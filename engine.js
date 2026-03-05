(function () {
  const SAVE_KEY = "zombie_choice_save_v5";
  const LEGACY_SAVE_KEYS = ["zombie_choice_save_v4", "zombie_choice_save_v3", "zombie_choice_save_v2"];
  const data = window.GAME_DATA;
  const MILESTONE_DAYS = [12, 24, 36, 48];

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function getStage(day) {
    if (day <= 5) return 1;
    if (day <= 14) return 2;
    if (day <= 28) return 3;
    if (day <= 48) return 4;
    return 5;
  }

  function getStatDef(key) {
    return data.statDefs.find(s => s.key === key);
  }

  function weightedPick(items, getWeight) {
    const weighted = items
      .map(item => ({ item, w: Math.max(0, getWeight(item)) }))
      .filter(x => x.w > 0);

    if (!weighted.length) return null;

    const total = weighted.reduce((sum, x) => sum + x.w, 0);
    let r = Math.random() * total;
    for (const x of weighted) {
      r -= x.w;
      if (r <= 0) return x.item;
    }
    return weighted[weighted.length - 1].item;
  }

  function makeInitialNpcRelations() {
    const rel = {};
    (data.npcDefs || []).forEach(npc => {
      rel[npc.id] = clamp(Number(npc.initial ?? 45), 0, 100);
    });
    return rel;
  }

  function getRoleDef(roleId) {
    const roles = data.profileRoles || [];
    return roles.find(r => r.id === roleId) || roles[0] || { id: "worker", company: "数珩股份", label: "综合岗", desc: "", startBonus: {} };
  }

  function profileMeta(state) {
    const npcs = getNpcView(state);
    const top = npcs[0];
    const low = npcs[npcs.length - 1];
    const role = getRoleDef(state.profile.role);

    return {
      name: state.profile.name,
      citizenTag: "数珩股份牛马打工人",
      roleLabel: role.label,
      companyLabel: role.company,
      statusLabel: state.flags.hasCommunity ? "社区协同中" : "流动求生中",
      topBond: top ? `${top.name}(${top.value})` : "-",
      lowBond: low ? `${low.name}(${low.value})` : "-"
    };
  }

  function tpl(text, state) {
    if (!text) return "";
    const district = data.districts[(state.day + state.turn) % data.districts.length] || "城区";
    const road = data.roads[(state.turn + state.day * 2) % data.roads.length] || "道路";
    const landmark = data.landmarks[(state.turn * 2 + state.day) % data.landmarks.length] || "地标";

    return String(text)
      .replaceAll("{name}", state.profile.name)
      .replaceAll("{district}", district)
      .replaceAll("{road}", road)
      .replaceAll("{landmark}", landmark);
  }

  function createStore(profileInput) {
    const base = deepClone(data.initialState);
    const name = (profileInput?.name || "匿名市民").replace(/\s+/g, "").slice(0, 16) || "匿名市民";
    const bestDays = Number(localStorage.getItem("zombie_survival_best_days") || 0) || 0;

    const selectedRole = getRoleDef(profileInput?.role);

    const state = {
      ...base,
      profile: { name, role: selectedRole.id },
      day: base.day,
      turn: 0,
      lastResult: "",
      currentEventId: null,
      currentTemplate: null,
      queue: [],
      log: [],
      seenEvents: {},
      recentEvents: [],
      storyMemory: {
        majorDecisions: [],
        routeHistory: [],
        decisionTags: []
      },
      arc: {
        path: null,
        milestonesDone: {},
        volatility: 0
      },
      npcRelations: makeInitialNpcRelations(),
      bestDays
    };

    if (selectedRole.startBonus) {
      for (const [key, delta] of Object.entries(selectedRole.startBonus)) {
        const def = getStatDef(key);
        if (!def) continue;
        state.stats[key] = clamp((state.stats[key] ?? 0) + delta, def.min, def.max);
      }
    }

    return state;
  }

  function normalizeState(raw) {
    const seeded = createStore(raw?.profile);
    if (!raw || typeof raw !== "object") return seeded;
    const mergedProfile = { ...seeded.profile, ...(raw.profile || {}) };
    const validRole = getRoleDef(mergedProfile.role);

    return {
      ...seeded,
      ...raw,
      stats: { ...seeded.stats, ...(raw.stats || {}) },
      flags: { ...seeded.flags, ...(raw.flags || {}) },
      profile: { ...mergedProfile, role: validRole.id },
      queue: Array.isArray(raw.queue) ? raw.queue : [],
      log: Array.isArray(raw.log) ? raw.log : [],
      seenEvents: raw.seenEvents || {},
      recentEvents: Array.isArray(raw.recentEvents) ? raw.recentEvents : [],
      storyMemory: raw.storyMemory || { majorDecisions: [], routeHistory: [], decisionTags: [] },
      arc: raw.arc || { path: null, milestonesDone: {}, volatility: 0 },
      npcRelations: { ...seeded.npcRelations, ...(raw.npcRelations || {}) },
      bestDays: Number(raw.bestDays || seeded.bestDays || 0)
    };
  }

  function matchComparators(value, rule) {
    if (rule.gte !== undefined && !(value >= rule.gte)) return false;
    if (rule.lte !== undefined && !(value <= rule.lte)) return false;
    if (rule.gt !== undefined && !(value > rule.gt)) return false;
    if (rule.lt !== undefined && !(value < rule.lt)) return false;
    if (rule.eq !== undefined && !(value === rule.eq)) return false;
    return true;
  }

  function matchEndingCondition(state, cond) {
    if (!cond) return true;
    if (cond.all && !cond.all.every(c => matchEndingCondition(state, c))) return false;
    if (cond.any && !cond.any.some(c => matchEndingCondition(state, c))) return false;
    if (cond.dayGte !== undefined && state.day < cond.dayGte) return false;
    if (cond.dayLte !== undefined && state.day > cond.dayLte) return false;

    if (cond.stats) {
      for (const [key, rule] of Object.entries(cond.stats)) {
        const value = state.stats[key] ?? 0;
        if (!matchComparators(value, rule)) return false;
      }
    }
    return true;
  }

  function applyNpcEffects(state, npcEffects) {
    if (!npcEffects) return;
    for (const [npcId, delta] of Object.entries(npcEffects)) {
      const current = state.npcRelations[npcId] ?? 45;
      state.npcRelations[npcId] = clamp(current + Number(delta || 0), 0, 100);

      if ((delta || 0) <= -10) {
        state.flags[`npc_${npcId}_enemy`] = true;
      }
      if ((delta || 0) >= 8) {
        state.flags[`npc_${npcId}_ally`] = true;
      }
    }
  }

  function applyEffects(state, effects) {
    if (!effects) return;

    if (effects.stats) {
      for (const [key, delta] of Object.entries(effects.stats)) {
        const def = getStatDef(key);
        if (!def) continue;
        state.stats[key] = clamp(state.stats[key] + delta, def.min, def.max);
      }
    }

    applyNpcEffects(state, effects.npc);

    if (effects.flagsSet) {
      for (const [k, v] of Object.entries(effects.flagsSet)) state.flags[k] = !!v;
    }

    if (effects.flagsClear) {
      for (const k of effects.flagsClear) state.flags[k] = false;
    }

    if (effects.queue) state.queue.push(...effects.queue);

    if (effects.decisionTagsAdd) {
      state.storyMemory.decisionTags.unshift(...effects.decisionTagsAdd);
      state.storyMemory.decisionTags = Array.from(new Set(state.storyMemory.decisionTags)).slice(0, 60);
    }
  }

  function getEventById(id) {
    return data.events.find(e => e.id === id) || null;
  }

  function eventMatchesContext(state, event) {
    if (!event) return false;

    if ((event.minDay || 1) > state.day) return false;
    if (event.maxDay && state.day > event.maxDay) return false;
    if (event.once !== false && state.seenEvents[event.id]) return false;
    if (state.recentEvents.includes(event.id)) return false;

    const reqAll = event.requiresFlagsAll || [];
    if (reqAll.length && !reqAll.every(f => !!state.flags[f])) return false;

    const reqAny = event.requiresAnyFlags || [];
    if (reqAny.length && !reqAny.some(f => !!state.flags[f])) return false;

    const forbid = event.forbidFlags || [];
    if (forbid.some(f => !!state.flags[f])) return false;

    if (event.requiresDecisionTagsAll) {
      const tags = state.storyMemory.decisionTags || [];
      if (!event.requiresDecisionTagsAll.every(t => tags.includes(t))) return false;
    }

    if (event.requiresDecisionTagsAny) {
      const tags = state.storyMemory.decisionTags || [];
      if (!event.requiresDecisionTagsAny.some(t => tags.includes(t))) return false;
    }

    if (event.forbidDecisionTags) {
      const tags = state.storyMemory.decisionTags || [];
      if (event.forbidDecisionTags.some(t => tags.includes(t))) return false;
    }

    if (event.requiresNpc) {
      for (const [npcId, rule] of Object.entries(event.requiresNpc)) {
        const value = state.npcRelations[npcId] ?? 45;
        if (!matchComparators(value, rule)) return false;
      }
    }

    return true;
  }

  function computeEventWeight(state, event) {
    let w = event.weight || 1;
    const stage = getStage(state.day);
    const scarcity = (100 - state.stats.supplies) / 100;

    if (stage >= 4 && event.category === "长期求生") w *= 1.18;
    if (stage <= 2 && event.category === "崩溃初期") w *= 1.1;
    if (state.stats.trust <= 25 && event.category === "组织重构") w *= 1.22;
    if (state.flags.betrayedCivilians && event.category === "高压消耗") w *= 1.16;
    if (state.flags.hasCommunity && event.category === "组织重构") w *= 1.1;
    if (scarcity >= 0.58 && /补给|仓储|交换|滤水/.test(event.title)) w *= 1.2;

    if (event.npcId) {
      const rel = state.npcRelations[event.npcId] ?? 45;
      if (rel >= 70) w *= 1.1;
      if (rel <= 30) w *= 1.14;
      if (state.flags[`npc_${event.npcId}_enemy`]) w *= 1.08;
    }

    return Math.max(0.1, w);
  }

  function buildTemplateEvent(state) {
    const template = weightedPick(data.templateEvents || [], t => {
      let w = 1;
      if (t.id === "t_supply_run" && state.stats.supplies <= 45) w *= 1.5;
      if (t.id === "t_night_defense" && state.stats.shelter <= 55) w *= 1.45;
      if (t.id === "t_relation_flash" && state.stats.trust <= 50) w *= 1.25;
      if (state.day >= 35) w *= 1.14;
      return w;
    });

    if (!template) return null;

    const district = data.districts[(state.day * 7 + state.turn) % data.districts.length];
    const road = data.roads[(state.turn * 5 + state.day) % data.roads.length];
    const landmark = data.landmarks[(state.turn * 3 + state.day * 2) % data.landmarks.length];

    const id = `${template.id}#${state.day}#${state.turn}`;
    return {
      id,
      isTemplate: true,
      baseId: template.id,
      category: template.category,
      title: tpl(template.title, state),
      body: tpl(template.body, state)
        .replaceAll("{district}", district)
        .replaceAll("{road}", road)
        .replaceAll("{landmark}", landmark),
      location: district,
      roads: [road],
      choices: template.choices
    };
  }

  function pickNextEvent(state) {
    const milestone = buildMilestoneEvent(state);
    if (milestone) return milestone;

    if (state.queue.length > 0) {
      const queuedId = state.queue.shift();
      const forced = getEventById(queuedId);
      if (eventMatchesContext(state, forced)) return forced;
    }

    const pool = data.events.filter(e => eventMatchesContext(state, e));
    if (pool.length) return weightedPick(pool, e => computeEventWeight(state, e));

    return buildTemplateEvent(state);
  }

  function resolveChoiceOutcome(choice) {
    if (!choice.outcomes || !choice.outcomes.length) return null;
    return weightedPick(choice.outcomes, o => o.weight || 1);
  }

  function buildNpcImpact(choice) {
    if (!choice?.effects?.npc) return [];
    return Object.entries(choice.effects.npc).map(([npcId, delta]) => {
      const npc = (data.npcDefs || []).find(n => n.id === npcId);
      return {
        id: npcId,
        name: npc?.name || npcId,
        delta: Math.round(Number(delta || 0) * 10) / 10
      };
    });
  }

  function collectEffectStats(map, effects, weight) {
    if (!effects?.stats) return;
    for (const [key, delta] of Object.entries(effects.stats)) {
      map[key] = (map[key] || 0) + delta * weight;
    }
  }

  function collectNpcImpact(map, effects, weight) {
    if (!effects?.npc) return;
    for (const [key, delta] of Object.entries(effects.npc)) {
      map[key] = (map[key] || 0) + delta * weight;
    }
  }

  function getChoiceImpact(choice) {
    const stats = {};
    const npcs = {};

    collectEffectStats(stats, choice.effects, 1);
    collectNpcImpact(npcs, choice.effects, 1);

    if (choice.outcomes?.length) {
      const total = choice.outcomes.reduce((sum, o) => sum + (o.weight || 1), 0) || 1;
      choice.outcomes.forEach(o => {
        const p = (o.weight || 1) / total;
        collectEffectStats(stats, o.effects, p);
        collectNpcImpact(npcs, o.effects, p);
      });
    }

    const npcImpact = Object.entries(npcs).map(([id, delta]) => {
      const npc = (data.npcDefs || []).find(n => n.id === id);
      return { id, name: npc?.name || id, delta: Math.round(delta * 10) / 10 };
    });

    return { stats, npcs: npcImpact };
  }

  function getArcLabel(path) {
    const labels = {
      mutual_aid: "互助路线",
      hardline: "铁壁路线",
      mobile_net: "机动网络路线",
      signal_hunt: "信号追踪路线"
    };
    return labels[path] || "未定";
  }

  function assessChoiceRisk(choice, event) {
    const text = `${choice.label} ${choice.result || ""}`;
    let risk = 42;
    if (/强夺|硬守|炸毁|对抗|清算|报复|冲突|突击/.test(text)) risk += 20;
    if (/公开|协同|分配|护送|复盘|调停/.test(text)) risk -= 10;
    if (event.category === "高压消耗") risk += 12;
    if (event.category === "长期求生") risk -= 5;
    return clamp(risk, 15, 88);
  }

  function applyChoiceVariance(state, event, choice) {
    const risk = assessChoiceRisk(choice, event);
    const resilience = (
      state.stats.health * 0.25 +
      state.stats.stamina * 0.25 +
      state.stats.trust * 0.2 +
      state.stats.shelter * 0.15 +
      (100 - state.stats.stress) * 0.15
    );
    const relationBoost = event.npcId ? ((state.npcRelations[event.npcId] ?? 50) - 50) * 0.35 : 0;
    const successChance = clamp(Math.round(resilience * 0.7 - risk + relationBoost), 12, 92);
    const roll = Math.floor(Math.random() * 100) + 1;
    const success = roll <= successChance;

    if (success) {
      state.arc.volatility = clamp((state.arc.volatility || 0) - 3, 0, 100);
      return { success: true, suffix: `（行动检定 ${roll}/${successChance} · 成功）` };
    }

    const penalty = {
      stats: {
        health: -clamp(Math.round((risk - 30) / 14), 1, 5),
        stress: clamp(Math.round(risk / 18), 2, 8),
        stamina: -clamp(Math.round((risk - 20) / 16), 1, 5),
        trust: -clamp(Math.round((risk - 25) / 20), 1, 4)
      }
    };
    applyEffects(state, penalty);
    state.arc.volatility = clamp((state.arc.volatility || 0) + 8, 0, 100);
    return { success: false, suffix: `（行动检定 ${roll}/${successChance} · 失误）` };
  }

  function buildMilestoneEvent(state) {
    const day = state.day;
    if (!MILESTONE_DAYS.includes(day)) return null;
    if (state.arc.milestonesDone?.[day]) return null;

    return {
      id: `milestone_${day}`,
      isMilestone: true,
      category: "长期求生",
      title: `生存里程碑 · 第${day}天`,
      body: "你们必须确定下一阶段战略，否则队伍会在争论中内耗殆尽。",
      location: "桂果园8号楼作战会议室",
      roads: ["桂平路", "桂林路"],
      choices: [
        {
          label: "确立互助分配制度（稳态）",
          result: "你把配给和轮班公开，社区粘性显著上升。",
          effects: { stats: { trust: 10, shelter: 6, supplies: -3, stress: -2 }, flagsSet: { hasCommunity: true }, decisionTagsAdd: ["arc_mutual_aid"] }
        },
        {
          label: "确立铁壁守线制度（防御）",
          result: "你们收缩边界并强化工事，短期安全提升。",
          effects: { stats: { shelter: 12, stamina: -2, trust: -2, stress: 1 }, decisionTagsAdd: ["arc_hardline"] }
        },
        {
          label: "确立机动网络制度（游击）",
          result: "固定据点缩小，外勤路线扩张，波动更大但机会更多。",
          effects: { stats: { stamina: 8, supplies: 5, shelter: -5, stress: 2 }, decisionTagsAdd: ["arc_mobile_net"] }
        },
        {
          label: "确立信号追踪制度（情报）",
          result: "你们把精力集中在监听与路由，信息优势提升。",
          effects: { stats: { supplies: 4, stress: -1, trust: 3 }, flagsSet: { hasRadio: true, metroCodeKnown: true }, decisionTagsAdd: ["arc_signal_hunt"] }
        }
      ]
    };
  }

  function checkDynamicEnding(state) {
    if (state.day < 40) return null;
    const allies = getNpcView(state).filter(n => n.value >= 68).length;
    const stable = state.stats.health >= 46 && state.stats.trust >= 50 && state.stats.shelter >= 52;
    if (!stable) return null;

    const arc = state.arc.path;
    if (arc === "mutual_aid" && allies >= 2) {
      return {
        title: "结局：互助共同体",
        text: "你把桂果园8号楼从求生据点带成了可持续社区。它不再只是躲避危险的壳，而是能产出秩序的节点。"
      };
    }
    if (arc === "hardline" && state.stats.shelter >= 70) {
      return {
        title: "结局：铁壁防线",
        text: "你用纪律和工事把走廊变成了边界。代价不小，但你们确实挺到了新的稳定期。"
      };
    }
    if (arc === "mobile_net" && state.stats.stamina >= 55) {
      return {
        title: "结局：机动生存网",
        text: "你把零散小队织成了可切换的网络。没有绝对安全点，却也几乎没有单点崩溃。"
      };
    }
    if (arc === "signal_hunt" && state.flags.hasRadio) {
      return {
        title: "结局：信号猎手",
        text: "你们靠监听与反监听建立了信息优势，在漕河泾废墟里抢先半步活了下来。"
      };
    }
    return null;
  }

  function applyDailyDecay(state) {
    const stage = getStage(state.day);
    const baseHunger = stage <= 2 ? 2 : stage === 3 ? 3 : 4;
    const baseStress = stage <= 2 ? 1 : stage === 3 ? 2 : 3;
    const baseSupply = stage <= 2 ? 2 : stage === 3 ? 2 : 3;
    const baseStamina = stage <= 2 ? 1 : stage === 3 ? 2 : 3;
    const extraThreat = Math.floor(state.day / 20);

    state.stats.hunger = clamp(state.stats.hunger + baseHunger + extraThreat, 0, 100);
    state.stats.stress = clamp(state.stats.stress + baseStress + (state.stats.shelter < 40 ? 1 : 0), 0, 100);
    state.stats.supplies = clamp(state.stats.supplies - baseSupply - (state.stats.trust < 25 ? 1 : 0), 0, 100);
    state.stats.stamina = clamp(state.stats.stamina - baseStamina - (state.stats.hunger > 75 ? 1 : 0), 0, 100);

    if (state.flags.hasCommunity) {
      state.stats.stress = clamp(state.stats.stress - 1, 0, 100);
      state.stats.trust = clamp(state.stats.trust + 1, 0, 100);
    }

    if (state.stats.supplies <= 12) {
      state.stats.health = clamp(state.stats.health - 2, 0, 100);
      state.stats.hunger = clamp(state.stats.hunger + 2, 0, 100);
    }

    if (state.stats.stress >= 80) {
      state.stats.trust = clamp(state.stats.trust - 2, 0, 100);
      state.stats.health = clamp(state.stats.health - 1, 0, 100);
    }

    if (state.stats.hunger >= 85) state.stats.health = clamp(state.stats.health - 2, 0, 100);
    if (state.stats.infection >= 65) state.stats.health = clamp(state.stats.health - 2, 0, 100);
    if (state.day >= 30) state.stats.infection = clamp(state.stats.infection + (Math.random() < 0.28 ? 1 : 0), 0, 100);
  }

  function settleTurn(state, event, actionLabel, result) {
    state.lastResult = result;
    const roadHint = event.roads?.[0] ? ` @${event.roads[0]}` : "";
    state.log.unshift(`第${state.day}天${roadHint}：${tpl(event.title, state)} -> ${tpl(actionLabel, state)}。${result}`);
    state.log = state.log.slice(0, 140);

    if (!event.isTemplate) state.seenEvents[event.id] = true;
    if (event.isMilestone) state.arc.milestonesDone[state.day] = true;
    state.recentEvents.unshift(event.baseId || event.id);
    state.recentEvents = state.recentEvents.slice(0, 12);

    state.storyMemory.majorDecisions.unshift(`${state.day}天:${tpl(actionLabel, state)}`);
    state.storyMemory.majorDecisions = state.storyMemory.majorDecisions.slice(0, 30);

    if (event.location) {
      state.storyMemory.routeHistory.unshift(event.location);
      state.storyMemory.routeHistory = state.storyMemory.routeHistory.slice(0, 20);
    }

    state.turn += 1;
    state.day += 1;
    applyDailyDecay(state);

    if (state.day % 10 === 0) {
      // 每10天给一点恢复，避免体验陷入“必死线性结局”
      applyEffects(state, { stats: { health: 2, stress: -2, trust: 1 } });
    }

    if (state.day > state.bestDays) {
      state.bestDays = state.day;
      localStorage.setItem("zombie_survival_best_days", String(state.bestDays));
    }

    state.currentEventId = null;
    state.currentTemplate = null;
  }

  function getNpcView(state) {
    const list = (data.npcDefs || []).map(def => {
      const value = clamp(Math.round(state.npcRelations[def.id] ?? def.initial ?? 45), 0, 100);
      let stance = "中立";
      if (value >= 75) stance = "坚实盟友";
      else if (value >= 60) stance = "合作稳定";
      else if (value <= 25) stance = "敌对";
      else if (value <= 40) stance = "紧张";

      return {
        id: def.id,
        name: def.name,
        role: def.role,
        value,
        stance,
        markedEnemy: !!state.flags[`npc_${def.id}_enemy`],
        markedAlly: !!state.flags[`npc_${def.id}_ally`]
      };
    });

    return list.sort((a, b) => b.value - a.value);
  }

  function getWorldView(state, event) {
    const district = event?.location || data.districts[(state.day + state.turn) % data.districts.length];
    const road = event?.roads?.[0] || data.roads[(state.day * 2 + state.turn) % data.roads.length];
    const pressure = clamp(
      Math.round(
        state.stats.infection * 0.31 +
        state.stats.stress * 0.25 +
        state.stats.hunger * 0.22 +
        (100 - state.stats.shelter) * 0.22
      ),
      0,
      100
    );

    const npcs = getNpcView(state);
    return {
      district,
      road,
      pressure,
      dayRecord: state.bestDays,
      chapter: data.meta.stages[getStage(state.day)],
      focalNpc: npcs[0]?.name || "-",
      arcLabel: getArcLabel(state.arc.path)
    };
  }

  function checkEnding(state) {
    const sorted = [...data.endings].sort((a, b) => b.priority - a.priority);
    const failure = sorted.find(e => matchEndingCondition(state, e.condition)) || null;
    if (failure) return failure;

    const dynamic = checkDynamicEnding(state);
    if (dynamic) {
      return {
        id: `dynamic_${state.arc.path || "generic"}`,
        title: dynamic.title,
        text: `${dynamic.text}\n\n路线评价: ${getArcLabel(state.arc.path)} · 波动值 ${state.arc.volatility}`
      };
    }
    return null;
  }

  const sceneMap = {
    崩溃初期: "combat",
    封锁裂解: "moral",
    组织重构: "bond",
    高压消耗: "scavenge",
    长期求生: "shelter"
  };

  const game = {
    state: createStore(),

    getRoleOptions() {
      return deepClone(data.profileRoles || []);
    },

    start(profileInput) {
      this.state = createStore(profileInput);
      const role = getRoleDef(this.state.profile.role);
      this.state.lastResult = `${this.state.profile.name}，数珩股份牛马打工人（${role.company}·${role.label}）。起点在漕河泾桂果园8号楼，通信中断前最后一条语音里只剩一句: 别等系统恢复，先活下来。`;
      this.state.log.unshift(`第1天：${this.state.lastResult}`);
      return this.getCurrentView(true);
    },

    reset(profileInput) {
      return this.start(profileInput || this.state.profile);
    },

    getCurrentView(forceNewEvent = false) {
      const ending = checkEnding(this.state);
      if (ending) {
        return {
          ended: true,
          stage: getStage(this.state.day),
          stageLabel: data.meta.stages[getStage(this.state.day)],
          day: this.state.day,
          category: "终局",
          sceneTheme: "zombie",
          title: tpl(ending.title, this.state),
          body: `${tpl(ending.text, this.state)}\n\n生存天数: ${this.state.day}天\n历史最高: ${this.state.bestDays}天`,
          result: "",
          choices: [{ id: "restart", label: "重新挑战", disabled: false, impact: { stats: {}, npcs: [] } }],
          stats: this.state.stats,
          profile: profileMeta(this.state),
          npcs: getNpcView(this.state),
          memory: this.state.storyMemory,
          log: this.state.log,
          world: getWorldView(this.state, null)
        };
      }

      let event = null;
      if (!forceNewEvent && this.state.currentEventId) event = getEventById(this.state.currentEventId);
      if (!forceNewEvent && !event && this.state.currentTemplate) event = this.state.currentTemplate;

      if (forceNewEvent || !event) {
        event = pickNextEvent(this.state);
        if (!event) event = buildTemplateEvent(this.state);

        if (event?.isTemplate || event?.isMilestone) {
          this.state.currentTemplate = event;
          this.state.currentEventId = null;
        } else {
          this.state.currentEventId = event?.id || null;
          this.state.currentTemplate = null;
        }
      }

      if (!event) {
        return {
          ended: true,
          stage: getStage(this.state.day),
          stageLabel: data.meta.stages[getStage(this.state.day)],
          day: this.state.day,
          category: "终局",
          sceneTheme: "signal",
          title: "结局：信号沉默",
          body: "没有可触发的新线索，城市像被剪断时间线。",
          result: "",
          choices: [{ id: "restart", label: "重新挑战", disabled: false, impact: { stats: {}, npcs: [] } }],
          stats: this.state.stats,
          profile: profileMeta(this.state),
          npcs: getNpcView(this.state),
          memory: this.state.storyMemory,
          log: this.state.log,
          world: getWorldView(this.state, null)
        };
      }

      return {
        ended: false,
        stage: getStage(this.state.day),
        stageLabel: data.meta.stages[getStage(this.state.day)],
        day: this.state.day,
        eventId: event.id,
        category: event.category || "未知",
        sceneTheme: sceneMap[event.category] || "neutral",
        title: `第${this.state.day}天 · ${tpl(event.title, this.state)}`,
        body: `${tpl(event.body, this.state)}\n\n地点: ${event.location || "未知片区"}${event.roads?.length ? ` · 路线: ${event.roads.join(" / ")}` : ""}`,
        result: this.state.lastResult || "",
        choices: event.choices.map((choice, idx) => ({
          id: idx,
          label: tpl(choice.label, this.state),
          disabled: false,
          impact: getChoiceImpact(choice),
          npcImpactDirect: buildNpcImpact(choice)
        })),
        stats: this.state.stats,
        profile: profileMeta(this.state),
        npcs: getNpcView(this.state),
        memory: this.state.storyMemory,
        log: this.state.log,
        world: getWorldView(this.state, event)
      };
    },

    choose(choiceId) {
      const event = this.state.currentTemplate || getEventById(this.state.currentEventId);
      if (!event) return this.getCurrentView(true);

      const choice = event.choices[choiceId];
      if (!choice) return this.getCurrentView(false);

      applyEffects(this.state, choice.effects);
      let result = tpl(choice.result || "", this.state);

      if (event.isMilestone) {
        if (/互助/.test(choice.label)) this.state.arc.path = "mutual_aid";
        else if (/铁壁|守线/.test(choice.label)) this.state.arc.path = "hardline";
        else if (/机动/.test(choice.label)) this.state.arc.path = "mobile_net";
        else if (/信号|监听/.test(choice.label)) this.state.arc.path = "signal_hunt";
      }

      const variance = applyChoiceVariance(this.state, event, choice);
      result = `${result}${variance.suffix}`;

      const outcome = resolveChoiceOutcome(choice);
      if (outcome) {
        if (outcome.effects) applyEffects(this.state, outcome.effects);
        if (outcome.text) result = `${result} ${tpl(outcome.text, this.state)}`.trim();
      }

      settleTurn(this.state, event, choice.label, result);
      return this.getCurrentView(true);
    },

    save() {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.state));
      return "存档已写入本地。";
    },

    load() {
      let raw = localStorage.getItem(SAVE_KEY);
      if (!raw) {
        for (const key of LEGACY_SAVE_KEYS) {
          raw = localStorage.getItem(key);
          if (raw) break;
        }
      }

      if (!raw) return { ok: false, message: "没有可读取的存档。" };

      try {
        this.state = normalizeState(JSON.parse(raw));
        return { ok: true, message: "存档读取成功。" };
      } catch (_) {
        return { ok: false, message: "存档损坏，读取失败。" };
      }
    }
  };

  window.GameEngine = game;
})();

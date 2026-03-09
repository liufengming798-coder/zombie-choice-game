(function () {
  const SAVE_KEY = "zombie_choice_save_v6";
  const LEGACY_SAVE_KEYS = ["zombie_choice_save_v5", "zombie_choice_save_v4", "zombie_choice_save_v3", "zombie_choice_save_v2"];
  const data = window.GAME_DATA;
  const MILESTONE_DAYS = [5, 10, 16, 22];

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function getStage(day) {
    if (day <= 4) return 1;
    if (day <= 9) return 2;
    if (day <= 15) return 3;
    if (day <= 22) return 4;
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
    return roles.find(r => r.id === roleId) || roles[0] || { id: "worker", company: "雾港大厦", label: "综合岗", desc: "", startBonus: {} };
  }

  function getNpcName(npcId) {
    return (data.npcDefs || []).find(npc => npc.id === npcId)?.name || npcId;
  }

  function defaultShelterModules() {
    return {
      water: 40,
      power: 30,
      medical: 35,
      defense: 32,
      intel: 22
    };
  }

  function averageModuleState(modules) {
    const values = Object.values(modules || {});
    if (!values.length) return 0;
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }

  function pushUniqueFront(list, value, limit) {
    if (!value) return;
    list.unshift(value);
    const deduped = Array.from(new Set(list));
    list.length = 0;
    list.push(...deduped.slice(0, limit));
  }

  function addMemoryTrace(state, text) {
    if (!text) return;
    pushUniqueFront(state.storyMemory.memoryTraces, text, 24);
  }

  function addDebt(state, debt) {
    if (!debt?.id) return;
    state.debts = state.debts.filter(item => item.id !== debt.id);
    const normalized = {
      id: debt.id,
      title: debt.title || "未命名债务",
      dueDay: Number(debt.dueDay || state.day + 2),
      severity: debt.severity || "medium",
      note: debt.note || "",
      escalated: false
    };
    state.debts.unshift(normalized);
    state.debts = state.debts.slice(0, 20);
    addMemoryTrace(state, `新承诺: ${normalized.title}`);
  }

  function clearDebt(state, debtId) {
    if (!debtId) return;
    state.debts = state.debts.filter(item => item.id !== debtId);
  }

  function syncDerivedState(state) {
    const shelterAvg = averageModuleState(state.shelterModules);
    state.stats.shelter = clamp(Math.round((state.stats.shelter * 0.55) + shelterAvg * 0.45), 0, 100);
    state.stats.fatigue = clamp(100 - (state.stats.stamina ?? 50), 0, 100);

    const debtLoad = (state.debts || []).length;
    const alliedCount = Object.values(state.npcRelations || {}).filter(value => value >= 68).length;
    const morale = 55 + state.stats.trust * 0.28 - state.stats.stress * 0.34 - debtLoad * 4 + alliedCount * 3;
    state.stats.morale = clamp(Math.round(morale), 0, 100);

    const threat = (
      state.stats.infection * 0.22 +
      state.stats.stress * 0.18 +
      state.stats.hunger * 0.16 +
      state.stats.fatigue * 0.14 +
      (100 - state.stats.shelter) * 0.18 +
      (100 - state.shelterModules.defense) * 0.12
    );
    state.stats.threat = clamp(Math.round(threat), 0, 100);
  }

  function applyModuleEffects(state, moduleEffects) {
    if (!moduleEffects) return;
    const nextModules = state.shelterModules || defaultShelterModules();
    for (const [key, delta] of Object.entries(moduleEffects)) {
      nextModules[key] = clamp((nextModules[key] ?? 40) + Number(delta || 0), 0, 100);
    }
    state.shelterModules = nextModules;
  }

  function scheduleConsequence(state, consequence) {
    if (!consequence) return;
    const dueDay = Number(consequence.dueDay || (state.day + Number(consequence.dueIn || 2)));
    state.delayedConsequences.push({
      id: consequence.id || `cons_${state.day}_${state.turn}_${state.delayedConsequences.length}`,
      dueDay,
      type: consequence.type || "aftershock",
      text: consequence.text || "一项未明后果正在逼近。",
      sourceChoice: consequence.sourceChoice || "",
      payload: deepClone(consequence.payload || {}),
      resolved: false
    });
    state.delayedConsequences = state.delayedConsequences
      .filter(item => !item.resolved)
      .sort((a, b) => a.dueDay - b.dueDay)
      .slice(0, 40);
  }

  function processDueConsequences(state) {
    const pending = (state.delayedConsequences || []).filter(item => !item.resolved && item.dueDay <= state.day);
    if (!pending.length) return [];

    const applied = [];
    pending.forEach(item => {
      item.resolved = true;
      applyEffects(state, item.payload);
      const line = `第${state.day}天：${item.text}`;
      state.log.unshift(line);
      addMemoryTrace(state, `后果落地: ${item.text}`);
      applied.push(line);
    });
    state.log = state.log.slice(0, 140);
    syncDerivedState(state);
    return applied;
  }

  function processOverdueDebts(state) {
    const overdue = (state.debts || []).filter(item => !item.escalated && item.dueDay < state.day);
    if (!overdue.length) return [];

    const lines = [];
    overdue.forEach(item => {
      item.escalated = true;
      const severity = item.severity || "medium";
      const penalty = severity === "high"
        ? { stats: { trust: -5, stress: 4, morale: -4 }, modules: { defense: -2, intel: -2 } }
        : severity === "low"
          ? { stats: { trust: -2, stress: 1, morale: -1 }, modules: { intel: -1 } }
          : { stats: { trust: -3, stress: 2, morale: -2 }, modules: { defense: -1, intel: -1 } };
      applyEffects(state, penalty);
      const line = `第${state.day}天：你失约了，${item.title}开始反噬。`;
      state.log.unshift(line);
      addMemoryTrace(state, `失约后果: ${item.title}`);
      lines.push(line);
    });
    state.log = state.log.slice(0, 140);
    return lines;
  }

  function buildChoiceRiskTags(choice, event) {
    const text = `${choice?.label || ""} ${choice?.result || ""}`;
    const tags = [];
    if (/炸毁|强夺|报复|清算|对抗|突破|诱饵/.test(text)) tags.push("高冲突");
    if (/公开|护送|分配|接纳|协助|监督/.test(text)) tags.push("关系押注");
    if (/只通知核心|拒绝|切断|封门|退出会议|独立/.test(text)) tags.push("延迟后果");
    if (/炸毁|清洗|倒向|抛弃|只通知核心/.test(text)) tags.push("不可逆");
    if (event?.category === "高压消耗") tags.push("高疲劳");
    if (choice?.effects?.flagsSet?.betrayedCivilians) tags.push("名声风险");
    if (choice?.effects?.debtsAdd?.length) tags.push("承诺债务");
    if (choice?.effects?.delayedConsequences?.length) tags.push("延迟后果");
    if (choice?.effects?.memoriesAdd && Object.keys(choice.effects.memoriesAdd).length) tags.push("会被记住");
    if (choice?.effects?.modules) tags.push("据点代价");
    return Array.from(new Set(tags)).slice(0, 3);
  }

  function buildBriefing(state) {
    const items = [];
    if (state.stats.hunger >= 70) items.push({ level: "high", text: "配给正在失控，饥饿开始破坏判断。" });
    if (state.stats.stress >= 68) items.push({ level: "high", text: "队伍压抑值过高，今晚容易爆发争执。" });
    if (state.stats.threat >= 70) items.push({ level: "high", text: "外部威胁升高，防线和噪音管理必须优先。" });
    if (state.shelterModules.medical <= 35) items.push({ level: "medium", text: "医疗角接近枯竭，再有伤病就会压垮据点。" });
    if (state.shelterModules.power <= 30) items.push({ level: "medium", text: "电力不足，夜间行动和广播都会失真。" });
    if ((state.debts || []).length) {
      const debt = state.debts[0];
      items.push({ level: debt.severity === "high" ? "high" : "medium", text: `未兑现承诺: ${debt.title}` });
    }
    if ((state.delayedConsequences || []).some(item => !item.resolved && item.dueDay <= state.day + 1)) {
      items.push({ level: "medium", text: "过去的决定正在逼近，明天前会有后果落地。" });
    }

    if (!items.length) {
      items.push({ level: "low", text: "局面暂时可控，但这通常只说明风暴还没到。" });
    }

    return items.slice(0, 3);
  }

  function profileMeta(state) {
    const npcs = getNpcView(state);
    const top = npcs[0];
    const low = npcs[npcs.length - 1];
    const role = getRoleDef(state.profile.role);

    return {
      name: state.profile.name,
      citizenTag: data.meta.identityTag || "雾港幸存者",
      roleLabel: role.label,
      companyLabel: role.company,
      statusLabel: state.flags.hasCommunity ? "社区协同中" : "封楼求生中",
      topBond: top ? `${top.name}(${top.value})` : "-",
      lowBond: low ? `${low.name}(${low.value})` : "-",
      moraleLabel: state.stats.morale >= 65 ? "还能稳住" : state.stats.morale >= 40 ? "勉强维持" : "濒临失控"
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
        decisionTags: [],
        memoryTraces: []
      },
      arc: {
        path: null,
        milestonesDone: {},
        volatility: 0
      },
      delayedConsequences: [],
      debts: [],
      npcMemory: {},
      shelterModules: { ...defaultShelterModules(), ...(base.shelterModules || {}) },
      lastResolvedDay: 0,
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

    syncDerivedState(state);
    return state;
  }

  function normalizeState(raw) {
    const seeded = createStore(raw?.profile);
    if (!raw || typeof raw !== "object") return seeded;
    const mergedProfile = { ...seeded.profile, ...(raw.profile || {}) };
    const validRole = getRoleDef(mergedProfile.role);

    const normalized = {
      ...seeded,
      ...raw,
      stats: { ...seeded.stats, ...(raw.stats || {}) },
      flags: { ...seeded.flags, ...(raw.flags || {}) },
      profile: { ...mergedProfile, role: validRole.id },
      queue: Array.isArray(raw.queue) ? raw.queue : [],
      log: Array.isArray(raw.log) ? raw.log : [],
      seenEvents: raw.seenEvents || {},
      recentEvents: Array.isArray(raw.recentEvents) ? raw.recentEvents : [],
      storyMemory: {
        majorDecisions: raw.storyMemory?.majorDecisions || [],
        routeHistory: raw.storyMemory?.routeHistory || [],
        decisionTags: raw.storyMemory?.decisionTags || [],
        memoryTraces: raw.storyMemory?.memoryTraces || []
      },
      arc: raw.arc || { path: null, milestonesDone: {}, volatility: 0 },
      delayedConsequences: Array.isArray(raw.delayedConsequences) ? raw.delayedConsequences : [],
      debts: Array.isArray(raw.debts) ? raw.debts : [],
      npcMemory: raw.npcMemory || {},
      shelterModules: { ...seeded.shelterModules, ...(raw.shelterModules || {}) },
      lastResolvedDay: Number(raw.lastResolvedDay || 0),
      npcRelations: { ...seeded.npcRelations, ...(raw.npcRelations || {}) },
      bestDays: Number(raw.bestDays || seeded.bestDays || 0)
    };
    syncDerivedState(normalized);
    return normalized;
  }

  function matchComparators(value, rule) {
    if (rule.gte !== undefined && !(value >= rule.gte)) return false;
    if (rule.lte !== undefined && !(value <= rule.lte)) return false;
    if (rule.gt !== undefined && !(value > rule.gt)) return false;
    if (rule.lt !== undefined && !(value < rule.lt)) return false;
    if (rule.eq !== undefined && !(value === rule.eq)) return false;
    return true;
  }

  function matchStateCondition(state, cond) {
    if (!cond) return true;
    if (cond.all && !cond.all.every(c => matchStateCondition(state, c))) return false;
    if (cond.any && !cond.any.some(c => matchStateCondition(state, c))) return false;
    if (cond.dayGte !== undefined && state.day < cond.dayGte) return false;
    if (cond.dayLte !== undefined && state.day > cond.dayLte) return false;
    if (cond.stageGte !== undefined && getStage(state.day) < cond.stageGte) return false;
    if (cond.stageLte !== undefined && getStage(state.day) > cond.stageLte) return false;

    if (cond.stats) {
      for (const [key, rule] of Object.entries(cond.stats)) {
        const value = state.stats[key] ?? 0;
        if (!matchComparators(value, rule)) return false;
      }
    }

    if (cond.flagsAll && !cond.flagsAll.every(f => !!state.flags[f])) return false;
    if (cond.flagsAny && !cond.flagsAny.some(f => !!state.flags[f])) return false;
    if (cond.flagsNot && cond.flagsNot.some(f => !!state.flags[f])) return false;

    const debts = state.debts || [];
    if (cond.debtsAll && !cond.debtsAll.every(id => debts.some(item => item.id === id && !item.escalated))) return false;
    if (cond.debtsAny && !cond.debtsAny.some(id => debts.some(item => item.id === id && !item.escalated))) return false;
    if (cond.debtsNot && cond.debtsNot.some(id => debts.some(item => item.id === id && !item.escalated))) return false;

    const tags = state.storyMemory?.decisionTags || [];
    if (cond.decisionTagsAll && !cond.decisionTagsAll.every(t => tags.includes(t))) return false;
    if (cond.decisionTagsAny && !cond.decisionTagsAny.some(t => tags.includes(t))) return false;
    if (cond.decisionTagsNot && cond.decisionTagsNot.some(t => tags.includes(t))) return false;

    if (cond.npc) {
      for (const [npcId, rule] of Object.entries(cond.npc)) {
        const value = state.npcRelations[npcId] ?? 45;
        if (!matchComparators(value, rule)) return false;
      }
    }

    if (cond.npcMemoryAll) {
      for (const [npcId, memories] of Object.entries(cond.npcMemoryAll)) {
        const seen = state.npcMemory?.[npcId] || [];
        if (!memories.every(memory => seen.includes(memory))) return false;
      }
    }

    if (cond.npcMemoryAny) {
      const matched = Object.entries(cond.npcMemoryAny).every(([npcId, memories]) => {
        const seen = state.npcMemory?.[npcId] || [];
        return memories.some(memory => seen.includes(memory));
      });
      if (!matched) return false;
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
        if (key === "fatigue") {
          state.stats.stamina = clamp((state.stats.stamina ?? 50) - delta, 0, 100);
          continue;
        }
        if (key === "morale") {
          state.stats.stress = clamp((state.stats.stress ?? 50) - Math.round(delta * 0.6), 0, 100);
          state.stats.trust = clamp((state.stats.trust ?? 50) + Math.round(delta * 0.35), 0, 100);
          continue;
        }
        if (key === "threat") {
          state.stats.stress = clamp((state.stats.stress ?? 50) + Math.round(delta * 0.45), 0, 100);
          continue;
        }
        const def = getStatDef(key);
        if (!def) continue;
        state.stats[key] = clamp(state.stats[key] + delta, def.min, def.max);
      }
    }

    applyNpcEffects(state, effects.npc);
    applyModuleEffects(state, effects.modules);

    if (effects.flagsSet) {
      for (const [k, v] of Object.entries(effects.flagsSet)) state.flags[k] = !!v;
    }

    if (effects.flagsClear) {
      for (const k of effects.flagsClear) state.flags[k] = false;
    }

    if (effects.queue) state.queue.push(...effects.queue);

    if (effects.debtsAdd) {
      effects.debtsAdd.forEach(debt => addDebt(state, debt));
    }

    if (effects.debtsClear) {
      effects.debtsClear.forEach(id => clearDebt(state, id));
    }

    if (effects.memoriesAdd) {
      for (const [npcId, memories] of Object.entries(effects.memoriesAdd)) {
        const target = state.npcMemory[npcId] || [];
        memories.forEach(memory => {
          pushUniqueFront(target, memory, 12);
          addMemoryTrace(state, `${getNpcName(npcId)}记住了: ${memory}`);
        });
        state.npcMemory[npcId] = target;
      }
    }

    if (effects.delayedConsequences) {
      effects.delayedConsequences.forEach(consequence => scheduleConsequence(state, consequence));
    }

    if (effects.decisionTagsAdd) {
      state.storyMemory.decisionTags.unshift(...effects.decisionTagsAdd);
      state.storyMemory.decisionTags = Array.from(new Set(state.storyMemory.decisionTags)).slice(0, 60);
    }

    syncDerivedState(state);
  }

  function getEventById(id) {
    return data.events.find(e => e.id === id) || null;
  }

  function eventMatchesContext(state, event) {
    if (!event) return false;
    if (event.condition && !matchStateCondition(state, event.condition)) return false;

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

  function choiceMatchesState(state, choice) {
    return matchStateCondition(state, choice?.condition);
  }

  function getChoiceLockReason(choice) {
    return choice?.requirementText || "条件不足";
  }

  function inferArcFromChoice(choice) {
    if (choice?.arcPath) return choice.arcPath;
    const text = `${choice?.label || ""} ${choice?.result || ""}`;
    if (/收容|互助|公开|名单|照顾|共识/.test(text)) return "mutual_aid";
    if (/封层|铁律|门禁|守线|隔离/.test(text)) return "hardline";
    if (/连桥|转移|游走|分段|窗口/.test(text)) return "mobile_net";
    if (/广播|频段|信标|监听|真相/.test(text)) return "signal_hunt";
    return null;
  }

  function getRiskLabel(score) {
    if (score <= 34) return "低风险";
    if (score <= 58) return "中风险";
    return "高风险";
  }

  function getCurrentObjective(state) {
    if (!state.flags.securedFloor17) {
      return "先稳住 17 层门禁，决定今晚谁能留在灯下。";
    }
    if (!state.flags.hasRadio) {
      return "打通 19 层录音棚或其他窄频源，否则你只是在黑里猜。";
    }
    if (!state.flags.generatorOnline) {
      return "恢复备用电，没电就没有门禁、药箱和信标。";
    }
    if (!state.flags.bridgeMapped && !state.flags.escapePlanKnown) {
      return "摸清空中连桥和外部撤离窗口，给团队一条真正能走的路。";
    }
    if (!state.flags.archiveTruth) {
      return "进入档案夹层，弄清雾潮是事故、筛选，还是有人在导演。";
    }
    if (!state.flags.beaconReady && !state.flags.truthOnAir && !state.flags.sealedLevels) {
      return "做最终路线决策：广播、转移、还是彻底封层。";
    }
    if (state.arc.path === "signal_hunt") {
      return "把频段和真相握在自己手里，让整栋楼先你一步听见未来。";
    }
    if (state.arc.path === "mobile_net") {
      return "维持连桥窗口与流动补线，避免任何单点一次性崩掉。";
    }
    if (state.arc.path === "hardline") {
      return "守住封层秩序，确保每一扇门都先听你的。";
    }
    return "让这栋楼从临时避难点变成能撑过下一个星期的共同体。";
  }

  function getSignalFeed(state) {
    if (state.flags.truthOnAir) {
      return "窄频回路：\"W-17 不是事故。重复，W-17 不是事故。\"";
    }
    if (state.flags.archiveTruth) {
      return "档案磁带：\"雾潮先在封闭楼宇做压力测试，名单早就写好了。\"";
    }
    if (state.flags.beaconReady) {
      return "天台校准中：每亮一次灯，都可能把撤离者和追踪者一起引来。";
    }
    if (state.flags.hasRadio) {
      return "19 层杂讯里反复出现一句话：\"首批撤离名单是假的。\"";
    }
    if (state.flags.bridgeMapped) {
      return "连桥风切声下偶尔有敲击节律，像是对面楼在试图报平安。";
    }
    return "整栋楼只剩机械风声和手机断网提示音。还没有稳定信号。";
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
    if ((state.debts || []).length && /^zone_/.test(event.id)) w *= 0.72;
    if ((state.delayedConsequences || []).some(item => !item.resolved && item.dueDay <= state.day + 1) && /^zone_/.test(event.id)) w *= 0.64;
    if (/^zone_/.test(event.id) && state.day <= 14) w *= 0.78;
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

  function getObjectiveView(state) {
    const dueDebt = (state.debts || []).slice().sort((a, b) => a.dueDay - b.dueDay)[0] || null;
    if (dueDebt) {
      return {
        title: "先处理旧账",
        body: `${dueDebt.title}，最晚第${dueDebt.dueDay}天前要回应。`,
        tone: dueDebt.severity === "high" ? "danger" : "warn"
      };
    }
    if (state.stats.threat >= 68) {
      return {
        title: "优先稳住防线",
        body: "外部威胁已经抬头，任何高噪音和失误都会立刻反噬据点。",
        tone: "danger"
      };
    }
    if (state.stats.morale <= 40) {
      return {
        title: "先稳住人心",
        body: "最大的风险不是缺资源，而是有人开始不想再撑下去。",
        tone: "warn"
      };
    }
    return {
      title: "把今天活成明天",
      body: "在资源、关系和底线之间维持平衡，不要只赚眼前收益。",
      tone: "stable"
    };
  }

  function getArcLabel(path) {
    const labels = {
      mutual_aid: "收容协定",
      hardline: "封层铁律",
      mobile_net: "流动补线",
      signal_hunt: "广播回路"
    };
    return labels[path] || "未定";
  }

  function assessChoiceRisk(choice, event) {
    if (choice?.risk !== undefined) return clamp(Number(choice.risk), 10, 95);
    const text = `${choice.label} ${choice.result || ""}`;
    let risk = 42;
    if (/强夺|硬守|炸毁|对抗|清算|报复|冲突|突击|诱饵|独走/.test(text)) risk += 20;
    if (/公开|协同|分配|护送|复盘|调停|名单|照顾|广播/.test(text)) risk -= 10;
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
      title: `封楼议程 · 第${day}天`,
      body: "整栋楼开始要求一个明确方向。你不再只是处理眼前麻烦，而是在决定这群人未来会成为什么样的人。",
      location: "17层封楼会议室",
      roads: ["电梯厅", "东侧消防梯"],
      choices: [
        {
          label: "确立收容协定，优先稳住人心",
          result: "你把配给、值班和收容名额都摆到明面上，楼层第一次像一个整体。",
          arcPath: "mutual_aid",
          risk: 30,
          effects: { stats: { trust: 10, shelter: 6, supplies: -3, stress: -2 }, flagsSet: { hasCommunity: true, openedRefugeFloor: true }, decisionTagsAdd: ["arc_mutual_aid", "aid_protocol"] }
        },
        {
          label: "确立封层铁律，先让门听命",
          result: "你开始按区域封门、配钥匙、立规矩，秩序感上来了，呼吸也更紧了。",
          arcPath: "hardline",
          risk: 44,
          effects: { stats: { shelter: 12, stamina: -2, trust: -2, stress: 1 }, flagsSet: { sealedLevels: true }, decisionTagsAdd: ["arc_hardline", "iron_protocol"] }
        },
        {
          label: "确立流动补线，把连桥变成生命线",
          result: "你缩小固定据点，换来更灵活的窗口和更大的不确定性。",
          arcPath: "mobile_net",
          risk: 52,
          effects: { stats: { stamina: 8, supplies: 5, shelter: -5, stress: 2 }, flagsSet: { bridgeMapped: true, escapePlanKnown: true }, decisionTagsAdd: ["arc_mobile_net", "mobile_protocol"] }
        },
        {
          label: "确立广播回路，用真相换先手",
          result: "你们把最稳的人力投给频段、录音和信标，开始靠信息而不是运气活着。",
          arcPath: "signal_hunt",
          risk: 38,
          effects: { stats: { supplies: 4, stress: -1, trust: 3 }, flagsSet: { hasRadio: true, metroCodeKnown: true }, decisionTagsAdd: ["arc_signal_hunt", "signal_protocol"] }
        }
      ]
    };
  }

  function checkDynamicEnding(state) {
    return null;
  }

  function buildCompositeEnding(state) {
    if (state.day < 22) return null;

    let survival = null;
    if (state.flags.sacrificeMade && state.flags.sealedLevels) {
      survival = {
        key: "keeper",
        title: "结局：关门之后",
        text: "你没有真正离开这栋楼，而是把自己留成了它最后还能运转的一部分。人先走了，规则、灯和门留在你身后继续工作。"
      };
    } else if (state.flags.escapePlanKnown && state.flags.bridgeMapped && state.stats.health >= 24) {
      survival = {
        key: "evac",
        title: "结局：穿桥离场",
        text: "你最终没有把命押在一处据点，而是带着人从窗口和连桥里挤出了一条生路。活下来的方式不是坚守，而是不断切线、换路、带人穿过去。"
      };
    } else if (state.flags.hasCommunity && state.stats.shelter >= 45) {
      survival = {
        key: "hold",
        title: "结局：17层还亮着",
        text: "外面的秩序没有回来，但你硬把17层熬成了一个还能继续活人的地方。它不再只是躲命的楼层，而是开始像一个会自己维持下去的小社会。"
      };
    }
    if (!survival) return null;

    const allies = getNpcView(state).filter(n => n.value >= 68).length;
    let relation = null;
    if (state.stats.trust <= 26) {
      relation = {
        key: "isolated",
        text: "只是大多数人不再把你当同伴，而是把你当成那种必须服从、却不想靠近的决定本身。"
      };
    } else if (allies >= 3) {
      relation = {
        key: "allied",
        text: "到最后，仍有人愿意继续站在你旁边，而不是只站在你后面等命令。你留下的不是服从链，而是真正还在工作的关系。"
      };
    } else {
      relation = {
        key: "fragile",
        text: "你们还在一起，但那更像勉强没散，而不是稳稳抱成了一团。没人彻底离开，也没人再敢把心完全交出来。"
      };
    }

    let persona = null;
    if (state.flags.betrayedCivilians || state.flags.liedToGroup || state.stats.morale <= 28) {
      persona = {
        key: "cold",
        text: "你活下来靠的不是运气，而是一次次把代价往更窄的人群外推。最后留下来的秩序很有效，也很冷，冷到很多人直到活下来都没法原谅。"
      };
    } else if (state.flags.promisedNoOneLeft || state.stats.trust >= 62) {
      persona = {
        key: "keeper",
        text: "你做过很多难看的决定，但大多数时候，你没有先把人从名单上划掉。你守住的不是干净，而是那条‘别先把谁扔出去’的底线。"
      };
    } else {
      persona = {
        key: "gray",
        text: "你既没有干净地守住底线，也没有彻底把自己交给效率。你只是一直在折中里活到了最后，而那些折中会跟着你很久。"
      };
    }

    return {
      id: `composite_${survival.key}_${relation.key}_${persona.key}`,
      title: survival.title,
      text: `${survival.text}\n\n${relation.text}\n\n${persona.text}`
    };
  }

  function applyDailyDecay(state) {
    const stage = getStage(state.day);
    const baseHunger = stage <= 2 ? 2 : stage === 3 ? 2 : 2;
    const baseStress = stage <= 3 ? 1 : 2;
    const baseSupply = stage <= 3 ? 1 : 2;
    const baseStamina = stage <= 2 ? 1 : 2;
    const extraThreat = Math.floor(state.day / 20);

    state.stats.hunger = clamp(state.stats.hunger + baseHunger + extraThreat, 0, 100);
    state.stats.stress = clamp(state.stats.stress + baseStress + (state.stats.shelter < 40 ? 1 : 0), 0, 100);
    state.stats.supplies = clamp(
      state.stats.supplies - baseSupply - (state.stats.trust < 25 ? 1 : 0) - (state.stats.morale >= 60 ? -1 : 0),
      0,
      100
    );
    state.stats.stamina = clamp(state.stats.stamina - baseStamina - (state.stats.hunger > 75 ? 1 : 0), 0, 100);

    if (state.flags.hasCommunity) {
      state.stats.stress = clamp(state.stats.stress - 1, 0, 100);
      state.stats.trust = clamp(state.stats.trust + 1, 0, 100);
    }

    if (state.flags.generatorOnline) {
      state.stats.stress = clamp(state.stats.stress - 1, 0, 100);
      state.stats.shelter = clamp(state.stats.shelter + 1, 0, 100);
    }

    if (state.flags.openedRefugeFloor) {
      state.stats.trust = clamp(state.stats.trust + 1, 0, 100);
      state.stats.supplies = clamp(state.stats.supplies - (state.stats.morale >= 55 ? 0 : 1), 0, 100);
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
    if (state.day >= 18) state.stats.infection = clamp(state.stats.infection + (Math.random() < 0.22 ? 1 : 0), 0, 100);

    state.shelterModules.water = clamp(state.shelterModules.water - (state.stats.hunger >= 75 ? 2 : 1), 0, 100);
    state.shelterModules.power = clamp(state.shelterModules.power - (state.flags.generatorOnline ? 0 : 1), 0, 100);
    state.shelterModules.medical = clamp(state.shelterModules.medical - (state.stats.infection >= 50 ? 2 : 1), 0, 100);
    state.shelterModules.defense = clamp(state.shelterModules.defense - (state.stats.stress >= 70 ? 2 : 1), 0, 100);
    state.shelterModules.intel = clamp(state.shelterModules.intel - (state.flags.hasRadio ? 0 : 1), 0, 100);
    syncDerivedState(state);
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
    addMemoryTrace(state, `${state.day}天做过: ${tpl(actionLabel, state)}`);

    if (event.location) {
      state.storyMemory.routeHistory.unshift(event.location);
      state.storyMemory.routeHistory = state.storyMemory.routeHistory.slice(0, 20);
    }

    state.turn += 1;
    state.day += 1;
    applyDailyDecay(state);

    if (state.day % 7 === 0) {
      applyEffects(state, { stats: { health: 3, stress: -4, trust: 2, stamina: 2, supplies: 6, hunger: -3 } });
    }

    if (state.day > state.bestDays) {
      state.bestDays = state.day;
      localStorage.setItem("zombie_survival_best_days", String(state.bestDays));
    }

    state.currentEventId = null;
    state.currentTemplate = null;
    syncDerivedState(state);
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
        memories: (state.npcMemory?.[def.id] || []).slice(0, 2),
        markedEnemy: !!state.flags[`npc_${def.id}_enemy`],
        markedAlly: !!state.flags[`npc_${def.id}_ally`]
      };
    });

    return list.sort((a, b) => b.value - a.value);
  }

  function getWorldView(state, event) {
    const district = event?.location || data.districts[(state.day + state.turn) % data.districts.length];
    const road = event?.roads?.[0] || data.roads[(state.day * 2 + state.turn) % data.roads.length];
    const pressure = state.stats.threat;

    const npcs = getNpcView(state);
    return {
      district,
      road,
      pressure,
      dayRecord: state.bestDays,
      chapter: data.meta.stages[getStage(state.day)],
      focalNpc: npcs[0]?.name || "-",
      arcLabel: getArcLabel(state.arc.path),
      morale: state.stats.morale,
      pendingConsequences: (state.delayedConsequences || []).filter(item => !item.resolved).length
    };
  }

  function checkEnding(state) {
    const sorted = [...data.endings].sort((a, b) => b.priority - a.priority);
    const failure = sorted.find(e => matchStateCondition(state, e.condition)) || null;
    if (failure) return failure;

    const composite = buildCompositeEnding(state);
    if (composite) return composite;

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
      this.state.lastResult = `${this.state.profile.name}，${data.meta.identityTag || "雾港幸存者"}（${role.company}·${role.label}）。停电发生时你还在 17 层加班，门禁锁死前最后一条语音只有一句：别等外面来救，先把这一层活成据点。`;
      this.state.log.unshift(`第1天：${this.state.lastResult}`);
      addMemoryTrace(this.state, "断联那一晚，你第一次意识到别人会为你的决定付账。");
      return this.getCurrentView(true);
    },

    reset(profileInput) {
      return this.start(profileInput || this.state.profile);
    },

    getCurrentView(forceNewEvent = false) {
      if (this.state.lastResolvedDay !== this.state.day) {
        processDueConsequences(this.state);
        processOverdueDebts(this.state);
        this.state.lastResolvedDay = this.state.day;
      }

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
          world: getWorldView(this.state, null),
          objective: getObjectiveView(this.state),
          briefing: buildBriefing(this.state),
          debts: this.state.debts,
          shelterModules: this.state.shelterModules,
          consequences: (this.state.delayedConsequences || []).filter(item => !item.resolved).slice(0, 4),
          signalFeed: getSignalFeed(this.state)
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
          world: getWorldView(this.state, null),
          objective: getObjectiveView(this.state),
          briefing: buildBriefing(this.state),
          debts: this.state.debts,
          shelterModules: this.state.shelterModules,
          consequences: (this.state.delayedConsequences || []).filter(item => !item.resolved).slice(0, 4),
          signalFeed: getSignalFeed(this.state)
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
          disabled: !choiceMatchesState(this.state, choice),
          lockReason: !choiceMatchesState(this.state, choice) ? getChoiceLockReason(choice) : "",
          impact: getChoiceImpact(choice),
          npcImpactDirect: buildNpcImpact(choice),
          riskScore: assessChoiceRisk(choice, event),
          riskLabel: getRiskLabel(assessChoiceRisk(choice, event)),
          riskTags: buildChoiceRiskTags(choice, event)
        })),
        stats: this.state.stats,
        profile: profileMeta(this.state),
        npcs: getNpcView(this.state),
        memory: this.state.storyMemory,
        log: this.state.log,
        world: getWorldView(this.state, event),
        objective: getObjectiveView(this.state),
        briefing: buildBriefing(this.state),
        debts: this.state.debts,
        shelterModules: this.state.shelterModules,
        consequences: (this.state.delayedConsequences || []).filter(item => !item.resolved).slice(0, 4),
        signalFeed: getSignalFeed(this.state)
      };
    },

    choose(choiceId) {
      const event = this.state.currentTemplate || getEventById(this.state.currentEventId);
      if (!event) return this.getCurrentView(true);

      const choice = event.choices[choiceId];
      if (!choice || !choiceMatchesState(this.state, choice)) return this.getCurrentView(false);

      applyEffects(this.state, choice.effects);
      let result = tpl(choice.result || "", this.state);

      if (event.isMilestone) {
        this.state.arc.path = inferArcFromChoice(choice) || this.state.arc.path;
      }

      const variance = applyChoiceVariance(this.state, event, choice);
      result = `${result}${variance.suffix}`;

      const risk = assessChoiceRisk(choice, event);
      if (choice.effects?.flagsSet?.betrayedCivilians) {
        addDebt(this.state, {
          id: `debt_${event.id}_civilians`,
          title: "有人在追问你把谁留在门外",
          dueDay: this.state.day + 2,
          severity: "high",
          note: "互信和名声都会受损"
        });
        scheduleConsequence(this.state, {
          id: `after_${event.id}_civilians`,
          dueIn: 2,
          type: "social",
          text: "被你舍弃的人把消息传回来了，楼里开始质疑你只救自己人。",
          sourceChoice: choice.label,
          payload: { stats: { trust: -6, stress: 4 }, modules: { intel: -2 } }
        });
        if (event.npcId) {
          applyEffects(this.state, { memoriesAdd: { [event.npcId]: ["记得你把风险转嫁给别人"] } });
        }
      }

      if (risk >= 70) {
        scheduleConsequence(this.state, {
          id: `after_${event.id}_${choiceId}_risk`,
          dueIn: 1,
          type: "aftershock",
          text: "高风险行动的余波还没过去，今晚你得继续为刚才的选择补窟窿。",
          sourceChoice: choice.label,
          payload: { stats: { stress: 3, stamina: -2, threat: 4 }, modules: { defense: -2 } }
        });
      }

      if (/公开|护送|接纳|协助|名单|复盘/.test(`${choice.label} ${choice.result || ""}`) && event.npcId) {
        applyEffects(this.state, { memoriesAdd: { [event.npcId]: ["记得你愿意公开承担后果"] }, stats: { morale: 2 } });
      }

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

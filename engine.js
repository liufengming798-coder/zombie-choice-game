(function () {
  const SAVE_KEY = "zombie_choice_save_v3";
  const LEGACY_SAVE_KEYS = ["zombie_choice_save_v2"];
  const data = window.GAME_DATA;

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function getStage(day) {
    if (day <= 3) return 1;
    if (day <= 8) return 2;
    if (day <= 14) return 3;
    if (day <= 21) return 4;
    return 5;
  }

  function getStatDef(key) {
    return data.statDefs.find(s => s.key === key);
  }

  function readStat(state, key) {
    return state.stats[key] ?? 0;
  }

  function matchComparators(value, rule) {
    if (rule.gte !== undefined && !(value >= rule.gte)) return false;
    if (rule.lte !== undefined && !(value <= rule.lte)) return false;
    if (rule.gt !== undefined && !(value > rule.gt)) return false;
    if (rule.lt !== undefined && !(value < rule.lt)) return false;
    if (rule.eq !== undefined && !(value === rule.eq)) return false;
    return true;
  }

  function matchCondition(state, cond) {
    if (!cond) return true;

    if (cond.all && !cond.all.every(c => matchCondition(state, c))) return false;
    if (cond.any && !cond.any.some(c => matchCondition(state, c))) return false;

    if (cond.dayGte !== undefined && state.day < cond.dayGte) return false;
    if (cond.dayLte !== undefined && state.day > cond.dayLte) return false;

    const stage = getStage(state.day);
    if (cond.stageGte !== undefined && stage < cond.stageGte) return false;
    if (cond.stageLte !== undefined && stage > cond.stageLte) return false;

    if (cond.flagsAll && !cond.flagsAll.every(f => !!state.flags[f])) return false;
    if (cond.flagsAny && !cond.flagsAny.some(f => !!state.flags[f])) return false;
    if (cond.flagsNot && cond.flagsNot.some(f => !!state.flags[f])) return false;

    if (cond.profile) {
      if (cond.profile.career && state.profile.career !== cond.profile.career) return false;
      if (cond.profile.background && state.profile.background !== cond.profile.background) return false;
    }

    if (cond.stats) {
      for (const [key, rule] of Object.entries(cond.stats)) {
        if (!matchComparators(readStat(state, key), rule)) return false;
      }
    }

    return true;
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

  function getProfileDef(type, id) {
    const group = type === "career" ? data.profiles.careers : data.profiles.backgrounds;
    return group.find(x => x.id === id) || group[0];
  }

  function getAllowedBackgrounds(careerId) {
    const all = data.profiles.backgrounds || [];
    const filtered = all.filter(bg => !bg.careers || bg.careers.includes(careerId));
    return filtered.length ? filtered : all;
  }

  function applyProfileBonus(state) {
    const c = getProfileDef("career", state.profile.career);
    const b = getProfileDef("background", state.profile.background);

    const bundles = [c.startBonus || {}, b.startBonus || {}];
    bundles.forEach(bundle => {
      for (const [key, delta] of Object.entries(bundle)) {
        const def = getStatDef(key);
        if (!def) continue;
        state.stats[key] = clamp(state.stats[key] + delta, def.min, def.max);
      }
    });

    state.flags[`career_${c.id}`] = true;
    state.flags[`background_${b.id}`] = true;
  }

  function createStore(profileInput) {
    const base = deepClone(data.initialState);
    const careerIds = (data.profiles.careers || []).map(x => x.id);
    const defaultCareer = careerIds[0];
    const requestedCareer = profileInput?.career || defaultCareer;
    const selectedCareer = careerIds.includes(requestedCareer) ? requestedCareer : defaultCareer;
    const allowedForCareer = getAllowedBackgrounds(selectedCareer);
    const defaultBackground = allowedForCareer[0]?.id || data.profiles.backgrounds[0].id;
    const requestedBackground = profileInput?.background || defaultBackground;
    const validBackground = allowedForCareer.some(x => x.id === requestedBackground)
      ? requestedBackground
      : defaultBackground;
    const profile = {
      name: (profileInput?.name || "无名")
        .replace(/\s+/g, "")
        .slice(0, 12) || "无名",
      career: selectedCareer,
      background: validBackground
    };

    const state = {
      ...base,
      profile,
      turn: 0,
      lastResult: "",
      currentEventId: null,
      queue: [],
      log: [],
      seenCounts: {},
      lastSeenTurn: {},
      doneOnceEvents: {},
      recentEvents: [],
      specialContext: null
    };

    applyProfileBonus(state);
    return state;
  }

  function normalizeState(raw) {
    const seeded = createStore(raw?.profile);
    if (!raw || typeof raw !== "object") return seeded;

    return {
      ...seeded,
      ...raw,
      stats: { ...seeded.stats, ...(raw.stats || {}) },
      flags: { ...seeded.flags, ...(raw.flags || {}) },
      profile: { ...seeded.profile, ...(raw.profile || {}) },
      queue: Array.isArray(raw.queue) ? raw.queue : [],
      log: Array.isArray(raw.log) ? raw.log : [],
      seenCounts: raw.seenCounts || {},
      lastSeenTurn: raw.lastSeenTurn || {},
      doneOnceEvents: raw.doneOnceEvents || {},
      recentEvents: Array.isArray(raw.recentEvents) ? raw.recentEvents : [],
      specialContext: raw.specialContext || null
    };
  }

  function applyPassiveDecay(state) {
    if (state.flags.zombified) {
      state.stats.hunger = clamp(state.stats.hunger + 1, 0, 100);
      state.stats.stress = clamp(state.stats.stress + 1, 0, 100);
      state.stats.supplies = clamp(state.stats.supplies - 1, 0, 100);
      state.stats.humanity = clamp(state.stats.humanity - 2, 0, 100);
      state.stats.infection = clamp(state.stats.infection + 1, 40, 100);
      if (state.stats.humanity <= 16) state.stats.health = clamp(state.stats.health - 2, 0, 100);
      return;
    }

    const stage = getStage(state.day);
    const hungerGain = stage <= 2 ? 3 : stage === 3 ? 4 : 5;
    const stressGain = state.stats.shelter < 30 ? 4 : 2;
    const supplyDrain = stage <= 2 ? 2 : state.stats.shelter >= 60 ? 2 : 3;

    state.stats.hunger = clamp(state.stats.hunger + hungerGain, 0, 100);
    state.stats.stress = clamp(state.stats.stress + stressGain, 0, 100);
    state.stats.supplies = clamp(state.stats.supplies - supplyDrain, 0, 100);

    if (stage >= 4 && state.stats.supplies <= 12) {
      state.stats.hunger = clamp(state.stats.hunger + 2, 0, 100);
    }

    if (state.flags.woundOpen) {
      state.stats.health = clamp(state.stats.health - 2, 0, 100);
      state.stats.infection = clamp(state.stats.infection + 2, 0, 100);
    }

    if (state.stats.hunger >= 80) state.stats.health = clamp(state.stats.health - 2, 0, 100);
    if (state.stats.stress >= 80) state.stats.humanity = clamp(state.stats.humanity - 2, 0, 100);
    if (state.stats.noise >= 75) state.stats.stress = clamp(state.stats.stress + 3, 0, 100);
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

    if (effects.flagsSet) {
      for (const [k, v] of Object.entries(effects.flagsSet)) {
        state.flags[k] = !!v;
      }
    }

    if (effects.flagsClear) {
      for (const k of effects.flagsClear) {
        state.flags[k] = false;
      }
    }

    if (effects.queue) {
      state.queue.push(...effects.queue);
    }
  }

  function getEventById(id) {
    return data.events.find(e => e.id === id) || null;
  }

  function isEventEligible(state, event) {
    if (!matchCondition(state, event.condition)) return false;

    if (event.once && state.doneOnceEvents[event.id]) return false;

    const last = state.lastSeenTurn[event.id];
    if (last !== undefined && event.cooldown !== undefined) {
      if (state.turn - last < event.cooldown) return false;
    }

    if (state.recentEvents.includes(event.id)) return false;
    return true;
  }

  function computeEventWeight(state, event) {
    const stage = getStage(state.day);
    const seen = state.seenCounts[event.id] || 0;
    const novelty = Math.max(0.08, 1 - seen * 0.28);
    let w = (event.weight || 1) * novelty;

    if (event.category === "战斗" && state.stats.noise >= 60) w *= 1.35;
    if (event.category === "交易" && state.stats.supplies <= 30) w *= 1.3;
    if (event.category === "庇护所管理" && state.stats.shelter <= 35) w *= 1.25;
    if (event.category === "同伴互动" && state.stats.trust <= 35) w *= 1.2;

    if (state.flags.career_medic && (event.category === "同伴互动" || event.category === "庇护所管理")) w *= 1.08;
    if (state.flags.career_scout && event.category === "探索") w *= 1.1;
    if (state.flags.career_soldier && event.category === "战斗") w *= 1.08;
    if (state.flags.career_engineer && event.category === "庇护所管理") w *= 1.1;
    if (state.flags.career_standup && (event.category === "同伴互动" || event.category === "职业专属")) w *= 1.1;
    if (state.flags.career_astrologer && event.category === "特殊事件") w *= 1.1;
    if (state.flags.career_pet_streamer && event.category === "职业专属") w *= 1.08;
    if (state.flags.career_poet && (event.category === "道德困境" || event.category === "职业专属")) w *= 1.08;
    if (state.flags.career_magician && (event.category === "探索" || event.category === "特殊事件")) w *= 1.08;
    if (state.flags.career_delivery_king && event.category === "探索") w *= 1.1;

    if (state.flags.zombified) {
      if (event.category === "丧尸分支") w *= 2.4;
      if (event.category === "职业专属" || event.category === "同伴互动") w *= 0.85;
    }

    if (event.isKey && stage >= 4 && !state.doneOnceEvents[event.id]) w *= 1.25;
    if (event.id === "k_radio_tower" && stage >= 4 && !state.flags.knowsEvacPoint) w *= 1.6;
    if (event.id === "k_bridge_blast" && stage >= 5 && state.flags.knowsEvacPoint && !state.flags.bridgeOpen) w *= 1.7;
    if (event.id === "k_refugee_vote" && stage >= 4 && !state.flags.finalVoteDone) w *= 1.4;
    if (event.id === "k_final_hall" && stage >= 5 && state.day >= 21 && !state.flags.sacrificeMade) w *= 1.3;
    if (event.id === "k_turning_point" && state.stats.infection >= 55 && !state.flags.zombified) w *= 2.4;
    if (event.id === "r_mutation_offer" && state.stats.infection >= 42 && !state.flags.zombified) w *= 1.8;

    return w;
  }

  function pickNextEvent(state) {
    if (state.queue.length > 0) {
      const forcedId = state.queue.shift();
      const forcedEvent = getEventById(forcedId);
      if (forcedEvent && isEventEligible(state, forcedEvent)) return forcedEvent;
    }

    const stage = getStage(state.day);
    const keyChance = stage <= 2 ? 0.34 : stage === 3 ? 0.42 : stage === 4 ? 0.52 : 0.62;
    const keyPool = data.events.filter(e => e.isKey && isEventEligible(state, e));
    if (keyPool.length && Math.random() < keyChance) {
      return weightedPick(keyPool, e => computeEventWeight(state, e));
    }

    let randomPool = data.events.filter(e => !e.isKey && isEventEligible(state, e));
    if (!randomPool.length) {
      randomPool = data.events.filter(e => !e.isKey && matchCondition(state, e.condition));
    }

    return weightedPick(randomPool, e => computeEventWeight(state, e));
  }

  function ensureSpecialContext(state, event) {
    if (!event.special) return;
    if (state.specialContext?.eventId === event.id) return;

    if (event.special.type === "route_pick") {
      const routes = event.special.routes || [];
      state.specialContext = {
        eventId: event.id,
        safeRoute: Math.floor(Math.random() * Math.max(1, routes.length))
      };
      return;
    }

    state.specialContext = { eventId: event.id };
  }

  function recordEventSeen(state, event) {
    state.currentEventId = event.id;
    state.seenCounts[event.id] = (state.seenCounts[event.id] || 0) + 1;
    state.lastSeenTurn[event.id] = state.turn;
    if (event.once) state.doneOnceEvents[event.id] = true;

    state.recentEvents.unshift(event.id);
    state.recentEvents = state.recentEvents.slice(0, 7);

    ensureSpecialContext(state, event);
  }

  function resolveChoiceOutcome(choice) {
    if (!choice.outcomes || !choice.outcomes.length) return null;
    return weightedPick(choice.outcomes, o => o.weight || 1);
  }

  function checkEnding(state) {
    const sorted = [...data.endings].sort((a, b) => b.priority - a.priority);
    return sorted.find(e => matchCondition(state, e.condition)) || null;
  }

  function buildChoiceView(state, event) {
    if (event.special) return [];

    return event.choices.flatMap((choice, idx) => {
      const ok = matchCondition(state, choice.condition);
      if (!ok && choice.hideIfLocked) return [];
      return {
        id: idx,
        label: tpl(choice.label, state),
        disabled: !ok
      };
    });
  }

  function profileMeta(state) {
    const c = getProfileDef("career", state.profile.career);
    const b = getProfileDef("background", state.profile.background);
    return { name: state.profile.name, careerLabel: c.label, backgroundLabel: b.label };
  }

  function tpl(text, state) {
    if (!text) return "";
    const meta = profileMeta(state);
    return String(text)
      .replaceAll("{name}", meta.name)
      .replaceAll("{career}", meta.careerLabel)
      .replaceAll("{background}", meta.backgroundLabel);
  }

  function getSpecialView(state, event) {
    if (!event.special) return null;
    const sp = event.special;

    if (sp.type === "skill_check") {
      const base = sp.baseChance || 50;
      return {
        type: sp.type,
        title: sp.title,
        description: tpl(sp.description, state),
        meta: `基础成功率 ${base}% · 使用判定 ${sp.statLabel || "综合"}`,
        actionLabel: sp.actionLabel || "执行检定",
        timerSec: sp.timerSec || 0
      };
    }

    if (sp.type === "route_pick") {
      return {
        type: sp.type,
        title: sp.title,
        description: tpl(sp.description, state),
        meta: "从三条路线中选一条，只有一条是安全线。",
        routes: sp.routes || [],
        actionLabel: sp.actionLabel || "确认路线",
        timerSec: sp.timerSec || 0
      };
    }

    return null;
  }

  function settleTurn(state, event, actionLabel, result) {
    state.lastResult = result;
    state.log.unshift(`第${state.day}天：${tpl(event.title, state)} -> ${tpl(actionLabel, state)}。${result}`);
    state.log = state.log.slice(0, 90);

    state.turn += 1;
    state.day += 1;
    applyPassiveDecay(state);

    state.currentEventId = null;
    state.specialContext = null;
  }

  function getSkillCheckChance(state, special) {
    const base = special.baseChance || 50;
    const statValue = readStat(state, special.stat || "health");

    let chance = base;
    if (special.stat === "stress" || special.stat === "infection" || special.stat === "noise" || special.stat === "hunger") {
      chance += (55 - statValue) * 0.45;
    } else {
      chance += (statValue - 50) * 0.35;
    }

    if (state.flags.career_medic && special.careerBoost === "medic") chance += 12;
    if (state.flags.career_scout && special.careerBoost === "scout") chance += 12;
    if (state.flags.career_soldier && special.careerBoost === "soldier") chance += 12;
    if (state.flags.career_engineer && special.careerBoost === "engineer") chance += 12;

    if (state.flags.background_role_defender) chance += 3;
    if (state.flags.background_role_leader) chance += 2;
    if (state.flags.background_role_infiltrator) chance += 2;
    if (state.flags.background_role_medic) chance += 2;
    if (state.flags.career_magician) chance += 3;

    return clamp(Math.round(chance), 8, 92);
  }

  const game = {
    state: createStore(),

    getProfileOptions() {
      return deepClone(data.profiles);
    },

    start(profileInput) {
      this.state = createStore(profileInput);
      const c = getProfileDef("career", this.state.profile.career);
      const b = getProfileDef("background", this.state.profile.background);
      this.state.lastResult = `${this.state.profile.name}，${c.label}，${b.label}。我在电台杂音里确认了一件事: 今天必须活下去。`;
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
          title: tpl(ending.title, this.state),
          body: tpl(ending.text, this.state),
          result: "",
          special: null,
          choices: [{ id: "restart", label: "重新开始", disabled: false }],
          stats: this.state.stats,
          profile: profileMeta(this.state),
          log: this.state.log
        };
      }

      let event = getEventById(this.state.currentEventId);
      if (forceNewEvent || !event) {
        event = pickNextEvent(this.state);
        if (!event) {
          return {
            ended: true,
            stage: getStage(this.state.day),
            stageLabel: data.meta.stages[getStage(this.state.day)],
            day: this.state.day,
            title: "结局：信号中断",
            body: "没有新的线路，也没有新的冒险。故事在沉默里停住了。",
            result: "",
            special: null,
            choices: [{ id: "restart", label: "重新开始", disabled: false }],
            stats: this.state.stats,
            profile: profileMeta(this.state),
            log: this.state.log
          };
        }
        recordEventSeen(this.state, event);
      }

      return {
        ended: false,
        stage: getStage(this.state.day),
        stageLabel: data.meta.stages[getStage(this.state.day)],
        day: this.state.day,
        eventId: event.id,
        title: `第${this.state.day}天 · ${tpl(event.title, this.state)}`,
        body: tpl(event.body, this.state),
        result: this.state.lastResult || "",
        special: getSpecialView(this.state, event),
        choices: buildChoiceView(this.state, event),
        stats: this.state.stats,
        profile: profileMeta(this.state),
        log: this.state.log
      };
    },

    choose(choiceId) {
      const event = getEventById(this.state.currentEventId);
      if (!event) return this.getCurrentView(true);
      if (event.special) return this.getCurrentView(false);

      const choice = event.choices[choiceId];
      if (!choice || !matchCondition(this.state, choice.condition)) return this.getCurrentView(false);

      applyEffects(this.state, choice.effects);
      let result = tpl(choice.result || "", this.state);

      const outcome = resolveChoiceOutcome(choice);
      if (outcome) {
        if (outcome.effects) applyEffects(this.state, outcome.effects);
        if (outcome.text) result = `${result} ${tpl(outcome.text, this.state)}`.trim();
      }

      settleTurn(this.state, event, choice.label, result);
      return this.getCurrentView(true);
    },

    resolveSpecial(payload) {
      const event = getEventById(this.state.currentEventId);
      if (!event || !event.special) return this.getCurrentView(false);

      const special = event.special;
      let result = "";
      const timedOut = !!payload?.timeout;

      if (special.type === "skill_check") {
        if (timedOut) {
          applyEffects(this.state, special.failEffects);
          result = `${tpl(special.timeoutText || special.failText, this.state)}（超时）`;
          settleTurn(this.state, event, "犹豫过久", result);
          return this.getCurrentView(true);
        }

        const chance = getSkillCheckChance(this.state, special);
        const roll = Math.floor(Math.random() * 100) + 1;
        const success = roll <= chance;
        if (success) {
          applyEffects(this.state, special.successEffects);
          result = `${tpl(special.successText, this.state)}（检定 ${roll}/${chance}）`;
        } else {
          applyEffects(this.state, special.failEffects);
          result = `${tpl(special.failText, this.state)}（检定 ${roll}/${chance}）`;
        }
        settleTurn(this.state, event, special.actionLabel || "执行检定", result);
        return this.getCurrentView(true);
      }

      if (special.type === "route_pick") {
        if (timedOut) {
          applyEffects(this.state, special.failEffects);
          result = `${tpl(special.timeoutText || special.failText, this.state)}（超时）`;
          settleTurn(this.state, event, "错过路线窗口", result);
          return this.getCurrentView(true);
        }

        const idx = Number(payload?.routeIndex);
        const safe = this.state.specialContext?.safeRoute ?? -1;
        const selectedLabel = special.routes?.[idx] || "未知路线";
        if (idx === safe) {
          applyEffects(this.state, special.successEffects);
          result = `${tpl(special.successText, this.state)}（选择: ${selectedLabel}）`;
        } else {
          applyEffects(this.state, special.failEffects);
          result = `${tpl(special.failText, this.state)}（选择: ${selectedLabel}）`;
        }
        settleTurn(this.state, event, `路线抉择: ${selectedLabel}`, result);
        return this.getCurrentView(true);
      }

      return this.getCurrentView(false);
    },

    save() {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.state));
      return "存档已写入本地。";
    },

    load() {
      let raw = localStorage.getItem(SAVE_KEY);
      if (!raw) {
        for (const legacyKey of LEGACY_SAVE_KEYS) {
          raw = localStorage.getItem(legacyKey);
          if (raw) break;
        }
      }
      if (!raw) return { ok: false, message: "没有可读取的存档。" };
      try {
        const parsed = JSON.parse(raw);
        this.state = normalizeState(parsed);
        return { ok: true, message: "存档读取成功。" };
      } catch (_) {
        return { ok: false, message: "存档损坏，读取失败。" };
      }
    }
  };

  window.GameEngine = game;
})();

(function () {
  const SAVE_KEY = "zombie_choice_save_v4";
  const LEGACY_SAVE_KEYS = ["zombie_choice_save_v3", "zombie_choice_save_v2"];
  const data = window.GAME_DATA;

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function getStage(day) {
    if (day <= 5) return 1;
    if (day <= 12) return 2;
    if (day <= 24) return 3;
    if (day <= 45) return 4;
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

  function profileMeta(state) {
    return {
      name: state.profile.name,
      citizenTag: "上海市民",
      statusLabel: state.flags.hasCommunity ? "社区协同中" : "流动求生中"
    };
  }

  function tpl(text, state) {
    if (!text) return "";
    const district = data.districts[(state.day + state.turn) % data.districts.length];
    const road = data.roads[(state.turn + state.day * 2) % data.roads.length];
    const landmark = data.landmarks[(state.turn * 2 + state.day) % data.landmarks.length];
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

    return {
      ...base,
      profile: { name },
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
        routeHistory: []
      },
      bestDays
    };
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
      seenEvents: raw.seenEvents || {},
      recentEvents: Array.isArray(raw.recentEvents) ? raw.recentEvents : [],
      storyMemory: raw.storyMemory || { majorDecisions: [], routeHistory: [] },
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
      for (const [k, v] of Object.entries(effects.flagsSet)) state.flags[k] = !!v;
    }

    if (effects.flagsClear) {
      for (const k of effects.flagsClear) state.flags[k] = false;
    }

    if (effects.queue) {
      state.queue.push(...effects.queue);
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

    return true;
  }

  function computeEventWeight(state, event) {
    let w = event.weight || 1;
    const stage = getStage(state.day);
    const scarcity = (100 - state.stats.supplies) / 100;

    if (stage >= 4 && event.category === "长期求生") w *= 1.2;
    if (state.stats.trust <= 25 && event.category === "组织重构") w *= 1.2;
    if (state.flags.betrayedCivilians && event.category === "高压消耗") w *= 1.18;
    if (state.flags.hasCommunity && event.category === "组织重构") w *= 1.1;
    if (scarcity >= 0.55 && /补给|仓储|交换/.test(event.title)) w *= 1.18;

    return Math.max(0.1, w);
  }

  function buildTemplateEvent(state) {
    const template = weightedPick(data.templateEvents, t => {
      let w = 1;
      if (t.id === "t_supply_run" && state.stats.supplies <= 45) w *= 1.5;
      if (t.id === "t_night_defense" && state.stats.shelter <= 55) w *= 1.45;
      if (state.day >= 30) w *= 1.12;
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
      body: tpl(template.body, state),
      location: district,
      roads: [road],
      choices: template.choices
    };
  }

  function pickNextEvent(state) {
    if (state.queue.length > 0) {
      const forced = getEventById(state.queue.shift());
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

  function collectEffectStats(map, effects, weight) {
    if (!effects?.stats) return;
    for (const [key, delta] of Object.entries(effects.stats)) {
      map[key] = (map[key] || 0) + delta * weight;
    }
  }

  function getChoiceImpact(choice) {
    const impact = {};
    collectEffectStats(impact, choice.effects, 1);
    if (choice.outcomes?.length) {
      const total = choice.outcomes.reduce((sum, o) => sum + (o.weight || 1), 0) || 1;
      choice.outcomes.forEach(o => collectEffectStats(impact, o.effects, (o.weight || 1) / total));
    }
    return impact;
  }

  function applyDailyDecay(state) {
    const stage = getStage(state.day);
    const baseHunger = stage <= 2 ? 3 : stage === 3 ? 4 : 5;
    const baseStress = stage <= 2 ? 2 : stage === 3 ? 3 : 4;
    const baseSupply = stage <= 2 ? 2 : stage === 3 ? 3 : 4;
    const baseStamina = stage <= 2 ? 2 : stage === 3 ? 3 : 4;

    const extraThreat = Math.floor(state.day / 15);
    state.stats.hunger = clamp(state.stats.hunger + baseHunger + extraThreat, 0, 100);
    state.stats.stress = clamp(state.stats.stress + baseStress + (state.stats.shelter < 40 ? 1 : 0), 0, 100);
    state.stats.supplies = clamp(state.stats.supplies - baseSupply - (state.stats.trust < 25 ? 1 : 0), 0, 100);
    state.stats.stamina = clamp(state.stats.stamina - baseStamina - (state.stats.hunger > 75 ? 1 : 0), 0, 100);

    if (state.stats.supplies <= 18) {
      state.stats.health = clamp(state.stats.health - 2, 0, 100);
      state.stats.hunger = clamp(state.stats.hunger + 2, 0, 100);
    }

    if (state.stats.stress >= 80) {
      state.stats.trust = clamp(state.stats.trust - 2, 0, 100);
      state.stats.health = clamp(state.stats.health - 1, 0, 100);
    }

    if (state.stats.hunger >= 85) state.stats.health = clamp(state.stats.health - 2, 0, 100);
    if (state.stats.infection >= 65) state.stats.health = clamp(state.stats.health - 2, 0, 100);

    if (state.day >= 20) {
      state.stats.infection = clamp(state.stats.infection + (Math.random() < 0.42 ? 1 : 0), 0, 100);
    }
  }

  function settleTurn(state, event, actionLabel, result) {
    state.lastResult = result;
    const roadHint = event.roads?.[0] ? ` @${event.roads[0]}` : "";
    state.log.unshift(`第${state.day}天${roadHint}：${tpl(event.title, state)} -> ${tpl(actionLabel, state)}。${result}`);
    state.log = state.log.slice(0, 120);

    if (!event.isTemplate) state.seenEvents[event.id] = true;
    state.recentEvents.unshift(event.baseId || event.id);
    state.recentEvents = state.recentEvents.slice(0, 10);

    state.storyMemory.majorDecisions.unshift(`${state.day}天:${tpl(actionLabel, state)}`);
    state.storyMemory.majorDecisions = state.storyMemory.majorDecisions.slice(0, 20);

    if (event.location) {
      state.storyMemory.routeHistory.unshift(event.location);
      state.storyMemory.routeHistory = state.storyMemory.routeHistory.slice(0, 14);
    }

    state.turn += 1;
    state.day += 1;
    applyDailyDecay(state);

    if (state.day > state.bestDays) {
      state.bestDays = state.day;
      localStorage.setItem("zombie_survival_best_days", String(state.bestDays));
    }

    state.currentEventId = null;
    state.currentTemplate = null;
  }

  function getWorldView(state, event) {
    const district = event?.location || data.districts[(state.day + state.turn) % data.districts.length];
    const road = event?.roads?.[0] || data.roads[(state.day * 2 + state.turn) % data.roads.length];
    const pressure = clamp(
      Math.round(
        state.stats.infection * 0.32 +
        state.stats.stress * 0.26 +
        state.stats.hunger * 0.22 +
        (100 - state.stats.shelter) * 0.2
      ),
      0,
      100
    );

    return {
      district,
      road,
      pressure,
      dayRecord: state.bestDays,
      chapter: data.meta.stages[getStage(state.day)]
    };
  }

  function checkEnding(state) {
    const sorted = [...data.endings].sort((a, b) => b.priority - a.priority);
    return sorted.find(e => matchEndingCondition(state, e.condition)) || null;
  }

  const game = {
    state: createStore(),

    start(profileInput) {
      this.state = createStore(profileInput);
      this.state.lastResult = `${this.state.profile.name}，普通上海市民。通信中断前最后一条语音里只剩一句: 别等系统恢复，先活下来。`;
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
          choices: [{ id: "restart", label: "重新挑战", disabled: false, impact: {} }],
          stats: this.state.stats,
          profile: profileMeta(this.state),
          log: this.state.log,
          world: getWorldView(this.state, null)
        };
      }

      let event = null;

      if (!forceNewEvent && this.state.currentEventId) {
        event = getEventById(this.state.currentEventId);
      }

      if (!forceNewEvent && !event && this.state.currentTemplate) {
        event = this.state.currentTemplate;
      }

      if (forceNewEvent || !event) {
        event = pickNextEvent(this.state);
        if (!event) {
          event = buildTemplateEvent(this.state);
        }
        if (event?.isTemplate) {
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
          title: "结局：信号彻底沉默",
          body: "没有新的事件可触发，城市像被剪断了时间线。",
          result: "",
          choices: [{ id: "restart", label: "重新挑战", disabled: false, impact: {} }],
          stats: this.state.stats,
          profile: profileMeta(this.state),
          log: this.state.log,
          world: getWorldView(this.state, null)
        };
      }

      const sceneMap = {
        崩溃初期: "combat",
        封锁裂解: "moral",
        组织重构: "bond",
        高压消耗: "scavenge",
        长期求生: "shelter"
      };

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
          impact: getChoiceImpact(choice)
        })),
        stats: this.state.stats,
        profile: profileMeta(this.state),
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

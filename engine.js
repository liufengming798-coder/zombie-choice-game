(function () {
  const SAVE_KEY = "zombie_choice_save_v2";
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

  function createStore() {
    const base = deepClone(data.initialState);
    return {
      ...base,
      turn: 0,
      lastResult: "",
      currentEventId: null,
      queue: [],
      log: [],
      seenCounts: {},
      lastSeenTurn: {},
      doneOnceEvents: {},
      recentEvents: []
    };
  }

  function applyPassiveDecay(state) {
    const stage = getStage(state.day);
    const hungerGain = stage <= 2 ? 3 : stage === 3 ? 4 : 5;
    const stressGain = state.stats.shelter < 30 ? 4 : 2;
    const supplyDrain = stage <= 2 ? 2 : state.stats.shelter >= 60 ? 2 : 3;

    state.stats.hunger = clamp(state.stats.hunger + hungerGain, 0, 100);
    state.stats.stress = clamp(state.stats.stress + stressGain, 0, 100);
    state.stats.supplies = clamp(state.stats.supplies - supplyDrain, 0, 100);

    // Supply collapse accelerates hunger in late-game, not from day 1.
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

    // Story director: in late stages, bias toward unresolved key arcs.
    if (event.isKey && stage >= 4 && !state.doneOnceEvents[event.id]) w *= 1.25;
    if (event.id === "k_radio_tower" && stage >= 4 && !state.flags.knowsEvacPoint) w *= 1.6;
    if (event.id === "k_bridge_blast" && stage >= 5 && state.flags.knowsEvacPoint && !state.flags.bridgeOpen) w *= 1.7;
    if (event.id === "k_refugee_vote" && stage >= 4 && !state.flags.finalVoteDone) w *= 1.4;
    if (event.id === "k_final_hall" && stage >= 5 && state.day >= 21 && !state.flags.sacrificeMade) w *= 1.3;

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

  function recordEventSeen(state, event) {
    state.currentEventId = event.id;
    state.seenCounts[event.id] = (state.seenCounts[event.id] || 0) + 1;
    state.lastSeenTurn[event.id] = state.turn;
    if (event.once) state.doneOnceEvents[event.id] = true;

    state.recentEvents.unshift(event.id);
    state.recentEvents = state.recentEvents.slice(0, 7);
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
    return event.choices.map((choice, idx) => {
      const ok = matchCondition(state, choice.condition);
      return {
        id: idx,
        label: choice.label,
        disabled: !ok
      };
    });
  }

  const game = {
    state: createStore(),

    reset() {
      this.state = createStore();
      this.state.lastResult = "我从废弃仓库醒来，电台里只剩杂音。";
      this.state.log.unshift(`第1天：${this.state.lastResult}`);
      return this.getCurrentView(true);
    },

    getCurrentView(forceNewEvent = false) {
      const ending = checkEnding(this.state);
      if (ending) {
        return {
          ended: true,
          stage: getStage(this.state.day),
          stageLabel: data.meta.stages[getStage(this.state.day)],
          day: this.state.day,
          title: ending.title,
          body: ending.text,
          result: "",
          choices: [{ id: "restart", label: "重新开始", disabled: false }],
          stats: this.state.stats,
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
            choices: [{ id: "restart", label: "重新开始", disabled: false }],
            stats: this.state.stats,
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
        title: `第${this.state.day}天 · ${event.title}`,
        body: event.body,
        result: this.state.lastResult || "",
        choices: buildChoiceView(this.state, event),
        stats: this.state.stats,
        log: this.state.log
      };
    },

    choose(choiceId) {
      const event = getEventById(this.state.currentEventId);
      if (!event) return this.getCurrentView(true);

      const choice = event.choices[choiceId];
      if (!choice || !matchCondition(this.state, choice.condition)) return this.getCurrentView(false);

      applyEffects(this.state, choice.effects);
      let result = choice.result || "";

      const outcome = resolveChoiceOutcome(choice);
      if (outcome) {
        if (outcome.effects) applyEffects(this.state, outcome.effects);
        if (outcome.text) result = `${result} ${outcome.text}`.trim();
      }

      this.state.lastResult = result;
      this.state.log.unshift(`第${this.state.day}天：${event.title} -> ${choice.label}。${result}`);
      this.state.log = this.state.log.slice(0, 80);

      this.state.turn += 1;
      this.state.day += 1;
      applyPassiveDecay(this.state);

      this.state.currentEventId = null;
      return this.getCurrentView(true);
    },

    save() {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.state));
      return "存档已写入本地。";
    },

    load() {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return { ok: false, message: "没有可读取的存档。" };
      try {
        const parsed = JSON.parse(raw);
        this.state = parsed;
        return { ok: true, message: "存档读取成功。" };
      } catch (_) {
        return { ok: false, message: "存档损坏，读取失败。" };
      }
    }
  };

  window.GameEngine = game;
})();

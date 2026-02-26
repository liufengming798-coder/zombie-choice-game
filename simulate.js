const fs = require('fs');
const vm = require('vm');

function loadData() {
  const src = fs.readFileSync('data/events.js', 'utf8');
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return ctx.window.GAME_DATA;
}

const data = loadData();

function deepClone(obj){ return JSON.parse(JSON.stringify(obj)); }
function clamp(v,min,max){ return Math.max(min,Math.min(max,v)); }
function getStage(day){ if(day<=3) return 1; if(day<=8) return 2; if(day<=14) return 3; if(day<=21) return 4; return 5; }
function readStat(state,key){ return state.stats[key] ?? 0; }

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
    if (cond.profile.career && state.profile?.career !== cond.profile.career) return false;
    if (cond.profile.background && state.profile?.background !== cond.profile.background) return false;
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

function createState() {
  const careers = (data.profiles?.careers || []).map(c => c.id);
  const backgrounds = (data.profiles?.backgrounds || []).map(b => b.id);
  const career = careers[Math.floor(Math.random() * Math.max(1, careers.length))] || 'medic';
  const background = backgrounds[Math.floor(Math.random() * Math.max(1, backgrounds.length))] || 'family_man';
  const state = {
    ...deepClone(data.initialState),
    profile: { name: 'Sim', career, background },
    turn: 0,
    currentEventId: null,
    queue: [],
    seenCounts: {},
    lastSeenTurn: {},
    doneOnceEvents: {},
    recentEvents: [],
  };
  const c = (data.profiles?.careers || []).find(x => x.id === career);
  const b = (data.profiles?.backgrounds || []).find(x => x.id === background);
  [c?.startBonus || {}, b?.startBonus || {}].forEach(bundle => {
    for (const [key, delta] of Object.entries(bundle)) {
      const def = data.statDefs.find(s => s.key === key);
      if (!def) continue;
      state.stats[key] = clamp(state.stats[key] + delta, def.min, def.max);
    }
  });
  return state;
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
      const def = data.statDefs.find(s => s.key === key);
      if (!def) continue;
      state.stats[key] = clamp(state.stats[key] + delta, def.min, def.max);
    }
  }
  if (effects.flagsSet) {
    for (const [k,v] of Object.entries(effects.flagsSet)) state.flags[k] = !!v;
  }
  if (effects.flagsClear) {
    for (const k of effects.flagsClear) state.flags[k] = false;
  }
  if (effects.queue) {
    state.queue.push(...effects.queue);
  }
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
  if (event.category === '战斗' && state.stats.noise >= 60) w *= 1.35;
  if (event.category === '交易' && state.stats.supplies <= 30) w *= 1.3;
  if (event.category === '庇护所管理' && state.stats.shelter <= 35) w *= 1.25;
  if (event.category === '同伴互动' && state.stats.trust <= 35) w *= 1.2;
  if (state.flags.zombified) {
    if (event.category === '丧尸分支') w *= 2.4;
    if (event.category === '职业专属' || event.category === '同伴互动') w *= 0.85;
  }
  if (event.isKey && stage >= 4 && !state.doneOnceEvents[event.id]) w *= 1.25;
  if (event.id === 'k_radio_tower' && stage >= 4 && !state.flags.knowsEvacPoint) w *= 1.6;
  if (event.id === 'k_bridge_blast' && stage >= 5 && state.flags.knowsEvacPoint && !state.flags.bridgeOpen) w *= 1.7;
  if (event.id === 'k_refugee_vote' && stage >= 4 && !state.flags.finalVoteDone) w *= 1.4;
  if (event.id === 'k_final_hall' && stage >= 5 && state.day >= 21 && !state.flags.sacrificeMade) w *= 1.3;
  return w;
}

function pickNextEvent(state) {
  if (state.queue.length > 0) {
    const id = state.queue.shift();
    const forced = data.events.find(e => e.id === id);
    if (forced && isEventEligible(state, forced)) return forced;
  }
  const stage = getStage(state.day);
  const keyChance = stage <= 2 ? 0.34 : stage === 3 ? 0.42 : stage === 4 ? 0.52 : 0.62;
  const keyPool = data.events.filter(e => e.isKey && isEventEligible(state, e));
  if (keyPool.length && Math.random() < keyChance) {
    return weightedPick(keyPool, e => computeEventWeight(state, e));
  }
  let pool = data.events.filter(e => !e.isKey && isEventEligible(state, e));
  if (!pool.length) pool = data.events.filter(e => !e.isKey && matchCondition(state, e.condition));
  return weightedPick(pool, e => computeEventWeight(state, e));
}

function recordSeen(state,event){
  state.currentEventId = event.id;
  state.seenCounts[event.id] = (state.seenCounts[event.id] || 0) + 1;
  state.lastSeenTurn[event.id] = state.turn;
  if (event.once) state.doneOnceEvents[event.id] = true;
  state.recentEvents.unshift(event.id);
  state.recentEvents = state.recentEvents.slice(0,7);
}

function resolveOutcome(choice){
  if (!choice.outcomes?.length) return null;
  return weightedPick(choice.outcomes, o => o.weight || 1);
}

function checkEnding(state){
  const sorted = [...data.endings].sort((a,b)=>b.priority-a.priority);
  return sorted.find(e => matchCondition(state, e.condition)) || null;
}

function runOne(maxTurns = 80) {
  const state = createState();
  const chosenEvents = [];
  for (let i = 0; i < maxTurns; i++) {
    const ending = checkEnding(state);
    if (ending) return { ending: ending.id, day: state.day, chosenEvents, seenCounts: state.seenCounts };
    const event = pickNextEvent(state);
    if (!event) return { ending: 'none', day: state.day, chosenEvents, seenCounts: state.seenCounts };
    recordSeen(state, event);
    chosenEvents.push(event.id);

    if (event.special) {
      if (event.special.type === 'skill_check') {
        const chance = 55;
        const success = Math.random() * 100 < chance;
        applyEffects(state, success ? event.special.successEffects : event.special.failEffects);
      } else if (event.special.type === 'route_pick') {
        const routes = event.special.routes || [];
        const pick = Math.floor(Math.random() * Math.max(1, routes.length));
        const safe = Math.floor(Math.random() * Math.max(1, routes.length));
        applyEffects(state, pick === safe ? event.special.successEffects : event.special.failEffects);
      }
      state.turn += 1;
      state.day += 1;
      applyPassiveDecay(state);
      state.currentEventId = null;
      continue;
    }

    const choices = event.choices.filter(c => matchCondition(state, c.condition));
    const choice = choices[Math.floor(Math.random() * choices.length)];
    applyEffects(state, choice.effects);
    const outcome = resolveOutcome(choice);
    if (outcome?.effects) applyEffects(state, outcome.effects);
    state.turn += 1;
    state.day += 1;
    applyPassiveDecay(state);
    state.currentEventId = null;
  }
  const end = checkEnding(state);
  return { ending: end ? end.id : 'max_turn', day: state.day, chosenEvents, seenCounts: state.seenCounts };
}

function main() {
  const N = 1000;
  const endings = {};
  let daySum = 0;
  let repeatedGames = 0;

  for (let i = 0; i < N; i++) {
    const r = runOne();
    endings[r.ending] = (endings[r.ending] || 0) + 1;
    daySum += r.day;

    const vals = Object.values(r.seenCounts);
    if (vals.some(v => v >= 3)) repeatedGames += 1;
  }

  console.log('runs', N);
  console.log('avg_day', (daySum / N).toFixed(2));
  console.log('games_with_any_event_seen_3plus', repeatedGames);
  console.log('ending_dist', endings);
}

main();

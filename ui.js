(function () {
  const game = window.GameEngine;
  const data = window.GAME_DATA;

  const titleEl = document.getElementById("event-title");
  const bodyEl = document.getElementById("event-body");
  const resultEl = document.getElementById("event-result");
  const eventHeroImgEl = document.getElementById("event-hero-img");
  const eventHeroMetaEl = document.getElementById("event-hero-meta");
  const stageEl = document.getElementById("stage-tag");
  const categoryEl = document.getElementById("event-category");
  const choicesEl = document.getElementById("choices");
  const statsEl = document.getElementById("stats");
  const memoryEl = document.getElementById("memory");
  const logEl = document.getElementById("log");
  const logToggleBtn = document.getElementById("toggle-log");
  const hookTextEl = document.getElementById("hook-text");

  const worldDistrictEl = document.getElementById("world-district");
  const worldRoadEl = document.getElementById("world-road");
  const worldRecordEl = document.getElementById("world-record");
  const worldPressureEl = document.getElementById("world-pressure");

  const setupEl = document.getElementById("setup-screen");
  const premiseEl = document.getElementById("premise-text");
  const nameInput = document.getElementById("player-name");
  const previewEl = document.getElementById("profile-preview");
  const startBtn = document.getElementById("btn-start");

  const identityNameEl = document.getElementById("id-name");
  const identityStatusEl = document.getElementById("id-status");
  const identityBondEl = document.getElementById("id-bond");
  const identityRiskEl = document.getElementById("id-risk");
  const npcRelationsEl = document.getElementById("npc-relations");

  const canvas = document.getElementById("skyline-canvas");
  const sceneStageEl = document.getElementById("scene-stage");
  const sceneLabelEl = document.getElementById("scene-label");

  const statLabelMap = Object.fromEntries((data.statDefs || []).map(s => [s.key, s.label]));
  const statIconMap = {
    health: "assets/icons/heart-pulse.svg",
    infection: "assets/icons/flame.svg",
    hunger: "assets/icons/warning-triangle.svg",
    supplies: "assets/icons/route.svg",
    stamina: "assets/icons/swords.svg",
    stress: "assets/icons/warning-triangle.svg",
    trust: "assets/icons/users.svg",
    shelter: "assets/icons/shield.svg"
  };
  const categoryIconMap = {
    崩溃初期: "assets/icons/flame.svg",
    封锁裂解: "assets/icons/lock-open.svg",
    组织重构: "assets/icons/users.svg",
    高压消耗: "assets/icons/swords.svg",
    长期求生: "assets/icons/shield.svg",
    终局: "assets/icons/warning-triangle.svg"
  };
  const sceneImageMap = {
    combat: "assets/images/shanghai-night-cc0.jpg",
    moral: "assets/images/shanghai-skyline-cc0.jpg",
    bond: "assets/images/shanghai-skyline-cc0.jpg",
    scavenge: "assets/images/shanghai-night-cc0.jpg",
    shelter: "assets/images/shanghai-skyline-cc0.jpg",
    zombie: "assets/images/shanghai-night-cc0.jpg",
    signal: "assets/images/shanghai-skyline-cc0.jpg",
    neutral: "assets/images/shanghai-skyline-cc0.jpg"
  };

  let latestView = null;
  let audioCtx = null;

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function ensureAudioContext() {
    if (audioCtx) return audioCtx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
    return audioCtx;
  }

  function playTone(freq = 220, duration = 0.08, type = "sine", gain = 0.03) {
    const ctx = ensureAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(gain, now + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.03);
  }

  function playUiSound(kind) {
    if (kind === "choice") {
      playTone(188, 0.08, "triangle", 0.026);
      setTimeout(() => playTone(265, 0.08, "triangle", 0.018), 45);
      return;
    }
    if (kind === "danger") {
      playTone(132, 0.14, "sawtooth", 0.03);
    }
  }

  function statPercent(def, val) {
    const span = def.max - def.min;
    return clamp(Math.round(((val - def.min) / span) * 100), 0, 100);
  }

  function renderStats(stats) {
    statsEl.innerHTML = "";
    data.statDefs.forEach(def => {
      const value = stats[def.key] ?? 0;
      const item = document.createElement("div");
      item.className = "stat-item";
      const icon = statIconMap[def.key] || "assets/icons/route.svg";
      item.innerHTML = `
        <div class="stat-head">
          <span class="stat-title"><img src="${icon}" alt="" class="mini-icon" />${def.label}</span>
          <span>${Math.round(value)}</span>
        </div>
        <div class="bar"><div class="fill ${def.inverse ? "inverse" : ""}" style="width:${statPercent(def, value)}%"></div></div>
      `;
      statsEl.appendChild(item);
    });
  }

  function renderMemory(entries) {
    memoryEl.innerHTML = "";
    const picks = (entries || []).slice(0, 6);
    picks.forEach((line, idx) => {
      const item = document.createElement("div");
      item.className = "memory-item";
      item.textContent = `${idx + 1}. ${line}`;
      memoryEl.appendChild(item);
    });
    if (!picks.length) {
      const item = document.createElement("div");
      item.className = "memory-item";
      item.textContent = "暂无关键轨迹";
      memoryEl.appendChild(item);
    }
  }

  function renderNpcRelations(npcs) {
    npcRelationsEl.innerHTML = "";
    (npcs || []).forEach(npc => {
      const item = document.createElement("div");
      const stanceClass = npc.value >= 70 ? "ally" : npc.value <= 30 ? "enemy" : "neutral";
      item.className = `npc-item ${stanceClass}`;
      item.innerHTML = `
        <div class=\"npc-head\">
          <span>${npc.name}</span>
          <span>${npc.value}</span>
        </div>
        <div class=\"npc-role\">${npc.role} · ${npc.stance}</div>
      `;
      npcRelationsEl.appendChild(item);
    });
  }

  function renderLog(log) {
    logEl.innerHTML = "";
    log.forEach(line => {
      const d = document.createElement("div");
      d.className = "log-item";
      d.textContent = line;
      logEl.appendChild(d);
    });
  }

  function renderIdentity(profile) {
    identityNameEl.textContent = `身份: ${profile?.name || "未命名"}（${profile?.citizenTag || "市民"}）`;
    identityStatusEl.textContent = `状态: ${profile?.statusLabel || "-"}`;
    identityBondEl.textContent = `盟友: ${profile?.topBond || "-"}`;
    identityRiskEl.textContent = `紧张关系: ${profile?.lowBond || "-"}`;
  }

  function renderWorld(view) {
    const world = view.world || {};
    worldDistrictEl.textContent = `区域: ${world.district || "未知"}`;
    worldRoadEl.textContent = `道路: ${world.road || "未知"}`;
    worldRecordEl.textContent = `纪录: ${Math.round(world.dayRecord || view.day || 0)}天`;
    worldPressureEl.textContent = `威胁: ${Math.round(world.pressure || 0)}`;

    if ((world.pressure || 0) >= 78) playUiSound("danger");
  }

  function renderSceneTheme(view) {
    const theme = view.sceneTheme || "neutral";
    sceneStageEl.className = `scene-stage ${theme}`;
    sceneLabelEl.textContent = String(theme).toUpperCase();
  }

  function renderEventHero(view) {
    const theme = view.sceneTheme || "neutral";
    eventHeroImgEl.src = sceneImageMap[theme] || sceneImageMap.neutral;
    eventHeroMetaEl.innerHTML = "";

    const categoryIcon = document.createElement("span");
    categoryIcon.className = "hero-chip";
    categoryIcon.innerHTML = `<img src="${categoryIconMap[view.category] || "assets/icons/map-pin.svg"}" alt="" class="mini-icon" />${view.category || "事件"}`;
    eventHeroMetaEl.appendChild(categoryIcon);

    const dayChip = document.createElement("span");
    dayChip.className = "hero-chip";
    dayChip.innerHTML = `<img src="assets/icons/map-pin.svg" alt="" class="mini-icon" />第${view.day}天`;
    eventHeroMetaEl.appendChild(dayChip);
  }

  function renderImpactPills(impact, wrap) {
    const statEntries = Object.entries(impact?.stats || {})
      .map(([k, v]) => [k, Math.round(v * 10) / 10])
      .filter(([, v]) => Math.abs(v) >= 0.5)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, 3);

    const npcEntries = (impact?.npcs || [])
      .filter(x => Math.abs(x.delta || 0) >= 0.5)
      .slice(0, 2);

    if (!statEntries.length && !npcEntries.length) {
      const pill = document.createElement("span");
      pill.className = "impact-pill";
      pill.textContent = "未知后果";
      wrap.appendChild(pill);
      return;
    }

    statEntries.forEach(([k, v]) => {
      const pill = document.createElement("span");
      pill.className = `impact-pill ${v >= 0 ? "pos" : "neg"}`;
      const sign = v > 0 ? "+" : "";
      pill.textContent = `${statLabelMap[k] || k} ${sign}${v}`;
      wrap.appendChild(pill);
    });

    npcEntries.forEach(x => {
      const pill = document.createElement("span");
      pill.className = `impact-pill npc ${x.delta >= 0 ? "pos" : "neg"}`;
      const sign = x.delta > 0 ? "+" : "";
      pill.textContent = `${x.name} ${sign}${x.delta}`;
      wrap.appendChild(pill);
    });
  }

  function pickChoice(choiceId) {
    if (!latestView) return;
    if (choiceId === "restart") {
      openSetup(game.state?.profile || null);
      return;
    }

    const choice = latestView.choices.find(c => c.id === choiceId);
    if (!choice || choice.disabled) return;
    playUiSound("choice");
    render(game.choose(choice.id));
  }

  function bindTarotSwipe(card, choiceId) {
    let startX = null;
    let moved = 0;

    card.addEventListener("pointerdown", e => {
      startX = e.clientX;
      moved = 0;
      card.setPointerCapture(e.pointerId);
    });

    card.addEventListener("pointermove", e => {
      if (startX == null) return;
      moved = e.clientX - startX;
      card.style.transform = `translateX(${clamp(moved, -30, 30)}px) rotate(${moved * 0.05}deg)`;
    });

    card.addEventListener("pointerup", () => {
      if (Math.abs(moved) > 24) {
        card.style.transform = "translateX(0) rotate(0deg)";
        pickChoice(choiceId);
        startX = null;
        return;
      }
      card.style.transform = "translateX(0) rotate(0deg)";
      startX = null;
    });
  }

  function renderChoices(view) {
    choicesEl.innerHTML = "";
    const count = view.choices.length;
    let cardMin = 190;
    if (count <= 3) cardMin = 260;
    else if (count === 4) cardMin = 220;
    else if (count === 5) cardMin = 200;
    choicesEl.style.setProperty("--card-min", `${cardMin}px`);
    choicesEl.setAttribute("data-count", String(count));

    view.choices.forEach((choice, index) => {
      const card = document.createElement("article");
      card.className = `choice-card tarot-card ${choice.disabled ? "disabled" : ""}`;
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", choice.disabled ? "-1" : "0");

      const top = document.createElement("div");
      top.className = "tarot-top";
      top.innerHTML = `<span>ARCANA ${String(index + 1).padStart(2, "0")}</span><img src="${categoryIconMap[view.category] || "assets/icons/route.svg"}" alt="" class="mini-icon" />`;
      card.appendChild(top);

      const label = document.createElement("div");
      label.className = "choice-label";
      label.textContent = choice.label;
      card.appendChild(label);

      const impactWrap = document.createElement("div");
      impactWrap.className = "impact-wrap";
      renderImpactPills(choice.impact, impactWrap);
      card.appendChild(impactWrap);

      const bottom = document.createElement("div");
      bottom.className = "tarot-bottom";
      bottom.innerHTML = `<span>[#${index + 1}]</span>${choice.impact?.npcs?.length ? `<span class="npc-hint"><img src="assets/icons/users.svg" alt="" class="mini-icon" />关系变动</span>` : ""}`;
      card.appendChild(bottom);

      if (!choice.disabled) {
        card.addEventListener("click", () => pickChoice(choice.id));
        card.addEventListener("keydown", e => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            pickChoice(choice.id);
          }
        });
        bindTarotSwipe(card, choice.id);
      }

      choicesEl.appendChild(card);
    });
  }

  function render(view) {
    latestView = view;

    stageEl.textContent = `${view.stageLabel} | 第${view.day}天`;
    categoryEl.textContent = `事件类型: ${view.category || "未知"}`;
    titleEl.textContent = view.title;
    bodyEl.textContent = view.body;
    resultEl.textContent = view.result || "";

    renderSceneTheme(view);
    renderEventHero(view);
    renderChoices(view);
    renderStats(view.stats);
    renderIdentity(view.profile);
    renderWorld(view);
    renderNpcRelations(view.npcs || []);
    renderMemory(view.memory?.majorDecisions || view.log);
    renderLog(view.log);
  }

  function openSetup(seedProfile) {
    setupEl.classList.remove("hidden");
    if (seedProfile?.name) nameInput.value = seedProfile.name;
    previewEl.textContent = `你将以“普通上海市民”身份进入叙事。\n目标: 尽可能提升生存天数纪录。`;
  }

  function startRun() {
    const profile = {
      name: (nameInput.value || "匿名市民").trim().slice(0, 16) || "匿名市民"
    };
    const view = game.start(profile);
    setupEl.classList.add("hidden");
    render(view);
  }

  function bindKeyboardShortcuts() {
    window.addEventListener("keydown", e => {
      if (!setupEl.classList.contains("hidden")) return;
      if (!latestView || !latestView.choices?.length) return;

      if (e.key >= "1" && e.key <= "9") {
        const idx = Number(e.key) - 1;
        const choice = latestView.choices[idx];
        if (choice && !choice.disabled) pickChoice(choice.id);
      }
    });
  }

  function bindAudioUnlock() {
    const unlock = () => {
      const ctx = ensureAudioContext();
      if (ctx && ctx.state === "suspended") ctx.resume();
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
  }

  function initSkyline() {
    const ctx = canvas.getContext("2d");
    const buildings = [];
    const stars = [];

    function resize() {
      canvas.width = Math.max(800, Math.floor(window.innerWidth * window.devicePixelRatio));
      canvas.height = Math.max(520, Math.floor(window.innerHeight * window.devicePixelRatio));
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;

      buildings.length = 0;
      const base = canvas.height * 0.8;
      for (let x = 0; x < canvas.width; ) {
        const w = 24 + Math.random() * 72;
        const h = 60 + Math.random() * 190;
        buildings.push({ x, w, h, y: base - h });
        x += w + 5;
      }

      stars.length = 0;
      for (let i = 0; i < 90; i += 1) {
        stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height * 0.62,
          r: 0.5 + Math.random() * 1.8,
          t: Math.random() * Math.PI * 2
        });
      }
    }

    function draw(ts) {
      const pressure = latestView?.world?.pressure || 0;
      const glow = 0.08 + pressure / 430;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const grd = ctx.createLinearGradient(0, 0, 0, canvas.height);
      grd.addColorStop(0, `rgba(60, 88, 118, ${0.34 + glow})`);
      grd.addColorStop(1, "rgba(9, 13, 18, 0.12)");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      stars.forEach(s => {
        const pulse = 0.5 + Math.sin(ts / 780 + s.t) * 0.4;
        ctx.fillStyle = `rgba(229, 238, 245, ${0.08 + pulse * 0.2})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      });

      buildings.forEach((b, idx) => {
        const shade = 17 + (idx % 5) * 7;
        ctx.fillStyle = `rgba(${shade}, ${shade + 10}, ${shade + 18}, 0.78)`;
        ctx.fillRect(b.x, b.y, b.w, b.h);
      });

      const waveY = canvas.height * 0.7 + Math.sin(ts / 430) * 12;
      ctx.strokeStyle = `rgba(255, 115, 96, ${0.12 + pressure / 520})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x < canvas.width; x += 10) {
        const y = waveY + Math.sin((x + ts * 0.26) / 24) * (4 + pressure / 20);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      requestAnimationFrame(draw);
    }

    resize();
    requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
  }

  document.getElementById("btn-save").addEventListener("click", () => {
    const msg = game.save();
    resultEl.textContent = msg;
  });

  document.getElementById("btn-load").addEventListener("click", () => {
    const loaded = game.load();
    const view = game.getCurrentView(false);
    setupEl.classList.add("hidden");
    render(view);
    resultEl.textContent = loaded.message;
  });

  document.getElementById("btn-restart").addEventListener("click", () => {
    openSetup(game.state?.profile || null);
  });

  logToggleBtn.addEventListener("click", () => {
    logEl.classList.toggle("collapsed");
    logToggleBtn.textContent = logEl.classList.contains("collapsed") ? "行动日志 ▸" : "行动日志 ▾";
  });

  startBtn.addEventListener("click", startRun);

  hookTextEl.textContent = data.meta.hook;
  premiseEl.textContent = `${data.meta.premise}\n\n提示: 本作为架空叙事挑战，不对应现实结论。`;

  openSetup(null);
  bindKeyboardShortcuts();
  bindAudioUnlock();
  initSkyline();
})();

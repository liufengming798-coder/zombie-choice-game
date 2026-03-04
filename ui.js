(function () {
  const game = window.GameEngine;
  const data = window.GAME_DATA;

  const titleEl = document.getElementById("event-title");
  const bodyEl = document.getElementById("event-body");
  const resultEl = document.getElementById("event-result");
  const stageEl = document.getElementById("stage-tag");
  const categoryEl = document.getElementById("event-category");
  const choicesEl = document.getElementById("choices");
  const statsEl = document.getElementById("stats");
  const logEl = document.getElementById("log");
  const logToggleBtn = document.getElementById("toggle-log");
  const hookTextEl = document.getElementById("hook-text");

  const worldDistrictEl = document.getElementById("world-district");
  const worldWeatherEl = document.getElementById("world-weather");
  const worldPressureEl = document.getElementById("world-pressure");

  const tacticButtonsEl = document.getElementById("tactic-buttons");
  const tacticDescEl = document.getElementById("tactic-desc");

  const setupEl = document.getElementById("setup-screen");
  const nameInput = document.getElementById("player-name");
  const careerSelect = document.getElementById("player-career");
  const bgSelect = document.getElementById("player-background");
  const previewEl = document.getElementById("profile-preview");
  const startBtn = document.getElementById("btn-start");

  const identityNameEl = document.getElementById("id-name");
  const identityCareerEl = document.getElementById("id-career");
  const identityBgEl = document.getElementById("id-background");

  const specialPanelEl = document.getElementById("special-panel");
  const canvas = document.getElementById("skyline-canvas");
  const sceneStageEl = document.getElementById("scene-stage");
  const sceneLabelEl = document.getElementById("scene-label");

  const statLabelMap = Object.fromEntries((data.statDefs || []).map(s => [s.key, s.label]));

  let latestView = null;
  let specialTimerId = null;
  let specialRemain = 0;
  let specialEventId = null;
  let specialNotifiedId = null;
  let audioCtx = null;

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
    amp.gain.exponentialRampToValueAtTime(gain, now + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function playUiSound(kind) {
    if (kind === "choice") {
      playTone(240, 0.07, "triangle", 0.028);
      return;
    }
    if (kind === "special") {
      playTone(188, 0.12, "square", 0.024);
      setTimeout(() => playTone(262, 0.08, "triangle", 0.02), 45);
      return;
    }
    if (kind === "danger") {
      playTone(132, 0.16, "sawtooth", 0.028);
      return;
    }
    if (kind === "tactic") {
      playTone(320, 0.06, "triangle", 0.02);
      return;
    }
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function clearSpecialTimer() {
    if (specialTimerId) {
      clearInterval(specialTimerId);
      specialTimerId = null;
    }
    specialRemain = 0;
    specialEventId = null;
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
      item.innerHTML = `
        <div class="stat-head">
          <span>${def.label}</span>
          <span>${Math.round(value)}</span>
        </div>
        <div class="bar"><div class="fill ${def.inverse ? "inverse" : ""}" style="width:${statPercent(def, value)}%"></div></div>
      `;
      statsEl.appendChild(item);
    });
  }

  function formatImpact(impact) {
    const entries = Object.entries(impact || {})
      .map(([k, v]) => [k, Math.round(v * 10) / 10])
      .filter(([, v]) => Math.abs(v) >= 0.5)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, 4);

    if (!entries.length) return "影响较小";
    return entries.map(([k, v]) => {
      const sign = v > 0 ? "+" : "";
      return `${statLabelMap[k] || k} ${sign}${v}`;
    }).join(" · ");
  }

  function renderImpactPills(impact, wrap) {
    const entries = Object.entries(impact || {})
      .map(([k, v]) => [k, Math.round(v * 10) / 10])
      .filter(([, v]) => Math.abs(v) >= 0.5)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, 4);

    if (!entries.length) {
      const pill = document.createElement("span");
      pill.className = "impact-pill";
      pill.textContent = "波动较小";
      wrap.appendChild(pill);
      return;
    }

    entries.forEach(([k, v]) => {
      const pill = document.createElement("span");
      pill.className = `impact-pill ${v >= 0 ? "pos" : "neg"}`;
      const sign = v > 0 ? "+" : "";
      pill.textContent = `${statLabelMap[k] || k} ${sign}${v}`;
      wrap.appendChild(pill);
    });
  }

  function pickChoice(choiceId) {
    if (!latestView) return;
    if (choiceId === "restart") {
      clearSpecialTimer();
      openSetup(game.state?.profile || null);
      return;
    }
    const choice = latestView.choices.find(c => c.id === choiceId);
    if (!choice || choice.disabled) return;
    playUiSound("choice");
    render(game.choose(choice.id));
  }

  function bindChoiceSwipe(card, choiceId) {
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
      card.style.transform = `translateX(${clamp(moved, -32, 32)}px)`;
    });

    card.addEventListener("pointerup", () => {
      if (Math.abs(moved) > 28) {
        card.style.transform = "translateX(0)";
        pickChoice(choiceId);
        startX = null;
        return;
      }
      card.style.transform = "translateX(0)";
      startX = null;
    });
  }

  function renderChoices(view) {
    choicesEl.innerHTML = "";

    view.choices.forEach((choice, index) => {
      const card = document.createElement("article");
      card.className = `choice-card ${choice.disabled ? "disabled" : ""}`;
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", choice.disabled ? "-1" : "0");

      const label = document.createElement("div");
      label.className = "choice-label";
      label.textContent = `[${index + 1}] ${choice.label}`;
      card.appendChild(label);

      const impactWrap = document.createElement("div");
      impactWrap.className = "impact-wrap";
      renderImpactPills(choice.impact, impactWrap);
      card.appendChild(impactWrap);

      const helper = document.createElement("div");
      helper.className = "scene-sub";
      helper.textContent = formatImpact(choice.impact);
      card.appendChild(helper);

      if (!choice.disabled) {
        card.addEventListener("click", () => pickChoice(choice.id));
        card.addEventListener("keydown", e => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            pickChoice(choice.id);
          }
        });
        bindChoiceSwipe(card, choice.id);
      }
      choicesEl.appendChild(card);
    });
  }

  function renderSpecial(view) {
    clearSpecialTimer();
    specialPanelEl.innerHTML = "";
    specialPanelEl.classList.add("hidden");

    if (!view.special) {
      specialNotifiedId = null;
      return;
    }
    if (specialNotifiedId !== view.eventId) {
      playUiSound("special");
      specialNotifiedId = view.eventId;
    }
    specialPanelEl.classList.remove("hidden");

    const h = document.createElement("h4");
    h.textContent = `特殊事件 · ${view.special.title}`;
    specialPanelEl.appendChild(h);

    const desc = document.createElement("div");
    desc.textContent = view.special.description || "";
    specialPanelEl.appendChild(desc);

    const meta = document.createElement("div");
    meta.className = "special-meta";
    meta.textContent = view.special.meta || "";
    specialPanelEl.appendChild(meta);

    const timerEl = document.createElement("div");
    timerEl.className = "special-meta";
    specialPanelEl.appendChild(timerEl);

    const actions = document.createElement("div");
    actions.className = "special-actions";

    if (view.special.type === "skill_check") {
      const btn = document.createElement("button");
      btn.className = "btn";
      btn.textContent = view.special.actionLabel || "执行";
      btn.addEventListener("click", () => render(game.resolveSpecial({})));
      actions.appendChild(btn);
    }

    if (view.special.type === "route_pick") {
      (view.special.routes || []).forEach((route, idx) => {
        const btn = document.createElement("button");
        btn.className = "btn";
        btn.textContent = route;
        btn.addEventListener("click", () => render(game.resolveSpecial({ routeIndex: idx })));
        actions.appendChild(btn);
      });
    }

    specialPanelEl.appendChild(actions);

    if ((view.special.timerSec || 0) > 0) {
      specialRemain = view.special.timerSec;
      specialEventId = view.eventId;
      timerEl.textContent = `倒计时 ${specialRemain}s`;
      specialTimerId = setInterval(() => {
        specialRemain -= 1;
        timerEl.textContent = `倒计时 ${Math.max(0, specialRemain)}s`;
        if (specialRemain === 3 || specialRemain === 2 || specialRemain === 1) playUiSound("danger");
        if (specialRemain <= 0) {
          clearSpecialTimer();
          render(game.resolveSpecial({ timeout: true }));
        }
      }, 1000);
    }
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
    identityNameEl.textContent = `姓名: ${profile?.name || "未命名"}`;
    identityCareerEl.textContent = `职业: ${profile?.careerLabel || "-"}`;
    identityBgEl.textContent = `末日角色: ${profile?.backgroundLabel || "-"}`;
  }

  function renderWorld(view) {
    const world = view.world || {};
    worldDistrictEl.textContent = `区域: ${world.district || "未知"}`;
    worldWeatherEl.textContent = `天气: ${world.weather || "未知"}`;
    worldWeatherEl.title = world.weatherDesc || "";
    worldPressureEl.textContent = `威胁: ${Math.round(world.pressure || 0)}`;
  }

  function renderTactics(view) {
    tacticButtonsEl.innerHTML = "";
    (view.tactics || []).forEach(t => {
      const btn = document.createElement("button");
      btn.className = `tactic-btn ${view.tactic === t.id ? "active" : ""}`;
      btn.textContent = t.label;
      btn.title = t.desc;
      btn.addEventListener("click", () => {
        game.setTactic(t.id);
        playUiSound("tactic");
        const refreshed = game.getCurrentView(false);
        render(refreshed);
      });
      tacticButtonsEl.appendChild(btn);
    });

    const active = (view.tactics || []).find(t => t.id === view.tactic);
    tacticDescEl.textContent = active?.desc || "";
  }

  function renderSceneTheme(view) {
    const theme = view.sceneTheme || "neutral";
    if (!sceneStageEl) return;
    sceneStageEl.className = `scene-stage ${theme}`;
    if (sceneLabelEl) sceneLabelEl.textContent = String(theme).toUpperCase();
  }

  function render(view) {
    latestView = view;
    if (specialEventId && specialEventId !== view.eventId) clearSpecialTimer();

    stageEl.textContent = `${view.stageLabel} | 第${view.day}天`;
    categoryEl.textContent = `事件类型: ${view.category || "结局"}`;
    titleEl.textContent = view.title;
    bodyEl.textContent = view.body;
    resultEl.textContent = view.result || "";

    renderSceneTheme(view);
    renderSpecial(view);
    renderChoices(view);
    renderStats(view.stats);
    renderIdentity(view.profile);
    renderWorld(view);
    renderTactics(view);
    renderLog(view.log);
  }

  function fillProfileSelectors() {
    const profiles = game.getProfileOptions();
    careerSelect.innerHTML = "";

    profiles.careers.forEach(x => {
      const opt = document.createElement("option");
      opt.value = x.id;
      opt.textContent = `${x.label}`;
      careerSelect.appendChild(opt);
    });
    renderBackgroundOptions(careerSelect.value, null);
  }

  function renderBackgroundOptions(careerId, preferredBackground) {
    const profiles = game.getProfileOptions();
    const all = profiles.backgrounds || [];
    const options = all.filter(bg => !bg.careers || bg.careers.includes(careerId));
    const finalOptions = options.length ? options : all;
    const keep = preferredBackground && finalOptions.some(x => x.id === preferredBackground);

    bgSelect.innerHTML = "";
    finalOptions.forEach(x => {
      const opt = document.createElement("option");
      opt.value = x.id;
      opt.textContent = `${x.label}`;
      bgSelect.appendChild(opt);
    });
    if (keep) bgSelect.value = preferredBackground;
  }

  function updateProfilePreview() {
    const profiles = game.getProfileOptions();
    const c = profiles.careers.find(x => x.id === careerSelect.value) || profiles.careers[0];
    const b = profiles.backgrounds.find(x => x.id === bgSelect.value) || profiles.backgrounds[0];
    previewEl.textContent = `末日前职业: ${c.label}（${c.desc}）\n末日角色: ${b.label}（${b.desc}）`;
  }

  function openSetup(seedProfile) {
    setupEl.classList.remove("hidden");
    if (seedProfile?.name) nameInput.value = seedProfile.name;
    if (seedProfile?.career) careerSelect.value = seedProfile.career;
    renderBackgroundOptions(careerSelect.value, seedProfile?.background || null);
    updateProfilePreview();
  }

  function startRun() {
    const profile = {
      name: (nameInput.value || "无名").trim().slice(0, 12) || "无名",
      career: careerSelect.value,
      background: bgSelect.value
    };
    const view = game.start(profile);
    setupEl.classList.add("hidden");
    render(view);
  }

  function bindKeyboardShortcuts() {
    window.addEventListener("keydown", e => {
      if (setupEl && !setupEl.classList.contains("hidden")) return;
      if (!latestView || !latestView.choices?.length) return;

      if (e.key >= "1" && e.key <= "9") {
        const idx = Number(e.key) - 1;
        const choice = latestView.choices[idx];
        if (choice && !choice.disabled) pickChoice(choice.id);
        return;
      }

      if (e.key.toLowerCase() === "a") {
        const choice = latestView.choices[0];
        if (choice && !choice.disabled) pickChoice(choice.id);
      }

      if (e.key.toLowerCase() === "d") {
        const choice = latestView.choices[1];
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
      const base = canvas.height * 0.78;
      for (let x = 0; x < canvas.width; ) {
        const w = 30 + Math.random() * 68;
        const h = 50 + Math.random() * 170;
        buildings.push({ x, w, h, y: base - h });
        x += w + 6;
      }

      stars.length = 0;
      for (let i = 0; i < 80; i += 1) {
        stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height * 0.65,
          r: 0.6 + Math.random() * 1.6,
          t: Math.random() * Math.PI * 2
        });
      }
    }

    function draw(ts) {
      const pressure = latestView?.world?.pressure || 0;
      const noise = latestView?.stats?.noise || 0;
      const glow = 0.08 + pressure / 450;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const grd = ctx.createLinearGradient(0, 0, 0, canvas.height);
      grd.addColorStop(0, `rgba(58, 91, 120, ${0.32 + glow})`);
      grd.addColorStop(1, "rgba(13, 18, 24, 0.1)");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      stars.forEach(s => {
        const pulse = 0.5 + Math.sin(ts / 700 + s.t) * 0.4;
        ctx.fillStyle = `rgba(223, 235, 247, ${0.08 + pulse * 0.22})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      });

      buildings.forEach((b, idx) => {
        const shade = 18 + (idx % 4) * 8;
        ctx.fillStyle = `rgba(${shade}, ${shade + 8}, ${shade + 16}, 0.74)`;
        ctx.fillRect(b.x, b.y, b.w, b.h);
      });

      const waveY = canvas.height * 0.68 + Math.sin(ts / 400) * 10;
      ctx.strokeStyle = `rgba(255, 114, 92, ${0.12 + noise / 520})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x < canvas.width; x += 12) {
        const y = waveY + Math.sin((x + ts * 0.25) / 28) * (4 + pressure / 22);
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
    clearSpecialTimer();
    openSetup(game.state?.profile || null);
  });

  logToggleBtn.addEventListener("click", () => {
    logEl.classList.toggle("collapsed");
    logToggleBtn.textContent = logEl.classList.contains("collapsed") ? "行动日志 ▸" : "行动日志 ▾";
  });

  careerSelect.addEventListener("change", () => {
    renderBackgroundOptions(careerSelect.value, bgSelect.value);
    updateProfilePreview();
  });

  bgSelect.addEventListener("change", updateProfilePreview);
  startBtn.addEventListener("click", startRun);

  fillProfileSelectors();
  hookTextEl.textContent = data.meta.hook;
  openSetup(null);
  bindKeyboardShortcuts();
  bindAudioUnlock();
  initSkyline();
})();

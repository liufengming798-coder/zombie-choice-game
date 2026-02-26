(function () {
  const game = window.GameEngine;
  const data = window.GAME_DATA;

  const titleEl = document.getElementById("event-title");
  const bodyEl = document.getElementById("event-body");
  const resultEl = document.getElementById("event-result");
  const stageEl = document.getElementById("stage-tag");
  const choicesEl = document.getElementById("choices");
  const statsEl = document.getElementById("stats");
  const logEl = document.getElementById("log");
  const logToggleBtn = document.getElementById("toggle-log");
  const hookTextEl = document.getElementById("hook-text");

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
  let specialTimerId = null;
  let specialRemain = 0;
  let specialEventId = null;

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
    return Math.round(((val - def.min) / span) * 100);
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

  function renderChoices(view) {
    choicesEl.innerHTML = "";
    view.choices.forEach(choice => {
      const btn = document.createElement("button");
      btn.className = "btn";
      btn.textContent = choice.label;
      btn.disabled = !!choice.disabled;
      btn.addEventListener("click", () => {
        if (choice.id === "restart") {
          openSetup(view.profile);
          return;
        }
        render(game.choose(choice.id));
      });
      choicesEl.appendChild(btn);
    });
  }

  function renderSpecial(view) {
    clearSpecialTimer();
    specialPanelEl.innerHTML = "";
    specialPanelEl.classList.add("hidden");

    if (!view.special) return;
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
        if (specialRemain <= 0) {
          clearSpecialTimer();
          render(game.resolveSpecial({ timeout: true }));
        }
      }, 1000);
    } else {
      timerEl.textContent = "";
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
    identityBgEl.textContent = `身份: ${profile?.backgroundLabel || "-"}`;
  }

  function render(view) {
    if (specialEventId && specialEventId !== view.eventId) clearSpecialTimer();
    stageEl.textContent = `${view.stageLabel} | 第${view.day}天`;
    titleEl.textContent = view.title;
    bodyEl.textContent = view.body;
    resultEl.textContent = view.result || "";
    renderSpecial(view);
    renderChoices(view);
    renderStats(view.stats);
    renderIdentity(view.profile);
    renderLog(view.log);
  }

  function fillProfileSelectors() {
    const profiles = game.getProfileOptions();
    careerSelect.innerHTML = "";
    bgSelect.innerHTML = "";

    profiles.careers.forEach(x => {
      const opt = document.createElement("option");
      opt.value = x.id;
      opt.textContent = `${x.label}`;
      careerSelect.appendChild(opt);
    });

    profiles.backgrounds.forEach(x => {
      const opt = document.createElement("option");
      opt.value = x.id;
      opt.textContent = `${x.label}`;
      bgSelect.appendChild(opt);
    });
  }

  function updateProfilePreview() {
    const profiles = game.getProfileOptions();
    const c = profiles.careers.find(x => x.id === careerSelect.value) || profiles.careers[0];
    const b = profiles.backgrounds.find(x => x.id === bgSelect.value) || profiles.backgrounds[0];
    previewEl.textContent = `职业特性: ${c.desc} | 身份特性: ${b.desc}`;
  }

  function openSetup(seedProfile) {
    setupEl.classList.remove("hidden");
    if (seedProfile?.name) nameInput.value = seedProfile.name;
    if (seedProfile?.career) careerSelect.value = seedProfile.career;
    if (seedProfile?.background) bgSelect.value = seedProfile.background;
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

  careerSelect.addEventListener("change", updateProfilePreview);
  bgSelect.addEventListener("change", updateProfilePreview);
  startBtn.addEventListener("click", startRun);

  fillProfileSelectors();
  hookTextEl.textContent = data.meta.hook;
  openSetup(null);
})();

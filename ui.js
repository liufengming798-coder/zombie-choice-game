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
          render(game.reset());
          return;
        }
        render(game.choose(choice.id));
      });
      choicesEl.appendChild(btn);
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

  function render(view) {
    stageEl.textContent = `${view.stageLabel} | 第${view.day}天`;
    titleEl.textContent = view.title;
    bodyEl.textContent = view.body;
    resultEl.textContent = view.result || "";
    renderChoices(view);
    renderStats(view.stats);
    renderLog(view.log);
  }

  document.getElementById("btn-save").addEventListener("click", () => {
    const msg = game.save();
    resultEl.textContent = msg;
  });

  document.getElementById("btn-load").addEventListener("click", () => {
    const loaded = game.load();
    const view = game.getCurrentView(false);
    render(view);
    resultEl.textContent = loaded.message;
  });

  document.getElementById("btn-restart").addEventListener("click", () => {
    render(game.reset());
  });

  logToggleBtn.addEventListener("click", () => {
    logEl.classList.toggle("collapsed");
    logToggleBtn.textContent = logEl.classList.contains("collapsed") ? "日志 ▸" : "日志 ▾";
  });

  render(game.reset());
})();

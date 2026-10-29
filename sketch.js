const QUICK_MINUTES = [1, 3, 5, 10, 15, 20];
const RING_CIRCUMFERENCE = 2 * Math.PI * 118;

let timerState = {
  running: false,
  paused: false,
  finished: false,
  phase: "work",
  round: 1,
  workMs: 0,
  restMs: 0,
  rounds: 1,
  phaseDuration: 0,
  deadline: 0,
  pausedMs: 0
};

let audioContext;
let transitionSound;
let transitionSoundUnlocked = false;
let lastPaintedSecond = -1;
let lastPaintedPhase = null;

function setup() {
  noCanvas();
  document.documentElement.lang = "zh-Hant";
  document.title = "小組運動計時器";
  document.body.innerHTML = `
    <main class="app-shell">
      <header class="topbar">
        <a class="brand" href="#" aria-label="小組運動計時器首頁">
          <span class="brand-mark" aria-hidden="true">◎</span>
          <span>小組運動計時器</span>
        </a>
        <button class="icon-button fullscreen-button" id="fullscreen-button" type="button" aria-label="進入全螢幕">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M3 16v5h5m13-5v5h-5"/></svg>
          <span>全螢幕</span>
        </button>
      </header>

      <section class="timer-card" aria-label="小組倒數計時器">
        <div class="settings-panel">
          <div class="eyebrow"><span class="eyebrow-dot"></span> GROUP WORKOUT TIMER</div>
          <h1>準備好，<span>開始動起來。</span></h1>
          <p class="intro">設定運動與休息時間，帶領每一組訓練。</p>

          <div class="quick-settings">
            <div class="section-label">快速設定 <span>運動時間</span></div>
            <div class="quick-buttons" id="quick-buttons"></div>
          </div>

          <div class="field-grid">
            <label class="field">
              <span class="field-label">運動時間</span>
              <span class="time-inputs">
                <span class="input-wrap"><input id="work-minutes" type="number" min="0" max="99" value="1" inputmode="numeric" aria-label="運動分鐘"><small>分</small></span>
                <span class="time-colon">:</span>
                <span class="input-wrap"><input id="work-seconds" type="number" min="0" max="59" value="0" inputmode="numeric" aria-label="運動秒數"><small>秒</small></span>
              </span>
            </label>
            <label class="field">
              <span class="field-label">休息時間</span>
              <span class="time-inputs">
                <span class="input-wrap"><input id="rest-minutes" type="number" min="0" max="99" value="0" inputmode="numeric" aria-label="休息分鐘"><small>分</small></span>
                <span class="time-colon">:</span>
                <span class="input-wrap"><input id="rest-seconds" type="number" min="0" max="59" value="15" inputmode="numeric" aria-label="休息秒數"><small>秒</small></span>
              </span>
            </label>
          </div>

          <label class="rounds-field" for="round-count">
            <span><span class="field-label">循環組數</span><small>運動＋休息為 1 個循環</small></span>
            <span class="round-stepper">
              <button type="button" id="round-minus" aria-label="減少組數">−</button>
              <input id="round-count" type="number" min="1" max="99" value="3" inputmode="numeric" aria-label="循環組數">
              <button type="button" id="round-plus" aria-label="增加組數">＋</button>
            </span>
          </label>

          <div class="quick-note"><span class="note-icon">↗</span> 空白鍵開始／暫停 <span class="note-divider">·</span> R 重設</div>
        </div>

        <div class="display-panel" id="display-panel">
          <div class="timer-topline">
            <span class="phase-badge" id="phase-badge"><span class="phase-dot"></span><span id="phase-label">準備開始</span></span>
            <span class="round-label" id="round-label">第 <b>1</b> / 3 組</span>
          </div>
          <div class="timer-display" id="timer-display">
            <svg class="progress-ring" viewBox="0 0 260 260" role="img" aria-label="計時進度">
              <defs>
                <linearGradient id="ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#81f7d8"/>
                  <stop offset="100%" stop-color="#55b5ff"/>
                </linearGradient>
              </defs>
              <circle class="ring-track" cx="130" cy="130" r="118"/>
              <circle class="ring-progress" id="ring-progress" cx="130" cy="130" r="118"/>
            </svg>
            <div class="time-center">
              <div class="time-readout" id="time-readout" aria-live="polite">01:00</div>
              <div class="time-caption" id="time-caption">準備就緒</div>
            </div>
          </div>
          <p class="timer-message" id="timer-message" aria-live="polite">設定好時間，就可以出發了。</p>
          <div class="timer-controls">
            <button class="start-button" id="start-button" type="button"><span class="play-icon">▶</span><span>開始</span></button>
            <button class="reset-button" id="reset-button" type="button"><span class="reset-icon">↻</span>重設</button>
          </div>
        </div>
      </section>
      <footer class="footer"><span>MOVE TOGETHER</span><span>每一次努力，都是進步。</span></footer>
    </main>
  `;

  buildQuickButtons();
  bindControls();
  transitionSound = new Audio("y1457.mp3");
  transitionSound.preload = "auto";
  transitionSound.volume = 1;
  refreshPreview();
}

function draw() {
  if (!timerState.running) return;

  advanceTimer(Date.now());
  const remaining = Math.max(0, timerState.deadline - Date.now());
  const second = Math.ceil(remaining / 1000);
  if (second !== lastPaintedSecond || timerState.phase !== lastPaintedPhase) {
    paintTimer(remaining);
    playTimerCue(second, timerState.phase);
    lastPaintedSecond = second;
    lastPaintedPhase = timerState.phase;
  }
}

function buildQuickButtons() {
  const container = document.getElementById("quick-buttons");
  QUICK_MINUTES.forEach((minutes) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "quick-button";
    button.textContent = `${minutes} 分`;
    button.addEventListener("click", () => {
      if (timerIsActive()) return;
      document.getElementById("work-minutes").value = minutes;
      document.getElementById("work-seconds").value = 0;
      refreshPreview();
      markQuickButton(minutes);
    });
    container.appendChild(button);
  });
  markQuickButton(1);
}

function bindControls() {
  ["work-minutes", "work-seconds", "rest-minutes", "rest-seconds", "round-count"].forEach((id) => {
    document.getElementById(id).addEventListener("input", () => {
      if (timerIsActive()) return;
      normalizeInput(id);
      markQuickButton(null);
      refreshPreview();
    });
  });

  document.getElementById("round-minus").addEventListener("click", () => adjustRounds(-1));
  document.getElementById("round-plus").addEventListener("click", () => adjustRounds(1));
  document.getElementById("start-button").addEventListener("click", toggleTimer);
  document.getElementById("reset-button").addEventListener("click", resetTimer);
  document.getElementById("fullscreen-button").addEventListener("click", toggleFullscreen);

  document.addEventListener("keydown", (event) => {
    const editing = event.target instanceof HTMLElement &&
      event.target.closest("input, textarea, select, [contenteditable='true']");
    if (editing || event.repeat) return;
    if (event.code === "Space") {
      event.preventDefault();
      toggleTimer();
    } else if (event.key.toLowerCase() === "r") {
      resetTimer();
    }
  });
}

function normalizeInput(id) {
  const input = document.getElementById(id);
  const min = Number(input.min);
  const max = Number(input.max);
  let value = Number.parseInt(input.value, 10);
  if (!Number.isFinite(value)) value = min;
  value = Math.max(min, Math.min(max, value));
  input.value = value;
}

function adjustRounds(amount) {
  if (timerIsActive()) return;
  const input = document.getElementById("round-count");
  input.value = Math.max(1, Math.min(99, (Number(input.value) || 1) + amount));
  refreshPreview();
}

function markQuickButton(minutes) {
  document.querySelectorAll(".quick-button").forEach((button, index) => {
    button.classList.toggle("selected", QUICK_MINUTES[index] === minutes);
  });
}

function readSettings() {
  const value = (id) => Number(document.getElementById(id).value) || 0;
  return {
    workMs: (value("work-minutes") * 60 + value("work-seconds")) * 1000,
    restMs: (value("rest-minutes") * 60 + value("rest-seconds")) * 1000,
    rounds: Math.max(1, value("round-count"))
  };
}

function refreshPreview() {
  const settings = readSettings();
  const startSeconds = settings.workMs > 0 ? Math.ceil(settings.workMs / 1000) : 0;
  document.getElementById("time-readout").textContent = formatTime(startSeconds);
  document.getElementById("time-caption").textContent = "準備就緒";
  document.getElementById("phase-label").textContent = "準備開始";
  document.getElementById("round-label").innerHTML = `第 <b>1</b> / ${settings.rounds} 組`;
  document.getElementById("timer-message").textContent =
    settings.workMs > 0 ? "設定好時間，就可以出發了。" : "請設定大於 0 的運動時間。";
  setRingProgress(1);
  setAlertState(false);
  document.getElementById("start-button").disabled = settings.workMs === 0;
}

function toggleTimer() {
  if (timerState.running) {
    timerState.pausedMs = Math.max(0, timerState.deadline - Date.now());
    timerState.running = false;
    timerState.paused = true;
    document.getElementById("start-button").innerHTML = '<span class="play-icon">▶</span><span>繼續</span>';
    document.getElementById("phase-label").textContent = "已暫停";
    document.getElementById("time-caption").textContent = "已暫停";
    document.getElementById("timer-message").textContent = "休息一下，準備好再繼續。";
    return;
  }

  if (timerState.finished) resetTimer();
  if (timerState.paused) {
    timerState.deadline = Date.now() + timerState.pausedMs;
    timerState.paused = false;
  } else {
    const settings = readSettings();
    if (settings.workMs <= 0) return;
    prepareAudio();
    unlockTransitionSound();
    timerState = {
      running: true,
      paused: false,
      finished: false,
      phase: "prepare",
      round: 1,
      workMs: settings.workMs,
      restMs: settings.restMs,
      rounds: settings.rounds,
      phaseDuration: 5000,
      deadline: Date.now() + 5000,
      pausedMs: 0
    };
  }
  timerState.running = true;
  setSettingsEnabled(false);
  document.getElementById("start-button").innerHTML = '<span class="pause-icon">Ⅱ</span><span>暫停</span>';
  document.getElementById("timer-message").textContent =
    timerState.phase === "prepare" ? "準備倒數，馬上開始！" :
      timerState.phase === "work" ? "專注運動，穩住節奏！" : "喝口水，準備下一組。";
  syncTimerLabels();
  const remaining = Math.max(0, timerState.deadline - Date.now());
  const second = Math.ceil(remaining / 1000);
  lastPaintedSecond = second;
  lastPaintedPhase = timerState.phase;
  paintTimer(remaining);
  playTimerCue(second, timerState.phase);
}

function advanceTimer(now) {
  while (timerState.running && now >= timerState.deadline) {
    if (timerState.phase === "prepare") {
      startPhase("work", timerState.workMs);
    } else if (timerState.phase === "work" && timerState.restMs > 0) {
      startPhase("rest", timerState.restMs);
    } else if (timerState.round < timerState.rounds) {
      timerState.round += 1;
      startPhase("work", timerState.workMs);
    } else {
      finishTimer();
      break;
    }
  }
}

function startPhase(phase, duration) {
  timerState.phase = phase;
  timerState.phaseDuration = duration;
  timerState.deadline += duration;
  timerState.pausedMs = 0;
  syncTimerLabels();
  playPhaseChangeCue(phase);
  if (phase === "work" || phase === "rest") speakPhaseAnnouncement(phase);
  document.getElementById("timer-message").textContent =
    phase === "prepare" ? "準備倒數，馬上開始！" :
      phase === "work" ? "專注運動，穩住節奏！" : "休息一下，準備下一組。";
}

function syncTimerLabels() {
  const phaseNames = { prepare: "準備倒數", work: "運動中", rest: "休息中" };
  const captions = { prepare: "準備開始", work: "保持節奏", rest: "深呼吸" };
  document.getElementById("phase-label").textContent = phaseNames[timerState.phase];
  document.getElementById("time-caption").textContent = captions[timerState.phase];
  document.getElementById("round-label").innerHTML = `第 <b>${timerState.round}</b> / ${timerState.rounds} 組`;
  document.getElementById("display-panel").classList.toggle("is-rest", timerState.phase === "rest");
}

function paintTimer(remainingMs) {
  const remainingSeconds = Math.ceil(Math.max(0, remainingMs) / 1000);
  document.getElementById("time-readout").textContent = formatTime(remainingSeconds);
  const progress = timerState.phaseDuration > 0 ? Math.max(0, remainingMs / timerState.phaseDuration) : 0;
  setRingProgress(progress);
  setAlertState(timerState.running && remainingSeconds <= 10);
}

function setRingProgress(progress) {
  const ring = document.getElementById("ring-progress");
  if (!ring) return;
  ring.style.strokeDasharray = `${RING_CIRCUMFERENCE}`;
  ring.style.strokeDashoffset = `${RING_CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, progress)))}`;
}

function setAlertState(active) {
  document.getElementById("timer-display")?.classList.toggle("is-urgent", active);
  document.getElementById("phase-badge")?.classList.toggle("is-urgent", active);
}

function finishTimer() {
  timerState.running = false;
  timerState.paused = false;
  timerState.finished = true;
  timerState.pausedMs = 0;
  setSettingsEnabled(true);
  document.getElementById("time-readout").textContent = "00:00";
  document.getElementById("time-caption").textContent = "訓練完成";
  document.getElementById("phase-label").textContent = "完成";
  document.getElementById("round-label").innerHTML = `完成 <b>${timerState.rounds}</b> 組`;
  document.getElementById("timer-message").textContent = "時間到！做得太棒了。";
  document.getElementById("start-button").innerHTML = '<span class="play-icon">▶</span><span>再來一次</span>';
  setRingProgress(0);
  setAlertState(false);
  playAlarm();
}

function resetTimer() {
  timerState.running = false;
  timerState.paused = false;
  timerState.finished = false;
  timerState.pausedMs = 0;
  timerState.phase = "work";
  timerState.round = 1;
  setSettingsEnabled(true);
  document.getElementById("display-panel").classList.remove("is-rest");
  document.getElementById("start-button").innerHTML = '<span class="play-icon">▶</span><span>開始</span>';
  refreshPreview();
  lastPaintedSecond = -1;
  lastPaintedPhase = null;
}

function timerIsActive() {
  return timerState.running || timerState.paused;
}

function setSettingsEnabled(enabled) {
  document.querySelectorAll(
    ".quick-button, #work-minutes, #work-seconds, #rest-minutes, #rest-seconds, #round-count, #round-minus, #round-plus"
  ).forEach((control) => {
    control.disabled = !enabled;
  });
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function prepareAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    console.warn("此瀏覽器不支援 Web Audio API，無法播放鬧鈴。");
    return;
  }
  audioContext = audioContext || new AudioContextClass();
  if (audioContext.state === "suspended") {
    audioContext.resume().catch((error) => console.error("無法啟用音訊：", error));
  }
}

function playTimerCue(second, phase) {
  if (second <= 0) return;
  const countdownStart = phase === "rest" ? 3 : 5;
  if (second <= countdownStart) {
    playCountdownTone(second, phase);
    speakCountdownNumber(second);
  } else {
    playStopwatchTick(second, phase);
  }
}

function playStopwatchTick(second, phase) {
  const tick = second % 2 === 0;
  const frequency = phase === "work"
    ? (tick ? 1480 : 1180)
    : (tick ? 1120 : 900);
  playTone(frequency, 0.14, 0.065, "square");
}

function playCountdownTone(second, phase) {
  const baseFrequency = phase === "rest" ? 740 : 880;
  const frequency = baseFrequency + (second - 1) * 55;
  const loudness = phase === "rest" ? 0.16 : 0.2;
  playTone(frequency, loudness, 0.13, "sine");
}

function playPhaseChangeCue(phase) {
  if (phase === "work" || phase === "rest") playTransitionSound(phase);
}

function unlockTransitionSound() {
  if (!transitionSound || transitionSoundUnlocked) return;
  transitionSound.muted = true;
  transitionSound.play().then(() => {
    transitionSound.pause();
    transitionSound.currentTime = 0;
    transitionSound.muted = false;
    transitionSoundUnlocked = true;
  }).catch((error) => {
    transitionSound.muted = false;
    console.error("無法啟用開始／結束音效：", error);
  });
}

function playTransitionSound(phase) {
  if (!transitionSound) return;
  transitionSound.pause();
  transitionSound.currentTime = 0;
  transitionSound.muted = false;
  transitionSound.play().catch((error) => {
    console.error("無法播放開始／結束音效：", error);
    playGong(phase);
  });
}

function playGong(phase) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  audioContext = audioContext || new AudioContextClass();
  const begin = () => {
    const now = audioContext.currentTime;
    const fundamental = phase === "work" ? 190 : 155;
    const partials = [
      { ratio: 1, level: 0.38, decay: 1.15 },
      { ratio: 2.42, level: 0.21, decay: 0.9 },
      { ratio: 3.87, level: 0.13, decay: 0.72 },
      { ratio: 5.31, level: 0.08, decay: 0.55 }
    ];

    partials.forEach(({ ratio, level, decay }) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const frequency = fundamental * ratio;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency * 1.07, now);
      oscillator.frequency.exponentialRampToValueAtTime(frequency, now + 0.08);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(level, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + decay + 0.02);
    });
  };
  if (audioContext.state === "suspended") {
    audioContext.resume().then(begin).catch((error) => console.error("無法播放敲鑼音效：", error));
  } else {
    begin();
  }
}

function playTone(frequency, volume, duration, type, delay = 0) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  audioContext = audioContext || new AudioContextClass();
  const begin = () => {
    const startAt = audioContext.currentTime + delay;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.01);
  };
  if (audioContext.state === "suspended") {
    audioContext.resume().then(begin).catch((error) => console.error("無法播放計時音效：", error));
  } else {
    begin();
  }
}

function speakCountdownNumber(number) {
  if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(String(number));
  utterance.lang = "zh-TW";
  utterance.rate = 0.85;
  utterance.pitch = 1.15;
  utterance.volume = 1;
  window.speechSynthesis.speak(utterance);
}

function speakPhaseAnnouncement(phase) {
  if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(phase === "rest" ? "休息" : "開始");
  utterance.lang = "zh-TW";
  utterance.rate = 0.85;
  utterance.pitch = 1.15;
  utterance.volume = 1;
  window.speechSynthesis.speak(utterance);
}

function playAlarm() {
  playTransitionSound("work");
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch((error) => console.error("無法離開全螢幕：", error));
  } else {
    document.documentElement.requestFullscreen().catch((error) => console.error("無法進入全螢幕：", error));
  }
}

type DigitSegmentsMap = {
  [key: string]: string[];
}

const allSegments = ['a', 'b', 'c', 'd', 'e', 'f', 'g'] as const;

const digitSegmentsMap: DigitSegmentsMap = {
  '0': ['a', 'b', 'c', 'd', 'e', 'f'],
  '1': ['b', 'c'],
  '2': ['a', 'b', 'g', 'e', 'd'],
  '3': ['a', 'b', 'g', 'c', 'd'],
  '4': ['f', 'g', 'b', 'c'],
  '5': ['a', 'f', 'g', 'c', 'd'],
  '6': ['a', 'f', 'e', 'd', 'c', 'g'],
  '7': ['a', 'b', 'c'],
  '8': ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  '9': ['a', 'b', 'c', 'd', 'f', 'g']
};

const RETURN_TO_CLOCK_TIMEOUT = 4000;

const OVEN_PITCH = 1050;

// Target DOM Elements
const displayPane = document.getElementById("display-pane");
const btnAlarm = document.getElementById("btn-alarm");
const btnMinus = document.getElementById("btn-minus") as HTMLButtonElement;
const btnPlus = document.getElementById("btn-plus") as HTMLButtonElement;

const audioCtx: AudioContext = new AudioContext();

// Global App State Variables
let currentMode: "CLOCK" | "TIMER" | "ALARMING" = "CLOCK";
let timerMinutes = 0;
let countdownInterval: number | null = null;
let returnToClockTimeout: number | null = null;

let alarmInterval: number | null = null;

// Centralised System Ticker
window.setInterval(() => {
  if (currentMode === "CLOCK") updateDisplay();
}, 1000);

// Primary Render Engine Launch
updateDisplay();

// Bind Event Listeners
btnAlarm?.addEventListener("click", () => {
  if (currentMode === "ALARMING") {
    stopAlarm();
    currentMode = "CLOCK";
    updateDisplay();
    return;
  }

  if (currentMode === "CLOCK") {
    currentMode = "TIMER";
    updateDisplay();
    scheduleReturnToClock();
  } else if (currentMode === "TIMER") {
    currentMode = "CLOCK";
    updateDisplay();
  }
});

btnPlus?.addEventListener("click", () => {
  if (currentMode !== "TIMER") return;
  stopAlarm();

  timerMinutes++;
  updateDisplay();
  startTimerCounting();
  scheduleReturnToClock();
});

btnMinus?.addEventListener("click", () => {
  if (currentMode !== "TIMER") return;
  stopAlarm();

  if (timerMinutes > 0) {
    timerMinutes--;
    updateDisplay();

    if (timerMinutes === 0) {
      if (countdownInterval) {
        window.clearInterval(countdownInterval);
        countdownInterval = null;
      }
      currentMode = "ALARMING";
      updateDisplay();
      startAlarm();
    } else {
      startTimerCounting();
      scheduleReturnToClock();
    }
  }
});

displayPane?.addEventListener("click", () => {
  const docElm = document.documentElement as any;
  if (docElm.requestFullscreen) {
    docElm.requestFullscreen();
  } else if (docElm.webkitRequestFullscreen) {
    docElm.webkitRequestFullscreen();
  }
});

function setSegmentState(digitId: string, segment: string, isOn: boolean): void {
  const el = document.getElementById(`${digitId}-${segment}`);
  if (el) {
    el.classList.toggle("on", isOn);
  }
}

function drawDigit(digitId: string, value: string): void {
  const activeSegments = digitSegmentsMap[value] || [];

  for (const segment of allSegments) {
    setSegmentState(digitId, segment, activeSegments.includes(segment));
  }
}

function setColon(visible: boolean): void {
  for (const id of ["colon-top", "colon-bottom"]) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.toggle("on", visible);
    }
  }
}

function setIndicator(): void {
  const visible = currentMode !== "CLOCK" || timerMinutes > 0;
  const el = document.getElementById("alarm-indicator");
  if (el) {
    el.classList.toggle("on", visible);
  }
}

function playSingleBeep(startTime: number): void {
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(OVEN_PITCH, startTime);

  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(0.6, startTime + 0.002);
  gainNode.gain.setValueAtTime(0.6, startTime + 0.15);
  gainNode.gain.linearRampToValueAtTime(0, startTime + 0.18);

  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  osc.start(startTime);
  osc.stop(startTime + 0.2);
}

function playDoublePulse(): void {
  const now = audioCtx.currentTime;
  playSingleBeep(now);
  playSingleBeep(now + 0.25);
}

function startAlarm(): void {
  if (alarmInterval) window.clearInterval(alarmInterval);

  playDoublePulse();
  alarmInterval = window.setInterval(playDoublePulse, 1500);
}

function stopAlarm(): void {
  if (alarmInterval) {
    window.clearInterval(alarmInterval);
    alarmInterval = null;
  }
}

function updateDisplay(): void {
  if (currentMode === "CLOCK") {
    if (btnMinus) btnMinus.disabled = true;
    if (btnPlus) btnPlus.disabled = true;

    const now = new Date();
    const hStr = now.getHours().toString().padStart(2, '0');
    const mStr = now.getMinutes().toString().padStart(2, '0');

    drawDigit("d1", hStr[0]);
    drawDigit("d2", hStr[1]);

    setColon(now.getSeconds() % 2 === 0);
    setIndicator();

    drawDigit("d3", mStr[0]);
    drawDigit("d4", mStr[1]);

  } else if (currentMode === "TIMER" || currentMode === "ALARMING") {
    if (btnMinus) btnMinus.disabled = false;
    if (btnPlus) btnPlus.disabled = false;

    const hoursOut = Math.floor(timerMinutes / 60);
    const minsOut = timerMinutes % 60;
    const hStr = hoursOut.toString().padStart(2, '0');
    const mStr = minsOut.toString().padStart(2, '0');

    drawDigit("d1", hStr[0]);
    drawDigit("d2", hStr[1]);

    setColon(true);
    setIndicator();

    drawDigit("d3", mStr[0]);
    drawDigit("d4", mStr[1]);
  }
}

function startTimerCounting(): void {
  if (countdownInterval) window.clearInterval(countdownInterval);

  countdownInterval = window.setInterval(() => {
    if (timerMinutes > 0) {
      timerMinutes--;
      if (currentMode === "TIMER") updateDisplay();

      if (timerMinutes === 0) {
        if (countdownInterval) {
          window.clearInterval(countdownInterval);
          countdownInterval = null;
        }
        currentMode = "ALARMING";
        updateDisplay();
        startAlarm();
      }
    }
  }, 60_000);
}

function scheduleReturnToClock(): void {
  if (returnToClockTimeout) window.clearTimeout(returnToClockTimeout);

  returnToClockTimeout = window.setTimeout(() => {
    if (currentMode === "TIMER") {
      currentMode = "CLOCK";
      updateDisplay();
    }
  }, RETURN_TO_CLOCK_TIMEOUT);
}
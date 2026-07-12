type DigitSegment = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g';

const DigitSegmentsRegistry: Record<string, DigitSegment[]> = {
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

const allSegments = ['a', 'b', 'c', 'd', 'e', 'f', 'g'] as const;

const LONG_PRESS_REPEAT_SPEED = 200;
const LONG_PRESS_INITIAL_DELAY = 500;

const RETURN_TO_CLOCK_TIMEOUT = 4000;

const TIMER_BEEP_PITCH = 475;

// Target DOM Elements
const displayPane = document.getElementById("display-pane");
const btnAlarm = document.getElementById("btn-alarm");
const btnMinus = document.getElementById("btn-minus") as HTMLButtonElement;
const btnPlus = document.getElementById("btn-plus") as HTMLButtonElement;

const audioCtx: AudioContext = new AudioContext();

// Global App State Variables
let currentMode: "CLOCK" | "TIMER" | "ALARMING" = "CLOCK";
let timerMinutes = 0;

let longPressInitialTimeout: number | null = null;
let longPressRepeatInterval: number | null = null;
let hasLongPressed = false;

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

btnPlus.addEventListener('pointerdown', (e) => {
  // Prevents accidental text selection or zooming on mobile touch
  e.preventDefault();

  stopAlarm();

  hasLongPressed = false;

  // Initial immediate increment
  increaseTimer();

  // Wait before starting the rapid repeat
  initialTimeout = window.setTimeout(() => {
    hasLongPressed = true;

    repeatInterval = window.setInterval(() => {
      increaseTimer();

    }, REPEAT_SPEED);

  }, INITIAL_DELAY);
});

btnPlus.addEventListener('pointerup', stopCounting);
btnPlus.addEventListener('pointerleave', stopCounting);
btnPlus.addEventListener('pointercancel', stopCounting); // Crucial for mobile touch

btnPlus.addEventListener("click", (e) => {
  if (hasLongPressed) {
    e.preventDefault();
  }
});

btnMinus.addEventListener("pointerdown", (e) => {
  e.preventDefault();

  stopAlarm();

  hasLongPressed = false;

  decreaseTimer();

  initialTimeout = window.setTimeout(() => {
    hasLongPressed = true;

    repeatInterval = window.setInterval(() => {
      decreaseTimer();

    }, REPEAT_SPEED);

  }, INITIAL_DELAY);
});

btnMinus.addEventListener('pointerup', stopCounting);
btnMinus.addEventListener('pointerleave', stopCounting);
btnMinus.addEventListener('pointercancel', stopCounting);

btnMinus.addEventListener("click", (e) => {
  if (hasLongPressed) {
    e.preventDefault();
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
  const activeSegments = DigitSegmentsRegistry[value] || [];

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
  let hours2Digits: string,
      minutes2Digits: string;

  let showColon = true;

  if (currentMode === "CLOCK") {
    const now = new Date();
    hours2Digits = now.getHours().toString().padStart(2, '0');
    minutes2Digits = now.getMinutes().toString().padStart(2, '0');

    showColon = now.getSeconds() % 2 === 0;

  } else {
    const hoursOut = Math.floor(timerMinutes / 60);
    const minsOut = timerMinutes % 60;
    hours2Digits = hoursOut.toString().padStart(2, '0');
    minutes2Digits = minsOut.toString().padStart(2, '0');
  }

  drawDigit("d1", hours2Digits[0]);
  drawDigit("d2", hours2Digits[1]);

  setColon(showColon);
  setIndicator();

  drawDigit("d3", minutes2Digits[0]);
  drawDigit("d4", minutes2Digits[1]);

  btnMinus.disabled = currentMode === "CLOCK" || timerMinutes === 0;
  btnPlus.disabled = currentMode === "CLOCK";
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

function increaseTimer() {
  timerMinutes++;
  updateDisplay();
  startTimerCounting();
  scheduleReturnToClock();
}

function decreaseTimer() {
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
}

function stopCounting() {
  if (initialTimeout) window.clearTimeout(initialTimeout);
  if (repeatInterval) window.clearInterval(repeatInterval);
}
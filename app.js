// Tempo reader: state, rendering, playback, controls, and optional agent support.

// ── DOM references and reader state ──────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const ui = {
  text: $("text"),
  count: $("count"),
  word: $("word"),
  position: $("position"),
  remaining: $("remaining"),
  progress: document.querySelector('[role="progressbar"]'),
  fill: $("fill"),
  play: $("play"),
  playLabel: $("play-label"),
  playIcon: $("play-icon"),
  restart: $("restart"),
  stop: $("stop"),
  back: $("back"),
  status: $("status"),
  loop: $("loop"),
  voice: $("voice"),
  voiceNote: $("voice-note"),
  speed: $("speed"),
  wpm: $("wpm"),
  focusToggle: $("focus-toggle"),
  focusPlay: $("focus-play"),
  focusTargets: [
    document.querySelector("header"),
    document.querySelector(".editor"),
    document.querySelector(".progress-area"),
    document.querySelector(".transport"),
    document.querySelector(".options"),
    document.querySelector(".speed"),
    document.querySelector("footer"),
  ],
};

const MAX_WORDS = 2500;

let words = [];
let currentIndex = -1;
let isPlaying = false;
let isComplete = false;
let timer = null;
let wordsPerMinute = 300;
let playbackEpoch = 0;

const speechAvailable = false;

// ── Time and display helpers ─────────────────────────────────────────────────
function duration(wordCount) {
  const seconds = Math.ceil((wordCount * 60) / wordsPerMinute);
  return seconds >= 60
    ? `${Math.floor(seconds / 60)} min ${seconds % 60} sec`
    : `${seconds} sec`;
}

function progressPercent() {
  if (!words.length) return 0;
  if (isComplete) return 100;
  return Math.min(100, Math.max(0, ((currentIndex + 1) / words.length) * 100));
}

function render() {
  const progress = progressPercent();
  const shownPosition = Math.max(0, currentIndex + 1);
  const remainingWords = isComplete
    ? 0
    : Math.max(0, words.length - shownPosition);

  ui.count.textContent = `${words.length.toLocaleString()} words`;
  ui.position.textContent = `${shownPosition} / ${words.length} words`;
  ui.remaining.textContent = `${duration(remainingWords)} remaining`;
  ui.fill.style.width = `${progress}%`;
  ui.progress.setAttribute("aria-valuenow", String(Math.round(progress)));
  ui.word.textContent = currentIndex >= 0 ? words[currentIndex] : "Ready.";
  ui.word.classList.toggle("idle", currentIndex < 0);

  ui.play.disabled = !words.length;
  ui.restart.disabled = !words.length;
  ui.stop.disabled = !words.length;
  ui.back.disabled = !words.length || currentIndex < 1;

  ui.playLabel.textContent = isPlaying
    ? "Pause"
    : isComplete
      ? "Read again"
      : currentIndex >= 0
        ? "Resume"
        : "Start reading";
  ui.playIcon.innerHTML = isPlaying
    ? '<path d="M8 5v14M16 5v14" stroke-width="4"/>'
    : '<path d="m8 5 11 7-11 7Z" fill="currentColor" stroke="none"/>';
  ui.focusPlay.disabled = !words.length;
  ui.focusPlay.setAttribute("aria-label", ui.playLabel.textContent);
  ui.focusPlay.title = ui.playLabel.textContent;
  ui.focusPlay.innerHTML = isPlaying
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14" stroke-width="3"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7Z" fill="currentColor" stroke="none"/></svg>';
  ui.status.textContent = isPlaying
    ? "In the flow"
    : isComplete
      ? "Reading complete"
      : currentIndex >= 0
        ? "Paused"
        : "Ready when you are";
}

function tokenize(text) {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/u) : [];
}

function limitTextToWordCap(text) {
  const allWords = tokenize(text);
  if (allWords.length <= MAX_WORDS) return text;
  return allWords.slice(0, MAX_WORDS).join(" ");
}

function clampSpeed(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return null;
  return Math.max(50, Math.min(1200, Math.round(numericValue)));
}

// ── Playback lifecycle ───────────────────────────────────────────────────────
function cancelPlayback() {
  clearTimeout(timer);
  timer = null;
  playbackEpoch += 1;
  if (speechAvailable) window.speechSynthesis.cancel();
}

function pause() {
  cancelPlayback();
  isPlaying = false;
  render();
}

function finish() {
  timer = null;
  if (ui.loop.checked && words.length) {
    currentIndex = 0;
    isComplete = false;
    isPlaying = true;
    render();
    schedulePlayback();
    return;
  }

  isPlaying = false;
  isComplete = true;
  render();
}

function tick() {
  timer = setTimeout(() => {
    timer = null;
    if (!isPlaying) return;
    if (currentIndex >= words.length - 1) {
      finish();
      return;
    }
    currentIndex += 1;
    render();
    tick();
  }, 60000 / wordsPerMinute);
}

// Speak one word per utterance. This keeps the reader moving even when a
// browser does not emit optional speech word-boundary events.
function speakWord() {
  if (!isPlaying || currentIndex < 0 || currentIndex >= words.length) return;

  const epoch = ++playbackEpoch;
  const utterance = new SpeechSynthesisUtterance(words[currentIndex]);
  utterance.rate = Math.max(0.3, Math.min(4, wordsPerMinute / 180));
  utterance.onend = () => {
    if (epoch !== playbackEpoch || !isPlaying) return;
    if (currentIndex >= words.length - 1) {
      finish();
      return;
    }
    currentIndex += 1;
    render();
    speakWord();
  };
  utterance.onerror = (event) => {
    if (epoch !== playbackEpoch || !isPlaying) return;
    pause();
    ui.voiceNote.textContent =
      event?.error === "canceled"
        ? "under rework"
        : "under rework";
  };

  window.speechSynthesis.speak(utterance);
}

function schedulePlayback() {
  if (ui.voice.checked && speechAvailable) speakWord();
  else tick();
}

// ── User controls ────────────────────────────────────────────────────────────
function togglePlayback() {
  if (!words.length) return;
  if (isPlaying) {
    pause();
    return;
  }

  if (isComplete || currentIndex < 0) {
    currentIndex = 0;
    isComplete = false;
  }
  isPlaying = true;
  render();
  schedulePlayback();
}

function setText(text, { syncTextarea = true } = {}) {
  pause();
  const limitedText = limitTextToWordCap(text);
  if (syncTextarea && ui.text.value !== limitedText) ui.text.value = limitedText;
  words = tokenize(limitedText);
  currentIndex = -1;
  isComplete = false;
  render();
}

function setSpeed(value) {
  const nextSpeed = clampSpeed(value);
  if (nextSpeed === null) {
    ui.wpm.value = String(wordsPerMinute);
    return;
  }

  const changed = nextSpeed !== wordsPerMinute;
  wordsPerMinute = nextSpeed;
  ui.wpm.value = String(wordsPerMinute);
  ui.speed.value = String(wordsPerMinute);

  if (changed && isPlaying) {
    cancelPlayback();
    schedulePlayback();
  }
  render();
}

function rewind() {
  if (!words.length || currentIndex < 1) return;
  const resume = isPlaying;
  pause();
  currentIndex = Math.max(0, currentIndex - 10);
  isComplete = false;
  render();
  if (resume) {
    isPlaying = true;
    render();
    schedulePlayback();
  }
}

function stop() {
  pause();
  currentIndex = -1;
  isComplete = false;
  render();
}

function restart() {
  if (!words.length) return;
  stop();
  togglePlayback();
}

function setFocusMode(enabled) {
  document.body.classList.toggle("focus-mode", enabled);
  ui.focusToggle.setAttribute("aria-pressed", String(enabled));
  ui.focusToggle.setAttribute(
    "aria-label",
    enabled ? "Exit focus view" : "Enter focus view",
  );
  ui.focusToggle.textContent = enabled ? "Exit focus" : "Focus";
  ui.status.setAttribute("aria-hidden", String(enabled));
  ui.focusTargets.forEach((element) => {
    element.inert = enabled;
  });
}

// ── Event bindings ───────────────────────────────────────────────────────────
ui.text.addEventListener("input", (event) =>
  setText(event.target.value, { syncTextarea: false }),
);
$("edit").addEventListener("click", () => {
  pause();
  ui.text.focus();
});
$("clear").addEventListener("click", () => {
  setText("");
  ui.text.focus();
});
ui.focusToggle.addEventListener("click", () => {
  setFocusMode(!document.body.classList.contains("focus-mode"));
});
ui.focusPlay.addEventListener("click", togglePlayback);
ui.play.addEventListener("click", togglePlayback);
ui.restart.addEventListener("click", restart);
ui.stop.addEventListener("click", stop);
ui.back.addEventListener("click", rewind);
ui.speed.addEventListener("input", (event) => setSpeed(event.target.value));
ui.wpm.addEventListener("change", (event) => setSpeed(event.target.value));
ui.wpm.addEventListener("blur", (event) => setSpeed(event.target.value));
ui.voice.addEventListener("change", () => {
  if (isPlaying) {
    cancelPlayback();
    schedulePlayback();
  }
});

if (!speechAvailable) {
  ui.voice.checked = false;
  ui.voice.disabled = true;
  ui.voice.setAttribute("aria-label", "under rework");
  ui.voiceNote.textContent = "under rework";
}

document.addEventListener("keydown", (event) => {
  if (
    event.code === "Escape" &&
    document.body.classList.contains("focus-mode")
  ) {
    setFocusMode(false);
    ui.focusToggle.focus();
    return;
  }

  if (
    /INPUT|TEXTAREA|BUTTON/.test(event.target.tagName) ||
    event.target.isContentEditable
  ) {
    return;
  }
  if (event.code === "Space") {
    event.preventDefault();
    togglePlayback();
  }
  if (event.code === "ArrowLeft" && words.length) {
    event.preventDefault();
    rewind();
  }
  if (event.code === "Escape") stop();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && isPlaying) pause();
});

render();

// Optional model-context control for supported hosts.
if (document.modelContext?.registerTool) {
  try {
    Promise.resolve(
      document.modelContext.registerTool({
        name: "configure_reader",
        description:
          "Set the reader text and words per minute. Pauses and resets reading.",
        inputSchema: {
          type: "object",
          properties: {
            text: { type: "string" },
            wpm: { type: "integer", minimum: 50, maximum: 1200 },
          },
          required: ["text", "wpm"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false },
        execute(input) {
          if (
            typeof input.text !== "string" ||
            !Number.isInteger(input.wpm) ||
            input.wpm < 50 ||
            input.wpm > 1200
          ) {
            throw new Error("Provide text and a WPM between 50 and 1200.");
          }
          setText(input.text);
          setSpeed(input.wpm);
          return { words: words.length, wpm: wordsPerMinute, status: "ready" };
        },
      }),
    ).catch(() => {});
  } catch {}
}

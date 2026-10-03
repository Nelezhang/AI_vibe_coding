const STORAGE_KEY = "moment-countdown-settings";
const defaults = {
  name: "The good stuff is getting closer.",
  date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
  theme: "dusk",
  background: "",
};

const title = document.querySelector("#event-title");
const dateLabel = document.querySelector("#event-date-label");
const dateInput = document.querySelector("#event-date");
const nameInput = document.querySelector("#event-name");
const backdrop = document.querySelector("#modal-backdrop");
const finishedMessage = document.querySelector("#finished-message");
let settings = loadSettings();
let timerInterval;

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved ? { ...defaults, ...saved } : { ...defaults };
  } catch {
    return { ...defaults };
  }
}

function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // The countdown still works if browser storage is unavailable.
  }
}

function renderSettings() {
  const isDefault = settings.name === defaults.name;
  title.innerHTML = isDefault ? 'The good stuff<br /><span>is getting closer.</span>' : `${escapeHTML(settings.name)}<span>.</span>`;
  document.title = isDefault ? "Moment — Count down to what matters" : `${settings.name} — Moment`;
  const target = new Date(settings.date);
  dateLabel.textContent = Number.isNaN(target.getTime()) ? "Every second is a little step toward something wonderful." : target.toLocaleString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  document.body.dataset.theme = settings.theme || "dusk";
  document.body.classList.toggle("custom-background", Boolean(settings.background));
  if (settings.background) document.body.style.setProperty("--custom-background", `url("${settings.background}")`);
  document.querySelectorAll(".theme-swatch[data-theme]").forEach((swatch) => {
    swatch.setAttribute("aria-pressed", String(swatch.dataset.theme === settings.theme && !settings.background));
  });
  tick();
}

function escapeHTML(value) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function tick() {
  const remaining = new Date(settings.date).getTime() - Date.now();
  if (!Number.isFinite(remaining) || remaining <= 0) {
    ["days", "hours", "minutes", "seconds"].forEach((id) => { document.querySelector(`#${id}`).textContent = id === "days" ? "000" : "00"; });
    finishedMessage.hidden = false;
    return;
  }
  finishedMessage.hidden = true;
  const totalSeconds = Math.floor(remaining / 1000);
  const values = {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
  Object.entries(values).forEach(([id, value]) => {
    document.querySelector(`#${id}`).textContent = String(value).padStart(id === "days" ? 3 : 2, "0");
  });
}

function openSettings() {
  nameInput.value = settings.name === defaults.name ? "" : settings.name;
  const date = new Date(settings.date);
  dateInput.value = Number.isNaN(date.getTime()) ? "" : new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  backdrop.hidden = false;
  nameInput.focus();
}

document.querySelector("#open-settings").addEventListener("click", openSettings);
document.querySelector("#close-settings").addEventListener("click", () => { backdrop.hidden = true; });
backdrop.addEventListener("click", (event) => { if (event.target === backdrop) backdrop.hidden = true; });
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !backdrop.hidden) backdrop.hidden = true;
});

document.querySelectorAll(".preset-chip").forEach((chip) => {
  chip.addEventListener("click", () => { nameInput.value = chip.dataset.name; nameInput.focus(); });
});

document.querySelectorAll(".theme-swatch[data-theme]").forEach((swatch) => {
  swatch.addEventListener("click", () => {
    settings.theme = swatch.dataset.theme;
    settings.background = "";
    renderSettings();
    saveSettings();
    document.querySelector("#upload-note").textContent = "Or add a photo of your own";
  });
});

document.querySelector("#background-upload").addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    settings.background = reader.result;
    renderSettings();
    saveSettings();
    document.querySelector("#upload-note").textContent = `${file.name} selected`;
  });
  reader.readAsDataURL(file);
});

document.querySelector("#event-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const eventDate = new Date(dateInput.value);
  if (!nameInput.value.trim() || Number.isNaN(eventDate.getTime())) return;
  settings.name = nameInput.value.trim();
  settings.date = eventDate.toISOString();
  saveSettings();
  renderSettings();
  backdrop.hidden = true;
});

renderSettings();
timerInterval = window.setInterval(tick, 1000);
window.addEventListener("beforeunload", () => window.clearInterval(timerInterval));
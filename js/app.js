import { play, unlock, isMuted, setMuted } from "./sound.js";
import { t, getLang, setLang } from "./i18n.js";
import { esc } from "./ui.js";

const GAMES = [
  { id: "chess",     icon: "♟️" },
  { id: "halli",     icon: "🔔" },
  { id: "uno",       icon: "🃏" },
  { id: "blackjack", icon: "♠️" },
  { id: "thirtyone", icon: "3️⃣" },
];

const app = document.getElementById("app");
const titleEl = document.getElementById("title");
const backBtn = document.getElementById("back");
const soundBtn = document.getElementById("sound");
const langBtn = document.getElementById("lang");

let stopGame = null;     // 실행 중인 게임을 정리하는 함수
let netModule = null;    // 온라인 모드를 고를 때만 Firebase를 불러옴
let screen = null;       // 언어를 바꿀 때 다시 그릴 화면
let titleOf = () => t("app.title");

async function loadNet() {
  if (!netModule) netModule = await import("./net.js");
  return netModule;
}

function errorText(e) {
  if (e && e.userKey) return t(e.userKey);
  console.error(e);
  return t("err.connect");
}

function stopCurrent() {
  if (typeof stopGame === "function") {
    try { stopGame(); } catch (e) { console.warn(e); }
  }
  stopGame = null;
}

function setTitle(fn, showBack) {
  titleOf = fn;
  titleEl.textContent = fn();
  backBtn.hidden = !showBack;
}

const gameTitle = id => () => `${GAMES.find(g => g.id === id).icon} ${t("game." + id)}`;

function showMenu() {
  stopCurrent();
  screen = showMenu;
  setTitle(() => t("app.title"), false);
  app.innerHTML = `<div class="menu">${GAMES.map(g => `
    <button class="card" data-id="${g.id}">
      <span class="icon">${g.icon}</span>
      <strong>${esc(t("game." + g.id))}</strong>
      <small>${esc(t("game." + g.id + ".d"))}</small>
    </button>`).join("")}</div>`;
  app.querySelectorAll(".card").forEach(btn =>
    btn.addEventListener("click", () => showModes(btn.dataset.id)));
}

function showModes(gameId) {
  screen = () => showModes(gameId);
  setTitle(gameTitle(gameId), true);
  app.innerHTML = `<div class="menu">
    ${["local", "ai", "online"].map(m => `
      <button class="card" data-mode="${m}">
        <strong>${esc(t("mode." + m))}</strong><small>${esc(t("mode." + m + ".d"))}</small>
      </button>`).join("")}
  </div>`;
  app.querySelectorAll(".card").forEach(btn =>
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode;
      if (mode === "online") showOnlineEntry(gameId);
      else enterGame(gameId, mode);
    }));
}

function showOnlineEntry(gameId) {
  const keep = { name: document.getElementById("name")?.value || "", code: document.getElementById("code")?.value || "" };
  screen = () => showOnlineEntry(gameId);
  app.innerHTML = `<div class="form">
    <input id="name" placeholder="${esc(t("online.namePh"))}" maxlength="10" value="${esc(keep.name)}">
    <button id="create">${esc(t("online.create"))}</button>
    <input id="code" placeholder="${esc(t("online.codePh"))}" inputmode="numeric" maxlength="4" value="${esc(keep.code)}">
    <button id="join">${esc(t("online.join"))}</button>
    <p id="msg"></p>
  </div>`;
  const msg = document.getElementById("msg");
  const getName = () => document.getElementById("name").value.trim() || t("online.defaultName");

  document.getElementById("create").onclick = async () => {
    try {
      msg.textContent = t("online.creating");
      const net = await loadNet();
      const code = await net.createRoom(gameId, getName());
      enterGame(gameId, "online", { code, name: getName(), host: true }, net);
    } catch (e) { msg.textContent = errorText(e); }
  };

  document.getElementById("join").onclick = async () => {
    const code = document.getElementById("code").value.trim();
    if (!/^\d{4}$/.test(code)) { msg.textContent = t("online.badCode"); return; }
    try {
      msg.textContent = t("online.joining");
      const net = await loadNet();
      await net.joinRoom(code, getName(), gameId);
      enterGame(gameId, "online", { code, name: getName(), host: false }, net);
    } catch (e) { msg.textContent = errorText(e); }
  };
}

async function enterGame(gameId, mode, room = {}, net = null) {
  stopCurrent();
  screen = null;   // 게임 화면은 게임이 직접 다시 그려요
  app.innerHTML = `<p class="wait center">${esc(t("loading"))}</p>`;
  try {
    const mod = await import(`../games/${gameId}/game.js`);
    stopGame = mod.start({ container: app, mode, room, net }) || null;
  } catch (e) {
    console.error(e);
    screen = () => enterGame(gameId, mode, room, net);
    app.innerHTML = `<div class="game">
      <h2>${esc(t("err.load"))}</h2>
      <p class="wait">${esc(t("err.loadHint", { path: `games/${gameId}/game.js` }))}</p>
    </div>`;
  }
}

// ---------- 머리말 버튼 ----------
function paintHeader() {
  titleEl.textContent = titleOf();
  langBtn.textContent = t("lang.switch");
  langBtn.setAttribute("aria-label", t("lang.aria"));
  soundBtn.textContent = isMuted() ? "🔇" : "🔊";
  soundBtn.setAttribute("aria-label", t("sound.aria"));
  soundBtn.setAttribute("aria-pressed", String(!isMuted()));
  backBtn.setAttribute("aria-label", t("back.aria"));
  document.title = t("app.title").replace(/^\S+\s/, "");
  document.documentElement.lang = getLang();
}

soundBtn.addEventListener("click", () => {
  setMuted(!isMuted());
  paintHeader();
  play("turn");
});

langBtn.addEventListener("click", () => {
  setLang(getLang() === "ko" ? "en" : "ko");   // 게임 화면은 fg-lang 이벤트로 다시 그려져요
  paintHeader();
  if (screen) screen();
});

document.addEventListener("pointerdown", unlock);
backBtn.addEventListener("click", showMenu);
paintHeader();
showMenu();

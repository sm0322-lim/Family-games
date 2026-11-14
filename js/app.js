const GAMES = [
  { id: "chess",     name: "체스",      icon: "♟️", desc: "2인 대결",               ready: false },
  { id: "halli",     name: "할리갈리",  icon: "🍒", desc: "같은 과일 5개를 찾아라", ready: false },
  { id: "uno",       name: "우노",      icon: "🃏", desc: "카드를 가장 먼저 털어라", ready: false },
  { id: "blackjack", name: "블랙잭",    icon: "♠️", desc: "21에 가깝게",            ready: false },
  { id: "thirtyone", name: "31 만들기", icon: "3️⃣", desc: "합계 31을 만들어라",     ready: true  },
];

const app = document.getElementById("app");
const titleEl = document.getElementById("title");
const backBtn = document.getElementById("back");

let stopGame = null;   // 실행 중인 게임을 정리하는 함수
let netModule = null;  // 온라인 모드를 고를 때만 Firebase를 불러옴

async function loadNet() {
  if (!netModule) netModule = await import("./net.js");
  return netModule;
}

function errorText(e) {
  if (e && e.userMessage) return e.userMessage;
  console.error(e);
  return "연결하지 못했어요. js/firebase-config.js 설정과 인터넷 연결을 확인해 주세요";
}

function stopCurrent() {
  if (typeof stopGame === "function") {
    try { stopGame(); } catch (e) { console.warn(e); }
  }
  stopGame = null;
}

function setTitle(text, showBack) {
  titleEl.textContent = text;
  backBtn.hidden = !showBack;
}

function showMenu() {
  stopCurrent();
  setTitle("🎲 가족 게임", false);
  app.innerHTML = `<div class="menu">${GAMES.map(g => `
    <button class="card ${g.ready ? "" : "soon"}" data-id="${g.id}">
      <span class="icon">${g.icon}</span>
      <strong>${g.name}</strong>
      <small>${g.ready ? g.desc : "준비 중"}</small>
    </button>`).join("")}</div>`;
  app.querySelectorAll(".card").forEach(btn =>
    btn.addEventListener("click", () => openGame(btn.dataset.id)));
}

function openGame(gameId) {
  const game = GAMES.find(g => g.id === gameId);
  setTitle(`${game.icon} ${game.name}`, true);
  if (!game.ready) return enterGame(gameId, null);
  showModes(gameId);
}

function showModes(gameId) {
  app.innerHTML = `<div class="menu">
    <button class="card" data-mode="local"><strong>👨‍👩‍👧 한 기기</strong><small>같은 폰을 돌려가며</small></button>
    <button class="card" data-mode="ai"><strong>🤖 컴퓨터 상대</strong><small>컴퓨터 1~3명과 대결</small></button>
    <button class="card" data-mode="online"><strong>📱 온라인</strong><small>각자 폰에서 방 코드로</small></button>
  </div>`;
  app.querySelectorAll(".card").forEach(btn =>
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode;
      if (mode === "online") showOnlineEntry(gameId);
      else enterGame(gameId, mode);
    }));
}

function showOnlineEntry(gameId) {
  app.innerHTML = `<div class="form">
    <input id="name" placeholder="내 이름 (예: 아빠)" maxlength="8">
    <button id="create">방 만들기</button>
    <input id="code" placeholder="방 코드 4자리" inputmode="numeric" maxlength="4">
    <button id="join">방 입장</button>
    <p id="msg"></p>
  </div>`;
  const msg = document.getElementById("msg");
  const getName = () => document.getElementById("name").value.trim() || "가족";

  document.getElementById("create").onclick = async () => {
    try {
      msg.textContent = "방을 만드는 중...";
      const net = await loadNet();
      const code = await net.createRoom(gameId, getName());
      enterGame(gameId, "online", { code, name: getName(), host: true }, net);
    } catch (e) { msg.textContent = errorText(e); }
  };

  document.getElementById("join").onclick = async () => {
    const code = document.getElementById("code").value.trim();
    if (!/^\d{4}$/.test(code)) { msg.textContent = "방 코드는 숫자 4자리예요"; return; }
    try {
      msg.textContent = "입장하는 중...";
      const net = await loadNet();
      await net.joinRoom(code, getName(), gameId);
      enterGame(gameId, "online", { code, name: getName(), host: false }, net);
    } catch (e) { msg.textContent = errorText(e); }
  };
}

async function enterGame(gameId, mode, room = {}, net = null) {
  stopCurrent();
  app.innerHTML = `<p class="wait center">불러오는 중...</p>`;
  try {
    const mod = await import(`../games/${gameId}/game.js`);
    stopGame = mod.start({ container: app, mode, room, net }) || null;
  } catch (e) {
    console.error(e);
    app.innerHTML = `<div class="game">
      <h2>게임을 불러오지 못했어요</h2>
      <p class="wait">games/${gameId}/game.js 파일이 올라가 있는지 확인해 주세요</p>
    </div>`;
  }
}

backBtn.addEventListener("click", showMenu);
showMenu();

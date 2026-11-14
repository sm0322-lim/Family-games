// 차례대로 진행하는 게임(31, 블랙잭, 우노 등)의 공통 진행 장치
// 한 기기 / 컴퓨터 상대 / 온라인 세 가지 모드를 모두 처리해요.
//
// 게임은 아래 항목을 가진 spec 객체를 넘겨주면 돼요.
//   newGame(players) → g        게임 상태를 만들고 첫 라운드를 시작
//   act(g, playerId, action)    규칙에 맞으면 상태를 바꾸고 true
//   nextRound(g)                다음 라운드 시작 (라운드가 있는 게임만)
//   publicView(g)               모두에게 보여도 되는 정보 (turnId, phase, players[] 필수)
//   privateView(g, playerId)    본인만 볼 정보 (손패 등), 없으면 null
//   aiAction(g, playerId)       컴퓨터가 할 행동
//   render(container, pub, mine, ui)  화면 그리기
//   hidden                      손패를 숨기는 게임이면 true (한 기기 모드에서 폰 넘기기 화면)
import { esc } from "./ui.js";

const AI_NAMES = ["컴퓨터 A", "컴퓨터 B", "컴퓨터 C"];
// Firebase는 undefined를 저장하지 못해서 미리 정리해요
const clean = v => (v == null ? null : JSON.parse(JSON.stringify(v)));

export function runTurnGame(spec, { container, mode, room = {}, net = null }) {
  const id = (container.__tgSession = (container.__tgSession || 0) + 1);
  const ctx = { play: 0, subs: [], timers: new Set() };
  ctx.alive = () => container.__tgSession === id;
  ctx.later = (fn, ms) => {
    const t = setTimeout(() => { ctx.timers.delete(t); if (ctx.alive()) fn(); }, ms);
    ctx.timers.add(t);
  };

  const o = { spec, container, ctx, net, room };
  if (mode === "online") {
    startOnline(o).catch(e => {
      console.error(e);
      if (ctx.alive()) container.innerHTML = `<div class="game"><p class="wait">연결이 끊겼어요. 뒤로 가서 다시 들어와 주세요</p></div>`;
    });
  } else {
    showSetup(o, mode);
  }

  // 메뉴로 나갈 때 app.js가 호출: 예약된 컴퓨터 차례와 온라인 구독을 정리
  return () => {
    if (container.__tgSession === id) container.__tgSession++;
    ctx.timers.forEach(clearTimeout);
    ctx.timers.clear();
    ctx.subs.forEach(unsub => { try { unsub(); } catch (e) { /* 무시 */ } });
    if (mode === "online" && room.code && net) net.leaveRoom(room.code).catch(() => {});
  };
}

const rulesBox = spec => spec.rulesHTML
  ? `<details class="rules"><summary>규칙 보기</summary>${spec.rulesHTML}</details>` : "";

// ---------- 인원 선택 ----------
function showSetup(o, mode) {
  const { spec, container } = o;
  const isAI = mode === "ai";
  const counts = isAI ? (spec.aiCounts || [1, 2, 3]) : (spec.localCounts || [2, 3, 4]);
  const label = n => isAI ? (n === 0 ? "나 혼자" : `나 + 컴퓨터 ${n}명`) : `${n}명`;

  container.innerHTML = `<div class="game">
    <h2>${isAI ? "컴퓨터 몇 명과 할까요?" : "몇 명이 함께 할까요?"}</h2>
    <div class="menu">${counts.map(n => `
      <button class="card" data-n="${n}"><strong>${label(n)}</strong></button>`).join("")}</div>
    ${rulesBox(spec)}
  </div>`;

  container.querySelectorAll("[data-n]").forEach(btn => {
    btn.onclick = () => {
      const n = Number(btn.dataset.n);
      const players = isAI
        ? [{ id: "me", name: "나" }, ...AI_NAMES.slice(0, n).map((name, i) => ({ id: `ai${i}`, name, isAI: true }))]
        : Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `${i + 1}번 플레이어` }));
      playLocal(o, players, isAI ? "me" : null);
    };
  });
}

// ---------- 한 기기 / 컴퓨터 상대 ----------
function playLocal(o, players, meId) {
  const { spec, container, ctx } = o;
  const my = ++ctx.play;
  const live = () => ctx.alive() && my === ctx.play;
  const g = spec.newGame(players);
  let tick = 0;          // 상태가 바뀔 때마다 증가 (예약된 컴퓨터 차례가 낡았는지 확인)
  let shownFor = null;   // 한 기기 모드: 카드를 확인한 사람

  const doAct = (pid, action) => {
    if (spec.act(g, pid, action)) tick++;
    paint();
  };

  const paint = () => {
    if (!live()) return;
    const pub = spec.publicView(g);
    const cur = pub.players.find(p => p.id === pub.turnId) || null;
    const humanTurn = !!cur && !cur.isAI;

    if (spec.hidden && !meId && humanTurn && shownFor !== cur.id) {
      return renderPass(container, pub, cur, () => { shownFor = cur.id; paint(); });
    }

    const viewer = meId || (humanTurn ? cur.id : null);
    spec.render(container, pub, viewer ? spec.privateView(g, viewer) : null, {
      mode: meId ? "ai" : "local",
      meId: viewer,
      canAct: humanTurn,
      act: action => doAct(cur.id, action),
      onNext: pub.phase === "roundEnd" ? () => { shownFor = null; spec.nextRound(g); tick++; paint(); } : null,
      onRestart: pub.phase === "gameOver" ? () => playLocal(o, players, meId) : null,
    });

    if (cur && cur.isAI) {
      const t = tick;
      ctx.later(() => {
        if (!live() || t !== tick) return;
        doAct(cur.id, spec.aiAction(g, cur.id));
      }, spec.aiDelay || 900);
    }
  };
  paint();
}

function renderPass(container, pub, cur, onReveal) {
  const last = (pub.log || []).slice(-1)[0] || "";
  container.innerHTML = `<div class="game"><div class="pass">
    <p class="icon-big">📱</p>
    <h2>${esc(cur.name)} 차례예요</h2>
    <p class="wait">다른 사람이 보지 않게 폰을 넘겨주세요</p>
    ${last ? `<p class="lastlog">방금: ${esc(last)}</p>` : ""}
    <div class="actions"><button id="reveal">내 카드 보기</button></div>
  </div></div>`;
  container.querySelector("#reveal").onclick = onReveal;
}

// ---------- 온라인 (방장 폰이 게임을 계산, 나머지는 결과를 받아 표시) ----------
async function startOnline(o) {
  const { spec, container, ctx, net, room } = o;
  container.innerHTML = `<div class="game"><p class="wait">연결 중...</p></div>`;
  const myId = await net.myId();
  if (!ctx.alive()) return;

  const isHost = !!room.host;
  const min = spec.minPlayers || 2;
  const max = spec.maxPlayers || 4;

  let roomPlayers = {};   // 방에 들어와 있는 사람
  let bots = {};          // 방장이 추가한 컴퓨터
  let pub = null;         // 공개 상태
  let mine = null;        // 내 개인 정보 (손패)
  let busy = false;       // 행동을 보낸 뒤 결과가 올 때까지 중복 입력 막기
  let g = null;           // 방장 전용 게임 상태
  let tick = 0;
  let waiting = false;    // 방장: 컴퓨터 차례 예약 여부

  const send = action => {
    if (busy) return;
    busy = true;
    net.pushAction(room.code, { uid: myId, action: clean(action) });
  };

  const publish = () => {
    const view = spec.publicView(g);
    net.writeState(room.code, clean(view));
    if (spec.hidden) {
      view.players.forEach(p => {
        if (!p.isAI) net.writePrivate(room.code, p.id, clean(spec.privateView(g, p.id)));
      });
    }
  };

  // 방장: 컴퓨터 차례이거나 연결이 끊긴 사람 차례면 대신 진행
  const hostTick = () => {
    if (!g || waiting) return;
    const view = spec.publicView(g);
    const cur = view.players.find(p => p.id === view.turnId);
    if (!cur) return;
    const auto = cur.isAI || !roomPlayers[cur.id];
    if (!auto) return;
    const t = tick;
    waiting = true;
    ctx.later(() => {
      waiting = false;
      if (!g) return;
      if (t === tick && spec.act(g, cur.id, spec.aiAction(g, cur.id))) { tick++; publish(); }
      hostTick();
    }, cur.isAI ? (spec.aiDelay || 900) : 1500);
  };

  const startWith = players => {
    g = spec.newGame(players);
    tick++;
    publish();
    hostTick();
  };

  const hostStart = () => {
    const humans = Object.entries(roomPlayers)
      .sort(([, a], [, b]) => (a.joinedAt || 0) - (b.joinedAt || 0))
      .map(([id, v]) => ({ id, name: v.name || "가족" }));
    const ais = Object.entries(bots).map(([id, v]) => ({ id, name: v.name, isAI: true }));
    startWith([...humans, ...ais]);
  };

  const hostNext = () => { spec.nextRound(g); tick++; publish(); hostTick(); };

  // 다시 하기: 대기실로 돌아가서 인원을 다시 정하고 시작
  const hostRestart = () => { g = null; tick++; net.writeState(room.code, null); };

  const setBots = n => {
    const obj = {};
    for (let i = 0; i < n; i++) obj[`bot${i}`] = { name: AI_NAMES[i] };
    net.writeRoomField(room.code, "bots", n ? obj : null);
  };

  const renderLobby = () => {
    const humans = Object.values(roomPlayers);
    const botList = Object.values(bots);
    const n = humans.length + botList.length;
    const canAddBot = botList.length < AI_NAMES.length && n < max;
    container.innerHTML = `<div class="game">
      <h2>대기실</h2>
      <p>방 코드 <span class="code">${esc(room.code)}</span></p>
      <p class="wait">가족에게 이 코드를 알려 주세요 (${min === max ? `${min}명` : `${min}~${max}명`})</p>
      <ul class="lobby">
        ${humans.map(p => `<li>${esc(p.name)}</li>`).join("")}
        ${botList.map(b => `<li>🤖 ${esc(b.name)}</li>`).join("")}
      </ul>
      ${isHost ? `
        <div class="actions">
          <button id="addBot" class="ghost" ${canAddBot ? "" : "disabled"}>+ 컴퓨터</button>
          <button id="delBot" class="ghost" ${botList.length ? "" : "disabled"}>- 컴퓨터</button>
        </div>
        <div class="actions"><button id="start" ${n < min || n > max ? "disabled" : ""}>게임 시작 (${n}명)</button></div>`
      : `<p class="wait">방장이 시작하기를 기다리는 중...</p>`}
      ${rulesBox(spec)}
    </div>`;
    container.querySelector("#start")?.addEventListener("click", hostStart);
    container.querySelector("#addBot")?.addEventListener("click", () => setBots(botList.length + 1));
    container.querySelector("#delBot")?.addEventListener("click", () => setBots(botList.length - 1));
  };

  const paint = () => {
    if (!ctx.alive()) return;
    if (!pub) return renderLobby();
    spec.render(container, pub, mine, {
      mode: "online",
      meId: myId,
      canAct: pub.turnId === myId && !busy,
      act: send,
      onNext: isHost && pub.phase === "roundEnd" ? hostNext : null,
      onRestart: isHost && pub.phase === "gameOver" ? hostRestart : null,
    });
  };

  if (isHost) {
    ctx.subs.push(net.watchActions(room.code, ({ key, value }) => {
      if (!ctx.alive()) return;
      net.removeAction(room.code, key);
      if (!g || !value || !value.action) return;
      if (spec.act(g, value.uid, value.action)) { tick++; publish(); hostTick(); }
    }));
  }

  ctx.subs.push(net.watchRoom(room.code, data => {
    if (!ctx.alive()) return;
    if (!data) {
      container.innerHTML = `<div class="game"><p class="wait">방이 사라졌어요. 뒤로 가서 새로 만들어 주세요</p></div>`;
      return;
    }
    roomPlayers = data.players || {};
    bots = data.bots || {};
    pub = data.state || null;
    busy = false;
    if (isHost) hostTick();
    paint();
  }));

  if (spec.hidden) {
    ctx.subs.push(net.watchPrivate(room.code, myId, data => {
      mine = data;
      paint();
    }));
  }
}

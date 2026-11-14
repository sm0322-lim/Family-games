import { newGame, startRound, act, publicView, sum, START_LIVES } from "./engine.js";
import { decide } from "./ai.js";

const AI_NAMES = ["컴퓨터 A", "컴퓨터 B", "컴퓨터 C"];
const STATUS_TEXT = { active: "차례 대기", stood: "스톱", bust: "31 초과", out: "탈락" };
const esc = s => String(s ?? "").replace(/[&<>"']/g,
  c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let session = 0;   // 지금 화면에 떠 있는 게임 번호 (메뉴로 나가면 바뀜)

export function start({ container, mode, room, net }) {
  const ctx = { id: ++session, play: 0, subs: [] };
  ctx.alive = () => ctx.id === session;

  if (mode === "online") startOnline(container, room, net, ctx);
  else showSetup(container, mode, ctx);

  // 메뉴로 나갈 때 app.js가 호출: 예약된 컴퓨터 차례, 온라인 구독을 정리
  return () => {
    session++;
    ctx.subs.forEach(unsub => { try { unsub(); } catch (e) { /* 무시 */ } });
    if (mode === "online" && room && room.code) net.leaveRoom(room.code).catch(() => {});
  };
}

// ---------- 인원 선택 (한 기기 / 컴퓨터 상대) ----------
function showSetup(container, mode, ctx) {
  const isAI = mode === "ai";
  const counts = isAI ? [1, 2, 3] : [2, 3, 4];
  container.innerHTML = `<div class="game">
    <h2>${isAI ? "컴퓨터 몇 명과 할까요?" : "몇 명이 함께 할까요?"}</h2>
    <div class="menu">${counts.map(n => `
      <button class="card" data-n="${n}">
        <strong>${isAI ? `나 + 컴퓨터 ${n}명` : `${n}명`}</strong>
      </button>`).join("")}</div>
  </div>`;

  container.querySelectorAll("[data-n]").forEach(btn => {
    btn.onclick = () => {
      const n = Number(btn.dataset.n);
      if (isAI) {
        const players = [
          { id: "me", name: "나" },
          ...AI_NAMES.slice(0, n).map((name, i) => ({ id: `ai${i}`, name, isAI: true })),
        ];
        playLocal(container, players, "me", ctx);
      } else {
        const players = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `${i + 1}번 플레이어` }));
        playLocal(container, players, null, ctx);
      }
    };
  });
}

// ---------- 한 기기 / 컴퓨터 상대 ----------
function playLocal(container, players, meId, ctx) {
  const my = ++ctx.play;
  const live = () => ctx.alive() && my === ctx.play;
  const g = newGame(players);
  startRound(g);
  let shownFor = null;   // 한 기기 모드: 카드를 확인한 사람

  const paint = () => {
    if (!live()) return;
    const cur = g.turnIndex >= 0 ? g.players[g.turnIndex] : null;
    const humanTurn = g.phase === "playing" && cur && !cur.isAI;
    const me = meId ? g.players.find(p => p.id === meId) : null;
    // 한 기기 모드에서는 폰을 넘겨받은 사람이 버튼을 눌러야 카드가 보임
    const needPass = !meId && humanTurn && shownFor !== cur.id;

    renderGame(container, publicView(g), {
      meId,
      hand: me ? me.hand : (humanTurn && !needPass ? cur.hand : null),
      handLabel: me ? "내" : (cur ? `${cur.name}의` : ""),
      canAct: humanTurn && !needPass,
      passTo: needPass ? cur.name : null,
      onReveal: () => { shownFor = cur.id; paint(); },
      onDraw: () => { act(g, cur.id, "draw"); paint(); },
      onStand: () => { act(g, cur.id, "stand"); paint(); },
      onNext: () => { shownFor = null; startRound(g); paint(); },
      onRestart: () => playLocal(container, players, meId, ctx),
    });

    if (g.phase === "playing" && cur && cur.isAI) {
      setTimeout(() => {
        if (!live() || g.phase !== "playing" || g.players[g.turnIndex] !== cur) return;
        act(g, cur.id, decide(cur.hand, cur.lives));
        paint();
      }, 800);
    }
  };
  paint();
}

// ---------- 온라인 (방장 폰이 게임을 계산, 나머지는 결과를 받아 표시) ----------
async function startOnline(container, room, net, ctx) {
  container.innerHTML = `<div class="game"><p class="wait">연결 중...</p></div>`;
  const myId = await net.myId();
  if (!ctx.alive()) return;
  const isHost = !!room.host;

  let roomPlayers = {};   // 방에 들어와 있는 사람들
  let pub = null;         // DB에 저장된 공개 상태
  let myHand = null;      // 내 패 (본인만 읽을 수 있음)
  let g = null;           // 방장 전용 게임 상태

  const send = type => net.pushAction(room.code, { uid: myId, type });

  const publish = () => {
    net.writeState(room.code, publicView(g));
    g.players.forEach(p => net.writePrivate(room.code, p.id, { hand: p.hand }));
  };

  const hostStart = () => {
    const players = Object.entries(roomPlayers)
      .sort(([, a], [, b]) => a.joinedAt - b.joinedAt)
      .map(([id, v]) => ({ id, name: v.name }));
    g = newGame(players);
    startRound(g);
    publish();
  };

  const hostNext = () => { startRound(g); publish(); };

  const hostRestart = () => {
    const players = g.players
      .filter(p => roomPlayers[p.id])
      .map(({ id, name }) => ({ id, name }));
    g = newGame(players);
    startRound(g);
    publish();
  };

  const renderLobby = () => {
    const names = Object.values(roomPlayers);
    const n = names.length;
    container.innerHTML = `<div class="game">
      <h2>대기실</h2>
      <p>방 코드 <span class="code">${esc(room.code)}</span></p>
      <p class="wait">가족에게 이 코드를 알려 주세요 (2~4명)</p>
      <ul class="lobby">${names.map(p => `<li>${esc(p.name)}</li>`).join("")}</ul>
      ${isHost
        ? `<div class="actions"><button id="start" ${n < 2 || n > 4 ? "disabled" : ""}>게임 시작 (${n}명)</button></div>`
        : `<p class="wait">방장이 시작하기를 기다리는 중...</p>`}
    </div>`;
    container.querySelector("#start")?.addEventListener("click", hostStart);
  };

  const paint = () => {
    if (!ctx.alive()) return;
    if (!pub) return renderLobby();
    const myTurn = pub.phase === "playing" && pub.turnId === myId;
    renderGame(container, pub, {
      meId: myId,
      hand: myHand,            // 내 패는 항상 보임
      handLabel: "내",
      canAct: myTurn,
      onDraw: () => send("draw"),
      onStand: () => send("stand"),
      onNext: isHost ? hostNext : null,
      onRestart: isHost ? hostRestart : null,
    });
  };

  // 방장: 참가자 행동을 받아 규칙대로 처리
  if (isHost) {
    ctx.subs.push(net.watchActions(room.code, ({ key, value }) => {
      if (!ctx.alive()) return;
      net.removeAction(room.code, key);
      if (!g || !value || g.phase !== "playing") return;
      act(g, value.uid, value.type);
      publish();
    }));
  }

  ctx.subs.push(net.watchRoom(room.code, data => {
    roomPlayers = data?.players || {};
    pub = data?.state || null;

    // 방장: 연결이 끊긴 사람의 차례는 자동 스톱
    if (isHost && g && g.phase === "playing") {
      const cur = g.players[g.turnIndex];
      if (cur && !cur.isAI && !roomPlayers[cur.id]) {
        act(g, cur.id, "stand");
        publish();
        return;
      }
    }
    paint();
  }));

  ctx.subs.push(net.watchPrivate(room.code, myId, data => {
    myHand = data?.hand || null;
    paint();
  }));
}

// ---------- 공통 화면 ----------
function renderGame(container, pub, o) {
  const turn = pub.players.find(p => p.id === pub.turnId);
  const winner = pub.players.find(p => p.id === pub.winnerId);
  const hearts = n => "❤️".repeat(Math.max(0, n)) + "🖤".repeat(Math.max(0, START_LIVES - n));

  const players = pub.players.map(p => `
    <div class="pcard ${p.id === pub.turnId ? "turn" : ""} ${p.lives <= 0 ? "out" : ""}">
      <strong>${esc(p.name)}${p.id === o.meId ? " (나)" : ""}</strong>
      <span>${hearts(p.lives)}</span>
      <small>${p.lives <= 0 ? "탈락" : (STATUS_TEXT[p.status] || "")}</small>
    </div>`).join("");

  let body = "";

  if (pub.phase === "playing") {
    if (o.passTo) {
      body += `<div class="pass">
        <p>📱 <b>${esc(o.passTo)}</b> 차례예요</p>
        <p class="wait">다른 사람이 보지 않게 폰을 넘겨주세요</p>
        <div class="actions"><button id="reveal">내 카드 보기</button></div>
      </div>`;
    } else {
      if (o.hand && o.hand.length) {
        body += `<div class="hand">${o.hand.map(c => `<span class="face">${c}</span>`).join("")}</div>
                 <p class="sum">${esc(o.handLabel || "내")} 합계 <b>${sum(o.hand)}</b></p>`;
      }
      body += o.canAct
        ? `<div class="actions"><button id="draw">한 장 더</button><button id="stand" class="ghost">스톱</button></div>`
        : `<p class="wait">${esc(turn?.name ?? "")} 차례예요...</p>`;
    }
  }

  if (pub.phase === "roundEnd" || pub.phase === "gameOver") {
    body += renderReveal(pub.result);
  }

  if (pub.phase === "roundEnd") {
    body += o.onNext
      ? `<div class="actions"><button id="next">다음 라운드</button></div>`
      : `<p class="wait">방장이 다음 라운드를 시작할 때까지 기다려요</p>`;
  }

  if (pub.phase === "gameOver") {
    body += `<h2>🏆 ${winner ? esc(winner.name) + " 우승!" : "무승부"}</h2>`;
    if (o.onRestart) body += `<div class="actions"><button id="again">다시 하기</button></div>`;
  }

  container.innerHTML = `<div class="game">
    <div class="round">${pub.round}라운드 / 목표 31 / 목숨 ${START_LIVES}개</div>
    <div class="players">${players}</div>
    ${body}
    <p class="msg">${esc(pub.message)}</p>
  </div>`;

  container.querySelector("#reveal")?.addEventListener("click", o.onReveal);
  container.querySelector("#draw")?.addEventListener("click", o.onDraw);
  container.querySelector("#stand")?.addEventListener("click", o.onStand);
  container.querySelector("#next")?.addEventListener("click", o.onNext);
  container.querySelector("#again")?.addEventListener("click", o.onRestart);
}

function renderReveal(result) {
  if (!result) return "";
  const lost = result.lostIds || [];
  const rows = (result.reveal || []).map(r => {
    const hand = r.hand || [];
    const bust = r.status === "bust" ? " 💥" : "";
    const mark = lost.includes(r.id) ? " ❤️-1" : "";
    return `<li>${esc(r.name)} : ${hand.join(" + ") || "-"} = <b>${r.sum ?? 0}</b>${bust}${mark}</li>`;
  }).join("");
  return `<div class="reveal"><h3>이번 라운드 결과</h3><ul>${rows}</ul></div>`;
}

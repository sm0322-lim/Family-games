// 게임 공통 진행 장치: 한 기기 / 컴퓨터 상대 / 온라인 세 모드를 모두 처리해요.
//
// 게임은 아래 항목을 가진 spec 객체를 넘겨주면 돼요.
//   newGame(players) → g        게임 상태를 만들고 시작
//   act(g, playerId, action)    규칙에 맞으면 상태를 바꾸고 true
//   nextRound(g)                다음 라운드 (라운드가 있는 게임만)
//   publicView(g)               모두에게 보여도 되는 정보 (turnId, phase, players[] 필수)
//   privateView(g, playerId)    본인만 볼 정보 (손패 등), 없으면 null
//   aiAction(g, playerId)       컴퓨터 차례에 할 행동
//   aiReactions(g)              (선택) 차례와 상관없는 컴퓨터 행동 [{ pid, action, delay }]
//   render(container, pub, mine, ui)
//   hidden      손패를 숨기는 게임이면 true (한 기기 모드에서 폰 넘기기 화면)
//   levels      (선택) 컴퓨터 실력 선택지 ["easy", "normal", "hard"]
//   turnSound   false면 내 차례 알림음을 끔
//   rules       { ko: "HTML", en: "HTML" }
import { esc } from "./ui.js";
import { play } from "./sound.js";
import { t, getLang } from "./i18n.js";

const AI_LETTERS = ["A", "B", "C"];
// Firebase는 undefined를 저장하지 못해서 미리 정리해요
const clean = v => (v == null ? null : JSON.parse(JSON.stringify(v)));

// 새로 생긴 효과음 신호만 재생하고, 내 차례가 되면 알림음
function makeFx(spec) {
  let last = 0;
  let turnKey = null;
  return (pub, myTurn) => {
    const fresh = (pub.fx || []).filter(e => e && e.n > last);
    if (fresh.length) {
      last = Math.max(...fresh.map(e => e.n));
      fresh.slice(-2).forEach((e, i) => setTimeout(() => play(e.s), i * 220));
    }
    if (spec.turnSound === false) return;
    const key = myTurn ? String(pub.turnId) : null;
    if (key && key !== turnKey) setTimeout(() => play("turn"), fresh.length ? 480 : 0);
    turnKey = key;
  };
}

export function runTurnGame(spec, { container, mode, room = {}, net = null }) {
  const id = (container.__tgSession = (container.__tgSession || 0) + 1);
  const ctx = { play: 0, subs: [], timers: new Set(), repaint: null };
  ctx.alive = () => container.__tgSession === id;
  ctx.later = (fn, ms) => {
    const tm = setTimeout(() => { ctx.timers.delete(tm); if (ctx.alive()) fn(); }, ms);
    ctx.timers.add(tm);
  };

  const onLang = () => { if (ctx.alive() && ctx.repaint) ctx.repaint(); };
  window.addEventListener("fg-lang", onLang);

  const o = { spec, container, ctx, net, room };
  if (mode === "online") {
    startOnline(o).catch(e => {
      console.error(e);
      if (ctx.alive()) container.innerHTML = `<div class="game"><p class="wait">${esc(t("conn.lost"))}</p></div>`;
    });
  } else {
    showSetup(o, mode);
  }

  // 메뉴로 나갈 때 app.js가 호출: 예약된 컴퓨터 행동과 온라인 구독을 정리
  return () => {
    if (container.__tgSession === id) container.__tgSession++;
    window.removeEventListener("fg-lang", onLang);
    ctx.timers.forEach(clearTimeout);
    ctx.timers.clear();
    ctx.subs.forEach(unsub => { try { unsub(); } catch (e) { /* 무시 */ } });
    if (mode === "online" && room.code && net) net.leaveRoom(room.code).catch(() => {});
  };
}

const rulesBox = spec => {
  const html = spec.rules ? (spec.rules[getLang()] || spec.rules.ko) : "";
  return html ? `<details class="rules"><summary>${esc(t("rules"))}</summary>${html}</details>` : "";
};

// ---------- 인원 선택 ----------
function showSetup(o, mode) {
  const { spec, container, ctx } = o;
  const isAI = mode === "ai";
  const counts = isAI ? (spec.aiCounts || [1, 2, 3]) : (spec.localCounts || [2, 3, 4]);
  const levels = isAI && spec.levels ? spec.levels : null;
  let level = ctx.level || "normal";

  const draw = () => {
    const label = n => isAI ? (n === 0 ? t("setup.solo") : t("setup.meAI", { n })) : t("setup.n", { n });
    container.innerHTML = `<div class="game">
      ${levels ? `<h2>${esc(t("setup.level"))}</h2>
        <div class="seg">${levels.map(l =>
          `<button data-level="${l}" class="${l === level ? "on" : ""}">${esc(t("level." + l))}</button>`).join("")}</div>` : ""}
      <h2>${esc(t(isAI ? "setup.howManyAI" : "setup.howMany"))}</h2>
      <div class="menu">${counts.map(n => `
        <button class="card" data-n="${n}"><strong>${esc(label(n))}</strong></button>`).join("")}</div>
      ${rulesBox(spec)}
    </div>`;

    container.querySelectorAll("[data-level]").forEach(b => {
      b.onclick = () => { level = ctx.level = b.dataset.level; draw(); };
    });
    container.querySelectorAll("[data-n]").forEach(btn => {
      btn.onclick = () => {
        const n = Number(btn.dataset.n);
        const players = isAI
          ? [{ id: "me", name: t("name.me") },
             ...AI_LETTERS.slice(0, n).map((x, i) => ({ id: `ai${i}`, name: t("name.ai", { x }), isAI: true, level }))]
          : Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: t("name.p", { n: i + 1 }) }));
        playLocal(o, players, isAI ? "me" : null);
      };
    });
  };
  ctx.repaint = draw;
  draw();
}

// ---------- 한 기기 / 컴퓨터 상대 ----------
function playLocal(o, players, meId) {
  const { spec, container, ctx } = o;
  const my = ++ctx.play;
  const live = () => ctx.alive() && my === ctx.play;
  const g = spec.newGame(players);
  let tick = 0;          // 상태가 바뀔 때마다 증가 (예약된 컴퓨터 행동이 낡았는지 확인)
  let reactTick = -1;
  let shownFor = null;   // 한 기기 모드: 카드를 확인한 사람
  const fx = makeFx(spec);
  const humans = new Set(players.filter(p => !p.isAI).map(p => p.id));

  const doAct = (pid, action) => {
    if (action && spec.act(g, pid, action)) tick++;
    paint();
  };

  // 차례와 상관없는 컴퓨터 행동 (예: 할리갈리 종 치기)
  const react = () => {
    if (!spec.aiReactions || reactTick === tick) return;
    reactTick = tick;
    const t0 = tick;
    (spec.aiReactions(g) || []).forEach(r => ctx.later(() => {
      if (live() && t0 === tick) doAct(r.pid, r.action);
    }, r.delay));
  };

  const paint = () => {
    if (!live()) return;
    const pub = spec.publicView(g);
    const cur = pub.players.find(p => p.id === pub.turnId) || null;
    const humanTurn = !!cur && !cur.isAI;
    fx(pub, meId ? pub.turnId === meId : humanTurn);

    if (spec.hidden && !meId && humanTurn && shownFor !== cur.id) {
      renderPass(container, pub, cur, () => { shownFor = cur.id; paint(); });
    } else {
      const viewer = meId || (humanTurn ? cur.id : null);
      spec.render(container, pub, viewer ? spec.privateView(g, viewer) : null, {
        mode: meId ? "ai" : "local",
        meId: viewer,
        canAct: humanTurn,
        act: action => doAct(cur.id, action),
        actAs: (pid, action) => { if (humanTurn || humans.has(pid)) doAct(pid, action); },
        onNext: pub.phase === "roundEnd" ? () => { shownFor = null; spec.nextRound(g); tick++; paint(); } : null,
        onRestart: pub.phase === "gameOver" ? () => playLocal(o, players, meId) : null,
      });
    }

    if (cur && cur.isAI) {
      const t0 = tick;
      ctx.later(() => {
        if (live() && t0 === tick) doAct(cur.id, spec.aiAction(g, cur.id));
      }, spec.aiDelay || 900);
    }
    react();
  };
  ctx.repaint = paint;
  paint();
}

function renderPass(container, pub, cur, onReveal) {
  const lastEntry = (pub.log || []).slice(-1)[0];
  const last = lastEntry ? (typeof lastEntry === "string" ? lastEntry : t(lastEntry.k, lastEntry.v || {})) : "";
  container.innerHTML = `<div class="game"><div class="pass">
    <p class="icon-big">📱</p>
    <h2>${esc(t("pass.turn", { name: cur.name }))}</h2>
    <p class="wait">${esc(t("pass.hide"))}</p>
    ${last ? `<p class="lastlog">${esc(t("pass.last", { text: last }))}</p>` : ""}
    <div class="actions"><button id="reveal">${esc(t("pass.show"))}</button></div>
  </div></div>`;
  container.querySelector("#reveal").onclick = onReveal;
}

// ---------- 온라인 (방장 폰이 게임을 계산, 나머지는 결과를 받아 표시) ----------
async function startOnline(o) {
  const { spec, container, ctx, net, room } = o;
  container.innerHTML = `<div class="game"><p class="wait">${esc(t("conn.connecting"))}</p></div>`;
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
  let reactTick = -1;
  let waiting = false;    // 방장: 컴퓨터 차례 예약 여부
  const fx = makeFx(spec);

  const send = action => {
    if (busy || !action) return;
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

  const changed = () => { tick++; publish(); hostTick(); hostReact(); };

  // 방장: 컴퓨터 차례이거나 연결이 끊긴 사람 차례면 대신 진행
  const hostTick = () => {
    if (!g || waiting) return;
    const view = spec.publicView(g);
    const cur = view.players.find(p => p.id === view.turnId);
    if (!cur) return;
    if (!cur.isAI && roomPlayers[cur.id]) return;
    const t0 = tick;
    waiting = true;
    ctx.later(() => {
      waiting = false;
      if (!g) return;
      if (t0 === tick && spec.act(g, cur.id, spec.aiAction(g, cur.id))) changed();
      else hostTick();
    }, cur.isAI ? (spec.aiDelay || 900) : 1500);
  };

  // 방장: 차례와 상관없는 컴퓨터 행동
  const hostReact = () => {
    if (!g || !spec.aiReactions || reactTick === tick) return;
    reactTick = tick;
    const t0 = tick;
    const gNow = g;
    (spec.aiReactions(g) || []).forEach(r => ctx.later(() => {
      if (g === gNow && t0 === tick && spec.act(g, r.pid, r.action)) changed();
    }, r.delay));
  };

  const hostStart = () => {
    const humans = Object.entries(roomPlayers)
      .sort(([, a], [, b]) => (a.joinedAt || 0) - (b.joinedAt || 0))
      .map(([id, v]) => ({ id, name: v.name || t("online.defaultName") }));
    const ais = Object.entries(bots).map(([id, v]) => ({ id, name: v.name, isAI: true, level: "normal" }));
    g = spec.newGame([...humans, ...ais]);
    changed();
  };

  const hostNext = () => { spec.nextRound(g); changed(); };

  // 다시 하기: 대기실로 돌아가서 인원을 다시 정하고 시작
  const hostRestart = () => { g = null; tick++; net.writeState(room.code, null); };

  const setBots = n => {
    const obj = {};
    for (let i = 0; i < n; i++) obj[`bot${i}`] = { name: t("name.ai", { x: AI_LETTERS[i] }) };
    net.writeRoomField(room.code, "bots", n ? obj : null);
  };

  const renderLobby = () => {
    const humans = Object.values(roomPlayers);
    const botList = Object.values(bots);
    const n = humans.length + botList.length;
    const canAddBot = botList.length < AI_LETTERS.length && n < max;
    const range = min === max ? t("lobby.exact", { a: min }) : t("lobby.range", { a: min, b: max });
    container.innerHTML = `<div class="game">
      <h2>${esc(t("lobby.title"))}</h2>
      <p>${esc(t("lobby.code"))} <span class="code">${esc(room.code)}</span></p>
      <p class="wait">${esc(t("lobby.share", { range }))}</p>
      <ul class="lobby">
        ${humans.map(p => `<li>${esc(p.name)}</li>`).join("")}
        ${botList.map(b => `<li>🤖 ${esc(b.name)}</li>`).join("")}
      </ul>
      ${isHost ? `
        <div class="actions">
          <button id="addBot" class="ghost" ${canAddBot ? "" : "disabled"}>${esc(t("lobby.addBot"))}</button>
          <button id="delBot" class="ghost" ${botList.length ? "" : "disabled"}>${esc(t("lobby.delBot"))}</button>
        </div>
        <div class="actions"><button id="start" ${n < min || n > max ? "disabled" : ""}>${esc(t("lobby.start", { n }))}</button></div>`
      : `<p class="wait">${esc(t("lobby.wait"))}</p>`}
      ${rulesBox(spec)}
    </div>`;
    container.querySelector("#start")?.addEventListener("click", hostStart);
    container.querySelector("#addBot")?.addEventListener("click", () => setBots(botList.length + 1));
    container.querySelector("#delBot")?.addEventListener("click", () => setBots(botList.length - 1));
  };

  const paint = () => {
    if (!ctx.alive()) return;
    if (!pub) return renderLobby();
    fx(pub, pub.turnId === myId);
    spec.render(container, pub, mine, {
      mode: "online",
      meId: myId,
      canAct: pub.turnId === myId && !busy,
      act: send,
      actAs: (pid, action) => send(action),
      onNext: isHost && pub.phase === "roundEnd" ? hostNext : null,
      onRestart: isHost && pub.phase === "gameOver" ? hostRestart : null,
    });
  };
  ctx.repaint = paint;

  if (isHost) {
    ctx.subs.push(net.watchActions(room.code, ({ key, value }) => {
      if (!ctx.alive()) return;
      net.removeAction(room.code, key);
      if (!g || !value || !value.action) return;
      if (spec.act(g, value.uid, value.action)) changed();
    }));
  }

  ctx.subs.push(net.watchRoom(room.code, data => {
    if (!ctx.alive()) return;
    if (!data) {
      container.innerHTML = `<div class="game"><p class="wait">${esc(t("room.gone"))}</p></div>`;
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

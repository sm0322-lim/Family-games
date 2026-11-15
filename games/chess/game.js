import { runTurnGame } from "../../js/turn-game.js";
import { esc, footerHTML, bindFooter, logHTML, bindConfirm } from "../../js/ui.js";
import { t, addStrings } from "../../js/i18n.js";
import * as E from "./engine.js";
import { decide } from "./ai.js";

const GLYPH = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
const glyph = p => (GLYPH[String(p).toLowerCase()] || "") + "\uFE0E";   // \uFE0E: 이모지가 아닌 글자 모양으로

const moveText = (v, lang) =>
  `${v.name}: ${glyph(v.piece)} ${v.from}→${v.to}` +
  (v.cap ? " ✕" : "") +
  (v.promo ? ` =${glyph(v.promo)}` : "") +
  (v.castle ? (lang === "ko" ? " (캐슬링)" : " (castling)") : "") +
  (v.check ? (lang === "ko" ? " 체크!" : " check!") : "");

addStrings({
  ko: {
    "chess.white": "백", "chess.black": "흑",
    "chess.turnOf": "{name} 차례 ({color})",
    "chess.yourTurn": "내 차례예요 ({color})",
    "chess.check": "체크!",
    "chess.hint": "움직일 말을 누르고, 갈 칸을 눌러 주세요",
    "chess.resign": "🏳️ 기권", "chess.resignConfirm": "한 번 더 누르면 기권",
    "chess.promo": "어떤 말로 바꿀까요?",
    "chess.replay": "▶ 다시 보기",
    "chess.p.q": "퀸", "chess.p.r": "룩", "chess.p.b": "비숍", "chess.p.n": "나이트",
    "chess.start": "{name}(백)부터 시작해요",
    "chess.move": v => moveText(v, "ko"),
    "chess.end.mate": "체크메이트! {name} 승리",
    "chess.end.resign": "{loser} 기권, {name} 승리",
    "chess.end.stalemate": "스테일메이트! 움직일 수 있는 말이 없어 무승부",
    "chess.end.insufficient": "체크메이트할 말이 부족해 무승부",
    "chess.end.fifty": "50수 동안 잡거나 폰을 움직이지 않아 무승부",
    "chess.end.repetition": "같은 상황이 3번 나와 무승부",
  },
  en: {
    "chess.white": "White", "chess.black": "Black",
    "chess.turnOf": "Turn: {name} ({color})",
    "chess.yourTurn": "Your turn ({color})",
    "chess.check": "Check!",
    "chess.hint": "Tap a piece, then tap where it should go",
    "chess.resign": "🏳️ Resign", "chess.resignConfirm": "Tap again to resign",
    "chess.promo": "Promote to which piece?",
    "chess.replay": "▶ Replay",
    "chess.p.q": "Queen", "chess.p.r": "Rook", "chess.p.b": "Bishop", "chess.p.n": "Knight",
    "chess.start": "White moves first: {name}",
    "chess.move": v => moveText(v, "en"),
    "chess.end.mate": "Checkmate! Winner: {name}",
    "chess.end.resign": "{loser} resigned. Winner: {name}",
    "chess.end.stalemate": "Stalemate! No legal moves, so it's a draw",
    "chess.end.insufficient": "Draw: not enough pieces left to checkmate",
    "chess.end.fifty": "Draw by the 50-move rule",
    "chess.end.repetition": "Draw: the same position happened 3 times",
  },
});

const RULES = {
  ko: `<ul>
    <li>움직일 말을 누르면 갈 수 있는 칸에 점이 표시돼요. 그 칸을 누르면 이동해요.</li>
    <li>♚ 킹: 모든 방향 1칸 / ♛ 퀸: 모든 방향 쭉 / ♜ 룩: 앞뒤좌우 쭉 / ♝ 비숍: 대각선 쭉 / ♞ 나이트: L자로 점프 / ♟ 폰: 앞으로 1칸 (처음엔 2칸), 잡을 때는 대각선.</li>
    <li>상대 킹을 피할 곳 없이 공격하면 <b>체크메이트</b>로 승리!</li>
    <li>캐슬링, 앙파상, 폰 승진(끝까지 가면 다른 말로 바뀜)도 모두 돼요.</li>
    <li>움직일 수 있는 말이 없으면 스테일메이트로 무승부예요.</li>
  </ul>`,
  en: `<ul>
    <li>Tap a piece to see dots on the squares it can move to, then tap a square to move.</li>
    <li>♚ King: one square any way / ♛ Queen: any distance any way / ♜ Rook: straight lines / ♝ Bishop: diagonals / ♞ Knight: jumps in an L / ♟ Pawn: one square forward (two on its first move), captures diagonally.</li>
    <li>Attack the enemy king so it can't escape: <b>checkmate</b> wins!</li>
    <li>Castling, en passant, and pawn promotion are all supported.</li>
    <li>If a player has no legal move and isn't in check, it's a stalemate (draw).</li>
  </ul>`,
};

export function start(opts) {
  return runTurnGame({
    hidden: false,
    minPlayers: 2, maxPlayers: 2,
    localCounts: [2], aiCounts: [1],
    levels: ["easy", "normal", "hard"],
    aiDelay: 1300,
    rules: RULES,
    newGame: E.newGame, nextRound: E.nextRound, act: E.act,
    publicView: E.publicView, privateView: E.privateView,
    aiAction: decide,
    render,
  }, opts);
}

function render(container, pub, mine, ui) {
  const players = pub.players || [];
  const board = String(pub.board || "");
  if (board.length !== 64) return;
  const pos = { b: board.split(""), turn: pub.turn, cs: pub.cs || "", ep: pub.ep ?? -1, half: pub.half || 0, full: 1 };
  const me = players.find(p => p.id === ui.meId);
  const flip = ui.mode === "online" && me && me.color === "b";
  const colorName = c => t(c === "w" ? "chess.white" : "chess.black");

  // 선택 상태는 화면이 다시 그려져도 유지 (차례가 바뀌면 초기화)
  const st = container.__chess || (container.__chess = { sel: -1, key: "", promo: null });
  const key = board + pub.turn + pub.phase;
  if (st.key !== key) { st.sel = -1; st.promo = null; st.key = key; }

  const canMove = ui.canAct && pub.phase === "playing";
  const legal = canMove ? E.legalMoves(pos) : [];
  const targets = st.sel >= 0 ? legal.filter(m => m.from === st.sel) : [];
  const targetSet = new Set(targets.map(m => m.to));
  const checkSq = pub.check && pub.phase === "playing" ? E.kingSq(pos.b, pos.turn) : -1;
  const last = pub.last || {};

  let squares = "";
  for (let vr = 0; vr < 8; vr++) {
    for (let vf = 0; vf < 8; vf++) {
      const i = flip ? (7 - vr) * 8 + (7 - vf) : vr * 8 + vf;
      const r = i >> 3, f = i & 7;
      const p = pos.b[i];
      const cls = [
        (r + f) % 2 ? "dk" : "lt",
        i === last.from || i === last.to ? "last" : "",
        i === st.sel ? "sel" : "",
        targetSet.has(i) ? (p !== "." ? "tgt-cap" : "tgt-mv") : "",
        i === checkSq ? "chk" : "",
      ].join(" ");
      const coord = (vf === 0 ? `<i class="rk">${8 - r}</i>` : "") + (vr === 7 ? `<i class="fl">${"abcdefgh"[f]}</i>` : "");
      squares += `<button class="sq ${cls}" data-sq="${i}" aria-label="${E.sqName(i)}">${coord}${p !== "." ? `<span class="cp ${E.colorOf(p)}">${glyph(p)}</span>` : ""}</button>`;
    }
  }

  const bar = pl => {
    if (!pl) return "";
    const caps = (pub.captured && pub.captured[pl.color]) || "";
    const turnCls = pub.turnId === pl.id ? "turn" : "";
    return `<div class="cbar ${turnCls}">
      <span class="cdot ${pl.color}"></span>
      <strong>${esc(pl.name)}${pl.id === ui.meId && ui.mode === "online" ? esc(t("me.suffix")) : ""}</strong>
      <span class="caps">${caps.split("").map(c => `<span class="cp ${E.colorOf(c)}">${glyph(c)}</span>`).join("")}</span>
    </div>`;
  };
  const white = players.find(p => p.color === "w");
  const black = players.find(p => p.color === "b");
  const [topP, bottomP] = flip ? [white, black] : [black, white];

  const turnP = players.find(p => p.id === pub.turnId);
  let status = "";
  if (pub.phase === "playing" && turnP) {
    const base = canMove && ui.mode !== "local"
      ? t("chess.yourTurn", { color: colorName(turnP.color) })
      : t("chess.turnOf", { name: turnP.name, color: colorName(turnP.color) });
    status = `<p class="hint">${pub.check ? `<span class="warn">${esc(t("chess.check"))}</span> ` : ""}${esc(base)}</p>`;
  }

  let extra = "";
  if (st.promo) {
    extra += `<div class="picker"><p>${esc(t("chess.promo"))}</p><div class="actions">${["q", "r", "b", "n"].map(pc =>
      `<button data-promo="${pc}"><span class="cp ${pos.turn}">${glyph(pc)}</span> ${esc(t("chess.p." + pc))}</button>`).join("")}</div></div>`;
  }
  if (canMove) {
    extra += `<p class="wait">${esc(t("chess.hint"))}</p>
      <div class="actions"><button id="resign" class="ghost" data-confirm="${esc(t("chess.resignConfirm"))}">${esc(t("chess.resign"))}</button></div>`;
  }
  if (pub.phase === "gameOver") {
    const lastLog = (pub.log || []).slice(-1)[0];
    extra += `<h2>${esc(lastLog ? t(lastLog.k, lastLog.v || {}) : "")}</h2>`;
  }

  // 방금 둔 수: 보드 아래에 크게 보여 주고 다시 보기 버튼
  const lastMove = [...(pub.log || [])].reverse().find(e => e && e.k === "chess.move");
  const lastMoveHTML = lastMove && pub.last
    ? `<div class="lastmove"><span>${esc(t(lastMove.k, lastMove.v || {}))}</span><button id="replay">${esc(t("chess.replay"))}</button></div>`
    : "";

  container.innerHTML = `<div class="game">
    ${bar(topP)}
    <div class="board ${canMove ? "live" : ""}">${squares}</div>
    ${bar(bottomP)}
    ${lastMoveHTML}
    ${status}
    ${extra}
    ${footerHTML(pub, ui)}
    ${logHTML(pub)}
  </div>`;

  const redraw = () => render(container, pub, mine, ui);

  // 상대가 둔 수는 말이 미끄러지듯 천천히 움직여요 (내가 둔 수는 바로)
  const moveKey = board + pub.turn;
  if (pub.last && st.animKey !== moveKey) {
    const mover = E.colorOf(pos.b[pub.last.to]);
    const byMe = ui.mode !== "local" && me && me.color === mover;
    if (!byMe || st.forceAnim) animateMove(container, pub.last, flip);
    st.animKey = moveKey;
    st.forceAnim = false;
  }
  container.querySelector("#replay")?.addEventListener("click", () => {
    st.animKey = "";
    st.forceAnim = true;
    redraw();
  });

  container.querySelectorAll(".sq").forEach(el => el.addEventListener("click", () => {
    if (!canMove || st.promo) return;
    const i = Number(el.dataset.sq);
    if (targetSet.has(i)) {
      const options = targets.filter(m => m.to === i);
      if (options.some(m => m.promo)) { st.promo = { from: st.sel, to: i }; redraw(); return; }
      ui.act({ type: "move", from: st.sel, to: i });
      return;
    }
    st.sel = E.colorOf(pos.b[i]) === pos.turn && st.sel !== i ? i : -1;
    redraw();
  }));
  container.querySelectorAll("[data-promo]").forEach(el => el.addEventListener("click", () => {
    const { from, to } = st.promo;
    st.promo = null;
    ui.act({ type: "move", from, to, promo: el.dataset.promo });
  }));
  bindConfirm(container.querySelector("#resign"), () => ui.act({ type: "resign" }));
  bindFooter(container, ui);
}

const MOVE_MS = 900;

function animateMove(container, last, flip) {
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const toEl = container.querySelector(`.sq[data-sq="${last.to}"]`);
  const piece = toEl && toEl.querySelector(".cp");
  if (!piece) return;
  const view = i => { const r = i >> 3, f = i & 7; return flip ? [7 - r, 7 - f] : [r, f]; };
  const [fr, ff] = view(last.from);
  const [tr, tf] = view(last.to);
  const size = toEl.getBoundingClientRect().width || 0;
  toEl.classList.add("anim");
  piece.style.transition = "none";
  piece.style.transform = `translate(${(ff - tf) * size}px, ${(fr - tr) * size}px)`;
  piece.getBoundingClientRect();   // 시작 위치를 먼저 그리게 해요
  const go = () => {
    piece.style.transition = `transform ${MOVE_MS}ms ease-in-out`;
    piece.style.transform = "translate(0, 0)";
  };
  (window.requestAnimationFrame || setTimeout)(() => (window.requestAnimationFrame || setTimeout)(go));
  setTimeout(() => toEl.classList.remove("anim"), MOVE_MS + 100);
}

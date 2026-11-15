// 체스 규칙: 캐슬링, 앙파상, 승진, 체크메이트, 스테일메이트, 무승부 규칙 포함
// 칸 번호: 0 = a8, 7 = h8, 56 = a1, 63 = h1
// 말: 대문자 = 백(흰색), 소문자 = 흑. "." = 빈칸
import { say } from "../../js/events.js";

const FILES = "abcdefgh";
export const sqName = i => FILES[i & 7] + (8 - (i >> 3));
export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export function fromFEN(fen) {
  const [placement, turn, cs, ep, half, full] = fen.split(" ");
  const b = [];
  for (const ch of placement.replace(/\//g, "")) {
    if (/\d/.test(ch)) for (let k = 0; k < +ch; k++) b.push(".");
    else b.push(ch);
  }
  const epIdx = ep && ep !== "-" ? (8 - +ep[1]) * 8 + FILES.indexOf(ep[0]) : -1;
  return { b, turn, cs: cs === "-" ? "" : cs, ep: epIdx, half: +half || 0, full: +full || 1 };
}

export const colorOf = p => (!p || p === "." ? null : p === p.toUpperCase() ? "w" : "b");
export const other = c => (c === "w" ? "b" : "w");

const KN = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KG = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const ROOK = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const BISH = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const at = (r, f) => (r >= 0 && r < 8 && f >= 0 && f < 8 ? r * 8 + f : -1);

// 칸 i가 by 색 말에게 공격받는지
export function attacked(b, i, by) {
  const r = i >> 3, f = i & 7;
  const w = by === "w";
  const P = w ? "P" : "p", N = w ? "N" : "n", K = w ? "K" : "k";
  const R = w ? "R" : "r", B = w ? "B" : "b", Q = w ? "Q" : "q";
  const pr = w ? r + 1 : r - 1;
  for (const df of [-1, 1]) { const j = at(pr, f + df); if (j >= 0 && b[j] === P) return true; }
  for (const [dr, df] of KN) { const j = at(r + dr, f + df); if (j >= 0 && b[j] === N) return true; }
  for (const [dr, df] of KG) { const j = at(r + dr, f + df); if (j >= 0 && b[j] === K) return true; }
  for (const [dr, df] of ROOK) {
    let rr = r + dr, ff = f + df;
    while (rr >= 0 && rr < 8 && ff >= 0 && ff < 8) {
      const p = b[rr * 8 + ff];
      if (p !== ".") { if (p === R || p === Q) return true; break; }
      rr += dr; ff += df;
    }
  }
  for (const [dr, df] of BISH) {
    let rr = r + dr, ff = f + df;
    while (rr >= 0 && rr < 8 && ff >= 0 && ff < 8) {
      const p = b[rr * 8 + ff];
      if (p !== ".") { if (p === B || p === Q) return true; break; }
      rr += dr; ff += df;
    }
  }
  return false;
}

export function pseudoMoves(pos) {
  const { b, turn } = pos;
  const opp = other(turn);
  const ms = [];
  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (colorOf(p) !== turn) continue;
    const r = i >> 3, f = i & 7, k = p.toLowerCase();

    if (k === "p") {
      const dir = turn === "w" ? -1 : 1;
      const startR = turn === "w" ? 6 : 1;
      const lastR = turn === "w" ? 0 : 7;
      const add = to => {
        if ((to >> 3) === lastR) for (const pr of "qrbn") ms.push({ from: i, to, promo: pr });
        else ms.push({ from: i, to });
      };
      const one = at(r + dir, f);
      if (one >= 0 && b[one] === ".") {
        add(one);
        const two = at(r + 2 * dir, f);
        if (r === startR && b[two] === ".") ms.push({ from: i, to: two, flag: "double" });
      }
      for (const df of [-1, 1]) {
        const to = at(r + dir, f + df);
        if (to < 0) continue;
        if (colorOf(b[to]) === opp) add(to);
        else if (to === pos.ep) ms.push({ from: i, to, flag: "ep" });
      }
    } else if (k === "n" || k === "k") {
      for (const [dr, df] of (k === "n" ? KN : KG)) {
        const to = at(r + dr, f + df);
        if (to >= 0 && colorOf(b[to]) !== turn) ms.push({ from: i, to });
      }
      if (k === "k") {
        const home = turn === "w" ? 60 : 4;
        const [K, Q, R] = turn === "w" ? ["K", "Q", "R"] : ["k", "q", "r"];
        if (i === home && !attacked(b, home, opp)) {
          if (pos.cs.includes(K) && b[home + 1] === "." && b[home + 2] === "." && b[home + 3] === R &&
              !attacked(b, home + 1, opp) && !attacked(b, home + 2, opp)) ms.push({ from: i, to: home + 2, flag: "castleK" });
          if (pos.cs.includes(Q) && b[home - 1] === "." && b[home - 2] === "." && b[home - 3] === "." && b[home - 4] === R &&
              !attacked(b, home - 1, opp) && !attacked(b, home - 2, opp)) ms.push({ from: i, to: home - 2, flag: "castleQ" });
        }
      }
    } else {
      const dirs = k === "r" ? ROOK : k === "b" ? BISH : [...ROOK, ...BISH];
      for (const [dr, df] of dirs) {
        let rr = r + dr, ff = f + df;
        while (rr >= 0 && rr < 8 && ff >= 0 && ff < 8) {
          const to = rr * 8 + ff;
          const c = colorOf(b[to]);
          if (c === turn) break;
          ms.push({ from: i, to });
          if (c) break;
          rr += dr; ff += df;
        }
      }
    }
  }
  return ms;
}

export function makeMove(pos, m) {
  const b = pos.b.slice();
  const p = b[m.from];
  const white = pos.turn === "w";
  let captured = b[m.to];
  b[m.to] = m.promo ? (white ? m.promo.toUpperCase() : m.promo) : p;
  b[m.from] = ".";
  if (m.flag === "ep") {
    const cap = m.to + (white ? 8 : -8);
    captured = b[cap];
    b[cap] = ".";
  }
  if (m.flag === "castleK") { if (white) { b[61] = "R"; b[63] = "."; } else { b[5] = "r"; b[7] = "."; } }
  if (m.flag === "castleQ") { if (white) { b[59] = "R"; b[56] = "."; } else { b[3] = "r"; b[0] = "."; } }

  let cs = pos.cs;
  const strip = chars => { for (const c of chars) cs = cs.replace(c, ""); };
  if (p === "K") strip("KQ");
  if (p === "k") strip("kq");
  for (const sq of [m.from, m.to]) {
    if (sq === 63) strip("K");
    if (sq === 56) strip("Q");
    if (sq === 7) strip("k");
    if (sq === 0) strip("q");
  }
  return {
    b,
    turn: other(pos.turn),
    cs,
    ep: m.flag === "double" ? (m.from + m.to) / 2 : -1,
    half: p.toLowerCase() === "p" || captured !== "." ? 0 : pos.half + 1,
    full: pos.full + (pos.turn === "b" ? 1 : 0),
    captured: captured !== "." ? captured : null,
  };
}

export const kingSq = (b, side) => b.indexOf(side === "w" ? "K" : "k");

export function legalMoves(pos) {
  return pseudoMoves(pos).filter(m => {
    const np = makeMove(pos, m);
    return !attacked(np.b, kingSq(np.b, pos.turn), np.turn);
  });
}

export const inCheck = pos => attacked(pos.b, kingSq(pos.b, pos.turn), other(pos.turn));

function insufficient(b) {
  const rest = b.filter(p => p !== "." && p.toLowerCase() !== "k");
  return !rest.length || (rest.length === 1 && "bn".includes(rest[0].toLowerCase()));
}

const posKey = pos => pos.b.join("") + pos.turn + pos.cs + pos.ep;

// ---------- 게임 진행 (공통 진행 장치용) ----------
export function newGame(players) {
  const ps = players.slice(0, 2).map((p, i) => ({
    id: p.id, name: p.name, isAI: !!p.isAI, level: p.level || "normal", color: i === 0 ? "w" : "b",
  }));
  const g = {
    players: ps,
    pos: fromFEN(START_FEN),
    phase: "playing",
    winnerId: null,
    endReason: null,
    last: null,
    captured: { w: "", b: "" },   // 각 색이 잡은 말
    reps: {},
    log: [],
    fx: [],
  };
  g.reps[posKey(g.pos)] = 1;
  say(g, "chess.start", { name: ps[0].name }, "shuffle");
  return g;
}

export const nextRound = () => {};

function end(g, winnerId, reason, extra = {}) {
  g.phase = "gameOver";
  g.winnerId = winnerId;
  g.endReason = reason;
  const w = g.players.find(p => p.id === winnerId);
  say(g, "chess.end." + reason, { name: w ? w.name : "", ...extra }, winnerId ? "fanfare" : "end");
}

// action: { type: "move", from, to, promo? } | { type: "resign" }
export function act(g, playerId, a) {
  if (g.phase !== "playing" || !a) return false;
  const p = g.players.find(x => x.id === playerId);
  if (!p) return false;

  if (a.type === "resign") {
    const w = g.players.find(x => x !== p);
    end(g, w.id, "resign", { loser: p.name });
    return true;
  }
  if (a.type !== "move" || p.color !== g.pos.turn) return false;

  const promo = ["q", "r", "b", "n"].includes(a.promo) ? a.promo : "q";
  const m = legalMoves(g.pos).find(x => x.from === a.from && x.to === a.to && (!x.promo || x.promo === promo));
  if (!m) return false;

  const piece = g.pos.b[m.from];
  const np = makeMove(g.pos, m);
  const capturedPiece = np.captured;
  delete np.captured;
  if (capturedPiece) g.captured[p.color] += capturedPiece;
  g.pos = np;
  g.last = { from: m.from, to: m.to };
  const key = posKey(np);
  g.reps[key] = (g.reps[key] || 0) + 1;

  const check = inCheck(np);
  const replies = legalMoves(np);
  const info = {
    name: p.name, piece: piece.toUpperCase(), from: sqName(m.from), to: sqName(m.to),
    cap: capturedPiece ? 1 : 0,
    promo: m.promo ? m.promo.toUpperCase() : "",
    castle: m.flag === "castleK" ? "K" : m.flag === "castleQ" ? "Q" : "",
    check: check ? 1 : 0,
  };

  const ending = !replies.length || insufficient(np.b) || np.half >= 100 || g.reps[key] >= 3;
  say(g, "chess.move", info, ending ? null : check ? "special" : info.cap ? "chip" : "place");

  if (!replies.length) end(g, check ? p.id : null, check ? "mate" : "stalemate");
  else if (insufficient(np.b)) end(g, null, "insufficient");
  else if (np.half >= 100) end(g, null, "fifty");
  else if (g.reps[key] >= 3) end(g, null, "repetition");
  return true;
}

export function publicView(g) {
  const turnPlayer = g.players.find(p => p.color === g.pos.turn);
  return {
    phase: g.phase,
    turnId: g.phase === "playing" && turnPlayer ? turnPlayer.id : null,
    board: g.pos.b.join(""),
    turn: g.pos.turn,
    cs: g.pos.cs,
    ep: g.pos.ep,
    half: g.pos.half,
    last: g.last,
    check: inCheck(g.pos),
    captured: g.captured,
    winnerId: g.winnerId,
    endReason: g.endReason,
    log: [...g.log],
    fx: [...(g.fx || [])],
    players: g.players.map(p => ({ id: p.id, name: p.name, isAI: p.isAI, color: p.color })),
  };
}

export const privateView = () => null;

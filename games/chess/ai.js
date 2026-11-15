// 체스 컴퓨터: 말 점수 + 위치 점수로 몇 수 앞을 읽어요 (알파-베타 탐색)
import { pseudoMoves, legalMoves, makeMove, attacked, kingSq, inCheck } from "./engine.js";

const VAL = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };

// 백 기준 위치 점수 (0 = a8). 흑은 위아래를 뒤집어 사용
const PST = {
  P: [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5,
      0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
  N: [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30,
      -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
  B: [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10,
      -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
  R: [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5,
      -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
  Q: [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5,
      0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
  K: [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30,
      -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20],
};

const MATE = 100000;
const INF = 1e9;

function evaluate(pos) {
  let s = 0;
  const b = pos.b;
  for (let i = 0; i < 64; i++) {
    const p = b[i];
    if (p === ".") continue;
    const u = p.toUpperCase();
    if (p === u) s += VAL[u] + PST[u][i];
    else s -= VAL[u] + PST[u][i ^ 56];
  }
  return pos.turn === "w" ? s : -s;
}

// 잡는 수, 승진을 먼저 살펴봐야 탐색이 빨라져요
function ordered(b, ms) {
  return ms
    .map(m => {
      const victim = b[m.to] !== "." ? VAL[b[m.to].toUpperCase()] : m.flag === "ep" ? 100 : 0;
      const attacker = VAL[b[m.from].toUpperCase()] || 0;
      return { m, s: (victim ? 10 * victim - attacker / 10 : 0) + (m.promo === "q" ? 900 : 0) };
    })
    .sort((a, z) => z.s - a.s)
    .map(x => x.m);
}

const illegal = (pos, np) => attacked(np.b, kingSq(np.b, pos.turn), np.turn);

function quiesce(pos, alpha, beta, qd) {
  const stand = evaluate(pos);
  if (stand >= beta) return beta;
  if (stand > alpha) alpha = stand;
  if (qd <= 0) return alpha;
  const caps = pseudoMoves(pos).filter(m => pos.b[m.to] !== "." || m.flag === "ep" || m.promo === "q");
  for (const m of ordered(pos.b, caps)) {
    const np = makeMove(pos, m);
    if (illegal(pos, np)) continue;
    const s = -quiesce(np, -beta, -alpha, qd - 1);
    if (s >= beta) return beta;
    if (s > alpha) alpha = s;
  }
  return alpha;
}

function negamax(pos, depth, alpha, beta, ply, qd) {
  if (depth === 0) return quiesce(pos, alpha, beta, qd);
  let any = false;
  for (const m of ordered(pos.b, pseudoMoves(pos))) {
    const np = makeMove(pos, m);
    if (illegal(pos, np)) continue;
    any = true;
    const s = -negamax(np, depth - 1, -beta, -alpha, ply + 1, qd);
    if (s >= beta) return beta;
    if (s > alpha) alpha = s;
  }
  if (!any) return inCheck(pos) ? -MATE + ply : 0;
  return alpha;
}

const LEVELS = {
  easy:   { depth: 1, qd: 0, noise: 150, blunder: 0.25 },
  normal: { depth: 2, qd: 3, noise: 30,  blunder: 0 },
  hard:   { depth: 3, qd: 4, noise: 10,  blunder: 0 },
};

export function bestMove(pos, level = "normal") {
  const cfg = LEVELS[level] || LEVELS.normal;
  const moves = legalMoves(pos);
  if (!moves.length) return null;
  if (Math.random() < cfg.blunder) return moves[Math.floor(Math.random() * moves.length)];

  let best = null, bestScore = -INF, alpha = -INF;
  for (const m of ordered(pos.b, moves)) {
    const np = makeMove(pos, m);
    // 비슷한 점수의 수 중에서는 조금씩 다르게 골라서 매번 같은 게임이 되지 않게
    const raw = -negamax(np, cfg.depth - 1, -INF, -(alpha - cfg.noise), 1, cfg.qd);
    const s = raw + (Math.random() - 0.5) * cfg.noise;
    if (s > bestScore) { bestScore = s; best = m; }
    if (raw > alpha) alpha = raw;
  }
  return best;
}

export function decide(g, playerId) {
  const p = g.players.find(x => x.id === playerId);
  if (!p) return null;
  const m = bestMove(g.pos, p.level);
  return m ? { type: "move", from: m.from, to: m.to, promo: m.promo } : { type: "resign" };
}

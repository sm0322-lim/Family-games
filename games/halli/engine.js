// 할리갈리 규칙
// - 과일 카드 56장 (과일 4종 × 1개 5장, 2개 3장, 3개 3장, 4개 2장, 5개 1장)을 모두 나눠 가져요
// - 차례대로 내 더미 맨 위 카드를 뒤집어 내 앞에 놓아요 (맨 위 카드만 보여요)
// - 보이는 카드 중 한 과일이 정확히 5개면 누구든 먼저 종을 친 사람이 펼쳐진 카드를 모두 가져가요
// - 잘못 치면 다른 사람에게 1장씩 줘요
// - 카드가 모두 없어지면 탈락, 마지막까지 남은 사람이 우승
import { shuffle } from "../../js/cards.js";
import { say, fx } from "../../js/events.js";

export const FRUITS = ["S", "B", "L", "G"];   // 딸기, 바나나, 라임, 포도
const COUNTS = [[1, 5], [2, 3], [3, 3], [4, 2], [5, 1]];

function newDeck() {
  const d = [];
  for (const f of FRUITS) for (const [n, k] of COUNTS) for (let i = 0; i < k; i++) d.push({ f, n });
  return shuffle(d);
}

const total = p => p.deck.length + p.pile.length;
const alive = p => total(p) > 0;

// 보이는 카드 중 정확히 5개인 과일 (없으면 null)
export function fiveFruit(g) {
  const sum = {};
  g.players.forEach(p => {
    const top = p.pile[p.pile.length - 1];
    if (top) sum[top.f] = (sum[top.f] || 0) + top.n;
  });
  return FRUITS.find(f => sum[f] === 5) || null;
}

export function newGame(players) {
  const g = {
    phase: "playing",
    players: players.map(p => ({ id: p.id, name: p.name, isAI: !!p.isAI, level: p.level || "normal", deck: [], pile: [] })),
    turnIndex: 0,
    ver: 0,          // 판이 바뀔 때마다 증가: 늦게 도착한 종 치기를 구분해요
    winnerId: null,
    log: [],
    fx: [],
  };
  newDeck().forEach((c, i) => g.players[i % g.players.length].deck.push(c));
  say(g, "halli.start", { name: g.players[0].name }, "shuffle");
  return g;
}

export const nextRound = () => {};

function advance(g) {
  const n = g.players.length;
  for (let step = 1; step <= n; step++) {
    const i = (g.turnIndex + step) % n;
    if (g.players[i].deck.length) { g.turnIndex = i; return; }
  }
  g.turnIndex = -1;
}

function checkEnd(g) {
  g.players.forEach(p => {
    if (!alive(p) && !p.out) { p.out = true; say(g, "halli.out", { name: p.name }); }
  });
  const left = g.players.filter(alive);
  if (left.length <= 1) {
    g.phase = "gameOver";
    g.winnerId = left[0] ? left[0].id : null;
    g.turnIndex = -1;
    say(g, "halli.win", { name: left[0] ? left[0].name : "" }, "fanfare");
    return;
  }
  // 아무도 뒤집을 카드가 없으면 카드가 가장 많은 사람이 우승
  if (!g.players.some(p => p.deck.length)) {
    const best = [...g.players].sort((a, b) => total(b) - total(a))[0];
    g.phase = "gameOver";
    g.winnerId = best.id;
    g.turnIndex = -1;
    say(g, "halli.stuck", { name: best.name }, "fanfare");
    return;
  }
  const cur = g.players[g.turnIndex];
  if (!cur || !cur.deck.length) advance(g);
}

// action: { type: "flip" } | { type: "ring", ver }
export function act(g, playerId, a) {
  if (g.phase !== "playing" || !a) return false;
  const p = g.players.find(x => x.id === playerId);
  if (!p) return false;

  if (a.type === "flip") {
    if (g.players[g.turnIndex] !== p || !p.deck.length) return false;
    p.pile.push(p.deck.pop());
    g.ver++;
    fx(g, "flip");
    advance(g);
    checkEnd(g);
    return true;
  }

  if (a.type === "ring") {
    if (!alive(p) || a.ver !== g.ver) return false;   // 이미 판이 바뀐 뒤 도착한 종은 무시
    if (fiveFruit(g)) {
      const won = [];
      g.players.forEach(x => { won.push(...x.pile); x.pile = []; });
      p.deck.unshift(...shuffle(won));   // 가져온 카드는 내 더미 맨 아래로
      say(g, "halli.good", { name: p.name, n: won.length }, "bell");
      fx(g, "end");
    } else {
      let given = 0;
      g.players.forEach(x => {
        if (x !== p && alive(x) && p.deck.length) { x.deck.unshift(p.deck.pop()); given++; }
      });
      say(g, "halli.bad", { name: p.name, n: given }, "bell");
      fx(g, "bust");
    }
    g.ver++;
    checkEnd(g);
    return true;
  }
  return false;
}

export function publicView(g) {
  const turn = g.turnIndex >= 0 ? g.players[g.turnIndex] : null;
  return {
    phase: g.phase,
    turnId: g.phase === "playing" && turn ? turn.id : null,
    ver: g.ver,
    winnerId: g.winnerId,
    log: [...g.log],
    fx: [...(g.fx || [])],
    players: g.players.map(p => ({
      id: p.id, name: p.name, isAI: p.isAI,
      deck: p.deck.length, pile: p.pile.length,
      top: p.pile[p.pile.length - 1] || null,
      out: !alive(p),
    })),
  };
}

export const privateView = () => null;

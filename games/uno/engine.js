// 우노 기본 규칙
// - 7장씩, 같은 색 또는 같은 숫자/기호를 내요. 와일드는 언제나 가능
// - 낼 카드가 있어도 없어도 1장 먹을 수 있고, 먹은 카드를 낼 수 있으면 바로 내거나 넘겨요
// - 가장 먼저 카드를 다 털면 우승
import { shuffle } from "../../js/cards.js";
import { say } from "../../js/events.js";

export const COLORS = ["R", "Y", "G", "B"];

function newDeck() {
  const d = [];
  for (const c of COLORS) {
    d.push({ c, v: "0" });
    for (let n = 1; n <= 9; n++) d.push({ c, v: String(n) }, { c, v: String(n) });
    for (const v of ["skip", "rev", "+2"]) d.push({ c, v }, { c, v });
  }
  for (let i = 0; i < 4; i++) d.push({ c: "W", v: "wild" }, { c: "W", v: "+4" });
  return shuffle(d);
}

export const canPlay = (card, top, color) =>
  !!card && (card.c === "W" || card.c === color || (!!top && card.v === top.v));

const idx = (g, k) => (((g.turnIndex + g.dir * k) % g.players.length) + g.players.length) % g.players.length;

export function newGame(players) {
  const g = {
    phase: "playing",          // playing | gameOver
    players: players.map(p => ({ id: p.id, name: p.name, isAI: !!p.isAI, hand: [] })),
    deck: newDeck(),
    discard: [],
    color: null,
    dir: 1,
    turnIndex: 0,
    pendingDraw: false,        // 뽑은 카드를 낼지 고르는 중
    winnerId: null,
    log: [],
    fx: [],
  };
  for (let k = 0; k < 7; k++) g.players.forEach(p => p.hand.push(g.deck.pop()));

  // 첫 카드는 숫자 카드로
  const skipped = [];
  let first = g.deck.pop();
  while (!/^\d$/.test(first.v)) { skipped.push(first); first = g.deck.pop(); }
  g.deck.unshift(...skipped);
  g.discard.push(first);
  g.color = first.c;
  say(g, "uno.start", { name: g.players[0].name }, "shuffle");
  return g;
}

export const nextRound = () => {};

function drawOne(g) {
  if (!g.deck.length) {
    const top = g.discard.pop();
    g.deck = shuffle(g.discard);
    g.discard = top ? [top] : [];
  }
  return g.deck.pop() || null;
}

function drawN(g, p, n) {
  for (let i = 0; i < n; i++) {
    const c = drawOne(g);
    if (c) p.hand.push(c);
  }
}

// action: { type: "play", index, color? } | { type: "draw" } | { type: "pass" }
export function act(g, playerId, a) {
  if (g.phase !== "playing" || !a) return false;
  const p = g.players[g.turnIndex];
  if (!p || p.id !== playerId) return false;
  const top = g.discard[g.discard.length - 1];

  if (a.type === "play") {
    const i = a.index;
    if (!Number.isInteger(i) || i < 0 || i >= p.hand.length) return false;
    if (g.pendingDraw && i !== p.hand.length - 1) return false;
    const card = p.hand[i];
    if (!canPlay(card, top, g.color)) return false;
    if (card.c === "W" && !COLORS.includes(a.color)) return false;

    p.hand.splice(i, 1);
    g.discard.push(card);
    g.pendingDraw = false;
    g.color = card.c === "W" ? a.color : card.c;
    // 기록용 정보 (화면에서 언어에 맞게 문장으로 바뀌어요)
    const info = { name: p.name, c: card.c, val: card.v, color: g.color, eff: "", target: "", k: 0, uno: 0 };

    if (!p.hand.length) {
      g.phase = "gameOver";
      g.winnerId = p.id;
      g.turnIndex = -1;
      say(g, "uno.play", info, "place");
      say(g, "uno.win", { name: p.name }, "fanfare");
      return true;
    }
    if (p.hand.length === 1) info.uno = 1;

    const next = g.players[idx(g, 1)];
    if (card.v === "skip" || (card.v === "rev" && g.players.length === 2)) {
      info.eff = "skip"; info.target = next.name;
      g.turnIndex = idx(g, 2);
    } else if (card.v === "rev") {
      g.dir *= -1;
      info.eff = "rev";
      g.turnIndex = idx(g, 1);
    } else if (card.v === "+2" || card.v === "+4") {
      const k = card.v === "+2" ? 2 : 4;
      drawN(g, next, k);
      info.eff = "draw"; info.target = next.name; info.k = k;
      g.turnIndex = idx(g, 2);
    } else {
      g.turnIndex = idx(g, 1);
    }
    const sound = info.uno ? "uno" : (card.c === "W" || !/^\d$/.test(card.v)) ? "special" : "place";
    say(g, "uno.play", info, sound);
    return true;
  }

  if (a.type === "draw") {
    if (g.pendingDraw) return false;
    const c = drawOne(g);
    if (!c) { say(g, "uno.empty", { name: p.name }); g.turnIndex = idx(g, 1); return true; }
    p.hand.push(c);
    if (canPlay(c, top, g.color)) {
      g.pendingDraw = true;
      say(g, "uno.drew", { name: p.name }, "flip");
    } else {
      say(g, "uno.drewPass", { name: p.name }, "flip");
      g.turnIndex = idx(g, 1);
    }
    return true;
  }

  if (a.type === "pass") {
    if (!g.pendingDraw) return false;
    g.pendingDraw = false;
    say(g, "uno.pass", { name: p.name });
    g.turnIndex = idx(g, 1);
    return true;
  }
  return false;
}

export function publicView(g) {
  const turn = g.turnIndex >= 0 ? g.players[g.turnIndex] : null;
  return {
    phase: g.phase,
    turnId: g.phase === "playing" && turn ? turn.id : null,
    top: g.discard[g.discard.length - 1] || null,
    color: g.color,
    dir: g.dir,
    deckCount: g.deck.length,
    pendingDraw: g.pendingDraw,
    winnerId: g.winnerId,
    log: [...g.log],
    fx: [...(g.fx || [])],
    players: g.players.map(p => ({ id: p.id, name: p.name, isAI: p.isAI, count: p.hand.length })),
  };
}

export function privateView(g, playerId) {
  const p = g.players.find(x => x.id === playerId);
  return p ? { hand: p.hand } : null;
}

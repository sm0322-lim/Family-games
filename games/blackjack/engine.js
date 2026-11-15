// 블랙잭: 가족 모두가 컴퓨터 딜러와 대결
// - 칩 100개로 시작, 라운드마다 10/20/50칩 베팅
// - 21에 가깝게, 넘으면 버스트. 딜러는 17 이상에서 멈춤
// - 10라운드 후 칩이 가장 많은 사람이 우승
import { newDeck52 } from "../../js/cards.js";
import { say } from "../../js/events.js";

export const START_CHIPS = 100;
export const ROUNDS = 10;
export const BETS = [10, 20, 50];
const MIN_BET = BETS[0];

export function handValue(cards) {
  let total = 0, aces = 0;
  for (const c of cards || []) {
    if (c.r === 1) { aces++; total += 11; } else total += Math.min(c.r, 10);
  }
  while (total > 21 && aces) { total -= 10; aces--; }
  return { total, soft: aces > 0 };
}

const isBlackjack = cards => cards.length === 2 && handValue(cards).total === 21;
export const canDouble = p => p.status === "playing" && p.hand.length === 2 && p.chips >= p.bet * 2;

export function newGame(players) {
  const g = {
    round: 0,
    phase: "bet",              // bet | play | roundEnd | gameOver
    players: players.map(p => ({
      id: p.id, name: p.name, isAI: !!p.isAI,
      chips: START_CHIPS, bet: 0, hand: [], status: "out", result: null, delta: 0,
    })),
    dealer: [],
    deck: [],
    turnIndex: -1,
    winnerIds: [],
    log: [],
    fx: [],
  };
  startRound(g);
  return g;
}

export function nextRound(g) {
  if (g.phase === "roundEnd") startRound(g);
}

function startRound(g) {
  if (g.round >= ROUNDS || !g.players.some(p => p.chips >= MIN_BET)) return endGame(g);
  g.round += 1;
  g.deck = newDeck52();
  g.dealer = [];
  g.players.forEach(p => {
    p.hand = []; p.bet = 0; p.result = null; p.delta = 0;
    p.status = p.chips >= MIN_BET ? "bet" : "out";
  });
  g.phase = "bet";
  g.turnIndex = g.players.findIndex(p => p.status === "bet");
  say(g, "bj.round", { round: g.round }, "shuffle");
}

function draw(g) {
  if (!g.deck.length) g.deck = newDeck52();
  return g.deck.pop();
}

// action: { type: "bet", amount } | { type: "hit" } | { type: "stand" } | { type: "double" }
export function act(g, playerId, a) {
  const p = g.players[g.turnIndex];
  if (!p || p.id !== playerId || !a) return false;

  if (g.phase === "bet") {
    if (a.type !== "bet" || !BETS.includes(a.amount) || a.amount > p.chips) return false;
    p.bet = a.amount;
    p.status = "ready";
    say(g, "bj.bet", { name: p.name, n: a.amount }, "chip");
    const next = g.players.findIndex(x => x.status === "bet");
    if (next >= 0) g.turnIndex = next; else deal(g);
    return true;
  }

  if (g.phase !== "play" || p.status !== "playing") return false;

  if (a.type === "hit") {
    p.hand.push(draw(g));
    const v = handValue(p.hand).total;
    if (v > 21) { p.status = "bust"; say(g, "bj.hitBust", { name: p.name, n: v }, "bust"); nextPlayer(g); }
    else if (v === 21) { p.status = "stand"; say(g, "bj.hit21", { name: p.name }, "uno"); nextPlayer(g); }
    else say(g, "bj.hit", { name: p.name, n: v }, "flip");
    return true;
  }
  if (a.type === "stand") {
    p.status = "stand";
    say(g, "bj.stand", { name: p.name, n: handValue(p.hand).total }, "place");
    nextPlayer(g);
    return true;
  }
  if (a.type === "double") {
    if (!canDouble(p)) return false;
    p.bet *= 2;
    p.hand.push(draw(g));
    const v = handValue(p.hand).total;
    p.status = v > 21 ? "bust" : "stand";
    say(g, v > 21 ? "bj.doubleBust" : "bj.double", { name: p.name, bet: p.bet, n: v }, v > 21 ? "bust" : "chip");
    nextPlayer(g);
    return true;
  }
  return false;
}

function deal(g) {
  const live = g.players.filter(p => p.status === "ready");
  for (let k = 0; k < 2; k++) {
    live.forEach(p => p.hand.push(draw(g)));
    g.dealer.push(draw(g));
  }
  live.forEach(p => { p.status = isBlackjack(p.hand) ? "blackjack" : "playing"; });
  g.phase = "play";
  say(g, "bj.dealt", {}, "flip");

  if (isBlackjack(g.dealer)) {
    say(g, "bj.dealerBJ", {}, "lose");
    return dealerPlay(g);
  }
  const first = g.players.findIndex(p => p.status === "playing");
  if (first >= 0) g.turnIndex = first; else dealerPlay(g);
}

function nextPlayer(g) {
  for (let i = g.turnIndex + 1; i < g.players.length; i++) {
    if (g.players[i].status === "playing") { g.turnIndex = i; return; }
  }
  dealerPlay(g);
}

function dealerPlay(g) {
  g.turnIndex = -1;
  const someoneStands = g.players.some(p => p.status === "stand");
  if (someoneStands && !isBlackjack(g.dealer)) {
    while (handValue(g.dealer).total < 17) g.dealer.push(draw(g));
  }
  settle(g);
}

function settle(g) {
  const d = handValue(g.dealer).total;
  const dBJ = isBlackjack(g.dealer);
  say(g, d > 21 ? "bj.dealerBust" : "bj.dealer", { n: d }, "end");

  g.players.forEach(p => {
    if (p.status === "out") return;
    let delta = 0, result;
    if (p.status === "bust") { delta = -p.bet; result = "lose"; }
    else if (p.status === "blackjack") {
      if (dBJ) result = "push";
      else { delta = Math.floor(p.bet * 1.5); result = "bj"; }
    } else {
      const v = handValue(p.hand).total;
      if (dBJ) { delta = -p.bet; result = "lose"; }
      else if (d > 21 || v > d) { delta = p.bet; result = "win"; }
      else if (v === d) result = "push";
      else { delta = -p.bet; result = "lose"; }
    }
    p.delta = delta;
    p.chips += delta;
    p.result = result;
  });

  if (g.round >= ROUNDS || !g.players.some(p => p.chips >= MIN_BET)) return endGame(g);
  g.phase = "roundEnd";
}

function endGame(g) {
  g.phase = "gameOver";
  g.turnIndex = -1;
  const max = Math.max(...g.players.map(p => p.chips));
  g.winnerIds = max > 0 ? g.players.filter(p => p.chips === max).map(p => p.id) : [];
  const names = g.players.filter(p => g.winnerIds.includes(p.id)).map(p => p.name).join(", ");
  if (names) say(g, "bj.win", { names, n: max }, "fanfare");
  else say(g, "bj.dealerWins", {}, "lose");
}

export function publicView(g) {
  const reveal = g.phase === "roundEnd" || g.phase === "gameOver";
  const turn = g.turnIndex >= 0 ? g.players[g.turnIndex] : null;
  return {
    round: g.round,
    rounds: ROUNDS,
    phase: g.phase,
    turnId: (g.phase === "bet" || g.phase === "play") && turn ? turn.id : null,
    dealer: {
      cards: reveal ? g.dealer : g.dealer.slice(0, 1),
      hidden: reveal ? 0 : Math.max(0, g.dealer.length - 1),
      total: reveal && g.dealer.length ? handValue(g.dealer).total : null,
    },
    winnerIds: g.winnerIds,
    log: [...g.log],
    fx: [...(g.fx || [])],
    players: g.players.map(p => ({
      id: p.id, name: p.name, isAI: p.isAI,
      chips: p.chips, bet: p.bet, hand: p.hand,
      total: p.hand.length ? handValue(p.hand).total : 0,
      status: p.status, result: p.result, delta: p.delta,
      canDouble: canDouble(p),
    })),
  };
}

export const privateView = () => null;

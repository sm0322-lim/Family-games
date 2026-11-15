// 31 규칙
// - 각자 3장, 바닥에 1장 펼침
// - 차례: 더미 또는 바닥에서 1장 가져오고 1장 반납 (항상 3장)
// - 또는 가져오는 대신 Lock → 다른 사람은 마지막으로 한 번씩 교환
// - 같은 숫자 3장(트리플)을 만들면 즉시 1등, 나머지 모두 목숨 -1
// - 공개: 같은 무늬 합이 점수 (A=11, J/Q/K=10). 가장 낮은 사람 목숨 -1
import { newDeck52, shuffle, cardLabel, rankLabel } from "../../js/cards.js";
import { say } from "../../js/events.js";

export const START_LIVES = 3;

export const cardValue = c => (c.r === 1 ? 11 : Math.min(c.r, 10));

export const isTriple = hand => (hand || []).length === 3 && hand.every(c => c.r === hand[0].r);

export function score(hand) {
  const bySuit = {};
  (hand || []).forEach(c => { bySuit[c.s] = (bySuit[c.s] || 0) + cardValue(c); });
  const vals = Object.values(bySuit);
  return vals.length ? Math.max(...vals) : 0;
}

// 순위 비교용: 트리플은 31보다 높아요
export const rankValue = hand => (isTriple(hand) ? 100 : score(hand));

// 4장 중 무엇을 버리면 남은 3장이 가장 좋은지
export function bestKeep(hand4) {
  let best = null;
  hand4.forEach((c, i) => {
    const s = rankValue(hand4.filter((_, j) => j !== i));
    if (!best || s > best.score || (s === best.score && cardValue(c) < cardValue(hand4[best.index]))) {
      best = { index: i, score: s };
    }
  });
  return best;
}

const aliveOf = g => g.players.filter(p => p.lives > 0);
const namesOf = (g, ids) => ids.map(id => g.players.find(p => p.id === id).name).join(", ");

function nextAlive(g, from) {
  const n = g.players.length;
  for (let step = 1; step <= n; step++) {
    const i = (((from + step) % n) + n) % n;
    if (g.players[i].lives > 0) return i;
  }
  return -1;
}

export function newGame(players) {
  const g = {
    round: 0,
    phase: "playing",          // playing | roundEnd | gameOver
    players: players.map(p => ({ id: p.id, name: p.name, isAI: !!p.isAI, lives: START_LIVES, hand: [] })),
    deck: [],
    discard: [],
    starter: -1,
    turnIndex: -1,
    step: "draw",              // draw(가져오기) | discard(반납)
    lockBy: null,
    turnCount: 0,
    result: null,
    winnerId: null,
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
  const live = aliveOf(g);
  if (live.length <= 1) return endGame(g);

  g.round += 1;
  g.deck = newDeck52();
  g.discard = [];
  g.players.forEach(p => { p.hand = []; });
  for (let k = 0; k < 3; k++) live.forEach(p => p.hand.push(g.deck.pop()));
  g.discard.push(g.deck.pop());

  g.starter = nextAlive(g, g.starter);
  g.turnIndex = g.starter;
  g.step = "draw";
  g.lockBy = null;
  g.turnCount = 0;
  g.result = null;
  g.phase = "playing";
  say(g, "31.start", { round: g.round, name: g.players[g.turnIndex].name }, "shuffle");

  // 처음 받은 3장이 트리플이면 바로 승리
  const lucky = live.filter(p => isTriple(p.hand)).map(p => p.id);
  if (lucky.length) finishRound(g, lucky);
}

function refillDeck(g) {
  if (g.deck.length) return;
  const top = g.discard.pop();
  g.deck = shuffle(g.discard);
  g.discard = top ? [top] : [];
}

// action: { type: "drawDeck" } | { type: "drawDiscard" } | { type: "lock" } | { type: "discard", index }
export function act(g, playerId, a) {
  if (g.phase !== "playing" || !a) return false;
  const p = g.players[g.turnIndex];
  if (!p || p.id !== playerId) return false;

  if (g.step === "draw") {
    if (a.type === "drawDeck") {
      refillDeck(g);
      const c = g.deck.pop();
      if (!c) return false;
      p.hand.push(c);
      g.step = "discard";
      say(g, "31.drawDeck", { name: p.name }, "flip");
      return true;
    }
    if (a.type === "drawDiscard") {
      const c = g.discard.pop();
      if (!c) return false;
      p.hand.push(c);
      g.step = "discard";
      say(g, "31.drawDiscard", { name: p.name, card: cardLabel(c) }, "flip");
      return true;
    }
    if (a.type === "lock") {
      if (g.lockBy) return false;
      g.lockBy = p.id;
      say(g, "31.lock", { name: p.name }, "lock");
      endTurn(g);
      return true;
    }
    return false;
  }

  if (g.step === "discard" && a.type === "discard") {
    const i = a.index;
    if (!Number.isInteger(i) || i < 0 || i >= p.hand.length) return false;
    const [c] = p.hand.splice(i, 1);
    g.discard.push(c);
    say(g, "31.discard", { name: p.name, card: cardLabel(c) }, "place");
    if (isTriple(p.hand)) finishRound(g, [p.id]);
    else endTurn(g);
    return true;
  }
  return false;
}

function endTurn(g) {
  g.turnCount += 1;
  const next = nextAlive(g, g.turnIndex);
  if (g.lockBy && g.players[next].id === g.lockBy) return finishRound(g, null);
  g.turnIndex = next;
  g.step = "draw";
}

// instantIds: 트리플로 즉시 이긴 사람들 (없으면 null)
function finishRound(g, instantIds) {
  const live = aliveOf(g);
  const reveal = live.map(p => ({
    id: p.id, name: p.name, hand: [...p.hand],
    score: score(p.hand), triple: isTriple(p.hand),
  }));

  let winnerIds, lostIds;
  if (instantIds) {
    winnerIds = instantIds;
    lostIds = live.filter(p => !instantIds.includes(p.id)).map(p => p.id);
  } else {
    const vals = live.map(p => rankValue(p.hand));
    const max = Math.max(...vals);
    const min = Math.min(...vals);
    winnerIds = live.filter(p => rankValue(p.hand) === max).map(p => p.id);
    lostIds = max === min ? [] : live.filter(p => rankValue(p.hand) === min).map(p => p.id);
  }

  live.forEach(p => { if (lostIds.includes(p.id)) p.lives -= 1; });
  g.result = { reveal, winnerIds, lostIds, lockBy: g.lockBy, instant: !!instantIds };
  g.turnIndex = -1;

  if (instantIds) {
    const w = live.find(p => p.id === instantIds[0]);
    const r = rankLabel(w.hand[0].r);
    say(g, "31.triple", { names: namesOf(g, winnerIds), r }, "triple");
    if (lostIds.length) say(g, "31.lost", { names: namesOf(g, lostIds) });
    else say(g, "31.noLoss");
  } else if (!lostIds.length) {
    say(g, "31.tie", {}, "end");
  } else {
    const top = reveal.find(r => r.id === winnerIds[0]);
    const low = reveal.find(r => r.id === lostIds[0]);
    say(g, "31.round", { names: namesOf(g, winnerIds), top: top.score, lost: namesOf(g, lostIds), low: low.score }, "end");
  }

  if (aliveOf(g).length <= 1) return endGame(g);
  g.phase = "roundEnd";
}

function endGame(g) {
  const live = aliveOf(g);
  g.phase = "gameOver";
  g.turnIndex = -1;
  g.winnerId = live.length === 1 ? live[0].id : null;
  if (g.winnerId) say(g, "31.champ", { name: live[0].name }, "fanfare");
  else say(g, "31.allOut", {}, "lose");
}

export function publicView(g) {
  const turn = g.turnIndex >= 0 ? g.players[g.turnIndex] : null;
  return {
    round: g.round,
    phase: g.phase,
    turnId: g.phase === "playing" && turn ? turn.id : null,
    step: g.step,
    lockBy: g.lockBy,
    discardTop: g.discard.length ? g.discard[g.discard.length - 1] : null,
    deckCount: g.deck.length,
    result: g.result,
    winnerId: g.winnerId,
    log: [...g.log],
    fx: [...(g.fx || [])],
    players: g.players.map(p => ({ id: p.id, name: p.name, isAI: p.isAI, lives: p.lives })),
  };
}

export function privateView(g, playerId) {
  const p = g.players.find(x => x.id === playerId);
  return p ? { hand: p.hand } : null;
}

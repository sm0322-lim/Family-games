export const TARGET = 31;
export const START_LIVES = 3;

export const sum = cards => cards.reduce((s, c) => s + c, 0);

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function newDeck() {
  const deck = [];
  for (let v = 1; v <= 10; v++) for (let k = 0; k < 4; k++) deck.push(v);
  return shuffle(deck);
}

export function newGame(players) {
  return {
    round: 0,
    phase: "playing",          // playing | roundEnd | gameOver
    message: "",
    winnerId: null,
    result: null,
    deck: [],
    turnIndex: -1,
    players: players.map(p => ({
      id: p.id,
      name: p.name,
      isAI: !!p.isAI,
      lives: START_LIVES,
      hand: [],
      status: "out",           // active | stood | bust | out
    })),
  };
}

const aliveOf = g => g.players.filter(p => p.lives > 0);
const byId = (g, id) => g.players.find(p => p.id === id);

export function startRound(g) {
  const live = aliveOf(g);
  if (live.length <= 1) return endGame(g);

  g.round += 1;
  g.result = null;
  g.deck = newDeck();
  g.players.forEach(p => {
    p.hand = [];
    p.status = p.lives > 0 ? "active" : "out";
  });
  live.forEach(p => {
    for (let i = 0; i < 3; i++) p.hand.push(g.deck.pop());
  });
  g.turnIndex = g.players.findIndex(p => p.status === "active");
  g.phase = "playing";
  g.message = `${g.round}라운드 시작! 카드 3장씩 받았어요`;
  return g;
}

// type: "draw" | "stand"
export function act(g, playerId, type) {
  if (g.phase !== "playing") return g;
  const p = g.players[g.turnIndex];
  if (!p || p.id !== playerId || p.status !== "active") return g;

  if (type === "draw") {
    if (!g.deck.length) g.deck = newDeck();
    p.hand.push(g.deck.pop());
    const s = sum(p.hand);
    if (s === TARGET) {
      p.status = "stood";
      return finishRound(g, p.id);   // 정확히 31이면 즉시 승리
    }
    if (s > TARGET) p.status = "bust";
  } else if (type === "stand") {
    p.status = "stood";
  } else {
    return g;
  }
  return advance(g);
}

function advance(g) {
  const n = g.players.length;
  for (let step = 1; step <= n; step++) {
    const i = (g.turnIndex + step) % n;
    if (g.players[i].status === "active") {
      g.turnIndex = i;
      return g;
    }
  }
  return finishRound(g, null);      // 더 이상 진행할 사람이 없음
}

function finishRound(g, winnerId) {
  const live = aliveOf(g);
  const lost = [];

  if (winnerId) {
    live.forEach(p => { if (p.id !== winnerId) lost.push(p.id); });
  } else {
    live.forEach(p => { if (p.status === "bust") lost.push(p.id); });
    const safe = live.filter(p => p.status === "stood");
    if (safe.length) {
      const min = Math.min(...safe.map(p => sum(p.hand)));
      safe.forEach(p => { if (sum(p.hand) === min) lost.push(p.id); });
    }
  }

  const reveal = live.map(p => ({
    id: p.id,
    name: p.name,
    hand: [...p.hand],
    sum: sum(p.hand),
    status: p.status,
  }));

  live.forEach(p => { if (lost.includes(p.id)) p.lives -= 1; });
  g.players.forEach(p => { if (p.lives <= 0) p.status = "out"; });

  g.result = { winnerId: winnerId || null, lostIds: lost, reveal };
  g.turnIndex = -1;

  if (winnerId) {
    g.message = `${byId(g, winnerId).name} 정확히 31! 나머지 목숨 -1`;
  } else if (lost.length) {
    g.message = `이번 라운드 목숨 -1: ${lost.map(id => byId(g, id).name).join(", ")}`;
  } else {
    g.message = "이번 라운드 목숨 손실 없음";
  }

  if (aliveOf(g).length <= 1) return endGame(g);
  g.phase = "roundEnd";
  return g;
}

function endGame(g) {
  const live = aliveOf(g);
  g.phase = "gameOver";
  g.winnerId = live.length === 1 ? live[0].id : null;
  g.turnIndex = -1;
  g.message = g.winnerId
    ? `${byId(g, g.winnerId).name} 최종 우승!`
    : "모두 탈락! 무승부예요";
  return g;
}

// 화면에 보여도 되는 공개 정보만 (손패 제외)
export function publicView(g) {
  const turn = g.turnIndex >= 0 ? g.players[g.turnIndex] : null;
  return {
    round: g.round,
    phase: g.phase,
    message: g.message,
    turnId: turn ? turn.id : null,
    winnerId: g.winnerId,
    result: g.result,
    players: g.players.map(p => ({
      id: p.id,
      name: p.name,
      isAI: p.isAI,
      lives: p.lives,
      status: p.status,
    })),
  };
}

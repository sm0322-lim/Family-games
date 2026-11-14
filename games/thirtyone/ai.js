import { score, bestKeep } from "./engine.js";

// 컴퓨터는 자기 손패와 바닥 카드만 보고 판단해요
export function decide(g, playerId) {
  const p = g.players.find(x => x.id === playerId);
  if (!p) return null;

  if (g.step === "discard") return { type: "discard", index: bestKeep(p.hand).index };

  const s = score(p.hand);
  const alive = g.players.filter(x => x.lives > 0).length;
  const laps = Math.floor(g.turnCount / alive);
  // 처음에는 30점 이상일 때만 Lock, 바퀴가 돌수록 기준을 낮춤
  const threshold = Math.max(22, 30 - laps * 2) - (Math.random() < 0.3 ? 1 : 0);
  if (!g.lockBy && s >= threshold) return { type: "lock" };

  const top = g.discard[g.discard.length - 1];
  if (top && bestKeep([...p.hand, top]).score > s) return { type: "drawDiscard" };
  return { type: "drawDeck" };
}

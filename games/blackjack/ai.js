import { handValue, canDouble, BETS } from "./engine.js";

export function decide(g, playerId) {
  const p = g.players.find(x => x.id === playerId);
  if (!p) return null;

  if (g.phase === "bet") {
    const r = Math.random();
    let amount = 10;
    if (p.chips >= 150 && r < 0.3) amount = 50;
    else if (p.chips >= 60 && r < 0.5) amount = 20;
    if (!BETS.includes(amount) || amount > p.chips) amount = BETS[0];
    return { type: "bet", amount };
  }

  // 기본 전략을 단순하게 만든 판단
  const { total, soft } = handValue(p.hand);
  const up = g.dealer[0];
  const u = up ? (up.r === 1 ? 11 : Math.min(up.r, 10)) : 10;

  if (canDouble(p) && !soft && (total === 11 || (total === 10 && u <= 9))) return { type: "double" };
  if (soft) return { type: total <= 17 ? "hit" : "stand" };
  if (total <= 11) return { type: "hit" };
  if (total >= 17) return { type: "stand" };
  if (u >= 7) return { type: "hit" };
  if (total === 12 && u <= 3) return { type: "hit" };
  return { type: "stand" };
}

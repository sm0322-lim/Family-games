import { sum, TARGET } from "./engine.js";

// 다음 카드 한 장이 31을 넘게 만들 확률 (1~10 균등 가정)
function bustChance(s) {
  return Math.min(1, Math.max(0, (s - (TARGET - 10)) / 10));
}

// 반환값: "draw" | "stand"
export function decide(hand, lives) {
  const s = sum(hand);
  if (s <= 14) return "draw";

  // 목숨이 많을수록 공격적, 적을수록 조심스럽게
  const limit = lives >= 3 ? 0.5 : lives === 2 ? 0.35 : 0.2;
  const noise = (Math.random() - 0.5) * 0.1;
  return bustChance(s) < limit + noise ? "draw" : "stand";
}

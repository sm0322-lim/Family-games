import { fiveFruit } from "./engine.js";

// 컴퓨터 차례: 카드 뒤집기
export const decide = () => ({ type: "flip" });

// 반응 속도 (밀리초)
const SPEED = {
  easy:   [1300, 2300],
  normal: [800, 1500],
  hard:   [500, 950],
};
const rand = ([a, b]) => a + Math.random() * (b - a);

// 판이 바뀔 때마다: 5개가 보이면 컴퓨터가 종을 치려고 해요. 가끔은 실수로 잘못 치기도 해요
export function reactions(g) {
  if (g.phase !== "playing") return [];
  const five = fiveFruit(g);
  const out = [];
  g.players.forEach(p => {
    if (!p.isAI || p.deck.length + p.pile.length === 0) return;
    const speed = SPEED[p.level] || SPEED.normal;
    if (five) out.push({ pid: p.id, action: { type: "ring", ver: g.ver }, delay: rand(speed) });
    else if (Math.random() < (p.level === "easy" ? 0.04 : 0.02)) out.push({ pid: p.id, action: { type: "ring", ver: g.ver }, delay: rand([500, 900]) });
  });
  return out;
}

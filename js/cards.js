// 트럼프 카드 (♠♥♦♣, A~K) 공용 도구
export const SUITS = ["♠", "♥", "♦", "♣"];
export const isRed = s => s === "♥" || s === "♦";
export const rankLabel = r => ({ 1: "A", 11: "J", 12: "Q", 13: "K" }[r] || String(r));
export const cardLabel = c => `${c.s}${rankLabel(c.r)}`;

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function newDeck52() {
  const deck = [];
  for (const s of SUITS) for (let r = 1; r <= 13; r++) deck.push({ s, r });
  return shuffle(deck);
}

// 카드 앞면 HTML. tag를 "button"으로 주면 누를 수 있는 카드가 돼요
export function cardFace(c, { tag = "span", cls = "", attrs = "" } = {}) {
  const s = SUITS.includes(c?.s) ? c.s : "?";
  const r = Number.isInteger(c?.r) && c.r >= 1 && c.r <= 13 ? rankLabel(c.r) : "?";
  const type = tag === "button" ? ' type="button"' : "";
  return `<${tag}${type} class="pc ${isRed(s) ? "red" : ""} ${cls}" ${attrs}><b>${r}</b><i>${s}</i></${tag}>`;
}

export const cardBack = (cls = "") => `<span class="pc back ${cls}"></span>`;

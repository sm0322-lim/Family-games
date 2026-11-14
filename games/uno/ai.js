import { canPlay, COLORS } from "./engine.js";

export function decide(g, playerId) {
  const me = g.players.findIndex(x => x.id === playerId);
  const p = g.players[me];
  if (!p) return null;
  const n = g.players.length;
  const next = g.players[(((me + g.dir) % n) + n) % n];
  const top = g.discard[g.discard.length - 1];

  let options = p.hand.map((_, i) => i).filter(i => canPlay(p.hand[i], top, g.color));
  if (g.pendingDraw) options = options.filter(i => i === p.hand.length - 1);
  if (!options.length) return { type: g.pendingDraw ? "pass" : "draw" };

  const colorCount = { R: 0, Y: 0, G: 0, B: 0 };
  p.hand.forEach(c => { if (c.c !== "W") colorCount[c.c]++; });
  const danger = next.hand.length <= 2;   // 다음 사람이 곧 이길 것 같음

  const rate = i => {
    const c = p.hand[i];
    let s;
    if (c.c === "W") s = c.v === "+4" ? (danger ? 6 : -2) : (danger ? 3 : -1);   // 와일드는 아껴 두기
    else {
      s = 2 + colorCount[c.c] * 0.5;
      if (c.v === "skip" || c.v === "rev" || c.v === "+2") s += danger ? 3 : 0.5;
    }
    return s + Math.random() * 0.3;
  };
  const index = options.reduce((a, b) => (rate(b) > rate(a) ? b : a));

  let color;
  if (p.hand[index].c === "W") {
    const rest = p.hand.filter((_, j) => j !== index && p.hand[j].c !== "W");
    const counts = { R: 0, Y: 0, G: 0, B: 0 };
    rest.forEach(c => counts[c.c]++);
    color = COLORS.reduce((a, b) => (counts[b] > counts[a] ? b : a));
    if (!rest.length) color = COLORS[Math.floor(Math.random() * 4)];
  }
  return color ? { type: "play", index, color } : { type: "play", index };
}

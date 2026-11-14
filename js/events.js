// 게임 진행 기록 + 효과음 신호
// 엔진이 say(g, "문장", "소리이름")을 부르면 기록이 쌓이고,
// 모든 폰이 같은 순간에 같은 효과음을 내요 (온라인 포함).
export function say(g, text, sound) {
  g.log = g.log || [];
  g.log.push(text);
  if (g.log.length > 6) g.log.shift();
  if (sound) {
    g.fx = g.fx || [];
    g.fxSeq = (g.fxSeq || Date.now()) + 1;   // 새 게임일수록 번호가 커서 다시 하기에도 소리가 나요
    g.fx.push({ n: g.fxSeq, s: sound });
    if (g.fx.length > 4) g.fx.shift();
  }
}

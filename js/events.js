// 게임 진행 기록 + 효과음 신호
// 엔진은 문장 대신 { k: 문장 키, v: 값 } 을 기록해요.
// 그래서 온라인에서 방장과 참가자의 언어가 달라도 각자 자기 언어로 보여요.
export function say(g, k, v = {}, sound) {
  g.log = g.log || [];
  g.log.push({ k, v });
  if (g.log.length > 6) g.log.shift();
  if (sound) fx(g, sound);
}

// 기록 없이 소리만
export function fx(g, sound) {
  g.fx = g.fx || [];
  g.fxSeq = (g.fxSeq || Date.now()) + 1;   // 새 게임일수록 번호가 커서 다시 하기에도 소리가 나요
  g.fx.push({ n: g.fxSeq, s: sound });
  if (g.fx.length > 4) g.fx.shift();
}

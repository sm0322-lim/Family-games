// 효과음: 파일 없이 브라우저에서 직접 소리를 만들어요 (Web Audio)
let ctx = null;
let muted = false;
try { muted = localStorage.getItem("fg-muted") === "1"; } catch (e) { /* 저장 불가 시 무시 */ }

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

// 브라우저는 화면을 한 번 터치해야 소리를 낼 수 있어서, 터치할 때마다 깨워 둬요
export const unlock = () => { if (!muted) audio(); };

function tone(freq, start, dur, { type = "sine", vol = 0.15, to = null } = {}) {
  const t0 = ctx.currentTime + start;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function noise(start, dur, { vol = 0.25, freq = 2500 } = {}) {
  const t0 = ctx.currentTime + start;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const g = ctx.createGain();
  src.buffer = buf;
  filter.type = "bandpass";
  filter.frequency.value = freq;
  g.gain.value = vol;
  src.connect(filter).connect(g).connect(ctx.destination);
  src.start(t0);
}

const SOUNDS = {
  flip:    () => noise(0, 0.08, { freq: 3200, vol: 0.35 }),                       // 카드 뽑기
  place:   () => { noise(0, 0.06, { freq: 1200, vol: 0.4 }); tone(170, 0, 0.09, { vol: 0.12 }); }, // 카드 내려놓기
  shuffle: () => { for (let i = 0; i < 7; i++) noise(i * 0.055, 0.05, { freq: 2200 + i * 250, vol: 0.22 }); },
  chip:    () => { tone(1800, 0, 0.07, { type: "triangle", vol: 0.12 }); tone(2500, 0.05, 0.1, { type: "triangle", vol: 0.1 }); },
  lock:    () => { tone(220, 0, 0.14, { type: "square", vol: 0.08 }); tone(147, 0.15, 0.3, { type: "square", vol: 0.08 }); },
  special: () => tone(300, 0, 0.25, { type: "sawtooth", vol: 0.07, to: 1200 }),
  uno:     () => { tone(1320, 0, 0.14, { vol: 0.18 }); tone(1760, 0.14, 0.28, { vol: 0.18 }); },
  bust:    () => tone(220, 0, 0.45, { type: "sawtooth", vol: 0.08, to: 55 }),
  turn:    () => { tone(880, 0, 0.12, { vol: 0.12 }); tone(1175, 0.1, 0.2, { vol: 0.12 }); },
  end:     () => [523, 659, 784].forEach((f, i) => tone(f, i * 0.1, 0.28, { type: "triangle", vol: 0.14 })),
  fanfare: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.13, i === 3 ? 0.6 : 0.2, { type: "triangle", vol: 0.16 })),
  triple:  () => [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(f, i * 0.07, 0.3, { type: "square", vol: 0.07 })),
  bell:    () => { tone(1568, 0, 0.9, { vol: 0.2 }); tone(2093, 0, 0.6, { vol: 0.1 }); tone(3136, 0, 0.3, { vol: 0.05 }); }, // 할리갈리 종
  lose:    () => { tone(392, 0, 0.2, { type: "triangle", vol: 0.14 }); tone(311, 0.2, 0.4, { type: "triangle", vol: 0.14 }); },
};

export function play(name) {
  if (muted || !SOUNDS[name]) return;
  if (name === "turn" && navigator.vibrate) { try { navigator.vibrate(60); } catch (e) { /* 무시 */ } }
  if (!audio()) return;
  try { SOUNDS[name](); } catch (e) { /* 소리 실패는 게임에 영향 없음 */ }
}

export const isMuted = () => muted;

export function setMuted(value) {
  muted = !!value;
  try { localStorage.setItem("fg-muted", muted ? "1" : "0"); } catch (e) { /* 무시 */ }
}

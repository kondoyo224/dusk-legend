// WebAudio 합성 기본 부품: 오실레이터/노이즈 + 엔벨로프 + 필터. 모든 함수는 (eng, dest, t, ...) 형태로 예약 재생.
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 엔벨로프: a(어택) → peak → d 동안 sustain 레벨로 → 끝에서 r(릴리즈)
export function envGain(ctx, t, { peak = 1, a = 0.005, d = 0.1, s = 0, dur = 0.2, r = 0.05 } = {}) {
  const g = ctx.createGain();
  const p = g.gain;
  p.setValueAtTime(0.0001, t);
  p.linearRampToValueAtTime(peak, t + a);
  if (s > 0) {
    p.exponentialRampToValueAtTime(Math.max(0.0001, peak * s), t + a + d);
    p.setValueAtTime(Math.max(0.0001, peak * s), t + Math.max(a + d, dur));
    p.exponentialRampToValueAtTime(0.0001, t + Math.max(a + d, dur) + r);
  } else {
    p.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  return g;
}

// 단일 톤. opts: type, f, f2(끝 주파수), slide(초), dur, gain, a, d, s, r, detune, filter{type,f,f2,q}, vib{rate,depth}
export function tone(eng, dest, t, o) {
  const ctx = eng.ctx;
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.f, t);
  if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t + (o.slide ?? o.dur ?? 0.2));
  if (o.detune) osc.detune.setValueAtTime(o.detune, t);
  const total = (o.s ? Math.max((o.a ?? 0.005) + (o.d ?? 0.1), o.dur ?? 0.2) + (o.r ?? 0.05) : (o.a ?? 0.005) + (o.d ?? 0.1)) + 0.05;
  const g = envGain(ctx, t, { peak: o.gain ?? 0.3, a: o.a, d: o.d ?? (o.s ? 0.1 : o.dur ?? 0.2), s: o.s, dur: o.dur, r: o.r });
  let node = osc;
  if (o.vib) {
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = o.vib.rate ?? 5; lg.gain.value = o.vib.depth ?? 4;
    lfo.connect(lg); lg.connect(osc.detune);
    lfo.start(t); lfo.stop(t + total);
  }
  if (o.filter) node = chainFilter(ctx, node, t, o.filter, total);
  node.connect(g); g.connect(dest);
  osc.start(t); osc.stop(t + total);
  return osc;
}

export function noise(eng, dest, t, o) {
  const ctx = eng.ctx;
  const src = ctx.createBufferSource();
  src.buffer = eng.noiseBuf;
  src.loop = true;
  const total = (o.s ? Math.max((o.a ?? 0.005) + (o.d ?? 0.1), o.dur ?? 0.2) + (o.r ?? 0.05) : (o.a ?? 0.005) + (o.d ?? 0.1)) + 0.05;
  const g = envGain(ctx, t, { peak: o.gain ?? 0.3, a: o.a, d: o.d ?? (o.s ? 0.1 : o.dur ?? 0.2), s: o.s, dur: o.dur, r: o.r });
  let node = src;
  if (o.filter) node = chainFilter(ctx, node, t, o.filter, total);
  node.connect(g); g.connect(dest);
  src.start(t, Math.random() * 1.5); src.stop(t + total);
  return src;
}

function chainFilter(ctx, node, t, f, total) {
  const bq = ctx.createBiquadFilter();
  bq.type = f.type ?? 'lowpass';
  bq.frequency.setValueAtTime(f.f ?? 1000, t);
  if (f.f2) bq.frequency.exponentialRampToValueAtTime(Math.max(20, f.f2), t + (f.t ?? total));
  bq.Q.value = f.q ?? 0.7;
  node.connect(bq);
  return bq;
}

// 잔향 임펄스 (지수 감쇠 노이즈)
export function makeImpulse(ctx, sec = 2.6, decay = 2.8) {
  const len = Math.floor(ctx.sampleRate * sec);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}
export function makeNoise(ctx) {
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

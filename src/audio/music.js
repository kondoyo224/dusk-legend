// BGM: 트랙 정의(음계·화성 진행·패턴) → 시드 기반 선율 생성 → 16분음표 단위 선행 예약(lookahead) 스케줄러. 트랙 전환은 크로스페이드.
import { tone, noise, mtof } from './synth.js';

const S = {
  ionian: [0, 2, 4, 5, 7, 9, 11], aeolian: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11], harmonic: [0, 2, 3, 5, 7, 8, 11], locrian: [0, 1, 3, 5, 6, 8, 10],
};

// pad/arp/mel: 악기 이름, bass/kick/snare/hat/tom: 16스텝 패턴, dens: 선율 밀도(0~1), drone: 지속 저음
export const TRACKS = {
  title:     { bpm: 66, root: 50, scale: S.aeolian, prog: [0, 5, 3, 4, 0, 5, 6, 4], pad: 'choir', arp: 'harp', arpPat: 'x...x...x...x...', bass: 'x...............', mel: 'bell', dens: 0.3, vol: 0.9 },
  limbo:     { bpm: 58, root: 52, scale: S.phrygian, prog: [0, 1, 0, 6], pad: 'pad', mel: 'bell', dens: 0.22, drone: true, bass: '', vol: 0.85 },
  altar:     { bpm: 60, root: 53, scale: S.lydian, prog: [0, 1, 4, 0, 3, 1, 4, 4], pad: 'organ', mel: 'flute', dens: 0.35, bass: 'x...............', vol: 0.8 },
  village:   { bpm: 100, root: 55, scale: S.ionian, prog: [0, 3, 4, 0, 5, 3, 4, 4], pad: 'pad', arp: 'pluck', arpPat: 'x.x.x.x.x.x.x.x.', bass: 'x.......x...x...', mel: 'flute', dens: 0.55, kick: 'x.......x.......', hat: '..x...x...x...x.', vol: 0.75 },
  cellar:    { bpm: 92, root: 45, scale: S.aeolian, prog: [0, 0, 5, 4], arp: 'pluck', arpPat: 'x..x..x.x..x..x.', bass: 'x.x...x.x.x...x.', mel: 'lead', dens: 0.3, hat: '..x...x...x...x.', vol: 0.7 },
  forest:    { bpm: 84, root: 52, scale: S.dorian, prog: [0, 3, 0, 6, 0, 3, 4, 0], pad: 'pad', arp: 'harp', arpPat: 'x.x.x.x.x.x.x.x.', bass: 'x.......x.......', mel: 'flute', dens: 0.45, kick: 'x.......x.......', hat: '..x...x...x...x.', vol: 0.75 },
  graveyard: { bpm: 70, root: 48, scale: S.harmonic, prog: [0, 5, 3, 4], pad: 'organ', mel: 'bell', dens: 0.3, bass: 'x.......x.......', toll: true, vol: 0.8 },
  crypt:     { bpm: 60, root: 50, scale: S.phrygian, prog: [0, 1, 0, 1], pad: 'pad', mel: 'bell', dens: 0.14, drone: true, tom: 'x...............', vol: 0.85 },
  tower:     { bpm: 96, root: 54, scale: S.aeolian, prog: [0, 0, 5, 6, 0, 0, 3, 4], pad: 'choir', bass: 'x.x.x.x.x.x.x.x.', mel: 'lead', dens: 0.4, kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', vol: 0.7 },
  boss:      { bpm: 140, root: 48, scale: S.harmonic, prog: [0, 0, 5, 4, 0, 0, 6, 4], pad: 'pad', bass: 'x.xxx.xxx.xxx.xx', mel: 'lead', dens: 0.7, kick: 'x..x..x.x..x..x.', snare: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx', vol: 0.65 },
  final:     { bpm: 152, root: 50, scale: S.harmonic, prog: [0, 5, 1, 4, 0, 5, 6, 4], pad: 'choir', bass: 'x.x.xxx.x.x.xxx.', mel: 'lead', dens: 0.75, kick: 'x...x...x...x.x.', snare: '....x.......x...', hat: 'x.xxx.xxx.xxx.xx', tom: '..............xx', vol: 0.65 },
  ending:    { bpm: 72, root: 48, scale: S.ionian, prog: [0, 4, 5, 3, 0, 4, 3, 4], pad: 'choir', arp: 'harp', arpPat: 'x.x.x.x.x.x.x.x.', bass: 'x.......x.......', mel: 'flute', dens: 0.45, vol: 0.85 },
  rift:      { bpm: 76, root: 47, scale: S.locrian, prog: [0, 1, 4, 0], pad: 'pad', mel: 'bell', dens: 0.3, drone: true, tom: 'x.......x.......', vol: 0.8 },
};

// ── 악기 ──
const INST = {
  pad(e, d, t, f, dur, v) {
    for (const det of [-8, 8]) tone(e, d, t, { type: 'sawtooth', f, detune: det, dur, gain: 0.035 * v, a: 0.7, s: 0.9, d: 0.3, r: 1.2, filter: { f: 900, q: 0.5 } });
  },
  organ(e, d, t, f, dur, v) {
    [[1, 0.05], [2, 0.03], [3, 0.012], [4, 0.01]].forEach(([h, g]) => tone(e, d, t, { type: 'sine', f: f * h, dur, gain: g * v, a: 0.06, s: 0.85, d: 0.2, r: 0.5 }));
  },
  choir(e, d, t, f, dur, v) {
    for (const det of [-6, 5]) tone(e, d, t, { type: 'sawtooth', f, detune: det, dur, gain: 0.04 * v, a: 0.6, s: 0.9, d: 0.3, r: 1, filter: { type: 'bandpass', f: 750, q: 1.6 }, vib: { rate: 4.6, depth: 9 } });
  },
  harp(e, d, t, f, dur, v) {
    tone(e, d, t, { type: 'triangle', f, gain: 0.07 * v, a: 0.003, d: 1.1 });
    tone(e, d, t, { type: 'sine', f: f * 2, gain: 0.02 * v, a: 0.003, d: 0.5 });
  },
  pluck(e, d, t, f, dur, v) {
    tone(e, d, t, { type: 'triangle', f, gain: 0.08 * v, a: 0.002, d: 0.35, filter: { f: 2400, f2: 500, t: 0.3 } });
  },
  bell(e, d, t, f, dur, v) {
    tone(e, d, t, { type: 'sine', f, gain: 0.06 * v, a: 0.003, d: 2.4 });
    tone(e, d, t, { type: 'sine', f: f * 2.76, gain: 0.02 * v, a: 0.003, d: 1.1 });
    tone(e, d, t, { type: 'sine', f: f * 5.4, gain: 0.008 * v, a: 0.003, d: 0.5 });
  },
  flute(e, d, t, f, dur, v) {
    tone(e, d, t, { type: 'sine', f, dur: dur * 0.9, gain: 0.07 * v, a: 0.06, s: 0.8, d: 0.1, r: 0.18, vib: { rate: 5.2, depth: 7 } });
    tone(e, d, t, { type: 'triangle', f: f * 2, dur: dur * 0.9, gain: 0.01 * v, a: 0.06, s: 0.8, d: 0.1, r: 0.18 });
    noise(e, d, t, { gain: 0.006 * v, a: 0.04, d: 0.12, filter: { type: 'bandpass', f: f * 2, q: 4 } });
  },
  lead(e, d, t, f, dur, v) {
    tone(e, d, t, { type: 'square', f, dur: dur * 0.85, gain: 0.028 * v, a: 0.01, s: 0.7, d: 0.1, r: 0.12, filter: { f: 2200 }, vib: { rate: 5.5, depth: 6 } });
    tone(e, d, t, { type: 'sawtooth', f: f / 2, dur: dur * 0.85, gain: 0.012 * v, a: 0.01, s: 0.7, d: 0.1, r: 0.12, filter: { f: 1200 } });
  },
  bass(e, d, t, f, dur, v) {
    tone(e, d, t, { type: 'triangle', f, dur, gain: 0.13 * v, a: 0.005, s: 0.6, d: 0.12, r: 0.08, filter: { f: 600 } });
    tone(e, d, t, { type: 'sine', f: f / 2, dur, gain: 0.08 * v, a: 0.005, s: 0.6, d: 0.12, r: 0.08 });
  },
  kick(e, d, t, v) { tone(e, d, t, { type: 'sine', f: 130, f2: 42, slide: 0.12, gain: 0.32 * v, a: 0.002, d: 0.26 }); },
  snare(e, d, t, v) {
    noise(e, d, t, { gain: 0.12 * v, d: 0.16, filter: { type: 'highpass', f: 1400 } });
    tone(e, d, t, { type: 'triangle', f: 190, f2: 120, gain: 0.08 * v, d: 0.09 });
  },
  hat(e, d, t, v) { noise(e, d, t, { gain: 0.03 * v, d: 0.035, filter: { type: 'highpass', f: 7500 } }); },
  tom(e, d, t, v) { tone(e, d, t, { type: 'sine', f: 120, f2: 60, slide: 0.3, gain: 0.25 * v, d: 0.45 }); },
};

function seeded(str) {
  let h = 2166136261;
  for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => { h += 0x6d2b79f5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// 트랙 컴파일: 마디별 화음 + 선율 이벤트(스텝, 음, 길이)
function compile(id, def) {
  const rnd = seeded(id);
  const sc = def.scale;
  const deg2m = (deg, oct = 0) => def.root + sc[((deg % 7) + 7) % 7] + 12 * (Math.floor(deg / 7) + oct);
  const bars = def.prog.length * 2;
  const mel = [];
  if (def.mel && def.dens > 0) {
    const half = [];
    let deg = 7 + Math.floor(rnd() * 3);
    for (let b = 0; b < def.prog.length; b++) {
      const ch = def.prog[b];
      for (let s8 = 0; s8 < 8; s8++) {
        const strong = s8 % 4 === 0;
        if (rnd() > def.dens * (strong ? 1.5 : 0.8)) continue;
        if (strong) { // 강박엔 화음 구성음 쪽으로
          const tones = [ch, ch + 2, ch + 4].map((x) => x + 7);
          deg = tones.reduce((a, c) => (Math.abs(c - deg) < Math.abs(a - deg) ? c : a), tones[0]);
        } else deg += [-2, -1, -1, 1, 1, 2][Math.floor(rnd() * 6)];
        deg = Math.max(4, Math.min(14, deg));
        half.push({ step: b * 16 + s8 * 2, deg });
      }
    }
    for (let i = 0; i < half.length; i++) {
      const n = half[i], nx = half[i + 1];
      n.len = Math.min(8, (nx ? nx.step : def.prog.length * 16) - n.step);
    }
    // 두 번째 절반: 반복 + 끝부분 변주(종지음은 으뜸음)
    const second = half.map((n) => ({ ...n, step: n.step + def.prog.length * 16 }));
    if (second.length) { second[second.length - 1].deg = 7; }
    for (const n of [...half, ...second]) mel.push({ ...n, m: deg2m(n.deg) });
  }
  return { def, bars, mel, deg2m, steps: bars * 16 };
}

export class Music {
  constructor(eng) { this.eng = eng; this.cur = null; this.cache = {}; }

  play(id) {
    const e = this.eng, ctx = e.ctx;
    if (!ctx) return;
    if (this.cur?.id === id) return;
    const def = TRACKS[id];
    this.stop(1.6);
    if (!def) return;
    const tr = this.cache[id] ??= compile(id, def);
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, ctx.currentTime);
    out.gain.linearRampToValueAtTime(def.vol ?? 0.8, ctx.currentTime + 1.6);
    out.connect(e.bgm);
    const send = ctx.createGain(); send.gain.value = 0.45;
    out.connect(send); send.connect(e.revIn);
    this.cur = { id, tr, out, step: 0, next: ctx.currentTime + 0.15, sdur: 60 / def.bpm / 4, drones: [] };
  }

  stop(fade = 1.2) {
    const c = this.cur, ctx = this.eng.ctx;
    if (!c || !ctx) { this.cur = null; return; }
    const now = ctx.currentTime;
    c.out.gain.cancelScheduledValues(now);
    c.out.gain.setValueAtTime(c.out.gain.value, now);
    c.out.gain.linearRampToValueAtTime(0.0001, now + fade);
    setTimeout(() => { try { c.out.disconnect(); } catch { /* 이미 해제 */ } }, (fade + 3) * 1000);
    this.cur = null;
  }

  tick() {
    const c = this.cur, ctx = this.eng.ctx;
    if (!c || !ctx) return;
    if (c.next < ctx.currentTime - 1) c.next = ctx.currentTime + 0.05; // 탭이 멈췄다 돌아온 경우
    while (c.next < ctx.currentTime + 0.25) {
      this.schedule(c, c.step % c.tr.steps, c.next);
      c.next += c.sdur;
      c.step++;
    }
  }

  schedule(c, step, t) {
    const e = this.eng, d = c.out, tr = c.tr, def = tr.def;
    const bar = Math.floor(step / 16), s = step % 16;
    const deg = def.prog[bar % def.prog.length];
    const barDur = c.sdur * 16;
    if (s === 0) {
      if (def.pad) [deg, deg + 2, deg + 4].forEach((x) => INST[def.pad](e, d, t, mtof(tr.deg2m(x)), barDur * 0.98, 1));
      if (def.drone && bar % 4 === 0) {
        tone(e, d, t, { type: 'sawtooth', f: mtof(def.root - 12), dur: barDur * 4, gain: 0.04, a: 2, s: 1, d: 0.1, r: 2, filter: { f: 260 } });
        tone(e, d, t, { type: 'sawtooth', f: mtof(def.root - 5), detune: 6, dur: barDur * 4, gain: 0.025, a: 2, s: 1, d: 0.1, r: 2, filter: { f: 300 } });
      }
      if (def.toll && bar % 2 === 0) INST.bell(e, e.revIn, t, mtof(def.root - 12), 3, 1.4);
    }
    if (def.bass?.[s] === 'x') INST.bass(e, d, t, mtof(tr.deg2m(deg, -1)), c.sdur * (def.bass[s + 1] === 'x' ? 0.9 : 1.8), 1);
    if (def.arp && def.arpPat?.[s] === 'x') {
      const seq = [deg, deg + 2, deg + 4, deg + 7, deg + 4, deg + 2];
      const k = Math.floor(step / 2) % seq.length;
      INST[def.arp](e, d, t, mtof(tr.deg2m(seq[k])), c.sdur * 2, 1);
    }
    for (const n of tr.mel) if (n.step === step) INST[def.mel](e, d, t, mtof(n.m), n.len * c.sdur, 1);
    if (def.kick?.[s] === 'x') INST.kick(e, d, t, 1);
    if (def.snare?.[s] === 'x') INST.snare(e, d, t, 1);
    if (def.hat?.[s] === 'x') INST.hat(e, d, t, s % 4 === 0 ? 1 : 0.6);
    if (def.tom?.[s] === 'x') INST.tom(e, d, t, 1);
  }
}

// 효과음 절차 합성. id 목록: docs/ARCHITECTURE.md §9 (+ 내부용 step).
import { tone, noise, mtof } from './synth.js';

const rnd = (a, b) => a + Math.random() * (b - a);

export const SFX = {
  // 발걸음: 낮은 툭 소리 (흙/돌 질감), 혼 상태면 아주 작게
  step(e, t, o) {
    const d = e.sfx;
    const v = o.ghost ? 0.03 : 0.09;
    noise(e, d, t, { gain: v, d: 0.07, filter: { type: 'lowpass', f: rnd(500, 900), q: 1.2 } });
    tone(e, d, t, { type: 'sine', f: rnd(85, 110), f2: 50, dur: 0.06, gain: v * 0.8, d: 0.06 });
  },
  swing(e, t) {
    noise(e, e.sfx, t, { gain: 0.22, a: 0.02, d: 0.16, filter: { type: 'bandpass', f: 600, f2: 3200, q: 1.4, t: 0.16 } });
  },
  hit(e, t) {
    const d = e.sfx;
    noise(e, d, t, { gain: 0.35, d: 0.09, filter: { type: 'lowpass', f: 2600, f2: 400 } });
    tone(e, d, t, { type: 'triangle', f: rnd(150, 190), f2: 60, dur: 0.12, gain: 0.35, d: 0.12 });
    tone(e, d, t, { type: 'square', f: rnd(900, 1200), f2: 300, dur: 0.03, gain: 0.05, d: 0.03 });
  },
  poison(e, t) {
    tone(e, e.sfx, t, { type: 'sine', f: 520, f2: 260, dur: 0.08, gain: 0.05, d: 0.1, filter: { type: 'bandpass', f: 800, q: 3 } });
  },
  crit(e, t) {
    SFX.hit(e, t);
    const d = e.sfx;
    tone(e, d, t, { type: 'sawtooth', f: 90, f2: 35, dur: 0.25, gain: 0.3, d: 0.25, filter: { f: 900 } });
    tone(e, e.rev, t + 0.01, { type: 'sine', f: 2400, f2: 1800, dur: 0.3, gain: 0.08, d: 0.3 });
    noise(e, d, t, { gain: 0.25, d: 0.22, filter: { type: 'highpass', f: 2500 } });
  },
  miss(e, t) {
    noise(e, e.sfx, t, { gain: 0.12, a: 0.01, d: 0.12, filter: { type: 'bandpass', f: 2000, f2: 900, q: 2 } });
  },
  hurt(e, t) {
    const d = e.sfx;
    tone(e, d, t, { type: 'sawtooth', f: 220, f2: 110, dur: 0.18, gain: 0.18, d: 0.18, filter: { f: 1200 } });
    noise(e, d, t, { gain: 0.25, d: 0.1, filter: { type: 'lowpass', f: 1500 } });
  },
  die_monster(e, t) {
    const d = e.sfx;
    tone(e, d, t, { type: 'sawtooth', f: 260, f2: 55, dur: 0.5, gain: 0.16, d: 0.5, filter: { f: 1400, f2: 200 } });
    noise(e, d, t + 0.05, { gain: 0.16, a: 0.03, d: 0.5, filter: { type: 'lowpass', f: 1200, f2: 150 } });
    tone(e, e.rev, t + 0.1, { type: 'sine', f: 880, f2: 1760, dur: 0.6, gain: 0.04, d: 0.6 });
  },
  die_player(e, t) {
    const notes = [62, 58, 55, 50];
    notes.forEach((m, i) => tone(e, e.rev, t + i * 0.35, { type: 'triangle', f: mtof(m), dur: 0.9, gain: 0.16, a: 0.02, d: 1.2, vib: { rate: 4, depth: 10 } }));
    tone(e, e.sfx, t, { type: 'sine', f: 70, f2: 40, dur: 1.6, gain: 0.3, d: 1.6 });
  },
  levelup(e, t) {
    [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => {
      tone(e, e.rev, t + i * 0.07, { type: 'triangle', f: mtof(m), dur: 0.5, gain: 0.13, d: 0.7 });
      tone(e, e.sfx, t + i * 0.07, { type: 'sine', f: mtof(m + 12), dur: 0.3, gain: 0.05, d: 0.4 });
    });
    noise(e, e.rev, t + 0.45, { gain: 0.08, a: 0.1, d: 1, filter: { type: 'highpass', f: 6000 } });
  },
  pickup(e, t) {
    tone(e, e.sfx, t, { type: 'triangle', f: 700, f2: 1400, dur: 0.08, gain: 0.16, d: 0.12 });
    tone(e, e.sfx, t + 0.06, { type: 'sine', f: 1400, dur: 0.1, gain: 0.08, d: 0.14 });
  },
  gold(e, t) {
    for (let i = 0; i < 3; i++) {
      const f = rnd(2600, 3800);
      tone(e, e.sfx, t + i * 0.045, { type: 'square', f, dur: 0.05, gain: 0.05, d: 0.09, filter: { type: 'highpass', f: 1500 } });
      tone(e, e.rev, t + i * 0.045, { type: 'sine', f: f * 1.5, dur: 0.1, gain: 0.04, d: 0.2 });
    }
  },
  potion(e, t) {
    for (let i = 0; i < 5; i++) tone(e, e.sfx, t + i * 0.06, { type: 'sine', f: rnd(400, 900), f2: rnd(900, 1600), slide: 0.05, dur: 0.05, gain: 0.1, d: 0.06 });
    tone(e, e.rev, t + 0.3, { type: 'triangle', f: mtof(76), dur: 0.4, gain: 0.07, d: 0.6 });
  },
  ui_click(e, t) {
    tone(e, e.sfx, t, { type: 'square', f: 1800, f2: 1200, dur: 0.02, gain: 0.04, d: 0.03, filter: { f: 3000 } });
    noise(e, e.sfx, t, { gain: 0.04, d: 0.02, filter: { type: 'highpass', f: 3000 } });
  },
  ui_open(e, t) {
    noise(e, e.sfx, t, { gain: 0.08, a: 0.03, d: 0.12, filter: { type: 'bandpass', f: 1200, f2: 2500, q: 1.5 } });
    tone(e, e.sfx, t, { type: 'triangle', f: 400, f2: 600, dur: 0.06, gain: 0.05, d: 0.08 });
  },
  portal(e, t) {
    tone(e, e.rev, t, { type: 'sine', f: 200, f2: 900, slide: 0.8, dur: 0.8, gain: 0.12, a: 0.2, d: 0.9, vib: { rate: 8, depth: 30 } });
    tone(e, e.rev, t, { type: 'triangle', f: 300, f2: 1350, slide: 0.8, dur: 0.8, gain: 0.07, a: 0.2, d: 0.9 });
    noise(e, e.rev, t, { gain: 0.08, a: 0.3, d: 0.8, filter: { type: 'bandpass', f: 800, f2: 4000, q: 3 } });
  },
  door(e, t) {
    tone(e, e.sfx, t, { type: 'sawtooth', f: 140, f2: 90, dur: 0.4, gain: 0.08, a: 0.05, d: 0.4, filter: { type: 'bandpass', f: 600, q: 6 }, vib: { rate: 18, depth: 40 } });
    noise(e, e.sfx, t + 0.35, { gain: 0.25, d: 0.15, filter: { type: 'lowpass', f: 500 } });
    tone(e, e.sfx, t + 0.35, { type: 'sine', f: 80, f2: 45, dur: 0.15, gain: 0.25, d: 0.15 });
  },
  page(e, t) {
    noise(e, e.sfx, t, { gain: 0.1, a: 0.05, d: 0.18, filter: { type: 'bandpass', f: 3000, f2: 1500, q: 0.8 } });
    noise(e, e.sfx, t + 0.14, { gain: 0.07, a: 0.02, d: 0.12, filter: { type: 'bandpass', f: 2200, q: 0.8 } });
    [69, 76, 81].forEach((m, i) => tone(e, e.rev, t + 0.1 + i * 0.12, { type: 'sine', f: mtof(m), dur: 0.8, gain: 0.05, d: 1.2 }));
  },
  quest(e, t) {
    [67, 72, 76, 79].forEach((m, i) => tone(e, e.rev, t + i * 0.1, { type: 'triangle', f: mtof(m), dur: 0.4, gain: 0.11, d: 0.6 }));
    tone(e, e.rev, t + 0.4, { type: 'sine', f: mtof(84), dur: 0.9, gain: 0.06, d: 1.2 });
  },
  skill_power(e, t) {
    tone(e, e.sfx, t, { type: 'sawtooth', f: 120, f2: 600, slide: 0.12, dur: 0.12, gain: 0.12, d: 0.14, filter: { f: 1800 } });
    SFX.crit(e, t + 0.1);
  },
  skill_whirl(e, t) {
    for (let i = 0; i < 3; i++) noise(e, e.sfx, t + i * 0.09, { gain: 0.2, a: 0.02, d: 0.14, filter: { type: 'bandpass', f: 500 + i * 400, f2: 3000, q: 1.5, t: 0.14 } });
    tone(e, e.sfx, t, { type: 'sine', f: 180, f2: 90, dur: 0.4, gain: 0.15, d: 0.4 });
  },
  skill_charge(e, t) {
    noise(e, e.sfx, t, { gain: 0.25, a: 0.05, d: 0.3, filter: { type: 'lowpass', f: 400, f2: 3000, t: 0.3 } });
    for (let i = 0; i < 4; i++) tone(e, e.sfx, t + i * 0.06, { type: 'sine', f: 90, f2: 50, dur: 0.06, gain: 0.25, d: 0.07 });
    SFX.hit(e, t + 0.3);
  },
  skill_cry(e, t) {
    tone(e, e.rev, t, { type: 'sawtooth', f: 160, f2: 240, slide: 0.3, dur: 0.6, gain: 0.14, a: 0.04, d: 0.7, filter: { type: 'bandpass', f: 900, q: 3 }, vib: { rate: 7, depth: 25 } });
    tone(e, e.rev, t, { type: 'sawtooth', f: 240, f2: 360, slide: 0.3, dur: 0.6, gain: 0.1, a: 0.04, d: 0.7, filter: { type: 'bandpass', f: 1400, q: 3 } });
    tone(e, e.sfx, t, { type: 'sine', f: 60, dur: 0.5, gain: 0.3, d: 0.5 });
  },
  skill_wall(e, t) {
    [0, 0.08].forEach((dt) => tone(e, e.rev, t + dt, { type: 'square', f: 330, dur: 0.5, gain: 0.05, d: 0.9, filter: { type: 'bandpass', f: 1600, q: 8 } }));
    tone(e, e.rev, t, { type: 'sine', f: 660, dur: 0.6, gain: 0.08, d: 1.1 });
    tone(e, e.sfx, t, { type: 'sine', f: 110, f2: 70, dur: 0.3, gain: 0.25, d: 0.3 });
  },
  skill_earth(e, t) {
    tone(e, e.sfx, t, { type: 'sine', f: 70, f2: 28, dur: 0.9, gain: 0.5, d: 0.9 });
    noise(e, e.sfx, t, { gain: 0.4, d: 0.8, filter: { type: 'lowpass', f: 1600, f2: 120 } });
    for (let i = 0; i < 5; i++) noise(e, e.sfx, t + 0.08 + i * 0.07, { gain: 0.12, d: 0.08, filter: { type: 'bandpass', f: rnd(400, 1200), q: 2 } });
  },
};

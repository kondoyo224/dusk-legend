// 오디오 엔진. 소유: 워커 C. WebAudio 절차 합성(외부 음원 0).
// 구독: 'sound'{id}, 'bgm'{id}, 'map:loaded'(map.bgm), 전투/아이템/레벨업 등 자동 효과음. 첫 사용자 입력 시 AudioContext 생성·resume.
// 음량 설정은 저장 데이터와 별개 키(localStorage 'duskLegend.settings.v1').
import { SFX } from './sfx.js';
import { Music } from './music.js';
import { makeImpulse, makeNoise } from './synth.js';

const SET_KEY = 'duskLegend.settings.v1';
const DEFAULTS = { master: 0.8, bgm: 0.55, sfx: 0.8 };
const SKILL_SFX = { power_strike: 'skill_power', whirlwind: 'skill_whirl', charge: 'skill_charge', war_cry: 'skill_cry', iron_wall: 'skill_wall', earth_splitter: 'skill_earth' };
const THROTTLE = { quest: 0.6, potion: 0.3, portal: 0.6, levelup: 0.5, hit: 0.03, step: 0.06, gold: 0.08, pickup: 0.05, swing: 0.04, die_monster: 0.05, ui_click: 0.03 };

export class AudioEngine {
  constructor(game) {
    this.game = game;
    this.ctx = null;
    this.settings = { ...DEFAULTS, ...loadSettings() };
    this.want = null;          // 재생해야 할 BGM id (컨텍스트가 아직 없을 때 기억)
    this.last = {};
    this.music = null;
    this.prevMap = null;
    this.stepFlip = false;
    const unlock = () => this.unlock();
    for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(ev, unlock, { capture: true });
    this.bind();
    if (new URLSearchParams(location.search).has('audiotest')) this.selfTest();
  }

  // ── 초기화 ──
  init() {
    if (this.ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      const ctx = this.ctx = new AC();
      this.noiseBuf = makeNoise(ctx);
      this.comp = ctx.createDynamicsCompressor();
      this.comp.threshold.value = -14; this.comp.ratio.value = 4;
      this.masterG = ctx.createGain();
      this.masterG.connect(this.comp); this.comp.connect(ctx.destination);
      this.sfx = ctx.createGain(); this.sfx.connect(this.masterG);
      this.bgm = ctx.createGain(); this.bgm.connect(this.masterG);
      // 잔향: revIn → convolver → (sfx/bgm 공용 반환)
      this.revIn = ctx.createGain();
      const conv = ctx.createConvolver(); conv.buffer = makeImpulse(ctx);
      const revOut = ctx.createGain(); revOut.gain.value = 0.5;
      this.revIn.connect(conv); conv.connect(revOut); revOut.connect(this.masterG);
      // 효과음용 잔향 전송: 원음 + 잔향 동시에
      this.rev = ctx.createGain(); this.rev.connect(this.sfx);
      const rs = ctx.createGain(); rs.gain.value = 0.6; this.rev.connect(rs); rs.connect(this.revIn);
      this.applyVolume();
      this.music = new Music(this);
      return true;
    } catch (e) {
      console.warn('오디오 초기화 실패', e);
      this.ctx = null;
      return false;
    }
  }
  unlock() {
    if (!this.init()) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    if (this.want && this.music.cur?.id !== this.want) this.music.play(this.want);
  }
  get ready() { return !!this.ctx; }

  // ── 재생 ──
  play(id, opts = {}) {
    if (!this.ctx || this.ctx.state === 'closed') return;
    const fn = SFX[id];
    if (!fn) return;
    const now = this.ctx.currentTime;
    const th = THROTTLE[id] ?? 0.02;
    if (this.last[id] != null && now - this.last[id] < th) return;
    this.last[id] = now;
    try { fn(this, now + 0.005, opts); } catch (e) { console.warn('효과음 오류', id, e); }
  }
  playBgm(id) {
    this.want = id || null;
    if (!this.ctx) return;
    if (!id) { this.music.stop(1.5); return; }
    this.music.play(id);
  }

  // ── 음량 ──
  setVolume(kind, v) {
    if (!(kind in DEFAULTS)) return;
    this.settings[kind] = Math.max(0, Math.min(1, v));
    this.applyVolume();
    try { localStorage.setItem(SET_KEY, JSON.stringify(this.settings)); } catch { /* 저장 불가 환경 */ }
  }
  applyVolume() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, s = this.settings;
    this.masterG.gain.setTargetAtTime(s.master, t, 0.03);
    this.sfx.gain.setTargetAtTime(s.sfx, t, 0.03);
    this.bgm.gain.setTargetAtTime(s.bgm * 0.8, t, 0.03);
  }

  update() { this.music?.tick(); }

  // ── 이벤트 구독 ──
  bind() {
    const b = this.game.bus, g = this.game;
    const isP = (e) => e && e === g.player;
    b.on('sound', ({ id }) => this.play(id));
    b.on('bgm', ({ id }) => this.playBgm(id));
    b.on('scene:title', () => this.playBgm('title'));
    b.on('map:loaded', ({ map }) => {
      if (this.prevMap && this.prevMap !== map.id) this.play('portal');
      this.prevMap = map.id;
      if (map.bgm) this.playBgm(map.bgm);
    });
    b.on('entity:moveStart', ({ entity }) => {
      if (!isP(entity)) return;
      this.stepFlip = !this.stepFlip;
      if (this.stepFlip) this.play('step', { ghost: entity.ghost });
    });
    b.on('combat:attack', ({ attacker }) => { if (isP(attacker) || this.near(attacker, 6)) this.play('swing'); });
    b.on('combat:damage', ({ target, crit, skill }) => {
      if (skill === 'poison') { if (isP(target) || this.near(target, 8)) this.play('poison'); return; }
      if (isP(target)) this.play('hurt');
      else if (crit) this.play('crit');
      else if (this.near(target, 12)) this.play('hit');
    });
    b.on('combat:miss', () => this.play('miss'));
    b.on('entity:died', ({ entity }) => {
      if (isP(entity)) return;
      if (entity?.kind === 'monster') this.play('die_monster');
    });
    b.on('player:dead', () => { this.play('die_player'); this.duck(0.25, 3); });
    b.on('player:revived', () => this.play('levelup'));
    b.on('player:levelup', () => this.play('levelup'));
    b.on('skill:cast', ({ caster, skillId, sound }) => {
      const id = sound ?? SKILL_SFX[skillId];
      if (id && (isP(caster) || this.near(caster, 8))) this.play(id);
    });
    b.on('item:pickup', ({ gold }) => this.play(gold ? 'gold' : 'pickup'));
    b.on('gold:changed', ({ delta }) => { if (delta > 0) this.play('gold'); });
    b.on('quest:started', () => this.play('quest'));
    b.on('quest:completed', () => this.play('quest'));
    b.on('game:ending', () => this.playBgm('ending'));
  }
  near(e, r) {
    const p = this.game.player;
    return !!(e && p && Math.max(Math.abs(e.x - p.x), Math.abs(e.y - p.y)) <= r);
  }
  // 잠시 BGM 줄이기 (사망 등)
  duck(level, sec) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, g = this.bgm.gain, base = this.settings.bgm * 0.8;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(base * level, t, 0.1);
    g.setTargetAtTime(base, t + sec, 0.8);
  }

  // 헤드리스 검증용: ?audiotest → 모든 효과음과 BGM 을 즉시 한 번씩 예약(무음 환경에서도 노드 생성 오류를 잡는다)
  selfTest() {
    if (!this.init()) return;
    const ids = Object.keys(SFX);
    ids.forEach((id, i) => setTimeout(() => { this.last[id] = null; this.play(id); }, i * 40));
    const bgms = ['title', 'limbo', 'altar', 'village', 'cellar', 'forest', 'graveyard', 'crypt', 'tower', 'boss', 'final', 'ending', 'rift'];
    bgms.forEach((id, i) => setTimeout(() => { this.playBgm(id); for (let k = 0; k < 40; k++) this.music.schedule(this.music.cur, k, this.ctx.currentTime + k * 0.01); }, 100 + i * 120));
    setTimeout(() => {
      const d = document.createElement('pre'); d.id = '__state'; d.style.display = 'none';
      d.textContent = `audiotest sfx=${ids.length} bgm=${bgms.length} ctx=${this.ctx.state}`;
      document.body.appendChild(d);
    }, 100 + bgms.length * 120 + 200);
  }
}

function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SET_KEY) || '{}') || {}; } catch { return {}; }
}

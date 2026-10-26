import { makeEntity, bumpEntityId } from '../world/entity.js';

// 영속 게임 상태 (저장 대상). 형식: docs/ARCHITECTURE.md §상태.
export const SAVE_KEY = 'duskLegend.save.v1';
export const START_MAP = 'limbo_awakening';

export function newState(opts = {}) {
  const player = makeEntity('player', {
    name: opts.name || '이름없는 혼',
    faction: 'player',
    x: 0, y: 0, dir: 4,
    look: {
      body: 'human', gender: opts.gender ?? 'm', hair: opts.hair ?? 0,
      hairColor: opts.hairColor ?? '#3b2a1e', skin: opts.skin ?? '#e8c4a0',
      armor: null, weapon: null, shield: null, helm: null,
    },
    level: 1, exp: 0,
    base: { str: 3, dex: 3, con: 3, int: 3, wis: 3 },
    hp: 50, maxHp: 50, mp: 20, maxMp: 20,
    ghost: true,           // 프롤로그는 '혼'의 상태로 시작한다(스토리: 귀혼의 서)
  });
  return {
    version: 1,
    player,
    cls: null,             // 'warrior' (현재 구현 직업은 전사뿐)
    statPoints: 0,
    gold: 0,
    inventory: new Array(24).fill(null),   // {id, qty}
    equipment: { weapon: null, armor: null, shield: null, helm: null, ring: null, amulet: null, boots: null }, // {id}
    skills: [],            // 배운 스킬 id 배열
    hotbar: new Array(10).fill(null),     // 스킬 id 또는 {item:id}
    flags: {},
    quests: {},            // id → {state:'active'|'done', progress:{[objIndex]: n}}
    map: START_MAP,
    playTime: 0,
    chapter: 0,
    ended: false,          // 엔딩을 봤는가 → 이후 자유 탐험 모드
  };
}

const PLAYER_SAVE_FIELDS = ['id', 'name', 'x', 'y', 'dir', 'look', 'level', 'exp', 'base', 'hp', 'mp', 'ghost', 'dead'];

export function serialize(state) {
  const p = {};
  for (const k of PLAYER_SAVE_FIELDS) p[k] = state.player[k];
  return JSON.stringify({ ...state, player: p, savedAt: Date.now() });
}

export function deserialize(json) {
  const raw = JSON.parse(json);
  const base = newState();
  const player = makeEntity('player', { ...base.player, ...raw.player, faction: 'player' });
  bumpEntityId(player.id);
  return { ...base, ...raw, player };
}

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
}
export function writeSave(state) {
  try { localStorage.setItem(SAVE_KEY, serialize(state)); return true; } catch (e) { console.warn('저장 실패', e); return false; }
}
export function readSave() {
  try { const s = localStorage.getItem(SAVE_KEY); return s ? deserialize(s) : null; } catch (e) { console.warn('불러오기 실패', e); return null; }
}

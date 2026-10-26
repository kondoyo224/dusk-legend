// 타일 정의 (계약). 소유: 관리자. 새 타일 추가는 docs/TASKS.md 요청 → 관리자 승인 후 추가.
// walk: 통행 가능 / light: 광원 / tall: 렌더러가 세로로 높은 오브젝트로 그림(벽, 나무 등) / layer: ground|object
// 렌더러(render/tiles.js)는 모든 id에 대해 그리기 함수를 가져야 한다.
export const TILES = {
  // ── ground ──
  grass:        { layer: 'ground', walk: true },
  grass_dark:   { layer: 'ground', walk: true },
  dirt:         { layer: 'ground', walk: true },
  path:         { layer: 'ground', walk: true },
  stone_floor:  { layer: 'ground', walk: true },
  cobble:       { layer: 'ground', walk: true },
  wood_floor:   { layer: 'ground', walk: true },
  carpet_red:   { layer: 'ground', walk: true },
  sand:         { layer: 'ground', walk: true },
  swamp:        { layer: 'ground', walk: true, slow: 0.7 },
  bridge:       { layer: 'ground', walk: true },
  marble:       { layer: 'ground', walk: true },
  mist_floor:   { layer: 'ground', walk: true },   // 영혼의 경계(망각의 묘원) 바닥
  bone_floor:   { layer: 'ground', walk: true },   // 지하묘지 바닥
  ash:          { layer: 'ground', walk: true },   // 잿더미 땅 (최종장)
  water:        { layer: 'ground', walk: false },
  deep_water:   { layer: 'ground', walk: false },
  lava:         { layer: 'ground', walk: false, light: { radius: 2.5, color: '#ff5522' } },
  void:         { layer: 'ground', walk: false },   // 심연/맵 바깥

  // ── object ──
  wall_stone:   { layer: 'object', walk: false, tall: true },
  wall_wood:    { layer: 'object', walk: false, tall: true },
  wall_crypt:   { layer: 'object', walk: false, tall: true },
  wall_marble:  { layer: 'object', walk: false, tall: true },
  wall_spirit:  { layer: 'object', walk: false, tall: true },  // 반투명 영혼 장벽
  tree:         { layer: 'object', walk: false, tall: true },
  pine:         { layer: 'object', walk: false, tall: true },
  dead_tree:    { layer: 'object', walk: false, tall: true },
  bush:         { layer: 'object', walk: false },
  rock:         { layer: 'object', walk: false },
  fence:        { layer: 'object', walk: false },
  torch:        { layer: 'object', walk: false, tall: true, light: { radius: 4, color: '#ffa046' } },
  brazier:      { layer: 'object', walk: false, light: { radius: 5, color: '#ff8a30' } },
  lamp_post:    { layer: 'object', walk: false, tall: true, light: { radius: 5, color: '#ffd27a' } },
  crystal:      { layer: 'object', walk: false, tall: true, light: { radius: 4, color: '#7fd8ff' } },
  pillar:       { layer: 'object', walk: false, tall: true },
  statue:       { layer: 'object', walk: false, tall: true },
  gravestone:   { layer: 'object', walk: false },
  crate:        { layer: 'object', walk: false },
  barrel:       { layer: 'object', walk: false },
  table:        { layer: 'object', walk: false },
  bookshelf:    { layer: 'object', walk: false, tall: true },
  bed:          { layer: 'object', walk: false },
  anvil:        { layer: 'object', walk: false },
  well:         { layer: 'object', walk: false },
  sign:         { layer: 'object', walk: false },
  chest:        { layer: 'object', walk: false },
  altar:        { layer: 'object', walk: false, light: { radius: 3, color: '#c9b6ff' } },
  shrine:       { layer: 'object', walk: false, tall: true, light: { radius: 3, color: '#fff0b0' } },
  stairs_down:  { layer: 'object', walk: true },
  stairs_up:    { layer: 'object', walk: true },
  portal_glow:  { layer: 'object', walk: true, light: { radius: 4, color: '#a98bff' } },
  flowers:      { layer: 'object', walk: true },
  mushroom:     { layer: 'object', walk: true },
  bones:        { layer: 'object', walk: true },
  cobweb:       { layer: 'object', walk: true },
  rubble:       { layer: 'object', walk: true },
};

// 맵 문자 → 타일 id 기본 범례. 맵에서 legend 로 덮어쓸 수 있다.
export const GROUND_LEGEND = {
  '.': 'grass', ',': 'grass_dark', ':': 'dirt', '=': 'path', '_': 'stone_floor', 'c': 'cobble',
  'w': 'wood_floor', 'r': 'carpet_red', 's': 'sand', 'p': 'swamp', 'B': 'bridge', 'M': 'marble',
  'm': 'mist_floor', 'b': 'bone_floor', 'a': 'ash', '~': 'water', 'W': 'deep_water', 'L': 'lava', ' ': 'void',
};
export const OBJECT_LEGEND = {
  '#': 'wall_stone', 'H': 'wall_wood', 'C': 'wall_crypt', 'K': 'wall_marble', 'X': 'wall_spirit',
  'T': 'tree', 'P': 'pine', 'D': 'dead_tree', '*': 'bush', 'o': 'rock', '|': 'fence',
  't': 'torch', 'h': 'brazier', 'l': 'lamp_post', 'q': 'crystal', 'I': 'pillar', 'S': 'statue',
  'g': 'gravestone', 'x': 'crate', 'O': 'barrel', 'n': 'table', 'L': 'bookshelf', 'y': 'bed',
  'a': 'anvil', 'Q': 'well', 'i': 'sign', 'z': 'chest', 'A': 'altar', 'R': 'shrine',
  'v': 'stairs_down', '^': 'stairs_up', '@': 'portal_glow', 'f': 'flowers', 'u': 'mushroom',
  'k': 'bones', 'e': 'cobweb', 'r': 'rubble',
};

// 맵 모듈을 모아 export. 소유: 워커 D (3장 탑·균열 맵은 워커 B 작성, 등록만 여기서). 형식: docs/ARCHITECTURE.md §11 맵
import limbo_awakening from './limbo_awakening.js';
import limbo_altar from './limbo_altar.js';
import village_roen from './village_roen.js';
import roen_cellar from './roen_cellar.js';
import whisper_forest from './whisper_forest.js';
import old_graveyard from './old_graveyard.js';
import crypt_b1 from './crypt_b1.js';
import crypt_b2 from './crypt_b2.js';
import dusk_tower_1 from './dusk_tower_1.js';
import dusk_tower_2 from './dusk_tower_2.js';
import rift_abyss from './rift_abyss.js';

export const MAPS = { limbo_awakening, limbo_altar, village_roen, roen_cellar, whisper_forest, old_graveyard, crypt_b1, crypt_b2,
  dusk_tower_1, dusk_tower_2, rift_abyss };

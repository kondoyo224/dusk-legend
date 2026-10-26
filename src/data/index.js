// 데이터 레지스트리 집계. 소유: 관리자. 각 데이터 파일의 소유자는 docs/ARCHITECTURE.md §소유권 참조.
import { TILES } from './tiles.js';
import { ITEMS } from './items.js';         // 워커 B
import { MONSTERS } from './monsters.js';   // 워커 B
import { SKILLS } from './skills.js';       // 워커 B
import { CLASSES } from './classes.js';     // 워커 B
import { MAPS } from './maps/index.js';     // 워커 D
import { NPCS } from './npcs.js';           // 워커 D
import { DIALOGUES } from './dialogues/index.js'; // 워커 D
import { QUESTS } from './quests.js';       // 워커 D
import { SHOPS } from './shops.js';         // 워커 D

export const DATA = { tiles: TILES, items: ITEMS, monsters: MONSTERS, skills: SKILLS, classes: CLASSES, maps: MAPS, npcs: NPCS, dialogues: DIALOGUES, quests: QUESTS, shops: SHOPS };

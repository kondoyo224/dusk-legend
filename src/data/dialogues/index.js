// 대화 파일들을 모아 export. 소유: 워커 D (chapter3.js 는 워커 B 작성, 등록만 여기서). 형식: docs/ARCHITECTURE.md §11 대화
import prologue from './prologue.js';
import village from './village.js';
import story from './story.js';
import chapter3 from './chapter3.js';

export const DIALOGUES = { ...prologue, ...village, ...story, ...chapter3 };

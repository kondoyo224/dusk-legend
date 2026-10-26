# 황혼의 전설 — 귀혼의 서

어둠의 전설·가디우스 풍의 고전 도트 쿼터뷰(아이소메트릭) 정통 판타지 RPG.
죽음에서 돌아온 전사가 찢겨 나간 「귀혼의 서」의 세 장을 되찾아 황혼의 왕을 막는 **완결형 이야기**와, 엔딩 후 **자유 사냥·골드 파밍·장비 구매**.

- 그래픽·사운드 전부 코드로 절차 생성 (외부 에셋 0)
- 프롤로그 「귀혼의 서」(튜토리얼) → 1장 「돌아온 자」 → 2장 「묘지기의 노래」 → 3장 「황혼의 탑」 → 엔딩 → 포스트게임(망각의 균열, 상위 장비)
- 직업: 전사 (스킬 6종: 강타·회전베기·돌진·전투의 함성·철벽·대지 가르기), 레벨 1~30
- 맵 11개, NPC 22명, 퀘스트 9개, 아이템 59종, 몬스터 25종(보스 7)

## 실행
```
node serve.mjs
```
브라우저에서 http://localhost:8123 접속. (빌드·설치 불필요, Node 18+)
진행은 자동 저장(맵 이동 시)되며 Esc 메뉴에서 수동 저장/불러오기.

## 조작
| 입력 | 동작 |
|---|---|
| WASD / 방향키 | 8방향 이동 (누르고 있으면 끊김 없이 연속 이동, 벽에선 미끄러짐) |
| 좌클릭 / 유지 | 이동 · 공격(자동 추적) · 대화 · 줍기 / 커서 방향으로 계속 이동 |
| Space | 공격 (인접 적 자동 조준, 유지 시 연타, 이동 중 입력은 도착 즉시 실행) |
| 1~0 | 단축키 스킬·물약 |
| F / E | 상호작용 |
| Tab | 타겟 순환 |
| I K C J M | 소지품 · 기술 · 능력치 · 일지 · 지도 |
| Enter | 채팅 |
| 마우스 휠 | 확대/축소 |
| Esc | 창 닫기 / 메뉴 |

## 문서
- [docs/GDD.md](docs/GDD.md) 게임 디자인 / [docs/ART_STYLE.md](docs/ART_STYLE.md) 고전 도트풍 아트 규약
- [docs/STORY.md](docs/STORY.md) 스토리 바이블 / [docs/SCRIPT.md](docs/SCRIPT.md) 세부 대본·플래그표
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) 모듈 계약
- [docs/WORKFLOW.md](docs/WORKFLOW.md) 작업 체계 / [docs/TASKS.md](docs/TASKS.md) 작업 보드 / [docs/HANDOFF.md](docs/HANDOFF.md) 인수인계

## 검증
```
node tools/verify_content.mjs                                                     # 데이터 정적 검증 (포탈·도달성·대화·ID)
node tools/check.mjs "autostart&ghost=0&cls=warrior&map=village_roen&test=all" shot.png 15000   # 조작 회귀
node tools/check.mjs "autostart&test=playthrough" shot.png 200000                 # 프롤로그~엔딩~포스트게임 자동 완주
```

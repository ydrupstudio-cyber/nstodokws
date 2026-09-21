# 가구 목록

가격은 초기 제안값이며 실제 점수 경제에 연결된 값이 아닙니다.

| 파일 | 이름 | 크기 | 희귀도 | 제안 가격 | 분류 |
|---|---|---|---|---|---|
| `fn-sofa.svg` | 민트 소파 | 2×1 | 고급 | 900 | seating |
| `fn-beanbag.svg` | 피치 빈백 | 1×1 | 일반 | 350 | seating |
| `fn-chair.svg` | 작업 의자 | 1×1 | 일반 | 350 | seating |
| `fn-cushion.svg` | 라일락 방석 | 1×1 | 일반 | 350 | seating |
| `fn-desk.svg` | 오크 책상 | 2×1 | 고급 | 900 | surface |
| `fn-table.svg` | 작은 테이블 | 2×1 | 일반 | 350 | surface |
| `fn-shelf.svg` | 색색 책장 | 2×1 | 희귀 | 1800 | surface |
| `fn-nightstand.svg` | 침대 옆 협탁 | 1×1 | 일반 | 350 | surface |
| `fn-cat-tree.svg` | 구름 캣타워 | 2×2 | 희귀 | 1800 | pet-supply |
| `fn-pet-bed.svg` | 포근한 펫 침대 | 1×1 | 고급 | 900 | pet-supply |
| `fn-bowl.svg` | 두 그릇 세트 | 1×1 | 일반 | 350 | pet-supply |
| `fn-scratcher.svg` | 오크 스크래처 | 1×1 | 일반 | 350 | pet-supply |
| `fn-dog-house.svg` | 작은 강아지집 | 2×2 | 희귀 | 1800 | pet-supply |
| `fn-plant-large.svg` | 큰 몬스테라 | 1×1 | 고급 | 900 | plant |
| `fn-plant-small.svg` | 작은 새싹 | 1×1 | 일반 | 350 | plant |
| `fn-plant-hanging.svg` | 행잉 플랜트 | 1×1 | 고급 | 900 | plant |
| `fn-floor-lamp.svg` | 머시룸 플로어램프 | 1×1 | 고급 | 900 | light |
| `fn-table-lamp.svg` | 작은 테이블램프 | 1×1 | 일반 | 350 | light |
| `fn-mood-lamp.svg` | 뇌 무드등 | 1×1 | 특별 | 2600 | light |
| `fn-frame.svg` | 뇌 그림 액자 스탠드 | 1×1 | 고급 | 900 | wall-decor |
| `fn-clock.svg` | 데이지 시계 스탠드 | 1×1 | 일반 | 350 | wall-decor |
| `fn-board.svg` | 작은 할일 보드 스탠드 | 2×1 | 고급 | 900 | wall-decor |
| `fn-rug.svg` | 선셋 러그 | 2×2 | 일반 | 350 | misc |
| `fn-cushion-pile.svg` | 쿠션 더미 | 1×1 | 고급 | 900 | misc |


# 2차 추가 — 18종 / 합계 42종

| id | 표시명 | 점수 | 면적 | 설치 | 반응 |
|---|---|---:|---|---|---|
| fn-rocking-chair | 민트 흔들의자 | 650 | [1, 1] | floor | sit |
| fn-floor-pillow | 살구 좌식방석 | 180 | [1, 1] | floor | sit |
| fn-hammock | 정원 해먹 | 1100 | [3, 1] | floor | nap |
| fn-round-table | 우드 원형테이블 | 700 | [2, 2] | floor | — |
| fn-storage-chest | 낮은 수납함 | 450 | [2, 1] | floor | — |
| fn-sideboard | 오트밀 사이드보드 | 900 | [2, 1] | floor | — |
| fn-pet-tunnel | 민트 터널 | 650 | [2, 1] | floor | inspect |
| fn-ball-basket | 공놀이 바구니 | 280 | [1, 1] | floor | play |
| fn-hammock-bed | 라벤더 해먹침대 | 750 | [2, 1] | floor | nap |
| fn-cactus | 작은 선인장 | 200 | [1, 1] | floor | inspect |
| fn-tree-pot | 둥근 나무 화분 | 650 | [1, 1] | floor | inspect |
| fn-candle | 꿀빛 캔들 | 160 | [1, 1] | floor | — |
| fn-string-lights | 정원 스트링라이트 | 800 | [3, 1] | floor | — |
| fn-wall-mirror | 창문 벽거울 | 350 | [1, 1] | wall | inspect |
| fn-wall-calendar | 살구 벽달력 | 150 | [1, 1] | wall | — |
| fn-arc-rug | 궤도 무늬 러그 | 250 | [2, 2] | floor | — |
| fn-staff-locker | 의국 민트 로커 | 1000 | [2, 1] | floor | — |
| fn-snack-trolley | 당직 간식 트롤리 | 850 | [2, 1] | floor | inspect |

벽거울·달력은 진짜 벽면 부착물입니다. `mount=wall`, 위치는 wallId+u+height로 저장하고 바닥 점유와 분리하세요. floor 전용 엔진에 바로 등록하지 마세요. 0/270 뷰는 앞면, 90/180 뷰는 뒷면입니다. 스트링라이트는 바닥 지지대형입니다. 캔들은 장식 광원이며 화재 규칙이 없습니다. 좌석 interaction은 동작 연결 제안으로, 가구별 승하차 위치는 앱에서 연결해야 합니다.

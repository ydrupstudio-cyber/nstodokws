# NS Pet Club — 미니게임

할일을 기록하고 공유할수록 점수가 쌓이고, 그 점수로 펫을 키우고 먹이는 기능입니다.

## 설치 (Supabase SQL Editor 에 순서대로)

```
1) SUPABASE_SQL_V7_PET.sql     점수 · 출석 · 원장 · 신고
2) SUPABASE_SQL_V8_FEED.sql    먹이 · 친밀도 · 미니룸 · 상점
```

순서를 바꾸면 실패합니다. 두 파일 모두 여러 번 실행해도 안전합니다.

## 구조

```
public/game/            에셋 339개 (SVG). manifest.json 이 모든 경로의 정답
  pet/  room/  gacha/
lib/pet/rig.js          부위별 SVG 조작 (디자인 킷 원본, 수정 금지)
lib/pet/motion.js       12가지 동작 (디자인 킷 원본, 수정 금지)
lib/pet/assets.js       manifest 로더 + SVG 캐시
lib/pet/room-engine.js  격자·충돌·경로 (디자인 킷 원본, 수정 금지)
lib/pet/room.js         씬 좌표·벽·깊이 정렬 보조
lib/game.js             서버 RPC 래퍼. 점수 계산을 여기서 하지 마라
app/PetCanvas.js        rig+motion 을 React 에 얹는 껍데기
app/PetView.js          펫 · 먹이 · 출석 · 활동기록 · 랭킹 화면
app/AttendCalendar.js   출석 달력 (도장)
app/RoomView.js         미니룸 — 자율 행동, 가구 배치
```

## 설계 원칙

**점수는 클라이언트가 못 만든다.** 점수표·상한·가격이 전부 DB 테이블에 있고,
`point_ledger` 와 `game_profiles` 에는 INSERT/UPDATE 정책이 없다.
`SECURITY DEFINER` 함수만 쓸 수 있다. 클라이언트는 "이런 일이 있었다"고 알릴 뿐이고,
줄지 말지는 서버가 실제 `todos`·`comments` 행을 확인해서 정한다.

**펫은 배고파지지 않는다.** 허기 게이지도, 줄어드는 수치도 만들지 마라.
당직 서고 이틀 만에 돌아온 사람에게 죄책감을 주면 안 된다.
먹이는 의무가 아니라 기회다. 친밀도는 절대 안 내려간다.

**단짝(stage 4)은 나이가 아니라 친밀도다.** 성장 0~3 은 누적 점수, 4 는 친밀도 2500.
계산은 `game_stage()` 한 곳에만 있다.

**에셋 경로는 manifest 로만 찾는다.** 파일명 규칙을 직접 조립하지 마라 —
어른 단계만 `growth/` 가 아니라 베이스 파일을 쓰는 등 예외가 있다.

## 미니룸 좌표 규약

킷 인계서 기준이다. **바꾸지 마라.** 가구·펫 위치가 통째로 어긋난다.

```
screenX = N*32 + (gx-gy)*32
screenY = 112 + (gx+gy)*16
가구 SVG  viewBox 0 0 256 224, 바닥 기준점 (128,164)
펫  SVG  viewBox 0 0 200 190, 바닥 기준선 y=176
```

정적 에셋(가구·바닥·벽지)은 `<image href>` 로 그린다. 펫만 인라인하는 이유는
부위별로 움직여야 하기 때문이다. 씬 안에서는 `foreignObject` 가 아니라
**중첩 `<svg>`** 를 쓴다 (PetCanvas 의 `embedded` 모드).

⚠️ 전역 `svg { width: ... }` 같은 CSS 를 추가하지 마라. 중첩된 펫 svg 의
width 속성을 덮어써서 방 안에서 펫만 거대해진다. 실제로 겪은 사고다.

## 아직 안 만든 것

- 가구 상점 (지금은 저장된 가구만 옮길 수 있다. 구매·인벤토리 없음)
- 벽지 구매 UI (`game_buy` 는 준비돼 있음)
- 방 확장 UI (`game_buy` 의 room-1 / room-2)
- 뽑기 상자 로직
- 칭찬 보내기 / 친구 방 구경
- 의국 전체 목표 판정
- 멤버 PIN (지금은 남의 계정으로 점수 요청이 가능하다. 활동 피드+신고로 막는 중)

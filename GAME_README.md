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
lib/game.js             서버 RPC 래퍼. 점수 계산을 여기서 하지 마라
app/PetCanvas.js        rig+motion 을 React 에 얹는 껍데기
app/PetView.js          펫 · 먹이 · 활동기록 · 랭킹 화면
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

## 아직 안 만든 것

- 미니룸 (가구 배치·방 확장) — 에셋과 `room-engine.js` 는 준비돼 있음
- 뽑기 상자 로직
- 칭찬 보내기 / 친구 방 구경
- 의국 전체 목표 판정
- 멤버 PIN (지금은 남의 계정으로 점수 요청이 가능하다. 활동 피드+신고로 막는 중)

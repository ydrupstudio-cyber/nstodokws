'use client';

/*
  상단 마크.

  한 글자도 이미지로 만들지 않았다 — 도형뿐이라 어떤 배율에서도 안 뭉개지고,
  색은 currentColor 를 따라가므로 밝은 테마·어두운 테마를 따로 그릴 필요가 없다.

  모양: 둥근 네모 안의 체크. 체크가 올라가다 끝에서 점 하나로 맺힌다 —
  할 일 목록의 체크와 신경 끝의 시냅스를 겹쳐 놓은 것이다 (신경외과 의국 앱).
  22px 에서도 읽히도록 획을 굵게, 점은 획보다 조금 크게 잡았다.
*/
export default function BrandMark({ size = 22, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"
         style={{ display: 'block', flexShrink: 0, ...style }}>
      <rect x="1.6" y="1.6" width="20.8" height="20.8" rx="6.4"
            fill="none" stroke="currentColor" strokeWidth="1.7" opacity="0.55" />
      <path d="M6.6 12.4 L10.2 16 L17 8.4"
            fill="none" stroke="currentColor" strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="17" cy="8.4" r="2.1" fill="currentColor" />
    </svg>
  );
}

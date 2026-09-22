import './globals.css';

export const metadata = {
  title: 'NS_To-Do (by WS.Kim)',
  description: 'NS To-Do for medical residency',
  manifest: '/manifest.json',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  /*
    이 페이지가 밝은 테마·어두운 테마를 스스로 처리한다고 브라우저에 알린다.
    이걸 안 알리면 안드로이드 크롬·삼성인터넷의 '웹페이지 어둡게' 기능이
    제멋대로 색을 뒤집는다. 그림이 허옇게 뜨고 가구가 비쳐 보였던 원인이다.
    앱 안에서 밝은 테마를 골라 놔도 브라우저 설정이 이겨서 소용이 없었다.
  */
  colorScheme: 'light dark',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Gowun+Dodum&family=IBM+Plex+Sans+KR:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
        {/*
          주소창·상태바 색. 기기 설정이 아니라 **지금 쓰는 테마** 를 따라야 한다 —
          기기가 밝고 앱이 어두우면 예전엔 밝은 값이 나가서 위아래가 따로 놀았다.
          아래 스크립트가 테마를 정한 뒤 이 값을 고쳐 쓴다.
          supported-color-schemes 는 옛 안드로이드 브라우저용 같은 뜻의 선언이다.
        */}
        <meta name="theme-color" content="#1a1a18" />
        <meta name="supported-color-schemes" content="dark light" />
        <link rel="icon" href="/icon-192.png" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var t = localStorage.getItem('theme') || 'system';
                  var actual = t;
                  if (t === 'system') {
                    actual = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  }
                  document.documentElement.setAttribute('data-theme', actual);
                  // 브라우저에게 '이 페이지는 어둡다' 고 알린다. 이 선언이 없으면
                  // 삼성 인터넷의 '웹페이지 어둡게' 가 색을 0.85배로 깎는다
                  var m = document.querySelector('meta[name="theme-color"]');
                  if (m) m.setAttribute('content', actual === 'dark' ? '#1a1a18' : '#fafaf7');
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

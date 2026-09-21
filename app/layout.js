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

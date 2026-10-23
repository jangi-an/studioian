import "./globals.css";

export const metadata = {
  title: "하루한칸 · 오늘의 할 일",
  description: "중요한 일부터 하나씩. 휴대폰과 컴퓨터에서 함께 쓰는 나의 할 일 메모장.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f8f5",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

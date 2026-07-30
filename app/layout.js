export const metadata = {
  title: "Studio Ian",
  description: "Studio Ian",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

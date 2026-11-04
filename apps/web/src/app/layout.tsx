import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "ПДД Грузии",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cursor CRM",
  description: "CRM для управления заявками, оплатами, планами и премиями",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}

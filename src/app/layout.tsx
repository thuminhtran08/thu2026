import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Xoay vòng Xoay",
  description: "Xoay vòng Xoay - TDC Trung Thu",
  icons: {
    icon: "/images/phenakistoscope/logo.png",
    shortcut: "/images/phenakistoscope/logo.png",
    apple: "/images/phenakistoscope/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
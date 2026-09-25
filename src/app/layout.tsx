import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Xoay Vòng Xoay",
  description: "Xoay Vòng Xoay - TDC Trung Thu",
  icons: {
    icon: "/images/phenakistoscope/logo3.png",
    shortcut: "/images/phenakistoscope/logo3.png",
    apple: "/images/phenakistoscope/logo3.png",
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
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Northstar — Autonomous Revenue Operator",
  description: "An autonomous AI revenue operator for modern businesses."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
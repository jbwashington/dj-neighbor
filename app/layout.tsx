import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DJ Neighbor — Now Playing",
  description: "Whatever the DJ next door is spinning, right now.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

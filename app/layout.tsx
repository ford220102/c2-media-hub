import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "C2 Media Hub",
  description: "Launcher Jellyfin i Xbox Cloud Gaming dla projektora Hisense C2.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pl"><body>{children}</body></html>;
}

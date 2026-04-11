import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import UIThemeToggle from "@/components/UIThemeToggle";

// Default theme fonts (preserved)
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Editorial theme fonts (only used inside .theme-editorial scope / .theme-editorial-tree)
const playfair = Playfair_Display({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
});
const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono-editorial",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "Bunnyhop",
  description: "Plan trips together, the fun way",
};

// Inline script that runs before React hydrates. Reads the persisted theme
// from localStorage and sets the html class so the editorial overrides apply
// on first paint — no flash of default styles for users who chose editorial.
const themeInitScript = `
(function () {
  try {
    var t = localStorage.getItem('bunnyhop:ui-theme');
    if (t === 'editorial') {
      document.documentElement.classList.add('theme-editorial');
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} ${ibmPlexMono.variable} antialiased`}
      >
        {children}
        <UIThemeToggle />
      </body>
    </html>
  );
}

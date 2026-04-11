import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Default theme fonts (still loaded — referenced by the dual-tree
// .theme-default-tree blocks that haven't been deleted yet. The follow-up
// dual-tree teardown commit will drop these too along with the default JSX.)
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Editorial theme fonts — the live ones.
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

// Editorial is now the only theme. Set the .theme-editorial class on the
// html element synchronously before React hydrates so the cream background
// + serif font apply on first paint, no flash. The toggle component is
// no longer rendered. Future cleanup: drop the dual-tree wrappers from
// every page/component and unscope the editorial overrides in globals.css.
const themeInitScript = `document.documentElement.classList.add('theme-editorial');`;

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
      </body>
    </html>
  );
}

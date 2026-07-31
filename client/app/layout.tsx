import type { Metadata, Viewport } from "next";
import { Heebo, Space_Grotesk } from "next/font/google";
import { SocketProvider } from "../context/SocketContext";
import { AuthProvider } from "../context/AuthContext";
import { ThemeProvider, THEME_INIT_SCRIPT } from "../context/ThemeContext";
import "./globals.css";

// §8.1 — Heebo for the Hebrew UI (the whole app is RTL/Hebrew; Inter had no
// Hebrew glyphs), Space Grotesk tabular numerals for live scores & timers.
const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "700", "800", "900"],
  variable: "--font-heebo",
});
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
  title: "J'GAMES — Dog Frisbee",
  description: "Real-time management and judging for dog frisbee competitions.",
  manifest: "/manifest.json",
  // §6.1 — installable PWA / standalone tablet experience.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "J'GAMES",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0e0c", // arena near-black (§8.1)
  width: "device-width",
  initialScale: 1,
  // Prevent accidental pinch-zoom on judge tablets during scoring.
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <head>
        {/* Legacy mobile web-app capability flags for older WebViews. */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        {/* Set the theme class before first paint to avoid a flash (§8.1). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className={`${heebo.variable} ${spaceGrotesk.variable} font-sans`}>
        <ThemeProvider>
          <AuthProvider>
            <SocketProvider>{children}</SocketProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

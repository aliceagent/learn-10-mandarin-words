import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Sans_SC } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/bottom-nav";
import { PwaRegister } from "@/components/pwa-register";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoSansSC = Noto_Sans_SC({
  variable: "--font-noto-sc",
  weight: ["400", "500", "700"],
  preload: false,
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: "A Mandarin vocabulary learning app with video lessons, quizzes, flashcards, favorites, and local progress tracking.",
  applicationName: SITE_NAME,
  manifest: "/manifest.webmanifest",
  openGraph: {
    siteName: SITE_NAME,
    type: "website",
    locale: "en_US",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Learn 10",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  // SSR default is dark (#020617). The theme's `color-scheme` is now owned by
  // CSS (:root / [data-theme="light"] in globals.css) so light-mode form controls
  // render light; the browser-chrome color is kept in step at runtime by
  // use-theme.ts updating this <meta> on toggle.
  themeColor: "#020617",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${notoSansSC.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Pre-paint theme init (Sprint 16): sets data-theme="light" on <html>   */}
        {/* before first paint so a light-mode reload shows no dark flash. Dark    */}
        {/* leaves the attribute absent, matching the SSR output. Follows the      */}
        {/* Next.js 16 preventing-flash-before-hydration guide (Themes section).   */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full bg-background text-foreground">
        {children}
        <BottomNav />
        <PwaRegister />
      </body>
    </html>
  );
}

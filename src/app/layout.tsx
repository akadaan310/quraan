import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Celestial Muṣḥaf",
  description:
    "The fifteen-line Uthmani Muṣḥaf, set in obsidian and gold — an unhurried place to read.",
};

export const viewport: Viewport = {
  themeColor: "#05060c",
  width: "device-width",
  initialScale: 1,
  // The reading surface is a fixed canvas; pinch-zoom would break the grid,
  // so text size is offered as a setting instead of being taken away.
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* The Uthmani face backs every glyph font until it loads, and sets
            the basmala and sūrah names, so it is worth fetching early. */}
        <link
          rel="preconnect"
          href="https://static.qurancdn.com"
          crossOrigin="anonymous"
        />
        <link rel="preconnect" href="https://api.qurancdn.com" />
        <link
          rel="preload"
          as="font"
          type="font/woff2"
          href="https://static.qurancdn.com/fonts/quran/hafs/uthmanic_hafs/UthmanicHafs1Ver18.woff2"
          crossOrigin="anonymous"
        />
        <style>{`@font-face{font-family:"UthmanicHafs";src:url("https://static.qurancdn.com/fonts/quran/hafs/uthmanic_hafs/UthmanicHafs1Ver18.woff2") format("woff2");font-display:swap;}`}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { SwRegistration } from "@/components/SwRegistration";
import "./globals.css";

// IBM Plex Sans (SIL OFL, see fonts/IBM-Plex-OFL.txt), bundled so builds
// never depend on reaching Google Fonts.
const plexSans = localFont({
  src: [
    { path: "./fonts/ibm-plex-sans-latin-400-normal.woff2", weight: "400" },
    { path: "./fonts/ibm-plex-sans-latin-500-normal.woff2", weight: "500" },
    { path: "./fonts/ibm-plex-sans-latin-600-normal.woff2", weight: "600" },
    { path: "./fonts/ibm-plex-sans-latin-700-normal.woff2", weight: "700" },
  ],
  variable: "--font-plex",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Fridgeboard",
  description: "Shared groceries, to-dos and a family calendar for your household.",
  applicationName: "Fridgeboard",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#f5f6f8",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={plexSans.variable}>
      <body>
        <SwRegistration />
        {children}
      </body>
    </html>
  );
}

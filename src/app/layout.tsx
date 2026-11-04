import type { Metadata } from "next";
import localFont from "next/font/local";
import { SwRegistration } from "@/components/SwRegistration";
import "./globals.css";

// Figtree (SIL OFL, see fonts/Figtree-OFL.txt), bundled so builds don't need
// Google Fonts. One family for headings and body, as in the hub design.
const figtree = localFont({
  src: "./fonts/figtree-latin-wght-normal.woff2",
  weight: "300 900",
  variable: "--font-figtree",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Fridgeboard",
  description: "A warm shared grocery and to-do list for two phones and one home.",
  applicationName: "Fridgeboard",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={figtree.variable}>
      <body>
        <SwRegistration />
        {children}
      </body>
    </html>
  );
}

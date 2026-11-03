import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { SwRegistration } from "@/components/SwRegistration";
import "./globals.css";

// One family for everything (design system: clarity from across the room).
// Exposed as both variables so older screens using --font-heading follow along.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Fridgeboard",
  description: "A warm shared grocery and to-do list for two phones and one home.",
  applicationName: "Fridgeboard",
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: { capable: true, title: "Fridgeboard", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#f7f5f0",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={jakarta.variable}>
        <SwRegistration />
        {children}
      </body>
    </html>
  );
}

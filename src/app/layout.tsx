import type { Metadata } from "next";
import { Fraunces, Nunito } from "next/font/google";
import { SwRegistration } from "@/components/SwRegistration";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-body",
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
    <html lang="en">
      <body className={`${fraunces.variable} ${nunito.variable}`}>
        <SwRegistration />
        {children}
      </body>
    </html>
  );
}

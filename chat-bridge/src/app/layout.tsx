import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["500", "700", "800"],
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Brygga – ChatGPT till Mail & Kalender",
  description:
    "Lokal brygga mellan ChatGPT och Apples Mail- och Kalender-appar på Mac (synkas till iPhone via iCloud).",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sv">
      <body className={`${fraunces.variable} ${outfit.variable}`}>{children}</body>
    </html>
  );
}

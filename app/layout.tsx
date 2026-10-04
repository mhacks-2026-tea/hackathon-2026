import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  Bricolage_Grotesque,
  Hanken_Grotesk,
  Instrument_Serif,
} from "next/font/google";
import "./globals.css";

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ui",
});

const instrument = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-app-display",
});

export const metadata: Metadata = {
  title: "Movin | Your student finance copilot",
  description:
    "Understand what housing really costs and how it fits your student finances.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${hanken.variable} ${instrument.variable} ${bricolage.variable}`}>
        {children}
      </body>
    </html>
  );
}

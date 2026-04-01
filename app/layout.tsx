import type { Metadata } from "next";
import { Exo_2, Rajdhani, Share_Tech_Mono } from "next/font/google";
import "./globals.css";
import { PageTransition } from "@/components/ui/PageTransition";

const exo = Exo_2({
  variable: "--font-exo",
  subsets: ["latin"],
});

const rajdhani = Rajdhani({
  variable: "--font-rajdhani",
  subsets: ["latin"],
  weight: ["700"],
});

const mono = Share_Tech_Mono({
  variable: "--font-mono-tech",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "CardioSense",
  description: "AI cardiac monitoring platform with live ECG analytics",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${exo.variable} ${rajdhani.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <PageTransition>{children}</PageTransition>
      </body>
    </html>
  );
}

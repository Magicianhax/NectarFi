import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "sonner";
import { CursorGradient } from "@/components/cursor-gradient";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "NectarFi | AI DeFi Yield Agent on BNB Chain",
  description: "AI-powered DeFi yield optimization across Venus, Aave, and Lista on BNB Chain. Harvest the best yields automatically.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${jakarta.variable} ${jetbrains.variable} antialiased`}>
        <CursorGradient />
        <Providers>{children}</Providers>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'rgba(17,17,20,0.85)',
              backdropFilter: 'blur(24px)',
              border: '1px solid rgba(255,255,255,0.06)',
              color: '#f0f0f0',
              borderRadius: '12px',
              boxShadow: '0 8px 40px rgba(0,0,0,0.35)',
              fontFamily: 'var(--font-jakarta)',
              fontSize: '12px',
            },
          }}
        />
      </body>
    </html>
  );
}

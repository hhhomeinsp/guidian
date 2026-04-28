import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { AppHeader } from "@/components/AppHeader";
import { ConsentBanner } from "@/components/ConsentBanner";
import { LearnerHydrator } from "@/components/LearnerHydrator";

export const metadata: Metadata = {
  title: "Guidian",
  description: "AI-Native Adaptive Compliance LMS",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen font-body bg-background text-foreground antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-[#0071E3] focus:px-3 focus:py-2 focus:text-white focus:text-sm"
        >
          Skip to main content
        </a>
        <Providers>
          <LearnerHydrator />
          <AppHeader />
          <ConsentBanner />
          <div id="main-content">{children}</div>
        </Providers>
      </body>
    </html>
  );
}

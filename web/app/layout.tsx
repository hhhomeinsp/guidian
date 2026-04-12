import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { AppHeader } from "@/components/AppHeader";
import { LearnerHydrator } from "@/components/LearnerHydrator";

export const metadata: Metadata = {
  title: "Guidian",
  description: "AI-Native Adaptive Compliance LMS",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          <LearnerHydrator />
          <AppHeader />
          {children}
        </Providers>
      </body>
    </html>
  );
}

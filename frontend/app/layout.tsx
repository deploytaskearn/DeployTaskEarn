import type { Metadata } from "next";
import { Inter, Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { SiteSettingsProvider } from "@/lib/site-settings-context";
import { ToastProvider } from "@/components/ToastProvider";
import { ActivityFeed } from "@/components/ActivityFeed";
import { SupportButton } from "@/components/SupportButton";
import { SuppressDevErrors } from "@/components/SuppressDevErrors";

const BACKEND = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ?? 'http://localhost:4000';

const inter = Inter({ variable: "--font-body", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-display", subsets: ["latin"], weight: ["400","500","600","700","900"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TaskEarn — Complete tasks, get paid",
  description: "Earn real money completing surveys, app installs, and partner offers. Deposit and withdraw via EasyPaisa, JazzCash, or bank transfer.",
  icons: {
    icon: [
      { url: `${BACKEND}/uploads/favicon-16.png`,  sizes: "16x16",  type: "image/png" },
      { url: `${BACKEND}/uploads/favicon-32.png`,  sizes: "32x32",  type: "image/png" },
      { url: `${BACKEND}/uploads/favicon-48.png`,  sizes: "48x48",  type: "image/png" },
      { url: `${BACKEND}/uploads/favicon-96.png`,  sizes: "96x96",  type: "image/png" },
      { url: `${BACKEND}/uploads/favicon-512.png`, sizes: "512x512",type: "image/png" },
    ],
    apple: { url: `${BACKEND}/uploads/favicon-180.png`, sizes: "180x180", type: "image/png" },
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col" style={{ background: "var(--color-bg)" }}>
        <AuthProvider>
          <SiteSettingsProvider>
            <ToastProvider>
              {children}
              <ActivityFeed />
              <SupportButton />
              <SuppressDevErrors />
            </ToastProvider>
          </SiteSettingsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

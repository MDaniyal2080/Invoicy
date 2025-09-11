import type { Metadata } from "next";
import { Inter, Roboto_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { StoreProvider } from "@/components/providers/store-provider";
import { TitleUpdater } from "@/components/providers/title-updater";
import { NotificationToast } from "@/components/ui/notification-toast";
import { GlobalLoading } from "@/components/ui/global-loading";

const geistSans = Inter({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Roboto_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "Invoicy - Invoice Management System",
  description: "Professional invoice management and billing solution",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Script id="theme-init" strategy="beforeInteractive">
          {`try {
  var t = localStorage.getItem('theme') || 'system';
  var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  var useDark = t === 'dark' || (t === 'system' && prefersDark);
  var root = document.documentElement;
  if (useDark) root.classList.add('dark'); else root.classList.remove('dark');
  root.style.colorScheme = useDark ? 'dark' : 'light';
} catch (e) { /* no-op */ }`}
        </Script>
        <StoreProvider>
          {children}
          <GlobalLoading />
          <NotificationToast />
          <TitleUpdater />
        </StoreProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Tajawal } from "next/font/google";
import "./globals.css";
import { TelegramReady } from "@/components/TelegramReady";

const tajawal = Tajawal({ subsets: ["arabic", "latin"], weight: ["400", "500", "700"], variable: "--font-tajawal", display: "swap" });

export const metadata: Metadata = {
  title: "لوحة باو كير",
  description: "لوحة إدارة بوت عيادة باو كير البيطرية (عرض تجريبي)",
  robots: { index: false, follow: false },
};

// Applied before first paint so the saved theme never flashes. Falls back to the system preference via CSS.
const themeInit = `try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={tajawal.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-screen">
        <TelegramReady />
        {children}
      </body>
    </html>
  );
}

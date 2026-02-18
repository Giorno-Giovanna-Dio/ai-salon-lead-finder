import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: '龍蝦配 ClawMatch - AI B2B 客戶開發系統',
  description: '使用 AI 自動化 Instagram 潛在客戶開發，降低成本 97%，效率提升 100 倍',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-TW">
      <body className={inter.className}>
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <Header />
            <main className="flex-1 overflow-auto bg-background p-6">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}

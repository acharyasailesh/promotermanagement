import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { LayoutDashboard, Users, Activity } from "lucide-react";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Master Controller | TIFL SaaS",
  description: "SaaS Management and Provisioning Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-gray-50/50">
        <header className="bg-white border-b border-gray-100 py-3 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-indigo-600 p-1.5 rounded-lg shadow-inner">
                <Activity size={20} className="text-white" />
              </div>
              <span className="text-sm font-black text-gray-900 tracking-tight">TIFL<span className="text-indigo-600 ml-1">MASTER</span></span>
            </div>
            
            <nav className="flex items-center gap-6">
            <Link href="/" className="text-gray-500 hover:text-indigo-600 text-sm font-black transition-colors px-2 py-1 rounded-lg hover:bg-indigo-50/50 uppercase tracking-widest text-[10px]">Overview</Link>
            <Link href="/tenants" className="text-gray-500 hover:text-indigo-600 text-sm font-black transition-colors px-2 py-1 rounded-lg hover:bg-indigo-50/50 uppercase tracking-widest text-[10px]">Manage Tenants</Link>
            <Link href="/wizard" className="text-gray-500 hover:text-indigo-600 text-sm font-black transition-colors px-2 py-1 rounded-lg hover:bg-indigo-50/50 uppercase tracking-widest text-[10px]">Setup Wizard</Link>
            <Link href="/sql-library" className="text-gray-500 hover:text-indigo-600 text-sm font-black transition-colors px-2 py-1 rounded-lg hover:bg-indigo-50/50 uppercase tracking-widest text-[10px]">SQL Library</Link>
          </nav>

            <div className="flex items-center gap-3">
              <div className="h-6 w-px bg-gray-200 mx-1"></div>
              <button 
                onClick={async () => {
                  const { createClient } = await import('@supabase/supabase-js');
                  const supabase = createClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                  );
                  await supabase.auth.signOut();
                  window.location.href = '/login';
                }}
                className="text-[10px] font-black text-red-500 uppercase tracking-widest px-3 py-1.5 rounded-xl border border-red-50 hover:bg-red-50 transition-all"
              >
                Log Out
              </button>
            </div>
          </div>
        </header>
        <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
      </body>
    </html>
  );
}

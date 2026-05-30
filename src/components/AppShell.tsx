"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAutoSync } from "@/hooks/useAutoSync";
import AIFloatingButton from "@/components/AIFloatingButton";

const NAV_ITEMS = [
  { href: "/", label: "概要", icon: "📊" },
  { href: "/portfolio", label: "保有一覧", icon: "📋" },
  { href: "/stocks", label: "銘柄DB", icon: "🔍" },
  { href: "/charts", label: "チャート", icon: "📈" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { syncing, progress } = useAutoSync();

  return (
    <div className="flex flex-col h-screen" style={{ background: "var(--bg-page)" }}>
      {/* Header */}
      <header
        className="h-14 flex items-center px-6 flex-shrink-0 gap-4"
        style={{ background: "var(--bg-sidebar)", borderBottom: "1px solid var(--border-card)" }}
      >
        <span className="font-bold text-white flex-1 text-base">▋ 投資管理</span>
        {syncing && (
          <span className="text-xs flex items-center gap-1.5" style={{ color: "var(--text-sub)" }}>
            <span className="inline-block animate-spin">⟳</span>
            同期中 {progress.processed}/{progress.total}
          </span>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <nav
          className="w-[220px] flex-shrink-0 flex flex-col py-3"
          style={{ background: "var(--bg-sidebar)", borderRight: "1px solid var(--border-card)" }}
        >
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active ? "bg-indigo-600/20 text-white" : "hover:bg-white/5"
                }`}
                style={{
                  color: active ? "white" : "var(--text-sub)",
                  borderLeft: active ? "2px solid var(--accent)" : "2px solid transparent",
                }}
              >
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Main */}
        <main className="flex-1 overflow-y-auto p-6 relative">
          {children}
          <AIFloatingButton />
        </main>
      </div>
    </div>
  );
}

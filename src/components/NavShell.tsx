// ─────────────────────────────────────────────────────────────────
//  NavShell — top-level navigation wrapper for the Activity
// ─────────────────────────────────────────────────────────────────
import type { ReactNode } from 'react';
import type { DiscordUser } from '../auth';

type Page = 'wallet' | 'battle' | 'chat' | 'nft' | 'leaderboard';

interface NavShellProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  user: DiscordUser | null;
  children: ReactNode;
}

const tabs: { id: Page; label: string; icon: string }[] = [
  { id: 'wallet',      label: 'Wallet',      icon: '🔐' },
  { id: 'battle',      label: 'Battle',      icon: '⚔️' },
  { id: 'chat',        label: 'Wizard',      icon: '🧙' },
  { id: 'nft',         label: 'NFTs',        icon: '🎴' },
  { id: 'leaderboard', label: 'Rankings',    icon: '🏆' },
];

export default function NavShell({ activePage, onNavigate, user, children }: NavShellProps) {
  return (
    <div className="flex flex-col h-screen">
      {/* ── Header ──────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 py-2 bg-[var(--bg-secondary)] border-b border-[var(--bg-tertiary)]">
        <span className="font-bold text-sm tracking-wide">✨ aWizard</span>
        {user && (
          <span className="text-xs text-[var(--text-muted)]">
            {user.global_name ?? user.username}
          </span>
        )}
      </header>

      {/* ── Content ─────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto p-4">{children}</main>

      {/* ── Tab Bar ─────────────────────────────────────────── */}
      <nav className="flex bg-[var(--bg-secondary)] border-t border-[var(--bg-tertiary)]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onNavigate(tab.id)}
            className={`flex-1 py-2 text-center text-xs transition-colors ${
              activePage === tab.id
                ? 'text-[var(--accent)] font-semibold'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <span className="block text-base">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

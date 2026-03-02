// ─────────────────────────────────────────────────────────────────
//  NavShell — glow-themed navigation (matches bow-app style)
// ─────────────────────────────────────────────────────────────────
import type { ReactNode } from 'react';
import type { DiscordUser } from '../auth';

type Page = 'battle' | 'wallet' | 'chat' | 'nft' | 'leaderboard';

interface NavShellProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  user: DiscordUser | null;
  children: ReactNode;
}

const tabs: { id: Page; label: string; icon: string }[] = [
  { id: 'battle',      label: 'Battle',   icon: '⚔️' },
  { id: 'wallet',      label: 'Wallet',   icon: '🔮' },
  { id: 'chat',        label: 'Wizard',   icon: '🧙' },
  { id: 'nft',         label: 'NFTs',     icon: '🃏' },
  { id: 'leaderboard', label: 'Rankings', icon: '🏆' },
];

export default function NavShell({ activePage, onNavigate, user, children }: NavShellProps) {
  return (
    <div className="flex flex-col h-screen">
      {/* ── Top NavBar (bow-app style) ──────────────────────── */}
      <nav
        className="flex items-center justify-between px-4 h-14 border-b backdrop-blur-sm"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-color)',
        }}
      >
        {/* Brand */}
        <span
          className="text-lg font-bold whitespace-nowrap"
          style={{
            color: 'var(--text-color)',
            textShadow: '0 0 8px var(--glow-inner)',
          }}
        >
          ✨ Battle of Wizards
        </span>

        {/* Tab links (center) */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onNavigate(tab.id)}
              className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap cursor-pointer"
              style={
                activePage === tab.id
                  ? {
                      background: 'var(--sel-fill)',
                      color: 'var(--sel-text)',
                      boxShadow: '0 0 8px var(--glow-outer)',
                    }
                  : { color: 'var(--text-color)', opacity: 0.7 }
              }
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* User badge */}
        {user && (
          <div className="flex items-center gap-2">
            {user.avatar && (
              <img
                src={`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=32`}
                alt=""
                className="w-6 h-6 rounded-full"
              />
            )}
            <span
              className="text-xs font-medium"
              style={{ color: 'var(--text-muted)' }}
            >
              {user.global_name ?? user.username}
            </span>
          </div>
        )}
      </nav>

      {/* ── Content ─────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto p-4">{children}</main>
    </div>
  );
}

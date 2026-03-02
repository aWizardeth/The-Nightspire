import { useState, useEffect, type ReactNode } from 'react';
import NavShell from './components/NavShell';
import WizardChat from './components/WizardChat';
import BattleTab from './components/BattleTab';
import WalletTab from './components/WalletTab';
import NftViewer from './components/NftViewer';
import Leaderboard from './components/Leaderboard';
import { setupDiscordSdk } from './discord';
import { fetchDiscordUser, type DiscordUser } from './auth';
import useBowActivityStore from './store/bowActivityStore';

type Page = 'battle' | 'wallet' | 'chat' | 'nft' | 'leaderboard';

export default function App() {
  const [page, setPage] = useState<Page>('battle');
  const [user, setUser] = useState<DiscordUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const store = useBowActivityStore();

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const { accessToken } = await setupDiscordSdk();
        if (cancelled) return;
        store.setAccessToken(accessToken);

        const profile = await fetchDiscordUser(accessToken);
        if (cancelled) return;
        setUser(profile);

        console.log(`[aWizard] Activity initialized for Discord user ${profile.id}`);
      } catch (err) {
        console.error('[aWizard]', err);
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => { cancelled = true; };
  }, [store]);

  /* ── Loading ────────────────────────────────────────────── */
  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-screen"
        style={{ background: 'var(--bg-deep)' }}
      >
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">🧙‍♂️</div>
          <p className="glow-text text-lg">Conjuring the portal...</p>
        </div>
      </div>
    );
  }

  /* ── Error / outside Discord ────────────────────────────── */
  if (error) {
    return (
      <div
        className="flex items-center justify-center h-screen px-6 text-center"
        style={{ background: 'var(--bg-deep)' }}
      >
        <div className="glow-card p-8 max-w-lg">
          <div className="text-6xl mb-4">🧙‍♂️</div>
          <h1 className="glow-text text-2xl font-bold mb-4">Battle of Wizards</h1>
          <p style={{ color: 'var(--text-muted)' }} className="mb-6 leading-relaxed">
            This is a Discord Activity that must be launched from within Discord.
          </p>
          <div
            className="rounded-lg p-4 text-left text-sm"
            style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-color)' }}
          >
            <p style={{ color: 'var(--text-color)' }} className="font-semibold mb-2">
              To play:
            </p>
            <ol
              style={{ color: 'var(--text-muted)' }}
              className="space-y-1 list-decimal list-inside"
            >
              <li>Open Discord on desktop or mobile</li>
              <li>Join a server with the Battle of Wizards app</li>
              <li>Start an Activity and select &quot;Battle of Wizards&quot;</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  /* ── Main app ───────────────────────────────────────────── */
  const pages: Record<Page, ReactNode> = {
    battle: <BattleTab userId={user?.id || ''} />,
    wallet: <WalletTab userId={user?.id || ''} />,
    chat: <WizardChat user={user} />,
    nft: <NftViewer />,
    leaderboard: <Leaderboard />,
  };

  return (
    <NavShell activePage={page} onNavigate={setPage} user={user}>
      {pages[page]}
    </NavShell>
  );
}

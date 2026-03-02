import { useState, useEffect, type ReactNode } from 'react';
import NavShell from './components/NavShell';
import WizardChat from './components/WizardChat';
import BattleDashboard from './components/BattleDashboard';
import NftViewer from './components/NftViewer';
import Leaderboard from './components/Leaderboard';
import { setupDiscordSdk } from './discord';
import { fetchDiscordUser, type DiscordUser } from './auth';
import { useGuiStore } from './store/guiStore';

type Page = 'chat' | 'battle' | 'nft' | 'leaderboard';

export default function App() {
  const [page, setPage] = useState<Page>('chat');
  const [user, setUser] = useState<DiscordUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const setAccessToken = useGuiStore((s) => s.setAccessToken);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const { accessToken } = await setupDiscordSdk();
        if (cancelled) return;
        setAccessToken(accessToken);

        const profile = await fetchDiscordUser(accessToken);
        if (cancelled) return;
        setUser(profile);
      } catch (err) {
        console.error('[aWizard]', err);
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => { cancelled = true; };
  }, [setAccessToken]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-[var(--text-muted)] animate-pulse text-lg">
          🧙 Conjuring the portal…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen px-6 text-center">
        <div>
          <p className="text-[var(--danger)] text-lg font-semibold mb-2">Portal Failed</p>
          <p className="text-[var(--text-muted)] text-sm max-w-md">{error}</p>
        </div>
      </div>
    );
  }

  const pages: Record<Page, ReactNode> = {
    chat: <WizardChat user={user} />,
    battle: <BattleDashboard />,
    nft: <NftViewer />,
    leaderboard: <Leaderboard />,
  };

  return (
    <NavShell activePage={page} onNavigate={setPage} user={user}>
      {pages[page]}
    </NavShell>
  );
}

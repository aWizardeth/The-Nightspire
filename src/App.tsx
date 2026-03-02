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

type Page = 'wallet' | 'battle' | 'chat' | 'nft' | 'leaderboard';

export default function App() {
  const [page, setPage] = useState<Page>('wallet');
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
    const isDiscordActivityError = error.includes('must be launched from Discord');
    
    return (
      <div className="flex items-center justify-center h-screen px-6 text-center">
        <div className="max-w-lg">
          {isDiscordActivityError ? (
            <>
              <div className="text-6xl mb-4">🧙‍♂️</div>
              <h1 className="text-2xl font-bold text-[var(--text-normal)] mb-4">
                Battle of Wizards
              </h1>
              <p className="text-[var(--text-muted)] mb-6 leading-relaxed">
                This is a Discord Activity that must be launched from within Discord.
              </p>
              <div className="bg-[var(--background-secondary)] border border-[var(--background-modifier-accent)] rounded-lg p-4 text-left text-sm">
                <p className="text-[var(--text-normal)] font-semibold mb-2">To play:</p>
                <ol className="text-[var(--text-muted)] space-y-1 list-decimal list-inside">
                  <li>Open Discord on desktop or mobile</li>
                  <li>Join a server with the Battle of Wizards app</li>
                  <li>Start an Activity and select "Battle of Wizards"</li>
                </ol>
              </div>
            </>
          ) : (
            <>
              <p className="text-[var(--danger)] text-lg font-semibold mb-2">Portal Failed</p>
              <p className="text-[var(--text-muted)] text-sm max-w-md">{error}</p>
            </>
          )}
        </div>
      </div>
    );
  }

  const pages: Record<Page, ReactNode> = {
    wallet: <WalletTab userId={user?.id || ''} />,
    battle: <BattleTab userId={user?.id || ''} />,
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

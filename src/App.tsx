import { useState, useEffect, useRef, type ReactNode } from 'react';
import NavShell from './components/NavShell';
import WizardChat from './components/WizardChat';
import BattleTab from './components/BattleTab';
import WalletTab from './components/WalletTab';
import NftViewer from './components/NftViewer';
import Leaderboard from './components/Leaderboard';
import ChellyzTab from './components/ChellyzTab';
import { WalletConnectProvider } from './providers/WalletConnectProvider';
import { setupDiscordSdk } from './discord';
import { fetchDiscordUser, type DiscordUser } from './auth';
import useBowActivityStore from './store/bowActivityStore';

type Page = 'battle' | 'wallet' | 'chat' | 'nft' | 'leaderboard' | 'chellyz';

export default function App() {
  const [page, setPage] = useState<Page>('battle');
  const [user, setUser] = useState<DiscordUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const setAccessToken = useBowActivityStore((s) => s.setAccessToken);
  const initRef = useRef(false);

  useEffect(() => {
    // Prevent double-init (StrictMode or store-triggered re-render)
    if (initRef.current) return;
    initRef.current = true;

    let cancelled = false;

    async function init() {
      try {
        // Skip Discord SDK in development if not in Discord context
        const urlParams = new URLSearchParams(window.location.search);
        const devMode = urlParams.has('dev') || import.meta.env.DEV;
        const isLocalhost = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1';

        // Allow testing on Vercel with ?dev=true or on localhost
        if (devMode || isLocalhost) {
          console.log('[aWizard] Development mode: skipping Discord SDK');
          console.log('[aWizard] Access with ?dev=true to test features without Discord');
          // Mock user for local testing
          setUser({
            id: 'dev_user_123',
            username: 'DevTester',
            discriminator: '0001',
            avatar: null,
            global_name: 'Developer Tester'
          });
          setAccessToken('mock_dev_token');
          setLoading(false);
          return;
        }

        const { accessToken } = await setupDiscordSdk();
        if (cancelled) return;
        setAccessToken(accessToken);

        const profile = await fetchDiscordUser(accessToken);
        if (cancelled) return;
        setUser(profile);

        console.log(`[aWizard] Activity initialized for Discord user ${profile.id}`);
      } catch (err) {
        console.error('[aWizard]', err);
        if (!cancelled) {
          // Handle Discord detection error specifically
          if (err instanceof Error && err.message.includes('not running in Discord context')) {
            setError('This Activity must be opened from Discord using the /wiz command.');
          } else {
            // Extract useful error info regardless of error shape
            const msg = err instanceof Error
              ? err.message + (err.stack ? '\n' + err.stack : '')
              : JSON.stringify(err, null, 2);
            setError(msg || 'Unknown error (no message)');
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          {/* Debug: show the actual error so we can diagnose */}
          <div
            className="rounded-lg p-3 mb-4 text-left text-xs break-all"
            style={{ background: 'rgba(255,0,0,0.1)', border: '1px solid var(--danger)', color: 'var(--danger)' }}
          >
            <p className="font-bold mb-1">Debug Error:</p>
            <code>{error}</code>
          </div>
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
    chellyz: <ChellyzTab userId={user?.id || ''} userName={user?.global_name ?? user?.username ?? 'Wizard'} />,
  };

  return (
    <WalletConnectProvider>
      <NavShell activePage={page} onNavigate={setPage} user={user}>
        {pages[page]}
      </NavShell>
    </WalletConnectProvider>
  );
}

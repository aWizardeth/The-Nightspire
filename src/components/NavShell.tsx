// ─────────────────────────────────────────────────────────────────
//  NavShell — compact Discord Activity shell
//  · Row 1 (36px): brand left, user centre
//  · Row 2 (40px): tabs + hamburger wallet control on right
//  · Rest: scrollable page content
// ─────────────────────────────────────────────────────────────────
import { useState, useRef, useEffect, type ReactNode } from 'react';
import QRCode from 'react-qr-code';
import type { DiscordUser } from '../auth';
import { useWalletConnect } from '../providers/WalletConnectProvider';

type Page = 'battle' | 'wallet' | 'chat' | 'nft' | 'leaderboard' | 'chellyz' | 'lobby';

interface NavShellProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  user: DiscordUser | null;
  children: ReactNode;
}

const tabs: { id: Page; icon: string; label: string }[] = [
  { id: 'battle',      icon: '⚔️',  label: 'Battle'  },
  { id: 'wallet',      icon: '🔮',  label: 'Wallet'  },
  { id: 'lobby',       icon: '🏟',  label: 'Lobby'   },
  { id: 'chat',        icon: '🧙',  label: 'Wizard'  },
  { id: 'nft',         icon: '🃏',  label: 'NFTs'    },
  { id: 'leaderboard', icon: '🏆',  label: 'Ranks'   },
  { id: 'chellyz',     icon: '🌸',  label: 'Chellyz' },
];

export default function NavShell({ activePage, onNavigate, user, children }: NavShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const {
    session,
    pairingUri,
    fingerprint,
    walletAddress,
    connect,
    disconnect,
    cancelConnect,
    isConnecting,
    clientReady,
  } = useWalletConnect();

  const isConnected = !!session;

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handleCopy = () => {
    if (!pairingUri) return;
    const ta = document.createElement('textarea');
    ta.value = pairingUri;
    ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { document.execCommand('copy'); } catch { /* blocked */ }
    document.body.removeChild(ta);
    if (navigator.clipboard) navigator.clipboard.writeText(pairingUri).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="flex flex-col"
      style={{ height: '100dvh', background: 'var(--bg-deep)', overflow: 'hidden' }}
    >
      {/* ── Row 1: brand + username ─────────────────────────── */}
      <header
        className="flex items-center justify-between px-3 flex-shrink-0"
        style={{
          height: 36,
          background: 'var(--bg-card)',
          borderBottom: '1px solid rgba(0,217,255,0.15)',
        }}
      >
        <span
          className="text-sm font-bold tracking-wide whitespace-nowrap"
          style={{ color: 'var(--text-color)', textShadow: '0 0 8px var(--glow-inner)' }}
        >
          ⚔️ BOW
        </span>
        {user && (
          <span
            className="flex-1 text-center text-xs truncate px-2"
            style={{ color: 'var(--text-muted)' }}
          >
            {user.global_name ?? user.username}
          </span>
        )}
        {/* right-side spacer so username stays centred */}
        <span style={{ width: 30, flexShrink: 0 }} />
      </header>

      {/* ── Row 2: tabs + hamburger ─────────────────────────── */}
      <div
        ref={menuRef}
        className="flex flex-shrink-0 items-stretch"
        style={{
          height: 40,
          background: 'var(--bg-card)',
          borderBottom: '1px solid rgba(0,217,255,0.25)',
          position: 'relative',
        }}
      >
        {/* Tabs */}
        {tabs.map(({ id, icon, label }) => {
          const active = activePage === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5"
              style={{
                background: 'none',
                border: 'none',
                borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'border-color 0.15s',
              }}
            >
              <span style={{ fontSize: 15, filter: active ? 'drop-shadow(0 0 5px #00d9ff)' : 'none', lineHeight: 1 }}>
                {icon}
              </span>
              <span
                style={{
                  fontSize: '0.58rem',
                  color: active ? 'var(--accent)' : 'var(--text-muted)',
                  fontWeight: active ? 700 : 400,
                  lineHeight: 1,
                }}
              >
                {label}
              </span>
            </button>
          );
        })}

        {/* Hamburger — wallet control */}
        <div className="flex items-center justify-center flex-shrink-0 px-2" style={{ position: 'relative' }}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Wallet menu"
            style={{
              width: 30,
              height: 30,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              borderRadius: 6,
              border: isConnected ? '1px solid #4ade80' : '1px solid rgba(255,255,255,0.18)',
              background: isConnected ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.06)',
              boxShadow: isConnected ? '0 0 10px rgba(74,222,128,0.5)' : 'none',
              cursor: 'pointer',
              transition: 'box-shadow 0.3s',
            }}
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{ display: 'block', width: 13, height: 2, borderRadius: 1, background: isConnected ? '#4ade80' : 'var(--text-color)' }}
              />
            ))}
          </button>

          {/* Wallet dropdown */}
          {menuOpen && (
            <div
              className="absolute right-0 rounded-xl"
              style={{
                top: 36,
                width: 272,
                background: 'var(--bg-card)',
                border: '1px solid rgba(0,217,255,0.35)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 24px rgba(0,217,255,0.12)',
                zIndex: 100,
              }}
            >
              <div className="p-3 space-y-3">

                {/* Status pill */}
                <div className="flex items-center gap-2">
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: isConnected ? '#4ade80' : '#f23f42', boxShadow: isConnected ? '0 0 6px #4ade80' : '0 0 6px #f23f42', flexShrink: 0 }} />
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-color)' }}>
                    {isConnected ? 'Sage Connected' : 'Wallet Disconnected'}
                  </span>
                </div>

                {/* Connected */}
                {isConnected && (
                  <>
                    {(fingerprint || walletAddress) && (
                      <div className="rounded-lg p-2 text-xs font-mono space-y-0.5" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(0,217,255,0.2)', color: 'var(--text-muted)' }}>
                        {fingerprint && <div>🔑 {fingerprint}</div>}
                        {walletAddress && <div className="truncate">📍 {walletAddress.slice(0, 22)}…</div>}
                      </div>
                    )}
                    <button
                      onClick={() => { disconnect(); setMenuOpen(false); }}
                      className="w-full py-2 rounded-lg text-sm font-semibold"
                      style={{ background: 'rgba(242,63,66,0.12)', border: '1px solid var(--danger)', color: 'var(--danger)', cursor: 'pointer' }}
                    >
                      🔌 Disconnect
                    </button>
                  </>
                )}

                {/* QR / pairing */}
                {!isConnected && pairingUri && (
                  <>
                    <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                      Scan with <strong style={{ color: '#00d9ff' }}>Sage mobile</strong> or paste URI in <strong style={{ color: '#00d9ff' }}>Sage desktop</strong>
                    </p>
                    <div className="flex justify-center">
                      <div className="p-2 rounded-lg" style={{ background: '#fff' }}>
                        <QRCode value={pairingUri} size={152} />
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <input readOnly value={pairingUri} onFocus={(e) => e.target.select()} className="flex-1 rounded px-2 py-1 text-xs font-mono truncate" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid var(--border-color)', color: 'var(--text-color)', outline: 'none', minWidth: 0 }} />
                      <button onClick={handleCopy} className="flex-shrink-0 px-2.5 py-1 rounded text-xs font-bold" style={{ background: copied ? '#10b981' : '#00d9ff', color: '#000', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        {copied ? '✓' : '📋'}
                      </button>
                    </div>
                    <button onClick={cancelConnect} className="w-full py-1.5 rounded-lg text-sm" style={{ background: 'transparent', border: '1px solid rgba(255,100,100,0.4)', color: '#ff8080', cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </>
                )}

                {/* Generating */}
                {!isConnected && !pairingUri && isConnecting && (
                  <div className="text-center py-2">
                    <p className="text-sm" style={{ color: '#00d9ff' }}>⚡ Generating pairing code…</p>
                  </div>
                )}

                {/* Connect button */}
                {!isConnected && !pairingUri && !isConnecting && (
                  <button
                    onClick={() => connect()}
                    disabled={!clientReady}
                    className="w-full py-2.5 rounded-lg text-sm font-bold"
                    style={{
                      background: !clientReady ? 'rgba(60,60,60,0.6)' : 'linear-gradient(135deg, #00d9ff, #ff6600)',
                      color: '#fff',
                      border: !clientReady ? '1px solid rgba(255,255,255,0.15)' : '2px solid rgba(255,255,255,0.3)',
                      boxShadow: !clientReady ? 'none' : '0 0 16px rgba(0,217,255,0.4)',
                      cursor: !clientReady ? 'not-allowed' : 'pointer',
                      opacity: !clientReady ? 0.5 : 1,
                    }}
                  >
                    {!clientReady ? '⏳ Initializing…' : '🔗 Connect Sage Wallet'}
                  </button>
                )}

              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Page content ───────────────────────────────────── */}
      <main
        className="flex-1 overflow-y-auto"
        style={{ padding: '8px 8px 4px' }}
      >
        {children}
      </main>
    </div>
  );
}

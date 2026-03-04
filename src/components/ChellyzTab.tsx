/**
 * ChellyzTab.tsx
 * Full Chellyz card game board UI for the Discord Activity.
 *
 * Board layout (local player = bottom):
 *   ┌─ opponent bench row (top) ─────────────────────────────┐
 *   │  [OBench0]  [OBench1]  [OBench2]   [EBDeck] [DrawDeck] │
 *   │  [OSupport] [OActive]  [OEnergy]                        │
 *   ├─ divider ──────────────────────────────────────────────┤
 *   │  [MySupport][MyActive] [MyEnergy]                       │
 *   │  [Bench0]   [Bench1]   [Bench2]    [EBDeck] [DrawDeck]  │
 *   ├─ hand ─────────────────────────────────────────────────┤
 *   │  scrollable hand cards                                  │
 *   ├─ actions ──────────────────────────────────────────────┤
 *   │  phase-aware buttons                                    │
 *   └─ log ──────────────────────────────────────────────────┘
 */

import { useState, useEffect, useRef } from 'react';
import {
  useChellyzStore,
  selectIsMyTurn,
  selectLocalPlayer,
  selectOpponent,
  selectPhase,
  selectWinner,
  selectLog,
} from '../store/chellyzStore';
import type { ChellyzCard } from '../lib/chellyzCards';
import type { TurnPhase } from '../lib/chellyzEngine';
import useBowActivityStore from '../store/bowActivityStore';
import useChellyzLobbyStore from '../store/chellyzLobbyStore';
import { useWalletConnect } from '../providers/WalletConnectProvider';
import { useIsMobile } from '../hooks/useIsMobile';

// CSS variable names for responsive card sizes — injected by GameBoard via style prop
// Desktop:  sm=101×129  md=120×148  hand=120×123  deck=40×56
// Mobile:   sm=62×80    md=74×96    hand=74×80    deck=32×42

// ─── Prop types ───────────────────────────────────────────────────────────────

interface ChellyzTabProps {
  userId: string;
  userName?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ELEMENT_COLOR: Record<string, string> = {
  Fire:        'bg-orange-500/80 border-orange-400',
  Water:       'bg-blue-500/80 border-blue-400',
  Nature:      'bg-green-500/80 border-green-400',
  Electric:    'bg-yellow-400/80 border-yellow-300',
  Shadow:      'bg-purple-700/80 border-purple-500',
  Ice:         'bg-cyan-400/80 border-cyan-300',
  Spirit:      'bg-pink-400/80 border-pink-300',
  Arcane:      'bg-indigo-500/80 border-indigo-400',
  Corruption:  'bg-red-900/80 border-red-700',
  Neutral:     'bg-zinc-600/80 border-zinc-500',
};

const PHASE_LABEL: Record<TurnPhase, string> = {
  draw:         'Draw Phase',
  sacrifice:    'Sacrifice Phase',
  evolution:    'Evolution Phase',
  retreat:      'Retreat Phase',
  bench_swap:   'Bench Swap Phase',
  bench_fill:   'Bench Fill Phase',
  support_prep: 'Support Prep Phase',
  action:       'Action Phase',
  piercing_roll:'Piercing Roll',
  end:          'End Turn',
  coin_flip:    'Coin Flip',
  finished:     'Game Over',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

interface CardSlotProps {
  card:       ChellyzCard | null;
  label?:     string;
  size?:      'sm' | 'md';
  highlight?: boolean;
  onClick?:   () => void;
  flipped?:   boolean;
}

function CardSlot({ card, label, size = 'md', highlight, onClick, flipped }: CardSlotProps) {
  const sizeStyle: React.CSSProperties = size === 'sm'
    ? { width: 'var(--cz-sm-w)', height: 'var(--cz-sm-h)' }
    : { width: 'var(--cz-md-w)', height: 'var(--cz-md-h)' };
  const colorCls = card ? (ELEMENT_COLOR[card.element] ?? ELEMENT_COLOR['Neutral']) : 'bg-zinc-800/60 border-zinc-600';
  const ringCls  = highlight ? 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-zinc-900' : '';
  const [imgError, setImgError] = useState(false);

  return (
    <div className="flex flex-col items-center gap-0.5">
      {label && <span className="text-[9px] text-zinc-400 uppercase tracking-wide">{label}</span>}
      <button
        onClick={onClick}
        disabled={!onClick}
        style={sizeStyle}
        className={`rounded border ${colorCls} ${ringCls} relative overflow-hidden flex flex-row items-stretch cursor-pointer select-none transition-all hover:brightness-110 disabled:cursor-default`}
      >
        {flipped ? (
          <span className="text-zinc-500 text-[9px] m-auto">🂠</span>
        ) : card ? (
          <>
            {/* Image fills full height on left */}
            {card.imageUri && !imgError ? (
              <img
                src={card.imageUri}
                alt={card.name}
                className="h-full object-cover rounded-sm bg-black/30 shrink-0"
                style={{ width: '55%' }}
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="flex items-center justify-center bg-black/20 shrink-0" style={{ width: '55%' }}>
                <span className="text-base leading-none">
                  {card.type === 'memory_artifact' ? '📜' : card.type === 'flash_relic' ? '⚡' : card.type === 'energy_bloom' ? '🌸' : '🔮'}
                </span>
              </div>
            )}
            {/* Stats strip on right */}
            <div className="flex flex-col justify-end p-0.5 flex-1 min-w-0 overflow-hidden">
              <p className="text-[8px] font-bold text-white leading-tight" style={{ wordBreak: 'break-word', hyphens: 'auto' }}>{card.name}</p>
            {card.stats && (
                <p className="text-[8px] text-zinc-200 leading-tight">❤{card.currentHp}/{card.stats.maxHp}</p>
              )}
            </div>
          </>
        ) : (
          <span className="text-zinc-600 text-[9px] m-auto">—</span>
        )}
      </button>
    </div>
  );
}

function HPBar({ current, max }: { current: number; max: number }) {
  const pct = Math.min(100, Math.round((current / max) * 100));
  const color = pct > 60 ? 'bg-green-500' : pct > 30 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="w-full h-1 bg-zinc-700 rounded-full overflow-hidden mt-0.5">
      <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function EnergyZone({ count, max = 7 }: { count: number; max?: number }) {
  return (
    <div className="flex flex-col items-center justify-between gap-0.5" style={{ height: '100%' }}>
      <span className="text-[8px] text-zinc-400 uppercase tracking-wide">EB</span>
      <div className="flex flex-col gap-0.5 items-center">
        {Array.from({ length: max }).map((_, i) => (
          <div key={i} className={`w-2 h-2 rounded-full border ${i < count ? 'bg-emerald-400 border-emerald-300' : 'bg-zinc-700 border-zinc-600'}`} />
        ))}
      </div>
      <span className="text-[8px] text-emerald-400 font-bold">{count}/{max}</span>
    </div>
  );
}

function DeckPile({ count, label, color = 'bg-zinc-700' }: { count: number; label: string; color?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[9px] text-zinc-400 uppercase">{label}</span>
      <div
        className={`rounded border border-zinc-600 ${color} flex items-center justify-center`}
        style={{ width: 'var(--cz-deck-w)', height: 'var(--cz-deck-h)' }}
      >
        <span className="text-xs font-bold text-white">{count}</span>
      </div>
    </div>
  );
}

// ─── In-game Wizard Hint ──────────────────────────────────────────────────────

function WizardHint() {
  const myPlayer  = useChellyzStore(selectLocalPlayer);
  const oppPlayer = useChellyzStore(selectOpponent);
  const phase     = useChellyzStore(selectPhase);
  const isMyTurn  = useChellyzStore(selectIsMyTurn);
  const log       = useChellyzStore(selectLog);

  const [hint, setHint]       = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Auto-dismiss after 10s
  useEffect(() => {
    if (!hint) return;
    const t = setTimeout(() => setHint(null), 10000);
    return () => clearTimeout(t);
  }, [hint]);

  const askWizard = async () => {
    if (loading || !myPlayer || !oppPlayer) return;
    setLoading(true);
    setHint(null);
    try {
      const gameContext = {
        gameType:      'Chellyz',
        phase,
        isMyTurn,
        myActive:      myPlayer.active?.name ?? 'none',
        myActiveHp:    myPlayer.active?.currentHp ?? 0,
        myActiveMaxHp: myPlayer.active?.stats?.maxHp ?? 0,
        myEnergy:      myPlayer.energy.length,
        myHandCount:   myPlayer.hand.length,
        myBench:       myPlayer.bench.filter(Boolean).map((c) => c!.name).join(', ') || 'empty',
        oppActive:     oppPlayer.active?.name ?? 'none',
        oppActiveHp:   oppPlayer.active?.currentHp ?? 0,
        oppActiveMaxHp:oppPlayer.active?.stats?.maxHp ?? 0,
        recentLog:     log.slice(-2).join(' | '),
      };

      const res = await fetch('/api/wizard', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message:     'What should I do next? Give me one tactical suggestion.',
          gameContext,
          discordContext: { username: 'Wizard' },
        }),
      });
      const data = await res.json() as { reply?: string };
      setHint(data.reply ?? '🧙 The wizard is lost in thought…');
    } catch {
      setHint('⚠️ A curse disrupted the wizard.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex justify-end items-center">
      <button
        onClick={askWizard}
        disabled={loading}
        title="Ask the wizard for a hint"
        className="text-base leading-none disabled:opacity-50 transition-opacity hover:scale-110 active:scale-95"
      >
        {loading ? '⏳' : '🧙'}
      </button>
      {hint && (
        <div
          className="absolute bottom-7 right-0 w-56 rounded-lg p-2 text-[10px] leading-relaxed z-30 cursor-pointer"
          style={{ background: 'rgba(30,10,60,0.97)', border: '1px solid rgba(139,92,246,0.6)', color: '#e2d9f3' }}
          onClick={() => setHint(null)}
        >
          <span className="block mb-0.5 text-purple-400 font-bold text-[9px] uppercase tracking-wide">🧙 Wizard Hint</span>
          {hint}
          <span className="block mt-1 text-[8px] text-zinc-600">tap to dismiss</span>
        </div>
      )}
    </div>
  );
}

// ─── Dice animation overlay ───────────────────────────────────────────────────

function DiceOverlay({ roll, onDone }: { roll: number; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1600);
    return () => clearTimeout(t);
  }, [onDone]);
  const faces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  return (
    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-50 gap-2 animate-fade-in">
      <span className="text-6xl animate-bounce">{faces[roll - 1]}</span>
      <p className="text-white font-bold text-lg">Rolled: {roll}</p>
      <p className="text-zinc-400 text-sm">{roll >= 6 ? 'Critical Piercing!' : roll >= 4 ? 'Piercing Hit!' : 'No Effect'}</p>
    </div>
  );
}

function CoinOverlay({ result, onDone }: { result: 'heads' | 'tails'; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1600);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-50 gap-2">
      <span className="text-6xl animate-spin">{result === 'heads' ? '🟡' : '⚫'}</span>
      <p className="text-white font-bold text-xl capitalize">{result}!</p>
    </div>
  );
}

// ─── Invite code pill ────────────────────────────────────────────────────────

function InviteCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const ta = document.createElement('textarea');
    ta.value = code;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta); ta.focus(); ta.select();
    try { document.execCommand('copy'); } catch { /* noop */ }
    document.body.removeChild(ta);
    if (navigator.clipboard) navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg px-3 py-2"
      style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.4)' }}>
      <span className="text-xl font-bold tracking-[0.3em] text-purple-300">{code}</span>
      <button onClick={copy} className="text-[11px] font-bold px-2 py-1 rounded transition-all"
        style={{
          background: copied ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.07)',
          border: `1px solid ${copied ? 'rgba(74,222,128,0.5)' : 'rgba(255,255,255,0.15)'}`,
          color: copied ? '#4ade80' : '#8ba3b0',
        }}>
        {copied ? '✓ Copied' : 'Copy'}
      </button>
    </div>
  );
}

// ─── Chellyz PvP Lobby Panel ──────────────────────────────────────────────────

interface ChellyzPvpLobbyPanelProps {
  userId:   string;
  userName: string;
  onBack:   () => void;
}

interface PublicLobbyEntry {
  code:      string;
  hostId:    string;
  hostName:  string;
  createdAt: number;
  gameType?: string;
}

function ChellyzPvpLobbyPanel({ userId, userName, onBack }: ChellyzPvpLobbyPanelProps) {
  const lobby = useChellyzLobbyStore();
  const nfts  = useBowActivityStore((s) => s.wallet.nfts);
  const { session, walletAddress, fingerprint, connect, isConnecting, clientReady, wcRequest } = useWalletConnect();

  const address   = walletAddress ?? (fingerprint ? `xch1${fingerprint}` : null);
  const hasWallet = !!session;

  const [joinCode, setJoinCode]     = useState('');
  const [makePublic, setMakePublic] = useState(false);
  const [publicLobbies, setPublicLobbies] = useState<PublicLobbyEntry[]>([]);
  const [loadingBrowser, setLoadingBrowser] = useState(false);

  // Refresh public lobby list when idle
  useEffect(() => {
    if (lobby.step !== 'idle') return;
    let cancelled = false;
    setLoadingBrowser(true);
    fetch('/api/lobbies')
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          // Only show Chellyz lobbies in the Chellyz browser
          const all = (data.lobbies ?? []) as PublicLobbyEntry[];
          setPublicLobbies(all.filter((l) => l.gameType === 'chellyz' || !l.gameType));
        }
      })
      .catch(() => { if (!cancelled) setPublicLobbies([]); })
      .finally(() => { if (!cancelled) setLoadingBrowser(false); });
    return () => { cancelled = true; };
  }, [lobby.step]);

  const handleCreate = () => {
    lobby.createLobby(makePublic, userId, userName);
  };

  const handleJoin = () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) return;
    lobby.joinLobby(code);
  };

  const handleConfirmReady = () => {
    if (!address) return;
    lobby.confirmReady(address, { request: wcRequest }, userId, nfts.length ? nfts : null);
  };

  // === OPEN state — game starts automatically from root ChellyzTab useEffect ===
  if (lobby.step === 'open') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-4 h-full">
        <div className="text-4xl">🌸</div>
        <p className="text-sm font-bold text-purple-300">Channel Open!</p>
        <p className="text-xs text-zinc-400 text-center">Preparing your Chellyz decks and starting the match…</p>
        <div className="flex gap-1">
          <span className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    );
  }

  // === SETTLING state ===
  if (lobby.step === 'settling') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-4 h-full">
        <div className="text-4xl animate-pulse">⚖️</div>
        <p className="text-sm font-bold text-purple-300">Settling…</p>
        <p className="text-xs text-zinc-400">Broadcasting settlement to the Chia network.</p>
      </div>
    );
  }

  // === ERROR state ===
  if (lobby.step === 'error') {
    return (
      <div className="flex flex-col items-center gap-3 p-4">
        <p className="text-xs text-red-400 text-center">⚠️ {lobby.errorMsg}</p>
        <div className="flex gap-2">
          <button onClick={lobby.reset} className="px-3 py-1.5 rounded text-xs font-bold bg-zinc-800 border border-zinc-600 text-zinc-300">Try Again</button>
          <button onClick={onBack}     className="px-3 py-1.5 rounded text-xs font-bold bg-zinc-800 border border-zinc-600 text-zinc-300">Back</button>
        </div>
      </div>
    );
  }

  // === PENDING / SIGNING / WAITING_PEER / BROADCASTING ===
  if (lobby.step !== 'idle') {
    const isCreator  = lobby.role === 'creator';
    const isSigning  = lobby.step === 'signing';
    const isWaiting  = lobby.step === 'waiting_peer' || lobby.step === 'broadcasting';

    return (
      <div className="flex flex-col gap-3 p-4">
        {/* Deck preview */}
        <div className="rounded-lg p-2 text-xs text-center"
          style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', color: '#c4b5fd' }}>
          {nfts.length > 0
            ? `✨ ${nfts.length} NFT deck ready`
            : '📦 Starter deck will be used'}
        </div>

        {/* Invite code (creator only) */}
        {isCreator && lobby.inviteCode && (
          <div className="space-y-1">
            <p className="text-[11px] text-zinc-400 text-center">Share this code with your opponent</p>
            <InviteCode code={lobby.inviteCode} />
          </div>
        )}

        {/* Joined banner */}
        {lobby.opponentJoined && (
          <div className="rounded-lg px-3 py-2 text-xs text-center animate-pulse"
            style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.4)', color: '#4ade80' }}>
            ✨ Opponent has joined! Tap "I'm Ready" to lock in your deck.
          </div>
        )}

        {/* Status */}
        <div className="text-center text-[11px] text-zinc-400">
          {isSigning  && '⏳ Awaiting wallet signature…'}
          {isWaiting  && (isCreator ? 'Signed! Waiting for opponent to confirm…' : '⚡ Submitting to the Chia network…')}
          {lobby.step === 'pending' && (isCreator ? 'Waiting for opponent to join…' : `Joined lobby ${lobby.inviteCode}`)}
        </div>

        {/* I'm Ready button */}
        {lobby.step === 'pending' && (
          hasWallet ? (
            <button
              onClick={handleConfirmReady}
              className="w-full py-2 rounded-lg text-sm font-bold"
              style={{ background: 'linear-gradient(135deg, #9333ea, #6366f1)', color: '#fff', border: '1px solid rgba(147,51,234,0.5)' }}
            >
              🌸 I'm Ready — Lock in Deck
            </button>
          ) : (
            <button
              onClick={() => connect()}
              disabled={!clientReady || isConnecting}
              className="w-full py-2.5 rounded-lg text-sm font-bold"
              style={{ background: !clientReady ? 'rgba(60,60,60,0.6)' : 'linear-gradient(135deg, #00d9ff, #9333ea)', color: '#fff', border: '2px solid rgba(255,255,255,0.2)', cursor: !clientReady ? 'not-allowed' : 'pointer', opacity: !clientReady ? 0.5 : 1 }}
            >
              {isConnecting ? '⏳ Connecting…' : '🔗 Connect Wallet to Continue'}
            </button>
          )
        )}

        {/* Waiting spinner */}
        {(isSigning || isWaiting) && (
          <div className="flex justify-center gap-1 py-1">
            {[0,1,2].map((i) => (
              <span key={i} className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </div>
        )}

        <button onClick={() => { lobby.exitLobby(); onBack(); }} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors text-center w-full mt-1">
          ✕ Leave Lobby
        </button>
      </div>
    );
  }

  // === IDLE — lobby browser + create/join ===
  return (
    <div className="flex flex-col gap-3 p-4 overflow-y-auto">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">← Back</button>
        <h3 className="text-sm font-bold text-purple-300">🌸 Chellyz PvP Lobby</h3>
      </div>

      {/* Deck info */}
      {nfts.length > 0 ? (
        <div className="rounded p-2 text-xs text-center"
          style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80' }}>
          ✨ {nfts.length} NFTs loaded — your collection will be your deck
        </div>
      ) : (
        <div className="rounded p-2 text-xs text-center bg-zinc-800 border border-zinc-700 text-zinc-400">
          No NFTs — a Starter Deck will be used. Connect wallet &amp; load fighters first.
        </div>
      )}

      {/* Create lobby */}
      <div className="rounded-lg p-3 space-y-2" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.3)' }}>
        <p className="text-xs font-bold text-purple-300">Create Lobby</p>
        <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
          <input type="checkbox" checked={makePublic} onChange={(e) => setMakePublic(e.target.checked)} className="accent-purple-500" />
          List in public browser
        </label>
        <button onClick={handleCreate}
          className="w-full py-2 rounded text-xs font-bold"
          style={{ background: 'rgba(139,92,246,0.3)', border: '1px solid rgba(139,92,246,0.5)', color: '#e9d5ff', cursor: 'pointer' }}>
          + Create Chellyz Lobby
        </button>
      </div>

      {/* Join by code */}
      <div className="rounded-lg p-3 space-y-2" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.3)' }}>
        <p className="text-xs font-bold text-indigo-300">Join by Code</p>
        <div className="flex gap-2">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
            placeholder="ABC123"
            maxLength={6}
            className="flex-1 rounded px-2 py-1.5 text-sm font-mono text-center uppercase"
            style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(99,102,241,0.4)', color: '#e0f7ff', outline: 'none' }}
          />
          <button
            onClick={handleJoin}
            disabled={joinCode.trim().length !== 6}
            className="px-3 py-1.5 rounded text-xs font-bold"
            style={{ background: joinCode.trim().length === 6 ? 'rgba(99,102,241,0.4)' : 'rgba(60,60,60,0.4)', border: '1px solid rgba(99,102,241,0.4)', color: '#c7d2fe', cursor: joinCode.trim().length === 6 ? 'pointer' : 'not-allowed' }}
          >
            Join
          </button>
        </div>
      </div>

      {/* Public lobby browser */}
      <div>
        <p className="text-[11px] text-zinc-500 mb-1">Public Chellyz Lobbies</p>
        {loadingBrowser ? (
          <p className="text-xs text-zinc-600 text-center">Loading…</p>
        ) : publicLobbies.length === 0 ? (
          <p className="text-xs text-zinc-600 text-center">No open lobbies — create one!</p>
        ) : (
          <div className="space-y-1">
            {publicLobbies.map((l) => (
              <button key={l.code} onClick={() => lobby.joinLobby(l.code)}
                className="w-full flex items-center justify-between rounded px-3 py-2 text-xs transition-all"
                style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', color: 'var(--text-color)' }}>
                <span className="font-semibold">{l.hostName}</span>
                <span className="font-mono text-purple-400 ml-2">{l.code}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Lobby screen ─────────────────────────────────────────────────────────────

function ChellyzLobby({ userId, userName }: { userId: string; userName: string }) {
  const startNewGame  = useChellyzStore((s) => s.startNewGame);
  const enrichImages  = useChellyzStore((s) => s.enrichImages);
  const nfts          = useBowActivityStore((s) => s.wallet.nfts);
  const chellyzLobby  = useChellyzLobbyStore();

  const [mode, setMode] = useState<'ai' | 'hot_seat' | 'pvp'>('ai');

  const handleStart = () => {
    if (mode === 'ai') {
      startNewGame(userName, nfts.length ? nfts : null, 'AI Wizard', null, 'ai');
    } else {
      startNewGame('Player 1', nfts.length ? nfts : null, 'Player 2', null, 'hot_seat');
    }
    void enrichImages();
  };

  // If a PvP lobby is already active (restored from localStorage), jump straight to its panel
  if (chellyzLobby.step !== 'idle') {
    return (
      <div className="h-full overflow-y-auto">
        <ChellyzPvpLobbyPanel
          userId={userId}
          userName={userName}
          onBack={() => { chellyzLobby.exitLobby(); setMode('ai'); }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 p-4 h-full overflow-y-auto">
      <h2 className="text-xl font-bold text-purple-300">🌸 Chellyz</h2>
      <p className="text-sm text-zinc-400 text-center">A card battle game of magic and strategy.</p>

      {nfts.length > 0 ? (
        <div className="bg-emerald-900/30 border border-emerald-700 rounded p-2 text-xs text-emerald-300 text-center w-full max-w-xs">
          ✨ {nfts.length} NFTs detected — your deck will use your collection!
        </div>
      ) : (
        <div className="bg-zinc-800 border border-zinc-700 rounded p-2 text-xs text-zinc-400 text-center w-full max-w-xs">
          No NFTs in wallet — you'll receive a Starter Deck.
        </div>
      )}

      {/* Mode selector */}
      <div className="flex gap-1.5 flex-wrap justify-center">
        {(['ai', 'hot_seat', 'pvp'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 rounded text-xs font-medium border transition-all ${
              mode === m
                ? 'bg-purple-700 border-purple-500 text-white'
                : 'bg-zinc-800 border-zinc-600 text-zinc-300 hover:border-zinc-400'
            }`}
          >
            {m === 'ai' ? '🤖 vs AI' : m === 'hot_seat' ? '👥 Hot Seat' : '🔮 PvP Online'}
          </button>
        ))}
      </div>

      {mode === 'pvp' ? (
        // PvP Online — show lobby panel inline
        <div className="w-full max-w-xs">
          <ChellyzPvpLobbyPanel
            userId={userId}
            userName={userName}
            onBack={() => setMode('ai')}
          />
        </div>
      ) : (
        <button
          onClick={handleStart}
          className="mt-2 px-6 py-2 bg-purple-600 hover:bg-purple-500 rounded font-bold text-white text-sm transition-all"
        >
          Start Game
        </button>
      )}

      <div className="text-xs text-zinc-500 text-center max-w-xs mt-2">
        2-player card game · 50-card decks · First to 4 KOs wins
      </div>
    </div>
  );
}

// ─── Game Over screen ─────────────────────────────────────────────────────────

function GameOverScreen() {
  const winner   = useChellyzStore(selectWinner);
  const game     = useChellyzStore((s) => s.game);
  const resetGame = useChellyzStore((s) => s.resetGame);

  const winnerName = winner ? game?.players[winner].name : null;

  return (
    <div className="flex flex-col items-center gap-4 p-6 h-full justify-center">
      <span className="text-5xl">🏆</span>
      <h2 className="text-xl font-bold text-yellow-300">{winnerName} Wins!</h2>
      <button
        onClick={resetGame}
        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded font-bold text-white text-sm"
      >
        Play Again
      </button>
    </div>
  );
}

// ─── Main game board ──────────────────────────────────────────────────────────

function GameBoard() {
  const store = useChellyzStore();
  const isMyTurn   = useChellyzStore(selectIsMyTurn);
  const myPlayer   = useChellyzStore(selectLocalPlayer);
  const oppPlayer  = useChellyzStore(selectOpponent);
  const phase      = useChellyzStore(selectPhase);
  const log        = useChellyzStore(selectLog);
  const { lastRoll, lastCoinFlip, showingAnimation, clearAnimation, opponentType } = store;

  const lobby = useChellyzLobbyStore();
  const { wcRequest, walletAddress } = useWalletConnect();
  const isPvp = opponentType === 'pvp';

  const isMobile = useIsMobile();
  const cardVars: React.CSSProperties = isMobile
    ? {
        '--cz-sm-w': '62px',  '--cz-sm-h': '80px',
        '--cz-md-w': '74px',  '--cz-md-h': '96px',
        '--cz-hand-w': '74px', '--cz-hand-h': '80px',
        '--cz-deck-w': '32px', '--cz-deck-h': '42px',
      } as React.CSSProperties
    : {
        '--cz-sm-w': '101px', '--cz-sm-h': '129px',
        '--cz-md-w': '120px', '--cz-md-h': '148px',
        '--cz-hand-w': '120px', '--cz-hand-h': '123px',
        '--cz-deck-w': '40px',  '--cz-deck-h': '56px',
      } as React.CSSProperties;

  const logRef = useRef<HTMLDivElement>(null);
  const [selectedHandCard, setSelectedHandCard] = useState<string | null>(null);
  const [pendingEvo, setPendingEvo] = useState<{ targetId: string | null }>({ targetId: null });
  const [logOpen, setLogOpen] = useState(false); // mobile log toggle

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  // After AI turn triggers
  useEffect(() => {
    if (!isMyTurn && opponentType === 'ai' && phase !== 'finished' && phase) {
      const t = setTimeout(() => store.doAiTurn(), 600);
      return () => clearTimeout(t);
    }
  }, [isMyTurn, opponentType, phase]);

  if (!myPlayer || !oppPlayer) return null;

  const handleCardClick = (card: ChellyzCard) => {
    if (!isMyTurn) return;
    if (phase === 'sacrifice' && card.type.startsWith('chelly')) {
      store.doSacrifice(card.instanceId);
      return;
    }
    if (phase === 'evolution') {
      if (!pendingEvo.targetId) {
        // First click must be active or bench card — handled separately
        return;
      }
      // Second click: evo card from hand
      store.doEvolve(pendingEvo.targetId, card.instanceId);
      setPendingEvo({ targetId: null });
      return;
    }
    if (phase === 'bench_fill' && card.type === 'chelly_l1') {
      const emptySlot = myPlayer.bench.findIndex((b) => b === null);
      if (emptySlot !== -1) {
        store.doBenchFill(card.instanceId, emptySlot);
        return;
      }
    }
    if (phase === 'support_prep' && (card.type === 'memory_artifact' || card.isFlashRelic)) {
      store.doPlaySupport(card.instanceId);
      return;
    }
    setSelectedHandCard(card.instanceId === selectedHandCard ? null : card.instanceId);
  };

  const handleFieldCardClick = (card: ChellyzCard) => {
    if (!isMyTurn || !card) return;
    if (phase === 'evolution') {
      setPendingEvo({ targetId: card.instanceId });
      return;
    }
    if (phase === 'retreat') {
      const slot = myPlayer.bench.findIndex((b) => b?.instanceId === card.instanceId);
      if (slot !== -1) {
        store.doRetreat(slot);
      }
    }
  };

  const renderActionButtons = () => {
    if (!isMyTurn) {
      return <p className="text-zinc-500 text-xs italic">Waiting for {oppPlayer.name}…</p>;
    }
    switch (phase) {
      case 'draw':
        return <ActionBtn label="Draw Card 🂠" onClick={store.doDrawPhase} />;
      case 'sacrifice':
        return (
          <div className="flex gap-2 flex-wrap justify-center">
            <p className="text-xs text-zinc-400 w-full text-center">Tap a Chelly in hand to sacrifice → +1 EB (max 2)</p>
            <ActionBtn label="Skip Sacrifice" variant="ghost" onClick={store.doSkipSacrifice} />
          </div>
        );
      case 'evolution':
        return (
          <div className="flex gap-2 flex-wrap justify-center">
            <p className="text-xs text-zinc-400 w-full text-center">
              {pendingEvo.targetId ? 'Now tap an evolution card in your hand' : 'Tap Active/Bench Chelly to evolve, then tap evo card'}
            </p>
            <ActionBtn label="Skip Evolution" variant="ghost" onClick={() => { setPendingEvo({ targetId: null }); store.doSkipEvolution(); }} />
          </div>
        );
      case 'retreat':
        return (
          <div className="flex gap-2 flex-wrap justify-center">
            <p className="text-xs text-zinc-400 w-full text-center">Tap a Bench Chelly to retreat (ends turn)</p>
            <ActionBtn label="Skip Retreat" variant="ghost" onClick={store.doSkipRetreat} />
          </div>
        );
      case 'bench_swap':
        return <ActionBtn label="Skip Bench Swap" variant="ghost" onClick={store.doSkipBenchSwap} />;
      case 'bench_fill':
        return (
          <div className="flex gap-2 flex-wrap justify-center">
            <p className="text-xs text-zinc-400 w-full text-center">Tap a L1 Chelly in hand to fill an empty bench slot</p>
            <ActionBtn label="Skip Bench Fill" variant="ghost" onClick={store.doSkipBenchFill} />
          </div>
        );
      case 'support_prep':
        return (
          <div className="flex gap-2 flex-wrap justify-center">
            <p className="text-xs text-zinc-400 w-full text-center">Tap a Memory Artifact or Flash Relic to play</p>
            <ActionBtn label="Skip Support" variant="ghost" onClick={store.doSkipSupport} />
          </div>
        );
      case 'action':
        return (
          <div className="flex gap-2 flex-wrap justify-center">
            <ActionBtn label="⚔ Normal Attack" onClick={store.doNormalAttack} />
            <ActionBtn
              label={`✨ Special (${myPlayer.active?.stats?.specialCost ?? '?'}EB)`}
              onClick={store.doSpecialAttack}
              disabled={(myPlayer.active?.stats?.specialCost ?? 99) > myPlayer.energy.length}
            />
            <ActionBtn label="End Turn" variant="ghost" onClick={store.doEndTurn} />
          </div>
        );
      case 'piercing_roll':
        return (
          <div className="flex gap-2 flex-wrap justify-center">
            <ActionBtn
              label="🎲 Piercing Roll (1 EB)"
              onClick={store.doPiercingRoll}
              disabled={myPlayer.energy.length < 1}
            />
            <ActionBtn label="Skip & End Turn" variant="ghost" onClick={store.doSkipPiercing} />
          </div>
        );
      case 'end':
        return <ActionBtn label="End Turn" onClick={store.doEndTurn} />;
      default:
        return null;
    }
  };

  return (
    <div
      className="relative flex flex-col h-full bg-zinc-950 text-white overflow-hidden select-none"
      style={cardVars}
    >

      {/* Animation overlays */}
      {showingAnimation && lastRoll !== null && (
        <DiceOverlay roll={lastRoll} onDone={clearAnimation} />
      )}
      {showingAnimation && lastCoinFlip !== null && !lastRoll && (
        <CoinOverlay result={lastCoinFlip} onDone={clearAnimation} />
      )}

      {/* Coin flip screen */}
      {store.game?.status === 'coin_flip' && (
        <div className="absolute inset-0 bg-zinc-950 flex flex-col items-center justify-center gap-4 z-40">
          <h2 className="text-lg font-bold text-purple-300">Who goes first?</h2>
          <button
            onClick={store.doFlip}
            className="px-6 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded"
          >
            🪙 Flip Coin!
          </button>
        </div>
      )}

      {/* Main: board column + log (desktop: side-by-side; mobile: board only with toggle) */}
      <div className={`flex flex-1 min-h-0 overflow-hidden ${isMobile ? 'flex-col' : 'flex-row'}`}>
      {/* Board column */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

      {/* === OPPONENT SIDE === */}
      <div className="flex flex-col gap-1 p-1.5 pb-0.5">
        {/* Opponent info bar */}
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] text-zinc-400">{oppPlayer.name} {oppPlayer.isNftDeck ? '✨' : ''}</span>
          <span className="text-[10px] text-zinc-400">KOs: {oppPlayer.kos}/4  |  Hand: {oppPlayer.hand.length}</span>
        </div>

        {/* Opponent — bench left · zone centre · decks right */}
        <div className="flex items-end justify-between gap-1 w-full px-1">
          {/* Left: bench */}
          <div className="flex items-end gap-1">
            {oppPlayer.bench.map((card, i) => (
              <CardSlot key={i} card={card} label={`B${i}`} size="sm" flipped />
            ))}
          </div>
          {/* Centre: support + active + EB */}
          <div className="flex items-end gap-1">
            <CardSlot card={oppPlayer.support} label="Supp" size="sm" flipped />
            <div className="flex flex-col items-center">
              <CardSlot card={oppPlayer.active} label="Active" />
              {oppPlayer.active?.stats && (
                <HPBar current={oppPlayer.active.currentHp ?? 0} max={oppPlayer.active.stats.maxHp} />
              )}
            </div>
            <div className="flex flex-col items-center justify-center" style={{ height: 'var(--cz-sm-h)' }}>
              <EnergyZone count={oppPlayer.energy.length} />
            </div>
          </div>
          {/* Right: decks */}
          <div className="flex items-end gap-1">
            <DeckPile count={oppPlayer.deck.length} label="DK" />
            <DeckPile count={oppPlayer.ebDeck.length} label="EB" color="bg-emerald-900/60" />
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-purple-900/60 mx-2" />

      {/* === LOCAL PLAYER SIDE === */}
      <div className="flex flex-col gap-1 p-1.5 pt-0.5">
        {/* Me — bench left · zone centre · decks right */}
        <div className="flex items-end justify-between gap-1 w-full px-1">
          {/* Left: bench */}
          <div className="flex items-end gap-1">
            {myPlayer.bench.map((card, i) => (
              <CardSlot
                key={i}
                card={card}
                label={`B${i}`}
                size="sm"
                highlight={phase === 'retreat' && card !== null}
                onClick={() => card && handleFieldCardClick(card)}
              />
            ))}
          </div>
          {/* Centre: support + active + EB */}
          <div className="flex items-end gap-1">
            <CardSlot card={myPlayer.support} label="Supp" size="sm" />
            <div className="flex flex-col items-center">
              <CardSlot
                card={myPlayer.active}
                label="Active"
                highlight={phase === 'evolution' && !pendingEvo.targetId}
                onClick={() => myPlayer.active && handleFieldCardClick(myPlayer.active)}
              />
              {myPlayer.active?.stats && (
                <HPBar current={myPlayer.active.currentHp ?? 0} max={myPlayer.active.stats.maxHp} />
              )}
            </div>
            <div className="flex flex-col items-center justify-center" style={{ height: 'var(--cz-sm-h)' }}>
              <EnergyZone count={myPlayer.energy.length} />
            </div>
          </div>
          {/* Right: decks */}
          <div className="flex items-end gap-1">
            <DeckPile count={myPlayer.deck.length} label="DK" />
            <DeckPile count={myPlayer.ebDeck.length} label="EB" color="bg-emerald-900/60" />
          </div>
        </div>

        {/* Me info bar */}
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] text-zinc-400">{myPlayer.name} {myPlayer.isNftDeck ? '✨' : ''}</span>
          <span className="text-[10px] text-zinc-400">KOs: {myPlayer.kos}/4  |  Turn {store.game?.turnNumber ?? 1}</span>
        </div>
      </div>

      {/* === HAND === */}
      <div className="border-t border-zinc-800 mx-2" />
      <div className="flex gap-1 overflow-x-auto px-2 py-1 min-h-[84px] scrollbar-hide">
        {myPlayer.hand.map((card) => {
          const isSelected = selectedHandCard === card.instanceId;
          const colorCls = ELEMENT_COLOR[card.element] ?? ELEMENT_COLOR['Neutral'];
          return (
            <button
              key={card.instanceId}
              onClick={() => isMyTurn && handleCardClick(card)}
              style={{ width: 'var(--cz-hand-w)', height: 'var(--cz-hand-h)', flexShrink: 0 }}
              className={`rounded border ${colorCls} ${isSelected ? 'ring-2 ring-yellow-400 -translate-y-2' : ''} flex flex-row items-stretch overflow-hidden transition-all`}
            >
              {/* Image fills height */}
              {card.imageUri ? (
                <img
                  src={card.imageUri}
                  alt={card.name}
                  className="h-full object-cover rounded-sm bg-black/30 shrink-0"
                  style={{ width: '55%' }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="flex items-center justify-center bg-black/20 shrink-0" style={{ width: '55%' }}>
                  <span className="text-base">
                    {card.type === 'memory_artifact' ? '📜' : card.type === 'flash_relic' ? '⚡' : card.type === 'energy_bloom' ? '🌸' : '🔮'}
                  </span>
                </div>
              )}
              {/* Stats strip */}
              <div className="flex flex-col justify-end p-0.5 flex-1 min-w-0 overflow-hidden">
                <p className="text-[8px] font-bold text-white leading-tight" style={{ wordBreak: 'break-word' }}>{card.name}</p>
                <p className="text-[8px] text-zinc-300 leading-tight">{card.element}</p>
                {card.stats && <p className="text-[8px] text-zinc-200 leading-tight">❤{card.stats.hp}</p>}
              </div>
            </button>
          );
        })}
        {myPlayer.hand.length === 0 && (
          <p className="text-zinc-600 text-xs italic m-auto">No cards in hand</p>
        )}
      </div>

      {/* === ACTIONS === */}
      <div className="border-t border-zinc-800 mx-2" />
      <div className="px-2 py-1 flex items-start">
        {phase && (
          <div className="flex flex-col items-center gap-1 flex-1">
            <span className="text-[9px] text-purple-400 uppercase tracking-wide">
              {isMyTurn ? `Your turn — ${PHASE_LABEL[phase]}` : `${oppPlayer.name}'s turn`}
            </span>
            {renderActionButtons()}
          </div>
        )}
        <WizardHint />
      </div>

      {/* PvP settle / forfeit panel */}
      {isPvp && lobby.step === 'open' && phase !== 'coin_flip' && (
        <div className="border-t border-zinc-800 px-2 py-1.5 flex gap-1.5 flex-wrap justify-center shrink-0">
          {phase === 'finished' ? (
            <>
              <ActionBtn label="🏆 Settle Win"  onClick={() => lobby.settlePvpBattle({ request: wcRequest }, 'win',  walletAddress ?? undefined)} />
              <ActionBtn label="💀 Settle Loss" onClick={() => lobby.settlePvpBattle({ request: wcRequest }, 'loss', walletAddress ?? undefined)} />
              <ActionBtn label="⚖️ Draw"        onClick={() => lobby.settlePvpBattle({ request: wcRequest }, 'draw', walletAddress ?? undefined)} />
            </>
          ) : (
            <ActionBtn variant="ghost" label="🏳️ Forfeit" onClick={() => lobby.settlePvpBattle({ request: wcRequest }, 'forfeit', walletAddress ?? undefined)} />
          )}
        </div>
      )}
      {isPvp && lobby.step === 'settling' && (
        <div className="border-t border-zinc-800 px-2 py-2 text-center text-xs text-purple-400 animate-pulse shrink-0">
          ⚖️ Settling on-chain…
        </div>
      )}

      </div>{/* end board column */}

      {/* Log — desktop: right sidebar; mobile: collapsible bottom strip */}
      {isMobile ? (
        <div className="border-t border-zinc-800 shrink-0">
          <button
            onClick={() => setLogOpen((o) => !o)}
            className="w-full flex items-center justify-between px-3 py-1 text-[10px] text-zinc-500 hover:text-zinc-400"
          >
            <span>📜 Battle Log ({log.length})</span>
            <span>{logOpen ? '▾' : '▸'}</span>
          </button>
          {logOpen && (
            <div ref={logRef} className="max-h-24 overflow-y-auto px-2 pb-1 scrollbar-hide">
              {log.slice(-20).map((entry, i) => (
                <p key={i} className="text-[10px] text-zinc-400 leading-relaxed">{entry}</p>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col border-l border-zinc-800 overflow-hidden shrink-0" style={{ width: 154 }}>
          <p className="text-[12px] text-zinc-500 uppercase tracking-wide px-1.5 pt-1 pb-0.5 shrink-0">📜 Log</p>
          <div ref={logRef} className="flex-1 overflow-y-auto px-1 py-0.5 scrollbar-hide">
            {log.slice(-40).map((entry, i) => (
              <p key={i} className="text-[12px] text-zinc-400 leading-relaxed">{entry}</p>
            ))}
          </div>
        </div>
      )}

      </div>{/* end main flex row */}
    </div>
  );
}

// ─── Action button ────────────────────────────────────────────────────────────

function ActionBtn({
  label, onClick, variant = 'primary', disabled = false,
}: {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'ghost';
  disabled?: boolean;
}) {
  const cls = variant === 'primary'
    ? 'bg-purple-700 hover:bg-purple-600 text-white border-purple-600'
    : 'bg-transparent hover:bg-zinc-800 text-zinc-400 border-zinc-700';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-2 py-1 rounded text-[10px] font-medium border ${cls} disabled:opacity-40 disabled:cursor-not-allowed transition-all`}
    >
      {label}
    </button>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────

export default function ChellyzTab({ userId, userName = 'Wizard' }: ChellyzTabProps) {
  const chStore  = useChellyzStore();
  const game     = useChellyzStore((s) => s.game);
  const winner   = useChellyzStore(selectWinner);
  const nfts     = useBowActivityStore((s) => s.wallet.nfts);
  const lobby    = useChellyzLobbyStore();

  const pvpAutoStarted = useRef(false);

  // Auto-start Chellyz game when the PvP channel opens
  useEffect(() => {
    if (lobby.step !== 'open') { pvpAutoStarted.current = false; return; }
    if (pvpAutoStarted.current || !!game) return;
    pvpAutoStarted.current = true;
    chStore.startNewGame(
      userName,
      lobby.myDeck ?? (nfts.length ? nfts : null),
      'Opponent',
      lobby.opponentDeck ?? null,
      'pvp',
    );
    void chStore.enrichImages();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobby.step, lobby.opponentDeck]);

  if (!game) return <ChellyzLobby userId={userId} userName={userName} />;
  if (winner) return <GameOverScreen />;
  return <GameBoard />;
}

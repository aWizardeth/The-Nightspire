/**
 * LobbyTab.tsx
 * Create or join a battle lobby that opens a Chia state channel.
 *
 * PvE Gym flow:  Create → Sign (WalletConnect) → Gym countersigns → Open
 * PvP flow:      Create → Sign → Waiting peer → Peer joins + signs → Open
 *                Join   → Enter invite code → Sign → Open
 *
 * Wallet must be connected (bowActivityStore.wallet.session) before opening.
 */

import { useState } from 'react';
import { useWalletConnect } from '../providers/WalletConnectProvider';
import useBowActivityStore from '../store/bowActivityStore';
import { useLobbyStore, type LobbyStep, type LobbyMode } from '../store/lobbyStore';
import type { StateChannel } from '../lib/stateChannel';

// ─── Step metadata ────────────────────────────────────────────────────────────

const GYM_STEPS: LobbyStep[] = ['creating', 'signing', 'broadcasting', 'open'];
const PVP_STEPS: LobbyStep[] = ['creating', 'signing', 'waiting_peer', 'open'];

const STEP_LABELS: Record<LobbyStep, string> = {
  idle:         'Ready',
  creating:     'Preparing',
  signing:      'Signing',
  broadcasting: 'Opening',
  waiting_peer: 'Waiting Peer',
  open:         'Open',
  error:        'Error',
};

const STEP_ICONS: Record<LobbyStep, string> = {
  idle:         '🔮',
  creating:     '⚙️',
  signing:      '✍️',
  broadcasting: '📡',
  waiting_peer: '⏳',
  open:         '⚔️',
  error:        '💥',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending:   'bg-yellow-900/50 text-yellow-300 border-yellow-700',
    locked:    'bg-emerald-900/50 text-emerald-300 border-emerald-700',
    active:    'bg-purple-900/50 text-purple-300 border-purple-700',
    settling:  'bg-orange-900/50 text-orange-300 border-orange-700',
    settled:   'bg-blue-900/50 text-blue-300 border-blue-700',
    cancelled: 'bg-zinc-800 text-zinc-400 border-zinc-600',
  };
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${styles[status] ?? styles.pending}`}>
      {status.toUpperCase()}
    </span>
  );
}

function StepBar({ steps, currentStep }: { steps: LobbyStep[]; currentStep: LobbyStep }) {
  const currentIdx = steps.indexOf(currentStep);
  return (
    <div className="flex items-start w-full">
      {steps.map((step, i) => {
        const done   = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={step} className="flex items-start flex-1">
            <div className="flex flex-col items-center flex-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] border transition-all
                ${done   ? 'bg-emerald-600 border-emerald-400 text-white' :
                  active ? 'bg-purple-600 border-purple-400 text-white animate-pulse' :
                           'bg-zinc-800 border-zinc-600 text-zinc-500'}`}
              >
                {done ? '✓' : STEP_ICONS[step]}
              </div>
              <span className={`text-[8px] mt-0.5 text-center leading-tight
                ${active ? 'text-purple-300' : done ? 'text-emerald-400' : 'text-zinc-600'}`}>
                {STEP_LABELS[step]}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-px w-full mt-3 transition-all ${done ? 'bg-emerald-600' : 'bg-zinc-700'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ChannelCard({ channel }: { channel: StateChannel }) {
  const shortId    = channel.channelId.slice(0, 18) + '…';
  // Safe bigint → string display (mojos → XCH, rounded)
  const stakeXch   = Number(channel.partyABalance) / 1_000_000_000_000;
  const totalXch   = Number(channel.totalAmount)   / 1_000_000_000_000;
  return (
    <div
      className="rounded-lg p-3 space-y-1.5 text-xs"
      style={{ background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.3)' }}
    >
      <div className="flex items-center justify-between">
        <span style={{ color: 'var(--text-muted)' }}>Channel</span>
        <code className="text-purple-300 text-[10px]">{shortId}</code>
      </div>
      <div className="flex items-center justify-between">
        <span style={{ color: 'var(--text-muted)' }}>Status</span>
        <StatusBadge status={channel.status} />
      </div>
      <div className="flex items-center justify-between">
        <span style={{ color: 'var(--text-muted)' }}>Your stake</span>
        <span style={{ color: 'var(--text-color)' }}>{stakeXch.toFixed(4)} XCH</span>
      </div>
      <div className="flex items-center justify-between">
        <span style={{ color: 'var(--text-muted)' }}>Total locked</span>
        <span style={{ color: 'var(--text-color)' }}>{totalXch.toFixed(4)} XCH</span>
      </div>
      <div className="flex items-center justify-between">
        <span style={{ color: 'var(--text-muted)' }}>Game type</span>
        <span style={{ color: 'var(--text-color)' }}>{channel.gameType}</span>
      </div>
      <p className="text-[9px] text-zinc-600 pt-1.5 border-t border-zinc-800/60">
        Mini-Eltoo · 2-of-2 BLS · Chia state channel
      </p>
    </div>
  );
}

// ─── LobbyTab ─────────────────────────────────────────────────────────────────

export default function LobbyTab({ userId }: { userId: string }) {
  const { session, walletAddress, fingerprint } = useWalletConnect();
  const wallet  = useBowActivityStore((s) => s.wallet);
  const fighter = wallet.selectedFighter;
  // Use the provider's address (walletAddress) or fall back to fingerprint as presence check
  const address = walletAddress ?? (fingerprint ? `xch1${fingerprint}` : null);
  const noWallet = !session;

  const store      = useLobbyStore();
  const [joinCode, setJoinCode] = useState('');

  const steps     = store.mode === 'gym' ? GYM_STEPS : PVP_STEPS;
  const isIdle    = store.step === 'idle';
  const isActive  = !isIdle && store.step !== 'error';
  const isOpen    = store.step === 'open';
  const isError   = store.step === 'error';
  const isWaiting = store.step === 'waiting_peer';

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!address || !fighter) return;
    if (store.mode === 'gym') {
      await store.openGymLobby(address, session, fighter);
    } else {
      await store.openPvpLobby(address, session, userId);
    }
  };

  const handleJoin = async () => {
    if (!address || joinCode.length !== 6) return;
    await store.joinPvpLobby(joinCode.toUpperCase(), address, session, userId);
  };

  // ── Wallet gate ──────────────────────────────────────────────────────────

  if (noWallet) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
        <span className="text-4xl">🔮</span>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-color)' }}>
          Wallet required
        </p>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Connect your Sage wallet on the <strong>Wallet</strong> tab
          to open a state channel battle lobby.
        </p>
      </div>
    );
  }

  // ── Main layout ──────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3 p-3 h-full overflow-y-auto scrollbar-hide">

      {/* Header */}
      <div>
        <h2 className="font-bold text-sm" style={{ color: 'var(--text-color)' }}>⚔️ Battle Lobby</h2>
        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          Opens a Chia state channel for trustless, on-chain combat
        </p>
      </div>

      {/* Mode selector */}
      {isIdle && (
        <div className="flex gap-2">
          {(['gym', 'pvp'] as LobbyMode[]).map((m) => (
            <button
              key={m}
              onClick={() => store.setMode(m)}
              className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
              style={{
                background: store.mode === m ? 'rgba(139,92,246,0.22)' : 'rgba(255,255,255,0.03)',
                border:     store.mode === m ? '1px solid rgba(139,92,246,0.6)' : '1px solid var(--border-color)',
                color:      store.mode === m ? '#c4b5fd' : 'var(--text-muted)',
              }}
            >
              {m === 'gym' ? '🤖 Gym PvE' : '🧙 PvP 1v1'}
            </button>
          ))}
        </div>
      )}

      {/* Gym tier selector */}
      {isIdle && store.mode === 'gym' && (
        <div>
          <p className="text-[10px] mb-1.5" style={{ color: 'var(--text-muted)' }}>Gym Tier</p>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((t) => (
              <button
                key={t}
                onClick={() => store.setTier(t)}
                className="flex-1 py-1 rounded text-xs font-bold transition-all"
                style={{
                  background: store.selectedTier === t ? 'rgba(245,158,11,0.18)' : 'rgba(255,255,255,0.03)',
                  border:     store.selectedTier === t ? '1px solid rgba(245,158,11,0.5)' : '1px solid var(--border-color)',
                  color:      store.selectedTier === t ? '#fbbf24' : 'var(--text-muted)',
                }}
              >
                T{t}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected fighter badge */}
      {fighter && isIdle && (
        <div
          className="rounded-lg p-2 flex items-center gap-2"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)' }}
        >
          <span className="text-lg">🧙</span>
          <div>
            <p className="text-xs font-bold" style={{ color: 'var(--text-color)' }}>{fighter.name}</p>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {fighter.rarity} · {fighter.strength} · HP {fighter.stats.hp}
            </p>
          </div>
        </div>
      )}

      {/* Stake info */}
      {isIdle && (
        <div
          className="rounded-lg p-2.5 text-[11px]"
          style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.25)' }}
        >
          <p className="font-semibold text-emerald-400 mb-0.5">Battle Stake</p>
          <p style={{ color: 'var(--text-muted)' }}>
            100 TXCH (0.1 XCH) locked per side · settled on-chain after battle
          </p>
        </div>
      )}

      {/* Step progress bar */}
      {!isIdle && (
        <StepBar steps={steps} currentStep={store.step} />
      )}

      {/* Invite code display (PvP party_a waiting) */}
      {isWaiting && store.inviteCode && (
        <div
          className="rounded-lg p-3 text-center space-y-1.5"
          style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.4)' }}
        >
          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            Share this code with your opponent
          </p>
          <p className="text-2xl font-bold text-purple-300 tracking-[0.25em]">
            {store.inviteCode}
          </p>
          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            Waiting for them to join and sign…
          </p>
        </div>
      )}

      {/* Channel info card */}
      {store.channel && (isOpen || isWaiting) && (
        <ChannelCard channel={store.channel} />
      )}

      {/* Error */}
      {isError && (
        <div
          className="rounded-lg p-3 text-xs space-y-1"
          style={{ background: 'rgba(239,68,68,0.09)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171' }}
        >
          <p className="font-bold">Channel error</p>
          <p className="break-all">{store.errorMsg}</p>
          <p className="text-[9px] opacity-60 pt-0.5">Check wallet connection and try again.</p>
        </div>
      )}

      {/* Channel open success */}
      {isOpen && (
        <div
          className="rounded-lg p-2.5 text-xs text-center font-semibold text-emerald-400"
          style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)' }}
        >
          ✅ Channel open — battle can now begin!
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col gap-2 mt-auto pt-1">
        {isIdle && (
          <>
            <button
              onClick={handleCreate}
              disabled={!fighter}
              className="w-full py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-40"
              style={{ background: 'rgba(139,92,246,0.8)', color: 'white', border: 'none' }}
            >
              {store.mode === 'gym'
                ? `🤖 Open Gym Lobby — Tier ${store.selectedTier}`
                : '🧙 Create PvP Lobby'}
            </button>

            {store.mode === 'pvp' && (
              <div className="flex gap-2">
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                  placeholder="INVITE CODE"
                  maxLength={6}
                  className="flex-1 px-3 py-2 rounded-lg text-[11px] font-bold tracking-[0.2em] text-center uppercase outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border:     '1px solid var(--border-color)',
                    color:      'var(--text-color)',
                  }}
                />
                <button
                  onClick={handleJoin}
                  disabled={joinCode.length !== 6}
                  className="px-4 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-40"
                  style={{
                    background: 'rgba(16,185,129,0.18)',
                    border:     '1px solid rgba(16,185,129,0.5)',
                    color:      '#34d399',
                  }}
                >
                  Join
                </button>
              </div>
            )}
          </>
        )}

        {(isActive || isError) && !isOpen && (
          <button
            onClick={store.reset}
            className="w-full py-2 rounded-lg text-xs font-medium transition-all"
            style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}
          >
            {isError ? '↩ Try Again' : '✕ Cancel'}
          </button>
        )}

        {isOpen && (
          <button
            onClick={store.reset}
            className="w-full py-2 rounded-lg text-xs font-medium transition-all"
            style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}
          >
            ↩ New Lobby
          </button>
        )}
      </div>

      {/* Protocol note */}
      <p className="text-[9px] text-center pb-1" style={{ color: 'rgba(255,255,255,0.13)' }}>
        Mini-Eltoo · 2-of-2 BLS · Chia blockchain
      </p>
    </div>
  );
}

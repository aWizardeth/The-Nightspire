/**
 * BattleTab.tsx
 * Unified Battle Arena — PvP state-channel lobby + AI practice.
 *
 * Layout:
 *   · If user has an active AI battle → full-screen BattleInterface
 *   · Otherwise → arena home:
 *       1. (optional) Wallet connect strip — for PvP signing only
 *       2. PvP Lobby panel   — create / join / pending / ready / open
 *       3. AI Practice panel — no wallet, no stake; fight a gym boss
 *       4. Battle log        — shown when it has content
 *
 * Lobby state is persisted to localStorage ('bow-lobby-v1') so users who
 * disconnect can reopen the Activity and resume their pending state channel.
 */

import { useState, useEffect, useRef } from 'react';
import QRCode from 'react-qr-code';
import useBowActivityStore from '../store/bowActivityStore';
import { useWalletConnect } from '../providers/WalletConnectProvider';
import { MOVES, getAvailableMoves, createBattle, PrivacyBattleEngine } from '../lib/battleEngine';
import type { Fighter, MoveKind, BattleState } from '../store/bowActivityStore';
import { useLobbyStore } from '../store/lobbyStore';

interface BattleTabProps {
  userId: string;
}

// ─── InviteCode pill with copy button ────────────────────────────────────────

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
          color: copied ? '#4ade80' : 'var(--text-muted)',
        }}>
        {copied ? '✓ Copied' : 'Copy'}
      </button>
    </div>
  );
}

// ─── PvP Lobby Panel ──────────────────────────────────────────────────────────

interface PublicLobbyEntry {
  code:      string;
  hostId:    string;
  hostName:  string;
  createdAt: number;
}

function PvpLobbyPanel({ userId, reconnected }: { userId: string; reconnected: boolean }) {
  const lobby = useLobbyStore();
  const {
    session, walletAddress, fingerprint,
    connect, cancelConnect, pairingUri, isConnecting, clientReady,
  } = useWalletConnect();

  const [joinCode, setJoinCode]           = useState('');
  const [makePublic, setMakePublic]       = useState(false);
  const [publicLobbies, setPublicLobbies] = useState<PublicLobbyEntry[]>([]);
  const [loadingBrowser, setLoadingBrowser] = useState(false);

  const address   = walletAddress ?? (fingerprint ? `xch1${fingerprint}` : null);
  const hasWallet = !!session;

  // Fetch public lobbies whenever we're on the idle screen
  useEffect(() => {
    if (lobby.step !== 'idle') return;
    let cancelled = false;
    setLoadingBrowser(true);
    fetch('/api/lobbies')
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setPublicLobbies(data.lobbies ?? []); })
      .catch(() => { if (!cancelled) setPublicLobbies([]); })
      .finally(() => { if (!cancelled) setLoadingBrowser(false); });
    return () => { cancelled = true; };
  }, [lobby.step]);

  const handleConfirmReady = () => {
    if (!address) return;
    lobby.confirmReady(address, session, userId);
  };

  const STEP_HEADER: Record<string, string> = {
    pending:      lobby.role === 'creator' ? 'Lobby Created' : 'Lobby Joined',
    signing:      'Signing with Sage…',
    broadcasting: 'Broadcasting…',
    waiting_peer: 'Waiting for Opponent',
    open:         'Channel Open ✅',
    error:        'Channel Error',
  };

  // ── Idle: create / join ────────────────────────────────────────────────────
  if (lobby.step === 'idle') {
    const hostName = (walletAddress ?? fingerprint) ? `${(walletAddress ?? fingerprint)!.slice(0, 8)}…` : 'Anonymous Wizard';
    return (
      <div className="rounded-xl p-3 space-y-3"
        style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.22)' }}>

        {/* Header */}
        <div className="flex items-center gap-2">
          <span className="text-base">🧙</span>
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-color)' }}>PvP 1v1 Lobby</h3>
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>· Chia state channel</span>
        </div>

        {/* Public toggle + Create */}
        <div className="space-y-2">
          <button
            onClick={() => lobby.createLobby(makePublic, userId, hostName)}
            className="w-full py-2 rounded-lg text-xs font-bold transition-all"
            style={{ background: 'rgba(139,92,246,0.18)', border: '1px solid rgba(139,92,246,0.5)', color: '#c4b5fd' }}>
            + Create Lobby
          </button>
          {/* Public toggle */}
          <button
            onClick={() => setMakePublic((p) => !p)}
            className="w-full py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-2 transition-all"
            style={{
              background: makePublic ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.03)',
              border: makePublic ? '1px solid rgba(16,185,129,0.45)' : '1px solid var(--border-color)',
              color: makePublic ? '#34d399' : 'var(--text-muted)',
            }}>
            <span style={{ fontSize: 13 }}>{makePublic ? '🌐' : '🔒'}</span>
            {makePublic ? 'Public — visible in lobby browser' : 'Private — invite-code only'}
          </button>
        </div>

        {/* Join by code */}
        <div className="flex gap-2">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
            placeholder="INVITE CODE"
            maxLength={6}
            className="flex-1 px-3 py-2 rounded-lg text-[11px] font-bold tracking-[0.2em] text-center uppercase outline-none"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)', color: 'var(--text-color)' }}
          />
          <button
            onClick={() => joinCode.length === 6 && lobby.joinLobby(joinCode)}
            disabled={joinCode.length !== 6}
            className="px-4 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-40"
            style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.5)', color: '#34d399' }}>
            Join
          </button>
        </div>

        {/* Public lobby browser */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>
              🌐 Open Lobbies
            </p>
            {loadingBrowser && (
              <div className="w-2.5 h-2.5 rounded-full border border-purple-400 border-t-transparent animate-spin" />
            )}
          </div>
          {publicLobbies.length === 0 && !loadingBrowser ? (
            <p className="text-[10px] text-center py-2" style={{ color: 'rgba(255,255,255,0.2)' }}>
              No public lobbies right now
            </p>
          ) : (
            <div className="space-y-1">
              {publicLobbies.map((pl) => (
                <div key={pl.code}
                  className="flex items-center justify-between rounded-lg px-2 py-1.5"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(139,92,246,0.2)' }}>
                  <div>
                    <span className="text-[11px] font-bold tracking-wider" style={{ color: '#c4b5fd' }}>{pl.code}</span>
                    <span className="text-[10px] ml-2" style={{ color: 'var(--text-muted)' }}>{pl.hostName}</span>
                  </div>
                  <button
                    onClick={() => lobby.joinLobby(pl.code)}
                    className="text-[10px] font-bold px-2 py-0.5 rounded transition-all"
                    style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', color: '#34d399' }}>
                    Join
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Active lobby ───────────────────────────────────────────────────────────
  return (
    <div className="rounded-xl p-3 space-y-3"
      style={{ background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.3)' }}>

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold" style={{ color: 'var(--text-color)' }}>
            🧙 {STEP_HEADER[lobby.step] ?? 'PvP Lobby'}
          </span>
          {reconnected && lobby.step !== 'error' && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
              style={{ background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.4)', color: '#34d399' }}>
              RECONNECTED
            </span>
          )}
        </div>
        {lobby.step !== 'open' && (
          <button
            onClick={lobby.exitLobby}
            className="text-[11px] px-2 py-0.5 rounded transition-all"
            style={{ background: 'rgba(242,63,66,0.12)', border: '1px solid rgba(242,63,66,0.3)', color: '#f87171' }}>
            ✕ Exit Lobby
          </button>
        )}
      </div>

      {/* Invite code */}
      {lobby.inviteCode && lobby.step !== 'open' && (
        <div>
          <p className="text-[10px] mb-1.5" style={{ color: 'var(--text-muted)' }}>
            {lobby.role === 'creator' ? 'Share this code with your opponent:' : 'Your lobby code:'}
          </p>
          <InviteCode code={lobby.inviteCode} />
        </div>
      )}

      {/* Reconnect note */}
      {reconnected && lobby.channel && (
        <div className="rounded-lg p-2 text-[10px]"
          style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', color: '#6ee7b7' }}>
          <p className="font-semibold mb-0.5">Welcome back!</p>
          <p style={{ color: 'var(--text-muted)' }}>
            State channel still active:{' '}
            <code className="text-green-400">{lobby.channel.channelId.slice(0, 16)}…</code>
          </p>
        </div>
      )}

      {/* PENDING */}
      {lobby.step === 'pending' && (
        <div className="space-y-2.5">
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {lobby.role === 'creator'
              ? "Share the code above. When you're both ready, click Confirm Ready to sign and lock funds."
              : "You've joined the lobby. When both players are ready, click Confirm Ready."}
          </p>
          {hasWallet ? (
            <button
              onClick={handleConfirmReady}
              disabled={!address}
              className="w-full py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-40"
              style={{ background: 'rgba(139,92,246,0.8)', color: 'white', border: 'none' }}>
              ✅ I'm Ready — Sign &amp; Lock Funds
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-[10px] text-center" style={{ color: 'var(--text-muted)' }}>
                Connect Sage wallet to sign and lock funds
              </p>
              {pairingUri ? (
                <div className="space-y-2">
                  <div className="flex justify-center">
                    <div className="p-2 rounded-lg bg-white"><QRCode value={pairingUri} size={140} /></div>
                  </div>
                  <p className="text-[10px] text-center" style={{ color: 'var(--text-muted)' }}>
                    Scan with Sage mobile · paste URI in Sage desktop
                  </p>
                  <button onClick={cancelConnect} className="w-full py-1 rounded text-xs"
                    style={{ background: 'transparent', border: '1px solid rgba(255,100,100,0.4)', color: '#ff8080' }}>
                    Cancel
                  </button>
                </div>
              ) : isConnecting ? (
                <p className="text-xs text-center" style={{ color: '#00d9ff' }}>⚡ Generating pairing code…</p>
              ) : (
                <button onClick={connect} disabled={!clientReady}
                  className="w-full py-2 rounded-lg text-xs font-bold disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #00d9ff, #7c3aed)', color: '#fff', border: 'none' }}>
                  {clientReady ? '🔗 Connect Sage Wallet' : '⏳ Initializing…'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* SIGNING / BROADCASTING */}
      {(lobby.step === 'signing' || lobby.step === 'broadcasting') && (
        <div className="flex items-center gap-2 py-1">
          <div className="w-3.5 h-3.5 rounded-full border-2 border-purple-400 border-t-transparent animate-spin flex-shrink-0" />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {lobby.step === 'signing' ? 'Waiting for Sage wallet approval…' : 'Broadcasting to Chia network…'}
          </span>
        </div>
      )}

      {/* WAITING_PEER */}
      {lobby.step === 'waiting_peer' && (
        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          ⏳ Your signature is locked. Waiting for your opponent to sign their side…
        </p>
      )}

      {/* OPEN */}
      {lobby.step === 'open' && (
        <div className="space-y-2">
          <div className="rounded-lg p-2.5 text-center"
            style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)' }}>
            <p className="text-xs font-bold text-emerald-400">⚔️ Channel open — battle begins!</p>
            {lobby.channel && (
              <p className="text-[9px] mt-0.5 font-mono" style={{ color: 'var(--text-muted)' }}>
                {lobby.channel.channelId.slice(0, 24)}…
              </p>
            )}
          </div>
          <button onClick={lobby.exitLobby}
            className="w-full py-1.5 rounded-lg text-xs font-medium"
            style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
            ↩ New Lobby
          </button>
        </div>
      )}

      {/* ERROR */}
      {lobby.step === 'error' && (
        <div className="space-y-2">
          <div className="rounded-lg p-2 text-xs"
            style={{ background: 'rgba(239,68,68,0.09)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171' }}>
            <p className="font-bold mb-0.5">Channel error</p>
            <p className="break-all text-[10px]">{lobby.errorMsg}</p>
            <p className="text-[9px] opacity-60 mt-1">Check wallet connection and try again.</p>
          </div>
          <button onClick={lobby.exitLobby}
            className="w-full py-1.5 rounded-lg text-xs font-bold"
            style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.4)', color: '#c4b5fd' }}>
            ↩ Back to Lobby
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Element colour map (shared with WalletTab) ──────────────────────────────
const EL_COLOURS: Record<string, string> = {
  Fire: '#f97316', Water: '#3b82f6', Nature: '#22c55e',
  Electric: '#eab308', Shadow: '#a855f7', Ice: '#67e8f9',
  Arcane: '#00d9ff', Corruption: '#dc2626', Spirit: '#f9a8d4',
};

// ─── Inline fighter portrait (image or emoji fallback) ───────────────────────
function FighterPortrait({ src, size = 80 }: { src?: string; size?: number }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <div className="flex items-center justify-center rounded-lg text-4xl flex-shrink-0"
        style={{ width: size, height: size, background: 'rgba(0,217,255,0.08)', border: '1px solid rgba(0,217,255,0.2)' }}>
        🧙
      </div>
    );
  }
  return (
    <img src={src} alt="fighter" onError={() => setErr(true)}
      className="rounded-lg object-contain flex-shrink-0"
      style={{ width: size, height: size, background: 'rgba(0,0,0,0.3)' }} />
  );
}

// ─── AI Practice Panel ────────────────────────────────────────────────────────

function AiPracticePanel({ fighter, onStartBattle }: { fighter: Fighter; onStartBattle: () => void }) {
  const elColour = EL_COLOURS[fighter.strength] ?? '#aaa';
  const moves    = getAvailableMoves(fighter).filter(Boolean) as NonNullable<MoveKind>[];
  return (
    <div className="rounded-xl p-3 space-y-3"
      style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)' }}>

      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-base">🤖</span>
        <h3 className="text-sm font-bold" style={{ color: 'var(--text-color)' }}>AI Practice</h3>
        <span className="text-[9px] px-1.5 py-0.5 rounded font-bold"
          style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: '#fbbf24' }}>
          NO STAKE
        </span>
      </div>

      {/* Fighter card */}
      <div className="flex gap-3 rounded-lg p-2"
        style={{ background: 'rgba(0,0,0,0.25)', border: `1px solid ${elColour}30` }}>
        <FighterPortrait src={fighter.imageUri} size={88} />
        <div className="flex flex-col gap-1 min-w-0">
          <p className="font-bold text-sm leading-tight" style={{ color: 'var(--text-color)' }}>{fighter.name}</p>
          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold self-start"
            style={{ background: `${elColour}20`, color: elColour, border: `1px solid ${elColour}40` }}>
            {fighter.strength}
          </span>
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 mt-1" style={{ fontSize: '0.75rem' }}>
            <span style={{ color: '#4caf50' }}>❤ {fighter.stats.hp}</span>
            <span style={{ color: '#ff6b35' }}>⚔ {fighter.stats.atk}</span>
            <span style={{ color: '#2196f3' }}>🛡 {fighter.stats.def}</span>
            <span style={{ color: '#ffd600' }}>💨 {fighter.stats.spd}</span>
          </div>
        </div>
      </div>

      {/* Available moves derived from fighter metadata */}
      <div>
        <p className="text-[10px] font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>⚡ Available Moves</p>
        <div className="flex flex-wrap gap-1">
          {moves.map((m) => (
            <span key={m} className="px-2 py-0.5 rounded text-[10px] font-bold"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-color)' }}>
              {MOVES[m].name}
            </span>
          ))}
        </div>
      </div>

      <button onClick={onStartBattle}
        className="w-full py-2 rounded-lg text-xs font-bold"
        style={{ background: 'rgba(245,158,11,0.18)', border: '1px solid rgba(245,158,11,0.5)', color: '#fbbf24' }}>
        ⚔️ Fight AI Boss
      </button>
    </div>
  );
}

// ─── Main BattleTab ───────────────────────────────────────────────────────────

export default function BattleTab({ userId }: BattleTabProps) {
  const store   = useBowActivityStore();
  const lobby   = useLobbyStore();
  const {
    session,
    connect, cancelConnect, pairingUri, isConnecting, clientReady,
  } = useWalletConnect();

  const [selectedMove, setSelectedMove]         = useState<MoveKind>(null);
  const [isSubmittingMove, setIsSubmittingMove]  = useState(false);
  const [showQr, setShowQr]                     = useState(false);
  const [copiedUri, setCopiedUri]               = useState(false);
  // True when lobby was restored from localStorage on this mount
  const [reconnected, setReconnected]           = useState(false);
  const engineRef = useRef<PrivacyBattleEngine | null>(null);

  // Detect reconnection: lobby was persisted from a prior session
  useEffect(() => {
    if (lobby.step !== 'idle' && (lobby.inviteCode || lobby.channel)) {
      setReconnected(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (pairingUri) setShowQr(true);
    else setShowQr(false);
  }, [pairingUri]);

  const handleCopyUri = () => {
    if (!pairingUri) return;
    const ta = document.createElement('textarea');
    ta.value = pairingUri; ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta); ta.focus(); ta.select();
    try { document.execCommand('copy'); } catch { /* noop */ }
    document.body.removeChild(ta);
    if (navigator.clipboard) navigator.clipboard.writeText(pairingUri).catch(() => {});
    setCopiedUri(true); setTimeout(() => setCopiedUri(false), 2000);
  };

  const selectedFighter = store.wallet.selectedFighter;
  const currentBattle   = store.battle;
  const isInBattle      = !!(currentBattle && currentBattle.status !== 'finished');
  const isMyTurn        = !!(currentBattle && (
    (currentBattle.player1Id === userId && currentBattle.currentTurn === 'player1') ||
    (currentBattle.player2Id === userId && currentBattle.currentTurn === 'player2')
  ));

  /** Returns an AI gym boss that counters the player's element */
  const makeGymBoss = (player: Fighter): Fighter => {
    const counters: Record<string, Fighter['strength']> = {
      Fire: 'Water', Water: 'Nature', Nature: 'Fire',
      Electric: 'Shadow', Shadow: 'Arcane', Arcane: 'Corruption',
      Corruption: 'Spirit', Spirit: 'Shadow', Ice: 'Fire',
      Exile: 'Fire', None: 'Fire',
    };
    const bossStrength = counters[player.strength] ?? 'Fire';
    return {
      source: 'user',
      name: `${bossStrength} Archon`,
      stats: {
        hp:  Math.round(player.stats.hp  * 1.2),
        atk: Math.round(player.stats.atk * 1.15),
        def: Math.round(player.stats.def * 1.1),
        spd: player.stats.spd,
      },
      strength: bossStrength,
      weakness: player.strength as Fighter['strength'],
      rarity:   player.rarity,
    };
  };

  const handleStartAiBattle = () => {
    if (!selectedFighter) return;
    const boss   = makeGymBoss(selectedFighter);
    const battle = createBattle(userId, 'gym-ai', selectedFighter, boss);
    engineRef.current = new PrivacyBattleEngine(battle);
    store.setBattle(battle);
    store.setIsInBattle(true);
    store.addBattleLog('🏟️ AI Practice started!');
    store.addBattleLog(`⚔️ Your fighter: ${selectedFighter.name} (${selectedFighter.strength})`);
    store.addBattleLog(`🔥 Opponent: ${boss.name} (${boss.strength}) — counters your element!`);
  };

  const handleSubmitMove = async () => {
    if (!selectedMove || !currentBattle || isSubmittingMove || !engineRef.current) return;
    setIsSubmittingMove(true);
    try {
      const aiMoves = getAvailableMoves(currentBattle.player2Fighter!);
      const aiMove  = aiMoves[Math.floor(Math.random() * aiMoves.length)] ?? 'SCRATCH';
      store.addBattleLog(`⚡ You: ${MOVES[selectedMove].name}`);
      store.addBattleLog(`🤖 AI: ${MOVES[aiMove].name}`);
      const result        = engineRef.current.executeRound(selectedMove, aiMove);
      const updatedBattle = engineRef.current.applyRound(result.player1Damage, result.player2Damage);
      result.battleLog.forEach((log: string) => store.addBattleLog(log));
      if (result.player1Damage > 0) store.addBattleLog(`💥 You took ${result.player1Damage} damage`);
      if (result.player2Damage > 0) store.addBattleLog(`💥 Opponent took ${result.player2Damage} damage`);
      store.setBattle(updatedBattle);
      if (updatedBattle.status === 'finished') {
        const w = updatedBattle.winner;
        store.addBattleLog(w === 'draw' ? '⚖️ Draw!' : w === 'player1' ? '🏆 Victory!' : '💀 Defeat…');
        store.setIsInBattle(false);
        engineRef.current = null;
      }
      setSelectedMove(null);
    } finally {
      setIsSubmittingMove(false);
    }
  };

  const handleLeaveBattle = () => {
    engineRef.current = null;
    store.resetBattle();
    store.setIsInBattle(false);
    store.addBattleLog('🚪 Left battle');
  };

  const isConnected = !!session;

  // ── Active AI battle takes over the whole view ────────────────────────────
  if (isInBattle && currentBattle) {
    return (
      <div className="flex flex-col gap-3 p-3 h-full overflow-y-auto scrollbar-hide">
        <BattleInterface
          battle={currentBattle}
          userId={userId}
          selectedFighter={selectedFighter}
          isMyTurn={isMyTurn}
          selectedMove={selectedMove}
          setSelectedMove={setSelectedMove}
          onSubmitMove={handleSubmitMove}
          onLeaveBattle={handleLeaveBattle}
          isSubmittingMove={isSubmittingMove}
        />
        {store.gui.battleLogs.length > 0 && (
          <div className="glow-card p-2">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs font-semibold" style={{ color: 'var(--text-color)' }}>📜 Log</span>
              <button onClick={store.clearBattleLogs} className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Clear</button>
            </div>
            <div className="rounded p-2 max-h-36 overflow-y-auto space-y-0.5" style={{ background: 'var(--bg-deep)' }}>
              {store.gui.battleLogs.map((log: string, i: number) => (
                <div key={i} className="text-xs font-mono" style={{ color: 'var(--text-color)' }}>{log}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Arena home ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3 p-3 h-full overflow-y-auto scrollbar-hide" style={{ zoom: 1.32 }}>

      <div>
        <h2 className="font-bold text-sm" style={{ color: 'var(--text-color)' }}>⚔️ Battle of Wizards</h2>
        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          PvP state-channel battles · AI practice · Chia blockchain
        </p>
      </div>

      {/* Non-blocking wallet strip */}
      {!isConnected && (
        <div className="rounded-xl p-3 space-y-2"
          style={{ background: 'rgba(0,217,255,0.04)', border: '1px solid rgba(0,217,255,0.2)' }}>
          <p className="text-xs font-semibold" style={{ color: '#00d9ff' }}>🔮 Sage Wallet — required for PvP</p>
          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            Connect to sign state-channel transactions. AI Practice works without a wallet.
          </p>
          {showQr && pairingUri ? (
            <div className="space-y-2">
              <div className="flex justify-center">
                <div className="p-2 rounded-lg bg-white"><QRCode value={pairingUri} size={140} /></div>
              </div>
              <p className="text-[10px] text-center" style={{ color: 'var(--text-muted)' }}>
                Scan with Sage mobile · paste URI in Sage desktop
              </p>
              <div className="flex gap-2">
                <input readOnly value={pairingUri} onFocus={(e) => e.target.select()}
                  className="flex-1 rounded-lg px-2 py-1 text-[10px] font-mono truncate outline-none"
                  style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'var(--text-color)', minWidth: 0 }} />
                <button onClick={handleCopyUri}
                  className="flex-shrink-0 px-2 py-1 rounded text-[10px] font-bold"
                  style={{ background: copiedUri ? '#10b981' : '#00d9ff', color: '#000' }}>
                  {copiedUri ? '✓' : '📋'}
                </button>
              </div>
              <button onClick={cancelConnect} className="w-full py-1 rounded text-xs"
                style={{ background: 'transparent', border: '1px solid rgba(255,100,100,0.4)', color: '#ff8080' }}>
                Cancel
              </button>
            </div>
          ) : isConnecting ? (
            <p className="text-xs text-center" style={{ color: '#00d9ff' }}>⚡ Generating pairing code…</p>
          ) : (
            <button onClick={connect} disabled={!clientReady}
              className="w-full py-2 rounded-lg text-xs font-bold disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #00d9ff, #7c3aed)', color: '#fff', border: 'none' }}>
              {clientReady ? '🔗 Connect Sage Wallet' : '⏳ Initializing…'}
            </button>
          )}
        </div>
      )}

      {/* 2-column battle options */}
      <div className="grid grid-cols-2 gap-3">
        {/* Left: PvP */}
        <PvpLobbyPanel userId={userId} reconnected={reconnected} />

        {/* Right: AI Practice */}
        {selectedFighter ? (
          <AiPracticePanel fighter={selectedFighter} onStartBattle={handleStartAiBattle} />
        ) : (
          <div className="rounded-xl p-3 text-center flex flex-col items-center justify-center gap-2"
            style={{ background: 'rgba(245,158,11,0.05)', border: '1px dashed rgba(245,158,11,0.25)' }}>
            <span className="text-2xl">🤖</span>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              Select a fighter on the{' '}
              <strong style={{ color: 'var(--text-color)' }}>Fighters</strong>{' '}
              tab to unlock AI Practice.
            </p>
          </div>
        )}
      </div>

      {store.gui.battleLogs.length > 0 && (
        <div className="glow-card p-2">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-color)' }}>📜 Log</span>
            <button onClick={store.clearBattleLogs} className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Clear</button>
          </div>
          <div className="rounded p-2 max-h-32 overflow-y-auto space-y-0.5" style={{ background: 'var(--bg-deep)' }}>
            {store.gui.battleLogs.map((log: string, i: number) => (
              <div key={i} className="text-xs font-mono" style={{ color: 'var(--text-color)' }}>{log}</div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[9px] text-center pb-1" style={{ color: 'rgba(255,255,255,0.1)' }}>
        Mini-Eltoo · 2-of-2 BLS · Chia blockchain
      </p>
    </div>
  );
}

// ─── Active battle sub-component ─────────────────────────────────────────────

interface BattleInterfaceProps {
  battle:           BattleState;
  userId:           string;
  selectedFighter:  Fighter | null;
  isMyTurn:         boolean;
  selectedMove:     MoveKind;
  setSelectedMove:  (move: MoveKind) => void;
  onSubmitMove:     () => void;
  onLeaveBattle:    () => void;
  isSubmittingMove: boolean;
}

function BattleInterface({
  battle, userId, selectedFighter, isMyTurn,
  selectedMove, setSelectedMove, onSubmitMove, onLeaveBattle, isSubmittingMove,
}: BattleInterfaceProps) {
  const isPlayer1       = battle.player1Id === userId;
  const myHp            = isPlayer1 ? battle.player1Hp : battle.player2Hp;
  const opponentHp      = isPlayer1 ? battle.player2Hp : battle.player1Hp;
  const myFighter       = isPlayer1 ? battle.player1Fighter : battle.player2Fighter;
  const opponentFighter = isPlayer1 ? battle.player2Fighter : battle.player1Fighter;
  const availableMoves  = selectedFighter ? getAvailableMoves(selectedFighter) : [];

  return (
    <div className="space-y-3">
      {/* Round header */}
      <div className="glow-card p-3 flex items-center justify-between">
        <h2 className="text-base font-semibold" style={{ color: 'var(--text-color)' }}>
          ⚔️ Round {battle.roundNumber}
        </h2>
        <div className="flex gap-2 items-center">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
            style={{
              background: battle.status === 'waiting' ? 'rgba(240,178,50,0.2)' : 'rgba(0,217,255,0.2)',
              color:      battle.status === 'waiting' ? 'var(--warning)' : 'var(--accent)',
              border:     `1px solid ${battle.status === 'waiting' ? 'var(--warning)' : 'var(--accent)'}`,
            }}>
            {battle.status.toUpperCase()}
          </span>
          <button onClick={onLeaveBattle}
            className="px-2 py-0.5 rounded-full text-[10px]"
            style={{ background: 'rgba(242,63,66,0.2)', color: 'var(--danger)', border: '1px solid var(--danger)' }}>
            Leave
          </button>
        </div>
      </div>

      {/* HP bars */}
      <div className="grid grid-cols-2 gap-2">
        <div className="glow-card p-2" style={{ border: '2px solid var(--accent)' }}>
          <div className="flex gap-2 items-center mb-1">
            <FighterPortrait src={myFighter?.imageUri} size={40} />
            <div className="min-w-0">
              <p className="font-bold text-sm truncate" style={{ color: 'var(--text-color)' }}>{myFighter?.name ?? 'You'}</p>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{myFighter?.rarity} · {myFighter?.strength}</p>
            </div>
          </div>
          <div className="rounded-full h-2.5 overflow-hidden mb-1" style={{ background: 'rgba(74,222,128,0.2)' }}>
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.max(0, (myHp / (myFighter?.stats.hp || 100)) * 100)}%`, background: 'var(--success)', boxShadow: '0 0 6px var(--success)' }} />
          </div>
          <span className="text-xs font-semibold" style={{ color: 'var(--success)' }}>
            {Math.max(0, myHp)} / {myFighter?.stats.hp || 100} HP
          </span>
        </div>
        <div className="glow-card p-2" style={{ border: '2px solid var(--danger)' }}>
          <div className="flex gap-2 items-center mb-1">
            <FighterPortrait src={opponentFighter?.imageUri} size={40} />
            <div className="min-w-0">
              <p className="font-bold text-sm truncate" style={{ color: 'var(--text-color)' }}>{opponentFighter?.name ?? 'Opponent'}</p>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{opponentFighter?.rarity} · {opponentFighter?.strength}</p>
            </div>
          </div>
          <div className="rounded-full h-2.5 overflow-hidden mb-1" style={{ background: 'rgba(242,63,66,0.2)' }}>
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.max(0, (opponentHp / (opponentFighter?.stats.hp || 100)) * 100)}%`, background: 'var(--danger)', boxShadow: '0 0 6px var(--danger)' }} />
          </div>
          <span className="text-xs font-semibold" style={{ color: 'var(--danger)' }}>
            {Math.max(0, opponentHp)} / {opponentFighter?.stats.hp || 100} HP
          </span>
        </div>
      </div>

      {/* Move selection */}
      {battle.status === 'commit' && isMyTurn && (
        <div className="glow-card p-3">
          <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-color)' }}>🎯 Choose Your Move</h3>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {availableMoves.map((move) => {
              if (!move) return null;
              const md = MOVES[move];
              return (
                <button key={move} onClick={() => setSelectedMove(move)}
                  className="p-2 rounded-lg transition-all text-left"
                  style={{
                    background: selectedMove === move ? 'var(--sel-fill)' : 'var(--bg-deep)',
                    color:      selectedMove === move ? 'var(--sel-text)' : 'var(--text-color)',
                    border:     `2px solid ${selectedMove === move ? 'var(--accent)' : 'var(--border-color)'}`,
                  }}>
                  <div className="text-xs font-semibold">{md.name}</div>
                  <div className="text-[10px] opacity-60">{md.element} · DMG {md.damage}</div>
                </button>
              );
            })}
          </div>
          {selectedMove && (
            <div className="rounded p-2 mb-2.5 text-xs" style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-color)' }}>
              <p className="font-semibold" style={{ color: 'var(--text-color)' }}>{MOVES[selectedMove].name}</p>
              <p style={{ color: 'var(--text-muted)' }}>{MOVES[selectedMove].description}</p>
            </div>
          )}
          <button onClick={onSubmitMove} disabled={!selectedMove || isSubmittingMove}
            className="glow-btn w-full disabled:opacity-40">
            {isSubmittingMove ? '⏳ Submitting…' : '⚡ Submit Move'}
          </button>
        </div>
      )}

      {battle.status === 'commit' && !isMyTurn && (
        <div className="glow-card p-3 text-center">
          <p className="text-sm font-semibold" style={{ color: 'var(--warning)' }}>⏳ Waiting for opponent's move…</p>
        </div>
      )}
    </div>
  );
}

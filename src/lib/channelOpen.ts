/**
 * channelOpen.ts
 * State channel opening protocol for Arcane BOW.
 *
 * Two lobby modes:
 *   Gym (PvE)  — party_a locks stake; gym-server countersigns automatically
 *   PvP (1v1)  — both parties lock equal stakes; invite-code handshake
 *
 * Opening steps (mini-Eltoo / chia-gaming handshake):
 *   1. PENDING      — channel record created; channel ID & keys generated
 *   2. SIGNING      — party_a requests chip0002_signCoinSpends from Sage wallet
 *   3. BROADCASTING — funding SpendBundle sent to gym-server or tracker relay
 *   4. LOCKED       — channel coin confirmed on-chain; battle can begin
 *
 * WalletConnect refs (xch-dev/sage):
 *   chip0002_signCoinSpends  → { spend_bundle: { aggregated_signature } }
 *   chip0002_sendTransaction → { status: 1|2|3, error }
 *
 * BLS notes (arcane-battle-protocol/state-channel/channel_template.ts):
 *   aggregate_pk = G1Element.fromBytes(pkA) + G1Element.fromBytes(pkB)
 *   channel coin locked by: pay_to_2_of_2(aggregate_channel_pk, amount)
 *   unroll coin:            pay_to_2_of_2(aggregate_unroll_pk, amount)
 */

import type {
  StateChannel, ChannelKeys, CoinInfo, SpendBundle, CoinSpend, BondType,
} from './stateChannel';
// NOTE: greenwebjs is loaded lazily inside buildStandardSolution() to avoid
// crashing the module on load — @chiamine/bls-signatures uses Node.js
// built-ins (fs, path) that trigger errors in the Discord iframe environment.

// ─── Constants ────────────────────────────────────────────────────────────────

/** Gym server base URL — injected by Vercel env */
const GYM_SERVER_URL = import.meta.env.VITE_GYM_SERVER_URL ?? 'http://localhost:3001';

/** Default battle stake: 1 mojo (mainnet). Future: CATs or NFTs as bonds. */
const DEFAULT_STAKE_MOJOS = BigInt(1);

/** Spacescan / xchscan coin explorer URL */
export function explorerUrl(coinId: string): string {
  const chain = import.meta.env.VITE_CHIA_CHAIN ?? 'mainnet';
  const base   = chain === 'testnet11'
    ? 'https://testnet11.spacescan.io/coin/'
    : 'https://xchscan.com/coin/';
  return base + coinId.replace(/^0x/, '');
}

// ─── Key generation ───────────────────────────────────────────────────────────

/**
 * Deterministic channel ID from parties, game type, and timestamp.
 * Production: sha256tree(partyA || partyB || gameType || blockHeight)
 */
export function generateChannelId(partyA: string, partyB: string, gameType: string): string {
  const seed = `${partyA}:${partyB}:${gameType}:${Date.now()}`;
  return 'ch_' + Array.from(seed)
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 20);
}

/** 6-char alphanumeric invite code for PvP lobbies, easy to share in Discord chat. */
export function generateInviteCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/**
 * Build placeholder ChannelKeys from wallet addresses.
 *
 * TODO: Replace with real BLS key derivation.
 *   Real implementation:
 *     privateKey = AugSchemeMPL.deriveChildSk(masterSk, [12381, 8444, 0, index])
 *     publicKey  = privateKey.getG1()  → 48-byte G1 hex
 *     aggregate  = G1Element.fromBytes(pkA) + G1Element.fromBytes(pkB)
 *   Both channel keys and unroll keys should come from separate derivation paths.
 */
export function buildPlaceholderKeys(partyA: string, partyB: string): ChannelKeys {
  const pkA = '0x' + partyA.replace('xch1', '').slice(0, 48).padEnd(96, '0');
  const pkB = '0x' + partyB.replace('xch1', '').slice(0, 48).padEnd(96, '0');
  return {
    party_a_channel_public_key: pkA,
    party_b_channel_public_key: pkB,
    party_a_unroll_public_key:  pkA,
    party_b_unroll_public_key:  pkB,
    aggregate_channel_pk:       pkA, // TODO: BLS G1 point addition (pkA + pkB)
    aggregate_unroll_pk:        pkA, // TODO: BLS G1 point addition (pkA + pkB)
  };
}

// ─── Coin selection ──────────────────────────────────────────────────────────

/**
 * Fetch a spendable XCH coin from the connected Sage wallet via WalletConnect.
 *
 * chip0002_getAssetCoins docs:
 *   params: { asset_id: null, type: 'XCH', ... }
 *   result: [{ coin: { parent_coin_info, puzzle_hash, amount }, puzzle, coinName, locked }]
 */
export async function getSpendableCoin(
  session: any,
  minAmount: bigint = BigInt(1),
): Promise<{ coin: CoinInfo; puzzle: string; coinName: string }> {
  if (!session) throw new Error('[aWizard] No WalletConnect session — connect wallet first');

  const coins: Array<{ coin: { parent_coin_info: string; puzzle_hash: string; amount: number }; puzzle: string; coinName: string; locked: boolean }> =
    await session.request({
      method: 'chip0002_getAssetCoins',
      params: { asset_id: null, type: 'XCH', include_locked: false },
    });

  const found = coins.find(
    (c) => !c.locked && BigInt(c.coin.amount) >= minAmount,
  );
  if (!found) {
    throw new Error(
      `[aWizard] No spendable XCH coin found (need ≥ ${minAmount} mojo). ` +
      `Ensure your Sage wallet is funded on mainnet.`,
    );
  }

  return {
    coin: {
      parent_coin_info: found.coin.parent_coin_info,
      puzzle_hash:      found.coin.puzzle_hash,
      amount:           BigInt(found.coin.amount),
    },
    puzzle:   found.puzzle,
    coinName: found.coinName,
  };
}



/**
 * Builds a pending StateChannel record (no on-chain tx yet).
 * Used as the starting point for both Gym and PvP lobbies.
 */
export function createPendingChannel(
  partyAWallet:  string,
  partyBWallet:  string,
  partyAPeerId:  string,
  partyBPeerId:  string,
  gameType:      string,
  stakePerSide:  bigint = DEFAULT_STAKE_MOJOS,
  bondType:      BondType = 'mojo',
  bondCatAssetId?: string,
  bondNftId?:      string,
): StateChannel {
  const channelId = generateChannelId(partyAWallet, partyBWallet, gameType);
  const keys = buildPlaceholderKeys(partyAWallet, partyBWallet);
  const now  = Date.now();
  return {
    channelId,
    gameType,
    status:        'pending',
    partyAWallet,
    partyBWallet,
    partyAPeerId,
    partyBPeerId,
    channelKeys:   keys,
    bondType,
    bondCatAssetId,
    bondNftId,
    partyABalance: stakePerSide,
    partyBBalance: stakePerSide,
    totalAmount:   stakePerSide * BigInt(2),
    createdAt:     now,
    updatedAt:     now,
  };
}
// ─── CLVM helpers (ported from bow-app/app/channel/page.tsx) ─────────────────────────

/** CLVM atom-length prefix for N bytes (for REMARK condition encoding) */
function clvmAtomPrefix(len: number): string {
  if (len === 0) return '80';           // nil
  if (len <= 0x3f) return (0x80 | len).toString(16).padStart(2, '0');
  if (len <= 0x1fff) {
    const hi = 0xc0 | (len >> 8);
    const lo = len & 0xff;
    return hi.toString(16).padStart(2, '0') + lo.toString(16).padStart(2, '0');
  }
  throw new Error(`[aWizard] Memo too large for CLVM atom: ${len}`);
}

/**
 * Build a standard p2 coin solution using greenwebjs (loaded lazily):
 *  - REMARK condition with `memo`
 *  - CREATE_COIN back to sender for `totalAmount` (net-zero spend)
 * Returns 0x-prefixed CLVM hex.
 *
 * Mirrors bow-app/app/channel/page.tsx `buildStandardSolution`.
 */
async function buildStandardSolution(
  senderPuzzleHashHex: string,
  totalAmount: number,
  memo: string,
): Promise<string> {
  // Lazy import so greenwebjs never runs at module-init time in the browser
  const GreenWeb = await import('greenwebjs');

  const ph = senderPuzzleHashHex.replace(/^0x/, '');

  // Encode memo as hex (truncate to 63 chars to stay within CLVM atom limits)
  const memoBytes  = new TextEncoder().encode(memo.slice(0, 63));
  const memoHex    = Array.from(memoBytes).map(b => b.toString(16).padStart(2, '0')).join('');

  // REMARK condition: (1 memo_bytes) — ff 01 ff <atom> 80
  const atomPrefix = clvmAtomPrefix(memoBytes.length);
  const remarkHex  = 'ff01ff' + atomPrefix + memoHex + '80';
  const remarkCond = GreenWeb.util.sexp.fromHex(remarkHex);

  // CREATE_COIN condition: (51 puzzle_hash amount)
  const createCoinCond = GreenWeb.spend.createCoinCondition(ph, totalAmount);

  // Build solution: ((q . conditions) ())
  const solution = GreenWeb.util.sexp.standardCoinSolution([remarkCond, createCoinCond]);
  return '0x' + GreenWeb.util.sexp.toHex(solution);
}
// ─── WalletConnect signing ────────────────────────────────────────────────────

/**
 * Sign a channel-open coin spend via Sage wallet (chip0002_signCoinSpends).
 *
 * Mirrors bow-app/app/channel/page.tsx `handleFund`:
 *   - Uses the real coin + puzzle returned by getSpendableCoin()
 *   - Net-zero spend: CREATE_COIN back to self + REMARK memo to mark channel open
 *   - Solution built with greenwebjs (REMARK + CREATE_COIN conditions)
 *
 *   chip0002_signCoinSpends docs (xch-dev/sage):
 *     params: { coin_spends: CoinSpend[], partial: boolean, auto_submit: boolean }
 *     result: { spend_bundle: { coin_spends, aggregated_signature } }
 */
export async function requestFundingSignature(
  session:    any,
  channel:    StateChannel,
  realCoin:   { coin: CoinInfo; puzzle: string; coinName: string },
): Promise<SpendBundle> {
  if (!session) {
    throw new Error('[aWizard] requestFundingSignature: no WalletConnect session — connect wallet first');
  }

  const isPartial = channel.gameType === 'pvp'; // PvP needs half-sig only
  const addrTag   = channel.partyAWallet.slice(0, 16);
  const memo      = `BoW open ${channel.bondType} ${addrTag}`;

  // Build real p2 standard solution: REMARK + CREATE_COIN back to self
  const solution = await buildStandardSolution(
    realCoin.coin.puzzle_hash,
    Number(realCoin.coin.amount),
    memo,
  );

  const coinSpend: CoinSpend = {
    coin:          realCoin.coin,
    puzzle_reveal: realCoin.puzzle,
    solution,
  };

  const result: { spend_bundle: SpendBundle } | SpendBundle = await session.request({
    method: 'chip0002_signCoinSpends',
    params: {
      coin_spends:  [coinSpend],
      partial:      isPartial,
      auto_submit:  false,
    },
  });

  // Sage may return { spend_bundle: ... } or the SpendBundle directly
  const bundle: SpendBundle = (result as { spend_bundle?: SpendBundle }).spend_bundle ?? (result as SpendBundle);
  if (!bundle || !bundle.aggregated_signature) {
    throw new Error(`[aWizard] signCoinSpends returned no spend_bundle — response: ${JSON.stringify(result)}`);
  }

  console.log(`[aWizard] Channel sign OK memo="${memo}" coin=${realCoin.coinName}`);
  return bundle;
}

/**
 * Broadcast a fully-signed SpendBundle via Sage wallet (chip0002_sendTransaction).
 * Mirrors bow-app's `sendTransaction(spendBundle)`.
 *
 *   chip0002_sendTransaction docs (xch-dev/sage):
 *     params: { spend_bundle: { coin_spends, aggregated_signature } }
 *     result: { status: 'SUCCESS' | ..., error?: string, tx_id?: string }
 */
export async function sendFundingBundle(
  session: any,
  bundle:  SpendBundle,
): Promise<string> {
  if (!session) throw new Error('[aWizard] sendFundingBundle: no session');

  const result: { status: string; error?: string; tx_id?: string } = await session.request({
    method: 'chip0002_sendTransaction',
    params: { spend_bundle: bundle },
  });

  if (result.status !== 'SUCCESS') {
    throw new Error(`[aWizard] Transaction rejected: ${result.error ?? result.status}`);
  }

  return result.tx_id ?? 'unknown';
}

// ─── Broadcast ────────────────────────────────────────────────────────────────

/**
 * Submit the signed (or half-signed) funding bundle.
 *
 *   Gym  → POST /gym/channel/open — gym-server countersigns + broadcasts on-chain
 *   PvP  → POST to tracker relay — held until party_b countersigns; relay then broadcasts
 *
 * Returns 'broadcast' if channel coin is submitted, 'pending_peer' if waiting for opponent.
 */
export async function broadcastFundingBundle(
  channel: StateChannel,
  bundle:  SpendBundle,
): Promise<{ status: 'broadcast' | 'pending_peer' }> {
  if (channel.gameType === 'pvp') {
    // TODO: POST to tracker relay
    // await fetch(`${TRACKER_URL}/api/channels`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ channel, bundle }),
    // });
    console.log(`[aWizard] PvP bundle staged to relay — waiting for peer (${channel.channelId})`);
    return { status: 'pending_peer' };
  }

  // PvE Gym — gym-server auto-countersigns and broadcasts
  const res = await fetch(`${GYM_SERVER_URL}/gym/channel/open`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      channel_id:     channel.channelId,
      party_a_wallet: channel.partyAWallet,
      game_type:      channel.gameType,
      total_amount:   channel.totalAmount.toString(),
      funding_bundle: bundle,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`[aWizard] Gym server rejected channel open: ${errText}`);
  }

  return { status: 'broadcast' };
}

// ─── Gym wallet registry ──────────────────────────────────────────────────────

/**
 * Returns the gym-server's wallet address for a given tier.
 * TODO: fetch dynamically from GET /gym/info on gym-server startup.
 */
export function getGymWallet(tier: number): string {
  const wallets: Record<number, string> = {
    1: import.meta.env.VITE_GYM_TIER1_WALLET ?? 'xch1gym1000000000000000000000000000000000000000000000000000000',
    2: import.meta.env.VITE_GYM_TIER2_WALLET ?? 'xch1gym2000000000000000000000000000000000000000000000000000000',
    3: import.meta.env.VITE_GYM_TIER3_WALLET ?? 'xch1gym3000000000000000000000000000000000000000000000000000000',
    4: import.meta.env.VITE_GYM_TIER4_WALLET ?? 'xch1gym4000000000000000000000000000000000000000000000000000000',
    5: import.meta.env.VITE_GYM_TIER5_WALLET ?? 'xch1gym5000000000000000000000000000000000000000000000000000000',
  };
  return wallets[tier] ?? wallets[1];
}

// ─── High-level openers ───────────────────────────────────────────────────────

/**
 * Open a Gym (PvE) lobby:
 *   1. Create pending channel (player vs gym-server)
 *   2. Request funding signature from Sage via WalletConnect (partial=false)
 *   3. POST to gym-server — server countersigns and broadcasts on-chain
 *
 * @param walletAddress  player's xch1... Chia address
 * @param session        WalletConnect session (bowActivityStore.wallet.session)
 * @param tier           gym tier 1–5 (determines gym wallet + AI difficulty)
 * @param peerId         Discord user ID (peer identity for relay messages)
 * @param stakeOverride  custom stake in mojos (defaults to 1 mojo mainnet)
 * @param bondType       bond currency: 'mojo' (default) | 'cat' | 'nft' (future)
 */
export async function openGymChannel(
  walletAddress: string,
  session:       any,
  tier:          number,
  peerId:        string,
  stakeOverride?: bigint,
  bondType:       Parameters<typeof createPendingChannel>[6] = 'mojo',
): Promise<StateChannel> {
  const gymWallet = getGymWallet(tier);
  const channel   = createPendingChannel(
    walletAddress,
    gymWallet,
    peerId,
    `gym-tier-${tier}`,
    `gym_tier${tier}`,
    stakeOverride,
    bondType,
  );

  // ── Fetch a real spendable XCH coin from Sage wallet ──────────────────────
  const realCoin = await getSpendableCoin(session, BigInt(1));

  // ── Sign the channel-open coin spend ──────────────────────────────────────
  const bundle = await requestFundingSignature(session, channel, realCoin);

  // ── Broadcast on-chain via chip0002_sendTransaction ───────────────────────
  const txId = await sendFundingBundle(session, bundle);
  console.log(`[aWizard] Gym channel open tx: ${txId}`);

  // ── Notify gym-server of the open channel ─────────────────────────────────
  await broadcastFundingBundle(channel, bundle).catch((err) => {
    // Non-fatal: gym-server notification may fail if server is offline
    console.warn('[aWizard] Gym-server notify failed:', err);
  });

  const channelCoin: CoinInfo = {
    parent_coin_info: realCoin.coin.parent_coin_info,
    puzzle_hash:      realCoin.coin.puzzle_hash,
    amount:           realCoin.coin.amount,
  };

  return {
    ...channel,
    status:        'locked',
    channelCoin,
    fundingBundle: bundle,
    updatedAt:     Date.now(),
  };
}

/**
 * Create a PvP lobby (party_a):
 *   1. Create pending channel with a placeholder party_b wallet
 *   2. Sign party_a's half of the funding bundle
 *   3. Register with tracker relay and return invite code
 *
 * Opponent calls joinPvpChannel() with the returned invite code.
 */
export async function createPvpChannel(
  walletAddress: string,
  session:       any,
  peerId:        string,
  stakeOverride?: bigint,
  inviteCodeOverride?: string,
): Promise<{ channel: StateChannel; inviteCode: string }> {
  const inviteCode  = inviteCodeOverride ?? generateInviteCode();
  // Placeholder party_b address until opponent provides theirs
  const pendingPartyB = 'xch1pending' + '0'.repeat(53);

  const channel = createPendingChannel(
    walletAddress,
    pendingPartyB,
    peerId,
    `pvp-${inviteCode}`,
    'pvp',
    stakeOverride,
  );

  // ── Fetch real coin + sign party_a's half of the funding bundle ───────────
  const realCoin = await getSpendableCoin(session, BigInt(1));
  const bundle   = await requestFundingSignature(session, channel, realCoin);

  // Stage with relay (returns pending_peer — relay holds until party_b countersigns)
  await broadcastFundingBundle(channel, bundle);

  const channelCoin: CoinInfo = { ...realCoin.coin };
  console.log(`[aWizard] PvP lobby created: ${channel.channelId} (code: ${inviteCode})`);

  return {
    channel: { ...channel, fundingBundle: bundle, channelCoin, updatedAt: Date.now() },
    inviteCode,
  };
}

/**
 * Join an existing PvP lobby (party_b):
 *   1. Fetch channel record from tracker relay by invite code
 *   2. Provide party_b wallet address (updates channel record)
 *   3. Countersign the funding bundle
 *   4. Relay aggregates both half-sigs and broadcasts on-chain
 */
export async function joinPvpChannel(
  inviteCode:    string,
  walletAddress: string,
  session:       any,
  peerId:        string,
): Promise<StateChannel> {
  // TODO: fetch from tracker relay
  // const channelRecord = await trackerClient.fetchChannelByInviteCode(inviteCode);
  const placeholderPartyA = 'xch1host' + '0'.repeat(55);
  const channel = createPendingChannel(
    placeholderPartyA,
    walletAddress,
    `pvp-host-${inviteCode}`,
    peerId,
    'pvp',
  );

  // ── Fetch real coin + countersign ─────────────────────────────────────────
  const realCoin = await getSpendableCoin(session, BigInt(1));
  const bundle   = await requestFundingSignature(session, channel, realCoin);

  // TODO: POST party_b's half-sig to relay; relay aggregates + broadcasts
  const result = await broadcastFundingBundle(channel, bundle);

  const channelCoin: CoinInfo = { ...realCoin.coin };
  console.log(`[aWizard] Joined PvP lobby (code: ${inviteCode})`);
  return {
    ...channel,
    partyBWallet:  walletAddress,
    status:        result.status === 'broadcast' ? 'locked' : 'pending',
    fundingBundle: bundle,
    channelCoin,
    updatedAt:     Date.now(),
  };
}

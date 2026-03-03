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
  StateChannel, ChannelKeys, CoinInfo, SpendBundle, CoinSpend,
} from './stateChannel';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Gym server base URL — injected by Vercel env */
const GYM_SERVER_URL = import.meta.env.VITE_GYM_SERVER_URL ?? 'http://localhost:3001';

/** Default battle stake: 100 TXCH (0.1 XCH) per side */
const DEFAULT_STAKE_MOJOS = BigInt(100_000_000_000);

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

// ─── Channel record factory ───────────────────────────────────────────────────

/**
 * Builds a pending StateChannel record (no on-chain tx yet).
 * Used as the starting point for both Gym and PvP lobbies.
 */
export function createPendingChannel(
  partyAWallet: string,
  partyBWallet: string,
  partyAPeerId: string,
  partyBPeerId: string,
  gameType:     string,
  stakePerSide: bigint = DEFAULT_STAKE_MOJOS,
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
    partyABalance: stakePerSide,
    partyBBalance: stakePerSide,
    totalAmount:   stakePerSide * BigInt(2),
    createdAt:     now,
    updatedAt:     now,
  };
}

// ─── Funding puzzle (stub) ────────────────────────────────────────────────────

/**
 * Build the 2-of-2 funding CoinSpend for the channel coin.
 *
 * TODO: Replace with real CLVM serialisation.
 *   puzzle = pay_to_delegated_puzzle_or_hidden_puzzle(agg_channel_pk)
 *   solution = [[CREATE_COIN, channel_puzzle_hash, amount], [ASSERT_HEIGHT_ABSOLUTE, T]]
 *   serialise with: encode_clvm(puzzle), encode_clvm(solution)
 */
function buildFundingCoinSpend(_channel: StateChannel, fundingCoin: CoinInfo): CoinSpend {
  return {
    coin:           fundingCoin,
    puzzle_reveal:  '0xff01ff02ffff01ff04ffff0101ff0280', // stub — replace with real CLVM
    solution:       '0x80',                               // stub — real: encode_solution(...)
  };
}

// ─── WalletConnect signing ────────────────────────────────────────────────────

/**
 * Request a partial or full signature from Sage via WalletConnect.
 *
 *   PvP  → partial=true  (party_a's half-sig only; party_b countersigns separately)
 *   Gym  → partial=false (player provides full single-party sig; gym signs server-side)
 *
 *   chip0002_signCoinSpends docs (xch-dev/sage):
 *     params: { coin_spends: CoinSpend[], partial: boolean, auto_submit: boolean }
 *     result: { spend_bundle: { coin_spends, aggregated_signature } }
 */
export async function requestFundingSignature(
  session:     any,
  channel:     StateChannel,
  fundingCoin: CoinInfo,
): Promise<SpendBundle> {
  if (!session) {
    throw new Error('[aWizard] requestFundingSignature: no WalletConnect session — connect wallet first');
  }

  const coinSpend = buildFundingCoinSpend(channel, fundingCoin);
  const isPartial = channel.gameType === 'pvp'; // PvP needs half-sig only

  const result: { spend_bundle: SpendBundle } = await session.request({
    method: 'chip0002_signCoinSpends',
    params: {
      coin_spends:  [coinSpend],
      partial:      isPartial,
      auto_submit:  false,
    },
  });

  return result.spend_bundle;
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
 * @param stakeOverride  custom stake in mojos (defaults to 100 TXCH per side)
 */
export async function openGymChannel(
  walletAddress: string,
  session:       any,
  tier:          number,
  peerId:        string,
  stakeOverride?: bigint,
): Promise<StateChannel> {
  const gymWallet = getGymWallet(tier);
  const channel   = createPendingChannel(
    walletAddress,
    gymWallet,
    peerId,
    `gym-tier-${tier}`,
    `gym_tier${tier}`,
    stakeOverride,
  );

  // Placeholder funding coin — in production, select from player's unspent coins
  // TODO: call wallet RPC to get an actual coin with sufficient balance
  const fundingCoin: CoinInfo = {
    parent_coin_info: '0x' + channel.channelId.replace('ch_', '').padEnd(64, '0'),
    puzzle_hash:      '0x' + channel.channelId.replace('ch_', '').padEnd(64, 'f'),
    amount:           channel.totalAmount,
  };

  // Sign
  const bundle = await requestFundingSignature(session, channel, fundingCoin);

  // Broadcast via gym-server
  const result = await broadcastFundingBundle(channel, bundle);

  return {
    ...channel,
    status:        result.status === 'broadcast' ? 'locked' : 'pending',
    channelCoin:   fundingCoin,
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
): Promise<{ channel: StateChannel; inviteCode: string }> {
  const inviteCode  = generateInviteCode();
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

  const fundingCoin: CoinInfo = {
    parent_coin_info: '0x' + channel.channelId.replace('ch_', '').padEnd(64, '0'),
    puzzle_hash:      '0x' + channel.channelId.replace('ch_', '').padEnd(64, 'f'),
    amount:           channel.totalAmount,
  };

  // Party A half-sig
  const bundle = await requestFundingSignature(session, channel, fundingCoin);

  // Stage with relay
  await broadcastFundingBundle(channel, bundle); // returns pending_peer

  console.log(`[aWizard] PvP lobby created: ${channel.channelId} (code: ${inviteCode})`);

  return {
    channel: { ...channel, fundingBundle: bundle, channelCoin: fundingCoin, updatedAt: Date.now() },
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
  // Simulate finding the pending channel:
  const placeholderPartyA = 'xch1host' + '0'.repeat(55);
  const channel = createPendingChannel(
    placeholderPartyA,
    walletAddress,
    `pvp-host-${inviteCode}`,
    peerId,
    'pvp',
  );

  const fundingCoin: CoinInfo = {
    parent_coin_info: '0x' + channel.channelId.replace('ch_', '').padEnd(64, '0'),
    puzzle_hash:      '0x' + channel.channelId.replace('ch_', '').padEnd(64, 'f'),
    amount:           channel.totalAmount,
  };

  // Party B countersigns
  const bundle = await requestFundingSignature(session, channel, fundingCoin);

  // TODO: POST party_b's half-sig to relay; relay aggregates + broadcasts
  const result = await broadcastFundingBundle(channel, bundle);

  console.log(`[aWizard] Joined PvP lobby (code: ${inviteCode})`);
  return {
    ...channel,
    partyBWallet:  walletAddress,
    status:        result.status === 'broadcast' ? 'locked' : 'pending',
    fundingBundle: bundle,
    channelCoin:   fundingCoin,
    updatedAt:     Date.now(),
  };
}

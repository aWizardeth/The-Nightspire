// ─────────────────────────────────────────────────────────────────
//  Auth utilities — Discord OAuth2 + optional NFT-gate
// ─────────────────────────────────────────────────────────────────

const BOW_APP_URL = import.meta.env.VITE_BOW_APP_URL as string ?? 'http://localhost:3000';

/** Minimal Discord user profile returned by /users/@me */
export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  global_name: string | null;
}

/**
 * Fetch the authenticated user's Discord profile.
 * In development with mock tokens, returns mock user data.
 */
export async function fetchDiscordUser(accessToken: string): Promise<DiscordUser> {
  // Development bypass for mock tokens
  if (accessToken.startsWith('mock_')) {
    console.log('[aWizard] Using mock user data for development');
    return {
      id: 'dev_user_12345',
      username: 'DevWizard',
      discriminator: '0001', 
      avatar: null,
      global_name: 'Development Wizard',
    };
  }

  // Real Discord API call
  const res = await fetch('https://discord.com/api/v10/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`[aWizard] Failed to fetch Discord user: ${res.status}`);
  return res.json() as Promise<DiscordUser>;
}

/**
 * Check whether the user holds a qualifying NFT from the
 * approved collection. Calls a bow-app API route that performs
 * the on-chain lookup.
 *
 * If `VITE_REQUIRE_NFT_GATE` is "false" or unset, returns true
 * (gate disabled).
 */
export async function checkNftGate(walletAddress: string): Promise<boolean> {
  const gateEnabled = (import.meta.env.VITE_REQUIRE_NFT_GATE as string) === 'true';
  if (!gateEnabled) return true;

  const res = await fetch(`${BOW_APP_URL}/api/nft/gate?wallet=${walletAddress}`);
  if (!res.ok) {
    console.error('[aWizard] NFT gate check failed', res.status);
    return false;
  }

  const data = (await res.json()) as { allowed: boolean };
  return data.allowed;
}

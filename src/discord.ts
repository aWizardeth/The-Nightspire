// ─────────────────────────────────────────────────────────────────
//  Discord Embedded App SDK — bootstrap & helpers
//  Initialises the SDK, handles the OAuth2 handshake, and exposes
//  the ready client instance for the rest of the app.
// ─────────────────────────────────────────────────────────────────
import { DiscordSDK } from '@discord/embedded-app-sdk';

const DISCORD_CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID as string;

if (!DISCORD_CLIENT_ID) {
  console.error('[aWizard] VITE_DISCORD_CLIENT_ID is not set — the Activity will not function.');
}

export const discordSdk = new DiscordSDK(DISCORD_CLIENT_ID);

/**
 * Call once on app mount. Performs the Activity handshake and
 * authorises the user with Discord OAuth2 scopes.
 *
 * Returns the OAuth2 access_token so downstream code can call
 * Discord REST or our own API with user context.
 */
export async function setupDiscordSdk(): Promise<{ accessToken: string }> {
  // Check if we're running inside Discord iframe
  const params = new URLSearchParams(window.location.search);
  const frameId = params.get('frame_id');
  
  if (!frameId) {
    throw new Error('This Activity must be launched from Discord. Visit discord.gg and add the Battle of Wizards app to your server.');
  }

  // 1. Wait for the READY event from Discord client
  await discordSdk.ready();
  console.log('[aWizard] Discord SDK ready');

  // 2. Authorise — request identity scope
  const { code } = await discordSdk.commands.authorize({
    client_id: DISCORD_CLIENT_ID,
    response_type: 'code',
    state: '',
    prompt: 'none',
    scope: ['identify', 'guilds', 'applications.commands'],
  });

  // 3. Exchange the code for a token via our backend
  //    Use mock token when no backend is configured
  let access_token: string;
  
  if (!import.meta.env.VITE_TOKEN_EXCHANGE_URL) {
    // No backend configured - use mock token
    console.log('[aWizard] No backend configured, using mock token');
    access_token = 'mock_development_token_' + Date.now();
  } else {
    // Production token exchange
    const tokenEndpoint = import.meta.env.VITE_TOKEN_EXCHANGE_URL as string;

    const res = await fetch(tokenEndpoint, {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });

    if (!res.ok) {
      throw new Error(`[aWizard] Token exchange failed: ${res.status}`);
    }

    const result = (await res.json()) as { access_token: string };
    access_token = result.access_token;
  }

  // 4. Authenticate with the SDK (skip if using mock token)
  if (access_token.startsWith('mock_')) {
    console.log('[aWizard] Skipping SDK authentication with mock token');
    return { accessToken: access_token };
  }

  const auth = await discordSdk.commands.authenticate({ access_token });

  if (!auth) {
    throw new Error('[aWizard] Discord authentication failed');
  }

  console.log('[aWizard] Authenticated as', auth.user?.username);
  return { accessToken: access_token };
}

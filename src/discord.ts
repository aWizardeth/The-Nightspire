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

// Lazy singleton — only instantiated when inside a Discord iframe context
let _discordSdk: DiscordSDK | null = null;

// Check if we're running in Discord's iframe context
function isInDiscord(): boolean {
  try {
    // Check for Discord-specific URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const hasFrameId = urlParams.has('frame_id');
    const hasInstanceId = urlParams.has('instance_id');
    
    // Check if we're in an iframe (Discord loads Activities in iframes)
    const isIframe = window !== window.parent;
    
    // Check for Discord's parent origin
    const isDiscordOrigin = document.referrer.includes('discord.com') || 
                           document.referrer.includes('discordapp.com') ||
                           window.location.ancestorOrigins?.[0]?.includes('discord.com');

    console.log('[aWizard Discord] Environment check:', {
      hasFrameId,
      hasInstanceId,
      isIframe,
      isDiscordOrigin,
      referrer: document.referrer,
      search: window.location.search
    });

    return hasFrameId || hasInstanceId || (isIframe && isDiscordOrigin);
  } catch (error) {
    console.warn('[aWizard Discord] Environment check failed:', error);
    return false;
  }
}

export function getDiscordSdk(): DiscordSDK {
  if (!_discordSdk) {
    if (!isInDiscord()) {
      throw new Error('[aWizard Discord] Cannot initialize SDK - not running in Discord context. Missing frame_id parameter.');
    }
    _discordSdk = new DiscordSDK(DISCORD_CLIENT_ID);
  }
  return _discordSdk;
}

// Back-compat export used by WizardChat and useDiscordSdk hook
export const discordSdk = {
  get guildId()    { return getDiscordSdk().guildId; },
  get channelId()  { return getDiscordSdk().channelId; },
  get instanceId() { return getDiscordSdk().instanceId; },
};

/**
 * Call once on app mount. Performs the Activity handshake and
 * authorises the user with Discord OAuth2 scopes.
 *
 * Returns the OAuth2 access_token so downstream code can call
 * Discord REST or our own API with user context.
 */
export async function setupDiscordSdk(): Promise<{ accessToken: string }> {
  const discordSdk = getDiscordSdk();

  // 1. Wait for the READY event from Discord client
  await discordSdk.ready();
  console.log('[aWizard] Discord SDK ready');

  // 2. Authorise — request identity scope (minimal announcements)
  const { code } = await discordSdk.commands.authorize({
    client_id: DISCORD_CLIENT_ID,
    response_type: 'code',
    state: '',
    prompt: 'none', // Reduces auth popups
    scope: ['identify'], // Minimal scope to reduce activity tracking
  });

  // 3. Exchange the code for a token via our backend
  //    In development, we can bypass this with a mock token
  const isDev = import.meta.env.DEV;
  let access_token: string;
  
  if (isDev && !import.meta.env.VITE_TOKEN_EXCHANGE_URL) {
    // Development bypass - use mock token
    console.log('[aWizard] Using mock token for local development');
    access_token = 'mock_development_token_' + Date.now();
  } else {
    // Production token exchange
    const tokenEndpoint =
      (import.meta.env.VITE_TOKEN_EXCHANGE_URL as string) ?? '/.proxy/api/token';

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

  // 4. Authenticate with the SDK (skip in dev mode if using mock token)
  if (isDev && access_token.startsWith('mock_')) {
    console.log('[aWizard] Skipping SDK authentication in development');
    return { accessToken: access_token };
  }

  const auth = await discordSdk.commands.authenticate({ access_token });

  if (!auth) {
    throw new Error('[aWizard] Discord authentication failed');
  }

  console.log('[aWizard] Authenticated as', auth.user?.username);
  return { accessToken: access_token };
}


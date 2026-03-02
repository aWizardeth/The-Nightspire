import { type VercelRequest, type VercelResponse } from '@vercel/node';

/**
 * Vercel Serverless Function for Discord OAuth2 Token Exchange
 * 
 * Exchanges Discord authorization code for access_token
 * Required for Discord Activities to authenticate users
 */
export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  // Only accept POST requests
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { code } = request.body;

    if (!code) {
      return response.status(400).json({ error: 'Authorization code is required' });
    }

    // Discord OAuth2 credentials from environment
    // Note: VITE_DISCORD_CLIENT_ID works in serverless functions too
    const clientId = process.env.VITE_DISCORD_CLIENT_ID || process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('[TokenExchange] Missing Discord credentials');
      return response.status(500).json({ error: 'Server configuration error' });
    }

    // Exchange code for access_token with Discord
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[TokenExchange] Discord token exchange failed:', errorText);
      return response.status(tokenResponse.status).json({ 
        error: 'Token exchange failed with Discord' 
      });
    }

    const tokenData = await tokenResponse.json();

    // Return just the access_token to client
    return response.status(200).json({ 
      access_token: tokenData.access_token 
    });

  } catch (error) {
    console.error('[TokenExchange] Unexpected error:', error);
    return response.status(500).json({ error: 'Internal server error' });
  }
}
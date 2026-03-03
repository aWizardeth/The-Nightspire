import { type VercelRequest, type VercelResponse } from '@vercel/node';

/**
 * /api/img — server-side IPFS/CDN image proxy.
 *
 * Discord embeds Activities inside a sandboxed iframe with a strict CSP.
 * Fetching from nftstorage.link / ipfs.io directly can be blocked.
 * This edge function fetches the image server-side and pipes it back,
 * so the browser only ever requests from the same Vercel origin.
 *
 * GET /api/img?url={encodedHttpsUrl}
 *
 * Allowed origins: nftstorage.link, ipfs.io, cloudflare-ipfs.com,
 *                  mintgarden.io, dexie.space
 *
 * Cache: 24h on edge, 7d stale-while-revalidate.
 */

const ALLOWED_ORIGINS = [
  'nftstorage.link',
  'ipfs.io',
  'cloudflare-ipfs.com',
  'w3s.link',
  'mintgarden.io',
  'dexie.space',
  'arweave.net',
];

function isAllowed(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    if (protocol !== 'https:') return false;
    return ALLOWED_ORIGINS.some(
      (origin) => hostname === origin || hostname.endsWith('.' + origin),
    );
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS pre-flight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).end();

  const raw = (req.query.url as string | undefined)?.trim();
  if (!raw) return res.status(400).json({ error: 'Missing url parameter' });

  const decoded = decodeURIComponent(raw);
  if (!isAllowed(decoded)) {
    return res.status(403).json({ error: 'Origin not in allowlist', url: decoded });
  }

  try {
    const upstream = await fetch(decoded, {
      headers: { Accept: '*/*' },  // must accept JSON (NFT metadata) as well as images
      // 10-second timeout via AbortSignal
      signal: AbortSignal.timeout(10_000),
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Upstream ${upstream.status}` });
    }

    const contentType = upstream.headers.get('content-type') ?? 'image/png';
    const buffer = await upstream.arrayBuffer();

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', buffer.byteLength);
    // Cache aggressively — NFT images are immutable (content-addressed)
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).send(Buffer.from(buffer));
  } catch (e) {
    return res.status(502).json({ error: `Proxy fetch failed: ${String(e)}` });
  }
}

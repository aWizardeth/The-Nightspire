import { type VercelRequest, type VercelResponse } from '@vercel/node';

/**
 * Vercel Serverless Function — MintGarden NFT image proxy
 * GET /api/nft?id={nftId}  (or /api/nft/{nftId} via path param)
 *
 * Returns the raw MintGarden response so the client can pull
 * preview_url / thumbnail_uri for missing card images.
 * Caches on the edge for 5 minutes to avoid hammering the API.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const nftId =
    (req.query.id as string | undefined)?.trim() ??
    (req.query.nftId as string | undefined)?.trim();

  if (!nftId || nftId.length < 10) {
    return res.status(400).json({ error: 'Missing or invalid nftId query param' });
  }

  try {
    const upstream = await fetch(
      `https://api.mintgarden.io/nfts/${encodeURIComponent(nftId)}`,
      { headers: { Accept: 'application/json' } },
    );

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `MintGarden returned ${upstream.status}` });
    }

    const data = await upstream.json();

    // Cache for 5 min on Vercel edge
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(data);
  } catch (e) {
    return res.status(502).json({ error: `Upstream failure: ${String(e)}` });
  }
}

// ─────────────────────────────────────────────────────────────────
//  API client — fetch helpers for gym-server, bow-app, & wizard bot
// ─────────────────────────────────────────────────────────────────

const WIZARD_BOT_URL = import.meta.env.VITE_AWIZARD_BOT_URL as string ?? '';
const GYM_SERVER_URL = import.meta.env.VITE_GYM_SERVER_URL as string ?? 'http://localhost:3001';
const BOW_APP_URL    = import.meta.env.VITE_BOW_APP_URL as string ?? 'http://localhost:3000';

// ── Wizard Bot ───────────────────────────────────────────────────

export interface WizardRequest {
  userId: string;
  guildId?: string;
  message: string;
  context?: {
    page: string;
    wallet?: string;
  };
}

export interface WizardAction {
  type: 'navigate' | 'toast' | 'link';
  label: string;
  target: string;
}

export interface WizardResponse {
  reply: string;
  actions?: WizardAction[];
}

export async function sendWizardMessage(req: WizardRequest): Promise<WizardResponse> {
  const res = await fetch(`${WIZARD_BOT_URL}/api/wizard/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`Wizard API error: ${res.status}`);
  return res.json() as Promise<WizardResponse>;
}

export async function fetchWizardStatus(): Promise<{ online: boolean }> {
  const res = await fetch(`${WIZARD_BOT_URL}/api/wizard/status`);
  if (!res.ok) return { online: false };
  return res.json() as Promise<{ online: boolean }>;
}

// ── Gym Server ───────────────────────────────────────────────────

export async function fetchGymStatus() {
  const res = await fetch(`${GYM_SERVER_URL}/`);
  if (!res.ok) throw new Error(`Gym server error: ${res.status}`);
  return res.json();
}

// ── BOW App API ──────────────────────────────────────────────────

export async function fetchNft(nftId: string) {
  const res = await fetch(`${BOW_APP_URL}/api/nft/${nftId}`);
  if (!res.ok) throw new Error(`NFT API error: ${res.status}`);
  return res.json();
}

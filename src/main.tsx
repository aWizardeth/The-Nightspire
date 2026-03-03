import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// ── Discord Activity WebSocket relay intercept ──────────────────────────────
// Must run before WalletConnect modules initialise so that any WebSocket
// constructor calls—including those made by bundled isomorphic-ws—go through
// this wrapper.  We capture window.WebSocket here at module init time
// (which IS before user code in ES module execution order), replace it with
// our wrapper, and store raw relay messages in a global ring-buffer that the
// UI can read for diagnostics.
const isIframe = window !== window.parent;
(window as any).__wcRelayMessages = [] as string[];

if (isIframe) {
  const OrigWS = window.WebSocket;
  class ProxiedWS extends OrigWS {
    constructor(url: string | URL, protocols?: string | string[]) {
      const s = String(url);
      let finalUrl = s;
      if (s.includes('relay.walletconnect.com')) {
        // Rewrite to go through the Discord proxy (/walletconnect URL Mapping)
        finalUrl = s.replace(
          /wss:\/\/relay\.walletconnect\.com/,
          `wss://${window.location.hostname}/walletconnect`,
        );
        console.log('[aWizard] WebSocket intercept: relay.walletconnect.com →', finalUrl);
      }
      super(finalUrl, protocols);
      this.addEventListener('message', (ev: MessageEvent) => {
        const ring: string[] = (window as any).__wcRelayMessages;
        ring.push(String(ev.data).slice(0, 200));
        if (ring.length > 10) ring.shift();
        console.log('[aWizard] relay ← inbound:', String(ev.data).slice(0, 120));
      });
    }
  }
  // Copy static constants (OPEN, CLOSED, etc.)
  Object.assign(ProxiedWS, {
    CONNECTING: OrigWS.CONNECTING,
    OPEN: OrigWS.OPEN,
    CLOSING: OrigWS.CLOSING,
    CLOSED: OrigWS.CLOSED,
  });
  window.WebSocket = ProxiedWS as unknown as typeof WebSocket;
  console.log('[aWizard] ✅ WebSocket constructor patched for Discord Activity proxy');
}
// ───────────────────────────────────────────────────────────────────────────

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

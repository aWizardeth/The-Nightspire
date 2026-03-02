// ─────────────────────────────────────────────────────────────────
//  useDiscordSdk — React hook wrapping the Discord Embedded SDK
// ─────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { discordSdk } from '../discord';

interface DiscordSdkState {
  ready: boolean;
  instanceId: string | null;
  channelId: string | null;
  guildId: string | null;
}

/**
 * Provides reactive access to Discord Activity metadata.
 * Must be used after `setupDiscordSdk()` has resolved.
 */
export function useDiscordSdk(): DiscordSdkState {
  const [state, setState] = useState<DiscordSdkState>({
    ready: false,
    instanceId: null,
    channelId: null,
    guildId: null,
  });

  useEffect(() => {
    // The SDK may already be ready by the time this hook mounts
    try {
      setState({
        ready: true,
        instanceId: discordSdk.instanceId,
        channelId: discordSdk.channelId,
        guildId: discordSdk.guildId,
      });
    } catch {
      // Not inside Discord — leave defaults (null)
      setState({ ready: false, instanceId: null, channelId: null, guildId: null });
    }
  }, []);

  return state;
}

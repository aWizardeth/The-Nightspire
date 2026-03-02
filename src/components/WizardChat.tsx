// ─────────────────────────────────────────────────────────────────
//  WizardChat — conversational panel with the aWizard bot
// ─────────────────────────────────────────────────────────────────
import { useState, useRef, useEffect } from 'react';
import type { DiscordUser } from '../auth';

interface ChatMessage {
  role: 'user' | 'wizard';
  content: string;
}

interface WizardChatProps {
  user: DiscordUser | null;
}

export default function WizardChat({ user }: WizardChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'wizard', content: `🧙 Greetings${user?.global_name ? `, ${user.global_name}` : ', traveller'}! I am aWizard — your guide through the Arcane realm. Ask me anything about battles, NFTs, or the leaderboard.` },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setInput('');
    setLoading(true);

    try {
      // Try Discord bot integration first, fallback to direct AI
      const reply = await getWizardResponse(text);
      setMessages((prev) => [...prev, { role: 'wizard', content: reply }]);
    } catch (error) {
      console.error('[WizardChat] AI error:', error);
      setMessages((prev) => [
        ...prev,
        { role: 'wizard', content: '⚠️ A curse disrupted the connection. The wizard will return shortly.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  // Hybrid wizard response: bot integration + GitHub Models fallback
  async function getWizardResponse(message: string): Promise<string> {
    // Method 1: Try communicating with Discord bot through DM
    try {
      const botResponse = await tryDiscordBotInteraction(message);
      if (botResponse) {
        console.log('[WizardChat] Got response from Discord bot');
        return botResponse;
      }
    } catch (error) {
      console.log('[WizardChat] Discord bot unavailable, using fallback');
    }

    // Method 2: Fallback to direct GitHub Models API call
    return await callGitHubModelsAPI(message);
  }

  // Try to interact with Discord bot through Discord systems
  async function tryDiscordBotInteraction(message: string): Promise<string | null> {
    try {
      const { discordSdk } = await import('../discord');
      
      // Bot Configuration Required:
      // Your Discord bot should listen for DMs starting with "[ACTIVITY]"
      // and respond immediately for Activity integration
      
      const BOT_USER_ID = '1477105366520041532'; // aWizard Discord bot
      
      // Create DM channel with bot
      const dmChannel = await discordSdk.commands.createDm({
        recipient_id: BOT_USER_ID
      });

      // Send message to bot with Activity identifier
      const activityMessage = `[ACTIVITY] ${user?.global_name || 'User'}: ${message}`;
      
      // Get stored access token
      const accessToken = localStorage.getItem('discord_access_token');
      if (!accessToken) {
        throw new Error('No Discord access token available');
      }

      // Send message to bot via Discord API
      const response = await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: activityMessage
        })
      });

      if (!response.ok) {
        throw new Error(`Discord API failed: ${response.status}`);
      }

      // Wait for bot response with timeout
      const botReply = await waitForBotResponse(dmChannel.id, 4000); // 4 second timeout
      return botReply;

    } catch (error) {
      console.log('[WizardChat] Discord bot interaction failed:', error);
      return null;
    }
  }

  // Wait for bot response in DM channel
  async function waitForBotResponse(channelId: string, timeoutMs: number): Promise<string | null> {
    const startTime = Date.now();
    const accessToken = localStorage.getItem('discord_access_token');
    const BOT_USER_ID = '1477105366520041532'; // aWizard Discord bot
    
    if (!accessToken) return null;

    while (Date.now() - startTime < timeoutMs) {
      try {
        const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages?limit=2`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          }
        });

        if (response.ok) {
          const messages = await response.json();
          
          // Look for recent bot response
          for (const message of messages) {
            if (message.author.id === BOT_USER_ID && 
                new Date(message.timestamp).getTime() > startTime &&
                !message.content.startsWith('[ACTIVITY]')) { // Exclude our own message
              return message.content;
            }
          }
        }

        // Wait 600ms before checking again
        await new Promise(resolve => setTimeout(resolve, 600));
      } catch (error) {
        console.log('[WizardChat] Error checking for bot response:', error);
        break;
      }
    }

    return null; // Timeout reached
  }

  // Fallback: Direct GitHub Models API call (your existing implementation)
  async function callGitHubModelsAPI(message: string): Promise<string> {
    const discordContext = await gatherDiscordContext();

    const response = await fetch('/api/wizard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        message,
        userId: user?.id,
        discordContext
      }),
    });

    if (!response.ok) {
      throw new Error(`GitHub Models API failed: ${response.status}`);
    }

    const data = await response.json();
    return data.response || 'The wizard is silent... try again.';
  }

  // Gather rich Discord context for AI
  async function gatherDiscordContext() {
    try {
      // Import Discord SDK (avoid circular imports by importing here)
      const { discordSdk } = await import('../discord');
      
      const context: any = {
        username: user?.global_name || user?.username || 'traveler',
        guildId: discordSdk.guildId,
        channelId: discordSdk.channelId,
      };

      // Try to get guild info if available  
      if (context.guildId) {
        try {
          const guild = await discordSdk.commands.getGuild({ guild_id: context.guildId });
          context.guildName = guild?.name || 'unknown realm';
        } catch (e) {
          console.log('[WizardChat] Could not fetch guild info');
        }
      }

      // Try to get channel info if available
      if (context.channelId) {
        try {
          const channel = await discordSdk.commands.getChannel({ channel_id: context.channelId });
          context.channelName = channel?.name || 'unknown channel';
        } catch (e) {
          console.log('[WizardChat] Could not fetch channel info');
        }
      }

      return context;
    } catch (error) {
      console.log('[WizardChat] Discord context unavailable:', error);
      return {
        username: user?.global_name || user?.username || 'traveler',
        guildName: 'Discord Activity',
        channelName: 'embedded browser'
      };
    }
  }

  // Gather rich Discord context for AI
  async function gatherDiscordContext() {
    try {
      // Import Discord SDK (avoid circular imports by importing here)
      const { discordSdk } = await import('../discord');
      
      const context: any = {
        username: user?.global_name || user?.username || 'traveler',
        guildId: discordSdk.guildId,
        channelId: discordSdk.channelId,
      };

      // Try to get guild info if available  
      if (context.guildId) {
        try {
          const guild = await discordSdk.commands.getGuild({ guild_id: context.guildId });
          context.guildName = guild?.name || 'unknown realm';
        } catch (e) {
          console.log('[WizardChat] Could not fetch guild info');
        }
      }

      // Try to get channel info if available
      if (context.channelId) {
        try {
          const channel = await discordSdk.commands.getChannel({ channel_id: context.channelId });
          context.channelName = channel?.name || 'unknown channel';
        } catch (e) {
          console.log('[WizardChat] Could not fetch channel info');
        }
      }

      return context;
    } catch (error) {
      console.log('[WizardChat] Discord context unavailable:', error);
      return {
        username: user?.global_name || user?.username || 'traveler',
        guildName: 'Discord Activity',
        channelName: 'embedded browser'
      };
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-2">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`px-3 py-2 rounded-lg text-sm max-w-[85%] ${
              msg.role === 'wizard'
                ? 'bg-[var(--bg-secondary)] self-start'
                : 'bg-[var(--accent)] text-white self-end ml-auto'
            }`}
          >
            {msg.content}
          </div>
        ))}
        {loading && (
          <div className="px-3 py-2 rounded-lg text-sm bg-[var(--bg-secondary)] self-start animate-pulse text-[var(--text-muted)]">
            🧙 Consulting the arcane energies…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
        className="flex gap-2 pt-2 border-t border-[var(--bg-tertiary)]"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the wizard…"
          className="flex-1 bg-[var(--bg-tertiary)] rounded-md px-3 py-2 text-sm outline-none placeholder:text-[var(--text-muted)] focus:ring-1 focus:ring-[var(--accent)]"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40 rounded-md px-4 py-2 text-sm font-medium transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
}

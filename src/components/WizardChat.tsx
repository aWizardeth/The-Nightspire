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

  // Get wizard response using Activity API
  async function getWizardResponse(message: string): Promise<string> {
    return await sendWizardMessage(message);
  }

  // Send message to aWizard via Activity API (simplified)
  async function sendWizardMessage(message: string): Promise<string> {
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
      throw new Error(`Wizard API failed: ${response.status}`);
    }

    const data = await response.json();
    return data.reply || 'The wizard is contemplating your query... 🧙';
  }

  // Gather Discord context for AI prompting  
  async function gatherDiscordContext() {
    try {
      const { discordSdk } = await import('../discord');
      
      const context: any = {
        username: user?.global_name || user?.username || 'traveler',
        guildId: discordSdk.guildId,
        channelId: discordSdk.channelId,
      };

      // Try to get basic info without using unavailable SDK methods
      if (context.guildId) {
        context.guildName = 'Discord Server';
      }
      
      if (context.channelId) {
        context.channelName = 'Activity Channel';
      }

      return context;
    } catch (error) {
      console.log('[WizardChat] Could not gather Discord context');
      return {
        username: user?.global_name || user?.username || 'traveler',
        guildName: 'Discord Server', 
        channelName: 'Activity Channel',
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

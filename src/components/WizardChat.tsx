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
    { role: 'wizard', content: `🧙 Greetings${user?.global_name ? `, ${user.global_name}` : ', traveller'}! I am aWizard — your guide through the Arcane realm. Ask me anything about battles, Chellyz, NFTs, or the leaderboard.` },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const QUICK_PROMPTS = [
    { label: '🌸 How to play Chellyz?',   text: 'How do I play the Chellyz card game? Explain the basics.' },
    { label: '⚔️ How does battling work?', text: 'How do PvE gym battles work in Battle of Wizards?' },
    { label: '📈 How do I raise my APS?',  text: 'How do I raise my Arcane Power Score and unlock better rewards?' },
    { label: '🏰 What is the Lobby?',      text: 'What is the battle lobby and what is a state channel?' },
  ];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(overrideText?: string) {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;

    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    if (!overrideText) setInput('');
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

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-2">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`px-3 py-2 rounded-lg text-sm max-w-[85%] ${
              msg.role === 'wizard' ? 'self-start' : 'self-end ml-auto'
            }`}
            style={
              msg.role === 'wizard'
                ? { background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-color)' }
                : { background: 'var(--accent)', color: '#fff' }
            }
          >
            {msg.content}
          </div>
        ))}
        {loading && (
          <div
            className="px-3 py-2 rounded-lg text-sm self-start animate-pulse"
            style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}
          >
            🧙 Consulting the arcane energies…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick prompts — shown until user sends first message */}
      {messages.length <= 1 && !loading && (
        <div className="flex flex-wrap gap-1.5 py-2" style={{ borderTop: '1px solid var(--border-color)' }}>
          {QUICK_PROMPTS.map((qp) => (
            <button
              key={qp.label}
              onClick={() => handleSend(qp.text)}
              className="rounded-full px-2.5 py-1 text-[11px] font-medium transition-all"
              style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.4)', color: '#c4b5fd' }}
            >
              {qp.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
        className="flex gap-2 pt-2"
        style={{ borderTop: messages.length <= 1 ? 'none' : '1px solid var(--border-color)' }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the wizard…"
          className="glow-input flex-1 text-sm"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="glow-btn disabled:opacity-40 text-sm"
        >
          Send
        </button>
      </form>
    </div>
  );
}

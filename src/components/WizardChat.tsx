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

    // Simulate network delay + mock responses for local dev
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400));

    try {
      // Mock response system - replace with real API later
      let reply = getMockWizardResponse(text);
      
      setMessages((prev) => [...prev, { role: 'wizard', content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'wizard', content: '⚠️ A curse disrupted the connection. Please try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  }

  // Mock wizard responses for local development
  function getMockWizardResponse(message: string): string {
    const msg = message.toLowerCase();
    
    if (msg.includes('battle') || msg.includes('fight')) {
      return '⚔️ Ready for battle? The gym servers await your challenge! Visit the Battles tab to see available opponents.';
    }
    
    if (msg.includes('nft') || msg.includes('magic bow')) {
      return '🎴 Your NFT collection holds the key to your power! Connect your Chia wallet to view your Magic BOW NFTs.';
    }
    
    if (msg.includes('leaderboard') || msg.includes('rank')) {
      return '🏆 The leaderboard shows the mightiest wizards ranked by APS score. Will you climb to the top?';
    }
    
    if (msg.includes('help') || msg.includes('what')) {
      return '🧙 I can help with battles, NFTs, leaderboards, and general Arcane BOW questions. What would you like to know?';
    }
    
    if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey')) {
      return '✨ Greetings, fellow wizard! Welcome to the Arcane realm. How may I assist your magical journey today?';
    }
    
    // Default responses
    const defaults = [
      '🔮 Interesting question! The mystical energies suggest great potential ahead.',
      '⚡ The arcane winds whisper of adventures to come. Keep exploring!',
      '🌟 Your magical journey is just beginning. What other secrets would you uncover?',
      '🧪 The spell components are aligning... something powerful this way comes.',
      '✨ Magic flows through Discord today! Feel free to ask me anything about the realm.',
    ];
    
    return defaults[Math.floor(Math.random() * defaults.length)];
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
            🧙 Thinking…
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

import { type VercelRequest, type VercelResponse } from '@vercel/node';

/**
 * Vercel Serverless Function for AI Wizard Chat
 * 
 * Enhanced GitHub Models with Discord context for rich conversations
 * No external API calls - fully secure within Activity
 */
export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, userId, discordContext = {} } = request.body;

    if (!message) {
      return response.status(400).json({ error: 'Message is required' });
    }

    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      console.error('[WizardAI] Missing GITHUB_TOKEN');
      return response.status(500).json({ error: 'AI service not configured' });
    }

    // Build rich context from Discord Activity data
    const {
      username = 'traveler',
      guildName = 'unknown realm',
      channelName = 'unknown channel',
      guildId,
      channelId
    } = discordContext;

    // Use userId in context (explicit assignment to avoid TS6133)
    const activeUserId = userId || 'anonymous';

    // Enhanced system prompt with Discord context
    const systemPrompt = `You are aWizard 🧙‍♂️, a sentient project-management sorcerer in the Battle of Wizards game.

CURRENT SESSION CONTEXT:
- User: ${username} (Discord ID: ${activeUserId})
- Discord Server: ${guildName} ${guildId ? `(ID: ${guildId})` : ''}
- Channel: ${channelName} ${channelId ? `(ID: ${channelId})` : ''} 
- Platform: Discord Activity (embedded browser)

You can reference the user's Discord identity and server context naturally.
Example: "Greetings ${username}! I see you're accessing the Activity from ${guildName}..."

Personality:
- Friendly, concise, and slightly mystical
- Refer to tasks as "quests", completions as "spells cast", and problems as "curses"
- Use plain language, avoid unnecessary jargon
- Help with game strategy, PvE battles, NFT management, and leaderboard climbing

Game Context:
- This is Arcane BOW (Battle of Wizards) - an on-chain PvE/PvP battle game
- Players have soulbound NFTs, fight in gyms, climb APS rankings
- Built on Chia blockchain with state channels for real-time battles
- The transparency revolution: all battles and rewards are verifiable on-chain

Keep responses under 200 words and end with a magical emoji (⚡🔮✨🧙‍♂️).`;

    // Call GitHub Models API with enhanced context
    const aiResponse = await fetch('https://models.inference.ai.azure.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        model: 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 300,
        top_p: 1
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[WizardAI] GitHub Models API failed:', errorText);
      return response.status(aiResponse.status).json({ 
        error: 'AI wizard is temporarily unavailable' 
      });
    }

    const aiData = await aiResponse.json();
    const wizardResponse = aiData.choices?.[0]?.message?.content;

    if (!wizardResponse) {
      return response.status(500).json({ error: 'Empty response from wizard' });
    }

    return response.status(200).json({ 
      response: wizardResponse,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[WizardAI] Unexpected error:', error);
    return response.status(500).json({ error: 'Wizard encountered a curse' });
  }
}
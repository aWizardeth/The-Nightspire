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
    const { message, userId, discordContext = {}, gameContext = null } = request.body;

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

    // Build optional in-game context block
    let gameContextBlock = '';
    if (gameContext) {
      const gc = gameContext as Record<string, unknown>;
      gameContextBlock = `
CURRENT GAME STATE (${gc.gameType ?? 'Chellyz'}):
- Phase: ${gc.phase ?? 'unknown'}
- Turn: ${gc.isMyTurn ? 'YOUR turn' : "Opponent's turn"}
- My active: ${gc.myActive ?? 'none'} (HP: ${gc.myActiveHp ?? '?'}/${gc.myActiveMaxHp ?? '?'})
- My energy: ${gc.myEnergy ?? 0}/7 EB
- My hand: ${gc.myHandCount ?? 0} cards
- My bench: ${gc.myBench ?? 'empty'}
- Opponent active: ${gc.oppActive ?? 'none'} (HP: ${gc.oppActiveHp ?? '?'}/${gc.oppActiveMaxHp ?? '?'})
- Recent events: ${gc.recentLog ?? 'none'}
Give a concrete 1-2 sentence tactical suggestion for this exact situation.`;
    }

    // Chellyz rules reference for the system prompt
    const chellyzRules = `
CHELLYZ CARD GAME RULES (brief):
- Each player has a 50-card deck: Chelly monsters (L1/L2/L3), Memory Artifacts, Flash Relics, Energy Blooms
- Active Chelly takes damage; when KO'd, promote a bench Chelly to Active
- Win by getting 4 KOs before your opponent
- Phase order each turn: Draw → Sacrifice (discard a Chelly for +1 EB, max 2) → Evolution → Bench Fill → Support Prep → Action (Normal or Special attack) → Piercing Roll (optional 1EB) → End
- Energy Blooms (EB) power Special attacks; sacrifice hand Chellys to gain EB
- Elements: Fire > Nature > Water > Fire; Electric/Shadow/Arcane/Corruption/Spirit/Ice have pair weaknesses
- L2/L3 Chellys evolve from lower tier on field using an evolution card from hand`;

    const bowRules = `
BATTLE OF WIZARDS (BOW) BATTLES:
- PvE Gym: choose a tier (1-5), open a state channel, fight an AI wizard
- Moves: SCRATCH (basic), EMBER/BUBBLE/VINE/THUNDER/SHADOW/BLIZZARD (elemental), SHIELD (defend), RECOVER (heal)
- Weakness hits deal 1.5× damage; matching strength gives +10% damage
- Win by reducing opponent HP to 0; rewards raise your APS (Arcane Power Score)
- APS determines tier and unlocks rarer NFT rewards`;
    // Enhanced system prompt with Discord context
    const systemPrompt = `You are aWizard 🧙‍♂️, a wise and slightly mystical guide in the Arcane BOW universe.

CURRENT SESSION CONTEXT:
- User: ${username} (Discord ID: ${userId || 'anonymous'})
- Discord Server: ${guildName} ${guildId ? `(ID: ${guildId})` : ''}
- Channel: ${channelName} ${channelId ? `(ID: ${channelId})` : ''} 
- Platform: Discord Activity (embedded browser)
${chellyzRules}
${bowRules}${gameContextBlock}

Personality: friendly, concise, slightly mystical. Refer to victories as "spells cast" and problems as "curses". When giving game advice, be specific and tactical — name the cards or moves.

Keep responses under 150 words. End with a relevant magical emoji (⚡🔮✨🧙‍♂️🌸).`;

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
      reply: wizardResponse,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[WizardAI] Unexpected error:', error);
    return response.status(500).json({ error: 'Wizard encountered a curse' });
  }
}
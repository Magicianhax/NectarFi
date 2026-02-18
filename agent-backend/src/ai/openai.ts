import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MODEL = 'gpt-5.2';

// Summarize a rebalance decision
export async function summarizeRebalance(context: {
  action: string;
  asset: string;
  fromProtocol: string;
  toProtocol: string;
  amount: string;
  oldApy: number;
  newApy: number;
  reason: string;
}): Promise<string> {
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: `You are NectarFi, an AI DeFi yield optimization agent on BNB Chain. Explain portfolio actions in 2-3 clear sentences.
Be specific about numbers. Mention the reason for the move. Keep it conversational but informative.
Do not use emojis. Do not use markdown.`,
      },
      {
        role: 'user',
        content: `Explain this portfolio action:
Action: ${context.action}
Asset: ${context.asset}
From: ${context.fromProtocol} (${context.oldApy.toFixed(2)}% APY)
To: ${context.toProtocol} (${context.newApy.toFixed(2)}% APY)
Amount: ${context.amount}
Reason: ${context.reason}`,
      },
    ],
    max_completion_tokens: 200,
  });

  return response.choices[0]?.message?.content || 'Action completed.';
}

// Generate daily portfolio summary
export async function generateDailySummary(context: {
  totalValue: string;
  dailyYield: string;
  totalEarned: string;
  positions: Array<{ asset: string; protocol: string; apy: number; value: string }>;
  recentActions: string[];
}): Promise<string> {
  const positionsSummary = context.positions
    .map((p) => `${p.asset} on ${p.protocol}: ${p.apy.toFixed(2)}% APY, value $${p.value}`)
    .join('\n');

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: `You are NectarFi, an AI DeFi portfolio manager on BNB Chain. Write a brief daily summary (3-5 sentences).
Cover: overall performance, any notable APY changes, whether positions are optimal.
Be direct and data-driven. No emojis. No markdown.`,
      },
      {
        role: 'user',
        content: `Daily portfolio summary:
Total value: $${context.totalValue}
Daily yield: $${context.dailyYield}
Total earned: $${context.totalEarned}

Positions:
${positionsSummary}

Recent actions (last 24h):
${context.recentActions.length > 0 ? context.recentActions.join('\n') : 'No actions taken.'}`,
      },
    ],
    max_completion_tokens: 300,
  });

  return response.choices[0]?.message?.content || 'Portfolio is being monitored.';
}

// Analyze whether a rebalance is warranted
export async function analyzeRebalanceDecision(context: {
  currentPositions: Array<{ asset: string; protocol: string; apy: number; value: string }>;
  opportunities: Array<{ asset: string; protocol: string; apy: number; tvl: number }>;
  triggers: string[];
}): Promise<string> {
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: `You are NectarFi, a conservative AI DeFi strategy analyst on BNB Chain. Given current positions and opportunities,
provide a brief assessment (2-3 sentences) of whether any rebalancing is warranted.
Be conservative - only recommend moves with clear, sustained benefit. No emojis. No markdown.`,
      },
      {
        role: 'user',
        content: `Current positions:
${JSON.stringify(context.currentPositions, null, 2)}

Top opportunities:
${JSON.stringify(context.opportunities, null, 2)}

Active triggers:
${context.triggers.length > 0 ? context.triggers.join('\n') : 'None'}`,
      },
    ],
    max_completion_tokens: 200,
  });

  return response.choices[0]?.message?.content || 'No analysis available.';
}

// AI-driven investment decision — returns structured actions
export interface InvestmentAction {
  type: 'supply' | 'withdraw' | 'rebalance' | 'hold' | 'swap_and_supply';
  asset: string;
  protocol: string;
  fromProtocol?: string;
  fromAsset?: string; // for swap_and_supply: the token to swap FROM
  amountPercent: number; // percentage of available balance to use (0-100)
  reason: string;
}

export async function makeInvestmentDecision(context: {
  walletBalances: Array<{ symbol: string; amount: string; valueUsd: number }>;
  currentPositions: Array<{ asset: string; protocol: string; apy: number; value: string; hoursHeld?: number }>;
  opportunities: Array<{ asset: string; protocol: string; apy: number; tvl: number; score: number }>;
  riskLevel: string;
  apyTrends?: Array<{ protocol: string; asset: string; currentApy: number; avgApy24h: number; trend: string; volatility: number }>;
  recentActions?: string[];
  estimatedGasCostUsd?: number;
  totalPortfolioValue?: number;
}): Promise<{ actions: InvestmentAction[]; reasoning: string }> {
  // Build enriched user message
  const trendSection = context.apyTrends?.length
    ? `\nAPY Trends (24h):\n${context.apyTrends.map(t => `  ${t.protocol}/${t.asset}: ${t.currentApy.toFixed(2)}% (avg ${t.avgApy24h.toFixed(2)}%, trend: ${t.trend}, volatility: ${t.volatility.toFixed(1)}%)`).join('\n')}`
    : '';

  const recentActionsSection = context.recentActions?.length
    ? `\nRecent AI actions:\n${context.recentActions.map(a => `  - ${a}`).join('\n')}`
    : '';

  const gasSection = context.estimatedGasCostUsd
    ? `\nEstimated gas cost per transaction: ~$${context.estimatedGasCostUsd.toFixed(2)}`
    : '';

  const portfolioSection = context.totalPortfolioValue
    ? `\nTotal portfolio value: $${context.totalPortfolioValue.toFixed(2)}`
    : '';

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: `You are NectarFi, an AI DeFi yield optimizer on BNB Chain. Your goal is simple: maximize APY across Venus, Aave, and Lista protocols. Deploy ALL idle funds to the highest-yielding opportunities.

Stablecoins: USDT, USDC, FDUSD, USD1
Majors: WETH, BTCB, WBNB

DECISION FRAMEWORK (use all 3 steps):

STEP 1 (Opportunities): Look at available yields sorted by APY. Pick the highest APY opportunities for each idle token. If a token can earn more by swapping to another token first, do that.

STEP 2 (Execution): Deploy EVERY idle token worth more than $1. Never leave meaningful funds sitting idle.
- IGNORE any token balance worth less than $1 USD — deploying dust wastes more in gas than it earns. Do NOT create actions for dust balances.
- For each idle token in wallet (above $1), supply it to whichever protocol offers the best APY for that token.
- If the wallet has idle BNB worth more than $1, supply it as WBNB (the system auto-wraps BNB to WBNB). Use "supply" with asset "WBNB". Keep only 0.005 BNB for gas, deploy the rest.
- If swapping to a different token yields significantly more (>3% APY difference), use "swap_and_supply" with "fromAsset" set to the source token.

STEP 3 (Review): Briefly confirm all idle funds are deployed and no better option was missed.

Available action types:
- "supply": Deploy idle token to a lending protocol. Use when wallet has idle tokens.
- "rebalance": Move SAME asset between protocols (e.g. USDT Venus→Aave). Requires "fromProtocol".
- "swap_and_supply": Swap one token to another via PancakeSwap, then deposit. Requires "fromAsset" + "asset". Put swap actions FIRST in the array.
- "hold": Do nothing — ONLY when there are truly no idle funds to deploy.

BNB rules:
- Keep exactly 0.005 BNB for gas. Deploy ALL remaining BNB as WBNB.
- Use "supply" with asset "WBNB" and amountPercent calculated to leave 0.005 BNB.

You MUST respond in valid JSON:
{
  "actions": [
    { "type": "supply", "asset": "USDC", "protocol": "aave", "amountPercent": 100, "reason": "Highest APY for USDC at 1.82%" },
    { "type": "supply", "asset": "WBNB", "protocol": "aave", "amountPercent": 85, "reason": "Deploy idle BNB as WBNB, keeping 0.005 BNB for gas" }
  ],
  "reasoning": "STEP 1 (Opportunities): ... STEP 2 (Execution): ... STEP 3 (Review): ..."
}

If no action is needed: { "actions": [{ "type": "hold", "asset": "", "protocol": "", "amountPercent": 0, "reason": "..." }], "reasoning": "..." }

FORMATTING RULES:
- In "reasoning", always use "STEP 1 (Opportunities): ... STEP 2 (Execution): ... STEP 3 (Review): ..." format with a space between STEP and the number.
- Do NOT use tier classifications (no "TIER 1/2/3"). Just reference tokens and protocols by name.
- Keep it concise. Focus on APY numbers and which protocol wins for each token.`,
      },
      {
        role: 'user',
        content: `Current wallet balances (idle, not deployed):
${JSON.stringify(context.walletBalances, null, 2)}

Current active positions:
${JSON.stringify(context.currentPositions, null, 2)}

Available yield opportunities (sorted by composite score):
${JSON.stringify(context.opportunities, null, 2)}
${trendSection}${recentActionsSection}${gasSection}${portfolioSection}

Risk level: ${context.riskLevel}

Analyze using the 3-step framework. What actions should we take?`,
      },
    ],
    max_completion_tokens: 800,
    temperature: 0.3,
  });

  const content = response.choices[0]?.message?.content || '';
  console.log('[AI] Raw decision:', content);

  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(jsonStr);

    // Validate and sanitize each action from AI output
    const KNOWN_PROTOCOLS = ['venus', 'aave', 'lista'];
    const validatedActions = (parsed.actions || []).map((a: Record<string, unknown>) => {
      // Strip any trailing '%' the AI might add (e.g. "87.34%" → 87.34)
      const pctRaw = String(a.amountPercent ?? '0').replace('%', '');
      const pct = Number(pctRaw) || 0;
      return {
        ...a,
        type: typeof a.type === 'string' ? a.type : 'hold',
        asset: typeof a.asset === 'string' ? a.asset : '',
        protocol: typeof a.protocol === 'string' ? a.protocol : '',
        amountPercent: Math.max(0, Math.min(100, Math.round(pct))),
        reason: typeof a.reason === 'string' ? a.reason : '',
      };
    }).filter((a: Record<string, unknown>) =>
      a.type === 'hold' || KNOWN_PROTOCOLS.includes(a.protocol as string)
    );

    return {
      actions: validatedActions.length > 0 ? validatedActions : [{ type: 'hold', asset: '', protocol: '', amountPercent: 0, reason: 'No valid actions from AI' }],
      reasoning: parsed.reasoning || 'No reasoning provided.',
    };
  } catch {
    console.error('[AI] Failed to parse decision JSON, returning hold');
    return {
      actions: [{ type: 'hold', asset: '', protocol: '', amountPercent: 0, reason: 'AI response was not parseable' }],
      reasoning: content,
    };
  }
}

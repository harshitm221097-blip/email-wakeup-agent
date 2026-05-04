import type { ConversationMemory } from "../types";

export function buildNegotiationPrompt(
  memory: ConversationMemory,
  prospectReply: string
): string {
  const {
    prospectName,
    budgetCeiling,
    tone,
    negotiationState,
    messages,
    prospectSignals,
  } = memory;

  const previousMessages = messages
    .map(
      (m) =>
        `${m.role === "agent" ? "Agent" : prospectName}: ${m.content}`
    )
    .join("\n\n");

  const currentOffer = negotiationState.currentOffer;
  const hasRevealedMax = negotiationState.maxBudgetRevealed;

  return `You are negotiating with ${prospectName} about a gig opportunity. The prospect has raised objections or is pushing back on terms.

## Conversation So Far
${previousMessages || "(No prior messages)"}

## Prospect's Latest Reply
${prospectReply}

## Known Objections
${prospectSignals.objections.length > 0 ? prospectSignals.objections.join(", ") : "None explicitly stated yet"}

## Negotiation State
- Current offer on the table: ${currentOffer ? `$${currentOffer}/hr` : "No offer extended yet"}
- Budget has been discussed: ${negotiationState.budgetDiscussed ? "Yes" : "No"}
- Maximum budget revealed to prospect: ${hasRevealedMax ? "Yes" : "No"}
- Prospect's last mentioned rate: ${prospectSignals.rateMentioned ? `$${prospectSignals.rateMentioned}/hr` : "Not mentioned"}

## Budget Constraint
- Maximum budget ceiling: $${budgetCeiling}/hr (NEVER exceed this)
- Tone: ${tone}

## Your Task
Craft a response that addresses the prospect's concerns while staying within budget. Your response should:

1. Acknowledge their concerns empathetically
2. Address each objection directly and honestly
3. If their rate is above your ceiling, explore alternatives:
   - Project-based pricing
   - Reduced scope
   - Part-time arrangement
   - Trial period at a lower rate
4. Only reveal the maximum budget ($${budgetCeiling}) if it's necessary to keep the conversation going
5. Always drive toward scheduling a call — a live conversation resolves objections better than email
6. If the gap is too large and no middle ground exists, prepare to walk away politely

## Response Format
Return a JSON object:
{
  "action": "NEGOTIATE" | "PROPOSE_SLOTS" | "WALK_AWAY",
  "reasoning": "<your strategic reasoning for this action>",
  "emailContent": {
    "subject": "<email subject line>",
    "body": "<email body text>"
  },
  "budgetCounter": <number or null — your counter offer if applicable>
}

Return ONLY valid JSON — no markdown, no code fences, no extra text.`;
}

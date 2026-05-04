import type { ConversationMemory } from "../types";

export function buildReschedulePrompt(
  memory: ConversationMemory,
  cancellationReason?: string
): string {
  const {
    prospectName,
    tone,
    schedulingState,
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

  const rescheduleCount = schedulingState.rescheduleCount;
  const maxReschedules = 3;
  const isOverLimit = rescheduleCount >= maxReschedules;

  return `You are handling a reschedule request from ${prospectName}. This is a delicate moment — you need to stay warm and professional while also driving toward commitment.

## Conversation So Far
${previousMessages || "(No prior messages)"}

## Reschedule Context
- Reschedule count: ${rescheduleCount} of ${maxReschedules} allowed
- Last booked slot: ${schedulingState.lastBookedSlot || "None"}
- Cancellation reason provided: ${cancellationReason || "No reason given"}
- ${isOverLimit ? "WARNING: Reschedule limit reached. You must push for a final commitment or walk away." : `You can accommodate ${maxReschedules - rescheduleCount} more reschedule(s).`}

## Negotiation State (for context continuity)
- Current offer: ${negotiationState.currentOffer ? `$${negotiationState.currentOffer}/hr` : "None"}
- Budget discussed: ${negotiationState.budgetDiscussed ? "Yes" : "No"}
- Prospect's rate mentioned: ${prospectSignals.rateMentioned ? `$${prospectSignals.rateMentioned}/hr` : "None"}
- Known objections: ${prospectSignals.objections.length > 0 ? prospectSignals.objections.join(", ") : "None"}

## Tone: ${tone}

## Your Task
${isOverLimit
    ? `This is the ${rescheduleCount}th reschedule. You must:
1. Express understanding one final time
2. Firmly but politely request a final commitment
3. If the prospect cannot commit, walk away gracefully
4. Leave the door open: "If things change on your end, don't hesitate to reach back out"`
    : `Handle the reschedule gracefully:
1. Acknowledge the cancellation reason (if provided) with empathy
2. Reassure ${prospectName} that rescheduling is no problem
3. Maintain full conversation context — don't start from zero or repeat previously shared information
4. Propose new times for the call
5. Keep the same personality and tone as earlier messages — never sound like a different person
6. Don't renegotiate terms unless the prospect brings it up`
  }

## Critical Rules
- Stay in character — you are the same agent throughout this entire conversation
- Never repeat information from earlier messages
- Never contradict previous statements
- If the prospect mentioned specific availability preferences earlier, reference them
- Keep the momentum going — every reschedule is a risk of losing the prospect
- ${isOverLimit ? "You MUST push for commitment or walk away." : "Accommodate this reschedule warmly."}

## Response Format
Return a JSON object:
{
  "action": "PROPOSE_SLOTS" | "WALK_AWAY",
  "reasoning": "<your reasoning>",
  "emailContent": {
    "subject": "<email subject line>",
    "body": "<email body text>"
  },
  "proposedSlots": [<array of new slot strings to propose>],
  "bookingDetails": {
    "scheduledAt": null,
    "duration": 30
  }
}

Return ONLY valid JSON — no markdown, no code fences, no extra text.`;
}

import type { ConversationMemory } from "../types";

export function buildSchedulingPrompt(
  memory: ConversationMemory,
  availableSlots: string[]
): string {
  const {
    prospectName,
    tone,
    schedulingState,
    messages,
  } = memory;

  const previousMessages = messages
    .map(
      (m) =>
        `${m.role === "agent" ? "Agent" : prospectName}: ${m.content}`
    )
    .join("\n\n");

  const slotsFormatted = availableSlots
    .map((slot, i) => `${i + 1}. ${slot}`)
    .join("\n");

  return `You are at the scheduling stage with ${prospectName}. The prospect has shown interest and it's time to propose a call.

## Conversation So Far
${previousMessages || "(No prior messages)"}

## Scheduling State
- Slots previously proposed: ${schedulingState.slotsProposed.length > 0 ? schedulingState.slotsProposed.join(", ") : "None"}
- Call already booked: ${schedulingState.callBooked ? "Yes" : "No"}
- Reschedule count: ${schedulingState.rescheduleCount}
- Last booked slot: ${schedulingState.lastBookedSlot || "None"}
- Tone: ${tone}

## Available Time Slots
${slotsFormatted}

## Your Task
${schedulingState.callBooked
    ? `A call was previously booked for ${schedulingState.lastBookedSlot}. The prospect may be confirming or adjusting. If they're confirming, acknowledge and lock it in. If they want to change, handle it smoothly.`
    : `Propose 2-3 of the available slots to ${prospectName} for a 30-minute introductory call.`
  }

Guidelines:
1. Be warm but direct — don't over-explain why the call is needed
2. Present the slots as options, not demands
3. If the prospect already suggested times, align your proposals with their preferences
4. Keep the email concise — this is a scheduling email, not a sales pitch
5. If a slot was just booked and confirmed, send a brief confirmation with calendar details

## Response Format
Return a JSON object:
{
  "action": "PROPOSE_SLOTS" | "BOOK_CALL",
  "reasoning": "<your reasoning>",
  "emailContent": {
    "subject": "<email subject line>",
    "body": "<email body text>"
  },
  "proposedSlots": [<array of slot strings you're proposing, from the available list>],
  "bookingDetails": {
    "scheduledAt": "<ISO 8601 datetime string of the confirmed slot, or null if not yet confirmed>",
    "duration": 30
  }
}

Return ONLY valid JSON — no markdown, no code fences, no extra text.`;
}

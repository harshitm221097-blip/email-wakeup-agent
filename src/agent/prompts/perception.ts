export function buildPerceptionPrompt(
  emailBody: string,
  conversationHistory: string
): string {
  return `Analyze the following prospect email and conversation context to extract structured information.

## Conversation History
${conversationHistory || "(This is the first message from the prospect)"}

## Current Email from Prospect
${emailBody}

## Task
Analyze the prospect's email and return a JSON object with the following structure:

{
  "intent": "<one of: interested | curious | objecting | declining | silent | rescheduling>",
  "confidence": <number between 0 and 1 indicating your confidence in the intent classification>,
  "rateQuote": <number or null — the hourly rate the prospect mentioned, if any>,
  "schedulingSignals": <array of strings or null — any time/date references that indicate scheduling intent, e.g. "next Tuesday", "after 3pm", "sometime this week">,
  "objections": <array of strings — any objections or concerns raised, e.g. "rate too low", "not interested in full-time", "too far">,
  "summary": "<1-2 sentence summary of what the prospect is communicating>"
}

## Intent Classification Guide
- "interested": Prospect explicitly expresses interest, asks follow-up questions about the gig, or agrees to move forward
- "curious": Prospect asks for more information but hasn't committed — still evaluating
- "objecting": Prospect raises concerns about rate, terms, scope, or fit — wants to negotiate or push back
- "declining": Prospect explicitly says no, not interested, or withdraws from the conversation
- "silent": The email is vague, non-committal, or just an acknowledgment without substance (e.g. "thanks", "got it", "will think about it")
- "rescheduling": Prospect asks to reschedule a previously agreed-upon call or misses a scheduled call

## Rules
- Return ONLY valid JSON — no markdown, no code fences, no extra text
- Be precise with the intent classification — this drives the agent's next action
- Extract rate as a plain number (e.g. 125, not "$125/hr")
- For schedulingSignals, capture any time-related phrases verbatim
- If no objections are raised, return an empty array
- Confidence should reflect how certain you are — use 0.3-0.5 for ambiguous messages, 0.8-1.0 for clear ones`;
}

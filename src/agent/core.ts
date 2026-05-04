import { callLLM } from "@/lib/claude";
import { prisma } from "@/lib/db";
import { loadMemory, saveAgentState, addMessage } from "./memory";
import { buildSystemPrompt } from "./prompts/system";
import { buildPerceptionPrompt } from "./prompts/perception";
import { buildNegotiationPrompt } from "./prompts/negotiation";
import { buildSchedulingPrompt } from "./prompts/scheduling";
import { buildReschedulePrompt } from "./prompts/reschedule";
import type {
  PerceptionResult,
  AgentDecision,
  ConversationMemory,
} from "./types";

/**
 * Extract the first valid JSON object from a string.
 * Handles thinking blocks, extra text, and malformed outputs.
 */
function extractJsonObject(text: string): string | null {
  const firstBrace = text.indexOf("{");
  if (firstBrace === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = firstBrace; i < text.length; i++) {
    const ch = text[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === "\\") {
      if (inString) escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return text.substring(firstBrace, i + 1);
      }
    }
  }

  return null;
}

/**
 * Call the LLM with a prompt and parse the JSON response.
 * Handles stripping of markdown code fences, thinking/reasoning blocks,
 * and extracts JSON from verbose model outputs.
 */
async function callLLMForJson<T>(
  systemPrompt: string,
  userPrompt: string
): Promise<T> {
  const rawText = await callLLM(systemPrompt, userPrompt);

  let text = rawText.trim();

  // Strip markdown code fences
  text = text.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");

  // Extract first valid JSON object
  const jsonStr = extractJsonObject(text);
  if (jsonStr) {
    return JSON.parse(jsonStr) as T;
  }

  throw new Error(`Failed to parse LLM response as JSON: ${rawText.slice(0, 300)}`);
}

/**
 * Run perception: classify the prospect's email intent using Claude.
 * This is the "Perception" phase of the agent loop.
 */
async function runPerception(
  emailBody: string,
  memory: ConversationMemory
): Promise<PerceptionResult> {
  const conversationHistory = memory.messages
    .map(
      (m) =>
        `${m.role === "agent" ? "Agent" : memory.prospectName}: ${m.content}`
    )
    .join("\n\n");

  const perceptionPrompt = buildPerceptionPrompt(
    emailBody,
    conversationHistory
  );

  const systemPrompt = buildSystemPrompt({
    gigDescription: memory.gigDescription,
    budgetCeiling: memory.budgetCeiling,
    tone: memory.tone,
    prospectName: memory.prospectName,
  });

  return callLLMForJson<PerceptionResult>(systemPrompt, perceptionPrompt);
}

/**
 * Get available time slots for scheduling.
 * Generates slots for the next 5 business days, 9 AM - 5 PM in 2-hour intervals.
 * In production, this would integrate with the Google Calendar API to avoid conflicts.
 */
export function getDefaultAvailableSlots(): string[] {
  const slots: string[] = [];
  const now = new Date();
  let daysAdded = 0;

  while (daysAdded < 5) {
    now.setDate(now.getDate() + 1);
    const day = now.getDay();

    // Skip weekends
    if (day === 0 || day === 6) continue;

    for (let hour = 9; hour <= 15; hour += 2) {
      const slot = new Date(now);
      slot.setHours(hour, 0, 0, 0);
      slots.push(slot.toISOString());
    }

    daysAdded++;
  }

  return slots;
}

/**
 * Build a prompt for the "curious" intent — prospect wants more info.
 */
function buildCuriousPrompt(
  memory: ConversationMemory,
  emailBody: string
): string {
  const conversationHistory = memory.messages
    .map(
      (m) =>
        `${m.role === "agent" ? "Agent" : memory.prospectName}: ${m.content}`
    )
    .join("\n\n");

  return `The prospect (${memory.prospectName}) is curious and wants more information about the gig. They haven't committed yet.

## Conversation So Far
${conversationHistory || "(No prior messages)"}

## Prospect's Latest Message
${emailBody}

## Gig Details
${memory.gigDescription}

## Budget Ceiling: $${memory.budgetCeiling}/hr
## Tone: ${memory.tone}

## Your Task
Respond with helpful information about the gig opportunity. Be informative but not overwhelming. End with a clear call-to-action to schedule a brief call to discuss further.

Return a JSON object:
{
  "action": "SEND_REPLY" | "PROPOSE_SLOTS",
  "reasoning": "<why this action>",
  "emailContent": {
    "subject": "<subject line>",
    "body": "<email body>"
  },
  "proposedSlots": [<array of slot strings if action is PROPOSE_SLOTS, else null>]
}

Return ONLY valid JSON.`;
}

/**
 * Build a prompt for the "declining" intent — prospect says no.
 */
function buildDecliningPrompt(
  memory: ConversationMemory,
  emailBody: string
): string {
  return `The prospect (${memory.prospectName}) has declined the opportunity.

## Prospect's Latest Message
${emailBody}

## Tone: ${memory.tone}

## Your Task
Write a polite, professional goodbye email. Leave the door open for future opportunities. Do not be pushy or try to change their mind.

Return a JSON object:
{
  "action": "WALK_AWAY",
  "reasoning": "<why this action>",
  "emailContent": {
    "subject": "<subject line>",
    "body": "<email body>"
  }
}

Return ONLY valid JSON.`;
}

/**
 * Build a prompt for the "silent" intent — vague or non-committal reply.
 */
function buildSilentPrompt(
  memory: ConversationMemory,
  emailBody: string
): string {
  const conversationHistory = memory.messages
    .map(
      (m) =>
        `${m.role === "agent" ? "Agent" : memory.prospectName}: ${m.content}`
    )
    .join("\n\n");

  return `The prospect (${memory.prospectName}) sent a vague or non-committal reply.

## Conversation So Far
${conversationHistory || "(No prior messages)"}

## Prospect's Latest Message
${emailBody}

## Tone: ${memory.tone}

## Your Task
Send a gentle nudge follow-up. Reiterate the value of the opportunity briefly and suggest a quick call. Keep it short and low-pressure.

Return a JSON object:
{
  "action": "WAIT" | "PROPOSE_SLOTS",
  "reasoning": "<why this action>",
  "emailContent": {
    "subject": "<subject line>",
    "body": "<email body>"
  },
  "proposedSlots": [<array of slot strings if action is PROPOSE_SLOTS, else null>]
}

Return ONLY valid JSON.`;
}

/**
 * Main agent entry point: process an inbound email from a prospect.
 * Follows the Perception -> Reasoning -> Action loop:
 *   1. Load conversation memory
 *   2. Run perception (classify intent via Claude)
 *   3. Select strategy based on intent
 *   4. Call Claude with the selected prompt to decide action
 *   5. Return AgentDecision with the chosen action and content
 */
export async function processInboundEmail(
  conversationId: string,
  emailBody: string,
  fromEmail: string
): Promise<AgentDecision> {
  // 1. Load conversation memory
  const memory = await loadMemory(conversationId);

  // Record the inbound message
  const agentConfig = await prisma.agentConfig.findUnique({
    where: { key: "from_email" },
  });
  const agentEmail = agentConfig?.value ?? "agent@yourdomain.com";

  await addMessage(
    conversationId,
    "INBOUND",
    fromEmail,
    agentEmail,
    emailBody
  );

  // 2. Run perception — classify the prospect's intent
  const perception = await runPerception(emailBody, memory);

  // Update prospect signals from perception results
  if (perception.rateQuote !== null) {
    memory.prospectSignals.rateMentioned = perception.rateQuote;
  }
  if (perception.objections.length > 0) {
    memory.prospectSignals.objections = [
      ...new Set([
        ...memory.prospectSignals.objections,
        ...perception.objections,
      ]),
    ];
  }
  if (perception.intent === "interested" || perception.intent === "curious") {
    memory.prospectSignals.interested = true;
  }

  // 3. Build the system prompt for strategy selection
  const systemPrompt = buildSystemPrompt({
    gigDescription: memory.gigDescription,
    budgetCeiling: memory.budgetCeiling,
    tone: memory.tone,
    prospectName: memory.prospectName,
  });

  // 4. Select strategy based on intent
  let strategyPrompt: string;

  switch (perception.intent) {
    case "interested":
      strategyPrompt = buildSchedulingPrompt(
        memory,
        getDefaultAvailableSlots()
      );
      break;

    case "curious":
      strategyPrompt = buildCuriousPrompt(memory, emailBody);
      break;

    case "objecting":
      strategyPrompt = buildNegotiationPrompt(memory, emailBody);
      break;

    case "declining":
      strategyPrompt = buildDecliningPrompt(memory, emailBody);
      break;

    case "rescheduling":
      strategyPrompt = buildReschedulePrompt(memory, undefined);
      break;

    case "silent":
      strategyPrompt = buildSilentPrompt(memory, emailBody);
      break;

    default:
      throw new Error(`Unknown intent: ${perception.intent}`);
  }

  // 5. Call Claude with the selected strategy to get a decision
  const decision = await callLLMForJson<AgentDecision>(
    systemPrompt,
    strategyPrompt
  );

  // 6. Update memory state based on the decision
  if (decision.budgetCounter !== undefined && decision.budgetCounter !== null) {
    memory.negotiationState.currentOffer = decision.budgetCounter;
    memory.negotiationState.budgetDiscussed = true;
    if (decision.budgetCounter >= memory.budgetCeiling) {
      memory.negotiationState.maxBudgetRevealed = true;
    }
  }

  if (decision.proposedSlots && decision.proposedSlots.length > 0) {
    memory.schedulingState.slotsProposed = decision.proposedSlots;
  }

  if (decision.bookingDetails?.scheduledAt) {
    memory.schedulingState.callBooked = true;
    memory.schedulingState.lastBookedSlot = decision.bookingDetails.scheduledAt;
  }

  if (perception.intent === "rescheduling") {
    memory.schedulingState.rescheduleCount += 1;
    memory.schedulingState.callBooked = false;
  }

  // 7. Persist the updated agent state
  await saveAgentState(conversationId, memory);

  return decision;
}

/**
 * Generate the first outreach email for a new prospect.
 * Uses the system prompt plus outreach-specific instructions.
 */
export async function initiateOutreach(
  prospectId: string
): Promise<{ subject: string; body: string }> {
  // Load prospect details
  const prospect = await prisma.prospect.findUnique({
    where: { id: prospectId },
  });

  if (!prospect) {
    throw new Error(`Prospect not found: ${prospectId}`);
  }

  // Load agent config
  const configs = await prisma.agentConfig.findMany();
  const configMap = new Map<string, string>(
    configs.map((c: { key: string; value: string }) => [c.key, c.value])
  );

  const gigDescription: string = configMap.get("gig_description") ?? "";
  const budgetCeiling: number = Number(
    configMap.get("budget_ceiling") ?? 150
  );
  const tone: string = configMap.get("tone") ?? "professional yet friendly";

  const systemPrompt = buildSystemPrompt({
    gigDescription,
    budgetCeiling,
    tone,
    prospectName: prospect.name,
  });

  const outreachPrompt = `Write the initial outreach email to ${prospect.name}${prospect.company ? ` at ${prospect.company}` : ""}.

## Context
This is the FIRST email in a new conversation. You are reaching out cold about a gig opportunity.

## Gig Details
${gigDescription}

## Guidelines for the Outreach Email
1. Subject line should be compelling but not clickbait — it should feel personal and relevant
2. Open with a personalized hook (reference their work, skills, or company if known)
3. Briefly describe the opportunity without overwhelming detail
4. Highlight 1-2 compelling reasons why this opportunity is worth their time
5. End with a clear, low-friction call-to-action (suggest a brief 15-minute call)
6. Do NOT mention budget or rates in the first email
7. Keep it concise — 3-4 short paragraphs maximum
8. Tone: ${tone}
9. Do NOT be salesy, spammy, or generic — make it feel like a human wrote it specifically for ${prospect.name}

## Response Format
Return a JSON object:
{
  "subject": "<email subject line>",
  "body": "<email body text>"
}

Return ONLY valid JSON — no markdown, no code fences, no extra text.`;

  const result = await callLLMForJson<{ subject: string; body: string }>(
    systemPrompt,
    outreachPrompt
  );

  return result;
}

/**
 * Generate structured time slots for the next 7 business days.
 * Returns { start, end } pairs as ISO strings for API consumption.
 */
export async function generateTimeSlots(): Promise<
  { start: string; end: string }[]
> {
  const configs = await prisma.agentConfig.findMany();
  const configMap = new Map<string, string>(
    configs.map((c: { key: string; value: string }) => [c.key, c.value])
  );
  const availableHours = configMap.get("AGENT_AVAILABLE_HOURS") ?? "9-17";
  const [startHour, endHour] = availableHours.split("-").map(Number);

  const slots: { start: string; end: string }[] = [];
  const now = new Date();
  const slotDurationMinutes = 30;

  for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
    const date = new Date(now);
    date.setDate(date.getDate() + dayOffset);
    const dayOfWeek = date.getDay();

    // Skip weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += slotDurationMinutes) {
        const slotStart = new Date(date);
        slotStart.setHours(hour, minute, 0, 0);
        const slotEnd = new Date(date);
        slotEnd.setHours(
          minute + slotDurationMinutes >= 60 ? hour + 1 : hour,
          (minute + slotDurationMinutes) % 60,
          0,
          0
        );

        if (slotEnd.getHours() > endHour) continue;

        slots.push({
          start: slotStart.toISOString(),
          end: slotEnd.toISOString(),
        });
      }
    }
  }

  return slots;
}

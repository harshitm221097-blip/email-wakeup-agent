"use server";

import { prisma } from "@/lib/db";
import type { ConversationMemory } from "./types";

/**
 * Load conversation memory from the database and build a ConversationMemory object.
 * Pulls the conversation, its messages, and the prospect's agent state.
 */
export async function loadMemory(
  conversationId: string
): Promise<ConversationMemory> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      prospect: true,
      messages: {
        orderBy: { sentAt: "asc" },
      },
    },
  });

  if (!conversation) {
    throw new Error(`Conversation not found: ${conversationId}`);
  }

  const savedState = conversation.agentState as Partial<ConversationMemory> | null;

  // Load agent config defaults
  const configs = await prisma.agentConfig.findMany();
  const configMap = new Map<string, string>(
    configs.map((c: { key: string; value: string }) => [c.key, c.value])
  );

  const gigDescription: string =
    savedState?.gigDescription ??
    configMap.get("gig_description") ??
    "";
  const budgetCeiling: number =
    savedState?.budgetCeiling ??
    Number(configMap.get("budget_ceiling") ?? 150);
  const tone: string =
    savedState?.tone ?? configMap.get("tone") ?? "professional yet friendly";

  const memory: ConversationMemory = {
    prospectName: conversation.prospect.name,
    prospectEmail: conversation.prospect.email,
    gigDescription,
    budgetCeiling,
    tone,
    messages: conversation.messages.map(
      (msg: { direction: string; body: string; sentAt: Date }) => ({
        role: (msg.direction === "OUTBOUND" ? "agent" : "prospect") as
          | "agent"
          | "prospect",
        content: msg.body,
        timestamp: msg.sentAt.toISOString(),
      })
    ),
    negotiationState: savedState?.negotiationState ?? {
      currentOffer: null,
      budgetDiscussed: false,
      maxBudgetRevealed: false,
    },
    schedulingState: savedState?.schedulingState ?? {
      slotsProposed: [],
      callBooked: false,
      rescheduleCount: 0,
      lastBookedSlot: null,
    },
    prospectSignals: savedState?.prospectSignals ?? {
      interested: false,
      objections: [],
      rateMentioned: null,
    },
  };

  return memory;
}

/**
 * Persist the updated agent state back to the conversation record.
 * Only the stateful fields are stored — messages are saved separately.
 */
export async function saveAgentState(
  conversationId: string,
  memory: ConversationMemory
): Promise<void> {
  const stateToSave = {
    gigDescription: memory.gigDescription,
    budgetCeiling: memory.budgetCeiling,
    tone: memory.tone,
    negotiationState: memory.negotiationState,
    schedulingState: memory.schedulingState,
    prospectSignals: memory.prospectSignals,
  };

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      agentState: stateToSave,
      updatedAt: new Date(),
    },
  });
}

/**
 * Add a message to the conversation and return its ID.
 */
export async function addMessage(
  conversationId: string,
  direction: "INBOUND" | "OUTBOUND",
  from: string,
  to: string,
  body: string,
  metadata?: Record<string, string | number | boolean | null>
): Promise<string> {
  const message = await prisma.message.create({
    data: {
      conversationId,
      direction,
      fromEmail: from,
      toEmail: to,
      body,
      metadata: metadata as Record<string, string | number | boolean | null> | undefined,
    },
  });

  return message.id;
}

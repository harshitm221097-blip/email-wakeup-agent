export type Intent =
  | "interested"
  | "curious"
  | "objecting"
  | "declining"
  | "silent"
  | "rescheduling";

export type AgentAction =
  | "SEND_REPLY"
  | "NEGOTIATE"
  | "PROPOSE_SLOTS"
  | "BOOK_CALL"
  | "WALK_AWAY"
  | "WAIT";

export interface PerceptionResult {
  intent: Intent;
  confidence: number;
  rateQuote: number | null;
  schedulingSignals: string[] | null;
  objections: string[];
  summary: string;
}

export interface AgentDecision {
  action: AgentAction;
  reasoning: string;
  emailContent?: {
    subject: string;
    body: string;
  };
  proposedSlots?: string[];
  bookingDetails?: {
    scheduledAt: string;
    duration: number;
  };
  budgetCounter?: number;
}

export interface ConversationMemory {
  prospectName: string;
  prospectEmail: string;
  gigDescription: string;
  budgetCeiling: number;
  tone: string;
  messages: {
    role: "agent" | "prospect";
    content: string;
    timestamp: string;
  }[];
  negotiationState: {
    currentOffer: number | null;
    budgetDiscussed: boolean;
    maxBudgetRevealed: boolean;
  };
  schedulingState: {
    slotsProposed: string[];
    callBooked: boolean;
    rescheduleCount: number;
    lastBookedSlot: string | null;
  };
  prospectSignals: {
    interested: boolean;
    objections: string[];
    rateMentioned: number | null;
  };
}

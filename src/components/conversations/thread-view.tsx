"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bot,
  User,
  Target,
  DollarSign,
  CalendarCheck,
  Clock,
  AlertTriangle,
  Send,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Message {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  fromEmail: string;
  toEmail: string;
  subject: string | null;
  body: string;
  metadata: unknown;
  sentAt: string;
}

interface ConversationData {
  id: string;
  prospectId: string;
  subject: string;
  status: string;
  agentState: {
    prospectName?: string;
    prospectSignals?: {
      interested?: boolean;
      rateMentioned?: number | null;
      objections?: string[];
    };
    negotiationState?: {
      budgetDiscussed?: boolean;
      currentOffer?: number | null;
      maxBudgetRevealed?: boolean;
    };
    schedulingState?: {
      callBooked?: boolean;
      slotsProposed?: string[];
      lastBookedSlot?: string | null;
      rescheduleCount?: number;
    };
  } | null;
  createdAt: string;
  updatedAt: string;
  prospect: {
    id: string;
    name: string;
    email: string;
    company: string | null;
    status: string;
  };
  messages: Message[];
  call: unknown;
}

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function ThreadView({
  conversationId,
}: {
  conversationId: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const params = React.use(conversationId);
  const [conversation, setConversation] = useState<ConversationData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");

  const fetchConversation = useCallback(async () => {
    try {
      const res = await fetch(`/api/conversations/${params.id}`);
      if (!res.ok) throw new Error("Failed to fetch conversation");
      const data = await res.json();
      setConversation(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchConversation();
  }, [fetchConversation]);

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !conversation) return;

    try {
      const res = await fetch("/api/agent/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: conversation.id,
          emailBody: messageInput.trim(),
          fromEmail: conversation.prospect.email,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to process message");
      }

      setMessageInput("");
      await fetchConversation();
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-3rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          Loading conversation...
        </span>
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <div className="flex h-[calc(100vh-3rem)] flex-col items-center justify-center">
        <AlertCircle className="h-10 w-10 text-destructive/50" />
        <p className="mt-3 text-sm text-destructive">
          {error || "Conversation not found"}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => router.push("/conversations")}
        >
          Back to Conversations
        </Button>
      </div>
    );
  }

  const agentState = conversation.agentState as Record<string, unknown> | null;
  const prospectSignals = agentState?.prospectSignals as Record<string, unknown> | undefined;
  const negotiationState = agentState?.negotiationState as Record<string, unknown> | undefined;
  const schedulingState = agentState?.schedulingState as Record<string, unknown> | undefined;

  const intentLabel = schedulingState?.callBooked
    ? "Call booked"
    : schedulingState?.slotsProposed
      ? "Scheduling in progress"
      : negotiationState?.budgetDiscussed
        ? "Negotiating"
        : prospectSignals?.interested
          ? "Interested"
          : "Initial outreach";

  const negotiationLabel = negotiationState?.budgetDiscussed
    ? negotiationState?.maxBudgetRevealed
      ? "Max budget revealed"
      : `Current offer: $${negotiationState.currentOffer ?? "N/A"}`
    : "Not started";

  const schedulingLabel = schedulingState?.callBooked
    ? `Booked for ${schedulingState.lastBookedSlot ? new Date(schedulingState.lastBookedSlot as string).toLocaleString() : "TBD"}`
    : schedulingState?.slotsProposed
      ? "Awaiting prospect response"
      : "No activity yet";

  const budgetLabel = negotiationState?.currentOffer
    ? `$${negotiationState.currentOffer}/hr`
    : "Not discussed";

  return (
    <div className="flex h-[calc(100vh-3rem)] gap-6">
      {/* Main Thread */}
      <div className="flex flex-1 flex-col">
        {/* Thread Header */}
        <div className="flex items-center gap-4 pb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/conversations")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-foreground">
              {conversation.prospect.name}
            </h2>
            <p className="text-sm text-muted-foreground">
              {conversation.subject}
            </p>
          </div>
          <Badge className="bg-emerald-500/15 text-emerald-400">
            {conversation.status.toLowerCase()}
          </Badge>
        </div>

        <Separator />

        {/* Messages */}
        <ScrollArea className="mt-4 flex-1 pr-4">
          <div className="space-y-4 pb-4">
            {conversation.messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3",
                  message.direction === "OUTBOUND"
                    ? "flex-row-reverse"
                    : "flex-row"
                )}
              >
                <Avatar size="sm">
                  <AvatarFallback
                    className={cn(
                      message.direction === "OUTBOUND"
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {message.direction === "OUTBOUND" ? (
                      <Bot className="h-3 w-3" />
                    ) : (
                      <User className="h-3 w-3" />
                    )}
                  </AvatarFallback>
                </Avatar>

                <div
                  className={cn(
                    "max-w-[70%] rounded-xl p-4",
                    message.direction === "OUTBOUND"
                      ? "bg-primary/15 text-foreground"
                      : "bg-card text-card-foreground ring-1 ring-foreground/10"
                  )}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      {message.direction === "OUTBOUND"
                        ? "Email Wakeup Agent"
                        : conversation.prospect.name}
                    </span>
                  </div>
                  <div className="whitespace-pre-line text-sm">
                    {message.body}
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground/60">
                    <Clock className="h-3 w-3" />
                    {formatTimestamp(message.sentAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Message Input — simulate inbound reply for testing */}
        <div className="flex items-center gap-2 border-t border-border pt-4">
          <Input
            placeholder="Simulate a prospect reply..."
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />
          <Button
            size="icon"
            disabled={!messageInput.trim()}
            onClick={handleSendMessage}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Agent State Sidebar */}
      <Card className="glass-card hidden w-80 shrink-0 rounded-xl lg:block">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Bot className="h-4 w-4 text-primary" />
            Agent State
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Target className="h-3 w-3" />
                Current Intent
              </div>
              <p className="mt-1 text-sm font-medium text-foreground">
                {intentLabel as string}
              </p>
            </div>

            <div className="rounded-lg bg-muted/50 p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <DollarSign className="h-3 w-3" />
                Negotiation Position
              </div>
              <p className="mt-1 text-sm font-medium text-foreground">
                {negotiationLabel as string}
              </p>
            </div>

            <div className="rounded-lg bg-muted/50 p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarCheck className="h-3 w-3" />
                Scheduling Status
              </div>
              <p className="mt-1 text-sm font-medium text-foreground">
                {schedulingLabel as string}
              </p>
            </div>

            <Separator />

            <div className="rounded-lg bg-muted/50 p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                Budget Range
              </div>
              <p className="mt-1 text-sm font-medium text-foreground">
                {budgetLabel as string}
              </p>
            </div>

            <div className="rounded-lg bg-muted/50 p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                Prospect Status
              </div>
              <Badge variant="outline" className="mt-1 text-xs">
                {conversation.prospect.status}
              </Badge>
            </div>

            {Array.isArray(prospectSignals?.objections) && (prospectSignals.objections as string[]).length > 0 && (
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <AlertTriangle className="h-3 w-3" />
                  Detected Objections
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(prospectSignals.objections as string[]).map((o, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="text-xs text-yellow-400"
                    >
                      {o}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

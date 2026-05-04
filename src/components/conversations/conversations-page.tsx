"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  MessageSquare,
  Clock,
  ChevronRight,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

type ConversationStatus = "ACTIVE" | "COMPLETED" | "ARCHIVED";

interface Conversation {
  id: string;
  prospectId: string;
  subject: string;
  status: ConversationStatus;
  createdAt: string;
  updatedAt: string;
  prospect: {
    id: string;
    name: string;
    email: string;
    company: string | null;
    status: string;
  };
  messageCount: number;
  latestMessage: {
    id: string;
    direction: string;
    body: string;
    sentAt: string;
  } | null;
  call: unknown;
}

function getStatusBadge(status: ConversationStatus) {
  const config = {
    ACTIVE: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    COMPLETED: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    ARCHIVED: "bg-muted text-muted-foreground border-border",
  };

  return (
    <Badge
      variant="outline"
      className={cn("text-xs capitalize", config[status])}
    >
      {status.toLowerCase()}
    </Badge>
  );
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

export function ConversationsPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations");
      if (!res.ok) throw new Error("Failed to fetch conversations");
      const data = await res.json();
      setConversations(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleNewOutreach = async () => {
    if (!newName.trim() || !newEmail.trim()) return;

    setSending(true);
    setSendError(null);

    try {
      // 1. Create the prospect
      const prospectRes = await fetch("/api/prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          email: newEmail.trim(),
          company: newCompany.trim() || undefined,
        }),
      });

      if (!prospectRes.ok) {
        const errData = await prospectRes.json();
        throw new Error(errData.error || "Failed to create prospect");
      }

      const prospect = await prospectRes.json();

      // 2. Trigger outreach (generates email via LLM + sends via Resend)
      const outreachRes = await fetch(`/api/prospects/${prospect.id}/outreach`, {
        method: "POST",
      });

      if (!outreachRes.ok) {
        const errData = await outreachRes.json();
        throw new Error(errData.error || "Failed to send outreach");
      }

      // 3. Reset form and refresh list
      setNewName("");
      setNewEmail("");
      setNewCompany("");
      setDialogOpen(false);
      await fetchConversations();
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSending(false);
    }
  };

  const filteredConversations = conversations.filter(
    (conv) =>
      conv.prospect.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.prospect.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="gradient-text text-3xl font-bold">Conversations</h1>
          <p className="mt-1 text-muted-foreground">
            Manage your prospect conversations
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={
              <Button>
                <Plus /> New Outreach
              </Button>
            }
          />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>New Outreach</DialogTitle>
              <DialogDescription>
                Start a new conversation with a prospect. The agent will
                generate and send a personalized email.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="prospect-name">Prospect Name</Label>
                <Input
                  id="prospect-name"
                  placeholder="John Doe"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prospect-email">Prospect Email</Label>
                <Input
                  id="prospect-email"
                  placeholder="prospect@company.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prospect-company">
                  Company <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="prospect-company"
                  placeholder="Acme Inc."
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                />
              </div>
              {sendError && (
                <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {sendError}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  setSendError(null);
                }}
                disabled={sending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleNewOutreach}
                disabled={
                  sending || !newName.trim() || !newEmail.trim()
                }
              >
                {sending ? (
                  <>
                    <Loader2 className="animate-spin" /> Generating & Sending...
                  </>
                ) : (
                  "Send Outreach"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search conversations by prospect, subject, or email..."
          className="pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Conversations List */}
      <div className="space-y-2">
        {loading ? (
          <Card className="glass-card rounded-xl">
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">
                Loading conversations...
              </span>
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="glass-card rounded-xl">
            <CardContent className="flex flex-col items-center py-12">
              <AlertCircle className="h-10 w-10 text-destructive/50" />
              <p className="mt-3 text-sm text-destructive">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  setLoading(true);
                  fetchConversations();
                }}
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : filteredConversations.length === 0 ? (
          <Card className="glass-card rounded-xl">
            <CardContent className="py-12 text-center">
              <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-3 text-sm text-muted-foreground">
                {searchQuery
                  ? "No conversations match your search"
                  : "No conversations yet. Click 'New Outreach' to get started."}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredConversations.map((conversation) => (
            <Card
              key={conversation.id}
              className="glass-card cursor-pointer rounded-xl transition-colors hover:bg-muted/30"
              onClick={() =>
                router.push(`/conversations/${conversation.id}`)
              }
            >
              <CardContent className="py-3">
                <div className="flex items-center gap-4">
                  <Avatar>
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {conversation.prospect.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {conversation.prospect.name}
                      </span>
                      {getStatusBadge(conversation.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {conversation.subject}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground/70">
                      {conversation.latestMessage?.body ?? "No messages yet"}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatTimeAgo(conversation.updatedAt)}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MessageSquare className="h-3 w-3" />
                      {conversation.messageCount}
                    </div>
                  </div>

                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

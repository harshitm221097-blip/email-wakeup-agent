"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  MessageSquare,
  Phone,
  TrendingUp,
  ArrowUpRight,
  Clock,
  Mail,
  PhoneCall,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface StatsData {
  totalProspects: number;
  activeConversations: number;
  callsScheduled: number;
  pipelineStages: { stage: string; count: number }[];
  recentActivity: {
    id: string;
    direction: string;
    prospectName: string;
    prospectStatus: string;
    subject: string | null;
    body: string;
    sentAt: string;
  }[];
}

const statsConfig: { label: string; key: keyof StatsData; icon: typeof Users }[] = [
  { label: "Total Prospects", key: "totalProspects", icon: Users },
  { label: "Active Conversations", key: "activeConversations", icon: MessageSquare },
  { label: "Calls Scheduled", key: "callsScheduled", icon: Phone },
];

function getActivityIcon(direction: string) {
  return direction === "OUTBOUND" ? Mail : MessageSquare;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "CONTACTED":
      return <Badge variant="secondary" className="text-xs">Contacted</Badge>;
    case "NEGOTIATING":
      return <Badge className="bg-primary/20 text-primary text-xs">Negotiating</Badge>;
    case "SCHEDULED":
      return <Badge className="bg-emerald-500/20 text-emerald-400 text-xs">Booked</Badge>;
    case "WALKED_AWAY":
      return <Badge variant="destructive" className="text-xs">Walked Away</Badge>;
    case "DECLINED":
      return <Badge variant="destructive" className="text-xs">Declined</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">{status}</Badge>;
  }
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
  return `${diffDay}d ago`;
}

export function DashboardPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/stats");
      if (!res.ok) throw new Error("Failed");
      const stats = await res.json();
      setData(stats);
    } catch {
      console.error("Failed to load stats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading dashboard...</span>
      </div>
    );
  }

  const pipeline = data?.pipelineStages ?? [];
  const totalInPipeline = pipeline.reduce((sum, s) => sum + s.count, 0);
  const activity = data?.recentActivity ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="gradient-text text-3xl font-bold">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Monitor your email agent&apos;s activity
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statsConfig.map((stat) => (
          <Card key={stat.label} className="glass-card rounded-xl">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
              </div>
              <div className="mt-3">
                <p className="text-2xl font-bold text-foreground">
                  {data ? String(data[stat.key]) : "—"}
                </p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Activity */}
        <Card className="glass-card rounded-xl lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <div className="py-8 text-center">
                <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground/30" />
                <p className="mt-3 text-sm text-muted-foreground">
                  No activity yet. Start an outreach to see activity here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {activity.map((item) => {
                  const Icon = getActivityIcon(item.direction);
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-4 rounded-lg p-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground">
                            {item.prospectName}
                          </p>
                          {getStatusBadge(item.prospectStatus)}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {item.direction === "OUTBOUND" ? "Agent sent: " : "Prospect replied: "}
                          {item.body.slice(0, 80)}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatTimeAgo(item.sentAt)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pipeline Overview */}
        <Card className="glass-card rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Pipeline Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pipeline.length === 0 ? (
              <div className="py-8 text-center">
                <Users className="mx-auto h-10 w-10 text-muted-foreground/30" />
                <p className="mt-3 text-sm text-muted-foreground">
                  No prospects in pipeline yet.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {pipeline.map((stage) => (
                  <div key={stage.stage} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {stage.stage.charAt(0) + stage.stage.slice(1).toLowerCase().replace(/_/g, " ")}
                      </span>
                      <span className="font-medium text-foreground">
                        {stage.count}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{
                          width: `${totalInPipeline > 0 ? (stage.count / totalInPipeline) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-6 flex items-center justify-between rounded-lg bg-muted/50 p-3">
              <span className="text-sm text-muted-foreground">
                Total in Pipeline
              </span>
              <span className="text-lg font-bold text-foreground">{totalInPipeline}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

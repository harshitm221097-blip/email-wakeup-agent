"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Mail,
  MessageSquare,
  Phone,
  TrendingDown,
  BarChart3,
  PieChart,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AnalyticsData {
  metrics: {
    totalEmailsSent: number;
    responseRate: string;
    callBookingRate: string;
    walkAwayRate: string;
    totalConversations: number;
    totalProspects: number;
  };
  pipelineFunnel: {
    stage: string;
    count: number;
    percentage: number;
  }[];
  conversationQuality: {
    prospect: string;
    emailsSent: number;
    responsesReceived: number;
    rounds: number;
    finalOutcome: string;
    outcomeType: "success" | "pending" | "failed";
  }[];
}

export function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await fetch("/api/analytics");
      if (!res.ok) throw new Error("Failed");
      const analytics = await res.json();
      setData(analytics);
    } catch {
      console.error("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading analytics...</span>
      </div>
    );
  }

  const metrics = data?.metrics;
  const pipelineFunnel = data?.pipelineFunnel ?? [];
  const conversationQuality = data?.conversationQuality ?? [];

  const metricCards = [
    {
      label: "Total Emails Sent",
      value: metrics?.totalEmailsSent ?? 0,
      icon: Mail,
    },
    {
      label: "Response Rate",
      value: `${metrics?.responseRate ?? 0}%`,
      icon: MessageSquare,
    },
    {
      label: "Call Booking Rate",
      value: `${metrics?.callBookingRate ?? 0}%`,
      icon: Phone,
    },
    {
      label: "Walk-away Rate",
      value: `${metrics?.walkAwayRate ?? 0}%`,
      icon: TrendingDown,
    },
    {
      label: "Total Conversations",
      value: metrics?.totalConversations ?? 0,
      icon: Users,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="gradient-text text-3xl font-bold">Analytics</h1>
        <p className="mt-1 text-muted-foreground">
          Track your agent&apos;s performance and conversation outcomes
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {metricCards.map((metric) => (
          <Card key={metric.label} className="glass-card rounded-xl">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <metric.icon className="h-4 w-4 text-primary" />
                </div>
              </div>
              <div className="mt-2">
                <p className="text-xl font-bold text-foreground">
                  {metric.value}
                </p>
                <p className="text-xs text-muted-foreground">{metric.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Placeholder */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Response Timeline */}
        <Card className="glass-card rounded-xl lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Response Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border">
              <div className="text-center">
                <BarChart3 className="mx-auto h-10 w-10 text-muted-foreground/30" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Response timeline chart
                </p>
                <p className="text-xs text-muted-foreground/60">
                  Install recharts to visualize response data over time
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Negotiation Outcomes Pie */}
        <Card className="glass-card rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-4 w-4 text-primary" />
              Outcomes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-64 flex-col items-center justify-center gap-4">
              {conversationQuality.length > 0 ? (
                <div className="w-full space-y-2">
                  {(["success", "pending", "failed"] as const).map((type) => {
                    const count = conversationQuality.filter(
                      (c) => c.outcomeType === type
                    ).length;
                    if (count === 0) return null;
                    return (
                      <div key={type} className="flex items-center justify-between rounded-lg bg-muted/50 p-2">
                        <span className={cn(
                          "text-sm capitalize",
                          type === "success" && "text-emerald-400",
                          type === "pending" && "text-yellow-400",
                          type === "failed" && "text-destructive",
                        )}>
                          {type === "success" ? "Booked/Completed" : type}
                        </span>
                        <Badge variant="outline" className="text-xs">{count}</Badge>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <>
                  <PieChart className="h-10 w-10 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No data yet</p>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Funnel */}
      <Card className="glass-card rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            Pipeline Funnel
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pipelineFunnel.length === 0 ? (
            <div className="py-8 text-center">
              <Filter className="mx-auto h-10 w-10 text-muted-foreground/30" />
              <p className="mt-3 text-sm text-muted-foreground">No pipeline data yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pipelineFunnel.map((stage) => (
                <div key={stage.stage} className="flex items-center gap-4">
                  <span className="w-32 shrink-0 text-sm text-muted-foreground">
                    {stage.stage}
                  </span>
                  <div className="flex-1">
                    <div className="h-8 overflow-hidden rounded-lg bg-muted">
                      <div
                        className="flex h-full items-center rounded-lg bg-primary/80 px-3 transition-all duration-500"
                        style={{ width: `${stage.percentage}%` }}
                      >
                        <span className="text-xs font-medium text-primary-foreground">
                          {stage.count}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span className="w-16 shrink-0 text-right text-sm text-muted-foreground">
                    {stage.percentage}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conversation Quality Breakdown */}
      <Card className="glass-card rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Conversation Quality Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          {conversationQuality.length === 0 ? (
            <div className="py-8 text-center">
              <Users className="mx-auto h-10 w-10 text-muted-foreground/30" />
              <p className="mt-3 text-sm text-muted-foreground">
                No conversation data yet. Start outreach to see analytics.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prospect</TableHead>
                  <TableHead className="text-center">Emails Sent</TableHead>
                  <TableHead className="text-center">Responses</TableHead>
                  <TableHead className="text-center">Rounds</TableHead>
                  <TableHead>Outcome</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conversationQuality.map((row) => (
                  <TableRow key={row.prospect}>
                    <TableCell className="font-medium text-foreground">
                      {row.prospect}
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {row.emailsSent}
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {row.responsesReceived}
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {row.rounds}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          row.outcomeType === "success" &&
                            "border-emerald-500/20 bg-emerald-500/15 text-emerald-400",
                          row.outcomeType === "pending" &&
                            "border-yellow-500/20 bg-yellow-500/15 text-yellow-400",
                          row.outcomeType === "failed" &&
                            "border-destructive/20 bg-destructive/15 text-destructive"
                        )}
                      >
                        {row.outcomeType === "success" && (
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                        )}
                        {row.outcomeType === "pending" && (
                          <Clock className="mr-1 h-3 w-3" />
                        )}
                        {row.outcomeType === "failed" && (
                          <XCircle className="mr-1 h-3 w-3" />
                        )}
                        {row.finalOutcome}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

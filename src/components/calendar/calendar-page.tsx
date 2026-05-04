"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Phone,
  User,
  Calendar as CalendarIcon,
  RefreshCw,
  X,
  Video,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface ScheduledCallData {
  id: string;
  conversationId: string;
  prospectName: string;
  prospectEmail: string;
  scheduledAt: string;
  duration: number;
  status: string;
  googleEventId: string | null;
  rescheduleCount: number;
  notes: string | null;
}

type CallStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED" | "RESCHEDULED";

function getStatusBadge(status: CallStatus) {
  const config: Record<string, string> = {
    SCHEDULED: "bg-emerald-500/15 text-emerald-400",
    COMPLETED: "bg-blue-500/15 text-blue-400",
    CANCELLED: "bg-destructive/15 text-destructive",
    RESCHEDULED: "bg-yellow-500/15 text-yellow-400",
  };

  return (
    <Badge variant="outline" className={cn("text-xs capitalize", config[status] ?? "")}>
      {status.toLowerCase()}
    </Badge>
  );
}

const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatCallTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatCallDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function CalendarPage() {
  const [calls, setCalls] = useState<ScheduledCallData[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  const fetchCalls = useCallback(async () => {
    try {
      const res = await fetch("/api/calls");
      if (!res.ok) throw new Error("Failed to load calls");
      const data = await res.json();
      setCalls(data);
    } catch {
      console.error("Failed to load calls");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCalls();

    // Refetch when the page regains focus (user navigates back from conversations)
    const onFocus = () => fetchCalls();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchCalls]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const monthName = currentDate.toLocaleString("default", { month: "long" });

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // Build a map of date strings to calls for quick lookup
  const callsByDate = new Map<string, ScheduledCallData[]>();
  for (const call of calls) {
    const d = new Date(call.scheduledAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const existing = callsByDate.get(key) ?? [];
    existing.push(call);
    callsByDate.set(key, existing);
  }

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let day = 1; day <= daysInMonth; day++) calendarDays.push(day);

  const isToday = (day: number) =>
    today.getFullYear() === year &&
    today.getMonth() === month &&
    today.getDate() === day;

  const getCallsForDay = (day: number): ScheduledCallData[] => {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return callsByDate.get(key) ?? [];
  };

  // Upcoming calls (from today onwards, sorted by date)
  const upcomingCalls = calls
    .filter((c) => new Date(c.scheduledAt) >= new Date(new Date().setHours(0, 0, 0, 0)))
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="gradient-text text-3xl font-bold">Calendar</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your scheduled calls and availability
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Calendar Grid */}
        <Card className="glass-card rounded-xl lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {monthName} {year}
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon-sm" onClick={prevMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={nextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Day headers */}
            <div className="mb-2 grid grid-cols-7 gap-1">
              {daysOfWeek.map((day) => (
                <div
                  key={day}
                  className="py-2 text-center text-xs font-medium text-muted-foreground"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, index) => {
                const dayCalls = day ? getCallsForDay(day) : [];
                return (
                  <div
                    key={index}
                    className={cn(
                      "relative flex h-12 items-center justify-center rounded-lg text-sm transition-colors",
                      day === null && "invisible",
                      day !== null && "cursor-default hover:bg-muted/50",
                      isToday(day as number) &&
                        "bg-primary/15 font-semibold text-primary",
                      dayCalls.length > 0 &&
                        !isToday(day as number) &&
                        "font-medium text-foreground"
                    )}
                  >
                    {day}
                    {dayCalls.length > 0 && (
                      <div className="absolute right-1.5 bottom-1.5 flex gap-0.5">
                        {dayCalls.slice(0, 3).map((_, i) => (
                          <div
                            key={i}
                            className="h-1.5 w-1.5 rounded-full bg-primary"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Calls */}
        <Card className="glass-card rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-primary" />
              Upcoming Calls
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : upcomingCalls.length === 0 ? (
              <div className="py-8 text-center">
                <CalendarIcon className="mx-auto h-10 w-10 text-muted-foreground/30" />
                <p className="mt-3 text-sm text-muted-foreground">
                  No calls scheduled
                </p>
                <p className="mt-1 text-xs text-muted-foreground/60">
                  Calls will appear here as prospects confirm
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingCalls.map((call) => (
                  <div
                    key={call.id}
                    className="rounded-lg border border-border p-3 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar size="sm">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {call.prospectName
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-foreground">
                            {call.prospectName}
                          </p>
                          {getStatusBadge(call.status as CallStatus)}
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatCallTime(call.scheduledAt)}
                          </span>
                          <span>{call.duration} min</span>
                          <span>{formatCallDate(call.scheduledAt)}</span>
                        </div>
                        {call.googleEventId && (
                          <p className="mt-1 text-xs text-emerald-400/70">
                            Google Calendar event created
                          </p>
                        )}
                        {call.rescheduleCount > 0 && (
                          <p className="mt-1 text-xs text-yellow-400/70">
                            Rescheduled {call.rescheduleCount} time
                            {call.rescheduleCount > 1 ? "s" : ""}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

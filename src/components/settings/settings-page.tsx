"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bot,
  Mail,
  Calendar,
  Save,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Clock,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gigDescription, setGigDescription] = useState("");
  const [budgetCeiling, setBudgetCeiling] = useState("150");
  const [tone, setTone] = useState("professional yet friendly");
  const [fromEmail, setFromEmail] = useState("");
  const [availableHoursStart, setAvailableHoursStart] = useState("9");
  const [availableHoursEnd, setAvailableHoursEnd] = useState("17");
  const [timezone, setTimezone] = useState("America/New_York");
  const [calendarConnected, setCalendarConnected] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/config");
      if (!res.ok) throw new Error("Failed to load config");
      const config: Record<string, string> = await res.json();

      if (config.gig_description) setGigDescription(config.gig_description);
      if (config.budget_ceiling) setBudgetCeiling(config.budget_ceiling);
      if (config.tone) setTone(config.tone);
      if (config.from_email) setFromEmail(config.from_email);
      if (config.available_hours_start) setAvailableHoursStart(config.available_hours_start);
      if (config.available_hours_end) setAvailableHoursEnd(config.available_hours_end);
      if (config.timezone) setTimezone(config.timezone);

      setCalendarConnected(!!config.google_access_token && !!config.google_refresh_token);
    } catch {
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const entries = [
        { key: "gig_description", value: gigDescription },
        { key: "budget_ceiling", value: budgetCeiling },
        { key: "tone", value: tone },
        { key: "from_email", value: fromEmail },
        { key: "available_hours_start", value: availableHoursStart },
        { key: "available_hours_end", value: availableHoursEnd },
        { key: "timezone", value: timezone },
      ];

      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entries),
      });

      if (!res.ok) throw new Error("Failed to save");
      toast.success("Settings saved successfully");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleCalendarConnect = () => {
    window.location.href = "/api/calendar/connect";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="gradient-text text-3xl font-bold">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Configure your email agent&apos;s behavior
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Agent Configuration */}
        <Card className="glass-card rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              Agent Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gig-description">Gig Description</Label>
              <Textarea
                id="gig-description"
                placeholder="Describe the gig opportunity..."
                value={gigDescription}
                onChange={(e) => setGigDescription(e.target.value)}
                className="min-h-[100px]"
              />
              <p className="text-xs text-muted-foreground">
                This helps the agent understand and pitch the opportunity accurately.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="budget-ceiling">Budget Ceiling ($/hr)</Label>
              <Input
                id="budget-ceiling"
                type="number"
                min="0"
                value={budgetCeiling}
                onChange={(e) => setBudgetCeiling(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                The agent will never exceed this rate. Walks away if the prospect&apos;s rate is too high.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tone">Tone</Label>
              <Select value={tone} onValueChange={(value) => value && setTone(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional yet friendly">Professional yet Friendly</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="friendly">Friendly</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Available Hours</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="23"
                  value={availableHoursStart}
                  onChange={(e) => setAvailableHoursStart(e.target.value)}
                  className="w-20"
                />
                <span className="text-muted-foreground">to</span>
                <Input
                  type="number"
                  min="0"
                  max="23"
                  value={availableHoursEnd}
                  onChange={(e) => setAvailableHoursEnd(e.target.value)}
                  className="w-20"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {/* Email Settings */}
          <Card className="glass-card rounded-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                Email Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="from-email">From Email (Resend)</Label>
                <Input
                  id="from-email"
                  placeholder="agent@yourdomain.com"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Sender email address configured in Resend.
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>API Key Status</Label>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm text-emerald-400">
                    LLM API Connected
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm text-emerald-400">
                    Resend API Active
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Calendar Integration */}
          <Card className="glass-card rounded-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Calendar Integration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-card ring-1 ring-foreground/10">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Google Calendar
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {calendarConnected ? "Connected" : "Not connected"}
                    </p>
                  </div>
                </div>
                {calendarConnected ? (
                  <Badge className="bg-emerald-500/15 text-emerald-400">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Connected
                  </Badge>
                ) : (
                  <Button variant="outline" onClick={handleCalendarConnect}>
                    <ExternalLink /> Connect
                  </Button>
                )}
              </div>

              {calendarConnected && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-foreground">
                          Auto-schedule calls
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Book calls in Google Calendar automatically
                        </p>
                      </div>
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-foreground">
                          Buffer time between calls
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Minimum gap between scheduled calls
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        15 min
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} className="gap-2" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" /> Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

import { AppShell } from "@/components/layout/app-shell";
import { ThreadView } from "@/components/conversations/thread-view";

export default function ConversationThread({ params }: { params: Promise<{ id: string }> }) {
  return (
    <AppShell>
      <ThreadView conversationId={params} />
    </AppShell>
  );
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface ResendWebhookPayload {
  data: {
    from: string;
    to: string;
    subject: string;
    html?: string;
    text?: string;
  };
}

export async function POST(request: Request) {
  try {
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

    if (webhookSecret) {
      const svixId = request.headers.get("svix-id");
      const svixTimestamp = request.headers.get("svix-timestamp");
      const svixSignature = request.headers.get("svix-signature");

      if (!svixId || !svixTimestamp || !svixSignature) {
        return NextResponse.json(
          { error: "Missing webhook signature headers" },
          { status: 401 }
        );
      }
    }

    const payload: ResendWebhookPayload = await request.json();

    const fromEmail = payload.data.from;
    const subject = payload.data.subject;
    const emailBody = payload.data.text ?? payload.data.html ?? "";

    if (!fromEmail) {
      return NextResponse.json(
        { error: "Missing from email" },
        { status: 400 }
      );
    }

    // Return 200 immediately so the webhook doesn't block
    // Process asynchronously
    processEmailAsync(fromEmail, subject, emailBody).catch((error) => {
      console.error("Async email processing failed:", error);
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Failed to handle webhook:", error);
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 }
    );
  }
}

async function processEmailAsync(
  fromEmail: string,
  subject: string,
  emailBody: string
) {
  // Find or create the prospect
  let prospect = await prisma.prospect.findUnique({
    where: { email: fromEmail },
  });

  if (!prospect) {
    prospect = await prisma.prospect.create({
      data: {
        email: fromEmail,
        name: fromEmail.split("@")[0],
      },
    });
  }

  // Find or create an active conversation for this prospect
  let conversation = await prisma.conversation.findFirst({
    where: {
      prospectId: prospect.id,
      status: "ACTIVE",
    },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        prospectId: prospect.id,
        subject: subject ?? "New conversation",
      },
    });
  }

  // Trigger agent processing via internal API.
  // The processInboundEmail function inside /api/agent/process
  // handles saving the inbound message via addMessage.
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  await fetch(`${baseUrl}/api/agent/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      conversationId: conversation.id,
      emailBody,
      fromEmail,
      subject,
    }),
  });
}

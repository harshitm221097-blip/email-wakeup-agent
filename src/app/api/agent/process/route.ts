import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getResendClient } from "@/lib/resend";
import { createCalendarEvent, updateCalendarEvent } from "@/lib/google-calendar";
import { processInboundEmail } from "@/agent/core";
import type { AgentDecision } from "@/agent/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { conversationId, emailBody, fromEmail } = body as {
      conversationId: string;
      emailBody: string;
      fromEmail: string;
      subject?: string;
    };

    if (!conversationId || !emailBody || !fromEmail) {
      return NextResponse.json(
        { error: "conversationId, emailBody, and fromEmail are required" },
        { status: 400 }
      );
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { prospect: true },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    const agentEmailConfig = await prisma.agentConfig.findUnique({
      where: { key: "from_email" },
    });
    const agentEmail = agentEmailConfig?.value ?? "agent@yourdomain.com";

    // processInboundEmail handles saving the inbound message internally via addMessage
    const decision: AgentDecision = await processInboundEmail(
      conversationId,
      emailBody,
      fromEmail
    );

    // Helper to extract email content from the decision
    const getEmailContent = () => {
      if (decision.emailContent) {
        return decision.emailContent;
      }
      return {
        subject: `Re: ${conversation.subject}`,
        body: "",
      };
    };

    switch (decision.action) {
      case "SEND_REPLY": {
        const content = getEmailContent();
        const subject = content.subject || `Re: ${conversation.subject}`;

        await getResendClient().emails.send({
          from: agentEmail,
          to: conversation.prospect.email,
          subject,
          text: content.body,
        });

        await prisma.message.create({
          data: {
            conversationId,
            direction: "OUTBOUND",
            fromEmail: agentEmail,
            toEmail: conversation.prospect.email,
            subject,
            body: content.body,
            metadata: { reasoning: decision.reasoning },
          },
        });
        break;
      }

      case "NEGOTIATE": {
        const content = getEmailContent();
        const subject = content.subject || `Re: ${conversation.subject}`;

        await getResendClient().emails.send({
          from: agentEmail,
          to: conversation.prospect.email,
          subject,
          text: content.body,
        });

        await prisma.message.create({
          data: {
            conversationId,
            direction: "OUTBOUND",
            fromEmail: agentEmail,
            toEmail: conversation.prospect.email,
            subject,
            body: content.body,
            metadata: {
              reasoning: decision.reasoning,
              budgetCounter: decision.budgetCounter,
            },
          },
        });

        await prisma.prospect.update({
          where: { id: conversation.prospectId },
          data: { status: "NEGOTIATING" },
        });
        break;
      }

      case "PROPOSE_SLOTS": {
        const content = getEmailContent();
        const subject = content.subject || `Re: ${conversation.subject}`;

        const slotsText = decision.proposedSlots
          ?.map((slot) => `- ${slot}`)
          .join("\n");

        const emailBodyText =
          content.body + (slotsText ? "\n\nAvailable slots:\n" + slotsText : "");

        await getResendClient().emails.send({
          from: agentEmail,
          to: conversation.prospect.email,
          subject,
          text: emailBodyText,
        });

        await prisma.message.create({
          data: {
            conversationId,
            direction: "OUTBOUND",
            fromEmail: agentEmail,
            toEmail: conversation.prospect.email,
            subject,
            body: emailBodyText,
            metadata: {
              reasoning: decision.reasoning,
              proposedSlots: decision.proposedSlots,
            },
          },
        });
        break;
      }

      case "BOOK_CALL": {
        if (decision.bookingDetails?.scheduledAt) {
          const scheduledAt = new Date(decision.bookingDetails.scheduledAt);
          const duration = decision.bookingDetails.duration ?? 30;
          const endTime = new Date(scheduledAt.getTime() + duration * 60 * 1000);

          // Create Google Calendar event (graceful skip if not connected)
          let googleEventId: string | null = null;

          // Check for existing scheduled call (reschedule scenario)
          const existingCall = await prisma.scheduledCall.findUnique({
            where: { conversationId },
          });

          if (existingCall?.googleEventId) {
            // Update existing calendar event
            const updated = await updateCalendarEvent(existingCall.googleEventId, {
              summary: `Call with ${conversation.prospect.name}`,
              description: `Scheduled call with ${conversation.prospect.name} (${conversation.prospect.email})\n\nConversation: ${conversation.subject}`,
              start: scheduledAt,
              end: endTime,
              attendeeEmail: conversation.prospect.email,
              attendeeName: conversation.prospect.name,
            });
            if (updated) googleEventId = existingCall.googleEventId;
          } else {
            // Create new calendar event
            googleEventId = await createCalendarEvent({
              summary: `Call with ${conversation.prospect.name}`,
              description: `Scheduled call with ${conversation.prospect.name} (${conversation.prospect.email})\n\nConversation: ${conversation.subject}`,
              start: scheduledAt,
              end: endTime,
              attendeeEmail: conversation.prospect.email,
              attendeeName: conversation.prospect.name,
            });
          }

          // Upsert the scheduled call record
          await prisma.scheduledCall.upsert({
            where: { conversationId },
            update: {
              prospectName: conversation.prospect.name,
              prospectEmail: conversation.prospect.email,
              scheduledAt,
              duration,
              status: "SCHEDULED",
              googleEventId: googleEventId ?? existingCall?.googleEventId ?? null,
              rescheduleCount: (existingCall?.rescheduleCount ?? 0),
            },
            create: {
              conversationId,
              prospectName: conversation.prospect.name,
              prospectEmail: conversation.prospect.email,
              scheduledAt,
              duration,
              status: "SCHEDULED",
              googleEventId,
            },
          });

          const content = getEmailContent();
          const subject =
            content.subject || `Re: ${conversation.subject}`;

          await getResendClient().emails.send({
            from: agentEmail,
            to: conversation.prospect.email,
            subject,
            text: content.body,
          });

          await prisma.message.create({
            data: {
              conversationId,
              direction: "OUTBOUND",
              fromEmail: agentEmail,
              toEmail: conversation.prospect.email,
              subject,
              body: content.body,
              metadata: {
                reasoning: decision.reasoning,
                bookingDetails: decision.bookingDetails,
                googleCalendarEventId: googleEventId,
              },
            },
          });

          await prisma.prospect.update({
            where: { id: conversation.prospectId },
            data: { status: "SCHEDULED" },
          });
        }
        break;
      }

      case "WALK_AWAY": {
        const content = getEmailContent();
        const subject = content.subject || `Re: ${conversation.subject}`;

        await getResendClient().emails.send({
          from: agentEmail,
          to: conversation.prospect.email,
          subject,
          text: content.body,
        });

        await prisma.message.create({
          data: {
            conversationId,
            direction: "OUTBOUND",
            fromEmail: agentEmail,
            toEmail: conversation.prospect.email,
            subject,
            body: content.body,
            metadata: { reasoning: decision.reasoning },
          },
        });

        await prisma.prospect.update({
          where: { id: conversation.prospectId },
          data: { status: "WALKED_AWAY" },
        });

        await prisma.conversation.update({
          where: { id: conversationId },
          data: { status: "COMPLETED" },
        });
        break;
      }

      case "WAIT": {
        // No email sent — agent state already updated by processInboundEmail via saveAgentState
        break;
      }
    }

    return NextResponse.json({
      action: decision.action,
      reasoning: decision.reasoning,
    });
  } catch (error) {
    console.error("Failed to process inbound email:", error);
    return NextResponse.json(
      { error: "Failed to process inbound email" },
      { status: 500 }
    );
  }
}

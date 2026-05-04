import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        prospect: true,
        messages: {
          orderBy: { sentAt: "asc" },
        },
        call: true,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: conversation.id,
      prospectId: conversation.prospectId,
      subject: conversation.subject,
      status: conversation.status,
      agentState: conversation.agentState,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      prospect: {
        id: conversation.prospect.id,
        name: conversation.prospect.name,
        email: conversation.prospect.email,
        company: conversation.prospect.company,
        status: conversation.prospect.status,
      },
      messages: conversation.messages.map((m: { id: string; direction: string; fromEmail: string; toEmail: string; subject: string | null; body: string; metadata: unknown; sentAt: Date }) => ({
        id: m.id,
        direction: m.direction,
        fromEmail: m.fromEmail,
        toEmail: m.toEmail,
        subject: m.subject,
        body: m.body,
        metadata: m.metadata,
        sentAt: m.sentAt,
      })),
      call: conversation.call,
    });
  } catch (error) {
    console.error("Failed to get conversation:", error);
    return NextResponse.json(
      { error: "Failed to get conversation" },
      { status: 500 }
    );
  }
}

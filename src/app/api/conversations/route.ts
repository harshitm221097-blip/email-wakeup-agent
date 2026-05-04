import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as string | null;
    const prospectId = searchParams.get("prospectId");

    const where: Record<string, unknown> = {};
    if (status) {
      where.status = status;
    }
    if (prospectId) {
      where.prospectId = prospectId;
    }

    const conversations = await prisma.conversation.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        prospect: {
          select: {
            id: true,
            name: true,
            email: true,
            company: true,
            status: true,
          },
        },
        _count: {
          select: { messages: true },
        },
        messages: {
          orderBy: { sentAt: "desc" },
          take: 1,
          select: {
            id: true,
            direction: true,
            body: true,
            sentAt: true,
          },
        },
        call: true,
      },
    });

    const result = conversations.map((c: { id: string; prospectId: string; subject: string; status: string; createdAt: Date; updatedAt: Date; prospect: { id: string; name: string; email: string; company: string | null; status: string }; _count: { messages: number }; messages: { id: string; direction: string; body: string; sentAt: Date }[]; call: unknown }) => ({
      id: c.id,
      prospectId: c.prospectId,
      subject: c.subject,
      status: c.status,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      prospect: c.prospect,
      messageCount: c._count.messages,
      latestMessage: c.messages[0] ?? null,
      call: c.call,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to list conversations:", error);
    return NextResponse.json(
      { error: "Failed to list conversations" },
      { status: 500 }
    );
  }
}

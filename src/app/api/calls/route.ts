import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const calls = await prisma.scheduledCall.findMany({
      orderBy: { scheduledAt: "asc" },
      include: {
        conversation: {
          include: {
            prospect: {
              select: { name: true, email: true },
            },
          },
        },
      },
    });

    const result = calls.map((call) => ({
      id: call.id,
      conversationId: call.conversationId,
      prospectName: call.prospectName,
      prospectEmail: call.prospectEmail,
      scheduledAt: call.scheduledAt,
      duration: call.duration,
      status: call.status,
      googleEventId: call.googleEventId,
      rescheduleCount: call.rescheduleCount,
      notes: call.notes,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to load calls:", error);
    return NextResponse.json(
      { error: "Failed to load calls" },
      { status: 500 }
    );
  }
}

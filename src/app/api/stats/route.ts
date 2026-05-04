import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const [
      totalProspects,
      activeConversations,
      callsScheduled,
      recentMessages,
      prospectStatusCounts,
    ] = await Promise.all([
      prisma.prospect.count(),
      prisma.conversation.count({ where: { status: "ACTIVE" } }),
      prisma.scheduledCall.count({ where: { status: "SCHEDULED" } }),
      prisma.message.findMany({
        orderBy: { sentAt: "desc" },
        take: 10,
        include: {
          conversation: {
            include: {
              prospect: {
                select: { name: true, email: true, status: true },
              },
            },
          },
        },
      }),
      prisma.prospect.groupBy({
        by: ["status"],
        _count: { status: true },
      }),
    ]);

    const pipelineStages = prospectStatusCounts.map((p) => ({
      stage: p.status,
      count: p._count.status,
    }));

    const recentActivity = recentMessages.map((m) => ({
      id: m.id,
      direction: m.direction,
      prospectName: m.conversation.prospect.name,
      prospectStatus: m.conversation.prospect.status,
      subject: m.subject,
      body: m.body.slice(0, 100),
      sentAt: m.sentAt,
    }));

    return NextResponse.json({
      totalProspects,
      activeConversations,
      callsScheduled,
      pipelineStages,
      recentActivity,
    });
  } catch (error) {
    console.error("Failed to load stats:", error);
    return NextResponse.json(
      { error: "Failed to load stats" },
      { status: 500 }
    );
  }
}

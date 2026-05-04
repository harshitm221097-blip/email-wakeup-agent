import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const [
      totalOutbound,
      totalInbound,
      totalConversations,
      scheduledCalls,
      prospectsByStatus,
      conversationDetails,
    ] = await Promise.all([
      prisma.message.count({ where: { direction: "OUTBOUND" } }),
      prisma.message.count({ where: { direction: "INBOUND" } }),
      prisma.conversation.count(),
      prisma.scheduledCall.findMany({
        where: { status: "SCHEDULED" },
      }),
      prisma.prospect.groupBy({
        by: ["status"],
        _count: { status: true },
      }),
      prisma.conversation.findMany({
        include: {
          prospect: { select: { name: true, status: true } },
          _count: { select: { messages: true } },
          messages: {
            orderBy: { sentAt: "desc" },
            select: { direction: true },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
    ]);

    const responseRate =
      totalOutbound > 0
        ? ((totalInbound / totalOutbound) * 100).toFixed(1)
        : "0";

    const callBookingRate =
      totalConversations > 0
        ? ((scheduledCalls.length / totalConversations) * 100).toFixed(1)
        : "0";

    const pipelineFunnel = [
      { stage: "Emails Sent", count: totalOutbound, percentage: 100 },
      {
        stage: "Responses",
        count: totalInbound,
        percentage: totalOutbound > 0 ? Math.round((totalInbound / totalOutbound) * 100) : 0,
      },
    ];

    // Add pipeline stages from prospect statuses
    const statusOrder = ["NEGOTIATING", "INTERESTED", "SCHEDULED", "DECLINED", "WALKED_AWAY"] as const;
    for (const status of statusOrder) {
      const found = prospectsByStatus.find((p) => p.status === status);
      if (found && found._count.status > 0) {
        pipelineFunnel.push({
          stage: status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " "),
          count: found._count.status,
          percentage: totalOutbound > 0 ? Math.round((found._count.status / totalOutbound) * 100) : 0,
        });
      }
    }

    const conversationQuality = conversationDetails.map((c) => {
      const outboundCount = c.messages.filter((m) => m.direction === "OUTBOUND").length;
      const inboundCount = c.messages.filter((m) => m.direction === "INBOUND").length;

      let finalOutcome = "Active";
      let outcomeType: "success" | "pending" | "failed" = "pending";

      const prospectStatus = c.prospect.status;
      if (prospectStatus === "SCHEDULED") {
        finalOutcome = "Call Scheduled";
        outcomeType = "success";
      } else if (prospectStatus === "WALKED_AWAY") {
        finalOutcome = "Walked Away";
        outcomeType = "failed";
      } else if (prospectStatus === "DECLINED") {
        finalOutcome = "Declined";
        outcomeType = "failed";
      } else if (prospectStatus === "NEGOTIATING") {
        finalOutcome = "Negotiating";
        outcomeType = "pending";
      } else if (prospectStatus === "CONTACTED") {
        finalOutcome = "Awaiting Response";
        outcomeType = "pending";
      }

      return {
        prospect: c.prospect.name,
        emailsSent: outboundCount,
        responsesReceived: inboundCount,
        rounds: Math.max(outboundCount, inboundCount),
        finalOutcome,
        outcomeType,
      };
    });

    const walkAwayCount = prospectsByStatus.find((p) => p.status === "WALKED_AWAY")?._count.status ?? 0;
    const walkAwayRate =
      totalConversations > 0
        ? ((walkAwayCount / totalConversations) * 100).toFixed(1)
        : "0";

    return NextResponse.json({
      metrics: {
        totalEmailsSent: totalOutbound,
        responseRate,
        callBookingRate,
        walkAwayRate,
        totalConversations,
        totalProspects: prospectsByStatus.reduce((sum, p) => sum + p._count.status, 0),
      },
      pipelineFunnel,
      conversationQuality,
    });
  } catch (error) {
    console.error("Failed to load analytics:", error);
    return NextResponse.json(
      { error: "Failed to load analytics" },
      { status: 500 }
    );
  }
}

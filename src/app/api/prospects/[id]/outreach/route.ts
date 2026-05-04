import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getResendClient } from "@/lib/resend";
import { initiateOutreach } from "@/agent/core";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const prospect = await prisma.prospect.findUnique({
      where: { id },
    });

    if (!prospect) {
      return NextResponse.json(
        { error: "Prospect not found" },
        { status: 404 }
      );
    }

    if (prospect.status !== "NEW") {
      return NextResponse.json(
        { error: `Prospect is already in status: ${prospect.status}` },
        { status: 400 }
      );
    }

    const agentEmailConfig = await prisma.agentConfig.findUnique({
      where: { key: "from_email" },
    });
    const agentEmail = agentEmailConfig?.value ?? "agent@yourdomain.com";

    const { subject, body } = await initiateOutreach(id);

    const conversation = await prisma.conversation.create({
      data: {
        prospectId: id,
        subject,
      },
    });

    await getResendClient().emails.send({
      from: agentEmail,
      to: prospect.email,
      subject,
      text: body,
    });

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: "OUTBOUND",
        fromEmail: agentEmail,
        toEmail: prospect.email,
        subject,
        body,
      },
    });

    await prisma.prospect.update({
      where: { id },
      data: { status: "CONTACTED" },
    });

    return NextResponse.json({
      success: true,
      conversationId: conversation.id,
      subject,
      body,
    });
  } catch (error) {
    console.error("Failed to initiate outreach:", error);
    return NextResponse.json(
      { error: "Failed to initiate outreach" },
      { status: 500 }
    );
  }
}

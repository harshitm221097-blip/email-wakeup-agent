import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const prospects = await prisma.prospect.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { conversations: true },
        },
      },
    });

    const result = prospects.map((p: { id: string; name: string; email: string; company: string | null; status: string; createdAt: Date; updatedAt: Date; _count: { conversations: number } }) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      company: p.company,
      status: p.status,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      conversationCount: p._count.conversations,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to list prospects:", error);
    return NextResponse.json(
      { error: "Failed to list prospects" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, company } = body as {
      name: string;
      email: string;
      company?: string;
    };

    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      );
    }

    const existing = await prisma.prospect.findUnique({
      where: { email },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A prospect with this email already exists" },
        { status: 409 }
      );
    }

    const prospect = await prisma.prospect.create({
      data: {
        name,
        email,
        company: company ?? null,
      },
    });

    return NextResponse.json(prospect, { status: 201 });
  } catch (error) {
    console.error("Failed to create prospect:", error);
    return NextResponse.json(
      { error: "Failed to create prospect" },
      { status: 500 }
    );
  }
}

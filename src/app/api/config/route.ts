import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const configs = await prisma.agentConfig.findMany({
      orderBy: { key: "asc" },
    });

    const result: Record<string, string> = {};
    for (const config of configs) {
      result[config.key] = config.value;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to load config:", error);
    return NextResponse.json(
      { error: "Failed to load config" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const entries = body as { key: string; value: string }[];

    if (!Array.isArray(entries)) {
      return NextResponse.json(
        { error: "Request body must be an array of { key, value } objects" },
        { status: 400 }
      );
    }

    for (const entry of entries) {
      if (!entry.key || entry.value === undefined) {
        return NextResponse.json(
          { error: `Invalid entry: ${JSON.stringify(entry)}` },
          { status: 400 }
        );
      }
    }

    const results = await prisma.$transaction(
      entries.map((entry) =>
        prisma.agentConfig.upsert({
          where: { key: entry.key },
          update: { value: entry.value },
          create: { key: entry.key, value: entry.value },
        })
      )
    );

    return NextResponse.json({
      updated: results.length,
      configs: results.map((r: { key: string; value: string }) => ({ key: r.key, value: r.value })),
    });
  } catch (error) {
    console.error("Failed to update config:", error);
    return NextResponse.json(
      { error: "Failed to update config" },
      { status: 500 }
    );
  }
}

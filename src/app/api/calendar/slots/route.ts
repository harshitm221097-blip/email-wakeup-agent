import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateTimeSlots } from "@/agent/core";

export async function GET() {
  try {
    const slots = await generateTimeSlots();

    // Get existing scheduled calls to filter out conflicting slots
    const now = new Date();
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const scheduledCalls = await prisma.scheduledCall.findMany({
      where: {
        status: "SCHEDULED",
        scheduledAt: {
          gte: now,
          lte: sevenDaysFromNow,
        },
      },
      select: {
        scheduledAt: true,
        duration: true,
      },
    });

    // Build a set of occupied time ranges (by start minute)
    const occupiedStarts = new Set(
      scheduledCalls.map((call: { scheduledAt: Date }) => call.scheduledAt.toISOString())
    );

    const availableSlots = slots.filter((slot) => {
      // Check if this slot's start time conflicts with any scheduled call
      for (const call of scheduledCalls) {
        const callStart = call.scheduledAt.getTime();
        const callEnd = callStart + call.duration * 60 * 1000;
        const slotStart = new Date(slot.start).getTime();
        const slotEnd = new Date(slot.end).getTime();

        // Overlap check
        if (slotStart < callEnd && slotEnd > callStart) {
          return false;
        }
      }
      return true;
    });

    return NextResponse.json(availableSlots);
  } catch (error) {
    console.error("Failed to get available slots:", error);
    return NextResponse.json(
      { error: "Failed to get available slots" },
      { status: 500 }
    );
  }
}

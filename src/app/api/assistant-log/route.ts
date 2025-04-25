import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

// Define validation schema
const logSchema = z.object({
  action: z.enum(["open", "close", "keyboard_toggle"]),
  source: z.enum(["keyboard", "button"]).default("button"),
  variant: z.string().optional(),
  sessionId: z.string().optional(),
  duration: z.number().optional(),
  metadata: z.record(z.any()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const body = await req.json();
    const validatedData = logSchema.safeParse(body);
    
    if (!validatedData.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: validatedData.error },
        { status: 400 }
      );
    }
    
    const { action, source, variant, sessionId, duration, metadata } = validatedData.data;
    
    // Create log entry
    const logEntry = await prisma.assistantLog.create({
      data: {
        event: action,
        source,
        variant,
        sessionId,
        duration,
        metadata: metadata ? JSON.stringify(metadata) : null,
      }
    });
    
    return NextResponse.json({ success: true, id: logEntry.id });
  } catch (error) {
    console.error("Error logging assistant event:", error);
    return NextResponse.json(
      { error: "Failed to log assistant event" },
      { status: 500 }
    );
  }
} 
import { NextRequest, NextResponse } from 'next/server';
import { z } from "zod";
import { getOpenAIClient } from "@/lib/openai";
import { generateReasoning, extractStructuredResponse } from './utils';

const requestSchema = z.object({
  question: z.string().min(3).max(1000),
  sessionId: z.string().uuid().optional(),
  model: z.enum(["openai", "deepseek", "local"]).optional().default("openai"),
});

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate request
    const result = requestSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid request. Please provide a valid question." },
        { status: 400 }
      );
    }
    
    const { question, sessionId, model } = result.data;
    
    // Get OpenAI client
    const openai = getOpenAIClient();
    
    if (!openai) {
      return NextResponse.json(
        { error: "OpenAI client not configured. Please add your API key in settings." },
        { status: 500 }
      );
    }

    // Generate reasoning using few-shot learning with examples
    const reasoning = await generateReasoning(openai, question);

    // Parse structured response from the reasoning
    const structured = extractStructuredResponse(reasoning);

    // Prepare response
    const responseData = {
      fullReasoning: reasoning,
      structured
    };

    // Log the activity if sessionId is provided
    if (sessionId) {
      await logActivity(sessionId, question, responseData, true);
    }

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Error in reasoning API:", error);
    
    // Log failed activity if sessionId is provided
    try {
      const body = await req.clone().json();
      const sessionId = body?.sessionId;
      const question = body?.question || "Unknown question";
      
      if (sessionId) {
        await logActivity(sessionId, question, null, false);
      }
    } catch (logError) {
      console.error("Error logging failed activity:", logError);
    }
    
    return NextResponse.json(
      { error: "Failed to generate reasoning." },
      { status: 500 }
    );
  }
}

/**
 * Log activity to the session-activities endpoint
 */
async function logActivity(
  sessionId: string,
  query: string,
  response: any,
  success: boolean
): Promise<void> {
  try {
    // Call the session-activities API to log the activity
    const activityData = {
      sessionId,
      type: "reasoning",
      query,
      response,
      metadata: {
        timestamp: new Date().toISOString(),
        success
      }
    };
    
    // Use relative URL for edge function compatibility
    await fetch("/api/session-activities", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(activityData),
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
    // Non-blocking - we don't want to fail the main request if logging fails
  }
} 
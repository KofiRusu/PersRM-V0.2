import { NextRequest, NextResponse } from "next/server";
import { getRouteReasoning, isReasoningModelAvailable } from "@/lib/ollama-reasoning";

export async function POST(request: NextRequest) {
  // Check if reasoning model is available
  const modelAvailable = await isReasoningModelAvailable();
  if (!modelAvailable) {
    return NextResponse.json(
      { success: false, error: "Reasoning model is not available" }, 
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const { appDescription, features, existingRoutes } = body;

    // Validate request
    if (!appDescription) {
      return NextResponse.json(
        { success: false, error: "Application description is required" },
        { status: 400 }
      );
    }

    // Get reasoning for route generation
    const reasoning = await getRouteReasoning(
      appDescription,
      features,
      existingRoutes
    );

    return NextResponse.json({ 
      success: true,
      reasoning
    });
  } catch (error) {
    console.error("Error in route reasoning API:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate route reasoning" },
      { status: 500 }
    );
  }
} 
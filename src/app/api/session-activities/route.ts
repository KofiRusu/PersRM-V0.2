import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";

// Define directory for storing activity data
const DATA_DIR = path.join(process.cwd(), "data");
const ACTIVITIES_DIR = path.join(DATA_DIR, "activities");

// Activity interface
interface SessionActivity {
  id: string;
  sessionId: string;
  timestamp: string;
  type: "reasoning" | "component" | "route";
  query: string;
  response?: {
    fullReasoning?: string;
    structured?: {
      analysis: string;
      approaches: string;
      bestPractices: string;
      accessibility: string;
      implementation: string;
      examples: string;
    };
    code?: string;
    route?: string;
  };
  userId?: string;
  metadata?: Record<string, any>;
}

// Ensure data directories exist
async function ensureDirectories() {
  try {
    await fs.access(DATA_DIR);
  } catch (error) {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
  
  try {
    await fs.access(ACTIVITIES_DIR);
  } catch (error) {
    await fs.mkdir(ACTIVITIES_DIR, { recursive: true });
  }
}

// Get activity file path for a session
function getActivityFilePath(sessionId: string): string {
  return path.join(ACTIVITIES_DIR, `${sessionId}.json`);
}

// Load activities for a session
async function loadSessionActivities(sessionId: string): Promise<SessionActivity[]> {
  await ensureDirectories();
  const filePath = getActivityFilePath(sessionId);
  
  try {
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    // Return empty array if file doesn't exist or is invalid
    return [];
  }
}

// Save activities for a session
async function saveSessionActivities(sessionId: string, activities: SessionActivity[]): Promise<void> {
  await ensureDirectories();
  const filePath = getActivityFilePath(sessionId);
  await fs.writeFile(filePath, JSON.stringify(activities, null, 2), "utf-8");
}

// Validation schemas
const createActivitySchema = z.object({
  sessionId: z.string().uuid(),
  type: z.enum(["reasoning", "component", "route"]),
  query: z.string().min(1),
  response: z.object({
    fullReasoning: z.string().optional(),
    structured: z.object({
      analysis: z.string().optional(),
      approaches: z.string().optional(),
      bestPractices: z.string().optional(),
      accessibility: z.string().optional(),
      implementation: z.string().optional(),
      examples: z.string().optional(),
    }).optional(),
    code: z.string().optional(),
    route: z.string().optional(),
  }).optional(),
  userId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

// GET handler - fetch activities for a session
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("sessionId");
    
    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }
    
    const activities = await loadSessionActivities(sessionId);
    
    // Sort activities by timestamp (newest first)
    activities.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    return NextResponse.json(activities);
  } catch (error) {
    console.error("Error fetching session activities:", error);
    return NextResponse.json(
      { error: "Failed to fetch session activities" },
      { status: 500 }
    );
  }
}

// POST handler - create a new activity
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = createActivitySchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid activity data", details: validation.error.format() },
        { status: 400 }
      );
    }
    
    const activityData = validation.data;
    const activities = await loadSessionActivities(activityData.sessionId);
    
    const newActivity: SessionActivity = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      sessionId: activityData.sessionId,
      type: activityData.type,
      query: activityData.query,
      ...(activityData.response ? { response: activityData.response } : {}),
      ...(activityData.userId ? { userId: activityData.userId } : {}),
      ...(activityData.metadata ? { metadata: activityData.metadata } : {}),
    };
    
    activities.push(newActivity);
    await saveSessionActivities(activityData.sessionId, activities);
    
    return NextResponse.json(newActivity, { status: 201 });
  } catch (error) {
    console.error("Error creating session activity:", error);
    return NextResponse.json(
      { error: "Failed to create session activity" },
      { status: 500 }
    );
  }
}

// DELETE handler - delete an activity
export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("sessionId");
    const activityId = url.searchParams.get("activityId");
    
    if (!sessionId || !activityId) {
      return NextResponse.json(
        { error: "Session ID and Activity ID are required" },
        { status: 400 }
      );
    }
    
    let activities = await loadSessionActivities(sessionId);
    
    const activityIndex = activities.findIndex(a => a.id === activityId);
    if (activityIndex === -1) {
      return NextResponse.json(
        { error: "Activity not found" },
        { status: 404 }
      );
    }
    
    // Remove activity
    const deletedActivity = activities[activityIndex];
    activities = activities.filter(a => a.id !== activityId);
    await saveSessionActivities(sessionId, activities);
    
    return NextResponse.json({
      message: "Activity deleted successfully",
      deletedActivity
    });
  } catch (error) {
    console.error("Error deleting session activity:", error);
    return NextResponse.json(
      { error: "Failed to delete session activity" },
      { status: 500 }
    );
  }
} 
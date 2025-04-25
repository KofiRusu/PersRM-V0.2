import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import path from "path";
import fs from "fs/promises";
import { v4 as uuidv4 } from "uuid";

// Define directory for storing logs
const DATA_DIR = path.join(process.cwd(), "data");
const LOGS_FILE = path.join(DATA_DIR, "session-logs.jsonl");

// Session log entry interface
interface SessionLogEntry {
  id: string;
  timestamp: string;
  action: "create" | "switch" | "rename" | "delete" | "share" | "unshare";
  sessionId: string;
  userId?: string;
  metadata?: Record<string, any>;
}

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch (error) {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

// Append log entry to JSONL file
async function appendLogEntry(entry: SessionLogEntry): Promise<void> {
  await ensureDataDir();
  const entryString = JSON.stringify(entry) + "\n";
  await fs.appendFile(LOGS_FILE, entryString, "utf-8");
}

// Get recent logs (optional, for debugging and analytics)
async function getRecentLogs(limit: number = 100): Promise<SessionLogEntry[]> {
  await ensureDataDir();
  
  try {
    const data = await fs.readFile(LOGS_FILE, "utf-8");
    // Parse JSONL format (one JSON object per line)
    const lines = data.trim().split("\n");
    const logs = lines.map(line => JSON.parse(line) as SessionLogEntry);
    
    // Return most recent logs, up to the limit
    return logs.slice(-limit).reverse();
  } catch (error) {
    // Return empty array if file doesn't exist or is invalid
    return [];
  }
}

// Validation schema for log entries
const logEntrySchema = z.object({
  action: z.enum(["create", "switch", "rename", "delete", "share", "unshare"]),
  sessionId: z.string().uuid(),
  userId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

// POST handler - log a session event
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = logEntrySchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid log data", details: validation.error.format() },
        { status: 400 }
      );
    }
    
    const logData = validation.data;
    
    // Create log entry
    const logEntry: SessionLogEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      action: logData.action,
      sessionId: logData.sessionId,
      ...(logData.userId ? { userId: logData.userId } : {}),
      ...(logData.metadata ? { metadata: logData.metadata } : {}),
    };
    
    // Save log entry
    await appendLogEntry(logEntry);
    
    return NextResponse.json({ success: true, entry: logEntry }, { status: 201 });
  } catch (error) {
    console.error("Error logging session event:", error);
    return NextResponse.json(
      { error: "Failed to log session event" },
      { status: 500 }
    );
  }
}

// GET handler - retrieve recent logs (for debugging/analytics)
export async function GET(request: NextRequest) {
  try {
    // Add authorization check here for production
    const url = new URL(request.url);
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 100;
    
    const logs = await getRecentLogs(Math.min(limit, 1000)); // Cap at 1000 to prevent huge responses
    
    return NextResponse.json(logs);
  } catch (error) {
    console.error("Error fetching session logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch session logs" },
      { status: 500 }
    );
  }
} 
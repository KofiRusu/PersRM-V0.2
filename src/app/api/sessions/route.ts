import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import path from "path";
import fs from "fs/promises";
import { v4 as uuidv4 } from "uuid";

// Define directory for storing session data
const DATA_DIR = path.join(process.cwd(), "data");
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");

// Session interface
interface Session {
  id: string;
  name: string;
  createdAt: string;
  isShared: boolean;
  userId?: string; // Optional user ID for authenticated sessions
  metadata?: Record<string, any>; // Optional metadata
}

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch (error) {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

// Load sessions from disk
async function loadSessions(): Promise<Session[]> {
  await ensureDataDir();
  
  try {
    const data = await fs.readFile(SESSIONS_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    // Return empty array if file doesn't exist or is invalid
    return [];
  }
}

// Save sessions to disk
async function saveSessions(sessions: Session[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(SESSIONS_FILE, JSON.stringify(sessions, null, 2), "utf-8");
}

// Validation schemas
const createSessionSchema = z.object({
  name: z.string().min(1).max(100),
  isShared: z.boolean().optional().default(false),
  userId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const updateSessionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isShared: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
});

// GET handler - list all sessions or fetch a specific session
export async function GET(request: NextRequest) {
  try {
    const sessions = await loadSessions();
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("id");
    
    if (sessionId) {
      // Return specific session
      const session = sessions.find(s => s.id === sessionId);
      if (!session) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(session);
    }
    
    // Return all sessions
    return NextResponse.json(sessions);
  } catch (error) {
    console.error("Error fetching sessions:", error);
    return NextResponse.json(
      { error: "Failed to fetch sessions" },
      { status: 500 }
    );
  }
}

// POST handler - create a new session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = createSessionSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid session data", details: validation.error.format() },
        { status: 400 }
      );
    }
    
    const sessionData = validation.data;
    const sessions = await loadSessions();
    
    const newSession: Session = {
      id: uuidv4(),
      name: sessionData.name,
      createdAt: new Date().toISOString(),
      isShared: sessionData.isShared || false,
      ...(sessionData.userId ? { userId: sessionData.userId } : {}),
      ...(sessionData.metadata ? { metadata: sessionData.metadata } : {}),
    };
    
    sessions.push(newSession);
    await saveSessions(sessions);
    
    return NextResponse.json(newSession, { status: 201 });
  } catch (error) {
    console.error("Error creating session:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}

// PUT handler - update a session
export async function PUT(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("id");
    
    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }
    
    const body = await request.json();
    const validation = updateSessionSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid session data", details: validation.error.format() },
        { status: 400 }
      );
    }
    
    const updateData = validation.data;
    let sessions = await loadSessions();
    
    const sessionIndex = sessions.findIndex(s => s.id === sessionId);
    if (sessionIndex === -1) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }
    
    // Update session with new data
    sessions[sessionIndex] = {
      ...sessions[sessionIndex],
      ...(updateData.name !== undefined ? { name: updateData.name } : {}),
      ...(updateData.isShared !== undefined ? { isShared: updateData.isShared } : {}),
      ...(updateData.metadata !== undefined ? { metadata: updateData.metadata } : {}),
    };
    
    await saveSessions(sessions);
    
    return NextResponse.json(sessions[sessionIndex]);
  } catch (error) {
    console.error("Error updating session:", error);
    return NextResponse.json(
      { error: "Failed to update session" },
      { status: 500 }
    );
  }
}

// DELETE handler - delete a session
export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("id");
    
    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }
    
    let sessions = await loadSessions();
    
    const sessionIndex = sessions.findIndex(s => s.id === sessionId);
    if (sessionIndex === -1) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }
    
    // Remove session
    const deletedSession = sessions[sessionIndex];
    sessions = sessions.filter(s => s.id !== sessionId);
    await saveSessions(sessions);
    
    return NextResponse.json({
      message: "Session deleted successfully",
      deletedSession
    });
  } catch (error) {
    console.error("Error deleting session:", error);
    return NextResponse.json(
      { error: "Failed to delete session" },
      { status: 500 }
    );
  }
} 
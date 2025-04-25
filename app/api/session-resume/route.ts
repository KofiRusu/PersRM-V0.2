import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import path from "path";
import fs from "fs/promises";

// Define directory for storing session states
const DATA_DIR = path.join(process.cwd(), "data");
const STATES_DIR = path.join(DATA_DIR, "execution-states");

// Execution state interface
interface ExecutionState {
  id: string;
  timestamp: number;
  type: 'reasoning' | 'code-generation' | 'tool-execution';
  status: 'in-progress' | 'paused' | 'completed' | 'failed';
  lastExecutionPoint: string;
  context: Record<string, any>;
  toolState?: Record<string, any>;
  errorMessage?: string;
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
    await fs.access(STATES_DIR);
  } catch (error) {
    await fs.mkdir(STATES_DIR, { recursive: true });
  }
}

// Get file path for a session's execution states
function getSessionStatesFilePath(sessionId: string): string {
  return path.join(STATES_DIR, `${sessionId}.json`);
}

// Load execution states for a session
async function loadSessionStates(sessionId: string): Promise<ExecutionState[]> {
  await ensureDirectories();
  const filePath = getSessionStatesFilePath(sessionId);
  
  try {
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    // Return empty array if file doesn't exist or is invalid
    return [];
  }
}

// Save execution states for a session
async function saveSessionStates(sessionId: string, states: ExecutionState[]): Promise<void> {
  await ensureDirectories();
  const filePath = getSessionStatesFilePath(sessionId);
  await fs.writeFile(filePath, JSON.stringify(states, null, 2), "utf-8");
}

// Input validation schema
const executionStateSchema = z.object({
  sessionId: z.string().min(1),
  state: z.object({
    id: z.string().min(1),
    timestamp: z.number(),
    type: z.enum(['reasoning', 'code-generation', 'tool-execution']),
    status: z.enum(['in-progress', 'paused', 'completed', 'failed']),
    lastExecutionPoint: z.string(),
    context: z.record(z.any()),
    toolState: z.record(z.any()).optional(),
    errorMessage: z.string().optional(),
    metadata: z.record(z.any()).optional(),
  }),
});

// Batch save schema
const batchSaveSchema = z.object({
  sessions: z.array(
    z.object({
      sessionId: z.string().min(1),
      states: z.array(z.any()),
    })
  ),
});

// POST handler - save execution state
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = executionStateSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid execution state data", details: validation.error.format() },
        { status: 400 }
      );
    }
    
    const { sessionId, state } = validation.data;
    
    // Load existing states
    const states = await loadSessionStates(sessionId);
    
    // Check for duplicate ID
    const existingIndex = states.findIndex(s => s.id === state.id);
    if (existingIndex !== -1) {
      // Update existing state
      states[existingIndex] = state;
    } else {
      // Add new state
      states.push(state);
    }
    
    // Save states
    await saveSessionStates(sessionId, states);
    
    return NextResponse.json({
      success: true,
      message: "Execution state saved successfully",
      stateId: state.id
    });
  } catch (error) {
    console.error("Error saving execution state:", error);
    return NextResponse.json(
      { error: "Failed to save execution state" },
      { status: 500 }
    );
  }
}

// PUT handler - update execution state
export async function PUT(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const stateId = url.searchParams.get("id");
    
    if (!stateId) {
      return NextResponse.json(
        { error: "State ID is required" },
        { status: 400 }
      );
    }
    
    const body = await request.json();
    const validation = executionStateSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid execution state data", details: validation.error.format() },
        { status: 400 }
      );
    }
    
    const { sessionId, state } = validation.data;
    
    // Ensure the state ID matches the URL parameter
    if (state.id !== stateId) {
      return NextResponse.json(
        { error: "State ID in body does not match URL parameter" },
        { status: 400 }
      );
    }
    
    // Load existing states
    const states = await loadSessionStates(sessionId);
    
    // Find the state to update
    const stateIndex = states.findIndex(s => s.id === stateId);
    if (stateIndex === -1) {
      return NextResponse.json(
        { error: "Execution state not found" },
        { status: 404 }
      );
    }
    
    // Update the state
    states[stateIndex] = state;
    
    // Save states
    await saveSessionStates(sessionId, states);
    
    return NextResponse.json({
      success: true,
      message: "Execution state updated successfully",
      stateId: state.id
    });
  } catch (error) {
    console.error("Error updating execution state:", error);
    return NextResponse.json(
      { error: "Failed to update execution state" },
      { status: 500 }
    );
  }
}

// GET handler - retrieve execution state(s)
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("sessionId");
    const stateId = url.searchParams.get("id");
    
    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }
    
    // Load states for the session
    const states = await loadSessionStates(sessionId);
    
    if (stateId) {
      // Return specific state
      const state = states.find(s => s.id === stateId);
      if (!state) {
        return NextResponse.json(
          { error: "Execution state not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(state);
    }
    
    // Return all states for the session, sorted by timestamp (newest first)
    const sortedStates = states.sort((a, b) => b.timestamp - a.timestamp);
    return NextResponse.json(sortedStates);
  } catch (error) {
    console.error("Error retrieving execution state:", error);
    return NextResponse.json(
      { error: "Failed to retrieve execution state" },
      { status: 500 }
    );
  }
}

// Handle batch save of states
export async function POST_batch(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = batchSaveSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid batch save data", details: validation.error.format() },
        { status: 400 }
      );
    }
    
    const { sessions } = validation.data;
    
    // Process each session
    const results = await Promise.all(
      sessions.map(async ({ sessionId, states }) => {
        try {
          // Load existing states
          const existingStates = await loadSessionStates(sessionId);
          
          // Merge states, with new states overwriting existing ones by ID
          const stateMap = new Map();
          
          // Add existing states to map
          existingStates.forEach(state => {
            stateMap.set(state.id, state);
          });
          
          // Add/update with new states
          states.forEach(state => {
            stateMap.set(state.id, state);
          });
          
          // Convert map back to array
          const mergedStates = Array.from(stateMap.values());
          
          // Save merged states
          await saveSessionStates(sessionId, mergedStates);
          
          return {
            sessionId,
            success: true,
            stateCount: mergedStates.length
          };
        } catch (error) {
          console.error(`Error processing session ${sessionId}:`, error);
          return {
            sessionId,
            success: false,
            error: (error as Error).message
          };
        }
      })
    );
    
    return NextResponse.json({
      success: true,
      message: "Batch save completed",
      results
    });
  } catch (error) {
    console.error("Error in batch save:", error);
    return NextResponse.json(
      { error: "Failed to process batch save" },
      { status: 500 }
    );
  }
} 
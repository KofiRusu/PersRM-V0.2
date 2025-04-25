import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from "zod";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

// Define schema for validation
const componentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  code: z.string(),
  type: z.enum(["component", "route"]),
  sourceData: z.object({
    prompt: z.string().optional(),
    schema: z.string().optional(),
    modelName: z.string().optional(),
  }).optional(),
});

// Helper to ensure library directory exists
function ensureLibraryDir() {
  const libraryPath = path.join(process.cwd(), 'data', 'library');
  if (!fs.existsSync(libraryPath)) {
    fs.mkdirSync(libraryPath, { recursive: true });
  }
  return libraryPath;
}

// Get all components from the library
export async function GET() {
  try {
    const libraryPath = ensureLibraryDir();
    const files = fs.readdirSync(libraryPath);
    
    const components = files
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const filePath = path.join(libraryPath, file);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(fileContent);
      });
    
    return NextResponse.json({ components });
  } catch (error) {
    console.error('Error reading component library:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve components' },
      { status: 500 }
    );
  }
}

// Save a component to the library
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate the request body
    const validation = componentSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.format() },
        { status: 400 }
      );
    }
    
    const component = validation.data;
    
    // Add timestamp and ID
    const componentData = {
      ...component,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
    };
    
    // Save to file system
    const libraryPath = ensureLibraryDir();
    const fileName = `${componentData.id}.json`;
    const filePath = path.join(libraryPath, fileName);
    
    fs.writeFileSync(filePath, JSON.stringify(componentData, null, 2));
    
    return NextResponse.json({
      success: true,
      message: 'Component saved successfully',
      component: componentData,
    });
  } catch (error) {
    console.error('Error saving component:', error);
    return NextResponse.json(
      { error: 'Failed to save component' },
      { status: 500 }
    );
  }
} 
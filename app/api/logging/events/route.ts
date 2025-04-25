import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { EventData } from '@/app/common/retention';

// Initialize Prisma client
const prisma = new PrismaClient();

interface LogEventRequest {
  events: EventData[];
  sessionId: number;
}

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body: LogEventRequest = await request.json();
    
    if (!body.events || !Array.isArray(body.events) || !body.sessionId) {
      return NextResponse.json(
        { error: 'Invalid request format. Events array and sessionId are required.' },
        { status: 400 }
      );
    }

    // Process each event
    const results = await Promise.all(
      body.events.map(async (event) => {
        const { eventType, timestamp, metadata } = event;
        
        // Save to database
        const savedEvent = await prisma.event.create({
          data: {
            eventType,
            timestamp: new Date(timestamp),
            sessionId: String(body.sessionId),
            metadata: metadata ? JSON.stringify(metadata) : null,
          },
        });

        return {
          id: savedEvent.id,
          eventType: savedEvent.eventType,
          timestamp: savedEvent.timestamp,
        };
      })
    );

    return NextResponse.json({
      success: true,
      message: `Successfully logged ${results.length} events`,
      eventIds: results.map(r => r.id),
    });
  } catch (error) {
    console.error('Error logging events:', error);
    return NextResponse.json(
      { error: 'Failed to log events', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// For debugging/admin purposes
export async function GET(request: NextRequest) {
  try {
    // Only available in development mode
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json(
        { error: 'This endpoint is only available in development mode' },
        { status: 403 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const eventType = searchParams.get('eventType');
    const sessionId = searchParams.get('sessionId');
    const limit = parseInt(searchParams.get('limit') || '100');

    // Build query
    const where: any = {};
    if (eventType) where.eventType = eventType;
    if (sessionId) where.sessionId = sessionId;

    // Query events
    const events = await prisma.event.findMany({
      where,
      orderBy: {
        timestamp: 'desc',
      },
      take: Math.min(limit, 500), // Cap at 500 max
    });

    // Transform results
    const results = events.map(event => ({
      id: event.id,
      eventType: event.eventType,
      timestamp: event.timestamp,
      sessionId: event.sessionId,
      metadata: event.metadata ? JSON.parse(event.metadata as string) : null,
    }));

    return NextResponse.json({
      events: results,
      count: results.length,
    });
  } catch (error) {
    console.error('Error retrieving events:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve events', details: (error as Error).message },
      { status: 500 }
    );
  }
} 
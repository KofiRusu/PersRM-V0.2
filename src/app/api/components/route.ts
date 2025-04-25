import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    // Get components with related tags
    const components = await prisma.component.findMany({
      include: {
        tags: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ 
      components: components.map(component => ({
        id: component.id,
        name: component.name,
        description: component.description,
        createdAt: component.createdAt,
        updatedAt: component.updatedAt,
        sourceType: component.sourceType,
        tags: component.tags,
      }))
    });
  } catch (error) {
    console.error('Error fetching components:', error);
    return NextResponse.json(
      { error: 'Failed to fetch components' },
      { status: 500 }
    );
  }
} 
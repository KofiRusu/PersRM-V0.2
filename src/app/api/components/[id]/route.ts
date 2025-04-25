import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

interface Params {
  params: {
    id: string;
  };
}

// Get component by ID
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const id = params.id;
    
    const component = await prisma.component.findUnique({
      where: { id },
      include: {
        tags: true,
        versions: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });
    
    if (!component) {
      return NextResponse.json(
        { error: 'Component not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ component });
  } catch (error) {
    console.error('Error fetching component:', error);
    return NextResponse.json(
      { error: 'Failed to fetch component' },
      { status: 500 }
    );
  }
}

// Update component
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const id = params.id;
    const { name, description, tags } = await req.json();
    
    // Basic validation
    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }
    
    // Get existing component
    const existingComponent = await prisma.component.findUnique({
      where: { id },
      include: { tags: true },
    });
    
    if (!existingComponent) {
      return NextResponse.json(
        { error: 'Component not found' },
        { status: 404 }
      );
    }
    
    // Update component
    const updatedComponent = await prisma.component.update({
      where: { id },
      data: {
        name,
        description,
        // Handle tags if provided
        ...(tags && {
          tags: {
            // Disconnect all existing tags
            disconnect: existingComponent.tags.map(tag => ({ id: tag.id })),
            // Connect or create new tags
            connectOrCreate: tags.map((tagName: string) => ({
              where: { name: tagName },
              create: { name: tagName },
            })),
          },
        }),
      },
      include: {
        tags: true,
      },
    });
    
    return NextResponse.json({ component: updatedComponent });
  } catch (error) {
    console.error('Error updating component:', error);
    return NextResponse.json(
      { error: 'Failed to update component' },
      { status: 500 }
    );
  }
}

// Delete component
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const id = params.id;
    
    // Check if component exists
    const component = await prisma.component.findUnique({
      where: { id },
    });
    
    if (!component) {
      return NextResponse.json(
        { error: 'Component not found' },
        { status: 404 }
      );
    }
    
    // Delete component (versions will be deleted via cascade)
    await prisma.component.delete({
      where: { id },
    });
    
    return NextResponse.json({
      success: true,
      message: 'Component deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting component:', error);
    return NextResponse.json(
      { error: 'Failed to delete component' },
      { status: 500 }
    );
  }
} 
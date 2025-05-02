// migrate-comment-permissions.js
// Run with: node prisma/migrations/migrate-comment-permissions.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting comment permissions migration...');
  
  // 1. Migrate existing visibility values
  console.log('Migrating visibility values...');
  
  // Map old visibility values to new enum values
  const visibilityMapping = {
    'VISIBLE': 'PUBLIC',
    'HIDDEN': 'HIDDEN',
    'PRIVATE': 'PRIVATE',
  };
  
  // Get all comments
  const comments = await prisma.comment.findMany();
  console.log(`Found ${comments.length} comments to migrate`);
  
  // Update each comment
  for (const comment of comments) {
    const oldVisibility = comment.visibility;
    const newVisibility = visibilityMapping[oldVisibility] || 'PUBLIC';
    
    await prisma.comment.update({
      where: { id: comment.id },
      data: { 
        visibility: newVisibility,
        // Ensure deleted is set to false for all existing comments
        deleted: false,
      },
    });
  }
  
  console.log('Visibility migration completed');
  
  // 2. Add ADMIN role to the first user (optional)
  console.log('Setting up admin user...');
  const firstUser = await prisma.user.findFirst({
    orderBy: { createdAt: 'asc' },
  });
  
  if (firstUser) {
    await prisma.user.update({
      where: { id: firstUser.id },
      data: { role: 'ADMIN' },
    });
    console.log(`User ${firstUser.name || firstUser.id} set as ADMIN`);
  } else {
    console.log('No users found to set as admin');
  }
  
  console.log('Migration completed successfully');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Migration failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  }); 
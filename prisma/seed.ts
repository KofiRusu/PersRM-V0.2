// Add this function to seed recurring tasks
async function seedRecurringTasks() {
  console.log('Seeding recurring tasks...');
  
  // Get existing tasks to add recurrence to
  const tasks = await prisma.task.findMany({
    take: 3,
    orderBy: { createdAt: 'desc' },
  });
  
  if (tasks.length === 0) {
    console.log('No tasks found for adding recurrence');
    return;
  }
  
  // Create a daily recurrence
  await prisma.taskRecurrence.create({
    data: {
      pattern: 'DAILY',
      interval: 1,
      tasks: {
        connect: { id: tasks[0].id }
      }
    }
  });
  
  // Create a weekly recurrence
  if (tasks.length > 1) {
    await prisma.taskRecurrence.create({
      data: {
        pattern: 'WEEKLY',
        interval: 1,
        tasks: {
          connect: { id: tasks[1].id }
        }
      }
    });
  }
  
  // Create a monthly recurrence with end date
  if (tasks.length > 2) {
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 6); // End 6 months from now
    
    await prisma.taskRecurrence.create({
      data: {
        pattern: 'MONTHLY',
        interval: 2, // Every 2 months
        endsAt: endDate,
        tasks: {
          connect: { id: tasks[2].id }
        }
      }
    });
  }
  
  console.log(`Added recurrence to ${Math.min(tasks.length, 3)} tasks`);
}

// Add this function to update tasks with due dates for calendar testing
async function updateTasksWithDueDates() {
  console.log('Updating tasks with due dates for calendar testing...');
  
  // Get existing tasks
  const tasks = await prisma.task.findMany({
    take: 10, // Get 10 tasks to update
    orderBy: { createdAt: 'desc' },
  });
  
  if (tasks.length === 0) {
    console.log('No tasks found for adding due dates');
    return;
  }
  
  // Current date
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  // Update tasks with various due dates throughout the current month
  const updates = tasks.map((task, index) => {
    // Create an array of dates spread across the current month
    const day = Math.min(index * 3 + 1, 28); // Ensure we don't go beyond 28 for simplicity (every 3 days)
    const dueDate = new Date(currentYear, currentMonth, day);
    
    // If it's one of the first 3 tasks and has a recurrence, keep the recurrence
    // Otherwise, ensure no recurrence for the other tasks to avoid confusion
    const updateData: any = {
      dueDate,
    };
    
    return prisma.task.update({
      where: { id: task.id },
      data: updateData,
    });
  });
  
  await Promise.all(updates);
  console.log(`Updated ${tasks.length} tasks with due dates`);
}

// Add this function to seed comments if the file doesn't already have it
async function seedComments() {
  console.log('Seeding comments...');

  // Get some existing tasks
  const tasks = await prisma.task.findMany({
    take: 5
  });

  // Get demo user
  const demoUser = await prisma.user.findFirst({
    where: {
      email: 'demo@example.com'
    }
  });

  if (!demoUser) {
    console.log('Demo user not found, skipping comment seeding');
    return;
  }

  const commentContents = [
    "Started working on this. Will update with progress soon.",
    "This task is more complex than I initially thought. Need to break it down further.",
    "Completed the first milestone. Moving on to the next part.",
    "Had a discussion with the team about this task. We decided to change the approach.",
    "Running into some technical issues with this task. Will need some help.",
    "Great progress today! Almost finished with this task.",
    "This task is blocked by dependencies. Waiting on task #123 to be completed.",
    "Just updated the documentation for this task.",
    "Merged the changes for this task. Ready for review.",
    "All tests are passing. Ready to mark this as complete."
  ];

  const commentPromises = tasks.flatMap(task => {
    // Create 2-4 comments per task
    const commentCount = Math.floor(Math.random() * 3) + 2;
    
    return Array.from({ length: commentCount }, async (_, i) => {
      const content = commentContents[Math.floor(Math.random() * commentContents.length)];
      const createdAt = new Date(Date.now() - Math.floor(Math.random() * 10 * 24 * 60 * 60 * 1000)); // Random date within last 10 days
      const isPrivate = Math.random() > 0.8; // 20% chance of being private
      
      return prisma.comment.create({
        data: {
          taskId: task.id,
          userId: demoUser.id,
          content,
          createdAt,
          updatedAt: createdAt,
          visibility: isPrivate ? 'PRIVATE' : 'PUBLIC',
          edited: Math.random() > 0.8, // 20% chance of being edited
        }
      });
    });
  });

  await Promise.all(commentPromises);
  console.log('Comments seeded successfully');
}

// Add a function to seed task activities for monitor testing
async function seedTaskActivities() {
  console.log('Seeding task activities for monitor...');

  // Get existing tasks
  const tasks = await prisma.task.findMany({
    take: 5,
    include: {
      user: true
    }
  });

  if (tasks.length === 0) {
    console.log('No tasks found for activity seeding');
    return;
  }

  // Activity types to seed
  const activityTypes = [
    'COMMENT_ADDED',
    'STATUS_CHANGED',
    'TASK_UPDATED',
    'SUBTASK_COMPLETED',
    'ATTACHMENT_ADDED',
    'USER_ASSIGNED'
  ];

  // Create some activities
  const activityPromises = tasks.flatMap(task => {
    // Create 2-4 activities per task
    const activityCount = Math.floor(Math.random() * 3) + 2;
    
    return Array.from({ length: activityCount }, async (_, i) => {
      const type = activityTypes[Math.floor(Math.random() * activityTypes.length)];
      const createdAt = new Date(Date.now() - Math.floor(Math.random() * 48 * 60 * 60 * 1000)); // Random date within last 48 hours
      
      let details: any = {};
      
      // Add specific details based on activity type
      switch (type) {
        case 'COMMENT_ADDED':
          details = {
            commentId: `comment-${Math.random().toString(36).substring(2, 9)}`,
            content: 'This is a sample comment for testing the monitor.'
          };
          break;
          
        case 'STATUS_CHANGED':
          details = {
            oldStatus: 'PENDING',
            newStatus: ['IN_PROGRESS', 'COMPLETED', 'BLOCKED'][Math.floor(Math.random() * 3)]
          };
          break;
          
        case 'SUBTASK_COMPLETED':
          details = {
            subtaskId: `subtask-${Math.random().toString(36).substring(2, 9)}`,
            subtaskTitle: `Sample subtask ${i + 1}`
          };
          break;
          
        case 'ATTACHMENT_ADDED':
          details = {
            attachmentId: `attachment-${Math.random().toString(36).substring(2, 9)}`,
            fileName: `sample-file-${i + 1}.pdf`,
            fileSize: Math.floor(Math.random() * 1000) + 100
          };
          break;
          
        case 'USER_ASSIGNED':
          details = {
            assignedUserId: task.userId,
            assignedUserName: task.user?.name || 'Unknown User'
          };
          break;
      }
      
      return prisma.taskActivity.create({
        data: {
          taskId: task.id,
          userId: task.userId,
          type,
          details: JSON.stringify(details),
          createdAt
        }
      });
    });
  });

  await Promise.all(activityPromises);
  console.log('Task activities seeded successfully');
}

// Update your main seed function
async function main() {
  // ... existing seed functions ...
  
  // Add seedRecurringTasks to your main function
  await seedRecurringTasks();
  await updateTasksWithDueDates();
  await seedComments();
  await seedTaskActivities();
} 
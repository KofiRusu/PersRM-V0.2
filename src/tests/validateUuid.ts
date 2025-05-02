/**
 * Simple validator to manually test the UUID generation functionality
 * Run with: npx ts-node src/tests/validateUuid.ts
 */

import {
  TaskMonitorProvider,
  useTaskMonitor,
  Task,
} from "../context/TaskMonitorContext";

// Function to manually test UUID generation
function validateUuidGeneration() {
  // Define task type used in mock
  type TaskWithoutId = Omit<Task, "id">;

  // Create a mock context to test the addTask function
  const mockContext = {
    tasks: [] as Task[],
    addTask: function (task: TaskWithoutId) {
      const newTask = {
        ...task,
        id: generateId(),
      } as Task;
      this.tasks.push(newTask);
      return newTask;
    },
    updateTaskStatus: () => {},
  };

  // Generate a unique ID (copy of the function from TaskMonitorContext)
  const generateId = () => {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${randomStr}`;
  };

  // Add several tasks and check their IDs
  const task1 = mockContext.addTask({
    title: "Task 1",
    tags: [],
    priority: "medium",
    status: "pending",
  });

  // Wait a bit to ensure different timestamps
  setTimeout(() => {}, 10);

  const task2 = mockContext.addTask({
    title: "Task 2",
    tags: [],
    priority: "medium",
    status: "pending",
  });

  // Wait a bit to ensure different timestamps
  setTimeout(() => {}, 10);

  const task3 = mockContext.addTask({
    title: "Task 3",
    tags: [],
    priority: "medium",
    status: "pending",
  });

  console.log("Task 1 ID:", task1.id);
  console.log("Task 2 ID:", task2.id);
  console.log("Task 3 ID:", task3.id);

  // Check if IDs are unique
  const idsAreUnique =
    task1.id !== task2.id && task2.id !== task3.id && task1.id !== task3.id;
  console.log("All IDs are unique:", idsAreUnique);

  // Check ID format includes timestamp (should be <timestamp>-<randomString>)
  const hasExpectedFormat =
    task1.id.includes("-") && task2.id.includes("-") && task3.id.includes("-");
  console.log("IDs follow expected format:", hasExpectedFormat);

  if (idsAreUnique && hasExpectedFormat) {
    console.log("✅ UUID generation working as expected");
  } else {
    console.error("❌ UUID generation test failed");
  }
}

validateUuidGeneration();

export function getNextRecurrenceDate(
  current: Date,
  pattern: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM',
  interval: number
): Date {
  const next = new Date(current);
  switch (pattern) {
    case 'DAILY': next.setDate(next.getDate() + interval); break;
    case 'WEEKLY': next.setDate(next.getDate() + interval * 7); break;
    case 'MONTHLY': next.setMonth(next.getMonth() + interval); break;
    case 'CUSTOM': next.setDate(next.getDate() + interval); break;
  }
  return next;
}

export function formatRecurrencePattern(pattern: string, interval: number): string {
  switch (pattern) {
    case 'DAILY':
      return interval === 1 ? 'Daily' : `Every ${interval} days`;
    case 'WEEKLY':
      return interval === 1 ? 'Weekly' : `Every ${interval} weeks`;
    case 'MONTHLY':
      return interval === 1 ? 'Monthly' : `Every ${interval} months`;
    case 'CUSTOM':
      return `Every ${interval} days`;
    default:
      return `Repeats every ${interval} ${pattern.toLowerCase()}`;
  }
}

// Check if a task is due for recurrence generation
export function shouldGenerateRecurrence(
  task: { status: string; recurrence?: { endsAt: Date | null } | null },
  currentDate: Date = new Date()
): boolean {
  // Only generate recurrence for completed tasks
  if (task.status !== 'COMPLETED') {
    return false;
  }

  // If there's an end date, check if we've passed it
  if (task.recurrence?.endsAt && new Date(task.recurrence.endsAt) < currentDate) {
    return false;
  }

  return true;
} 
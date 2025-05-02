import { router } from '../trpc';
import { tasksRouter } from './tasks';
import { reasoningRouter } from './reasoning';
import { analyzerRouter } from './analyzer';
import { dashboardRouter } from './dashboard';
import { labelsRouter } from './labels';
import { subtasksRouter } from './subtasks';
import { commentsRouter } from './comments';
import { attachmentsRouter } from './attachments';
import { activityRouter } from './activity';
import { dependenciesRouter } from './dependencies';
import { remindersRouter } from './reminders';
import { recurrenceRouter } from './recurrence';

export const appRouter = router({
  tasks: tasksRouter,
  reasoning: reasoningRouter,
  analyzer: analyzerRouter,
  dashboard: dashboardRouter,
  labels: labelsRouter,
  subtasks: subtasksRouter,
  comments: commentsRouter,
  attachments: attachmentsRouter,
  activity: activityRouter,
  dependencies: dependenciesRouter,
  reminders: remindersRouter,
  recurrence: recurrenceRouter,
});

export type AppRouter = typeof appRouter; 
import { TaskMonitor } from '@/components/monitor/TaskMonitor';

export default function MonitorPage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Task Monitor</h1>
      <p className="text-muted-foreground mb-6">
        Monitor real-time task activity, active tasks, and user engagement.
      </p>
      
      <div className="grid md:grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-3">
          <TaskMonitor />
        </div>
      </div>
    </div>
  );
} 
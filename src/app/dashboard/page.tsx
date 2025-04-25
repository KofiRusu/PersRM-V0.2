import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, BarChart2, Activity, Users } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Dashboard | PersLM',
  description: 'Analytics dashboard for PersLM',
};

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Analytics and insights for PersLM
        </p>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Assistant Analytics
            </CardTitle>
            <BarChart2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              View usage analytics for the reasoning assistant
            </div>
            <div className="mt-4">
              <Link href="/dashboard/assistant-analytics">
                <Button variant="outline" size="sm" className="gap-1">
                  View Analytics <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Usage Activity
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              View overall usage activity and performance metrics
            </div>
            <div className="mt-4">
              <Button variant="outline" size="sm" className="gap-1" disabled>
                Coming Soon <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              User Analytics
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              View user engagement and satisfaction metrics
            </div>
            <div className="mt-4">
              <Button variant="outline" size="sm" className="gap-1" disabled>
                Coming Soon <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 
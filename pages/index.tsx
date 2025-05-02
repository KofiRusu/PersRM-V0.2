import { useEffect } from 'react';
import { useRouter } from 'next/router';
import MainPage from '@/components/task-monitor/MainPage';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Try redirecting to /app in case there's an issue with direct app routes
    router.push('/app');
  }, [router]);

  // Still render MainPage in case redirect doesn't work
  return <MainPage />;
} 
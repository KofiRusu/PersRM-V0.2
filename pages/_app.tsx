import '../styles/globals.css';
import { TaskMonitorProvider } from '@/context/TaskMonitorContext';
import type { AppProps } from 'next/app';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <TaskMonitorProvider>
      <Component {...pageProps} />
    </TaskMonitorProvider>
  );
} 
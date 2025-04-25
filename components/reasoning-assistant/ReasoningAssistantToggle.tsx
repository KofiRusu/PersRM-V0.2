import React from 'react';
import { useReasoningAssistant } from './ReasoningAssistantProvider';

interface ReasoningAssistantToggleProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const ReasoningAssistantToggle: React.FC<ReasoningAssistantToggleProps> = ({
  children,
  fallback = null
}) => {
  const { isOpen } = useReasoningAssistant();

  // If assistant is open, render children, otherwise render fallback (if provided)
  return isOpen ? <>{children}</> : <>{fallback}</>;
};

export default ReasoningAssistantToggle; 
"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Info } from "lucide-react";
import { useReasoningAssistant } from "./ReasoningAssistantProvider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ToggleReasoningAssistantButtonProps {
  className?: string;
  variant?: "default" | "secondary" | "outline" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

export default function ToggleReasoningAssistantButton({
  className,
  variant = "outline",
  size = "icon"
}: ToggleReasoningAssistantButtonProps) {
  const { isVisible, toggleVisibility } = useReasoningAssistant();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={variant}
            size={size}
            className={className}
            onClick={() => toggleVisibility('button')}
            aria-label={isVisible ? "Hide reasoning assistant" : "Show reasoning assistant"}
          >
            <Info className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {isVisible ? "Hide reasoning assistant" : "Show reasoning assistant"}
            <span className="ml-2 text-xs opacity-70">(⌘+K)</span>
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
} 
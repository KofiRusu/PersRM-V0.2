"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import ReasoningDevAssistant from "./ReasoningDevAssistant";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

interface Session {
  id: string;
  name: string;
  createdAt: string;
  isShared: boolean;
}

interface ReasoningAssistantContextType {
  isVisible: boolean;
  toggleVisibility: (source?: 'keyboard' | 'button') => void;
  sessionId: string;
  sessions: Session[];
  currentSession: Session;
  createSession: (name: string, isShared?: boolean) => void;
  switchSession: (sessionId: string) => void;
  renameSession: (sessionId: string, newName: string) => void;
  deleteSession: (sessionId: string) => void;
  toggleSessionSharing: (sessionId: string) => void;
}

const ReasoningAssistantContext = createContext<ReasoningAssistantContextType | undefined>(undefined);

export function useReasoningAssistant() {
  const context = useContext(ReasoningAssistantContext);
  if (context === undefined) {
    throw new Error("useReasoningAssistant must be used within a ReasoningAssistantProvider");
  }
  return context;
}

// Animation variants for A/B testing
const ANIMATION_VARIANTS = ["slide-fade", "zoom-bounce", "none"];

interface ReasoningAssistantProviderProps {
  children: React.ReactNode;
  defaultVisible?: boolean;
}

export function ReasoningAssistantProvider({
  children,
  defaultVisible = false
}: ReasoningAssistantProviderProps) {
  const [isVisible, setIsVisible] = useState(defaultVisible);
  const [animationVariant] = useState(() => {
    // Assign a random animation variant for A/B testing
    return ANIMATION_VARIANTS[Math.floor(Math.random() * ANIMATION_VARIANTS.length)];
  });
  
  // Sessions management
  const [sessions, setSessions] = useState<Session[]>(() => {
    // Initialize with stored sessions or create a default one
    if (typeof window !== 'undefined') {
      const storedSessions = localStorage.getItem("reasoningAssistantSessions");
      if (storedSessions) {
        return JSON.parse(storedSessions);
      }
    }
    
    const defaultSession: Session = {
      id: uuidv4(),
      name: "My Session",
      createdAt: new Date().toISOString(),
      isShared: false
    };
    
    return [defaultSession];
  });
  
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => {
    // Get last used session from localStorage or use the first one
    if (typeof window !== 'undefined') {
      const storedSessionId = localStorage.getItem("reasoningAssistantCurrentSession");
      if (storedSessionId && sessions.some(s => s.id === storedSessionId)) {
        return storedSessionId;
      }
    }
    
    return sessions[0]?.id || "";
  });
  
  // Track when the assistant was opened for duration measurement
  const openTimeRef = useRef<number | null>(null);
  
  // Automatically save sessions to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined' && sessions.length > 0) {
      localStorage.setItem("reasoningAssistantSessions", JSON.stringify(sessions));
    }
  }, [sessions]);
  
  // Save current session ID whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && currentSessionId) {
      localStorage.setItem("reasoningAssistantCurrentSession", currentSessionId);
    }
  }, [currentSessionId]);
  
  useEffect(() => {
    // Check if there's a saved preference in localStorage
    const savedVisibility = localStorage.getItem("reasoningAssistantVisible");
    if (savedVisibility !== null) {
      setIsVisible(savedVisibility === "true");
    }
  }, []);
  
  // Get current session object
  const currentSession = sessions.find(s => s.id === currentSessionId) || sessions[0] || {
    id: "",
    name: "Default Session",
    createdAt: new Date().toISOString(),
    isShared: false
  };

  // Session management functions
  const createSession = (name: string, isShared: boolean = false) => {
    const newSession: Session = {
      id: uuidv4(),
      name,
      createdAt: new Date().toISOString(),
      isShared
    };
    
    setSessions(prev => [...prev, newSession]);
    setCurrentSessionId(newSession.id);
    toast.success(`Created new session: ${name}`);
    
    // Log session creation
    logSessionEvent("create", newSession.id);
  };
  
  const switchSession = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setCurrentSessionId(sessionId);
      toast.success(`Switched to session: ${session.name}`);
      
      // Log session switch
      logSessionEvent("switch", sessionId);
    }
  };
  
  const renameSession = (sessionId: string, newName: string) => {
    setSessions(prev => 
      prev.map(session => 
        session.id === sessionId 
          ? { ...session, name: newName }
          : session
      )
    );
    toast.success(`Renamed session to: ${newName}`);
    
    // Log session rename
    logSessionEvent("rename", sessionId);
  };
  
  const deleteSession = (sessionId: string) => {
    const sessionToDelete = sessions.find(s => s.id === sessionId);
    if (!sessionToDelete) return;
    
    // Don't allow deleting the last session
    if (sessions.length <= 1) {
      toast.error("Cannot delete the only session");
      return;
    }
    
    setSessions(prev => prev.filter(session => session.id !== sessionId));
    
    // If deleting current session, switch to another one
    if (currentSessionId === sessionId) {
      const remainingSessions = sessions.filter(s => s.id !== sessionId);
      setCurrentSessionId(remainingSessions[0].id);
    }
    
    toast.success(`Deleted session: ${sessionToDelete.name}`);
    
    // Log session deletion
    logSessionEvent("delete", sessionId);
  };
  
  const toggleSessionSharing = (sessionId: string) => {
    setSessions(prev => 
      prev.map(session => {
        if (session.id === sessionId) {
          const newSharedState = !session.isShared;
          
          // Log session sharing toggle
          logSessionEvent(newSharedState ? "share" : "unshare", sessionId);
          
          return { ...session, isShared: newSharedState };
        }
        return session;
      })
    );
  };

  // Log toggle events to the API
  const logToggleEvent = async (action: "open" | "close", source: string = "button") => {
    try {
      // Calculate duration if closing
      let duration = null;
      if (action === "close" && openTimeRef.current) {
        duration = Math.floor((Date.now() - openTimeRef.current) / 1000); // in seconds
      }
      
      await fetch("/api/assistant-log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          source,
          variant: animationVariant,
          sessionId: currentSessionId,
          duration,
          metadata: {
            timestamp: new Date().toISOString(),
            url: typeof window !== 'undefined' ? window.location.pathname : null
          }
        }),
      });
      
      // Update openTimeRef for duration tracking
      if (action === "open") {
        openTimeRef.current = Date.now();
      } else {
        openTimeRef.current = null;
      }
    } catch (error) {
      console.error("Failed to log assistant toggle event:", error);
    }
  };
  
  // Log session events to the API
  const logSessionEvent = async (action: "create" | "switch" | "rename" | "delete" | "share" | "unshare", sessionId: string) => {
    try {
      await fetch("/api/session-log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          sessionId,
          metadata: {
            timestamp: new Date().toISOString(),
            url: typeof window !== 'undefined' ? window.location.pathname : null
          }
        }),
      });
    } catch (error) {
      console.error("Failed to log session event:", error);
    }
  };

  const toggleVisibility = (source: 'keyboard' | 'button' = 'button') => {
    const newVisibility = !isVisible;
    setIsVisible(newVisibility);
    
    // Save preference to localStorage
    localStorage.setItem("reasoningAssistantVisible", newVisibility.toString());
    
    // Log the toggle event
    logToggleEvent(newVisibility ? "open" : "close", source);
    
    // Show toast notification when using keyboard shortcut
    if (source === 'keyboard') {
      toast.success(
        newVisibility 
          ? "Reasoning Assistant activated" 
          : "Reasoning Assistant hidden",
        { duration: 2000 }
      );
    }
  };

  // Add keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for ⌘+K (Mac) or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault(); // Prevent default browser behavior
        toggleVisibility('keyboard');
      }
    };

    // Add event listener
    window.addEventListener('keydown', handleKeyDown);
    
    // Clean up event listener on unmount
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isVisible]); // Add isVisible to dependencies since toggleVisibility uses it

  // Context value with sessions included
  const contextValue = {
    isVisible,
    toggleVisibility,
    sessionId: currentSessionId,
    sessions,
    currentSession,
    createSession,
    switchSession,
    renameSession,
    deleteSession,
    toggleSessionSharing
  };

  return (
    <ReasoningAssistantContext.Provider value={contextValue}>
      {children}
      {isVisible && (
        <ReasoningDevAssistant 
          animationVariant={animationVariant}
          sessionId={currentSessionId}
        />
      )}
    </ReasoningAssistantContext.Provider>
  );
} 
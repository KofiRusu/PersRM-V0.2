"use client";

import React, { useEffect, useState } from "react";
import { TaskMonitorProvider } from "@/context/TaskMonitorContext";
import ChatSidebar from "./ChatSidebar";
import TaskDashboard from "./TaskDashboard";

export function MainPage() {
  // Track if the page is fully loaded for smooth transitions
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Mark as loaded after the component mounts
    setIsLoaded(true);
    
    // Log to console to verify the component is mounting
    console.log("MainPage component mounted");
  }, []);

  return (
    <main
      className={`min-h-screen bg-background text-foreground transition-opacity duration-300 ${isLoaded ? "opacity-100" : "opacity-0"}`}
    >
      <TaskMonitorProvider>
        <div className="flex flex-col md:flex-row h-screen">
          {/* Chat sidebar - collapses to full width on mobile */}
          <div className="md:sticky md:top-0 md:h-screen">
            <ChatSidebar />
          </div>

          {/* Main content area - scrollable */}
          <div className="flex-1 overflow-auto">
            <TaskDashboard />
          </div>
        </div>
      </TaskMonitorProvider>
    </main>
  );
}

export default MainPage;

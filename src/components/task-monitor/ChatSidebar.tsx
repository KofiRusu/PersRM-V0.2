"use client";

import React, { useState } from "react";
import { MessageSquare, Send } from "lucide-react";

export function ChatSidebar() {
  const [message, setMessage] = useState("");

  const handleSendMessage = () => {
    if (message.trim()) {
      // In a real app, this would send the message to an API
      console.log("Sending message:", message);
      setMessage("");
    }
  };

  return (
    <div className="w-full md:w-80 border-r border-border bg-card p-4 flex flex-col md:h-screen">
      <h2 className="text-xl font-semibold mb-4">Agent Chat</h2>

      <div className="flex items-center space-x-2 mb-6">
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
          <MessageSquare className="h-4 w-4 text-primary-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">Task Assistant</p>
          <p className="text-xs text-muted-foreground">Online</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto mb-4 border rounded-md p-3 bg-background">
        <div className="space-y-4">
          {/* Assistant's message */}
          <ChatMessage
            content="Hi there! I'm your task assistant. How can I help you manage your tasks today?"
            time="12:30 PM"
            isUser={false}
          />

          {/* User's message */}
          <ChatMessage
            content="I need to organize the UX research tasks"
            time="12:31 PM"
            isUser={true}
          />

          {/* Assistant's response */}
          <ChatMessage
            content="I'll help you with that. What's the timeline for these tasks?"
            time="12:32 PM"
            isUser={false}
          />
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="text"
          placeholder="Type a message..."
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
        />
        <button
          className="bg-primary rounded-md p-2 hover:bg-primary/90 transition-colors"
          onClick={handleSendMessage}
          aria-label="Send message"
        >
          <Send className="h-4 w-4 text-primary-foreground" />
        </button>
      </div>
    </div>
  );
}

interface ChatMessageProps {
  content: string;
  time: string;
  isUser: boolean;
}

function ChatMessage({ content, time, isUser }: ChatMessageProps) {
  return (
    <div
      className={`${isUser ? "bg-primary ml-auto" : "bg-muted"} p-3 rounded-md max-w-[80%]`}
    >
      <p className={`text-sm ${isUser ? "text-primary-foreground" : ""}`}>
        {content}
      </p>
      <span
        className={`text-xs ${isUser ? "text-primary-foreground/70" : "text-muted-foreground"} block mt-1`}
      >
        {time}
      </span>
    </div>
  );
}

export default ChatSidebar;

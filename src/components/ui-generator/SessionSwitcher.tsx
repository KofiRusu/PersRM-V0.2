"use client";

import { Check, ChevronDown, Plus, Share2, Trash2, Pencil } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useReasoningAssistant } from "./ReasoningAssistantProvider";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";

export interface SessionSwitcherProps {
  className?: string;
}

export function SessionSwitcher({ className }: SessionSwitcherProps) {
  const { 
    sessions, 
    currentSessionId, 
    switchSession, 
    createSession, 
    renameSession, 
    deleteSession, 
    toggleSessionSharing 
  } = useReasoningAssistant();
  
  const [open, setOpen] = useState(false);
  const [newSessionName, setNewSessionName] = useState("");
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [sessionToRename, setSessionToRename] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  
  const currentSession = sessions.find(session => session.id === currentSessionId);

  const handleCreateSession = () => {
    if (newSessionName.trim()) {
      createSession(newSessionName);
      setNewSessionName("");
      setOpen(false);
      toast({
        title: "Session created",
        description: `New session "${newSessionName}" has been created.`,
      });
    }
  };

  const handleRenameSession = () => {
    if (sessionToRename && newName.trim()) {
      renameSession(sessionToRename, newName);
      setRenameDialogOpen(false);
      setSessionToRename(null);
      setNewName("");
      toast({
        title: "Session renamed",
        description: `Session has been renamed to "${newName}".`,
      });
    }
  };

  const handleDeleteSession = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      deleteSession(sessionId);
      toast({
        title: "Session deleted",
        description: `Session "${session.name}" has been deleted.`,
      });
    }
  };

  const handleShareSession = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      toggleSessionSharing(sessionId);
      
      if (!session.shared) {
        // Copy session link to clipboard
        const sessionLink = `${window.location.origin}/share/session/${sessionId}`;
        navigator.clipboard.writeText(sessionLink);
        
        toast({
          title: "Session shared",
          description: "Session link copied to clipboard.",
        });
      }
    }
  };

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Select a session"
            className="w-full justify-between"
          >
            <span className="truncate">
              {currentSession?.name || "Select session"}
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[250px] p-0">
          <Command>
            <CommandList>
              <CommandInput placeholder="Search sessions..." />
              <CommandEmpty>No sessions found.</CommandEmpty>
              <CommandGroup heading="Your Sessions">
                {sessions.map((session) => (
                  <CommandItem
                    key={session.id}
                    value={session.id}
                    onSelect={() => {
                      switchSession(session.id);
                      setOpen(false);
                    }}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center">
                      {session.id === currentSessionId && (
                        <Check className="mr-2 h-4 w-4" />
                      )}
                      <span>{session.name}</span>
                      {session.shared && (
                        <Badge variant="outline" className="ml-2">
                          Shared
                        </Badge>
                      )}
                    </div>
                    <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSessionToRename(session.id);
                          setNewName(session.name);
                          setRenameDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShareSession(session.id);
                        }}
                      >
                        <Share2 className="h-3 w-3" />
                      </Button>
                      {sessions.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSession(session.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
            <CommandSeparator />
            <div className="p-2">
              <div className="flex items-center space-x-2">
                <Input
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  placeholder="New session name..."
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateSession();
                    }
                  }}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCreateSession}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Session</DialogTitle>
            <DialogDescription>
              Enter a new name for this session.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input
              id="name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="mt-1"
            />
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setRenameDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleRenameSession}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 
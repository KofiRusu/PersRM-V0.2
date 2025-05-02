import { useState, useEffect, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { trpc } from "@/app/_trpc/client";
import { Trash2, Edit, Check, X, Eye, EyeOff, ShieldAlert, Info } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/components/ui/use-toast";
import { pusherClient, CHANNELS, EVENTS } from "@/lib/pusher";
import { useSession } from "next-auth/react";
import { debounce } from "lodash";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CommentVisibility, UserRole } from "@prisma/client";

export function TaskComments({ taskId }: { taskId: string }) {
  const { toast } = useToast();
  const session = useSession();
  const [comment, setComment] = useState("");
  const [visibility, setVisibility] = useState<CommentVisibility>(CommentVisibility.PUBLIC);
  const [showHiddenComments, setShowHiddenComments] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [typingUsers, setTypingUsers] = useState<Record<string, {userName: string, timestamp: string}>>({});
  const [moderationDialogOpen, setModerationDialogOpen] = useState(false);
  const [commentToModerate, setCommentToModerate] = useState<any>(null);
  const [moderationAction, setModerationAction] = useState<'HIDE' | 'UNHIDE'>('HIDE');
  const [moderationReason, setModerationReason] = useState('');
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Get current user role
  const userRole = session.data?.user?.role as UserRole || UserRole.USER;
  const isModOrAdmin = userRole === UserRole.MODERATOR || userRole === UserRole.ADMIN;
  
  // Query to get comments
  const commentsQuery = trpc.comments.getCommentsByTaskId.useQuery(
    { taskId, includeHidden: showHiddenComments },
    {
      enabled: !!taskId,
      onError: (error) => {
        toast({
          title: "Error loading comments",
          description: error.message,
          variant: "destructive",
        });
      },
    }
  );

  // Mutations
  const utils = trpc.useContext();
  
  const createCommentMutation = trpc.comments.createComment.useMutation({
    onSuccess: () => {
      setComment("");
      utils.comments.getCommentsByTaskId.invalidate({ taskId });
      toast({
        title: "Comment added",
        description: "Your comment has been added successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error adding comment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateCommentMutation = trpc.comments.updateComment.useMutation({
    onSuccess: () => {
      setEditingCommentId(null);
      setEditingContent("");
      utils.comments.getCommentsByTaskId.invalidate({ taskId });
      toast({
        title: "Comment updated",
        description: "Your comment has been updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error updating comment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteCommentMutation = trpc.comments.deleteComment.useMutation({
    onSuccess: () => {
      utils.comments.getCommentsByTaskId.invalidate({ taskId });
      toast({
        title: "Comment deleted",
        description: "The comment has been deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error deleting comment",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const moderateCommentMutation = trpc.comments.moderateComment.useMutation({
    onSuccess: (data) => {
      utils.comments.getCommentsByTaskId.invalidate({ taskId });
      const action = data.visibility === CommentVisibility.HIDDEN ? "hidden" : "unhidden";
      toast({
        title: `Comment ${action}`,
        description: `The comment has been ${action} successfully`,
      });
      setModerationDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error moderating comment",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const sendTypingIndicatorMutation = trpc.comments.sendTypingIndicator.useMutation();

  // Setup Pusher subscription
  useEffect(() => {
    if (!taskId) return;
    
    const channel = pusherClient.subscribe(CHANNELS.TASK_COMMENTS(taskId));
    
    // Handle new comment
    channel.bind(EVENTS.NEW_COMMENT, (newComment: any) => {
      if (newComment.userId !== session.data?.user?.id) {
        utils.comments.getCommentsByTaskId.setData({ taskId, includeHidden: showHiddenComments }, (prevData) => {
          if (!prevData) return [newComment];
          return [newComment, ...prevData];
        });
      }
    });
    
    // Handle edited comment
    channel.bind(EVENTS.EDIT_COMMENT, (updatedComment: any) => {
      if (updatedComment.userId !== session.data?.user?.id) {
        utils.comments.getCommentsByTaskId.setData({ taskId, includeHidden: showHiddenComments }, (prevData) => {
          if (!prevData) return [updatedComment];
          return prevData.map(comment => 
            comment.id === updatedComment.id ? updatedComment : comment
          );
        });
      }
    });
    
    // Handle deleted comment
    channel.bind(EVENTS.DELETE_COMMENT, (deletedComment: { id: string }) => {
      utils.comments.getCommentsByTaskId.setData({ taskId, includeHidden: showHiddenComments }, (prevData) => {
        if (!prevData) return [];
        return prevData.filter(comment => comment.id !== deletedComment.id);
      });
    });
    
    // Handle moderation-deleted comment
    channel.bind(EVENTS.MOD_COMMENT_DELETED, (deletedComment: { id: string }) => {
      utils.comments.getCommentsByTaskId.setData({ taskId, includeHidden: showHiddenComments }, (prevData) => {
        if (!prevData) return [];
        return prevData.filter(comment => comment.id !== deletedComment.id);
      });
    });
    
    // Handle hidden comment
    channel.bind(EVENTS.COMMENT_HIDDEN, (hiddenComment: any) => {
      utils.comments.getCommentsByTaskId.setData({ taskId, includeHidden: showHiddenComments }, (prevData) => {
        if (!prevData) return showHiddenComments ? [hiddenComment] : [];
        
        if (!showHiddenComments) {
          return prevData.filter(comment => comment.id !== hiddenComment.id);
        } else {
          return prevData.map(comment => 
            comment.id === hiddenComment.id ? hiddenComment : comment
          );
        }
      });
    });
    
    // Handle unhidden comment
    channel.bind(EVENTS.COMMENT_UNHIDDEN, (unhiddenComment: any) => {
      utils.comments.getCommentsByTaskId.setData({ taskId, includeHidden: showHiddenComments }, (prevData) => {
        if (!prevData) return [unhiddenComment];
        return prevData.map(comment => 
          comment.id === unhiddenComment.id ? unhiddenComment : comment
        );
      });
    });
    
    // Handle typing indicator
    channel.bind(EVENTS.TYPING, (data: { userId: string, userName: string, isTyping: boolean, timestamp: string }) => {
      if (data.userId === session.data?.user?.id) return;
      
      setTypingUsers(prev => {
        if (data.isTyping) {
          return { ...prev, [data.userId]: { userName: data.userName, timestamp: data.timestamp } };
        } else {
          const newState = { ...prev };
          delete newState[data.userId];
          return newState;
        }
      });
    });
    
    return () => {
      channel.unbind_all();
      pusherClient.unsubscribe(CHANNELS.TASK_COMMENTS(taskId));
    };
  }, [taskId, utils.comments, session.data?.user?.id, showHiddenComments]);
  
  // Clean up typing indicators after 5 seconds of inactivity
  useEffect(() => {
    const now = new Date();
    const timeoutUsers = Object.entries(typingUsers).filter(([_, data]) => {
      const timeDiff = now.getTime() - new Date(data.timestamp).getTime();
      return timeDiff > 5000; // 5 seconds
    });
    
    if (timeoutUsers.length > 0) {
      setTypingUsers(prev => {
        const newState = { ...prev };
        timeoutUsers.forEach(([userId]) => {
          delete newState[userId];
        });
        return newState;
      });
    }
    
    const interval = setInterval(() => {
      setTypingUsers(prev => {
        const now = new Date();
        const newState = { ...prev };
        let changed = false;
        
        Object.entries(newState).forEach(([userId, data]) => {
          const timeDiff = now.getTime() - new Date(data.timestamp).getTime();
          if (timeDiff > 5000) { // 5 seconds
            delete newState[userId];
            changed = true;
          }
        });
        
        return changed ? newState : prev;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [typingUsers]);

  // Send typing indicator when user is typing
  const debouncedTypingIndicator = useRef(
    debounce((isTyping: boolean) => {
      if (taskId) {
        sendTypingIndicatorMutation.mutate({ taskId, isTyping });
      }
    }, 500)
  ).current;
  
  const handleCommentInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setComment(newValue);
    
    // Send typing indicator
    const isTyping = newValue.length > 0;
    debouncedTypingIndicator(isTyping);
    
    // Clear typing indicator after 2 seconds of inactivity
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    if (isTyping) {
      typingTimeoutRef.current = setTimeout(() => {
        debouncedTypingIndicator(false);
      }, 2000);
    }
  };

  // Handlers
  const handleAddComment = () => {
    if (!comment.trim()) return;
    
    debouncedTypingIndicator(false);
    createCommentMutation.mutate({
      taskId,
      content: comment,
      visibility,
    });
  };

  const handleEditComment = (id: string, currentContent: string) => {
    setEditingCommentId(id);
    setEditingContent(currentContent);
  };

  const handleUpdateComment = (id: string) => {
    if (!editingContent.trim()) return;
    
    updateCommentMutation.mutate({
      id,
      content: editingContent,
    });
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditingContent("");
  };

  const handleDeleteComment = (id: string) => {
    if (confirm("Are you sure you want to delete this comment?")) {
      deleteCommentMutation.mutate({ id });
    }
  };
  
  const handleModerateComment = (comment: any, action: 'HIDE' | 'UNHIDE') => {
    setCommentToModerate(comment);
    setModerationAction(action);
    setModerationReason('');
    setModerationDialogOpen(true);
  };
  
  const submitModeration = () => {
    if (!commentToModerate) return;
    
    moderateCommentMutation.mutate({
      commentId: commentToModerate.id,
      visibility: moderationAction === 'HIDE' ? CommentVisibility.HIDDEN : CommentVisibility.PUBLIC,
      reason: moderationReason || undefined,
    });
  };

  const toggleVisibility = () => {
    setVisibility(prev => prev === CommentVisibility.PUBLIC ? CommentVisibility.PRIVATE : CommentVisibility.PUBLIC);
  };

  return (
    <div className="space-y-6 mt-8">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Comments</h3>
        <span className="text-sm text-muted-foreground">
          {commentsQuery.data?.length || 0} comment(s)
        </span>
      </div>

      {/* Moderator controls */}
      {isModOrAdmin && (
        <div className="flex items-center space-x-2 mb-4">
          <Switch
            id="show-hidden"
            checked={showHiddenComments}
            onCheckedChange={setShowHiddenComments}
          />
          <Label htmlFor="show-hidden" className="text-sm">
            Show hidden comments
          </Label>
        </div>
      )}

      {/* Add comment */}
      <div className="space-y-2">
        <Textarea
          placeholder="Add a comment..."
          value={comment}
          onChange={handleCommentInputChange}
          className="min-h-[80px]"
        />
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleVisibility}
            className="gap-2"
          >
            {visibility === CommentVisibility.PUBLIC ? (
              <>
                <Eye className="h-4 w-4" />
                <span>Public</span>
              </>
            ) : (
              <>
                <EyeOff className="h-4 w-4" />
                <span>Private</span>
              </>
            )}
          </Button>
          <Button
            onClick={handleAddComment}
            disabled={!comment.trim() || createCommentMutation.isPending}
          >
            {createCommentMutation.isPending ? "Adding..." : "Add Comment"}
          </Button>
        </div>
      </div>
      
      {/* Typing indicators */}
      {Object.keys(typingUsers).length > 0 && (
        <div className="text-sm italic text-muted-foreground animate-pulse">
          {Object.values(typingUsers).length === 1 
            ? `${Object.values(typingUsers)[0].userName} is typing...` 
            : `${Object.values(typingUsers).length} people are typing...`}
        </div>
      )}

      {/* Comments list */}
      <div className="space-y-4">
        {commentsQuery.isLoading && (
          <>
            <CommentSkeleton />
            <CommentSkeleton />
          </>
        )}

        {commentsQuery.data?.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No comments yet. Be the first to add one!
          </div>
        )}

        {commentsQuery.data?.map((comment) => (
          <Card 
            key={comment.id} 
            className={`p-4 ${comment.visibility === CommentVisibility.HIDDEN ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800' : ''}`}
          >
            <div className="flex items-start gap-4">
              <Avatar className="h-10 w-10">
                <AvatarImage src={comment.user?.image || ""} alt={comment.user?.name || ""} />
                <AvatarFallback>
                  {comment.user?.name?.substring(0, 2) || "??"}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium">
                      {comment.user?.name || "Unknown User"}
                    </h4>
                    {comment.user?.role && comment.user.role !== 'USER' && (
                      <span className={`text-xs rounded px-1.5 py-0.5 ${
                        comment.user.role === 'ADMIN' 
                          ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                          : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                      }`}>
                        {comment.user.role}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                    </span>
                    {comment.edited && (
                      <span className="text-xs text-muted-foreground italic">
                        (edited)
                      </span>
                    )}
                    {comment.visibility === CommentVisibility.PRIVATE && (
                      <span className="text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded px-1.5 py-0.5 flex items-center gap-1">
                        <EyeOff className="h-3 w-3" />
                        Private
                      </span>
                    )}
                    {comment.visibility === CommentVisibility.HIDDEN && (
                      <span className="text-xs bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded px-1.5 py-0.5 flex items-center gap-1">
                        <ShieldAlert className="h-3 w-3" />
                        Hidden by {comment.moderatedBy?.name || 'Moderator'}
                      </span>
                    )}
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 15 15"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                        >
                          <path
                            d="M3.625 7.5C3.625 8.12132 3.12132 8.625 2.5 8.625C1.87868 8.625 1.375 8.12132 1.375 7.5C1.375 6.87868 1.87868 6.375 2.5 6.375C3.12132 6.375 3.625 6.87868 3.625 7.5ZM8.625 7.5C8.625 8.12132 8.12132 8.625 7.5 8.625C6.87868 8.625 6.375 8.12132 6.375 7.5C6.375 6.87868 6.87868 6.375 7.5 6.375C8.12132 6.375 8.625 6.87868 8.625 7.5ZM13.625 7.5C13.625 8.12132 13.1213 8.625 12.5 8.625C11.8787 8.625 11.375 8.12132 11.375 7.5C11.375 6.87868 11.8787 6.375 12.5 6.375C13.1213 6.375 13.625 6.87868 13.625 7.5Z"
                            fill="currentColor"
                            fillRule="evenodd"
                            clipRule="evenodd"
                          ></path>
                        </svg>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {/* Regular user actions - only shown if they're the author */}
                      {comment.userId === session.data?.user?.id && (
                        <>
                          <DropdownMenuItem
                            onClick={() => handleEditComment(comment.id, comment.content)}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            <span>Edit</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteComment(comment.id)}
                            className="text-red-600 dark:text-red-400"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            <span>Delete</span>
                          </DropdownMenuItem>
                        </>
                      )}
                      
                      {/* Moderator actions */}
                      {isModOrAdmin && comment.userId !== session.data?.user?.id && (
                        <>
                          {comment.visibility !== CommentVisibility.HIDDEN ? (
                            <DropdownMenuItem
                              onClick={() => handleModerateComment(comment, 'HIDE')}
                              className="text-red-600 dark:text-red-400"
                            >
                              <ShieldAlert className="mr-2 h-4 w-4" />
                              <span>Hide Comment</span>
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => handleModerateComment(comment, 'UNHIDE')}
                              className="text-green-600 dark:text-green-400"
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              <span>Unhide Comment</span>
                            </DropdownMenuItem>
                          )}
                          
                          <DropdownMenuSeparator />
                          
                          <DropdownMenuItem
                            onClick={() => handleDeleteComment(comment.id)}
                            className="text-red-600 dark:text-red-400"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            <span>Delete Comment</span>
                          </DropdownMenuItem>
                          
                          {comment.moderationReason && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-sm italic text-muted-foreground cursor-default"
                                disabled
                              >
                                <Info className="mr-2 h-4 w-4" />
                                <span>Reason: {comment.moderationReason}</span>
                              </DropdownMenuItem>
                            </>
                          )}
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {editingCommentId === comment.id ? (
                  <div className="space-y-2 mt-2">
                    <Textarea
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      className="min-h-[80px]"
                    />
                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCancelEdit}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleUpdateComment(comment.id)}
                        disabled={
                          !editingContent.trim() ||
                          updateCommentMutation.isPending
                        }
                      >
                        <Check className="mr-2 h-4 w-4" />
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 whitespace-pre-wrap">
                    {comment.content}
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
      
      {/* Moderation Dialog */}
      <Dialog open={moderationDialogOpen} onOpenChange={setModerationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {moderationAction === 'HIDE' ? 'Hide Comment' : 'Unhide Comment'}
            </DialogTitle>
            <DialogDescription>
              {moderationAction === 'HIDE' 
                ? 'This comment will be hidden from regular users but still visible to moderators.'
                : 'This comment will be made visible to all users again.'}
            </DialogDescription>
          </DialogHeader>
          
          {moderationAction === 'HIDE' && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="reason">Reason (optional)</Label>
                <Textarea
                  id="reason"
                  placeholder="Enter reason for hiding comment..."
                  value={moderationReason}
                  onChange={(e) => setModerationReason(e.target.value)}
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setModerationDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={submitModeration}
              variant={moderationAction === 'HIDE' ? 'destructive' : 'default'}
            >
              {moderationAction === 'HIDE' ? 'Hide Comment' : 'Unhide Comment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CommentSkeleton() {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-4">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    </Card>
  );
} 
import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { trpc } from '@/lib/trpc';

export interface Comment {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  author: {
    id: string;
    name: string;
    image?: string;
  };
  replies?: Comment[];
  replyCount?: number;
  parentId?: string;
}

interface CommentThreadProps {
  comments: Comment[];
  entityId: string; // ID of schema, version, etc. being commented on
  entityType: 'schema' | 'schemaVersion' | 'field' | 'review';
  fieldPath?: string; // For field-specific comments
  onCommentAdded?: (comment: Comment) => void;
  onCommentUpdated?: (comment: Comment) => void;
  onCommentDeleted?: (commentId: string) => void;
  maxDepth?: number;
  enableReplies?: boolean;
  enableEditing?: boolean;
  enableAIAssistance?: boolean;
}

export const CommentThread: React.FC<CommentThreadProps> = ({
  comments,
  entityId,
  entityType,
  fieldPath,
  onCommentAdded,
  onCommentUpdated,
  onCommentDeleted,
  maxDepth = 3,
  enableReplies = true,
  enableEditing = true,
  enableAIAssistance = false,
}) => {
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // tRPC mutations
  const addComment = trpc.comments.addComment.useMutation({
    onSuccess: (data) => {
      setNewComment('');
      setIsSubmitting(false);
      onCommentAdded?.(data);
      toast({
        title: 'Comment added',
        description: 'Your comment has been posted successfully.',
      });
    },
    onError: (error) => {
      setIsSubmitting(false);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add comment. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Handle submit new comment
  const handleSubmitComment = () => {
    if (!newComment.trim()) return;
    
    setIsSubmitting(true);
    addComment.mutate({
      content: newComment,
      entityId,
      entityType,
      fieldPath,
    });
  };

  // AI assistance for enhancing comments
  const improveComment = trpc.ai.improveComment.useMutation({
    onSuccess: (data) => {
      setNewComment(data.improvedContent);
      toast({
        title: 'Comment improved',
        description: 'AI has enhanced your comment.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to improve comment.',
        variant: 'destructive',
      });
    },
  });

  const handleImproveComment = () => {
    if (!newComment.trim()) return;
    
    improveComment.mutate({
      content: newComment,
      entityType,
      fieldPath,
    });
  };

  // Root-level comment input
  const CommentInput = () => (
    <div className="mb-6">
      <Textarea
        placeholder="Add a comment..."
        value={newComment}
        onChange={(e) => setNewComment(e.target.value)}
        className="mb-2 min-h-[100px]"
      />
      <div className="flex space-x-2 justify-end">
        {enableAIAssistance && newComment.trim().length > 0 && (
          <Button 
            variant="outline" 
            onClick={handleImproveComment}
            disabled={isSubmitting || improveComment.isLoading}
          >
            {improveComment.isLoading ? 'Improving...' : 'Improve with AI'}
          </Button>
        )}
        <Button 
          onClick={handleSubmitComment}
          disabled={isSubmitting || !newComment.trim()}
        >
          {isSubmitting ? 'Posting...' : 'Post Comment'}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="comment-thread space-y-6">
      <CommentInput />
      
      {comments.length > 0 ? (
        <div className="comments-list space-y-4">
          {comments
            .filter(comment => !comment.parentId) // Only show root comments
            .map(comment => (
              <CommentItem
                key={comment.id}
                comment={comment}
                allComments={comments}
                entityId={entityId}
                entityType={entityType}
                fieldPath={fieldPath}
                onCommentUpdated={onCommentUpdated}
                onCommentDeleted={onCommentDeleted}
                depth={0}
                maxDepth={maxDepth}
                enableReplies={enableReplies}
                enableEditing={enableEditing}
                enableAIAssistance={enableAIAssistance}
              />
            ))}
        </div>
      ) : (
        <p className="text-center text-muted-foreground py-4">
          No comments yet. Be the first to comment!
        </p>
      )}
    </div>
  );
};

interface CommentItemProps {
  comment: Comment;
  allComments: Comment[];
  entityId: string;
  entityType: string;
  fieldPath?: string;
  onCommentUpdated?: (comment: Comment) => void;
  onCommentDeleted?: (commentId: string) => void;
  depth: number;
  maxDepth: number;
  enableReplies: boolean;
  enableEditing: boolean;
  enableAIAssistance: boolean;
}

const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  allComments,
  entityId,
  entityType,
  fieldPath,
  onCommentUpdated,
  onCommentDeleted,
  depth,
  maxDepth,
  enableReplies,
  enableEditing,
  enableAIAssistance,
}) => {
  const [isReplying, setIsReplying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [editContent, setEditContent] = useState(comment.content);
  const [showReplies, setShowReplies] = useState(depth < 1); // Auto-expand first level
  const { toast } = useToast();
  
  // Get replies for this comment
  const replies = allComments.filter(c => c.parentId === comment.id);
  
  // Can we nest deeper?
  const canNestReplies = depth < maxDepth;
  
  // Is this the current user's comment? (would need auth context in real app)
  const isOwnComment = true; // TODO: Replace with actual auth check
  
  // tRPC mutations
  const addReply = trpc.comments.addComment.useMutation({
    onSuccess: (data) => {
      setReplyContent('');
      setIsReplying(false);
      onCommentUpdated?.(data);
      toast({
        title: 'Reply added',
        description: 'Your reply has been posted successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add reply. Please try again.',
        variant: 'destructive',
      });
    },
  });
  
  const updateComment = trpc.comments.updateComment.useMutation({
    onSuccess: (data) => {
      setIsEditing(false);
      onCommentUpdated?.(data);
      toast({
        title: 'Comment updated',
        description: 'Your comment has been updated successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update comment. Please try again.',
        variant: 'destructive',
      });
    },
  });
  
  const deleteComment = trpc.comments.deleteComment.useMutation({
    onSuccess: () => {
      onCommentDeleted?.(comment.id);
      toast({
        title: 'Comment deleted',
        description: 'Your comment has been deleted successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete comment. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // AI assistance for improving replies
  const improveReply = trpc.ai.improveComment.useMutation({
    onSuccess: (data) => {
      setReplyContent(data.improvedContent);
      toast({
        title: 'Reply improved',
        description: 'AI has enhanced your reply.',
      });
    },
  });

  const handleSubmitReply = () => {
    if (!replyContent.trim()) return;
    
    addReply.mutate({
      content: replyContent,
      entityId,
      entityType,
      fieldPath,
      parentId: comment.id,
    });
  };
  
  const handleUpdateComment = () => {
    if (!editContent.trim() || editContent === comment.content) {
      setIsEditing(false);
      return;
    }
    
    updateComment.mutate({
      id: comment.id,
      content: editContent,
    });
  };
  
  const handleDeleteComment = () => {
    if (window.confirm('Are you sure you want to delete this comment?')) {
      deleteComment.mutate({ id: comment.id });
    }
  };

  const handleImproveReply = () => {
    if (!replyContent.trim()) return;
    
    improveReply.mutate({
      content: replyContent,
      entityType,
      fieldPath,
    });
  };
  
  const formatDate = (date: Date) => {
    if (typeof date === 'string') {
      date = new Date(date);
    }
    return date.toLocaleString();
  };

  return (
    <Card className={`border-l-4 ${depth % 2 === 0 ? 'border-l-primary/30' : 'border-l-secondary/50'}`}>
      <CardHeader className="flex flex-row items-start space-x-4 pb-2">
        <Avatar className="h-10 w-10">
          <AvatarImage src={comment.author.image} alt={comment.author.name} />
          <AvatarFallback>{comment.author.name.substring(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium">{comment.author.name}</span>
              <span className="text-xs text-muted-foreground ml-2">
                {formatDate(comment.createdAt)}
                {comment.updatedAt > comment.createdAt && ' (edited)'}
              </span>
            </div>
            {isOwnComment && enableEditing && (
              <div className="flex space-x-2">
                {!isEditing && (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleDeleteComment}>
                      Delete
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full min-h-[100px]"
            />
            <div className="flex justify-end space-x-2">
              <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleUpdateComment}>
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div className="whitespace-pre-wrap">{comment.content}</div>
        )}
      </CardContent>
      
      <CardFooter className="flex-col items-start pt-0">
        {enableReplies && canNestReplies && (
          <div className="w-full">
            {!isReplying && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setIsReplying(true)}
              >
                Reply
              </Button>
            )}
            
            {isReplying && (
              <div className="mt-2 space-y-2">
                <Textarea
                  placeholder="Write your reply..."
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  className="min-h-[80px] w-full"
                />
                <div className="flex justify-end space-x-2">
                  {enableAIAssistance && replyContent.trim().length > 0 && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleImproveReply}
                      disabled={improveReply.isLoading}
                    >
                      {improveReply.isLoading ? 'Improving...' : 'Improve with AI'}
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      setIsReplying(false);
                      setReplyContent('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={handleSubmitReply}
                    disabled={addReply.isLoading || !replyContent.trim()}
                  >
                    {addReply.isLoading ? 'Posting...' : 'Post Reply'}
                  </Button>
                </div>
              </div>
            )}
            
            {/* Show/hide replies */}
            {replies.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowReplies(!showReplies)}
                className="mt-2"
              >
                {showReplies ? 'Hide' : 'Show'} {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
              </Button>
            )}
            
            {/* Render replies */}
            {showReplies && replies.length > 0 && (
              <div className="mt-4 ml-4 space-y-3">
                {replies.map(reply => (
                  <CommentItem
                    key={reply.id}
                    comment={reply}
                    allComments={allComments}
                    entityId={entityId}
                    entityType={entityType}
                    fieldPath={fieldPath}
                    onCommentUpdated={onCommentUpdated}
                    onCommentDeleted={onCommentDeleted}
                    depth={depth + 1}
                    maxDepth={maxDepth}
                    enableReplies={enableReplies}
                    enableEditing={enableEditing}
                    enableAIAssistance={enableAIAssistance}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </CardFooter>
    </Card>
  );
};

export default CommentThread; 
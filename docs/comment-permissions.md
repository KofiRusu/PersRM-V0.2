# Comment Permissions & Moderation System

This document outlines the implementation of the comment permissions and moderation system in the PersRM application.

## Overview

The comment system now includes comprehensive permissions and moderation features, allowing for:

- Different visibility levels for comments (PUBLIC, PRIVATE, HIDDEN)
- Role-based access control for comments (USER, MODERATOR, ADMIN)
- Comment moderation tools for authorized users
- Soft deletion of comments
- Audit trails for moderation actions
- Real-time updates for all moderation actions

## Schema Changes

### New Enums

```prisma
enum CommentVisibility {
  PUBLIC   // Visible to everyone
  PRIVATE  // Only visible to the author and moderators/admins
  HIDDEN   // Only visible to moderators/admins when they enable "Show hidden comments"
}

enum UserRole {
  USER      // Regular user
  MODERATOR // Can moderate comments but not permanently delete them
  ADMIN     // Full permissions including permanent deletion
}
```

### Updated Comment Model

The Comment model has been updated with the following fields:

```prisma
model Comment {
  // Basic fields
  id          String   @id @default(cuid())
  taskId      String
  userId      String
  content     String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  // Visibility & moderation fields
  visibility       CommentVisibility @default(PUBLIC)
  edited           Boolean           @default(false)
  deleted          Boolean           @default(false) // For soft deletion
  moderatedBy      User?             @relation("ModeratedBy", fields: [moderatedById], references: [id])
  moderatedById    String?
  moderationReason String?
  
  // Relations
  task  Task  @relation(fields: [taskId], references: [id], onDelete: Cascade)
  user  User  @relation(fields: [userId], references: [id])
}
```

## API Endpoints

### 1. Get Comments by Task ID

- Filters comments based on user role and visibility settings
- Regular users only see PUBLIC comments and their own PRIVATE comments
- Moderators and admins see all comments except HIDDEN ones by default
- Moderators and admins can opt to see HIDDEN comments with `includeHidden: true`

### 2. Create Comment

- Sets visibility to PUBLIC or PRIVATE based on user selection
- Logs activity for audit trail
- Triggers real-time updates via Pusher

### 3. Update Comment

- Only allows comment author or admin/moderator to edit
- Marks comments as edited
- Maintains original visibility unless explicitly changed
- Triggers real-time updates

### 4. Delete Comment

- Implements soft deletion (sets `deleted: true`) for regular deletion
- Only admins can permanently delete comments
- Records moderation actions separately from regular deletions
- Triggers appropriate real-time events based on who performed the action

### 5. Moderate Comment (New)

- Restricted to MODERATOR and ADMIN roles
- Allows changing visibility to HIDDEN or back to PUBLIC
- Records moderation reason and moderator information
- Triggers real-time events for immediate UI updates

## Real-time Events

New Pusher events have been added to handle moderation actions:

- `COMMENT_HIDDEN` - When a comment is hidden by a moderator
- `COMMENT_UNHIDDEN` - When a hidden comment is made visible again
- `MOD_COMMENT_DELETED` - When a comment is deleted by a moderator

## User Interface

The UI has been updated with:

- Visibility badges for PRIVATE and HIDDEN comments
- Role badges for MODERATOR and ADMIN users
- Conditional controls based on user role and ownership
- Toggle for moderators to show/hide HIDDEN comments
- Moderation dialog for adding reasons when hiding comments
- Visual styling to highlight hidden comments

## Activity Logging

All moderation actions are recorded in the TaskActivity log with specific types:

- `MOD_COMMENT_HIDDEN` - When a comment is hidden
- `MOD_COMMENT_UNHIDDEN` - When a comment is unhidden
- `MOD_COMMENT_DELETED` - When a comment is deleted by a moderator

## Migration

A migration script is provided to migrate existing comments to the new schema:

1. Maps old visibility values to the new enum
2. Sets the `deleted` field to `false` for all existing comments
3. Optionally sets up an initial admin user

Run the migration with:

```bash
node prisma/migrations/migrate-comment-permissions.js
```

## Testing

Test files are provided to verify:

- Visibility filtering works correctly based on user role
- Permission checks for moderation actions are enforced
- Soft-deletion works as expected
- Events are triggered correctly for real-time updates

## Security Considerations

- All permission checks are performed on the server side
- User roles are verified for each action
- Only authorized users can see hidden/private comments
- Moderator actions are logged for accountability

## Future Improvements

Potential future enhancements could include:

- Comment appeals system for users to request moderation review
- Advanced filtering options for moderators (by user, time, content)
- Auto-moderation for inappropriate content using AI
- Expanded audit log UI for administrators 
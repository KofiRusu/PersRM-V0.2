# Manual Steps for Comment Moderation System

This document provides detailed, step-by-step instructions for implementing the comment moderation system without relying on automated scripts.

## 1. Update Database Schema

The schema changes for comment permissions have already been added to your Prisma schema. To apply them:

```bash
# Direct push approach (no shadow database needed)
npx prisma db push --accept-data-loss
```

## 2. Apply Data Migration

Run the comment permissions migration script to convert existing comments to the new schema:

```bash
node prisma/migrations/migrate-comment-permissions.js
```

## 3. Start Development Server

Start the Next.js development server:

```bash
# Use the correct version for your package manager
npm run dev
# OR
yarn dev
# OR
pnpm dev
```

## 4. Manually Test Comment Features

### Testing as a Regular User:
1. Log in as a regular user
2. Navigate to a task detail page
3. Create a PUBLIC comment
4. Create a PRIVATE comment
5. Verify you can see both comments
6. Verify you can edit and delete your own comments

### Testing as a Moderator:
1. Log in as a user with MODERATOR role
2. Navigate to same task detail page
3. Verify you can see all PUBLIC comments and PRIVATE comments
4. Toggle "Show hidden comments" to see HIDDEN comments
5. Try hiding a comment with a reason
6. Try unhiding a comment
7. Verify real-time updates work with multiple browser windows

### Testing as an Admin:
1. Log in as a user with ADMIN role
2. Test all moderator functions
3. Try permanently deleting a comment

## 5. Troubleshooting

### If `/tasks/[id]` Pages Don't Load:
- Check browser console for errors
- Verify the task ID exists in your database
- Try the Python script to open a valid task: `python open_persrm_window.py`

### If Comments Don't Save:
- Check browser console for tRPC errors
- Verify database connection is working
- Check that Prisma schema matches your database

### If Real-time Updates Don't Work:
- Verify Pusher credentials in your environment
- Check browser console for connection errors

## 6. Expected Behavior

- Regular users: Can only see PUBLIC comments and their own PRIVATE comments
- Moderators/Admins: Can see all comments, can hide/unhide and soft-delete any comment
- Admins only: Can permanently delete comments

The comment system should update in real-time across multiple browser sessions via Pusher. 
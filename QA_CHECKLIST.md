# Task Monitor QA Checklist

## Setup
1. Run `npm install` (or `yarn install`) to install dependencies
2. Run `npm run dev` to start the development server
3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Functional Testing

### Task Management
- [ ] **Add new task:**
  - Enter a task title in the input field
  - Click "Add" button or press Enter
  - Verify the task appears in the list
  - Verify it has a unique ID (check browser console if needed)

- [ ] **Update task status:**
  - Click the clock icon to mark a pending task as "in progress"
  - Click the check icon to mark a task as "completed"
  - Verify the status pill color and text updates correctly
  - Verify analytics graphs update accordingly

- [ ] **Task filtering:**
  - Click filter options (All, Active, Completed)
  - Verify correct tasks are displayed

### Analytics
- [ ] **Real-time analytics:**
  - Add a task and verify dashboard stats update
  - Complete a task and verify completion percentage increases
  - Check that status breakdown visualization shows correct proportions
  - Verify the counts of pending/in-progress/completed tasks are accurate

- [ ] **Priority distribution:**
  - Verify high/medium/low priority counts match the actual task list

### Tabs
- [ ] **Tab navigation:**
  - Switch between Task Management, Testing & Grading, System Overview tabs
  - Verify UI shows appropriate content for each tab

### Responsive Design
- [ ] **Mobile view:**
  - Resize browser window to mobile size (< 768px width)
  - Verify layout adjusts appropriately
  - Verify all functions still work on mobile

- [ ] **Desktop view:**
  - Verify side-by-side layout of chat and task dashboard
  - Check that task list displays correctly with all columns

### Chat Sidebar
- [ ] **Chat interface:**
  - Type a message in the chat input
  - Send the message
  - Verify message appears in the chat window
  - Verify UI styling is correct

## Performance
- [ ] **Load time:** Page loads within 2 seconds
- [ ] **Task operations:** Adding/updating tasks happens without noticeable delay
- [ ] **Animations:** Transitions between components are smooth

## Accessibility
- [ ] **Keyboard navigation:** Can navigate using Tab key
- [ ] **Screen reader:** Test with a screen reader to ensure readable content
- [ ] **Color contrast:** All text has sufficient contrast against backgrounds

## Final Check
- [ ] No console errors in browser dev tools
- [ ] All API calls (if any) complete successfully
- [ ] Performance is acceptable with 50+ tasks 
# Operations Dashboard - Frontend Features

Complete enumeration of all dashboard components, their features, and expected behaviors.

## Header Components

### 1. Health Ring
**Purpose**: Visual summary of overall system health

**Features**:
- Animated SVG ring that changes color based on system health
- Three states: healthy (green), degraded (yellow), unhealthy (red)
- Pulse animation when healthy
- Displays status text inside ring

**Behavior**:
- Polls health status from backend
- Animates transitions between states
- Shows component counts (e.g., "5 components")

### 2. User Info & Sign Out
**Purpose**: Display authenticated user and provide logout

**Features**:
- Shows user email from MSAL authentication
- Sign out button with confirmation
- User avatar icon

**Behavior**:
- Displays current logged-in user
- Sign out triggers MSAL logout flow
- Redirects to login page after logout

## Dashboard Controls

**Purpose**: Global expand/collapse controls for all panels

**Features**:
- "Expand All" button
- "Collapse All" button
- Keyboard shortcuts (E for expand, C for collapse)

**Behavior**:
- Simultaneously expands/collapses all collapsible panels
- Keyboard shortcuts work from anywhere on page
- Visual feedback on button press

## Main Dashboard Components

### 3. Smart Notifications Panel
**Purpose**: Context-aware notification system that alerts users to system issues

**Features**:
- Four notification types: error, warning, info, success
- Auto-generated notifications based on system state:
  - Auth expired (error)
  - System health critical (error)
  - System health degraded (warning)
  - Task backlog building (info when >5 pending tasks)
- Snooze functionality with 4 duration options:
  - 15 minutes
  - 1 hour
  - 4 hours
  - Until tomorrow
- Dismiss button
- Action buttons that scroll to relevant sections
- Persistent snooze state via localStorage

**Behavior**:
- Automatically generates notifications when `healthStatus`, `authStatus`, or `pendingTasks` props change
- Auto-hides when no active notifications
- Shows notification count badge
- Shows snoozed count indicator
- Checks every minute for expired snoozes
- Smooth enter/exit animations

### 4. Health Panel
**Purpose**: Real-time monitoring of all system components with intelligent issue correlation

**Features**:
- Monitors 5 component types:
  1. **Pods** (Claude Agent containers)
     - Phase, container counts, restart counts
  2. **Authentication**
     - Status, exit codes, last check time
  3. **CronJob** (Auth Watchdog)
     - Schedule, active/suspended status, last success
  4. **Storage** (Azure Blob)
     - Account name, container lists
  5. **n8n** (Workflow Platform)
     - Version, workflow counts
- Overall health calculation (healthy/degraded/unhealthy)
- Root cause analysis engine that correlates issues:
  - Pods causing auth failures
  - Multiple pod failures = cluster issues
  - Isolated auth token expiration
  - Storage connectivity problems
- Issue priority levels (critical/warning)
- Suggested remediation actions with quick-fix buttons

**Behavior**:
- Polls backend every 30 seconds
- Auto-expands when overall health != healthy
- Auto-collapses when all components healthy
- Shows issue summary bar when collapsed
- Groups components into "Claude Agent" and "Infrastructure" sections
- Each component expandable for detailed view
- Quick-fix buttons scroll to relevant panels or open external links
- Animated status indicators (pulse for healthy, opacity for issues)

### 5. Token Refresh (Authentication Panel)
**Purpose**: Manage Claude API authentication credentials

**Features**:
- Two authentication methods (tabs):
  1. **Long-Lived Token** (Recommended)
     - OAuth flow via `claude setup-token`
     - Never expires
     - Platform-specific CLI commands (Mac/Linux/Windows)
  2. **Session Refresh** (Legacy)
     - Manual token export from local CLI
     - Requires periodic updates
     - Multi-step progress tracker
- Token validation (must start with `sk-ant-`)
- Token sanitization (handles whitespace)
- Copy-to-clipboard buttons
- Progress tracking for session refresh:
  1. Waiting for credentials
  2. Updating secret
  3. Restarting deployment
  4. Verifying auth
- Real-time status polling

**Behavior**:
- Auto-collapses when authenticated
- Auto-expands when auth status = expired/unknown
- Polls auth status every 30s during refresh flow
- Shows success/error feedback
- Highlights active tab
- Disables inputs during operations

### 6. CronJob Panel (Auth Watchdog)
**Purpose**: Monitor and control the auth verification CronJob

**Features**:
- CronJob metadata display:
  - Schedule (cron expression)
  - Active/Suspended status
  - Last scheduled time
  - Last success time
- Recent runs table:
  - Timestamp (formatted relative)
  - Status (succeeded/failed/running)
  - Duration (human-readable)
  - Color-coded status indicators
- Manual trigger button with confirmation dialog
- Auto-refresh every 30 seconds

**Behavior**:
- Auto-expands if last run failed or CronJob suspended
- Auto-collapses when healthy (recent success, active)
- Shows loading spinner during operations
- Provides feedback on trigger success/failure
- Formats durations intelligently (seconds, minutes, hours)

### 7. Pipeline Board (Task Kanban)
**Purpose**: Visual Kanban board for autonomous dev team task pipeline

**Features**:
- 6 phase columns:
  1. Intake
  2. Planning
  3. Implementation
  4. Verification
  5. Review
  6. Release
- Task cards showing:
  - Title
  - Task ID
  - Priority badge (critical/high/medium/low)
  - Status badge (pending/in_progress/completed/blocked)
  - Retry counts (verification/review)
  - Error indicator when present
- Three-tab detail dialog:
  1. **Overview Tab**
     - Task metadata (ID, status, phase, priority)
     - Repository URL
     - Created by/at timestamps
     - Description
     - Acceptance criteria
     - Phase-specific artifacts (PR URL, branch name, build attempts)
  2. **History Tab**
     - Phase completion timeline
     - Error history with timestamps
  3. **Envelope Tab** (NEW)
     - Complete task envelope JSON
     - Custom syntax highlighting (cyan keys, green strings, amber numbers, purple booleans)
     - Line numbers
     - Formatted indentation
- Real-time updates via WebSocket
- Phase completion indicators (green checkmarks)

**Behavior**:
- WebSocket connection on mount, disconnect on unmount
- Updates task positions when messages received
- Click card to open detail dialog
- Color-coded priority badges
- Status-based card styling
- Shows task counts per column
- Empty state message when no tasks in column

### 8. n8n Execution Feed
**Purpose**: Real-time workflow execution monitoring

**Features**:
- Timeline view with connector dots
- Execution cards showing:
  - Workflow name
  - Status badge (success/error/waiting/running)
  - Timestamp (relative format)
  - Duration
  - Execution ID
- Filters:
  - Workflow dropdown (all workflows + individual)
  - Status dropdown (all statuses + individual)
- Status color coding:
  - Success: green
  - Error: red
  - Waiting: yellow
  - Running: blue with spinner
- Auto-refresh every 10 seconds
- Click to view execution details dialog:
  - Collapsible sections for each node
  - Input/output data preview
  - Error messages
  - Node metadata

**Behavior**:
- Polls executions on mount and every 10s
- Filters apply client-side
- Shows most recent 20 executions
- Smooth scroll animations
- Timeline connector dots between cards
- Detail dialog with syntax-highlighted JSON

### 9. Storage Browser
**Purpose**: Azure Blob Storage explorer with management capabilities

**Features**:
- Container selection dropdown with color coding:
  - agent-state (cyan)
  - agent-spec (blue)
  - agent-plan (purple)
  - agent-verification (emerald)
  - agent-review (amber)
  - agent-release (rose)
- Two-panel layout:
  - Left: Hierarchical file tree
  - Right: Content preview
- File tree features:
  - Folder expansion/collapse
  - Blob lease status indicators
  - Delete buttons (folder/blob level)
  - File type icons
- Preview panel features:
  - Syntax highlighting for JSON/YAML
  - Truncation warning for large files
  - Download button
  - Break lease button (when locked)
  - Delete confirmation
- Lease management:
  - Visual indicators (lock icon)
  - Break lease functionality
  - Refresh on lease break

**Behavior**:
- Loads containers on mount
- Fetches blobs when container selected
- Tree builds hierarchical structure from flat blob list
- Click blob to preview
- Confirmation dialogs for destructive actions
- Refreshes tree after delete operations
- Shows loading states during operations

### 10. Activity Timeline
**Purpose**: System event log with categorized activity feed

**Features**:
- 5 event types:
  - Health events
  - Auth events
  - CronJob events
  - Execution events
  - Pipeline events
- 4 status levels:
  - Success (green)
  - Error (red)
  - Warning (yellow)
  - Info (blue)
- Event cards showing:
  - Type icon
  - Message
  - Relative timestamp
  - Metadata badges (key-value pairs)
- Color-coded type indicators
- Timeline connector dots

**Behavior**:
- Currently uses mock data generation
- Real implementation would poll backend
- Chronological sort (newest first)
- Smooth animations on load
- Responsive metadata badge wrapping

### 11. Command Palette (Agent Executor)
**Purpose**: Execute ad-hoc Claude prompts via dashboard

**Features**:
- Large textarea for prompt input
- Character limit: 100KB
- Character counter with warning at 90%
- Quick command chips for common operations:
  - "Check system health"
  - "Verify authentication"
  - "List active tasks"
- Execute button with loading state
- Keyboard shortcut: Cmd/Ctrl + Enter
- Result display:
  - Collapsible sections (stdout, stderr, metadata)
  - Syntax highlighting
  - Exit code indicator
  - Execution duration

**Behavior**:
- Validates input length before submit
- Shows loading spinner during execution
- Displays results with expand/collapse
- Clears result on new execution
- Quick command chips populate textarea
- Keyboard shortcut works when textarea focused

### 12. Execution History
**Purpose**: Historical record of past Claude agent executions

**Features**:
- Table view with columns:
  - Timestamp
  - Prompt (truncated to 50 chars)
  - Status (success/error)
  - Duration
  - Exit code
- Status filter dropdown
- Click row to view full details dialog:
  - Complete prompt
  - Full stdout/stderr
  - Metadata
  - Timestamps
- Color-coded status badges
- Pagination (if implemented)

**Behavior**:
- Loads recent executions on mount
- Filter applies client-side
- Truncates long prompts with ellipsis
- Detail dialog shows complete content
- Sorts by timestamp descending

### 13. Footer Bar
**Purpose**: Version info and external links

**Features**:
- App version display
- Link to n8n dashboard
- Link to Azure portal
- Link to GitHub repo

**Behavior**:
- Always visible at bottom
- External links open in new tab
- Version pulled from package.json

## Global Behaviors

### Keyboard Shortcuts
- **E**: Expand all panels
- **C**: Collapse all panels
- **Cmd/Ctrl + Enter**: Execute prompt (when in Command Palette)
- **1-8**: Jump to specific panel sections

### Animations
- Framer Motion throughout
- Smooth expand/collapse transitions
- Fade in/out for notifications
- Pulse effects for loading states
- Slide animations for dialogs
- Spring physics for interactive elements

### Theme
- Dark mode with glassmorphic effects
- Cyan accent color throughout
- Consistent spacing and typography
- Card-based layout with subtle borders
- Gradient backgrounds on interactive elements

---

## Technical Insights

### Component Architecture Patterns
All collapsible panels follow a consistent pattern:
- Accept `forceState` prop for global expand/collapse control
- Manage local collapsed state with `useSectionState` custom hook
- Auto-expand when detecting issues/errors
- Persist collapse state to localStorage

### UX Intelligence
Components are "smart" - they automatically expand when they detect issues:
- Health Panel expands when `overall !== 'healthy'`
- CronJob Panel expands when last run failed or suspended
- Token Refresh expands when `authStatus === 'expired'`
- Smart Notifications auto-generates based on system state

### Real-time Update Mechanisms
- **Polling intervals**:
  - Health Panel: 30s
  - CronJob Panel: 30s
  - Execution Feed: 10s
  - Token Refresh: 30s (during refresh flow)
- **WebSocket**: Pipeline Board uses live connection for task updates
- **Event-driven**: Smart Notifications react to prop changes immediately

### Code Patterns

#### JSON Syntax Highlighting (Pipeline Board Envelope Tab)
```typescript
const highlightJSON = (json: string) => {
  return json
    .replace(/"([^"]+)":/g, '<span class="text-cyan-400">"$1":</span>')
    .replace(/: "([^"]*)"/g, ': <span class="text-emerald-400">"$1"</span>')
    .replace(/: (\d+\.?\d*)/g, ': <span class="text-amber-400">$1</span>')
    .replace(/: (true|false|null)/g, ': <span class="text-purple-400">$1</span>');
};
```

#### Container Color Mapping (Storage Browser)
```typescript
const CONTAINER_COLORS: Record<string, {
  bg: string;
  text: string;
  border: string;
  icon: string;
}> = {
  'agent-state': {
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-400',
    border: 'border-cyan-500/30',
    icon: 'text-cyan-400'
  },
  // ... more containers
};
```

#### Status Badge Mapping (Execution Feed)
```typescript
function getStatusBadge(status: N8nExecutionStatus): {
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  icon: React.ReactNode;
  label: string;
  color: string;
}
```

---

**Document Version**: 1.0
**Last Updated**: 2026-01-21
**Component Count**: 14 major components + global behaviors

# Dashboard UX Improvements & Recommendations

**Analysis Date**: 2026-01-21
**Method**: Live Chrome DevTools testing + Feature documentation review
**Dashboard Version**: v1.0.0

---

## Critical Issues Identified

### 1. **Stuck Tasks Have No Actionable Resolution Path**
**Location**: Pipeline Board → Intake/Implementation columns
**Current State**:
- Tasks show "Stuck" status with exclamation mark
- Time in phase visible (e.g., "1h 1m", "39m")
- No clear indication of WHY stuck
- No actionable buttons to unstick tasks

**Impact**: **HIGH** - Users see problems but can't resolve them
**User Experience Issue**: Frustration from visibility without actionability

**Evidence from Testing**:
```
Task: FEAT-test-013-1768971220
Status: Pending, Intake phase, Stuck (1h 1m)
Available actions: Only "Cancel Task" in detail dialog
```

**Recommended Solution**:
Add **contextual action buttons** to stuck task cards:

```typescript
// Pseudo-code for stuck task enhancement
if (task.status === 'stuck') {
  return (
    <TaskCard>
      {/* existing content */}
      <StuckActionsPanel>
        <Button
          icon={RefreshIcon}
          variant="outline"
          onClick={() => retryTask(task.id)}
        >
          Retry Task
        </Button>
        <Button
          icon={InfoIcon}
          variant="ghost"
          onClick={() => showStuckReason(task.id)}
        >
          Why Stuck?
        </Button>
        <Button
          icon={AlertIcon}
          variant="destructive-outline"
          onClick={() => escalateToHuman(task.id)}
        >
          Escalate to Human
        </Button>
      </StuckActionsPanel>
    </TaskCard>
  );
}
```

**Additional UI Enhancement**:
- Add tooltip showing stuck reason on hover
- Show last error message directly on card
- Auto-expand task cards when stuck > 30 minutes
- Add "Stuck" filter to Pipeline Board

---

### 2. **Failed Pods Lack One-Click Remediation**
**Location**: Health Panel → Claude Agent section
**Current State**:
- 3 failed pods visible: `claude-auth-watchdog-29481450-7kmt5`, `claude-auth-watchdog-29481480-gdnzr`, `claude-auth-watchdog-29481840-8kbhm`
- "View Logs" and "Restart" buttons present
- Root cause analysis shows "Multiple pods are failing - possible cluster-wide issue"
- Suggested action: "Check cluster resources and node health" (high priority)

**Impact**: **HIGH** - System health critical, but resolution requires multiple steps
**User Experience Issue**: Multi-step resolution for common failure patterns

**Evidence from Testing**:
```
Health Panel Status: Unhealthy (8/11 healthy)
Root Cause: "Multiple pods are failing - possible cluster-wide issue"
Quick Fix Button: "Check cluster resources and node health"
  → Opens external link (Azure portal or kubectl dashboard)
  → User must manually diagnose and fix
```

**Recommended Solution 1: Smart Bulk Actions**

Add **bulk remediation** for common failure patterns:

```typescript
// Enhanced Health Panel with bulk actions
<HealthPanel>
  {failedPods.length > 2 && (
    <BulkActionBar variant="warning">
      <AlertTriangle className="h-4 w-4" />
      <span>{failedPods.length} pods failing</span>
      <div className="flex gap-2 ml-auto">
        <Button
          size="sm"
          onClick={() => restartAllFailed()}
        >
          Restart All Failed Pods
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => deleteAndRecreate()}
        >
          Delete & Recreate
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => showDetailedDiagnostics()}
        >
          Run Diagnostics
        </Button>
      </div>
    </BulkActionBar>
  )}
  {/* existing pod list */}
</HealthPanel>
```

**Recommended Solution 2: Automated Remediation Playbooks**

Add **remediation playbooks** that execute multiple steps:

```typescript
interface RemediationPlaybook {
  id: string;
  name: string;
  description: string;
  steps: RemediationStep[];
  autoRun: boolean;
  confirmationRequired: boolean;
}

const PLAYBOOKS: RemediationPlaybook[] = [
  {
    id: 'restart-auth-watchdog',
    name: 'Fix Auth Watchdog Failures',
    description: 'Restart failed auth watchdog pods and verify authentication',
    steps: [
      { action: 'DELETE_FAILED_PODS', target: 'claude-auth-watchdog' },
      { action: 'WAIT_FOR_RECREATION', timeout: 60 },
      { action: 'VERIFY_AUTH_STATUS', retries: 3 },
      { action: 'NOTIFY_COMPLETION' }
    ],
    autoRun: false,
    confirmationRequired: true
  },
  {
    id: 'emergency-rollback',
    name: 'Rollback Deployment',
    description: 'Roll back to previous working deployment version',
    steps: [
      { action: 'GET_PREVIOUS_VERSION' },
      { action: 'KUBECTL_ROLLBACK' },
      { action: 'VERIFY_HEALTH', timeout: 120 },
      { action: 'NOTIFY_COMPLETION' }
    ],
    autoRun: false,
    confirmationRequired: true
  }
];

// UI Component
<PlaybookExecutor playbooks={relevantPlaybooks}>
  <Button onClick={() => executePlaybook('restart-auth-watchdog')}>
    🔧 Run Auto-Fix
  </Button>
</PlaybookExecutor>
```

---

## High-Priority Enhancements

### 3. **Pipeline Board Lacks Drag-and-Drop Task Reordering**
**Location**: Pipeline Board - all columns
**Current State**:
- Tasks displayed in chronological order
- No way to prioritize/reorder tasks within a column
- No drag-and-drop between columns (manual phase override)

**Impact**: **MEDIUM** - Limits operational control
**User Experience Issue**: Can't manually prioritize or override task flow

**Recommended Solution**:
```typescript
import { DndContext, DragOverlay } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

<DndContext onDragEnd={handleDragEnd}>
  <SortableContext items={tasks} strategy={verticalListSortingStrategy}>
    {tasks.map(task => (
      <SortableTaskCard key={task.id} task={task} />
    ))}
  </SortableContext>
  <DragOverlay>{/* dragged task preview */}</DragOverlay>
</DndContext>

function handleDragEnd(event) {
  const { active, over } = event;
  if (over && active.id !== over.id) {
    // Reorder within column OR move to different column
    updateTaskOrder(active.id, over.id);
  }
}
```

**Keyboard Accessibility**:
- `Ctrl+↑/↓`: Move task up/down in column
- `Ctrl+←/→`: Move task to previous/next phase

---

### 4. **n8n Execution Feed Lacks Inline Error Viewing**
**Location**: n8n Executions panel
**Current State**:
- Error executions show red badge
- Must click execution to view details dialog
- Dialog requires expanding nodes to see errors

**Impact**: **MEDIUM** - Slows error triage
**User Experience Issue**: Too many clicks to identify error type

**Recommended Solution**:
Add **inline error preview** on hover/expand:

```typescript
<ExecutionCard status="error">
  {/* existing content */}
  <ErrorPreview className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded">
    <div className="flex items-start gap-2">
      <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-red-400">
          Node: {errorNode}
        </p>
        <p className="text-xs text-red-300 truncate">
          {errorMessage}
        </p>
        <button className="text-xs text-red-400 hover:underline mt-1">
          View full details →
        </button>
      </div>
    </div>
  </ErrorPreview>
</ExecutionCard>
```

---

### 5. **Storage Browser Missing Quick Actions**
**Location**: Storage Browser - file tree
**Current State**:
- Can view, delete files
- Must click file to preview
- No copy path, download, or share options

**Impact**: **LOW-MEDIUM** - Reduces efficiency
**User Experience Issue**: Missing common file operations

**Recommended Solution**:
Add **context menu** and **quick actions**:

```typescript
<FileTreeItem onContextMenu={showContextMenu}>
  {/* existing content */}
  <QuickActions className="opacity-0 group-hover:opacity-100 transition-opacity">
    <IconButton
      icon={Copy}
      tooltip="Copy blob path"
      onClick={() => copyToClipboard(blob.path)}
    />
    <IconButton
      icon={Download}
      tooltip="Download file"
      onClick={() => downloadBlob(blob.name)}
    />
    <IconButton
      icon={ExternalLink}
      tooltip="Open in Azure Portal"
      onClick={() => openInPortal(blob.uri)}
    />
    <IconButton
      icon={Lock}
      tooltip="Lease info"
      onClick={() => showLeaseDetails(blob)}
    />
  </QuickActions>
</FileTreeItem>

<ContextMenu>
  <MenuItem icon={Eye}>Preview</MenuItem>
  <MenuItem icon={Copy}>Copy Path</MenuItem>
  <MenuItem icon={Download}>Download</MenuItem>
  <MenuSeparator />
  <MenuItem icon={Edit}>Edit JSON</MenuItem>
  <MenuItem icon={History}>Version History</MenuItem>
  <MenuSeparator />
  <MenuItem icon={Trash} variant="destructive">Delete</MenuItem>
</ContextMenu>
```

---

## Notification & Alerting Improvements

### 6. **Smart Notifications Need Severity-Based Auto-Actions**
**Location**: Smart Notifications panel
**Current State**:
- Shows critical error: "System Health Critical"
- Action button: "View Health" (scrolls to health panel)
- Can snooze (15min, 1hr, 4hr, until tomorrow)
- Can dismiss

**Observations**:
- Notification correctly auto-generated based on `healthStatus === 'unhealthy'`
- Action button behavior works (tested - scrolls to health panel)
- Snooze dropdown works (tested - 4 duration options)
- Missing: auto-escalation for critical issues

**Recommended Enhancement 1: Priority-Based Auto-Escalation**

```typescript
interface NotificationEnhancement {
  id: string;
  type: NotificationType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  autoEscalateAfter?: number; // minutes
  escalationActions?: EscalationAction[];
}

const ENHANCED_NOTIFICATIONS = {
  'health-critical': {
    severity: 'critical',
    autoEscalateAfter: 15, // 15 minutes
    escalationActions: [
      {
        trigger: 'TIME_THRESHOLD',
        threshold: 15 * 60 * 1000,
        action: 'SEND_TEAMS_ALERT',
        payload: {
          channel: '#ops-alerts',
          mention: '@oncall'
        }
      },
      {
        trigger: 'TIME_THRESHOLD',
        threshold: 30 * 60 * 1000,
        action: 'RUN_AUTO_REMEDIATION',
        playbook: 'emergency-restart'
      }
    ]
  }
};

// UI Enhancement
<NotificationItem notification={notification}>
  {notification.severity === 'critical' && !notification.acknowledged && (
    <AutoEscalationTimer
      startTime={notification.timestamp}
      escalateAfter={notification.autoEscalateAfter}
      onEscalate={() => triggerEscalation(notification)}
    >
      <div className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded">
        <div className="flex items-center gap-2 text-xs">
          <Clock className="h-3 w-3 text-yellow-400" />
          <span className="text-yellow-400">
            Auto-escalates in {timeRemaining}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => acknowledgeNotification(notification.id)}
          >
            Acknowledge
          </Button>
        </div>
      </div>
    </AutoEscalationTimer>
  )}
</NotificationItem>
```

**Recommended Enhancement 2: Notification Action History**

Add **audit trail** for notification actions:

```typescript
<NotificationItem notification={notification}>
  {/* existing content */}
  <NotificationHistory className="mt-2 text-xs text-muted-foreground">
    <details>
      <summary className="cursor-pointer hover:text-foreground">
        View history ({notification.actionHistory.length} actions)
      </summary>
      <div className="mt-2 space-y-1 pl-4 border-l-2 border-muted">
        {notification.actionHistory.map(action => (
          <div key={action.id} className="flex justify-between">
            <span>{action.type}</span>
            <span>{formatRelative(action.timestamp)}</span>
          </div>
        ))}
      </div>
    </details>
  </NotificationHistory>
</NotificationItem>
```

---

### 7. **Pipeline Board Needs Task Health Indicators**
**Location**: Pipeline Board - task cards
**Current State**:
- Cards show status, priority, time in phase
- Error indicator shown when errors exist
- Retry counts displayed

**Enhancement**: Add **predictive health scoring**:

```typescript
interface TaskHealthScore {
  score: number; // 0-100
  factors: HealthFactor[];
  recommendation: string;
}

function calculateTaskHealth(task: Task): TaskHealthScore {
  let score = 100;
  const factors: HealthFactor[] = [];

  // Time in phase
  if (task.timeInPhase > 60 * 60 * 1000) { // > 1 hour
    score -= 30;
    factors.push({ type: 'time_stuck', impact: -30 });
  }

  // Retry count
  if (task.retryCount.verification > 2) {
    score -= 25;
    factors.push({ type: 'high_retries', impact: -25 });
  }

  // Error history
  if (task.errorHistory.length > 0) {
    score -= 20;
    factors.push({ type: 'has_errors', impact: -20 });
  }

  // Build attempts
  if (task.phases.implementation?.buildAttempts > 2) {
    score -= 15;
    factors.push({ type: 'build_failures', impact: -15 });
  }

  return {
    score: Math.max(0, score),
    factors,
    recommendation: getRecommendation(score)
  };
}

// UI Component
<TaskCard task={task}>
  <HealthIndicator health={calculateTaskHealth(task)}>
    <div className="flex items-center gap-1">
      <div
        className={cn(
          "h-2 w-2 rounded-full",
          health.score > 70 && "bg-green-400",
          health.score > 40 && health.score <= 70 && "bg-yellow-400",
          health.score <= 40 && "bg-red-400"
        )}
      />
      <span className="text-xs">{health.score}%</span>
    </div>
  </HealthIndicator>
  {/* existing content */}
</TaskCard>
```

---

## Accessibility & Keyboard Navigation Enhancements

### 8. **Missing Keyboard Shortcuts for Common Actions**
**Current State**:
- Global shortcuts: E (expand all), C (collapse all), Cmd+Enter (execute prompt)
- Section jump shortcuts: 1-8 (documented but behavior not tested)
- Missing: shortcuts for common actions

**Recommended Shortcuts**:

| Shortcut | Action | Context |
|----------|--------|---------|
| `?` | Show keyboard shortcuts modal | Global |
| `/` | Focus search/filter | Global |
| `Esc` | Close dialogs/modals | Global |
| `r` | Refresh current panel | Focused panel |
| `f` | Toggle filters | Execution Feed |
| `n` | Next execution/task | Execution Feed/Pipeline |
| `p` | Previous execution/task | Execution Feed/Pipeline |
| `Enter` | Open details dialog | On focused task/execution |
| `Ctrl+D` | Dismiss notification | Focused notification |
| `Ctrl+S` | Snooze notification | Focused notification |

**Implementation**:

```typescript
import { useHotkeys } from 'react-hotkeys-hook';

function Dashboard() {
  useHotkeys('?', () => showKeyboardShortcutsModal());
  useHotkeys('/', (e) => {
    e.preventDefault();
    focusSearchBox();
  });
  useHotkeys('r', () => refreshActivePanel());

  return (
    <>
      {/* existing dashboard */}
      <KeyboardShortcutsModal isOpen={shortcutsModalOpen}>
        <ShortcutsList shortcuts={ALL_SHORTCUTS} />
      </KeyboardShortcutsModal>
    </>
  );
}
```

---

### 9. **Activity Timeline Uses Mock Data**
**Location**: Activity Timeline panel
**Current State**: "Currently uses mock data generation" (per documentation)

**Impact**: **LOW** - Feature exists but not functional
**User Experience Issue**: Potentially confusing if users expect real data

**Recommended Solution**:
1. Add **"Demo Mode" badge** until real backend integration
2. Or **hide panel** entirely until functional
3. Or show **empty state** with "Coming Soon" message

```typescript
<ActivityTimeline>
  {useMockData && (
    <DemoBadge className="mb-2">
      <Info className="h-3 w-3" />
      <span className="text-xs">Demo data - backend integration pending</span>
    </DemoBadge>
  )}
  {/* existing timeline */}
</ActivityTimeline>
```

---

## Summary of Recommendations

| # | Issue | Priority | Impact | Effort |
|---|-------|----------|--------|--------|
| 1 | Stuck tasks need actionable resolution | **CRITICAL** | High | Medium |
| 2 | Failed pods lack one-click remediation | **CRITICAL** | High | High |
| 3 | Pipeline drag-and-drop reordering | High | Medium | Medium |
| 4 | n8n execution feed inline errors | High | Medium | Low |
| 5 | Storage browser quick actions | Medium | Medium | Low |
| 6 | Smart notifications auto-escalation | High | High | Medium |
| 7 | Pipeline task health scoring | Medium | Medium | Medium |
| 8 | Keyboard shortcuts expansion | Medium | Low | Low |
| 9 | Activity timeline mock data badge | Low | Low | Low |

---

## Implementation Priorities

### Phase 1: Critical Operational Improvements (Week 1)
1. **Stuck Task Actions** - Unblock operators from resolving task issues
2. **Pod Remediation Playbooks** - Reduce mean time to recovery (MTTR)
3. **Notification Auto-Escalation** - Prevent incidents from going unnoticed

### Phase 2: Efficiency Enhancements (Week 2)
4. **Execution Feed Inline Errors** - Faster error triage
5. **Storage Browser Quick Actions** - Improved file operations
6. **Keyboard Shortcuts** - Power user efficiency

### Phase 3: Advanced Features (Week 3)
7. **Pipeline Drag-and-Drop** - Manual task flow control
8. **Task Health Scoring** - Predictive issue detection
9. **Activity Timeline Integration** - Real backend connection

---

## Testing Checklist

**Completed Testing**:
- [x] Login flow (MSAL Azure AD)
- [x] Health Panel display and pod details
- [x] Smart Notifications rendering and actions
- [x] Smart Notifications snooze dropdown
- [x] Pipeline Board task cards and "Stuck" indicators
- [x] Task Detail dialog (Overview, History, Envelope tabs)
- [x] Envelope tab JSON syntax highlighting
- [x] n8n Execution Feed real-time updates
- [x] Storage Browser container selection
- [x] Storage Browser file tree display
- [x] Console for JavaScript errors (none found)
- [x] Network requests for polling behavior

**Recommended Additional Testing**:
- [ ] Test "View Health" action button (notification → health panel scroll)
- [ ] Test pod "View Logs" button functionality
- [ ] Test pod "Restart" button functionality
- [ ] Test n8n execution detail dialog
- [ ] Test execution filters (workflow, status)
- [ ] Test storage browser file preview
- [ ] Test storage browser delete confirmation
- [ ] Test storage browser lease management
- [ ] Test Command Palette execution
- [ ] Test Execution History filtering
- [ ] Test keyboard shortcuts (E, C, 1-8, Cmd+Enter)
- [ ] Test global Expand All / Collapse All
- [ ] Test Authentication panel token refresh flow
- [ ] Test CronJob manual trigger
- [ ] Test activity timeline (once backend integrated)

---

**Document Version**: 1.0
**Analysis Methodology**: Live Chrome DevTools + API inspection
**Browser**: Chrome
**Environment**: Production (ops-dashboard.ii-us.com)

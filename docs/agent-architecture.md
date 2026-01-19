# Autonomous Dev Team Agent Architecture

## How It Works (Plain English)

Imagine a software development team that never sleeps, never takes breaks, and works together automatically. That's what this system does using four AI "agents" - each one an expert at a specific job:

### The Team

| Agent | Role | Like a... |
|-------|------|-----------|
| **PM Agent** | Understands what you want and writes it down clearly | Project Manager who takes your idea and creates a detailed blueprint |
| **Dev Agent** | Writes the actual code | Software Developer who builds what the blueprint describes |
| **QA Agent** | Tests everything works correctly | Quality Tester who checks the work before it ships |
| **Reviewer Agent** | Reviews the code for problems | Senior Engineer who double-checks for mistakes and security issues |

### The Process

```
    YOU                        THE AI TEAM                         RESULT
     │                                                               │
     │  "I want a button                                             │
     │   that exports data"                                          │
     │         │                                                     │
     │         ▼                                                     │
     │    ┌─────────┐                                                │
     │    │   PM    │  Writes spec: "Add export button               │
     │    │  Agent  │  to dashboard, CSV format..."                  │
     │    └────┬────┘                                                │
     │         │                                                     │
     │         ▼                                                     │
     │    ┌─────────┐                                                │
     │    │   Dev   │  Writes code, creates                          │
     │    │  Agent  │  pull request on GitHub                        │
     │    └────┬────┘                                                │
     │         │                                                     │
     │         ▼                                                     │
     │    ┌─────────┐                                                │
     │    │   QA    │  Runs tests, checks the                        │
     │    │  Agent  │  button actually works                         │
     │    └────┬────┘                                                │
     │         │                                                     │
     │         ▼                                                     │
     │    ┌─────────┐                                                │
     │    │Reviewer │  Checks code quality,                          │
     │    │  Agent  │  no security problems                          │
     │    └────┬────┘                                                │
     │         │                                                     │
     │         ▼                                                     ▼
     │                                                        ┌─────────────┐
     └───────────────────────────────────────────────────────▶│ Feature     │
                                                              │ Deployed!   │
                                                              └─────────────┘
```

### What Makes It Smart

1. **They ask for help when stuck** - If the PM Agent doesn't understand your request, it sends you a message asking for clarification instead of guessing wrong.

2. **They fix their mistakes** - If the QA Agent finds a bug, it sends the Dev Agent back to fix it. This can happen up to 3 times before a human is called in.

3. **They escalate serious problems** - If the Reviewer finds a security issue, it immediately alerts a human rather than trying to fix it alone.

4. **They remember everything** - All their work is saved, so you can see exactly what each agent did and why.

### When Humans Get Involved

The system calls for human help when:
- Your request is unclear and needs explanation
- The agents have tried to fix something 3 times and still can't
- A security vulnerability is found
- Something unexpected happens

You'll get a **Microsoft Teams notification** with buttons to approve, reject, or provide more information.

---

## System Overview

```
                                    USERS
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
                    ▼                 ▼                 ▼
            ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
            │  n8n Form   │   │  Dashboard  │   │   Teams     │
            │  (Submit)   │   │  (Monitor)  │   │  (Approve)  │
            └──────┬──────┘   └──────┬──────┘   └──────┬──────┘
                   │                 │                 │
                   │                 │ read/cancel     │ webhook
                   │                 │                 │
───────────────────┼─────────────────┼─────────────────┼──────────────────
                   │                 │                 │
                   ▼                 ▼                 ▼
            ┌─────────────────────────────────────────────────┐
            │                    n8n                          │
            │  ┌───────────────────────────────────────────┐  │
            │  │          Master Orchestrator              │  │
            │  │                                           │  │
            │  │   intake → planning → implementation →    │  │
            │  │   verification → review → release         │  │
            │  └───────────────────────────────────────────┘  │
            │                       │                         │
            │         ┌─────────────┼─────────────┐          │
            │         ▼             ▼             ▼          │
            │  ┌───────────┐ ┌───────────┐ ┌───────────┐     │
            │  │ PM Agent  │ │ Dev Agent │ │ QA Agent  │     │
            │  │ Workflows │ │ Workflows │ │ Workflows │     │
            │  └───────────┘ └───────────┘ └───────────┘     │
            │         │             │             │          │
            └─────────┼─────────────┼─────────────┼──────────┘
                      │             │             │
───────────────────────────────────────────────────────────────────────────
                      │             │             │
                      ▼             ▼             ▼
            ┌─────────────────────────────────────────────────┐
            │              Claude Agent (AKS)                 │
            │                                                 │
            │   POST /run  →  claude -p "..."  →  response    │
            │                                                 │
            └─────────────────────────────────────────────────┘
                                    │
                                    │ Workload Identity
                                    ▼
───────────────────────────────────────────────────────────────────────────
                            AZURE RESOURCES
            ┌─────────────────────────────────────────────────┐
            │              Azure Blob Storage                 │
            │                                                 │
            │  ┌─────────────┐  ┌─────────────┐              │
            │  │ agent-state │  │ agent-spec  │              │
            │  │             │  │             │              │
            │  │ task-       │  │ spec.md     │              │
            │  │ envelope.yml│  │ plan.md     │              │
            │  │             │  │ tasks.md    │              │
            │  └─────────────┘  └─────────────┘              │
            │                                                 │
            │  ┌─────────────┐  ┌─────────────┐              │
            │  │ agent-      │  │ agent-      │              │
            │  │ verification│  │ review      │              │
            │  │             │  │             │              │
            │  │ report.json │  │ feedback.md │              │
            │  └─────────────┘  └─────────────┘              │
            └─────────────────────────────────────────────────┘
                                    │
            ┌───────────────────────┼───────────────────────┐
            │                       │                       │
            ▼                       ▼                       ▼
     ┌─────────────┐        ┌─────────────┐        ┌─────────────┐
     │ Key Vault   │        │   GitHub    │        │   Teams     │
     │             │        │             │        │   Webhook   │
     │ GitHub App  │        │ Repos, PRs  │        │             │
     │ Private Key │        │             │        │ Notify      │
     └─────────────┘        └─────────────┘        └─────────────┘
```

## Agent Pipeline Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌───────┐  │
│  │  USER   │    │   PM    │    │   DEV   │    │   QA    │    │REVIEW │  │
│  │ SUBMITS │───▶│  AGENT  │───▶│  AGENT  │───▶│  AGENT  │───▶│ AGENT │  │
│  │ FEATURE │    │         │    │         │    │         │    │       │  │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘    └───┬───┘  │
│                      │              ▲              │             │      │
│                      │              │              │             │      │
│                      ▼              │              ▼             ▼      │
│                 ┌─────────┐    ┌────┴────┐   ┌─────────┐   ┌─────────┐  │
│                 │ HUMAN   │    │FEEDBACK │   │ FAILED? │   │APPROVED?│  │
│                 │CHECKPOINT│◀──│ ROUTER  │◀──│  (≤3x)  │   │  (≤2x)  │  │
│                 │(if unclear)│  │         │   └─────────┘   └────┬────┘  │
│                 └─────────┘    └─────────┘                      │      │
│                                                                  ▼      │
│                                                            ┌─────────┐  │
│                                                            │  MERGE  │  │
│                                                            │   PR    │  │
│                                                            └─────────┘  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## Agent Interactions

Agents don't communicate directly. They exchange artifacts through Azure Blob Storage:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          AGENT ARTIFACT FLOW                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                           PM AGENT                                   │   │
│  │                                                                      │   │
│  │   Reads: task-envelope.yml (title, description, acceptance)         │   │
│  │   Writes: spec.md ──▶ plan.md ──▶ tasks.md                          │   │
│  │                                                                      │   │
│  │   If unclear ──▶ Human Checkpoint (questions → Teams → user)        │   │
│  └──────────────────────────────────┬───────────────────────────────────┘   │
│                                     │                                       │
│                                     ▼ spec.md, plan.md, tasks.md            │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                           DEV AGENT                                  │   │
│  │                                                                      │   │
│  │   Reads: spec.md, plan.md, tasks.md, feedback (if retry)            │   │
│  │   Writes: Code changes → GitHub PR                                   │   │
│  │   Updates: task-envelope.yml (pr_url, branch)                        │   │
│  │                                                                      │   │
│  │   On feedback ◀── Reads QA/Reviewer feedback, fixes, updates PR     │   │
│  └──────────────────────────────────┬───────────────────────────────────┘   │
│                                     │                                       │
│                                     ▼ PR URL                                │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                           QA AGENT                                   │   │
│  │                                                                      │   │
│  │   Reads: spec.md (acceptance criteria), PR diff                      │   │
│  │   Runs: Test suite, validates each criterion                         │   │
│  │   Writes: verification-report.json                                   │   │
│  │                                                                      │   │
│  │   Result: PASS ──▶ Reviewer    FAIL ──▶ Feedback Router ──▶ Dev     │   │
│  └──────────────────────────────────┬───────────────────────────────────┘   │
│                                     │                                       │
│                                     ▼ verification-report.json              │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         REVIEWER AGENT                               │   │
│  │                                                                      │   │
│  │   Reads: PR diff, verification-report.json, spec.md                  │   │
│  │   Checks: Code quality, security (OWASP), conventions                │   │
│  │   Writes: review-feedback.md                                         │   │
│  │                                                                      │   │
│  │   Result: APPROVE ──▶ Dev Release (merge)                            │   │
│  │           CHANGES ──▶ Feedback Router ──▶ Dev                        │   │
│  │           CRITICAL SECURITY ──▶ Human Checkpoint (immediate)         │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Agent Responsibilities

| Agent | Phase | Reads | Writes | Triggers |
|-------|-------|-------|--------|----------|
| **PM** | Intake | `task-envelope.yml` | `spec.md` | Human Checkpoint (if unclear) |
| **PM** | Planning | `spec.md` | `plan.md` | - |
| **PM** | Tasks | `spec.md`, `plan.md` | `tasks.md` | Dev Agent |
| **Dev** | Implementation | `spec.md`, `plan.md`, `tasks.md` | GitHub PR | QA Agent |
| **Dev** | Retry | Above + `feedback` | Updated PR | QA Agent |
| **Dev** | Release | Approved PR | Merged PR | Notification |
| **QA** | Verification | `spec.md`, PR diff | `verification-report.json` | Reviewer or Feedback Router |
| **Reviewer** | Review | `verification-report.json`, PR | `review-feedback.md` | Release or Feedback Router |

### Feedback Loops

```
                         QA Loop (max 3 cycles)
               ┌────────────────────────────────────┐
               │                                    │
               ▼                                    │
┌───────┐   ┌──────┐   ┌────────┐   ┌──────────┐   │
│  Dev  │──▶│  QA  │──▶│ FAIL?  │──▶│ Feedback │───┘
│ Agent │   │Agent │   └───┬────┘   │  Router  │
└───────┘   └──────┘       │PASS    └──────────┘
                           ▼
                    ┌────────────┐
                    │  Reviewer  │
                    │   Agent    │
                    └─────┬──────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
     ┌─────────┐    ┌─────────┐    ┌───────────┐
     │ APPROVE │    │ CHANGES │    │ CRITICAL  │
     └────┬────┘    └────┬────┘    │ SECURITY  │
          │              │         └─────┬─────┘
          ▼              │               ▼
     ┌─────────┐         │         ┌───────────┐
     │ Release │         │         │  Human    │
     │ (merge) │         │         │Checkpoint │
     └─────────┘         │         └───────────┘
                         │
                         │ Review Loop (max 2 cycles)
               ┌─────────┘
               │
               ▼
        ┌──────────┐
        │ Feedback │──▶ Dev Agent
        │  Router  │
        └──────────┘
```

## Dashboard Interaction Points

| Component | Dashboard Action | Data Source |
|-----------|------------------|-------------|
| Task List | View all tasks, filter by status | `agent-state/*.yml` |
| Task Detail | View envelope, artifacts, history | `agent-state/{id}/task-envelope.yml` |
| Spec Viewer | Read spec, plan, tasks | `agent-spec/{id}/*.md` |
| PR Link | Navigate to GitHub PR | `task-envelope.pr_url` |
| Cancel Task | Update status to cancelled | `agent-state/{id}/task-envelope.yml` |
| Retry Task | Trigger orchestrator resume | n8n webhook |
| Auth Status | Check Claude session health | Claude Agent `/health` |

## Blob Container Structure

```
iiusagentstore/
├── agent-state/
│   └── {task_id}/
│       └── task-envelope.yml      # Task state, phase, history
│
├── agent-spec/
│   └── {task_id}/
│       ├── spec.md                # Requirements (PM Agent)
│       ├── plan.md                # Design (PM Agent)
│       └── tasks.md               # Implementation tasks (PM Agent)
│
├── agent-verification/
│   └── {task_id}/
│       └── report-{cycle}.json    # Test results (QA Agent)
│
└── agent-review/
    └── {task_id}/
        └── feedback-{cycle}.md    # Review comments (Reviewer Agent)
```

## Key Data Flows

### 1. Task Submission
```
User → n8n Form → Create task-envelope.yml → Trigger Orchestrator
```

### 2. Agent Execution
```
Orchestrator → Agent Workflow → POST /run → Claude CLI → Response → Parse → Update Blob
```

### 3. Human Escalation
```
Agent unclear → Human Checkpoint → Teams Card → User clicks Approve/Reject → Webhook → Resume/Cancel
```

### 4. Dashboard Monitoring
```
Dashboard → Azure Blob API (Workload Identity) → Read task-envelope.yml → Display status
```

# Frontend Codemap

**Freshness:** 2026-01-26T00:00:00Z

## Module Structure

```
dashboard/frontend/src/
├── main.tsx              # React bootstrap
├── App.tsx               # Root component + MSAL
├── pages/
│   └── dashboard.tsx     # Main dashboard layout
├── components/
│   ├── auth-guard.tsx    # Azure AD login guard
│   ├── health-panel.tsx  # Pod status display
│   ├── auth-status-panel.tsx
│   ├── token-refresh.tsx # Token refresh UI
│   ├── agent-executor.tsx# Prompt execution form
│   ├── execution-history.tsx
│   ├── cronjob-panel.tsx # CronJob management
│   └── ui/               # Radix UI primitives
├── services/
│   └── api.ts            # Backend API client
└── lib/
    ├── msal-config.ts    # Azure AD configuration
    └── utils.ts          # Utility functions
```

## Component Hierarchy

```
App (MsalProvider)
└── AuthGuard
    └── Dashboard
        ├── HealthPanel
        ├── AuthStatusPanel
        ├── TokenRefresh
        ├── AgentExecutor
        ├── ExecutionHistory
        └── CronJobPanel
```

## Key Components

| Component | Purpose | API Calls |
|-----------|---------|-----------|
| AuthGuard | Login gate + group check | MSAL |
| HealthPanel | Pod status display | GET /api/health |
| AuthStatusPanel | Claude auth status | GET /api/auth/status |
| TokenRefresh | Token refresh workflow | POST/GET /api/credentials/* |
| AgentExecutor | Prompt execution form | POST /api/execute |
| ExecutionHistory | Execution log viewer | GET /api/executions |
| CronJobPanel | CronJob management | GET/POST /api/cronjobs/* |

## Authentication Flow

```
1. MsalProvider wraps app
2. AuthGuard checks useIsAuthenticated()
3. If not authenticated → loginRedirect()
4. If authenticated → check group membership
5. Pass Bearer token to all API calls
```

## MSAL Configuration

```typescript
{
  auth: {
    clientId: string,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: window.location.origin
  },
  cache: { cacheLocation: 'sessionStorage' }
}
```

## State Management

- Local component state (useState)
- No global state library
- API data fetched per-component with useEffect

## Build Configuration

- **Bundler:** Vite 5.4.10
- **Testing:** Vitest 2.1.3 (unit), Playwright 1.48.0 (E2E)
- **Styling:** Tailwind CSS 3 + Radix UI
- **TypeScript:** Strict mode

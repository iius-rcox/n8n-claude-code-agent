# Quickstart: Dynamic Repository Dropdown

**Feature**: 012-dynamic-repo-dropdown
**Date**: 2026-01-20

## Overview

This feature modifies the Feature Request Form workflow to dynamically populate the Target Repository dropdown with active repositories from the ii-us GitHub organization.

## Prerequisites

1. **GitHub Token**: Ensure `GITHUB_TOKEN` environment variable is set in n8n with a token that has read access to ii-us organization repositories
2. **n8n Access**: Workflow editor access to modify "Agent Dev Team - Feature Request Form"

## Architecture Change

### Before (Current)
```
[Form Trigger] → [Generate Task] → [Store Blob] → [Notify Teams] → [Merge] → [Response] → [Orchestrator]
     │
     └─ Static text field for repository
```

### After (New)
```
[Form Trigger: Step 1] → [Fetch Repos] → [Transform] → [IF: Success?]
     │                                                       │
     │                              ┌────────────────────────┤
     │                              ▼                        ▼
     │                    [Form: Dropdown]         [Form: Text + Error]
     │                              │                        │
     │                              └────────┬───────────────┘
     │                                       ▼
     └─ Step 1 fields:              [Generate Task] → [Store Blob] → ...
        Title, Description,
        Priority, Acceptance
```

## Implementation Steps

### Step 1: Modify Form Trigger (Remove Repository Field)

Update "Feature Request Form" node to remove the Target Repository field. This field moves to step 2.

**Remaining fields in Step 1**:
- Feature Title (text, required)
- Description (textarea, required)
- Priority (dropdown, required)
- Acceptance Criteria (textarea, required)

### Step 2: Add Repository Fetch Node

Insert HTTP Request node after Form Trigger:

```
Name: Fetch Organization Repos
Method: GET
URL: https://api.github.com/orgs/ii-us/repos?type=all&sort=full_name&per_page=100
Headers:
  - Authorization: Bearer {{ $env.GITHUB_TOKEN }}
  - Accept: application/vnd.github+json
```

### Step 3: Add Transform Code Node

Insert Code node to filter and format repos:

```javascript
const repos = $input.all().map(item => item.json);

const activeRepos = repos
  .filter(repo => !repo.archived)
  .sort((a, b) => a.full_name.localeCompare(b.full_name));

const dropdownOptions = activeRepos.map(repo => ({
  option: repo.full_name
}));

return [{
  json: {
    dropdownOptions,
    repoCount: dropdownOptions.length,
    success: dropdownOptions.length > 0
  }
}];
```

### Step 4: Add IF Node for Error Handling

Insert IF node to check success:

```
Condition: {{ $json.success }} equals true
```

### Step 5: Add Form Node (Success Path)

Add n8n Form node with dynamic dropdown:

```
Page Type: Form
Define Form: Using JSON
Form Fields (JSON):
[
  {
    "fieldLabel": "Target Repository",
    "fieldType": "dropdown",
    "requiredField": true,
    "fieldOptions": {
      "values": {{ $json.dropdownOptions }}
    }
  }
]
```

### Step 6: Add Form Node (Fallback Path)

Add n8n Form node with text input for error case:

```
Page Type: Form
Define Form: Using JSON
Form Fields (JSON):
[
  {
    "fieldLabel": "Target Repository (Unable to load list - enter manually)",
    "fieldType": "text",
    "requiredField": true,
    "placeholder": "ii-us/repository-name"
  }
]
```

### Step 7: Merge Paths

Add Merge node to combine success and fallback paths before continuing to "Generate Task ID & Envelope".

### Step 8: Update Generate Task Code

Ensure the code node handles the repository value from form submission:

```javascript
// No changes needed - existing code already handles:
repository: body.repository || body['Target Repository'] || 'ii-us/n8n-claude-code-agent'
```

## Testing

### Test 1: Verify Dropdown Population
1. Open form URL: `https://n8n.ii-us.com/form/feature-request-form`
2. Fill Step 1 fields and submit
3. Verify Step 2 shows dropdown with organization repos
4. Verify repos are sorted alphabetically
5. Verify archived repos are not shown

### Test 2: Verify Selection Persistence
1. Complete form through both steps
2. Check task envelope in Azure Blob
3. Verify `repository` field contains selected repo name

### Test 3: Verify Fallback
1. Temporarily set invalid `GITHUB_TOKEN`
2. Open form and complete Step 1
3. Verify Step 2 shows text input with error message
4. Complete form and verify submission works

## Rollback

If issues arise, revert the workflow to use a static text field:

### Option A: Restore from Backup (Recommended)
1. Import backup from `n8n-workflows/stage-1/feature-request-form-backup.json`
2. Delete the current workflow
3. Rename imported workflow to "Agent Dev Team - Feature Request Form"
4. Activate the workflow

### Option B: Manual Rollback
1. **Remove nodes** (in order):
   - Select Repository (Fallback)
   - Select Repository (Dropdown)
   - Merge Form Results
   - Check Repos Loaded
   - Transform Repo Response
   - Fetch Organization Repos

2. **Modify Form Trigger**: Add back "Target Repository" field:
   ```json
   {
     "fieldLabel": "Target Repository",
     "fieldType": "text",
     "requiredField": true,
     "placeholder": "iius-rcox/repository-name"
   }
   ```

3. **Reconnect workflow**: Feature Request Form → Generate Task ID & Envelope

4. **Update Generate Task code**: Revert to get repository from Step 1 form data:
   ```javascript
   const body = $input.first().json;
   // ... rest of code unchanged
   ```

### Verification After Rollback
1. Open form URL: `https://n8n.ii-us.com/form/feature-request`
2. Fill all fields including Target Repository (text input)
3. Submit and verify task envelope created with correct repository

## Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| GITHUB_TOKEN | GitHub API authentication | Yes |
| AZURE_STORAGE_SAS_TOKEN | (Existing) Blob storage | Yes |
| TEAMS_WEBHOOK_URL | (Existing) Notifications | Optional |

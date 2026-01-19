# Schema Versioning Strategy

**Branch**: `011-autonomous-agents` | **Date**: 2026-01-19
**Purpose**: Define versioning, compatibility, and migration patterns for task envelopes and artifacts

## Table of Contents

1. [Version Format](#1-version-format)
2. [Compatibility Rules](#2-compatibility-rules)
3. [Migration Strategy](#3-migration-strategy)
4. [Schema Registry](#4-schema-registry)
5. [Validation](#5-validation)

---

## 1. Version Format

### 1.1 Semantic Versioning

All schemas use semantic versioning: `MAJOR.MINOR.PATCH`

| Component | When to Increment | Compatibility |
|-----------|-------------------|---------------|
| **MAJOR** | Breaking changes (field removal, type change, semantic change) | NOT backward compatible |
| **MINOR** | Additive changes (new optional fields, new enum values) | Backward compatible |
| **PATCH** | Bug fixes, documentation, no structural changes | Fully compatible |

### 1.2 Schema Header

Every schema file includes version metadata:

```yaml
# task-envelope-schema.yaml
$schema: "https://json-schema.org/draft/2020-12/schema"
$id: "https://ii-us.github.io/schemas/task-envelope/v1.2.0"
title: "Task Envelope Schema"
version: "1.2.0"
x-compatibility:
  minimum_supported: "1.0.0"
  deprecated_fields: []
  added_in_version:
    clarifications: "1.1.0"
    notification_ids: "1.2.0"
```

### 1.3 Document Version Field

Task envelopes include a `schema_version` field:

```yaml
# task-envelope.yml
schema_version: "1.2.0"
task_id: "FEAT-20260119-abc123"
# ... rest of envelope
```

---

## 2. Compatibility Rules

### 2.1 Backward Compatibility (Reader)

Newer readers MUST handle older documents:

```
Reader v1.2 → Document v1.0 ✅ MUST work
Reader v1.2 → Document v1.1 ✅ MUST work
Reader v1.2 → Document v1.2 ✅ MUST work
Reader v1.2 → Document v2.0 ❌ MAY fail
```

**Implementation**:
- Treat missing optional fields as defaults
- Ignore unknown fields (don't fail on extra fields)
- Use `additionalProperties: true` in schemas

### 2.2 Forward Compatibility (Writer)

Older readers SHOULD handle newer documents (within MINOR):

```
Reader v1.0 → Document v1.1 ⚠️ SHOULD work (ignore new fields)
Reader v1.0 → Document v1.2 ⚠️ SHOULD work (ignore new fields)
Reader v1.0 → Document v2.0 ❌ WILL fail (major change)
```

**Implementation**:
- New fields are always optional for one MINOR version
- Required fields become mandatory after one release cycle
- Breaking changes reserved for MAJOR versions only

### 2.3 Compatibility Matrix

| Schema | Minimum Reader | Maximum Reader |
|--------|----------------|----------------|
| v1.0.0 | v1.0.0 | latest v1.x |
| v1.1.0 | v1.0.0 | latest v1.x |
| v1.2.0 | v1.0.0 | latest v1.x |
| v2.0.0 | v2.0.0 | latest v2.x |

---

## 3. Migration Strategy

### 3.1 Migration Triggers

Migrations run:
1. **On read**: Lazy migration when loading older documents
2. **Batch**: Scheduled job to upgrade all documents (before MAJOR release)
3. **On write**: Always write current schema version

### 3.2 Migration Functions

Each version bump has a migration function:

```javascript
// migrations/task-envelope.js

const migrations = {
  // v1.0.0 → v1.1.0: Add clarifications array
  "1.0.0→1.1.0": (envelope) => ({
    ...envelope,
    request: {
      ...envelope.request,
      clarifications: envelope.request.clarifications || []
    },
    schema_version: "1.1.0"
  }),

  // v1.1.0 → v1.2.0: Add notification tracking
  "1.1.0→1.2.0": (envelope) => ({
    ...envelope,
    notification_ids: envelope.notification_ids || [],
    schema_version: "1.2.0"
  }),

  // v1.x → v2.0.0: Restructure phases (BREAKING)
  "1.2.0→2.0.0": (envelope) => {
    // Complex migration with data transformation
    return {
      schema_version: "2.0.0",
      task_id: envelope.task_id,
      // ... restructured format
    };
  }
};

function migrate(envelope, targetVersion) {
  let current = envelope.schema_version || "1.0.0";
  while (current !== targetVersion) {
    const key = `${current}→${getNextVersion(current, targetVersion)}`;
    if (!migrations[key]) {
      throw new Error(`No migration path from ${current} to ${targetVersion}`);
    }
    envelope = migrations[key](envelope);
    current = envelope.schema_version;
  }
  return envelope;
}
```

### 3.3 Migration Safety

| Scenario | Handling |
|----------|----------|
| Missing `schema_version` | Assume v1.0.0 |
| Unknown version | Fail loudly, alert operator |
| Migration error | Preserve original, log error, alert |
| Partial migration | Rollback, retry with backoff |

### 3.4 MAJOR Version Upgrade Process

For breaking changes (v1.x → v2.0):

1. **Announce**: Document breaking changes 2 sprints before
2. **Dual-write**: Write both v1 and v2 formats during transition
3. **Migrate batch**: Run batch migration on existing documents
4. **Validate**: Verify all documents migrated successfully
5. **Cutover**: Switch readers to v2, stop dual-write
6. **Cleanup**: Remove v1 support after grace period (1 sprint)

---

## 4. Schema Registry

### 4.1 Storage Location

Schemas stored in repository under `schemas/`:

```
schemas/
├── task-envelope/
│   ├── v1.0.0.yaml
│   ├── v1.1.0.yaml
│   ├── v1.2.0.yaml
│   └── current.yaml      # Symlink to latest
├── verification-report/
│   ├── v1.0.0.yaml
│   └── current.yaml
├── review-report/
│   ├── v1.0.0.yaml
│   └── current.yaml
└── README.md             # Schema catalog
```

### 4.2 Schema URLs

Published schemas use consistent URLs:

```
# Versioned URL (immutable)
https://ii-us.github.io/schemas/task-envelope/v1.2.0

# Latest URL (mutable)
https://ii-us.github.io/schemas/task-envelope/latest
```

### 4.3 Schema Discovery

Blob State Manager validates against schemas:

```yaml
# n8n workflow node
validate_schema:
  schema_url: "{{ $env.SCHEMA_BASE_URL }}/task-envelope/current.yaml"
  document: "{{ $json.task_envelope }}"
  on_error: "reject"  # or "warn", "migrate"
```

---

## 5. Validation

### 5.1 Validation Points

| Point | When | Action on Failure |
|-------|------|-------------------|
| Form submission | Before task creation | Reject with error message |
| Task envelope read | After blob download | Attempt migration |
| Task envelope write | Before blob upload | Fail workflow, alert |
| Artifact upload | Before blob upload | Fail with schema errors |
| API response | Before HTTP response | Fail request |

### 5.2 Validation Library

Use `ajv` with strict mode:

```javascript
const Ajv = require('ajv/dist/2020');
const ajv = new Ajv({
  strict: true,
  allErrors: true,
  removeAdditional: false,  // Preserve unknown fields
  useDefaults: true,        // Apply default values
});

// Load schema
const schema = require('./schemas/task-envelope/current.yaml');
const validate = ajv.compile(schema);

// Validate
const valid = validate(envelope);
if (!valid) {
  console.error(validate.errors);
}
```

### 5.3 Error Messages

Validation errors include actionable information:

```json
{
  "valid": false,
  "schema_version": "1.2.0",
  "errors": [
    {
      "path": "/request/priority",
      "message": "must be one of: low, medium, high, critical",
      "value": "urgent",
      "suggestion": "Use 'critical' for highest priority"
    },
    {
      "path": "/phases/implementation/current_task",
      "message": "must be >= 1",
      "value": 0
    }
  ]
}
```

---

## 6. Changelog

### v1.0.0 (Initial Release)
- Task envelope schema
- Verification report schema
- Review report schema

### v1.1.0 (Clarification Support)
- Added: `request.clarifications[]` array
- Added: `escalations[].resolved_at` field

### v1.2.0 (Notification Tracking)
- Added: `notification_ids[]` for deduplication
- Added: `phases.*.agent_invocations` counter

---

## Summary

This versioning strategy ensures:

1. **Stability**: Breaking changes are rare and well-communicated
2. **Compatibility**: Older documents work with newer code
3. **Migratability**: Clear path to upgrade documents
4. **Discoverability**: Schemas are versioned, documented, and accessible
5. **Validation**: Documents are validated at every boundary

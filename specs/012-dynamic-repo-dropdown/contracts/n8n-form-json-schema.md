# Contract: n8n Form JSON Definition

**Feature**: 012-dynamic-repo-dropdown
**Date**: 2026-01-20
**Type**: Internal (n8n Form Node)

## Schema

The n8n Form node accepts a JSON array defining form fields when using "Define Form > Using JSON".

### FormFieldDefinition[]

```typescript
interface FormFieldDefinition {
  fieldLabel: string;        // Required: Label displayed above field
  fieldType: FormFieldType;  // Required: Type of form element
  requiredField?: boolean;   // Optional: Whether field is mandatory
  placeholder?: string;      // Optional: Placeholder text (text/textarea/email/password/number)
  fieldOptions?: FieldOptions; // Required for dropdown type
  multiselect?: boolean;     // Optional: Allow multiple selections (dropdown only)
  formatDate?: string;       // Optional: Date format (date type only)
  multipleFiles?: boolean;   // Optional: Allow multiple files (file type only)
  acceptFileTypes?: string;  // Optional: Allowed file extensions (file type only)
}

type FormFieldType =
  | 'text'
  | 'textarea'
  | 'dropdown'
  | 'date'
  | 'email'
  | 'number'
  | 'password'
  | 'file';

interface FieldOptions {
  values: DropdownOption[];
}

interface DropdownOption {
  option: string;  // Display value and submission value
}
```

## Feature-Specific Schemas

### Success Case: Dynamic Dropdown

When repositories are successfully fetched, render dropdown with repo options.

```json
[
  {
    "fieldLabel": "Target Repository",
    "fieldType": "dropdown",
    "requiredField": true,
    "fieldOptions": {
      "values": [
        { "option": "ii-us/analytics-service" },
        { "option": "ii-us/n8n-claude-code-agent" },
        { "option": "ii-us/ops-dashboard" }
      ]
    }
  }
]
```

### Fallback Case: Text Input

When repository fetch fails, render text input with error message.

```json
[
  {
    "fieldLabel": "Target Repository (Unable to load repository list)",
    "fieldType": "text",
    "requiredField": true,
    "placeholder": "ii-us/repository-name"
  }
]
```

## n8n Code Node: Transform Repos to Form JSON

```javascript
// Input: GitHub API response in $json (array of repositories)
// Output: Form field definition for Target Repository dropdown

const repos = $input.all().map(item => item.json);

// Filter out archived repos and sort alphabetically
const activeRepos = repos
  .filter(repo => !repo.archived)
  .sort((a, b) => a.full_name.localeCompare(b.full_name));

// Transform to n8n dropdown format
const dropdownOptions = activeRepos.map(repo => ({
  option: repo.full_name
}));

// Return form field definition
return [{
  json: {
    formFields: [
      {
        fieldLabel: "Target Repository",
        fieldType: "dropdown",
        requiredField: true,
        fieldOptions: {
          values: dropdownOptions
        }
      }
    ],
    repoCount: dropdownOptions.length
  }
}];
```

## n8n Form Node Configuration

When using "Define Form > Using JSON", the form definition expression:

```javascript
// In n8n Form node "Form Fields (JSON)" parameter
={{ $json.formFields }}
```

Or as a complete form definition including all step 2 fields:

```javascript
=[
  {
    "fieldLabel": "Target Repository",
    "fieldType": "dropdown",
    "requiredField": true,
    "fieldOptions": {
      "values": {{ JSON.stringify($json.dropdownOptions) }}
    }
  }
]
```

## Validation Rules

| Rule | Enforcement |
|------|-------------|
| `fieldLabel` must be non-empty | n8n form rendering |
| `fieldType` must be valid type | n8n form rendering |
| Dropdown must have at least 1 option | Custom (pre-render check) |
| `requiredField` applies client-side | Browser validation |

## Error Handling

If `dropdownOptions` is empty or undefined:
1. Check if API returned empty array (no repos) vs error
2. For empty: Show message "No repositories found in organization"
3. For error: Fall back to text input with error message in label

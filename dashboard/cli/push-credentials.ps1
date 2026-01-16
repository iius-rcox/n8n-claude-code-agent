<#
.SYNOPSIS
    Push Claude credentials to the Operations Dashboard for token refresh.

.DESCRIPTION
    This script reads local Claude credentials and settings files, then sends them
    to the Operations Dashboard API to complete a token refresh workflow.

.PARAMETER DashboardUrl
    The base URL of the Operations Dashboard (e.g., https://ops-dashboard.yourdomain.com)

.PARAMETER SessionToken
    The Azure AD session token (Bearer token) for authentication

.EXAMPLE
    .\push-credentials.ps1 -DashboardUrl "https://ops-dashboard.example.com" -SessionToken "eyJ..."

.NOTES
    Prerequisites:
    - Run `claude /login` first to generate fresh credentials
    - Must have valid session token from Operations Dashboard
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$DashboardUrl,

    [Parameter(Mandatory = $true)]
    [string]$SessionToken
)

# Exit codes
$EXIT_SUCCESS = 0
$EXIT_CREDENTIALS_NOT_FOUND = 1
$EXIT_SETTINGS_NOT_FOUND = 2
$EXIT_API_ERROR = 3
$EXIT_INVALID_RESPONSE = 4

# Credential file paths
$credentialsPath = "$env:USERPROFILE\.claude\.credentials.json"
$settingsPath = "$env:USERPROFILE\.claude\settings.json"

Write-Host "Claude Credentials Push Script" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check if credentials file exists
if (-not (Test-Path $credentialsPath)) {
    Write-Error "Credentials file not found at: $credentialsPath"
    Write-Host ""
    Write-Host "Run 'claude /login' first to generate credentials." -ForegroundColor Yellow
    exit $EXIT_CREDENTIALS_NOT_FOUND
}

# Check if settings file exists
if (-not (Test-Path $settingsPath)) {
    Write-Error "Settings file not found at: $settingsPath"
    Write-Host ""
    Write-Host "Run 'claude /login' first to generate settings." -ForegroundColor Yellow
    exit $EXIT_SETTINGS_NOT_FOUND
}

Write-Host "Reading credentials from: $credentialsPath" -ForegroundColor Gray
Write-Host "Reading settings from: $settingsPath" -ForegroundColor Gray
Write-Host ""

# Read file contents
try {
    $credentials = Get-Content $credentialsPath -Raw -ErrorAction Stop
    $settings = Get-Content $settingsPath -Raw -ErrorAction Stop
}
catch {
    Write-Error "Failed to read credential files: $_"
    exit $EXIT_CREDENTIALS_NOT_FOUND
}

# Validate credentials JSON has required structure
try {
    $credObj = $credentials | ConvertFrom-Json
    if (-not $credObj.claudeAiOauth) {
        Write-Error "Invalid credentials: missing claudeAiOauth"
        exit $EXIT_INVALID_RESPONSE
    }
    if (-not $credObj.claudeAiOauth.accessToken) {
        Write-Error "Invalid credentials: missing accessToken"
        exit $EXIT_INVALID_RESPONSE
    }
}
catch {
    Write-Error "Invalid credentials JSON format: $_"
    exit $EXIT_INVALID_RESPONSE
}

# Prepare API request
$apiUrl = "$DashboardUrl/api/credentials/push"
$headers = @{
    "Authorization" = "Bearer $SessionToken"
    "Content-Type"  = "application/json"
}

$body = @{
    credentials = $credentials
    settings    = $settings
} | ConvertTo-Json -Depth 10

Write-Host "Pushing credentials to: $apiUrl" -ForegroundColor Gray
Write-Host ""

# Send request
try {
    $response = Invoke-RestMethod -Uri $apiUrl -Method POST -Headers $headers -Body $body -ErrorAction Stop

    if ($response.success) {
        Write-Host "SUCCESS: Credentials pushed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Operation ID: $($response.operationId)" -ForegroundColor Cyan
        Write-Host "Message: $($response.message)" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "The token refresh is now in progress." -ForegroundColor Yellow
        Write-Host "Check the Operations Dashboard for status updates." -ForegroundColor Yellow
        exit $EXIT_SUCCESS
    }
    else {
        Write-Error "Push failed: $($response.error)"
        exit $EXIT_API_ERROR
    }
}
catch {
    $statusCode = $_.Exception.Response.StatusCode.value__

    if ($statusCode -eq 401) {
        Write-Error "Authentication failed. Your session token may have expired."
        Write-Host ""
        Write-Host "Please initiate a new token refresh from the Operations Dashboard." -ForegroundColor Yellow
    }
    elseif ($statusCode -eq 404) {
        Write-Error "No pending refresh operation found."
        Write-Host ""
        Write-Host "Please initiate a token refresh from the Operations Dashboard first." -ForegroundColor Yellow
    }
    elseif ($statusCode -eq 400) {
        Write-Error "Invalid credentials format."
        Write-Host ""
        Write-Host "Try running 'claude /login' again to generate fresh credentials." -ForegroundColor Yellow
    }
    elseif ($statusCode -eq 409) {
        Write-Error "A token refresh is already in progress."
        Write-Host ""
        Write-Host "Wait for the current refresh to complete or check the dashboard." -ForegroundColor Yellow
    }
    else {
        Write-Error "API request failed: $_"
    }

    exit $EXIT_API_ERROR
}

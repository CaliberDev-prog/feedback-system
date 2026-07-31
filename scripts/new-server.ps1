# ============================================================================
# new-server.ps1 - Create a brand-new, isolated Cloudflare Workers deployment.
#
# Run from the project root:  npm run new
# Or directly:               powershell -ExecutionPolicy Bypass -File scripts/new-server.ps1
#
# What it does:
#   1. Verifies you are logged in to Cloudflare (wrangler).
#   2. Asks for an instance name + branding info.
#   3. Creates a NEW KV namespace and a NEW D1 database (never touches existing ones).
#   4. Backs up wrangler.toml and writes a fresh one (new worker name, no custom domain).
#   5. Optionally rebrands public/config.js + worker/database/seed.js.
#   6. Deploys the new Worker.
#   7. Sets ADMIN_PASSWORD, DISCORD_WEBHOOK_URL, and SESSION_SECRET secrets.
#   8. Smoke-tests the new URL and prints the admin login link.
#
# Safe preview: pass -DryRun to see the plan + generated wrangler.toml without
# creating or changing anything.
# ============================================================================

[CmdletBinding()]
param(
  [string]$Name,           # instance slug, e.g. "calibers-igloo-feedback"
  [string]$SiteName,       # display name, e.g. "Caliber's Igloo"
  [string]$AccentColor,    # hex color, e.g. "#5865F2"
  [string]$AdminPassword,  # dashboard password
  [string]$WebhookUrl,     # Discord webhook URL
  [switch]$SkipRebrand,    # do not touch config.js / seed.js
  [switch]$DryRun          # print plan only, change nothing
)

$ErrorActionPreference = 'Continue'
$RepoRoot   = Split-Path -Parent $PSScriptRoot
$NPX        = 'npx.cmd'
$OLDNAMESUB = "Kwan's Performance Hub Feedback"
$OLDNAME    = "Kwan's Performance Hub"
$OLDNAMEESC = "Kwan\'s Performance Hub"
$OLDACCENT  = '#5865F2'

function Write-Step([string]$msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok([string]$msg)   { Write-Host "   OK: $msg" -ForegroundColor Green }
function Write-Warn([string]$msg) { Write-Host "   WARN: $msg" -ForegroundColor Yellow }

function Get-SecureStringValue([System.Security.SecureString]$sec) {
  if (-not $sec) { return '' }
  $ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  try { return [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

function Test-Slug([string]$s) {
  return ($s -match '^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$')
}

function Test-HexColor([string]$s) {
  return ($s -match '^#[0-9A-Fa-f]{6}$')
}

# --- Gather config ---------------------------------------------------------
Write-Host ""
Write-Host "========================================================" -ForegroundColor Magenta
Write-Host "  New isolated Cloudflare Workers deployment" -ForegroundColor Magenta
Write-Host "========================================================" -ForegroundColor Magenta
Write-Host "This creates a NEW Worker, KV namespace, and D1 database." -ForegroundColor Yellow
Write-Host "It never reuses or touches the existing deployment." -ForegroundColor Yellow

# --- 0. Preflight ----------------------------------------------------------
if (-not (Get-Command curl.exe -ErrorAction SilentlyContinue)) {
  Write-Warn "curl.exe not found; smoke test will be skipped."
}
if (-not (Test-Path (Join-Path $RepoRoot 'node_modules\.bin\wrangler.cmd'))) {
  Write-Host "`nWrangler is not installed. Run this first:" -ForegroundColor Red
  Write-Host "   npm install" -ForegroundColor White
  exit 1
}

$who = & $NPX --no-install wrangler whoami 2>&1 | Out-String
if ($who -notmatch 'Logged in') {
  Write-Host "`nYou are not logged in to Cloudflare." -ForegroundColor Red
  Write-Host "Run:  npx wrangler login" -ForegroundColor White
  exit 1
}
Write-Ok "Cloudflare login confirmed"

# --- 1. Instance name ------------------------------------------------------
if (-not $Name) {
  $Name = Read-Host "`nInstance name (lowercase, no spaces, e.g. calibers-igloo-feedback)"
}
$Name = $Name.Trim().ToLowerInvariant()
while (-not (Test-Slug $Name)) {
  $Name = (Read-Host "Invalid name. Use lowercase letters, numbers, hyphens (e.g. calibers-igloo-feedback)").Trim().ToLowerInvariant()
}
Write-Ok "Worker name: $Name"

# --- 2. Branding -----------------------------------------------------------
if (-not $SiteName) {
  $SiteName = Read-Host "`nSite display name shown on the form (e.g. Caliber's Igloo) [default: $Name]"
  if (-not $SiteName) { $SiteName = $Name }
}
if (-not $AccentColor) {
  $AccentColor = Read-Host "`nAccent color as #RRGGBB [default: $OLDACCENT]"
  if (-not $AccentColor) { $AccentColor = $OLDACCENT }
}
while (-not (Test-HexColor $AccentColor)) {
  $AccentColor = Read-Host "Invalid color. Use format #RRGGBB (e.g. #5865F2)"
}

# --- 3. Secrets ------------------------------------------------------------
if (-not $AdminPassword) {
  do {
    $pw1 = Read-Host "`nAdmin dashboard password (min 8 characters)" -AsSecureString
    $pw2 = Read-Host 'Confirm admin dashboard password' -AsSecureString
    $AdminPassword = Get-SecureStringValue $pw1
    if ($AdminPassword -ne (Get-SecureStringValue $pw2)) {
      Write-Warn "Passwords do not match."
      $AdminPassword = ''
    } elseif ($AdminPassword.Length -lt 8) {
      Write-Warn "Password must be at least 8 characters."
      $AdminPassword = ''
    }
  } while (-not $AdminPassword)
}
while ($AdminPassword.Length -lt 8) {
  Write-Warn "Password must be at least 8 characters."
  $AdminPassword = Read-Host "Admin dashboard password (min 8 characters)" -AsSecureString | Get-SecureStringValue
}

if (-not $WebhookUrl) {
  $WebhookUrl = Read-Host "`nDiscord webhook URL (paste from channel Integrations -> Webhooks)"
}
while (-not ($WebhookUrl -match '^https://')) {
  $WebhookUrl = Read-Host "Webhook URL must start with https://. Paste the webhook URL:"
}

$rebrand = -not $SkipRebrand
if (-not $SkipRebrand) {
  $ans = Read-Host "`nRebrand this copy from ""Kwan's Performance Hub"" to ""$SiteName""? (Y/n)"
  if ($ans -and $ans.ToLowerInvariant() -ne 'y') { $rebrand = $false }
}

# --- 4. Confirm ------------------------------------------------------------
$oldToml = Get-Content -Raw (Join-Path $RepoRoot 'wrangler.toml')
$accountId = ''
if ($oldToml -match 'account_id\s*=\s*"([^"]+)"') { $accountId = $Matches[1] }

Write-Host ""
Write-Host "==================== PLAN ====================" -ForegroundColor Cyan
Write-Host "  Worker name : $Name"
Write-Host "  Site name   : $SiteName"
Write-Host "  Accent      : $AccentColor"
Write-Host "  Webhook     : $($WebhookUrl.Substring(0, [Math]::Min(40, $WebhookUrl.Length)))..."
Write-Host "  Rebrand     : $(if ($rebrand) {'yes'} else {'no'})"
Write-Host "  New KV + D1 : yes (brand new resources)"
Write-Host "  Custom dom  : none (workers.dev URL for now)"
Write-Host "  wrangler.toml will be backed up first."
if ($DryRun) { Write-Host "  MODE        : DRY RUN - nothing will be created or changed" -ForegroundColor Yellow }
Write-Host "==============================================" -ForegroundColor Cyan

if (-not $DryRun) {
  $go = Read-Host "`nProceed? (y/N)"
  if (-not $go -or $go.ToLowerInvariant() -ne 'y') { Write-Host "Aborted."; exit 0 }
}

# --- 5. Generate wrangler.toml content ------------------------------------
$toml = @'
name = "__NAME__"
main = "worker/index.js"
compatibility_date = "2026-07-01"
account_id = "__ACCOUNT_ID__"

[assets]
directory = "./public"
binding = "ASSETS"

[vars]
RATE_LIMIT_MAX = "20"
RATE_LIMIT_WINDOW = "60"
ADMIN_SESSION_TTL = "86400"
CORS_ORIGIN = ""

[[kv_namespaces]]
binding = "FEEDBACK_KV"
id = "__KV_ID__"
preview_id = "__KV_ID__"

[[d1_databases]]
binding = "DB"
database_name = "__DB_NAME__"
database_id = "__DB_ID__"
'@

if ($DryRun) {
  Write-Host "`n=== Preview: wrangler.toml that would be written ===" -ForegroundColor Cyan
  $preview = $toml.Replace('__NAME__', $Name).Replace('__KV_ID__', '<NEW-KV-ID>').Replace('__DB_NAME__', $Name).Replace('__DB_ID__', '<NEW-D1-ID>').Replace('__ACCOUNT_ID__', $accountId)
  Write-Host $preview
  Write-Host "`nDry run complete - nothing was changed." -ForegroundColor Green
  exit 0
}

# --- 6. Create resources ---------------------------------------------------
Write-Step "Creating a new KV namespace"
Write-Host "   creating KV namespace $Name-kv ..." -ForegroundColor DarkGray
$kvOut = & $NPX --no-install wrangler kv namespace create "$Name-kv" 2>&1 | Out-String
if ($kvOut -notmatch 'id\s*=\s*"([a-f0-9]+)"') {
  Write-Host "Could not create KV namespace. Output:" -ForegroundColor Red
  Write-Host $kvOut
  exit 1
}
$kvId = $Matches[1]
Write-Ok "KV namespace id: $kvId"

Write-Step "Creating a new D1 database"
Write-Host "   creating D1 database $Name ..." -ForegroundColor DarkGray
$d1Out = & $NPX --no-install wrangler d1 create $Name 2>&1 | Out-String
if ($d1Out -notmatch 'database_id\s*=\s*"([a-f0-9-]+)"' -and $d1Out -notmatch '"uuid"\s*:\s*"([a-f0-9-]+)"') {
  Write-Host "Could not create D1 database. Output:" -ForegroundColor Red
  Write-Host $d1Out
  exit 1
}
$d1Id = $Matches[1]
Write-Ok "D1 database id: $d1Id"

# --- 7. Write wrangler.toml -------------------------------------------------
Write-Step "Writing wrangler.toml (backing up the old one first)"
$bak = Join-Path $RepoRoot ("wrangler.toml.backup-" + (Get-Date -Format 'yyyyMMdd-HHmmss'))
Copy-Item (Join-Path $RepoRoot 'wrangler.toml') $bak
Write-Ok "Backup saved to $bak"

$newToml = $toml.Replace('__NAME__', $Name).Replace('__KV_ID__', $kvId).Replace('__DB_NAME__', $Name).Replace('__DB_ID__', $d1Id).Replace('__ACCOUNT_ID__', $accountId)
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path $RepoRoot 'wrangler.toml'), $newToml, $utf8NoBom)
Write-Ok "wrangler.toml updated (new worker + new storage)"

# --- 8. Rebrand ------------------------------------------------------------
if ($rebrand) {
  Write-Step "Rebranding form and backend defaults"
  $escapedName = $SiteName.Replace("'", "\'")
  foreach ($file in @('public\config.js', 'worker\database\seed.js')) {
    $path = Join-Path $RepoRoot $file
    $content = [System.IO.File]::ReadAllText($path, $utf8NoBom)
    $content = $content.Replace($OLDNAMESUB, $SiteName)
    $content = $content.Replace($OLDNAMEESC, $escapedName)
    $content = $content.Replace($OLDNAME, $SiteName)
    if ($AccentColor -ne $OLDACCENT) { $content = $content.Replace($OLDACCENT, $AccentColor) }
    [System.IO.File]::WriteAllText($path, $content, $utf8NoBom)
    Write-Ok "Rebranded $file"
  }
  Write-Warn "Fine-tune the questions/description in public/config.js and the admin dashboard if needed."
} else {
  Write-Ok "Rebrand skipped"
}

# --- 9. Deploy -------------------------------------------------------------
Write-Step "Deploying the new Worker"
$deployOut = & $NPX --no-install wrangler deploy 2>&1 | Out-String
$url = ''
if ($deployOut -match '(https://[\w.-]+\.workers\.dev)') { $url = $Matches[1] }
if (-not $url) {
  Write-Host "Deploy output:" -ForegroundColor Red
  Write-Host $deployOut
  exit 1
}
Write-Ok "Deployed to $url"

# --- 10. Secrets -----------------------------------------------------------
Write-Step "Setting secrets (needed before the first API request)"
$sessionSecret = -join ((1..48 | ForEach-Object { (Get-Random -Minimum 0 -Maximum 255).ToString('x2') }))
"$AdminPassword" | & $NPX --no-install wrangler secret put ADMIN_PASSWORD 2>&1 | Out-Null
"$WebhookUrl" | & $NPX --no-install wrangler secret put DISCORD_WEBHOOK_URL 2>&1 | Out-Null
"$sessionSecret" | & $NPX --no-install wrangler secret put SESSION_SECRET 2>&1 | Out-Null
Write-Ok "Secrets set: ADMIN_PASSWORD, DISCORD_WEBHOOK_URL, SESSION_SECRET"

# --- 11. Smoke test ---------------------------------------------------------
Write-Step "Smoke-testing the new URL"
$configUrl = "$url/api/v1/public/config"
$ok = $false
for ($i = 1; $i -le 4; $i++) {
  $code = & curl.exe -s -o NUL -w '%{http_code}' $configUrl 2>$null
  Write-Host "   attempt $i -> HTTP $code"
  if ($code -eq '200') { $ok = $true; break }
  Start-Sleep -Seconds 3
}
if (-not $ok) { Write-Warn "Smoke test did not return 200 yet. The Worker may still be initializing; check $configUrl in a minute." }

# --- 12. Summary ------------------------------------------------------------
Write-Host ""
Write-Host "==================== DONE ====================" -ForegroundColor Green
Write-Host "  Site      : $url"
Write-Host "  Admin     : $url/admin/"
Write-Host "  Username  : admin"
Write-Host "  Password  : (the one you entered)"
Write-Host "  Storage   : brand-new KV + D1 (isolated)"
Write-Host "  Backup    : $bak"
Write-Host "==============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Open the admin dashboard, log in, and set your webhook is working by submitting a test."
Write-Host "  2. To add a custom domain: Cloudflare dashboard -> Workers & Pages -> $Name -> Settings -> Triggers -> Custom Domains."
Write-Host "  3. To rebrand questions/colors/text further, edit public/config.js and redeploy (npm run deploy)."
Write-Host ""

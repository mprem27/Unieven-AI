[CmdletBinding()]
param([switch]$ReconfigureAtlas, [switch]$ConfigureOnly, [switch]$UseExistingAdministrator, [switch]$DevelopmentInbox, [int]$Port = 4100, [ValidateSet('PostgreSQL','Atlas')][string]$Database = 'PostgreSQL')
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'scripts/CampusTools.psm1') -Force
$private = Join-Path $PSScriptRoot '.private'
$campusFile = Join-Path $private 'campus.env'
if ((Test-Path $campusFile) -and -not $ReconfigureAtlas) {
 $existing = Read-CampusEnvironment $campusFile
 if (-not $PSBoundParameters.ContainsKey('Port')) { $Port = [int]$existing.CAMPUS_PUBLIC_PORT }
 if ($PSBoundParameters.ContainsKey('Port') -and [int]$existing.CAMPUS_PUBLIC_PORT -ne $Port) {
  $oldPort = $existing.CAMPUS_PUBLIC_PORT; $existing.CAMPUS_PUBLIC_PORT = [string]$Port
  $existing.CAMPUS_ORIGINS = $existing.CAMPUS_ORIGINS.Replace("localhost:$oldPort","localhost:$Port").Replace("127.0.0.1:$oldPort","127.0.0.1:$Port")
  Write-CampusEnvironment $campusFile $existing
 }
 if (-not (Test-Path (Join-Path $private 'academic.env'))) { throw 'Restore both private env files. Existing keys will not be replaced.' }
} elseif ($Database -eq 'PostgreSQL') {
 if ($ReconfigureAtlas) { throw 'An existing database cannot be switched automatically. Follow docs/V2-UPGRADE.md.' }
 Write-CampusPostgresConfiguration -Directory $private -Port $Port
} else {
 $uri = Read-CampusSecret 'Paste your MongoDB Atlas Drivers connection URI (hidden)'
 try { Write-CampusConfiguration -Directory $private -AtlasUri $uri -Port $Port } finally { $uri = $null }
}
[IO.File]::WriteAllText((Join-Path $PSScriptRoot '.env'), "CAMPUS_PUBLIC_PORT=$Port`n", (New-Object Text.UTF8Encoding($false)))
if ($DevelopmentInbox) { [IO.File]::WriteAllText((Join-Path $private 'dev-mail.enabled'), 'Local development inbox enabled.') }
Write-Output 'Private configuration and persistent keys are ready.'
if ($ConfigureOnly) { return }
Assert-CampusDocker
Push-Location $PSScriptRoot
try {
 $compose = @('compose', '-f', 'compose.yaml')
 if (Test-Path (Join-Path $private 'dev-mail.enabled')) { $compose += @('-f', 'compose.dev-mail.yaml') }
 if (Test-Path (Join-Path $private 'postgres.enabled')) { $compose += @('-f', 'compose.postgres.yaml') }
 & docker @compose build --pull
 if ($LASTEXITCODE -ne 0) { throw 'Docker build failed. Resolve the reported build error and rerun Setup.ps1.' }
 if (Test-Path (Join-Path $private 'postgres.enabled')) {
  & docker @compose up -d --wait --wait-timeout 180 postgres ferretdb
  if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL did not become ready. Inspect the database logs.' }
 }
 # The local marker is informational; the selected database is the authority.
 & docker @compose run --rm -T --no-deps campus node campus/provision.js --check-existing
 $adminStatus = $LASTEXITCODE
 if ($adminStatus -ne 0 -and $adminStatus -ne 2) { throw 'Could not check administrator existence. Check database access and retry.' }
 if ($UseExistingAdministrator -and $adminStatus -eq 2) { throw 'No existing administrator found. Rerun Setup.ps1 without UseExistingAdministrator.' }
 if ($adminStatus -eq 2) {
  $env:CAMPUS_ADMIN_EMAIL = Read-Host 'First administrator email'
  $env:CAMPUS_ADMIN_USERNAME = Read-Host 'First administrator username (3-30 lowercase letters/numbers/underscore/dot)'
  $env:CAMPUS_ADMIN_NAME = Read-Host 'First administrator name'
  $env:CAMPUS_ADMIN_PASSWORD = Read-CampusSecret 'First administrator password (16+ characters; hidden)'
  try {
   & docker @compose run --rm -T --no-deps -e CAMPUS_ADMIN_EMAIL -e CAMPUS_ADMIN_USERNAME -e CAMPUS_ADMIN_NAME -e CAMPUS_ADMIN_PASSWORD campus node campus/provision.js
   if ($LASTEXITCODE -ne 0) { throw 'Administrator provisioning failed. Check database access and the account requirements, then retry setup.' }
   [IO.File]::WriteAllText((Join-Path $private 'setup.complete'), 'Administrator provisioned. Keys must be retained.')
  } finally { foreach ($name in @('CAMPUS_ADMIN_EMAIL','CAMPUS_ADMIN_USERNAME','CAMPUS_ADMIN_NAME','CAMPUS_ADMIN_PASSWORD')) { [Environment]::SetEnvironmentVariable($name, $null, 'Process') } }
 }
} finally { Pop-Location }
& (Join-Path $PSScriptRoot 'Start.ps1')

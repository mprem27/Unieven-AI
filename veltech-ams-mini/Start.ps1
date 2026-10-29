$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'scripts/CampusTools.psm1') -Force
$file = Join-Path $PSScriptRoot '.private/campus.env'
if (-not (Test-Path $file) -or -not (Test-Path (Join-Path $PSScriptRoot '.private/academic.env'))) { throw 'Run Setup.ps1 from this project folder first.' }
Assert-CampusDocker
$settings = Read-CampusEnvironment $file; $port = [int]$settings.CAMPUS_PUBLIC_PORT
Push-Location $PSScriptRoot
try {
 $compose = @('compose', '-f', 'compose.yaml')
 if (Test-Path (Join-Path $PSScriptRoot '.private/postgres.enabled')) { $compose += @('-f', 'compose.postgres.yaml') }
 if (Test-Path (Join-Path $PSScriptRoot '.private/dev-mail.enabled')) { $compose += @('-f', 'compose.dev-mail.yaml') }
 & docker @compose up -d --wait --wait-timeout 180
 if ($LASTEXITCODE -ne 0) { throw 'A service did not become healthy. Check Docker Desktop and database access, then inspect docker compose logs.' }
 $health = Invoke-RestMethod -Uri "http://127.0.0.1:$port/api/campus/health" -TimeoutSec 15
 if ($health.status -ne 'ok') { throw 'The campus API did not pass its database health check.' }
 Write-Output "veltech-ams-mini is running. Open http://localhost:$port on this Windows computer."
 if (Test-Path (Join-Path $PSScriptRoot '.private/dev-mail.enabled')) { Write-Output 'Local development emails: http://localhost:8025 (no Internet mail delivery).' }
} finally { Pop-Location }

$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'scripts/CampusTools.psm1') -Force
Assert-CampusDocker
Push-Location $PSScriptRoot
try {
 $compose = @('compose', '-f', 'compose.yaml')
 if (Test-Path (Join-Path $PSScriptRoot '.private/postgres.enabled')) { $compose += @('-f', 'compose.postgres.yaml') }
 if (Test-Path (Join-Path $PSScriptRoot '.private/dev-mail.enabled')) { $compose += @('-f', 'compose.dev-mail.yaml') }
 & docker @compose stop
 if ($LASTEXITCODE -ne 0) { throw 'Docker could not stop the campus services.' }
 Write-Output 'Campus services stopped. Private configuration and database data are retained.'
} finally { Pop-Location }

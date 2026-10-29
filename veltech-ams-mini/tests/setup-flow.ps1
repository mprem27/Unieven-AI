$ErrorActionPreference='Stop'
function Assert($Condition,$Message){if(-not $Condition){throw $Message}}
$folder=Join-Path ([IO.Path]::GetTempPath()) ('campus-flow-'+[Guid]::NewGuid())
try {
 New-Item -ItemType Directory $folder | Out-Null
 New-Item -ItemType Directory (Join-Path $folder 'scripts') | Out-Null
 foreach($name in @('Setup.ps1','Start.ps1','Stop.ps1')){Copy-Item (Join-Path $PSScriptRoot ('../'+$name)) (Join-Path $folder $name)}
 Copy-Item (Join-Path $PSScriptRoot '../scripts/CampusTools.psm1') (Join-Path $folder 'scripts/CampusTools.psm1')
 Import-Module (Join-Path $folder 'scripts/CampusTools.psm1') -Force
 Write-CampusConfiguration -Directory (Join-Path $folder '.private') -AtlasUri 'mongodb+srv://fixture:fixture@qa.mongodb.net/'
 [IO.File]::WriteAllText((Join-Path $folder '.private/setup.complete'),'stale marker')
 $global:calls=New-Object Collections.Generic.List[string]
 $global:missingAdmin=$true
 function global:docker {
  $line=$args -join ' ';$global:calls.Add($line)
  if($line.Contains('--check-existing') -and $global:missingAdmin){$global:LASTEXITCODE=2}
  else {$global:LASTEXITCODE=0}
 }
 function global:Read-Host {
  param([string]$Prompt,[switch]$AsSecureString)
  if($AsSecureString){return ConvertTo-SecureString 'Fixture!AdminPassword1' -AsPlainText -Force}
  return 'fixture'
 }
 function global:Invoke-RestMethod {return @{status='ok'}}
 & (Join-Path $folder 'Setup.ps1')
 Assert (@($calls | Where-Object {$_ -like '*--check-existing*'}).Count -eq 1) 'Setup must query administrator existence even with a marker'
 Assert (@($calls | Where-Object {$_ -like '*-e CAMPUS_ADMIN_EMAIL*'}).Count -eq 1) 'An empty selected database must provision its own first admin'
 Assert (-not $env:CAMPUS_ADMIN_PASSWORD) 'Administrator password must be cleared'
 $global:calls.Clear();$global:missingAdmin=$false
 & (Join-Path $folder 'Setup.ps1')
 Assert (@($calls | Where-Object {$_ -like '*--check-existing*'}).Count -eq 1) 'Repeat setup must recheck selected database'
 Assert (@($calls | Where-Object {$_ -like '*-e CAMPUS_ADMIN_EMAIL*'}).Count -eq 0) 'Existing administrator must not be recreated'
 $global:calls.Clear()
 & (Join-Path $folder 'Setup.ps1') -DevelopmentInbox
 Assert (Test-Path (Join-Path $folder '.private/dev-mail.enabled')) 'Development inbox selection must persist for restart'
 Assert (@($calls | Where-Object {$_ -like '*-f compose.dev-mail.yaml*'}).Count -ge 3) 'Build, provision check and startup must use the selected inbox override'
 & (Join-Path $folder 'Stop.ps1')
 Assert (@($calls | Where-Object {$_ -like '*-f compose.dev-mail.yaml stop'}).Count -eq 1) 'Stop must include the inbox service'
 foreach($path in (Get-ChildItem $folder -Recurse -Include *.ps1,*.psm1)){
  $errors=$null;$tokens=$null;[System.Management.Automation.Language.Parser]::ParseFile($path.FullName,[ref]$tokens,[ref]$errors) | Out-Null
  Assert ($errors.Count -eq 0) 'PowerShell syntax must parse'
 }
 Write-Output 'PowerShell setup flow checks passed: stale marker, first admin, repeat setup, cleared password and syntax.'
} finally {
 foreach($name in @('docker','Read-Host','Invoke-RestMethod')){Remove-Item ('Function:global:'+$name) -ErrorAction SilentlyContinue}
 if(Test-Path $folder){Remove-Item $folder -Recurse -Force}
}

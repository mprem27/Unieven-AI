Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

function ConvertTo-CampusAtlasUri {
 param([string]$ConnectionString, [string]$Database)
 if ($ConnectionString -match '[\s<>#]' -or $ConnectionString -notmatch '^mongodb\+srv://([^/]+)(/[^?]*)?(\?.*)?$') { throw 'Enter a complete MongoDB Atlas SRV connection URI with its database user password.' }
 $authority = $Matches[1]; $options = $Matches[3]
 $parsed = $null
 if (-not [Uri]::TryCreate($ConnectionString, [UriKind]::Absolute, [ref]$parsed) -or -not $parsed.Host.EndsWith('.mongodb.net') -or @($authority.ToCharArray() | Where-Object { $_ -eq '@' }).Count -ne 1 -or $parsed.UserInfo -notmatch '^[^:]+:[^:]+$') { throw 'Invalid Atlas connection URI. Use the Drivers connection string and URL-encode reserved password characters.' }
 foreach ($part in ($parsed.Query.TrimStart('?') -split '&')) {
  $pair = $part -split '=', 2
  $key = [Uri]::UnescapeDataString($pair[0]).ToLowerInvariant()
  $value = if ($pair.Count -gt 1) { [Uri]::UnescapeDataString($pair[1]).ToLowerInvariant() } else { '' }
  if ((@('tls','ssl') -contains $key -and @('false','0') -contains $value) -or (@('tlsinsecure','tlsallowinvalidcertificates','tlsallowinvalidhostnames') -contains $key -and @('true','1') -contains $value)) { throw 'Atlas TLS and certificate verification must stay enabled.' }
 }
 if ($Database -notmatch '^[a-z0-9_]{1,63}$') { throw 'Invalid application database name.' }
 return 'mongodb+srv://' + $authority + '/' + $Database + $options
}

function New-CampusRandomHex {
 param([int]$Bytes = 32)
 $buffer = New-Object byte[] $Bytes; $random = [Security.Cryptography.RandomNumberGenerator]::Create()
 try { $random.GetBytes($buffer) } finally { $random.Dispose() }
 return -join ($buffer | ForEach-Object { $_.ToString('x2') })
}

function New-CampusFernetKey {
 $buffer = New-Object byte[] 32; $random = [Security.Cryptography.RandomNumberGenerator]::Create()
 try { $random.GetBytes($buffer) } finally { $random.Dispose() }
 return [Convert]::ToBase64String($buffer).Replace('+', '-').Replace('/', '_')
}

function Protect-CampusDirectory {
 param([string]$Directory)
 if ([Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT) {
  $owner = [Security.Principal.WindowsIdentity]::GetCurrent().Name
  $acl = New-Object Security.AccessControl.DirectorySecurity
  $acl.SetAccessRuleProtection($true, $false)
  $acl.SetOwner((New-Object Security.Principal.NTAccount($owner)))
  foreach ($identity in @($owner, 'NT AUTHORITY\SYSTEM')) {
   $rule = New-Object Security.AccessControl.FileSystemAccessRule($identity, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
   $acl.AddAccessRule($rule)
  }
  Set-Acl -LiteralPath $Directory -AclObject $acl
 } else { & chmod 700 $Directory; if ($LASTEXITCODE -ne 0) { throw 'Could not protect private configuration.' } }
}

function Read-CampusEnvironment {
 param([string]$File)
 $values = @{}
 foreach ($line in [IO.File]::ReadAllLines($File)) {
  if ($line -match '^([A-Z0-9_]+)=(.*)$') {
   $key = $Matches[1]; $value = $Matches[2]
   if ($value.StartsWith('"')) { $value = (ConvertFrom-Json $value).Replace('$$', '$') }
   $values[$key] = [string]$value
  }
 }
 return $values
}

function Write-CampusEnvironment {
 param([string]$File, [hashtable]$Values)
 $lines = foreach ($key in ($Values.Keys | Sort-Object)) { $key + '=' + (ConvertTo-Json (([string]$Values[$key]).Replace('$', '$$')) -Compress) }
 $temporary = $File + '.' + [Guid]::NewGuid() + '.tmp'
 try {
  [IO.File]::WriteAllLines($temporary, [string[]]$lines, (New-Object Text.UTF8Encoding($false)))
  if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { & chmod 600 $temporary }
  Move-Item -LiteralPath $temporary -Destination $File -Force
 } finally { if (Test-Path $temporary) { Remove-Item -LiteralPath $temporary -Force } }
}

function Write-CampusConfiguration {
 param([string]$Directory, [string]$AtlasUri, [int]$Port = 4100)
 $uri = ConvertTo-CampusAtlasUri $AtlasUri 'unieve_campus_v1'
 if ($Port -lt 1024 -or $Port -gt 65535) { throw 'Choose a web port between 1024 and 65535.' }
 [IO.Directory]::CreateDirectory($Directory) | Out-Null
 Protect-CampusDirectory $Directory
 $lock = [IO.File]::Open((Join-Path $Directory '.lock'), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
 try {
  $campusFile = Join-Path $Directory 'campus.env'; $academicFile = Join-Path $Directory 'academic.env'
  if ((Test-Path $campusFile) -xor (Test-Path $academicFile)) { throw 'Private configuration is incomplete. Restore both env files; keys will not be regenerated automatically.' }
  if (Test-Path $campusFile) {
   $campus = Read-CampusEnvironment $campusFile; $academic = Read-CampusEnvironment $academicFile
   if ($campus.CAMPUS_LINK_KEY -notmatch '^[a-f0-9]{64}$' -or $campus.CAMPUS_SERVICE_KEY -notmatch '^[a-f0-9]{64}$' -or $campus.CAMPUS_SERVICE_KEY -ne $academic.CAMPUS_SERVICE_KEY -or -not $academic.PORTAL_CREDENTIAL_ENCRYPTION_KEY) { throw 'Existing private keys are invalid or inconsistent. Restore your private configuration before continuing.' }
  } else {
   $shared = New-CampusRandomHex
   $campus = @{ CAMPUS_LINK_KEY = (New-CampusRandomHex); CAMPUS_SERVICE_KEY = $shared; NODE_ENV = 'production'; CAMPUS_HOST = '0.0.0.0'; CAMPUS_COOKIE_SECURE = 'false'; CAMPUS_PORT = '4100'; ACADEMIC_API_URL = 'http://academic:8000/api/v1'; CAMPUS_WEB_DIST = '/app/web'; CAMPUS_DOWNLOAD_DIR = '/app/downloads'; CAMPUS_MEDIA_DIR = '/app/media'; CAMPUS_BRIDGE_ENABLED = 'true'; RAZORPAY_KEY_ID = ''; RAZORPAY_KEY_SECRET = ''; RAZORPAY_WEBHOOK_SECRET = '' }
   $academic = @{ JWT_SECRET = (New-CampusRandomHex 48); PORTAL_CREDENTIAL_ENCRYPTION_KEY = (New-CampusFernetKey); CAMPUS_SERVICE_KEY = $shared; DEFAULT_ADMIN_EMAIL = 'local-admin@example.invalid'; DEFAULT_ADMIN_NAME = 'Academic service administrator'; DEFAULT_ADMIN_PASSWORD = (New-CampusRandomHex); MONGO_DB_NAME = 'unieve_campus_attendance_v1'; COLLEGE_ADAPTER_MODE = 'portal'; SYNC_ENABLED = 'false'; SMS_ENABLED = 'false'; EMAIL_ENABLED = 'false'; CORS_ORIGINS = '[]' }
  }
  $campus.MONGODB_URI = $uri; $academic.MONGO_URI = $uri
  $campus.CAMPUS_PUBLIC_PORT = [string]$Port
  $campus.CAMPUS_ORIGINS = (@("http://localhost:$Port", "http://127.0.0.1:$Port", "http://localhost:5173", "http://127.0.0.1:5173") | Select-Object -Unique) -join ','
  $campus.CAMPUS_MEDIA_DIR = '/app/media'
  Write-CampusEnvironment $campusFile $campus
  Write-CampusEnvironment $academicFile $academic
 } finally { $lock.Dispose() }
}

function Read-CampusSecret {
 param([string]$Prompt)
 $secure = Read-Host $Prompt -AsSecureString
 $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
 try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer); $secure.Dispose() }
}

function Assert-CampusDocker {
 if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Install Docker Desktop for Windows, open it and wait until its engine is running.' }
 $null = & docker version --format '{{.Server.Version}}' 2>$null
 if ($LASTEXITCODE -ne 0) { throw 'Docker Desktop is not running. Open it and wait for the engine before retrying.' }
 $null = & docker compose version 2>$null
 if ($LASTEXITCODE -ne 0) { throw 'Docker Compose is unavailable. Update Docker Desktop.' }
}

Export-ModuleMember -Function ConvertTo-CampusAtlasUri, Read-CampusEnvironment, Write-CampusConfiguration, Read-CampusSecret, Assert-CampusDocker

function Write-CampusPostgresConfiguration {
 param([string]$Directory, [int]$Port = 4100)
 if ($Port -lt 1024 -or $Port -gt 65535) { throw 'Choose a port between 1024 and 65535.' }
 [IO.Directory]::CreateDirectory($Directory) | Out-Null
 Protect-CampusDirectory $Directory
 foreach ($name in @('campus.env','academic.env','postgres.env','ferretdb.env')) { if (Test-Path (Join-Path $Directory $name)) { throw 'Existing configuration found. No database or keys were changed. Follow docs/V2-UPGRADE.md.' } }
 $password = New-CampusRandomHex; $shared = New-CampusRandomHex
 $campus = @{ NODE_ENV='production'; CAMPUS_HOST='0.0.0.0'; CAMPUS_PORT='4100'; CAMPUS_PUBLIC_PORT=[string]$Port; CAMPUS_COOKIE_SECURE='false'; CAMPUS_ORIGINS="http://localhost:$Port,http://127.0.0.1:$Port,http://localhost:5173,http://127.0.0.1:5173"; CAMPUS_LINK_KEY=(New-CampusRandomHex); CAMPUS_SERVICE_KEY=$shared; CAMPUS_BRIDGE_ENABLED='true'; ACADEMIC_API_URL='http://academic:8000/api/v1'; MONGODB_URI="mongodb://campus:${password}@ferretdb:27017/unieve_campus_v1?authSource=postgres"; CAMPUS_MEDIA_DIR='/app/media'; CAMPUS_WEB_DIST='/app/web'; CAMPUS_APK_DIRECTORY='/app/media/app-releases'; CAMPUS_RATE_LIMIT_STORE='mongo'; CAMPUS_MAIL_FROM=''; SMTP_HOST=''; SMTP_PORT='587'; SMTP_REQUIRE_TLS='true'; SMTP_USER=''; SMTP_PASS='' }
 $academic = @{ MONGO_URI="mongodb://campus:${password}@ferretdb:27017/unieve_campus_attendance_v1?authSource=postgres"; MONGO_DB_NAME='unieve_campus_attendance_v1'; CAMPUS_SERVICE_KEY=$shared; JWT_SECRET=(New-CampusRandomHex 48); PORTAL_CREDENTIAL_ENCRYPTION_KEY=(New-CampusFernetKey); DEFAULT_ADMIN_EMAIL='local-admin@example.invalid'; DEFAULT_ADMIN_NAME='Academic service administrator'; DEFAULT_ADMIN_PASSWORD=(New-CampusRandomHex); COLLEGE_ADAPTER_MODE='portal'; SYNC_ENABLED='false'; SMS_ENABLED='false'; EMAIL_ENABLED='false'; CORS_ORIGINS='[]' }
 Write-CampusEnvironment (Join-Path $Directory 'postgres.env') @{ POSTGRES_USER='campus'; POSTGRES_PASSWORD=$password; POSTGRES_DB='postgres' }
 Write-CampusEnvironment (Join-Path $Directory 'ferretdb.env') @{ FERRETDB_POSTGRESQL_URL="postgres://campus:${password}@postgres:5432/postgres" }
 Write-CampusEnvironment (Join-Path $Directory 'campus.env') $campus
 Write-CampusEnvironment (Join-Path $Directory 'academic.env') $academic
 [IO.File]::WriteAllText((Join-Path $Directory 'postgres.enabled'),'PostgreSQL + FerretDB')
}
Export-ModuleMember -Function Write-CampusPostgresConfiguration, Write-CampusEnvironment

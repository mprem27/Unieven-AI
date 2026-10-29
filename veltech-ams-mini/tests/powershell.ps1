$ErrorActionPreference = 'Stop'
function Assert($Condition, $Message) { if (-not $Condition) { throw "Assertion failed: $Message" } }
$module = Join-Path $PSScriptRoot '../scripts/CampusTools.psm1'
Assert (Test-Path $module) 'configuration helper must exist'
Import-Module $module -Force
$prefix = 'mongodb+srv://' + 'qa_user' + ':' + 'qa_secret%40encoded$literal' + '@qa.mongodb.net'
$uri = $prefix + '/old?retryWrites=true&w=majority'
Assert ((ConvertTo-CampusAtlasUri $uri 'unieve_campus_v1') -eq ($prefix + '/unieve_campus_v1?retryWrites=true&w=majority')) 'URI must preserve encoded credentials and options'
foreach ($bad in @('https://example.com', 'mongodb://localhost:27017', ($uri + '#fragment'), ($uri + "`nextra"), 'mongodb+srv://<user>:<password>@qa.mongodb.net', ($uri + '&tls=false'), ($uri + '&ssl=0'), ($uri + '&tlsAllowInvalidCertificates=true'), ($uri + '&tlsAllowInvalidHostnames=true'), ($uri + '&%74lsInsecure=1'))) {
 $rejected = $false
 try { ConvertTo-CampusAtlasUri $bad 'unieve_campus_v1' | Out-Null } catch { $rejected = $true; Assert (-not $_.Exception.Message.Contains('qa_secret')) 'errors must not expose credentials' }
 Assert $rejected 'invalid or placeholder URI must be rejected'
}
$folder = Join-Path ([IO.Path]::GetTempPath()) ('unieve-config-' + [Guid]::NewGuid())
try {
 Write-CampusConfiguration -Directory $folder -AtlasUri $uri
 $campus = Read-CampusEnvironment (Join-Path $folder 'campus.env')
 $academic = Read-CampusEnvironment (Join-Path $folder 'academic.env')
 Assert ($campus.MONGODB_URI.Contains('$literal')) 'literal dollar in URI must round trip'
 Assert ($campus.CAMPUS_LINK_KEY.Length -eq 64) 'link encryption key must have 32 random bytes'
 Assert ($campus.CAMPUS_SERVICE_KEY -eq $academic.CAMPUS_SERVICE_KEY) 'internal bridge keys must match'
 Assert ($academic.JWT_SECRET.Length -ge 64) 'JWT key must be strong'
 Assert ($campus.CAMPUS_HOST -eq '0.0.0.0') 'container must listen on its network interface'
 Assert ($campus.CAMPUS_COOKIE_SECURE -eq 'false') 'localhost HTTP must support session cookies'
 Assert ($campus.CAMPUS_ORIGINS.Contains('http://localhost:5173')) 'React development origin must be allowed'
 Assert ($campus.CAMPUS_MEDIA_DIR -eq '/app/media') 'uploads must use the persistent container volume'
 Write-CampusConfiguration -Directory $folder -AtlasUri ($prefix + '/?appName=changed')
 $again = Read-CampusEnvironment (Join-Path $folder 'campus.env')
 Assert ($again.CAMPUS_LINK_KEY -eq $campus.CAMPUS_LINK_KEY) 'setup must preserve encryption keys'
 Assert ($again.CAMPUS_SERVICE_KEY -eq $campus.CAMPUS_SERVICE_KEY) 'setup must preserve bridge identity'
 Remove-Item (Join-Path $folder 'academic.env')
 $rejected = $false
 try { Write-CampusConfiguration -Directory $folder -AtlasUri $uri } catch { $rejected = $true }
 Assert $rejected 'partial private configuration must not regenerate keys silently'
} finally { if (Test-Path $folder) { Remove-Item $folder -Recurse -Force } }
Write-Output 'PowerShell configuration checks passed: URI validation, private settings, persistent keys and partial-config protection.'

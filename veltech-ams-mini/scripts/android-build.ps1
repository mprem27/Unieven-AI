param(
    [Parameter(Mandatory = $true)][string]$ProjectDirectory,
    [Parameter(Mandatory = $true)][string]$SigningKeyPath,
    [Parameter(Mandatory = $true)][string]$KeyAlias,
    [Parameter(Mandatory = $true)][string]$AllowedFingerprintCsv,
    [Parameter(Mandatory = $true)][string]$OutputFile,
    [Parameter(Mandatory = $true)][string]$ReceiptFile,
    [Parameter(Mandatory = $true)][string]$PackageId,
    [Parameter(Mandatory = $true)][string]$VersionName,
    [Parameter(Mandatory = $true)][int]$VersionCode
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Read-PasswordValue([string]$Prompt) {
    $secure = Read-Host -Prompt $Prompt -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer); $secure.Dispose() }
}

try {
    if (-not $env:JAVA_HOME -or -not (Test-Path -LiteralPath (Join-Path $env:JAVA_HOME 'bin/java.exe'))) {
        throw 'Set JAVA_HOME to your JDK 21 (or JDK 17) installation; see docs/ANDROID.md.'
    }
    if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android/Sdk' }
    $tools = Join-Path $env:ANDROID_HOME 'build-tools/36.1.0'
    $zipalign = Join-Path $tools 'zipalign.exe'
    $apksigner = Join-Path $tools 'apksigner.bat'
    foreach ($file in @($zipalign, $apksigner, $SigningKeyPath,
        (Join-Path $env:ANDROID_HOME 'platforms/android-36/android.jar'),
        (Join-Path $ProjectDirectory 'gradlew.bat'))) {
        if (-not (Test-Path -LiteralPath $file)) { throw "Required file missing: $file. Follow docs/ANDROID.md." }
    }
    if ($KeyAlias -notmatch '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,49}$' -or
        ($AllowedFingerprintCsv -ne 'PENDING' -and $AllowedFingerprintCsv -notmatch '^[A-F0-9]{64}(,[A-F0-9]{64})*$')) { throw 'Invalid release identity arguments.' }
    $allowed = $AllowedFingerprintCsv.Split(',')
    Push-Location -LiteralPath $ProjectDirectory
    try {
        & (Join-Path $ProjectDirectory 'gradlew.bat') --no-daemon --console=plain assembleRelease
        if ($LASTEXITCODE -ne 0) { throw "Gradle failed with exit $LASTEXITCODE." }
        $unsigned = Join-Path $ProjectDirectory 'app/build/outputs/apk/release/app-release-unsigned.apk'
        if (-not (Test-Path -LiteralPath $unsigned)) { throw 'Gradle did not produce the expected unsigned release APK.' }
        $aligned = Join-Path $ProjectDirectory "release-$PID-aligned.apk"
        $signed = Join-Path $ProjectDirectory "release-$PID-signed.apk"
        try {
            & $zipalign -P 16 -f 4 $unsigned $aligned
            if ($LASTEXITCODE -ne 0) { throw 'APK alignment failed.' }
            $env:CAMPUS_ANDROID_STORE_PASSWORD = Read-PasswordValue 'Release keystore password (not saved)'
            $env:CAMPUS_ANDROID_KEY_PASSWORD = Read-PasswordValue 'Release key password (use the same password for a PKCS12 key)'
            & $apksigner sign --ks $SigningKeyPath --ks-key-alias $KeyAlias `
                --ks-pass env:CAMPUS_ANDROID_STORE_PASSWORD --key-pass env:CAMPUS_ANDROID_KEY_PASSWORD `
                --out $signed $aligned
            if ($LASTEXITCODE -ne 0) { throw 'APK signing failed.' }
            $verification = & $apksigner verify --verbose --print-certs $signed 2>&1
            if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed.' }
            $verificationText = $verification -join "`n"
            $match = [regex]::Match($verificationText, '(?im)^Signer #1 certificate SHA-256 digest:\s*([a-f0-9]{64})\s*$')
            if (-not $match.Success -or $verificationText -notmatch '(?im)^Verified using v[23] scheme[^\r\n]*:\s*true\s*$') { throw 'Could not verify a v2/v3 APK signing certificate.' }
            $fingerprint = $match.Groups[1].Value.ToUpperInvariant()
            if ($AllowedFingerprintCsv -ne 'PENDING' -and $allowed -notcontains $fingerprint) { throw 'APK certificate differs from your live Digital Asset Links. Deploy the correct fingerprint and rebuild.' }
            & $zipalign -c -P 16 -v 4 $signed
            if ($LASTEXITCODE -ne 0) { throw 'Signed APK alignment verification failed.' }
            $badging = & (Join-Path $tools 'aapt.exe') dump badging $signed 2>&1
            $badgingText = $badging -join "`n"
            if ($LASTEXITCODE -ne 0 -or $badgingText -match '(?m)^application-debuggable' -or
                -not $badgingText.Contains("name='$PackageId'") -or
                -not $badgingText.Contains("versionCode='$VersionCode'") -or
                -not $badgingText.Contains("versionName='$VersionName'") -or
                $badgingText -notmatch '(?m)^launchable-activity: ') { throw 'APK release identity verification failed.' }
            Copy-Item -LiteralPath $signed -Destination $OutputFile -Force
            $hash = (Get-FileHash -LiteralPath $OutputFile -Algorithm SHA256).Hash.ToLowerInvariant()
            [ordered]@{ certificateSha256 = $fingerprint; apkSha256 = $hash } |
                ConvertTo-Json | Set-Content -LiteralPath $ReceiptFile -Encoding UTF8
            "$hash  $([IO.Path]::GetFileName($OutputFile))" |
                Set-Content -LiteralPath "$OutputFile.sha256" -Encoding ASCII
            Write-Host "APK signature and alignment verified: $OutputFile"
        }
        finally {
            Remove-Item -LiteralPath $aligned, $signed -Force -ErrorAction SilentlyContinue
        }
    }
    finally { Pop-Location }
}
catch { Write-Error $_; exit 1 }
finally {
    Remove-Item Env:CAMPUS_ANDROID_STORE_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:CAMPUS_ANDROID_KEY_PASSWORD -ErrorAction SilentlyContinue
}

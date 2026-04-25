param(
  [switch]$InstallOnly,
  [switch]$StartOnly,
  [switch]$NoClear
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ($InstallOnly -and $StartOnly) {
  throw "Use only one mode: -InstallOnly or -StartOnly."
}

$clientDir = Split-Path -Parent $PSScriptRoot
$androidDir = Join-Path $clientDir "android"
$gradleWrapper = Join-Path $androidDir "gradlew.bat"

if (-not (Test-Path $gradleWrapper)) {
  throw "Android Gradle wrapper not found at $gradleWrapper."
}

function Test-AdbAvailable {
  return [bool](Get-Command adb -ErrorAction SilentlyContinue)
}

function Get-OnlineDeviceCount {
  if (-not (Test-AdbAvailable)) {
    return 0
  }

  $deviceLines = & adb devices | Select-String "`tdevice$"
  return @($deviceLines).Count
}

if (-not $StartOnly) {
  if (Test-AdbAvailable) {
    $deviceCount = Get-OnlineDeviceCount
    if ($deviceCount -eq 0) {
      Write-Host "No Android device/emulator detected. Start an emulator or connect a phone with USB debugging."
    } else {
      Write-Host "Detected $deviceCount Android device(s). Installing debug build..."
    }
  } else {
    Write-Host "adb not found in PATH. Continuing with installDebug; make sure a device/emulator is available."
  }

  Push-Location $androidDir
  try {
    & $gradleWrapper installDebug
  } finally {
    Pop-Location
  }
}

if (-not $InstallOnly) {
  $expoArgs = @("expo", "start", "--dev-client")
  if (-not $NoClear) {
    $expoArgs += "--clear"
  }

  Write-Host "Starting Metro for dev client..."

  Push-Location $clientDir
  try {
    & npx @expoArgs
  } finally {
    Pop-Location
  }
}

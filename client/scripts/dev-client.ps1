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

function Get-ExistingExpoProcess {
  $escapedClientDir = [Regex]::Escape($clientDir)
  $nodeProcesses = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue

  return @($nodeProcesses | Where-Object {
      $_.CommandLine -and
      $_.CommandLine -match $escapedClientDir -and
      $_.CommandLine -match "expo\\bin\\cli" -and
      $_.CommandLine -match "\sstart(\s|$)"
    })
}

function Get-ExpoProcessPort([string]$commandLine) {
  if ($commandLine -match "--port\s+(\d+)") {
    return [int]$matches[1]
  }

  return 8081
}

function Get-PreferredMetroPort {
  $defaultPort = 8081
  $parsedPort = 0
  if ($env:EXPO_DEV_CLIENT_PORT -and [int]::TryParse($env:EXPO_DEV_CLIENT_PORT, [ref]$parsedPort)) {
    $defaultPort = $parsedPort
  }

  $port = $defaultPort
  while ($true) {
    $listener = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
    if (-not $listener) {
      return $port
    }

    $port++
  }
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
  $existingExpoProcess = Get-ExistingExpoProcess | Select-Object -First 1
  if ($existingExpoProcess) {
    $existingPort = Get-ExpoProcessPort -commandLine $existingExpoProcess.CommandLine
    Write-Host "Expo dev server already running for this project on port $existingPort (PID $($existingExpoProcess.ProcessId))."
    Write-Host "Using the existing dev server instead of starting a duplicate."
    return
  }

  $metroPort = Get-PreferredMetroPort
  $expoArgs = @("expo", "start", "--dev-client", "--port", "$metroPort")
  if (-not $NoClear) {
    $expoArgs += "--clear"
  }

  Write-Host "Starting Metro for dev client on port $metroPort..."

  Push-Location $clientDir
  try {
    & npx @expoArgs
  } finally {
    Pop-Location
  }
}

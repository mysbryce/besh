$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT -or [Runtime.InteropServices.RuntimeInformation]::OSArchitecture -ne [Runtime.InteropServices.Architecture]::X64) {
  throw 'Bun setup requires Windows x64.'
}

$bunVersion = $env:BESH_BUN_VERSION
if ($bunVersion -notmatch '\A(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\z') {
  throw 'Provide an exact stable Bun version such as 1.4.2.'
}
if ([string]::IsNullOrWhiteSpace($env:RUNNER_TEMP) -or [string]::IsNullOrWhiteSpace($env:GITHUB_PATH)) {
  throw 'RUNNER_TEMP and GITHUB_PATH are required.'
}
if ($env:RUNNER_TEMP -match '[\r\n]' -or $env:GITHUB_PATH -match '[\r\n]') {
  throw 'Bun setup paths must not contain line breaks.'
}

$runnerTemp = [IO.Path]::GetFullPath($env:RUNNER_TEMP).TrimEnd('\', '/')
$githubPath = [IO.Path]::GetFullPath($env:GITHUB_PATH)

function Assert-JobTemporaryPath([string] $target) {
  if ($target -match '[\r\n]') {
    throw 'Bun setup paths must not contain line breaks.'
  }
  $fullPath = [IO.Path]::GetFullPath($target)
  if (-not $fullPath.StartsWith($runnerTemp + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Bun setup paths must stay inside RUNNER_TEMP.'
  }

  $cursor = $fullPath
  while ($cursor) {
    if (Test-Path -LiteralPath $cursor) {
      $item = Get-Item -LiteralPath $cursor -Force
      if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw 'Bun setup paths must not contain reparse points.'
      }
    }
    $cursor = [IO.Path]::GetDirectoryName($cursor)
  }
}

function Assert-RegularJobFile([string] $target) {
  Assert-JobTemporaryPath $target
  if (-not ((Get-Item -LiteralPath $target -Force) -is [IO.FileInfo])) {
    throw 'Bun setup requires regular files.'
  }
}

if (-not (Test-Path -LiteralPath $runnerTemp -PathType Container)) {
  throw 'RUNNER_TEMP must be an existing directory.'
}
Assert-JobTemporaryPath $githubPath
if (-not (Test-Path -LiteralPath $githubPath -PathType Leaf)) {
  throw 'GITHUB_PATH must be an existing regular file.'
}
Assert-RegularJobFile $githubPath

$installDirectory = Join-Path $runnerTemp ('besh-bun-' + [Guid]::NewGuid().ToString('N'))
Assert-JobTemporaryPath $installDirectory
New-Item -ItemType Directory -Path $installDirectory -ErrorAction Stop | Out-Null

$archivePath = Join-Path $installDirectory 'bun-windows-x64.zip'
$downloadUrl = 'https://github.com/oven-sh/bun/releases/download/bun-v' + $bunVersion + '/bun-windows-x64.zip'
Invoke-WebRequest -UseBasicParsing -TimeoutSec 120 -Uri $downloadUrl -OutFile $archivePath
Assert-JobTemporaryPath $installDirectory
Assert-RegularJobFile $archivePath
Expand-Archive -LiteralPath $archivePath -DestinationPath $installDirectory

$binDirectory = Join-Path $installDirectory 'bun-windows-x64'
$bunPath = Join-Path $binDirectory 'bun.exe'
$bunxPath = Join-Path $binDirectory 'bunx.exe'
Assert-JobTemporaryPath $bunPath
Assert-JobTemporaryPath $bunxPath
if (-not (Test-Path -LiteralPath $bunPath -PathType Leaf)) {
  throw 'The official archive did not contain the expected Bun executable.'
}
Assert-RegularJobFile $bunPath

$actualVersion = (& $bunPath --version | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $actualVersion -cne $bunVersion) {
  throw 'The downloaded Bun executable did not report the requested version.'
}

# A regular copy avoids the Windows privilege required by the upstream bunx symlink.
Copy-Item -LiteralPath $bunPath -Destination $bunxPath -ErrorAction Stop
Assert-RegularJobFile $bunxPath
Assert-RegularJobFile $githubPath
[IO.File]::AppendAllText($githubPath, $binDirectory + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))

Write-Host ('Bun ' + $actualVersion + ' installed with a regular bunx executable in RUNNER_TEMP.')

$ErrorActionPreference = 'Stop'

if (-not $env:GH_TOKEN) { throw 'Missing GitHub Actions token.' }
if (-not $env:GITHUB_REPOSITORY -or -not $env:GITHUB_REF_NAME) { throw 'This script must run from a tagged GitHub Actions workflow.' }

$root = Split-Path -Parent $PSScriptRoot
$package = Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw | ConvertFrom-Json
$version = [string]$package.version
$tag = [string]$env:GITHUB_REF_NAME
if ($tag -ne "v$version") { throw "Tag $tag does not match package version $version." }

$output = Join-Path $root 'release'
$installerName = "POKEBRICKS-Setup-$version.exe"
$installerPath = Join-Path $output $installerName
if (-not (Test-Path -LiteralPath $installerPath -PathType Leaf)) { throw "Signed installer not found: $installerPath" }

$stream = [System.IO.File]::OpenRead($installerPath)
try {
  $sha512 = [Convert]::ToBase64String([System.Security.Cryptography.SHA512]::HashData($stream))
} finally {
  $stream.Dispose()
}
$size = (Get-Item -LiteralPath $installerPath).Length
$releaseDate = [DateTime]::UtcNow.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'")
$manifest = @"
version: '$version'
files:
  - url: '$installerName'
    sha512: '$sha512'
    size: $size
path: '$installerName'
sha512: '$sha512'
releaseDate: '$releaseDate'
"@
$manifestPath = Join-Path $output 'latest.yml'
Set-Content -LiteralPath $manifestPath -Value $manifest -Encoding utf8NoBOM

$assets = @($installerPath)
$blockmapPath = "$installerPath.blockmap"
if (Test-Path -LiteralPath $blockmapPath -PathType Leaf) { $assets += $blockmapPath }
$assets += $manifestPath

$headers = @{
  Authorization = "Bearer $env:GH_TOKEN"
  Accept = 'application/vnd.github+json'
  'X-GitHub-Api-Version' = '2022-11-28'
}
$api = "https://api.github.com/repos/$env:GITHUB_REPOSITORY"
$release = $null
try {
  $release = Invoke-RestMethod -Method Get -Uri "$api/releases/tags/$tag" -Headers $headers
} catch {
  $status = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
  if ($status -ne 404) { throw }
}

if ($release -and -not $release.draft) {
  throw "Release $tag is already published. Use a new version tag instead of creating a second release with the same tag."
}

if (-not $release) {
  $body = @{ tag_name = $tag; name = $version; draft = $true; prerelease = $false } | ConvertTo-Json
  $release = Invoke-RestMethod -Method Post -Uri "$api/releases" -Headers $headers -ContentType 'application/json' -Body $body
} else {
  foreach ($oldAsset in @($release.assets)) {
    Invoke-RestMethod -Method Delete -Uri "$api/releases/assets/$($oldAsset.id)" -Headers $headers | Out-Null
  }
}

$uploadUrl = [string]$release.upload_url -replace '\{\?name,label\}$', ''
foreach ($assetPath in $assets) {
  $assetName = [System.IO.Path]::GetFileName($assetPath)
  $encodedName = [Uri]::EscapeDataString($assetName)
  $contentType = if ($assetName -eq 'latest.yml') { 'text/yaml' } else { 'application/octet-stream' }
  Invoke-RestMethod -Method Post -Uri "$uploadUrl?name=$encodedName" -Headers $headers -ContentType $contentType -InFile $assetPath | Out-Null
  Write-Host "Uploaded $assetName"
}

$publishBody = @{ draft = $false } | ConvertTo-Json
Invoke-RestMethod -Method Patch -Uri "$api/releases/$($release.id)" -Headers $headers -ContentType 'application/json' -Body $publishBody | Out-Null
Write-Host "Published $tag with installer and updater manifest in one GitHub release."

# download-images.ps1
# Downloads all original Archspace game images from the Wayback Machine CDX API
# Run from the MagellanWars directory: .\download-images.ps1

$OutputDir = Join-Path $PSScriptRoot "src\web"
$UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

Write-Host "=== Fetching image list from Wayback CDX API ===" -ForegroundColor Cyan

$cdxUrl = "https://web.archive.org/cdx/search/cdx?url=archspace.org/image/*&output=json&fl=original,timestamp&collapse=original&limit=5000"
$rows = Invoke-RestMethod -Uri $cdxUrl -UserAgent $UserAgent
# rows[0] is header, rest are [original, timestamp]
$images = $rows[1..($rows.Count-1)]

Write-Host "Found $($images.Count) unique images" -ForegroundColor Green

$downloaded = 0
$skipped    = 0
$failed     = 0

foreach ($row in $images) {
    $originalUrl = $row[0]
    $timestamp   = $row[1]

    # Derive local path: strip protocol + host
    $localRel = $originalUrl -replace '^https?://(?:www\.)?archspace\.org(?::\d+)?/', ''
    # Replace forward slashes for Windows path
    $localPath = Join-Path $OutputDir ($localRel -replace '/', '\')

    # Skip if already downloaded
    if (Test-Path $localPath) {
        $skipped++
        continue
    }

    # Create directory
    $dir = Split-Path $localPath -Parent
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }

    # Build Wayback raw-image URL
    $waybackUrl = "https://web.archive.org/web/${timestamp}im_/${originalUrl}"

    try {
        Invoke-WebRequest -Uri $waybackUrl -OutFile $localPath -UserAgent $UserAgent -TimeoutSec 30 -ErrorAction Stop
        $downloaded++
        if ($downloaded % 20 -eq 0) {
            Write-Host "  [$downloaded downloaded, $failed failed] $localRel" -ForegroundColor Gray
        }
        # Be polite to Wayback Machine
        Start-Sleep -Milliseconds 300
    }
    catch {
        Write-Warning "FAILED: $waybackUrl -> $_"
        $failed++
        # Remove empty/partial file
        if (Test-Path $localPath) { Remove-Item $localPath -Force }
    }
}

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Cyan
Write-Host "Downloaded : $downloaded" -ForegroundColor Green
Write-Host "Skipped    : $skipped (already existed)"
Write-Host "Failed     : $failed" -ForegroundColor $(if ($failed -gt 0) { 'Yellow' } else { 'Green' })
Write-Host "Images in  : $OutputDir"

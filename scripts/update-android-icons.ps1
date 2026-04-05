# Generate Android launcher PNGs from public\icon.ico and copy into Android mipmap folders.
# Requires ImageMagick (magick.exe) for proper PNG conversion. If not available, the script will copy the ICO file as-is (may not work on all devices).

$src = Join-Path $PSScriptRoot "..\public\icon.ico"
$androidRes = Join-Path $PSScriptRoot "..\android\app\src\main\res"

if (-not (Test-Path $src)) {
    Write-Error "Source icon not found: $src"
    exit 1
}

$targets = @{
    "mipmap-mdpi" = 48
    "mipmap-hdpi" = 72
    "mipmap-xhdpi" = 96
    "mipmap-xxhdpi" = 144
    "mipmap-xxxhdpi" = 192
}

# Check for ImageMagick
$magick = (Get-Command magick -ErrorAction SilentlyContinue)
if ($magick) {
    Write-Host "ImageMagick found. Generating PNGs..."
    foreach ($folder in $targets.Keys) {
        $size = $targets[$folder]
        $outDir = Join-Path $androidRes $folder
        if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }
        $outPath = Join-Path $outDir "ic_launcher.png"
        & magick convert "$src[0]" -resize ${size}x${size} "$outPath"
        Copy-Item -Path $outPath -Destination (Join-Path $outDir "ic_launcher_round.png") -Force
        Copy-Item -Path $outPath -Destination (Join-Path $outDir "ic_launcher_foreground.png") -Force
        Write-Host "Written: $outPath"
    }

    # mipmap-anydpi-v26 uses adaptive icon foreground/background XML -- copy a high-res foreground
    $anydpiDir = Join-Path $androidRes "mipmap-anydpi-v26"
    if (-not (Test-Path $anydpiDir)) { New-Item -ItemType Directory -Path $anydpiDir | Out-Null }
    $hiRes = Join-Path $anydpiDir "ic_launcher_foreground.png"
    & magick convert "$src[0]" -resize 432x432 "$hiRes"
    Write-Host "Wrote adaptive foreground: $hiRes"

    Write-Host "Icon generation complete. Edit android/app/src/main/res/values/ic_launcher_background.xml if you need a different background color."
} else {
    Write-Warning "ImageMagick (magick) not found on PATH. Falling back to copying the ICO file into mipmap folders (may not be usable on Android)."
    foreach ($folder in $targets.Keys) {
        $outDir = Join-Path $androidRes $folder
        if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }
        Copy-Item -Path $src -Destination (Join-Path $outDir "ic_launcher.png") -Force
        Copy-Item -Path $src -Destination (Join-Path $outDir "ic_launcher_round.png") -Force
        Copy-Item -Path $src -Destination (Join-Path $outDir "ic_launcher_foreground.png") -Force
        Write-Host "Copied: $(Join-Path $outDir "ic_launcher.png")"
    }
    Write-Host "Copied ICO to mipmap folders. Recommend installing ImageMagick and re-running this script for proper PNGs."
}

Write-Host "Done. Rebuild the Android project (npm run build:mobile && npx cap sync android) and then assemble the release."dd
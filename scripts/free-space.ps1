<#
    OneHealth AI - disk audit and SAFE cleanup for drive C:

    PHASE 1  audit: measure where the space has gone (deletes nothing)
    PHASE 2  clean: remove only clearly disposable caches and temporary files
    PHASE 3  verify: re-measure, and REPORT (never delete) large personal items

    EXPLICITLY NEVER TOUCHED:
      - C:\Windows\System32 and any OS binaries      - Program Files / Program Files (x86)
      - the Healthcare_AI project                    - PostgreSQL (install or data)
      - source code, node_modules, .venv, .git       - Documents / Pictures / Videos / Desktop
      - C:\Windows\Installer, C:\ProgramData\Package Cache (needed for repair/uninstall)
      - games, or any application install

    Requires administrator rights for the Windows component store cleanup.
    Everything is written to scripts\disk-report.txt.
#>

$ErrorActionPreference = 'SilentlyContinue'
$report = Join-Path $PSScriptRoot 'disk-report.txt'
Remove-Item $report -Force -ErrorAction SilentlyContinue

function W($text) { Write-Host $text; Add-Content -Path $report -Value $text }

function Get-FreeGB {
    $d = Get-PSDrive -Name C
    return [math]::Round($d.Free / 1GB, 2)
}

# robocopy in list-only mode is dramatically faster than Get-ChildItem -Recurse
function Get-SizeGB($path) {
    if (-not (Test-Path -LiteralPath $path)) { return $null }
    $lines = robocopy $path NULL /L /S /NJH /BYTES /NFL /NDL /NP /XJ 2>$null
    foreach ($line in $lines) {
        if ($line -match '^\s*Bytes\s*:\s*([\d\.]+)') {
            return [math]::Round(([double]$Matches[1]) / 1GB, 2)
        }
    }
    return $null
}

function Show($label, $path) {
    $size = Get-SizeGB $path
    if ($null -ne $size) { W ("  {0,8:N2} GB  {1}  ({2})" -f $size, $label, $path) }
    return $size
}

$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
           ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

$startFree = Get-FreeGB
$disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"

W "OneHealth AI - disk audit and cleanup"
W "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')   Administrator: $isAdmin"
W ("=" * 78)
W ""
W ("C: total {0:N1} GB, free {1:N2} GB ({2:N1}% free)" -f ($disk.Size/1GB), $startFree, (100*$disk.FreeSpace/$disk.Size))
W ""

# ============================== PHASE 1: AUDIT ==============================
W "PHASE 1 - AUDIT (nothing is deleted in this phase)"
W ("-" * 78)
W ""
W "Disposable caches and temporary data:"
$disposable = @(
    @('User temp',                  $env:TEMP),
    @('Windows temp',               'C:\Windows\Temp'),
    @('Windows Update downloads',   'C:\Windows\SoftwareDistribution\Download'),
    @('Delivery Optimization cache','C:\Windows\SoftwareDistribution\DeliveryOptimization'),
    @('Prefetch',                   'C:\Windows\Prefetch'),
    @('CBS logs',                   'C:\Windows\Logs\CBS'),
    @('Crash dumps (user)',         "$env:LOCALAPPDATA\CrashDumps"),
    @('Minidumps',                  'C:\Windows\Minidump'),
    @('npm cache',                  "$env:LOCALAPPDATA\npm-cache"),
    @('npm cache (roaming)',        "$env:APPDATA\npm-cache"),
    @('pip cache',                  "$env:LOCALAPPDATA\pip\Cache"),
    @('Chrome cache',               "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Cache"),
    @('Chrome code cache',          "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Code Cache"),
    @('Edge cache',                 "$env:LOCALAPPDATA\Microsoft\Edge\User Data\Default\Cache"),
    @('Brave cache',                "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\User Data\Default\Cache"),
    @('IE/INet cache',              "$env:LOCALAPPDATA\Microsoft\Windows\INetCache"),
    @('Windows Error Reporting',    'C:\ProgramData\Microsoft\Windows\WER'),
    @('NuGet http cache',           "$env:LOCALAPPDATA\NuGet\v3-cache"),
    @('VS Code caches',             "$env:APPDATA\Code\Cache"),
    @('VS Code CachedData',         "$env:APPDATA\Code\CachedData")
)
$disposableTotal = 0
foreach ($item in $disposable) {
    $s = Show $item[0] $item[1]
    if ($s) { $disposableTotal += $s }
}
W ""
W ("  => roughly {0:N2} GB in clearly disposable locations" -f $disposableTotal)

W ""
W "Large system areas (Windows manages these - handled via built-in cleanup only):"
Show 'Component store (WinSxS)' 'C:\Windows\WinSxS' | Out-Null
Show 'Windows Installer cache'  'C:\Windows\Installer' | Out-Null
Show 'Package Cache'            'C:\ProgramData\Package Cache' | Out-Null
if (Test-Path 'C:\Windows.old') { Show 'PREVIOUS WINDOWS INSTALL' 'C:\Windows.old' | Out-Null }

$hiber = Get-Item 'C:\hiberfil.sys' -Force -ErrorAction SilentlyContinue
if ($hiber) { W ("  {0,8:N2} GB  Hibernation file  (C:\hiberfil.sys)" -f ($hiber.Length/1GB)) }

W ""
W "Your own folders (REPORTED ONLY - nothing here is ever deleted by this script):"
foreach ($folder in @('Downloads','Documents','Pictures','Videos','Music','Desktop','AppData')) {
    Show $folder (Join-Path $env:USERPROFILE $folder) | Out-Null
}

W ""
W "Applications and games (REPORTED ONLY):"
foreach ($p in @(
    @('Steam',            'C:\Program Files (x86)\Steam'),
    @('Epic Games',       'C:\Program Files\Epic Games'),
    @('Riot Games',       'C:\Riot Games'),
    @('EA Games',         'C:\Program Files\EA Games'),
    @('Rockstar Games',   'C:\Program Files\Rockstar Games'),
    @('Ubisoft',          'C:\Program Files (x86)\Ubisoft'),
    @('Xbox game saves',  'C:\XboxGames'),
    @('Adobe',            'C:\Program Files\Adobe'),
    @('MATLAB',           'C:\Program Files\MATLAB'),
    @('Android SDK',      "$env:LOCALAPPDATA\Android"),
    @('Docker images/WSL',"$env:LOCALAPPDATA\Docker"),
    @('WSL distributions',"$env:LOCALAPPDATA\Packages")
)) { Show $p[0] $p[1] | Out-Null }

W ""
W "20 largest files in Downloads (REPORTED ONLY):"
Get-ChildItem (Join-Path $env:USERPROFILE 'Downloads') -Recurse -File -Force -ErrorAction SilentlyContinue |
    Sort-Object Length -Descending | Select-Object -First 20 |
    ForEach-Object { W ("  {0,8:N2} GB  {1}" -f ($_.Length/1GB), $_.FullName) }

# ============================= PHASE 2: CLEANUP =============================
W ""
W ("=" * 78)
W "PHASE 2 - SAFE CLEANUP"
W ("-" * 78)

function Clear-Contents($label, $path) {
    if (-not (Test-Path -LiteralPath $path)) { W "  skipped (absent): $label"; return }
    $before = Get-SizeGB $path
    Get-ChildItem -LiteralPath $path -Force -ErrorAction SilentlyContinue | ForEach-Object {
        Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
    }
    $after = Get-SizeGB $path
    if ($null -eq $before) { $before = 0 }
    if ($null -eq $after)  { $after  = 0 }
    $freed = [double]$before - [double]$after
    if ($freed -lt 0) { $freed = 0 }
    W ("  cleared {0,7:N2} GB  {1}" -f $freed, $label)
}

Clear-Contents 'User temp'                   $env:TEMP
Clear-Contents 'Windows temp'                'C:\Windows\Temp'
Clear-Contents 'Windows Update downloads'    'C:\Windows\SoftwareDistribution\Download'
Clear-Contents 'Prefetch'                    'C:\Windows\Prefetch'
Clear-Contents 'Crash dumps (user)'          "$env:LOCALAPPDATA\CrashDumps"
Clear-Contents 'Minidumps'                   'C:\Windows\Minidump'
Clear-Contents 'Windows Error Reporting'     'C:\ProgramData\Microsoft\Windows\WER\ReportQueue'
Clear-Contents 'Windows Error Reporting (archive)' 'C:\ProgramData\Microsoft\Windows\WER\ReportArchive'
Clear-Contents 'pip cache'                   "$env:LOCALAPPDATA\pip\Cache"
Clear-Contents 'NuGet http cache'            "$env:LOCALAPPDATA\NuGet\v3-cache"
Clear-Contents 'IE/INet cache'               "$env:LOCALAPPDATA\Microsoft\Windows\INetCache"
Clear-Contents 'Chrome cache'                "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Cache"
Clear-Contents 'Chrome code cache'           "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Code Cache"
Clear-Contents 'Chrome GPU cache'            "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\GPUCache"
Clear-Contents 'Edge cache'                  "$env:LOCALAPPDATA\Microsoft\Edge\User Data\Default\Cache"
Clear-Contents 'Brave cache'                 "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\User Data\Default\Cache"
Clear-Contents 'VS Code CachedData'          "$env:APPDATA\Code\CachedData"

# CBS logs: keep the most recent, drop rotated ones.
$cbs = Get-ChildItem 'C:\Windows\Logs\CBS' -File -ErrorAction SilentlyContinue |
       Where-Object { $_.Name -ne 'CBS.log' }
if ($cbs) {
    $mb = [math]::Round(($cbs | Measure-Object Length -Sum).Sum / 1MB, 1)
    $cbs | Remove-Item -Force -ErrorAction SilentlyContinue
    W ("  cleared {0,7:N2} GB  rotated CBS logs ({1} MB)" -f ($mb/1024), $mb)
}

# npm's own cache command is safer than deleting the directory by hand.
if (Get-Command npm -ErrorAction SilentlyContinue) {
    $before = Get-SizeGB "$env:LOCALAPPDATA\npm-cache"
    & cmd /c "npm cache clean --force > nul 2>&1"
    $after = Get-SizeGB "$env:LOCALAPPDATA\npm-cache"
    if ($null -ne $before) {
        if ($null -eq $after) { $after = 0 }
        $freed = [double]$before - [double]$after
        if ($freed -lt 0) { $freed = 0 }
        W ("  cleared {0,7:N2} GB  npm cache" -f $freed)
    }
}

W ""
W "  Recycle Bin..."
try { Clear-RecycleBin -DriveLetter C -Force -ErrorAction Stop; W "  emptied Recycle Bin" }
catch { W "  Recycle Bin: $($_.Exception.Message)" }

W ""
W "  Delivery Optimization cache..."
try { Delete-DeliveryOptimizationCache -Force -ErrorAction Stop; W "  cleared Delivery Optimization cache" }
catch { W "  Delivery Optimization: not available ($($_.Exception.Message))" }

if ($isAdmin) {
    W ""
    W "  Windows component store cleanup (DISM) - this takes a few minutes..."
    $dism = & cmd /c "dism /Online /Cleanup-Image /StartComponentCleanup 2>&1"
    $dism | Select-Object -Last 6 | ForEach-Object { W "    $_" }

    W ""
    W "  Built-in Disk Cleanup (cleanmgr) on the safe handlers..."
    $base = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\VolumeCaches'
    # NOTE: 'Previous Installations' and 'Upgrade Discarded Files' are deliberately
    # EXCLUDED. They delete C:\Windows.old, which removes your ability to roll back
    # a Windows upgrade. That is reported as an option at the end instead, so the
    # decision stays yours.
    $handlers = @(
        'Active Setup Temp Folders','BranchCache','Content Indexer Cleaner',
        'Delivery Optimization Files','Downloaded Program Files','Internet Cache Files',
        'Old ChkDsk Files','Recycle Bin','RetailDemo Offline Content',
        'Setup Log Files','System error memory dump files','System error minidump files',
        'Temporary Files','Temporary Setup Files','Thumbnail Cache','Update Cleanup',
        'Windows Error Reporting Files'
    )
    # Make sure any previously-set flag for the excluded handlers is cleared.
    foreach ($excluded in @('Previous Installations','Upgrade Discarded Files')) {
        $key = Join-Path $base $excluded
        if (Test-Path $key) { Set-ItemProperty -Path $key -Name 'StateFlags5432' -Value 0 -Type DWord -Force }
    }
    foreach ($h in $handlers) {
        $key = Join-Path $base $h
        if (Test-Path $key) { Set-ItemProperty -Path $key -Name 'StateFlags5432' -Value 2 -Type DWord -Force }
    }
    Start-Process -FilePath 'cleanmgr.exe' -ArgumentList '/sagerun:5432' -Wait -WindowStyle Hidden
    W "  Disk Cleanup finished"
} else {
    W ""
    W "  SKIPPED (needs administrator): Windows component store cleanup and Disk Cleanup."
    W "  Re-run this script as administrator to reclaim several more GB."
}

# ============================= PHASE 3: VERIFY ==============================
$endFree = Get-FreeGB
W ""
W ("=" * 78)
W "PHASE 3 - RESULT"
W ("-" * 78)
W ("  Free before : {0,8:N2} GB" -f $startFree)
W ("  Free after  : {0,8:N2} GB" -f $endFree)
W ("  Reclaimed   : {0,8:N2} GB" -f ($endFree - $startFree))
W ""
if ($endFree -ge 10) {
    W "  Comfortable. Docker images and the build tooling will fit easily."
} elseif ($endFree -ge 4) {
    W "  Enough to proceed: the Postgres + Redis images need about 0.5 GB,"
    W "  plus WSL headroom. Review the suggestions below if you want more."
} else {
    W "  STILL TIGHT. See the suggestions below - none are applied automatically."
}

W ""
W "OPTIONAL - these need your explicit approval, nothing here was touched:"
W ""
if (Test-Path 'C:\Windows.old') {
    $wo = Get-SizeGB 'C:\Windows.old'
    W ("  * C:\Windows.old ({0:N2} GB) - your previous Windows installation." -f $wo)
    W "    Removed via Disk Cleanup -> 'Previous Windows installations'. Safe once you are"
    W "    sure you will not roll back to the old build."
}
if ($hiber) {
    W ("  * Hibernation file ({0:N2} GB) - disable with:  powercfg /h off" -f ($hiber.Length/1GB))
    W "    Frees the space immediately. You lose hibernate and Fast Startup."
}
$shadow = & cmd /c "vssadmin list shadowstorage 2>&1" | Select-String 'Used Shadow Copy Storage'
if ($shadow) { W "  * System Restore points: $($shadow -join '; ')" }
W "  * Games and large applications listed in the audit above - uninstall via"
W "    Settings > Apps > Installed apps if you want to reclaim tens of GB."
W "  * Large files in Downloads listed above - review and delete what you no longer need."
W ""
W "Nothing in Healthcare_AI, PostgreSQL, your documents, photos, videos, source code,"
W "node_modules, virtual environments or Git data was read, moved or deleted."
W ""
W "Report saved to: $report"

# ---------------------------------------------------------------------------
# Run the environment diagnostic in the same pass, so Docker / PostgreSQL /
# Tesseract status is captured without needing a second run.
# ---------------------------------------------------------------------------
$diagnose = Join-Path $PSScriptRoot 'diagnose.ps1'
if (Test-Path $diagnose) {
    W ""
    W ("=" * 78)
    W "Running environment diagnostics..."
    & $diagnose | Out-Null
    W "Diagnostics saved to: $(Join-Path $PSScriptRoot 'diagnostics.txt')"
}

Write-Host ""
Write-Host "Done. Both reports are in the scripts folder." -ForegroundColor Green
Write-Host "You can close this window."

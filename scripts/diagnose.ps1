<#
    Fast environment diagnostic (~15 seconds).
    Writes scripts\diagnostics.txt. Reads nothing sensitive: it reports whether
    files exist, never their contents.
#>
$out = Join-Path $PSScriptRoot 'diagnostics.txt'
Remove-Item $out -ErrorAction SilentlyContinue
function W($t) { Write-Host $t; Add-Content -Path $out -Value $t }

W "OneHealth AI diagnostics - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
W ("=" * 70)

W "`n--- DOCKER DESKTOP INSTALLATION ---"
$candidates = @(
    'C:\Program Files\Docker\Docker\Docker Desktop.exe',
    'C:\Program Files\Docker\Docker\frontend\Docker Desktop.exe',
    "$env:LOCALAPPDATA\Docker\Docker Desktop.exe",
    "$env:ProgramW6432\Docker\Docker\Docker Desktop.exe"
)
$found = $null
foreach ($c in $candidates) {
    if (Test-Path $c) {
        $item = Get-Item $c
        W "  FOUND: $c"
        W "         version $($item.VersionInfo.ProductVersion), $([math]::Round($item.Length/1MB,1)) MB, installed $($item.CreationTime)"
        if (-not $found) { $found = $c }
    } else {
        W "  absent: $c"
    }
}
if (-not $found) { W "  => Docker Desktop.exe was NOT found in any standard location." }

W "`n--- Docker directory contents ---"
foreach ($d in @('C:\Program Files\Docker', 'C:\Program Files\Docker\Docker')) {
    if (Test-Path $d) {
        W "  $d :"
        Get-ChildItem $d -ErrorAction SilentlyContinue |
            Select-Object -First 25 |
            ForEach-Object { W "     $(if ($_.PSIsContainer) {'[dir] '} else {'      '})$($_.Name)" }
    } else { W "  $d : does not exist" }
}

W "`n--- DOCKER CLI / DAEMON ---"
$dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
if ($dockerCmd) {
    W "  docker CLI: $($dockerCmd.Source)"
    W "  docker --version        -> $(& cmd /c 'docker --version 2>&1')"
    W "  docker compose version  -> $(& cmd /c 'docker compose version 2>&1' | Select-Object -First 1)"
    & cmd /c "docker info > nul 2>&1"
    if ($LASTEXITCODE -eq 0) {
        W "  docker info             -> DAEMON IS RUNNING"
        W "  running containers      -> $(& cmd /c 'docker ps --format "{{.Names}} ({{.Status}})" 2>&1' | Out-String)"
    } else {
        W "  docker info             -> daemon NOT running (engine stopped or Docker Desktop closed)"
        W "     detail: $(& cmd /c 'docker info 2>&1' | Select-Object -First 4 | Out-String)"
    }
} else {
    W "  docker CLI is NOT on PATH."
}

W "`n--- WSL (Docker Desktop's backend) ---"
W "  $(& cmd /c 'wsl --status 2>&1' | Out-String)"
W "  installed distributions:"
W "  $(& cmd /c 'wsl --list --quiet 2>&1' | Out-String)"

W "`n--- SERVICES ---"
Get-Service -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match 'docker|postgres|com.docker' } |
    ForEach-Object { W "  $($_.Name) : $($_.Status)  ($($_.DisplayName))" }

W "`n--- LISTENING PORTS OF INTEREST ---"
foreach ($port in 5432, 5433, 6379, 3001, 8000, 5173) {
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($conn) {
        $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
        W "  $port : LISTENING (pid $($conn.OwningProcess), $($proc.ProcessName))"
    } else { W "  $port : free" }
}

W "`n--- POSTGRESQL (fallback option) ---"
foreach ($d in @('C:\Program Files\PostgreSQL')) {
    if (Test-Path $d) {
        W "  installed versions: $((Get-ChildItem $d -Directory -ErrorAction SilentlyContinue | ForEach-Object { $_.Name }) -join ', ')"
    }
}
$pgpass = "$env:APPDATA\postgresql\pgpass.conf"
if (Test-Path $pgpass) {
    W "  pgpass.conf EXISTS at $pgpass"
    W "     (it stores saved PostgreSQL passwords in plain text - you can open it yourself)"
} else {
    W "  pgpass.conf not present at $pgpass"
}

W "`n--- TESSERACT ---"
$tess = 'C:\Program Files\Tesseract-OCR\tesseract.exe'
if (Test-Path $tess) { W "  FOUND: $tess" } else { W "  not found at $tess" }

W "`n$('=' * 70)"
W "Diagnostics written to $out"

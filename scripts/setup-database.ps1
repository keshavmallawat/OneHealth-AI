<#
    OneHealth AI - self-contained local PostgreSQL.

    Downloads the official PostgreSQL Windows *binaries* (a ZIP, not an
    installer), extracts them inside this project, creates a fresh database
    cluster and starts it on port 5433.

    WHAT THIS DOES NOT DO:
      - it does not install anything into Windows
      - it does not require administrator rights
      - it does not create a Windows service
      - it does not read, modify or even contact your existing PostgreSQL 17
      - everything lives in .local-postgres\ and is removed by deleting that folder

    Run WITHOUT administrator rights: PostgreSQL refuses to run elevated on Windows.
#>

$ErrorActionPreference = 'Stop'

$root     = Split-Path -Parent $PSScriptRoot
$pgRoot   = Join-Path $root '.local-postgres'
$pgsql    = Join-Path $pgRoot 'pgsql'
$dataDir  = Join-Path $pgRoot 'data'
$logFile  = Join-Path $pgRoot 'postgres.log'
$zipPath  = Join-Path $pgRoot 'postgresql-binaries.zip'
$setupLog = Join-Path $PSScriptRoot 'database-log.txt'

$PG_PORT = 5433
$PG_USER = 'postgres'
$PG_PASS = 'onehealth_local_dev'
$PG_DB   = 'healthcareai'

Remove-Item $setupLog -Force -ErrorAction SilentlyContinue
function W($t) { Write-Host $t; Add-Content -Path $setupLog -Value $t }

W "OneHealth AI - local PostgreSQL setup"
W "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
W ("=" * 72)

# PostgreSQL refuses to run as an elevated user on Windows.
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
           ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if ($isAdmin) {
    W ""
    W "ERROR: this window is running as Administrator."
    W "PostgreSQL will not start under an elevated account on Windows."
    W "Close this window and run SETUP-DATABASE.bat by double-clicking it normally"
    W "(do not use 'Run as administrator')."
    exit 1
}

New-Item -ItemType Directory -Path $pgRoot -Force | Out-Null

# ---------------------------------------------------------------- download ---
$binExe = Join-Path $pgsql 'bin\pg_ctl.exe'
if (Test-Path $binExe) {
    W "PostgreSQL binaries already present at $pgsql"
} else {
    # Several build numbers are tried: EnterpriseDB publishes per-patch-release
    # archives, so any single URL can go stale.
    $candidates = @(
        'https://get.enterprisedb.com/postgresql/postgresql-16.6-1-windows-x64-binaries.zip',
        'https://get.enterprisedb.com/postgresql/postgresql-16.4-1-windows-x64-binaries.zip',
        'https://get.enterprisedb.com/postgresql/postgresql-16.3-1-windows-x64-binaries.zip',
        'https://get.enterprisedb.com/postgresql/postgresql-17.2-1-windows-x64-binaries.zip',
        'https://get.enterprisedb.com/postgresql/postgresql-17.0-1-windows-x64-binaries.zip',
        'https://get.enterprisedb.com/postgresql/postgresql-15.8-1-windows-x64-binaries.zip',
        'https://get.enterprisedb.com/postgresql/postgresql-15.7-1-windows-x64-binaries.zip'
    )

    if (Test-Path $zipPath) {
        W "Using the archive already downloaded at $zipPath"
    } else {
        $ok = $false
        foreach ($url in $candidates) {
            W ""
            W "Downloading $url"
            W "  (this is a few hundred MB and can take a couple of minutes)"
            try {
                $ProgressPreference = 'SilentlyContinue'   # progress bar makes this 10x slower
                Invoke-WebRequest -Uri $url -OutFile $zipPath -UseBasicParsing -TimeoutSec 900
                $ProgressPreference = 'Continue'
            } catch {
                W "  failed: $($_.Exception.Message)"
                Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
                continue
            }

            # A 404 page would also "download" - verify it is really a ZIP.
            $size = (Get-Item $zipPath).Length
            $head = [System.IO.File]::ReadAllBytes($zipPath)[0..1]
            if ($size -gt 50MB -and $head[0] -eq 0x50 -and $head[1] -eq 0x4B) {
                W ("  downloaded {0:N0} MB - valid ZIP archive" -f ($size / 1MB))
                $ok = $true
                break
            }
            W ("  rejected: {0:N0} bytes, not a ZIP archive" -f $size)
            Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
        }

        if (-not $ok) {
            W ""
            W "Could not download the PostgreSQL binaries automatically."
            W ""
            W "MANUAL STEP:"
            W "  1. Open  https://www.enterprisedb.com/download-postgresql-binaries"
            W "  2. Download the Windows x86-64 ZIP for PostgreSQL 15, 16 or 17"
            W "  3. Save it as exactly:"
            W "       $zipPath"
            W "  4. Run this script again - it will use that file."
            exit 1
        }
    }

    W ""
    W "Extracting (this takes a minute)..."
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $pgRoot)
    if (-not (Test-Path $binExe)) {
        W "ERROR: extraction did not produce $binExe"
        W "Contents of ${pgRoot}:"
        Get-ChildItem $pgRoot | ForEach-Object { W "  $($_.Name)" }
        exit 1
    }
    W "Extracted to $pgsql"
    Remove-Item $zipPath -Force -ErrorAction SilentlyContinue   # reclaim the space
    W "Removed the downloaded archive to save disk space"
}

$initdb    = Join-Path $pgsql 'bin\initdb.exe'
$pgctl     = Join-Path $pgsql 'bin\pg_ctl.exe'
$psqlExe   = Join-Path $pgsql 'bin\psql.exe'
$createdb  = Join-Path $pgsql 'bin\createdb.exe'
$isready   = Join-Path $pgsql 'bin\pg_isready.exe'

W ""
W "PostgreSQL version: $(& $pgctl --version)"

# ------------------------------------------------------------- create cluster ---
if (Test-Path (Join-Path $dataDir 'PG_VERSION')) {
    W "Database cluster already exists at $dataDir"
} else {
    W ""
    W "Creating a fresh database cluster..."
    $pwFile = Join-Path $pgRoot 'pw.txt'
    Set-Content -Path $pwFile -Value $PG_PASS -NoNewline -Encoding ASCII
    & $initdb --pgdata=$dataDir --username=$PG_USER --pwfile=$pwFile --encoding=UTF8 --locale=C 2>&1 |
        Select-Object -Last 8 | ForEach-Object { W "  $_" }
    Remove-Item $pwFile -Force -ErrorAction SilentlyContinue

    if (-not (Test-Path (Join-Path $dataDir 'PG_VERSION'))) {
        W "ERROR: initdb failed. See above."
        exit 1
    }

    # Listen only on loopback, on our own port.
    Add-Content -Path (Join-Path $dataDir 'postgresql.conf') -Value @"

# --- OneHealth AI local development cluster ---
port = $PG_PORT
listen_addresses = '127.0.0.1'
"@
    W "Cluster created, bound to 127.0.0.1:$PG_PORT"
}

# -------------------------------------------------------------------- start ---
& $isready -h 127.0.0.1 -p $PG_PORT -q
if ($LASTEXITCODE -eq 0) {
    W "PostgreSQL is already running on port $PG_PORT"
} else {
    W ""
    W "Starting PostgreSQL..."
    & $pgctl -D $dataDir -l $logFile -o "-p $PG_PORT" start
    for ($i = 1; $i -le 30; $i++) {
        Start-Sleep -Seconds 1
        & $isready -h 127.0.0.1 -p $PG_PORT -q
        if ($LASTEXITCODE -eq 0) { W "PostgreSQL accepting connections after ${i}s"; break }
    }
    & $isready -h 127.0.0.1 -p $PG_PORT -q
    if ($LASTEXITCODE -ne 0) {
        W "ERROR: PostgreSQL did not start. Last lines of $logFile :"
        Get-Content $logFile -Tail 20 -ErrorAction SilentlyContinue | ForEach-Object { W "  $_" }
        exit 1
    }
}

# ---------------------------------------------------------------- database ---
$env:PGPASSWORD = $PG_PASS
$exists = & $psqlExe -h 127.0.0.1 -p $PG_PORT -U $PG_USER -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$PG_DB'"
if ($exists -match '1') {
    W "Database '$PG_DB' already exists"
} else {
    & $createdb -h 127.0.0.1 -p $PG_PORT -U $PG_USER $PG_DB
    W "Created database '$PG_DB'"
}
W "Connection check: $(& $psqlExe -h 127.0.0.1 -p $PG_PORT -U $PG_USER -d $PG_DB -tAc 'SELECT version()')"
Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue

# ------------------------------------------------------------- wire up .env ---
$envFile = Join-Path $root 'backend\.env'
$newUrl = "postgresql://${PG_USER}:${PG_PASS}@127.0.0.1:${PG_PORT}/${PG_DB}"
$lines = Get-Content $envFile
$updated = @()
$done = $false
foreach ($line in $lines) {
    if ($line -match '^\s*DATABASE_URL\s*=') {
        $updated += "DATABASE_URL=$newUrl"
        $done = $true
    } else { $updated += $line }
}
if (-not $done) { $updated += "DATABASE_URL=$newUrl" }
Set-Content -Path $envFile -Value $updated -Encoding UTF8
W ""
W "backend\.env updated:"
W "  DATABASE_URL=postgresql://${PG_USER}:********@127.0.0.1:${PG_PORT}/${PG_DB}"

# ----------------------------------------------------------- helper scripts ---
# These resolve every path from %~dp0 (the folder the .bat sits in) rather than
# baking in an absolute path. Absolute paths break the moment the project folder
# is moved or renamed - which is exactly what happened once already.
$startBat = Join-Path $root 'START-DB.bat'
Set-Content -Path $startBat -Encoding ASCII -Value @"
@echo off
REM Start the project's local PostgreSQL (port $PG_PORT). Do NOT run as administrator.
REM All paths resolve relative to this file, so the project folder can be moved.
setlocal
set "PGROOT=%~dp0.local-postgres"
if not exist "%PGROOT%\pgsql\bin\pg_ctl.exe" (
  echo PostgreSQL binaries not found at "%PGROOT%\pgsql".
  echo Run SETUP-DATABASE.bat first.
  pause
  exit /b 1
)
"%PGROOT%\pgsql\bin\pg_ctl.exe" -D "%PGROOT%\data" -l "%PGROOT%\postgres.log" -o "-p $PG_PORT" start
"%PGROOT%\pgsql\bin\pg_isready.exe" -h 127.0.0.1 -p $PG_PORT
pause
"@
$stopBat = Join-Path $root 'STOP-DB.bat'
Set-Content -Path $stopBat -Encoding ASCII -Value @"
@echo off
REM Stop the project's local PostgreSQL. Paths resolve relative to this file.
setlocal
set "PGROOT=%~dp0.local-postgres"
"%PGROOT%\pgsql\bin\pg_ctl.exe" -D "%PGROOT%\data" -m fast stop
pause
"@
W "Created START-DB.bat and STOP-DB.bat in the project root (path-independent)"

W ""
W ("=" * 72)
W "Database ready on 127.0.0.1:$PG_PORT  (database '$PG_DB')"
W "Your existing PostgreSQL 17 on port 5432 was not touched."
W ""

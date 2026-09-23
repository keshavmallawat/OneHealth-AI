<#
    OneHealth AI - one-command setup and verification (Windows / PowerShell)

    Starts the Docker database, prepares every service, runs the builds and
    tests, starts the stack, seeds demo data and runs the end-to-end smoke test.
    Everything is written to scripts\setup-log.txt.

    Safe to re-run: work that is already done is skipped.

    Usage:
        powershell -ExecutionPolicy Bypass -File <repo>\scripts\setup-and-verify.ps1
    or just double-click RUN-SETUP.bat in the repository root.
#>

$ErrorActionPreference = 'Continue'
$root    = Split-Path -Parent $PSScriptRoot
$logPath = Join-Path $PSScriptRoot 'setup-log.txt'
Remove-Item $logPath -ErrorAction SilentlyContinue

$backend  = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'
$ai       = Join-Path $root 'ai-service'
$infra    = Join-Path $root 'infra'

# ---------------------------------------------------------------- helpers ----
function Log($message) {
    $line = "$(Get-Date -Format 'HH:mm:ss')  $message"
    Write-Host $line
    Add-Content -Path $logPath -Value $line
}

function Run($label, $workingDir, $command) {
    Log "----- $label -----"
    Push-Location $workingDir
    $output = & cmd /c "$command 2>&1"
    $code = $LASTEXITCODE
    Pop-Location
    foreach ($line in $output) { Add-Content -Path $logPath -Value "    $line" }
    if ($code -eq 0) { Log "OK: $label" } else { Log "FAILED ($code): $label" }
    return $code
}

function Test-Port($port) {
    try {
        $client = New-Object Net.Sockets.TcpClient
        $client.Connect('127.0.0.1', $port)
        $client.Close()
        return $true
    } catch { return $false }
}

function Wait-ForPort($label, $port, $seconds) {
    for ($i = 0; $i -lt $seconds; $i++) {
        if (Test-Port $port) { Log "$label is listening on port $port"; return $true }
        Start-Sleep -Seconds 1
    }
    Log "$label did NOT open port $port within ${seconds}s"
    return $false
}

function Stop-StaleListener($label, $port) {
    # A previous run may have left a dev server on this port holding stale
    # configuration (an old DATABASE_URL, for instance). Restart it rather than
    # silently reusing it. Only our own dev-server process types are touched.
    try {
        $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    } catch { return }
    foreach ($connection in $connections) {
        $process = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue
        if ($process -and $process.ProcessName -in @('node', 'python', 'cmd', 'conhost')) {
            Log "Stopping stale $label (pid $($process.Id), $($process.ProcessName)) on port $port"
            Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 1
        } elseif ($process) {
            Log "Port $port is held by $($process.ProcessName) (pid $($process.Id)) - not touching it"
        }
    }
}

function Start-Service-Window($label, $workDir, $command, $port, $logFile) {
    if (Test-Port $port) { Log "$label already listening on port $port - leaving it alone"; return }
    Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', "cd /d `"$workDir`" && $command > `"$logFile`" 2>&1" -WindowStyle Minimized
    Log "$label starting (output -> $(Split-Path -Leaf $logFile))"
}

function Probe($label, $url) {
    try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 15
        Log "OK: $label (HTTP $($response.StatusCode))"
        Add-Content -Path $logPath -Value "    $($response.Content)"
    } catch {
        $webResponse = $_.Exception.Response
        if ($webResponse) {
            $status = [int]$webResponse.StatusCode
            $reader = New-Object IO.StreamReader($webResponse.GetResponseStream())
            Log "RESPONDED: $label (HTTP $status)"
            Add-Content -Path $logPath -Value "    $($reader.ReadToEnd())"
        } else {
            Log "FAILED: $label -> $($_.Exception.Message)"
        }
    }
}

# ------------------------------------------------------------------ start ----
Log 'OneHealth AI setup starting'
Log "Repository: $root"

Log '----- tool versions -----'
foreach ($tool in @('node --version', 'npm --version', 'python --version', 'docker --version')) {
    Add-Content -Path $logPath -Value "    $tool -> $(& cmd /c "$tool 2>&1")"
}
$tesseractPath = 'C:\Program Files\Tesseract-OCR\tesseract.exe'
if (Test-Path $tesseractPath) {
    Add-Content -Path $logPath -Value "    tesseract -> found at $tesseractPath"
} else {
    Add-Content -Path $logPath -Value "    tesseract -> NOT FOUND (digital PDFs still work; image OCR will not)"
}

# --- 1. Database -----------------------------------------------------------
# The project uses its own PostgreSQL cluster under .local-postgres\ (set up by
# scripts\setup-database.ps1). It needs no installer, no administrator rights and
# no Windows service, and it never touches any other PostgreSQL on this machine.
#
# infra\docker-compose.yml remains a supported alternative when Docker is
# available - point DATABASE_URL at port 5433 with the compose credentials.
Log '----- database -----'

$dbLine = (Get-Content (Join-Path $backend '.env') |
           Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1)
$dbUrl  = ($dbLine -replace '^\s*DATABASE_URL\s*=', '').Trim().Trim('"').Trim("'")
$dbPort = 5433
if ($dbUrl -match ':(\d+)/') { $dbPort = [int]$Matches[1] }
Log "DATABASE_URL points at port $dbPort"

if (Test-Port $dbPort) {
    Log "A database is already listening on port $dbPort"
} else {
    Log "Nothing is listening on port $dbPort - running the database setup..."
    $dbScript = Join-Path $PSScriptRoot 'setup-database.ps1'
    if (Test-Path $dbScript) {
        # setup-database.ps1 uses ErrorActionPreference='Stop'; contain any
        # terminating error so it cannot abort this whole run.
        try {
            & $dbScript
            if ($LASTEXITCODE -ne 0) {
                Log "Database setup reported a problem - see scripts\database-log.txt"
            }
        } catch {
            Log "Database setup threw: $($_.Exception.Message)"
            Log "See scripts\database-log.txt for detail."
        }
        # setup-database.ps1 rewrites DATABASE_URL, so re-read the port.
        $dbLine = (Get-Content (Join-Path $backend '.env') |
                   Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1)
        $dbUrl  = ($dbLine -replace '^\s*DATABASE_URL\s*=', '').Trim().Trim('"').Trim("'")
        if ($dbUrl -match ':(\d+)/') { $dbPort = [int]$Matches[1] }
    } else {
        Log "scripts\setup-database.ps1 is missing."
    }
}
Wait-ForPort 'Database' $dbPort 30 | Out-Null

# --- 2. Backend ------------------------------------------------------------
if (-not (Test-Path (Join-Path $backend 'node_modules'))) {
    Run 'backend npm install' $backend 'npm install --no-audit --no-fund' | Out-Null
} else { Log 'backend node_modules already present' }

# `prisma generate` only produces the typed client; the runtime needs no engine
# binary because schema.prisma sets engineType = "client" and the app supplies a
# `pg` driver adapter. The CLI still insists the engine files exist before it
# will run, so if the download is unavailable (offline, proxy, firewall) we point
# it at placeholder paths - nothing ever executes them.
$generateCode = Run 'prisma generate' $backend 'npx prisma generate'
if ($generateCode -ne 0) {
    Log 'prisma generate failed - retrying without the engine download.'
    $stub = Join-Path $env:TEMP 'onehealth-engine-stub'
    Set-Content -Path $stub -Value '' -Encoding ASCII
    $env:PRISMA_SCHEMA_ENGINE_BINARY = $stub
    $env:PRISMA_QUERY_ENGINE_LIBRARY = $stub
    $env:PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING = '1'
    $generateCode = Run 'prisma generate (offline)' $backend 'npx prisma generate'
}
if ($generateCode -ne 0) {
    Log 'PRISMA CLIENT GENERATION FAILED - the API will not start.'
    Log '  Try:  cd backend  &&  npx prisma generate'
}

# Migrations are applied by our own runner over plain `pg`, so this step needs
# no Prisma engine at all and works on a machine that has never downloaded one.
$migrateCode = Run 'apply migrations' $backend 'node scripts/apply-migrations.js'

if ($migrateCode -ne 0) {
    # The database itself may simply not exist yet. Create it, then retry.
    $dbLine = (Get-Content (Join-Path $backend '.env') | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1)
    if ($dbLine) {
        $url = ($dbLine -replace '^\s*DATABASE_URL\s*=', '').Trim().Trim('"').Trim("'")
        if ($url -match '^(.*/)([^/?]+)(\?.*)?$') {
            $adminUrl = $Matches[1] + 'postgres' + $Matches[3]
            $dbName = $Matches[2]
            Log "Attempting to create the database '$dbName'..."
            $createJs = Join-Path $env:TEMP 'onehealth-createdb.js'
            $js = 'const {Client}=require(''pg'');(async()=>{const c=new Client({connectionString:process.argv[2]});await c.connect();await c.query(''CREATE DATABASE "''+process.argv[3]+''"'');await c.end();console.log(''created'');})().catch(e=>{console.error(e.message);process.exit(1)});'
            Set-Content -Path $createJs -Value $js -Encoding ASCII
            Run 'create database' $backend "node `"$createJs`" `"$adminUrl`" `"$dbName`"" | Out-Null
            Remove-Item $createJs -ErrorAction SilentlyContinue
            $migrateCode = Run 'apply migrations (retry)' $backend 'node scripts/apply-migrations.js'
        }
    }
}

if ($migrateCode -ne 0) {
    Log 'MIGRATION STILL FAILING.'
    Log '  1. Is the database running?  Double-click START-DB.bat'
    Log '  2. Re-run the database setup: double-click SETUP-DATABASE.bat'
    Log '  3. Check DATABASE_URL in backend\.env matches the port shown above.'
}

Run 'backend typecheck' $backend 'npx tsc --noEmit' | Out-Null
Run 'backend build'     $backend 'npm run build'    | Out-Null

# --- 3. AI service ---------------------------------------------------------
if (-not (Test-Path (Join-Path $ai '.venv\Scripts\python.exe'))) {
    Run 'create python venv' $ai 'python -m venv .venv' | Out-Null
}
Run 'ai-service pip install' $ai '.venv\Scripts\python.exe -m pip install --quiet --upgrade pip && .venv\Scripts\python.exe -m pip install --quiet -r requirements.txt' | Out-Null
Run 'ai-service preflight'   $ai '.venv\Scripts\python.exe scripts\check_environment.py' | Out-Null
Run 'ai-service extraction tests' $ai '.venv\Scripts\python.exe tests\test_extraction.py' | Out-Null
Run 'ai-service assistant tests'  $ai '.venv\Scripts\python.exe -m pytest tests -q' | Out-Null
Run 'generate sample data'   $ai '.venv\Scripts\python.exe scripts\generate_samples.py' | Out-Null

# --- 4. Frontend -----------------------------------------------------------
if (-not (Test-Path (Join-Path $frontend 'node_modules'))) {
    Run 'frontend npm install' $frontend 'npm install --no-audit --no-fund' | Out-Null
} else { Log 'frontend node_modules already present' }
Run 'frontend build' $frontend 'npm run build' | Out-Null

# --- 5. Start the stack ----------------------------------------------------
Log '----- starting services -----'
$aiLog       = Join-Path $PSScriptRoot 'ai-service.log'
$backendLog  = Join-Path $PSScriptRoot 'backend.log'
$frontendLog = Join-Path $PSScriptRoot 'frontend.log'

# Always restart: a stale process would still be holding the previous .env.
Stop-StaleListener 'AI service'  8001
Stop-StaleListener 'Backend API' 3001
Stop-StaleListener 'Frontend'    5173
Start-Sleep -Seconds 2

Start-Service-Window 'AI service' $ai '.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001' 8001 $aiLog
Wait-ForPort 'AI service' 8001 60 | Out-Null

Start-Service-Window 'Backend API' $backend 'npm run dev' 3001 $backendLog
Wait-ForPort 'Backend API' 3001 60 | Out-Null

Start-Service-Window 'Frontend' $frontend 'npm run dev' 5173 $frontendLog
Wait-ForPort 'Frontend' 5173 60 | Out-Null

Probe 'AI service /health'  'http://127.0.0.1:8001/health'
Probe 'backend /api/health' 'http://127.0.0.1:3001/api/health'
Probe 'frontend'            'http://127.0.0.1:5173/'

foreach ($pair in @(@('AI service', $aiLog), @('Backend', $backendLog), @('Frontend', $frontendLog))) {
    if (Test-Path $pair[1]) {
        Log "----- $($pair[0]) log (last 30 lines) -----"
        Get-Content $pair[1] -Tail 30 | ForEach-Object { Add-Content -Path $logPath -Value "    $_" }
    }
}

# --- 6. Seed demo data -----------------------------------------------------
Run 'seed demo data' $backend 'npm run seed' | Out-Null

# --- 7. End-to-end smoke test ----------------------------------------------
Run 'e2e smoke test - core pipeline' $backend 'node ..\scripts\smoke-test.js' | Out-Null
Run 'e2e smoke test - consent and sharing' $backend 'node ..\scripts\smoke-test-consent.js' | Out-Null

Log ''
Log 'Setup finished. Full log: scripts\setup-log.txt'
Log 'Frontend: http://localhost:5173   API: http://localhost:3001   AI: http://localhost:8001'
Log 'Demo sign-in (patient):   patient@onehealth.ai / Demo@12345'
Log 'Demo sign-in (clinician): doctor@onehealth.ai  / Demo@12345'

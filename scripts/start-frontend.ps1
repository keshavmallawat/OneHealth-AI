<#
    Starts ONLY the Vite dev server and verifies it is reachable.
    Touches nothing else: not the database, not the backend, not the AI service.
#>
$ErrorActionPreference = 'Continue'
$root     = Split-Path -Parent $PSScriptRoot
$frontend = Join-Path $root 'frontend'
$log      = Join-Path $PSScriptRoot 'frontend.log'
$out      = Join-Path $PSScriptRoot 'frontend-check.txt'

Remove-Item $out -Force -ErrorAction SilentlyContinue
function W($t) { Write-Host $t; Add-Content -Path $out -Value $t }

function Test-Port($port) {
    foreach ($address in @('127.0.0.1', '::1')) {
        try {
            $c = New-Object Net.Sockets.TcpClient
            $c.Connect($address, $port); $c.Close()
            return $address
        } catch { }
    }
    return $null
}

W "Frontend start + verify - $(Get-Date -Format 'HH:mm:ss')"
W ("=" * 64)

# Stop whatever is on 5173 so the new config actually takes effect.
$conns = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
foreach ($c in $conns) {
    $p = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
    if ($p -and $p.ProcessName -in @('node', 'cmd', 'conhost')) {
        W "Stopping existing dev server (pid $($p.Id), $($p.ProcessName))"
        Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
    } elseif ($p) {
        W "Port 5173 held by $($p.ProcessName) (pid $($p.Id)) - leaving it alone"
    }
}
Start-Sleep -Seconds 2

W ""
W "vite.config.ts server block:"
Get-Content (Join-Path $frontend 'vite.config.ts') |
    Select-String -Pattern 'host|port|strictPort|target' |
    ForEach-Object { W "    $($_.Line.Trim())" }

W ""
W "Starting Vite..."
Remove-Item $log -Force -ErrorAction SilentlyContinue
Start-Process -FilePath 'cmd.exe' `
    -ArgumentList '/c', "cd /d `"$frontend`" && npm run dev > `"$log`" 2>&1" `
    -WindowStyle Minimized

$boundOn = $null
for ($i = 1; $i -le 45; $i++) {
    Start-Sleep -Seconds 1
    $boundOn = Test-Port 5173
    if ($boundOn) { W "Port 5173 accepted a connection on $boundOn after ${i}s"; break }
}

W ""
W "Vite output:"
Get-Content $log -ErrorAction SilentlyContinue | ForEach-Object { W "    $_" }

if (-not $boundOn) {
    W ""
    W "RESULT: FAILED - nothing is listening on 5173 (checked IPv4 and IPv6)."
    exit 1
}

W ""
W "HTTP checks:"
$anyOk = $false
foreach ($url in @('http://127.0.0.1:5173/', 'http://localhost:5173/', 'http://[::1]:5173/')) {
    try {
        $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10
        $isSpa = $r.Content -match 'id="root"'
        W ("    OK   {0}  HTTP {1}, {2} bytes, SPA root element: {3}" -f $url, $r.StatusCode, $r.RawContentLength, $isSpa)
        $anyOk = $true
    } catch {
        W ("    FAIL {0}  {1}" -f $url, $_.Exception.Message)
    }
}

# The proxy is what makes the SPA able to reach the API - verify it end to end.
W ""
W "API proxy through Vite (this is what the browser actually uses):"
try {
    $api = Invoke-WebRequest -Uri 'http://127.0.0.1:5173/api/health' -UseBasicParsing -TimeoutSec 15
    W "    OK   /api/health -> HTTP $($api.StatusCode)"
    W "    $($api.Content)"
} catch {
    W "    FAIL /api/health -> $($_.Exception.Message)"
    W "    (is the backend still running on 3001?)"
}

W ""
if ($anyOk) {
    W "RESULT: PASS - open http://localhost:5173 and sign in as patient@onehealth.ai / Demo@12345"
} else {
    W "RESULT: port is open but HTTP failed - see above."
}

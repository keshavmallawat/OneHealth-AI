<#
    Read-only git and secret audit. Changes NOTHING.
    Writes scripts\git-audit.txt.
#>
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
$out  = Join-Path $PSScriptRoot 'git-audit.txt'
Remove-Item $out -ErrorAction SilentlyContinue
function W($t) { Write-Host $t; Add-Content -Path $out -Value $t }

Push-Location $root
W "OneHealth AI - git audit (read-only)  $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
W ("=" * 70)

W "`n--- last commits ---"
(& cmd /c "git log --oneline -5 2>&1") | ForEach-Object { W "  $_" }

W "`n--- current branch / remote ---"
W "  branch: $(& cmd /c 'git rev-parse --abbrev-ref HEAD 2>&1')"
W "  remote: $(& cmd /c 'git remote -v 2>&1' | Select-Object -First 1)"

W "`n--- SECRET CHECK: are these ignored? (must all say IGNORED) ---"
foreach ($f in @('backend\.env','ai-service\.env','infra\.env.docker')) {
    if (Test-Path (Join-Path $root $f)) {
        & cmd /c "git check-ignore -q `"$f`" 2>&1" | Out-Null
        $ignored = ($LASTEXITCODE -eq 0)
        W ("  {0,-24} {1}" -f $f, $(if ($ignored) { 'IGNORED  (safe)' } else { '*** TRACKED / NOT IGNORED - DO NOT COMMIT ***' }))
    } else { W ("  {0,-24} not present" -f $f) }
}

W "`n--- any .env currently tracked by git? (want: none) ---"
$tracked = & cmd /c "git ls-files 2>&1" | Select-String -Pattern '\.env'
if ($tracked) { $tracked | ForEach-Object { W "  *** $_ ***" } } else { W "  none" }

W "`n--- would any large/generated dir be committed? (want: none) ---"
foreach ($d in @('node_modules','.local-postgres','.venv','dist','storage')) {
    $hits = & cmd /c "git status --porcelain --untracked-files=all 2>&1" | Select-String -SimpleMatch $d
    W ("  {0,-18} {1}" -f $d, $(if ($hits) { "$($hits.Count) path(s) NOT ignored - check .gitignore" } else { 'clean' }))
}

W "`n--- change summary ---"
$porcelain = & cmd /c "git status --porcelain 2>&1"
$modified = ($porcelain | Select-String -Pattern '^\s*M').Count
$untracked = ($porcelain | Select-String -Pattern '^\?\?').Count
$deleted  = ($porcelain | Select-String -Pattern '^\s*D').Count
W "  modified : $modified"
W "  untracked: $untracked"
W "  deleted  : $deleted"
W "  total    : $($porcelain.Count) entries"

W "`n--- first 60 changed paths ---"
$porcelain | Select-Object -First 60 | ForEach-Object { W "  $_" }
if ($porcelain.Count -gt 60) { W "  ... and $($porcelain.Count - 60) more" }

W "`n--- repo size that would be pushed (excluding ignored) ---"
$bytes = 0
& cmd /c "git status --porcelain --untracked-files=all 2>&1" | ForEach-Object {
    $p = $_.Substring(3).Trim('"')
    $full = Join-Path $root $p
    if (Test-Path $full -PathType Leaf) { $bytes += (Get-Item $full).Length }
}
W ("  approx {0:N1} MB of working-tree changes" -f ($bytes / 1MB))

Pop-Location
W "`nAudit complete. Nothing was changed. Report: $out"

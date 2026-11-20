$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
$composePath = Join-Path $workspace 'compose.yaml'
$project = 'tennis-check-' + [Guid]::NewGuid().ToString('N')
$originalPort = $env:PORT
$portReservation = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
$portReservation.Start()
try { $env:PORT = [string]$portReservation.LocalEndpoint.Port }
finally { $portReservation.Stop() }

function Invoke-Compose {
    param([string[]]$ComposeArgs)
    & docker compose --project-directory $workspace -f $composePath -p $project @ComposeArgs
    if ($LASTEXITCODE -ne 0) { throw "Compose step failed with exit code $LASTEXITCODE" }
}

try {
    Invoke-Compose -ComposeArgs @('up', '--build', '-d', '--wait', '--wait-timeout', '60')
    $seed = "import { DatabaseSync } from 'node:sqlite'; const db = new DatabaseSync(process.env.SQLITE_DB_PATH); db.exec('CREATE TABLE compose_probe (value INTEGER); INSERT INTO compose_probe VALUES (42)'); db.close();"
    Invoke-Compose -ComposeArgs @('exec', '-T', 'app', 'node', '--input-type=module', '-e', $seed)
    Invoke-Compose -ComposeArgs @('up', '-d', '--force-recreate', '--wait', '--wait-timeout', '60')
    $verify = "import assert from 'node:assert/strict'; import { DatabaseSync } from 'node:sqlite'; const db = new DatabaseSync(process.env.SQLITE_DB_PATH); assert.equal(db.prepare('SELECT value FROM compose_probe').get().value, 42); assert.equal(db.prepare('PRAGMA quick_check').get().quick_check, 'ok'); db.close(); const res = await fetch('http://127.0.0.1:3000/healthz'); assert.equal(res.status, 200); assert.deepEqual(await res.json(), {status:'ok'}); console.log('Compose recreation, SQLite volume and readiness verified.');"
    Invoke-Compose -ComposeArgs @('exec', '-T', 'app', 'node', '--input-type=module', '-e', $verify)
}
finally {
    # This unique project contains only resources created by this verification run.
    & docker compose --project-directory $workspace -f $composePath -p $project down --volumes --rmi local
    $cleanupExit = $LASTEXITCODE
    $env:PORT = $originalPort
    if ($cleanupExit -ne 0) { Write-Warning "Cleanup is incomplete for project $project" }
}

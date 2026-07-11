$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$backendDir = Join-Path $repoRoot "backend"

Push-Location $repoRoot
try {
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"

    docker compose up -d postgres redis 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "docker compose up failed, continuing with existing services if available."
    }

    $dbExists = docker compose exec -T postgres psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'content_platform_test';" 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Could not inspect test database through docker compose. Continuing."
    } elseif ($dbExists.Trim() -ne "1") {
        docker compose exec -T postgres psql -U postgres -c "CREATE DATABASE content_platform_test;" 2>$null
    }

    $ErrorActionPreference = $previousErrorActionPreference
} finally {
    Pop-Location
}

Push-Location $backendDir
try {
    & npm.cmd run test
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }

    & npm.cmd run test:curl
    exit $LASTEXITCODE
} finally {
    Pop-Location
}

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$backendDir = Join-Path $repoRoot "backend"

Push-Location $repoRoot
try {
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"

    docker compose up -d mysql redis 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "docker compose up failed, continuing with existing services if available."
    }

    docker compose exec -T mysql mysql -uroot -ppassword -e "CREATE DATABASE IF NOT EXISTS content_platform_test;" 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Could not create test database through docker compose. Continuing."
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

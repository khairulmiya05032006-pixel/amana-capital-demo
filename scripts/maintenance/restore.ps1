param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFile
)

if (-not (Test-Path $BackupFile)) {
    Write-Host "Backup file not found!"
    exit 1
}

if (Test-Path ".env") {
    Get-Content .env | Where-Object { $_ -match "^([^#]+?)=(.+)$" } | ForEach-Object {
        $name, $value = $_ -split '=', 2
        Set-Item -Path "env:\$name" -Value $value
    }
}

Write-Host "Restoring $($env:DB_NAME) from $BackupFile..."

# Read file and pipe to mysql (assuming plain SQL)
Get-Content $BackupFile | mysql -h $env:DB_HOST -P $env:DB_PORT -u $env:DB_USER -p"$env:DB_PASSWORD" --ssl-mode=REQUIRED $env:DB_NAME

if ($LASTEXITCODE -eq 0) {
    Write-Host "Restore completed successfully."
} else {
    Write-Host "Restore failed!"
    exit 1
}

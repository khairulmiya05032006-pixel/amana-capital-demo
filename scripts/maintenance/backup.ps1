param()

# Load environment variables
if (Test-Path ".env") {
    Get-Content .env | Where-Object { $_ -match "^([^#]+?)=(.+)$" } | ForEach-Object {
        $name, $value = $_ -split '=', 2
        Set-Item -Path "env:\$name" -Value $value
    }
}

$BACKUP_DIR = "./database/backups"
if (-not (Test-Path $BACKUP_DIR)) {
    New-Item -ItemType Directory -Path $BACKUP_DIR | Out-Null
}

$TIMESTAMP = Get-Date -Format "yyyyMMdd_HHmmss"
$BACKUP_FILE = "$BACKUP_DIR\backup_$TIMESTAMP.sql"

Write-Host "Starting backup of $($env:DB_NAME)..."
# Pass arguments to mysqldump
mysqldump -h $env:DB_HOST -P $env:DB_PORT -u $env:DB_USER -p"$env:DB_PASSWORD" --ssl-mode=REQUIRED $env:DB_NAME > $BACKUP_FILE

if ($LASTEXITCODE -eq 0) {
    Write-Host "Backup successfully saved to $BACKUP_FILE"
} else {
    Write-Host "Backup failed!"
    exit 1
}

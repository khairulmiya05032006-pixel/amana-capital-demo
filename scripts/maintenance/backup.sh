#!/bin/bash
# backup.sh - Automated Backup Script
source .env
BACKUP_DIR="./database/backups"
mkdir -p $BACKUP_DIR
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql"

echo "Starting backup of $DB_NAME..."
mysqldump -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD $DB_NAME > $BACKUP_FILE

if [ $? -eq 0 ]; then
  echo "Backup successfully saved to $BACKUP_FILE"
  # Optional: compress backup
  gzip $BACKUP_FILE
else
  echo "Backup failed!"
  exit 1
fi

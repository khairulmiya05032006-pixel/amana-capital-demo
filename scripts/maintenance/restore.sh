#!/bin/bash
# restore.sh - Automated Restore Script
source .env

if [ -z "$1" ]; then
  echo "Usage: ./restore.sh <backup_file.sql.gz>"
  exit 1
fi

BACKUP_FILE=$1

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup file not found!"
  exit 1
fi

echo "Restoring $DB_NAME from $BACKUP_FILE..."

# Uncompress and pipe to mysql
gunzip -c "$BACKUP_FILE" | mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD $DB_NAME

if [ $? -eq 0 ]; then
  echo "Restore completed successfully."
else
  echo "Restore failed!"
  exit 1
fi

#!/bin/bash
set -e

echo "Initializing Database Structure..."

# Run Schema
for f in /app-database/schema/*.sql; do
  echo "Running $f"
  mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" < "$f"
done

# Run Views
for f in /app-database/views/*.sql; do
  echo "Running $f"
  mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" < "$f"
done

# Run Procedures
for f in /app-database/procedures/*.sql; do
  echo "Running $f"
  mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" < "$f"
done

# Run Seeders
for f in /app-database/seeders/*.sql; do
  echo "Running $f"
  mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" < "$f"
done

echo "Database Initialization Complete."

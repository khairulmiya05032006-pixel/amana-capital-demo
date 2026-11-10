Start-Process "node" -ArgumentList "app.js" -NoNewWindow
Start-Process "node" -ArgumentList "services/auth-service/index.js" -NoNewWindow
Start-Process "node" -ArgumentList "services/loan-service/index.js" -NoNewWindow
Start-Process "node" -ArgumentList "services/payment-service/index.js" -NoNewWindow
Start-Process "node" -ArgumentList "services/admin-service/index.js" -NoNewWindow
Write-Host "All microservices started."

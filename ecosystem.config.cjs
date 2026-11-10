module.exports = {
  apps: [
    {
      name: 'gateway-app',
      script: './app.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 8080
      }
    },
    {
      name: 'auth-service',
      script: './microservices/authService.js',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 8081
      }
    },
    {
      name: 'loan-service',
      script: './microservices/loanService.js',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 8082
      }
    },
    {
      name: 'payment-service',
      script: './microservices/paymentService.js',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 8083
      }
    },
    {
      name: 'admin-service',
      script: './microservices/adminService.js',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 8084
      }
    }
  ]
};

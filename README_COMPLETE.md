# MicroFinance Loan Management System

A comprehensive Node.js/Express-based microfinance loan management application with a complete MySQL database backend.

## Features

- **User Management**: Role-based access (Admin/Customer)
- **Customer Management**: Profile management and KYC
- **Loan Applications**: Submit and manage loan applications
- **Loan Management**: Track active loans, EMI schedules
- **Payment Processing**: Record and track loan payments
- **Reports**: Generate business and financial reports
- **Audit Logging**: Complete audit trail of all transactions

## Tech Stack

- **Backend**: Node.js, Express.js 5.x
- **Database**: MySQL 8.0+
- **Templating**: EJS with EJS-Mate for layouts
- **Security**: BCrypt, JWT, Helmet
- **File Upload**: Multer
- **Validation**: Express-Validator
- **Session**: Express-Session
- **Logging**: Morgan

## Project Structure

microfinance/
├── config/              # Configuration files
├── controllers/         # Request handlers
├── database/            # SQL scripts, backups, migrations
├── middleware/          # Express middleware (Security, Logging, RBAC)
├── models/              # Database access layer
├── public/              # Static files (CSS, JS, images)
├── routes/              # API route definitions
├── scripts/             # Dev scripts and utilities
├── services/            # Internal Microservices
├── utils/               # Utility functions (Logger, Validator)
├── views/               # EJS templates
├── app.js               # Express app setup
├── ecosystem.config.cjs # PM2 ecosystem file
├── nginx.conf           # Production NGINX configuration
├── RUNBOOK.md           # Operational Runbook
├── server.js            # Server startup
└── package.json         # Dependencies
```

## Documentation
- **Runbook**: See [RUNBOOK.md](./RUNBOOK.md) for operational procedures, backup/restore instructions, and troubleshooting.

## Installation

1. Clone the repository
```bash
git clone <repository-url>
cd microfinance
```

2. Install dependencies
```bash
npm install
```

3. Create `.env` file
```env
PORT=8080
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=microfinance_db
JWT_SECRET=your-secret-key
NODE_ENV=development
```

4. Set up the database
```bash
bash database/setup.sh
```

5. Start the application
```bash
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/logout` - User logout

### Users
- `GET /api/users` - Get all users
- `GET /api/users/id/:id` - Get user by ID
- `GET /users/view` - View users (HTML)

### Customers
- `GET /api/customers` - Get all customers
- `POST /api/customers` - Create customer
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer

### Loans
- `GET /api/loans` - Get all loans
- `POST /api/loans` - Create loan
- `GET /api/loans/:id` - Get loan details
- `POST /api/loans/:id/close` - Close loan

### Loan Applications
- `GET /api/applications` - Get all applications
- `POST /api/applications` - Submit application
- `POST /api/applications/:id/approve` - Approve application
- `POST /api/applications/:id/reject` - Reject application

### Payments
- `GET /api/payments` - Get all payments
- `POST /api/payments` - Record payment
- `GET /api/payments/loan/:loanId` - Get payments by loan

### Reports
- `GET /api/reports/dashboard` - Dashboard statistics
- `GET /api/reports/overdue-loans` - Overdue loans report
- `GET /api/reports/collection` - Collection report

## Database Schema

### Core Tables
- `users` - System users (Admin, Customer)
- `customer_profiles` - Customer information
- `loan_types` - Loan type definitions
- `loans` - Approved loans
- `loan_applications` - Loan applications

### Transaction Tables
- `payments` - Payment records
- `loan_installments` - EMI schedule
- `loan_transactions` - Transaction logs

### Audit Tables
- `audit_logs` - Change history
- `loan_status_history` - Loan status changes

## Key Features

### EMI Calculation
- Automatic EMI schedule generation
- Compound interest calculation
- Amortization schedule

### Reports
- Dashboard summary
- Overdue loan analysis
- Collection reports
- Monthly financial reports

### Security
- Password hashing with BCrypt
- JWT-based authentication
- Role-based access control
- Input validation and sanitization
- Helmet for HTTP headers

## Development

### Run in Development Mode
```bash
npm run dev
```

### Run Tests
```bash
npm test
```

### Database Migrations
All SQL scripts are in `database/schema/` directory. Run them in order:
```bash
mysql -u root -p microfinance_db < database/schema/001_create_database.sql
# ... continue with all schema files
```

## Documentation

- [Database ERD](database/docs/ERD.md) - Entity relationship diagram
- [Business Rules](database/docs/Business_Rules.md) - Business logic rules
- [Naming Conventions](database/docs/Naming_Conventions.md) - Code naming standards
- [Stored Procedures](database/docs/Stored_Procedures.md) - Database procedures

## License

MIT License - See LICENSE file for details

## Support

For issues, questions, or contributions, please create an issue in the repository.

## Changelog

### Version 1.0.0 (2026-07-18)
- Initial project setup
- Database schema implementation
- API endpoints scaffolding
- UI views with EJS templates
- Core middleware implementation


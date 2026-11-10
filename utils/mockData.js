// Mock/Sample user data for testing
export const mockUsers = [
  {
    id: 1,
    user_code: "ADM001",
    email: "admin@microfinance.com",
    role: "ADMIN",
    account_status: "ACTIVE",
    last_login: new Date("2026-07-18T10:30:00"),
    created_at: new Date("2026-01-01T00:00:00"),
    updated_at: new Date("2026-07-18T10:30:00"),
  },
  {
    id: 2,
    user_code: "CUST001",
    email: "john.doe@example.com",
    role: "CUSTOMER",
    account_status: "ACTIVE",
    last_login: new Date("2026-07-17T15:45:00"),
    created_at: new Date("2026-02-15T08:20:00"),
    updated_at: new Date("2026-07-17T15:45:00"),
  },
  {
    id: 3,
    user_code: "CUST002",
    email: "jane.smith@example.com",
    role: "CUSTOMER",
    account_status: "ACTIVE",
    last_login: new Date("2026-07-16T12:00:00"),
    created_at: new Date("2026-03-10T14:30:00"),
    updated_at: new Date("2026-07-16T12:00:00"),
  },
  {
    id: 4,
    user_code: "CUST003",
    email: "mike.johnson@example.com",
    role: "CUSTOMER",
    account_status: "ACTIVE",
    last_login: new Date("2026-07-15T09:15:00"),
    created_at: new Date("2026-04-05T11:45:00"),
    updated_at: new Date("2026-07-15T09:15:00"),
  },
  {
    id: 5,
    user_code: "CUST004",
    email: "sarah.wilson@example.com",
    role: "CUSTOMER",
    account_status: "INACTIVE",
    last_login: new Date("2026-06-20T16:30:00"),
    created_at: new Date("2026-05-12T13:00:00"),
    updated_at: new Date("2026-06-20T16:30:00"),
  },
];

// Get all mock users
export const getAllMockUsers = () => {
  return mockUsers;
};

// Get mock user by ID
export const getMockUserById = (id) => {
  return mockUsers.find((user) => user.id === parseInt(id));
};

// Get mock user by code
export const getMockUserByCode = (userCode) => {
  return mockUsers.find((user) => user.user_code === userCode);
};

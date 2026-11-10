// User Model
export const getUserById = async (db, userId) => {
  try {
    const [users] = await db.query(
      'SELECT id, user_code, email, role, account_status, last_login, created_at, updated_at FROM users WHERE id = ?',
      [userId]
    );
    return users.length > 0 ? users[0] : null;
  } catch (error) {
    throw new Error(`Error fetching user: ${error.message}`);
  }
};

export const getUserByEmail = async (db, email) => {
  try {
    const [users] = await db.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    return users.length > 0 ? users[0] : null;
  } catch (error) {
    throw new Error(`Error fetching user by email: ${error.message}`);
  }
};

export const getAllUsers = async (db) => {
  try {
    const [users] = await db.query(
      'SELECT id, user_code, email, role, account_status, last_login, created_at, updated_at FROM users'
    );
    return users;
  } catch (error) {
    throw new Error(`Error fetching users: ${error.message}`);
  }
};

export const createUser = async (db, userData) => {
  try {
    const { userCode, email, passwordHash, role } = userData;
    const [result] = await db.query(
      'INSERT INTO users (user_code, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [userCode, email, passwordHash, role]
    );
    return result.insertId;
  } catch (error) {
    throw new Error(`Error creating user: ${error.message}`);
  }
};

export const updateUser = async (db, userId, userData) => {
  try {
    const [result] = await db.query(
      'UPDATE users SET ? WHERE id = ?',
      [userData, userId]
    );
    return result.affectedRows > 0;
  } catch (error) {
    throw new Error(`Error updating user: ${error.message}`);
  }
};

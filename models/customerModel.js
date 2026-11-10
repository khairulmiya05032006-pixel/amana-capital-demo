// Customer Model
export const getCustomerById = async (db, customerId) => {
  try {
    const [customers] = await db.query(
      'SELECT * FROM customer_profiles WHERE id = ?',
      [customerId]
    );
    return customers.length > 0 ? customers[0] : null;
  } catch (error) {
    throw new Error(`Error fetching customer: ${error.message}`);
  }
};

export const getAllCustomers = async (db) => {
  try {
    const [customers] = await db.query(
      'SELECT * FROM customer_profiles'
    );
    return customers;
  } catch (error) {
    throw new Error(`Error fetching customers: ${error.message}`);
  }
};

export const createCustomer = async (db, customerData) => {
  try {
    const [result] = await db.query(
      'INSERT INTO customer_profiles SET ?',
      [customerData]
    );
    return result.insertId;
  } catch (error) {
    throw new Error(`Error creating customer: ${error.message}`);
  }
};

export const updateCustomer = async (db, customerId, customerData) => {
  try {
    const [result] = await db.query(
      'UPDATE customer_profiles SET ? WHERE id = ?',
      [customerData, customerId]
    );
    return result.affectedRows > 0;
  } catch (error) {
    throw new Error(`Error updating customer: ${error.message}`);
  }
};

export const deleteCustomer = async (db, customerId) => {
  try {
    const [result] = await db.query(
      'DELETE FROM customer_profiles WHERE id = ?',
      [customerId]
    );
    return result.affectedRows > 0;
  } catch (error) {
    throw new Error(`Error deleting customer: ${error.message}`);
  }
};

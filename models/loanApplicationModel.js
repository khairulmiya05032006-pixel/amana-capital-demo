// Loan Application Model
export const getApplicationById = async (db, applicationId) => {
  try {
    const [apps] = await db.query(
      'SELECT * FROM loan_applications WHERE id = ?',
      [applicationId]
    );
    return apps.length > 0 ? apps[0] : null;
  } catch (error) {
    throw new Error(`Error fetching application: ${error.message}`);
  }
};

export const getAllApplications = async (db) => {
  try {
    const [apps] = await db.query(
      'SELECT * FROM loan_applications'
    );
    return apps;
  } catch (error) {
    throw new Error(`Error fetching applications: ${error.message}`);
  }
};

export const createApplication = async (db, appData) => {
  try {
    const [result] = await db.query(
      'INSERT INTO loan_applications SET ?',
      [appData]
    );
    return result.insertId;
  } catch (error) {
    throw new Error(`Error creating application: ${error.message}`);
  }
};

export const updateApplication = async (db, applicationId, appData) => {
  try {
    const [result] = await db.query(
      'UPDATE loan_applications SET ? WHERE id = ?',
      [appData, applicationId]
    );
    return result.affectedRows > 0;
  } catch (error) {
    throw new Error(`Error updating application: ${error.message}`);
  }
};

export const getApplicationsByCustomer = async (db, customerId) => {
  try {
    const [apps] = await db.query(
      'SELECT * FROM loan_applications WHERE customer_id = ?',
      [customerId]
    );
    return apps;
  } catch (error) {
    throw new Error(`Error fetching customer applications: ${error.message}`);
  }
};

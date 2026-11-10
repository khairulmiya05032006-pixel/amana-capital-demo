import db from '../config/db.js';
import * as customerModel from '../models/customerModel.js';

export const getAllCustomers = async (req, res, next) => {
  try {
    const customers = await customerModel.getAllCustomers(db);
    res.json({ success: true, data: customers });
  } catch (error) {
    next(error);
  }
};

export const getCustomerById = async (req, res, next) => {
  try {
    const customer = await customerModel.getCustomerById(db, req.params.id);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    res.json({ success: true, data: customer });
  } catch (error) {
    next(error);
  }
};

export const createCustomer = async (req, res, next) => {
  try {
    const customerData = {
      ...req.body,
      customer_code: `CP${Date.now().toString().slice(-6)}`
    };
    
    // Note: this method may not be needed if register creates the profile
    const newId = await customerModel.createCustomer(db, customerData);
    res.status(201).json({ success: true, message: 'Customer created successfully', customerId: newId });
  } catch (error) {
    next(error);
  }
};

export const updateCustomer = async (req, res, next) => {
  try {
    const updated = await customerModel.updateCustomer(db, req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Customer not found or no changes made' });
    }
    res.json({ success: true, message: 'Customer updated successfully' });
  } catch (error) {
    next(error);
  }
};

export const deleteCustomer = async (req, res, next) => {
  try {
    const deleted = await customerModel.deleteCustomer(db, req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    res.json({ success: true, message: 'Customer deleted successfully' });
  } catch (error) {
    next(error);
  }
};

import SchemeService from '../services/schemeService.js';
import ScheduleService from '../services/scheduleService.js';

export const listSchemes = async (req, res, next) => {
  try {
    const filters = {
      status: req.query.status,
      repayment_frequency: req.query.frequency,
      search: req.query.search
    };
    const schemes = await SchemeService.listSchemes(filters);
    res.render('admin/schemes/index', { schemes, filters, title: 'Loan Schemes' });
  } catch (error) {
    next(error);
  }
};

export const showCreateForm = async (req, res) => {
  res.render('admin/schemes/create', { title: 'Create Loan Scheme' });
};

export const showEditForm = async (req, res, next) => {
  try {
    const scheme = await SchemeService.getSchemeById(req.params.id);
    res.render('admin/schemes/edit', { scheme, title: 'Edit Loan Scheme' });
  } catch (error) {
    next(error);
  }
};

export const showSchemeDetails = async (req, res, next) => {
  try {
    const scheme = await SchemeService.getSchemeById(req.params.id);
    // Add dummy or real performance stats here
    res.render('admin/schemes/details', { scheme, title: 'Scheme Details' });
  } catch (error) {
    next(error);
  }
};

export const createScheme = async (req, res, next) => {
  try {
    const userId = res.locals.user.id;
    await SchemeService.createScheme(req.body, userId);
    res.redirect('/admin/schemes?success=Scheme created successfully');
  } catch (error) {
    res.render('admin/schemes/create', { error: error.message, title: 'Create Loan Scheme', data: req.body });
  }
};

export const updateScheme = async (req, res, next) => {
  try {
    const userId = res.locals.user.id;
    await SchemeService.updateScheme(req.params.id, req.body, userId);
    res.redirect(`/admin/schemes/${req.params.id}?success=Scheme updated successfully`);
  } catch (error) {
    res.redirect(`/admin/schemes/${req.params.id}/edit?error=` + encodeURIComponent(error.message));
  }
};

export const cloneScheme = async (req, res, next) => {
  try {
    const userId = res.locals.user.id;
    const isNewVersion = req.body.is_new_version === 'true';
    const newId = await SchemeService.cloneScheme(req.params.id, req.body, isNewVersion, userId);
    res.redirect(`/admin/schemes/${newId}/edit?success=Scheme cloned successfully`);
  } catch (error) {
    next(error);
  }
};

export const changeStatus = async (req, res, next) => {
  try {
    const userId = res.locals.user.id;
    await SchemeService.changeStatus(req.params.id, req.body.status, userId);
    res.redirect(`/admin/schemes/${req.params.id}?success=Status changed successfully`);
  } catch (error) {
    next(error);
  }
};

export const previewSchedule = async (req, res) => {
  try {
    const { amount, duration, interest_rate, interest_amount, flat_interest_amount } = req.query;
    const schemeId = req.params.id;
    
    const scheme = await SchemeService.getSchemeById(schemeId);
    
    // Apply overrides for preview
    if (duration) scheme.duration_value = parseInt(duration, 10);

    const rawInterest = interest_amount !== undefined ? interest_amount : flat_interest_amount;
    if (rawInterest !== undefined && rawInterest !== null && rawInterest !== '') {
      scheme.interest_calculation_method = 'FLAT_AMOUNT';
      scheme.flat_interest_amount = parseFloat(rawInterest);
      scheme.interest_amount = parseFloat(rawInterest);
    } else if (interest_rate) {
      scheme.base_interest_rate = parseFloat(interest_rate);
    } else if (scheme.base_interest_amount !== undefined && scheme.base_interest_amount !== null) {
      scheme.interest_calculation_method = 'FLAT_AMOUNT';
      scheme.flat_interest_amount = parseFloat(scheme.base_interest_amount);
    }

    const startDate = new Date().toISOString().split('T')[0];
    const preview = ScheduleService.generateSchedule(scheme, parseFloat(amount), startDate);

    res.json({ success: true, preview });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

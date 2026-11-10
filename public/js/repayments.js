/**
 * Admin Loan Repayment System - Client-side JS Workspace Modal & Engine
 * Handles Keyboard Shortcuts, Dynamic Two-Column Modal Workspace, Live Calculation Engine,
 * Inline Confirmation Flow, Async Fetch Submissions, Smooth Animations, and Toasts.
 */
document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const modalEl = document.getElementById('paymentWorkspaceModal');
  const modalCloseBtns = document.querySelectorAll('.payment-modal-close-trigger');
  const modalOverlay = document.getElementById('paymentModalBackdrop');
  
  // Search & Global Inputs
  const globalSearchInput = document.getElementById('searchQueryInput');
  const searchResultsDropdown = document.getElementById('searchResultsDropdown');

  // Modal Form Inputs
  const modalForm = document.getElementById('workspacePaymentForm');
  const modalLoanIdInput = document.getElementById('workspaceLoanId');
  const modalInstIdInput = document.getElementById('workspaceInstallmentId');
  const modalAmountInput = document.getElementById('workspacePaymentAmount');
  const modalMethodSelect = document.getElementById('workspacePaymentMethod');
  const modalRefGroup = document.getElementById('workspaceRefGroup');
  const modalRefInput = document.getElementById('workspaceReferenceNumber');
  const modalRefAsterisk = document.getElementById('workspaceRefAsterisk');
  const modalDateInput = document.getElementById('workspacePaymentDate');
  const modalRemarksInput = document.getElementById('workspaceRemarks');

  // Modal Left Column Card Elements
  const modalCustAvatar = document.getElementById('workspaceCustAvatar');
  const modalCustName = document.getElementById('workspaceCustName');
  const modalCustCode = document.getElementById('workspaceCustCode');
  const modalCustPhone = document.getElementById('workspaceCustPhone');

  const modalLoanNumber = document.getElementById('workspaceLoanNumber');
  const modalPrincipal = document.getElementById('workspacePrincipal');
  const modalRate = document.getElementById('workspaceRate');
  const modalDuration = document.getElementById('workspaceDuration');
  const modalEmi = document.getElementById('workspaceEmi');
  const modalOutstanding = document.getElementById('workspaceOutstanding');
  const modalTotalPaid = document.getElementById('workspaceTotalPaid');
  const modalProgressBar = document.getElementById('workspaceProgressBar');
  const modalProgressText = document.getElementById('workspaceProgressText');

  const modalInstNo = document.getElementById('workspaceInstNo');
  const modalInstDueDate = document.getElementById('workspaceInstDueDate');
  const modalInstEmiAmount = document.getElementById('workspaceInstEmiAmount');
  const modalInstStatusBadge = document.getElementById('workspaceInstStatusBadge');

  // Modal Right Column Live Calc Elements
  const calcOutstandingEl = document.getElementById('calcOutstanding');
  const calcPaymentAmountEl = document.getElementById('calcPaymentAmount');
  const calcRemainingAfterEl = document.getElementById('calcRemainingAfter');
  const calcTypeBadgeEl = document.getElementById('calcTypeBadge');
  const calcNoticeTextEl = document.getElementById('calcNoticeText');

  // Confirmation Panel Elements inside Modal
  const confirmPanel = document.getElementById('workspaceConfirmPanel');
  const confirmCustName = document.getElementById('confirmCustName');
  const confirmLoanNum = document.getElementById('confirmLoanNum');
  const confirmAmount = document.getElementById('confirmAmount');
  const confirmMethod = document.getElementById('confirmMethod');
  const confirmRef = document.getElementById('confirmRef');
  const confirmDate = document.getElementById('confirmDate');
  const btnCancelConfirm = document.getElementById('btnCancelConfirm');
  const btnSubmitConfirm = document.getElementById('btnSubmitConfirm');
  const btnReceivePaymentInit = document.getElementById('btnReceivePaymentInit');

  // State
  let currentLoanData = null;
  let isConfirming = false;
  let calcDebounceTimeout = null;

  // Formatters
  const formatINR = (val) => '₹' + (parseFloat(val) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const formatDateStr = (dStr) => dStr ? new Date(dStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';

  // 1. Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    // Escape key closes modal or cancels confirmation
    if (e.key === 'Escape') {
      if (isConfirming) {
        cancelConfirmation();
      } else if (modalEl && modalEl.classList.contains('show')) {
        closeModal();
      }
    }
    // Enter key submits confirmation if confirmation panel is active
    else if (e.key === 'Enter' && isConfirming) {
      e.preventDefault();
      executePaymentSubmission();
    }
    // "/" key focuses global search input
    else if (e.key === '/' && globalSearchInput && document.activeElement !== globalSearchInput && (!modalEl || !modalEl.classList.contains('show'))) {
      e.preventDefault();
      globalSearchInput.focus();
    }
  });

  // 2. Open Modal Event Listeners
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('.open-payment-modal, .btn-receive-payment');
    if (trigger) {
      e.preventDefault();
      const loanId = trigger.getAttribute('data-loan-id');
      const instId = trigger.getAttribute('data-installment-id');
      const amount = trigger.getAttribute('data-amount');
      openModal(loanId, instId, amount);
    }
  });

  if (modalCloseBtns) {
    modalCloseBtns.forEach(btn => btn.addEventListener('click', closeModal));
  }
  if (modalOverlay) {
    modalOverlay.addEventListener('click', closeModal);
  }

  // 3. Open Modal Function & Data Fetching
  async function openModal(loanId, instId = null, defaultAmount = null) {
    if (!modalEl || !loanId) return;

    try {
      // Fetch full loan details via JSON API
      const res = await fetch(`/admin/repayments/${encodeURIComponent(loanId)}`, {
        headers: { 'Accept': 'application/json' }
      });
      const json = await res.json();

      if (!json.success || !json.data) {
        showToast(json.message || 'Failed to fetch loan details', 'error');
        return;
      }

      currentLoanData = json.data;
      populateModalData(currentLoanData, instId, defaultAmount);

      modalEl.classList.add('show');
      modalEl.style.display = 'block';
      if (modalOverlay) modalOverlay.style.display = 'block';

      // Auto-focus payment amount field
      setTimeout(() => {
        if (modalAmountInput) {
          modalAmountInput.focus();
          modalAmountInput.select();
        }
      }, 150);

    } catch (err) {
      console.error('Error opening payment modal:', err);
      showToast('Network error while loading loan details', 'error');
    }
  }

  function closeModal() {
    if (!modalEl) return;
    modalEl.classList.remove('show');
    modalEl.style.display = 'none';
    if (modalOverlay) modalOverlay.style.display = 'none';
    cancelConfirmation();
  }

  // 4. Populate Modal Left Column Cards & Inputs
  function populateModalData(data, selectedInstId = null, defaultAmount = null) {
    const { loan, customer, installments, nextEmi, totalPaid } = data;

    // Customer Card
    if (modalCustAvatar) modalCustAvatar.textContent = (customer.name || 'C').charAt(0).toUpperCase();
    if (modalCustName) modalCustName.textContent = customer.name;
    if (modalCustCode) modalCustCode.textContent = customer.code;
    if (modalCustPhone) modalCustPhone.textContent = customer.phone;

    // Loan Summary Card
    const principal = parseFloat(loan.principal_amount || 0);
    const payable = parseFloat(loan.total_payable || (principal * 1.15));
    const paid = parseFloat(totalPaid || 0);
    const outstanding = parseFloat(loan.outstanding_balance || 0);
    const emi = parseFloat(loan.emi_amount || 0);

    if (modalLoanNumber) modalLoanNumber.textContent = loan.loan_number;
    if (modalPrincipal) modalPrincipal.textContent = formatINR(principal);
    if (modalRate) modalRate.textContent = `${loan.annual_interest_rate || 0}%`;
    if (modalDuration) modalDuration.textContent = `${loan.tenure_months || 0} Mos`;
    if (modalEmi) modalEmi.textContent = formatINR(emi);
    if (modalOutstanding) modalOutstanding.textContent = formatINR(outstanding);
    if (modalTotalPaid) modalTotalPaid.textContent = formatINR(paid);

    // Progress Bar (paid / payable * 100)
    const pct = payable > 0 ? Math.min(100, Math.max(0, Math.round((paid / payable) * 100))) : 0;
    if (modalProgressBar) modalProgressBar.style.width = `${pct}%`;
    if (modalProgressText) modalProgressText.textContent = `${pct}% Paid`;

    // Next EMI Card
    const activeEmi = nextEmi || (installments.length > 0 ? installments[0] : null);
    if (activeEmi) {
      if (modalInstNo) modalInstNo.textContent = `# ${activeEmi.installment_number}`;
      if (modalInstDueDate) modalInstDueDate.textContent = formatDateStr(activeEmi.due_date);
      if (modalInstEmiAmount) modalInstEmiAmount.textContent = formatINR(activeEmi.total_amount || emi);
      
      if (modalInstStatusBadge) {
        modalInstStatusBadge.textContent = activeEmi.installment_status;
        modalInstStatusBadge.className = `admin-badge ${activeEmi.installment_status === 'OVERDUE' ? 'badge-danger' : (activeEmi.installment_status === 'PARTIALLY_PAID' ? 'badge-warning' : 'badge-success')}`;
      }
      if (modalInstIdInput) modalInstIdInput.value = activeEmi.id;
    } else {
      if (modalInstNo) modalInstNo.textContent = 'None';
      if (modalInstDueDate) modalInstDueDate.textContent = 'Settled';
      if (modalInstEmiAmount) modalInstEmiAmount.textContent = '₹0';
      if (modalInstStatusBadge) {
        modalInstStatusBadge.textContent = 'CLOSED';
        modalInstStatusBadge.className = 'admin-badge badge-purple';
      }
    }

    // Set Hidden Inputs
    if (modalLoanIdInput) modalLoanIdInput.value = loan.id;
    if (modalDateInput) modalDateInput.value = new Date().toISOString().split('T')[0];

    // Initial Payment Amount Value
    let initialPayAmount = defaultAmount ? parseFloat(defaultAmount) : (activeEmi ? (parseFloat(activeEmi.total_amount || emi) - parseFloat(activeEmi.paid_amount || 0)) : outstanding);
    initialPayAmount = Math.min(outstanding, Math.max(1, initialPayAmount));
    
    if (modalAmountInput) {
      modalAmountInput.value = initialPayAmount;
      modalAmountInput.setAttribute('max', outstanding);
    }

    // Reference Requirement Toggle
    updateRefRequirement();

    // Trigger Live Summary Calculation
    updateLiveCalculation();
  }

  // 5. Reference Number Visibility Toggle (Cash vs UPI/Bank Transfer/Cheque)
  if (modalMethodSelect) {
    modalMethodSelect.addEventListener('change', updateRefRequirement);
  }

  function updateRefRequirement() {
    const method = modalMethodSelect ? modalMethodSelect.value : 'CASH';
    if (method === 'CASH') {
      if (modalRefAsterisk) modalRefAsterisk.style.display = 'none';
      if (modalRefInput) {
        modalRefInput.removeAttribute('required');
        modalRefInput.value = '';
        modalRefInput.placeholder = 'Auto-generated (CASH + timestamp)';
      }
    } else {
      if (modalRefAsterisk) modalRefAsterisk.style.display = 'inline';
      if (modalRefInput) {
        modalRefInput.setAttribute('required', 'true');
        modalRefInput.placeholder = `Enter ${method} Transaction / UTR Ref Number`;
      }
    }
  }

  // 6. Live Payment Calculation Engine with 150ms Debounce
  if (modalAmountInput) {
    modalAmountInput.addEventListener('input', () => {
      clearTimeout(calcDebounceTimeout);
      calcDebounceTimeout = setTimeout(updateLiveCalculation, 150);
    });
  }

  function updateLiveCalculation() {
    if (!currentLoanData || !currentLoanData.loan) return;

    const outstanding = parseFloat(currentLoanData.loan.outstanding_balance || 0);
    const emiAmount = parseFloat(currentLoanData.loan.emi_amount || 0);
    const payAmount = parseFloat(modalAmountInput ? modalAmountInput.value : 0) || 0;

    if (calcOutstandingEl) calcOutstandingEl.textContent = formatINR(outstanding);
    if (calcPaymentAmountEl) calcPaymentAmountEl.textContent = formatINR(payAmount);

    const remaining = Math.max(0, outstanding - payAmount);
    if (calcRemainingAfterEl) {
      calcRemainingAfterEl.textContent = formatINR(remaining);
      calcRemainingAfterEl.style.color = remaining <= 0.01 ? '#22C55E' : '#F8FAFC';
    }

    // Payment Type Detection Logic
    if (!calcTypeBadgeEl || !calcNoticeTextEl) return;

    if (payAmount <= 0) {
      calcTypeBadgeEl.style.display = 'none';
      calcNoticeTextEl.textContent = 'Enter payment amount above.';
      calcNoticeTextEl.style.color = '#94A3B8';
    } else if (payAmount >= outstanding) {
      calcTypeBadgeEl.textContent = 'Loan Settlement';
      calcTypeBadgeEl.className = 'admin-badge badge-settlement';
      calcTypeBadgeEl.style.display = 'inline-flex';
      calcNoticeTextEl.textContent = 'Loan will be closed after this payment ✓';
      calcNoticeTextEl.style.color = '#22C55E';
    } else if (payAmount > emiAmount) {
      const cleared = Math.floor(payAmount / emiAmount);
      calcTypeBadgeEl.textContent = 'Advance Payment';
      calcTypeBadgeEl.className = 'admin-badge badge-advance';
      calcTypeBadgeEl.style.display = 'inline-flex';
      calcNoticeTextEl.textContent = `This payment will clear ~${cleared} EMI(s)`;
      calcNoticeTextEl.style.color = '#14B8A6';
    } else if (Math.abs(payAmount - emiAmount) < 1) {
      calcTypeBadgeEl.textContent = 'Normal EMI';
      calcTypeBadgeEl.className = 'admin-badge badge-normal';
      calcTypeBadgeEl.style.display = 'inline-flex';
      calcNoticeTextEl.textContent = '1 Regular EMI Installment';
      calcNoticeTextEl.style.color = '#3B82F6';
    } else {
      calcTypeBadgeEl.textContent = 'Partial Payment';
      calcTypeBadgeEl.className = 'admin-badge badge-partial';
      calcTypeBadgeEl.style.display = 'inline-flex';
      calcNoticeTextEl.textContent = `Partial payment (${formatINR(emiAmount - payAmount)} remaining on installment)`;
      calcNoticeTextEl.style.color = '#F59E0B';
    }
  }

  // 7. Inline Confirmation Dialog Handling
  if (btnReceivePaymentInit) {
    btnReceivePaymentInit.addEventListener('click', (e) => {
      e.preventDefault();
      validateAndShowConfirmation();
    });
  }

  function validateAndShowConfirmation() {
    if (!currentLoanData || !modalAmountInput || !modalMethodSelect) return;

    const outstanding = parseFloat(currentLoanData.loan.outstanding_balance || 0);
    const payAmount = parseFloat(modalAmountInput.value || 0);
    const method = modalMethodSelect.value;
    const refNum = modalRefInput ? modalRefInput.value.trim() : '';

    // Remove old inline error states
    document.querySelectorAll('.inline-error-msg').forEach(el => el.remove());

    let hasError = false;

    if (isNaN(payAmount) || payAmount <= 0) {
      showInlineError(modalAmountInput, 'Please enter a valid amount greater than ₹0');
      hasError = true;
    } else if (payAmount > outstanding + 1.00) {
      showInlineError(modalAmountInput, `Amount exceeds outstanding balance (${formatINR(outstanding)})`);
      hasError = true;
    }

    if (method !== 'CASH' && (!refNum || refNum === '')) {
      showInlineError(modalRefInput, `Reference number is required for ${method} payments`);
      hasError = true;
    }

    if (hasError) return;

    // Populate Inline Confirmation Panel
    if (confirmCustName) confirmCustName.textContent = currentLoanData.customer.name;
    if (confirmLoanNum) confirmLoanNum.textContent = currentLoanData.loan.loan_number;
    if (confirmAmount) confirmAmount.textContent = formatINR(payAmount);
    if (confirmMethod) confirmMethod.textContent = method;
    if (confirmRef) confirmRef.textContent = method === 'CASH' ? 'Auto-Generated (Cash)' : refNum;
    if (confirmDate) confirmDate.textContent = formatDateStr(modalDateInput ? modalDateInput.value : new Date());

    if (confirmPanel) confirmPanel.style.display = 'block';
    if (btnReceivePaymentInit) btnReceivePaymentInit.style.display = 'none';
    isConfirming = true;
  }

  if (btnCancelConfirm) {
    btnCancelConfirm.addEventListener('click', cancelConfirmation);
  }

  function cancelConfirmation() {
    if (confirmPanel) confirmPanel.style.display = 'none';
    if (btnReceivePaymentInit) btnReceivePaymentInit.style.display = 'block';
    isConfirming = false;
  }

  function showInlineError(inputEl, msg) {
    if (!inputEl) return;
    const err = document.createElement('div');
    err.className = 'inline-error-msg text-danger text-xs mt-1 fw-600';
    err.textContent = msg;
    inputEl.parentNode.appendChild(err);
  }

  // 8. Execute Async Submission via fetch()
  if (btnSubmitConfirm) {
    btnSubmitConfirm.addEventListener('click', executePaymentSubmission);
  }

  async function executePaymentSubmission() {
    if (!currentLoanData || !btnSubmitConfirm) return;

    const method = modalMethodSelect ? modalMethodSelect.value : 'CASH';
    let refNum = modalRefInput ? modalRefInput.value.trim() : '';

    if (method === 'CASH' && (!refNum || refNum === '')) {
      refNum = `CASH${Date.now()}`;
    }

    const payload = {
      loanId: currentLoanData.loan.id,
      installmentId: modalInstIdInput ? modalInstIdInput.value : null,
      amount: parseFloat(modalAmountInput.value),
      paymentMethod: method,
      referenceNumber: refNum,
      paymentDate: modalDateInput ? modalDateInput.value : new Date().toISOString().split('T')[0],
      remarks: modalRemarksInput ? modalRemarksInput.value : ''
    };

    try {
      // Prevent double submission
      btnSubmitConfirm.disabled = true;
      btnSubmitConfirm.innerHTML = `<i class="fa fa-spinner fa-spin me-2"></i> Committing...`;

      const response = await fetch('/admin/repayments/record', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        showToast(result.message || `✓ Payment of ${formatINR(payload.amount)} recorded successfully`, 'success');
        
        closeModal();

        // Refresh Loan Data DOM without full page reload
        refreshLoanPageDOM(result.updatedLoan || currentLoanData.loan, payload.amount);
      } else {
        showToast(result.message || result.error || 'Failed to record payment', 'error');
        btnSubmitConfirm.disabled = false;
        btnSubmitConfirm.innerHTML = `<i class="fa fa-check me-1"></i> Confirm & Submit`;
      }
    } catch (err) {
      console.error('Payment submission failed:', err);
      showToast('Network error while processing payment', 'error');
      btnSubmitConfirm.disabled = false;
      btnSubmitConfirm.innerHTML = `<i class="fa fa-check me-1"></i> Confirm & Submit`;
    }
  }

  // 9. Dynamic DOM Refresh & Smooth Count-Up Animation
  async function refreshLoanPageDOM(updatedLoan, payAmount) {
    // Re-fetch loan details to get updated installments & payments list
    if (!updatedLoan || !updatedLoan.id) return;

    try {
      const res = await fetch(`/admin/repayments/${updatedLoan.id}`, { headers: { 'Accept': 'application/json' } });
      const json = await res.json();

      if (json.success && json.data) {
        const { loan, installments, totalPaid, payments } = json.data;

        // Animate count-up / count-down on outstanding balance element on main page
        const mainOutstandingEl = document.querySelector('.admin-kpi-card .admin-kpi-value');
        if (mainOutstandingEl) {
          mainOutstandingEl.classList.add('number-flash-update');
          mainOutstandingEl.textContent = formatINR(loan.outstanding_balance);
          setTimeout(() => mainOutstandingEl.classList.remove('number-flash-update'), 600);
        }

        // Reload current page cleanly if in tabular search mode
        setTimeout(() => {
          window.location.reload();
        }, 800);
      }
    } catch (e) {
      window.location.reload();
    }
  }

  // 10. Custom Toast Notifications (Bottom-Right Corner)
  function showToast(message, type = 'success') {
    let toastContainer = document.querySelector('.custom-toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.className = 'custom-toast-container';
      document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = `custom-toast custom-toast-${type}`;

    const icon = type === 'success' ? 'fa-check-circle' : (type === 'error' ? 'fa-exclamation-triangle' : 'fa-info-circle');
    toast.innerHTML = `<i class="fa ${icon}" style="font-size: 1.2rem;"></i> <span>${message}</span>`;

    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 400ms ease';
      setTimeout(() => toast.remove(), 400);
    }, 4000);
  }

  // Expose global showToast helper
  window.showToast = showToast;
});

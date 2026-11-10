/**
 * Admin Account - Add Funds Module Client-Side JavaScript
 * Handles Modal, Live Calculation Engine, Reference Field Toggle, Inline Confirmation,
 * Async Fetch Submissions, Smooth Animations, and Toasts.
 */
document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const modalEl = document.getElementById('addFundsModal');
  const modalBackdrop = document.getElementById('addFundsModalBackdrop');
  const openModalBtns = document.querySelectorAll('.btn-open-add-funds-modal');
  const closeModalBtns = document.querySelectorAll('.btn-close-add-funds-modal');

  const form = document.getElementById('addFundsForm');
  const amountInput = document.getElementById('fundAmountInput');
  const sourceSelect = document.getElementById('fundSourceSelect');
  const methodSelect = document.getElementById('fundMethodSelect');
  const refGroup = document.getElementById('fundRefGroup');
  const refInput = document.getElementById('fundRefInput');
  const refAsterisk = document.getElementById('fundRefAsterisk');
  const dateInput = document.getElementById('fundDateInput');
  const descInput = document.getElementById('fundDescInput');

  // Live Calculation Elements
  const previewCurrentBalEl = document.getElementById('previewCurrentBalance');
  const previewDepositEl = document.getElementById('previewDepositAmount');
  const previewNewBalEl = document.getElementById('previewNewBalance');

  // Confirmation Panel Elements
  const btnInitSubmit = document.getElementById('btnInitAddFunds');
  const confirmPanel = document.getElementById('addFundsConfirmPanel');
  const confirmAmountEl = document.getElementById('confirmFundAmount');
  const confirmSourceEl = document.getElementById('confirmFundSource');
  const confirmMethodEl = document.getElementById('confirmFundMethod');
  const confirmRefEl = document.getElementById('confirmFundRef');
  const confirmDateEl = document.getElementById('confirmFundDate');
  const btnCancelConfirm = document.getElementById('btnCancelFundConfirm');
  const btnSubmitConfirm = document.getElementById('btnSubmitFundConfirm');

  // State
  let isConfirming = false;
  let calcDebounceTimeout = null;

  const formatINR = (val) => '₹' + (parseFloat(val) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const formatDateStr = (dStr) => dStr ? new Date(dStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';

  // 1. Open & Close Modal Events
  openModalBtns.forEach(btn => btn.addEventListener('click', openModal));
  closeModalBtns.forEach(btn => btn.addEventListener('click', closeModal));
  if (modalBackdrop) modalBackdrop.addEventListener('click', closeModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (isConfirming) {
        cancelConfirmation();
      } else if (modalEl && modalEl.classList.contains('show')) {
        closeModal();
      }
    }
  });

  function openModal() {
    if (!modalEl) return;
    
    // Set default date to today
    if (dateInput && !dateInput.value) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }

    updateRefFieldVisibility();
    updateLivePreview();

    modalEl.classList.add('show');
    modalEl.style.display = 'block';
    if (modalBackdrop) modalBackdrop.style.display = 'block';

    // Auto-focus amount input
    setTimeout(() => {
      if (amountInput) {
        amountInput.focus();
        amountInput.select();
      }
    }, 150);
  }

  function closeModal() {
    if (!modalEl) return;
    modalEl.classList.remove('show');
    modalEl.style.display = 'none';
    if (modalBackdrop) modalBackdrop.style.display = 'none';
    cancelConfirmation();
  }

  // 2. Reference Field Visibility Toggle (Cash vs Non-Cash)
  if (methodSelect) {
    methodSelect.addEventListener('change', updateRefFieldVisibility);
  }

  function updateRefFieldVisibility() {
    const method = methodSelect ? methodSelect.value : 'CASH';
    if (method === 'CASH') {
      if (refAsterisk) refAsterisk.style.display = 'none';
      if (refInput) {
        refInput.removeAttribute('required');
        refInput.value = '';
        refInput.placeholder = 'Auto-generated (CASH + timestamp)';
      }
    } else {
      if (refAsterisk) refAsterisk.style.display = 'inline';
      if (refInput) {
        refInput.setAttribute('required', 'true');
        refInput.placeholder = `Enter ${method} UTR / Reference Number`;
      }
    }
  }

  // 3. Live Preview Calculation Engine
  if (amountInput) {
    amountInput.addEventListener('input', () => {
      clearTimeout(calcDebounceTimeout);
      calcDebounceTimeout = setTimeout(updateLivePreview, 100);
    });
  }

  function updateLivePreview() {
    const rawCurrentBal = parseFloat(form?.getAttribute('data-current-balance') || 0);
    const depositAmt = parseFloat(amountInput ? amountInput.value : 0) || 0;
    const newBal = rawCurrentBal + depositAmt;

    if (previewCurrentBalEl) previewCurrentBalEl.textContent = formatINR(rawCurrentBal);
    if (previewDepositEl) previewDepositEl.textContent = formatINR(depositAmt);
    if (previewNewBalEl) {
      previewNewBalEl.textContent = formatINR(newBal);
      previewNewBalEl.style.color = depositAmt > 0 ? '#22C55E' : '#F8FAFC';
    }
  }

  // 4. Confirmation Flow inside Modal
  if (btnInitSubmit) {
    btnInitSubmit.addEventListener('click', (e) => {
      e.preventDefault();
      validateAndShowConfirmation();
    });
  }

  function validateAndShowConfirmation() {
    const depositAmt = parseFloat(amountInput ? amountInput.value : 0);
    const method = methodSelect ? methodSelect.value : 'CASH';
    const refNum = refInput ? refInput.value.trim() : '';

    // Clear old errors
    document.querySelectorAll('.inline-error-msg').forEach(el => el.remove());

    let hasError = false;

    if (isNaN(depositAmt) || depositAmt <= 0) {
      showInlineError(amountInput, 'Please enter a valid deposit amount greater than ₹0');
      hasError = true;
    }

    if (method !== 'CASH' && (!refNum || refNum === '')) {
      showInlineError(refInput, `Transaction Reference Number is required for ${method} deposits`);
      hasError = true;
    }

    if (hasError) return;

    // Populate confirmation panel
    if (confirmAmountEl) confirmAmountEl.textContent = formatINR(depositAmt);
    if (confirmSourceEl) confirmSourceEl.textContent = sourceSelect ? sourceSelect.value : 'Owner Investment';
    if (confirmMethodEl) confirmMethodEl.textContent = method;
    if (confirmRefEl) confirmRefEl.textContent = method === 'CASH' ? 'Auto-Generated (Cash)' : refNum;
    if (confirmDateEl) confirmDateEl.textContent = formatDateStr(dateInput ? dateInput.value : new Date());

    if (confirmPanel) confirmPanel.style.display = 'block';
    if (btnInitSubmit) btnInitSubmit.style.display = 'none';
    isConfirming = true;
  }

  if (btnCancelConfirm) {
    btnCancelConfirm.addEventListener('click', cancelConfirmation);
  }

  function cancelConfirmation() {
    if (confirmPanel) confirmPanel.style.display = 'none';
    if (btnInitSubmit) btnInitSubmit.style.display = 'block';
    isConfirming = false;
  }

  function showInlineError(inputEl, msg) {
    if (!inputEl) return;
    const err = document.createElement('div');
    err.className = 'inline-error-msg text-danger text-xs mt-1 fw-600';
    err.textContent = msg;
    inputEl.parentNode.appendChild(err);
  }

  // 5. Submit Add Funds Request via Fetch
  if (btnSubmitConfirm) {
    btnSubmitConfirm.addEventListener('click', executeAddFundsSubmission);
  }

  async function executeAddFundsSubmission() {
    if (!btnSubmitConfirm) return;

    const method = methodSelect ? methodSelect.value : 'CASH';
    let refNum = refInput ? refInput.value.trim() : '';
    if (method === 'CASH' && (!refNum || refNum === '')) {
      refNum = `CASH${Date.now()}`;
    }

    const payload = {
      amount: parseFloat(amountInput.value),
      fundingSource: sourceSelect ? sourceSelect.value : 'Owner Investment',
      paymentMethod: method,
      referenceNumber: refNum,
      depositDate: dateInput ? dateInput.value : new Date().toISOString().split('T')[0],
      description: descInput ? descInput.value : ''
    };

    try {
      btnSubmitConfirm.disabled = true;
      btnSubmitConfirm.innerHTML = `<i class="fa fa-spinner fa-spin me-2"></i> Depositing Funds...`;

      const response = await fetch('/admin/account/add-funds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        showToast(result.message || `✓ ${formatINR(payload.amount)} added to lending capital successfully!`, 'success');
        
        closeModal();

        // Dynamically update account balance on page
        if (result.newBalance !== undefined) {
          updatePageAccountBalance(result.newBalance);
        } else {
          setTimeout(() => window.location.reload(), 800);
        }
      } else {
        showToast(result.message || 'Failed to process deposit', 'error');
        btnSubmitConfirm.disabled = false;
        btnSubmitConfirm.innerHTML = `<i class="fa fa-check me-1"></i> Confirm & Submit`;
      }
    } catch (err) {
      console.error('Error submitting add funds:', err);
      showToast('Network error while processing deposit', 'error');
      btnSubmitConfirm.disabled = false;
      btnSubmitConfirm.innerHTML = `<i class="fa fa-check me-1"></i> Confirm & Submit`;
    }
  }

  // 6. Dynamic DOM Balance Update & Refresh
  async function updatePageAccountBalance(newBal) {
    const mainBalEl = document.getElementById('mainAccountBalance');
    if (mainBalEl) {
      mainBalEl.classList.add('number-flash-update');
      mainBalEl.textContent = formatINR(newBal);
      setTimeout(() => mainBalEl.classList.remove('number-flash-update'), 600);
    }

    // Refresh transaction history table
    try {
      const res = await fetch('/admin/account/transactions?limit=20');
      const json = await res.json();

      if (json.success && json.data) {
        renderTransactionsTable(json.data);
      } else {
        setTimeout(() => window.location.reload(), 800);
      }
    } catch (e) {
      setTimeout(() => window.location.reload(), 800);
    }
  }

  function renderTransactionsTable(transactions) {
    const tbody = document.getElementById('accountTxTableBody');
    if (!tbody) return;

    if (!transactions || transactions.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-4 text-muted text-xs">No account transactions recorded yet.</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = transactions.map(tx => {
      const isCredit = tx.transaction_type === 'CREDIT' || tx.transaction_type === 'FUND_DEPOSIT';
      const source = tx.funding_source || '-';
      const method = (tx.payment_method || 'CASH').replace('_', ' ');
      const ref = tx.reference_number || tx.reference || 'N/A';
      const dateStr = formatDateStr(tx.created_at);

      return `
        <tr>
          <td class="text-xs text-muted">${dateStr}</td>
          <td>
            <span class="admin-badge ${isCredit ? 'badge-success' : 'badge-danger'}">
              ${isCredit ? 'CREDIT' : 'DEBIT'}
            </span>
          </td>
          <td class="fw-700 ${isCredit ? 'text-success' : 'text-danger'}">
            ${isCredit ? '+' : '-'}${formatINR(tx.amount)}
          </td>
          <td class="fw-600 text-heading">${source}</td>
          <td><span class="admin-badge badge-secondary text-xs">${method}</span></td>
          <td class="text-xs text-body font-monospace">${ref}</td>
          <td class="text-xs text-muted">${tx.admin_email || tx.admin_name || 'Admin'}</td>
        </tr>
      `;
    }).join('');
  }

  // 7. Custom Toast Notifications
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

  window.showToast = showToast;
});

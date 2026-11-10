document.addEventListener('DOMContentLoaded', () => {
  const schemeSelect = document.getElementById('schemeId');
  const amountInput = document.getElementById('approvedAmount');
  const interestInput = document.getElementById('interestAmount') || document.getElementById('interestRate');
  const durationInput = document.getElementById('durationValue');
  const overrideCheck = document.getElementById('overrideScheme');
  const btnConfirm = document.getElementById('btnConfirmApprove');
  const previewBox = document.getElementById('schedulePreviewBox');
  const previewContent = document.getElementById('schedulePreviewContent');

  let currentDebounce = null;

  function formatINR(val) {
    const num = parseFloat(val) || 0;
    return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatDate(dateStr) {
    if (!dateStr || dateStr === 'N/A') return 'N/A';
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  }

  function getFrequencyLabel(freq) {
    if (freq === 'DAILY') return 'Daily Installment';
    if (freq === 'WEEKLY') return 'Weekly Installment';
    if (freq === 'MONTHLY') return 'Monthly Installment';
    return 'Regular Installment';
  }

  function updatePreview() {
    if (!schemeSelect || !amountInput || !interestInput || !durationInput) return;

    const schemeId = schemeSelect.value;
    const amountVal = parseFloat(amountInput.value);
    const interestVal = parseFloat(interestInput.value);
    const durationVal = parseInt(durationInput.value, 10);

    const option = schemeSelect.options[schemeSelect.selectedIndex];

    if (!schemeId || isNaN(amountVal) || amountVal <= 0 || isNaN(interestVal) || interestVal < 0 || isNaN(durationVal) || durationVal <= 0) {
      if (previewBox) previewBox.classList.add('d-none');
      if (btnConfirm) btnConfirm.disabled = true;
      return;
    }

    if (currentDebounce) clearTimeout(currentDebounce);

    currentDebounce = setTimeout(async () => {
      try {
        previewBox.classList.remove('d-none');
        btnConfirm.disabled = true;

        const res = await fetch(`/api/schemes/${schemeId}/preview?amount=${amountVal}&interest_amount=${interestVal}&duration=${durationVal}`);
        const data = await res.json();

        if (data.success && data.preview) {
          const sum = data.preview.summary;
          const inst = data.preview.installments || [];

          const firstDate = inst.length > 0 ? inst[0].due_date : 'N/A';
          const lastDate = inst.length > 0 ? inst[inst.length - 1].due_date : 'N/A';
          const freqLabel = getFrequencyLabel(sum.frequency);
          const hasRoundingAdj = (sum.rounding_adjustment && parseFloat(sum.rounding_adjustment) > 0);

          const higherAmt = sum.higher_emi_amount !== undefined ? sum.higher_emi_amount : sum.base_emi;
          const higherCnt = sum.higher_emi_count !== undefined ? sum.higher_emi_count : sum.total_installments;
          const lowerAmt = sum.lower_emi_amount !== undefined ? sum.lower_emi_amount : sum.base_emi;
          const lowerCnt = sum.lower_emi_count !== undefined ? sum.lower_emi_count : 0;

          let html = `
            <div class="row g-2 mb-3 p-3 rounded-3" style="background-color: #F8FAFC; border: 1px solid #E2E8F0;">
              <div class="col-6 col-md-3">
                <span class="text-xs text-muted d-block">Approved Principal</span>
                <span class="fw-700" style="color: #0F172A; font-size: 0.95rem;">₹${formatINR(sum.principal)}</span>
              </div>
              <div class="col-6 col-md-3">
                <span class="text-xs text-muted d-block">Total Flat Interest</span>
                <span class="fw-700" style="color: #D97706; font-size: 0.95rem;">₹${formatINR(sum.total_interest)}</span>
              </div>
              ${hasRoundingAdj ? `
              <div class="col-6 col-md-3">
                <span class="text-xs text-muted d-block">Rounding Adjustment (Upward)</span>
                <span class="fw-700" style="color: #0284C7; font-size: 0.95rem;">+₹${formatINR(sum.rounding_adjustment)}</span>
              </div>
              ` : ''}
              <div class="col-6 col-md-3">
                <span class="text-xs text-muted d-block">Total Payable (Rounded)</span>
                <span class="fw-700" style="color: #059669; font-size: 0.95rem;">₹${formatINR(sum.total_payable)}</span>
              </div>
              <div class="col-6 col-md-3">
                <span class="text-xs text-muted d-block">Repayment Frequency</span>
                <span class="fw-700 text-primary" style="font-size: 0.95rem;">${sum.frequency}</span>
              </div>
              <div class="col-6 col-md-3">
                <span class="text-xs text-muted d-block">Number of Installments</span>
                <span class="fw-700" style="color: #0F172A; font-size: 0.95rem;">${sum.total_installments}</span>
              </div>
              <div class="col-6 col-md-3">
                <span class="text-xs text-muted d-block">Higher EMI (${higherCnt} Installments)</span>
                <span class="fw-700 text-success" style="color: #059669; font-size: 0.95rem;">₹${higherAmt}</span>
              </div>
              <div class="col-6 col-md-3">
                <span class="text-xs text-muted d-block">Lower EMI (${lowerCnt} Installments)</span>
                <span class="fw-700 text-heading" style="color: ${lowerCnt > 0 ? '#334155' : '#94A3B8'}; font-size: 0.95rem;">
                  ${lowerCnt > 0 ? '₹' + lowerAmt : 'None (Uniform)'}
                </span>
              </div>
              <div class="col-6 col-md-3">
                <span class="text-xs text-muted d-block">First Installment Date</span>
                <span class="fw-600" style="color: #0F172A; font-size: 0.85rem;">${formatDate(firstDate)}</span>
              </div>
              <div class="col-6 col-md-3">
                <span class="text-xs text-muted d-block">Final Installment Date</span>
                <span class="fw-600" style="color: #0F172A; font-size: 0.85rem;">${formatDate(lastDate)}</span>
              </div>
            </div>

            <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
              <div class="d-flex justify-content-between align-items-center px-3 py-2 border-bottom" style="background: #F8FAFC; border-color: #E2E8F0 !important;">
                <span class="fw-700 text-xs" style="color: #334155; text-transform: uppercase; letter-spacing: 0.05em;">
                  <i class="fa-regular fa-calendar-days text-primary me-1"></i> Dynamic Payment Calendar (${higherCnt} Higher EMIs First, ${lowerCnt} Lower EMIs Last)
                </span>
                <span style="background: #E0F2FE; color: #0284C7; font-weight: 600; font-size: 0.72rem; padding: 2px 8px; border-radius: 4px;">
                  Front-Loaded Schedule
                </span>
              </div>

              <div style="max-height: 360px; overflow-y: auto;">
                <table class="admin-table mb-0" style="width: 100%; border-collapse: collapse; font-size: 0.8rem; background: #FFFFFF; color: #1E293B;">
                  <thead style="position: sticky; top: 0; background: #F1F5F9; z-index: 2; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                    <tr>
                      <th style="padding: 10px 12px; font-weight: 700; color: #475569; font-size: 0.72rem; text-transform: uppercase; border-bottom: 2px solid #CBD5E1; width: 60px;">#</th>
                      <th style="padding: 10px 12px; font-weight: 700; color: #475569; font-size: 0.72rem; text-transform: uppercase; border-bottom: 2px solid #CBD5E1;">Due Date</th>
                      <th style="padding: 10px 12px; font-weight: 700; color: #475569; font-size: 0.72rem; text-transform: uppercase; border-bottom: 2px solid #CBD5E1; text-align: right;">Principal</th>
                      <th style="padding: 10px 12px; font-weight: 700; color: #475569; font-size: 0.72rem; text-transform: uppercase; border-bottom: 2px solid #CBD5E1; text-align: right;">Interest</th>
                      ${hasRoundingAdj ? '<th style="padding: 10px 12px; font-weight: 700; color: #475569; font-size: 0.72rem; text-transform: uppercase; border-bottom: 2px solid #CBD5E1; text-align: right;">Rounding Adj</th>' : ''}
                      <th style="padding: 10px 12px; font-weight: 700; color: #475569; font-size: 0.72rem; text-transform: uppercase; border-bottom: 2px solid #CBD5E1; text-align: right;">Installment Amount</th>
                    </tr>
                  </thead>
                  <tbody>
          `;

          // Render all installments dynamically (Higher first, Lower last)
          for (let i = 0; i < inst.length; i++) {
            const it = inst[i];
            const isLast = (it.installment_number === inst.length);
            const isHigher = (lowerCnt > 0 && it.installment_number <= higherCnt);
            const rowBg = (i % 2 === 0) ? '#FFFFFF' : '#F8FAFC';

            html += `
              <tr style="border-bottom: 1px solid #E2E8F0; background: ${rowBg};">
                <td style="padding: 10px 12px; font-weight: 600; color: #475569;">
                  #${it.installment_number}
                  ${isLast ? '<span style="font-size: 0.65rem; background: #FEF3C7; color: #B45309; padding: 2px 5px; border-radius: 4px; margin-left: 4px; font-weight: 700;">Final</span>' : ''}
                </td>
                <td style="padding: 10px 12px; font-weight: 500; color: #0F172A; white-space: nowrap;">
                  ${formatDate(it.due_date)}
                </td>
                <td style="padding: 10px 12px; text-align: right; color: #334155; font-variant-numeric: tabular-nums;">
                  ₹${formatINR(it.principal_amount)}
                </td>
                <td style="padding: 10px 12px; text-align: right; color: #D97706; font-variant-numeric: tabular-nums;">
                  ₹${formatINR(it.interest_amount)}
                </td>
                ${hasRoundingAdj ? `
                  <td style="padding: 10px 12px; text-align: right; color: #0284C7; font-variant-numeric: tabular-nums;">
                    ${it.rounding_adjustment > 0 ? '+₹' + formatINR(it.rounding_adjustment) : '₹0.00'}
                  </td>
                ` : ''}
                <td style="padding: 10px 12px; text-align: right;">
                  <span style="display: inline-block; font-weight: 700; color: ${isHigher ? '#047857' : '#334155'}; background: ${isHigher ? '#ECFDF5' : '#F1F5F9'}; border: 1px solid ${isHigher ? '#A7F3D0' : '#CBD5E1'}; padding: 3px 10px; border-radius: 6px; font-size: 0.85rem; font-variant-numeric: tabular-nums;">
                    ₹${Math.round(it.total_amount).toLocaleString('en-IN')}
                  </span>
                  ${lowerCnt > 0 ? `
                    <span style="font-size: 0.65rem; background: ${isHigher ? '#DBEAFE' : '#E2E8F0'}; color: ${isHigher ? '#1E40AF' : '#475569'}; padding: 2px 6px; border-radius: 4px; font-weight: 700; margin-left: 4px;">
                      ${isHigher ? 'Higher' : 'Lower'}
                    </span>
                  ` : ''}
                </td>
              </tr>
            `;
          }

          html += `
                  </tbody>
                </table>
              </div>

              <div class="d-flex justify-content-between align-items-center px-3 py-2 border-top text-xs" style="background: #F8FAFC; border-color: #E2E8F0 !important; color: #64748B;">
                <span><i class="fa fa-info-circle me-1 text-primary"></i> ${higherCnt} Higher EMIs (₹${higherAmt}) followed by ${lowerCnt} Lower EMIs (${lowerCnt > 0 ? '₹' + lowerAmt : 'N/A'}).</span>
                <span class="fw-700" style="color: #0F172A;">Total Scheduled: <span style="color: #059669; font-weight: 800;">₹${formatINR(sum.total_payable)}</span></span>
              </div>
            </div>
          `;

          previewContent.innerHTML = html;
          btnConfirm.disabled = false;
        } else {
          previewContent.innerHTML = `<div class="text-danger py-2"><i class="fa fa-exclamation-circle me-1"></i> ${data.message || 'Error generating calculation preview'}</div>`;
        }
      } catch (err) {
        previewContent.innerHTML = `<div class="text-danger py-2"><i class="fa fa-exclamation-circle me-1"></i> Network error generating calculation preview</div>`;
      }
    }, 300);
  }

  function handleSchemeChange() {
    const option = schemeSelect.options[schemeSelect.selectedIndex];
    const durationUnitLabel = document.getElementById('durationUnitLabel');
    
    if (option && option.value) {
      if (durationUnitLabel && option.dataset.freq) {
        const freq = option.dataset.freq;
        let unitText = '';
        if (freq === 'DAILY') unitText = '(Days)';
        if (freq === 'WEEKLY') unitText = '(Weeks)';
        if (freq === 'MONTHLY') unitText = '(Months)';
        durationUnitLabel.textContent = unitText;
      }
      
      if (!overrideCheck || !overrideCheck.checked) {
        const defaultInterest = option.dataset.interestAmount || '0.00';
        interestInput.value = parseFloat(defaultInterest).toFixed(2);
        durationInput.value = option.dataset.duration || '';
      }
      updatePreview();
    } else {
      if (durationUnitLabel) durationUnitLabel.textContent = '';
      if (previewBox) previewBox.classList.add('d-none');
      if (btnConfirm) btnConfirm.disabled = true;
    }
  }

  if (schemeSelect) schemeSelect.addEventListener('change', handleSchemeChange);
  if (amountInput) amountInput.addEventListener('input', updatePreview);
  if (interestInput) interestInput.addEventListener('input', updatePreview);
  if (durationInput) durationInput.addEventListener('input', updatePreview);

  if (overrideCheck) {
    overrideCheck.addEventListener('change', (e) => {
      const isOverride = e.target.checked;
      if (isOverride) {
        if (interestInput) {
          interestInput.classList.remove('bg-light');
          interestInput.readOnly = false;
        }
        if (durationInput) {
          durationInput.classList.remove('bg-light');
          durationInput.readOnly = false;
        }
      } else {
        if (interestInput) {
          interestInput.classList.add('bg-light');
          interestInput.readOnly = true;
        }
        if (durationInput) {
          durationInput.classList.add('bg-light');
          durationInput.readOnly = true;
        }
        handleSchemeChange(); // Reset to defaults
      }
      updatePreview();
    });
  }

  // Initial trigger if a scheme is already selected on page load
  if (schemeSelect && schemeSelect.value) {
    handleSchemeChange();
  }
});

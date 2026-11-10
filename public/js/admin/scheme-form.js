document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const frequencyRadios = document.querySelectorAll('input[name="repayment_frequency"]');
  const frequencyCards = document.querySelectorAll('.frequency-card');
  const modeRadios = document.querySelectorAll('input[name="penalty_mode"]');
  const customSection = document.getElementById('customPenaltySection');
  
  const loadingPreview = document.getElementById('loadingPreview');
  const penaltyPreviewContent = document.getElementById('penaltyPreviewContent');
  const previewRate = document.getElementById('previewRate');
  const previewGrace = document.getElementById('previewGrace');
  const previewMethod = document.getElementById('previewMethod');
  const previewCap = document.getElementById('previewCap');
  const previewAutoApply = document.getElementById('previewAutoApply');
  const previewTitle = document.getElementById('previewTitle');

  const penaltyTypeSelect = document.getElementById('penaltyType');
  const percentageSection = document.getElementById('percentageSection');
  const fixedSection = document.getElementById('fixedSection');

  // Form elements for live update
  const formElements = [
    'penaltyType', 'penaltyRate', 'fixedAmount', 
    'grace_period_days', 'maximum_penalty_cap', 'autoApply'
  ].map(id => document.getElementById(id) || document.getElementsByName(id)[0]);

  // Handle Frequency Cards Selection
  frequencyRadios.forEach((radio, index) => {
    radio.addEventListener('change', () => {
      frequencyCards.forEach(card => {
        card.classList.remove('border-primary', 'text-primary', 'selected');
      });
      if (radio.checked) {
        frequencyCards[index].classList.add('border-primary', 'text-primary', 'selected');
        updatePenaltyPreview();
      }
    });
  });

  // Handle Penalty Mode Toggle
  modeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.value === 'CUSTOM') {
        customSection.style.display = 'block';
      } else {
        customSection.style.display = 'none';
      }
      updatePenaltyPreview();
    });
  });

  // Handle Penalty Type (Percentage vs Fixed) within Custom section
  if (penaltyTypeSelect) {
    penaltyTypeSelect.addEventListener('change', () => {
      if (penaltyTypeSelect.value === 'PERCENTAGE') {
        percentageSection.style.display = 'block';
        fixedSection.style.display = 'none';
      } else {
        percentageSection.style.display = 'none';
        fixedSection.style.display = 'block';
      }
      updatePenaltyPreview();
    });
  }

  // Listen for changes on custom fields to live update preview
  formElements.forEach(el => {
    if (el) {
      el.addEventListener('input', updatePenaltyPreview);
      el.addEventListener('change', updatePenaltyPreview);
    }
  });

  async function fetchFrequencyDefaults(frequency) {
    try {
      const response = await fetch(`/admin/settings/penalties/defaults?frequency=${frequency}`);
      const result = await response.json();
      if (result.success) {
        return result.data;
      }
    } catch (e) {
      console.error(e);
    }
    return null;
  }

  async function updatePenaltyPreview() {
    const selectedFrequency = document.querySelector('input[name="repayment_frequency"]:checked')?.value || 'MONTHLY';
    const selectedMode = document.querySelector('input[name="penalty_mode"]:checked')?.value || 'INHERIT_FREQUENCY_DEFAULT';

    if (selectedMode === 'INHERIT_FREQUENCY_DEFAULT') {
      loadingPreview.style.display = 'block';
      penaltyPreviewContent.style.display = 'none';
      
      const defaults = await fetchFrequencyDefaults(selectedFrequency);
      
      loadingPreview.style.display = 'none';
      penaltyPreviewContent.style.display = 'block';
      previewTitle.textContent = 'Effective Default';

      if (defaults) {
        const isFixed = defaults.calculation_method === 'FIXED_AMOUNT';
        previewMethod.textContent = isFixed ? 'Fixed Amount' : 'Percentage of Overdue';
        previewRate.textContent = isFixed ? `₹${defaults.fixed_penalty_amount}` : `${defaults.penalty_rate}%`;
        previewGrace.textContent = `${defaults.grace_period_days} Days`;
        previewCap.textContent = parseFloat(defaults.maximum_penalty_cap) === 0 ? 'Unlimited' : `${defaults.maximum_penalty_cap}%`;
        previewAutoApply.textContent = defaults.auto_apply ? 'Enabled' : 'Disabled';
      } else {
        previewMethod.textContent = 'Not Configured';
        previewRate.textContent = '--';
        previewGrace.textContent = '--';
        previewCap.textContent = '--';
        previewAutoApply.textContent = '--';
      }
    } else {
      // CUSTOM mode
      loadingPreview.style.display = 'none';
      penaltyPreviewContent.style.display = 'block';
      previewTitle.textContent = 'Custom Penalty';

      const type = document.getElementById('penaltyType').value;
      const rate = document.getElementById('penaltyRate').value;
      const fixed = document.getElementById('fixedAmount').value;
      const grace = document.getElementsByName('grace_period_days')[0].value;
      const cap = document.getElementsByName('maximum_penalty_cap')[0].value;
      const autoApply = document.getElementById('autoApply').checked;

      previewMethod.textContent = type === 'FIXED' ? 'Fixed Amount' : 'Percentage of Overdue';
      previewRate.textContent = type === 'FIXED' ? `₹${fixed || 0}` : `${rate || 0}%`;
      previewGrace.textContent = `${grace || 0} Days`;
      previewCap.textContent = parseFloat(cap) === 0 || !cap ? 'Unlimited' : `${cap}%`;
      previewAutoApply.textContent = autoApply ? 'Enabled' : 'Disabled';
    }
  }

  // Initial load
  updatePenaltyPreview();
});

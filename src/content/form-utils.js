(function(App) {
  'use strict';

  App.formatDateForInput = function(dateStr) {
    if (!dateStr || dateStr === '--') return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    } catch (e) {
      // Ignore
    }
    return '';
  };

  App.setSafeValue = async function(input, value) {
    if (!input || value === undefined || value === null) return;

    input.focus();

    if (input.value && (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT')) {
      try {
        const isTextArea = input.tagName === 'TEXTAREA';
        const clearSetter = isTextArea
          ? Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
          : Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        if (clearSetter) {
          clearSetter.call(input, '');
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      } catch (e) {
        // Ignore
      }
    }

    try {
      if (input.type === 'date') {
        const formattedDate = App.formatDateForInput(value);
        if (formattedDate) {
          value = formattedDate;
        } else {
          console.warn('Specify7+: Could not parse date format for input:', value);
        }
      }

      input.select();
      const success = document.execCommand('insertText', false, value);
      if (!success) throw new Error('execCommand failed');
    } catch (e) {
      try {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
        const nativeSelectValueSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set;
        
        let setter = nativeInputValueSetter;
        if (input.tagName === 'TEXTAREA') {
          setter = nativeTextAreaValueSetter;
        } else if (input.tagName === 'SELECT') {
          setter = nativeSelectValueSetter;
        }

        if (setter) {
          setter.call(input, value);
        } else {
          input.value = value;
        }
      } catch (err) {
        console.error('Specify7+: Fallback setter failed:', err);
        input.value = value;
      }
    }

    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    await App.sleep(100);

    if (input.getAttribute('role') === 'combobox') {
      const originalValue = value;
      const preventClearing = (e) => {
        e.stopImmediatePropagation();
        input.removeEventListener('blur', preventClearing, true);
        input.removeEventListener('focusout', preventClearing, true);
      };

      input.addEventListener('blur', preventClearing, true);
      input.addEventListener('focusout', preventClearing, true);

      setTimeout(() => {
        if (input.value === '' && originalValue !== '') {
          input.value = originalValue;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, 500);
      
      await App.sleep(300);
    } else {
      input.dispatchEvent(new Event('blur', { bubbles: true }));
    }

    input.classList.remove('not-touched');
  };

  App.expandCollapsibleSections = async function() {
    const sectionNames = [
      'other identifiers', 'otros identificadores',
      'geological context', 'contexto geologico',
      'paleo context', 'contexto paleo', 'stratigraphy', 'estratigrafia', 'estratigrafía',
      'preparations', 'preparaciones',
      'determinations', 'determinaciones',
      'locality', 'localidad',
      'taxon', 'taxon',
      'collecting event', 'evento de colecta',
      'attributes', 'atributos'
    ];

    const headers = Array.from(document.querySelectorAll('legend, h3, h4, .fieldset-title, [class*="header"], [class*="title"]'));
    
    for (const header of headers) {
      const text = header.textContent.trim().toLowerCase();
      if (!text) continue;

      const normText = App.normalizeString(text);
      const isTargetSection = sectionNames.some(name => App.normalizeString(name) === normText || normText.includes(App.normalizeString(name)));
      
      if (!isTargetSection) continue;

      const sectionContainer = header.closest('fieldset') || header.closest('section') || header.closest('.fieldset-container') || header.parentElement;
      if (!sectionContainer) continue;

      const inputs = sectionContainer.querySelectorAll('input, textarea, select');
      let isCollapsed = true;
      
      for (const input of inputs) {
        const rect = input.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && window.getComputedStyle(input).display !== 'none') {
          isCollapsed = false;
          break;
        }
      }

      if (isCollapsed || inputs.length === 0) {
        const toggleBtn = header.querySelector('button, [role="button"], svg, [class*="chevron"], [class*="caret"]') || header;
        console.log(`Specify7+: Found collapsed section "${text}", attempting to expand it.`);
        toggleBtn.click();
        await App.sleep(250);
      }
    }
  };

  App.waitForNewInputs = async function(previousInputCount, timeout = 2500) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const currentCount = document.querySelectorAll('input:not([type="submit"]):not([type="button"]), textarea, select').length;
      if (currentCount > previousInputCount) {
        await App.sleep(200);
        return true;
      }
      await App.sleep(50);
    }
    return false;
  };

  App.ensureSubformRowFor = async function(sectionRegex) {
    const fieldsets = Array.from(document.querySelectorAll('fieldset'));
    const fs = fieldsets.find(f => {
      const h = f.querySelector('h3, h4, legend');
      return h && sectionRegex.test(h.textContent);
    });
    if (!fs) return null;

    const existingEditable = fs.querySelector(
      'input[type="text"]:not([readonly]):not([disabled]),' +
      'input[role="combobox"]:not([readonly]):not([disabled]),' +
      'input[type="date"]:not([readonly]):not([disabled]),' +
      'select:not([disabled]),' +
      'textarea:not([readonly]):not([disabled])'
    );
    if (existingEditable) return fs;

    const addBtn = Array.from(fs.querySelectorAll('button')).find(b => {
      if (b.disabled) return false;
      const haystack = (
        (b.getAttribute('title') || '') + ' ' +
        (b.getAttribute('aria-label') || '') + ' ' +
        (b.textContent || '')
      ).toLowerCase();
      return /\badd\b|\bañad/i.test(haystack);
    });

    if (addBtn) {
      const countBefore = document.querySelectorAll('input:not([type="submit"]):not([type="button"]), textarea, select').length;
      addBtn.click();
      await App.waitForNewInputs(countBefore);
    }
    return fs;
  };

  App.isTreePickInput = function(input) {
    return !!(input && input.getAttribute('role') === 'combobox');
  };

  App.injectPasteButton = function(input) {
    if (input.dataset.hasPasteBtn || input.readOnly || input.disabled) return;
    
    const valueToSet = App.findValueInCapturedData(input);
    if (valueToSet === undefined || valueToSet === null || valueToSet === '') return;

    const btn = document.createElement('button');
    btn.className = 'field-paste-btn';
    btn.type = 'button';
    btn.title = `Paste value from captured data`;
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
      </svg>
    `;

    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      try {
        const freshValue = App.findValueInCapturedData(input);
        if (freshValue) {
          await App.setSafeValue(input, freshValue.toString());
          btn.classList.add('success');
          setTimeout(() => btn.classList.remove('success'), 1000);
        }
      } catch (err) {
        console.error('Specify7+: Field paste failed', err);
      }
    });

    const wrapper = input.parentElement;
    if (wrapper && (wrapper.classList.contains('relative') || wrapper.classList.contains('flex'))) {
      wrapper.appendChild(btn);
    } else {
      input.after(btn);
    }
    
    input.dataset.hasPasteBtn = 'true';
  };

  App.addPasteButtonsToAllFields = function() {
    if (App.enabledFeatures.dataCapture === false) return;
    
    const inputs = document.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]), textarea, select');
    inputs.forEach(App.injectPasteButton);
  };

})(window.Specify7Plus = window.Specify7Plus || {});

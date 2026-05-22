/**
 * Content Script to detect Specify 7 forms and add enhanced functionality
 */

(function() {
  'use strict';
  
  console.log('Specify7+: Extension loaded');
  
  // Feature flags loaded from storage
  let enabledFeatures = {
    bibtex: true,
    doi: true,
    viewer3d: true,
    selectAll: true,
    morphosource: true
    };

    // Keep track of the last captured data to know which buttons to show
    let lastCapturedData = null;

    // Load feature states and last captured data from storage
    function loadFeatureStates() {
    if (chrome && chrome.storage) {
      // Load enabled features
      if (chrome.storage.sync) {
        chrome.storage.sync.get(['enabledFeatures'], (result) => {
          if (result && result.enabledFeatures) {
            enabledFeatures = result.enabledFeatures;
            console.log('Specify7+: Feature states loaded', enabledFeatures);
          }
        });
      }

      // Load last captured specimen data
      if (chrome.storage.local) {
        chrome.storage.local.get(['lastCapturedSpecimen'], (result) => {
          if (result && result.lastCapturedSpecimen) {
            lastCapturedData = result.lastCapturedSpecimen;
            // Refresh buttons if form is already open
            if (isSpecifyCollectionObjectForm()) {
              addPasteButtonsToAllFields();
            }
          }
        });

        // Listen for updates from other tabs
        chrome.storage.onChanged.addListener((changes, area) => {
          if (area === 'local' && changes.lastCapturedSpecimen) {
            lastCapturedData = changes.lastCapturedSpecimen.newValue;
            if (isSpecifyCollectionObjectForm()) {
              // Remove old buttons and add new ones based on new data
              document.querySelectorAll('.field-paste-btn').forEach(b => b.remove());
              document.querySelectorAll('[data-has-paste-btn]').forEach(i => delete i.dataset.hasPasteBtn);
              addPasteButtonsToAllFields();
            }
          }
        });
      }
    }
    }
  
  // Load features on startup
  loadFeatureStates();
  
  /**
   * Detects if we are in a Specify 7 Reference Work form
   */
  function isSpecifyReferenceForm() {
    // Look for the modal title indicating it's a Reference Work form
    const modalHeader = document.querySelector('h2[id*="modal"][id*="header"]');
    if (modalHeader && modalHeader.textContent.includes('Reference Work')) {
      return true;
    }
    
    // Check for the presence of specific fields
    const titleField = document.querySelector('input[name="title"]');
    const publisherField = document.querySelector('input[name="publisher"]');
    const typeSelect = document.querySelector('select[name="ReferenceWorkType"]');
    
    return titleField && publisherField && typeSelect;
  }

  /**
   * Detects if we are in a Specify 7 Collection Object form
   */
  function isSpecifyCollectionObjectForm() {
    // Look for any h2 containing "Collection Object"
    const headers = Array.from(document.querySelectorAll('h2'));
    const isColForm = headers.some(h2 => h2.textContent.includes('Collection Object'));
    if (isColForm) return true;
    
    // Fallback: check for catalogNumber field
    const catNumField = document.querySelector('input[name="catalogNumber"]');
    return !!catNumField;
  }
  
  /**
   * Creates the BibTeX import button
   */
  function createBibtexButton() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'bibtex-import-button';
    button.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="12" y1="18" x2="12" y2="12"></line>
        <line x1="9" y1="15" x2="15" y2="15"></line>
      </svg>
      <span>Import BibTeX</span>
    `;
    button.title = 'Import BibTeX entry from clipboard';
    
    button.addEventListener('click', handleBibtexImport);
    
    return button;
  }

  /**
   * Creates the DOI import button
   */
  function createDoiButton() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'doi-import-button';
    button.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2v20"></path>
        <path d="M5 7h14"></path>
        <path d="M5 17h14"></path>
      </svg>
      <span>Import DOI</span>
    `;
    button.title = 'Import metadata by DOI';
    button.addEventListener('click', showDoiInputModal);
    return button;
  }
  
  /**
   * Creates the unified 'Import from Clipboard' button
   */
  function createClipboardImportButton() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'clipboard-import-button';
    button.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
      </svg>
      <span>Import from Clipboard</span>
    `;
    button.title = 'Import specimen data from clipboard';
    button.classList.add('bibtex-import-button');
    button.addEventListener('click', handleClipboardImport);
    return button;
  }
  
  /**
   * Creates the MorphoSource import button
   */
  function createMorphoSourceButton() {
    // Deprecated in favor of createClipboardImportButton
    return createClipboardImportButton();
  }
  
  /**
   * Handles BibTeX import
   */
  async function handleBibtexImport() {
    try {
      // Try to read from clipboard
      const text = await navigator.clipboard.readText();
      
      if (!text.trim()) {
        showMessage('Clipboard is empty', 'warning');
        return;
      }
      
      // If it doesn't look like BibTeX, show modal
      if (!text.includes('@')) {
        showBibtexInputModal();
        return;
      }
      
      processBibtexInput(text);
      
    } catch (error) {
      // If clipboard access fails, show modal
      console.log('Could not access clipboard, showing modal:', error);
      showBibtexInputModal();
    }
  }
  
  /**
   * Processes BibTeX input and fills the form
   */
  function processBibtexInput(bibtexText) {
    try {
      const entries = BibtexParser.parse(bibtexText);
      
      if (entries.length === 0) {
        showMessage('No valid BibTeX entries found', 'error');
        return;
      }
      
      if (entries.length > 1) {
        showMessage(`Found ${entries.length} entries. Importing the first one.`, 'info');
      }
      
      const specifyData = BibtexParser.toSpecifyFormat(entries[0]);
      fillForm(specifyData);
      
      showMessage('BibTeX imported successfully!', 'success');
      
    } catch (error) {
      console.error('Error processing BibTeX:', error);
      showMessage('Error processing BibTeX: ' + error.message, 'error');
    }
  }

  /**
   * Handles import from clipboard
   */
  async function handleClipboardImport() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        showMessage('Clipboard is empty', 'warning');
        return;
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        showMessage('Clipboard does not contain valid specimen data', 'warning');
        return;
      }

      if (data._source !== 'Specify7+' || data._type !== 'SpecimenData') {
        showMessage('Clipboard data is not from Specify7+ capture', 'warning');
        return;
      }

      await fillCollectionObjectForm(data);
      showMessage('Specimen data imported from clipboard!', 'success');
      
    } catch (error) {
      console.error('Specify7+: Error importing from clipboard:', error);
      if (error.name === 'NotAllowedError' || error.name === 'DOMException') {
        showMessage('Could not read clipboard. Please click on the page first to give it focus.', 'warning');
      } else {
        showMessage('Error reading from clipboard. Please ensure extension has permission.', 'error');
      }
    }
  }

  /**
   * Handles MorphoMuseum import (legacy support)
   */
  async function handleMorphoImport() {
    return handleClipboardImport();
  }

  /**
   * Helper to format various date strings into YYYY-MM-DD for HTML5 date inputs
   */
  function formatDateForInput(dateStr) {
    if (!dateStr || dateStr === '--') return '';

    // If already in YYYY-MM-DD format, return as is
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
  }

  /**
   * Helper to set value in a way that React/Specify picks it up and keeps it.
   * Uses execCommand to simulate typing, which is more reliable for autocomplete fields.
   */
  async function setSafeValue(input, value) {
    if (!input || value === undefined || value === null) return;

    input.focus();

    // Try to use execCommand to simulate user typing - this is best for React/Specify
    try {
      // If it's a date input, try to format it correctly
      if (input.type === 'date') {
        const formattedDate = formatDateForInput(value);
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
      // Fallback to property setter
      try {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
        const setter = input.tagName === 'TEXTAREA' ? nativeTextAreaValueSetter : nativeInputValueSetter;

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

    // Dispatch events to trigger validation
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    // Small delay to let React process
    await sleep(100);

    // For comboboxes, we prevent the first blur/focusout from triggering the "reset if not selected" behavior
    // This gives the user time to go back and select a suggestion or create a new one.
    if (input.getAttribute('role') === 'combobox') {
      const originalValue = value;
      const preventClearing = (e) => {
        // Stop Specify 7 from seeing these events which usually trigger clearing
        e.stopImmediatePropagation();
        
        // Remove listeners after first use
        input.removeEventListener('blur', preventClearing, true);
        input.removeEventListener('focusout', preventClearing, true);
      };

      // We use capture phase to get it before Specify 7's React handlers
      input.addEventListener('blur', preventClearing, true);
      input.addEventListener('focusout', preventClearing, true);

      // Fallback: If Specify 7 STILL manages to clear it (e.g. via internal React state),
      // we try to restore it once after a short delay.
      setTimeout(() => {
        if (input.value === '' && originalValue !== '') {
          // console.log('Specify7+: Restoring cleared combobox value:', originalValue);
          input.value = originalValue;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, 500);
      
      // Wait a bit longer for comboboxes to let searches initialize
      await sleep(300);
    } else {
      input.dispatchEvent(new Event('blur', { bubbles: true }));
    }

    input.classList.remove('not-touched');
  }

  /**
   * Helper to find which data key corresponds to an input
   */
  function findFieldKey(input) {
    // 1. Check by name attribute
    const name = input.getAttribute('name');
    if (name) {
      if (name === 'catalogNumber') return 'inventoryNumber';
      if (name === 'altCatalogNumber') return 'inventoryNumber';
      if (name === 'identifier') return 'inventoryNumber';
      if (name === 'institution') return 'collection';
      if (name === 'remarks') return 'description';
      if (name === 'stationFieldNumber') return 'inventoryNumber';
      if (name === 'verbatimDate') return 'dateCreated';
    }
    
    // 2. Check by label
    const label = document.querySelector(`label[for="${input.id}"]`);
    if (label) {
      const text = label.textContent.trim().toLowerCase();
      // Use more specific matching to avoid false positives on generic fields
      if (text === 'catalog number') return 'inventoryNumber';
      if (text === 'alt cat number') return 'inventoryNumber';
      if (text === 'identifier') return 'inventoryNumber';
      if (text === 'institution') return 'collection';
      if (text === 'remarks' && input.tagName === 'TEXTAREA') return 'description';
      if (text === 'taxon') return 'taxon';
      if (text === 'genus') return 'genus';
      if (text === 'species') return 'species';
      if (text === 'locality' || text === 'locality name') return 'origin';
      if (text === 'prepared by') return 'creator';
      if (text === 'prepared date') return 'dateCreated';
      if (text === 'determined date') return 'dateCreated';
      if (text === 'start date') return 'dateCreated';
      if (text === 'cataloged date') return 'dateCreated';
      if (text === 'method') return 'method';
      if (text === 'count') return 'count';
    }

    // 3. Check by title (common in Specify comboboxes)
    const title = input.getAttribute('title') || '';
    if (title.toLowerCase().includes('locality name')) return 'origin';
    if (title.toLowerCase().includes('full name')) return 'taxon';
    if (title.toLowerCase().includes('prepared by')) return 'creator';
    if (title.toLowerCase().includes('prep type')) return 'prepType';

    return null;
  }

  /**
   * Injects a small paste button next to an input
   */
  function injectPasteButton(input) {
    if (input.dataset.hasPasteBtn || input.readOnly || input.disabled) return;
    
    const fieldKey = findFieldKey(input);
    if (!fieldKey) return;

    // Only show button if we have data for this field in lastCapturedData
    if (!lastCapturedData) return;
    
    let hasData = false;
    if (fieldKey === 'taxon') {
      hasData = !!(lastCapturedData.genus || lastCapturedData.species);
    } else if (fieldKey === 'inventoryNumber') {
      hasData = !!(lastCapturedData.inventoryNumber || lastCapturedData.catalogNumber);
    } else {
      hasData = !!lastCapturedData[fieldKey];
    }

    if (!hasData) return;

    const btn = document.createElement('button');
    btn.className = 'field-paste-btn';
    btn.type = 'button';
    btn.title = `Paste ${fieldKey} from captured data`;
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
        let valueToSet = '';
        if (fieldKey === 'taxon') {
          valueToSet = `${lastCapturedData.genus || ''} ${lastCapturedData.species || ''}`.trim();
        } else if (fieldKey === 'inventoryNumber' && !lastCapturedData.inventoryNumber) {
           valueToSet = lastCapturedData.catalogNumber || '';
        } else {
          valueToSet = lastCapturedData[fieldKey];
        }

        if (valueToSet) {
          await setSafeValue(input, valueToSet);
          btn.classList.add('success');
          setTimeout(() => btn.classList.remove('success'), 1000);
        }
      } catch (err) {
        console.error('Specify7+: Field paste failed', err);
      }
    });

    // Insertion logic: Place inside the input wrapper whenever possible
    const wrapper = input.parentElement;
    if (wrapper && (wrapper.classList.contains('relative') || wrapper.classList.contains('flex'))) {
      // If it's a combobox, we want it inside but before other buttons if possible
      wrapper.appendChild(btn);
    } else {
      // Fallback for simple inputs
      input.after(btn);
    }
    
    input.dataset.hasPasteBtn = 'true';
  }

  /**
   * Scans the form and adds paste buttons to all supported fields
   */
  function addPasteButtonsToAllFields() {
    if (enabledFeatures.dataCapture === false) return;
    
    const inputs = document.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]), textarea, select');
    inputs.forEach(injectPasteButton);
  }

  /**
   * Fills the Collection Object form with Morpho/Specimen data
   */
  async function fillCollectionObjectForm(data) {
    // 1. Fill non-combobox fields first
    
    // Fill Alt Catalog Number
    if (data.inventoryNumber) {
      const altCatInput = document.querySelector('input[name="altCatalogNumber"]');
      if (altCatInput) {
        await setSafeValue(altCatInput, data.inventoryNumber);
      }

      // Also add to Other Identifiers subform
      const fieldsets = Array.from(document.querySelectorAll('fieldset'));
      const otherIdFs = fieldsets.find(fs => {
        const h3 = fs.querySelector('h3');
        return h3 && /Other Identifiers\b/i.test(h3.textContent);
      });

      if (otherIdFs) {
        let identifierInput = otherIdFs.querySelector('input[type="text"]:not([readonly])');
        if (!identifierInput) {
          const addBtn = otherIdFs.querySelector('button[title="Add"]');
          if (addBtn && !addBtn.disabled) {
            addBtn.click();
            await sleep(300);
            identifierInput = otherIdFs.querySelector('input[type="text"]:not([readonly])');
          }
        }

        if (identifierInput) {
          await setSafeValue(identifierInput, data.inventoryNumber);
          
          // Institution / Collection
          const allInputs = Array.from(otherIdFs.querySelectorAll('input[type="text"]:not([readonly])'));
          if (allInputs.length > 1 && data.collection) {
            await setSafeValue(allInputs[1], data.collection);
          }
        }
      }
    }

    // Preparations Subform - Date and Type (Select/Date are safer than comboboxes)
    if (data.dateCreated) {
      const fieldsets = Array.from(document.querySelectorAll('fieldset'));
      const prepFs = fieldsets.find(fs => {
        const h3 = fs.querySelector('h3');
        return h3 && /Preparations\b/i.test(h3.textContent);
      });

      if (prepFs) {
        let prepTypeSelect = prepFs.querySelector('select[name*="prepType"], select');
        let preparedDateInput = prepFs.querySelector('input[name*="preparedDate"], input[type="date"]');

        if (!prepTypeSelect) {
          const addBtn = prepFs.querySelector('button[title="Add"]');
          if (addBtn && !addBtn.disabled) {
            addBtn.click();
            await sleep(300);
            prepTypeSelect = prepFs.querySelector('select[name*="prepType"], select');
            preparedDateInput = prepFs.querySelector('input[name*="preparedDate"], input[type="date"]');
          }
        }

        if (prepTypeSelect) {
          const option3d = Array.from(prepTypeSelect.options).find(opt => 
            opt.text.toLowerCase().includes('3d') || opt.value.toLowerCase().includes('3d')
          );
          if (option3d) {
            prepTypeSelect.value = option3d.value;
            prepTypeSelect.dispatchEvent(new Event('input', { bubbles: true }));
            prepTypeSelect.dispatchEvent(new Event('change', { bubbles: true }));
            prepTypeSelect.blur();
            await sleep(200);
          }
        }

        if (preparedDateInput) {
          await setSafeValue(preparedDateInput, data.dateCreated);
        }
      }
    }

    // Description / Remarks
    if (data.description) {
      const descInput = document.querySelector('textarea[name*="description"], textarea[name*="remarks"], input[name*="description"]');
      if (descInput) {
        await setSafeValue(descInput, data.description);
      }
    }

    // 2. Fill comboboxes LAST to keep them active and prevent them from being cleared by subsequent focus changes

    // Locality / Origin
    if (data.origin) {
      const locInput = document.querySelector('input[role="combobox"][title*="Locality Name"]');
      if (locInput) {
        await setSafeValue(locInput, data.origin);
      }
    }

    // Prepared By (Combobox)
    if (data.creator) {
      const fieldsets = Array.from(document.querySelectorAll('fieldset'));
      const prepFs = fieldsets.find(fs => {
        const h3 = fs.querySelector('h3');
        return h3 && /Preparations\b/i.test(h3.textContent);
      });
      if (prepFs) {
        const preparedByInput = prepFs.querySelector('input[name*="preparedBy"], input[role="combobox"]');
        if (preparedByInput) {
          await setSafeValue(preparedByInput, data.creator);
        }
      }
    }

    // Taxonomy (Combobox) - Usually the most sensitive, fill absolute last
    if (data.genus || data.species) {
      const taxonStr = `${data.genus || ''} ${data.species || ''}`.trim();
      const fieldsets = Array.from(document.querySelectorAll('fieldset'));
      const detFs = fieldsets.find(fs => {
        const h3 = fs.querySelector('h3');
        return h3 && /Determinations\b/i.test(h3.textContent);
      });
      
      if (detFs) {
        let taxonInput = detFs.querySelector('input[role="combobox"][title*="Full Name"]') || 
                         detFs.querySelector('input[role="combobox"]');
                         
        if (!taxonInput) {
          const addBtn = detFs.querySelector('button[title="Add"]');
          if (addBtn && !addBtn.disabled) {
            addBtn.click();
            await sleep(300);
            taxonInput = detFs.querySelector('input[role="combobox"][title*="Full Name"]') || 
                         detFs.querySelector('input[role="combobox"]');
          }
        }
        
        if (taxonInput) {
          await setSafeValue(taxonInput, taxonStr);
        }
      }
    }
  }

  /**
   * Shows modal to paste DOI and fetch metadata
   */
  function showDoiInputModal() {
    const modal = document.createElement('div');
    modal.className = 'bibtex-modal';
    modal.innerHTML = `
      <div class="bibtex-modal-content">
        <div class="bibtex-modal-header">
          <h3>Paste DOI</h3>
          <button class="bibtex-modal-close" title="Close">&times;</button>
        </div>
        <div class="bibtex-modal-body">
          <input id="doi-input" placeholder="10.1038/s41586-020-2649-2" />
          <p class="bibtex-hint">You can paste a DOI (e.g. 10.1038/...) and the extension will fetch metadata.</p>
        </div>
        <div class="bibtex-modal-footer">
          <button class="bibtex-btn bibtex-btn-secondary" id="doi-cancel">Cancel</button>
          <button class="bibtex-btn bibtex-btn-primary" id="doi-import">Fetch</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('.bibtex-modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('#doi-cancel').addEventListener('click', () => modal.remove());
    modal.querySelector('#doi-import').addEventListener('click', async () => {
      const doi = modal.querySelector('#doi-input').value.trim();
      modal.remove();
      if (!doi) {
        showMessage('Please enter a DOI', 'warning');
        return;
      }
      await fetchDoiAndFill(doi);
    });

    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    setTimeout(() => { modal.querySelector('#doi-input').focus(); }, 100);
  }

  /**
   * Fetches DOI metadata from CrossRef and fills the form
   * @param {string} doi
   */
  async function fetchDoiAndFill(doi) {
    try {
      showMessage('Fetching metadata for DOI...', 'info');
      const url = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
      const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!resp.ok) throw new Error(`CrossRef returned ${resp.status}`);
      const json = await resp.json();
      const item = json.message;

      // Map CrossRef fields to specifyData
      const specifyData = {
        type: mapCrossrefType(item.type),
        title: (item.title && item.title[0]) || '',
        publisher: item.publisher || '',
        placeOfPublication: (item['publisher-location']) || '',
        workDate: (item.issued && item.issued['date-parts'] && item.issued['date-parts'][0] && item.issued['date-parts'][0][0]) || '',
        volume: item.volume || item.volume || '',
        pages: item.page || '',
        journal: (item['container-title'] && item['container-title'][0]) || '',
        libraryNumber: item.DOI || item.ISBN && item.ISBN[0] || '',
        authors: parseCrossrefAuthors(item.author || [])
      };

      fillForm(specifyData);
      showMessage('Metadata imported from DOI', 'success');
    } catch (err) {
      console.error('Error fetching DOI metadata:', err);
      showMessage('Error fetching DOI metadata: ' + err.message, 'error');
    }
  }

  function mapCrossrefType(crossrefType) {
    const map = {
      'book': 0,
      'book-chapter': 5,
      'journal-article': 2,
      'report': 3,
      'dissertation': 4,
      'monograph': 0,
      'reference-entry': 5,
      'proceedings-article': 2
    };
    return map[crossrefType] !== undefined ? map[crossrefType] : 0;
  }

  function parseCrossrefAuthors(authors) {
    if (!Array.isArray(authors)) return [];
    return authors.map((a, i) => ({
      orderNumber: i,
      firstName: (a.given || ''),
      lastName: (a.family || a.name || '')
    }));
  }
  
  /**
   * Fills the form with the data
   */
  async function fillForm(data) {
    // Reference type — use native setter so React picks up the change
    const typeSelect = document.querySelector('select[name="ReferenceWorkType"]');
    if (typeSelect && data.type !== undefined) {
      try {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
        if (nativeSetter) nativeSetter.call(typeSelect, String(data.type));
        else typeSelect.value = data.type;
      } catch(e) { typeSelect.value = data.type; }
      typeSelect.dispatchEvent(new Event('input', { bubbles: true }));
      typeSelect.dispatchEvent(new Event('change', { bubbles: true }));
      typeSelect.classList.remove('not-touched');
      await sleep(100);
    }

    // Text fields — use setSafeValue so React's controlled inputs register the change
    const fieldMapping = {
      'title': data.title,
      'publisher': data.publisher,
      'placeOfPublication': data.placeOfPublication,
      'workDate': data.workDate ? String(data.workDate) : '',
      'volume': data.volume ? String(data.volume) : '',
      'pages': data.pages,
      'libraryNumber': data.libraryNumber
    };

    for (const [fieldName, value] of Object.entries(fieldMapping)) {
      if (value) {
        const input = document.querySelector(`input[name="${fieldName}"]`);
        if (input) {
          await setSafeValue(input, value);
        }
      }
    }

    // Journal (special field with autocomplete)
    if (data.journal) {
      const journalInput = document.querySelector('input[role="combobox"][title*="Journal"]') ||
                           document.querySelector('input[role="combobox"][title*="journal"]');
      if (journalInput) {
        await setSafeValue(journalInput, data.journal);
      }
    }

    // Handle authors - attempt auto-insertion
    if (data.authors && data.authors.length > 0) {
      console.log('Authors to import:', data.authors);

      // Try to auto-insert authors into the Authors subform
      addAuthorsToForm(data.authors).then((added) => {
        const existing = countExistingAuthors();
        if (added > 0) {
          showMessage(`Added ${added} author field(s). Total: ${existing}. Please create/select agents when prompted.`, 'info');
        } else if (existing > 0) {
          showMessage(`Using ${existing} existing author field(s). Please verify and create/select agents.`, 'info');
        } else {
          showMessage(`Note: Authors (${data.authors.length}) must be added manually.`, 'info');
        }
      }).catch((err) => {
        console.error('Error inserting authors:', err);
        showMessage('Could not insert authors automatically', 'warning');
      });
    }
  }


  /**
   * Utility sleep
   */
  function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  /**
   * Count existing author rows in the Authors fieldset
   */
  function countExistingAuthors() {
    const fieldsets = Array.from(document.querySelectorAll('fieldset'));
    const authorsFs = fieldsets.find(fs => {
      const h3 = fs.querySelector('h3');
      return h3 && /Authors\b/i.test(h3.textContent);
    });
    if (!authorsFs) return 0;

    // Count rows in the authors table/grid
    const rows = authorsFs.querySelectorAll('[role="row"]');
    // Subtract 1 for header row if present
    const headerRows = Array.from(rows).filter(r => r.querySelector('[role="columnheader"]'));
    return Math.max(0, rows.length - headerRows.length);
  }

  /**
   * Attempt to add authors into the Authors subform as agent rows.
   * This function calculates how many author fields are needed and only adds the difference.
   * Returns the number of authors actually inserted.
   * @param {Array<{firstName:string,lastName:string}>} authors
   */
  async function addAuthorsToForm(authors) {
    if (!Array.isArray(authors) || authors.length === 0) return 0;

    // Count how many author fields already exist
    const existingCount = countExistingAuthors();
    const neededCount = authors.length;
    const toAdd = neededCount - existingCount;

    console.log(`Authors: ${neededCount} needed, ${existingCount} existing, ${toAdd} to add`);

    // If we already have enough fields, just fill them
    if (toAdd <= 0) {
      await fillExistingAuthorFields(authors);
      return 0; // No new fields added
    }

    // Find the Authors fieldset by header text
    const fieldsets = Array.from(document.querySelectorAll('fieldset'));
    const authorsFs = fieldsets.find(fs => {
      const h3 = fs.querySelector('h3');
      return h3 && /Authors\b/i.test(h3.textContent);
    });
    if (!authorsFs) return 0;

    // Find the Add button inside the authors fieldset
    let addBtn = Array.from(authorsFs.querySelectorAll('button')).find(b => {
      const title = (b.getAttribute('title') || '') + ' ' + (b.getAttribute('aria-label') || '');
      return /add|añad|añadir/i.test(title) && !b.disabled;
    });

    if (!addBtn) return 0;

    // Add only the missing fields
    let inserted = 0;
    for (let i = 0; i < toAdd; i++) {
      try {
        // Click the add button to create a new row
        addBtn.click();
        inserted++;
        // Wait for the DOM to update
        await sleep(300);
      } catch (err) {
        console.error('Error while adding author row:', err);
      }
    }

    // Now fill all author fields (existing + newly added)
    if (inserted > 0) {
      await sleep(200); // Extra wait for DOM stabilization
      await fillExistingAuthorFields(authors);
    }

    return inserted;
  }

  /**
   * Fill existing author fields with author data
   * @param {Array<{firstName:string,lastName:string}>} authors
   */
  async function fillExistingAuthorFields(authors) {
    const fieldsets = Array.from(document.querySelectorAll('fieldset'));
    const authorsFs = fieldsets.find(fs => {
      const h3 = fs.querySelector('h3');
      return h3 && /Authors\b/i.test(h3.textContent);
    });
    if (!authorsFs) return;

    // Get all combobox inputs in the authors fieldset
    const comboboxes = Array.from(authorsFs.querySelectorAll('input[role="combobox"]'));

    for (let i = 0; i < Math.min(comboboxes.length, authors.length); i++) {
      const input = comboboxes[i];
      const author = authors[i];

      const last = author.lastName || '';
      const first = author.firstName || '';
      const display = last && first ? `${last}, ${first}` : (last || first);

      if (display && input) {
        await setSafeValue(input, display);
      }
    }
  }
  
  /**
   * Shows modal to paste BibTeX
   */
  function showBibtexInputModal() {
    const modal = document.createElement('div');
    modal.className = 'bibtex-modal';
    modal.innerHTML = `
      <div class="bibtex-modal-content">
        <div class="bibtex-modal-header">
          <h3>Paste BibTeX entry</h3>
          <button class="bibtex-modal-close" title="Close">&times;</button>
        </div>
        <div class="bibtex-modal-body">
          <textarea 
            id="bibtex-input" 
            placeholder="Paste your BibTeX entry here..."
            rows="15"
          ></textarea>
        </div>
        <div class="bibtex-modal-footer">
          <button class="bibtex-btn bibtex-btn-secondary" id="bibtex-cancel">Cancel</button>
          <button class="bibtex-btn bibtex-btn-primary" id="bibtex-import">Import</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Event listeners
    modal.querySelector('.bibtex-modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('#bibtex-cancel').addEventListener('click', () => modal.remove());
    modal.querySelector('#bibtex-import').addEventListener('click', () => {
      const text = modal.querySelector('#bibtex-input').value;
      modal.remove();
      processBibtexInput(text);
    });
    
    // Close when clicking outside the modal
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
    
    // Focus on the textarea
    setTimeout(() => {
      modal.querySelector('#bibtex-input').focus();
    }, 100);
  }
  
  /**
   * Shows a temporary message
   */
  function showMessage(text, type = 'info') {
    const message = document.createElement('div');
    message.className = `bibtex-message bibtex-message-${type}`;
    message.textContent = text;
    
    document.body.appendChild(message);
    
    // Auto-close after 5 seconds
    setTimeout(() => {
      message.classList.add('bibtex-message-fade');
      setTimeout(() => message.remove(), 300);
    }, 5000);
  }
  
  /**
   * Adds buttons to the form depending on type
   */
  function addButtonsToForm() {
    const isRefForm = isSpecifyReferenceForm();
    const isColForm = isSpecifyCollectionObjectForm();

    if (!isRefForm && !isColForm) return;

    // Try multiple possible toolbars
    const modalToolbar = document.querySelector('.flex.gap-2.justify-end');
    const roleToolbar = document.querySelector('[role="toolbar"]');

    const buttonContainer = modalToolbar || roleToolbar;

    if (isRefForm) {
      const bibtexMissing = !document.querySelector('.bibtex-import-button') && enabledFeatures.bibtex !== false;
      const doiMissing = !document.querySelector('.doi-import-button') && enabledFeatures.doi !== false;

      if (buttonContainer) {
        const firstButton = buttonContainer.querySelector('button, input[type="submit"]');
        if (bibtexMissing) {
          buttonContainer.insertBefore(createBibtexButton(), firstButton || null);
        }
        if (doiMissing) {
          buttonContainer.insertBefore(createDoiButton(), firstButton || null);
        }
      } else if (bibtexMissing || doiMissing) {
        // Toolbar not yet rendered — inject near the top of the form
        injectReferenceFormButtonsFallback();
      }
    }

    if (isColForm) {
      if (!document.querySelector('.clipboard-import-button')) {
        const clipboardButton = createClipboardImportButton();

        if (buttonContainer) {
          const firstButton = buttonContainer.querySelector('button, input[type="submit"]');
          buttonContainer.insertBefore(clipboardButton, firstButton || null);
        } else {
          injectButtonAtTop(clipboardButton);
        }
      }
    }
  }

  /**
   * Fallback injection for Reference Work forms when no toolbar is found yet.
   * Inserts buttons at the top of the form container.
   */
  function injectReferenceFormButtonsFallback() {
    if (document.querySelector('.bibtex-import-button') && document.querySelector('.doi-import-button')) return;

    const anchor = document.querySelector('select[name="ReferenceWorkType"]') ||
                   document.querySelector('input[name="title"]');
    if (!anchor) return;

    const formContainer = anchor.closest('[role="dialog"]') ||
                          anchor.closest('form') ||
                          anchor.closest('.grid') ||
                          anchor.closest('section') ||
                          anchor.parentElement?.parentElement;
    if (!formContainer) return;

    const btnWrapper = document.createElement('div');
    btnWrapper.className = 'specify7plus-btn-fallback';
    btnWrapper.style.cssText = 'display:flex;justify-content:flex-end;padding:6px 0 10px;gap:8px;flex-wrap:wrap;';

    if (!document.querySelector('.bibtex-import-button') && enabledFeatures.bibtex !== false) {
      btnWrapper.appendChild(createBibtexButton());
    }
    if (!document.querySelector('.doi-import-button') && enabledFeatures.doi !== false) {
      btnWrapper.appendChild(createDoiButton());
    }

    if (btnWrapper.children.length > 0) {
      formContainer.insertBefore(btnWrapper, formContainer.firstChild);
    }
  }

  function injectButtonAtTop(button) {
    const catNumInput = document.querySelector('input[name="catalogNumber"]');
    if (catNumInput) {
      const gridContainer = catNumInput.closest('.grid');
      if (gridContainer) {
        const btnWrapper = document.createElement('div');
        btnWrapper.style.gridColumn = '1 / -1';
        btnWrapper.style.display = 'flex';
        btnWrapper.style.justifyContent = 'flex-end';
        btnWrapper.style.paddingBottom = '10px';
        btnWrapper.style.gap = '8px';
        btnWrapper.appendChild(button);
        gridContainer.insertBefore(btnWrapper, gridContainer.firstChild);
      }
    }
  }
  
  /**
   * Observes DOM changes to detect when the form opens.
   * Uses a debounce so the form has time to fully render before we try to inject buttons.
   */
  function observeFormChanges() {
    let debounceTimer = null;

    const observer = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (isSpecifyReferenceForm() || isSpecifyCollectionObjectForm()) {
          addButtonsToForm();
          addPasteButtonsToAllFields();
        }
      }, 200);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  /**
   * Intercepts clicks on 3D model links (.stl, .obj, .gltf, .glb files)
   * and opens them in the custom 3D viewer instead of downloading
   */
  function intercept3DModelLinks() {
    // Only intercept if 3D viewer feature is enabled
    if (enabledFeatures.viewer3d === false) {
      console.log('Specify7+: 3D Viewer disabled, skipping link interception');
      return;
    }
    
    document.addEventListener('click', function(event) {
      const target = event.target.closest('a');
      
      if (!target || !target.href) return;
      
      const url = target.href;
      const lowerUrl = url.toLowerCase();
      
      // Check if it's a 3D model file
      const is3DModel = lowerUrl.endsWith('.stl') ||
                        lowerUrl.endsWith('.obj') ||
                        lowerUrl.endsWith('.gltf') ||
                        lowerUrl.endsWith('.glb') ||
                        lowerUrl.endsWith('.ply');
      
      if (!is3DModel) return;
      
      // Only intercept when the user clicked the "Open" link (Open in New Tab)
      // Leave any explicit download links untouched so Specify/browser handles them.
      const linkText = (target.textContent || '').toLowerCase();
      const ariaLabel = (target.getAttribute('aria-label') || '').toLowerCase();

      // If it's explicitly a download link or labelled 'download', do nothing here
      if (target.hasAttribute('download') || target.getAttribute('downloadname') || linkText.includes('download') || ariaLabel.includes('download')) {
        return;
      }

      // Only proceed for links that indicate 'open' (e.g. "Open in New Tab") or have target _blank
      const looksLikeOpen = linkText.includes('open') || ariaLabel.includes('open') || target.target === '_blank';
      if (!looksLikeOpen) return;

      // Intercept the click and open the viewer for Open-in-New-Tab links
      event.preventDefault();
      event.stopPropagation();
      
      // Extract filename from URL or download attribute, sanitize common server prefixes
      let filename = '';

      // Try to parse query parameters from the model URL first, prioritizing 'downloadname'
      try {
        const params = new URLSearchParams(url.split('?')[1] || '');
        const dlName = params.get('downloadname');
        const fnName = params.get('filename');
        if (dlName) filename = decodeURIComponent(dlName);
        else if (fnName) filename = decodeURIComponent(fnName);
      } catch (e) {
        // ignore and fallback
      }

      // If not found in query params, fallback to target attributes or last part of URL path
      if (!filename) {
        filename = target.getAttribute('downloadname') || target.download || url.split('/').pop().split('?')[0];
        filename = decodeURIComponent(filename || 'model');
      }

      // If still contains query params, strip them
      filename = filename.split('?')[0];
      // If it looks like a server token or UUID-only, keep last path segment
      filename = filename.split('/').pop();

      // Final fallback
      if (!filename) filename = 'model';

      // Attempt to retrieve specimen information from the current page/form to enrich the title and details panel
      let specimenInfo = '';
      let metadata = [];
      try {
        // Find the active form or nearest form container
        const form = target.closest('form') || document.querySelector('form');
        if (form) {
          // Helper to find a label for an element
          const findLabel = (inputEl) => {
            // 1. Explicit label with matching 'for' attribute
            if (inputEl.id) {
              const label = form.querySelector(`label[for="${inputEl.id}"]`);
              if (label && label.textContent.trim()) return label.textContent.trim();
            }

            // 2. aria-label attribute
            const ariaLabel = inputEl.getAttribute('aria-label');
            if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();

            // 3. title attribute if it is descriptive (doesn't just say e.g. "Required Format")
            const title = inputEl.getAttribute('title');
            if (title && title.trim() && !title.includes('Required Format') && !title.includes('Searched fields')) {
              return title.trim();
            }

            // 4. placeholder attribute
            const placeholder = inputEl.getAttribute('placeholder');
            if (placeholder && placeholder.trim() && !/^[#\-\s]+$/.test(placeholder)) {
              return placeholder.trim();
            }

            // 5. Look for preceding sibling labels or labels inside preceding siblings
            let ancestor = inputEl;
            for (let i = 0; i < 3; i++) {
              ancestor = ancestor.parentElement;
              if (!ancestor || ancestor === form) break;
              
              let sibling = ancestor.previousElementSibling;
              while (sibling) {
                const label = sibling.tagName === 'LABEL' ? sibling : sibling.querySelector('label');
                if (label && label.textContent.trim()) {
                  return label.textContent.trim();
                }
                sibling = sibling.previousElementSibling;
              }
            }

            // 6. Sibling label (if the label is directly next to it or nested)
            const siblingLabel = inputEl.parentElement.querySelector('label') || 
                                 (inputEl.previousElementSibling && inputEl.previousElementSibling.tagName === 'LABEL' ? inputEl.previousElementSibling : null);
            if (siblingLabel && siblingLabel.textContent.trim()) {
              return siblingLabel.textContent.trim();
            }

            // 7. Check name attribute
            const name = inputEl.getAttribute('name');
            if (name) {
              // Convert camelCase or kebab-case to Title Case
              const cleanName = name
                .replace(/([A-Z])/g, ' $1')
                .replace(/[-_]/g, ' ')
                .replace(/^./, str => str.toUpperCase());
              return cleanName.trim();
            }

            return null;
          };

          // Find all inputs, select, and textarea elements
          const elements = form.querySelectorAll('input, select, textarea');
          
          let catNum = '';
          let taxon = '';

          for (const el of elements) {
            // Skip hidden elements, buttons, and checkbox/radio that are not checked
            if (el.type === 'hidden' || el.type === 'submit' || el.type === 'button' || el.type === 'image') {
              continue;
            }
            // Skip elements that are hidden from view
            if (el.offsetWidth === 0 && el.offsetHeight === 0 && el.type !== 'checkbox' && el.type !== 'radio') {
              continue;
            }

            let value = '';
            if (el.tagName.toLowerCase() === 'select') {
              // Skip date precision dropdowns (e.g. options: full, month-year, year)
              const options = Array.from(el.options).map(o => o.value.toLowerCase());
              if (options.includes('full') && options.includes('year') && (options.includes('month-year') || options.includes('month'))) {
                continue;
              }
              const selectedOpt = el.options[el.selectedIndex];
              value = selectedOpt ? selectedOpt.textContent.trim() : '';
            } else if (el.type === 'checkbox' || el.type === 'radio') {
              value = el.checked ? 'Yes' : '';
            } else {
              value = el.value ? el.value.trim() : '';
            }

            // Skip empty, null, or undefined values
            if (!value) {
              continue;
            }
            const lowerVal = value.toLowerCase();
            if (lowerVal === 'null' || lowerVal === '|null|' || lowerVal === 'undefined' || lowerVal === '(null)') {
              continue;
            }

            const label = findLabel(el);
            if (!label) {
              continue;
            }

            // Clean up label: remove trailing colons or whitespace
            const cleanLabel = label.replace(/:\s*$/, '').trim();

            // Track Catalog Number and Taxon for the primary title
            const lowerLabel = cleanLabel.toLowerCase();
            const lowerName = (el.getAttribute('name') || '').toLowerCase();
            
            if (!catNum && (lowerLabel.includes('catalog number') || lowerName.includes('catalognumber') || lowerName === 'identifier')) {
              catNum = value;
            }
            if (!taxon && (lowerLabel.includes('taxon') || lowerLabel.includes('full name') || lowerName.includes('taxon') || lowerName.includes('preferredtaxon'))) {
              taxon = value;
            }

            // Avoid duplicate labels in the list (e.g. from table header match and row match)
            const exists = metadata.some(item => item.label === cleanLabel && item.value === value);
            if (!exists) {
              metadata.push({ label: cleanLabel, value: value });
            }
          }

          // Build specimenInfo for title
          if (catNum && taxon) {
            specimenInfo = `${catNum} — ${taxon}`;
          } else if (catNum) {
            specimenInfo = catNum;
          } else if (taxon) {
            specimenInfo = taxon;
          }
        }
      } catch (e) {
        console.warn('Specify7+: Could not extract specimen info from page', e);
      }

      let viewerUrl = chrome.runtime.getURL('src/viewer/viewer.html') +
                        '?url=' + encodeURIComponent(url) +
                        '&name=' + encodeURIComponent(filename);
      
      if (specimenInfo) {
        viewerUrl += '&title=' + encodeURIComponent(specimenInfo + ' - ' + filename);
      }
      
      if (metadata.length > 0) {
        viewerUrl += '&metadata=' + encodeURIComponent(JSON.stringify(metadata));
      }
      
      // Open in new tab
      window.open(viewerUrl, '_blank');

      console.log('Specify7+: 3D Model opened in viewer -', filename);
    }, true); // Use capture phase to catch the event early
  }

  /**
   * Detects if we are in a Specify 7 query results page
   */
  function isSpecifyQueryPage() {
    // Check if the URL matches the query pattern
    return window.location.pathname.includes('/specify/query/');
  }

  /**
   * Creates the "Select All" button for query results
   */
  function createSelectAllButton() {
    // Button style classes matching Specify 7 UI
    const buttonClasses = [
      'button', 'rounded', 'cursor-pointer', 'active:brightness-80', 'px-4', 'py-2',
      'disabled:bg-gray-200', 'disabled:dark:ring-neutral-500', 'disabled:ring-gray-400', 'disabled:text-gray-500',
      'dark:disabled:!bg-neutral-700', 'gap-2', 'inline-flex', 'items-center', 'capitalize', 'justify-center',
      'shadow-sm', '!py-1', '!px-2', 'hover:brightness-90', 'dark:hover:brightness-125',
      'bg-[color:var(--secondary-button-color)]', 'text-gray-800', 'dark:text-gray-100',
      'ring-1', 'ring-gray-400', 'dark:ring-0', 'disabled:ring-gray-400', 'disabled:dark:ring-neutral-500'
    ];

    const button = document.createElement('button');
    button.id = 'specify7plus-select-all-btn';
    button.type = 'button';
    button.textContent = 'Select All';
    button.classList.add(...buttonClasses);
    button.title = 'Select all records in the current query results';

    button.addEventListener('click', () => {
      // Attempt to find the nearest results container relative to the button
      // Prefer elements that act as the results table: [role="table"] or .grid-table
      function findResultsContainer(startEl) {
        let el = startEl;
        while (el) {
          try {
            const found = el.querySelector('[role="table"], .grid-table');
            if (found) return found;
          } catch (e) {
            // ignore read-only / cross-origin issues and continue
          }
          el = el.parentElement;
        }
        // Fallback: try to find a global results container in the document
        return document.querySelector('[role="table"], .grid-table');
      }

      const toolbar = button.closest('div.flex.items-center.items-stretch.gap-2');
      const resultsContainer = findResultsContainer(toolbar || button);

      if (!resultsContainer) {
        console.log('Specify7+: No results container found — Select All will not toggle any checkboxes');
        return;
      }

      // Select only enabled, visible checkboxes inside the results container
      const allCbs = Array.from(resultsContainer.querySelectorAll('input[type="checkbox"]:not([disabled])'));
      const visibleCbs = allCbs.filter(cb => {
        try {
          // offsetParent null often indicates display:none; getClientRects covers visibility in some shadowed cases
          return cb.offsetParent !== null || cb.getClientRects().length > 0;
        } catch (e) {
          return true; // if any error, keep the checkbox
        }
      });

      let selectedCount = 0;
      visibleCbs.forEach(cb => {
        if (!cb.checked) {
          // Simulate real click event so Specify recognizes the selection
          cb.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          selectedCount++;
        }
      });

      console.log(`Specify7+: Selected ${selectedCount} records (scoped to results)`);
    });

    return button;
  }

  /**
   * Adds the "Select All" button to the query results toolbar
   */
  function addSelectAllButton() {
    // Check if button already exists
    if (document.getElementById('specify7plus-select-all-btn')) {
      return;
    }

    // Check if Select All feature is enabled
    if (enabledFeatures.selectAll === false) {
      console.log('Specify7+: Select All feature disabled');
      return;
    }

    // Find the button toolbar
    const buttonToolbar = document.querySelector('div.flex.items-center.items-stretch.gap-2');
    
    if (buttonToolbar) {
      const selectAllButton = createSelectAllButton();
      buttonToolbar.appendChild(selectAllButton);
      console.log('Specify7+: Select All button added to query results');
    }
  }

  /**
   * Observes for query results toolbar to appear
   */
  function observeQueryPage() {
    const observer = new MutationObserver(() => {
      if (isSpecifyQueryPage()) {
        addSelectAllButton();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  // Initialize
  function init() {
    // Check if the form is already there
    if (isSpecifyReferenceForm() || isSpecifyCollectionObjectForm()) {
      addButtonsToForm();
      addPasteButtonsToAllFields();
    }
    
    // Observe changes
    observeFormChanges();
    
    // Intercept 3D model links
    intercept3DModelLinks();

    // Add Select All button to query pages
    if (isSpecifyQueryPage()) {
      addSelectAllButton();
      observeQueryPage();
    }
  }
  
  // Wait for the DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
})();

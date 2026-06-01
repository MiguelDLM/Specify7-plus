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
    morphosource: true,
    json: true
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
   * Treat `document` as the "main form" context and each `[role="dialog"]`
   * as its own context. When walking from document, exclude elements that
   * live inside a dialog — otherwise opening a Reference Work modal makes
   * isSpecifyReferenceForm(document) true and our buttons bleed into the
   * Collection Object toolbar underneath.
   */
  function inSameContext(el, root) {
    if (!el) return false;
    if (root === document) return !el.closest('[role="dialog"]');
    return root.contains(el);
  }
  function scopedAll(root, selector) {
    return Array.from(root.querySelectorAll(selector)).filter(el => inSameContext(el, root));
  }
  function scopedFirst(root, selector) {
    return scopedAll(root, selector)[0] || null;
  }

  /**
   * Detects if `root` contains a Specify 7 Reference Work form.
   */
  function isSpecifyReferenceForm(root = document) {
    const modalHeader = scopedAll(root, 'h2[id*="modal"][id*="header"]')
      .find(h => h.textContent.includes('Reference Work'));
    if (modalHeader) return true;

    const dialogHeader = scopedAll(root, 'h2')
      .find(h => /Reference Work/i.test(h.textContent));
    if (dialogHeader) return true;

    const titleField = scopedFirst(root, 'input[name="title"]');
    const publisherField = scopedFirst(root, 'input[name="publisher"]');
    const typeSelect = scopedFirst(root, 'select[name="ReferenceWorkType"]');

    return !!(titleField && publisherField && typeSelect);
  }

  /**
   * Detects if `root` contains a Specify 7 Collection Object form.
   */
  function isSpecifyCollectionObjectForm(root = document) {
    const headers = scopedAll(root, 'h2');
    if (headers.some(h2 => h2.textContent.includes('Collection Object'))) return true;

    const catNumField = scopedFirst(root, 'input[name="catalogNumber"]');
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
   * Handles BibTeX import — always opens the paste modal, prefilled with
   * the clipboard contents if available. Previously this auto-imported
   * whenever the clipboard contained "@", which was a hidden shortcut
   * that surprised users (especially when the clipboard already had
   * unrelated BibTeX from another tab). The modal now always gives the
   * user a chance to review or replace the text before importing.
   */
  async function handleBibtexImport() {
    let clipboardText = '';
    try {
      clipboardText = await navigator.clipboard.readText();
    } catch (error) {
      // Permission denied or no focus — fall through with empty prefill.
      console.log('Specify7+: Could not read clipboard for BibTeX prefill:', error);
    }
    showBibtexInputModal(clipboardText);
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
   * Helper to normalize a string: lowercase, remove non-alphanumeric characters,
   * and strip accents/diacritics to make matching extremely robust.
   */
  function normalizeString(str) {
    if (!str) return '';
    let clean = str
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const stopwords = new Set(['de', 'del', 'el', 'la', 'los', 'las', 'y', 'o', 'of', 'the', 'in', 'and', 'or', 'a', 'an', 'to', 'for', 'with', 'by', 'at', 'on', 'from']);
    const words = clean.split(/[^a-z0-9]+/);
    const filteredWords = words.filter(word => word && !stopwords.has(word));
    
    return filteredWords.join('');
  }

  /**
   * Flattens a nested object into a flat object with snake_case keys.
   */
  function flattenObject(obj, prefix = '') {
    let result = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const newKey = prefix ? `${prefix}_${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          Object.assign(result, flattenObject(obj[key], newKey));
        } else {
          result[newKey] = obj[key];
        }
      }
    }
    return result;
  }

  /**
   * Tries to find the label text corresponding to an input element.
   * Walks up parents, siblings, and grid blocks.
   */
  function getInputLabelText(input) {
    // 1. Associated label by 'for' attribute
    if (input.id) {
      const label = document.querySelector(`label[for="${input.id}"]`);
      if (label && label.textContent.trim()) return label.textContent.trim();
    }

    // 2. aria-label — Specify uses this on headlessui-rendered combobox
    // pickers (Taxon, Locality, Paleo Context, etc.) where the visible
    // label sits in a separate row that doesn't reach this input via
    // `for=` or `<label>` ancestry.
    const ariaLabel = input.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();

    // 3. Parent label element
    const parentLabel = input.closest('label');
    if (parentLabel && parentLabel.textContent.trim()) return parentLabel.textContent.trim();
    
    // 3. Search siblings for label tag or elements with label-like classes
    const parent = input.parentElement;
    if (parent) {
      const labelsInParent = parent.querySelectorAll('label');
      for (const lbl of labelsInParent) {
        if (lbl.textContent.trim()) return lbl.textContent.trim();
      }
      
      let prev = input.previousElementSibling;
      while (prev) {
        if (prev.tagName === 'LABEL' || prev.classList.contains('control-label') || prev.classList.contains('label')) {
          if (prev.textContent.trim()) return prev.textContent.trim();
        }
        if (prev.textContent && prev.textContent.trim().length > 1 && prev.textContent.trim().length < 50) {
          if (!prev.contains(input)) return prev.textContent.trim();
        }
        prev = prev.previousElementSibling;
      }
    }
    
    // 4. Try looking at the closest grid cell or row labels
    const formRow = input.closest('.grid') || input.closest('tr') || input.closest('.flex');
    if (formRow) {
      const labels = formRow.querySelectorAll('label, .label, .control-label');
      if (labels.length === 1 && labels[0].textContent.trim()) {
        return labels[0].textContent.trim();
      }
      
      const inputWrapper = input.closest('.col-span-1') || input.closest('td') || input.parentElement;
      if (inputWrapper) {
        let cellPrev = inputWrapper.previousElementSibling;
        if (cellPrev) {
          const lbl = cellPrev.querySelector('label, .label, .control-label') || cellPrev;
          if (lbl && lbl.textContent.trim()) return lbl.textContent.trim();
        }
      }
    }
    
    return '';
  }

  /**
   * Semantic aliases: a JSON key on the left can also match any of the
   * normalized aria-labels / titles on the right. Specify groups several
   * concepts under one combobox (e.g. "Paleo Context" covers stratigraphy,
   * formation, member, age, era) so we need to expand the search space for
   * those keys explicitly.
   */
  const KEY_ALIASES = {
    // Stratigraphy / chronostratigraphy: Specify funnels several concepts
    // through one "Paleo Context" picker
    stratigraphy: ['paleocontext', 'lithostratigraphy', 'chronostratigraphy'],
    lithostratigraphy: ['paleocontext', 'lithostratigraphy'],
    biostratigraphy: ['paleocontext', 'biostratigraphy'],
    chronostratigraphy: ['paleocontext', 'chronostratigraphy'],
    formation: ['paleocontext', 'lithostratigraphy'],
    member: ['paleocontext', 'lithostratigraphy'],
    group: ['paleocontext', 'lithostratigraphy'],
    bed: ['paleocontext', 'lithostratigraphy'],
    geologicalage: ['paleocontext', 'chronostratigraphy'],
    age: ['paleocontext', 'chronostratigraphy'],
    period: ['paleocontext', 'chronostratigraphy'],
    epoch: ['paleocontext', 'chronostratigraphy'],
    era: ['paleocontext', 'chronostratigraphy'],
    systemperiod: ['paleocontext', 'chronostratigraphy'],
    seriesepoch: ['paleocontext', 'chronostratigraphy'],
    // Land-mammal age / faunal zone are BIOstratigraphy, never chronostrat —
    // the Chronostratigraphy field takes Series/Epoch or System/Period.
    landmammalage: ['paleocontext', 'biostratigraphy'],
    faunalzone: ['paleocontext', 'biostratigraphy'],
    zone: ['paleocontext', 'biostratigraphy'],

    // Locality auxiliaries — many JSON exports from other Specify
    // instances or portals use "site" / "siteKey" / "latitude" instead
    // of Specify's internal `localityName` / `stationFieldNumber` /
    // `latitude1` field names.
    locality: ['locality', 'localityname'],
    site: ['locality', 'localityname'],
    sitename: ['locality', 'localityname'],
    sitekey: ['stationfieldnumber', 'localitycode', 'collectornumber'],
    latitude: ['latitude1', 'lat'],
    longitude: ['longitude1', 'lng', 'lon'],
    namedplace: ['locality', 'localityname'],

    // Agents
    collector: ['collectors', 'agent', 'lastname'],
    collectors: ['collectors', 'agent', 'lastname'],
    determiner: ['determiner', 'lastname'],
    cataloger: ['cataloger', 'lastname'],
    preparator: ['preparedby', 'lastname'],
    preparedby: ['preparedby', 'lastname'],

    // Taxonomy hierarchy — these are NOT separately mappable in most
    // Specify Collection Object forms (the Taxon picker takes a single
    // string against the tree). We alias them to `taxon` as a last
    // resort so the picker still gets a value when the JSON omits the
    // composite `taxon` key.
    class: ['taxon', 'fullname'],
    order: ['taxon', 'fullname'],
    family: ['taxon', 'fullname'],
    subfamily: ['taxon', 'fullname'],
    tribe: ['taxon', 'fullname'],
    genus: ['taxon', 'fullname'],
    subgenus: ['taxon', 'fullname'],
    species: ['taxon', 'fullname'],
    scientificname: ['taxon', 'fullname'],

    // Specimen attributes
    natureofspecimen: ['naturedescription', 'description', 'preservation'],
    // Map straight to the determination's "Type Status" picklist. The old
    // broad `type` alias leaked the value onto unrelated fields (prepType,
    // ReferenceWorkType), leaving Type Status empty.
    specimentype: ['typestatus'],
    typestatus: ['typestatus'],
    isondisplay: ['onloan', 'available'],
    ispublished: ['ispublished', 'published'],
    objectstatus: ['inventorystatus', 'objectcondition'],
    status: ['inventorystatus', 'objectcondition'],

    // Dates
    startdateyear: ['startdate'],
    enddateyear: ['enddate'],
    collectiondate: ['startdate'],
    datecollected: ['startdate'],
  };

  // An alias hit scores slightly below a literal-key hit (see getMatchScore).
  const ALIAS_PENALTY = 0.9;

  // Tie-breaker for when several JSON keys alias to the SAME Specify field
  // and therefore score identically — most of the stratigraphy/age vocabulary
  // funnels through the single "Paleo Context" picker. Lower number = more
  // preferred. Keys not listed fall back to DEFAULT_PRIORITY. This encodes:
  //   • Paleo Context *name* is the lithostratigraphic unit (the formation),
  //     not the geological age — so "Liushu Formation" wins over "Neogene".
  //   • Chronostratigraphy takes the finer Series/Epoch, then System/Period.
  //   • Land-mammal age / faunal zone are Biostratigraphy.
  const DEFAULT_PRIORITY = 50;
  const KEY_PRIORITY = {
    // Composite taxon beats the individual rank fields for the Taxon picker.
    taxon: 0, scientificname: 0,
    // Lithostratigraphy → also the Paleo Context context name.
    formation: 1, lithostratigraphy: 1,
    member: 2, group: 2, bed: 2,
    // Biostratigraphy.
    landmammalage: 3, faunalzone: 4, zone: 5,
    // Chronostratigraphy: prefer Series/Epoch over System/Period.
    seriesepoch: 6, systemperiod: 7,
    geologicalage: 8, series: 8, epoch: 8, period: 9, era: 9, age: 9,
    // Umbrella keys lose to anything more specific.
    chronostratigraphy: 20, biostratigraphy: 20, stratigraphy: 21,
    // Rank fields are last-resort Taxon fillers.
    genus: 30, species: 30, subgenus: 31,
    class: 40, order: 40, family: 40, subfamily: 40, tribe: 40,
  };

  function keyPriority(key) {
    const k = normalizeString(key);
    return KEY_PRIORITY[k] != null ? KEY_PRIORITY[k] : DEFAULT_PRIORITY;
  }

  /**
   * Calculates a match score between an input field and a JSON key.
   * Returns a score, where exact matches are highest and partial matches are lower.
   */
  function getMatchScore(input, key, labelText) {
    const normKey = normalizeString(key);
    if (!normKey) return 0;

    const normName = normalizeString(input.getAttribute('name'));
    const normId = normalizeString(input.getAttribute('id'));
    const normLabel = normalizeString(labelText);
    const normAria = normalizeString(input.getAttribute('aria-label'));
    const normTitle = normalizeString(input.getAttribute('title'));
    const normPlaceholder = normalizeString(input.getAttribute('placeholder'));

    const checkMatch = (normVal, baseScore, targetKey) => {
      if (!normVal) return 0;
      if (normVal === targetKey) {
        return baseScore + 2; // Exact match
      }
      if (normVal.includes(targetKey) || targetKey.includes(normVal)) {
        const ratio = Math.min(normVal.length, targetKey.length) / Math.max(normVal.length, targetKey.length);
        let score = baseScore * 0.6 * ratio;
        if (normVal.startsWith(targetKey) || normVal.endsWith(targetKey) || targetKey.startsWith(normVal) || targetKey.endsWith(normVal)) {
          score += 0.5;
        }
        return score;
      }
      return 0;
    };

    // Score one target key against all of the input's identifying attributes
    // and take the best attribute hit. aria-label is Specify's canonical
    // label for combobox pickers — weight it just below `name` because
    // Specify often leaves `name` empty on headlessui-rendered comboboxes
    // (taxon, locality, paleo context, etc.).
    const scoreTarget = (targetKey) => {
      let s = 0;
      s = Math.max(s, checkMatch(normName, 10, targetKey));
      s = Math.max(s, checkMatch(normAria, 9.5, targetKey));
      s = Math.max(s, checkMatch(normId, 9, targetKey));
      s = Math.max(s, checkMatch(normLabel, 8, targetKey));
      s = Math.max(s, checkMatch(normTitle, 7, targetKey));
      s = Math.max(s, checkMatch(normPlaceholder, 6, targetKey));
      return s;
    };

    // A hit on the literal JSON key always outranks a hit that only came
    // through an alias. Without this, broad rank/strat aliases steal a field
    // from the more specific key the user actually meant: e.g. `class`
    // ("Mammalia") aliases to `taxon` and would otherwise tie — and win by
    // JSON order — against the real composite `taxon` ("Ursavus tedfordi").
    let bestScore = scoreTarget(normKey);
    for (const alias of (KEY_ALIASES[normKey] || [])) {
      bestScore = Math.max(bestScore, scoreTarget(alias) * ALIAS_PENALTY);
    }

    return bestScore;
  }

  /**
   * Automatically expands collapsed fieldsets/sections in the form.
   * Scans for headings/legends, checks if they are collapsed (e.g. no inputs visible inside their container),
   * and clicks the header/legend to expand them.
   */
  async function expandCollapsibleSections() {
    const sectionNames = [
      'other identifiers', 'otros identificadores',
      'geological context', 'contexto geologico',
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

      const normText = normalizeString(text);
      const isTargetSection = sectionNames.some(name => normalizeString(name) === normText || normText.includes(normalizeString(name)));
      
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
        await sleep(250);
      }
    }
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

    // Force-clear any existing content first via the native React-aware
    // setter. Without this, when the input was previously populated
    // (Specify default, prior fill, or React-controlled re-render),
    // execCommand 'insertText' below can APPEND instead of replace —
    // which produced concatenated nonsense in the Other Identifiers
    // Remarks textarea (e.g. "Associated...1974-11-302001-01-01").
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
        // Ignore — execCommand path below will still try to overwrite.
      }
    }

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
   * Find a fieldset whose heading matches `sectionRegex` and ensure it has
   * at least one editable row. If the section is empty (typical for new
   * Collection Object forms where Determinations / Paleo Context / Collecting
   * Event subforms render an "Add" button only), this clicks Add and waits
   * for the row to render before returning. Returns the fieldset or null.
   */
  async function ensureSubformRowFor(sectionRegex) {
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
      addBtn.click();
      await sleep(400);
    }
    return fs;
  }

  /**
   * Returns true if the input is an autocomplete combobox that Specify 7
   * clears on blur when the typed value doesn't match an existing record.
   * In Specify, every `input[role="combobox"]` is one of these pickers
   * (tree-pickers, agent lookups, locality, journal, etc.) — fixed-list
   * dropdowns use `<select>` instead. So watching all of them is safe.
   */
  function isTreePickInput(input) {
    return !!(input && input.getAttribute('role') === 'combobox');
  }

  /**
   * Watch a tree-picker combobox: if Specify clears its value (typed name not
   * matched against the tree), surface a small "Crear «value»" badge below
   * the input. Clicking the badge re-types the value and gives the user a
   * chance to pick the autocomplete "Add" suggestion or create the node.
   */
  function watchTreeFieldClearing(input, value) {
    if (!input || !value) return;
    input.dataset.pendingTreeValue = value;

    if (input._specify7plusTreeWatched) return;
    input._specify7plusTreeWatched = true;

    let badge = null;

    const refill = async () => {
      await setSafeValue(input, value);
      await sleep(400);
      const listbox = document.querySelector('[role="listbox"]');
      if (listbox) {
        const opts = Array.from(listbox.querySelectorAll('[role="option"], li, button'));
        const addOpt = opts.find(o => /\badd\b|\bañad|\bcrear/i.test(o.textContent || ''));
        if (addOpt) addOpt.click();
      }
    };

    const showBadge = () => {
      if (badge && document.body.contains(badge)) return;
      badge = document.createElement('button');
      badge.type = 'button';
      badge.className = 'specify7plus-tree-pending';
      badge.title = `Specify borró "${value}" porque no existe en el árbol. Click para reinsertarlo y crear la entrada nueva.`;
      badge.textContent = `Crear «${value}»`;
      badge.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await refill();
      });

      const wrapper = input.closest('.relative') || input.parentElement;
      if (wrapper) {
        wrapper.style.position = wrapper.style.position || 'relative';
        wrapper.appendChild(badge);
      } else {
        input.after(badge);
      }
    };

    const hideBadge = () => {
      if (badge) { badge.remove(); badge = null; }
    };

    const check = () => {
      if (!document.body.contains(input)) return false;
      const expected = input.dataset.pendingTreeValue;
      if (!expected) { hideBadge(); return false; }
      const current = (input.value || '').trim();
      if (!current) {
        showBadge();
      } else if (current === expected) {
        hideBadge();
      }
      return true;
    };

    const intervalId = setInterval(() => {
      if (!check()) clearInterval(intervalId);
    }, 600);
    setTimeout(() => clearInterval(intervalId), 30000);

    input.addEventListener('input', check);
    input.addEventListener('change', check);
    input.addEventListener('blur', () => setTimeout(check, 250));
  }

  /**
   * Helper to find which data key corresponds to an input. Used by the
   * per-field paste button as a fallback when keyword scoring doesn't
   * match anything. Order matters: name → label → aria-label → title,
   * narrow to broad, exact to substring. The title-based heuristics in
   * particular must be SCOPED to the input's fieldset — Paleo Context's
   * title contains "Full Name" twice ("…Chronostratigraphy / Full Name
   * …Lithostratigraphy / Full Name") which used to mis-classify it as
   * a Taxon input and then paste the taxon value into it.
   */
  function findFieldKey(input) {
    // 1. Check by name attribute (server-rendered fields)
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

    // 2. Check by <label for=...>
    const label = document.querySelector(`label[for="${input.id}"]`);
    if (label) {
      const text = label.textContent.trim().toLowerCase();
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

    // 3. Check by aria-label — Specify uses this on its combobox pickers
    // and it's unambiguous (one canonical name per field).
    const aria = (input.getAttribute('aria-label') || '').trim().toLowerCase();
    if (aria) {
      if (aria === 'taxon') return 'taxon';
      if (aria === 'locality' || aria === 'locality name') return 'origin';
      if (aria === 'paleo context') return 'paleoContext';
      if (aria === 'preparer' || aria === 'prepared by') return 'creator';
      if (aria === 'collector' || aria === 'cataloger' || aria === 'determiner') return 'creator';
    }

    // 4. Title-based heuristics — only safe when scoped to the right
    // fieldset, otherwise the heading-less form rows leak between
    // sections (Paleo Context's title includes "Full Name" twice).
    const title = (input.getAttribute('title') || '').toLowerCase();
    const fs = input.closest('fieldset');
    const heading = fs ? (fs.querySelector('h3, h4, legend')?.textContent || '').toLowerCase() : '';

    if (title.includes('locality name')) return 'origin';
    if (title.includes('prep type')) return 'prepType';
    if (title.includes('prepared by')) return 'creator';
    if (title.includes('full name') && /determination/i.test(heading)) return 'taxon';

    return null;
  }

  /**
   * Tries to find a matching value for an input in the lastCapturedData.
   */
  function findValueInCapturedData(input) {
    if (!lastCapturedData) return null;
    
    const fieldKey = findFieldKey(input);
    const labelText = getInputLabelText(input);
    const keys = Object.keys(lastCapturedData);

    // 1. Try to find key match via greedy scoring
    let bestKey = null;
    let bestScore = 0;

    for (const key of keys) {
      const score = getMatchScore(input, key, labelText);
      if (score < 1.5) continue;
      // Higher score wins; on a tie, the lower keyPriority wins (so the
      // context-name picker keeps `formation` over `systemPeriod`, etc.).
      if (score > bestScore || (score === bestScore && bestKey && keyPriority(key) < keyPriority(bestKey))) {
        bestScore = score;
        bestKey = key;
      }
    }

    if (bestKey) {
      return lastCapturedData[bestKey];
    }

    // 2. Specific legacy fallbacks for MorphoSource captured data
    if (fieldKey === 'taxon') {
      return `${lastCapturedData.genus || ''} ${lastCapturedData.species || ''}`.trim() || lastCapturedData.taxon;
    }
    if (fieldKey === 'inventoryNumber') {
      return lastCapturedData.inventoryNumber || lastCapturedData.catalogNumber || lastCapturedData.altCatalogNumber || lastCapturedData.identifier || lastCapturedData.stationFieldNumber;
    }
    if (fieldKey === 'collection') {
      return lastCapturedData.collection || lastCapturedData.institution;
    }
    if (fieldKey === 'description') {
      return lastCapturedData.description || lastCapturedData.remarks;
    }
    if (fieldKey === 'paleoContext') {
      return lastCapturedData.stratigraphy || lastCapturedData.lithostratigraphy ||
             lastCapturedData.formation || lastCapturedData.member ||
             lastCapturedData.geologicalAge || lastCapturedData.age ||
             lastCapturedData.chronostratigraphy;
    }
    if (fieldKey === 'origin') {
      return lastCapturedData.locality || lastCapturedData.localityName ||
             lastCapturedData.origin;
    }
    if (fieldKey === 'creator') {
      return lastCapturedData.collector || lastCapturedData.collectors ||
             lastCapturedData.cataloger || lastCapturedData.determiner ||
             lastCapturedData.creator;
    }

    return null;
  }

  /**
   * Injects a small paste button next to an input
   */
  function injectPasteButton(input) {
    if (input.dataset.hasPasteBtn || input.readOnly || input.disabled) return;
    
    const valueToSet = findValueInCapturedData(input);
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
        const freshValue = findValueInCapturedData(input);
        if (freshValue) {
          await setSafeValue(input, freshValue.toString());
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
      wrapper.appendChild(btn);
    } else {
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
        watchTreeFieldClearing(locInput, data.origin);
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
          watchTreeFieldClearing(preparedByInput, data.creator);
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
          watchTreeFieldClearing(taxonInput, taxonStr);
        }
      }
    }
  }

  /**
   * Shows modal to paste DOI and fetch metadata
   */
  async function showDoiInputModal() {
    // Try to prefill from clipboard. Accept either a bare DOI ("10.x/...")
    // or a DOI URL ("https://doi.org/10.x/...") — common copy formats.
    let prefill = '';
    try {
      const clip = (await navigator.clipboard.readText()).trim();
      const doiMatch = clip.match(/(?:https?:\/\/(?:dx\.)?doi\.org\/)?(10\.\d{4,9}\/\S+)/i);
      if (doiMatch) prefill = doiMatch[1];
    } catch (e) {
      // No clipboard access — leave empty.
    }

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

    const input = modal.querySelector('#doi-input');
    if (prefill) input.value = prefill;

    modal.querySelector('.bibtex-modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('#doi-cancel').addEventListener('click', () => modal.remove());
    modal.querySelector('#doi-import').addEventListener('click', async () => {
      const doi = input.value.trim();
      modal.remove();
      if (!doi) {
        showMessage('Please enter a DOI', 'warning');
        return;
      }
      await fetchDoiAndFill(doi);
    });

    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    setTimeout(() => {
      input.focus();
      if (input.value) input.select();
    }, 100);
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

    // Journal (special field with autocomplete). Specify wipes the typed
    // value on any unrelated state change (e.g. opening the New Agent
    // dialog from an author "+ Add"), so attach the same "pending tree
    // value" badge as taxon / stratigraphy — the user can refill with one
    // click without re-typing the whole journal name.
    if (data.journal) {
      const journalInput = document.querySelector('input[role="combobox"][title*="Journal"]') ||
                           document.querySelector('input[role="combobox"][title*="journal"]');
      if (journalInput) {
        await setSafeValue(journalInput, data.journal);
        watchTreeFieldClearing(journalInput, data.journal);
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
   * Queue of recently-typed author intents. When the user clicks "+ Add"
   * in an author combobox's autocomplete, Specify opens a "New Agent" dialog
   * and dumps the whole typed string into `lastName` (firstName stays empty).
   * We keep the parsed firstName / lastName around so the dialog watcher
   * below can re-fill the dialog correctly once it appears.
   */
  const pendingAuthorIntents = [];
  const PENDING_AUTHOR_TTL_MS = 5 * 60 * 1000;

  function rememberAuthorIntent(author, typedString) {
    if (!author || (!author.firstName && !author.lastName)) return;
    pendingAuthorIntents.push({
      author,
      typedString: (typedString || '').trim(),
      timestamp: Date.now()
    });
    const cutoff = Date.now() - PENDING_AUTHOR_TTL_MS;
    while (pendingAuthorIntents.length && pendingAuthorIntents[0].timestamp < cutoff) {
      pendingAuthorIntents.shift();
    }
  }

  function consumePendingAuthorMatch(dialogLastName) {
    if (!pendingAuthorIntents.length) return null;
    const target = (dialogLastName || '').trim();
    if (!target) return null; // Don't guess if Specify hasn't prefilled yet.

    // Strict match only. Previously we fell back to the newest pending
    // author when nothing matched, but that caused the New Agent dialog
    // to be populated with the LAST author's data even when the user
    // clicked "+ Add" on the first author's combobox. Better to no-op
    // than to silently fill the wrong record.
    const idx = pendingAuthorIntents.findIndex(p => {
      if (p.typedString && p.typedString === target) return true;
      if (p.author.lastName && p.author.lastName === target) return true;
      if (p.author.lastName && target.startsWith(p.author.lastName + ',')) return true;
      return false;
    });
    if (idx === -1) return null;

    const [match] = pendingAuthorIntents.splice(idx, 1);
    return match.author;
  }

  let agentDialogObserver = null;
  function initAgentDialogWatcher() {
    if (agentDialogObserver) return;
    agentDialogObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          const dialogs = node.matches && node.matches('[role="dialog"]')
            ? [node]
            : Array.from(node.querySelectorAll ? node.querySelectorAll('[role="dialog"]') : []);
          for (const dialog of dialogs) {
            maybeFillAgentDialog(dialog);
          }
        }
      }
    });
    agentDialogObserver.observe(document.body, { childList: true, subtree: true });
  }

  async function maybeFillAgentDialog(dialog) {
    if (dialog._specify7plusAgentFilled) return;

    // Wait for React to mount the lastName/firstName inputs.
    let lastInput = null;
    let firstInput = null;
    for (let i = 0; i < 25; i++) {
      lastInput = dialog.querySelector('input[name="lastName"]');
      firstInput = dialog.querySelector('input[name="firstName"]');
      if (lastInput && firstInput) break;
      await sleep(80);
    }
    if (!lastInput || !firstInput) return;

    // Then wait for Specify to prefill lastName from the source combobox.
    // Specify pushes this value after the dialog mounts, so polling here is
    // necessary — reading too early gives "" and our matcher would no-op.
    let prefilled = '';
    for (let i = 0; i < 25; i++) {
      prefilled = (lastInput.value || '').trim();
      if (prefilled) break;
      await sleep(80);
    }

    const author = consumePendingAuthorMatch(prefilled);
    if (!author) return;

    dialog._specify7plusAgentFilled = true;

    // Make sure Agent Type is "Person" before filling personal name fields.
    const typeSelect = dialog.querySelector('select[name="_AgentTypeComboBox"]');
    if (typeSelect) {
      const personOpt = Array.from(typeSelect.options).find(o => /^person|persona/i.test(o.text.trim()));
      if (personOpt && typeSelect.value !== personOpt.value) {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
        nativeSetter.call(typeSelect, personOpt.value);
        typeSelect.dispatchEvent(new Event('input', { bubbles: true }));
        typeSelect.dispatchEvent(new Event('change', { bubbles: true }));
        await sleep(150);
      }
    }

    // Specify dumped the whole "LastName, FirstName" search string into
    // lastName — overwrite it with the parsed components.
    if (author.lastName) {
      await setSafeValue(lastInput, author.lastName);
    }
    if (author.firstName) {
      const firstParts = author.firstName.trim().split(/\s+/);
      const firstName = firstParts[0];
      const middle = firstParts.slice(1).join(' ');

      await setSafeValue(firstInput, firstName);

      const middleInput = dialog.querySelector('input[name="middleInitial"]');
      if (middleInput && middle) {
        const initials = middle
          .split(/\s+/)
          .map(p => p[0] ? p[0].toUpperCase() + '.' : '')
          .filter(Boolean)
          .join(' ');
        if (initials) await setSafeValue(middleInput, initials);
      }
    }
  }

  /**
   * Fill existing author fields with author data
   * @param {Array<{firstName:string,lastName:string}>} authors
   */
  async function fillExistingAuthorFields(authors) {
    initAgentDialogWatcher();

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
        rememberAuthorIntent(author, display);
        // Opening the New Agent dialog from any one row causes Specify to
        // wipe the typed (but unselected) value in the OTHER author rows
        // when the dialog closes. The badge gives the user a one-click
        // refill so they don't lose their place.
        watchTreeFieldClearing(input, display);
      }
    }
  }

  /**
   * Processes the pasted JSON text and maps it to Specify form fields
   */
  async function processJsonInput(jsonText) {
    if (!jsonText || !jsonText.trim()) {
      showMessage('JSON input is empty', 'warning');
      return;
    }

    let rawData;
    try {
      rawData = JSON.parse(jsonText);
    } catch (e) {
      console.error('Specify7+: Failed to parse JSON:', e);
      showMessage('Invalid JSON format: ' + e.message, 'error');
      return;
    }

    if (typeof rawData !== 'object' || rawData === null) {
      showMessage('JSON must be an object or array of objects', 'error');
      return;
    }

    const data = Array.isArray(rawData) ? rawData[0] : rawData;
    if (typeof data !== 'object' || data === null) {
      showMessage('JSON data is empty or invalid', 'error');
      return;
    }

    const flatData = flattenObject(data);
    const keys = Object.keys(flatData);

    if (keys.length === 0) {
      showMessage('No keys found in JSON object', 'warning');
      return;
    }

    // 1. Clear previous captured data to avoid mixing old data with the new JSON data
    lastCapturedData = {};
    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ lastCapturedSpecimen: {} });
    }

    showMessage('Mapping JSON data...', 'info');

    // 2. Automatically expand collapsed fieldsets/sections
    await expandCollapsibleSections();

    // 3. Pre-create rows in subforms that need an "Add" click before any input
    //    is available. Only trigger when the JSON actually has a non-empty
    //    value for one of the relevant keys — otherwise we'd open empty rows
    //    for keys present as null (e.g. {"collector": null}).
    const norm = s => normalizeString(s);
    const hasNonEmpty = (set) => keys.some(k => set.includes(norm(k)) && flatData[k] != null && flatData[k] !== '');
    const hasOtherIdKeys = hasNonEmpty(['altcatalognumber', 'institution', 'collection', 'otherid', 'otheridentifier']);
    const hasDeterminationKeys = hasNonEmpty(['taxon', 'genus', 'species', 'determination', 'determinations', 'preferredtaxon', 'scientificname']);
    const hasGeoContextKeys = hasNonEmpty(['stratigraphy', 'formation', 'member', 'lithostratigraphy', 'biostratigraphy', 'chronostratigraphy', 'geologicalage', 'age', 'period', 'epoch', 'era']);
    const hasCollectingEventKeys = hasNonEmpty(['collector', 'collectors', 'collectiondate', 'startdate', 'enddate', 'verbatimdate', 'date', 'locality', 'localityname']);

    if (hasOtherIdKeys) await ensureSubformRowFor(/Other Identifiers|Otros identificadores/i);
    if (hasDeterminationKeys) await ensureSubformRowFor(/Determinations?|Determinaciones?/i);
    if (hasGeoContextKeys) await ensureSubformRowFor(/Paleo\s*Context|Geological\s*Context|Contexto\s*Geol[oó]gico|Stratigraph|Estratigraf/i);
    if (hasCollectingEventKeys) await ensureSubformRowFor(/Collecting\s*Event|Evento\s*de\s*Colecta/i);

    // Get all supported inputs in the form (now updated with newly expanded/added inputs)
    const inputs = Array.from(document.querySelectorAll('input:not([type="submit"]):not([type="button"]), textarea, select'));
    
    const inputsWithLabels = inputs.map(input => {
      return {
        input,
        labelText: getInputLabelText(input)
      };
    });

    const candidates = [];
    const threshold = 1.5;

    for (const key of keys) {
      const val = flatData[key];
      if (val === undefined || val === null || val === '') continue;

      for (const entry of inputsWithLabels) {
        const score = getMatchScore(entry.input, key, entry.labelText);
        if (score >= threshold) {
          candidates.push({
            key,
            value: val,
            input: entry.input,
            score
          });
        }
      }
    }

    // Phase 1: greedy assignment by score — best (key, input) pairs win first,
    // then both sides drop out of the pool. Ties (many keys funnel through one
    // Paleo Context picker and score identically) are broken by keyPriority so
    // the semantically-right key wins instead of whichever came first in the
    // JSON — e.g. `formation` beats `systemPeriod` for the context name.
    candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return keyPriority(a.key) - keyPriority(b.key);
    });

    const assignments = [];
    const claimedInputs = new Set();
    const claimedKeys = new Set();
    for (const cand of candidates) {
      if (claimedInputs.has(cand.input) || claimedKeys.has(cand.key)) continue;
      claimedInputs.add(cand.input);
      claimedKeys.add(cand.key);
      assignments.push(cand);
    }

    // Phase 2: fill non-combobox fields first, then tree-picker comboboxes.
    // Specify clears comboboxes when another field steals focus, so filling
    // them last keeps their values from being wiped by subsequent setters.
    assignments.sort((a, b) => {
      const aIsCombo = a.input.getAttribute('role') === 'combobox' ? 1 : 0;
      const bIsCombo = b.input.getAttribute('role') === 'combobox' ? 1 : 0;
      return aIsCombo - bIsCombo;
    });

    let fillCount = 0;
    for (const cand of assignments) {
      try {
        const strValue = cand.value.toString();
        await setSafeValue(cand.input, strValue);
        fillCount++;

        if (isTreePickInput(cand.input)) {
          watchTreeFieldClearing(cand.input, strValue);
        }
      } catch (err) {
        console.error('Specify7+: Error setting value for key', cand.key, err);
      }
    }

    // 4. Save the new JSON data to lastCapturedData and local storage so individual paste buttons can use it
    for (const key in flatData) {
      lastCapturedData[key] = flatData[key];
    }
    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ lastCapturedSpecimen: lastCapturedData });
    }

    // Remove old paste buttons and re-evaluate so the new JSON values show up next to matched fields
    document.querySelectorAll('.field-paste-btn').forEach(b => b.remove());
    document.querySelectorAll('[data-has-paste-btn]').forEach(i => delete i.dataset.hasPasteBtn);

    if (fillCount > 0) {
      showMessage(`Successfully imported ${fillCount} fields!`, 'success');
      addPasteButtonsToAllFields();
    } else {
      showMessage('No fields could be mapped from the JSON.', 'warning');
    }
  }

  /**
   * Shows modal to paste JSON
   */
  function showJsonInputModal() {
    const modal = document.createElement('div');
    modal.className = 'bibtex-modal';
    modal.innerHTML = `
      <div class="bibtex-modal-content">
        <div class="bibtex-modal-header">
          <h3>Paste JSON data</h3>
          <button class="bibtex-modal-close" title="Close">&times;</button>
        </div>
        <div class="bibtex-modal-body">
          <textarea 
            id="json-input" 
            placeholder='Paste your JSON object here...\n\nExample:\n{\n  "catalogNumber": "12345",\n  "taxon": "Canis lupus",\n  "remarks": "Sample description"\n}'
            rows="15"
          ></textarea>
        </div>
        <div class="bibtex-modal-footer">
          <button class="bibtex-btn bibtex-btn-secondary" id="json-cancel">Cancel</button>
          <button class="bibtex-btn bibtex-btn-primary" id="json-import">Import</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Event listeners
    modal.querySelector('.bibtex-modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('#json-cancel').addEventListener('click', () => modal.remove());
    modal.querySelector('#json-import').addEventListener('click', () => {
      const text = modal.querySelector('#json-input').value;
      modal.remove();
      processJsonInput(text);
    });
    
    // Close when clicking outside the modal
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
    
    // Focus on the textarea
    setTimeout(() => {
      modal.querySelector('#json-input').focus();
    }, 100);
  }

  /**
   * Creates the JSON import button
   */
  function createJsonButton() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'json-import-button';
    button.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="16 18 22 12 16 6"></polyline>
        <polyline points="8 6 2 12 8 18"></polyline>
      </svg>
      <span>Import JSON</span>
    `;
    button.title = 'Import data from JSON format';
    
    button.addEventListener('click', showJsonInputModal);
    
    return button;
  }

  /**
   * Shows modal to paste BibTeX
   */
  function showBibtexInputModal(prefill = '') {
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

    const textarea = modal.querySelector('#bibtex-input');
    if (prefill && /@\w+\s*\{/.test(prefill)) {
      // Only prefill when the clipboard looks like BibTeX — avoids dumping
      // unrelated clipboard contents into the textarea.
      textarea.value = prefill;
    }

    modal.querySelector('.bibtex-modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('#bibtex-cancel').addEventListener('click', () => modal.remove());
    modal.querySelector('#bibtex-import').addEventListener('click', () => {
      const text = textarea.value;
      modal.remove();
      processBibtexInput(text);
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    setTimeout(() => {
      textarea.focus();
      // If we prefilled, select all so the user can immediately replace it
      // with Ctrl+V if it's the wrong entry.
      if (textarea.value) textarea.select();
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
   * Find the toolbar (button row at the bottom of a form) inside `root`.
   * Specify uses either `[role="toolbar"]` (standalone forms) or a flex
   * container ending in `justify-end` (modal dialogs). When root is the
   * document, the toolbar must NOT live inside a dialog — that would be
   * the modal's toolbar, not the main form's.
   */
  function findToolbar(root) {
    return scopedFirst(root, '[role="toolbar"]') ||
           scopedFirst(root, '.flex.gap-2.justify-end');
  }

  /**
   * Inject import buttons into a single context (either the main document or
   * a dialog modal). All existence checks and toolbar lookups are scoped to
   * `root` so opening a Reference Work modal on top of a Collection Object
   * page doesn't get confused by the buttons that already exist on the COD.
   */
  function addButtonsToContext(root) {
    if (!root) return;

    const isRefForm = isSpecifyReferenceForm(root);
    const isColForm = isSpecifyCollectionObjectForm(root);

    const buttonContainer = findToolbar(root);
    const hasInputs = scopedAll(root, 'input:not([type="submit"]):not([type="button"]), textarea, select').length > 0;
    const isAnyForm = buttonContainer && hasInputs;

    if (!isRefForm && !isColForm && !isAnyForm) return;

    // Remove any stale buttons that don't belong in this context. Earlier
    // versions of addButtonsToForm could mis-inject when a Reference Work
    // modal was open on top of a Collection Object form, leaving BibTeX
    // and DOI buttons behind in the COD toolbar after the modal closed.
    if (isColForm && !isRefForm) {
      scopedAll(root, '.bibtex-import-button:not(.clipboard-import-button)').forEach(b => b.remove());
      scopedAll(root, '.doi-import-button').forEach(b => b.remove());
    } else if (isRefForm && !isColForm) {
      scopedAll(root, '.clipboard-import-button').forEach(b => b.remove());
      scopedAll(root, '.json-import-button').forEach(b => b.remove());
    }

    // Existence checks must be scoped — otherwise an "already present" button
    // in a dialog blocks injection into the main form (or vice versa).
    const hasBtn = (sel) => !!scopedFirst(root, sel);

    if (isRefForm) {
      // Reference Work only gets BibTeX + DOI — JSON import is for the
      // generic Collection Object workflow.
      const bibtexMissing = !hasBtn('.bibtex-import-button:not(.clipboard-import-button)') && enabledFeatures.bibtex !== false;
      const doiMissing = !hasBtn('.doi-import-button') && enabledFeatures.doi !== false;

      if (buttonContainer) {
        const firstButton = buttonContainer.querySelector('button, input[type="submit"]');
        if (bibtexMissing) buttonContainer.insertBefore(createBibtexButton(), firstButton || null);
        if (doiMissing) buttonContainer.insertBefore(createDoiButton(), firstButton || null);
      } else if (bibtexMissing || doiMissing) {
        injectReferenceFormButtonsFallback(root);
      }
    } else if (isColForm) {
      const clipboardMissing = !hasBtn('.clipboard-import-button');
      const jsonMissing = !hasBtn('.json-import-button') && enabledFeatures.json !== false;

      if (buttonContainer) {
        const firstButton = buttonContainer.querySelector('button, input[type="submit"]');
        if (clipboardMissing) buttonContainer.insertBefore(createClipboardImportButton(), firstButton || null);
        if (jsonMissing) buttonContainer.insertBefore(createJsonButton(), firstButton || null);
      } else {
        if (clipboardMissing) injectButtonAtTop(createClipboardImportButton());
        if (jsonMissing) injectButtonAtTop(createJsonButton());
      }
    }
    // Note: we used to inject the JSON button into any unrecognized form, but
    // that bled JSON imports into Locality / Author / Reference Work dialogs.
    // JSON + Clipboard are scoped to the Collection Object workflow only.
  }

  /**
   * Adds buttons to every form context on the page — the main document and
   * each `[role="dialog"]` separately. Each context is treated independently
   * so a Reference Work modal opened on top of a Collection Object form gets
   * its own set of import buttons even though the COD form already has some.
   */
  function addButtonsToForm() {
    addButtonsToContext(document);
    document.querySelectorAll('[role="dialog"]').forEach(addButtonsToContext);
  }

  /**
   * Fallback injection for Reference Work forms when no toolbar is found yet.
   * Inserts buttons at the top of the form container scoped to `root`.
   */
  function injectReferenceFormButtonsFallback(root = document) {
    const anchor = root.querySelector('select[name="ReferenceWorkType"]') ||
                   root.querySelector('input[name="title"]');
    if (!anchor) return;

    const formContainer = anchor.closest('[role="dialog"]') ||
                          anchor.closest('form') ||
                          anchor.closest('.grid') ||
                          anchor.closest('section') ||
                          anchor.parentElement?.parentElement;
    if (!formContainer) return;

    if (formContainer.querySelector('.specify7plus-btn-fallback')) return;

    const btnWrapper = document.createElement('div');
    btnWrapper.className = 'specify7plus-btn-fallback';
    btnWrapper.style.cssText = 'display:flex;justify-content:flex-end;padding:6px 0 10px;gap:8px;flex-wrap:wrap;';

    if (!formContainer.querySelector('.bibtex-import-button:not(.clipboard-import-button)') && enabledFeatures.bibtex !== false) {
      btnWrapper.appendChild(createBibtexButton());
    }
    if (!formContainer.querySelector('.doi-import-button') && enabledFeatures.doi !== false) {
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
        const isRef = isSpecifyReferenceForm();
        const isCol = isSpecifyCollectionObjectForm();
        const buttonContainer = document.querySelector('.flex.gap-2.justify-end') || document.querySelector('[role="toolbar"]');
        const hasInputs = document.querySelectorAll('input:not([type="submit"]):not([type="button"]), textarea, select').length > 0;
        
        if (isRef || isCol || (buttonContainer && hasInputs)) {
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
    const isRef = isSpecifyReferenceForm();
    const isCol = isSpecifyCollectionObjectForm();
    const buttonContainer = document.querySelector('.flex.gap-2.justify-end') || document.querySelector('[role="toolbar"]');
    const hasInputs = document.querySelectorAll('input:not([type="submit"]):not([type="button"]), textarea, select').length > 0;

    // Check if the form is already there
    if (isRef || isCol || (buttonContainer && hasInputs)) {
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

(function(App) {
  'use strict';

  App.flattenObject = function(obj, prefix = '') {
    let result = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const newKey = prefix ? `${prefix}_${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          Object.assign(result, App.flattenObject(obj[key], newKey));
        } else {
          result[newKey] = obj[key];
        }
      }
    }
    return result;
  };

  App.processJsonInput = async function(jsonText) {
    if (!jsonText || !jsonText.trim()) {
      App.showMessage('JSON input is empty', 'warning');
      return;
    }

    let rawData;
    try {
      rawData = JSON.parse(jsonText);
    } catch (e) {
      console.error('Specify7+: Failed to parse JSON:', e);
      App.showMessage('Invalid JSON format: ' + e.message, 'error');
      return;
    }

    if (typeof rawData !== 'object' || rawData === null) {
      App.showMessage('JSON must be an object or array of objects', 'error');
      return;
    }

    const data = Array.isArray(rawData) ? rawData[0] : rawData;
    if (typeof data !== 'object' || data === null) {
      App.showMessage('JSON data is empty or invalid', 'error');
      return;
    }

    const flatData = App.flattenObject(data);
    const keys = Object.keys(flatData);

    if (keys.length === 0) {
      App.showMessage('No keys found in JSON object', 'warning');
      return;
    }

    // 1. Clear previous captured data to avoid mixing old data with the new JSON data
    App.lastCapturedData = {};
    if (App.isExtensionContextValid() && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ lastCapturedSpecimen: {} });
    }

    App.showMessage('Mapping JSON data...', 'info');

    // 2. Automatically expand collapsed fieldsets/sections
    await App.expandCollapsibleSections();

    // 3. Pre-create rows in subforms that need an "Add" click before any input
    //    is available. Only trigger when the JSON actually has a non-empty
    //    value for one of the relevant keys — otherwise we'd open empty rows
    //    for keys present as null (e.g. {"collector": null}).
    const norm = s => App.normalizeString(s);
    const hasNonEmpty = (set) => keys.some(k => set.includes(norm(k)) && flatData[k] != null && flatData[k] !== '');
    const hasOtherIdKeys = hasNonEmpty(['altcatalognumber', 'institution', 'collection', 'otherid', 'otheridentifier', 'altcatalogo', 'institucion', 'coleccion', 'otroidentificador']);
    const hasDeterminationKeys = hasNonEmpty(['taxon', 'taxon', 'taxón', 'genus', 'genero', 'género', 'species', 'especie', 'determination', 'determinations', 'preferredtaxon', 'scientificname', 'nombrecientifico', 'nombrecientífico']);
    const hasGeoContextKeys = hasNonEmpty(['stratigraphy', 'formation', 'member', 'lithostratigraphy', 'biostratigraphy', 'chronostratigraphy', 'geologicalage', 'age', 'period', 'epoch', 'era', 'estratigrafia', 'formacion', 'miembro', 'litoestratigrafia', 'bioestratigrafia', 'cronoestratigrafia', 'edadgeologica', 'edad', 'periodo', 'epoca', 'bed', 'camada', 'landmammalage', 'faunalzone', 'systemperiod', 'seriesepoch']);
    const hasCollectingEventKeys = hasNonEmpty(['collector', 'collectors', 'collectiondate', 'startdate', 'enddate', 'verbatimdate', 'date', 'locality', 'localityname', 'colector', 'colectores', 'fechadecolecta', 'localidad']);

    if (hasOtherIdKeys) await App.ensureSubformRowFor(/Other Identifiers|Otros identificadores/i);
    if (hasDeterminationKeys) await App.ensureSubformRowFor(/Determinations?|Determinaciones?/i);
    if (hasGeoContextKeys) await App.ensureSubformRowFor(/Paleo\s*Context|Geological\s*Context|Contexto\s*Geol[oó]gico|Stratigraph|Estratigraf/i);
    if (hasCollectingEventKeys) await App.ensureSubformRowFor(/Collecting\s*Event|Evento\s*de\s*Colecta/i);

    // Get all supported inputs in the form (now updated with newly expanded/added inputs)
    const inputs = Array.from(document.querySelectorAll('input:not([type="submit"]):not([type="button"]), textarea, select'));
    
    const inputsWithLabels = inputs.map(input => {
      return {
        input,
        labelText: App.getInputLabelText(input)
      };
    });

    const candidates = [];
    const threshold = 1.5;

    for (const key of keys) {
      const val = flatData[key];
      if (val === undefined || val === null || val === '') continue;

      for (const entry of inputsWithLabels) {
        const score = App.getMatchScore(entry.input, key, entry.labelText);
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
      return App.keyPriority(a.key) - App.keyPriority(b.key);
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
        await App.setSafeValue(cand.input, strValue);
        fillCount++;

        if (App.isTreePickInput(cand.input)) {
          App.watchTreeFieldClearing(cand.input, strValue);
        }
      } catch (err) {
        console.error('Specify7+: Error setting value for key', cand.key, err);
      }
    }

    // 4. Save the new JSON data to lastCapturedData and local storage so individual paste buttons can use it
    for (const key in flatData) {
      App.lastCapturedData[key] = flatData[key];
    }
    if (App.isExtensionContextValid() && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ lastCapturedSpecimen: App.lastCapturedData });
    }

    // Remove old paste buttons and re-evaluate so the new JSON values show up next to matched fields
    document.querySelectorAll('.field-paste-btn').forEach(b => b.remove());
    document.querySelectorAll('[data-has-paste-btn]').forEach(i => delete i.dataset.hasPasteBtn);

    if (fillCount > 0) {
      App.showMessage(`Successfully imported ${fillCount} fields!`, 'success');
      App.addPasteButtonsToAllFields();
    } else {
      App.showMessage('No fields could be mapped from the JSON.', 'warning');
    }
  };

  App.showJsonInputModal = function() {
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
            placeholder='Paste your JSON object here...\\n\\nExample:\\n{\\n  "catalogNumber": "12345",\\n  "taxon": "Canis lupus",\\n  "remarks": "Sample description"\\n}'
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
      App.processJsonInput(text);
    });
    
    // Close when clicking outside the modal, avoiding closure when text selection ends outside the modal
    let isClickOutside = false;
    modal.addEventListener('mousedown', (e) => {
      isClickOutside = (e.target === modal);
    });
    modal.addEventListener('mouseup', (e) => {
      if (isClickOutside && e.target === modal) {
        modal.remove();
      }
    });
    
    // Focus on the textarea
    setTimeout(() => {
      modal.querySelector('#json-input').focus();
    }, 100);
  };

  App.createJsonButton = function() {
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
    
    button.addEventListener('click', App.showJsonInputModal);
    
    return button;
  };

})(window.Specify7Plus = window.Specify7Plus || {});

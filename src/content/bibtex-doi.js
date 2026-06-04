(function(App) {
  'use strict';

  App.createBibtexButton = function() {
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
    button.addEventListener('click', App.handleBibtexImport);
    return button;
  };

  App.createDoiButton = function() {
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
    button.addEventListener('click', App.showDoiInputModal);
    return button;
  };

  App.handleBibtexImport = async function() {
    let clipboardText = '';
    try {
      clipboardText = await navigator.clipboard.readText();
    } catch (error) {
      console.log('Specify7+: Could not read clipboard for BibTeX prefill:', error);
    }
    App.showBibtexInputModal(clipboardText);
  };

  App.processBibtexInput = function(bibtexText) {
    try {
      const entries = BibtexParser.parse(bibtexText);
      if (entries.length === 0) {
        App.showMessage('No valid BibTeX entries found', 'error');
        return;
      }
      if (entries.length > 1) {
        App.showMessage(`Found ${entries.length} entries. Importing the first one.`, 'info');
      }
      const specifyData = BibtexParser.toSpecifyFormat(entries[0]);
      App.fillForm(specifyData);
      App.showMessage('BibTeX imported successfully!', 'success');
    } catch (error) {
      console.error('Error processing BibTeX:', error);
      App.showMessage('Error processing BibTeX: ' + error.message, 'error');
    }
  };

  App.showDoiInputModal = async function() {
    let prefill = '';
    try {
      const clip = (await navigator.clipboard.readText()).trim();
      const doiMatch = clip.match(/(?:https?:\/\/(?:dx\.)?doi\.org\/)?(10\.\d{4,9}\/\S+)/i);
      if (doiMatch) prefill = doiMatch[1];
    } catch (e) {
      // No clipboard access
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
        App.showMessage('Please enter a DOI', 'warning');
        return;
      }
      await App.fetchDoiAndFill(doi);
    });

    let isClickOutside = false;
    modal.addEventListener('mousedown', (e) => {
      isClickOutside = (e.target === modal);
    });
    modal.addEventListener('mouseup', (e) => {
      if (isClickOutside && e.target === modal) {
        modal.remove();
      }
    });
    setTimeout(() => {
      input.focus();
      if (input.value) input.select();
    }, 100);
  };

  App.fetchDoiAndFill = async function(doi) {
    try {
      App.showMessage('Fetching metadata for DOI...', 'info');
      const url = `https://api.crossref.org/works/${encodeURIComponent(doi)}`;
      const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!resp.ok) throw new Error(`CrossRef returned ${resp.status}`);
      const json = await resp.json();
      const item = json.message;

      const specifyData = {
        type: App.mapCrossrefType(item.type),
        title: (item.title && item.title[0]) || '',
        publisher: item.publisher || '',
        placeOfPublication: (item['publisher-location']) || '',
        workDate: (item.issued && item.issued['date-parts'] && item.issued['date-parts'][0] && item.issued['date-parts'][0][0]) || '',
        volume: item.volume || '',
        pages: item.page || '',
        journal: (item['container-title'] && item['container-title'][0]) || '',
        libraryNumber: item.DOI || item.ISBN && item.ISBN[0] || '',
        authors: App.parseCrossrefAuthors(item.author || [])
      };

      App.fillForm(specifyData);
      App.showMessage('Metadata imported from DOI', 'success');
    } catch (err) {
      console.error('Error fetching DOI metadata:', err);
      App.showMessage('Error fetching DOI metadata: ' + err.message, 'error');
    }
  };

  App.mapCrossrefType = function(crossrefType) {
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
  };

  App.parseCrossrefAuthors = function(authors) {
    if (!Array.isArray(authors)) return [];
    return authors.map((a, i) => ({
      orderNumber: i,
      firstName: (a.given || ''),
      lastName: (a.family || a.name || '')
    }));
  };

  App.fillForm = async function(data) {
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
      await App.sleep(100);
    }

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
          await App.setSafeValue(input, value);
        }
      }
    }

    if (data.journal) {
      const journalInput = document.querySelector('input[role="combobox"][title*="Journal"]') ||
                           document.querySelector('input[role="combobox"][title*="journal"]');
      if (journalInput) {
        await App.setSafeValue(journalInput, data.journal);
        App.watchTreeFieldClearing(journalInput, data.journal);
      }
    }

    if (data.authors && data.authors.length > 0) {
      console.log('Authors to import:', data.authors);
      App.addAuthorsToForm(data.authors).then((added) => {
        const existing = App.countExistingAuthors();
        if (added > 0) {
          App.showMessage(`Added ${added} author field(s). Total: ${existing}. Please create/select agents when prompted.`, 'info');
        } else if (existing > 0) {
          App.showMessage(`Using ${existing} existing author field(s). Please verify and create/select agents.`, 'info');
        } else {
          App.showMessage(`Note: Authors (${data.authors.length}) must be added manually.`, 'info');
        }
      }).catch((err) => {
        console.error('Error inserting authors:', err);
        App.showMessage('Could not insert authors automatically', 'warning');
      });
    }
  };

  App.showBibtexInputModal = function(prefill = '') {
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
      textarea.value = prefill;
    }

    modal.querySelector('.bibtex-modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('#bibtex-cancel').addEventListener('click', () => modal.remove());
    modal.querySelector('#bibtex-import').addEventListener('click', () => {
      const text = textarea.value;
      modal.remove();
      App.processBibtexInput(text);
    });

    let isClickOutside = false;
    modal.addEventListener('mousedown', (e) => {
      isClickOutside = (e.target === modal);
    });
    modal.addEventListener('mouseup', (e) => {
      if (isClickOutside && e.target === modal) {
        modal.remove();
      }
    });

    setTimeout(() => {
      textarea.focus();
      if (textarea.value) textarea.select();
    }, 100);
  };

  App.countExistingAuthors = function() {
    const fieldsets = Array.from(document.querySelectorAll('fieldset'));
    const authorsFs = fieldsets.find(fs => {
      const h3 = fs.querySelector('h3');
      return h3 && /Authors\b/i.test(h3.textContent);
    });
    if (!authorsFs) return 0;

    const rows = authorsFs.querySelectorAll('[role="row"]');
    const headerRows = Array.from(rows).filter(r => r.querySelector('[role="columnheader"]'));
    return Math.max(0, rows.length - headerRows.length);
  };

  App.addAuthorsToForm = async function(authors) {
    if (!Array.isArray(authors) || authors.length === 0) return 0;

    const existingCount = App.countExistingAuthors();
    const neededCount = authors.length;
    const toAdd = neededCount - existingCount;

    console.log(`Authors: ${neededCount} needed, ${existingCount} existing, ${toAdd} to add`);

    if (toAdd <= 0) {
      await App.fillExistingAuthorFields(authors);
      return 0;
    }

    const fieldsets = Array.from(document.querySelectorAll('fieldset'));
    const authorsFs = fieldsets.find(fs => {
      const h3 = fs.querySelector('h3');
      return h3 && /Authors\b/i.test(h3.textContent);
    });
    if (!authorsFs) return 0;

    let addBtn = Array.from(authorsFs.querySelectorAll('button')).find(b => {
      const title = (b.getAttribute('title') || '') + ' ' + (b.getAttribute('aria-label') || '');
      return /add|añad|añadir/i.test(title) && !b.disabled;
    });

    if (!addBtn) return 0;

    let inserted = 0;
    for (let i = 0; i < toAdd; i++) {
      try {
        addBtn.click();
        inserted++;
        await App.sleep(300);
      } catch (err) {
        console.error('Error while adding author row:', err);
      }
    }

    if (inserted > 0) {
      await App.sleep(200);
      await App.fillExistingAuthorFields(authors);
    }

    return inserted;
  };

  App.fillExistingAuthorFields = async function(authors) {
    App.initAgentDialogWatcher();

    const fieldsets = Array.from(document.querySelectorAll('fieldset'));
    const authorsFs = fieldsets.find(fs => {
      const h3 = fs.querySelector('h3');
      return h3 && /Authors\b/i.test(h3.textContent);
    });
    if (!authorsFs) return;

    const comboboxes = Array.from(authorsFs.querySelectorAll('input[role="combobox"]'));

    for (let i = 0; i < Math.min(comboboxes.length, authors.length); i++) {
      const input = comboboxes[i];
      const author = authors[i];

      const last = author.lastName || '';
      const first = author.firstName || '';
      const display = last && first ? `${last}, ${first}` : (last || first);

      if (display && input) {
        await App.setSafeValue(input, display);
        App.rememberAuthorIntent(author, display);
        App.watchTreeFieldClearing(input, display);
      }
    }
  };

  App.rememberAuthorIntent = function(author, typedString) {
    if (!author || (!author.firstName && !author.lastName)) return;
    App.pendingAuthorIntents.push({
      author,
      typedString: (typedString || '').trim(),
      timestamp: Date.now()
    });
    const cutoff = Date.now() - (5 * 60 * 1000); // 5 min TTL
    while (App.pendingAuthorIntents.length && App.pendingAuthorIntents[0].timestamp < cutoff) {
      App.pendingAuthorIntents.shift();
    }
  };

  App.consumePendingAuthorMatch = function(dialogLastName) {
    if (!App.pendingAuthorIntents.length) return null;
    const target = (dialogLastName || '').trim();
    if (!target) return null;

    const idx = App.pendingAuthorIntents.findIndex(p => {
      if (p.typedString && p.typedString === target) return true;
      if (p.author.lastName && p.author.lastName === target) return true;
      if (p.author.lastName && target.startsWith(p.author.lastName + ',')) return true;
      return false;
    });
    if (idx === -1) return null;

    const [match] = App.pendingAuthorIntents.splice(idx, 1);
    return match.author;
  };

  App.initAgentDialogWatcher = function() {
    if (App.agentDialogObserver) return;
    App.agentDialogObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          const dialogs = node.matches && node.matches('[role="dialog"]')
            ? [node]
            : Array.from(node.querySelectorAll ? node.querySelectorAll('[role="dialog"]') : []);
          for (const dialog of dialogs) {
            App.maybeFillAgentDialog(dialog);
          }
        }
      }
    });
    App.agentDialogObserver.observe(document.body, { childList: true, subtree: true });
  };

  App.maybeFillAgentDialog = async function(dialog) {
    if (dialog._specify7plusAgentFilled) return;

    let lastInput = null;
    let firstInput = null;
    for (let i = 0; i < 25; i++) {
      lastInput = dialog.querySelector('input[name="lastName"]');
      firstInput = dialog.querySelector('input[name="firstName"]');
      if (lastInput && firstInput) break;
      await App.sleep(80);
    }
    if (!lastInput || !firstInput) return;

    let prefilled = '';
    for (let i = 0; i < 25; i++) {
      prefilled = (lastInput.value || '').trim();
      if (prefilled) break;
      await App.sleep(80);
    }

    const author = App.consumePendingAuthorMatch(prefilled);
    if (!author) return;

    dialog._specify7plusAgentFilled = true;

    const typeSelect = dialog.querySelector('select[name="_AgentTypeComboBox"]');
    if (typeSelect) {
      const personOpt = Array.from(typeSelect.options).find(o => /^person|persona/i.test(o.text.trim()));
      if (personOpt && typeSelect.value !== personOpt.value) {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
        nativeSetter.call(typeSelect, personOpt.value);
        typeSelect.dispatchEvent(new Event('input', { bubbles: true }));
        typeSelect.dispatchEvent(new Event('change', { bubbles: true }));
        await App.sleep(150);
      }
    }

    if (author.lastName) {
      await App.setSafeValue(lastInput, author.lastName);
    }
    if (author.firstName) {
      const firstParts = author.firstName.trim().split(/\s+/);
      const firstName = firstParts[0];
      const middle = firstParts.slice(1).join(' ');

      await App.setSafeValue(firstInput, firstName);

      const middleInput = dialog.querySelector('input[name="middleInitial"]');
      if (middleInput && middle) {
        const initials = middle
          .split(/\s+/)
          .map(p => p[0] ? p[0].toUpperCase() + '.' : '')
          .filter(Boolean)
          .join(' ');
        if (initials) await App.setSafeValue(middleInput, initials);
      }
    }
  };

})(window.Specify7Plus = window.Specify7Plus || {});

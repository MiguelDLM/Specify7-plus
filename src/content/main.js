(function(App) {
  'use strict';

  App.isSpecifyReferenceForm = function(root = document) {
    // The query builder can contain the same field names (title/publisher/
    // ReferenceWorkType) as search criteria — never treat a query page as a
    // data-entry form, or the import buttons leak into the query toolbar.
    if (App.isSpecifyQueryPage()) return false;

    const modalHeader = App.scopedAll(root, 'h2[id*="modal"][id*="header"]')
      .find(h => h.textContent.includes('Reference Work'));
    if (modalHeader) return true;

    const dialogHeader = App.scopedAll(root, 'h2')
      .find(h => /Reference Work/i.test(h.textContent));
    if (dialogHeader) return true;

    // Require the full trio of data-entry fields together. A lone title/
    // publisher input shows up in other contexts; all three only co-occur on the
    // actual Reference Work form.
    const titleField = App.scopedFirst(root, 'input[name="title"]');
    const publisherField = App.scopedFirst(root, 'input[name="publisher"]');
    const typeSelect = App.scopedFirst(root, 'select[name="ReferenceWorkType"]');

    return !!(titleField && publisherField && typeSelect);
  };

  App.isSpecifyCollectionObjectForm = function(root = document) {
    // Only the Collection Object data-entry form should get the Import JSON
    // button. Query pages carry a catalogNumber filter input and list/tree
    // views can show a "Collection Object" heading, so neither signal alone is
    // enough — exclude query pages and require an actual catalogNumber field.
    if (App.isSpecifyQueryPage()) return false;

    const catNumField = App.scopedFirst(root, 'input[name="catalogNumber"]');
    return !!catNumField;
  };

  App.findToolbar = function(root) {
    return App.scopedFirst(root, '[role="toolbar"]') ||
           App.scopedFirst(root, '.flex.gap-2.justify-end');
  };

  App.watchTreeFieldClearing = function(input, value) {
    if (!input || !value) return;
    input.dataset.pendingTreeValue = value;

    if (input._specify7plusTreeWatched) return;
    input._specify7plusTreeWatched = true;

    let badge = null;

    const refill = async () => {
      await App.setSafeValue(input, value);
      await App.sleep(400);
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
  };

  App.injectReferenceFormButtonsFallback = function(root = document) {
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

    if (!formContainer.querySelector('.bibtex-import-button:not(.clipboard-import-button)') && App.enabledFeatures.bibtex !== false) {
      btnWrapper.appendChild(App.createBibtexButton());
    }
    if (!formContainer.querySelector('.doi-import-button') && App.enabledFeatures.doi !== false) {
      btnWrapper.appendChild(App.createDoiButton());
    }

    if (btnWrapper.children.length > 0) {
      formContainer.insertBefore(btnWrapper, formContainer.firstChild);
    }
  };

  App.injectButtonAtTop = function(button) {
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
  };

  App.addButtonsToContext = function(root) {
    if (!root) return;

    const isRefForm = App.isSpecifyReferenceForm(root);
    const isColForm = App.isSpecifyCollectionObjectForm(root);

    const buttonContainer = App.findToolbar(root);
    const hasInputs = App.scopedAll(root, 'input:not([type="submit"]):not([type="button"]), textarea, select').length > 0;
    const isAnyForm = buttonContainer && hasInputs;

    if (!isRefForm && !isColForm && !isAnyForm) return;

    // Remove any stale buttons
    if (isColForm && !isRefForm) {
      App.scopedAll(root, '.bibtex-import-button:not(.clipboard-import-button)').forEach(b => b.remove());
      App.scopedAll(root, '.doi-import-button').forEach(b => b.remove());
      App.scopedAll(root, '.clipboard-import-button').forEach(b => b.remove());
    } else if (isRefForm && !isColForm) {
      App.scopedAll(root, '.clipboard-import-button').forEach(b => b.remove());
      App.scopedAll(root, '.json-import-button').forEach(b => b.remove());
    }

    const hasBtn = (sel) => !!App.scopedFirst(root, sel);

    if (isRefForm) {
      const bibtexMissing = !hasBtn('.bibtex-import-button:not(.clipboard-import-button)') && App.enabledFeatures.bibtex !== false;
      const doiMissing = !hasBtn('.doi-import-button') && App.enabledFeatures.doi !== false;

      if (buttonContainer) {
        const firstButton = buttonContainer.querySelector('button, input[type="submit"]');
        if (bibtexMissing) buttonContainer.insertBefore(App.createBibtexButton(), firstButton || null);
        if (doiMissing) buttonContainer.insertBefore(App.createDoiButton(), firstButton || null);
      } else if (bibtexMissing || doiMissing) {
        App.injectReferenceFormButtonsFallback(root);
      }
    } else if (isColForm) {
      const jsonMissing = !hasBtn('.json-import-button') && App.enabledFeatures.json !== false;

      if (buttonContainer) {
        const firstButton = buttonContainer.querySelector('button, input[type="submit"]');
        if (jsonMissing) buttonContainer.insertBefore(App.createJsonButton(), firstButton || null);
      } else {
        if (jsonMissing) App.injectButtonAtTop(App.createJsonButton());
      }
    }
  };

  App.addButtonsToForm = function() {
    App.addButtonsToContext(document);
    document.querySelectorAll('[role="dialog"]').forEach(App.addButtonsToContext);
  };

  App.observeFormChanges = function() {
    let debounceTimer = null;

    const observer = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const isRef = App.isSpecifyReferenceForm();
        const isCol = App.isSpecifyCollectionObjectForm();
        const buttonContainer = document.querySelector('.flex.gap-2.justify-end') || document.querySelector('[role="toolbar"]');
        const hasInputs = document.querySelectorAll('input:not([type="submit"]):not([type="button"]), textarea, select').length > 0;
        
        if (isRef || isCol || (buttonContainer && hasInputs)) {
          App.addButtonsToForm();
          App.addPasteButtonsToAllFields();
        }
      }, 200);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  };

  App.loadFeatureStates = function() {
    if (App.isExtensionContextValid() && chrome.storage) {
      // Load enabled features
      if (chrome.storage.sync) {
        chrome.storage.sync.get(['enabledFeatures'], (result) => {
          if (result && result.enabledFeatures) {
            App.enabledFeatures = result.enabledFeatures;
            console.log('Specify7+: Feature states loaded', App.enabledFeatures);
          }
        });
      }

      // Load last captured specimen data
      if (chrome.storage.local) {
        chrome.storage.local.get(['lastCapturedSpecimen'], (result) => {
          if (result && result.lastCapturedSpecimen) {
            App.lastCapturedData = result.lastCapturedSpecimen;
            // Refresh buttons if form is already open
            if (App.isSpecifyCollectionObjectForm()) {
              App.addPasteButtonsToAllFields();
            }
          }
        });

        // Listen for updates from other tabs
        chrome.storage.onChanged.addListener((changes, area) => {
          if (area === 'local' && changes.lastCapturedSpecimen) {
            App.lastCapturedData = changes.lastCapturedSpecimen.newValue;
            if (App.isSpecifyCollectionObjectForm()) {
              // Remove old buttons and add new ones based on new data
              document.querySelectorAll('.field-paste-btn').forEach(b => b.remove());
              document.querySelectorAll('[data-has-paste-btn]').forEach(i => delete i.dataset.hasPasteBtn);
              App.addPasteButtonsToAllFields();
            }
          }
        });
      }
    }
  };

  App.init = function() {
    const isRef = App.isSpecifyReferenceForm();
    const isCol = App.isSpecifyCollectionObjectForm();
    const buttonContainer = document.querySelector('.flex.gap-2.justify-end') || document.querySelector('[role="toolbar"]');
    const hasInputs = document.querySelectorAll('input:not([type="submit"]):not([type="button"]), textarea, select').length > 0;

    // Check if the form is already there
    if (isRef || isCol || (buttonContainer && hasInputs)) {
      App.addButtonsToForm();
      App.addPasteButtonsToAllFields();
    }
    
    // Observe changes
    App.observeFormChanges();
    
    // Intercept 3D model links
    App.intercept3DModelLinks();

    // Add Select All button to query pages
    if (App.isSpecifyQueryPage()) {
      App.addSelectAllButton();
      App.observeQueryPage();
    }
  };

  // Only initialize the extension if we are on a Specify 7 page
  if (!App.isSpecify7Page()) {
    console.log('Specify7+: Not a Specify 7 page, skipping initialization.');
    return;
  }

  console.log('Specify7+: Extension loaded');

  // Load features on startup
  App.loadFeatureStates();

  // Wait for the DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', App.init);
  } else {
    App.init();
  }

})(window.Specify7Plus = window.Specify7Plus || {});

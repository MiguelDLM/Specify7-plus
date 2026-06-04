(function(App) {
  'use strict';

  /**
   * Intercepts clicks on 3D model links (.stl, .obj, .gltf, .glb, .ply files)
   * and opens them in the custom 3D viewer instead of downloading
   */
  App.intercept3DModelLinks = function() {
    // Only intercept if 3D viewer feature is enabled
    if (App.enabledFeatures.viewer3d === false) {
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

      if (!App.isExtensionContextValid()) {
        App.showMessage('Specify7+ was updated or reloaded. Please refresh this page to open the 3D viewer.', 'warning');
        return;
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
  };

})(window.Specify7Plus = window.Specify7Plus || {});

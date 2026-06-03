/**
 * MorphoSource Content Script
 * Scrapes specimen data and media links to send to Specify 7
 */

(function() {
  'use strict';
  
  console.log('Specify7+: MorphoSource script loaded');

  // Utility to find text by labels in different formats
  function getFieldByLabel(labelText) {
    const isPlaceholder = (val) => !val || val === '--' || val === 'unknown';

    // 1. Try MorphoSource grid format (.showcase-label / .showcase-value)
    const showcaseLabels = Array.from(document.querySelectorAll('.showcase-label'));
    const matchingLabels = showcaseLabels.filter(el => el.textContent.trim().toLowerCase().includes(labelText.toLowerCase()));
    
    for (const labelEl of matchingLabels) {
      const valueEl = labelEl.nextElementSibling;
      if (valueEl && valueEl.classList.contains('showcase-value')) {
        const val = valueEl.textContent.trim();
        if (!isPlaceholder(val)) return val;
      }
    }

    // 2. Try standard dl/dt/dd format
    const dts = Array.from(document.querySelectorAll('dt'));
    const matchingDts = dts.filter(el => el.textContent.trim().toLowerCase().includes(labelText.toLowerCase()));
    
    for (const dt of matchingDts) {
      const dd = dt.nextElementSibling;
      if (dd && dd.tagName === 'DD') {
        const val = dd.textContent.trim();
        if (!isPlaceholder(val)) return val;
      }
    }

    // 3. Try bold tags (like MorphoMuseum)
    const bTags = Array.from(document.querySelectorAll('b'));
    const matchingBTags = bTags.filter(b => b.textContent.trim().toLowerCase().includes(labelText.toLowerCase()));
    
    for (const b of matchingBTags) {
      let nextNode = b.nextSibling;
      while (nextNode) {
        if (nextNode.nodeType === Node.TEXT_NODE) {
          const text = nextNode.textContent.trim();
          if (text && /[a-zA-Z0-9]/.test(text) && !isPlaceholder(text)) return text;
        } else if (nextNode.nodeType === Node.ELEMENT_NODE) {
          if (nextNode.tagName === 'A' || nextNode.tagName === 'I') {
            const val = nextNode.textContent.trim();
            if (!isPlaceholder(val)) return val;
          }
          if (nextNode.tagName === 'BR') break;
        }
        nextNode = nextNode.nextSibling;
      }
    }

    return '';
  }

  function extractMorphoSourceData() {
    const data = {};
    
    // Capture COMPLETE "Object represented" or "Catalog number"
    data.inventoryNumber = getFieldByLabel('Object represented') || getFieldByLabel('Catalog number');
    
    // Object organization -> Institution
    data.collection = getFieldByLabel('Object organization') || getFieldByLabel('Institution code');
    
    // Creator -> Prepared By (Try multiple labels)
    data.creator = getFieldByLabel('Creator') || getFieldByLabel('Contributor') || getFieldByLabel('Media creator');
    
    // Date created -> Prepared Date
    data.dateCreated = getFieldByLabel('Date created') || getFieldByLabel('Date uploaded');

    // Taxonomy
    let fullTaxon = getFieldByLabel('Object taxonomy');
    if (!fullTaxon) {
      const taxonomyHeader = Array.from(document.querySelectorAll('h3, h2')).find(h => h.textContent.includes('TAXONOMY'));
      if (taxonomyHeader) {
        let current = taxonomyHeader.nextElementSibling;
        while (current && !['H2', 'H3'].includes(current.tagName)) {
          if (current.tagName === 'DL') {
            const userSuppliedDt = Array.from(current.querySelectorAll('dt')).find(dt => dt.textContent.includes('User Supplied'));
            if (userSuppliedDt) {
              const userSuppliedDd = userSuppliedDt.nextElementSibling;
              if (userSuppliedDd) {
                fullTaxon = userSuppliedDd.textContent.trim();
                break;
              }
            }
          }
          current = current.nextElementSibling;
        }
      }
    }

    if (fullTaxon) {
      const parts = fullTaxon.split(' ');
      data.genus = parts[0] || '';
      data.species = parts.slice(1).join(' ') || '';
    }

    // Locality
    data.origin = getFieldByLabel('Locality');

    // Media Link
    const downloadBtn = document.querySelector('a[href*="/download"], button[title*="Download"], .btn-download');
    if (downloadBtn) {
      data.modelUrl = downloadBtn.href || '';
    }

    // Description
    const description = document.querySelector('.work-description, .media-description, .description-content');
    if (description) {
      data.description = description.textContent.trim();
    }

    data.source = 'MorphoSource';
    data.url = window.location.href;

    return data;
  }

  function createFloatingButton() {
    const button = document.createElement('button');
    button.textContent = 'Copy Specimen Data';
    button.id = 'specify7-capture-btn';
    button.title = 'Copy data to clipboard for Specify 7';
    
    // Style the button
    Object.assign(button.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      padding: '12px 20px',
      backgroundColor: '#059669', 
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      cursor: 'pointer',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '14px',
      fontWeight: '600',
      zIndex: '9999',
      transition: 'background-color 0.2s'
    });

    button.onmouseover = () => button.style.backgroundColor = '#047857'; 
    button.onmouseout = () => button.style.backgroundColor = '#059669';

    button.addEventListener('click', handleCapture);

    document.body.appendChild(button);
  }

  async function handleCapture() {
    try {
      const data = extractMorphoSourceData();
      console.log('Specify7+: Extracted MorphoSource data:', data);

      if (!data.inventoryNumber && !data.genus) {
        alert('Specify7+: Could not find relevant specimen data on this page.');
        return;
      }

      // Copy to clipboard as JSON with a signature
      const clipboardData = {
        _source: 'Specify7+',
        _type: 'SpecimenData',
        ...data
      };
      
      await navigator.clipboard.writeText(JSON.stringify(clipboardData));

      // Save to storage so other tabs know what data is available.
      // chrome.runtime.id is undefined once the extension is reloaded and this
      // script is orphaned — guard against "Extension context invalidated".
      if (chrome && chrome.runtime && chrome.runtime.id && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ lastCapturedSpecimen: clipboardData });
      }
      
      // Visual feedback
      const originalText = this.textContent;
      this.textContent = '✅ Copied!';
      this.style.backgroundColor = '#10b981';
      setTimeout(() => {
        this.textContent = originalText;
        this.style.backgroundColor = '#059669';
      }, 2000);

    } catch (error) {
      console.error('Specify7+: Error capturing data:', error);
      alert('Specify7+: Error copying data. Please ensure the page has focus.');
    }
  }

  // Initialize
  if (chrome && chrome.runtime && chrome.runtime.id && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(['enabledFeatures'], (result) => {
      const features = result.enabledFeatures || { dataCapture: true };
      if (features.dataCapture !== false) {
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', createFloatingButton);
        } else {
          createFloatingButton();
        }
      } else {
        console.log('Specify7+: Data capture is disabled in settings');
      }
    });
  } else {
    // Fallback if storage not available (unlikely in extension)
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', createFloatingButton);
    } else {
      createFloatingButton();
    }
  }

})();

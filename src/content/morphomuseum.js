/**
 * MorphoMuseum Content Script
 * Scrapes specimen data and 3D models to send to Specify 7
 */

(function() {
  'use strict';
  
  console.log('Specify7+: MorphoMuseum script loaded');

  // Utility to find text next to a bold label like <b>Inventory number :</b>
  function getFieldByLabel(labelText) {
    const bTags = document.querySelectorAll('b');
    for (const b of bTags) {
      if (b.textContent.trim().toLowerCase().includes(labelText.toLowerCase())) {
        // The value might be a text node right after, or inside an <a> tag
        let nextNode = b.nextSibling;
        while (nextNode) {
          if (nextNode.nodeType === Node.TEXT_NODE) {
            const text = nextNode.textContent.trim();
            // Only return text if it has some alphanumeric characters, otherwise keep searching
            // This skips symbols like &#10013; or commas before the actual value
            if (text && /[a-zA-Z0-9]/.test(text)) return text;
          } else if (nextNode.nodeType === Node.ELEMENT_NODE) {
            if (nextNode.tagName === 'A') return nextNode.textContent.trim();
            if (nextNode.tagName === 'BR') break;
            if (nextNode.tagName === 'I') return nextNode.textContent.trim(); // sometimes wrapped in <i> like Genus
          }
          nextNode = nextNode.nextSibling;
        }
      }
    }
    return '';
  }

  function extractMorphoData() {
    const data = {};
    
    // Attempt to extract fields based on typical MorphoMuseum DOM structure
    data.inventoryNumber = getFieldByLabel('Inventory number');
    data.collection = getFieldByLabel('Collection');
    data.class = getFieldByLabel('Class');
    data.order = getFieldByLabel('Order');
    data.family = getFieldByLabel('Family');
    data.genus = getFieldByLabel('Genus');
    data.species = getFieldByLabel('Species').replace(/^[\W_]+/, '').trim(); // Remove leading symbols like &#10013; (cross)
    
    data.sex = getFieldByLabel('Sex');
    data.age = getFieldByLabel('Age group');
    data.origin = getFieldByLabel('Origin');
    
    const descP = document.querySelector('h1 + p');
    if (descP) {
      data.description = descP.textContent.trim();
    }

    // Look for 3D model link
    const downloadLink = Array.from(document.querySelectorAll('a')).find(
      a => a.textContent.trim() === 'Download 3D model'
    );
    
    if (downloadLink) {
      data.modelUrl = downloadLink.href;
    }

    return data;
  }

  function createFloatingButton() {
    const button = document.createElement('button');
    button.textContent = 'Send to Specify';
    button.title = 'Capture data and download 3D model for Specify 7';
    
    // Style the button
    Object.assign(button.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      padding: '12px 20px',
      backgroundColor: '#2563eb', // Blue-600
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

    button.onmouseover = () => button.style.backgroundColor = '#1d4ed8'; // Blue-700
    button.onmouseout = () => button.style.backgroundColor = '#2563eb';

    button.addEventListener('click', handleCapture);

    document.body.appendChild(button);
  }

  async function handleCapture() {
    try {
      const data = extractMorphoData();
      console.log('Specify7+: Extracted MorphoMuseum data:', data);

      if (!data.inventoryNumber && !data.genus) {
        alert('Specify7+: Could not find relevant specimen data on this page.');
        return;
      }

      // Save to local storage for Specify to pick up
      await chrome.storage.local.set({ pendingMorphoData: data });
      
      // Trigger download if available
      if (data.modelUrl) {
        window.open(data.modelUrl, '_blank');
        alert('Specify7+: Data captured successfully! Download started.\\nYou can now go to Specify 7 and click "Import MorphoMuseum".');
      } else {
        alert('Specify7+: Data captured successfully! (No 3D model found)\\nYou can now go to Specify 7 and click "Import MorphoMuseum".');
      }

    } catch (error) {
      console.error('Specify7+: Error capturing data:', error);
      alert('Specify7+: Error capturing data. See console for details.');
    }
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createFloatingButton);
  } else {
    createFloatingButton();
  }

})();

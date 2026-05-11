// Popup script for Specify7+ - Feature toggle management

// Default enabled features
const DEFAULT_FEATURES = {
  bibtex: true,
  doi: true,
  viewer3d: true,
  selectAll: true,
  dataCapture: true
};

// Load saved feature states
function loadFeatureStates() {
  if (chrome && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(['enabledFeatures'], (result) => {
      console.log('popup.js: loaded feature states', result);
      const features = result.enabledFeatures || DEFAULT_FEATURES;
      
      // Update checkboxes
      document.getElementById('feature-bibtex').checked = features.bibtex !== false;
      document.getElementById('feature-doi').checked = features.doi !== false;
      document.getElementById('feature-3dviewer').checked = features.viewer3d !== false;
      document.getElementById('feature-selectall').checked = features.selectAll !== false;
      document.getElementById('feature-capture').checked = features.dataCapture !== false;
    });
  }
}

// Save feature states
function saveFeatureStates() {
  const features = {
    bibtex: document.getElementById('feature-bibtex').checked,
    doi: document.getElementById('feature-doi').checked,
    viewer3d: document.getElementById('feature-3dviewer').checked,
    selectAll: document.getElementById('feature-selectall').checked,
    dataCapture: document.getElementById('feature-capture').checked
  };
  
  console.log('popup.js: saving feature states', features);
  
  if (chrome && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.set({ enabledFeatures: features }, () => {
      console.log('popup.js: features saved');
      showStatus();
    });
  }
}

// Show success message briefly
function showStatus() {
  const status = document.getElementById('status');
  if (status) {
    status.textContent = 'Settings saved!';
    status.classList.add('success');
    setTimeout(() => {
      status.classList.remove('success');
    }, 2000);
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  loadFeatureStates();
  
  // Add change listeners to all checkboxes
  document.getElementById('feature-bibtex').addEventListener('change', saveFeatureStates);
  document.getElementById('feature-doi').addEventListener('change', saveFeatureStates);
  document.getElementById('feature-3dviewer').addEventListener('change', saveFeatureStates);
  document.getElementById('feature-selectall').addEventListener('change', saveFeatureStates);
  document.getElementById('feature-capture').addEventListener('change', saveFeatureStates);
});

(function(App) {
  'use strict';

  App.sleep = function(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  };

  App.normalizeString = function(str) {
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
  };

  App.isExtensionContextValid = function() {
    try {
      return !!(chrome && chrome.runtime && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  };

  App.isSpecify7Page = function() {
    const hostname = window.location.hostname;
    const excludedDomains = [
      'mail.google.com', 'gmail.com', 'google.com', 'github.com',
      'gitlab.com', 'bitbucket.org', 'facebook.com', 'twitter.com',
      'x.com', 'linkedin.com', 'youtube.com', 'wikipedia.org',
      'outlook.live.com', 'outlook.office.com', 'yahoo.com',
      'mail.yahoo.com', 'bing.com', 'duckduckgo.com', 'stackoverflow.com'
    ];
    
    if (excludedDomains.some(domain => hostname === domain || hostname.endsWith('.' + domain))) {
      return false;
    }
    
    if (window.location.pathname.includes('/specify/')) {
      return true;
    }
    
    const path = window.location.pathname;
    const isTypicalSpecifyPath = path === '/' || 
                                 path.startsWith('/login') || 
                                 path.startsWith('/view/') || 
                                 path.startsWith('/query/') || 
                                 path.startsWith('/workbench/') || 
                                 path.startsWith('/landing/') || 
                                 path.startsWith('/accounts/login/');
                                 
    const hasSpecifyTitle = document.title && /specify/i.test(document.title);
    const hasSpecifyAsset = !!document.querySelector('script[src*="specify"], link[href*="specify"], img[src*="specify"], img[alt*="Specify" i]');
    
    if (isTypicalSpecifyPath && (hasSpecifyTitle || hasSpecifyAsset)) {
      return true;
    }
    
    return false;
  };

  App.inSameContext = function(el, root) {
    if (!el) return false;
    if (root === document) return !el.closest('[role="dialog"]');
    return root.contains(el);
  };

  App.scopedAll = function(root, selector) {
    return Array.from(root.querySelectorAll(selector)).filter(el => App.inSameContext(el, root));
  };

  App.scopedFirst = function(root, selector) {
    return App.scopedAll(root, selector)[0] || null;
  };

  App.showMessage = function(text, type = 'info') {
    const message = document.createElement('div');
    message.className = `bibtex-message bibtex-message-${type}`;
    message.textContent = text;
    
    document.body.appendChild(message);
    
    setTimeout(() => {
      message.classList.add('bibtex-message-fade');
      setTimeout(() => message.remove(), 300);
    }, 5000);
  };

})(window.Specify7Plus = window.Specify7Plus || {});

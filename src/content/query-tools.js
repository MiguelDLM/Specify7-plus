(function(App) {
  'use strict';

  /**
   * Detects if we are in a Specify 7 query results page
   */
  App.isSpecifyQueryPage = function() {
    // Check if the URL matches the query pattern
    return window.location.pathname.includes('/specify/query/');
  };

  /**
   * Creates the "Select All" button for query results
   */
  App.createSelectAllButton = function() {
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
  };

  /**
   * Adds the "Select All" button to the query results toolbar
   */
  App.addSelectAllButton = function() {
    // Check if button already exists
    if (document.getElementById('specify7plus-select-all-btn')) {
      return;
    }

    // Check if Select All feature is enabled
    if (App.enabledFeatures.selectAll === false) {
      console.log('Specify7+: Select All feature disabled');
      return;
    }

    // Find the button toolbar
    const buttonToolbar = document.querySelector('div.flex.items-center.items-stretch.gap-2');
    
    if (buttonToolbar) {
      const selectAllButton = App.createSelectAllButton();
      buttonToolbar.appendChild(selectAllButton);
      console.log('Specify7+: Select All button added to query results');
    }
  };

  /**
   * Observes for query results toolbar to appear
   */
  App.observeQueryPage = function() {
    const observer = new MutationObserver(() => {
      if (App.isSpecifyQueryPage()) {
        App.addSelectAllButton();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  };

})(window.Specify7Plus = window.Specify7Plus || {});

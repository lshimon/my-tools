document.addEventListener('DOMContentLoaded', () => {
    const detectButton = document.getElementById('detectButton');
    const loading = document.getElementById('loading');
    const platformInfo = document.getElementById('platform-info');
  
    detectButton.addEventListener('click', async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        loading.style.display = 'block';
        platformInfo.innerHTML = '';

        // Send message to content script
        chrome.tabs.sendMessage(tab.id, { action: 'detectPlatform' }, (response) => {
          loading.style.display = 'none';
          if (response && response.platform) {
            displayResults(response);
          } else {
            platformInfo.innerHTML = '<div class="error">Could not detect platform</div>';
          }
        });

      } catch (error) {
        loading.style.display = 'none';
        platformInfo.innerHTML = '<div class="error">Error: Cannot access this page</div>';
        console.error('Detection error:', error);
      }
    });

    const openWebTool = document.getElementById('openWebTool');
    if (openWebTool) {
      openWebTool.addEventListener('click', () => {
        chrome.tabs.create({ url: 'https://ecomdetector.com' });
      });
    }
  });
  
  // Display detection results
  function displayResults(result) {
    const platformInfo = document.getElementById('platform-info');
    
    // Define tabs based on platform
    let tabsHtml = '';
    let tabsContentHtml = '';
    
    // Common detection tab
    tabsHtml += `<button class="tab-button active" data-tab="detection">Detection</button>`;
    tabsContentHtml += `
      <div class="tab-content active" id="detection">
        <h2>Platform: <span style="font-weight: normal;">${result.platform}</span></h2>
        ${result.subdomain ? 
          `<div class="shopify-url">
            <strong>myShopify URL:</strong> 
            <span id="shopifyUrl">${result.subdomain}</span>
            <button id="copyShopifyUrl" class="icon-button" aria-label="Copy URL">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                  stroke-linejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
            <span id="copyTooltip" class="tooltip">Copied!</span>
          </div>` : ''
        }
        ${result.logos && result.logos.length > 0 ? 
          `<div class="platform-logos">
            ${result.logos.map(logo => 
              `<img src="icons/${logo}" alt="${result.platform} logo" class="platform-logo">`
            ).join('')}
          </div>` : ''
        }
      </div>`;

    // Platform-specific tabs
    if (result.platform === 'Shopify') {
      tabsHtml += `
        <button class="tab-button" data-tab="apps">Apps & Theme</button>
        <button class="tab-button" data-tab="details">About Shopify</button>`;
      
      // Add Shopify-specific content
      tabsContentHtml += getShopifyTabsContent(result);
    } else if (result.platform === 'WooCommerce') {
      tabsHtml += `
        <button class="tab-button" data-tab="plugins">Plugins</button>
        <button class="tab-button" data-tab="details">About WooCommerce</button>`;
      
      // Add WooCommerce-specific content
      tabsContentHtml += getWooCommerceTabsContent(result);
    } else if (result.platform === 'Wix') {
      tabsHtml += `
        <button class="tab-button" data-tab="apps">Apps</button>
        <button class="tab-button" data-tab="details">About Wix</button>`;
      
      // Add Wix-specific content
      tabsContentHtml += getWixTabsContent(result);
    }

    // Combine all HTML
    const html = `
      <div class="result-card">
        <div class="tabs">${tabsHtml}</div>
        ${tabsContentHtml}
      </div>`;

    platformInfo.innerHTML = html;
    
    // Setup handlers
    setupTabHandlers();
    setupCopyButton(result.subdomain);
  }

  function setupTabHandlers() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        button.classList.add('active');
        const tabId = button.dataset.tab;
        document.getElementById(tabId).classList.add('active');
      });
    });
  }

  function setupCopyButton(subdomain) {
    if (subdomain) {
      const copyButton = document.getElementById('copyShopifyUrl');
      const tooltip = document.getElementById('copyTooltip');
      
      copyButton.addEventListener('click', () => {
        navigator.clipboard.writeText(subdomain);
        tooltip.style.display = 'block';
        setTimeout(() => tooltip.style.display = 'none', 2000);
      });
    }
  }

  function getShopifyTabsContent(result) {
    return `
      <div class="tab-content" id="apps">
        <h3>Theme</h3>
        <p>Theme Name: ${result.themeName || 'Not detected'}</p>
        
        <h3>Detected Apps</h3>
        <ul class="apps-list">
          ${result.apps ? result.apps.map(app => `
            <li>
              <strong>${app.name}</strong>
              <p>${app.description}</p>
            </li>
          `).join('') : '<li>No apps detected</li>'}
        </ul>
      </div>
      <div class="tab-content" id="details">
        <h3>About Shopify</h3>
        <div class="details-content">
          <h4>Company Overview</h4>
          <p>Shopify Inc. is a Canadian e-commerce company founded in 2006 by Tobias Lütke and Scott Lake.</p>
          <p>It provides a platform for online stores and retail point-of-sale systems, offering services like payments, marketing, and shipping tools.</p>
          
          <h4>Growth and Impact</h4>
          <p>As of 2023, Shopify hosts 4.6 million stores in 175 countries, with a total revenue of $7.1 billion.</p>
          
          <h4>Resources</h4>
          <p><a href="${result.platformDetails.officialWebsite}" target="_blank">Official Website</a></p>
          <p><a href="${result.platformDetails.pricingPlans}" target="_blank">Pricing Plans</a></p>
          <p><a href="${result.platformDetails.documentation}" target="_blank">Documentation</a></p>
        </div>
      </div>`;
  }
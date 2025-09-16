// popup.js - Handles the extension popup UI and Google Sheet integration

document.addEventListener('DOMContentLoaded', function() {
  // Get DOM elements
  const totalSalesElement = document.getElementById('total-sales');
  const totalEarningsElement = document.getElementById('total-earnings');
  const lastUpdatedElement = document.getElementById('last-updated');
  const productsListElement = document.getElementById('products-list');
  const refreshButton = document.getElementById('refresh-btn');
  const exportButton = document.getElementById('export-btn');
  const clearButton = document.getElementById('clear-btn');
  const statusMessage = document.getElementById('status-message');
  
  // Filter buttons
  const sortNameBtn = document.getElementById('sort-name');
  const sortTotalSalesBtn = document.getElementById('sort-total-sales');
  const sortTodaysSalesBtn = document.getElementById('sort-todays-sales');

  // Store current products data for filtering
  let currentProductsData = null;
  let currentSortType = 'name';
  let sortOrder = 'asc'; // Default to ascending

  // Load data from storage when popup opens
  loadStoredData();

  // Add event listeners
  refreshButton.addEventListener('click', refreshData);
  exportButton.addEventListener('click', exportToGoogleSheet);
  clearButton.addEventListener('click', clearStoredData);
  
  // Filter button event listeners
  sortNameBtn.addEventListener('click', () => setSortType('name'));
  sortTotalSalesBtn.addEventListener('click', () => setSortType('total-sales'));
  sortTodaysSalesBtn.addEventListener('click', () => setSortType('todays-sales'));

  // Function to load stored data
  function loadStoredData() {
    chrome.storage.local.get(['productData'], function(result) {
      if (result.productData) {
        displayData(result.productData);
      } else {
        showMessage('No data available. Click refresh to scrape data.', 'error-message');
        productsListElement.innerHTML = '<p class="loading-message">No data available</p>';
      }
    });
  }

  // Function to display data in the popup
  function displayData(data) {
    // Display dashboard stats
    if (data.dashboardData) {
      totalSalesElement.textContent = data.dashboardData.totalSales || 'N/A';
      totalEarningsElement.textContent = data.dashboardData.totalEarnings || 'N/A';
      
      const lastUpdated = data.dashboardData.lastScraped 
        ? new Date(data.dashboardData.lastScraped).toLocaleString() 
        : 'Never';
      lastUpdatedElement.textContent = lastUpdated;
    }

    // Display products
    if (data.products && data.products.length > 0) {
      displayProducts(data.products);
    } else {
      productsListElement.innerHTML = '<p class="loading-message">No products found</p>';
    }
  }

  // Function to display products
  function displayProducts(products) {
    if (!products || products.length === 0) {
      productsListElement.innerHTML = '<p>No products found.</p>';
      return;
    }

    // Store products data for filtering
    currentProductsData = products;

    // Apply current filters
    applyFilters();
  }

  // Function to set sort type and update UI
  function setSortType(sortType) {
    // Toggle sort order if clicking the same button
    if (currentSortType === sortType) {
      sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      currentSortType = sortType;
      sortOrder = 'desc'; // Default to descending for sales numbers
    }
    
    // Update button states
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    
    if (sortType === 'name') {
      sortNameBtn.classList.add('active');
      sortOrder = sortOrder === 'desc' ? 'asc' : 'desc'; // Name sorting defaults to ascending
    } else if (sortType === 'total-sales') {
      sortTotalSalesBtn.classList.add('active');
    } else if (sortType === 'todays-sales') {
      sortTodaysSalesBtn.classList.add('active');
    }
    
    // Apply the filter
    applyFilters();
  }

  // Function to apply filters and sorting
  function applyFilters() {
    if (!currentProductsData || currentProductsData.length === 0) {
      return;
    }

    let filteredProducts = [...currentProductsData];
    
    // Sort based on current sort type
    if (currentSortType === 'name') {
      filteredProducts.sort((a, b) => {
        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        const result = nameA.localeCompare(nameB);
        return sortOrder === 'asc' ? result : -result;
      });
    } else if (currentSortType === 'total-sales') {
      filteredProducts.sort((a, b) => {
        const salesA = parseInt(a.totalSales) || 0;
        const salesB = parseInt(b.totalSales) || 0;
        return sortOrder === 'asc' ? salesA - salesB : salesB - salesA;
      });
    } else if (currentSortType === 'todays-sales') {
      filteredProducts.sort((a, b) => {
        const todaysA = parseInt(a.todaysSales) || 0;
        const todaysB = parseInt(b.todaysSales) || 0;
        return sortOrder === 'asc' ? todaysA - todaysB : todaysB - todaysA;
      });
    }

    renderProducts(filteredProducts);
  }

  // Function to render products HTML
  function renderProducts(products) {
    const productsHTML = products.map(product => {
      const productLink = product.productUrl || '#';
      const todaysSales = product.todaysSales || 0;
      const salesDifference = product.salesDifference || 0;
      
      // Format sales difference with proper + prefix and styling
      let salesDifferenceText = '';
      let salesDifferenceClass = 'neutral';
      
      if (salesDifference > 0) {
        salesDifferenceText = `+${salesDifference}`;
        salesDifferenceClass = 'positive';
      } else if (salesDifference < 0) {
        salesDifferenceText = salesDifference.toString();
        salesDifferenceClass = 'negative';
      } else {
        salesDifferenceText = '0';
        salesDifferenceClass = 'neutral';
      }

      return `
        <div class="product-item">
          <div class="product-name">
            <a href="${productLink}" target="_blank">${product.name}</a>
          </div>
          <div class="product-stats">
            <span>Sales: ${product.totalSales}</span>
            <span class="sales-change ${salesDifferenceClass}">${salesDifferenceText}</span>
          </div>
        </div>
      `;
    }).join('');

    productsListElement.innerHTML = productsHTML;
  }

  // Function to refresh data by sending message to content script
  function refreshData() {
    showMessage('Refreshing data...', '');
    
    // Check if we're on the correct page
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const currentTab = tabs[0];
      
      if (currentTab.url.includes('elegantthemes.com/marketplace/seller-dashboard')) {
        // We're on the correct page, send message to content script
        chrome.tabs.sendMessage(currentTab.id, {action: 'scrapeNow'}, function(response) {
          if (response && response.success) {
            displayData(response.data);
            showMessage('Data refreshed successfully!', 'success-message');
          } else {
            showMessage('Failed to refresh data. Try reloading the page.', 'error-message');
          }
        });
      } else {
        showMessage('Please navigate to the Elegant Themes seller dashboard first.', 'error-message');
      }
    });
  }

  // Function to export data to Google Sheet
  function exportToGoogleSheet() {
    showMessage('Exporting to Google Sheet...', '');
    
    chrome.storage.local.get(['productData'], function(result) {
      if (!result.productData || !result.productData.products || result.productData.products.length === 0) {
        showMessage('No data available to export.', 'error-message');
        return;
      }
      
      // Filter products with sales changes for export
      const productsWithChanges = result.productData.products.filter(product => {
        const salesDifference = product.salesDifference || 0;
        return salesDifference !== 0;
      });

      if (productsWithChanges.length === 0) {
        showMessage('No products with sales changes to export.', 'error-message');
        return;
      }

      // Prepare data for Google Sheet
      const exportData = productsWithChanges.map(product => ({
        name: product.name,
        totalSales: product.totalSales,
        todaysSales: product.todaysSales || 0,
        salesDifference: product.salesDifference || 0,
        productUrl: product.productUrl || '',
        timestamp: new Date().toISOString()
      }));
      
      // Send data to background script to handle the API call
      chrome.runtime.sendMessage({
        action: 'exportToSheet',
        sheetId: '1EjLA92fMblcp3ONeorWJHGnA0k4NKPjHcc4cVSaYDhg',
        data: exportData
      }, function(response) {
        if (response && response.success) {
          showMessage('Data exported to Google Sheet successfully!', 'success-message');
        } else {
          showMessage('Failed to export data: ' + (response ? response.error : 'Unknown error'), 'error-message');
        }
      });
    });
  }

  // Function to clear stored data
  function clearStoredData() {
    if (confirm('Are you sure you want to clear all stored data?')) {
      chrome.storage.local.remove(['productData'], function() {
        showMessage('All stored data has been cleared.', 'success-message');
        productsListElement.innerHTML = '<p class="loading-message">No data available</p>';
        totalSalesElement.textContent = 'N/A';
        totalEarningsElement.textContent = 'N/A';
        lastUpdatedElement.textContent = 'Never';
      });
    }
  }

  // Function to show status messages
  function showMessage(message, className) {
    statusMessage.textContent = message;
    statusMessage.className = className;
    
    // Clear message after 5 seconds
    setTimeout(() => {
      statusMessage.textContent = '';
      statusMessage.className = '';
    }, 5000);
  }
});
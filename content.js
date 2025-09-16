// content.js - Scrapes product data from Elegant Themes seller dashboard

// Function to scrape product data from the page
function scrapeProductData() {
  console.log('Scraping product data from Elegant Themes seller dashboard...');
  
  const products = [];
  const productElements = document.querySelectorAll('.et_dashboard_product');
  
  // Get total sales and earnings from the page
  const totalSalesElement = document.querySelector('.et_marketplace_seller_total_sales');
  const totalEarningsElement = document.querySelector('.et_marketplace_seller_total_earned');
  
  const totalSales = totalSalesElement ? totalSalesElement.textContent : 'N/A';
  const totalEarnings = totalEarningsElement ? totalEarningsElement.textContent : 'N/A';
  
  // Process each product element
  productElements.forEach(product => {
    const productName = product.querySelector('h4') ? product.querySelector('h4').textContent : 'Unknown';
    const totalSalesElement = product.querySelector('.product_total_sales_number');
    const pendingRequestsElement = product.querySelector('.product_pending_requests_number');
    
    const totalSales = totalSalesElement ? parseInt(totalSalesElement.textContent, 10) : 0;
    const pendingRequests = pendingRequestsElement ? parseInt(pendingRequestsElement.textContent, 10) : 0;
    
    // Get product URL from the anchor tag with the specific class structure
    const productLink = product.querySelector('a[href*="marketplace"]') || 
                       product.querySelector('.et_dashboard_product a') ||
                       product.querySelector('a');
    const productUrl = productLink ? productLink.href : '';

    products.push({
      name: productName,
      totalSales: totalSales,
      pendingRequests: pendingRequests,
      productUrl: productUrl, // Changed from 'url' to 'productUrl' to match popup.js
      lastUpdated: new Date().toISOString(),
      previousSales: 0, // Will be updated when comparing with stored data
      todaysSales: 0, // Will be calculated based on today's changes
      salesDifference: 0 // Will be calculated when comparing with stored data
    });
  });
  
  // Get the overall dashboard data
  const dashboardData = {
    totalSales: totalSales,
    totalEarnings: totalEarnings,
    lastScraped: new Date().toISOString()
  };
  
  return { products, dashboardData };
}

// Function to compare new data with stored data to detect changes
function compareWithStoredData(newData) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['productData'], (result) => {
      const storedData = result.productData || { products: [] };
      const changedProducts = [];
      const today = new Date().toDateString();
      
      newData.products.forEach(newProduct => {
        // Find matching product in stored data
        const storedProduct = storedData.products.find(p => p.name === newProduct.name);
        
        if (storedProduct) {
          // Set previous sales from stored data
          newProduct.previousSales = storedProduct.totalSales;
          
          // Calculate sales difference
          const salesDifference = newProduct.totalSales - storedProduct.totalSales;
          newProduct.salesDifference = salesDifference;
          
          // Calculate today's sales (if last update was today, add to existing today's sales)
          const lastUpdateDate = storedProduct.lastUpdated ? new Date(storedProduct.lastUpdated).toDateString() : '';
          if (lastUpdateDate === today && salesDifference > 0) {
            newProduct.todaysSales = (storedProduct.todaysSales || 0) + salesDifference;
          } else if (lastUpdateDate !== today && salesDifference > 0) {
            // New day, reset today's sales to current difference
            newProduct.todaysSales = salesDifference;
          } else {
            // No new sales or same day with no change
            newProduct.todaysSales = storedProduct.todaysSales || 0;
          }
          
          // Always add the product to track changes (even if no change)
          changedProducts.push({
            ...newProduct,
            salesDifference
          });
        } else {
          // New product found
          newProduct.previousSales = 0;
          newProduct.salesDifference = newProduct.totalSales; // All sales are new
          newProduct.todaysSales = newProduct.totalSales; // All sales are today's sales for new products
          
          changedProducts.push({
            ...newProduct,
            salesDifference: newProduct.totalSales
          });
        }
      });
      
      resolve({ 
        newData, 
        changedProducts,
        hasChanges: changedProducts.length > 0
      });
    });
  });
}

// Function to store the scraped data
function storeProductData(data) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ 'productData': data }, () => {
      console.log('Product data stored in Chrome storage');
      resolve(data);
    });
  });
}

// Main function to execute when page loads
function main() {
  // Only run on the seller dashboard page
  if (window.location.href.includes('elegantthemes.com/marketplace/seller-dashboard')) {
    console.log('Elegant Themes seller dashboard detected');
    
    // Wait for the page to fully load
    setTimeout(() => {
      const scrapedData = scrapeProductData();
      
      // Compare with stored data and update storage
      compareWithStoredData(scrapedData)
        .then(({ newData, changedProducts, hasChanges }) => {
          // Store the new data
          storeProductData(newData)
            .then(() => {
              // Notify the extension popup about new data
              chrome.runtime.sendMessage({
                action: 'dataScraped',
                data: newData,
                changedProducts,
                hasChanges
              });
            });
        });
    }, 2000); // Wait 2 seconds for dynamic content to load
  }
}

// Run the main function when the page is loaded
window.addEventListener('load', main);

// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'scrapeNow') {
    const scrapedData = scrapeProductData();
    
    compareWithStoredData(scrapedData)
      .then(({ newData, changedProducts, hasChanges }) => {
        storeProductData(newData)
          .then(() => {
            sendResponse({
              success: true,
              data: newData,
              changedProducts,
              hasChanges
            });
          });
      });
    
    // Return true to indicate we will send a response asynchronously
    return true;
  }
});
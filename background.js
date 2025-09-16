// background.js - Handles background tasks and Google Sheets API integration

// Listen for installation event
chrome.runtime.onInstalled.addListener(() => {
  console.log('Elegant Themes Dashboard Helper extension installed');
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'exportToSheet') {
    exportToGoogleSheet(message.sheetId, message.data)
      .then(result => {
        sendResponse({ success: true, result });
      })
      .catch(error => {
        console.error('Error exporting to Google Sheet:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    // Return true to indicate we will send a response asynchronously
    return true;
  }
});

// Function to export data to Google Sheet
async function exportToGoogleSheet(sheetId, data) {
  try {
    // Get OAuth token
    const token = await getAuthToken();
    
    // Prepare the values to append to the sheet
    const values = data.map(item => [
      new Date(item.timestamp).toLocaleString(),
      item.productName,
      item.totalSales,
      item.pendingSupport,
      item.salesDifference
    ]);
    
    // Append values to the sheet
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1:append?valueInputOption=USER_ENTERED`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: values
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Google Sheets API error: ${errorData.error.message}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error in exportToGoogleSheet:', error);
    throw error;
  }
}

// Function to get OAuth token
async function getAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, function(token) {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(token);
      }
    });
  });
}
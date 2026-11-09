// Background script for StudyCap extension
chrome.runtime.onInstalled.addListener(() => {
  // Extension installed - no action needed
});

// Handle all messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Forward completion messages to the popup
  if (message.type === "CAPTIONS_LOADED" || message.type === "CONTENT_SCRIPT_ERROR" || message.type === "REDIRECTING_TO_LECTURE_VIEWER") {
    console.log("Background: Forwarding message to popup:", message.type);
    chrome.runtime.sendMessage(message);
  }
  
  // Don't return true for forwarding messages - no response needed
});

// Function to check user access by calling the Flask API
// Returns both access data and server time if available
async function checkUserAccess() {
  const { response, data, error } = await apiRequest("https://study-cap.com/api/check_access");
  if (error) {
    return { access: false, error: "Fetch error" };
  }
  
  // Extract server time if available (for getServerTime optimization)
  if (response && response.headers) {
    const serverDateStr = response.headers.get('Date');
    if (serverDateStr && data && data.access) {
      // Store server time offset for later use
      const serverTime = new Date(serverDateStr);
      const localTime = new Date();
      const timeOffset = serverTime - localTime;
      localStorage.setItem('serverTimeOffset', timeOffset.toString());
      localStorage.setItem('lastSyncTime', localTime.getTime().toString());
    }
  }
  
  return data || { access: false, error: "Fetch error" };
}

// Simple generation state tracking
let isGenerating = false;

// Simple message display system
function showGenerationMessage(message) {
  // Remove any existing message
  const existingMessage = document.getElementById('generationMessage');
  if (existingMessage) {
    existingMessage.remove();
  }
  
  // Create message element
  const messageDiv = document.createElement('div');
  messageDiv.id = 'generationMessage';
  messageDiv.style.cssText = `
    background: linear-gradient(135deg, #ff6b6b, #ee5a24);
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    margin: 10px 0;
    text-align: center;
    font-weight: 600;
    font-size: 14px;
    box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
    animation: slideIn 0.3s ease-out;
  `;
  messageDiv.innerHTML = `
    <i class="fas fa-exclamation-triangle" style="margin-right: 8px;"></i>
    ${message}
  `;
  
  // Add CSS animation if not already added
  if (!document.getElementById('generationMessageStyles')) {
    const style = document.createElement('style');
    style.id = 'generationMessageStyles';
    style.textContent = `
      @keyframes slideIn {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);
  }
  
  // Insert message after the header
  const header = document.querySelector('.header');
  if (header && header.nextSibling) {
    header.parentNode.insertBefore(messageDiv, header.nextSibling);
  } else if (header) {
    header.parentNode.appendChild(messageDiv);
  }
}

function hideGenerationMessage() {
  const message = document.getElementById('generationMessage');
  if (message) {
    message.style.animation = 'slideIn 0.3s ease-out reverse';
    setTimeout(() => {
      if (message.parentNode) {
        message.parentNode.removeChild(message);
      }
    }, 300);
  }
}

// Inject minimal CSS for in-button spinner once
let __progressStylesInjected = false;
function ensureProgressStyles() {
  if (__progressStylesInjected) return;
  const style = document.createElement('style');
  style.textContent = `
    .btn-progress {
      position: relative;
      overflow: hidden;
      border-radius: 12px;
    }
    .btn-progress .spinner {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 20px;
      height: 20px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top-color: #fff;
      animation: spin 1s linear infinite;
      pointer-events: none;
      z-index: 2;
    }
    .btn-progress .progress-label {
      position: relative;
      z-index: 1;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      opacity: 0.9;
    }
    .btn-progress.loading {
      cursor: progress !important;
      background: linear-gradient(90deg, #673ab7, #00c9b7) !important;
      color: #fff !important;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
      border-radius: 12px;
      overflow: hidden;
    }
    .btn-progress.loading i { 
      opacity: 0.7; 
    }
    @keyframes spin {
      to { transform: translate(-50%, -50%) rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
  __progressStylesInjected = true;
}

// Create an in-button spinner UI wrapper
function withButtonProgress(button, intentLabel) {
  ensureProgressStyles();
  if (!button.classList.contains('btn-progress')) {
    button.classList.add('btn-progress');
    const labelSpan = document.createElement('span');
    labelSpan.className = 'progress-label';
    // Move existing contents into labelSpan
    while (button.firstChild) labelSpan.appendChild(button.firstChild);
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    button.appendChild(spinner);
    button.appendChild(labelSpan);
  }
  const spinnerEl = button.querySelector('.spinner');
  const labelEl = button.querySelector('.progress-label');

  const setLabel = (text) => { if (labelEl) labelEl.textContent = String(text || ''); };

  const start = (customText) => {
    button.disabled = true;
    button.classList.add('loading');
    setLabel(customText || intentLabel);
    if (spinnerEl) spinnerEl.style.display = 'block';
  };

  const updateText = (customText) => setLabel(customText || intentLabel);

  const complete = (customText) => new Promise((resolve) => {
    setLabel(customText || 'Done');
    if (spinnerEl) spinnerEl.style.display = 'none';
    setTimeout(() => {
      button.classList.remove('loading');
      button.disabled = false;
      resolve();
    }, 500);
  });

  const fail = (customText) => new Promise((resolve) => {
    setLabel(customText || 'Failed');
    if (spinnerEl) spinnerEl.style.display = 'none';
    setTimeout(() => {
      button.classList.remove('loading');
      button.disabled = false;
      resolve();
    }, 500);
  });

  return { start, complete, fail, updateText };
}

// Function to show loading state and message
function showLoading(customMessage = null, preferredButton = null) {
  // If a preferred button is provided, use it regardless of visibility
  let target = preferredButton || null;
  if (!target) {
    // Fallback: prefer visible upload/summarize buttons, otherwise the main trigger
    const uploadBtn = document.getElementById('addPdfToLecture');
    const summarizeBtn = document.getElementById('summarizeLectureOnly');
    const createBtn = document.getElementById('lectureSummaryButton');
    target = (uploadBtn && uploadBtn.offsetParent !== null) ? uploadBtn : (summarizeBtn && summarizeBtn.offsetParent !== null) ? summarizeBtn : createBtn;
  }
  if (!target) return;
  if (!target.__progress) target.__progress = withButtonProgress(target, 'Generating summary');
  target.__progress.start(customMessage || 'Generating summary');

  // Set generation state
  isGenerating = true;
  
  // Show the warning message
  showGenerationMessage("PLEASE DO NOT CLOSE THE EXTENSION OR REGENERATE UNTIL IT IS DONE!");
  
  // Set a timeout to clear generation state after 5 minutes (safety net)
  setTimeout(() => {
    if (isGenerating) {
      console.log("Generation timeout reached, clearing state");
      isGenerating = false;
      hideGenerationMessage();
    }
  }, 300000); // 5 minutes
}

// Function to hide loading state and finalize any button progress
function hideLoading(success = true) {
  // Finish any active button bar
  const candidates = [
    document.getElementById('addPdfToLecture'),
    document.getElementById('summarizeLectureOnly'),
    document.getElementById('lectureSummaryButton'),
    // pdfOnlySummaryButton reference removed from hideLoading - no longer needed
  ];
  candidates.forEach((btn) => {
    if (btn && btn.__progress) {
      if (success) {
        btn.__progress.complete();
      } else {
        btn.__progress.fail();
      }
    }
  });

  // Clear generation state and hide message
  isGenerating = false;
  hideGenerationMessage();
}

// Helper function to make authenticated API requests
// Note: For FormData requests (like PDF upload), use fetch directly as headers are set automatically
async function apiRequest(url, options = {}) {
  try {
    const defaultOptions = {
      method: options.method || "GET",
      credentials: "include",
      headers: {
        ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...options.headers
      }
    };
    
    if (options.body) {
      defaultOptions.body = options.body instanceof FormData ? options.body : JSON.stringify(options.body);
    }
    
    const response = await fetch(url, defaultOptions);
    const data = await response.json();
    return { response, data };
  } catch (error) {
    console.error(`Error in API request to ${url}:`, error);
    return { response: null, data: null, error };
  }
}

// Function to check daily summary limit
async function checkDailyLimit() {
  const { response, data, error } = await apiRequest("https://study-cap.com/api/check_daily_limit");
  if (error) {
    return { limitReached: false, error: "Fetch error" };
  }
  return data || { limitReached: false, error: "Fetch error" };
}

// Function to update the usage counter display
function updateUsageCounter(usedCount, limitCount) {
  const usageCounter = document.getElementById('usageCounter');
  const usageBar = document.getElementById('usageBar');
  const usedCountElement = document.getElementById('usedCount');
  const limitCountElement = document.getElementById('limitCount');
  
  // Calculate percentage (capped at 100%)
  const percentage = Math.min(100, (usedCount / limitCount) * 100);
  
  // Update display elements
  usageBar.style.width = `${percentage}%`;
  usedCountElement.textContent = usedCount;
  limitCountElement.textContent = limitCount;
  
  // Show usage counter element
  usageCounter.style.display = 'block';
  
  // Change color if nearing or at limit
  if (percentage >= 90) {
    usageBar.style.background = 'linear-gradient(90deg, #f56565, #ed8936)';
  } else if (percentage >= 70) {
    usageBar.style.background = 'linear-gradient(90deg, #ed8936, #ecc94b)';
  }
  
  // Start the countdown timer
  startRefillCountdown();
}

// Get server time - tries to use cached offset, falls back to check_access endpoint if needed
// Note: This is optimized to use the offset stored during checkUserAccess() calls
async function getServerTime() {
  // First try to use stored offset if recent (< 10 minutes)
  const lastSyncTime = parseInt(localStorage.getItem('lastSyncTime') || '0');
  const storedOffset = localStorage.getItem('serverTimeOffset');
  const now = new Date().getTime();
  
  if (storedOffset && (now - lastSyncTime) < 10 * 60 * 1000) {
    // Use cached offset if less than 10 minutes old
    const offset = parseInt(storedOffset);
    return new Date(new Date().getTime() + offset);
  }
  
  // Need fresh server time - use check_access endpoint (server time is extracted there)
  try {
    await checkUserAccess(); // This will update the stored offset
    const offset = parseInt(localStorage.getItem('serverTimeOffset') || '0');
    return new Date(new Date().getTime() + offset);
  } catch (error) {
    console.error("Error getting server time:", error);
    
    // Fallback to stored offset even if old
    if (storedOffset) {
      const offset = parseInt(storedOffset);
      return new Date(new Date().getTime() + offset);
    }
    
    // Last resort: use local time
    return new Date();
  }
}

// Function to get current time adjusted for server offset
function getCurrentAdjustedTime() {
  const storedOffset = localStorage.getItem('serverTimeOffset');
  if (storedOffset) {
    const offset = parseInt(storedOffset);
    return new Date(new Date().getTime() + offset);
  }
  // If no offset is stored, just use local time
  return new Date();
}

// Function to calculate time until midnight based on adjusted time
function getTimeUntilMidnight() {
  const now = getCurrentAdjustedTime();
  const midnight = new Date(now);
  // Set to next UTC midnight
  midnight.setUTCHours(24, 0, 0, 0);
  return midnight - now; // Time difference in milliseconds
}

// Format time in HH:MM:SS
function formatTimeRemaining(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Function to start and manage the countdown timer
function startRefillCountdown() {
  // Synchronize with server time first
  getServerTime().then(() => {
    // Get or create the countdown element
    let countdownElement = document.getElementById('refillCountdown');
    if (!countdownElement) {
      // Get the title element in the usage counter
      const titleElement = document.querySelector('.usage-counter .title');
      
      // Create the countdown element
      countdownElement = document.createElement('span');
      countdownElement.id = 'refillCountdown';
      countdownElement.style.marginLeft = 'auto';
      countdownElement.style.fontSize = '12px';
      countdownElement.style.fontWeight = 'normal';
      countdownElement.style.color = '#666';
      countdownElement.style.backgroundColor = 'rgba(0,0,0,0.05)';
      countdownElement.style.padding = '2px 6px';
      countdownElement.style.borderRadius = '10px';
      
      // Add it to the title
      titleElement.appendChild(countdownElement);
    }
    
    // Clear any existing interval
    if (window.countdownInterval) {
      clearInterval(window.countdownInterval);
    }
    
    // Function to update the countdown
    const updateCountdown = () => {
      const timeRemaining = getTimeUntilMidnight();
      if (timeRemaining <= 0) {
        // It's past midnight, refresh the page or the usage data
        clearInterval(window.countdownInterval);
        
        // Re-sync with server before reloading to ensure we have accurate time
        getServerTime().then(() => {
          // Double-check after sync that we're actually past midnight
          if (getTimeUntilMidnight() <= 0) {
            location.reload();
          }
        });
        return;
      }
      
      countdownElement.textContent = `Refills in ${formatTimeRemaining(timeRemaining)}`;
      
      // Periodically re-sync with server time (every 10 minutes)
      const lastSyncTime = parseInt(localStorage.getItem('lastSyncTime') || '0');
      const now = new Date().getTime();
      if (now - lastSyncTime > 10 * 60 * 1000) { // 10 minutes
        getServerTime(); // Re-sync but don't wait for it
      }
    };
    
    // Initial update
    updateCountdown();
    
    // Set interval to update every second
    window.countdownInterval = setInterval(updateCountdown, 1000);
  });
}

// Function to show limit reached message
function showLimitReachedMessage(element, tier) {
  // Remove any existing message
  const existingMessage = element.parentElement.querySelector('.limit-reached-message');
  if (existingMessage) {
    existingMessage.remove();
  }

  // Build a stylish inline banner with CTA
  // Determine message based on tier
  const limitCount = getMaxLimitForTier(tier);

  const banner = document.createElement('div');
  banner.className = 'limit-reached-message';
  banner.style.display = 'flex';
  banner.style.alignItems = 'center';
  banner.style.gap = '10px';
  banner.style.marginTop = '8px';
  banner.style.padding = '10px';
  banner.style.borderRadius = '12px';
  banner.style.background = 'linear-gradient(135deg, rgba(103,58,183,0.08), rgba(0,201,183,0.08))';
  banner.style.border = '1px solid rgba(103,58,183,0.2)';
  banner.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';

  const icon = document.createElement('i');
  icon.className = 'fas fa-crown';
  icon.style.color = '#f59e0b';
  icon.style.fontSize = '14px';
  icon.style.flex = '0 0 auto';

  const text = document.createElement('div');
  text.style.flex = '1';
  text.style.fontSize = '12px';
  text.style.color = '#4b5563';
  text.style.lineHeight = '1.4';
      text.innerHTML = `<strong>Daily limit reached</strong> <span style="opacity:0.9">(${limitCount} summaries)</span>`;

  // Only show upgrade button if not on Premium
  let upgradeBtn = null;
  if (tier !== 'Premium') {
    upgradeBtn = document.createElement('button');
    upgradeBtn.type = 'button';
    upgradeBtn.innerHTML = '<i class="fas fa-crown"></i> Upgrade Now';
    upgradeBtn.style.padding = '8px 12px';
    upgradeBtn.style.border = 'none';
    upgradeBtn.style.borderRadius = '10px';
    upgradeBtn.style.cursor = 'pointer';
    upgradeBtn.style.fontFamily = 'inherit';
    upgradeBtn.style.fontSize = '12px';
    upgradeBtn.style.fontWeight = '600';
    upgradeBtn.style.color = '#fff';
    upgradeBtn.style.background = 'linear-gradient(90deg, #f59e0b, #ec4899)';
    upgradeBtn.style.transition = 'all 0.3s ease';
    upgradeBtn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
    upgradeBtn.style.position = 'relative';
    upgradeBtn.style.overflow = 'hidden';

    upgradeBtn.addEventListener('mouseover', function() {
      this.style.transform = 'translateY(-2px) scale(1.02)';
      this.style.boxShadow = '0 5px 15px rgba(103,58,183,0.3), 0 10px 30px rgba(0,201,183,0.2)';
    });
    upgradeBtn.addEventListener('mouseout', function() {
      this.style.transform = '';
      this.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
    });
    upgradeBtn.addEventListener('click', function() {
      window.open('https://study-cap.com/pricing', '_blank');
    });
  }

  banner.appendChild(icon);
  banner.appendChild(text);
  if (upgradeBtn) banner.appendChild(upgradeBtn);
  element.parentElement.appendChild(banner);
}

// Track the active tab ID
let _activeTabId;
// Track loading timeout
let _loadingTimeout;

// Utility function to get active tab
async function getActiveTab() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0];
  } catch (error) {
    console.error("Error getting active tab:", error);
    return null;
  }
}



// When the popup loads, check access and update the UI
document.addEventListener("DOMContentLoaded", async () => {
  
  // Initialize active tab ID and URL
  let currentTabUrl = "";
  const activeTab = await getActiveTab();
  if (activeTab) {
    _activeTabId = activeTab.id;
    currentTabUrl = activeTab.url || "";
  }
  
  const accessStatusDiv = document.getElementById("accessStatus");
  const toolContentDiv = document.getElementById("toolContent");
  const lectureSummaryButton = document.getElementById("lectureSummaryButton");
  const lectureOptions = document.getElementById("lectureOptions");
  const addPdfToLecture = document.getElementById("addPdfToLecture");
  const pdfInput = document.getElementById("pdfInput");
  const summarizeLectureOnly = document.getElementById("summarizeLectureOnly");
  const pdfOnlySummaryButton = document.getElementById("pdfOnlySummaryButton");
  
  const manageSubscriptionsButton = document.getElementById("manageSubscriptions");

  // Disable all summary buttons while connecting to backend
  lectureSummaryButton.disabled = true;
  pdfOnlySummaryButton.disabled = true;
  addPdfToLecture.disabled = true;
  summarizeLectureOnly.disabled = true;

  // Show connection spinner (already in HTML)
  const accessData = await checkUserAccess();

  // Hide connection spinner
  const connectionSpinner = accessStatusDiv.querySelector('.connection-spinner');
  if (connectionSpinner) {
    connectionSpinner.style.display = 'none';
  }

  if (!accessData.access) {
    // Redirect to login page if user is not logged in or not verified
    chrome.tabs.create({ url: "https://study-cap.com/login" });
    accessStatusDiv.textContent = accessData.error || "Access denied. Please log in and verify your account.";
    lectureSummaryButton.disabled = true;
    toolContentDiv.innerHTML = "<p>You must be logged in and verified to use this tool.</p>";
    return;
  } else {
    
    // Fetch and display the daily usage information
    const limitData = await checkDailyLimit();
    if (!limitData.error) {
      const usedCount = limitData.remaining !== undefined ? 
        (getMaxLimitForTier(accessData.tier) - limitData.remaining) : 0;
      const limitCount = getMaxLimitForTier(accessData.tier);
      updateUsageCounter(usedCount, limitCount);
    }
    
    // Create tier button display with more interesting styling
    let tierButtonStyle = '';
    let tierIcon = '';
    
    if (accessData.tier === 'Free') {
      tierButtonStyle = 'background: linear-gradient(90deg,rgb(74, 81, 93),rgb(169, 169, 169)); color: white;';
      tierIcon = '<i class="fas fa-user" style="margin-right: 5px;"></i>';
    } else if (accessData.tier === 'Student') {
      tierButtonStyle = 'background: linear-gradient(90deg, #f59e0b, #d97706); color: white;';
      tierIcon = '<i class="fas fa-graduation-cap" style="margin-right: 5px;"></i>';
    } else if (accessData.tier === 'Premium') {
      tierButtonStyle = 'background: linear-gradient(90deg, #673ab7, #00c9b7); color: white;';
      tierIcon = '<i class="fas fa-crown" style="margin-right: 5px;"></i>';
    }
    
    // Create a style tag for the tier button hover animations
    const styleTag = document.createElement('style');
    styleTag.textContent = `
      .tier-button {
        padding: 6px 15px;
        border-radius: 15px;
        font-weight: bold;
        display: inline-block;
        font-size: 14px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        transform: translateY(0);
        transition: all 0.3s ease;
        position: relative;
        overflow: hidden;
      }
      .tier-button:hover {
        transform: translateY(-2px) scale(1.05);
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
      }
      .tier-button::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 200%;
        height: 100%;
        background: linear-gradient(
          to right,
          transparent 0%,
          rgba(255,255,255,0.3) 50%,
          transparent 100%
        );
        transform: skewX(-30deg);
        transition: left 1s ease;
      }
      .tier-button:hover::before {
        left: 200%;
      }
    `;
    document.head.appendChild(styleTag);
    
    accessStatusDiv.innerHTML = `<a href="https://study-cap.com/manage-subscriptions" target="_blank" style="text-decoration: none; cursor: pointer;"><div class="tier-button" style="${tierButtonStyle}">${tierIcon}${accessData.tier}</div></a>`;
    
    // Enable buttons after backend connection completes
    pdfOnlySummaryButton.disabled = false;
    toolContentDiv.innerHTML = ""; // Remove "Premium tool content enabled" text
    
    // Panopto lecture URL pattern (adjust as needed)
    const isPanoptoLecture = /panopto\..*\/Panopto\/Pages\/Viewer\.aspx/.test(currentTabUrl);
    if (!isPanoptoLecture) {
      lectureSummaryButton.disabled = true;
      lectureSummaryButton.title = "Navigate to a Panopto lecture page to use this feature";
      lectureSummaryButton.style.opacity = "0.6";
      // Keep lecture options buttons disabled if not on Panopto page
      addPdfToLecture.disabled = true;
      summarizeLectureOnly.disabled = true;
      // Show contextual message
      if (!toolContentDiv.innerHTML.trim()) {
        toolContentDiv.innerHTML = `
          <div style="background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; margin: 8px 0;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <i class="fas fa-info-circle" style="color: #6b7280;"></i>
              <strong style="color: #374151;">Lecture Required</strong>
            </div>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #6b7280;">
              LECTURE SUMMARY works on Panopto lecture pages. Use PDF ONLY SUMMARY for standalone PDFs.
            </p>
          </div>
        `;
      }
    } else {
      // Enable lecture summary button and options buttons if on a Panopto lecture page
      lectureSummaryButton.disabled = false;
      addPdfToLecture.disabled = false;
      summarizeLectureOnly.disabled = false;
    }
    
    async function startSummary(preferredBtn = null) {
      // Prevent double generation
      if (isGenerating) {
        console.log("Generation already in progress, ignoring startSummary call");
        return;
      }
      
      // Clear any existing timeout
      clearTimeout(_loadingTimeout);
      
      // Show loading state on the initiating button if provided
      showLoading(null, preferredBtn);
      
      // Set a timeout to hide loading state after 3 minutes (in case something goes wrong)
      _loadingTimeout = setTimeout(() => {
        hideLoading(false);
        alert("Summary generation timed out. Please try again.");
      }, 180000); // 3 minutes
      
      try {
        // Check user tier and daily limit first
        const accessData = await checkUserAccess();
        const limitData = await checkDailyLimit();
        if (limitData.limitReached) {
          clearTimeout(_loadingTimeout);
          hideLoading();
          showLimitReachedMessage(lectureSummaryButton, accessData.tier);
          return;
        }
        
        // Validate and refresh tab ID if needed
        let tabId = _activeTabId;
        if (!tabId) {
          const activeTab = await getActiveTab();
          if (!activeTab) {
            clearTimeout(_loadingTimeout);
            hideLoading();
            return;
          }
          tabId = activeTab.id;
          _activeTabId = tabId;
        }
        
        // Execute the content script
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ["content.js"]
          });
          // Keep loading state active - the content script will handle completion
          // The timeout will be cleared when the content script sends completion message
        } catch (error) {
          console.error("Error executing content script:", error);
          clearTimeout(_loadingTimeout);
          hideLoading();
          alert("Error: " + error.message);
        }
      } catch (error) {
        console.error("Error in startSummary:", error);
        clearTimeout(_loadingTimeout);
        hideLoading();
      }
    }

    // Change the click handler for the Lecture Summary button
    lectureSummaryButton.addEventListener("click", function() {
      // Hide the button and show the options
      lectureSummaryButton.style.display = 'none';
      lectureOptions.style.display = 'block';
    });

    // Handle PDF Only Summary button - redirect to dashboard
    pdfOnlySummaryButton.addEventListener('click', async function() {
      // Redirect to dashboard where users can upload PDF/PowerPoint
      // Add parameter to trigger animation highlighting the upload button
      chrome.tabs.create({ url: "https://study-cap.com/dashboard?upload=true" });
    });

    // Handle summarize lecture only
    summarizeLectureOnly.addEventListener('click', function() {
      // Prevent double generation
      if (isGenerating) {
        console.log("Generation already in progress, ignoring click");
        return;
      }
      // Start summary and anchor progress to this button; keep options visible so progress stays in place
      startSummary(summarizeLectureOnly);
    });

    // Handle add PDF to lecture option
    addPdfToLecture.addEventListener('click', async function() {
      // Prevent double generation
      if (isGenerating) {
        console.log("Generation already in progress, ignoring click");
        return;
      }
      
      // All tiers can now use PDF/PowerPoint upload feature
      
      // Prevent double-trigger while file dialog is open
      if (addPdfToLecture.__fileDialogOpen) return;
      addPdfToLecture.__fileDialogOpen = true;
      addPdfToLecture.disabled = true;
      if (!addPdfToLecture.__progress) addPdfToLecture.__progress = withButtonProgress(addPdfToLecture, 'Uploading PDF...');
      addPdfToLecture.__progress.start('Choose a PDF...');
      pdfInput.value = '';
      pdfInput.click();
      // If user cancels file picker, reset state after short delay
      const resetIfNoFile = setTimeout(() => {
        if (!pdfInput.files || pdfInput.files.length === 0) {
          addPdfToLecture.__progress.fail('Upload cancelled');
          addPdfToLecture.disabled = false;
          addPdfToLecture.__fileDialogOpen = false;
        }
      }, 1200);
      // Clean up flag once dialog action concludes
      pdfInput.onblur = () => {
        clearTimeout(resetIfNoFile);
        setTimeout(() => { addPdfToLecture.__fileDialogOpen = false; }, 100);
      };
    });

    pdfInput.addEventListener('change', async function(event) {
      const file = event.target.files[0];
      if (!file) return;
      
      // Prevent double generation
      if (isGenerating) {
        console.log("Generation already in progress, ignoring file upload");
        return;
      }
      
      // Clear any existing timeout
      clearTimeout(_loadingTimeout);
      
      // Show loading state and explicit phase text
      if (!addPdfToLecture.__progress) addPdfToLecture.__progress = withButtonProgress(addPdfToLecture, 'Uploading file...');
      addPdfToLecture.__progress.start('Uploading file...');
      showLoading("Uploading file...", addPdfToLecture);
      
      // Set a timeout to hide loading state after 3 minutes (in case something goes wrong)
      _loadingTimeout = setTimeout(() => {
        hideLoading(false);
        alert("Summary generation timed out. Please try again.");
      }, 180000); // 3 minutes
      
      // Disable buttons during upload
      addPdfToLecture.disabled = true;
      summarizeLectureOnly.disabled = true;
      
      try {
        // Prepare form data
        const formData = new FormData();
        formData.append('pdf', file);
        
        const response = await fetch('https://study-cap.com/api/upload-pdf', {
          method: 'POST',
          body: formData,
          credentials: 'include'
        });
        if (!response.ok) throw new Error('Failed to upload file');
        const data = await response.json();
        
        // Validate and refresh tab ID if needed
        let tabId = _activeTabId;
        if (!tabId) {
          const activeTab = await getActiveTab();
          if (!activeTab) {
            clearTimeout(_loadingTimeout);
            hideLoading();
            return;
          }
          tabId = activeTab.id;
          _activeTabId = tabId;
        }
        
        // Execute content script with PDF data
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: (pdfText) => {
            // Store PDF text in window object for content script to access
            window.pdfText = pdfText;
          },
          args: [data.captions]
        });
        
        // Switch progress text to generation phase
        try { addPdfToLecture.__progress.updateText('Generating summary...'); } catch(e) {}
        // Now execute the content script
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ["content.js"]
        });
        
        // Keep loading state active - the content script will handle completion
        
              } catch (err) {
          clearTimeout(_loadingTimeout);
          try { addPdfToLecture.__progress.fail('Upload failed'); } catch(e) {}
          hideLoading(false);
          alert('Error uploading file: ' + err.message);
        } finally {
        // Buttons will be re-enabled by hideLoading() when content script completes
        // or by the error handler if there's an error
      }
    });

    // PDF-only summary functionality redirects to dashboard for upload

    // Listen for messages from content script
    chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
      if (message.type === "CAPTIONS_LOADED") {
        clearTimeout(_loadingTimeout);
        
        // Hide loading and enable popup
        hideLoading();
        
        // Refresh the usage counter
        const accessData = await checkUserAccess();
        const limitData = await checkDailyLimit();
        
        if (!limitData.error) {
          const usedCount = limitData.remaining !== undefined ? 
            (getMaxLimitForTier(accessData.tier) - limitData.remaining) : 0;
          const limitCount = getMaxLimitForTier(accessData.tier);
          updateUsageCounter(usedCount, limitCount);
        }
      }
      
      // Handle content script errors
      if (message.type === "CONTENT_SCRIPT_ERROR") {
        console.error("Content script error:", message.error);
        clearTimeout(_loadingTimeout);
        hideLoading(false);
        alert("Error generating summary: " + (message.error || "Unknown error"));
      }
      
      
      // Handle immediate popup re-enable when redirecting to lecture viewer
      if (message.type === "REDIRECTING_TO_LECTURE_VIEWER") {
        clearTimeout(_loadingTimeout);
        hideLoading();
      }
      
      // Return true to indicate asynchronous response
      return true;
    });

    // Monitor for tab changes to detect when user is redirected to lecture viewer
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      // Check if this is the active tab and it's loading a lecture viewer page
      if (changeInfo.status === 'loading' && tab.url && tab.url.includes('/lecture-viewer')) {
        // Clear loading state when redirected
        clearTimeout(_loadingTimeout);
        hideLoading();
      }
    });

    if (manageSubscriptionsButton) {
      manageSubscriptionsButton.addEventListener("click", function(e) {
        e.preventDefault();
        window.open("https://study-cap.com/dashboard", "_blank");
      });
    }

    // Feedback button
    const feedbackButton = document.getElementById("feedbackButton");
    
    // Add click handler for feedback button
    if (feedbackButton) {
      feedbackButton.addEventListener("click", showFeedbackPopup);
    }
    
    // Check if we should show feedback popup based on timing
    checkFeedbackTiming();
    

  }
});



// Helper function to get max limit based on tier
function getMaxLimitForTier(tier) {
  if (tier.toLowerCase() === 'free') {
    return 3;
  } else if (tier.toLowerCase() === 'student') {
    return 25;
  } else if (tier.toLowerCase() === 'premium') {
    return 999; // Unlimited (high number)
  } else {
    return 3; // Default to free tier limit
  }
}


// Feedback-related functions
function showFeedbackPopup() {
  // Create background overlay with blur
  const overlay = document.createElement('div');
  overlay.className = 'popup-overlay';
  overlay.style.position = 'absolute';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
  overlay.style.backdropFilter = 'blur(4px)';
  overlay.style.zIndex = '1015';
  overlay.style.animation = 'fadeInOverlay 0.3s forwards';

  // Create the feedback popup
  const feedbackPopup = document.createElement('div');
  feedbackPopup.className = 'feedback-popup';
  
  // Create the feedback content
  const title = document.createElement('h3');
  title.textContent = 'Help Us Improve StudyCap';
  
  const description = document.createElement('p');
  description.textContent = 'Would you like to take a quick survey to help us make StudyCap better? It will only takes a minute!';
  
  const buttonsContainer = document.createElement('div');
  buttonsContainer.className = 'feedback-buttons';
  
  // Create the buttons
  const yesButton = document.createElement('button');
  yesButton.className = 'feedback-btn primary';
  yesButton.textContent = 'Yes, I\'ll help';
  
  const noButton = document.createElement('button');
  noButton.className = 'feedback-btn secondary';
  noButton.textContent = 'Not now';
  
  // Add event listeners
  yesButton.addEventListener('click', () => {
    // Update the last feedback time
    const now = new Date().getTime();
    chrome.storage.local.set({ lastFeedbackTime: now });
    
    // Open the feedback form in a new tab
    chrome.tabs.create({ url: 'https://study-cap.com/feedback' });
    
    // Close the popup
    document.querySelector('.rounded-popup').removeChild(overlay);
    document.querySelector('.rounded-popup').removeChild(feedbackPopup);
  });
  
  noButton.addEventListener('click', () => {
    // Update the last feedback time
    const now = new Date().getTime();
    chrome.storage.local.set({ lastFeedbackTime: now });
    
    // Close the popup
    document.querySelector('.rounded-popup').removeChild(overlay);
    document.querySelector('.rounded-popup').removeChild(feedbackPopup);
  });
  
  // Assemble the popup
  buttonsContainer.appendChild(yesButton);
  buttonsContainer.appendChild(noButton);
  
  feedbackPopup.appendChild(title);
  feedbackPopup.appendChild(description);
  feedbackPopup.appendChild(buttonsContainer);
  
  // Add to DOM
  document.querySelector('.rounded-popup').appendChild(overlay);
  document.querySelector('.rounded-popup').appendChild(feedbackPopup);
}

// Function to check if we should show the feedback popup
function checkFeedbackTiming() {
  chrome.storage.local.get(['firstUseTime', 'lastFeedbackTime'], (result) => {
    const now = new Date().getTime();
    
    // If this is the first use, record the time
    if (!result.firstUseTime) {
      chrome.storage.local.set({ firstUseTime: now });
      return;
    }
    
    // Get the last time feedback was shown or declined
    const lastFeedbackTime = result.lastFeedbackTime || 0;
    
    // Two days in milliseconds
    const twoDays = 2 * 24 * 60 * 60 * 1000;
    
    // 30 minutes in milliseconds
    const thirtyMinutes = 30 * 60 * 1000;
    
    // Show feedback if:
    // 1. It's been more than two days since the last feedback
    // 2. OR it's been at least 30 minutes since first use and feedback has never been shown
    if (
      (lastFeedbackTime > 0 && now - lastFeedbackTime > twoDays) || 
      (lastFeedbackTime === 0 && now - result.firstUseTime > thirtyMinutes)
    ) {
      showFeedbackPopup();
    }
  });
}

(async () => {

  function generateLectureId(url) {
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }

  async function extractCaptions(tier) {
    try {
      const currentUrl = window.location.href;
      
      let lectureTitle = "Untitled Lecture";
      const titleSelectors = [
        ".video-title",
        ".video-title-text",
        "h1",
        ".title-text",
        ".lecture-title"
      ];
      
      for (const selector of titleSelectors) {
        const titleElement = document.querySelector(selector);
        if (titleElement && titleElement.textContent.trim()) {
          lectureTitle = titleElement.textContent.trim();
          break;
        }
      }
      

      const captionElements = document.querySelectorAll(".event-tab-scroll-pane .index-event-row .event-text span");
      
      // Determine source: Panopto captions or PDF-enhanced flow
      const hasPanoptoCaptions = captionElements.length > 0;
      const pdfText = window.pdfText;
      
      if (hasPanoptoCaptions || (pdfText && pdfText.trim())) {
      const captions = hasPanoptoCaptions
        ? Array.from(captionElements).map(el => el.innerText.trim()).join('\n')
        : ""; // If no Panopto captions but PDF provided, captions will be empty

      // Generate lecture ID first (before generating summary)
      const lectureId = generateLectureId(currentUrl);
      
      // Open lecture viewer immediately with generating state
      const lectureViewerUrl = `https://study-cap.com/lecture-viewer?id=${lectureId}&generating=true`;
      let viewerWindow = window.open(lectureViewerUrl, '_blank');
      
      // Send message to popup that we're about to redirect
      chrome.runtime.sendMessage({ type: "REDIRECTING_TO_LECTURE_VIEWER" });

      try {
        const summary = await summarizeCaptions(captions, tier, pdfText);

        const htmlContent = parseSummaryToHTML(summary);

        try {
          // Always use replace endpoint - it handles both new and existing lectures
          const response = await fetch("https://study-cap.com/api/lectures/replace", {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              lecture_id: lectureId,
              url: currentUrl,
              summary: htmlContent,
              timestamp: new Date().toISOString(),
              title: lectureTitle
            })
          });

          if (!response.ok) {
            throw new Error(`Failed to save lecture: ${response.status}`);
          } else {
            await response.json();
            console.log("Lecture saved successfully");
            
            // Update the lecture viewer by removing the generating parameter
            // Add a small delay to ensure database commit is complete, and add cache-busting parameter
            if (viewerWindow && !viewerWindow.closed) {
              // Wait a bit to ensure database commit is complete
              setTimeout(() => {
                // Add timestamp as cache-busting parameter to ensure fresh data is loaded
                const timestamp = Date.now();
                viewerWindow.location.href = `https://study-cap.com/lecture-viewer?id=${lectureId}&_t=${timestamp}`;
              }, 500);
            }
          }
        } catch (error) {
          console.error("Error saving lecture to database:", error);
          // If there's an error, still try to update the viewer to show error
          if (viewerWindow && !viewerWindow.closed) {
            viewerWindow.location.href = `https://study-cap.com/lecture-viewer?id=${lectureId}&error=true`;
          }
        } finally {
          // Always send completion message, regardless of success or failure
          chrome.runtime.sendMessage({ type: "CAPTIONS_LOADED" });
        }
        
        if (window.pdfText) {
          delete window.pdfText;
        }

      } catch (error) {
        console.error("Error summarizing captions:", error);
        
        // Update the lecture viewer to show error state
        if (viewerWindow && !viewerWindow.closed) {
          viewerWindow.location.href = `https://study-cap.com/lecture-viewer?id=${lectureId}&error=true`;
        }
        
        // Send error message to popup
        chrome.runtime.sendMessage({ 
          type: "CONTENT_SCRIPT_ERROR", 
          error: error.message || "Unknown error occurred" 
        });
      }
      } else {
        // No Panopto captions and no PDF content
        alert("No captions found on this page.");
        
        chrome.runtime.sendMessage({ type: "CAPTIONS_LOADED" });
      }
    } catch (error) {
      console.error("Error in extractCaptions:", error);
      alert("Error extracting captions: " + error.message);
      
      // Send error message to popup
      chrome.runtime.sendMessage({ 
        type: "CONTENT_SCRIPT_ERROR", 
        error: error.message || "Failed to extract captions" 
      });
    }
  }
  
  async function summarizeCaptions(captions, tier, pdfText = null) {
    return await generateSummary(captions, pdfText);
  }
  
  async function generateSummary(captions, pdfText = null) {
    function estimateTokens(text) {
        return Math.ceil(text.length / 4);
    }
    
    const captionsTokens = estimateTokens(captions);
    const pdfTokens = pdfText ? estimateTokens(pdfText) : 0;
    const totalInputTokens = captionsTokens + pdfTokens;
    
    const MAX_TOKENS = 20000;
    if (totalInputTokens > MAX_TOKENS) {
        throw new Error(`Input too large: ${totalInputTokens} tokens exceeds limit of ${MAX_TOKENS} tokens.`);
    }
    
    const response = await fetch('https://study-cap.com/api/generate', {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type: "summary",
        captions: captions,
        pdfText: pdfText || null
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Unknown error');
    }
    
    if (!data.content) {
      throw new Error('Invalid response format from server');
    }
    
    return data.content;
  }

  function parseSummaryToHTML(rawSummary) {
    const lines = rawSummary.split("\n");
    let htmlOutput = "";
    let mathBlockLines = null;
    let currentIndentLevel = 0;
    let inBulletList = false;
    let listType = null;
  
    for (let line of lines) {
        if (mathBlockLines !== null) {
            mathBlockLines.push(line);
            if (line.trim().endsWith("\\]")) {
                htmlOutput += mathBlockLines.join("\n");
                mathBlockLines = null;
            }
            continue;
        }
  
        if (line.trim().startsWith("\\[") && !line.trim().endsWith("\\]")) {
            mathBlockLines = [line];
            continue;
        }
  
        if (line.trim().startsWith("\\[") && line.trim().endsWith("\\]")) {
            htmlOutput += line;
            continue;
        }
  
        const indentMatch = line.match(/^(\s*)/);
        const indent = indentMatch ? indentMatch[0].length : 0;
        const trimmedLine = line.trim();
        const isBulletPoint = trimmedLine.startsWith("* ");
        const isDashPoint = trimmedLine.startsWith("- ");
        const isListItem = isBulletPoint || isDashPoint;
        const newListType = isBulletPoint ? 'bullet' : isDashPoint ? 'dash' : null;
        
        if (inBulletList && (indent !== currentIndentLevel || newListType !== listType)) {
            htmlOutput += "</ul>";
            inBulletList = false;
            listType = null;
        }
  
        if (line.startsWith("## ")) {
            htmlOutput += `<h2>${escapeHTML(line.replace("## ", ""))}</h2>`;
        } else if (line.startsWith("### ")) {
            htmlOutput += `<h3>${escapeHTML(line.replace("### ", ""))}</h3>`;
        } else if (line.startsWith("#### ")) {
            htmlOutput += `<h4>${escapeHTML(line.replace("#### ", ""))}</h4>`;
        } else if (line.startsWith("# ")) {
            htmlOutput += `<h1>${escapeHTML(line.replace("# ", ""))}</h1>`;
        } else if (isListItem) {
            if (!inBulletList) {
                htmlOutput += `<ul style="margin-left: ${indent * 20}px;">`;
                inBulletList = true;
                currentIndentLevel = indent;
                listType = newListType;
            }
            const content = parseBold(trimmedLine.replace(/^[*\-]\s+/, ""));
            htmlOutput += `<li>${content}</li>`;
        } else {
            const parsedLine = parseBold(line);
            if (parsedLine.trim()) {
                htmlOutput += `<p>${parsedLine}</p>`;
            }
        }
    }
  
    if (inBulletList) {
        htmlOutput += "</ul>";
    }
  
    return htmlOutput;
  }

  function parseBold(text) {
    return text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  }

  function escapeHTML(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Simplified function to get user tier - uses same endpoint as popup but only extracts tier
  async function checkUserTier() {
    try {
      const res = await fetch('https://study-cap.com/api/check_access', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();

      if (res.ok && data.access) {
        return data.tier;
      } else {
        console.warn('No access:', data.error);
        return null;
      }
    } catch (err) {
      console.error('Error checking tier:', err);
      return null;
    }
  }

  const tier = await checkUserTier();
  extractCaptions(tier);
})();

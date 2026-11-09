document.addEventListener("DOMContentLoaded", () => {
  // Configurable constant for spacing between pages (in mm)
  const PAGE_SPACING = 2; // You can change this value to adjust spacing between pages
  
  window.studycapDownloads = {
    downloadPDF: () => startDownloadWorkflow('pdf'),
    downloadDOC: () => startDownloadWorkflow('doc')
  };

  async function startDownloadWorkflow(format) {
    const allowed = await ensureDownloadAccess();
    if (!allowed) return false;

    if (format === 'pdf') {
      await generatePDF();
    } else {
      generateDOC();
    }
    
    return true;
  }

  async function ensureDownloadAccess() {
    try {
      const tierResponse = await fetch('/api/check_access', {
        credentials: 'include'
      });
      await tierResponse.json();
      return true;
    } catch (error) {
      console.error('Error checking user tier:', error);
      window.open('/dashboard', '_blank');
      return false;
    }
  }
  
  // Function to generate PDF
  async function generatePDF() {
    try {
      // Load jsPDF library if not already loaded
      if (typeof jspdf === 'undefined') {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      }
      
      // Load html2canvas for rendering
      if (typeof html2canvas === 'undefined') {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
      }
      
      // Get the title element if it exists
      let titleElement = document.querySelector(".lecture-title");
      let titleText = titleElement ? titleElement.textContent : "Lecture Summary";
      
      // Retrieve the summary element
      const summaryElement = document.getElementById("summary");
      
      // Create temporary styled container for PDF rendering with Outfit font
      const container = document.createElement("div");
      container.id = "pdf-container";
      container.style.position = "absolute";
      container.style.left = "-9999px";
      container.style.fontFamily = "'Outfit', sans-serif";
      container.style.width = "800px";
      container.style.padding = `${40 + PAGE_SPACING}px ${40}px ${40 + PAGE_SPACING}px ${40}px`; // Add spacing to top and bottom
      container.style.backgroundColor = "#fff";
      document.body.appendChild(container);
      
      // Add StudyCap as plain text without any banner
      const bannerText = document.createElement("h1");
      bannerText.textContent = "StudyCap";
      bannerText.style.textAlign = "center";
      bannerText.style.margin = "0 0 20px 0";
      bannerText.style.padding = "0";
      bannerText.style.fontSize = "42px";
      bannerText.style.fontWeight = "bold";
      bannerText.style.color = "#673ab7"; // Solid purple color
      bannerText.style.background = "none";
      bannerText.style.backgroundColor = "transparent";
      container.appendChild(bannerText);
      
      // Create the header without gradient background
      const header = document.createElement("div");
      header.style.textAlign = "center";
      header.style.marginBottom = `${40 + PAGE_SPACING}px`; // Add extra spacing after header
      header.style.background = "none"; // Ensure no background gradient in the header
      header.style.backgroundColor = "transparent";
      
      // Add title
      const title = document.createElement("h2");
      title.textContent = titleText;
      title.style.fontSize = "24px";
      title.style.color = "#673ab7";
      title.style.margin = "20px 0";
      title.style.fontWeight = "600";
      header.appendChild(title);
      
      container.appendChild(header);
      
      // Add styled content
      const content = document.createElement("div");
      content.style.lineHeight = "1.6";
      content.style.fontSize = "14px";
      content.style.color = "#2d3748";
      content.style.background = "none";
      content.style.backgroundColor = "transparent";
      
      // Clone the summary content and remove any background styling
      const summaryClone = summaryElement.cloneNode(true);
      // Remove any background styling from the cloned content
      const allElements = summaryClone.querySelectorAll('*');
      allElements.forEach(el => {
        el.style.background = 'none';
        el.style.backgroundColor = 'transparent';
        el.style.backgroundImage = 'none';
      });
      
      content.innerHTML = summaryClone.innerHTML;
      
      // Style the content headings and lists
      const styleContent = () => {
        const sectionHeadings = content.querySelectorAll(".summary-section");
        sectionHeadings.forEach(heading => {
          heading.style.color = "#673ab7";
          heading.style.fontSize = "18px";
          heading.style.borderBottom = "1px solid rgba(103,58,183,0.2)";
          heading.style.paddingBottom = "8px";
          heading.style.marginTop = "15px";
          heading.style.marginBottom = "15px";
          heading.style.fontWeight = "500";
        });
        
        const lists = content.querySelectorAll("ul");
        lists.forEach(list => {
          list.style.paddingLeft = "20px";
          list.style.marginLeft = "5px";
          list.style.marginBottom = "15px";
        });
        
        const listItems = content.querySelectorAll("li");
        listItems.forEach(item => {
          item.style.marginBottom = "8px";
          item.style.paddingLeft = "5px";
        });
      };
      
      styleContent();
      container.appendChild(content);
      
      // Add footer
      const footer = document.createElement("div");
      footer.style.marginTop = `${40 + PAGE_SPACING}px`; // Add extra spacing before footer
      footer.style.textAlign = "center";
      footer.style.color = "#718096";
      footer.style.fontSize = "12px";
      footer.style.borderTop = "1px solid #e2e8f0";
      footer.style.paddingTop = "15px";
      
      const footerText = document.createElement("p");
      footerText.textContent = "Generated by StudyCap • " + new Date().toLocaleDateString();
      footer.appendChild(footerText);
      
      container.appendChild(footer);
      
      // Create PDF with jsPDF
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });
      
      // Calculate dimensions
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const marginTop = 10; // mm
      const marginLeft = 15; // mm
      const marginBottom = 20; // mm
      const availableWidth = pdfWidth - (marginLeft * 2);
      const availableHeight = pdfHeight - marginTop - marginBottom;
      
      // Function to render a page of content
      const renderPage = async (content, pageNumber, totalPages) => {
        const pageContainer = document.createElement("div");
        pageContainer.style.position = "absolute";
        pageContainer.style.left = "-9999px";
        pageContainer.style.fontFamily = "'Outfit', sans-serif";
        pageContainer.style.width = "800px";
        pageContainer.style.padding = `${20 + PAGE_SPACING}px ${30}px ${20 + PAGE_SPACING}px ${30}px`;
        pageContainer.style.backgroundColor = "#fff";
        pageContainer.style.minHeight = "100vh"; // Ensure minimum height
        document.body.appendChild(pageContainer);
        
        // Add StudyCap title (only on first page)
        if (pageNumber === 1) {
          const bannerText = document.createElement("h1");
          bannerText.textContent = "StudyCap";
          bannerText.style.textAlign = "center";
          bannerText.style.margin = "0 0 10px 0";
          bannerText.style.padding = "0";
          bannerText.style.fontSize = "42px";
          bannerText.style.fontWeight = "bold";
          bannerText.style.color = "#673ab7";
          bannerText.style.background = "none";
          bannerText.style.backgroundColor = "transparent";
          pageContainer.appendChild(bannerText);
          
          // Add lecture title
          const title = document.createElement("h2");
          title.textContent = titleText;
          title.style.fontSize = "24px";
          title.style.color = "#673ab7";
          title.style.margin = "10px 0 20px 0"; // Added bottom margin
          title.style.fontWeight = "600";
          title.style.textAlign = "center";
          pageContainer.appendChild(title);
        }
        
        // Add content for this page
        const contentDiv = document.createElement("div");
        contentDiv.style.lineHeight = "1.6";
        contentDiv.style.fontSize = "14px";
        contentDiv.style.color = "#2d3748";
        contentDiv.style.background = "none";
        contentDiv.style.backgroundColor = "transparent";
        contentDiv.style.wordWrap = "break-word"; // Prevent overflow
        contentDiv.style.overflowWrap = "break-word"; // Additional word breaking
        contentDiv.innerHTML = content;
        
        // Style the content with better spacing
        const stylePageContent = (container) => {
          const sectionHeadings = container.querySelectorAll(".summary-section");
          sectionHeadings.forEach(heading => {
            heading.style.color = "#673ab7";
            heading.style.fontSize = "18px";
            heading.style.borderBottom = "1px solid rgba(103,58,183,0.2)";
            heading.style.paddingBottom = "8px";
            heading.style.marginTop = "20px"; // Increased top margin
            heading.style.marginBottom = "15px";
            heading.style.fontWeight = "500";
            heading.style.pageBreakAfter = "avoid"; // Try to keep heading with content
          });
          
          const lists = container.querySelectorAll("ul, ol");
          lists.forEach(list => {
            list.style.paddingLeft = "20px";
            list.style.marginLeft = "5px";
            list.style.marginBottom = "15px";
            list.style.pageBreakInside = "avoid"; // Try to keep lists together
          });
          
          const listItems = container.querySelectorAll("li");
          listItems.forEach(item => {
            item.style.marginBottom = "8px";
            item.style.paddingLeft = "5px";
            item.style.pageBreakInside = "avoid"; // Try to keep list items together
          });
          
          const paragraphs = container.querySelectorAll("p");
          paragraphs.forEach(p => {
            p.style.marginBottom = "12px";
            p.style.pageBreakInside = "avoid"; // Try to keep paragraphs together
          });
          
          // Handle any remaining headings
          const allHeadings = container.querySelectorAll("h1, h2, h3, h4, h5, h6");
          allHeadings.forEach(heading => {
            if (!heading.classList.contains("summary-section")) {
              heading.style.color = "#673ab7";
              heading.style.fontSize = "16px";
              heading.style.marginTop = "15px";
              heading.style.marginBottom = "10px";
              heading.style.fontWeight = "500";
              heading.style.pageBreakAfter = "avoid";
            }
          });
        };
        
        stylePageContent(contentDiv);
        pageContainer.appendChild(contentDiv);
        
        // Add footer (only on last page)
        if (pageNumber === totalPages) {
          const footer = document.createElement("div");
          footer.style.marginTop = `${20 + PAGE_SPACING}px`; // Increased margin
          footer.style.textAlign = "center";
          footer.style.color = "#718096";
          footer.style.fontSize = "12px";
          footer.style.borderTop = "1px solid #e2e8f0";
          footer.style.paddingTop = "15px";
          
          const footerText = document.createElement("p");
          footerText.textContent = "Generated by StudyCap • " + new Date().toLocaleDateString();
          footer.appendChild(footerText);
          pageContainer.appendChild(footer);
        }
        
        // Render to canvas with better options
        const canvas = await html2canvas(pageContainer, {
          scale: 2,
          useCORS: true,
          logging: false,
          allowTaint: true,
          backgroundColor: "#ffffff",
          height: pageContainer.scrollHeight,
          width: pageContainer.scrollWidth
        });
        
        // Remove temporary container
        document.body.removeChild(pageContainer);
        
        return canvas;
      };
      
      // Split content into pages with better section handling
      const splitContentIntoPages = (content) => {
        const pages = [];
        const contentDiv = document.createElement('div');
        contentDiv.innerHTML = content;
        
        // Get all content including text between sections
        const allContent = contentDiv.innerHTML;
        
        // Split by sections but include all content between them
        const sectionMatches = allContent.match(/<h[1-6][^>]*class="summary-section"[^>]*>.*?<\/h[1-6]>|<h[1-6][^>]*>.*?<\/h[1-6]>/g) || [];
        
        if (sectionMatches.length === 0) {
          // If no sections found, split by paragraphs or other elements
          return splitContentByElements(allContent);
        }
        
        let currentPage = '';
        let currentHeight = 0;
        const maxHeight = 800; // Approximate max height for one page
        
        // Process each section and its following content
        for (let i = 0; i < sectionMatches.length; i++) {
          const section = sectionMatches[i];
          const sectionStart = allContent.indexOf(section);
          
          // Find the next section or end of content
          const nextSectionStart = i < sectionMatches.length - 1 ? 
            allContent.indexOf(sectionMatches[i + 1]) : allContent.length;
          
          // Get the full content for this section (including text after the heading)
          const sectionContent = allContent.substring(sectionStart, nextSectionStart);
          
          // Create a temporary div to measure height
          const tempDiv = document.createElement('div');
          tempDiv.style.position = 'absolute';
          tempDiv.style.left = '-9999px';
          tempDiv.style.width = '800px';
          tempDiv.style.fontFamily = "'Outfit', sans-serif";
          tempDiv.style.fontSize = '14px';
          tempDiv.style.lineHeight = '1.6';
          tempDiv.innerHTML = sectionContent;
          document.body.appendChild(tempDiv);
          
          const sectionHeight = tempDiv.scrollHeight;
          document.body.removeChild(tempDiv);
          
          // If this section alone exceeds max height, split it further
          if (sectionHeight > maxHeight) {
            // If current page has content, save it first
            if (currentPage !== '') {
              pages.push(currentPage);
              currentPage = '';
              currentHeight = 0;
            }
            
            // Split the large section into smaller parts
            const sectionPages = splitLargeSection(sectionContent, maxHeight);
            pages.push(...sectionPages);
          } else if (currentHeight + sectionHeight > maxHeight && currentPage !== '') {
            // Current page is full, start new page with this section
            pages.push(currentPage);
            currentPage = sectionContent;
            currentHeight = sectionHeight;
          } else {
            // Add section to current page
            currentPage += sectionContent;
            currentHeight += sectionHeight;
          }
        }
        
        if (currentPage !== '') {
          pages.push(currentPage);
        }
        
        return pages;
      };
      
      // Helper function to split content by elements when no sections are found
      const splitContentByElements = (content) => {
        const pages = [];
        const contentDiv = document.createElement('div');
        contentDiv.innerHTML = content;
        
        // Split by paragraphs, lists, or other block elements
        const elements = contentDiv.querySelectorAll('p, ul, ol, div, h1, h2, h3, h4, h5, h6');
        
        if (elements.length === 0) {
          return [content];
        }
        
        let currentPage = '';
        let currentHeight = 0;
        const maxHeight = 800;
        
        elements.forEach(element => {
          const elementHTML = element.outerHTML;
          
          // Create a temporary div to measure height
          const tempDiv = document.createElement('div');
          tempDiv.style.position = 'absolute';
          tempDiv.style.left = '-9999px';
          tempDiv.style.width = '800px';
          tempDiv.style.fontFamily = "'Outfit', sans-serif";
          tempDiv.style.fontSize = '14px';
          tempDiv.style.lineHeight = '1.6';
          tempDiv.innerHTML = elementHTML;
          document.body.appendChild(tempDiv);
          
          const elementHeight = tempDiv.scrollHeight;
          document.body.removeChild(tempDiv);
          
          if (currentHeight + elementHeight > maxHeight && currentPage !== '') {
            pages.push(currentPage);
            currentPage = elementHTML;
            currentHeight = elementHeight;
          } else {
            currentPage += elementHTML;
            currentHeight += elementHeight;
          }
        });
        
        if (currentPage !== '') {
          pages.push(currentPage);
        }
        
        return pages;
      };
      
      // Helper function to split large sections into smaller parts
      const splitLargeSection = (sectionContent, maxHeight) => {
        const pages = [];
        const contentDiv = document.createElement('div');
        contentDiv.innerHTML = sectionContent;
        
        // Get the section heading
        const heading = contentDiv.querySelector('h1, h2, h3, h4, h5, h6');
        const headingHTML = heading ? heading.outerHTML : '';
        
        // Get all content after the heading
        const contentAfterHeading = contentDiv.innerHTML.replace(headingHTML, '');
        
        // Split by paragraphs, lists, or other block elements
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = contentAfterHeading;
        const elements = tempDiv.querySelectorAll('p, ul, ol, div, h1, h2, h3, h4, h5, h6');
        
        if (elements.length === 0) {
          // If no elements found, try to split by text content
          return splitByTextContent(sectionContent, maxHeight);
        }
        
        let currentPage = headingHTML; // Start with the heading
        let currentHeight = 0;
        
        // Measure heading height
        const headingDiv = document.createElement('div');
        headingDiv.style.position = 'absolute';
        headingDiv.style.left = '-9999px';
        headingDiv.style.width = '800px';
        headingDiv.style.fontFamily = "'Outfit', sans-serif";
        headingDiv.style.fontSize = '14px';
        headingDiv.style.lineHeight = '1.6';
        headingDiv.innerHTML = headingHTML;
        document.body.appendChild(headingDiv);
        currentHeight = headingDiv.scrollHeight;
        document.body.removeChild(headingDiv);
        
        elements.forEach(element => {
          const elementHTML = element.outerHTML;
          
          // Create a temporary div to measure height
          const tempDiv = document.createElement('div');
          tempDiv.style.position = 'absolute';
          tempDiv.style.left = '-9999px';
          tempDiv.style.width = '800px';
          tempDiv.style.fontFamily = "'Outfit', sans-serif";
          tempDiv.style.fontSize = '14px';
          tempDiv.style.lineHeight = '1.6';
          tempDiv.innerHTML = elementHTML;
          document.body.appendChild(tempDiv);
          
          const elementHeight = tempDiv.scrollHeight;
          document.body.removeChild(tempDiv);
          
          if (currentHeight + elementHeight > maxHeight && currentPage !== headingHTML) {
            pages.push(currentPage);
            currentPage = elementHTML;
            currentHeight = elementHeight;
          } else {
            currentPage += elementHTML;
            currentHeight += elementHeight;
          }
        });
        
        if (currentPage !== '') {
          pages.push(currentPage);
        }
        
        return pages;
      };
      
      // Helper function to split content by text when no block elements are found
      const splitByTextContent = (content, maxHeight) => {
        const pages = [];
        const contentDiv = document.createElement('div');
        contentDiv.innerHTML = content;
        
        // Split by sentences or paragraphs
        const text = contentDiv.textContent || contentDiv.innerText;
        const sentences = text.split(/[.!?]\s+/);
        
        let currentPage = '';
        let currentHeight = 0;
        
        sentences.forEach(sentence => {
          const sentenceHTML = `<p>${sentence.trim()}</p>`;
          
          // Create a temporary div to measure height
          const tempDiv = document.createElement('div');
          tempDiv.style.position = 'absolute';
          tempDiv.style.left = '-9999px';
          tempDiv.style.width = '800px';
          tempDiv.style.fontFamily = "'Outfit', sans-serif";
          tempDiv.style.fontSize = '14px';
          tempDiv.style.lineHeight = '1.6';
          tempDiv.innerHTML = sentenceHTML;
          document.body.appendChild(tempDiv);
          
          const sentenceHeight = tempDiv.scrollHeight;
          document.body.removeChild(tempDiv);
          
          if (currentHeight + sentenceHeight > maxHeight && currentPage !== '') {
            pages.push(currentPage);
            currentPage = sentenceHTML;
            currentHeight = sentenceHeight;
          } else {
            currentPage += sentenceHTML;
            currentHeight += sentenceHeight;
          }
        });
        
        if (currentPage !== '') {
          pages.push(currentPage);
        }
        
        return pages;
      };
      
      // Split the content
      const contentPages = splitContentIntoPages(summaryClone.innerHTML);
      
      // Render each page
      for (let i = 0; i < contentPages.length; i++) {
        if (i > 0) {
          pdf.addPage();
        }
        
        const canvas = await renderPage(contentPages[i], i + 1, contentPages.length);
        const imgData = canvas.toDataURL("image/jpeg", 1.0);
        
        pdf.addImage(
          imgData,
          "JPEG",
          marginLeft,
          marginTop,
          availableWidth,
          availableWidth * (canvas.height / canvas.width)
        );
      }
      
      // Add page numbers
      for (let i = 1; i <= contentPages.length; i++) {
        pdf.setPage(i);
        pdf.setFontSize(10);
        pdf.setTextColor(150, 150, 150);
        pdf.text(`Page ${i} of ${contentPages.length}`, pdfWidth / 2, pdfHeight - (marginBottom / 2), {
          align: "center"
        });
      }
      
      // Remove the temporary container
      document.body.removeChild(container);
      
      // Download the PDF
      pdf.save(`${titleText.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_summary.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("There was an error generating the PDF. Please try again.");
    } finally {
      // no-op
    }
  }
  
  // Function to generate DOC
  function generateDOC() {
    try {
      // Get the title element if it exists
      let titleElement = document.querySelector(".lecture-title");
      let titleText = titleElement ? titleElement.textContent : "Lecture Summary";
      
      // Retrieve the summary HTML from the "summary" element
      const summaryHTML = document.getElementById("summary").innerHTML;
      
      // Create a Word-compatible HTML document
      const docContent = `
      <!DOCTYPE html>
      <html xmlns:o="urn:schemas-microsoft-com:office:office" 
            xmlns:w="urn:schemas-microsoft-com:office:word"
            xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <title>${titleText} - StudyCap</title>
        <!-- Word specific styling -->
        <style>
          @page {
            size: 8.5in 11in;
            margin: 1in;
          }
          body {
            font-family: Calibri, Arial, sans-serif;
            line-height: 1.5;
          }
          /* Plain text style for StudyCap - no background */
          .studycap-title {
            text-align: center;
            font-size: 42pt;
            font-weight: bold;
            color: #673ab7;
            margin: 0 0 20pt 0;
            padding: 0;
            background: none;
            background-color: transparent;
          }
          h2 {
            color: #673ab7;
            font-size: 18pt;
            border-bottom: 1pt solid #673ab7;
            margin-top: 14pt;
          }
          h3.summary-section {
            color: #673ab7;
            font-size: 14pt;
            border-bottom: 1pt solid rgba(103,58,183,0.2);
            padding-bottom: 6pt;
            margin-top: 12pt;
          }
          ul {
            margin-left: 12pt;
            padding-left: 12pt;
          }
          li {
            margin-bottom: 6pt;
          }
          .footer {
            margin-top: 24pt;
            text-align: center;
            font-size: 9pt;
            color: #718096;
            border-top: 1pt solid #e2e8f0;
            padding-top: 12pt;
          }
          /* SVG logo fallback for Word */
          .svg-fallback {
            text-align: center;
            margin-bottom: 20pt;
          }
        </style>
      </head>
      <body>
        <!-- Plain text for StudyCap - no background -->
        <h1 class="studycap-title">StudyCap</h1>
        <h2>${titleText}</h2>
        <div class="content">
          ${summaryHTML}
        </div>
        <div class="footer">
          <p>Generated by StudyCap • ${new Date().toLocaleDateString()}</p>
        </div>
      </body>
      </html>
      `;
      
      // Create a Blob with the HTML content formatted for Word
      const blob = new Blob([docContent], { type: "application/msword" });
      
      // Create an object URL for the Blob
      const url = URL.createObjectURL(blob);
      
      // Create a temporary link element with the download attribute
      const a = document.createElement("a");
      a.href = url;
      a.download = `${titleText.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_summary.doc`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error generating DOC:", error);
      alert("There was an error generating the DOC file. Please try again.");
    } finally {
      // no-op
    }
  }
  
  // Helper function to load external scripts
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
}); 
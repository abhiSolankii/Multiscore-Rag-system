import html2pdf from "html2pdf.js";
import { marked } from "marked";
/**
 * pdfExport.js
 * High-quality structured PDF generation from Markdown.
 * Uses 'marked' for Markdown -> HTML and 'html2pdf.js' for HTML -> PDF.
 */

export const stripCitations = (content) =>
  content?.replace(/\[\[Chunk \d+\]\]/gi, "").trim() ?? "";

export const exportMessageAsPdf = (content, chatTitle = "Chat Response") => {
  try {
    const cleanContent = stripCitations(content);
    const htmlContent = marked.parse(cleanContent);
    const timestamp = new Date().toLocaleString();

    // Container for styling the PDF content
    const element = document.createElement("div");
    element.innerHTML = `
      <div style="font-family: 'Helvetica', 'Arial', sans-serif; padding: 40px; color: #1a1a1a; line-height: 1.6; max-width: 800px;">
        <h1 style="color: #111; margin-bottom: 8px; font-size: 24px;">${chatTitle}</h1>
        <p style="color: #666; font-size: 11px; margin-bottom: 24px; border-bottom: 2px solid #eee; padding-bottom: 12px;">
          Exported on ${timestamp}
        </p>
        <div style="font-size: 14px; text-align: justify;">
          ${htmlContent}
        </div>
      </div>
    `;

    // High quality PDF options
    const opt = {
      margin: 10,
      filename: `${chatTitle.replace(/\s+/g, "_")}_${Date.now()}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    };

    // Use html2pdf to generate and save
    html2pdf().from(element).set(opt).save();
  } catch (err) {
    console.error("Structured PDF Export Error:", err);
    alert("Failed to generate structured PDF. Check console.");
  }
};

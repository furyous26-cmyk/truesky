"use strict";

import { sharedNatal } from "./sharedNatal.js";
import { openSafariPrintView, isSafariMode } from "./js/safariPrintView.js";

document.addEventListener("DOMContentLoaded", function () {
  const svgContainer = d3.select("#return-chart");
  sharedNatal(
    svgContainer,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    "return"
  );
});

// Print return chart
document.getElementById("returnPrint").addEventListener("click", function () {
  const chart = document.getElementById("return-chart");
  if (!chart) return;
  const returnType = document.getElementById("adjustType")?.value || "";

  if (isSafariMode()) {
    // Safari mode - open in new window with title modifier
    const label =
      returnType.toLowerCase() === "lunar" ? "Lunar Return" : "Solar Return";
    openSafariPrintView("return-chart", label, (titleText) => {
      if (!titleText.dataset.originalText) {
        titleText.dataset.originalText = titleText.textContent;
      }
      titleText.textContent = `${titleText.dataset.originalText} - ${label}`;
    });
  } else {
    // Standard mode - use browser print
    const titleText = chart.querySelector("svg .birth-details text");

    if (titleText && !titleText.dataset.originalText) {
      // Save the original name
      titleText.dataset.originalText = titleText.textContent;
    }

    if (titleText) {
      // Append return type
      const label =
        returnType.toLowerCase() === "lunar" ? "Lunar Return" : "Solar Return";
      titleText.textContent = `${titleText.dataset.originalText} - ${label}`;
    }

    // Ensure chart is in view for printing
    const y = chart.getBoundingClientRect().top + window.pageYOffset;
    window.scrollTo(0, y);

    // Trigger print
    window.print();

    // Restore original text
    if (titleText) {
      setTimeout(() => {
        titleText.textContent = titleText.dataset.originalText;
      }, 1000);
    }
  }
});

// Return report
document.getElementById("returnReport")?.addEventListener("click", function () {
  // For Safari, open window immediately to avoid popup blocking
  const isSafari =
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  let printWindow = null;
  if (isSafari) {
    printWindow = window.open("", "PrintChart", "width=1000,height=1200");
    if (printWindow) {
      printWindow.document.write(
        "<html><body><p>Loading report...</p></body></html>"
      );
    }
  }

    fetch("/view-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
    credentials: "same-origin",
  })
    .then((response) => response.json())
    .then((data) => {
      if (false && data.redirectUrl) {
        if (printWindow) printWindow.close();
        window.location.href = data.redirectUrl;
        return;
      }

      if (data.success) {
        // Call the return report generation function
        window.generateReturnReport(printWindow);
      }
    })
    .catch((error) => {
      if (printWindow) printWindow.close();
      console.error("Error preparing report:", error);
    });
});

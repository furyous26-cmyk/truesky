"use strict";

import { sharedNatal } from "./sharedNatal.js";
import { openSafariPrintView, isSafariMode } from "./js/safariPrintView.js";

document.addEventListener("DOMContentLoaded", function () {
  const svgContainer = d3.select("#synastry-chart");

  // Move house circles closer to center
  const signInner = 2.27;
  const houseOuter = 7.5;
  const houseInner = 9;
  const houseNumber = `16px`;
  const planetCircle = 4.2;
  const innerWheel = 0.64;
  const middleWheel = false;
  const innerPlanet = 1;
  const centerPlanet = 3.25;
  const outerPlanet = 2.5;
  const removeHouseTicks = true;

  // Call sharedNatal with the custom parameters for triwheel chart
  sharedNatal(
    svgContainer,
    signInner,
    houseOuter,
    houseInner,
    houseNumber,
    planetCircle,
    innerWheel,
    middleWheel,
    innerPlanet,
    centerPlanet,
    outerPlanet,
    removeHouseTicks,
    "synastry"
  );

  function openBlankSynastryWheel() {
    const form = document.getElementById("synastryForm");
    const storedNatalData = JSON.parse(localStorage.getItem("natalData") || "null");
    if (!form || !storedNatalData?.day || !storedNatalData?.month || !storedNatalData?.year) return;

    const hasPerson2Date = ["synastryDay", "synastryMonth", "synastryYear"].some((id) => {
      const el = document.getElementById(id);
      return el && String(el.value || "").trim() !== "";
    });

    // If Person 2 is not filled yet, draw the synastry base wheel open and keep
    // the second circle empty until Calculate is clicked with Person 2 data.
    if (!hasPerson2Date) {
      window.synastryPlanets = [];
      window.synastryData = null;
      form.dataset.baseOnly = "true";
      form.requestSubmit();
    }
  }

  document.getElementById("synastry-button")?.addEventListener("click", () => {
    setTimeout(openBlankSynastryWheel, 0);
  });

  document.addEventListener("synastry:shown", openBlankSynastryWheel);

  if (document.getElementById("showSynastry")?.style.display !== "none") {
    openBlankSynastryWheel();
  }
});

// Print synastry chart
document.getElementById("synastryPrint").addEventListener("click", function () {
  const chart = document.getElementById("synastry-chart");
  if (!chart) return;

  if (isSafariMode()) {
    // Safari mode - open in new window
    openSafariPrintView("synastry-chart", "Synastry Chart");
  } else {
    // Standard mode - use browser print
    const y = chart.getBoundingClientRect().top + window.pageYOffset;
    window.scrollTo(0, y);
    window.print();
  }
});

// Synastry report
document.getElementById("synastryReport")?.addEventListener("click", function () {
  // For Safari, open window immediately to avoid popup blocking
  const isSafari =
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  let printWindow = null;
  if (isSafari) {
    printWindow = window.open("about:blank", "_blank", "width=1000,height=1200");
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
        // Call the synastry report generation function
        window.generateSynastryReport(printWindow);
      }
    })
    .catch((error) => {
      if (printWindow) printWindow.close();
      console.error("Error preparing report:", error);
    });
});

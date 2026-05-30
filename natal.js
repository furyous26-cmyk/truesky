"use strict";

import { sharedNatal } from "./sharedNatal.js";

function initializeNatal() {
  const svgContainer = d3.select("#natal-chart");
  sharedNatal(svgContainer);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeNatal);
} else {
  initializeNatal();
}

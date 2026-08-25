// @ts-check

import { claims } from "./claims.js";

const claimList = document.querySelector("#claim-list");
const runButton = document.querySelector("#run-claims");

if (!(claimList instanceof HTMLElement) || !(runButton instanceof HTMLButtonElement)) {
  throw new Error("The proof panel is incomplete");
}

function renderPending() {
  claimList.replaceChildren(...claims.map((claim) => {
    const article = document.createElement("article");
    article.className = "claim";
    article.innerHTML = `<div class="claim-top"><h3>${claim.name}</h3><span class="badge">NOT RUN</span></div><p class="claim-result">Waiting for a measured run.</p><p class="claim-catches">${claim.catches}</p>`;
    return article;
  }));
}

function runClaims() {
  runButton.disabled = true;
  runButton.textContent = "Measuring…";
  const results = claims.map((claim) => {
    const article = document.createElement("article");
    try {
      const evidence = claim.verify();
      article.className = "claim pass";
      article.innerHTML = `<div class="claim-top"><h3>${claim.name}</h3><span class="badge">PASS</span></div><p class="claim-result">${evidence}</p><p class="claim-catches">${claim.catches}</p>`;
    } catch (error) {
      article.className = "claim fail";
      const message = error instanceof Error ? error.message : String(error);
      article.innerHTML = `<div class="claim-top"><h3>${claim.name}</h3><span class="badge">FAIL</span></div><p class="claim-result">${message}</p><p class="claim-catches">${claim.catches}</p>`;
    }
    return article;
  });
  claimList.replaceChildren(...results);
  runButton.disabled = false;
  runButton.textContent = "Run again";
}

runButton.addEventListener("click", runClaims);
renderPending();
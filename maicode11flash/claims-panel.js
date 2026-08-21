import { claims, runClaims } from './claims.js';

export function mountClaimsPanel() {
  const list = document.querySelector('#claim-list');
  if (!list) {
    return;
  }

  const render = () => {
    const results = runClaims();
    list.innerHTML = '';

    results.forEach((result) => {
      const item = document.createElement('li');
      item.className = 'claim-item';
      const verdict = document.createElement('strong');
      verdict.textContent = `${result.passed ? '✓' : '✗'} ${result.name}`;
      verdict.className = result.passed ? 'status-pass' : 'status-fail';

      const explanation = document.createElement('p');
      explanation.textContent = result.whatItCatches;

      const evidence = document.createElement('p');
      if (result.passed) {
        evidence.textContent = `Measured evidence: ${JSON.stringify(result.evidence)}`;
      } else {
        evidence.textContent = `Result: ${result.error}`;
      }

      item.append(verdict, explanation, evidence);
      list.appendChild(item);
    });
  };

  const button = document.querySelector('#run-claims');
  if (button) {
    button.addEventListener('click', render);
  }

  render();
}

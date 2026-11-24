/* Validate public GitHub repository links before leaving a tool landing page. */
(() => {
  "use strict";
  const ownerRe = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
  const repoRe = /^[A-Za-z0-9_.-]{1,100}$/;
  function isGitHubRepo(value) {
    const raw = value.trim();
    if (!raw || raw.length > 2048) return false;
    // Keep validation consistent with the homepage's GitHub URL parser.
    const match = raw.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(\/.*)?\/?$/i);
    if (!match) return false;
    const owner = match[1];
    const name = match[2];
    return ownerRe.test(owner) && repoRe.test(name) && name !== "." && name !== "..";
  }

  document.querySelectorAll('form[data-repo-launch]').forEach(form => {
    const input = form.querySelector('input[name="repo"]');
    const view = form.querySelector('input[name="view"]');
    const status = form.querySelector('[data-repo-feedback]');
    const submit = form.querySelector('button[type="submit"]');
    if (!input || !view || !["files", "evidence", "compare", "health", "gitdiagram"].includes(view.value)) return;
    input.addEventListener("input", () => {
      input.setCustomValidity("");
      if (status) status.textContent = "";
    });
    form.addEventListener("submit", event => {
      if (!isGitHubRepo(input.value)) {
        event.preventDefault();
        input.setCustomValidity("Enter a public GitHub repository URL such as https://github.com/facebook/react.");
        input.reportValidity();
        if (status) status.textContent = "Use a GitHub repository URL, not a profile or unrelated website.";
        input.focus();
        return;
      }
      input.setCustomValidity("");
      if (status) status.textContent = "Opening the selected repository feature…";
      if (submit) {
        submit.disabled = true;
        submit.textContent = "Opening repository…";
      }
    });
  });
})();

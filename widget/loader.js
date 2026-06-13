/**
 * MyVault Widget Loader — Embeddable overlay widget for third-party applications.
 *
 * Usage:
 *   <script src="https://myvault.example.com/widget/loader.js"
 *           data-app="grist-connector"
 *           data-position="bottom-right"
 *           data-theme="dsfr">
 *   </script>
 */

(function () {
  "use strict";

  const script = document.currentScript;
  const appSlug = script?.getAttribute("data-app") || "";
  const position = script?.getAttribute("data-position") || "bottom-right";
  const theme = script?.getAttribute("data-theme") || "dsfr";
  const myvaultUrl = script?.src
    ? new URL(script.src).origin
    : "https://myvault.example.com";

  if (!appSlug) {
    console.error("[MyVault Widget] data-app attribute is required");
    return;
  }

  // Create Shadow DOM container for style isolation
  const host = document.createElement("div");
  host.id = "myvault-widget-host";
  const shadow = host.attachShadow({ mode: "closed" });

  // Position map
  const positions = {
    "bottom-right": "bottom: 20px; right: 20px;",
    "bottom-left": "bottom: 20px; left: 20px;",
    "top-right": "top: 20px; right: 20px;",
    "top-left": "top: 20px; left: 20px;",
  };

  // Inject styles
  const style = document.createElement("style");
  style.textContent = `
    :host {
      all: initial;
      font-family: "Marianne", system-ui, sans-serif;
    }

    .myvault-fab {
      position: fixed;
      ${positions[position] || positions["bottom-right"]}
      z-index: 999999;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #000091;
      color: white;
      border: none;
      cursor: pointer;
      font-size: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .myvault-fab:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
    }

    .myvault-panel {
      position: fixed;
      ${position.includes("right") ? "right: 20px;" : "left: 20px;"}
      ${position.includes("bottom") ? "bottom: 80px;" : "top: 80px;"}
      z-index: 999998;
      width: 360px;
      max-height: 500px;
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      display: none;
      flex-direction: column;
      overflow: hidden;
    }

    .myvault-panel.open {
      display: flex;
    }

    .myvault-header {
      background: #000091;
      color: white;
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 14px;
      font-weight: 700;
    }

    .myvault-close {
      background: none;
      border: none;
      color: white;
      font-size: 18px;
      cursor: pointer;
      padding: 0 4px;
    }

    .myvault-body {
      padding: 16px;
      overflow-y: auto;
      flex: 1;
    }

    .myvault-var {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #eee;
      font-size: 13px;
    }

    .myvault-var:last-child {
      border-bottom: none;
    }

    .myvault-var-label {
      font-weight: 600;
      color: #333;
    }

    .myvault-var-value {
      font-family: monospace;
      font-size: 12px;
      color: #666;
      max-width: 150px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .myvault-copy-btn {
      background: none;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 2px 8px;
      cursor: pointer;
      font-size: 12px;
      color: #000091;
    }

    .myvault-copy-btn:hover {
      background: #f0f0ff;
    }

    .myvault-footer {
      padding: 12px 16px;
      border-top: 1px solid #eee;
      display: flex;
      gap: 8px;
      justify-content: center;
    }

    .myvault-link {
      color: #000091;
      text-decoration: none;
      font-size: 13px;
      font-weight: 600;
    }

    .myvault-status {
      padding: 8px 16px;
      font-size: 12px;
      text-align: center;
    }

    .myvault-status.ok { color: #18753C; background: #B8FEC9; }
    .myvault-status.error { color: #CE0500; background: #FFE9E9; }
    .myvault-status.loading { color: #666; background: #f5f5f5; }
  `;
  shadow.appendChild(style);

  // FAB button
  const fab = document.createElement("button");
  fab.className = "myvault-fab";
  fab.innerHTML = "&#128274;"; // lock icon
  fab.title = "MyVault";
  fab.setAttribute("aria-label", "Ouvrir MyVault");
  shadow.appendChild(fab);

  // Panel
  const panel = document.createElement("div");
  panel.className = "myvault-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "MyVault credentials");
  panel.innerHTML = `
    <div class="myvault-header">
      <span>MyVault</span>
      <button class="myvault-close" aria-label="Fermer">&times;</button>
    </div>
    <div class="myvault-status loading">Chargement...</div>
    <div class="myvault-body"></div>
    <div class="myvault-footer">
      <a class="myvault-link" href="#" target="_blank" rel="noopener">
        Modifier dans MyVault &#8599;
      </a>
    </div>
  `;
  // Set the link target via property (no HTML parsing → no attribute injection
  // from the embedder-controlled data-app value).
  const footerLink = panel.querySelector(".myvault-link");
  if (footerLink) footerLink.href = `${myvaultUrl}/app/${encodeURIComponent(appSlug)}`;
  shadow.appendChild(panel);

  // Toggle panel
  let isOpen = false;
  fab.addEventListener("click", () => {
    isOpen = !isOpen;
    panel.classList.toggle("open", isOpen);
    if (isOpen) loadCredentials();
  });

  panel.querySelector(".myvault-close")?.addEventListener("click", () => {
    isOpen = false;
    panel.classList.remove("open");
  });

  // Load credentials via iframe postMessage (avoids CORS for cookies)
  async function loadCredentials() {
    const statusEl = panel.querySelector(".myvault-status");
    const bodyEl = panel.querySelector(".myvault-body");
    if (!statusEl || !bodyEl) return;

    statusEl.className = "myvault-status loading";
    statusEl.textContent = "Chargement...";
    bodyEl.innerHTML = "";

    try {
      const resp = await fetch(
        `${myvaultUrl}/api/v1/me/apps/${encodeURIComponent(appSlug)}/entries`,
        { credentials: "include" }
      );

      if (!resp.ok) {
        statusEl.className = "myvault-status error";
        statusEl.textContent = "Non authentifié — connectez-vous à MyVault";
        return;
      }

      const data = await resp.json();

      if (!data.entry_id) {
        statusEl.className = "myvault-status error";
        statusEl.textContent = "Credentials non configurés";
        return;
      }

      statusEl.className = `myvault-status ${data.check_status === "ok" ? "ok" : ""}`;
      statusEl.textContent =
        data.check_status === "ok"
          ? "Connexion OK"
          : data.check_status === "error"
            ? "Connexion en erreur"
            : "";

      if (!statusEl.textContent) statusEl.style.display = "none";

      // Render variables (never inject into host DOM for security)
      for (const [key, value] of Object.entries(data.values)) {
        const row = document.createElement("div");
        row.className = "myvault-var";

        const label = document.createElement("span");
        label.className = "myvault-var-label";
        label.textContent = key;

        const val = document.createElement("span");
        val.className = "myvault-var-value";
        val.textContent = typeof value === "string" && value.length > 4
          ? value.substring(0, 4) + "..."
          : "****";

        const copyBtn = document.createElement("button");
        copyBtn.className = "myvault-copy-btn";
        copyBtn.textContent = "Copier";
        copyBtn.addEventListener("click", async () => {
          await navigator.clipboard.writeText(String(value));
          copyBtn.textContent = "Copié !";
          setTimeout(() => (copyBtn.textContent = "Copier"), 2000);
        });

        row.appendChild(label);
        row.appendChild(val);
        row.appendChild(copyBtn);
        bodyEl.appendChild(row);
      }
    } catch {
      statusEl.className = "myvault-status error";
      statusEl.textContent = "Erreur de chargement";
    }
  }

  // Mount
  document.body.appendChild(host);
})();

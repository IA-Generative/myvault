/**
 * MyVault Assistant — Popup script.
 * Displays detected app, credentials, and full app list.
 */

document.addEventListener("DOMContentLoaded", async () => {
  const detectedSection = document.getElementById("detected-app");
  const detectedName = document.getElementById("detected-name");
  const detectedStatus = document.getElementById("detected-status");
  const credentialsSection = document.getElementById("credentials-section");
  const appsUl = document.getElementById("apps-ul");
  const openLink = document.getElementById("open-myvault");

  // Get MyVault URL
  const { myvaultUrl } = await chrome.storage.local.get("myvaultUrl");
  openLink.href = myvaultUrl || "https://myvault.example.com";

  // Get current tab URL
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Check for matching app
  chrome.runtime.sendMessage(
    { type: "GET_MATCHING_APP", url: tab?.url },
    (response) => {
      if (response?.app) {
        showDetectedApp(response.app);
      }
    }
  );

  // Load all apps
  chrome.runtime.sendMessage({ type: "GET_APPS" }, (response) => {
    const apps = response?.apps || [];
    renderAppList(apps);
  });

  function showDetectedApp(app) {
    detectedSection.style.display = "block";
    detectedName.textContent = app.name;

    if (app.user_configured && app.user_enabled) {
      detectedStatus.textContent = "Credentials configurés";
      detectedStatus.className = "status-badge ok";
      loadCredentials(app.friendly_slug);
    } else if (app.user_configured) {
      detectedStatus.textContent = "Désactivé";
      detectedStatus.className = "status-badge error";
    } else {
      detectedStatus.textContent = "Non configuré";
      detectedStatus.className = "status-badge unconfigured";
    }
  }

  function loadCredentials(appSlug) {
    chrome.runtime.sendMessage(
      { type: "GET_CREDENTIALS", appSlug },
      (response) => {
        if (response?.error || !response?.credentials?.values) return;

        credentialsSection.style.display = "block";
        credentialsSection.innerHTML = "";

        for (const [key, value] of Object.entries(response.credentials.values)) {
          const row = document.createElement("div");
          row.className = "cred-row";

          const keyEl = document.createElement("span");
          keyEl.className = "cred-key";
          keyEl.textContent = key;

          const valEl = document.createElement("span");
          valEl.className = "cred-value";
          valEl.textContent = "••••••";

          const copyBtn = document.createElement("button");
          copyBtn.className = "copy-btn";
          copyBtn.textContent = "Copier";
          copyBtn.addEventListener("click", async () => {
            await navigator.clipboard.writeText(String(value));
            copyBtn.textContent = "Copié !";
            setTimeout(() => (copyBtn.textContent = "Copier"), 1500);
          });

          row.appendChild(keyEl);
          row.appendChild(valEl);
          row.appendChild(copyBtn);
          credentialsSection.appendChild(row);
        }
      }
    );
  }

  function renderAppList(apps) {
    appsUl.innerHTML = "";
    for (const app of apps) {
      const li = document.createElement("li");

      const name = document.createElement("span");
      name.className = "app-name";
      name.textContent = app.name;

      const badge = document.createElement("span");
      badge.className = "status-badge";
      if (app.user_configured && app.user_enabled) {
        badge.textContent = "OK";
        badge.classList.add("ok");
      } else if (!app.user_configured) {
        badge.textContent = "Non configuré";
        badge.classList.add("unconfigured");
      } else {
        badge.textContent = "Désactivé";
        badge.classList.add("error");
      }

      li.appendChild(name);
      li.appendChild(badge);
      li.style.cursor = "pointer";
      li.addEventListener("click", () => {
        chrome.tabs.create({
          url: `${openLink.href}/app/${app.friendly_slug}`,
        });
      });

      appsUl.appendChild(li);
    }

    if (apps.length === 0) {
      const li = document.createElement("li");
      li.textContent = "Aucune application";
      li.style.color = "#999";
      li.style.fontStyle = "italic";
      appsUl.appendChild(li);
    }
  }
});

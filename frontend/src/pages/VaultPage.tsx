/**
 * User vault page — "Applications"
 * Table with status, configure, and "Ouvrir" button with credentials overlay.
 */

import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { userApi, type AppListItem, type VaultEntry } from "../services/api";
import { buildPopupData } from "./PopupCredentialsPage";

function StatusBadge({ app }: { app: AppListItem }) {
  if (!app.user_configured) {
    return <span className="fr-badge fr-badge--sm fr-badge--warning">Non configuré</span>;
  }
  if (!app.user_enabled) {
    return <span className="fr-badge fr-badge--sm fr-badge--new">Désactivé</span>;
  }
  if (app.check_status === "ok") {
    return <span className="fr-badge fr-badge--sm fr-badge--success">Actif</span>;
  }
  if (app.check_status === "error") {
    return <span className="fr-badge fr-badge--sm fr-badge--error">Erreur</span>;
  }
  return <span className="fr-badge fr-badge--sm fr-badge--info">Actif</span>;
}

function getAppTargetUrl(app: AppListItem, entry: VaultEntry): string | null {
  // Prefer app_url (the website), fall back to first url variable
  if (entry.values["app_url"]) return entry.values["app_url"];
  // Also check default values
  const appUrlVar = app.required_variables.find((v) => v.key === "app_url");
  if (appUrlVar?.default_value) return appUrlVar.default_value;
  // Fallback: first url-type variable with a value
  for (const v of app.required_variables) {
    if (v.var_type === "url" && entry.values[v.key]) {
      return entry.values[v.key];
    }
  }
  return null;
}

export default function VaultPage() {
  const [apps, setApps] = useState<AppListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [popupBlocked, setPopupBlocked] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    userApi
      .getMyApps()
      .then(setApps)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

    // Restore window size when popup is closed
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "MYVAULT_POPUP_CLOSED") {
        window.moveTo(0, 0);
        window.resizeTo(screen.availWidth, screen.availHeight);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const handleOpen = useCallback(async (app: AppListItem) => {
    try {
      const entry = await userApi.getMyEntry(app.friendly_slug);
      if (!("entry_id" in entry)) return;
      const vaultEntry = entry as VaultEntry;

      const popupData = buildPopupData(app, vaultEntry.values);
      const targetUrl = getAppTargetUrl(app, vaultEntry);

      // Layout: resize current window to left side, popup on right
      const screenW = window.screen.availWidth;
      const screenH = window.screen.availHeight;
      const screenLeft = (window.screen as unknown as Record<string, number>).availLeft ?? 0;
      const screenTop = (window.screen as unknown as Record<string, number>).availTop ?? 0;
      const popupWidth = 340;
      const mainWidth = screenW - popupWidth;

      // Resize the current browser window to the left portion
      window.moveTo(screenLeft, screenTop);
      window.resizeTo(mainWidth, screenH);

      // Open credentials popup on the right strip
      const popup = window.open(
        `/popup/${app.friendly_slug}`,
        `myvault-${app.friendly_slug}`,
        `width=${popupWidth},height=${screenH},left=${screenLeft + mainWidth},top=${screenTop},resizable=yes,scrollbars=yes`
      );

      if (!popup || popup.closed) {
        setPopupBlocked(true);
        if (targetUrl) window.open(targetUrl, "_blank", "noopener,noreferrer");
      } else {
        setPopupBlocked(false);

        // Send credentials to popup
        const sendData = () => {
          popup.postMessage(
            { type: "MYVAULT_CREDENTIALS", payload: popupData },
            window.location.origin
          );
        };

        const onMessage = (event: MessageEvent) => {
          if (event.data?.type === "MYVAULT_POPUP_READY") {
            sendData();
            window.removeEventListener("message", onMessage);
          }
        };
        window.addEventListener("message", onMessage);
        setTimeout(sendData, 500);
        setTimeout(sendData, 1500);

        // Open target app in the main (resized) window
        if (targetUrl) {
          setTimeout(() => {
            window.open(targetUrl, "_blank", "noopener,noreferrer");
          }, 300);
        }
      }
    } catch {
      // silently fail
    }
  }, []);

  if (loading) return <p>Chargement...</p>;

  if (error) {
    return <div className="fr-alert fr-alert--error"><p>{error}</p></div>;
  }

  const canOpen = (app: AppListItem) => app.user_configured && app.user_enabled;

  return (
    <>
      <h1>Mes applications</h1>

      {popupBlocked && (
        <div className="fr-alert fr-alert--warning fr-mb-2w">
          <h3 className="fr-alert__title">Fenêtre bloquée par le navigateur</h3>
          <p>
            La fenêtre d'identifiants a été bloquée. Pour que le bouton <strong>Ouvrir</strong> fonctionne,
            autorisez les pop-ups pour ce site :
          </p>
          <ul style={{ margin: "0.5rem 0", paddingLeft: "1.5rem", fontSize: "0.875rem" }}>
            <li>
              <strong>Chrome</strong> : cliquez sur l'icône bloquée dans la barre d'adresse,
              ou allez dans <em>Paramètres &gt; Confidentialité &gt; Paramètres des sites &gt; Pop-ups</em> et
              ajoutez <code>{window.location.origin}</code>
            </li>
            <li>
              <strong>Firefox</strong> : cliquez sur le bandeau de notification en haut de page,
              ou allez dans <em>Paramètres &gt; Vie privée &gt; Permissions &gt; Pop-ups &gt; Exceptions</em> et
              ajoutez <code>{window.location.origin}</code>
            </li>
            <li>
              <strong>Edge</strong> : cliquez sur l'icône bloquée dans la barre d'adresse,
              ou allez dans <em>Paramètres &gt; Cookies et autorisations &gt; Pop-ups</em> et
              ajoutez <code>{window.location.origin}</code>
            </li>
          </ul>
          <button className="fr-btn fr-btn--sm fr-btn--tertiary" onClick={() => setPopupBlocked(false)}>
            Fermer
          </button>
        </div>
      )}
      <p className="fr-text--lg fr-mb-2w">
        Configurez vos accès puis cliquez sur <strong>Ouvrir</strong> pour
        accéder à l'application avec vos identifiants à portée de main.
      </p>
      <p className="fr-mb-3w">
        Vous pouvez aussi <strong>autoriser une application à se servir de vos
        identifiants</strong> pour des travaux d'automatisation : une fois vos accès
        renseignés et l'application activée, il suffit de le demander — en toutes lettres —
        à <strong>Mon assistant</strong> ou à <strong>Mes agents</strong>, qui agiront en
        votre nom sur celles des applications ci-dessous qui le proposent. Vos secrets
        restent chiffrés en AES-256-GCM, l'outil ne les obtient qu'au moment où il s'en
        sert, et désactiver une application lui coupe l'accès aussitôt.{" "}
        <a className="fr-link" href="/guide">En savoir plus dans le guide</a>.
      </p>

      {apps.length === 0 ? (
        <div className="fr-callout">
          <h3 className="fr-callout__title">Aucune application disponible</h3>
          <p className="fr-callout__text">
            Les applications apparaîtront ici dès qu'un administrateur
            les aura ajoutées depuis l'onglet <strong>Administration</strong>.
          </p>
        </div>
      ) : (
        <div className="fr-table">
          <table>
            <thead>
              <tr>
                <th>Application</th>
                <th>Description</th>
                <th>Statut</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((app) => (
                <tr key={app.id}>
                  <td style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {app.icon_url && (
                      <img src={app.icon_url} alt="" style={{ width: 20, height: 20 }} />
                    )}
                    <strong>{app.name}</strong>
                  </td>
                  <td>{app.description}</td>
                  <td>
                    <StatusBadge app={app} />
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button
                      className={`fr-btn fr-btn--sm ${canOpen(app) ? "" : ""}`}
                      onClick={() => handleOpen(app)}
                      disabled={!canOpen(app)}
                      title={canOpen(app) ? "Ouvrir l'application et afficher les credentials" : "Configurez d'abord vos identifiants"}
                    >
                      Ouvrir
                    </button>
                    {" "}
                    <button
                      className="fr-btn fr-btn--sm fr-btn--tertiary"
                      onClick={() => navigate(`/app/${app.friendly_slug}`)}
                    >
                      {app.user_configured ? "Modifier" : "Configurer"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </>
  );
}

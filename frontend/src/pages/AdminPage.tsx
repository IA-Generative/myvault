/**
 * Admin page: manage applications (CRUD), import/export, view provisioned users.
 */

import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { adminApi, type AdminApp } from "../services/api";

export default function AdminPage() {
  const [apps, setApps] = useState<AdminApp[]>([]);
  const [users, setUsers] = useState<{ user_id: string; apps_configured: number; last_activity: string }[]>([]);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"apps" | "users">("apps");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    adminApi.listApps().then(setApps).catch((e) => setError(e.message));
    adminApi.listUsers().then(setUsers).catch(() => {});
  }, []);

  const handleDelete = async (appId: string, appName: string) => {
    if (!confirm(`Supprimer l'application "${appName}" et toutes les données associées ?`)) return;
    try {
      await adminApi.deleteApp(appId);
      setApps((prev) => prev.filter((a) => a.id !== appId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de suppression");
    }
  };

  const handleExport = async () => {
    const data = await adminApi.exportKeycloak();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "myvault-export.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const data = JSON.parse(text);
      const result = await adminApi.importKeycloak(data);
      alert(`${result.imported} application(s) importée(s)`);
      adminApi.listApps().then(setApps);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fichier invalide");
    }
  };

  return (
    <>
      <h1>Administration</h1>

      {error && (
        <div className="fr-alert fr-alert--error fr-mb-2w">
          <p>{error}</p>
        </div>
      )}

      <nav className="fr-tabs" role="tablist" aria-label="Sections admin">
        <ul className="fr-tabs__list">
          <li role="presentation">
            <button
              className={`fr-tabs__tab ${tab === "apps" ? "fr-tabs__tab--active" : ""}`}
              role="tab"
              aria-selected={tab === "apps"}
              onClick={() => setTab("apps")}
            >
              Applications
            </button>
          </li>
          <li role="presentation">
            <button
              className={`fr-tabs__tab ${tab === "users" ? "fr-tabs__tab--active" : ""}`}
              role="tab"
              aria-selected={tab === "users"}
              onClick={() => setTab("users")}
            >
              Utilisateurs
            </button>
          </li>
        </ul>
      </nav>

      {tab === "apps" && (
        <div className="fr-mt-2w">
          <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
            <button className="fr-btn" onClick={() => navigate("/admin/apps/new")}>
              Créer une application
            </button>
            <button className="fr-btn fr-btn--secondary" onClick={handleExport}>
              Exporter (JSON)
            </button>
            <button className="fr-btn fr-btn--secondary" onClick={() => fileInputRef.current?.click()}>
              Importer (JSON)
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              style={{ display: "none" }}
            />
          </div>

          <div className="fr-table">
            <table>
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Slug</th>
                  <th>Client ID</th>
                  <th>Statut</th>
                  <th>Variables</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {apps.map((app) => (
                  <tr key={app.id}>
                    <td>{app.name}</td>
                    <td><code>{app.friendly_slug}</code></td>
                    <td><code>{app.client_id}</code></td>
                    <td>
                      <span className={`fr-badge fr-badge--sm ${app.status === "active" ? "fr-badge--success" : "fr-badge--warning"}`}>
                        {app.status}
                      </span>
                    </td>
                    <td>{app.required_variables.length}</td>
                    <td>
                      <button
                        className="fr-btn fr-btn--tertiary-no-outline fr-btn--sm"
                        onClick={() => navigate(`/admin/apps/${app.id}/edit`)}
                      >
                        Modifier
                      </button>
                      <button
                        className="fr-btn fr-btn--tertiary-no-outline fr-btn--sm"
                        style={{ color: "var(--text-default-error)" }}
                        onClick={() => handleDelete(app.id, app.name)}
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
                {apps.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center" }}>Aucune application</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "users" && (
        <div className="fr-mt-2w">
          <div className="fr-table">
            <table>
              <thead>
                <tr>
                  <th>ID Utilisateur</th>
                  <th>Applications configurées</th>
                  <th>Dernière activité</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.user_id}>
                    <td><code>{u.user_id}</code></td>
                    <td>{u.apps_configured}</td>
                    <td>{u.last_activity ? new Date(u.last_activity).toLocaleString("fr-FR") : "—"}</td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ textAlign: "center" }}>Aucun utilisateur provisionné</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

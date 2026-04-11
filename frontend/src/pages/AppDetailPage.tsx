/**
 * Application detail page: form to manage credentials for a specific app.
 * Shows variable fields per type, toggle enable/disable, check connection.
 */

import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import VariableField from "../components/VariableField";
import ConnectionChecker from "../components/ConnectionChecker";
import { userApi, type AppListItem } from "../services/api";

export default function AppDetailPage() {
  const { appSlug } = useParams<{ appSlug: string }>();
  const [app, setApp] = useState<AppListItem | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [enabled, setEnabled] = useState(true);
  const [isNew, setIsNew] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!appSlug) return;

    Promise.all([
      userApi.getMyApps(),
      userApi.getMyEntry(appSlug),
    ]).then(([apps, entry]) => {
      const found = apps.find((a) => a.friendly_slug === appSlug);
      if (found) setApp(found);

      if ("entry_id" in entry) {
        setValues(entry.values);
        setEnabled(entry.enabled);
        setIsNew(false);
      } else {
        // Pre-fill defaults
        const defaults: Record<string, string> = {};
        found?.required_variables.forEach((v) => {
          if (v.default_value) defaults[v.key] = v.default_value;
        });
        setValues(defaults);
      }
    }).catch((err) => setError(err.message));
  }, [appSlug]);

  const handleChange = useCallback((key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }, []);

  const handleSave = async () => {
    if (!appSlug) return;
    setSaving(true);
    setError("");
    try {
      await userApi.saveMyEntry(appSlug, values, enabled);
      setSaved(true);
      setIsNew(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async () => {
    if (!appSlug) return;
    try {
      const result = await userApi.toggleMyEntry(appSlug);
      setEnabled(result.enabled);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  };

  if (!app) {
    return error ? (
      <div className="fr-alert fr-alert--error"><p>{error}</p></div>
    ) : (
      <p>Chargement...</p>
    );
  }

  return (
    <>
      <nav className="fr-breadcrumb" aria-label="vous êtes ici :">
        <ol className="fr-breadcrumb__list">
          <li>
            <Link className="fr-breadcrumb__link" to="/">Mon coffre-fort</Link>
          </li>
          <li>
            <span className="fr-breadcrumb__link" aria-current="page">{app.name}</span>
          </li>
        </ol>
      </nav>

      <div className="fr-grid-row fr-grid-row--gutters fr-grid-row--middle fr-mb-2w">
        <div className="fr-col">
          <h1>{app.name}</h1>
          <p>{app.description}</p>
        </div>
        {!isNew && (
          <div className="fr-col-auto">
            <div className="fr-toggle">
              <input
                type="checkbox"
                className="fr-toggle__input"
                id="toggle-enabled"
                checked={enabled}
                onChange={handleToggle}
              />
              <label className="fr-toggle__label" htmlFor="toggle-enabled">
                {enabled ? "Actif" : "Désactivé"}
              </label>
            </div>
          </div>
        )}
      </div>

      {isNew && (
        <div className="fr-alert fr-alert--info fr-mb-2w">
          <h3 className="fr-alert__title">Première configuration</h3>
          <p>
            Remplissez les champs ci-dessous avec vos identifiants pour cette application,
            puis cliquez sur <strong>Sauvegarder</strong>.
            Vos données seront chiffrées et stockées en toute sécurité.
          </p>
        </div>
      )}

      {error && (
        <div className="fr-alert fr-alert--error fr-mb-2w">
          <p>{error}</p>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
      >
        <div className="fr-grid-row fr-grid-row--gutters">
          {app.required_variables.map((variable) => (
            <div className="fr-col-12 fr-col-md-6" key={variable.key}>
              <VariableField
                variable={variable}
                value={values[variable.key] ?? ""}
                onChange={handleChange}
              />
            </div>
          ))}
        </div>

        <div className="fr-mt-3w" style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <button
            type="submit"
            className="fr-btn"
            disabled={saving}
          >
            {saving ? "Sauvegarde..." : "Sauvegarder"}
          </button>

          <Link to={`/bridge/${appSlug}`} className="fr-btn fr-btn--secondary">
            Pont de configuration
          </Link>

          {saved && (
            <span className="fr-valid-text" role="status">
              Sauvegardé avec succès
            </span>
          )}
        </div>
      </form>

      <ConnectionChecker appSlug={appSlug!} disabled={!app.check_connection_endpoint} />
    </>
  );
}

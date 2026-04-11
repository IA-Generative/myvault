/**
 * Application detail page with two tabs:
 * - "Accès manuel" : app URL, login, password — for browser-based login
 * - "Accès API" : tokens, keys, API endpoints — for programmatic/agent access
 *
 * Known API endpoints are pre-filled and read-only.
 * app_url is used by the "Ouvrir" button on the vault page.
 */

import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import VariableField from "../components/VariableField";
import ConnectionChecker from "../components/ConnectionChecker";
import { userApi, type AppListItem, type VariableDefinition } from "../services/api";

const API_TYPES = new Set(["api_key", "secret", "oauth_token", "certificate"]);
const MANUAL_TYPES = new Set(["login", "password", "email"]);
const API_KEY_PATTERNS = /api|token|endpoint|secret|key|client/i;

function classifyVariable(v: VariableDefinition): "manual" | "api" {
  // app_url is always manual (the website to open in browser)
  if (v.key === "app_url") return "manual";
  // Explicit API types
  if (API_TYPES.has(v.var_type)) return "api";
  // Explicit manual types
  if (MANUAL_TYPES.has(v.var_type)) return "manual";
  // URLs: classify by key name
  if (v.var_type === "url") {
    return API_KEY_PATTERNS.test(v.key) ? "api" : "manual";
  }
  // text, number, etc. — classify by key name
  return API_KEY_PATTERNS.test(v.key) ? "api" : "manual";
}

function isReadOnlyField(v: VariableDefinition): boolean {
  // API endpoints with a known default value are read-only
  if (v.var_type === "url" && v.key !== "app_url" && v.default_value) {
    return true;
  }
  return false;
}

function filterVariables(
  variables: VariableDefinition[],
  tab: "manual" | "api"
): VariableDefinition[] {
  return variables.filter((v) => classifyVariable(v) === tab);
}

function hasVariablesForTab(
  variables: VariableDefinition[],
  tab: "manual" | "api"
): boolean {
  return filterVariables(variables, tab).length > 0;
}

export default function AppDetailPage() {
  const { appSlug } = useParams<{ appSlug: string }>();
  const [app, setApp] = useState<AppListItem | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [enabled, setEnabled] = useState(true);
  const [isNew, setIsNew] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"manual" | "api">("manual");

  useEffect(() => {
    if (!appSlug) return;

    Promise.all([
      userApi.getMyApps(),
      userApi.getMyEntry(appSlug),
    ]).then(([apps, entry]) => {
      const found = apps.find((a) => a.friendly_slug === appSlug);
      if (found) {
        setApp(found);
        if (!hasVariablesForTab(found.required_variables, "manual") &&
            hasVariablesForTab(found.required_variables, "api")) {
          setTab("api");
        }
      }

      if ("entry_id" in entry) {
        setValues(entry.values);
        setEnabled(entry.enabled);
        setIsNew(false);
      } else {
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

  const hasManual = hasVariablesForTab(app.required_variables, "manual");
  const hasApi = hasVariablesForTab(app.required_variables, "api");
  const showTabs = hasManual && hasApi;
  const currentVariables = showTabs
    ? filterVariables(app.required_variables, tab)
    : app.required_variables;

  return (
    <>
      <nav className="fr-breadcrumb" aria-label="vous êtes ici :">
        <ol className="fr-breadcrumb__list">
          <li>
            <Link className="fr-breadcrumb__link" to="/">Mes identifiants</Link>
          </li>
          <li>
            <span className="fr-breadcrumb__link" aria-current="page">{app.name}</span>
          </li>
        </ol>
      </nav>

      <div className="fr-grid-row fr-grid-row--gutters fr-grid-row--middle fr-mb-2w">
        <div className="fr-col" style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {app.icon_url && <img src={app.icon_url} alt="" style={{ width: 32, height: 32 }} />}
          <div>
            <h1 style={{ marginBottom: 0 }}>{app.name}</h1>
            <p className="fr-text--sm" style={{ margin: 0, color: "var(--text-mention-grey)" }}>{app.description}</p>
          </div>
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
            Remplissez les champs ci-dessous avec vos identifiants,
            puis cliquez sur <strong>Sauvegarder</strong>.
            Vos données seront chiffrées et accessibles uniquement par vous.
          </p>
        </div>
      )}

      {error && (
        <div className="fr-alert fr-alert--error fr-mb-2w"><p>{error}</p></div>
      )}

      {/* Tabs */}
      {showTabs && (
        <div className="fr-tabs fr-mb-2w">
          <ul className="fr-tabs__list" role="tablist">
            <li role="presentation">
              <button
                className="fr-tabs__tab"
                role="tab"
                aria-selected={tab === "manual"}
                onClick={() => setTab("manual")}
              >
                Accès manuel
              </button>
            </li>
            <li role="presentation">
              <button
                className="fr-tabs__tab"
                role="tab"
                aria-selected={tab === "api"}
                onClick={() => setTab("api")}
              >
                Accès API
              </button>
            </li>
          </ul>
        </div>
      )}

      {/* Tab explanations */}
      {showTabs && tab === "manual" && (
        <div className="fr-callout fr-callout--brown-caramel fr-mb-2w" style={{ padding: "0.75rem 1rem" }}>
          <p className="fr-text--sm" style={{ margin: 0 }}>
            <strong>Accès manuel</strong> — Vos identifiants pour vous connecter
            à {app.name} depuis votre navigateur (login, mot de passe).
            Utilisez le bouton <strong>Ouvrir</strong> sur la page d'accueil pour
            ouvrir le site et avoir vos identifiants à portée de main.
          </p>
        </div>
      )}
      {showTabs && tab === "api" && (
        <div className="fr-callout fr-callout--brown-caramel fr-mb-2w" style={{ padding: "0.75rem 1rem" }}>
          <p className="fr-text--sm" style={{ margin: 0 }}>
            <strong>Accès API</strong> — Ces identifiants permettent à vos agents IA
            (tools OpenWebUI, pipelines MirAI) d'accéder aux données
            de {app.name} en votre nom, de manière sécurisée et automatisée.
            Les endpoints pré-remplis sont ceux utilisés par l'écosystème et ne doivent
            pas être modifiés.
          </p>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
      >
        <div className="fr-grid-row fr-grid-row--gutters">
          {currentVariables.map((variable) => {
            const readOnly = isReadOnlyField(variable);
            return (
              <div className="fr-col-12 fr-col-md-6" key={variable.key}>
                <VariableField
                  variable={variable}
                  value={values[variable.key] ?? ""}
                  onChange={handleChange}
                  readOnly={readOnly}
                />
                {readOnly && (
                  <p className="fr-text--xs" style={{ color: "var(--text-mention-grey)", marginTop: "-0.5rem" }}>
                    Pré-configuré — ne pas modifier
                  </p>
                )}
              </div>
            );
          })}
          {currentVariables.length === 0 && (
            <div className="fr-col-12">
              <p className="fr-text--sm" style={{ color: "var(--text-mention-grey)", fontStyle: "italic" }}>
                Aucun champ pour ce mode d'accès.
              </p>
            </div>
          )}
        </div>

        <div className="fr-mt-3w" style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
          <button type="submit" className="fr-btn" disabled={saving}>
            {saving ? "Sauvegarde..." : "Sauvegarder"}
          </button>
          <Link to={`/bridge/${appSlug}`} className="fr-btn fr-btn--secondary">
            Import / Export
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

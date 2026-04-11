/**
 * Bridge page: export/import credentials in multiple formats.
 * Provides copy-to-clipboard in JSON, .env, YAML formats and import capability.
 */

import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import SecretField from "../components/SecretField";
import { bridgeApi, userApi, type AppListItem, type BridgeExport } from "../services/api";

export default function BridgePage() {
  const { appSlug } = useParams<{ appSlug: string }>();
  const [searchParams] = useSearchParams();
  const source = searchParams.get("source");

  const [app, setApp] = useState<AppListItem | null>(null);
  const [exportData, setExportData] = useState<BridgeExport | null>(null);
  const [format, setFormat] = useState<string>(source === "openwebui" ? "env" : "json");
  const [importText, setImportText] = useState("");
  const [importFormat, setImportFormat] = useState("json");
  const [importResult, setImportResult] = useState<Record<string, string> | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!appSlug) return;
    userApi.getMyApps().then((apps) => {
      const found = apps.find((a) => a.friendly_slug === appSlug);
      if (found) setApp(found);
    });
  }, [appSlug]);

  useEffect(() => {
    if (!appSlug) return;
    bridgeApi
      .exportCredentials(appSlug, format)
      .then(setExportData)
      .catch((e) => setError(e.message));
  }, [appSlug, format]);

  const handleCopyAll = useCallback(async () => {
    if (!exportData) return;
    await navigator.clipboard.writeText(exportData.data);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [exportData]);

  const handleImport = async () => {
    if (!appSlug || !importText.trim()) return;
    try {
      const result = await bridgeApi.importCredentials(appSlug, importFormat, importText);
      setImportResult(result.mapped_variables);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur d'import");
    }
  };

  const handleSaveImport = async () => {
    if (!appSlug || !importResult) return;
    try {
      await userApi.saveMyEntry(appSlug, importResult, true);
      setImportResult(null);
      setImportText("");
      // Refresh export data
      bridgeApi.exportCredentials(appSlug, format).then(setExportData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de sauvegarde");
    }
  };

  if (!app) return <p>Chargement...</p>;

  return (
    <>
      <nav className="fr-breadcrumb" aria-label="vous êtes ici :">
        <ol className="fr-breadcrumb__list">
          <li><Link className="fr-breadcrumb__link" to="/">Mon coffre-fort</Link></li>
          <li><Link className="fr-breadcrumb__link" to={`/app/${appSlug}`}>{app.name}</Link></li>
          <li><span className="fr-breadcrumb__link" aria-current="page">Pont de configuration</span></li>
        </ol>
      </nav>

      <h1>Pont de configuration — {app.name}</h1>
      <p>Copiez vos variables vers l'application ou importez-les ici.</p>

      {error && <div className="fr-alert fr-alert--error fr-mb-2w"><p>{error}</p></div>}

      {/* Export section */}
      <h2>Export</h2>
      <div className="fr-btns-group fr-btns-group--inline fr-mb-2w">
        {["json", "env", "yaml"].map((f) => (
          <button
            key={f}
            className={`fr-btn ${format === f ? "" : "fr-btn--secondary"} fr-btn--sm`}
            onClick={() => setFormat(f)}
          >
            {f === "env" ? ".env" : f.toUpperCase()}
          </button>
        ))}
      </div>

      {exportData && (
        <>
          {/* Individual variables */}
          <div className="fr-table fr-mb-2w">
            <table>
              <thead>
                <tr>
                  <th>Variable</th>
                  <th>Valeur</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(exportData.variables).map(([key, value]) => {
                  const varDef = app.required_variables.find((v) => v.key === key);
                  const isSecret = varDef && ["secret", "api_key", "password", "oauth_token", "login", "certificate"].includes(varDef.var_type);
                  return (
                    <tr key={key}>
                      <td><code>{key}</code></td>
                      <td>
                        {isSecret ? (
                          <SecretField
                            label=""
                            value={value}
                            onChange={() => {}}
                            readOnly
                          />
                        ) : (
                          <span>{value}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <button className="fr-btn fr-btn--secondary" onClick={handleCopyAll}>
              Tout copier au format {format === "env" ? ".env" : format.toUpperCase()}
            </button>
            {copied && <span className="fr-valid-text" role="status">Copié dans le presse-papier</span>}
          </div>

          {/* Raw export preview */}
          <details className="fr-mt-2w">
            <summary>Voir le contenu brut</summary>
            <pre
              style={{
                background: "var(--background-contrast-grey)",
                padding: "1rem",
                borderRadius: "4px",
                overflow: "auto",
                maxHeight: "300px",
              }}
            >
              {exportData.data}
            </pre>
          </details>
        </>
      )}

      {/* Import section */}
      <h2 className="fr-mt-4w">Import depuis l'application</h2>
      <div className="fr-btns-group fr-btns-group--inline fr-mb-1w">
        {["json", "env", "yaml"].map((f) => (
          <button
            key={f}
            className={`fr-btn ${importFormat === f ? "" : "fr-btn--secondary"} fr-btn--sm`}
            onClick={() => setImportFormat(f)}
          >
            {f === "env" ? ".env" : f.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="fr-input-group">
        <label className="fr-label" htmlFor="import-data">
          Collez vos données ({importFormat === "env" ? ".env" : importFormat.toUpperCase()})
        </label>
        <textarea
          className="fr-input"
          id="import-data"
          rows={6}
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          style={{ fontFamily: "monospace" }}
          placeholder={importFormat === "env" ? "API_KEY=xxx\nSERVER_URL=yyy" : '{\n  "api_key": "xxx"\n}'}
        />
      </div>

      <button className="fr-btn fr-btn--secondary fr-mt-1w" onClick={handleImport} disabled={!importText.trim()}>
        Analyser et mapper
      </button>

      {importResult && (
        <div className="fr-callout fr-mt-2w">
          <h3 className="fr-callout__title">Variables détectées ({Object.keys(importResult).length})</h3>
          <ul>
            {Object.entries(importResult).map(([key, value]) => (
              <li key={key}>
                <code>{key}</code> : <code>{value.substring(0, 20)}{value.length > 20 ? "..." : ""}</code>
              </li>
            ))}
          </ul>
          <button className="fr-btn fr-mt-1w" onClick={handleSaveImport}>
            Sauvegarder ces valeurs
          </button>
        </div>
      )}
    </>
  );
}

/**
 * Admin form for creating or editing an application.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminApi } from "../services/api";

const VAR_TYPES = [
  "text", "textarea", "number", "boolean", "url", "email",
  "select", "multi_select", "secret", "api_key", "login",
  "password", "oauth_token", "certificate", "json",
];

interface VarDraft {
  key: string;
  label: string;
  var_type: string;
  required: boolean;
  description: string;
  default_value: string;
}

export default function AdminAppFormPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [checkEndpoint, setCheckEndpoint] = useState("");
  const [variables, setVariables] = useState<VarDraft[]>([
    { key: "", label: "", var_type: "text", required: true, description: "", default_value: "" },
  ]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const updateVar = (idx: number, field: keyof VarDraft, value: string | boolean) => {
    setVariables((prev) =>
      prev.map((v, i) => (i === idx ? { ...v, [field]: value } : v))
    );
  };

  const addVariable = () => {
    setVariables((prev) => [
      ...prev,
      { key: "", label: "", var_type: "text", required: true, description: "", default_value: "" },
    ]);
  };

  const removeVariable = (idx: number) => {
    setVariables((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await adminApi.createApp({
        client_id: clientId,
        name,
        friendly_slug: slug,
        description,
        check_connection_endpoint: checkEndpoint,
        required_variables: variables.filter((v) => v.key),
      });
      navigate("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de création");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <h1>Nouvelle application</h1>

      {error && (
        <div className="fr-alert fr-alert--error fr-mb-2w"><p>{error}</p></div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="fr-grid-row fr-grid-row--gutters">
          <div className="fr-col-12 fr-col-md-6">
            <div className="fr-input-group">
              <label className="fr-label" htmlFor="name">Nom de l'application *</label>
              <input className="fr-input" id="name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
          <div className="fr-col-12 fr-col-md-6">
            <div className="fr-input-group">
              <label className="fr-label" htmlFor="client-id">Client ID *</label>
              <input className="fr-input" id="client-id" required value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="myvault-mon-outil" />
            </div>
          </div>
          <div className="fr-col-12 fr-col-md-6">
            <div className="fr-input-group">
              <label className="fr-label" htmlFor="slug">Slug (URL) *</label>
              <input className="fr-input" id="slug" required value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="mon-outil" />
            </div>
          </div>
          <div className="fr-col-12 fr-col-md-6">
            <div className="fr-input-group">
              <label className="fr-label" htmlFor="check-endpoint">
                Endpoint de vérification
                <span className="fr-hint-text">URL appelée pour tester la connexion</span>
              </label>
              <input className="fr-input" id="check-endpoint" value={checkEndpoint} onChange={(e) => setCheckEndpoint(e.target.value)} type="url" />
            </div>
          </div>
          <div className="fr-col-12">
            <div className="fr-input-group">
              <label className="fr-label" htmlFor="desc">Description</label>
              <textarea className="fr-input" id="desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
        </div>

        <h2 className="fr-mt-3w">Variables requises</h2>

        {variables.map((v, idx) => (
          <fieldset className="fr-fieldset fr-mb-2w" key={idx} style={{ border: "1px solid var(--border-default-grey)", padding: "1rem", borderRadius: "4px" }}>
            <div className="fr-grid-row fr-grid-row--gutters">
              <div className="fr-col-12 fr-col-md-3">
                <div className="fr-input-group">
                  <label className="fr-label">Clé *</label>
                  <input className="fr-input" value={v.key} onChange={(e) => updateVar(idx, "key", e.target.value)} placeholder="api_token" required />
                </div>
              </div>
              <div className="fr-col-12 fr-col-md-3">
                <div className="fr-input-group">
                  <label className="fr-label">Libellé *</label>
                  <input className="fr-input" value={v.label} onChange={(e) => updateVar(idx, "label", e.target.value)} placeholder="Clé API" required />
                </div>
              </div>
              <div className="fr-col-12 fr-col-md-2">
                <div className="fr-select-group">
                  <label className="fr-label">Type</label>
                  <select className="fr-select" value={v.var_type} onChange={(e) => updateVar(idx, "var_type", e.target.value)}>
                    {VAR_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="fr-col-12 fr-col-md-2">
                <div className="fr-input-group">
                  <label className="fr-label">Valeur par défaut</label>
                  <input className="fr-input" value={v.default_value} onChange={(e) => updateVar(idx, "default_value", e.target.value)} />
                </div>
              </div>
              <div className="fr-col-12 fr-col-md-2" style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem" }}>
                <div className="fr-checkbox-group">
                  <input type="checkbox" id={`req-${idx}`} checked={v.required} onChange={(e) => updateVar(idx, "required", e.target.checked)} />
                  <label className="fr-label" htmlFor={`req-${idx}`}>Requis</label>
                </div>
                {variables.length > 1 && (
                  <button type="button" className="fr-btn fr-btn--tertiary-no-outline fr-btn--sm" onClick={() => removeVariable(idx)} style={{ color: "var(--text-default-error)" }}>
                    Supprimer
                  </button>
                )}
              </div>
            </div>
          </fieldset>
        ))}

        <button type="button" className="fr-btn fr-btn--secondary fr-btn--sm" onClick={addVariable}>
          Ajouter une variable
        </button>

        <div className="fr-mt-3w" style={{ display: "flex", gap: "1rem" }}>
          <button type="submit" className="fr-btn" disabled={saving}>
            {saving ? "Création..." : "Créer l'application"}
          </button>
          <button type="button" className="fr-btn fr-btn--secondary" onClick={() => navigate("/admin")}>
            Annuler
          </button>
        </div>
      </form>
    </>
  );
}

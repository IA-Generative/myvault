/**
 * Secret input field with toggle visibility and copy-to-clipboard.
 * Renders as masked dots by default, with eye toggle and copy button.
 */

import { useState, useCallback } from "react";

interface SecretFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  description?: string;
  required?: boolean;
  readOnly?: boolean;
}

export default function SecretField({
  label,
  value,
  onChange,
  description,
  required,
  readOnly,
}: SecretFieldProps) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [value]);

  return (
    <div className="fr-input-group">
      <label className="fr-label">
        {label}
        {required && <span className="fr-hint-text"> *</span>}
        {description && <span className="fr-hint-text"> — {description}</span>}
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <input
          className="fr-input"
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          readOnly={readOnly}
          required={required}
          style={{ flex: 1 }}
        />
        <button
          type="button"
          className="fr-btn fr-btn--tertiary-no-outline fr-btn--sm"
          onClick={() => setVisible(!visible)}
          title={visible ? "Masquer" : "Afficher"}
          aria-label={visible ? "Masquer la valeur" : "Afficher la valeur"}
        >
          <span className={visible ? "fr-icon-eye-off-line" : "fr-icon-eye-line"} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="fr-btn fr-btn--tertiary-no-outline fr-btn--sm"
          onClick={handleCopy}
          title="Copier"
          aria-label="Copier la valeur"
        >
          <span className="fr-icon-clipboard-line" aria-hidden="true" />
        </button>
      </div>
      {copied && (
        <p className="fr-valid-text" role="status">
          Valeur copiée
        </p>
      )}
    </div>
  );
}

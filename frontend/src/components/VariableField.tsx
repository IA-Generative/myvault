/**
 * Renders the appropriate input field based on the variable type definition.
 * Handles: text, textarea, number, boolean, url, email, select, multi_select,
 * secret, api_key, login, password, oauth_token, certificate, json.
 */

import SecretField from "./SecretField";
import TotpField from "./TotpField";
import type { VariableDefinition } from "../services/api";

const SECRET_TYPES = new Set([
  "secret", "api_key", "login", "password", "oauth_token", "certificate",
]);

interface VariableFieldProps {
  variable: VariableDefinition;
  value: string;
  onChange: (key: string, value: string) => void;
  readOnly?: boolean;
}

export default function VariableField({
  variable,
  value,
  onChange,
  readOnly,
}: VariableFieldProps) {
  const { key, label, var_type, required, description, default_value, choices } = variable;
  const currentValue = value ?? default_value ?? "";

  if (var_type === "totp") {
    return (
      <TotpField
        label={label}
        value={currentValue}
        onChange={(v) => onChange(key, v)}
        description={description}
        required={required}
        readOnly={readOnly}
      />
    );
  }

  if (SECRET_TYPES.has(var_type)) {
    return (
      <SecretField
        label={label}
        value={currentValue}
        onChange={(v) => onChange(key, v)}
        description={description}
        required={required}
        readOnly={readOnly}
      />
    );
  }

  if (var_type === "boolean") {
    return (
      <div className="fr-toggle">
        <input
          type="checkbox"
          className="fr-toggle__input"
          id={`toggle-${key}`}
          checked={currentValue === "true"}
          onChange={(e) => onChange(key, e.target.checked ? "true" : "false")}
          disabled={readOnly}
        />
        <label className="fr-toggle__label" htmlFor={`toggle-${key}`}>
          {label}
        </label>
        {description && <p className="fr-hint-text">{description}</p>}
      </div>
    );
  }

  if (var_type === "select" && choices) {
    return (
      <div className="fr-select-group">
        <label className="fr-label" htmlFor={`select-${key}`}>
          {label}
          {description && <span className="fr-hint-text"> — {description}</span>}
        </label>
        <select
          className="fr-select"
          id={`select-${key}`}
          value={currentValue}
          onChange={(e) => onChange(key, e.target.value)}
          disabled={readOnly}
          required={required}
        >
          <option value="" disabled>Sélectionnez une option</option>
          {choices.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>
    );
  }

  if (var_type === "multi_select" && choices) {
    const selected = currentValue ? currentValue.split(",") : [];
    const toggle = (choice: string) => {
      const next = selected.includes(choice)
        ? selected.filter((s) => s !== choice)
        : [...selected, choice];
      onChange(key, next.join(","));
    };

    return (
      <fieldset className="fr-fieldset">
        <legend className="fr-fieldset__legend">
          {label}
          {description && <span className="fr-hint-text"> — {description}</span>}
        </legend>
        {choices.map((c) => (
          <div className="fr-checkbox-group" key={c}>
            <input
              type="checkbox"
              id={`check-${key}-${c}`}
              checked={selected.includes(c)}
              onChange={() => toggle(c)}
              disabled={readOnly}
            />
            <label className="fr-label" htmlFor={`check-${key}-${c}`}>{c}</label>
          </div>
        ))}
      </fieldset>
    );
  }

  if (var_type === "textarea" || var_type === "json" || var_type === "certificate") {
    return (
      <div className="fr-input-group">
        <label className="fr-label" htmlFor={`textarea-${key}`}>
          {label}
          {required && <span className="fr-hint-text"> *</span>}
          {description && <span className="fr-hint-text"> — {description}</span>}
        </label>
        <textarea
          className="fr-input"
          id={`textarea-${key}`}
          value={currentValue}
          onChange={(e) => onChange(key, e.target.value)}
          readOnly={readOnly}
          required={required}
          rows={var_type === "json" ? 8 : 4}
          style={var_type === "json" ? { fontFamily: "monospace" } : undefined}
        />
      </div>
    );
  }

  // Default: text, url, email, number
  const inputType = var_type === "url" ? "url"
    : var_type === "email" ? "email"
    : var_type === "number" ? "number"
    : "text";

  return (
    <div className="fr-input-group">
      <label className="fr-label" htmlFor={`input-${key}`}>
        {label}
        {required && <span className="fr-hint-text"> *</span>}
        {description && <span className="fr-hint-text"> — {description}</span>}
      </label>
      <input
        className="fr-input"
        type={inputType}
        id={`input-${key}`}
        value={currentValue}
        onChange={(e) => onChange(key, e.target.value)}
        readOnly={readOnly}
        required={required}
      />
    </div>
  );
}

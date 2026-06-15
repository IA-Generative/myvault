/**
 * TOTP field — stores a 2FA seed (shared secret) and shows the live 6-digit
 * code with a countdown, like an authenticator app. The seed is edited via the
 * masked SecretField; the code is computed locally (Web Crypto, offline).
 */

import { useEffect, useState, useCallback } from "react";
import SecretField from "./SecretField";

const PERIOD = 30;
const DIGITS = 6;

function extractSecret(raw: string): string {
  const s = (raw || "").trim();
  if (s.toLowerCase().startsWith("otpauth://")) {
    try {
      const secret = new URL(s).searchParams.get("secret") || "";
      return secret.replace(/\s/g, "").toUpperCase();
    } catch {
      return "";
    }
  }
  return s.replace(/\s/g, "").toUpperCase();
}

function base32Decode(input: string): Uint8Array | null {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = input.replace(/=+$/, "");
  if (!clean) return null;
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = alphabet.indexOf(ch);
    if (idx === -1) return null;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

async function computeCode(seed: string): Promise<string | null> {
  const key = base32Decode(extractSecret(seed));
  if (!key || key.length === 0) return null;
  const counter = Math.floor(Date.now() / 1000 / PERIOD);
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setUint32(0, Math.floor(counter / 2 ** 32));
  view.setUint32(4, counter >>> 0);
  try {
    const cryptoKey = await crypto.subtle.importKey(
      "raw", key as BufferSource, { name: "HMAC", hash: "SHA-1" }, false, ["sign"],
    );
    const sig = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, buf));
    const offset = sig[sig.length - 1] & 0x0f;
    const bin =
      ((sig[offset] & 0x7f) << 24) |
      (sig[offset + 1] << 16) |
      (sig[offset + 2] << 8) |
      sig[offset + 3];
    return (bin % 10 ** DIGITS).toString().padStart(DIGITS, "0");
  } catch {
    return null;
  }
}

interface TotpFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  description?: string;
  required?: boolean;
  readOnly?: boolean;
}

export default function TotpField({
  label, value, onChange, description, required, readOnly,
}: TotpFieldProps) {
  const [code, setCode] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(PERIOD);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    const tick = async () => {
      const c = await computeCode(value);
      if (!active) return;
      setCode(c);
      setRemaining(PERIOD - (Math.floor(Date.now() / 1000) % PERIOD));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [value]);

  const handleCopy = useCallback(async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <div>
      <SecretField
        label={label}
        value={value}
        onChange={onChange}
        description={description || "Clé secrète 2FA (base32 ou otpauth://) — fournie à l'activation de la double authentification"}
        required={required}
        readOnly={readOnly}
      />
      {value && (
        <div
          className="fr-mt-1w fr-p-2w"
          style={{ background: "var(--background-alt-blue-france)", borderRadius: "0.5rem" }}
        >
          {code ? (
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
              <span style={{ fontSize: "1.75rem", fontWeight: 700, letterSpacing: "0.2rem", fontFamily: "monospace" }}>
                {code.slice(0, 3)} {code.slice(3)}
              </span>
              <button
                type="button"
                className="fr-btn fr-btn--secondary fr-btn--sm"
                onClick={handleCopy}
              >
                <span className="fr-icon-clipboard-line fr-mr-1v" aria-hidden="true" />
                {copied ? "Copié" : "Copier le code"}
              </button>
              <span className="fr-text--sm" style={{ color: "var(--text-mention-grey)" }}>
                expire dans {remaining}s
              </span>
              <progress
                max={PERIOD}
                value={remaining}
                style={{ flex: 1, minWidth: "80px", height: "0.4rem" }}
                aria-label="Temps restant avant expiration du code"
              />
            </div>
          ) : (
            <span className="fr-text--sm" style={{ color: "var(--text-default-error)" }}>
              Clé 2FA invalide — vérifiez la valeur saisie.
            </span>
          )}
        </div>
      )}
    </div>
  );
}

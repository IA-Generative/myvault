# ADR-001 : Choix du moteur de secrets — Chiffrement applicatif plutôt qu'OpenBao ou Infisical

**Date** : 2026-04-11
**Statut** : Accepté
**Décideurs** : Équipe MyVault
**Contexte technique** : Coffre-fort de credentials utilisateur pour l'écosystème MirAI

---

## Contexte

MyVault doit stocker de manière sécurisée des credentials utilisateur (clés API, tokens, mots de passe) pour les applications de l'écosystème MirAI. Trois approches ont été évaluées :

- **OpenBao** (fork open-source de HashiCorp Vault, licence MPL-2.0)
- **Infisical** (gestionnaire de secrets open-source, licence MIT)
- **Chiffrement applicatif** (PostgreSQL + AES-256-GCM + HKDF-SHA256)

Le critère décisif posé par le cahier des charges est :

> Simplicité opérationnelle + intégration OIDC + API ergonomique. Si OpenBao impose une unseal ceremony trop lourde pour un usage "coffre-fort utilisateur" (≠ PKI/rotation de secrets infra), privilégier une solution plus légère.

---

## Évaluation comparative

| Critère | OpenBao | Infisical | Custom (PG + AES-256-GCM) |
|---------|---------|-----------|---------------------------|
| **Complexité opérationnelle** | Élevée — cluster HA, unseal ceremony, audit backend séparé, policies HCL | Moyenne — service dédié, Redis, migrations, UI propre | **Faible** — PostgreSQL seul, déjà dans l'infra |
| **Intégration Keycloak OIDC** | Oui (auth method OIDC) mais config multi-étapes (mount, policy, role) | Oui (SSO natif) | Oui (validation JWT directe en middleware) |
| **API REST / SDK Python** | API riche mais verbeuse (paths KV v2, policies, leases) | API propre, SDK Python existant | API sur mesure, exactement les endpoints nécessaires |
| **Unseal ceremony** | **Oui** — Shamir shares ou auto-unseal via KMS externe | Non | Non |
| **Empreinte mémoire** | ~200-500 Mo (Go runtime + backend stockage) | ~150-300 Mo (Node.js + Redis + PostgreSQL) | **~50 Mo** (FastAPI seul, PostgreSQL partagé) |
| **Dépendances ajoutées** | Consul ou Raft, éventuellement KMS pour auto-unseal | Redis, service Infisical dédié | Aucune (bibliothèque `cryptography` Python) |
| **Licence OSS** | MPL-2.0 | MIT (core), propriétaire (enterprise) | — |
| **Auditabilité du chiffrement** | Boîte noire (code Go interne) | Boîte noire (service externe) | **~50 lignes Python** lisibles et auditables |

---

## Décision

**Retenu : Chiffrement applicatif (PostgreSQL + AES-256-GCM + HKDF-SHA256)**

---

## Justification détaillée

### 1. L'unseal ceremony est disproportionnée pour ce cas d'usage

OpenBao exige qu'au démarrage, N opérateurs fournissent leurs clés Shamir pour déverrouiller le vault. Ce mécanisme est conçu pour des **secrets d'infrastructure** (certificats PKI, credentials de bases de données, clés de chiffrement) gérés par des équipes SRE dans des environnements haute sécurité.

MyVault est un coffre-fort **utilisateur** : chaque agent stocke sa propre clé API Grist ou son token LinkedIn. Les implications de l'unseal ceremony :

- **À chaque redémarrage de pod Kubernetes**, intervention humaine requise (ou configuration d'un auto-unseal via KMS)
- **L'auto-unseal nécessite un KMS externe** (AWS KMS, GCP KMS, Azure Key Vault) — ce qui contredit la contrainte souveraine "pas de dépendance à un SaaS externe"
- **Alternative souveraine** : auto-unseal via Transit engine d'un autre OpenBao → nécessite un deuxième cluster, complexité opérationnelle doublée

### 2. La complexité opérationnelle n'apporte pas de valeur

OpenBao nécessite de gérer :

| Composant | Charge opérationnelle |
|-----------|----------------------|
| Backend de stockage | Consul (cluster 3 nœuds) ou Raft intégré (quorum) |
| Policies | Fichiers HCL par path, par rôle, par application |
| Token lifecycle | Renewal, revocation, orphan tokens, leases |
| Audit backend | Fichier, syslog, ou socket — séparé du log applicatif |
| Seal management | Monitoring de l'état sealed/unsealed, procédure de recovery |
| Montées de version | Migration du backend, re-seal possible, breaking changes |

Pour MyVault, le besoin se résume à **3 opérations** :
1. Chiffrer une valeur avec la clé de l'utilisateur
2. Déchiffrer une valeur avec la clé de l'utilisateur
3. Stocker/lire le résultat dans PostgreSQL

Le chiffrement applicatif fait cela en ~50 lignes de code dans `backend/app/core/encryption.py`.

### 3. La sécurité est équivalente pour ce modèle de menace

Le modèle de menace de MyVault couvre :

| Menace | Protection chiffrement applicatif | Protection OpenBao |
|--------|-----------------------------------|-------------------|
| Accès non autorisé à la DB | Valeurs chiffrées AES-256-GCM, illisibles | Identique (chiffré au repos) |
| Compromission d'un utilisateur | Clé dérivée par utilisateur (HKDF), isolation cryptographique | Policies par path (isolation logique) |
| Vol de la clé maître | Secret Kubernetes, accès restreint RBAC | Seal keys / KMS — même niveau |
| Intégrité des données | AES-GCM est un schéma AEAD (authentifié) | Identique |
| Audit des accès | Log applicatif structuré | Audit backend dédié |

La différence principale : OpenBao ajoute des **leases** (durée de vie des secrets) et une **rotation automatique**. Ces fonctionnalités sont utiles pour des secrets d'infra à durée limitée, mais les credentials utilisateur MyVault :
- Sont gérés manuellement par l'utilisateur
- N'expirent pas côté MyVault (l'expiration est côté service externe)
- Ne nécessitent pas de rotation automatique (sauf OAuth refresh tokens — voir section "Évolution")

### 4. Empreinte et souveraineté

| Critère | Chiffrement applicatif | OpenBao |
|---------|----------------------|---------|
| Pods Kubernetes | 0 supplémentaire | +1 (OpenBao) +3 (Consul) minimum |
| RAM totale ajoutée | 0 Mo | ~700 Mo - 1.5 Go |
| Dépendance externe | Aucune | Éventuellement KMS pour auto-unseal |
| Conformité SecNumCloud | Compatible | Compatible (si auto-unseal souverain) |

---

## Schéma de chiffrement retenu

```
                    Clé maître (32 octets)
                    stockée dans Secret Kubernetes
                            │
                            ▼
              ┌─────────────────────────────┐
              │  HKDF-SHA256                │
              │  info = "myvault-user-{id}" │
              └──────────────┬──────────────┘
                             │
                    Clé utilisateur (32 octets)
                    unique par user_id
                             │
                             ▼
              ┌─────────────────────────────┐
              │  AES-256-GCM                │
              │  nonce = random(12 octets)  │
              │  plaintext → ciphertext     │
              └──────────────┬──────────────┘
                             │
                    base64(nonce + ciphertext)
                    stocké dans PostgreSQL (colonne JSON)
```

**Propriétés** :
- Chaque utilisateur a une clé unique (compromission d'un user ≠ compromission de tous)
- Chaque opération de chiffrement utilise un nonce aléatoire (pas de ciphertext identique pour une même valeur)
- AES-GCM fournit confidentialité ET intégrité (détection de toute altération)
- La clé maître ne quitte jamais le Secret Kubernetes

### Protection de la clé maître

Le Secret Kubernetes contenant la clé maître peut lui-même être protégé par un vault d'infrastructure (OpenBao, HashiCorp Vault, ou tout KMS souverain). Dans cette configuration :

```
┌──────────────────────────────────┐
│  Vault d'infrastructure          │
│  (OpenBao / Vault / KMS)         │
│                                  │
│  Stocke et injecte la clé       │
│  maître dans le Secret K8s      │
└──────────────┬───────────────────┘
               │ Sealed Secret / CSI driver / Agent injector
               ▼
┌──────────────────────────────────┐
│  Secret Kubernetes               │
│  MYVAULT_MASTER_KEY             │
└──────────────┬───────────────────┘
               │ Variable d'environnement (pod)
               ▼
         MyVault Backend
```

Cela permet de bénéficier de la gestion centralisée des secrets d'infrastructure (rotation, audit, contrôle d'accès, unseal ceremony) **là où elle a du sens** — pour protéger la clé maître elle-même — tout en gardant le chiffrement applicatif simple côté MyVault pour les credentials utilisateur.

Mécanismes d'injection possibles :
- **Vault Agent Injector** : sidecar qui injecte le secret dans le pod au démarrage
- **CSI Secret Store Driver** : monte le secret comme volume depuis le vault
- **External Secrets Operator** : synchronise le vault vers un Secret Kubernetes natif
- **Sealed Secrets** (Bitnami) : chiffre le Secret dans Git, déchiffré par le contrôleur en cluster

Cette approche sépare clairement les responsabilités : le vault d'infrastructure protège les **secrets de déploiement** (clé maître, credentials DB, OIDC client secret), tandis que MyVault protège les **secrets utilisateur** (clés API, tokens personnels).

---

## Risques et mitigations

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Compromission de la clé maître | Faible | Critique | RBAC K8s strict, rotation possible (re-chiffrement en background), stockage optionnel dans un vault d'infrastructure |
| Bug dans le code de chiffrement | Faible | Élevé | Code court (~50 lignes), bibliothèque `cryptography` maintenue par PyCA, tests unitaires exhaustifs |
| Perte de la clé maître | Faible | Critique | Backup du Secret K8s, procédure de disaster recovery documentée |
| Besoin futur de rotation automatique | Moyenne | Faible | Migration vers OpenBao possible sans changement d'API (voir section Évolution) |

---

## Conditions de réversibilité

Cette décision peut être révisée si MyVault évolue vers :

1. **Rotation automatique de tokens OAuth** (refresh flows avec expiration) — nécessiterait un mécanisme de leases
2. **Gestion de certificats PKI** avec expiration et renouvellement automatique
3. **Partage de secrets d'équipe** avec des policies granulaires par rôle/groupe
4. **Intégration d'un KMS souverain** (ex : Cloud Pi Native HSM) permettant un auto-unseal sans dépendance SaaS

L'architecture actuelle facilite cette migration : il suffit de remplacer les deux fichiers `encryption.py` et `vault_service.py` par des appels à l'API OpenBao, sans modifier les routes API, le frontend, le SDK, ni les tests e2e.

---

## Références

- [NIST SP 800-38D](https://csrc.nist.gov/publications/detail/sp/800-38d/final) — Recommendation for GCM Mode
- [RFC 5869](https://datatracker.ietf.org/doc/html/rfc5869) — HMAC-based Extract-and-Expand Key Derivation Function (HKDF)
- [OpenBao Documentation](https://openbao.org/docs/) — Seal/Unseal, Auth Methods, Secret Engines
- [PyCA cryptography](https://cryptography.io/) — Bibliothèque utilisée pour AES-GCM et HKDF

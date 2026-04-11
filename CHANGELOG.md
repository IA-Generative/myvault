# Changelog

Tous les changements notables de ce projet sont documentés ici.

## [1.0.0-beta] — 2026-04-11

### Ajouté

**Backend**
- FastAPI avec chiffrement AES-256-GCM et dérivation de clé par utilisateur (HKDF-SHA256)
- Authentification OIDC via Keycloak (client public, PKCE S256)
- API REST : utilisateur, administration, machine-to-machine, bridge, personal vault
- Catégorie `manual` / `api` / `both` sur chaque variable pour séparation automatique
- Test API générique côté serveur (réseau Docker/K8s interne)
- Audit logging de tous les accès aux secrets
- Health checks (liveness + readiness) pour Kubernetes
- Tables auto-créées au démarrage (idempotent)

**Frontend**
- React + DSFR (Design System de l'État) + TypeScript + Vite
- Navigation : Mes applications, Coffre personnel, Administration, Aide
- Double onglet **Accès manuel** / **Accès API** par application
- Endpoints API connus pré-remplis et en lecture seule (grisés)
- Bouton **Ouvrir** : split-screen (app à gauche, credentials à droite via popup latérale)
- Bouton **Tester l'API** inline dans l'onglet API
- Coffre personnel : gestionnaire de mots de passe libre (CRUD)
- Champs secrets avec toggle visibilité et copie presse-papier
- Onboarding : import d'applications d'exemple en un clic
- Badge Beta sur le titre
- Auth OIDC avec `oidc-client-ts` (authorization code + PKCE)

**Applications pré-configurées**
- Grist, GitHub, iObeya, Tchap, Mattermost
- Chacune avec accès manuel (login/password) et accès API (tokens/endpoints)
- Logos hébergés localement

**Infrastructure**
- PostgreSQL et Keycloak partagés avec owuicore-main (réseau `owui-net`)
- Docker Compose sans PostgreSQL dédié (base `myvault` dans le PG partagé)
- Kubernetes : Kustomize avec overlays dev et prod-scaleway
- CI/CD GitHub Actions (lint, tests, build, scan de sécurité, release)

**Intégration**
- SDK Python `myvault-client` pour tools OpenWebUI
- Auto-enrôlement des applications
- Widget overlay embarquable (Shadow DOM)
- Extension navigateur MyVault Assistant (Manifest V3)
- Bridge multi-format : export/import en JSON, .env, YAML
- Import/Export au format compatible Keycloak (avec `myvault.icon_url`, `myvault.variables`)
- Prompt d'intégration pour adapter les tools existants

**Documentation**
- README, architecture (avec ADR-001), spécification fonctionnelle
- Guide utilisateur (in-app + Markdown), guide d'intégration
- Client Keycloak et applications d'exemple prêts à importer
- Plans de tests manuels (36 cas), checklist, template de rapport

**Keycloak (owuicore-main)**
- Client `myvault` public avec PKCE dans le realm `openwebui`
- Rôle client `myvault-admin` attribué à user1
- Protocol mapper `myvault-client-roles` pour `resource_access.myvault.roles`

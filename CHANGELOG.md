# Changelog

Tous les changements notables de ce projet sont documentés ici.

## [1.0.0] — 2026-04-11

### Ajouté

- Backend FastAPI avec chiffrement AES-256-GCM et dérivation de clé par utilisateur (HKDF-SHA256)
- Authentification OIDC via Keycloak avec mode développement
- API REST complète : utilisateur, administration, machine-to-machine, bridge
- Frontend React avec Design System de l'État (DSFR)
- 14 types de variables supportés (text, secret, api_key, url, boolean, etc.)
- Champs secrets avec toggle visibilité et copie presse-papier
- Test de connexion avec feedback visuel
- Bridge multi-format : export/import en JSON, .env, YAML avec mapping d'aliases
- SDK Python `myvault-client` pour intégration dans les tools OpenWebUI
- Auto-enrôlement des applications (tools)
- Widget overlay embarquable pour applications tierces
- Extension navigateur MyVault Assistant (Manifest V3, Chrome + Firefox)
- Docker Compose pour déploiement local
- Manifestes Kubernetes avec Kustomize (base, dev, prod-scaleway)
- Tests unitaires, e2e, charge, et plans de tests manuels
- CI/CD GitHub Actions (lint, tests, build, scan de sécurité)
- Documentation complète (architecture, fonctionnelle, guide utilisateur, intégration)
- Import/Export au format compatible Keycloak
- Audit logging de tous les accès aux secrets
- Health checks (liveness + readiness) pour Kubernetes

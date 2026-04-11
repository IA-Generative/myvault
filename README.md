# MyVault

[![CI](https://github.com/IA-Generative/myvault/actions/workflows/ci.yml/badge.svg)](https://github.com/IA-Generative/myvault/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

**Coffre-fort de credentials utilisateur souverain** pour l'écosystème MirAI (OpenWebUI, tools, applications internes).

MyVault permet aux agents de l'État de stocker, gérer et partager leurs identifiants (clés API, tokens, mots de passe) de manière sécurisée et centralisée, avec chiffrement AES-256-GCM et authentification SSO via Keycloak.

---

## Démarrage rapide

```bash
git clone https://github.com/IA-Generative/myvault.git
cd myvault
cp .env.example .env
make dev        # ou: docker compose -f deploy/docker/docker-compose.yml up -d
# → http://localhost:3000 (frontend)
# → http://localhost:8000/api/docs (API docs)
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│          Utilisateur (navigateur, SSO)           │
└───────────────┬─────────────────────────────────┘
                │ OIDC token
                ▼
┌─────────────────────────────────────────────────┐
│         MyVault Frontend (React + DSFR)          │
└───────────────┬─────────────────────────────────┘
                │ API REST (Bearer token)
                ▼
┌─────────────────────────────────────────────────┐
│          MyVault Backend (FastAPI)                │
│  Auth │ Vault Service │ App Registry │ Bridge    │
│              │                                   │
│     Secret Engine (AES-256-GCM + HKDF)          │
│              │                                   │
│     PostgreSQL (secrets chiffrés)                │
└─────────────────────────────────────────────────┘
```

Voir [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) pour le détail complet.

## Fonctionnalités

- **Coffre-fort personnel** : chaque utilisateur gère ses propres credentials
- **Chiffrement fort** : AES-256-GCM avec clé dérivée par utilisateur (HKDF-SHA256)
- **SSO Keycloak** : authentification OIDC, rôles admin
- **IHM DSFR** : conforme au Design System de l'État Français, accessible (RGAA)
- **API REST complète** : utilisateur, admin, machine-to-machine
- **Auto-enrôlement** : les tools s'enregistrent automatiquement
- **Test de connexion** : vérification en un clic
- **Bridge multi-format** : export/import en JSON, .env, YAML
- **SDK Python** : `myvault-client` pour intégration dans les tools OpenWebUI
- **Widget embarquable** : overlay pour applications tierces
- **Extension navigateur** : MyVault Assistant (Chrome + Firefox)
- **Import/Export Keycloak** : format compatible

## Structure du projet

```
myvault/
├── backend/           # API FastAPI + chiffrement + auth
├── frontend/          # React + DSFR
├── sdk/               # Package Python myvault-client
├── browser-extension/ # Extension navigateur (Manifest V3)
├── widget/            # Widget overlay embarquable
├── deploy/            # Docker Compose + Kubernetes
├── tests/             # E2E, load, plans de tests manuels
└── docs/              # Documentation complète
```

## Documentation

- [Architecture technique](docs/ARCHITECTURE.md)
- [Spécification fonctionnelle](docs/FUNCTIONAL_SPEC.md)
- [Guide utilisateur](docs/USER_GUIDE.md)
- [Guide d'intégration](docs/INTEGRATION_GUIDE.md)
- [Référence API](http://localhost:8000/api/docs) (OpenAPI auto-générée)

## Commandes utiles

```bash
make help              # Voir toutes les commandes
make dev               # Démarrer l'environnement complet
make test              # Lancer tous les tests
make lint              # Vérifier le code
make docker-up         # Docker Compose up
make docker-down       # Docker Compose down
make db-migrate        # Appliquer les migrations
```

## Contribuer

Voir [CONTRIBUTING.md](CONTRIBUTING.md).

## Licence

[Apache License 2.0](LICENSE)

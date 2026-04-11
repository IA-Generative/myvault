# MyVault <sup>Beta</sup>

[![CI](https://github.com/IA-Generative/myvault/actions/workflows/ci.yml/badge.svg)](https://github.com/IA-Generative/myvault/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

**Coffre-fort de credentials utilisateur souverain** pour l'écosystème MirAI (OpenWebUI, tools, applications internes).

MyVault permet aux agents de l'État de stocker, gérer et partager leurs identifiants (clés API, tokens, mots de passe) de manière sécurisée et centralisée, avec chiffrement AES-256-GCM et authentification SSO via Keycloak.

---

## Démarrage rapide

**Prérequis** : [owuicore-main](https://github.com/IA-Generative/owuicore-main) doit tourner (PostgreSQL + Keycloak partagés).

```bash
git clone https://github.com/IA-Generative/myvault.git
cd myvault
cp .env.example .env
docker compose -f deploy/docker/docker-compose.yml up -d
# → http://localhost:8085 (frontend)
# → http://localhost:8000/api/docs (API docs)
# Login : user1 / user1password (via Keycloak)
```

La base `myvault` est créée automatiquement dans le PostgreSQL partagé d'owuicore-main.
Le client OIDC `myvault` (public, PKCE) est déjà configuré dans le realm `openwebui`.

## Architecture

```
owuicore-main (réseau Docker owui-net)
├── PostgreSQL ─── base "myvault" (partagée)
├── Keycloak ───── realm "openwebui", client "myvault" (PKCE)
│
├── MyVault Frontend (:8085) ── React + DSFR ── OIDC auth
├── MyVault Backend  (:8000) ── FastAPI ── AES-256-GCM ── HKDF
│
└── OpenWebUI, Grist, iObeya, Tchap, Mattermost...
```

Voir [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) et [ADR-001 (choix du moteur de secrets)](docs/adr/ADR-001-choix-moteur-secrets.md).

## Fonctionnalités

### Pour l'utilisateur
- **Mes applications** : tableau des apps avec statut, bouton **Configurer** / **Ouvrir**
- **Accès manuel** : login + mot de passe pour se connecter via le navigateur
- **Accès API** : tokens et clés pour que les agents IA accèdent aux données en votre nom
- **Bouton Ouvrir** : ouvre l'app + affiche les credentials en split-screen (popup latérale)
- **Coffre personnel** : ajout libre de logins/mots de passe (gestionnaire de mots de passe)
- **Chiffrement AES-256-GCM** : clé dérivée par utilisateur, personne d'autre ne peut lire vos secrets

### Pour l'administrateur
- **Gestion des applications** : CRUD, import/export Keycloak JSON
- **Import rapide** : 5 applications d'exemple en un clic (Grist, GitHub, iObeya, Tchap, Mattermost)
- **Variables typées** : 14 types (text, url, api_key, password, login, etc.) avec catégorie manual/api
- **Endpoints API pré-remplis** : les URLs connues sont en lecture seule
- **Test API** : vérification de connectivité côté serveur (réseau Docker/K8s)

### Intégration
- **SSO Keycloak** : OIDC public avec PKCE, rôle client `myvault-admin`
- **SDK Python** : `myvault-client` pour tools OpenWebUI
- **Auto-enrôlement** : les tools s'enregistrent automatiquement
- **Bridge** : export/import en JSON, .env, YAML
- **Widget embarquable** et **extension navigateur** (Manifest V3)

## Applications pré-configurées

| App | Accès manuel | Accès API |
|-----|-------------|-----------|
| Grist | URL, login, mot de passe | Clé API, URL API, ID document |
| GitHub | URL, login, mot de passe | PAT (scopes repo/project/read:org), organisation, URL API |
| iObeya | URL, login, mot de passe | Token JWT, URL API, room ID, types de cartes |
| Tchap | URL, email, mot de passe | Homeserver URL, token Matrix, room ID |
| Mattermost | URL, login, mot de passe | URL API, bot token, channel ID |

## Structure du projet

```
myvault/
├── backend/           # API FastAPI + chiffrement + auth
├── frontend/          # React + DSFR (Vite + TypeScript)
├── sdk/               # Package Python myvault-client
├── browser-extension/ # Extension navigateur (Manifest V3)
├── widget/            # Widget overlay embarquable
├── deploy/            # Docker Compose + Kubernetes (Kustomize)
├── tests/             # E2E, charge (Locust), plans manuels
└── docs/              # Architecture, ADR, guides, exemples Keycloak
```

## Documentation

- [Architecture technique](docs/ARCHITECTURE.md)
- [ADR-001 : Choix du moteur de secrets](docs/adr/ADR-001-choix-moteur-secrets.md)
- [Spécification fonctionnelle](docs/FUNCTIONAL_SPEC.md)
- [Guide utilisateur](docs/USER_GUIDE.md)
- [Guide d'intégration](docs/INTEGRATION_GUIDE.md)
- [Prompt d'intégration pour tools](docs/PROMPT_INTEGRATION_TOOL.md)
- [Client Keycloak (import)](docs/keycloak-client-myvault.json)
- [Applications d'exemple (import)](docs/sample-apps-import.json)

## Commandes utiles

```bash
make help              # Voir toutes les commandes
make dev               # Docker Compose up (owuicore-main requis)
make test              # Lancer tous les tests
make lint              # Vérifier le code
make docker-down       # Arrêter les services
```

## Contribuer

Voir [CONTRIBUTING.md](CONTRIBUTING.md).

## Licence

[Apache License 2.0](LICENSE)

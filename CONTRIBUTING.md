# Contribuer à MyVault

## Prérequis

- Python 3.12+
- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 16 (ou via Docker)

## Installation locale

```bash
# Backend
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Frontend
cd frontend
npm install

# Copier la configuration
cp .env.example .env
```

## Lancer en développement

```bash
# Option 1 : Docker (recommandé)
make dev

# Option 2 : Sans Docker
# Terminal 1 : PostgreSQL doit tourner
make dev-backend

# Terminal 2 :
make dev-frontend
```

## Tests

```bash
make test              # Tous les tests
make test-backend      # Tests backend uniquement
make test-frontend     # Tests frontend uniquement
make test-e2e          # Tests end-to-end (nécessite l'app en cours d'exécution)
```

## Conventions

- **Backend** : Python, formaté avec `ruff`, typé avec `mypy`
- **Frontend** : TypeScript, composants React fonctionnels
- **Commits** : messages en anglais, format conventionnel (`feat:`, `fix:`, `docs:`)
- **Branches** : `feature/xxx`, `fix/xxx`, `docs/xxx`
- **Pas de secrets** dans le code — utiliser `.env` et les secrets Kubernetes

## Sécurité

Si vous découvrez une vulnérabilité, ne créez pas d'issue publique. Contactez l'équipe via les canaux internes.

# Plan de tests manuels — MyVault

Ce plan est conçu pour être exécuté par un testeur humain. Chaque test a un identifiant, des prérequis, des étapes numérotées et un résultat attendu.

---

## Catégorie A — Accès et authentification

| ID | Test | Prérequis | Étapes | Résultat attendu |
|----|------|-----------|--------|------------------|
| A1 | Connexion SSO | Compte Keycloak actif | 1. Ouvrir MyVault 2. Cliquer "Se connecter" 3. S'authentifier sur Keycloak | Redirigé vers le coffre-fort, nom affiché en haut à droite |
| A2 | Auto-provisionnement | Premier accès | 1. Se connecter avec un compte jamais utilisé | Coffre-fort vide affiché, aucune erreur |
| A3 | Déconnexion | Connecté | 1. Cliquer "Se déconnecter" 2. Tenter d'accéder à /api/v1/me/apps | Redirigé vers login, API retourne 401 |
| A4 | Accès admin refusé | Compte sans rôle admin | 1. Tenter d'accéder à /admin | Message "Accès non autorisé" ou redirection |

## Catégorie B — Gestion des credentials utilisateur

| ID | Test | Prérequis | Étapes | Résultat attendu |
|----|------|-----------|--------|------------------|
| B1 | Saisie d'un secret | App créée par admin | 1. Ouvrir l'app 2. Saisir une clé API 3. Sauvegarder | Confirmation visuelle, valeur masquée après sauvegarde |
| B2 | Toggle visibilité | Secret sauvegardé | 1. Cliquer l'icône œil | Valeur affichée en clair. Re-clic → masquée |
| B3 | Copier un secret | Secret sauvegardé | 1. Cliquer l'icône copier 2. Coller dans un éditeur | Toast "Copié" affiché, valeur correcte collée |
| B4 | Saisie en clair | Champ secret vide | 1. Cliquer dans le champ 2. Taper une valeur | La valeur est visible pendant la saisie |
| B5 | Tous les types | App avec tous les types | 1. Remplir chaque type 2. Sauvegarder 3. Recharger | Toutes les valeurs correctement restituées |
| B6 | Activer/Désactiver | App avec credentials | 1. Cliquer le toggle | Toggle visuel changé. API ne retourne plus les credentials |
| B7 | Test connexion OK | Credentials valides | 1. Cliquer "Tester la connexion" | Spinner → badge vert avec message de succès |
| B8 | Test connexion KO | Credentials invalides | 1. Saisir un faux token 2. Tester | Spinner → badge rouge avec message d'erreur |

## Catégorie C — Administration

| ID | Test | Prérequis | Étapes | Résultat attendu |
|----|------|-----------|--------|------------------|
| C1 | Créer une application | Rôle admin | 1. Admin > Créer 2. Remplir le formulaire 3. Sauvegarder | App visible dans la liste admin et le coffre utilisateur |
| C2 | Import JSON Keycloak | Fichier JSON préparé | 1. Admin > Import 2. Charger le fichier 3. Valider | Applications créées, variables mappées |
| C3 | Export JSON | Applications existantes | 1. Admin > Export | Fichier JSON téléchargé, structure Keycloak |
| C4 | Round-trip | Export fait en C3 | 1. Supprimer les apps 2. Ré-importer | État identique |
| C5 | Admin ne voit pas les secrets | Users ont saisi des credentials | 1. Admin > Utilisateurs | Nombre de credentials visible, JAMAIS les valeurs |

## Catégorie D — Intégration tool OpenWebUI

| ID | Test | Prérequis | Étapes | Résultat attendu |
|----|------|-----------|--------|------------------|
| D1 | Auto-enrôlement | Tool avec MYVAULT_APP | 1. Appeler le tool | App créée dans MyVault si inexistante |
| D2 | Credentials manquants | User sans credentials | 1. Utiliser le tool | Message avec lien cliquable vers MyVault |
| D3 | Credentials invalides | Mauvais credentials | 1. Utiliser le tool | Message credentials invalides + lien |
| D4 | Flux complet | Aucun prérequis | 1. Utiliser un tool neuf 2. Configurer via MyVault 3. Réutiliser | Le tool fonctionne |

## Catégorie E — Sécurité

| ID | Test | Prérequis | Étapes | Résultat attendu |
|----|------|-----------|--------|------------------|
| E1 | Isolation inter-utilisateur | 2 comptes | 1. User A se connecte 2. Tenter d'accéder aux secrets de User B | 403 Forbidden |
| E2 | Token expiré | Token OIDC expiré | 1. Appeler l'API | 401 + redirect vers login |
| E3 | Client_secret invalide | Mauvais secret | 1. Appeler /vault/ avec mauvais secret | 401 Unauthorized |
| E4 | Injection SQL | Connecté | 1. Saisir `'; DROP TABLE--` dans un champ | Valeur sauvegardée littéralement |
| E5 | XSS | Connecté | 1. Saisir `<script>alert('xss')</script>` | Rendu échappé, pas d'exécution |

## Catégorie F — IHM et accessibilité

| ID | Test | Prérequis | Étapes | Résultat attendu |
|----|------|-----------|--------|------------------|
| F1 | Responsive mobile | DevTools 375px | 1. Ouvrir MyVault | Interface utilisable, pas de scroll horizontal |
| F2 | Navigation clavier | — | 1. Tab à travers les éléments | Focus visible, ordre logique |
| F3 | Guide in-app | — | 1. Cliquer Aide | Guide affiché avec DSFR |
| F4 | DSFR conformité | — | 1. Vérifier visuellement | Composants conformes au DSFR |

## Catégorie G — Bridge et export/import

| ID | Test | Prérequis | Étapes | Résultat attendu |
|----|------|-----------|--------|------------------|
| G1 | Page bridge | Credentials saisis | 1. Ouvrir /bridge/{slug} | Variables affichées, secrets masqués |
| G2 | Export JSON | Credentials saisis | 1. Cliquer "Copier JSON" 2. Coller | JSON valide |
| G3 | Export .env | Credentials saisis | 1. Cliquer "Copier .env" 2. Coller | Format KEY=VALUE correct |
| G4 | Import .env | Données .env préparées | 1. Coller dans la zone d'import 2. Analyser | Variables détectées et mappées |
| G5 | Import JSON | Données JSON préparées | 1. Coller du JSON 2. Analyser | Variables détectées et mappées |
| G6 | Mapping alias | App avec aliases configurés | 1. Importer avec noms aliasés | Variables correctement mappées |

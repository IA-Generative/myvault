# Checklist de tests — MyVault

**Testeur** : _________________________
**Date** : _________________________
**Version** : _________________________
**Environnement** : _________________________

## Accès et authentification

- [ ] A1 — Connexion SSO via Keycloak
- [ ] A2 — Auto-provisionnement au premier accès
- [ ] A3 — Déconnexion et invalidation du token
- [ ] A4 — Accès admin refusé sans le rôle

## Gestion des credentials

- [ ] B1 — Saisie et sauvegarde d'un secret
- [ ] B2 — Toggle visibilité d'un secret (œil)
- [ ] B3 — Copie d'un secret dans le presse-papier
- [ ] B4 — Saisie en clair pendant l'édition
- [ ] B5 — Tous les types de variables fonctionnent
- [ ] B6 — Activer / Désactiver une application
- [ ] B7 — Test de connexion réussi
- [ ] B8 — Test de connexion échoué

## Administration

- [ ] C1 — Création d'une application
- [ ] C2 — Import JSON format Keycloak
- [ ] C3 — Export JSON format Keycloak
- [ ] C4 — Round-trip import/export
- [ ] C5 — Admin ne voit pas les valeurs des secrets

## Intégration tools

- [ ] D1 — Auto-enrôlement d'une application
- [ ] D2 — Message credentials manquants avec lien
- [ ] D3 — Message credentials invalides avec lien
- [ ] D4 — Flux complet tool → MyVault → tool

## Sécurité

- [ ] E1 — Isolation entre utilisateurs (403)
- [ ] E2 — Token expiré (401)
- [ ] E3 — Client secret invalide (401)
- [ ] E4 — Résistance à l'injection SQL
- [ ] E5 — Résistance au XSS

## IHM et accessibilité

- [ ] F1 — Responsive mobile (375px)
- [ ] F2 — Navigation clavier complète
- [ ] F3 — Guide utilisateur in-app
- [ ] F4 — Conformité DSFR

## Bridge

- [ ] G1 — Page bridge accessible
- [ ] G2 — Export JSON
- [ ] G3 — Export .env
- [ ] G4 — Import .env
- [ ] G5 — Import JSON
- [ ] G6 — Mapping des aliases

---

**Résultat global** : _____ / 31 tests passés

**Commentaires** :


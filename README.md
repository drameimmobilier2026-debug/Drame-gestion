# DRAMÉ Gestion — Déploiement (Supabase + Netlify)

Application React (Vite) **complète et à jour** : toutes les fonctionnalités (quittances et reçus PDF, assistant vocal, recouvrement, versements, mode sombre, PWA installable…) avec **authentification réelle et sauvegarde dans le cloud via Supabase**. Le code a été **compilé et vérifié** (`npm run build` réussi).

## Comment ça marche (en bref)
- **Connexion** : chaque utilisateur crée un compte (email + mot de passe) géré par Supabase.
- **Sauvegarde** : toutes vos données sont enregistrées automatiquement dans Supabase, liées à votre compte. Vous pouvez fermer, changer d'appareil, vous reconnecter : tout est là.
- **Première connexion** : l'application démarre avec vos données déjà saisies (immeubles, locaux, 15 locataires). Vous continuez simplement à les modifier ; chaque changement est sauvegardé.
- **Assistant vocal** : une petite fonction serveur (incluse) parle à l'IA sans jamais exposer votre clé.

---

## Étape 1 — Créer la base Supabase (obligatoire, sans code)
1. Créez un compte sur [supabase.com](https://supabase.com) puis **New project**.
2. Donnez un nom, un mot de passe de base de données (notez-le), choisissez une région proche (Europe convient).
3. Attendez ~2 min que le projet soit prêt.
4. **SQL Editor -> New query** : collez tout le contenu du fichier `supabase-schema.sql` (fourni dans ce dossier), puis **Run**. Cela crée la table de sauvegarde et les règles de sécurité.
5. **Authentication -> Providers -> Email** : vérifiez que la connexion par email est activée (c'est le cas par défaut).
6. Pour tester sans validation d'email au début : **Authentication -> Sign In / Providers -> Confirm email : OFF** (à réactiver plus tard si vous voulez la vérification par email).
7. **Settings -> API** : notez votre **Project URL** et votre clé **anon public**. Vous en aurez besoin à l'étape 3.

## Étape 2 — Obtenir une clé API Anthropic (pour l'assistant vocal)
1. Créez une clé sur [console.anthropic.com](https://console.anthropic.com) (section API Keys).
2. Notez-la (commence par `sk-ant-...`). Elle restera côté serveur, jamais dans le navigateur.

*(Si vous ne voulez pas de l'assistant vocal tout de suite, vous pouvez sauter cette étape — tout le reste de l'app fonctionnera ; seul l'assistant répondra « connexion impossible ».)*

## Étape 3 — Déployer sur Netlify
**La méthode la plus simple, sans terminal :**
1. Mettez ce dossier sur GitHub (nouveau dépôt, poussez le code).
2. Sur [netlify.com](https://netlify.com) -> **Add new site -> Import an existing project** -> choisissez GitHub -> sélectionnez ce dépôt.
3. Netlify détecte la configuration automatiquement (grâce au fichier `netlify.toml` : commande `npm run build`, dossier `dist`, fonctions dans `netlify/functions`).
4. **Avant de déployer**, cliquez sur **Add environment variables** et ajoutez ces trois valeurs :
   - `VITE_SUPABASE_URL` -> votre Project URL (étape 1.7)
   - `VITE_SUPABASE_ANON_KEY` -> votre clé anon public (étape 1.7)
   - `ANTHROPIC_API_KEY` -> votre clé Anthropic (étape 2)
5. Cliquez **Deploy**. En 1 à 2 minutes vous obtenez une adresse du type `votre-site.netlify.app`.

C'est en ligne. Créez votre compte depuis l'écran de connexion, et l'application démarre avec vos données.

**Variante en ligne de commande (optionnelle) :**
```bash
npm install -g netlify-cli
netlify login
netlify init          # relie ce dossier à un site Netlify
netlify env:set VITE_SUPABASE_URL "https://votre-projet.supabase.co"
netlify env:set VITE_SUPABASE_ANON_KEY "votre-cle-anon"
netlify env:set ANTHROPIC_API_KEY "sk-ant-votre-cle"
netlify deploy --build --prod
```

---

## Tester en local (facultatif, avant le déploiement)
```bash
npm install
cp .env.example .env      # puis renseignez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans .env
npm run dev
```
Ouvrez l'adresse affichée. **Note** : en `npm run dev`, l'assistant vocal n'est pas disponible (la fonction serveur ne tourne pas). Pour tester l'assistant en local aussi, utilisez `netlify dev` (avec la CLI Netlify) au lieu de `npm run dev`, après avoir mis `ANTHROPIC_API_KEY` dans `.env`.

## Installer l'app sur le téléphone (PWA)
Une fois le site en ligne (HTTPS), l'installation est automatique :
- **Android (Chrome)** : menu options -> « Installer l'application ».
- **iPhone (Safari)** : bouton Partager -> « Sur l'écran d'accueil ».
- **Ordinateur (Chrome/Edge)** : icône d'installation dans la barre d'adresse.

## Où changer quoi
- Icône / nom affiché : bloc `manifest` dans `vite.config.js` + fichiers PNG dans `public/`.
- Modèle d'IA de l'assistant : `netlify/functions/assistant.js`.
- Le code de l'application : `src/App.jsx` (fichier unique).

---

## Récapitulatif
| Étape | Statut |
|---|---|
| Projet compilable (`npm run build`) | OK, déjà vérifié |
| Authentification + sauvegarde cloud (Supabase) | intégré dans ce code |
| Base Supabase à créer | à faire (étape 1) |
| Clé Anthropic pour l'assistant vocal | à faire (étape 2) |
| Mise en ligne (Netlify) | à faire (étape 3) |
| PWA installable | automatique une fois en ligne |

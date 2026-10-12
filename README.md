# 🪐 Satisfactory Interactive Map — FICSIT Pioneer Edition

Une réplique **100% fidèle et sans restriction** de la carte interactive Satisfactory de MapGenie (MASSAGE-2(A-B)b), conçue pour contourner la limite artificielle des 100 marqueurs gratuits.

## ✨ Fonctionnalités Clés

- **Tuiles Officielles Haute Définition** : Rendu WebGL (MapLibre GL) avec les tuiles officielles du monde Satisfactory (zoom 8 à 15).
- **2 509 Marqueurs Complets** :
  - **Collectibles** : Disques durs (Crash Sites avec prérequis d'ouverture en MW et composants), Sphères de Mercer, Somersloops, Cassettes Boombox.
  - **Limaces Énergétiques** : Bleues (596), Jaunes (389), Violettes (257).
  - **Gisements de Ressources** : Purs, Normaux, Impurs (Fer, Cuivre, Charbon, Pétrole, Bauxite, Quartz, Soufre, Uranium, SAM, Azote, Eau, Geysers).
  - **Points d'exploration** : Accès souterrains et grottes (135 entrées détaillées).
- **Suivi & Marquage Illimité (Anti-Paywall)** :
  - Marquez autant d'objets que vous voulez (0 à 2509).
  - Statut visuel immédiat (icône estompée avec badge vert ✓).
  - Option **« Masquer récupérés »** pour nettoyer la carte en temps réel.
  - Barre de progression globale en direct et compteurs par catégorie.
- **Persistance & Sauvegarde** :
  - Sauvegarde automatique continue dans `localStorage`.
  - **Export JSON** : Téléchargement en un clic de votre fichier de progression.
  - **Import JSON** : Restauration instantanée sur n'importe quel ordinateur ou navigateur.
  - **Réinitialisation sécurisée** avec confirmation.
- **Recherche & Filtres Avancés** :
  - Recherche instantanée par nom, prérequis (ex: `40 MW`, `Rotor`, `Soufre`, `Grotte`).
  - Filtres rapides par groupe (Objets, Limaces, Purs, Normaux, Impurs, Grottes).
  - Clic droit sur une catégorie : « Tout marquer comme récupéré » ou « Tout décocher ».
- **Balises Personnelles (+ Balise)** :
  - Ajoutez vos propres repères FICSIT (Usines, Gares, Hub, Dangers) avec vos notes personnelles.

## ⌨️ Raccourcis Clavier

- `[` ou `Ctrl+B` : Afficher / Masquer la barre latérale.
- `F` ou `Espace` : Marquer / Démarquer l'objet sélectionné comme récupéré.
- `/` : Activer la barre de recherche.
- `Échap` : Fermer le panneau de détail ou les fenêtres modales.

## 🚀 Démarrage en local

```bash
# Lancer le serveur local
npm run dev

# Ouvrir dans votre navigateur
http://localhost:5173
```

## 🌐 Déploiement sur GitHub Pages

Le projet inclut une configuration prête pour GitHub Pages avec un workflow automatique (`.github/workflows/deploy.yml`) :

1. Poussez votre code sur GitHub :
   ```bash
   git add .
   git commit -m "feat: complete satisfactory interactive map"
   git push origin main
   ```
2. Sur votre dépôt GitHub :
   - Allez dans **Settings** > **Pages**
   - Sous **Build and deployment > Source**, sélectionnez **GitHub Actions**
3. C'est tout ! À chaque `git push`, le site est automatiquement compilé et déployé à l'adresse :
   `https://clementtorchiat.github.io/mapgenie-outpass/`

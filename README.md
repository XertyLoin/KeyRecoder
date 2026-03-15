# ⌨️ KeyRecoder

**KeyRecoder** est un logiciel d'overlay clavier ultra-léger et stylé conçu pour les streamers et créateurs de contenu. Inspiré du plugin OBS "Input Overlay", il permet d'afficher vos touches pressées en temps réel avec un design moderne et personnalisable.

![License](https://img.shields.io/badge/license-ISC-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows-lightgrey.svg)
![Electron](https://img.shields.io/badge/built%20with-Electron-9feaf9.svg)

---

## ✨ Caractéristiques

- 🚀 **Performance** : Détection globale des touches via `uiohook-napi` (très faible latence).
- 🎨 **Design Premium** : Interface moderne avec effets de flou (Glassmorphism), ombres portées et animations fluides.
- 📐 **Éditeur de Layout** :
  - Déplacez et redimensionnez vos touches sur une grille de **20px**.
  - Gestion des unités (1 unité = 20px) pour un alignement parfait.
  - Importez vos propres icônes ou images pour chaque touche.
- 🎵 **Sound Design** : Retours sonores configurables (clics mécaniques, sons d'interface).
- 🎥 **Intégration OBS** :
  - Serveur local intégré servant une version optimisée pour les sources navigateurs OBS.
  - Mode "Capture Software" pour masquer l'overlay local et ne garder que la source OBS.
- 🖱️ **Mouvement Libres** : Déplacez l'overlay directement à la souris et verrouillez sa position instantanément.
- 📚 **Bibliothèque de Layouts** : 
  - Sauvegardez plusieurs configurations différentes.
  - Basculez instantanément entre vos layouts (ex: un layout par jeu).
  - Gestion plein écran avec interface premium.

---

## 🚀 Installation & Lancement

### Prérequis
- [Node.js](https://nodejs.org/) (version 18+)
- [Git](https://git-scm.com/)

### Étapes
1. Clonez le dépôt :
   ```bash
   git clone https://github.com/XertyLoin/KeyRecoder.git
   cd KeyRecoder
   ```

2. Installez les dépendances :
   ```bash
   npm install
   ```

3. Lancez l'application :
   ```bash
   npm start
   ```

---

## 🛠️ Utilisation

### Éditeur de Layout
- Accédez à l'éditeur via l'icône dans la **barre des tâches (System Tray)**.
- **Ajouter une touche** : Cliquez sur le bouton "Add Key".
- **Assigner une touche** : Sélectionnez une touche, cliquez sur "Press to assign" et appuyez sur la touche physique souhaitée.
- **Grille** : Les touches s'aimantent par défaut. Maintenez **CTRL** pour un déplacement libre.
- **Unités** : Modifiez la position (X/Y) et la taille (W/H) directement en unités de grille.

### Déplacer l'Overlay
1. Dans l'éditeur, cliquez sur **Move Overlay**.
2. Cliquez n'importe où sur l'overlay et faites-le glisser.
3. Relâchez le clic pour verrouiller la position.

### Intégration OBS
1. Copiez l'URL affichée dans le panneau OBS de l'éditeur (ex: `http://localhost:4242`).
2. Dans OBS, ajoutez une **Source Navigateur**.
3. Collez l'URL et ajustez la taille (ex: 800x600 ou selon votre layout).

---

## 📦 Technologies Utilisées

- **Core** : [Electron.js](https://www.electronjs.org/)
- **Inputs** : `uiohook-napi`
- **UI** : HTML5, CSS3 (Vanilla), JavaScript (ES6+)
- **Audio** : Web Audio API
- **Persistence** : `electron-store`

---

## 📄 Licence

Ce projet est sous licence ISC.

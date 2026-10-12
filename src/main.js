import { state } from './state.js';
import { SatisfactoryMap } from './map.js';
import { UIManager } from './ui.js';

async function bootstrap() {
  try {
    const baseUrl = import.meta.env.BASE_URL || './';
    const dataUrl = baseUrl.endsWith('/') ? `${baseUrl}data/map-data.json` : `${baseUrl}/data/map-data.json`;
    const response = await fetch(dataUrl);
    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status} lors du chargement des données`);
    }
    const mapData = await response.json();

    // 1. Initialize State
    state.init(mapData);

    // 2. Initialize MapLibre Map
    const mapInstance = new SatisfactoryMap('map', mapData);
    await mapInstance.init();

    // 3. Initialize UI
    const uiManager = new UIManager(mapInstance, mapData);
    uiManager.init();

    console.log('FICSIT P.I.O.N.E.E.R. Map System initialized with', mapData.locations.length, 'locations.');
  } catch (err) {
    console.error('Initialization error:', err);
    const container = document.getElementById('categories-tree');
    if (container) {
      container.innerHTML = `
        <div style="padding: 20px; color: var(--ficsit-danger); font-family: var(--font-hud);">
          <h3>ÉCHEC DU CHARGEMENT</h3>
          <p style="font-size: 13px; color: var(--text-secondary); margin-top: 6px;">
            ${err.message}
          </p>
        </div>
      `;
    }
  }
}

document.addEventListener('DOMContentLoaded', bootstrap);

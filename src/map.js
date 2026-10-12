import * as maplibregl from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { state } from './state.js';

maplibregl.setWorkerUrl(workerUrl);

export class SatisfactoryMap {
  constructor(containerId, mapData) {
    this.containerId = containerId;
    this.mapData = mapData;
    this.map = null;
    this.isLoaded = false;
    this.spriteImage = null;
    this.allFeatures = [];
  }

  async init() {
    return new Promise(async (resolve, reject) => {
      try {
        const { center, bounds, initialZoom, minZoom, maxZoom, tilesUrl } = this.mapData.mapInfo;

        this.map = new maplibregl.Map({
          container: this.containerId,
          style: {
            version: 8,
            sources: {
              'massage-tiles': {
                type: 'raster',
                tiles: [tilesUrl],
                tileSize: 256,
                bounds: bounds, // [-1.4, 0, 0, 1.4]
                minzoom: minZoom,
                maxzoom: maxZoom
              }
            },
            layers: [
              {
                id: 'massage-tiles-layer',
                type: 'raster',
                source: 'massage-tiles',
                minzoom: minZoom,
                maxzoom: maxZoom
              }
            ]
          },
          center: center,
          zoom: initialZoom,
          minZoom: minZoom,
          maxZoom: maxZoom,
          maxBounds: [[-1.55, -0.05], [0.05, 1.45]],
          attributionControl: false
        });

        // Add Navigation controls (zoom in/out)
        this.map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

        // Load sprite sheet image
        await this.loadSpriteSheet('/icons.png');

        this.map.on('load', () => {
          this.isLoaded = true;
          this.registerPinIcons();
          this.buildFeatures();
          this.setupLayers();
          this.setupEvents();
          resolve(this);
        });

        this.map.on('error', (e) => {
          console.warn('MapLibre error event:', e);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  loadSpriteSheet(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.spriteImage = img;
        resolve(img);
      };
      img.onerror = reject;
      img.src = src;
    });
  }

  // Generate crisp circular pin icons with custom group colors and sprite icons
  registerPinIcons() {
    const categories = Object.values(this.mapData.categoriesById);
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // Track registered icon keys to avoid duplicate work
    const registered = new Set();

    for (const cat of categories) {
      const iconKey = cat.icon || 'point_of_interest';
      if (registered.has(iconKey)) continue;
      registered.add(iconKey);

      const iconIndex = cat.iconIndex || 0;
      const groupColor = cat.groupColor || '#BA8E23';

      // 1. Regular Pin
      this.drawPin(ctx, iconIndex, groupColor, false);
      const normalData = ctx.getImageData(0, 0, 64, 64);
      if (this.map.hasImage(iconKey)) {
        this.map.updateImage(iconKey, normalData);
      } else {
        this.map.addImage(iconKey, normalData);
      }

      // 2. Found / Collected Pin (muted + green checkmark badge)
      this.drawPin(ctx, iconIndex, groupColor, true);
      const foundData = ctx.getImageData(0, 0, 64, 64);
      const foundKey = `${iconKey}_found`;
      if (this.map.hasImage(foundKey)) {
        this.map.updateImage(foundKey, foundData);
      } else {
        this.map.addImage(foundKey, foundData);
      }
    }

    // Custom Pin Icons (beacon, factory, hub, train, danger)
    this.registerCustomPinIcons(ctx);
  }

  drawPin(ctx, iconIndex, groupColor, isFound) {
    ctx.clearRect(0, 0, 64, 64);

    const centerX = 32;
    const centerY = 32;
    const radius = 22;

    ctx.save();

    if (isFound) {
      // Dimmed / grayed-out background for collected item
      ctx.globalAlpha = 0.45;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 2;

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#222b38';
      ctx.fill();

      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.stroke();
    } else {
      // Vibrant glowing pin with group color
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 3;

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fillStyle = groupColor;
      ctx.fill();

      // Inner subtle border
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.stroke();
    }

    // Draw sprite icon in center
    if (this.spriteImage) {
      const spriteY = iconIndex * 48;
      const targetSize = 26;
      const targetX = centerX - targetSize / 2;
      const targetY = centerY - targetSize / 2;

      ctx.drawImage(
        this.spriteImage,
        0, spriteY, 48, 48,
        targetX, targetY, targetSize, targetSize
      );
    }

    ctx.restore();

    // If found, draw a crisp green checkmark badge on top right
    if (isFound) {
      ctx.save();
      const badgeX = 46;
      const badgeY = 18;
      const badgeR = 9;

      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 1;

      ctx.beginPath();
      ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2);
      ctx.fillStyle = '#00e676';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#0f141c';
      ctx.stroke();

      // Checkmark icon
      ctx.beginPath();
      ctx.moveTo(badgeX - 4, badgeY);
      ctx.lineTo(badgeX - 1, badgeY + 3);
      ctx.lineTo(badgeX + 4, badgeY - 3);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#000';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      ctx.restore();
    }
  }

  registerCustomPinIcons(ctx) {
    const types = [
      { key: 'custom_beacon', color: '#fa7b17', symbol: '🚩' },
      { key: 'custom_factory', color: '#00e5ff', symbol: '🏭' },
      { key: 'custom_hub', color: '#ffb300', symbol: '🚀' },
      { key: 'custom_train', color: '#7c4dff', symbol: '🚂' },
      { key: 'custom_danger', color: '#ff334b', symbol: '⚠️' }
    ];

    for (const t of types) {
      ctx.clearRect(0, 0, 64, 64);
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 3;

      ctx.beginPath();
      ctx.arc(32, 32, 22, 0, Math.PI * 2);
      ctx.fillStyle = t.color;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      ctx.font = '22px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.symbol, 32, 33);
      ctx.restore();

      const imgData = ctx.getImageData(0, 0, 64, 64);
      if (this.map.hasImage(t.key)) {
        this.map.updateImage(t.key, imgData);
      } else {
        this.map.addImage(t.key, imgData);
      }
    }
  }

  buildFeatures() {
    this.allFeatures = this.mapData.locations.map(loc => ({
      type: 'Feature',
      id: loc.id,
      geometry: {
        type: 'Point',
        coordinates: [loc.lng, loc.lat]
      },
      properties: {
        id: loc.id,
        categoryId: loc.categoryId,
        categoryTitle: loc.categoryTitle,
        groupTitle: loc.groupTitle,
        groupColor: loc.groupColor,
        icon: loc.icon || 'point_of_interest',
        title: loc.title,
        description: loc.description,
        lat: loc.lat,
        lng: loc.lng,
        hasMedia: loc.media && loc.media.length > 0
      }
    }));
  }

  setupLayers() {
    // 1. Main Locations Source
    this.map.addSource('locations-source', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: []
      }
    });

    // 2. Main Locations Symbol Layer
    this.map.addLayer({
      id: 'locations-layer',
      type: 'symbol',
      source: 'locations-source',
      layout: {
        'icon-image': [
          'case',
          ['get', 'found'],
          ['concat', ['get', 'icon'], '_found'],
          ['get', 'icon']
        ],
        'icon-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          8, 0.5,
          11, 0.7,
          13, 0.85,
          15, 1.05
        ],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true
      }
    });

    // 3. Custom Pins Source
    this.map.addSource('custom-pins-source', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: []
      }
    });

    // 4. Custom Pins Symbol Layer
    this.map.addLayer({
      id: 'custom-pins-layer',
      type: 'symbol',
      source: 'custom-pins-source',
      layout: {
        'icon-image': ['concat', 'custom_', ['get', 'type']],
        'icon-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          8, 0.6,
          12, 0.85,
          15, 1.1
        ],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true
      }
    });

    // Initial update
    this.updateLocationsData();
    this.updateCustomPinsData();
  }

  // Filter features according to active categories, search query, and hideCollected
  updateLocationsData() {
    if (!this.map || !this.map.getSource('locations-source')) return;

    const { activeCategories, hideCollected, searchQuery, groupFilter } = state;
    const query = searchQuery ? searchQuery.toLowerCase() : '';

    const visibleFeatures = [];

    for (let i = 0; i < this.allFeatures.length; i++) {
      const feat = this.allFeatures[i];
      const props = feat.properties;
      const isFound = state.isFound(props.id);

      // Category filter
      if (!activeCategories.has(props.categoryId)) continue;

      // Group filter (quick chips)
      if (groupFilter !== 'all' && props.groupTitle !== groupFilter) continue;

      // Hide collected filter
      if (hideCollected && isFound) continue;

      // Search query filter (matches title, description, or categoryTitle)
      if (query) {
        const titleMatch = (props.title || '').toLowerCase().includes(query);
        const descMatch = (props.description || '').toLowerCase().includes(query);
        const catMatch = (props.categoryTitle || '').toLowerCase().includes(query);
        if (!titleMatch && !descMatch && !catMatch) continue;
      }

      // Feature clone with updated `found` state
      visibleFeatures.push({
        ...feat,
        properties: {
          ...props,
          found: isFound
        }
      });
    }

    this.map.getSource('locations-source').setData({
      type: 'FeatureCollection',
      features: visibleFeatures
    });

    // Update HUD visible count
    const hudVis = document.getElementById('hud-visible-count');
    if (hudVis) hudVis.textContent = visibleFeatures.length;
  }

  updateCustomPinsData() {
    if (!this.map || !this.map.getSource('custom-pins-source')) return;

    const features = state.customPins.map(pin => ({
      type: 'Feature',
      id: pin.id,
      geometry: {
        type: 'Point',
        coordinates: [pin.lng, pin.lat]
      },
      properties: pin
    }));

    this.map.getSource('custom-pins-source').setData({
      type: 'FeatureCollection',
      features
    });
  }

  setupEvents() {
    // Cursor hover on locations
    this.map.on('mouseenter', 'locations-layer', () => {
      this.map.getCanvas().style.cursor = 'pointer';
    });
    this.map.on('mouseleave', 'locations-layer', () => {
      this.map.getCanvas().style.cursor = '';
    });

    // Click on location
    this.map.on('click', 'locations-layer', (e) => {
      if (!e.features || e.features.length === 0) return;
      const feature = e.features[0];
      const locId = feature.properties.id;
      const originalLoc = this.mapData.locations.find(l => l.id === Number(locId));
      if (originalLoc) {
        state.setSelectedLocation(originalLoc);
      }
    });

    // Cursor hover on custom pins
    this.map.on('mouseenter', 'custom-pins-layer', () => {
      this.map.getCanvas().style.cursor = 'pointer';
    });
    this.map.on('mouseleave', 'custom-pins-layer', () => {
      this.map.getCanvas().style.cursor = '';
    });

    // Click on custom pin
    this.map.on('click', 'custom-pins-layer', (e) => {
      if (!e.features || e.features.length === 0) return;
      const pinId = e.features[0].properties.id;
      const pin = state.customPins.find(p => p.id === pinId);
      if (pin) {
        state.setSelectedLocation({
          id: pin.id,
          title: pin.title,
          categoryTitle: 'Balise Personnelle',
          groupTitle: 'Balises',
          groupColor: '#fa7b17',
          description: pin.notes || '(Aucune note)',
          lat: pin.lat,
          lng: pin.lng,
          isCustom: true
        });
      }
    });

    // Update Coordinates and Zoom in HUD
    this.map.on('mousemove', (e) => {
      const latEl = document.getElementById('hud-lat');
      const lngEl = document.getElementById('hud-lng');
      if (latEl && lngEl) {
        latEl.textContent = e.lngLat.lat.toFixed(4);
        lngEl.textContent = e.lngLat.lng.toFixed(4);
      }
    });

    this.map.on('zoom', () => {
      const zoomEl = document.getElementById('hud-zoom');
      if (zoomEl) {
        zoomEl.textContent = this.map.getZoom().toFixed(1);
      }
    });

    // Reactive State Listeners
    state.on('filter-changed', () => this.updateLocationsData());
    state.on('found-toggled', () => this.updateLocationsData());
    state.on('category-batch-updated', () => this.updateLocationsData());
    state.on('custom-pins-updated', () => this.updateCustomPinsData());
  }

  flyToLocation(lat, lng, zoom = 13.5) {
    if (!this.map) return;
    this.map.flyTo({
      center: [lng, lat],
      zoom: zoom,
      speed: 1.2,
      curve: 1.4,
      essential: true
    });
  }

  resetView() {
    if (!this.map) return;
    const { center, initialZoom } = this.mapData.mapInfo;
    this.map.flyTo({
      center: center,
      zoom: initialZoom,
      speed: 1.0,
      essential: true
    });
  }
}

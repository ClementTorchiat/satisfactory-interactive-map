/**
 * Reactive State Manager for Satisfactory Map
 * Handles tracking, persistence in localStorage, category filters, and custom pins.
 */

class MapState {
  constructor() {
    this.STORAGE_KEYS = {
      FOUND: 'mapgenie_satisfactory_found',
      ACTIVE_CATS: 'mapgenie_satisfactory_active_cats',
      HIDE_COLLECTED: 'mapgenie_satisfactory_hide_collected',
      CUSTOM_PINS: 'mapgenie_satisfactory_custom_pins'
    };

    this.listeners = new Map();
    this.mapData = null;
    
    // Core state
    this.foundLocations = new Set();
    this.activeCategories = new Set();
    this.hideCollected = false;
    this.customPins = [];
    this.searchQuery = '';
    this.groupFilter = 'all';
    this.selectedLocation = null;
  }

  // Event Emitter
  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(handler);
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(h => {
        try {
          h(data);
        } catch (err) {
          console.error(`Error in event handler for ${event}:`, err);
        }
      });
    }
  }

  // Initialization
  init(mapData) {
    this.mapData = mapData;

    // Load found locations
    try {
      const storedFound = localStorage.getItem(this.STORAGE_KEYS.FOUND);
      if (storedFound) {
        const arr = JSON.parse(storedFound);
        if (Array.isArray(arr)) {
          this.foundLocations = new Set(arr);
        }
      }
    } catch (e) {
      console.warn('Failed to load found locations from localStorage:', e);
    }

    // Load active categories
    try {
      const storedCats = localStorage.getItem(this.STORAGE_KEYS.ACTIVE_CATS);
      if (storedCats) {
        const arr = JSON.parse(storedCats);
        if (Array.isArray(arr) && arr.length > 0) {
          this.activeCategories = new Set(arr);
        } else {
          // Default: all categories active
          this.activeCategories = new Set(Object.keys(mapData.categoriesById).map(Number));
        }
      } else {
        this.activeCategories = new Set(Object.keys(mapData.categoriesById).map(Number));
      }
    } catch (e) {
      this.activeCategories = new Set(Object.keys(mapData.categoriesById).map(Number));
    }

    // Load hide collected setting
    try {
      const storedHide = localStorage.getItem(this.STORAGE_KEYS.HIDE_COLLECTED);
      if (storedHide !== null) {
        this.hideCollected = storedHide === 'true';
      }
    } catch (e) {
      this.hideCollected = false;
    }

    // Load custom pins
    try {
      const storedPins = localStorage.getItem(this.STORAGE_KEYS.CUSTOM_PINS);
      if (storedPins) {
        this.customPins = JSON.parse(storedPins);
      }
    } catch (e) {
      this.customPins = [];
    }

    this.emit('state-changed', this);
    this.emit('progress-updated', this.getProgressStats());
  }

  saveFound() {
    try {
      localStorage.setItem(this.STORAGE_KEYS.FOUND, JSON.stringify(Array.from(this.foundLocations)));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }

  saveActiveCategories() {
    try {
      localStorage.setItem(this.STORAGE_KEYS.ACTIVE_CATS, JSON.stringify(Array.from(this.activeCategories)));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }

  saveHideCollected() {
    try {
      localStorage.setItem(this.STORAGE_KEYS.HIDE_COLLECTED, String(this.hideCollected));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }

  saveCustomPins() {
    try {
      localStorage.setItem(this.STORAGE_KEYS.CUSTOM_PINS, JSON.stringify(this.customPins));
    } catch (e) {
      console.warn('LocalStorage save failed:', e);
    }
  }

  // Found / Collected Logic
  toggleFound(locationId) {
    const id = Number(locationId);
    let isNowFound = false;
    if (this.foundLocations.has(id)) {
      this.foundLocations.delete(id);
      isNowFound = false;
    } else {
      this.foundLocations.add(id);
      isNowFound = true;
    }

    this.saveFound();
    this.emit('found-toggled', { id, isFound: isNowFound });
    this.emit('progress-updated', this.getProgressStats());
    this.emit('state-changed', this);
    return isNowFound;
  }

  isFound(locationId) {
    return this.foundLocations.has(Number(locationId));
  }

  markCategoryFound(categoryId, isFound = true) {
    const catId = Number(categoryId);
    const locs = this.mapData.locations.filter(l => l.categoryId === catId);
    locs.forEach(l => {
      if (isFound) {
        this.foundLocations.add(l.id);
      } else {
        this.foundLocations.delete(l.id);
      }
    });

    this.saveFound();
    this.emit('category-batch-updated', { categoryId: catId, isFound });
    this.emit('progress-updated', this.getProgressStats());
    this.emit('state-changed', this);
  }

  resetProgress() {
    this.foundLocations.clear();
    this.saveFound();
    this.emit('progress-updated', this.getProgressStats());
    this.emit('state-changed', this);
  }

  // Category Filtering
  setCategoryActive(categoryId, active) {
    const id = Number(categoryId);
    if (active) {
      this.activeCategories.add(id);
    } else {
      this.activeCategories.delete(id);
    }
    this.saveActiveCategories();
    this.emit('filter-changed', this);
  }

  toggleCategory(categoryId) {
    const id = Number(categoryId);
    this.setCategoryActive(id, !this.activeCategories.has(id));
  }

  setAllCategories(active = true) {
    if (active) {
      this.activeCategories = new Set(Object.keys(this.mapData.categoriesById).map(Number));
    } else {
      this.activeCategories.clear();
    }
    this.saveActiveCategories();
    this.emit('filter-changed', this);
  }

  setGroupFilter(groupTitle) {
    this.groupFilter = groupTitle;
    this.emit('filter-changed', this);
  }

  setSearchQuery(query) {
    this.searchQuery = (query || '').trim().toLowerCase();
    this.emit('filter-changed', this);
  }

  setHideCollected(hide) {
    this.hideCollected = Boolean(hide);
    this.saveHideCollected();
    this.emit('filter-changed', this);
  }

  setSelectedLocation(location) {
    this.selectedLocation = location;
    this.emit('location-selected', location);
  }

  // Custom Pins
  addCustomPin(pin) {
    const newPin = {
      id: 'custom_' + Date.now(),
      title: pin.title || 'Balise',
      type: pin.type || 'beacon',
      notes: pin.notes || '',
      lat: pin.lat,
      lng: pin.lng,
      createdAt: new Date().toISOString()
    };
    this.customPins.push(newPin);
    this.saveCustomPins();
    this.emit('custom-pins-updated', this.customPins);
    return newPin;
  }

  removeCustomPin(pinId) {
    this.customPins = this.customPins.filter(p => p.id !== pinId);
    this.saveCustomPins();
    this.emit('custom-pins-updated', this.customPins);
  }

  // Progress Calculations
  getProgressStats() {
    if (!this.mapData) return { totalFound: 0, totalCount: 0, percent: 0, categoryCounts: {} };

    const totalCount = this.mapData.locations.length;
    const totalFound = this.foundLocations.size;
    const percent = totalCount > 0 ? ((totalFound / totalCount) * 100).toFixed(1) : 0;

    // Category breakdown
    const categoryCounts = {};
    for (const [catIdStr, cat] of Object.entries(this.mapData.categoriesById)) {
      const catId = Number(catIdStr);
      categoryCounts[catId] = {
        found: 0,
        total: cat.count || cat.totalCount || 0
      };
    }

    for (const loc of this.mapData.locations) {
      if (this.foundLocations.has(loc.id)) {
        if (categoryCounts[loc.categoryId]) {
          categoryCounts[loc.categoryId].found++;
        }
      }
    }

    return {
      totalFound,
      totalCount,
      percent,
      categoryCounts
    };
  }

  // Backup Export & Import
  exportData() {
    const backup = {
      app: 'satisfactory-mapgenie-outpass',
      version: 1,
      exportedAt: new Date().toISOString(),
      stats: this.getProgressStats(),
      foundLocations: Array.from(this.foundLocations),
      customPins: this.customPins,
      activeCategories: Array.from(this.activeCategories),
      hideCollected: this.hideCollected
    };
    return JSON.stringify(backup, null, 2);
  }

  importData(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (!data || typeof data !== 'object') throw new Error('Format JSON invalide');

      if (Array.isArray(data.foundLocations)) {
        this.foundLocations = new Set(data.foundLocations);
        this.saveFound();
      }

      if (Array.isArray(data.customPins)) {
        this.customPins = data.customPins;
        this.saveCustomPins();
      }

      if (Array.isArray(data.activeCategories)) {
        this.activeCategories = new Set(data.activeCategories);
        this.saveActiveCategories();
      }

      if (typeof data.hideCollected === 'boolean') {
        this.hideCollected = data.hideCollected;
        this.saveHideCollected();
      }

      this.emit('progress-updated', this.getProgressStats());
      this.emit('custom-pins-updated', this.customPins);
      this.emit('filter-changed', this);
      this.emit('state-changed', this);
      return { success: true, count: this.foundLocations.size };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
}

export const state = new MapState();

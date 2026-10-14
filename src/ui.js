import { state } from './state.js';

export class UIManager {
  constructor(mapInstance, mapData) {
    this.mapInstance = mapInstance;
    this.mapData = mapData;
  }

  init() {
    this.renderCategoryTree();
    this.setupHeaderControls();
    this.setupSearchAndFilters();
    this.setupDetailFlyout();
    this.setupModals();
    this.setupKeyboardShortcuts();
    this.setupStateListeners();

    // Initial progress update
    this.updateProgressUI(state.getProgressStats());
  }

  // =========================================================================
  // Category Accordion Tree
  // =========================================================================
  renderCategoryTree() {
    const container = document.getElementById('categories-tree');
    if (!container) return;

    container.innerHTML = '';

    for (const group of this.mapData.groups) {
      const groupEl = document.createElement('div');
      groupEl.className = 'group-section';
      groupEl.dataset.groupId = group.id;
      groupEl.dataset.groupTitle = group.title;

      // Group Header
      const header = document.createElement('div');
      header.className = 'group-header';
      header.innerHTML = `
        <div class="group-title-wrap">
          <span class="group-color-pill" style="background-color: ${group.color}"></span>
          <span class="group-title">${group.title}</span>
        </div>
        <div class="group-meta">
          <span class="group-count-badge" id="group-count-${group.id}">
            <strong class="group-found-sum">0</strong> / ${group.categories.reduce((acc, c) => acc + (c.count || c.totalCount || 0), 0)}
          </span>
          <svg class="group-arrow" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      `;

      // Accordion toggle
      header.addEventListener('click', () => {
        groupEl.classList.toggle('collapsed');
      });

      // Group Body (Categories list)
      const body = document.createElement('div');
      body.className = 'group-body';

      for (const cat of group.categories) {
        const catRow = document.createElement('div');
        catRow.className = 'category-item';
        catRow.dataset.catId = cat.id;

        const isActive = state.activeCategories.has(cat.id);
        if (!isActive) catRow.classList.add('disabled');

        const iconOffset = (cat.iconIndex || 0) * 20;

        catRow.innerHTML = `
          <div class="category-row-top">
            <input type="checkbox" class="cat-checkbox" ${isActive ? 'checked' : ''} aria-label="Afficher ${cat.title}">
            <span class="cat-sprite-icon" style="background-position: 0px -${iconOffset}px;"></span>
            <span class="cat-title" title="${cat.title} (Cliquer pour centrer)">${cat.title}</span>
          </div>
          <div class="category-row-bottom">
            <div class="cat-mini-bar">
              <div class="cat-mini-bar-fill" id="cat-bar-${cat.id}" style="width: 0%"></div>
            </div>
            <span class="cat-progress-pill" id="cat-progress-${cat.id}">
              <span class="done">0</span> / ${cat.count || cat.totalCount || 0}
            </span>
          </div>
        `;

        // Checkbox change -> toggle category visibility
        const checkbox = catRow.querySelector('.cat-checkbox');
        checkbox.addEventListener('click', (e) => {
          e.stopPropagation();
          state.setCategoryActive(cat.id, checkbox.checked);
          catRow.classList.toggle('disabled', !checkbox.checked);
        });

        // Click on category row -> fly to first location of this category
        catRow.addEventListener('click', (e) => {
          if (e.target.tagName === 'INPUT') return;
          const firstLoc = this.mapData.locations.find(l => l.categoryId === cat.id);
          if (firstLoc) {
            // Ensure category is visible
            if (!state.activeCategories.has(cat.id)) {
              state.setCategoryActive(cat.id, true);
              checkbox.checked = true;
              catRow.classList.remove('disabled');
            }
            this.mapInstance.flyToLocation(firstLoc.lat, firstLoc.lng, 13.5);
            state.setSelectedLocation(firstLoc);
          }
        });

        // Context menu (right-click) -> Batch mark category
        catRow.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          this.showCategoryContextMenu(e, cat);
        });

        body.appendChild(catRow);
      }

      // Group Batch Actions (Tout afficher / Tout masquer pour ce groupe)
      const groupActions = document.createElement('div');
      groupActions.className = 'group-batch-actions';
      groupActions.innerHTML = `
        <button type="button" class="btn-subtle group-btn-show">Tout afficher</button>
        <span class="sep">•</span>
        <button type="button" class="btn-subtle group-btn-hide">Tout masquer</button>
      `;

      groupActions.querySelector('.group-btn-show').addEventListener('click', (e) => {
        e.stopPropagation();
        for (const cat of group.categories) {
          state.setCategoryActive(cat.id, true);
        }
        groupEl.querySelectorAll('.category-item').forEach(item => {
          item.classList.remove('disabled');
          const cb = item.querySelector('.cat-checkbox');
          if (cb) cb.checked = true;
        });
      });

      groupActions.querySelector('.group-btn-hide').addEventListener('click', (e) => {
        e.stopPropagation();
        for (const cat of group.categories) {
          state.setCategoryActive(cat.id, false);
        }
        groupEl.querySelectorAll('.category-item').forEach(item => {
          item.classList.add('disabled');
          const cb = item.querySelector('.cat-checkbox');
          if (cb) cb.checked = false;
        });
      });

      groupEl.appendChild(header);
      groupEl.appendChild(groupActions);
      groupEl.appendChild(body);
      container.appendChild(groupEl);
    }
  }

  showCategoryContextMenu(e, cat) {
    const existing = document.getElementById('cat-context-menu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.id = 'cat-context-menu';
    menu.className = 'dropdown-menu';
    menu.style.display = 'flex';
    menu.style.position = 'fixed';
    menu.style.left = `${Math.min(e.clientX, window.innerWidth - 230)}px`;
    menu.style.top = `${Math.min(e.clientY, window.innerHeight - 120)}px`;

    menu.innerHTML = `
      <div style="padding: 4px 10px; font-size: 11px; color: var(--text-muted); font-family: var(--font-hud);">
        ${cat.title}
      </div>
      <button class="dropdown-item" id="ctx-mark-all">✓ Tout marquer comme récupéré</button>
      <button class="dropdown-item" id="ctx-unmark-all">↺ Tout décocher</button>
    `;

    document.body.appendChild(menu);

    menu.querySelector('#ctx-mark-all').addEventListener('click', () => {
      state.markCategoryFound(cat.id, true);
      this.showToast(`Catégorie "${cat.title}" marquée comme récupérée !`, 'success');
      menu.remove();
    });

    menu.querySelector('#ctx-unmark-all').addEventListener('click', () => {
      state.markCategoryFound(cat.id, false);
      this.showToast(`Catégorie "${cat.title}" réinitialisée !`);
      menu.remove();
    });

    const closeListener = (evt) => {
      if (!menu.contains(evt.target)) {
        menu.remove();
        document.removeEventListener('click', closeListener);
      }
    };
    setTimeout(() => document.addEventListener('click', closeListener), 10);
  }

  // =========================================================================
  // Header & Controls
  // =========================================================================
  setupHeaderControls() {
    // Sidebar toggle (Desktop & Mobile)
    const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
    const sidebar = document.getElementById('sidebar');
    if (toggleSidebarBtn && sidebar) {
      toggleSidebarBtn.addEventListener('click', () => {
        const isMobile = window.innerWidth <= 768;
        if (isMobile) {
          sidebar.classList.toggle('mobile-open');
        } else {
          const isCollapsed = sidebar.classList.toggle('collapsed');
          toggleSidebarBtn.classList.toggle('active', isCollapsed);
          setTimeout(() => {
            this.mapInstance?.map?.resize();
          }, 300);
        }
      });

      sidebar.addEventListener('transitionend', () => {
        this.mapInstance?.map?.resize();
      });
    }

    // Hide collected toggle
    const hideCollectedToggle = document.getElementById('toggle-hide-collected');
    if (hideCollectedToggle) {
      hideCollectedToggle.checked = state.hideCollected;
      hideCollectedToggle.addEventListener('change', () => {
        state.setHideCollected(hideCollectedToggle.checked);
      });
    }

    // Backup dropdown menu
    const backupBtn = document.getElementById('btn-backup-menu');
    const dropdownWrap = backupBtn?.closest('.dropdown-wrap');
    if (backupBtn && dropdownWrap) {
      backupBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownWrap.classList.toggle('open');
      });
      document.addEventListener('click', () => dropdownWrap.classList.remove('open'));
    }

    // Export Data Button
    document.getElementById('btn-export-data')?.addEventListener('click', () => {
      this.exportSaveFile();
    });

    // Import Data Trigger
    const fileInput = document.getElementById('file-import-input');
    document.getElementById('btn-import-trigger')?.addEventListener('click', () => {
      fileInput?.click();
    });

    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const res = state.importData(event.target.result);
        if (res.success) {
          this.showToast(`Sauvegarde importée avec succès (${res.count} objets récupérés) !`, 'success');
        } else {
          this.showToast(`Erreur d'importation : ${res.error}`, 'error');
        }
      };
      reader.readAsText(file);
      fileInput.value = '';
    });

    // Reset Data Button (opens modal)
    document.getElementById('btn-reset-data')?.addEventListener('click', () => {
      document.getElementById('modal-confirm-reset').style.display = 'flex';
    });

    document.getElementById('confirm-reset-btn')?.addEventListener('click', () => {
      state.resetProgress();
      document.getElementById('modal-confirm-reset').style.display = 'none';
      this.showToast('Progression réinitialisée.', 'success');
    });

    // Map HUD Controls: Zoom in/out, Recenter & Fullscreen
    document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
      this.mapInstance.map?.zoomIn();
    });

    document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
      this.mapInstance.map?.zoomOut();
    });

    document.getElementById('btn-recenter')?.addEventListener('click', () => {
      this.mapInstance.resetView();
    });

    document.getElementById('btn-fullscreen')?.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });
  }

  exportSaveFile() {
    const jsonStr = state.exportData();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = url;
    a.download = `satisfactory_map_backup_${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('Sauvegarde exportée dans vos téléchargements !', 'success');
  }

  // =========================================================================
  // Search & Filters
  // =========================================================================
  setupSearchAndFilters() {
    const searchInput = document.getElementById('filter-search-input');
    const clearBtn = document.getElementById('clear-search-btn');

    searchInput?.addEventListener('input', () => {
      const val = searchInput.value;
      clearBtn.style.display = val ? 'block' : 'none';
      state.setSearchQuery(val);
    });

    clearBtn?.addEventListener('click', () => {
      searchInput.value = '';
      clearBtn.style.display = 'none';
      state.setSearchQuery('');
    });

    // Quick Chips (All, Collectibles, Slugs, Pure, etc.)
    const chips = document.querySelectorAll('.chip-btn');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state.setGroupFilter(chip.dataset.group);
      });
    });

    // Batch Actions: Show All / Hide All / Collapse All
    document.getElementById('btn-show-all-cats')?.addEventListener('click', () => {
      state.setAllCategories(true);
      document.querySelectorAll('.cat-checkbox').forEach(cb => cb.checked = true);
      document.querySelectorAll('.category-item').forEach(el => el.classList.remove('disabled'));
    });

    document.getElementById('btn-hide-all-cats')?.addEventListener('click', () => {
      state.setAllCategories(false);
      document.querySelectorAll('.cat-checkbox').forEach(cb => cb.checked = false);
      document.querySelectorAll('.category-item').forEach(el => el.classList.add('disabled'));
    });

    document.getElementById('btn-collapse-all')?.addEventListener('click', () => {
      const sections = document.querySelectorAll('.group-section');
      const btn = document.getElementById('btn-collapse-all');
      const isAnyOpen = Array.from(sections).some(s => !s.classList.contains('collapsed'));
      sections.forEach(s => s.classList.toggle('collapsed', isAnyOpen));
      if (btn) btn.textContent = isAnyOpen ? 'Déplier' : 'Replier';
    });
  }

  // =========================================================================
  // Detail Flyout (Marker Inspector)
  // =========================================================================
  setupDetailFlyout() {
    const flyout = document.getElementById('detail-flyout');
    const content = document.getElementById('flyout-content');
    const closeBtn = document.getElementById('flyout-close-btn');

    closeBtn?.addEventListener('click', () => {
      flyout.classList.remove('open');
      state.setSelectedLocation(null);
    });

    state.on('location-selected', (loc) => {
      if (!loc) {
        flyout.classList.remove('open');
        return;
      }
      this.renderDetailContent(loc, content);
      flyout.classList.add('open');
    });

    // Update found button when found status toggles
    state.on('found-toggled', ({ id, isFound }) => {
      if (state.selectedLocation && state.selectedLocation.id === id) {
        const toggleBtn = document.getElementById('flyout-toggle-found-btn');
        if (toggleBtn) {
          toggleBtn.className = `btn-toggle-found ${isFound ? 'is-found' : 'not-found'}`;
          toggleBtn.innerHTML = isFound
            ? `<span>✓ RÉCUPÉRÉ (Cliquer pour annuler)</span>`
            : `<span>MARQUER COMME RÉCUPÉRÉ</span>`;
        }
      }
    });

    // Close detail-flyout when clicking anywhere outside
    document.addEventListener('pointerdown', (e) => {
      if (!flyout.classList.contains('open')) return;

      // Don't close if click happened within the flyout itself
      if (flyout.contains(e.target)) return;

      // Don't close if click was on a modal or dropdown
      if (e.target.closest('.modal-backdrop') || e.target.closest('.dropdown-wrap')) return;

      // Don't close if click was on a category row (which selects that location)
      if (e.target.closest('.category-item')) return;

      // Don't close if click was on map canvas - MapLibre's click listener determines marker hit vs background
      if (e.target.closest('#map')) return;

      // Close the flyout
      flyout.classList.remove('open');
      state.setSelectedLocation(null);
    });
  }

  getResourceYieldData(loc) {
    const catTitle = loc.categoryTitle || '';
    const groupTitle = loc.groupTitle || '';
    let purity = null;

    if (groupTitle.includes('Pure') || catTitle.endsWith('(P)')) purity = 'pure';
    else if (groupTitle.includes('Normal') || catTitle.endsWith('(N)')) purity = 'normal';
    else if (groupTitle.includes('Impure') || catTitle.endsWith('(I)')) purity = 'impure';

    if (!purity) return null;

    if (catTitle.startsWith('Geyser')) {
      const powerMap = {
        impure: { min: 50, max: 150, avg: 100 },
        normal: { min: 100, max: 300, avg: 200 },
        pure: { min: 200, max: 600, avg: 400 }
      };
      return {
        type: 'geyser',
        purity,
        power: powerMap[purity]
      };
    }

    if (catTitle.startsWith('Crude Oil')) {
      const baseMap = { impure: 60, normal: 120, pure: 240 };
      const baseRate = baseMap[purity];
      return {
        type: 'fluid',
        fluidType: 'oil',
        extractorName: 'Extracteur de pétrole',
        unit: 'm³/min',
        purity,
        baseRate,
        overclockRate: baseRate * 2.5
      };
    }

    if (catTitle.startsWith('Water')) {
      const baseMap = { impure: 30, normal: 60, pure: 120 };
      const baseRate = baseMap[purity];
      return {
        type: 'fluid',
        fluidType: 'water',
        extractorName: 'Extracteur de puits (Pressuriseur)',
        unit: 'm³/min',
        purity,
        baseRate,
        overclockRate: baseRate * 2.5
      };
    }

    if (catTitle.startsWith('Nitrogen')) {
      const baseMap = { impure: 30, normal: 60, pure: 120 };
      const baseRate = baseMap[purity];
      return {
        type: 'fluid',
        fluidType: 'nitrogen',
        extractorName: 'Extracteur de puits (Pressuriseur)',
        unit: 'm³/min',
        purity,
        baseRate,
        overclockRate: baseRate * 2.5
      };
    }

    // Solid Minerals (Iron, Copper, Coal, Limestone, Caterium, Quartz, Sulfur, Bauxite, SAM, Uranium)
    const baseRates = {
      impure: { mk1: 30, mk2: 60, mk3: 120 },
      normal: { mk1: 60, mk2: 120, mk3: 240 },
      pure: { mk1: 120, mk2: 240, mk3: 480 }
    }[purity];

    return {
      type: 'solid',
      purity,
      tiers: [
        { name: 'Mk.1', label: 'Foreuse Mk.1', rate100: baseRates.mk1, rate250: baseRates.mk1 * 2.5 },
        { name: 'Mk.2', label: 'Foreuse Mk.2', rate100: baseRates.mk2, rate250: baseRates.mk2 * 2.5 },
        { name: 'Mk.3', label: 'Foreuse Mk.3', rate100: baseRates.mk3, rate250: baseRates.mk3 * 2.5 }
      ]
    };
  }

  getRecommendedBelt(rate) {
    if (rate <= 60) return { name: 'Conv. Mk.1', full: 'Convoyeur Mk.1 (60/min)' };
    if (rate <= 120) return { name: 'Conv. Mk.2', full: 'Convoyeur Mk.2 (120/min)' };
    if (rate <= 270) return { name: 'Conv. Mk.3', full: 'Convoyeur Mk.3 (270/min)' };
    if (rate <= 480) return { name: 'Conv. Mk.4', full: 'Convoyeur Mk.4 (480/min)' };
    if (rate <= 780) return { name: 'Conv. Mk.5', full: 'Convoyeur Mk.5 (780/min)' };
    return { name: 'Conv. Mk.6', full: 'Convoyeur Mk.6 (1200/min)' };
  }

  getRecommendedPipe(rate) {
    if (rate <= 300) return { name: 'Pipe Mk.1', full: 'Pipeline Mk.1 (300 m³/min)' };
    return { name: 'Pipe Mk.2', full: 'Pipeline Mk.2 (600 m³/min)' };
  }

  renderResourceYieldHtml(yieldData) {
    if (!yieldData) return '';

    const purityLabels = {
      pure: 'PUR',
      normal: 'NORMAL',
      impure: 'IMPUR'
    };
    const purityText = purityLabels[yieldData.purity] || yieldData.purity.toUpperCase();

    if (yieldData.type === 'solid') {
      return `
        <div class="resource-yield-widget" id="resource-yield-widget" data-overclock="false">
          <div class="yield-widget-header">
            <div class="yield-widget-title">
              <span class="yield-icon">⛏️</span>
              <span class="yield-label">Rendement d'extraction</span>
              <span class="yield-purity-pill purity-${yieldData.purity}">${purityText}</span>
            </div>
            <button type="button" class="btn-overclock-toggle" id="btn-overclock-toggle" title="Basculer entre cadence 100% et surcadençage 250%">
              <span class="oc-badge">100%</span>
              <span class="oc-label">Standard</span>
            </button>
          </div>

          <div class="yield-grid">
            ${yieldData.tiers.map(t => {
              const belt = this.getRecommendedBelt(t.rate100);
              return `
                <div class="yield-card" data-mk="${t.name}">
                  <div class="yield-card-header">
                    <span class="yield-mk-badge">${t.name}</span>
                    <span class="yield-mk-title">${t.label}</span>
                  </div>
                  <div class="yield-rate-wrap">
                    <span class="yield-rate-value" data-rate-100="${t.rate100}" data-rate-250="${t.rate250}">${t.rate100}</span>
                    <span class="yield-rate-unit">/min</span>
                  </div>
                  <div class="yield-belt-recommendation" data-rate-100="${t.rate100}" data-rate-250="${t.rate250}" title="${belt.full}">
                    <span class="yield-belt-icon">➔</span>
                    <span class="yield-belt-text">${belt.name}</span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    if (yieldData.type === 'fluid') {
      const icon = yieldData.fluidType === 'oil' ? '🛢️' : (yieldData.fluidType === 'water' ? '💧' : '💨');
      const pipe = this.getRecommendedPipe(yieldData.baseRate);
      return `
        <div class="resource-yield-widget" id="resource-yield-widget" data-overclock="false">
          <div class="yield-widget-header">
            <div class="yield-widget-title">
              <span class="yield-icon">${icon}</span>
              <span class="yield-label">Débit d'extraction</span>
              <span class="yield-purity-pill purity-${yieldData.purity}">${purityText}</span>
            </div>
            <button type="button" class="btn-overclock-toggle" id="btn-overclock-toggle" title="Basculer entre cadence 100% et surcadençage 250%">
              <span class="oc-badge">100%</span>
              <span class="oc-label">Standard</span>
            </button>
          </div>

          <div class="yield-fluid-box">
            <div class="yield-fluid-main">
              <div class="yield-fluid-extractor">${yieldData.extractorName}</div>
              <div class="yield-rate-wrap yield-fluid-rate">
                <span class="yield-rate-value" data-rate-100="${yieldData.baseRate}" data-rate-250="${yieldData.overclockRate}">${yieldData.baseRate}</span>
                <span class="yield-rate-unit">${yieldData.unit}</span>
              </div>
            </div>
            <div class="yield-belt-recommendation yield-pipe-rec" data-rate-100="${yieldData.baseRate}" data-rate-250="${yieldData.overclockRate}" title="${pipe.full}">
              <span class="yield-belt-icon">➔</span>
              <span class="yield-belt-text">${pipe.name}</span>
            </div>
          </div>
        </div>
      `;
    }

    if (yieldData.type === 'geyser') {
      return `
        <div class="resource-yield-widget geyser-widget">
          <div class="yield-widget-header">
            <div class="yield-widget-title">
              <span class="yield-icon">🌋</span>
              <span class="yield-label">Générateur Géothermique</span>
              <span class="yield-purity-pill purity-${yieldData.purity}">${purityText}</span>
            </div>
            <span class="geyser-badge-clean">ÉNERGIE PROPRE</span>
          </div>

          <div class="yield-geyser-box">
            <div class="yield-geyser-avg">
              <span class="geyser-avg-val">${yieldData.power.avg}</span>
              <span class="geyser-avg-unit">MW (Moyenne continue)</span>
            </div>
            <div class="yield-geyser-range">
              <span>Oscillation électrique : <strong>${yieldData.power.min} MW</strong> ~ <strong>${yieldData.power.max} MW</strong></span>
            </div>
          </div>
        </div>
      `;
    }

    return '';
  }

  setupOverclockToggle() {
    const btn = document.getElementById('btn-overclock-toggle');
    const widget = document.getElementById('resource-yield-widget');
    if (!btn || !widget) return;

    btn.addEventListener('click', () => {
      const isOC = widget.dataset.overclock === 'true';
      const newOC = !isOC;
      widget.dataset.overclock = String(newOC);
      widget.classList.toggle('overclocked', newOC);

      // Update button label and badge
      const badge = btn.querySelector('.oc-badge');
      const label = btn.querySelector('.oc-label');
      if (badge && label) {
        badge.textContent = newOC ? '250%' : '100%';
        label.textContent = newOC ? '3 Éclats ⚡' : 'Standard';
      }

      // Update rate values
      widget.querySelectorAll('.yield-rate-value').forEach(el => {
        const val = newOC ? el.dataset.rate250 : el.dataset.rate100;
        if (val) {
          el.textContent = val;
          el.style.transform = 'scale(1.18)';
          setTimeout(() => { el.style.transform = ''; }, 160);
        }
      });

      // Update conveyor/pipeline recommendations
      widget.querySelectorAll('.yield-belt-recommendation').forEach(el => {
        const rate = Number(newOC ? el.dataset.rate250 : el.dataset.rate100);
        const textEl = el.querySelector('.yield-belt-text');
        if (textEl) {
          if (el.classList.contains('yield-pipe-rec')) {
            const pipe = this.getRecommendedPipe(rate);
            textEl.textContent = pipe.name;
            el.title = pipe.full;
          } else {
            const belt = this.getRecommendedBelt(rate);
            textEl.textContent = belt.name;
            el.title = belt.full;
          }
        }
      });
    });
  }

  renderDetailContent(loc, container) {
    const isFound = state.isFound(loc.id);
    const cat = this.mapData.categoriesById[loc.categoryId] || {};
    const groupColor = loc.groupColor || cat.groupColor || '#BA8E23';

    const yieldData = this.getResourceYieldData(loc);
    const yieldHtml = this.renderResourceYieldHtml(yieldData);

    let mediaHtml = '';
    if (loc.media && loc.media.length > 0) {
      const med = loc.media[0];
      mediaHtml = `
        <div class="detail-media-wrap" id="detail-media-preview" title="Cliquer pour agrandir la capture">
          <img class="detail-media-img" src="${med.url}" alt="${med.title || loc.title}" loading="lazy">
          <div class="detail-media-overlay">📷 Cliquer pour voir en grand</div>
        </div>
      `;
    }

    container.innerHTML = `
      <div class="detail-header-badge" style="border-color: ${groupColor}40">
        <span class="detail-cat-dot" style="background-color: ${groupColor}"></span>
        <span>${loc.groupTitle || 'Général'} • ${loc.categoryTitle || cat.title || 'Marqueur'}</span>
      </div>

      <h2 class="detail-title">${loc.title}</h2>

      ${yieldHtml}

      ${loc.description ? `<div class="detail-description">${this.formatDescription(loc.description)}</div>` : ''}

      ${mediaHtml}

      <div class="detail-action-box">
        <button id="flyout-toggle-found-btn" class="btn-toggle-found ${isFound ? 'is-found' : 'not-found'}">
          ${isFound ? '<span>✓ RÉCUPÉRÉ (Cliquer pour annuler)</span>' : '<span>MARQUER COMME RÉCUPÉRÉ</span>'}
        </button>
        <span class="shortcut-hint">Raccourci clavier : Appuyez sur <kbd>F</kbd> ou <kbd>Espace</kbd></span>
      </div>

      <div class="detail-coords-row">
        <span>Coordonnées : LAT ${loc.lat.toFixed(4)}, LNG ${loc.lng.toFixed(4)}</span>
        <button id="detail-center-btn" class="btn-subtle" style="color: var(--ficsit-cyan)">Recentrer</button>
      </div>
    `;

    // Overclock toggle handler
    this.setupOverclockToggle();

    // Toggle button handler
    document.getElementById('flyout-toggle-found-btn')?.addEventListener('click', () => {
      const nowFound = state.toggleFound(loc.id);
      this.showToast(
        nowFound ? `"${loc.title}" marqué comme récupéré !` : `"${loc.title}" démarqué.`,
        nowFound ? 'success' : undefined
      );
    });

    // Center button handler
    document.getElementById('detail-center-btn')?.addEventListener('click', () => {
      this.mapInstance.flyToLocation(loc.lat, loc.lng, 14);
    });

    // Lightbox image preview handler
    if (loc.media && loc.media.length > 0) {
      document.getElementById('detail-media-preview')?.addEventListener('click', () => {
        this.openLightbox(loc.media[0].url, loc.title);
      });
    }
  }

  formatDescription(text) {
    if (!text) return '';
    // Highlight MW, parts, requirements
    return text
      .replace(/(\d+\s*MW)/gi, '<strong style="color: var(--ficsit-orange);">$1</strong>')
      .replace(/(\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s*x\s*\d+\b)/g, '<strong style="color: var(--ficsit-cyan);">$1</strong>');
  }

  openLightbox(imgUrl, caption) {
    const modal = document.getElementById('modal-lightbox');
    const img = document.getElementById('lightbox-img');
    const cap = document.getElementById('lightbox-caption');
    if (!modal || !img) return;

    img.src = imgUrl;
    if (cap) cap.textContent = caption || '';
    modal.style.display = 'flex';
  }

  // =========================================================================
  // Modals & Forms
  // =========================================================================
  setupModals() {
    // Universal close buttons
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.closest('.modal-backdrop').style.display = 'none';
      });
    });

    // Lightbox close
    document.getElementById('lightbox-close-btn')?.addEventListener('click', () => {
      document.getElementById('modal-lightbox').style.display = 'none';
    });

    // Backdrop click close
    document.querySelectorAll('.modal-backdrop').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
      });
    });

    // Custom Pin Modal
    document.getElementById('btn-custom-pin')?.addEventListener('click', () => {
      document.getElementById('modal-custom-pin').style.display = 'flex';
    });

    const customPinForm = document.getElementById('custom-pin-form');
    customPinForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const center = this.mapInstance.map.getCenter();
      const title = document.getElementById('pin-title').value;
      const type = document.getElementById('pin-type').value;
      const notes = document.getElementById('pin-notes').value;

      state.addCustomPin({
        title,
        type,
        notes,
        lat: center.lat,
        lng: center.lng
      });

      customPinForm.reset();
      document.getElementById('modal-custom-pin').style.display = 'none';
      this.showToast(`Balise "${title}" placée au centre de l'écran !`, 'success');
    });
  }

  // =========================================================================
  // Keyboard Shortcuts
  // =========================================================================
  setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Ignore if typing inside an input/textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
        if (e.key === 'Escape') e.target.blur();
        return;
      }

      // 'F' or 'Space' -> Toggle selected location found state
      if (e.key === 'f' || e.key === 'F' || e.code === 'Space') {
        if (state.selectedLocation && !state.selectedLocation.isCustom) {
          e.preventDefault();
          const nowFound = state.toggleFound(state.selectedLocation.id);
          this.showToast(
            nowFound ? `"${state.selectedLocation.title}" récupéré !` : `"${state.selectedLocation.title}" démarqué.`,
            nowFound ? 'success' : undefined
          );
        }
      }

      // '/' -> Focus Search
      if (e.key === '/') {
        e.preventDefault();
        document.getElementById('filter-search-input')?.focus();
      }

      // '[' or 'Ctrl+B' -> Toggle sidebar
      if (e.key === '[' || (e.ctrlKey && (e.key === 'b' || e.key === 'B'))) {
        e.preventDefault();
        document.getElementById('toggle-sidebar-btn')?.click();
      }

      // 'Escape' -> Close flyouts / modals
      if (e.key === 'Escape') {
        document.getElementById('detail-flyout')?.classList.remove('open');
        document.querySelectorAll('.modal-backdrop').forEach(m => m.style.display = 'none');
        document.getElementById('cat-context-menu')?.remove();
      }
    });
  }

  // =========================================================================
  // State Listeners & Progress Updates
  // =========================================================================
  setupStateListeners() {
    state.on('progress-updated', (stats) => {
      this.updateProgressUI(stats);
    });
  }

  updateProgressUI(stats) {
    const totalFoundEl = document.getElementById('total-found-count');
    const totalCountEl = document.getElementById('total-locations-count');
    const totalPercentEl = document.getElementById('total-found-percent');
    const globalBar = document.getElementById('global-progress-bar');

    if (totalFoundEl) totalFoundEl.textContent = stats.totalFound;
    if (totalCountEl) totalCountEl.textContent = stats.totalCount;
    if (totalPercentEl) totalPercentEl.textContent = `${stats.percent}%`;
    if (globalBar) globalBar.style.width = `${stats.percent}%`;

    // Category mini counters & bars
    for (const [catId, countInfo] of Object.entries(stats.categoryCounts)) {
      const pill = document.getElementById(`cat-progress-${catId}`);
      if (pill) {
        pill.innerHTML = `<span class="done">${countInfo.found}</span> / ${countInfo.total}`;
      }
      const bar = document.getElementById(`cat-bar-${catId}`);
      if (bar) {
        const pct = countInfo.total > 0 ? (countInfo.found / countInfo.total) * 100 : 0;
        bar.style.width = `${pct}%`;
      }
    }

    // Group counters
    for (const group of this.mapData.groups) {
      const badge = document.getElementById(`group-count-${group.id}`);
      if (badge) {
        let grpFound = 0;
        let grpTotal = 0;
        for (const cat of group.categories) {
          const cInfo = stats.categoryCounts[cat.id];
          if (cInfo) {
            grpFound += cInfo.found;
            grpTotal += cInfo.total;
          } else {
            grpTotal += (cat.count || cat.totalCount || 0);
          }
        }
        badge.innerHTML = `<strong class="group-found-sum">${grpFound}</strong> / ${grpTotal}`;
      }
    }
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span>${type === 'success' ? '✓' : '⚡'}</span>
      <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }
}

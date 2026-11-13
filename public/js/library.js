/**
 * MediaFetch Web — Library Module
 */

(function () {
  'use strict';

  let libraryItems = [];
  let currentFilter = 'all'; // all, mp4, mp3
  let searchQuery = '';

  const librarySearchInput = document.getElementById('librarySearchInput');
  const libraryItemsGrid = document.getElementById('libraryItemsGrid');
  const emptyLibraryNotice = document.getElementById('emptyLibraryNotice');
  const storageSummary = document.getElementById('storageSummary');
  const libraryCountBadge = document.getElementById('libraryCountBadge');
  const mobileLibraryBadge = document.getElementById('mobileLibraryBadge');

  // Load Library from Server
  async function loadLibrary() {
    try {
      const res = await fetch('/api/library');
      if (!res.ok) return;
      libraryItems = await res.json();

      updateStorageSummary();
      renderItems();
    } catch (err) {
      console.error('Error loading library:', err);
    }
  }

  // Update Storage & Badges Summary
  function updateStorageSummary() {
    const totalFiles = libraryItems.length;
    let totalBytes = 0;

    for (const item of libraryItems) {
      totalBytes += (item.fileSize || 0);
    }

    if (storageSummary) {
      storageSummary.textContent = `${totalFiles} archivo${totalFiles === 1 ? '' : 's'} · ${window.appModule.formatBytes(totalBytes)}`;
    }
    if (libraryCountBadge) {
      libraryCountBadge.textContent = totalFiles;
    }
    if (mobileLibraryBadge) {
      mobileLibraryBadge.textContent = totalFiles;
    }
  }

  // Render Filtered Items
  function renderItems() {
    const filtered = libraryItems.filter(item => {
      // Format filter
      if (currentFilter === 'mp4' && item.format !== 'mp4') return false;
      if (currentFilter === 'mp3' && item.format !== 'mp3') return false;

      // Search query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = (item.title || '').toLowerCase().includes(q);
        const matchesFile = (item.fileName || '').toLowerCase().includes(q);
        const matchesPlatform = (item.platform || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesFile && !matchesPlatform) return false;
      }
      return true;
    });

    if (libraryItems.length === 0) {
      libraryItemsGrid.innerHTML = '';
      emptyLibraryNotice.style.display = 'block';
      return;
    }

    emptyLibraryNotice.style.display = 'none';

    if (filtered.length === 0) {
      libraryItemsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 32px; color: var(--text-muted);">
          No se encontraron archivos con ese término de búsqueda o filtro.
        </div>
      `;
      return;
    }

    libraryItemsGrid.innerHTML = filtered.map(item => {
      const isVideo = item.format === 'mp4';
      const formatLabel = isVideo ? 'MP4' : 'MP3';
      const sizeStr = window.appModule.formatBytes(item.fileSize);
      const dateStr = window.appModule.formatDate(item.createdAt);
      const directDownloadUrl = `${item.downloadUrl || `/api/files/${encodeURIComponent(item.fileName)}`}?download=1`;

      return `
        <div class="library-card" id="lib-${item.id}">
          <div class="lib-card-top">
            <div class="lib-media-icon ${item.format}">
              ${isVideo ? `
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="23 7 16 12 23 17 23 7"></polygon>
                  <rect width="15" height="14" x="1" y="5" rx="2" ry="2"></rect>
                </svg>
              ` : `
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M9 18V5l12-2v13"></path>
                  <circle cx="6" cy="18" r="3"></circle>
                  <circle cx="18" cy="16" r="3"></circle>
                </svg>
              `}
            </div>

            <div class="lib-card-details">
              <h4 class="lib-item-title" title="${window.appModule.escapeHtml(item.title)}">${window.appModule.escapeHtml(item.title)}</h4>
              <div class="lib-item-meta">
                <span class="task-format-pill ${item.format}">${formatLabel}</span>
                <span>${sizeStr}</span>
                <span>·</span>
                <span>${window.appModule.escapeHtml(item.platform || 'Web')}</span>
                <span>·</span>
                <span>${dateStr}</span>
              </div>
            </div>
          </div>

          <div class="lib-card-actions">
            <button type="button" class="btn-lib-action btn-lib-play" onclick='window.playerModule.open(${JSON.stringify(item).replace(/'/g, "&#39;")})'>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              Reproducir
            </button>

            <a class="btn-lib-action" href="${directDownloadUrl}" download="${window.appModule.escapeHtml(item.fileName)}" target="_blank" rel="noopener noreferrer" title="Guardar en descargas de tu equipo">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              Descargar
            </a>

            <button type="button" class="btn-lib-action" onclick="window.libraryModule.copyLink('${directDownloadUrl}')" title="Copiar enlace directo">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>
            </button>

            <button type="button" class="btn-lib-action btn-lib-delete" onclick="window.libraryModule.deleteItem('${item.id}')" title="Eliminar archivo">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // Delete Item
  async function deleteItem(id) {
    if (!confirm('¿Seguro que deseas eliminar este archivo de la biblioteca y del disco?')) {
      return;
    }

    try {
      const res = await fetch(`/api/library/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        window.appModule.showToast('error', 'No se pudo eliminar el archivo.');
        return;
      }
      window.appModule.showToast('info', 'Archivo eliminado.');
      loadLibrary();
    } catch (err) {
      window.appModule.showToast('error', 'Error al eliminar el archivo.');
    }
  }

  // Copy Direct Link
  function copyLink(relUrl) {
    const fullUrl = `${window.location.origin}${relUrl}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(fullUrl).then(() => {
        window.appModule.showToast('success', 'Enlace copiado al portapapeles.');
      });
    } else {
      prompt('Copia este enlace:', fullUrl);
    }
  }

  // Initialize
  function init() {
    librarySearchInput.addEventListener('input', e => {
      searchQuery = e.target.value.trim();
      renderItems();
    });

    document.querySelectorAll('.lib-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.lib-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        currentFilter = chip.dataset.filter;
        renderItems();
      });
    });

    loadLibrary();
  }

  document.addEventListener('DOMContentLoaded', init);

  // Export
  window.libraryModule = {
    loadLibrary,
    deleteItem,
    copyLink,
  };
})();


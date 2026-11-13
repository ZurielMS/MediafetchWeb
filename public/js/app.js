/**
 * MediaFetch Web — Main Application Coordinator
 */

(function () {
  'use strict';

  const state = {
    currentTab: 'downloader',
    engineStatus: null,
    theme: 'dark',
    effectiveTheme: 'dark',
  };

  // Client-Side Error Telemetry to Server
  function reportErrorToServer(type, err, extra = {}) {
    try {
      fetch('/api/debug/client-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          message: err ? (err.message || String(err)) : 'Unknown Error',
          stack: err ? err.stack : null,
          url: window.location.href,
          ...extra
        })
      }).catch(() => {});
    } catch (e) {}
  }

  window.addEventListener('error', function (event) {
    reportErrorToServer('window.onerror', event.error || event.message, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
  });

  window.addEventListener('unhandledrejection', function (event) {
    reportErrorToServer('unhandledrejection', event.reason);
  });

  // Theme Management
  function getSystemTheme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function applyTheme(themeMode) {
    const effectiveTheme = themeMode === 'system' ? getSystemTheme() : themeMode;
    document.documentElement.setAttribute('data-theme', effectiveTheme);
    state.theme = themeMode;
    state.effectiveTheme = effectiveTheme;

    // Update meta theme-color for browser chrome
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', effectiveTheme === 'light' ? '#F4F6F9' : '#0B0F19');
    }

    // Update theme toggle button tooltip and accessible label
    const toggleBtn = document.getElementById('themeToggleBtn');
    if (toggleBtn) {
      const nextThemeLabel = effectiveTheme === 'light' ? 'oscuro' : 'claro';
      toggleBtn.setAttribute('title', `Cambiar a modo ${nextThemeLabel}`);
      toggleBtn.setAttribute('aria-label', `Cambiar a modo ${nextThemeLabel}`);
    }

    // Synchronize settings select dropdown if available
    const themeSelect = document.getElementById('themeModeSelect');
    if (themeSelect && themeSelect.value !== themeMode) {
      themeSelect.value = themeMode;
    }
  }

  function setTheme(themeMode, showFeedback = false) {
    localStorage.setItem('mf_theme', themeMode);
    applyTheme(themeMode);

    if (showFeedback) {
      const label = themeMode === 'system' 
        ? 'Automático (según el sistema)' 
        : themeMode === 'light' ? 'Modo Claro' : 'Modo Oscuro';
      showToast('info', `Tema visual: ${label}`);
    }
  }

  function toggleTheme() {
    const current = state.effectiveTheme || (document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
    const next = current === 'light' ? 'dark' : 'light';
    setTheme(next);
    showToast('info', `Modo ${next === 'light' ? 'claro' : 'oscuro'} activado`);
  }

  // Toast Notification System
  function showToast(type, text) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconSvg = '';
    if (type === 'success') {
      iconSvg = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
    } else if (type === 'error') {
      iconSvg = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
    } else {
      iconSvg = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
    }

    toast.innerHTML = `${iconSvg}<span>${escapeHtml(text)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, 4000);
  }

  // Switch Tab
  function switchTab(tabId) {
    state.currentTab = tabId;

    // Toggle views
    document.querySelectorAll('.tab-view').forEach(view => {
      view.classList.toggle('active', view.id === `view-${tabId}`);
    });

    // Toggle desktop nav buttons
    document.querySelectorAll('.desktop-nav .nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // Toggle mobile bottom buttons
    document.querySelectorAll('.mobile-bottom-bar .bottom-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // Tab-specific lifecycle hooks
    if (tabId === 'library' && window.libraryModule) {
      window.libraryModule.loadLibrary();
    }
    if (tabId === 'settings' && window.settingsModule) {
      window.settingsModule.refreshStatus();
    }
  }

  // Fetch Engine Status
  async function fetchEngineStatus() {
    try {
      const res = await fetch('/api/status');
      if (!res.ok) return;
      const data = await res.json();
      state.engineStatus = data;

      // Update Header pill
      const engineVerEl = document.getElementById('engineVersionText');
      if (engineVerEl) {
        engineVerEl.textContent = `yt-dlp ${data.ytdlpVersion || ''}`.trim();
      }

      // Update cookies indicator
      const cookieDot = document.getElementById('headerCookieDot');
      if (cookieDot) {
        cookieDot.style.display = data.hasCookies ? 'inline-block' : 'none';
      }

      // Update settings info if available
      const settingsYt = document.getElementById('settingsYtDlpVer');
      if (settingsYt) settingsYt.textContent = data.ytdlpVersion;

      const settingsFfmpeg = document.getElementById('settingsFfmpegPath');
      if (settingsFfmpeg) settingsFfmpeg.textContent = data.ffmpegPath || 'ffmpeg (sistema)';

    } catch (err) {
      console.warn('Could not fetch engine status:', err);
    }
  }

  // Format Helpers
  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let idx = 0;
    let val = bytes;
    while (val >= 1024 && idx < units.length - 1) {
      val /= 1024;
      idx++;
    }
    return `${val >= 10 || idx === 0 ? val.toFixed(1) : val.toFixed(2)} ${units[idx]}`;
  }

  function formatDuration(seconds) {
    if (!seconds || isNaN(seconds) || seconds <= 0) return '--:--';
    const total = Math.floor(seconds);
    const hrs = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    const pad = n => n.toString().padStart(2, '0');
    if (hrs > 0) return `${hrs}:${pad(mins)}:${pad(secs)}`;
    return `${mins}:${pad(secs)}`;
  }

  function formatDate(timestamp) {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    return d.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Initialize
  function init() {
    // 1. Initialize Theme
    const savedTheme = localStorage.getItem('mf_theme') || 'dark';
    applyTheme(savedTheme);

    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', toggleTheme);
    }

    // Listen to system theme changes if set to 'system'
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
        if (state.theme === 'system') {
          applyTheme('system');
        }
      });
    }

    // 2. Navigation events
    document.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        if (tab) switchTab(tab);
      });
    });

    fetchEngineStatus();
    setInterval(fetchEngineStatus, 30000);
  }

  // Universal Cross-Browser File Downloader (Brave, Chrome, Firefox, Edge, Safari)
  function downloadFile(fileUrl, fileName) {
    if (!fileUrl) return;
    const directUrl = `${fileUrl}${fileUrl.includes('?') ? '&' : '?'}download=1`;

    // 1. Try hidden iframe (bypasses popup blockers and async click restrictions in Brave/Chrome)
    try {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.style.position = 'fixed';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      iframe.src = directUrl;
      document.body.appendChild(iframe);

      setTimeout(() => {
        try { iframe.remove(); } catch (_) {}
      }, 45000);
      return;
    } catch (e) {
      console.warn('Iframe download fallback:', e);
    }

    // 2. Fallback: anchor click with target="_blank"
    try {
      const a = document.createElement('a');
      a.href = directUrl;
      if (fileName) a.download = fileName;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => a.remove(), 1000);
    } catch (err) {
      // 3. Ultimate fallback
      window.location.assign(directUrl);
    }
  }

  document.addEventListener('DOMContentLoaded', init);

  // Export to global scope
  window.appModule = {
    showToast,
    switchTab,
    fetchEngineStatus,
    formatBytes,
    formatDuration,
    formatDate,
    escapeHtml,
    setTheme,
    toggleTheme,
    applyTheme,
    downloadFile,
    reportError: reportErrorToServer,
    getState: () => state,
  };
})();


/**
 * MediaFetch Web — Settings Module
 */

(function () {
  'use strict';

  const defaultFormatSelect = document.getElementById('defaultFormatSelect');
  const defaultVideoQualitySelect = document.getElementById('defaultVideoQualitySelect');
  const defaultAudioQualitySelect = document.getElementById('defaultAudioQualitySelect');
  const autoAnalyzeToggle = document.getElementById('autoAnalyzeToggle');
  const themeModeSelect = document.getElementById('themeModeSelect');

  const cookiesTextInput = document.getElementById('cookiesTextInput');
  const saveCookiesBtn = document.getElementById('saveCookiesBtn');
  const clearCookiesBtn = document.getElementById('clearCookiesBtn');
  const cookiesActiveDot = document.getElementById('cookiesActiveDot');
  const cookiesActiveText = document.getElementById('cookiesActiveText');

  const updateEngineBtn = document.getElementById('updateEngineBtn');

  // Load Saved Preferences
  function loadPreferences() {
    const fmt = localStorage.getItem('mf_default_format') || 'mp4';
    const vq = localStorage.getItem('mf_default_video_quality') || 'best';
    const aq = localStorage.getItem('mf_default_audio_quality') || '320';
    const autoAn = localStorage.getItem('mf_auto_analyze') !== 'false';
    const theme = localStorage.getItem('mf_theme') || 'dark';

    defaultFormatSelect.value = fmt;
    defaultVideoQualitySelect.value = vq;
    defaultAudioQualitySelect.value = aq;
    autoAnalyzeToggle.checked = autoAn;
    if (themeModeSelect) themeModeSelect.value = theme;
  }

  // Refresh Cookies Status
  async function refreshCookiesStatus() {
    try {
      const res = await fetch('/api/session/cookies');
      if (!res.ok) return;
      const data = await res.json();

      if (data.hasCookies) {
        cookiesActiveDot.className = 'status-dot online';
        cookiesActiveText.textContent = `Sesión activa (${data.cookieCount} cookies configuradas)`;
        clearCookiesBtn.style.display = 'inline-block';
      } else {
        cookiesActiveDot.className = 'status-dot';
        cookiesActiveText.textContent = 'Sin cookies configuradas';
        clearCookiesBtn.style.display = 'none';
      }
    } catch (e) {
      console.warn('Error fetching cookies status:', e);
    }
  }

  // Save Cookies
  async function saveCookies() {
    const content = cookiesTextInput.value.trim();
    if (!content) {
      window.appModule.showToast('error', 'Pega primero el texto de tus cookies en formato Netscape.');
      return;
    }

    try {
      const res = await fetch('/api/session/cookies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      const data = await res.json();
      if (!res.ok) {
        window.appModule.showToast('error', data.error || 'Error al guardar cookies.');
        return;
      }

      window.appModule.showToast('success', `¡${data.cookieCount} cookies guardadas con éxito!`);
      cookiesTextInput.value = '';
      refreshCookiesStatus();
      window.appModule.fetchEngineStatus();
    } catch (err) {
      window.appModule.showToast('error', 'Error al comunicar con el servidor.');
    }
  }

  // Clear Cookies
  async function clearCookies() {
    if (!confirm('¿Deseas eliminar las cookies de sesión guardadas?')) return;

    try {
      const res = await fetch('/api/session/cookies', { method: 'DELETE' });
      if (!res.ok) {
        window.appModule.showToast('error', 'No se pudieron eliminar las cookies.');
        return;
      }

      window.appModule.showToast('info', 'Cookies eliminadas.');
      refreshCookiesStatus();
      window.appModule.fetchEngineStatus();
    } catch (err) {
      window.appModule.showToast('error', 'Error al eliminar cookies.');
    }
  }

  // Update yt-dlp Engine
  async function updateEngine() {
    updateEngineBtn.disabled = true;
    updateEngineBtn.innerHTML = `
      <div class="spinner" style="width: 14px; height: 14px; border-width: 2px;"></div>
      <span>Actualizando extractor yt-dlp...</span>
    `;

    try {
      const res = await fetch('/api/engine/update', { method: 'POST' });
      const data = await res.json();

      updateEngineBtn.disabled = false;
      updateEngineBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path><path d="M16 21h5v-5"></path></svg>
        <span>Actualizar extractor yt-dlp</span>
      `;

      if (!res.ok) {
        window.appModule.showToast('error', data.error || 'Error al actualizar el motor.');
        return;
      }

      window.appModule.showToast('success', data.message || 'Motor actualizado con éxito.');
      window.appModule.fetchEngineStatus();
    } catch (err) {
      updateEngineBtn.disabled = false;
      updateEngineBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path><path d="M16 21h5v-5"></path></svg>
        <span>Actualizar extractor yt-dlp</span>
      `;
      window.appModule.showToast('error', 'Error al conectar para actualizar.');
    }
  }

  // Initialize
  function init() {
    loadPreferences();

    if (themeModeSelect) {
      themeModeSelect.addEventListener('change', e => {
        window.appModule.setTheme(e.target.value, true);
      });
    }

    defaultFormatSelect.addEventListener('change', e => {
      localStorage.setItem('mf_default_format', e.target.value);
      if (window.downloaderModule) window.downloaderModule.selectFormat(e.target.value);
      window.appModule.showToast('info', `Formato inicial: ${e.target.value.toUpperCase()}`);
    });

    defaultVideoQualitySelect.addEventListener('change', e => {
      localStorage.setItem('mf_default_video_quality', e.target.value);
      if (window.downloaderModule) window.downloaderModule.selectQuality('video', e.target.value);
    });

    defaultAudioQualitySelect.addEventListener('change', e => {
      localStorage.setItem('mf_default_audio_quality', e.target.value);
      if (window.downloaderModule) window.downloaderModule.selectQuality('audio', e.target.value);
    });

    autoAnalyzeToggle.addEventListener('change', e => {
      localStorage.setItem('mf_auto_analyze', e.target.checked);
    });

    saveCookiesBtn.addEventListener('click', saveCookies);
    clearCookiesBtn.addEventListener('click', clearCookies);
    updateEngineBtn.addEventListener('click', updateEngine);

    refreshCookiesStatus();
  }

  document.addEventListener('DOMContentLoaded', init);

  // Export
  window.settingsModule = {
    refreshStatus: () => {
      refreshCookiesStatus();
      loadPreferences();
    },
  };
})();


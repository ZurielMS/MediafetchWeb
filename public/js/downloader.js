/**
 * MediaFetch Web — Downloader Module
 */

(function () {
  'use strict';

  let currentMediaInfo = null;
  let selectedFormat = 'mp4';
  let selectedVideoQuality = 'best';
  let selectedAudioQuality = '320';
  const activeTasks = new Map();

  // DOM Elements
  const urlInput = document.getElementById('urlInput');
  const clearUrlBtn = document.getElementById('clearUrlBtn');
  const pasteBtn = document.getElementById('pasteBtn');
  const analyzeBtn = document.getElementById('analyzeBtn');
  const platformBadge = document.getElementById('platformBadge');
  const platformDot = document.getElementById('platformDot');
  const platformName = document.getElementById('platformName');

  const analyzeLoading = document.getElementById('analyzeLoading');
  const analyzeErrorCard = document.getElementById('analyzeErrorCard');
  const analyzeErrorMsg = document.getElementById('analyzeErrorMsg');

  const mediaPreviewCard = document.getElementById('mediaPreviewCard');
  const previewThumbnail = document.getElementById('previewThumbnail');
  const previewDuration = document.getElementById('previewDuration');
  const previewExtractor = document.getElementById('previewExtractor');
  const previewTitle = document.getElementById('previewTitle');
  const previewAuthor = document.getElementById('previewAuthor');
  const customTitleInput = document.getElementById('customTitleInput');

  const videoQualitySection = document.getElementById('videoQualitySection');
  const audioQualitySection = document.getElementById('audioQualitySection');
  const startDownloadBtn = document.getElementById('startDownloadBtn');
  const startDownloadText = document.getElementById('startDownloadText');

  const activeTasksList = document.getElementById('activeTasksList');
  const emptyQueueMsg = document.getElementById('emptyQueueMsg');
  const activeTasksBadge = document.getElementById('activeTasksBadge');
  const mobileActiveBadge = document.getElementById('mobileActiveBadge');
  const activeTasksCount = document.getElementById('activeTasksCount');

  // Helper: Detect Platform locally
  function detectLocalPlatform(url) {
    const lower = (url || '').toLowerCase();
    if (lower.includes('music.youtube.com')) return { label: 'YouTube Music', color: '#EF4444' };
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) return { label: 'YouTube', color: '#EF4444' };
    if (lower.includes('tiktok.com')) return { label: 'TikTok', color: '#2DD4BF' };
    if (lower.includes('instagram.com')) return { label: 'Instagram', color: '#EC4899' };
    if (lower.includes('facebook.com') || lower.includes('fb.watch')) return { label: 'Facebook', color: '#3B82F6' };
    if (lower.includes('twitter.com') || lower.includes('x.com')) return { label: 'X (Twitter)', color: '#E2E8F0' };
    if (lower.includes('soundcloud.com')) return { label: 'SoundCloud', color: '#F97316' };
    if (lower.includes('vimeo.com')) return { label: 'Vimeo', color: '#38BDF8' };
    if (lower.includes('twitch.tv')) return { label: 'Twitch', color: '#A855F7' };
    if (lower.includes('reddit.com') || lower.includes('redd.it')) return { label: 'Reddit', color: '#FB7185' };
    if (/\.(mp4|mp3|m4a|webm|mkv|m3u8)(\?|$)/i.test(lower)) return { label: 'Enlace directo', color: '#10B981' };
    if (lower.startsWith('http://') || lower.startsWith('https://')) return { label: 'Enlace web', color: '#6366F1' };
    return null;
  }

  // Update Input UI
  function onUrlInputChange() {
    const val = urlInput.value.trim();
    clearUrlBtn.style.display = val ? 'flex' : 'none';

    const p = detectLocalPlatform(val);
    if (p) {
      platformDot.style.backgroundColor = p.color;
      platformName.textContent = p.label;
      platformBadge.style.display = 'flex';
    } else {
      platformBadge.style.display = 'none';
    }
  }

  // Clear Input
  function clearInput() {
    urlInput.value = '';
    onUrlInputChange();
    mediaPreviewCard.style.display = 'none';
    analyzeErrorCard.style.display = 'none';
    currentMediaInfo = null;
  }

  // Paste from Clipboard
  async function pasteClipboard() {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          urlInput.value = text.trim();
          onUrlInputChange();
          window.appModule.showToast('info', 'Enlace pegado del portapapeles');

          // Auto-analyze if enabled in settings
          const autoAnalyze = localStorage.getItem('mf_auto_analyze') !== 'false';
          if (autoAnalyze) {
            analyzeUrl(text.trim());
          }
          return;
        }
      }
      window.appModule.showToast('info', 'Usa Ctrl+V para pegar el enlace.');
    } catch (err) {
      window.appModule.showToast('info', 'Permiso denegado. Pega el enlace manualmente con Ctrl+V.');
    }
  }

  // Analyze URL
  async function analyzeUrl(explicitUrl) {
    const targetUrl = (explicitUrl || urlInput.value).trim();
    if (!targetUrl) {
      window.appModule.showToast('error', 'Por favor ingresa o pega un enlace primero.');
      return;
    }

    analyzeLoading.style.display = 'flex';
    analyzeErrorCard.style.display = 'none';
    mediaPreviewCard.style.display = 'none';
    currentMediaInfo = null;

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
      });

      const data = await res.json();
      analyzeLoading.style.display = 'none';

      if (!res.ok) {
        analyzeErrorMsg.textContent = data.error || 'No se pudo analizar el enlace.';
        analyzeErrorCard.style.display = 'flex';
        return;
      }

      currentMediaInfo = data;
      renderPreview(data);
    } catch (err) {
      analyzeLoading.style.display = 'none';
      analyzeErrorMsg.textContent = 'Error al comunicarse con el servidor local.';
      analyzeErrorCard.style.display = 'flex';
    }
  }

  // Render Media Preview
  function renderPreview(info) {
    previewThumbnail.src = info.thumbnail || '';
    previewDuration.textContent = window.appModule.formatDuration(info.duration);
    previewExtractor.textContent = info.extractor || (info.platform ? info.platform.label : 'WEB');
    previewTitle.textContent = info.title || 'Sin título';
    previewAuthor.textContent = info.uploader || 'Desconocido';
    customTitleInput.value = info.title || '';

    // Adjust video qualities based on source
    if (info.availableQualities && info.availableQualities.length) {
      const qualityChips = videoQualitySection.querySelectorAll('.quality-chip');
      qualityChips.forEach(chip => {
        const qVal = chip.dataset.quality;
        if (qVal === 'best') return;
        const qNum = parseInt(qVal, 10);
        const hasQuality = info.availableQualities.some(h => h >= qNum);
        chip.style.opacity = hasQuality ? '1' : '0.5';
      });
    }

    mediaPreviewCard.style.display = 'block';
    updateStartBtnLabel();
  }

  // Select Format
  function selectFormat(fmt) {
    selectedFormat = fmt;
    document.querySelectorAll('.format-chip').forEach(c => {
      c.classList.toggle('active', c.dataset.format === fmt);
    });

    if (fmt === 'mp4') {
      videoQualitySection.style.display = 'flex';
      audioQualitySection.style.display = 'none';
    } else {
      videoQualitySection.style.display = 'none';
      audioQualitySection.style.display = 'flex';
    }

    updateStartBtnLabel();
  }

  // Select Quality
  function selectQuality(section, val) {
    if (section === 'video') {
      selectedVideoQuality = val;
      videoQualitySection.querySelectorAll('.quality-chip').forEach(c => {
        c.classList.toggle('active', c.dataset.quality === val);
      });
    } else {
      selectedAudioQuality = val;
      audioQualitySection.querySelectorAll('.quality-chip').forEach(c => {
        c.classList.toggle('active', c.dataset.quality === val);
      });
    }
  }

  function updateStartBtnLabel() {
    startDownloadText.textContent = selectedFormat === 'mp4' ? 'Descargar MP4 (Video)' : 'Descargar MP3 (Música)';
  }

  // Start Download
  async function startDownload() {
    const rawUrl = urlInput.value.trim();
    if (!rawUrl) {
      window.appModule.showToast('error', 'Pega una URL antes de descargar.');
      return;
    }

    const taskId = `dl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const quality = selectedFormat === 'mp4' ? selectedVideoQuality : selectedAudioQuality;
    const customTitle = customTitleInput.value.trim() || (currentMediaInfo ? currentMediaInfo.title : '');

    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          url: rawUrl,
          format: selectedFormat,
          quality,
          customTitle,
          referer: currentMediaInfo ? currentMediaInfo.webpageUrl : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        window.appModule.showToast('error', data.error || 'No se pudo iniciar la descarga.');
        return;
      }

      window.appModule.showToast('success', `Descarga de ${selectedFormat.toUpperCase()} iniciada.`);
      
      // Add task to active list
      addTaskToQueue({
        taskId,
        title: customTitle || 'Iniciando descarga...',
        format: selectedFormat,
        quality,
        progress: 0,
        statusLine: 'Preparando descarga...',
        phase: 'preparing',
      });

      // Subscribe to real-time progress
      subscribeTaskProgress(taskId);

    } catch (err) {
      window.appModule.showToast('error', 'Error al conectar con el servidor.');
    }
  }

  // Add Task to UI Queue
  function addTaskToQueue(task) {
    activeTasks.set(task.taskId, task);
    emptyQueueMsg.style.display = 'none';

    let itemEl = document.getElementById(`task-${task.taskId}`);
    if (!itemEl) {
      itemEl = document.createElement('div');
      itemEl.id = `task-${task.taskId}`;
      itemEl.className = 'task-item';
      activeTasksList.prepend(itemEl);
    }

    updateTaskCardUI(itemEl, task);
    updateActiveBadges();
  }

  // Update Task Card HTML
  function updateTaskCardUI(el, task) {
    const isCompleted = task.phase === 'completed';
    const isError = task.phase === 'error';
    const isCancelled = task.phase === 'cancelled';

    el.className = `task-item ${task.phase || ''}`;

    el.innerHTML = `
      <div class="task-header">
        <h4 class="task-title">${window.appModule.escapeHtml(task.title || 'Descarga')}</h4>
        <span class="task-format-pill ${task.format}">${task.format ? task.format.toUpperCase() : 'MP4'}</span>
      </div>

      <div class="task-progress-bar-wrap">
        <div class="task-progress-bar-fill ${isCompleted ? 'completed' : ''}" style="width: ${Math.min(100, Math.max(0, task.progress || 0))}%;"></div>
      </div>

      <div class="task-info-row">
        <span>${window.appModule.escapeHtml(task.statusLine || 'Descargando...')}</span>
        <span>${task.progress ? task.progress.toFixed(1) + '%' : '0%'}</span>
      </div>

      <div class="task-actions-row">
        ${isCompleted && task.result ? `
          <a class="btn-task-action btn-task-direct" href="${task.result.downloadUrl}?download=1" download="${window.appModule.escapeHtml(task.result.fileName)}" target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" style="margin-right: 4px; vertical-align: middle;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Guardar archivo
          </a>
          <button type="button" class="btn-task-action" onclick="window.playerModule.open(${JSON.stringify(task.result).replace(/"/g, '&quot;')})">Reproducir</button>
        ` : ''}

        ${(!isCompleted && !isError && !isCancelled) ? `
          <button type="button" class="btn-task-action" onclick="window.downloaderModule.cancelTask('${task.taskId}')">Cancelar</button>
        ` : `
          <button type="button" class="btn-task-action" onclick="window.downloaderModule.removeTask('${task.taskId}')">Quitar</button>
        `}
      </div>
    `;
  }

  // Hybrid SSE + Polling Real-Time Progress Subscription (100% Brave Shields & Adblocker Proof)
  function subscribeTaskProgress(taskId) {
    let isTerminated = false;
    let es = null;

    function handleTaskUpdate(update) {
      if (!update || isTerminated) return;
      const existing = activeTasks.get(taskId) || {};
      const merged = { ...existing, ...update };
      activeTasks.set(taskId, merged);

      const el = document.getElementById(`task-${taskId}`);
      if (el) updateTaskCardUI(el, merged);

      if (update.phase === 'completed') {
        cleanup();
        window.appModule.showToast('success', `¡${merged.format ? merged.format.toUpperCase() : 'ARCHIVO'} descargado con éxito!`);
        updateActiveBadges();
        if (window.libraryModule) window.libraryModule.loadLibrary();

        // Trigger universal browser download automatically
        if (merged.result && merged.result.downloadUrl) {
          window.appModule.downloadFile(merged.result.downloadUrl, merged.result.fileName);
        }
      } else if (update.phase === 'error' || update.phase === 'cancelled') {
        cleanup();
        updateActiveBadges();
      }
    }

    function cleanup() {
      if (isTerminated) return;
      isTerminated = true;
      if (pollingTimer) {
        clearInterval(pollingTimer);
        pollingTimer = null;
      }
      if (es) {
        try { es.close(); } catch (_) {}
        es = null;
      }
    }

    // A) Immediate concurrent polling watchdog every 1000ms
    let pollingTimer = setInterval(async () => {
      if (isTerminated) {
        clearInterval(pollingTimer);
        return;
      }
      try {
        const res = await fetch(`/api/task/${taskId}`);
        if (!res.ok) {
          if (res.status === 404) cleanup();
          return;
        }
        const task = await res.json();
        handleTaskUpdate(task);
      } catch (e) {}
    }, 1000);

    // B) SSE connection for instant low-latency events
    if (window.EventSource) {
      try {
        es = new EventSource(`/api/progress/${taskId}`);
        es.onmessage = e => {
          if (isTerminated) return;
          try {
            const update = JSON.parse(e.data);
            handleTaskUpdate(update);
          } catch (err) {
            console.error('SSE parse error:', err);
          }
        };
        es.onerror = () => {
          // If SSE drops or is buffered by Brave Shields, pollingTimer continues seamlessly
          if (es) {
            try { es.close(); } catch (_) {}
            es = null;
          }
        };
      } catch (err) {
        console.warn('EventSource initialization bypassed:', err);
      }
    }
  }

  // Cancel Task
  async function cancelTask(taskId) {
    try {
      await fetch(`/api/cancel/${taskId}`, { method: 'POST' });
      window.appModule.showToast('info', 'Cancelando descarga...');
    } catch (e) {
      window.appModule.showToast('error', 'No se pudo cancelar.');
    }
  }

  // Remove Task from UI
  function removeTask(taskId) {
    activeTasks.delete(taskId);
    const el = document.getElementById(`task-${taskId}`);
    if (el) el.remove();

    if (activeTasks.size === 0) {
      emptyQueueMsg.style.display = 'flex';
    }
    updateActiveBadges();
  }

  // Update Badge Counters
  function updateActiveBadges() {
    let running = 0;
    for (const t of activeTasks.values()) {
      if (t.phase !== 'completed' && t.phase !== 'error' && t.phase !== 'cancelled') {
        running++;
      }
    }

    if (activeTasksBadge) {
      activeTasksBadge.textContent = running;
      activeTasksBadge.style.display = running > 0 ? 'inline-block' : 'none';
    }
    if (mobileActiveBadge) {
      mobileActiveBadge.textContent = running;
      mobileActiveBadge.style.display = running > 0 ? 'inline-block' : 'none';
    }
    if (activeTasksCount) {
      activeTasksCount.textContent = `${running} activa${running === 1 ? '' : 's'}`;
    }
  }

  // Set External URL into input and analyze
  function setUrlAndAnalyze(url) {
    if (!url) return;
    urlInput.value = url;
    onUrlInputChange();
    window.appModule.switchTab('downloader');
    analyzeUrl(url);
  }

  // Initialize Event Listeners
  function init() {
    urlInput.addEventListener('input', onUrlInputChange);
    urlInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') analyzeUrl();
    });

    clearUrlBtn.addEventListener('click', clearInput);
    pasteBtn.addEventListener('click', pasteClipboard);
    analyzeBtn.addEventListener('click', () => analyzeUrl());

    // Format Chips
    document.querySelectorAll('.format-chip').forEach(btn => {
      btn.addEventListener('click', () => selectFormat(btn.dataset.format));
    });

    // Quality Chips (Video)
    videoQualitySection.querySelectorAll('.quality-chip').forEach(btn => {
      btn.addEventListener('click', () => selectQuality('video', btn.dataset.quality));
    });

    // Quality Chips (Audio)
    audioQualitySection.querySelectorAll('.quality-chip').forEach(btn => {
      btn.addEventListener('click', () => selectQuality('audio', btn.dataset.quality));
    });

    startDownloadBtn.addEventListener('click', startDownload);

    // Load defaults from localStorage
    const savedFormat = localStorage.getItem('mf_default_format') || 'mp4';
    selectFormat(savedFormat);

    const savedVideoQ = localStorage.getItem('mf_default_video_quality') || 'best';
    selectQuality('video', savedVideoQ);

    const savedAudioQ = localStorage.getItem('mf_default_audio_quality') || '320';
    selectQuality('audio', savedAudioQ);
  }

  document.addEventListener('DOMContentLoaded', init);

  // Export
  window.downloaderModule = {
    analyzeUrl,
    setUrlAndAnalyze,
    cancelTask,
    removeTask,
    selectFormat,
    selectQuality,
  };
})();


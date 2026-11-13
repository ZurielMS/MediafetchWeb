/**
 * MediaFetch Web — Responsive Player Modal Module
 */

(function () {
  'use strict';

  const playerModal = document.getElementById('playerModal');
  const closePlayerModalBtn = document.getElementById('closePlayerModalBtn');
  const playerModalTitle = document.getElementById('playerModalTitle');
  const playerModalFormatBadge = document.getElementById('playerModalFormatBadge');
  const html5VideoPlayer = document.getElementById('html5VideoPlayer');
  const html5AudioPlayer = document.getElementById('html5AudioPlayer');
  const playerDirectDownloadBtn = document.getElementById('playerDirectDownloadBtn');

  function open(item) {
    if (!item) return;

    const isVideo = item.format === 'mp4';
    const streamUrl = `/api/files/${encodeURIComponent(item.fileName)}`;
    const directDownloadUrl = `${streamUrl}?download=1`;

    playerModalTitle.textContent = item.title || item.fileName;
    playerModalFormatBadge.textContent = isVideo ? 'MP4 VIDEO' : 'MP3 AUDIO';
    playerModalFormatBadge.style.backgroundColor = isVideo ? 'var(--mp4-soft)' : 'var(--mp3-soft)';
    playerModalFormatBadge.style.color = isVideo ? 'var(--mp4-accent)' : 'var(--mp3-accent)';

    playerDirectDownloadBtn.href = directDownloadUrl;
    playerDirectDownloadBtn.download = item.fileName;
    playerDirectDownloadBtn.target = '_blank';
    playerDirectDownloadBtn.rel = 'noopener noreferrer';

    if (isVideo) {
      html5AudioPlayer.style.display = 'none';
      html5AudioPlayer.pause();
      html5AudioPlayer.src = '';

      html5VideoPlayer.style.display = 'block';
      html5VideoPlayer.src = streamUrl;
      html5VideoPlayer.play().catch(() => {});
    } else {
      html5VideoPlayer.style.display = 'none';
      html5VideoPlayer.pause();
      html5VideoPlayer.src = '';

      html5AudioPlayer.style.display = 'block';
      html5AudioPlayer.src = streamUrl;
      html5AudioPlayer.play().catch(() => {});
    }

    playerModal.style.display = 'flex';
  }

  function close() {
    html5VideoPlayer.pause();
    html5VideoPlayer.src = '';
    html5AudioPlayer.pause();
    html5AudioPlayer.src = '';
    playerModal.style.display = 'none';
  }

  function init() {
    closePlayerModalBtn.addEventListener('click', close);
    playerModal.addEventListener('click', e => {
      if (e.target === playerModal) {
        close();
      }
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && playerModal.style.display !== 'none') {
        close();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  // Export
  window.playerModule = {
    open,
    close,
  };
})();


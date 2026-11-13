/**
 * MediaFetch Web — Browser & Stream Sniffer Module
 */

(function () {
  'use strict';

  let currentUrl = '';
  const historyStack = [];

  const browserAddressInput = document.getElementById('browserAddressInput');
  const browserGoBtn = document.getElementById('browserGoBtn');
  const browserBackBtn = document.getElementById('browserBackBtn');
  const browserReloadBtn = document.getElementById('browserReloadBtn');
  const browserHomeSplash = document.getElementById('browserHomeSplash');
  const browserIframe = document.getElementById('browserIframe');
  const browserFloatingBar = document.getElementById('browserFloatingBar');
  const sendBrowserUrlBtn = document.getElementById('sendBrowserUrlBtn');
  const browserSessionStatus = document.getElementById('browserSessionStatus');
  const browserSessionDot = document.getElementById('browserSessionDot');
  const browserSessionLabel = document.getElementById('browserSessionLabel');

  // Normalize URL or search
  function normalizeUrl(input) {
    const raw = (input || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    if (/^[^\s]+\.[^\s]{2,}(\/.*)?$/i.test(raw) && !raw.includes(' ')) {
      return `https://${raw}`;
    }
    return `https://www.google.com/search?q=${encodeURIComponent(raw)}`;
  }

  // Navigate to URL
  function navigate(rawInput) {
    const url = normalizeUrl(rawInput);
    if (!url) return;

    currentUrl = url;
    browserAddressInput.value = url;
    historyStack.push(url);

    if (browserBackBtn) browserBackBtn.disabled = historyStack.length <= 1;

    browserHomeSplash.style.display = 'none';
    browserIframe.style.display = 'block';
    browserFloatingBar.style.display = 'flex';

    // Load via safe local proxy to bypass X-Frame-Options and CORS restrictions
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
    browserIframe.src = proxyUrl;

    updateSessionPill(url);
  }

  // Check if session cookies are active
  async function updateSessionPill() {
    try {
      const res = await fetch('/api/session/cookies');
      if (!res.ok) return;
      const data = await res.json();

      if (data.hasCookies) {
        browserSessionDot.className = 'session-dot active';
        browserSessionLabel.textContent = `${data.cookieCount} cookies activas`;
      } else {
        browserSessionDot.className = 'session-dot';
        browserSessionLabel.textContent = 'Sin cookies';
      }
    } catch (e) {
      browserSessionDot.className = 'session-dot';
      browserSessionLabel.textContent = 'Sin cookies';
    }
  }

  // Go Back
  function goBack() {
    if (historyStack.length > 1) {
      historyStack.pop(); // current
      const prev = historyStack.pop();
      navigate(prev);
    }
  }

  // Reload
  function reload() {
    if (currentUrl) {
      navigate(currentUrl);
    }
  }

  // Send to Downloader
  function sendToDownloader() {
    if (!currentUrl) return;
    window.downloaderModule.setUrlAndAnalyze(currentUrl);
  }

  // Initialize
  function init() {
    browserGoBtn.addEventListener('click', () => navigate(browserAddressInput.value));
    browserAddressInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') navigate(browserAddressInput.value);
    });

    browserBackBtn.addEventListener('click', goBack);
    browserReloadBtn.addEventListener('click', reload);
    sendBrowserUrlBtn.addEventListener('click', sendToDownloader);

    // Bookmarks bar clicks
    document.querySelectorAll('.bm-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.url;
        if (target) navigate(target);
      });
    });

    updateSessionPill();
  }

  document.addEventListener('DOMContentLoaded', init);

  // Export
  window.browserModule = {
    navigate,
    getCurrentUrl: () => currentUrl,
  };
})();


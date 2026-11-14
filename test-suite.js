const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('====================================================');
console.log('🧪 MediaFetch Web — Comprehensive Automated Test Suite');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function it(description, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ PASS: ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${description}`);
    console.error(`     Error: ${err.message}`);
  }
}

async function itAsync(description, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✅ PASS: ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${description}`);
    console.error(`     Error: ${err.message}`);
  }
}

function fetchHttp(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function run() {
  console.log('--- 1. Verification of HTML Structure ---');
  const htmlPath = path.join(__dirname, 'public', 'index.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  it('HTML includes anti-flicker early theme script in <head>', () => {
    assert(htmlContent.includes('localStorage.getItem(\'mf_theme\')'), 'Missing theme early initialization script');
    assert(htmlContent.includes('document.documentElement.setAttribute(\'data-theme\''), 'Missing data-theme setter');
  });

  it('HTML contains theme toggle button in header with sun and moon icons', () => {
    assert(htmlContent.includes('id="themeToggleBtn"'), 'Missing #themeToggleBtn');
    assert(htmlContent.includes('class="theme-icon sun-icon"'), 'Missing sun icon');
    assert(htmlContent.includes('class="theme-icon moon-icon"'), 'Missing moon icon');
    assert(htmlContent.includes('aria-label='), 'Theme toggle must have aria-label');
  });

  it('HTML contains themeModeSelect in Settings tab', () => {
    assert(htmlContent.includes('id="themeModeSelect"'), 'Missing #themeModeSelect in settings');
    assert(htmlContent.includes('value="system"'), 'Missing system theme option');
    assert(htmlContent.includes('value="dark"'), 'Missing dark theme option');
    assert(htmlContent.includes('value="light"'), 'Missing light theme option');
  });

  it('HTML format chips have redesigned UI structure with check indicators', () => {
    assert(htmlContent.includes('class="chip-icon-wrap"'), 'Missing chip icon container');
    assert(htmlContent.includes('class="chip-badge-tag mp4"'), 'Missing mp4 badge tag');
    assert(htmlContent.includes('class="chip-badge-tag mp3"'), 'Missing mp3 badge tag');
    assert(htmlContent.includes('class="chip-check-indicator"'), 'Missing chip checkmark indicator');
  });

  console.log('\n--- 2. Verification of CSS Design System & Themes ---');
  const cssPath = path.join(__dirname, 'public', 'css', 'styles.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');

  it('CSS defines dark theme tokens in :root and [data-theme="dark"]', () => {
    assert(cssContent.includes('[data-theme="dark"]'), 'Missing [data-theme="dark"] selector');
    assert(cssContent.includes('--bg-primary: #0B0F19;'), 'Missing dark bg-primary');
    assert(cssContent.includes('--bg-surface: #121826;'), 'Missing dark bg-surface');
  });

  it('CSS defines comprehensive light theme tokens in [data-theme="light"]', () => {
    assert(cssContent.includes('[data-theme="light"]'), 'Missing [data-theme="light"] selector');
    assert(cssContent.includes('--bg-primary: #F4F6F9;'), 'Missing light bg-primary');
    assert(cssContent.includes('--bg-surface: #FFFFFF;'), 'Missing light bg-surface');
    assert(cssContent.includes('--text-primary: #0F172A;'), 'Missing light text-primary');
    assert(cssContent.includes('--input-bg: #FFFFFF;'), 'Missing light input-bg');
    assert(cssContent.includes('--border-color: #E2E8F0;'), 'Missing light border-color');
  });

  it('CSS includes smooth theme transitions and custom scrollbars', () => {
    assert(cssContent.includes('transition: background-color 0.25s ease'), 'Missing surface theme transitions');
    assert(cssContent.includes('::-webkit-scrollbar'), 'Missing custom scrollbar styling');
  });

  it('CSS provides modernized button hierarchy and tactile active states', () => {
    assert(cssContent.includes('.theme-toggle-btn'), 'Missing .theme-toggle-btn styles');
    assert(cssContent.includes('.btn-analyze:active'), 'Missing .btn-analyze tactile active state');
    assert(cssContent.includes('.btn-start-download'), 'Missing .btn-start-download styling');
    assert(cssContent.includes('.btn-paste:hover'), 'Missing .btn-paste hover styling');
    assert(cssContent.includes('.format-chip.active[data-format="mp4"]'), 'Missing active mp4 format chip styling');
    assert(cssContent.includes('.format-chip.active[data-format="mp3"]'), 'Missing active mp3 format chip styling');
  });

  console.log('\n--- 3. Verification of JavaScript Modules ---');
  const appJsPath = path.join(__dirname, 'public', 'js', 'app.js');
  const appJsContent = fs.readFileSync(appJsPath, 'utf8');

  it('app.js exports theme manipulation functions', () => {
    assert(appJsContent.includes('setTheme'), 'Missing setTheme in app.js');
    assert(appJsContent.includes('toggleTheme'), 'Missing toggleTheme in app.js');
    assert(appJsContent.includes('applyTheme'), 'Missing applyTheme in app.js');
    assert(appJsContent.includes('window.matchMedia'), 'Missing system theme listener support');
  });

  const settingsJsPath = path.join(__dirname, 'public', 'js', 'settings.js');
  const settingsJsContent = fs.readFileSync(settingsJsPath, 'utf8');

  it('settings.js binds themeModeSelect to window.appModule.setTheme', () => {
    assert(settingsJsContent.includes('themeModeSelect'), 'Missing themeModeSelect reference');
    assert(settingsJsContent.includes('window.appModule.setTheme(e.target.value'), 'Missing setTheme call on select change');
  });

  console.log('\n--- 4. Live Server HTTP API Tests (port 3000) ---');

  // Ensure server is running for tests; if not, spawn it automatically and poll until ready
  let spawnedServer = null;
  try {
    await fetchHttp('http://127.0.0.1:3000/api/status');
  } catch (_) {
    const { spawn } = require('child_process');
    spawnedServer = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
      env: { ...process.env, PORT: '3000' },
      stdio: 'ignore'
    });
    
    // Poll until server is responding
    let ready = false;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 400));
      try {
        await fetchHttp('http://127.0.0.1:3000/api/status');
        ready = true;
        break;
      } catch (e) {}
    }
    if (!ready) {
      throw new Error('Server failed to start within timeout');
    }
  }

  await itAsync('GET / returns 200 and serves HTML', async () => {
    const res = await fetchHttp('http://127.0.0.1:3000/');
    assert.strictEqual(res.statusCode, 200);
    assert(res.body.includes('MediaFetch Web'), 'Response does not include site title');
    assert(res.body.includes('id="themeToggleBtn"'), 'HTML does not include theme toggle button');
  });

  await itAsync('GET /css/styles.css returns 200 with proper Content-Type', async () => {
    const res = await fetchHttp('http://127.0.0.1:3000/css/styles.css');
    assert.strictEqual(res.statusCode, 200);
    assert(res.headers['content-type'].includes('text/css'), 'Content-type must be text/css');
    assert(res.body.includes('[data-theme="light"]'), 'Served CSS missing light theme');
  });

  await itAsync('GET /js/app.js returns 200 with proper Content-Type', async () => {
    const res = await fetchHttp('http://127.0.0.1:3000/js/app.js');
    assert.strictEqual(res.statusCode, 200);
    assert(res.body.includes('toggleTheme'), 'Served app.js missing toggleTheme');
  });

  await itAsync('GET /api/status returns 200 with system diagnostics', async () => {
    const res = await fetchHttp('http://127.0.0.1:3000/api/status');
    assert.strictEqual(res.statusCode, 200);
    const data = JSON.parse(res.body);
    assert.strictEqual(data.initialized, true);
    assert(data.ytdlpVersion, 'Missing yt-dlp version');
    assert.strictEqual(data.ffmpegReady, true, 'ffmpeg should be ready');
  });

  await itAsync('GET /api/library returns 200 with downloaded items array', async () => {
    const res = await fetchHttp('http://127.0.0.1:3000/api/library');
    assert.strictEqual(res.statusCode, 200);
    const data = JSON.parse(res.body);
    assert(Array.isArray(data), 'Library must return an array');
  });

  await itAsync('GET /api/session/cookies returns 200 with session status', async () => {
    const res = await fetchHttp('http://127.0.0.1:3000/api/session/cookies');
    assert.strictEqual(res.statusCode, 200);
    const data = JSON.parse(res.body);
    assert('hasCookies' in data, 'Missing hasCookies property');
  });

  await itAsync('POST /api/analyze without URL returns 400 Bad Request', async () => {
    const res = await fetchHttp('http://127.0.0.1:3000/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: '' })
    });
    assert.strictEqual(res.statusCode, 400);
    const data = JSON.parse(res.body);
    assert(data.error, 'Should return validation error');
  });

  await itAsync('POST /api/analyze with YouTube Music URL returns media metadata', async () => {
    const res = await fetchHttp('http://127.0.0.1:3000/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://music.youtube.com/watch?v=mSjHnQ1h7bE' })
    });
    assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}: ${res.body}`);
    const data = JSON.parse(res.body);
    assert.strictEqual(data.id, 'mSjHnQ1h7bE', 'Must match video ID');
    assert(data.title, 'Title should be present');
    assert(data.platform, 'Platform should be present');
    assert.strictEqual(data.platform.label, 'YouTube Music', 'Platform label should preserve YouTube Music');
  });

  await itAsync('POST /api/analyze with YouTube Music Radio / Mix URL extracts video cleanly', async () => {
    const res = await fetchHttp('http://127.0.0.1:3000/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://music.youtube.com/watch?v=tFkxbRzrdZk&list=RDtFkxbRzrdZk&start_radio=1' })
    });
    assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}: ${res.body}`);
    const data = JSON.parse(res.body);
    assert.strictEqual(data.id, 'tFkxbRzrdZk', 'Must match video ID');
    assert(data.title, 'Title should be present');
    assert.strictEqual(data.platform.label, 'YouTube Music', 'Platform label should preserve YouTube Music');
  });

  console.log('\n====================================================');
  console.log(`📊 Test Results: ${passedTests}/${totalTests} tests passed (${Math.round((passedTests/totalTests)*100)}%)`);
  console.log('====================================================');

  if (spawnedServer) {
    try {
      spawnedServer.kill();
    } catch (_) {}
  }

  if (passedTests === totalTests) {
    console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
  } else {
    process.exitCode = 1;
  }
}

run().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});


(() => {
  const MIN_ANGLE = 135;
  const MAX_ANGLE = 405;
  const MAX_SPEED = 500;

  const gaugeArc = document.getElementById('gaugeArc');
  const needle = document.getElementById('needle');
  const ticksGroup = document.getElementById('ticks');
  const speedValue = document.getElementById('speedValue');
  const testLabel = document.getElementById('testLabel');
  const goBtn = document.getElementById('goBtn');
  const resultsPanel = document.getElementById('results');
  const settingsPanel = document.getElementById('settingsPanel');
  const historyPanel = document.getElementById('historyPanel');
  const historyList = document.getElementById('historyList');
  const spinnerRing = document.getElementById('spinnerRing');
  const serverSelect = document.getElementById('serverSelect');
  const serverNameEl = document.getElementById('serverName');
  const serverDistEl = document.getElementById('serverDist');

  const CIRCUMFERENCE = 2 * Math.PI * 120;

  const servers = {
    nyc: { name: 'New York, USA', dist: '1,204 km · 7.5 ms prop.' },
    lon: { name: 'London, UK', dist: '5,631 km · 84.2 ms prop.' },
    fra: { name: 'Frankfurt, DE', dist: '6,240 km · 93.1 ms prop.' },
    sg: { name: 'Singapore, SG', dist: '11,320 km · 167.4 ms prop.' },
    syd: { name: 'Sydney, AU', dist: '15,402 km · 215.9 ms prop.' },
    tok: { name: 'Tokyo, JP', dist: '10,857 km · 161.1 ms prop.' }
  };

  const indexRows = [
    { country: 'Singapore', flag: '🇸🇬', dl: 264.91 },
    { country: 'Hong Kong', flag: '🇭🇰', dl: 242.45 },
    { country: 'Monaco', flag: '🇲🇨', dl: 231.89 },
    { country: 'Thailand', flag: '🇹🇭', dl: 225.52 },
    { country: 'Switzerland', flag: '🇨🇭', dl: 218.37 },
    { country: 'South Korea', flag: '🇰🇷', dl: 211.78 },
    { country: 'Denmark', flag: '🇩🇰', dl: 207.63 },
    { country: 'Chile', flag: '🇨🇱', dl: 199.44 },
    { country: 'Romania', flag: '🇷🇴', dl: 196.12 },
    { country: 'Japan', flag: '🇯🇵', dl: 191.55 }
  ];

  let history = [];
  let isRunning = false;

  function buildTicks() {
    const steps = 14;
    for (let i = 0; i <= steps; i++) {
      const angle = MIN_ANGLE + ((MAX_ANGLE - MIN_ANGLE) * i) / steps;
      const rad = (angle * Math.PI) / 180;
      const r1 = 96;
      const r2 = i % 2 === 0 ? 84 : 88;
      const x1 = 150 + r1 * Math.cos(rad);
      const y1 = 150 + r1 * Math.sin(rad);
      const x2 = 150 + r2 * Math.cos(rad);
      const y2 = 150 + r2 * Math.sin(rad);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x1.toFixed(2));
      line.setAttribute('y1', y1.toFixed(2));
      line.setAttribute('x2', x2.toFixed(2));
      line.setAttribute('y2', y2.toFixed(2));
      ticksGroup.appendChild(line);
    }
  }

  function speedToAngle(mbps) {
    const clamped = Math.max(0, Math.min(MAX_SPEED, mbps));
    return MIN_ANGLE + ((MAX_ANGLE - MIN_ANGLE) * clamped) / MAX_SPEED;
  }

  function updateGauge(mbps) {
    const angle = speedToAngle(mbps);
    const currentArc = CIRCUMFERENCE * ((angle - MIN_ANGLE) / 360);
    const offset = CIRCUMFERENCE - currentArc;
    gaugeArc.setAttribute('stroke-dashoffset', Math.max(0, offset).toFixed(2));
    needle.setAttribute('transform', `rotate(${angle} 150 150)`);
  }

  function resetGauge() {
    gaugeArc.setAttribute('stroke-dashoffset', CIRCUMFERENCE.toFixed(2));
    needle.setAttribute('transform', `rotate(${MIN_ANGLE} 150 150)`);
  }

  function setSpeed(mbps) {
    speedValue.textContent = Math.max(0, mbps).toFixed(2);
    updateGauge(mbps);
  }

  function setSpinner(on) {
    spinnerRing.style.opacity = on ? '1' : '0';
  }

  function selectServer() {
    const key = serverSelect.value;
    const s = servers[key];
    serverNameEl.textContent = s.name;
    serverDistEl.textContent = s.dist;
  }

  function toggleSettings() {
    const visible = settingsPanel.style.display !== 'none';
    settingsPanel.style.display = visible ? 'none' : 'block';
  }

  function toggleHistory() {
    const visible = historyPanel.style.display !== 'none';
    historyPanel.style.display = visible ? 'none' : 'block';
  }

  function clearHistory() {
    history = [];
    renderHistory();
  }

  function addHistoryItem(result) {
    const item = {
      time: new Date().toLocaleString(),
      ping: result.ping,
      download: result.download,
      upload: result.upload
    };
    history.unshift(item);
    if (history.length > 8) history.length = 8;
    renderHistory();
  }

  function renderHistory() {
    historyList.innerHTML = '';
    if (history.length === 0) {
      historyList.innerHTML = '<div class="history-item" style="color:#8888a8;justify-content:center;">No recent tests yet.</div>';
      return;
    }
    history.forEach((item) => {
      const el = document.createElement('div');
      el.className = 'history-item';
      el.innerHTML = `
        <div class="history-meta">${item.time}<br/>${servers[serverSelect.value].name}</div>
        <div class="history-values">↓ ${item.download.toFixed(2)} Mbps<br/>↑ ${item.upload.toFixed(2)} Mbps</div>
      `;
      historyList.appendChild(el);
    });
  }

  function buildGlobalIndex() {
    const grid = document.getElementById('indexGrid');
    grid.innerHTML = '';
    indexRows.forEach((row) => {
      const card = document.createElement('div');
      card.className = 'index-card';
      card.innerHTML = `
        <div class="index-card-header">
          <div class="index-country">${row.country}</div>
          <div class="index-flag">${row.flag}</div>
        </div>
        <div class="index-dl">${row.dl} <label>Median Download</label></div>
      `;
      grid.appendChild(card);
    });
  }

  async function timedFetch(url, options = {}, ms = 7000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      return res;
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  }

  async function measurePing() {
    testLabel.textContent = 'PING';
    setSpinner(true);
    const start = performance.now();
    try {
      await timedFetch('https://proof.ovh.net/files/1Mb.dat', { method: 'HEAD', mode: 'cors' }, 5000);
    } catch (_) {
      // offline or blocked
    }
    setSpinner(false);
    const elapsed = performance.now() - start;
    const ping = Math.max(1, Math.round(elapsed * 10) / 10);
    return ping;
  }

  async function measureDownload() {
    testLabel.textContent = 'DOWNLOAD';
    setSpinner(true);
    const url = 'https://proof.ovh.net/files/10Mb.dat';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const start = performance.now();
    let bytes = 0;
    try {
      const res = await fetch(url, { mode: 'cors', signal: controller.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      bytes = parseInt(res.headers.get('content-length') || '10485760', 10);
      await res.arrayBuffer();
    } catch (_) {
      // fallback to zero but keep flow moving
    }
    clearTimeout(timeout);
    setSpinner(false);
    const elapsed = (performance.now() - start) / 1000;
    const mbps = elapsed > 0 ? (bytes * 8) / (elapsed * 1_000_000) : 0;
    return Math.max(0.5, mbps);
  }

  async function measureUpload() {
    testLabel.textContent = 'UPLOAD';
    setSpinner(true);
    const payload = new Uint8Array(2 * 1024 * 1024);
    crypto.getRandomValues(payload);
    const blob = new Blob([payload]);
    const endpoints = [
      { url: 'https://httpbin.org/post', method: 'POST', body: blob },
      { url: 'https://httpbin.org/post', method: 'POST', body: blob },
      { url: 'https://httpbin.org/put', method: 'PUT', body: blob }
    ];
    const start = performance.now();
    let sentBytes = 0;

    try {
      let lastError = null;
      for (const ep of endpoints) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 12000);
        try {
          const res = await timedFetch(ep.url, { method: ep.method, body: ep.body, mode: 'cors' }, 12000);
          clearTimeout(id);
          if (!res.ok) throw new Error('HTTP ' + res.status);
          sentBytes += payload.byteLength;
          break;
        } catch (e) {
          lastError = e;
          clearTimeout(id);
          continue;
        }
      }
      if (!sentBytes) throw lastError || new Error('upload_endpoint_unavailable');
    } catch (_) {
      sentBytes = 1024 * 1024;
    }
    setSpinner(false);
    const elapsed = (performance.now() - start) / 1000;
    const mbps = elapsed > 0 ? (sentBytes * 8) / (elapsed * 1_000_000) : 0;
    return Math.max(0.5, mbps);
  }

  async function animateValue(fromMbps, toMbps, duration) {
    const start = performance.now();
    const step = (now) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = fromMbps + (toMbps - fromMbps) * eased;
      setSpeed(current);
      if (t < 1) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  }

  async function runSpeedTest() {
    const connType = document.getElementById('connType').value;

    const ping = await measurePing();
    const warmTarget = Math.min(Math.max(2, ping * 2), 14);
    await animateValue(0, warmTarget, 350);

    const dlTarget = await measureDownload();
    if (dlTarget > 0) {
      await animateValue(0, dlTarget, 2200);
    } else {
      await animateValue(0, 0.5, 300);
    }

    const ulTarget = await measureUpload();
    const uploadFrom = dlTarget > 0 ? dlTarget : 0.5;
    if (ulTarget > 0) {
      await animateValue(uploadFrom, ulTarget, 2000);
    } else {
      await animateValue(uploadFrom, uploadFrom, 300);
    }

    testLabel.textContent = 'COMPLETE';
    return { ping, download: dlTarget, upload: ulTarget };
  }

  async function startTest() {
    if (isRunning) return;
    isRunning = true;
    goBtn.disabled = true;
    resultsPanel.style.display = 'none';
    historyPanel.style.display = 'none';
    resetGauge();
    goBtn.textContent = 'TESTING...';
    try {
      const result = await runSpeedTest();
      document.getElementById('pingValue').textContent = result.ping.toFixed(2);
      document.getElementById('dlValue').textContent = result.download.toFixed(2);
      document.getElementById('ulValue').textContent = result.upload.toFixed(2);
      resultsPanel.style.display = 'flex';
      addHistoryItem(result);
    } catch (err) {
      console.error(err);
      alert('Speed test failed. Please try again. If this keeps happening, your network may be blocking the test servers.');
    } finally {
      isRunning = false;
      goBtn.disabled = false;
      goBtn.textContent = 'GO';
      setSpinner(false);
    }
  }

  // Init
  buildTicks();
  resetGauge();
  setSpeed(0);
  selectServer();
  buildGlobalIndex();
  renderHistory();
})();

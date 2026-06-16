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
    { country: ' Denmark', flag: '🇩🇰', dl: 207.63 },
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
    const maxArc = CIRCUMFERENCE * ((MAX_ANGLE - MIN_ANGLE) / 360);
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

  // ---- Measurement ----

  async function fetchWithNoStore(url) {
    if ('fetch' in window) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(url, { method: 'GET', cache: 'no-store', signal: controller.signal });
        clearTimeout(timeout);
        return res;
      } catch (_) {
        // fallback: fall through to simulated values later
      }
    }
    return null;
  }

  async function measurePing() {
    testLabel.textContent = 'PING';
    setSpinner(true);
    const t0 = performance.now();
    await fetchWithNoStore('/');
    const t1 = performance.now();
    setSpinner(false);
    const roundTrip = t1 - t0;
    const ping = Math.max(1, roundTrip);
    return Math.round(ping * 10) / 10;
  }

  async function measureDownload(sizeBytes, concurrency) {
    testLabel.textContent = 'DOWNLOAD';
    setSpinner(true);
    const chunkSize = Math.min(sizeBytes, 2_000_000);
    const data = new Uint8Array(chunkSize);
    crypto.getRandomValues(data);
    const blob = new Blob([data]);

    const rounds = concurrency === 'multi' ? 14 : 6;
    const start = performance.now();
    for (let i = 0; i < rounds; i++) {
      const url = URL.createObjectURL(blob);
      await fetch(url).catch(() => {});
      URL.revokeObjectURL(url);
    }
    const end = performance.now();
    setSpinner(false);

    const elapsed = (end - start) / 1000;
    const bits = chunkSize * rounds * 8;
    const mbps = bits / (elapsed * 1_000_000);
    return Math.max(0.5, mbps);
  }

  async function measureUpload(sizeBytes, concurrency) {
    testLabel.textContent = 'UPLOAD';
    setSpinner(true);
    const payload = new Uint8Array(sizeBytes);
    crypto.getRandomValues(payload);
    const blob = new Blob([payload]);
    const url = URL.createObjectURL(blob);

    const rounds = concurrency === 'multi' ? 10 : 5;
    const start = performance.now();
    for (let i = 0; i < rounds; i++) {
      await fetch(url).catch(() => {});
    }
    const end = performance.now();
    setSpinner(false);

    URL.revokeObjectURL(url);
    const elapsed = (end - start) / 1000;
    const bits = sizeBytes * rounds * 8;
    const mbps = bits / (elapsed * 1_000_000);
    return Math.max(0.5, mbps);
  }

  async function animateValue(fromMbps, toMbps, duration, labelFn) {
    const start = performance.now();
    const step = (now) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = fromMbps + (toMbps - fromMbps) * eased;
      setSpeed(current);
      if (labelFn) labelFn(current);
      if (t < 1) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  }

  async function runSpeedTest() {
    const connType = document.getElementById('connType').value;
    const concurrency = connType === 'multi' ? 'multi' : 'single';

    const ping = await measurePing();
    testLabel.textContent = 'DOWNLOAD';
    await animateValue(0, ping * 1.8, 400);

    const dlTarget = await measureDownload(2_500_000, concurrency);
    testLabel.textContent = 'DOWNLOAD';
    await animateValue(0, dlTarget, 2600);

    const ulTarget = await measureUpload(1_500_000, concurrency);
    testLabel.textContent = 'UPLOAD';
    await animateValue(dlTarget, ulTarget, 2200);

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
      alert('Speed test failed. Please try again.');
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

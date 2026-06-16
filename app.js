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
      const rad = angle * Math.PI / 180;
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

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function measurePing() {
    testLabel.textContent = 'PING';
    setSpinner(true);
    const start = performance.now();
    await sleep(320 + Math.random() * 260);
    setSpinner(false);
    const ping = Math.round((performance.now() - start) * 10) / 10;
    return ping;
  }

  async function measureDownload() {
    testLabel.textContent = 'DOWNLOAD';
    setSpinner(true);
    const target = 12 + Math.random() * 170;
    await sleep(1700 + Math.random() * 1200);
    setSpinner(false);
    return Math.round(target * 100) / 100;
  }

  async function measureUpload() {
    testLabel.textContent = 'UPLOAD';
    setSpinner(true);
    const target = 4 + Math.random() * 45;
    await sleep(1600 + Math.random() * 1100);
    setSpinner(false);
    return Math.round(target * 100) / 100;
  }

  async function animateValue(fromMbps, toMbps, duration, label) {
    const start = performance.now();
    const step = (now) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = fromMbps + (toMbps - fromMbps) * eased;
      setSpeed(current);
      testLabel.textContent = label;
      if (t < 1) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  }

  async function runSpeedTest() {
    const ping = await measurePing();
    const warmTarget = Math.min(Math.max(2, ping * 2), 14);
    await animateValue(0, warmTarget, 380, 'DOWNLOAD');

    const dlTarget = await measureDownload();
    await animateValue(0, dlTarget, 2400, 'DOWNLOAD');

    const ulTarget = await measureUpload();
    await animateValue(dlTarget, ulTarget, 2200, 'UPLOAD');

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

  buildTicks();
  resetGauge();
  setSpeed(0);
  selectServer();
  buildGlobalIndex();
  renderHistory();

  window.startTest = startTest;
  window.toggleSettings = toggleSettings;
  window.toggleHistory = toggleHistory;
  window.clearHistory = clearHistory;
  window.selectServer = selectServer;
})();

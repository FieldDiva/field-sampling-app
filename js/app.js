// ============================================
// FIELD SAMPLER PWA - App Logic
// ============================================

// --- CONFIG ---
const SPANS = [2, 3, 4, 7, 8, 9];
const LYSIMETER_SPANS = [3, 8];
const SIDES = ['East', 'West'];
const QUADRANTS = ['NE', 'NW', 'SE', 'SW'];
const ROWS = ['R1', 'R2', 'R3', 'R4'];

// --- STATE ---
let currentSession = null;
let currentPlotKey = null;
let currentMode = null; // 'field' | 'lab' | 'ref' | 'lys'
let selectedSide = 'East';
let currentPlotGPS = { lat: null, lng: null };
let selectedSessionType = 'Weekly';

// --- STORAGE ---
function getSessions() {
  try {
    return JSON.parse(localStorage.getItem('fs_sessions') || '{}');
  } catch { return {}; }
}

function saveSessionsData(sessions) {
  localStorage.setItem('fs_sessions', JSON.stringify(sessions));
}

function saveCurrentSession() {
  if (!currentSession) return;
  const sessions = getSessions();
  sessions[currentSession.id] = currentSession;
  saveSessionsData(sessions);
}

// --- SCREEN NAVIGATION ---
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (id === 'screen-home') renderHome();
  if (id === 'screen-sessions') renderSessionsList();
  if (id === 'screen-new-session') initNewSessionForm();
}

function backToSessionMenu() {
  showScreen('screen-session-menu');
  renderSessionMenu();
}

// --- HOME ---
function renderHome() {
  const sessions = getSessions();
  const recent = Object.values(sessions).sort((a,b) => b.id - a.id).slice(0, 3);
  const el = document.getElementById('home-recent');
  if (recent.length === 0) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <div style="color:rgba(255,255,255,0.7);font-size:12px;font-weight:700;letter-spacing:0.5px;margin-bottom:8px;">RECENT</div>
    ${recent.map(s => `
      <div class="session-card" style="margin-bottom:8px;" onclick="openSession('${s.id}')">
        <div class="session-card-info">
          <h3>${s.date} · ${s.side}</h3>
          <p>${s.crop} · ${s.type}</p>
        </div>
        <span class="session-card-arrow">›</span>
      </div>
    `).join('')}
  `;
}

// --- NEW SESSION ---
function initNewSessionForm() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('session-date').value = today;
  selectedSide = 'East';
  selectedSessionType = 'Weekly';
  updateToggle('side-east', 'side-west', 'East');
  updateToggle('type-weekly', 'type-harvest', 'Weekly');
  document.getElementById('gps-display').textContent = 'Not captured';
  document.getElementById('gps-display').classList.remove('captured');
  document.getElementById('gps-display').dataset.lat = '';
  document.getElementById('gps-display').dataset.lng = '';
}

function selectSide(side) {
  selectedSide = side;
  updateToggle('side-east', 'side-west', side === 'East' ? 'East' : null);
  document.getElementById('side-east').classList.toggle('active', side === 'East');
  document.getElementById('side-west').classList.toggle('active', side === 'West');
}

function selectSessionType(type) {
  selectedSessionType = type;
  document.getElementById('type-weekly').classList.toggle('active', type === 'Weekly');
  document.getElementById('type-harvest').classList.toggle('active', type === 'Harvest');
}

function updateToggle(idA, idB, activeVal) {
  // handled inline
}

function captureGPS() {
  const el = document.getElementById('plot-gps-display');
  if (!el) return;
  el.textContent = 'Capturing...';
  if (!navigator.geolocation) {
    el.textContent = 'GPS not available';
    return;
  }
  navigator.geolocation.getCurrentPosition(
    pos => {
      const lat = pos.coords.latitude.toFixed(6);
      const lng = pos.coords.longitude.toFixed(6);
      el.textContent = `${lat}, ${lng}`;
      el.classList.add('captured');
      el.dataset.lat = lat;
      el.dataset.lng = lng;
      currentPlotGPS = { lat, lng };
    },
    err => {
      el.textContent = 'GPS error - try again';
      showToast('Could not get GPS. Check location permissions.');
    },
    { enableHighAccuracy: true, timeout: 15000 }
  );
}

function autoAdvance(input, nextId) {
  if (input.value.length > 0) {
    const next = document.getElementById(nextId);
    if (next) { next.focus(); next.select(); }
  }
}

function startSession() {
  const date = document.getElementById('session-date').value;
  const crop = document.getElementById('session-crop').value;
  const year = document.getElementById('session-year').value;
  const tech = document.getElementById('session-tech').value;

  if (!date) { showToast('Please enter a date'); return; }

  currentSession = {
    id: Date.now().toString(),
    date,
    crop,
    year,
    side: selectedSide,
    type: selectedSessionType,
    tech,
    plots: {},
    refs: {},
    lys: {}
  };

  saveCurrentSession();
  showScreen('screen-session-menu');
  renderSessionMenu();
}

// --- SESSION MENU ---
function renderSessionMenu() {
  if (!currentSession) return;

  document.getElementById('session-menu-title').textContent =
    `${currentSession.date} · ${currentSession.side}`;
  document.getElementById('session-info-bar').textContent =
    `${currentSession.crop} · ${currentSession.year} · ${currentSession.type} · ${currentSession.tech || ''}`;

  // Destructive plots
  const plotList = document.getElementById('plot-list');
  plotList.innerHTML = '';
  SPANS.forEach(span => {
    ['A','B'].forEach(ab => {
      const key = `${span}${currentSession.side.charAt(0)}${ab}`;
      const data = currentSession.plots[key] || {};
      const fieldDone = data.field_saved;
      const labDone = data.lab_saved;
      const isLys = LYSIMETER_SPANS.includes(span);

      const item = document.createElement('div');
      item.className = `plot-item${isLys ? ' lysimeter' : ''}`;
      item.innerHTML = `
        <div style="flex:1">
          <div class="plot-item-name">Span ${span}${selectedSide.charAt(0)} · ${ab}</div>
          <div class="plot-item-sub">${isLys ? '🧪 Lysimeter span' : 'Destructive sample'}</div>
        </div>
        <div class="status-dots">
          <div class="dot${fieldDone ? ' filled-field' : ''}" title="Field"></div>
          <div class="dot${labDone ? ' filled-lab' : ''}" title="Lab"></div>
        </div>
        <span style="font-size:20px;color:#bbb">›</span>
      `;
      item.onclick = () => openPlotEntry(key, 'destructive');
      plotList.appendChild(item);
    });
  });

  // Reference rows
  const refList = document.getElementById('ref-list');
  refList.innerHTML = '';
  QUADRANTS.forEach(q => {
    ROWS.forEach(r => {
      const key = `${q}_${r}`;
      const data = currentSession.refs[key] || {};
      const done = data.saved;
      const item = document.createElement('div');
      item.className = 'plot-item';
      item.innerHTML = `
        <div style="flex:1">
          <div class="plot-item-name">${q} · ${r}</div>
          <div class="plot-item-sub">Reference row</div>
        </div>
        <div class="status-dots">
          <div class="dot${done ? ' filled-lab' : ''}"></div>
        </div>
        <span style="font-size:20px;color:#bbb">›</span>
      `;
      item.onclick = () => openRefEntry(key, q, r);
      refList.appendChild(item);
    });
  });

  // Lysimeter boxes
  const lysList = document.getElementById('lys-list');
  lysList.innerHTML = '';
  QUADRANTS.forEach(q => {
    const key = `${q}_BOX`;
    const data = currentSession.lys[key] || {};
    const done = data.saved;
    const item = document.createElement('div');
    item.className = 'plot-item lysimeter';
    item.innerHTML = `
      <div style="flex:1">
        <div class="plot-item-name">${q} Box</div>
        <div class="plot-item-sub">${currentSession.type === 'Harvest' ? 'Harvest + weekly measurements' : 'Height & leaf count only'}</div>
      </div>
      <div class="status-dots">
        <div class="dot${done ? ' filled-lab' : ''}"></div>
      </div>
      <span style="font-size:20px;color:#bbb">›</span>
    `;
    item.onclick = () => openLysEntry(key, q);
    lysList.appendChild(item);
  });

  // Wrap content in scrollable div
  const menu = document.getElementById('screen-session-menu');
  if (!menu.querySelector('.session-scroll')) {
    // Already structured in HTML
  }
}

// --- PLOT ENTRY (Field) ---
function openPlotEntry(key, type) {
  currentPlotKey = key;
  currentMode = 'field';

  const data = currentSession.plots[key] || {};
  const isLys = LYSIMETER_SPANS.includes(parseInt(key));
  const label = key.replace(/([0-9]+)([EW])([AB])/, 'Span $1$2 · $3');

  document.getElementById('field-entry-title').textContent = label;
  const badge = document.getElementById('field-entry-badge');
  badge.textContent = isLys ? 'LYSIMETER' : 'FIELD DATA';
  badge.className = `badge${isLys ? ' lysimeter' : ''}`;

  const form = document.getElementById('field-entry-form');
  form.innerHTML = `
    <div class="field-group">
      <label>Plant Count — Row 1 (1m)</label>
      <input type="number" id="f-count1" inputmode="numeric" placeholder="e.g. 8" value="${data.count1 || ''}">
    </div>
    <div class="field-group">
      <label>Plant Count — Row 2 (1m)</label>
      <input type="number" id="f-count2" inputmode="numeric" placeholder="e.g. 9" value="${data.count2 || ''}">
    </div>
    <div class="field-group">
      <label>Plants / m² (calculated)</label>
      <div class="calc-field${data.plants_m2 ? ' has-value' : ''}" id="f-plants-m2">${data.plants_m2 || '—'}</div>
    </div>

    <div class="form-section-title">PLANT HEIGHT (inches) — 5 Plants</div>
    <div class="field-group">
      <div class="plant-grid">
        ${[1,2,3,4,5].map(i => `
          <div class="plant-input-wrap">
            <span>P${i}</span>
            <input type="number" inputmode="decimal" id="f-h${i}" value="${data['h'+i] || ''}" oninput="calcAvg('f-h','f-avg-height')">
          </div>
        `).join('')}
      </div>
      <div class="avg-display" id="f-avg-height">Avg: ${data.avg_height ? data.avg_height + ' in' : '—'}</div>
    </div>

    <div class="form-section-title">LEAF COUNT — 5 Plants</div>
    <div class="field-group">
      <div class="plant-grid">
        ${[1,2,3,4,5].map(i => `
          <div class="plant-input-wrap">
            <span>P${i}</span>
            <input type="number" inputmode="numeric" id="f-l${i}" value="${data['l'+i] || ''}" oninput="calcAvg('f-l','f-avg-leaves')">
          </div>
        `).join('')}
      </div>
      <div class="avg-display" id="f-avg-leaves">Avg: ${data.avg_leaves ? data.avg_leaves + ' leaves' : '—'}</div>
    </div>

    <div class="field-group">
      <label>Notes</label>
      <textarea id="f-notes" placeholder="Flags, observations, issues...">${data.notes || ''}</textarea>
    </div>
  `;

  // Live calc for plant count
  document.getElementById('f-count1').addEventListener('input', calcPlantsM2);
  document.getElementById('f-count2').addEventListener('input', calcPlantsM2);

  showScreen('screen-field-entry');
}

function calcPlantsM2() {
  const c1 = parseFloat(document.getElementById('f-count1').value) || 0;
  const c2 = parseFloat(document.getElementById('f-count2').value) || 0;
  const el = document.getElementById('f-plants-m2');
  if (c1 > 0 || c2 > 0) {
    // 2 rows × 1m = 2m², divide total count by 2 to get per m²
    const pm2 = ((c1 + c2) / 2).toFixed(1);
    el.textContent = pm2 + ' plants/m²';
    el.classList.add('has-value');
  } else {
    el.textContent = '—';
    el.classList.remove('has-value');
  }
}

function calcAvg(prefix, displayId) {
  const vals = [1,2,3,4,5].map(i => parseFloat(document.getElementById(`${prefix}${i}`)?.value)).filter(v => !isNaN(v));
  const el = document.getElementById(displayId);
  if (vals.length === 0) { el.textContent = 'Avg: —'; return; }
  const avg = (vals.reduce((a,b) => a+b, 0) / vals.length).toFixed(1);
  const unit = displayId.includes('height') ? ' in' : ' leaves';
  el.textContent = `Avg: ${avg}${unit}`;
}

function saveFieldEntry() {
  const c1 = parseFloat(document.getElementById('f-count1').value) || null;
  const c2 = parseFloat(document.getElementById('f-count2').value) || null;

  const heights = [1,2,3,4,5].map(i => parseFloat(document.getElementById(`f-h${i}`)?.value) || null);
  const leaves = [1,2,3,4,5].map(i => parseFloat(document.getElementById(`f-l${i}`)?.value) || null);

  const validH = heights.filter(v => v !== null);
  const validL = leaves.filter(v => v !== null);
  const avgH = validH.length ? (validH.reduce((a,b)=>a+b,0)/validH.length) : null;
  const avgL = validL.length ? (validL.reduce((a,b)=>a+b,0)/validL.length) : null;

  const pm2 = (c1 !== null && c2 !== null) ? ((c1 + c2) / 2) : null;

  if (!currentSession.plots[currentPlotKey]) currentSession.plots[currentPlotKey] = {};
  Object.assign(currentSession.plots[currentPlotKey], {
    count1: c1, count2: c2, plants_m2: pm2 ? pm2.toFixed(1) : null,
    h1: heights[0], h2: heights[1], h3: heights[2], h4: heights[3], h5: heights[4],
    avg_height: avgH ? avgH.toFixed(1) : null,
    l1: leaves[0], l2: leaves[1], l3: leaves[2], l4: leaves[3], l5: leaves[4],
    avg_leaves: avgL ? avgL.toFixed(1) : null,
    notes: document.getElementById('f-notes').value,
    field_saved: true
  });

  saveCurrentSession();
  showToast('Field data saved ✓');

  // Ask if they want to go to lab entry or back
  setTimeout(() => {
    backToSessionMenu();
  }, 800);
}

// --- LAB ENTRY ---
function openLabEntry(key) {
  currentPlotKey = key;
  currentMode = 'lab';

  const data = currentSession.plots[key] || {};
  const label = key.replace(/([0-9]+)([EW])([AB])/, 'Span $1$2 · $3');

  document.getElementById('lab-entry-title').textContent = `${label} — Lab`;

  const form = document.getElementById('lab-entry-form');
  form.innerHTML = `
    <div class="field-group">
      <label>Leaf Area (cm²)</label>
      <input type="number" inputmode="decimal" id="lab-leaf-area" value="${data.leaf_area || ''}" oninput="calcLAI()">
    </div>
    <div class="field-group">
      <label>Bag Weight (g)</label>
      <input type="number" inputmode="decimal" id="lab-bag-weight" value="${data.bag_weight || ''}">
    </div>

    <div class="form-section-title">WET WEIGHTS</div>
    <div class="field-group">
      <label>Leaf Wet Weight (g)</label>
      <input type="number" inputmode="decimal" id="lab-leaf-wet" value="${data.leaf_wet || ''}">
    </div>
    <div class="field-group">
      <label>Stem Wet Weight (g)</label>
      <input type="number" inputmode="decimal" id="lab-stem-wet" value="${data.stem_wet || ''}">
    </div>

    <div class="form-section-title">DRY WEIGHTS</div>
    <div class="field-group">
      <label>Leaf Dry Weight (g)</label>
      <input type="number" inputmode="decimal" id="lab-leaf-dry" value="${data.leaf_dry || ''}">
    </div>
    <div class="field-group">
      <label>Stem Dry Weight (g)</label>
      <input type="number" inputmode="decimal" id="lab-stem-dry" value="${data.stem_dry || ''}">
    </div>

    <div class="form-section-title">CALCULATED</div>
    <div class="field-group">
      <label>LAI (auto-calculated)</label>
      <div class="calc-field${data.lai ? ' has-value' : ''}" id="lab-lai">${data.lai ? data.lai.toFixed(4) : '—'}</div>
    </div>
    <div class="field-group">
      <label>Above Ground Dry Matter (g/m²)</label>
      <div class="calc-field${data.agdm ? ' has-value' : ''}" id="lab-agdm">${data.agdm ? data.agdm.toFixed(2) : '—'}</div>
    </div>

    <div class="field-group">
      <label>Lab Notes</label>
      <textarea id="lab-notes" placeholder="Any issues with this sample...">${data.lab_notes || ''}</textarea>
    </div>
  `;

  document.getElementById('lab-leaf-area').addEventListener('input', calcLAI);
  document.getElementById('lab-leaf-dry').addEventListener('input', calcLAI);
  document.getElementById('lab-stem-dry').addEventListener('input', calcLAI);

  showScreen('screen-lab-entry');
}

function calcLAI() {
  // LAI = Leaf Area (cm²) / (Plot size m² × 10000)
  // Plot size = 1 m², so LAI = leaf_area / 15239.96 (scanner area constant from original data)
  // Actually from data: LAI = leaf_area / 15239.96... let's use standard: leaf_area_cm2 / (plot_m2 * 10000)
  // Plot size is 1 m² = 10000 cm², so LAI = leaf_area / 10000
  // But looking at the data, they use 15239.96 as denominator (likely the actual scanner bed area)
  // We'll use the standard plot-based LAI: leaf_area / 10000
  const la = parseFloat(document.getElementById('lab-leaf-area')?.value);
  const leafDry = parseFloat(document.getElementById('lab-leaf-dry')?.value);
  const stemDry = parseFloat(document.getElementById('lab-stem-dry')?.value);

  const laiEl = document.getElementById('lab-lai');
  const agdmEl = document.getElementById('lab-agdm');

  if (!isNaN(la)) {
    const lai = la / 10000;
    laiEl.textContent = lai.toFixed(4);
    laiEl.classList.add('has-value');
  } else {
    laiEl.textContent = '—';
    laiEl.classList.remove('has-value');
  }

  if (!isNaN(leafDry) && !isNaN(stemDry)) {
    const agdm = leafDry + stemDry;
    agdmEl.textContent = agdm.toFixed(2) + ' g/m²';
    agdmEl.classList.add('has-value');
  } else {
    agdmEl.textContent = '—';
    agdmEl.classList.remove('has-value');
  }
}

function saveLabEntry() {
  const la = parseFloat(document.getElementById('lab-leaf-area').value) || null;
  const leafDry = parseFloat(document.getElementById('lab-leaf-dry').value) || null;
  const stemDry = parseFloat(document.getElementById('lab-stem-dry').value) || null;
  const lai = la ? la / 10000 : null;
  const agdm = (leafDry && stemDry) ? leafDry + stemDry : null;

  if (!currentSession.plots[currentPlotKey]) currentSession.plots[currentPlotKey] = {};
  Object.assign(currentSession.plots[currentPlotKey], {
    leaf_area: la,
    bag_weight: parseFloat(document.getElementById('lab-bag-weight').value) || null,
    leaf_wet: parseFloat(document.getElementById('lab-leaf-wet').value) || null,
    stem_wet: parseFloat(document.getElementById('lab-stem-wet').value) || null,
    leaf_dry: leafDry,
    stem_dry: stemDry,
    lai,
    agdm,
    lab_notes: document.getElementById('lab-notes').value,
    lab_saved: true
  });

  saveCurrentSession();
  showToast('Lab data saved ✓');
  setTimeout(() => backToSessionMenu(), 800);
}

// --- OPEN PLOT (decides field vs lab) ---
function openPlotEntry(key, type) {
  currentPlotKey = key;
  const data = currentSession.plots[key] || {};
  const isLys = LYSIMETER_SPANS.includes(parseInt(key));
  const label = key.replace(/([0-9]+)([EW])([AB])/, 'Span $1$2 · $3');

  document.getElementById('field-entry-title').textContent = label;
  const badge = document.getElementById('field-entry-badge');
  badge.textContent = isLys ? 'LYSIMETER' : 'FIELD DATA';
  badge.className = `badge${isLys ? ' lysimeter' : ''}`;

  // Reset GPS for this plot, restore if previously saved
  currentPlotGPS = { lat: data.gps_lat || null, lng: data.gps_lng || null };

  // Build combined field + lab form with tabs
  const form = document.getElementById('field-entry-form');
  form.innerHTML = `
    <div style="display:flex;gap:8px;margin-bottom:4px;">
      <button class="toggle-btn active" id="tab-field" onclick="switchTab('field')">Field</button>
      <button class="toggle-btn" id="tab-lab" onclick="switchTab('lab')">Lab</button>
    </div>

    <div id="tab-content-field">
      <div class="field-group">
        <label>GPS Location</label>
        <div class="gps-row">
          <span id="plot-gps-display" class="gps-value${data.gps_lat ? ' captured' : ''}">${data.gps_lat ? `${data.gps_lat}, ${data.gps_lng}` : 'Not captured'}</span>
          <button class="btn-gps" onclick="captureGPS()">📍 Capture</button>
        </div>
      </div>
      <div class="field-group">
        <label>Plant Count — Row 1 (1m)</label>
        <input type="number" id="f-count1" inputmode="numeric" placeholder="e.g. 8" value="${data.count1 || ''}">
      </div>
      <div class="field-group">
        <label>Plant Count — Row 2 (1m)</label>
        <input type="number" id="f-count2" inputmode="numeric" placeholder="e.g. 9" value="${data.count2 || ''}">
      </div>
      <div class="field-group">
        <label>Plants / m² (calculated)</label>
        <div class="calc-field${data.plants_m2 ? ' has-value' : ''}" id="f-plants-m2">${data.plants_m2 || '—'}</div>
      </div>

      <div class="form-section-title">PLANT HEIGHT (inches) — 5 Plants</div>
      <div class="field-group">
        <div class="plant-grid">
          ${[1,2,3,4,5].map(i => `
            <div class="plant-input-wrap">
              <span>P${i}</span>
              <input type="number" inputmode="decimal" id="f-h${i}" value="${data['h'+i] || ''}" 
                oninput="calcAvg('f-h','f-avg-height')"
                onchange="autoAdvance(this, '${i < 5 ? 'f-h'+(i+1) : 'f-l1'}')">
            </div>
          `).join('')}
        </div>
        <div class="avg-display" id="f-avg-height">Avg: ${data.avg_height ? data.avg_height + ' in' : '—'}</div>
      </div>

      <div class="form-section-title">LEAF COUNT — 5 Plants</div>
      <div class="field-group">
        <div class="plant-grid">
          ${[1,2,3,4,5].map(i => `
            <div class="plant-input-wrap">
              <span>P${i}</span>
              <input type="number" inputmode="numeric" id="f-l${i}" value="${data['l'+i] || ''}" 
                oninput="calcAvg('f-l','f-avg-leaves')"
                onchange="autoAdvance(this, '${i < 5 ? 'f-l'+(i+1) : 'f-notes'}')">
            </div>
          `).join('')}
        </div>
        <div class="avg-display" id="f-avg-leaves">Avg: ${data.avg_leaves ? data.avg_leaves + ' leaves' : '—'}</div>
      </div>

      <div class="field-group">
        <label>Notes</label>
        <textarea id="f-notes" placeholder="Flags, observations, issues...">${data.notes || ''}</textarea>
      </div>
    </div>

    <div id="tab-content-lab" style="display:none">
      <div class="field-group">
        <label>Leaf Area (cm²)</label>
        <input type="number" inputmode="decimal" id="lab-leaf-area" value="${data.leaf_area || ''}" oninput="calcLAI()">
      </div>
      <div class="field-group">
        <label>Bag Weight (g)</label>
        <input type="number" inputmode="decimal" id="lab-bag-weight" value="${data.bag_weight || ''}">
      </div>
      <div class="form-section-title">WET WEIGHTS</div>
      <div class="field-group">
        <label>Leaf Wet Weight (g)</label>
        <input type="number" inputmode="decimal" id="lab-leaf-wet" value="${data.leaf_wet || ''}">
      </div>
      <div class="field-group">
        <label>Stem Wet Weight (g)</label>
        <input type="number" inputmode="decimal" id="lab-stem-wet" value="${data.stem_wet || ''}">
      </div>
      <div class="form-section-title">DRY WEIGHTS</div>
      <div class="field-group">
        <label>Leaf Dry Weight (g)</label>
        <input type="number" inputmode="decimal" id="lab-leaf-dry" value="${data.leaf_dry || ''}" oninput="calcLAI()">
      </div>
      <div class="field-group">
        <label>Stem Dry Weight (g)</label>
        <input type="number" inputmode="decimal" id="lab-stem-dry" value="${data.stem_dry || ''}" oninput="calcLAI()">
      </div>
      <div class="form-section-title">CALCULATED</div>
      <div class="field-group">
        <label>LAI (auto-calculated)</label>
        <div class="calc-field${data.lai ? ' has-value' : ''}" id="lab-lai">${data.lai ? parseFloat(data.lai).toFixed(4) : '—'}</div>
      </div>
      <div class="field-group">
        <label>Above Ground Dry Matter (g/m²)</label>
        <div class="calc-field${data.agdm ? ' has-value' : ''}" id="lab-agdm">${data.agdm ? parseFloat(data.agdm).toFixed(2) + ' g/m²' : '—'}</div>
      </div>
      <div class="field-group">
        <label>Lab Notes</label>
        <textarea id="lab-notes" placeholder="Any issues with this sample...">${data.lab_notes || ''}</textarea>
      </div>
    </div>
  `;

  document.getElementById('f-count1').addEventListener('input', calcPlantsM2);
  document.getElementById('f-count2').addEventListener('input', calcPlantsM2);

  showScreen('screen-field-entry');
}

function switchTab(tab) {
  document.getElementById('tab-content-field').style.display = tab === 'field' ? 'flex' : 'none';
  document.getElementById('tab-content-field').style.flexDirection = 'column';
  document.getElementById('tab-content-field').style.gap = '14px';
  document.getElementById('tab-content-lab').style.display = tab === 'lab' ? 'flex' : 'none';
  document.getElementById('tab-content-lab').style.flexDirection = 'column';
  document.getElementById('tab-content-lab').style.gap = '14px';
  document.getElementById('tab-field').classList.toggle('active', tab === 'field');
  document.getElementById('tab-lab').classList.toggle('active', tab === 'lab');
  currentMode = tab;
}

function saveFieldEntry() {
  const c1 = parseFloat(document.getElementById('f-count1')?.value) || null;
  const c2 = parseFloat(document.getElementById('f-count2')?.value) || null;
  const heights = [1,2,3,4,5].map(i => parseFloat(document.getElementById(`f-h${i}`)?.value) || null);
  const leaves = [1,2,3,4,5].map(i => parseFloat(document.getElementById(`f-l${i}`)?.value) || null);
  const validH = heights.filter(v => v !== null);
  const validL = leaves.filter(v => v !== null);
  const avgH = validH.length ? (validH.reduce((a,b)=>a+b,0)/validH.length) : null;
  const avgL = validL.length ? (validL.reduce((a,b)=>a+b,0)/validL.length) : null;
  const pm2 = (c1 !== null && c2 !== null) ? ((c1 + c2) / 2) : null;

  // Lab
  const la = parseFloat(document.getElementById('lab-leaf-area')?.value) || null;
  const leafDry = parseFloat(document.getElementById('lab-leaf-dry')?.value) || null;
  const stemDry = parseFloat(document.getElementById('lab-stem-dry')?.value) || null;
  const lai = la ? la / 10000 : null;
  const agdm = (leafDry && stemDry) ? leafDry + stemDry : null;

  if (!currentSession.plots[currentPlotKey]) currentSession.plots[currentPlotKey] = {};
  Object.assign(currentSession.plots[currentPlotKey], {
    count1: c1, count2: c2, plants_m2: pm2 ? pm2.toFixed(1) : null,
    gps_lat, gps_lng,
    h1: heights[0], h2: heights[1], h3: heights[2], h4: heights[3], h5: heights[4],
    avg_height: avgH ? avgH.toFixed(1) : null,
    l1: leaves[0], l2: leaves[1], l3: leaves[2], l4: leaves[3], l5: leaves[4],
    avg_leaves: avgL ? avgL.toFixed(1) : null,
    notes: document.getElementById('f-notes')?.value || '',
    field_saved: validH.length > 0 || c1 !== null,
    leaf_area: la,
    bag_weight: parseFloat(document.getElementById('lab-bag-weight')?.value) || null,
    leaf_wet: parseFloat(document.getElementById('lab-leaf-wet')?.value) || null,
    stem_wet: parseFloat(document.getElementById('lab-stem-wet')?.value) || null,
    leaf_dry: leafDry,
    stem_dry: stemDry,
    lai,
    agdm,
    lab_notes: document.getElementById('lab-notes')?.value || '',
    lab_saved: la !== null || leafDry !== null
  });

  saveCurrentSession();
  showToast('Saved ✓');
  setTimeout(() => backToSessionMenu(), 800);
}

// --- REFERENCE ROW ENTRY ---
function openRefEntry(key, quadrant, row) {
  currentPlotKey = key;
  currentMode = 'ref';

  const data = currentSession.refs[key] || {};
  document.getElementById('field-entry-title').textContent = `${quadrant} · ${row}`;
  document.getElementById('field-entry-badge').textContent = 'REF ROW';
  document.getElementById('field-entry-badge').className = 'badge';

  const form = document.getElementById('field-entry-form');
  form.innerHTML = `
    <div class="form-section-title">PLANT HEIGHT (inches) — 5 Plants</div>
    <div class="field-group">
      <div class="plant-grid">
        ${[1,2,3,4,5].map(i => `
          <div class="plant-input-wrap">
            <span>P${i}</span>
            <input type="number" inputmode="decimal" id="f-h${i}" value="${data['h'+i] || ''}" oninput="calcAvg('f-h','f-avg-height')">
          </div>
        `).join('')}
      </div>
      <div class="avg-display" id="f-avg-height">Avg: ${data.avg_height ? data.avg_height + ' in' : '—'}</div>
    </div>

    <div class="form-section-title">LEAF COUNT — 5 Plants</div>
    <div class="field-group">
      <div class="plant-grid">
        ${[1,2,3,4,5].map(i => `
          <div class="plant-input-wrap">
            <span>P${i}</span>
            <input type="number" inputmode="numeric" id="f-l${i}" value="${data['l'+i] || ''}" oninput="calcAvg('f-l','f-avg-leaves')">
          </div>
        `).join('')}
      </div>
      <div class="avg-display" id="f-avg-leaves">Avg: ${data.avg_leaves ? data.avg_leaves + ' leaves' : '—'}</div>
    </div>

    <div class="field-group">
      <label>Notes / Flag</label>
      <textarea id="f-notes" placeholder="e.g. flag, bugs, shooting head...">${data.notes || ''}</textarea>
    </div>
  `;

  showScreen('screen-field-entry');
}

// Override saveFieldEntry for ref mode
const _origSave = saveFieldEntry;
// We handle via currentMode check inside saveFieldEntry

function saveFieldEntry() {
  if (currentMode === 'ref') {
    saveRefEntry();
    return;
  }
  if (currentMode === 'lys') {
    saveLysEntry();
    return;
  }

  // GPS per plot
  const gps_lat = currentPlotGPS.lat;
  const gps_lng = currentPlotGPS.lng;
  showToast("GPS: " + gps_lat + ", " + gps_lng);

  // Destructive plot save
  const c1 = parseFloat(document.getElementById('f-count1')?.value) || null;
  const c2 = parseFloat(document.getElementById('f-count2')?.value) || null;
  const heights = [1,2,3,4,5].map(i => parseFloat(document.getElementById(`f-h${i}`)?.value) || null);
  const leaves = [1,2,3,4,5].map(i => parseFloat(document.getElementById(`f-l${i}`)?.value) || null);
  const validH = heights.filter(v => v !== null);
  const validL = leaves.filter(v => v !== null);
  const avgH = validH.length ? (validH.reduce((a,b)=>a+b,0)/validH.length) : null;
  const avgL = validL.length ? (validL.reduce((a,b)=>a+b,0)/validL.length) : null;
  const pm2 = (c1 !== null && c2 !== null) ? ((c1 + c2) / 2) : null;

  const la = parseFloat(document.getElementById('lab-leaf-area')?.value) || null;
  const leafDry = parseFloat(document.getElementById('lab-leaf-dry')?.value) || null;
  const stemDry = parseFloat(document.getElementById('lab-stem-dry')?.value) || null;
  const lai = la ? la / 10000 : null;
  const agdm = (leafDry && stemDry) ? leafDry + stemDry : null;

  if (!currentSession.plots[currentPlotKey]) currentSession.plots[currentPlotKey] = {};
  Object.assign(currentSession.plots[currentPlotKey], {
    count1: c1, count2: c2, plants_m2: pm2 ? pm2.toFixed(1) : null,
    h1: heights[0], h2: heights[1], h3: heights[2], h4: heights[3], h5: heights[4],
    avg_height: avgH ? avgH.toFixed(1) : null,
    l1: leaves[0], l2: leaves[1], l3: leaves[2], l4: leaves[3], l5: leaves[4],
    avg_leaves: avgL ? avgL.toFixed(1) : null,
    notes: document.getElementById('f-notes')?.value || '',
    field_saved: validH.length > 0 || c1 !== null,
    leaf_area: la,
    bag_weight: parseFloat(document.getElementById('lab-bag-weight')?.value) || null,
    leaf_wet: parseFloat(document.getElementById('lab-leaf-wet')?.value) || null,
    stem_wet: parseFloat(document.getElementById('lab-stem-wet')?.value) || null,
    leaf_dry: leafDry,
    stem_dry: stemDry,
    lai,
    agdm,
    lab_notes: document.getElementById('lab-notes')?.value || '',
    lab_saved: la !== null || leafDry !== null
  });

  saveCurrentSession();
  showToast('Saved ✓');
  setTimeout(() => backToSessionMenu(), 800);
}

function saveRefEntry() {
  const heights = [1,2,3,4,5].map(i => parseFloat(document.getElementById(`f-h${i}`)?.value) || null);
  const leaves = [1,2,3,4,5].map(i => parseFloat(document.getElementById(`f-l${i}`)?.value) || null);
  const validH = heights.filter(v => v !== null);
  const validL = leaves.filter(v => v !== null);
  const avgH = validH.length ? (validH.reduce((a,b)=>a+b,0)/validH.length) : null;
  const avgL = validL.length ? (validL.reduce((a,b)=>a+b,0)/validL.length) : null;

  if (!currentSession.refs[currentPlotKey]) currentSession.refs[currentPlotKey] = {};
  Object.assign(currentSession.refs[currentPlotKey], {
    h1: heights[0], h2: heights[1], h3: heights[2], h4: heights[3], h5: heights[4],
    avg_height: avgH ? avgH.toFixed(1) : null,
    l1: leaves[0], l2: leaves[1], l3: leaves[2], l4: leaves[3], l5: leaves[4],
    avg_leaves: avgL ? avgL.toFixed(1) : null,
    notes: document.getElementById('f-notes')?.value || '',
    saved: true
  });

  saveCurrentSession();
  showToast('Saved ✓');
  setTimeout(() => backToSessionMenu(), 800);
}

// --- LYSIMETER ENTRY ---
function openLysEntry(key, quadrant) {
  currentPlotKey = key;
  currentMode = 'lys';

  const data = currentSession.lys[key] || {};
  document.getElementById('field-entry-title').textContent = `${quadrant} Box`;
  document.getElementById('field-entry-badge').textContent = 'LYSIMETER';
  document.getElementById('field-entry-badge').className = 'badge lysimeter';

  const isHarvest = currentSession.type === 'Harvest';

  const form = document.getElementById('field-entry-form');
  form.innerHTML = `
    <div class="form-section-title">PLANT HEIGHT (inches) — 5 Plants</div>
    <div class="field-group">
      <div class="plant-grid">
        ${[1,2,3,4,5].map(i => `
          <div class="plant-input-wrap">
            <span>P${i}</span>
            <input type="number" inputmode="decimal" id="f-h${i}" value="${data['h'+i] || ''}" oninput="calcAvg('f-h','f-avg-height')">
          </div>
        `).join('')}
      </div>
      <div class="avg-display" id="f-avg-height">Avg: ${data.avg_height ? data.avg_height + ' in' : '—'}</div>
    </div>

    <div class="form-section-title">LEAF COUNT — 5 Plants</div>
    <div class="field-group">
      <div class="plant-grid">
        ${[1,2,3,4,5].map(i => `
          <div class="plant-input-wrap">
            <span>P${i}</span>
            <input type="number" inputmode="numeric" id="f-l${i}" value="${data['l'+i] || ''}" oninput="calcAvg('f-l','f-avg-leaves')">
          </div>
        `).join('')}
      </div>
      <div class="avg-display" id="f-avg-leaves">Avg: ${data.avg_leaves ? data.avg_leaves + ' leaves' : '—'}</div>
    </div>

    ${isHarvest ? `
      <div class="form-section-title">HARVEST DATA</div>
      <div class="field-group">
        <label>Nutrient Sample Weight (g)</label>
        <input type="number" inputmode="decimal" id="lys-nutrient" value="${data.nutrient_wt || ''}">
      </div>
      <div class="field-group">
        <label>Biomass Wet Weight (lbs)</label>
        <input type="number" inputmode="decimal" id="lys-biomass-wet" value="${data.biomass_wet || ''}">
      </div>
      <div class="field-group">
        <label>Biomass Sub Wet Weight (g)</label>
        <input type="number" inputmode="decimal" id="lys-sub-wet" value="${data.sub_wet || ''}">
      </div>
      <div class="field-group">
        <label>Biomass Sub Dry Weight (g)</label>
        <input type="number" inputmode="decimal" id="lys-sub-dry" value="${data.sub_dry || ''}">
      </div>
    ` : ''}

    <div class="field-group">
      <label>Notes</label>
      <textarea id="f-notes" placeholder="Observations...">${data.notes || ''}</textarea>
    </div>
  `;

  showScreen('screen-field-entry');
}

function saveLysEntry() {
  const heights = [1,2,3,4,5].map(i => parseFloat(document.getElementById(`f-h${i}`)?.value) || null);
  const leaves = [1,2,3,4,5].map(i => parseFloat(document.getElementById(`f-l${i}`)?.value) || null);
  const validH = heights.filter(v => v !== null);
  const validL = leaves.filter(v => v !== null);
  const avgH = validH.length ? (validH.reduce((a,b)=>a+b,0)/validH.length) : null;
  const avgL = validL.length ? (validL.reduce((a,b)=>a+b,0)/validL.length) : null;

  if (!currentSession.lys[currentPlotKey]) currentSession.lys[currentPlotKey] = {};
  Object.assign(currentSession.lys[currentPlotKey], {
    h1: heights[0], h2: heights[1], h3: heights[2], h4: heights[3], h5: heights[4],
    avg_height: avgH ? avgH.toFixed(1) : null,
    l1: leaves[0], l2: leaves[1], l3: leaves[2], l4: leaves[3], l5: leaves[4],
    avg_leaves: avgL ? avgL.toFixed(1) : null,
    nutrient_wt: parseFloat(document.getElementById('lys-nutrient')?.value) || null,
    biomass_wet: parseFloat(document.getElementById('lys-biomass-wet')?.value) || null,
    sub_wet: parseFloat(document.getElementById('lys-sub-wet')?.value) || null,
    sub_dry: parseFloat(document.getElementById('lys-sub-dry')?.value) || null,
    notes: document.getElementById('f-notes')?.value || '',
    saved: true
  });

  saveCurrentSession();
  showToast('Saved ✓');
  setTimeout(() => backToSessionMenu(), 800);
}

// --- SESSIONS LIST ---
function renderSessionsList() {
  const sessions = getSessions();
  const list = document.getElementById('sessions-list');
  const all = Object.values(sessions).sort((a,b) => b.id - a.id);
  if (all.length === 0) {
    list.innerHTML = '<p style="color:#999;text-align:center;padding:40px;">No sessions yet</p>';
    return;
  }
  list.innerHTML = all.map(s => `
    <div class="session-card">
      <div class="session-card-info" onclick="openSession('${s.id}')" style="flex:1">
        <h3>${s.date} · ${s.side}</h3>
        <p>${s.crop} · ${s.year} · ${s.type}</p>
      </div>
      <button class="btn-delete" onclick="deleteSession('${s.id}')">🗑</button>
    </div>
  `).join('');
}

function deleteSession(id) {
  if (!confirm('Delete this session? This cannot be undone.')) return;
  const sessions = getSessions();
  delete sessions[id];
  saveSessionsData(sessions);
  renderSessionsList();
  showToast('Session deleted');
}

function openSession(id) {
  const sessions = getSessions();
  currentSession = sessions[id];
  selectedSide = currentSession.side;
  selectedSessionType = currentSession.type;
  showScreen('screen-session-menu');
  renderSessionMenu();
}

// --- EXPORT ---
function exportSession() {
  if (!currentSession) return;
  showToast('Preparing export...');

  // Build CSV
  const rows = [];
  const header = ['Date','Year','DOY','Plot Name','Growth Stage/#Leaves','Plot Size m2',
    '# Plants/m2','Plant Height in','Plant Height m','Leaf Area cm2',
    'Leaf Wet Weight g','Stem Wet Weight g','Leaf Dry Weight g','Stem Dry Weight g',
    'LAI','Above Ground Dry Matter g/m2','GPS Lat','GPS Lng','Notes'];
  rows.push(header.join(','));

  const date = currentSession.date;
  const year = currentSession.year;
  const doy = getDOY(date);
  const gpsLat = currentSession.gps?.lat || '';
  const gpsLng = currentSession.gps?.lng || '';  // Destructive plots
  SPANS.forEach(span => {
    ['A','B'].forEach(ab => {
      const key = `${span}${currentSession.side.charAt(0)}${ab}`;
      const d = currentSession.plots[key] || {};
      const heightM = d.avg_height ? (parseFloat(d.avg_height) * 0.0254).toFixed(4) : '';
      rows.push([
        date, year, doy, key,
        d.avg_leaves || '', 1,
        d.plants_m2 || '',
        d.avg_height || '', heightM,
        d.leaf_area || '',
        d.leaf_wet || '', d.stem_wet || '',
        d.leaf_dry || '', d.stem_dry || '',
        d.lai ? parseFloat(d.lai).toFixed(6) : '',
        d.agdm ? parseFloat(d.agdm).toFixed(2) : '',
        d.gps_lat || '', d.gps_lng || '',
        `"${(d.notes || '') + (d.lab_notes ? ' | ' + d.lab_notes : '')}"`
      ].join(','));
    });
  });

  // Reference rows
  QUADRANTS.forEach(q => {
    ROWS.forEach(r => {
      const key = `${q}_${r}`;
      const d = currentSession.refs[key] || {};
      const heightM = d.avg_height ? (parseFloat(d.avg_height) * 0.0254).toFixed(4) : '';
      rows.push([
        date, year, doy, `${q} ${r}\``,
        d.avg_leaves || '', 1, '',
        d.avg_height || '', heightM,
        '','','','','','','',
        gpsLat, gpsLng,
        `"${d.notes || ''}"`
      ].join(','));
    });
  });

  // Lysimeter boxes
  QUADRANTS.forEach(q => {
    const key = `${q}_BOX`;
    const d = currentSession.lys[key] || {};
    const heightM = d.avg_height ? (parseFloat(d.avg_height) * 0.0254).toFixed(4) : '';
    rows.push([
      date, year, doy, `${q} BOX`,
      d.avg_leaves || '', '', '',
      d.avg_height || '', heightM,
      '','','','','','','',
      gpsLat, gpsLng,
      `"${d.notes || ''}"`
    ].join(','));
  });

  const csv = rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `field_data_${currentSession.side}_${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Export ready! Check your downloads.');
}

function getDOY(dateStr) {
  const d = new Date(dateStr);
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d - start) / 86400000);
}

// --- TOAST ---
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}

// --- INIT ---
window.addEventListener('load', () => {
  renderHome();
  // Set today's date on the session form
  const today = new Date().toISOString().split('T')[0];
  const dateEl = document.getElementById('session-date');
  if (dateEl) dateEl.value = today;
});

// Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(() => {
    console.log('Service Worker registered');
  }).catch(err => {
    console.log('SW registration failed:', err);
  });
}

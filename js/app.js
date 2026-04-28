// ============================================
// FIELD SAMPLER PWA - App Logic (Clean)
// ============================================

// --- CONFIG ---
const SPANS = [2, 3, 4, 7, 8, 9];
const LYSIMETER_SPANS = [3, 8];
const QUADRANTS = ['NE', 'NW', 'SE', 'SW'];
const ROWS = ['R1', 'R2', 'R3', 'R4'];

// --- STATE ---
let currentSession = null;
let currentPlotKey = null;
let currentMode = null; // 'destructive' | 'ref' | 'lys'
let selectedSide = 'East';
let selectedSessionType = 'Weekly';
let currentPlotGPS = { lat: null, lng: null };

// --- STORAGE ---
function getSessions() {
  try { return JSON.parse(localStorage.getItem('fs_sessions') || '{}'); }
  catch { return {}; }
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

// --- NAVIGATION ---
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
  el.innerHTML = '<div style="color:rgba(255,255,255,0.7);font-size:12px;font-weight:700;letter-spacing:0.5px;margin-bottom:8px;">RECENT</div>' +
    recent.map(s =>
      '<div class="session-card" style="margin-bottom:8px;" onclick="openSession(\'' + s.id + '\')">' +
      '<div class="session-card-info"><h3>' + s.date + ' · ' + s.side + '</h3><p>' + s.crop + ' · ' + s.type + '</p></div>' +
      '<span class="session-card-arrow">›</span></div>'
    ).join('');
}

// --- NEW SESSION ---
function initNewSessionForm() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('session-date').value = today;
  selectedSide = 'East';
  selectedSessionType = 'Weekly';
  document.getElementById('side-east').classList.add('active');
  document.getElementById('side-west').classList.remove('active');
  document.getElementById('type-weekly').classList.add('active');
  document.getElementById('type-harvest').classList.remove('active');
}

function selectSide(side) {
  selectedSide = side;
  document.getElementById('side-east').classList.toggle('active', side === 'East');
  document.getElementById('side-west').classList.toggle('active', side === 'West');
}

function selectSessionType(type) {
  selectedSessionType = type;
  document.getElementById('type-weekly').classList.toggle('active', type === 'Weekly');
  document.getElementById('type-harvest').classList.toggle('active', type === 'Harvest');
}

function startSession() {
  const date = document.getElementById('session-date').value;
  const crop = document.getElementById('session-crop').value;
  const year = document.getElementById('session-year').value;
  const tech = document.getElementById('session-tech').value;
  if (!date) { showToast('Please enter a date'); return; }
  currentSession = {
    id: Date.now().toString(),
    date, crop, year,
    side: selectedSide,
    type: selectedSessionType,
    tech,
    plots: {}, refs: {}, lys: {}
  };
  saveCurrentSession();
  showScreen('screen-session-menu');
  renderSessionMenu();
}

// --- GPS ---
function captureGPS() {
  const el = document.getElementById('plot-gps-display');
  if (!el) return;
  el.textContent = 'Capturing...';
  if (!navigator.geolocation) { el.textContent = 'GPS not available'; return; }
  navigator.geolocation.getCurrentPosition(
    function(pos) {
      const lat = pos.coords.latitude.toFixed(6);
      const lng = pos.coords.longitude.toFixed(6);
      el.textContent = lat + ', ' + lng;
      el.classList.add('captured');
      currentPlotGPS = { lat: lat, lng: lng };
    },
    function() {
      el.textContent = 'GPS error - try again';
      showToast('Could not get GPS. Check location permissions.');
    },
    { enableHighAccuracy: true, timeout: 15000 }
  );
}

// --- AUTO ADVANCE ---
function autoAdvance(input, nextId) {
  if (input.value.length > 0) {
    const next = document.getElementById(nextId);
    if (next) { next.focus(); next.select(); }
  }
}

// --- CALCULATIONS ---
function calcPlantsM2() {
  const c1 = parseFloat(document.getElementById('f-count1').value) || 0;
  const c2 = parseFloat(document.getElementById('f-count2').value) || 0;
  const el = document.getElementById('f-plants-m2');
  if (c1 > 0 || c2 > 0) {
    el.textContent = ((c1 + c2) / 2).toFixed(1) + ' plants/m\u00b2';
    el.classList.add('has-value');
  } else {
    el.textContent = '\u2014';
    el.classList.remove('has-value');
  }
}

function calcAvg(prefix, displayId) {
  const vals = [1,2,3,4,5].map(function(i) {
    return parseFloat(document.getElementById(prefix + i) ? document.getElementById(prefix + i).value : '');
  }).filter(function(v) { return !isNaN(v); });
  const el = document.getElementById(displayId);
  if (vals.length === 0) { el.textContent = 'Avg: \u2014'; return; }
  const avg = (vals.reduce(function(a,b){return a+b;}, 0) / vals.length).toFixed(1);
  el.textContent = 'Avg: ' + avg + (displayId.indexOf('height') >= 0 ? ' in' : ' leaves');
}

function calcLAI() {
  const la = parseFloat(document.getElementById('lab-leaf-area') ? document.getElementById('lab-leaf-area').value : '');
  const leafDry = parseFloat(document.getElementById('lab-leaf-dry') ? document.getElementById('lab-leaf-dry').value : '');
  const stemDry = parseFloat(document.getElementById('lab-stem-dry') ? document.getElementById('lab-stem-dry').value : '');
  const laiEl = document.getElementById('lab-lai');
  const agdmEl = document.getElementById('lab-agdm');
  if (!isNaN(la)) {
    laiEl.textContent = (la / 10000).toFixed(4);
    laiEl.classList.add('has-value');
  } else {
    laiEl.textContent = '\u2014';
    laiEl.classList.remove('has-value');
  }
  if (!isNaN(leafDry) && !isNaN(stemDry)) {
    agdmEl.textContent = (leafDry + stemDry).toFixed(2) + ' g/m\u00b2';
    agdmEl.classList.add('has-value');
  } else {
    agdmEl.textContent = '\u2014';
    agdmEl.classList.remove('has-value');
  }
}

// --- SESSION MENU ---
function renderSessionMenu() {
  if (!currentSession) return;
  document.getElementById('session-menu-title').textContent = currentSession.date + ' \u00b7 ' + currentSession.side;
  document.getElementById('session-info-bar').textContent =
    currentSession.crop + ' \u00b7 ' + currentSession.year + ' \u00b7 ' + currentSession.type +
    (currentSession.tech ? ' \u00b7 ' + currentSession.tech : '');

  const sideChar = currentSession.side.charAt(0);

  // Destructive plots
  const plotList = document.getElementById('plot-list');
  plotList.innerHTML = '';
  SPANS.forEach(function(span) {
    ['A','B'].forEach(function(ab) {
      const key = span + sideChar + ab;
      const data = currentSession.plots[key] || {};
      const isLys = LYSIMETER_SPANS.indexOf(span) >= 0;
      const item = document.createElement('div');
      item.className = 'plot-item' + (isLys ? ' lysimeter' : '');
      item.innerHTML =
        '<div style="flex:1">' +
        '<div class="plot-item-name">Span ' + span + sideChar + ' \u00b7 ' + ab + '</div>' +
        '<div class="plot-item-sub">' + (isLys ? '\ud83e\uddea Lysimeter span' : 'Destructive sample') + '</div>' +
        '</div>' +
        '<div class="status-dots">' +
        '<div class="dot' + (data.field_saved ? ' filled-field' : '') + '"></div>' +
        '<div class="dot' + (data.lab_saved ? ' filled-lab' : '') + '"></div>' +
        '</div>' +
        '<span style="font-size:20px;color:#bbb">\u203a</span>';
      item.onclick = (function(k) { return function() { openPlotEntry(k); }; })(key);
      plotList.appendChild(item);
    });
  });

  // Reference rows
  const refList = document.getElementById('ref-list');
  refList.innerHTML = '';
  QUADRANTS.forEach(function(q) {
    ROWS.forEach(function(r) {
      const key = q + '_' + r;
      const data = currentSession.refs[key] || {};
      const item = document.createElement('div');
      item.className = 'plot-item';
      item.innerHTML =
        '<div style="flex:1">' +
        '<div class="plot-item-name">' + q + ' \u00b7 ' + r + '</div>' +
        '<div class="plot-item-sub">Reference row</div>' +
        '</div>' +
        '<div class="status-dots"><div class="dot' + (data.saved ? ' filled-lab' : '') + '"></div></div>' +
        '<span style="font-size:20px;color:#bbb">\u203a</span>';
      item.onclick = (function(k,qq,rr) { return function() { openRefEntry(k,qq,rr); }; })(key,q,r);
      refList.appendChild(item);
    });
  });

  // Lysimeter boxes
  const lysList = document.getElementById('lys-list');
  lysList.innerHTML = '';
  QUADRANTS.forEach(function(q) {
    const key = q + '_BOX';
    const data = currentSession.lys[key] || {};
    const item = document.createElement('div');
    item.className = 'plot-item lysimeter';
    item.innerHTML =
      '<div style="flex:1">' +
      '<div class="plot-item-name">' + q + ' Box</div>' +
      '<div class="plot-item-sub">' + (currentSession.type === 'Harvest' ? 'Harvest + weekly' : 'Height & leaf count only') + '</div>' +
      '</div>' +
      '<div class="status-dots"><div class="dot' + (data.saved ? ' filled-lab' : '') + '"></div></div>' +
      '<span style="font-size:20px;color:#bbb">\u203a</span>';
    item.onclick = (function(k,qq) { return function() { openLysEntry(k,qq); }; })(key,q);
    lysList.appendChild(item);
  });
}

// --- DESTRUCTIVE PLOT ENTRY ---
function openPlotEntry(key) {
  currentPlotKey = key;
  currentMode = 'destructive';
  const data = currentSession.plots[key] || {};
  const isLys = LYSIMETER_SPANS.indexOf(parseInt(key)) >= 0;
  const label = key.replace(/([0-9]+)([EW])([AB])/, 'Span $1$2 \u00b7 $3');

  document.getElementById('field-entry-title').textContent = label;
  const badge = document.getElementById('field-entry-badge');
  badge.textContent = isLys ? 'LYSIMETER' : 'FIELD DATA';
  badge.className = 'badge' + (isLys ? ' lysimeter' : '');

  currentPlotGPS = { lat: data.gps_lat || null, lng: data.gps_lng || null };
  const gpsDisplay = data.gps_lat ? (data.gps_lat + ', ' + data.gps_lng) : 'Not captured';
  const gpsClass = data.gps_lat ? ' captured' : '';

  function plantInputs(prefix, savedData, avgId, nextPrefix) {
    return [1,2,3,4,5].map(function(i) {
      const nextId = i < 5 ? (prefix + (i+1)) : (nextPrefix === 'notes' ? 'f-notes' : nextPrefix + '1');
      return '<div class="plant-input-wrap"><span>P' + i + '</span>' +
        '<input type="number" inputmode="' + (prefix === 'f-h' ? 'decimal' : 'numeric') + '" id="' + prefix + i + '" value="' + (savedData[prefix.replace('f-','') + i] || '') + '"' +
        ' oninput="calcAvg(\'' + prefix + '\',\'' + avgId + '\')"' +
        ' onchange="autoAdvance(this,\'' + nextId + '\')">' +
        '</div>';
    }).join('');
  }

  const form = document.getElementById('field-entry-form');
  form.innerHTML =
    '<div style="display:flex;gap:8px;margin-bottom:4px;">' +
    '<button class="toggle-btn active" id="tab-field" onclick="switchTab(\'field\')">Field</button>' +
    '<button class="toggle-btn" id="tab-lab" onclick="switchTab(\'lab\')">Lab</button>' +
    '</div>' +

    '<div id="tab-content-field" style="display:flex;flex-direction:column;gap:14px;">' +
    '<div class="field-group"><label>GPS Location</label>' +
    '<div class="gps-row">' +
    '<span id="plot-gps-display" class="gps-value' + gpsClass + '">' + gpsDisplay + '</span>' +
    '<button class="btn-gps" onclick="captureGPS()">\ud83d\udccd Capture</button>' +
    '</div></div>' +

    '<div class="field-group"><label>Plant Count \u2014 Row 1 (1m)</label>' +
    '<input type="number" id="f-count1" inputmode="numeric" placeholder="e.g. 8" value="' + (data.count1 || '') + '"></div>' +

    '<div class="field-group"><label>Plant Count \u2014 Row 2 (1m)</label>' +
    '<input type="number" id="f-count2" inputmode="numeric" placeholder="e.g. 9" value="' + (data.count2 || '') + '"></div>' +

    '<div class="field-group"><label>Plants / m\u00b2 (calculated)</label>' +
    '<div class="calc-field' + (data.plants_m2 ? ' has-value' : '') + '" id="f-plants-m2">' + (data.plants_m2 || '\u2014') + '</div></div>' +

    '<div class="form-section-title">PLANT HEIGHT (inches) \u2014 5 Plants</div>' +
    '<div class="field-group"><div class="plant-grid">' +
    [1,2,3,4,5].map(function(i) {
      const nextId = i < 5 ? 'f-h'+(i+1) : 'f-l1';
      return '<div class="plant-input-wrap"><span>P'+i+'</span>' +
        '<input type="number" inputmode="decimal" id="f-h'+i+'" value="'+(data['h'+i]||'')+'"' +
        ' oninput="calcAvg(\'f-h\',\'f-avg-height\')"' +
        ' onchange="autoAdvance(this,\''+nextId+'\')"></div>';
    }).join('') +
    '</div><div class="avg-display" id="f-avg-height">Avg: ' + (data.avg_height ? data.avg_height + ' in' : '\u2014') + '</div></div>' +

    '<div class="form-section-title">LEAF COUNT \u2014 5 Plants</div>' +
    '<div class="field-group"><div class="plant-grid">' +
    [1,2,3,4,5].map(function(i) {
      const nextId = i < 5 ? 'f-l'+(i+1) : 'f-notes';
      return '<div class="plant-input-wrap"><span>P'+i+'</span>' +
        '<input type="number" inputmode="numeric" id="f-l'+i+'" value="'+(data['l'+i]||'')+'"' +
        ' oninput="calcAvg(\'f-l\',\'f-avg-leaves\')"' +
        ' onchange="autoAdvance(this,\''+nextId+'\')"></div>';
    }).join('') +
    '</div><div class="avg-display" id="f-avg-leaves">Avg: ' + (data.avg_leaves ? data.avg_leaves + ' leaves' : '\u2014') + '</div></div>' +

    '<div class="field-group"><label>Notes</label>' +
    '<textarea id="f-notes" placeholder="Flags, observations, issues...">' + (data.notes || '') + '</textarea></div>' +
    '</div>' + // end tab-content-field

    '<div id="tab-content-lab" style="display:none;flex-direction:column;gap:14px;">' +
    '<div class="form-section-title">LEAF AREA METER CALIBRATION</div>' +
    '<div class="field-group"><label>Index Card Actual Area (cm\u00b2)</label>' +
    '<input type="number" inputmode="decimal" id="lab-cal-actual" value="' + (data.cal_actual || '') + '" placeholder="e.g. 90.32"></div>' +
    '<div class="field-group"><label>LA Machine Reading for Card (cm\u00b2)</label>' +
    '<input type="number" inputmode="decimal" id="lab-cal-machine" value="' + (data.cal_machine || '') + '" placeholder="e.g. 91.50"></div>' +

    '<div class="field-group"><label>Leaf Area (cm\u00b2)</label>' +
    '<input type="number" inputmode="decimal" id="lab-leaf-area" value="' + (data.leaf_area || '') + '" oninput="calcLAI()"></div>' +

    '<div class="field-group"><label>Bag Weight (g)</label>' +
    '<input type="number" inputmode="decimal" id="lab-bag-weight" value="' + (data.bag_weight || '') + '"></div>' +

    '<div class="form-section-title">WET WEIGHTS</div>' +
    '<div class="field-group"><label>Leaf Wet Weight (g)</label>' +
    '<input type="number" inputmode="decimal" id="lab-leaf-wet" value="' + (data.leaf_wet || '') + '"></div>' +
    '<div class="field-group"><label>Stem Wet Weight (g)</label>' +
    '<input type="number" inputmode="decimal" id="lab-stem-wet" value="' + (data.stem_wet || '') + '"></div>' +

    '<div class="form-section-title">DRY WEIGHTS</div>' +
    '<div class="field-group"><label>Leaf Dry Weight (g)</label>' +
    '<input type="number" inputmode="decimal" id="lab-leaf-dry" value="' + (data.leaf_dry || '') + '" oninput="calcLAI()"></div>' +
    '<div class="field-group"><label>Stem Dry Weight (g)</label>' +
    '<input type="number" inputmode="decimal" id="lab-stem-dry" value="' + (data.stem_dry || '') + '" oninput="calcLAI()"></div>' +

    '<div class="form-section-title">CALCULATED</div>' +
    '<div class="field-group"><label>LAI (auto-calculated)</label>' +
    '<div class="calc-field' + (data.lai ? ' has-value' : '') + '" id="lab-lai">' + (data.lai ? parseFloat(data.lai).toFixed(4) : '\u2014') + '</div></div>' +
    '<div class="field-group"><label>Above Ground Dry Matter (g/m\u00b2)</label>' +
    '<div class="calc-field' + (data.agdm ? ' has-value' : '') + '" id="lab-agdm">' + (data.agdm ? parseFloat(data.agdm).toFixed(2) + ' g/m\u00b2' : '\u2014') + '</div></div>' +

    '<div class="field-group"><label>Lab Notes</label>' +
    '<textarea id="lab-notes" placeholder="Any issues with this sample...">' + (data.lab_notes || '') + '</textarea></div>' +
    '</div>'; // end tab-content-lab

  document.getElementById('f-count1').addEventListener('input', calcPlantsM2);
  document.getElementById('f-count2').addEventListener('input', calcPlantsM2);
  showScreen('screen-field-entry');
}

function switchTab(tab) {
  const field = document.getElementById('tab-content-field');
  const lab = document.getElementById('tab-content-lab');
  field.style.display = tab === 'field' ? 'flex' : 'none';
  lab.style.display = tab === 'lab' ? 'flex' : 'none';
  document.getElementById('tab-field').classList.toggle('active', tab === 'field');
  document.getElementById('tab-lab').classList.toggle('active', tab === 'lab');
}

// --- SAVE (handles all modes) ---
function saveFieldEntry() {
  if (currentMode === 'ref') { saveRefEntry(); return; }
  if (currentMode === 'lys') { saveLysEntry(); return; }

  const gps_lat = currentPlotGPS.lat;
  const gps_lng = currentPlotGPS.lng;

  const c1 = parseFloat(document.getElementById('f-count1') ? document.getElementById('f-count1').value : '') || null;
  const c2 = parseFloat(document.getElementById('f-count2') ? document.getElementById('f-count2').value : '') || null;
  const pm2 = (c1 !== null && c2 !== null) ? ((c1 + c2) / 2) : null;

  const heights = [1,2,3,4,5].map(function(i) { return parseFloat(document.getElementById('f-h'+i) ? document.getElementById('f-h'+i).value : '') || null; });
  const leaves  = [1,2,3,4,5].map(function(i) { return parseFloat(document.getElementById('f-l'+i) ? document.getElementById('f-l'+i).value : '') || null; });
  const validH = heights.filter(function(v){return v !== null;});
  const validL = leaves.filter(function(v){return v !== null;});
  const avgH = validH.length ? (validH.reduce(function(a,b){return a+b;},0)/validH.length) : null;
  const avgL = validL.length ? (validL.reduce(function(a,b){return a+b;},0)/validL.length) : null;

  const la      = parseFloat(document.getElementById('lab-leaf-area') ? document.getElementById('lab-leaf-area').value : '') || null;
  const leafDry = parseFloat(document.getElementById('lab-leaf-dry') ? document.getElementById('lab-leaf-dry').value : '') || null;
  const stemDry = parseFloat(document.getElementById('lab-stem-dry') ? document.getElementById('lab-stem-dry').value : '') || null;
  const lai  = la ? la / 10000 : null;
  const agdm = (leafDry && stemDry) ? leafDry + stemDry : null;

  if (!currentSession.plots[currentPlotKey]) currentSession.plots[currentPlotKey] = {};
  Object.assign(currentSession.plots[currentPlotKey], {
    gps_lat: gps_lat,
    gps_lng: gps_lng,
    count1: c1, count2: c2,
    plants_m2: pm2 ? pm2.toFixed(1) : null,
    h1: heights[0], h2: heights[1], h3: heights[2], h4: heights[3], h5: heights[4],
    avg_height: avgH ? avgH.toFixed(1) : null,
    l1: leaves[0], l2: leaves[1], l3: leaves[2], l4: leaves[3], l5: leaves[4],
    avg_leaves: avgL ? avgL.toFixed(1) : null,
    notes: document.getElementById('f-notes') ? document.getElementById('f-notes').value : '',
    field_saved: validH.length > 0 || c1 !== null,
    leaf_area: la, 
    bag_weight: parseFloat(document.getElementById('lab-bag-weight') ? document.getElementById('lab-bag-weight').value : '') || null,
    cal_actual: parseFloat(document.getElementById('lab-cal-actual') ? document.getElementById('lab-cal-actual').value : '') || null,
    cal_machine: parseFloat(document.getElementById('lab-cal-machine') ? document.getElementById('lab-cal-machine').value : '') || null,
    leaf_wet: parseFloat(document.getElementById('lab-leaf-wet') ? document.getElementById('lab-leaf-wet').value : '') || null,
    stem_wet: parseFloat(document.getElementById('lab-stem-wet') ? document.getElementById('lab-stem-wet').value : '') || null,
    leaf_dry: leafDry, stem_dry: stemDry,
    lai: lai, agdm: agdm,
    lab_notes: document.getElementById('lab-notes') ? document.getElementById('lab-notes').value : '',
    lab_saved: la !== null || leafDry !== null
  });

  saveCurrentSession();
  showToast('Saved \u2713');
  setTimeout(function() { backToSessionMenu(); }, 800);
}

// --- REFERENCE ROW ---
function openRefEntry(key, quadrant, row) {
  currentPlotKey = key;
  currentMode = 'ref';
  const data = currentSession.refs[key] || {};
  document.getElementById('field-entry-title').textContent = quadrant + ' \u00b7 ' + row;
  document.getElementById('field-entry-badge').textContent = 'REF ROW';
  document.getElementById('field-entry-badge').className = 'badge';

  document.getElementById('field-entry-form').innerHTML =
    '<div class="form-section-title">PLANT HEIGHT (inches) \u2014 5 Plants</div>' +
    '<div class="field-group"><div class="plant-grid">' +
    [1,2,3,4,5].map(function(i) {
      const nextId = i < 5 ? 'f-h'+(i+1) : 'f-l1';
      return '<div class="plant-input-wrap"><span>P'+i+'</span>' +
        '<input type="number" inputmode="decimal" id="f-h'+i+'" value="'+(data['h'+i]||'')+'"' +
        ' oninput="calcAvg(\'f-h\',\'f-avg-height\')" onchange="autoAdvance(this,\''+nextId+'\')"></div>';
    }).join('') +
    '</div><div class="avg-display" id="f-avg-height">Avg: ' + (data.avg_height ? data.avg_height + ' in' : '\u2014') + '</div></div>' +

    '<div class="form-section-title">LEAF COUNT \u2014 5 Plants</div>' +
    '<div class="field-group"><div class="plant-grid">' +
    [1,2,3,4,5].map(function(i) {
      const nextId = i < 5 ? 'f-l'+(i+1) : 'f-notes';
      return '<div class="plant-input-wrap"><span>P'+i+'</span>' +
        '<input type="number" inputmode="numeric" id="f-l'+i+'" value="'+(data['l'+i]||'')+'"' +
        ' oninput="calcAvg(\'f-l\',\'f-avg-leaves\')" onchange="autoAdvance(this,\''+nextId+'\')"></div>';
    }).join('') +
    '</div><div class="avg-display" id="f-avg-leaves">Avg: ' + (data.avg_leaves ? data.avg_leaves + ' leaves' : '\u2014') + '</div></div>' +

    '<div class="field-group"><label>Notes / Flag</label>' +
    '<textarea id="f-notes" placeholder="e.g. flag, bugs, shooting head...">' + (data.notes || '') + '</textarea></div>';

  showScreen('screen-field-entry');
}

function saveRefEntry() {
  const heights = [1,2,3,4,5].map(function(i) { return parseFloat(document.getElementById('f-h'+i) ? document.getElementById('f-h'+i).value : '') || null; });
  const leaves  = [1,2,3,4,5].map(function(i) { return parseFloat(document.getElementById('f-l'+i) ? document.getElementById('f-l'+i).value : '') || null; });
  const validH = heights.filter(function(v){return v !== null;});
  const validL = leaves.filter(function(v){return v !== null;});
  const avgH = validH.length ? (validH.reduce(function(a,b){return a+b;},0)/validH.length) : null;
  const avgL = validL.length ? (validL.reduce(function(a,b){return a+b;},0)/validL.length) : null;
  if (!currentSession.refs[currentPlotKey]) currentSession.refs[currentPlotKey] = {};
  Object.assign(currentSession.refs[currentPlotKey], {
    h1: heights[0], h2: heights[1], h3: heights[2], h4: heights[3], h5: heights[4],
    avg_height: avgH ? avgH.toFixed(1) : null,
    l1: leaves[0], l2: leaves[1], l3: leaves[2], l4: leaves[3], l5: leaves[4],
    avg_leaves: avgL ? avgL.toFixed(1) : null,
    notes: document.getElementById('f-notes') ? document.getElementById('f-notes').value : '',
    saved: true
  });
  saveCurrentSession();
  showToast('Saved \u2713');
  setTimeout(function() { backToSessionMenu(); }, 800);
}

// --- LYSIMETER BOX ---
function openLysEntry(key, quadrant) {
  currentPlotKey = key;
  currentMode = 'lys';
  const data = currentSession.lys[key] || {};
  const isHarvest = currentSession.type === 'Harvest';
  document.getElementById('field-entry-title').textContent = quadrant + ' Box';
  document.getElementById('field-entry-badge').textContent = 'LYSIMETER';
  document.getElementById('field-entry-badge').className = 'badge lysimeter';

  document.getElementById('field-entry-form').innerHTML =
    '<div class="form-section-title">PLANT HEIGHT (inches) \u2014 5 Plants</div>' +
    '<div class="field-group"><div class="plant-grid">' +
    [1,2,3,4,5].map(function(i) {
      const nextId = i < 5 ? 'f-h'+(i+1) : 'f-l1';
      return '<div class="plant-input-wrap"><span>P'+i+'</span>' +
        '<input type="number" inputmode="decimal" id="f-h'+i+'" value="'+(data['h'+i]||'')+'"' +
        ' oninput="calcAvg(\'f-h\',\'f-avg-height\')" onchange="autoAdvance(this,\''+nextId+'\')"></div>';
    }).join('') +
    '</div><div class="avg-display" id="f-avg-height">Avg: ' + (data.avg_height ? data.avg_height + ' in' : '\u2014') + '</div></div>' +

    '<div class="form-section-title">LEAF COUNT \u2014 5 Plants</div>' +
    '<div class="field-group"><div class="plant-grid">' +
    [1,2,3,4,5].map(function(i) {
      const nextId = i < 5 ? 'f-l'+(i+1) : 'f-notes';
      return '<div class="plant-input-wrap"><span>P'+i+'</span>' +
        '<input type="number" inputmode="numeric" id="f-l'+i+'" value="'+(data['l'+i]||'')+'"' +
        ' oninput="calcAvg(\'f-l\',\'f-avg-leaves\')" onchange="autoAdvance(this,\''+nextId+'\')"></div>';
    }).join('') +
    '</div><div class="avg-display" id="f-avg-leaves">Avg: ' + (data.avg_leaves ? data.avg_leaves + ' leaves' : '\u2014') + '</div></div>' +

    (isHarvest ?
      '<div class="form-section-title">HARVEST DATA</div>' +
      '<div class="field-group"><label>Nutrient Sample Weight (g)</label>' +
      '<input type="number" inputmode="decimal" id="lys-nutrient" value="' + (data.nutrient_wt || '') + '"></div>' +
      '<div class="field-group"><label>Biomass Wet Weight (lbs)</label>' +
      '<input type="number" inputmode="decimal" id="lys-biomass-wet" value="' + (data.biomass_wet || '') + '"></div>' +
      '<div class="field-group"><label>Biomass Sub Wet Weight (g)</label>' +
      '<input type="number" inputmode="decimal" id="lys-sub-wet" value="' + (data.sub_wet || '') + '"></div>' +
      '<div class="field-group"><label>Biomass Sub Dry Weight (g)</label>' +
      '<input type="number" inputmode="decimal" id="lys-sub-dry" value="' + (data.sub_dry || '') + '"></div>'
    : '') +

    '<div class="field-group"><label>Notes</label>' +
    '<textarea id="f-notes" placeholder="Observations...">' + (data.notes || '') + '</textarea></div>';

  showScreen('screen-field-entry');
}

function saveLysEntry() {
  const heights = [1,2,3,4,5].map(function(i) { return parseFloat(document.getElementById('f-h'+i) ? document.getElementById('f-h'+i).value : '') || null; });
  const leaves  = [1,2,3,4,5].map(function(i) { return parseFloat(document.getElementById('f-l'+i) ? document.getElementById('f-l'+i).value : '') || null; });
  const validH = heights.filter(function(v){return v !== null;});
  const validL = leaves.filter(function(v){return v !== null;});
  const avgH = validH.length ? (validH.reduce(function(a,b){return a+b;},0)/validH.length) : null;
  const avgL = validL.length ? (validL.reduce(function(a,b){return a+b;},0)/validL.length) : null;
  if (!currentSession.lys[currentPlotKey]) currentSession.lys[currentPlotKey] = {};
  Object.assign(currentSession.lys[currentPlotKey], {
    h1: heights[0], h2: heights[1], h3: heights[2], h4: heights[3], h5: heights[4],
    avg_height: avgH ? avgH.toFixed(1) : null,
    l1: leaves[0], l2: leaves[1], l3: leaves[2], l4: leaves[3], l5: leaves[4],
    avg_leaves: avgL ? avgL.toFixed(1) : null,
    nutrient_wt: parseFloat(document.getElementById('lys-nutrient') ? document.getElementById('lys-nutrient').value : '') || null,
    biomass_wet: parseFloat(document.getElementById('lys-biomass-wet') ? document.getElementById('lys-biomass-wet').value : '') || null,
    sub_wet:     parseFloat(document.getElementById('lys-sub-wet') ? document.getElementById('lys-sub-wet').value : '') || null,
    sub_dry:     parseFloat(document.getElementById('lys-sub-dry') ? document.getElementById('lys-sub-dry').value : '') || null,
    notes: document.getElementById('f-notes') ? document.getElementById('f-notes').value : '',
    saved: true
  });
  saveCurrentSession();
  showToast('Saved \u2713');
  setTimeout(function() { backToSessionMenu(); }, 800);
}

// --- SESSIONS LIST ---
function renderSessionsList() {
  const sessions = getSessions();
  const list = document.getElementById('sessions-list');
  const all = Object.values(sessions).sort(function(a,b){return b.id - a.id;});
  if (all.length === 0) {
    list.innerHTML = '<p style="color:#999;text-align:center;padding:40px;">No sessions yet</p>';
    return;
  }
  list.innerHTML = all.map(function(s) {
    return '<div class="session-card">' +
      '<div class="session-card-info" onclick="openSession(\'' + s.id + '\')" style="flex:1;cursor:pointer;">' +
      '<h3>' + s.date + ' \u00b7 ' + s.side + '</h3>' +
      '<p>' + s.crop + ' \u00b7 ' + s.year + ' \u00b7 ' + s.type + '</p>' +
      '</div>' +
      '<button class="btn-delete" onclick="deleteSession(\'' + s.id + '\')">\ud83d\uddd1</button>' +
      '</div>';
  }).join('');
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
  const rows = [];
  const header = ['Date','DOY','Plot Name','Growth Stage/#Leaves','Plot Size m2',
    '# Plants/m2','Plant Height in','Plant Height m','Leaf Area cm2',
    'Leaf Wet Weight g','Stem Wet Weight g','Leaf Dry Weight g','Stem Dry Weight g',
    'LAI','Above Ground Dry Matter g/m2','GPS Lat','GPS Lng',
    'Cal Card Actual cm2','Cal Machine Reading cm2','Notes'];
  rows.push(header.join(','));

  const date = currentSession.date;
  const year = currentSession.year;
  const doy  = getDOY(date);
  const sideChar = currentSession.side.charAt(0);

  SPANS.forEach(function(span) {
    ['A','B'].forEach(function(ab) {
      const key = span + sideChar + ab;
      const d = currentSession.plots[key] || {};
      const heightM = d.avg_height ? (parseFloat(d.avg_height) * 0.0254).toFixed(4) : '';
      rows.push([
        date, doy, key,
        d.avg_leaves || '', 1, d.plants_m2 || '',
        d.avg_height || '', heightM,
        d.leaf_area || '', d.leaf_wet || '', d.stem_wet || '',
        d.leaf_dry || '', d.stem_dry || '',
        d.lai ? parseFloat(d.lai).toFixed(6) : '',
        d.agdm ? parseFloat(d.agdm).toFixed(2) : '',
        d.gps_lat || '', d.gps_lng || '',
        d.cal_actual || '', d.cal_machine || '',
        '"' + ((d.notes || '') + (d.lab_notes ? ' | ' + d.lab_notes : '')) + '"'
      ].join(','));
    });
  });

  QUADRANTS.forEach(function(q) {
    ROWS.forEach(function(r) {
      const key = q + '_' + r;
      const d = currentSession.refs[key] || {};
      const heightM = d.avg_height ? (parseFloat(d.avg_height) * 0.0254).toFixed(4) : '';
      rows.push([date, doy, q+' '+r+'`', d.avg_leaves||'', 1, '',
        d.avg_height||'', heightM, '','','','','','','','','',
        '"'+(d.notes||'')+'"'].join(','));
    });
  });

  if (currentSession.type === 'Harvest') {
    QUADRANTS.forEach(function(q) {
      const key = q + '_BOX';
      const d = currentSession.lys[key] || {};
      const heightM = d.avg_height ? (parseFloat(d.avg_height) * 0.0254).toFixed(4) : '';
      rows.push([date, doy, q+' BOX', d.avg_leaves||'', '', '',
        d.avg_height||'', heightM, '','','','','','','','','',
        '"'+(d.notes||'')+'"'].join(','));
    });
  }

  const csv = rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'field_data_' + currentSession.side + '_' + date + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Export ready!');
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
  setTimeout(function() { el.classList.remove('show'); }, 2500);
}

// --- INIT ---
window.addEventListener('load', function() { renderHome(); });

// Unregister any old service workers
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(regs) {
    regs.forEach(function(r) { r.unregister(); });
  });
}

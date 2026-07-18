// ============================================
// FIELD SAMPLER PWA - App Logic
// ============================================

const SPANS = [2, 3, 4, 7, 8, 9];
const LYSIMETER_SPANS = [3, 8];
const QUADRANTS = ['NE', 'NW', 'SE', 'SW'];
const ROWS = ['R1', 'R2', 'R3', 'R4'];
const STABILITY_THRESHOLD = 0.01;
const LBS_TO_G = 453.592;

let currentSession = null;
let currentPlotKey = null;
let currentMode = null;
let selectedSide = 'East';
let selectedSessionType = 'Weekly';
let currentPlotGPS = { lat: null, lng: null };

function getSessions() {
  try { return JSON.parse(localStorage.getItem('fs_sessions') || '{}'); }
  catch { return {}; }
}
function saveSessionsData(s) { localStorage.setItem('fs_sessions', JSON.stringify(s)); }
function saveCurrentSession() {
  if (!currentSession) return;
  const s = getSessions(); s[currentSession.id] = currentSession; saveSessionsData(s);
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(function(s){s.classList.remove('active');});
  document.getElementById(id).classList.add('active');
  if (id === 'screen-home') renderHome();
  if (id === 'screen-sessions') renderSessionsList();
  if (id === 'screen-new-session') initNewSessionForm();
}
function backToSessionMenu() { showScreen('screen-session-menu'); renderSessionMenu(); }

function renderHome() {
  const sessions = getSessions();
  const recent = Object.values(sessions).sort(function(a,b){return b.id-a.id;}).slice(0,3);
  const el = document.getElementById('home-recent');
  if (!recent.length) { el.innerHTML=''; return; }
  el.innerHTML = '<div style="color:rgba(255,255,255,0.7);font-size:12px;font-weight:700;letter-spacing:0.5px;margin-bottom:8px;">RECENT</div>' +
    recent.map(function(s){
      return '<div class="session-card" style="margin-bottom:8px;" onclick="openSession(\''+s.id+'\')">' +
        '<div class="session-card-info"><h3>'+s.date+' \u00b7 '+s.side+'</h3><p>'+s.crop+' \u00b7 '+s.type+'</p></div>' +
        '<span class="session-card-arrow">\u203a</span></div>';
    }).join('');
}

function initNewSessionForm() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('session-date').value = today;
  selectedSide = 'East'; selectedSessionType = 'Weekly';
  document.getElementById('side-east').classList.add('active');
  document.getElementById('side-west').classList.remove('active');
  document.getElementById('type-weekly').classList.add('active');
  document.getElementById('type-harvest').classList.remove('active');
  document.getElementById('harvest-bag-weights').style.display = 'none';
}
function selectSide(side) {
  selectedSide = side;
  document.getElementById('side-east').classList.toggle('active', side==='East');
  document.getElementById('side-west').classList.toggle('active', side==='West');
}
function selectSessionType(type) {
  selectedSessionType = type;
  document.getElementById('type-weekly').classList.toggle('active', type==='Weekly');
  document.getElementById('type-harvest').classList.toggle('active', type==='Harvest');
  document.getElementById('harvest-bag-weights').style.display = type==='Harvest' ? 'flex' : 'none';
}
function startSession() {
  const date = document.getElementById('session-date').value;
  const crop = document.getElementById('session-crop').value;
  const year = document.getElementById('session-year').value;
  const tech = document.getElementById('session-tech').value;
  if (!date) { showToast('Please enter a date'); return; }
  currentSession = {
    id: Date.now().toString(), date, crop, year,
    side: selectedSide, type: selectedSessionType, tech,
    plots: {}, refs: {}, lys: {}, harvest: {},
    dryingLog: {},
    bagWeights: {
      ziplock: parseFloat(document.getElementById('bag-ziplock').value)||null,
      purple: parseFloat(document.getElementById('bag-purple').value)||null,
      brownPaper: parseFloat(document.getElementById('bag-brown').value)||null
    }
  };
  saveCurrentSession();
  showScreen('screen-session-menu');
  renderSessionMenu();
}

function captureGPS() {
  const el = document.getElementById('plot-gps-display');
  if (!el) return;
  el.textContent = 'Capturing...';
  if (!navigator.geolocation) { el.textContent = 'GPS not available'; return; }
  navigator.geolocation.getCurrentPosition(
    function(pos) {
      const lat = pos.coords.latitude.toFixed(6);
      const lng = pos.coords.longitude.toFixed(6);
      el.textContent = lat+', '+lng;
      el.classList.add('captured');
      currentPlotGPS = { lat, lng };
    },
    function() { el.textContent='GPS error - try again'; showToast('Could not get GPS.'); },
    { enableHighAccuracy:true, timeout:15000 }
  );
}
function autoAdvance(input, nextId) {
  if (input.value.length>0) { const n=document.getElementById(nextId); if(n){n.focus();n.select();} }
}
function calcPlantsM2() {
  const c1=parseFloat(document.getElementById('f-count1').value)||0;
  const c2=parseFloat(document.getElementById('f-count2').value)||0;
  const el=document.getElementById('f-plants-m2');
  if (c1>0||c2>0) { el.textContent=((c1+c2)/1.524).toFixed(1)+' plants/m\u00b2'; el.classList.add('has-value'); }
  else { el.textContent='\u2014'; el.classList.remove('has-value'); }
}
function calcAvg(prefix, displayId) {
  const vals=[1,2,3,4,5].map(function(i){const e=document.getElementById(prefix+i);return e?parseFloat(e.value):NaN;}).filter(function(v){return !isNaN(v);});
  const el=document.getElementById(displayId);
  if (!vals.length){el.textContent='Avg: \u2014';return;}
  el.textContent='Avg: '+(vals.reduce(function(a,b){return a+b;},0)/vals.length).toFixed(1)+(displayId.indexOf('height')>=0?' in':' leaves');
}
function calcLAI() {
  const la=parseFloat(document.getElementById('lab-leaf-area')?document.getElementById('lab-leaf-area').value:'');
  const bagWt=parseFloat(document.getElementById('lab-bag-weight')?document.getElementById('lab-bag-weight').value:'')||0;
  const ldr=parseFloat(document.getElementById('lab-leaf-dry')?document.getElementById('lab-leaf-dry').value:'');
  const sdr=parseFloat(document.getElementById('lab-stem-dry')?document.getElementById('lab-stem-dry').value:'');
  const laiEl=document.getElementById('lab-lai');
  const agdmEl=document.getElementById('lab-agdm');
  if (!isNaN(la)){laiEl.textContent=(la/15239.96).toFixed(4);laiEl.classList.add('has-value');}
  else{laiEl.textContent='\u2014';laiEl.classList.remove('has-value');}
  if (!isNaN(ldr)&&!isNaN(sdr)){agdmEl.textContent=((ldr-bagWt)+(sdr-bagWt)).toFixed(2)+' g/m\u00b2';agdmEl.classList.add('has-value');}
  else{agdmEl.textContent='\u2014';agdmEl.classList.remove('has-value');}
}

// Harvest bag weight helpers
function getBW() { return currentSession.bagWeights || {}; }
function calcHarvestWeights() {
  const bw = getBW();
  const raw = parseFloat(document.getElementById('h-nutrient-wt') ? document.getElementById('h-nutrient-wt').value : '') || null;
  const bwetRaw = parseFloat(document.getElementById('h-biomass-wet-lbs') ? document.getElementById('h-biomass-wet-lbs').value : '') || null;
  const bsubRaw = parseFloat(document.getElementById('h-biomass-sub-wet') ? document.getElementById('h-biomass-sub-wet').value : '') || null;

  // Nutrient sample: subtract ziplock
  const zipG = bw.ziplock || 0;
  const netNutrient = raw !== null ? raw - zipG : null;
  const netNutrientEl = document.getElementById('h-nutrient-net');
  if (netNutrientEl) {
    if (netNutrient !== null) { netNutrientEl.textContent = netNutrient.toFixed(2) + ' g net'; netNutrientEl.classList.add('has-value'); }
    else { netNutrientEl.textContent = '\u2014'; netNutrientEl.classList.remove('has-value'); }
  }

  // Biomass wet: subtract purple + brown paper bag (converted to lbs)
  const purpleG = bw.purple || 0;
  const brownG = bw.brownPaper || 0;
  const totalBagG = purpleG + brownG;
  const totalBagLbs = totalBagG / LBS_TO_G;
  const netBWetLbs = bwetRaw !== null ? bwetRaw - totalBagLbs : null;
  const netBWetG = netBWetLbs !== null ? netBWetLbs * LBS_TO_G : null;
  const netBWetEl = document.getElementById('h-biomass-wet-net');
  if (netBWetEl) {
    if (netBWetLbs !== null) {
      netBWetEl.textContent = netBWetLbs.toFixed(4) + ' lbs / ' + netBWetG.toFixed(1) + ' g net';
      netBWetEl.classList.add('has-value');
    } else { netBWetEl.textContent = '\u2014'; netBWetEl.classList.remove('has-value'); }
  }

  // Biomass sub wet: subtract purple bag
  const netBSub = bsubRaw !== null ? bsubRaw - purpleG : null;
  const netBSubEl = document.getElementById('h-biomass-sub-net');
  if (netBSubEl) {
    if (netBSub !== null) { netBSubEl.textContent = netBSub.toFixed(2) + ' g net'; netBSubEl.classList.add('has-value'); }
    else { netBSubEl.textContent = '\u2014'; netBSubEl.classList.remove('has-value'); }
  }
}

function getHarvestBoxKeys() {
  if (!currentSession) return [];
  return currentSession.side === 'East' ? ['NE_BOX','SE_BOX'] : ['NW_BOX','SW_BOX'];
}
function getAllHarvestPlotKeys() {
  const sideChar = currentSession.side.charAt(0);
  const keys = [];
  SPANS.forEach(function(span){['A','B'].forEach(function(ab){keys.push(span+sideChar+ab);});});
  getHarvestBoxKeys().forEach(function(k){keys.push(k);});
  return keys;
}

function renderSessionMenu() {
  if (!currentSession) return;
  const isHarvest = currentSession.type === 'Harvest';
  const sideChar = currentSession.side.charAt(0);
  document.getElementById('session-menu-title').textContent = currentSession.date+' \u00b7 '+currentSession.side;
  document.getElementById('session-info-bar').textContent =
    currentSession.crop+' \u00b7 '+currentSession.year+' \u00b7 '+currentSession.type+(currentSession.tech?' \u00b7 '+currentSession.tech:'');

  if (isHarvest) {
    // Harvest: only show harvest data + drying log
    document.getElementById('weekly-sections').style.display = 'none';
    document.getElementById('harvest-section').style.display = 'block';
    const harvestList = document.getElementById('harvest-list');
    harvestList.innerHTML = '';
    getAllHarvestPlotKeys().forEach(function(key){
      const data = currentSession.harvest[key] || {};
      const label = key.indexOf('_BOX')>=0 ? key.replace('_BOX',' Box') : key;
      const item = document.createElement('div');
      item.className = 'plot-item' + (key.indexOf('_BOX')>=0?' lysimeter':'');
      item.innerHTML = '<div style="flex:1"><div class="plot-item-name">'+label+'</div>'+
        '<div class="plot-item-sub">Harvest data</div></div>'+
        '<div class="status-dots"><div class="dot'+(data.saved?' filled-lab':'')+'"></div></div>'+
        '<span style="font-size:20px;color:#bbb">\u203a</span>';
      item.onclick = (function(k){return function(){openHarvestEntry(k);};})(key);
      harvestList.appendChild(item);
    });
    // Drying log
    const stable = getDryingStableCount();
    const total = getAllHarvestPlotKeys().length;
    const dryBtn = document.createElement('div');
    dryBtn.className = 'plot-item';
    dryBtn.style.background = '#fff8e8';
    dryBtn.style.borderLeft = '4px solid #c17f24';
    dryBtn.innerHTML = '<div style="flex:1"><div class="plot-item-name">\ud83d\udcca Drying Log</div>'+
      '<div class="plot-item-sub">'+stable+'/'+total+' stable</div></div>'+
      '<span style="font-size:20px;color:#bbb">\u203a</span>';
    dryBtn.onclick = function(){openDryingLog();};
    harvestList.appendChild(dryBtn);
  } else {
    // Weekly: show all sections
    document.getElementById('weekly-sections').style.display = 'block';
    document.getElementById('harvest-section').style.display = 'none';
    const plotList = document.getElementById('plot-list');
    plotList.innerHTML = '';
    SPANS.forEach(function(span){
      ['A','B'].forEach(function(ab){
        const key = span+sideChar+ab;
        const data = currentSession.plots[key]||{};
        const isLys = LYSIMETER_SPANS.indexOf(span)>=0;
        const item = document.createElement('div');
        item.className = 'plot-item'+(isLys?' lysimeter':'');
        item.innerHTML = '<div style="flex:1"><div class="plot-item-name">Span '+span+sideChar+' \u00b7 '+ab+'</div>'+
          '<div class="plot-item-sub">'+(isLys?'\ud83e\uddea Lysimeter span':'Destructive sample')+'</div></div>'+
          '<div class="status-dots"><div class="dot'+(data.field_saved?' filled-field':'')+'"></div>'+
          '<div class="dot'+(data.lab_saved?' filled-lab':'')+'"></div></div>'+
          '<span style="font-size:20px;color:#bbb">\u203a</span>';
        item.onclick = (function(k){return function(){openPlotEntry(k);};})(key);
        plotList.appendChild(item);
      });
    });
    const refList = document.getElementById('ref-list');
    refList.innerHTML = '';
    QUADRANTS.forEach(function(q){
      ROWS.forEach(function(r){
        const key = q+'_'+r;
        const data = currentSession.refs[key]||{};
        const item = document.createElement('div');
        item.className = 'plot-item';
        item.innerHTML = '<div style="flex:1"><div class="plot-item-name">'+q+' \u00b7 '+r+'</div>'+
          '<div class="plot-item-sub">Reference row</div></div>'+
          '<div class="status-dots"><div class="dot'+(data.saved?' filled-lab':'')+'"></div></div>'+
          '<span style="font-size:20px;color:#bbb">\u203a</span>';
        item.onclick = (function(k,qq,rr){return function(){openRefEntry(k,qq,rr);};})(key,q,r);
        refList.appendChild(item);
      });
    });
    const lysList = document.getElementById('lys-list');
    lysList.innerHTML = '';
    QUADRANTS.forEach(function(q){
      const key = q+'_BOX';
      const data = currentSession.lys[key]||{};
      const item = document.createElement('div');
      item.className = 'plot-item lysimeter';
      item.innerHTML = '<div style="flex:1"><div class="plot-item-name">'+q+' Box</div>'+
        '<div class="plot-item-sub">Height & leaf count</div></div>'+
        '<div class="status-dots"><div class="dot'+(data.saved?' filled-lab':'')+'"></div></div>'+
        '<span style="font-size:20px;color:#bbb">\u203a</span>';
      item.onclick = (function(k,qq){return function(){openLysEntry(k,qq);};})(key,q);
      lysList.appendChild(item);
    });
  }
}

// --- DESTRUCTIVE PLOT ENTRY ---
function openPlotEntry(key) {
  currentPlotKey=key; currentMode='destructive';
  const data=currentSession.plots[key]||{};
  const isLys=LYSIMETER_SPANS.indexOf(parseInt(key))>=0;
  const label=key.replace(/([0-9]+)([EW])([AB])/,'Span $1$2 \u00b7 $3');
  document.getElementById('field-entry-title').textContent=label;
  const badge=document.getElementById('field-entry-badge');
  badge.textContent=isLys?'LYSIMETER':'FIELD DATA';
  badge.className='badge'+(isLys?' lysimeter':'');
  currentPlotGPS={lat:data.gps_lat||null,lng:data.gps_lng||null};
  const gpsDisplay=data.gps_lat?(data.gps_lat+', '+data.gps_lng):'Not captured';
  const gpsClass=data.gps_lat?' captured':'';
  const form=document.getElementById('field-entry-form');
  form.innerHTML=
    '<div style="display:flex;gap:8px;margin-bottom:4px;">'+
    '<button class="toggle-btn active" id="tab-field" onclick="switchTab(\'field\')">Field</button>'+
    '<button class="toggle-btn" id="tab-lab" onclick="switchTab(\'lab\')">Lab</button></div>'+
    '<div id="tab-content-field" style="display:flex;flex-direction:column;gap:14px;">'+
    '<div class="field-group"><label>GPS Location</label><div class="gps-row">'+
    '<span id="plot-gps-display" class="gps-value'+gpsClass+'">'+gpsDisplay+'</span>'+
    '<button class="btn-gps" onclick="captureGPS()">\ud83d\udccd Capture</button></div></div>'+
    '<div class="field-group"><label>Plant Count \u2014 Row 1 (1m)</label>'+
    '<input type="number" id="f-count1" inputmode="numeric" placeholder="e.g. 8" value="'+(data.count1||'')+'"></div>'+
    '<div class="field-group"><label>Plant Count \u2014 Row 2 (1m)</label>'+
    '<input type="number" id="f-count2" inputmode="numeric" placeholder="e.g. 9" value="'+(data.count2||'')+'"></div>'+
    '<div class="field-group"><label>Plants / m\u00b2 (calculated)</label>'+
    '<div class="calc-field'+(data.plants_m2?' has-value':'')+'" id="f-plants-m2">'+(data.plants_m2||'\u2014')+'</div></div>'+
    '<div class="form-section-title">PLANT HEIGHT (inches) \u2014 5 Plants</div>'+
    '<div class="field-group"><div class="plant-grid">'+
    [1,2,3,4,5].map(function(i){const n=i<5?'f-h'+(i+1):'f-l1';
      return '<div class="plant-input-wrap"><span>P'+i+'</span>'+
        '<input type="number" inputmode="decimal" id="f-h'+i+'" value="'+(data['h'+i]||'')+'"'+
        ' oninput="calcAvg(\'f-h\',\'f-avg-height\')" onchange="autoAdvance(this,\''+n+'\')"></div>';}).join('')+
    '</div><div class="avg-display" id="f-avg-height">Avg: '+(data.avg_height?data.avg_height+' in':'\u2014')+'</div></div>'+
    '<div class="form-section-title">LEAF COUNT \u2014 5 Plants</div>'+
    '<div class="field-group"><div class="plant-grid">'+
    [1,2,3,4,5].map(function(i){const n=i<5?'f-l'+(i+1):'f-notes';
      return '<div class="plant-input-wrap"><span>P'+i+'</span>'+
        '<input type="number" inputmode="numeric" id="f-l'+i+'" value="'+(data['l'+i]||'')+'"'+
        ' oninput="calcAvg(\'f-l\',\'f-avg-leaves\')" onchange="autoAdvance(this,\''+n+'\')"></div>';}).join('')+
    '</div><div class="avg-display" id="f-avg-leaves">Avg: '+(data.avg_leaves?data.avg_leaves+' leaves':'\u2014')+'</div></div>'+
    '<div class="field-group"><label>Notes</label>'+
    '<textarea id="f-notes" placeholder="Flags, observations, issues...">'+(data.notes||'')+'</textarea></div></div>'+
    '<div id="tab-content-lab" style="display:none;flex-direction:column;gap:14px;">'+
    '<div class="form-section-title">LEAF AREA METER CALIBRATION</div>'+
    '<div class="field-group"><label>Index Card Actual Area (cm\u00b2)</label>'+
    '<input type="number" inputmode="decimal" id="lab-cal-actual" value="'+(data.cal_actual||'')+'" placeholder="e.g. 90.32"></div>'+
    '<div class="field-group"><label>LA Machine Reading for Card (cm\u00b2)</label>'+
    '<input type="number" inputmode="decimal" id="lab-cal-machine" value="'+(data.cal_machine||'')+'" placeholder="e.g. 91.50"></div>'+
    '<div class="field-group"><label>Leaf Area (cm\u00b2)</label>'+
    '<input type="number" inputmode="decimal" id="lab-leaf-area" value="'+(data.leaf_area||'')+'" oninput="calcLAI()"></div>'+
    '<div class="field-group"><label>Bag Weight (g)</label>'+
    '<input type="number" inputmode="decimal" id="lab-bag-weight" value="'+(data.bag_weight||'')+'" oninput="calcLAI()"></div>'+
    '<div class="form-section-title">WET WEIGHTS (before bag subtraction)</div>'+
    '<div class="field-group"><label>Leaf Wet Weight (g)</label>'+
    '<input type="number" inputmode="decimal" id="lab-leaf-wet" value="'+(data.leaf_wet_raw||'')+'"></div>'+
    '<div class="field-group"><label>Stem Wet Weight (g)</label>'+
    '<input type="number" inputmode="decimal" id="lab-stem-wet" value="'+(data.stem_wet_raw||'')+'"></div>'+
    '<div class="form-section-title">DRY WEIGHTS (before bag subtraction)</div>'+
    '<div class="field-group"><label>Leaf Dry Weight (g)</label>'+
    '<input type="number" inputmode="decimal" id="lab-leaf-dry" value="'+(data.leaf_dry_raw||'')+'" oninput="calcLAI()"></div>'+
    '<div class="field-group"><label>Stem Dry Weight (g)</label>'+
    '<input type="number" inputmode="decimal" id="lab-stem-dry" value="'+(data.stem_dry_raw||'')+'" oninput="calcLAI()"></div>'+
    '<div class="form-section-title">CALCULATED</div>'+
    '<div class="field-group"><label>LAI</label>'+
    '<div class="calc-field'+(data.lai?' has-value':'')+'" id="lab-lai">'+(data.lai?parseFloat(data.lai).toFixed(4):'\u2014')+'</div></div>'+
    '<div class="field-group"><label>Above Ground Dry Matter (g/m\u00b2)</label>'+
    '<div class="calc-field'+(data.agdm?' has-value':'')+'" id="lab-agdm">'+(data.agdm?parseFloat(data.agdm).toFixed(2)+' g/m\u00b2':'\u2014')+'</div></div>'+
    '<div class="field-group"><label>Lab Notes</label>'+
    '<textarea id="lab-notes" placeholder="Any issues...">'+(data.lab_notes||'')+'</textarea></div></div>';
  document.getElementById('f-count1').addEventListener('input',calcPlantsM2);
  document.getElementById('f-count2').addEventListener('input',calcPlantsM2);
  showScreen('screen-field-entry');
}
function switchTab(tab) {
  document.getElementById('tab-content-field').style.display=tab==='field'?'flex':'none';
  document.getElementById('tab-content-lab').style.display=tab==='lab'?'flex':'none';
  document.getElementById('tab-field').classList.toggle('active',tab==='field');
  document.getElementById('tab-lab').classList.toggle('active',tab==='lab');
}
function saveFieldEntry() {
  if (currentMode==='ref'){saveRefEntry();return;}
  if (currentMode==='lys'){saveLysEntry();return;}
  const gps_lat=currentPlotGPS.lat, gps_lng=currentPlotGPS.lng;
  const c1=parseFloat(document.getElementById('f-count1')?document.getElementById('f-count1').value:'')||null;
  const c2=parseFloat(document.getElementById('f-count2')?document.getElementById('f-count2').value:'')||null;
  const pm2=(c1!==null&&c2!==null)?((c1+c2)/1.524):null;
  const heights=[1,2,3,4,5].map(function(i){return parseFloat(document.getElementById('f-h'+i)?document.getElementById('f-h'+i).value:'')||null;});
  const leaves=[1,2,3,4,5].map(function(i){return parseFloat(document.getElementById('f-l'+i)?document.getElementById('f-l'+i).value:'')||null;});
  const validH=heights.filter(function(v){return v!==null;});
  const validL=leaves.filter(function(v){return v!==null;});
  const avgH=validH.length?(validH.reduce(function(a,b){return a+b;},0)/validH.length):null;
  const avgL=validL.length?(validL.reduce(function(a,b){return a+b;},0)/validL.length):null;
  const la=parseFloat(document.getElementById('lab-leaf-area')?document.getElementById('lab-leaf-area').value:'')||null;
  const bagWt=parseFloat(document.getElementById('lab-bag-weight')?document.getElementById('lab-bag-weight').value:'')||0;
  const lwr=parseFloat(document.getElementById('lab-leaf-wet')?document.getElementById('lab-leaf-wet').value:'')||null;
  const swr=parseFloat(document.getElementById('lab-stem-wet')?document.getElementById('lab-stem-wet').value:'')||null;
  const ldr=parseFloat(document.getElementById('lab-leaf-dry')?document.getElementById('lab-leaf-dry').value:'')||null;
  const sdr=parseFloat(document.getElementById('lab-stem-dry')?document.getElementById('lab-stem-dry').value:'')||null;
  const lai=la?la/15239.96:null;
  const agdm=(ldr&&sdr)?(ldr-bagWt)+(sdr-bagWt):null;
  if (!currentSession.plots[currentPlotKey]) currentSession.plots[currentPlotKey]={};
  Object.assign(currentSession.plots[currentPlotKey],{
    gps_lat,gps_lng,count1:c1,count2:c2,plants_m2:pm2?pm2.toFixed(1):null,
    h1:heights[0],h2:heights[1],h3:heights[2],h4:heights[3],h5:heights[4],
    avg_height:avgH?avgH.toFixed(1):null,
    l1:leaves[0],l2:leaves[1],l3:leaves[2],l4:leaves[3],l5:leaves[4],
    avg_leaves:avgL?avgL.toFixed(1):null,
    notes:document.getElementById('f-notes')?document.getElementById('f-notes').value:'',
    field_saved:validH.length>0||c1!==null,
    leaf_area:la,bag_weight:bagWt||null,
    cal_actual:parseFloat(document.getElementById('lab-cal-actual')?document.getElementById('lab-cal-actual').value:'')||null,
    cal_machine:parseFloat(document.getElementById('lab-cal-machine')?document.getElementById('lab-cal-machine').value:'')||null,
    leaf_wet_raw:lwr,stem_wet_raw:swr,leaf_dry_raw:ldr,stem_dry_raw:sdr,
    leaf_wet:lwr!==null?lwr-bagWt:null,stem_wet:swr!==null?swr-bagWt:null,
    leaf_dry:ldr!==null?ldr-bagWt:null,stem_dry:sdr!==null?sdr-bagWt:null,
    lai,agdm,
    lab_notes:document.getElementById('lab-notes')?document.getElementById('lab-notes').value:'',
    lab_saved:la!==null||ldr!==null
  });
  saveCurrentSession(); showToast('Saved \u2713'); setTimeout(function(){backToSessionMenu();},800);
}

function openRefEntry(key,quadrant,row) {
  currentPlotKey=key; currentMode='ref';
  const data=currentSession.refs[key]||{};
  document.getElementById('field-entry-title').textContent=quadrant+' \u00b7 '+row;
  document.getElementById('field-entry-badge').textContent='REF ROW';
  document.getElementById('field-entry-badge').className='badge';
  document.getElementById('field-entry-form').innerHTML=
    '<div class="form-section-title">PLANT HEIGHT (inches) \u2014 5 Plants</div>'+
    '<div class="field-group"><div class="plant-grid">'+
    [1,2,3,4,5].map(function(i){const n=i<5?'f-h'+(i+1):'f-l1';
      return '<div class="plant-input-wrap"><span>P'+i+'</span>'+
        '<input type="number" inputmode="decimal" id="f-h'+i+'" value="'+(data['h'+i]||'')+'"'+
        ' oninput="calcAvg(\'f-h\',\'f-avg-height\')" onchange="autoAdvance(this,\''+n+'\')"></div>';}).join('')+
    '</div><div class="avg-display" id="f-avg-height">Avg: '+(data.avg_height?data.avg_height+' in':'\u2014')+'</div></div>'+
    '<div class="form-section-title">LEAF COUNT \u2014 5 Plants</div>'+
    '<div class="field-group"><div class="plant-grid">'+
    [1,2,3,4,5].map(function(i){const n=i<5?'f-l'+(i+1):'f-notes';
      return '<div class="plant-input-wrap"><span>P'+i+'</span>'+
        '<input type="number" inputmode="numeric" id="f-l'+i+'" value="'+(data['l'+i]||'')+'"'+
        ' oninput="calcAvg(\'f-l\',\'f-avg-leaves\')" onchange="autoAdvance(this,\''+n+'\')"></div>';}).join('')+
    '</div><div class="avg-display" id="f-avg-leaves">Avg: '+(data.avg_leaves?data.avg_leaves+' leaves':'\u2014')+'</div></div>'+
    '<div class="field-group"><label>Notes / Flag</label>'+
    '<textarea id="f-notes" placeholder="e.g. flag, bugs...">'+(data.notes||'')+'</textarea></div>';
  showScreen('screen-field-entry');
}
function saveRefEntry() {
  const heights=[1,2,3,4,5].map(function(i){return parseFloat(document.getElementById('f-h'+i)?document.getElementById('f-h'+i).value:'')||null;});
  const leaves=[1,2,3,4,5].map(function(i){return parseFloat(document.getElementById('f-l'+i)?document.getElementById('f-l'+i).value:'')||null;});
  const validH=heights.filter(function(v){return v!==null;});
  const validL=leaves.filter(function(v){return v!==null;});
  const avgH=validH.length?(validH.reduce(function(a,b){return a+b;},0)/validH.length):null;
  const avgL=validL.length?(validL.reduce(function(a,b){return a+b;},0)/validL.length):null;
  if (!currentSession.refs[currentPlotKey]) currentSession.refs[currentPlotKey]={};
  Object.assign(currentSession.refs[currentPlotKey],{
    h1:heights[0],h2:heights[1],h3:heights[2],h4:heights[3],h5:heights[4],
    avg_height:avgH?avgH.toFixed(1):null,
    l1:leaves[0],l2:leaves[1],l3:leaves[2],l4:leaves[3],l5:leaves[4],
    avg_leaves:avgL?avgL.toFixed(1):null,
    notes:document.getElementById('f-notes')?document.getElementById('f-notes').value:'',saved:true
  });
  saveCurrentSession(); showToast('Saved \u2713'); setTimeout(function(){backToSessionMenu();},800);
}

function openLysEntry(key,quadrant) {
  currentPlotKey=key; currentMode='lys';
  const data=currentSession.lys[key]||{};
  document.getElementById('field-entry-title').textContent=quadrant+' Box';
  document.getElementById('field-entry-badge').textContent='LYSIMETER';
  document.getElementById('field-entry-badge').className='badge lysimeter';
  document.getElementById('field-entry-form').innerHTML=
    '<div class="form-section-title">PLANT HEIGHT (inches) \u2014 5 Plants</div>'+
    '<div class="field-group"><div class="plant-grid">'+
    [1,2,3,4,5].map(function(i){const n=i<5?'f-h'+(i+1):'f-l1';
      return '<div class="plant-input-wrap"><span>P'+i+'</span>'+
        '<input type="number" inputmode="decimal" id="f-h'+i+'" value="'+(data['h'+i]||'')+'"'+
        ' oninput="calcAvg(\'f-h\',\'f-avg-height\')" onchange="autoAdvance(this,\''+n+'\')"></div>';}).join('')+
    '</div><div class="avg-display" id="f-avg-height">Avg: '+(data.avg_height?data.avg_height+' in':'\u2014')+'</div></div>'+
    '<div class="form-section-title">LEAF COUNT \u2014 5 Plants</div>'+
    '<div class="field-group"><div class="plant-grid">'+
    [1,2,3,4,5].map(function(i){const n=i<5?'f-l'+(i+1):'f-notes';
      return '<div class="plant-input-wrap"><span>P'+i+'</span>'+
        '<input type="number" inputmode="numeric" id="f-l'+i+'" value="'+(data['l'+i]||'')+'"'+
        ' oninput="calcAvg(\'f-l\',\'f-avg-leaves\')" onchange="autoAdvance(this,\''+n+'\')"></div>';}).join('')+
    '</div><div class="avg-display" id="f-avg-leaves">Avg: '+(data.avg_leaves?data.avg_leaves+' leaves':'\u2014')+'</div></div>'+
    '<div class="field-group"><label>Notes</label>'+
    '<textarea id="f-notes" placeholder="Observations...">'+(data.notes||'')+'</textarea></div>';
  showScreen('screen-field-entry');
}
function saveLysEntry() {
  const heights=[1,2,3,4,5].map(function(i){return parseFloat(document.getElementById('f-h'+i)?document.getElementById('f-h'+i).value:'')||null;});
  const leaves=[1,2,3,4,5].map(function(i){return parseFloat(document.getElementById('f-l'+i)?document.getElementById('f-l'+i).value:'')||null;});
  const validH=heights.filter(function(v){return v!==null;});
  const validL=leaves.filter(function(v){return v!==null;});
  const avgH=validH.length?(validH.reduce(function(a,b){return a+b;},0)/validH.length):null;
  const avgL=validL.length?(validL.reduce(function(a,b){return a+b;},0)/validL.length):null;
  if (!currentSession.lys[currentPlotKey]) currentSession.lys[currentPlotKey]={};
  Object.assign(currentSession.lys[currentPlotKey],{
    h1:heights[0],h2:heights[1],h3:heights[2],h4:heights[3],h5:heights[4],
    avg_height:avgH?avgH.toFixed(1):null,
    l1:leaves[0],l2:leaves[1],l3:leaves[2],l4:leaves[3],l5:leaves[4],
    avg_leaves:avgL?avgL.toFixed(1):null,
    notes:document.getElementById('f-notes')?document.getElementById('f-notes').value:'',saved:true
  });
  saveCurrentSession(); showToast('Saved \u2713'); setTimeout(function(){backToSessionMenu();},800);
}

// --- HARVEST ENTRY ---
function openHarvestEntry(key) {
  currentPlotKey = key;
  const data = currentSession.harvest[key] || {};
  const bw = getBW();
  const label = key.indexOf('_BOX')>=0 ? key.replace('_BOX',' Box') : key;
  document.getElementById('harvest-entry-title').textContent = label;

  // Pre-calculate displayed nets from saved raw values
  const zipG = bw.ziplock || 0;
  const purpleG = bw.purple || 0;
  const brownG = bw.brownPaper || 0;
  const totalBagG = purpleG + brownG;
  const totalBagLbs = totalBagG / LBS_TO_G;

  const nutrientNet = data.nutrient_wt_raw !== null && data.nutrient_wt_raw !== undefined ? (data.nutrient_wt_raw - zipG).toFixed(2)+' g net' : '\u2014';
  const bwetNet = data.biomass_wet_lbs_raw !== null && data.biomass_wet_lbs_raw !== undefined ?
    ((data.biomass_wet_lbs_raw - totalBagLbs).toFixed(4)+' lbs / '+((data.biomass_wet_lbs_raw - totalBagLbs)*LBS_TO_G).toFixed(1)+' g net') : '\u2014';
  const bsubNet = data.biomass_sub_wet_raw !== null && data.biomass_sub_wet_raw !== undefined ? (data.biomass_sub_wet_raw - purpleG).toFixed(2)+' g net' : '\u2014';

  document.getElementById('harvest-entry-form').innerHTML =
    '<div class="form-section-title">SESSION BAG WEIGHTS (reference)</div>'+
    '<div style="background:#f5f5f5;border-radius:8px;padding:10px 14px;font-size:13px;color:#555;display:flex;gap:16px;flex-wrap:wrap;">'+
    '<span>\ud83d\udcbc Zip Lock: <b>'+(bw.ziplock||'?')+' g</b></span>'+
    '<span>\ud83d\udfe3 Purple: <b>'+(bw.purple||'?')+' g</b></span>'+
    '<span>\ud83d\udfe4 Brown Paper: <b>'+(bw.brownPaper||'?')+' g</b></span></div>'+

    '<div class="field-group"><label>Plot Length (ft)</label>'+
    '<input type="number" inputmode="decimal" id="h-plot-ft" value="'+(data.plot_ft||'')+'" placeholder="e.g. 60"></div>'+

    '<div class="form-section-title">NUTRIENT SAMPLE</div>'+
    '<div class="field-group"><label>Nutrient Sample Weight (g) <span style="font-size:11px;color:#999;">zip lock subtracted by app</span></label>'+
    '<input type="number" inputmode="decimal" id="h-nutrient-wt" value="'+(data.nutrient_wt_raw||'')+'" oninput="calcHarvestWeights()" placeholder="Raw weight with bag"></div>'+
    '<div class="field-group"><label>Net Nutrient Weight</label>'+
    '<div class="calc-field'+(data.nutrient_wt_raw!==undefined?' has-value':'')+'" id="h-nutrient-net">'+nutrientNet+'</div></div>'+

    '<div class="form-section-title">BIOMASS WET</div>'+
    '<div class="field-group"><label>Biomass Wet Weight (lbs) <span style="font-size:11px;color:#999;">purple + brown bag subtracted by app</span></label>'+
    '<input type="number" inputmode="decimal" id="h-biomass-wet-lbs" value="'+(data.biomass_wet_lbs_raw||'')+'" oninput="calcHarvestWeights()" placeholder="Raw weight with bags"></div>'+
    '<div class="field-group"><label>Net Biomass Wet Weight</label>'+
    '<div class="calc-field'+(data.biomass_wet_lbs_raw!==undefined?' has-value':'')+'" id="h-biomass-wet-net">'+bwetNet+'</div></div>'+

    '<div class="form-section-title">BIOMASS SUB WET</div>'+
    '<div class="field-group"><label>Biomass Sub Wet Weight (g) <span style="font-size:11px;color:#999;">purple bag subtracted by app</span></label>'+
    '<input type="number" inputmode="decimal" id="h-biomass-sub-wet" value="'+(data.biomass_sub_wet_raw||'')+'" oninput="calcHarvestWeights()" placeholder="Raw weight with purple bag"></div>'+
    '<div class="field-group"><label>Net Biomass Sub Wet Weight</label>'+
    '<div class="calc-field'+(data.biomass_sub_wet_raw!==undefined?' has-value':'')+'" id="h-biomass-sub-net">'+bsubNet+'</div></div>'+

    '<div class="field-group"><label>Notes</label>'+
    '<textarea id="h-notes" placeholder="Any observations...">'+(data.notes||'')+'</textarea></div>';

  showScreen('screen-harvest-entry');
}

function saveHarvestEntry() {
  const bw = getBW();
  const zipG = bw.ziplock || 0;
  const purpleG = bw.purple || 0;
  const brownG = bw.brownPaper || 0;
  const totalBagG = purpleG + brownG;
  const totalBagLbs = totalBagG / LBS_TO_G;

  const nutRaw = parseFloat(document.getElementById('h-nutrient-wt').value) || null;
  const bwetRaw = parseFloat(document.getElementById('h-biomass-wet-lbs').value) || null;
  const bsubRaw = parseFloat(document.getElementById('h-biomass-sub-wet').value) || null;

  if (!currentSession.harvest[currentPlotKey]) currentSession.harvest[currentPlotKey] = {};
  Object.assign(currentSession.harvest[currentPlotKey], {
    plot_ft: parseFloat(document.getElementById('h-plot-ft').value) || null,
    nutrient_wt_raw: nutRaw,
    nutrient_wt_net: nutRaw !== null ? nutRaw - zipG : null,
    biomass_wet_lbs_raw: bwetRaw,
    biomass_wet_lbs_net: bwetRaw !== null ? bwetRaw - totalBagLbs : null,
    biomass_wet_g_net: bwetRaw !== null ? (bwetRaw - totalBagLbs) * LBS_TO_G : null,
    biomass_sub_wet_raw: bsubRaw,
    biomass_sub_wet_net: bsubRaw !== null ? bsubRaw - purpleG : null,
    notes: document.getElementById('h-notes').value || '',
    saved: true
  });
  saveCurrentSession(); showToast('Saved \u2713'); setTimeout(function(){backToSessionMenu();},800);
}

// --- DRYING LOG ---
function isPlotStable(key) {
  const log = currentSession.dryingLog || {};
  const entries = log[key] || [];
  const filled = entries.filter(function(e){return e.net !== null && e.net !== undefined;});
  if (filled.length < 2) return false;
  const last2 = filled.slice(-2);
  const w1 = last2[0].net, w2 = last2[1].net;
  if (!w1 || w1 === 0) return false;
  return Math.abs(w2 - w1) / w1 <= STABILITY_THRESHOLD;
}
function getDryingStableCount() {
  if (!currentSession) return 0;
  return getAllHarvestPlotKeys().filter(function(k){return isPlotStable(k);}).length;
}
function getFinalDryWeight(key) {
  const log = currentSession.dryingLog || {};
  const entries = log[key] || [];
  const filled = entries.filter(function(e){return e.net !== null && e.net !== undefined;});
  if (!filled.length) return null;
  return filled[filled.length-1].net;
}

function openDryingLog() {
  if (!currentSession.dryingLog) currentSession.dryingLog = {};
  // Initialize entries for all plots if not exists
  getAllHarvestPlotKeys().forEach(function(key){
    if (!currentSession.dryingLog[key]) {
      currentSession.dryingLog[key] = Array(10).fill(null).map(function(){return {date:'',raw:null,net:null};});
    }
    // Ensure always 10 slots
    while (currentSession.dryingLog[key].length < 10) {
      currentSession.dryingLog[key].push({date:'',raw:null,net:null});
    }
  });
  document.getElementById('drying-info-bar').textContent =
    currentSession.date+' \u00b7 '+currentSession.side+' \u00b7 '+currentSession.crop;
  renderDryingLog();
  showScreen('screen-drying-log');
}

function renderDryingLog() {
  const keys = getAllHarvestPlotKeys();
  const bw = getBW();
  const purpleG = bw.purple || 0;
  const brownG = bw.brownPaper || 0;
  const totalBagG = purpleG + brownG;
  const stable = getDryingStableCount();
  const total = keys.length;
  const allStable = stable === total;
  const content = document.getElementById('drying-log-content');

  let html = '<div style="margin:12px 16px;padding:12px 16px;border-radius:10px;background:'+
    (allStable?'#e8f5e8':'#fff8e8')+';border:1.5px solid '+(allStable?'#c3e6c3':'#f0c060')+';">'+
    '<div style="font-weight:700;font-size:15px;color:'+(allStable?'#2d6a2d':'#c17f24')+';">'+
    (allStable?'\u2705 All samples stable!':'\ud83d\udd04 '+stable+' of '+total+' samples stable')+'</div>'+
    '<div style="font-size:12px;color:#777;margin-top:2px;">Bags subtracted: purple ('+purpleG+'g) + brown ('+brownG+'g) = '+totalBagG+'g total</div>'+
    '<div style="font-size:12px;color:#777;">Threshold: \u22641% change between last two weighings</div></div>';

  keys.forEach(function(key){
    const label = key.indexOf('_BOX')>=0 ? key.replace('_BOX',' Box') : key;
    const entries = (currentSession.dryingLog[key] || []);
    const plotStable = isPlotStable(key);

    html += '<div style="margin:0 16px 16px;background:#fff;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.08);overflow:hidden;">'+
      '<div style="padding:12px 14px;background:'+(plotStable?'#e8f5e8':'#f5f5f5')+';display:flex;justify-content:space-between;align-items:center;">'+
      '<span style="font-weight:700;font-size:15px;">'+label+'</span>'+
      '<span style="font-size:18px;">'+(plotStable?'\u2705':'\ud83d\udd04')+'</span></div>';

    entries.forEach(function(entry,idx){
      const filled = entry.raw !== null && entry.raw !== undefined && entry.raw !== '';
      const net = filled ? (parseFloat(entry.raw) - totalBagG) : null;
      // Calculate % change from previous filled entry
      let pctHtml = '';
      if (filled && idx > 0) {
        const prevFilled = entries.slice(0,idx).filter(function(e){return e.raw!==null&&e.raw!==undefined&&e.raw!=='';});
        if (prevFilled.length > 0) {
          const prevNet = parseFloat(prevFilled[prevFilled.length-1].raw) - totalBagG;
          if (prevNet > 0) {
            const pct = Math.abs(net - prevNet) / prevNet * 100;
            const isStable = pct <= 1;
            pctHtml = '<span style="font-size:12px;font-weight:600;color:'+(isStable?'#2d6a2d':'#c17f24')+';">'+pct.toFixed(2)+'% '+(isStable?'\u2705':'\ud83d\udd04')+'</span>';
          }
        }
      }
      html += '<div style="padding:10px 14px;border-top:1px solid #f0f0f0;display:grid;grid-template-columns:140px 1fr 1fr;gap:8px;align-items:center;">'+
        '<input type="date" style="border:1.5px solid #e0e0e0;border-radius:6px;padding:6px 8px;font-size:13px;width:100%;" '+
        'value="'+(entry.date||'')+'" onchange="updateDryDate(\''+key+'\','+idx+',this.value)">'+
        '<div style="display:flex;flex-direction:column;gap:2px;">'+
        '<input type="number" inputmode="decimal" style="border:1.5px solid #e0e0e0;border-radius:6px;padding:6px 8px;font-size:14px;width:100%;" '+
        'placeholder="Raw wt (g)" value="'+(entry.raw!==null&&entry.raw!==undefined?entry.raw:'')+'" '+
        'onchange="updateDryWeight(\''+key+'\','+idx+',this.value)">'+
        (filled?'<span style="font-size:11px;color:#2d6a2d;font-weight:600;padding-left:4px;">Net: '+(net.toFixed(2))+'g</span>':'')+'</div>'+
        '<div style="font-size:12px;color:#777;">'+pctHtml+'</div></div>';
    });
    html += '</div>';
  });
  content.innerHTML = html;
}

function updateDryDate(key, idx, value) {
  if (!currentSession.dryingLog[key]) return;
  currentSession.dryingLog[key][idx].date = value;
  saveCurrentSession();
}
function updateDryWeight(key, idx, value) {
  if (!currentSession.dryingLog[key]) return;
  const raw = value ? parseFloat(value) : null;
  const bw = getBW();
  const totalBagG = (bw.purple||0) + (bw.brownPaper||0);
  currentSession.dryingLog[key][idx].raw = raw;
  currentSession.dryingLog[key][idx].net = raw !== null ? raw - totalBagG : null;
  saveCurrentSession();
  renderDryingLog();
}

// --- SESSIONS LIST ---
function renderSessionsList() {
  const sessions = getSessions();
  const list = document.getElementById('sessions-list');
  const all = Object.values(sessions).sort(function(a,b){return b.id-a.id;});
  if (!all.length){list.innerHTML='<p style="color:#999;text-align:center;padding:40px;">No sessions yet</p>';return;}
  list.innerHTML = all.map(function(s){
    return '<div class="session-card">'+
      '<div class="session-card-info" onclick="openSession(\''+s.id+'\')" style="flex:1;cursor:pointer;">'+
      '<h3>'+s.date+' \u00b7 '+s.side+'</h3><p>'+s.crop+' \u00b7 '+s.year+' \u00b7 '+s.type+'</p></div>'+
      '<button class="btn-delete" onclick="deleteSession(\''+s.id+'\')">\ud83d\uddd1</button></div>';
  }).join('');
}
function deleteSession(id) {
  if (!confirm('Delete this session? This cannot be undone.')) return;
  const s=getSessions(); delete s[id]; saveSessionsData(s);
  renderSessionsList(); showToast('Session deleted');
}
function openSession(id) {
  const s=getSessions(); currentSession=s[id];
  selectedSide=currentSession.side; selectedSessionType=currentSession.type;
  if (!currentSession.harvest) currentSession.harvest={};
  if (!currentSession.dryingLog) currentSession.dryingLog={};
  if (!currentSession.bagWeights) currentSession.bagWeights={};
  showScreen('screen-session-menu'); renderSessionMenu();
}

// --- EXPORT ---
function exportSession() {
  if (!currentSession) return;
  showToast('Preparing export...');
  const date=currentSession.date, doy=getDOY(date);
  const sideChar=currentSession.side.charAt(0);
  const isHarvest=currentSession.type==='Harvest';
  const bw=getBW();

  // Sheet 1: Summary
  const summaryHeader=['Date','DOY','Plot Name','Growth Stage/#Leaves','Plot Size m2',
    'Row 1 Count','Row 2 Count','# Plants/m2','Plant Height in','Plant Height m','Leaf Area cm2',
    'Leaf Wet Weight g','Stem Wet Weight g','Leaf Dry Weight g','Stem Dry Weight g',
    'LAI','Above Ground Dry Matter g/m2','GPS Lat','GPS Lng',
    'Cal Card Actual cm2','Cal Machine Reading cm2','Notes'];
  const summaryRows=[summaryHeader];
  SPANS.forEach(function(span){['A','B'].forEach(function(ab){
    const key=span+sideChar+ab, d=currentSession.plots[key]||{};
    const hm=d.avg_height?parseFloat((parseFloat(d.avg_height)*0.0254).toFixed(4)):'';
    summaryRows.push([date,doy,key,
      d.avg_leaves?parseFloat(d.avg_leaves):'',1.524,
      d.count1||'',d.count2||'',d.plants_m2?parseFloat(d.plants_m2):'',
      d.avg_height?parseFloat(d.avg_height):'',hm,
      d.leaf_area||'',d.leaf_wet||'',d.stem_wet||'',
      d.leaf_dry||'',d.stem_dry||'',
      d.lai?parseFloat(parseFloat(d.lai).toFixed(6)):'',
      d.agdm?parseFloat(parseFloat(d.agdm).toFixed(2)):'',
      d.gps_lat||'',d.gps_lng||'',
      d.cal_actual||'',d.cal_machine||'',
      (d.notes||'')+(d.lab_notes?' | '+d.lab_notes:'')
    ]);
  });});
  QUADRANTS.forEach(function(q){ROWS.forEach(function(r){
    const key=q+'_'+r, d=currentSession.refs[key]||{};
    const hm=d.avg_height?parseFloat((parseFloat(d.avg_height)*0.0254).toFixed(4)):'';
    summaryRows.push([date,doy,q+' '+r,d.avg_leaves?parseFloat(d.avg_leaves):'',1.524,'','','',
      d.avg_height?parseFloat(d.avg_height):'',hm,'','','','','','','','','','','',d.notes||'']);
  });});

  // Sheet 2: Individual readings
  const plantHeader=['Date','DOY','Plot Name','H1 in','H2 in','H3 in','H4 in','H5 in','Avg Height in','L1','L2','L3','L4','L5','Avg Leaves'];
  const plantRows=[plantHeader];
  SPANS.forEach(function(span){['A','B'].forEach(function(ab){
    const key=span+sideChar+ab, d=currentSession.plots[key]||{};
    plantRows.push([date,doy,key,d.h1||'',d.h2||'',d.h3||'',d.h4||'',d.h5||'',
      d.avg_height?parseFloat(d.avg_height):'',d.l1||'',d.l2||'',d.l3||'',d.l4||'',d.l5||'',
      d.avg_leaves?parseFloat(d.avg_leaves):'']);
  });});
  QUADRANTS.forEach(function(q){ROWS.forEach(function(r){
    const key=q+'_'+r, d=currentSession.refs[key]||{};
    plantRows.push([date,doy,q+' '+r,d.h1||'',d.h2||'',d.h3||'',d.h4||'',d.h5||'',
      d.avg_height?parseFloat(d.avg_height):'',d.l1||'',d.l2||'',d.l3||'',d.l4||'',d.l5||'',
      d.avg_leaves?parseFloat(d.avg_leaves):'']);
  });});

  // Sheets 3 & 4: Harvest
  let harvestRows=null, dryingRows=null;
  if (isHarvest) {
    const harvestHeader=['Plot Name','Plot Ft',
      'Nutrient Wt Raw (g)','Nutrient Wt Net (g, -ziplock)',
      'Biomass Wet Raw (lbs)','Biomass Wet Net (lbs)','Biomass Wet Net (g)',
      'Biomass Sub Wet Raw (g)','Biomass Sub Wet Net (g, -purple)',
      'Zip Lock Bag (g)','Purple Bag (g)','Brown Paper Bag (g)',
      'Biomass Sub Dry Wt Final (g)','Notes'];
    harvestRows=[harvestHeader];
    getAllHarvestPlotKeys().forEach(function(key){
      const h=currentSession.harvest[key]||{};
      const label=key.indexOf('_BOX')>=0?key.replace('_BOX',' Box'):key;
      harvestRows.push([label,h.plot_ft||'',
        h.nutrient_wt_raw||'',h.nutrient_wt_net!==null&&h.nutrient_wt_net!==undefined?h.nutrient_wt_net.toFixed(2):'',
        h.biomass_wet_lbs_raw||'',
        h.biomass_wet_lbs_net!==null&&h.biomass_wet_lbs_net!==undefined?h.biomass_wet_lbs_net.toFixed(4):'',
        h.biomass_wet_g_net!==null&&h.biomass_wet_g_net!==undefined?h.biomass_wet_g_net.toFixed(1):'',
        h.biomass_sub_wet_raw||'',
        h.biomass_sub_wet_net!==null&&h.biomass_sub_wet_net!==undefined?h.biomass_sub_wet_net.toFixed(2):'',
        bw.ziplock||'',bw.purple||'',bw.brownPaper||'',
        getFinalDryWeight(key)||'',h.notes||''
      ]);
    });

    // Drying log sheet
    const totalBagG=(bw.purple||0)+(bw.brownPaper||0);
    const dryingHeader=['Plot Name','Weigh #','Date','Raw Weight (g)','Net Weight (g)','% Change','Stable?'];
    dryingRows=[dryingHeader];
    getAllHarvestPlotKeys().forEach(function(key){
      const label=key.indexOf('_BOX')>=0?key.replace('_BOX',' Box'):key;
      const entries=(currentSession.dryingLog[key]||[]).filter(function(e){return e.raw!==null&&e.raw!==undefined&&e.raw!=='';});
      entries.forEach(function(entry,idx){
        const net=parseFloat(entry.raw)-totalBagG;
        let pct='', stab='';
        if (idx>0) {
          const prevNet=parseFloat(entries[idx-1].raw)-totalBagG;
          if (prevNet>0){pct=(Math.abs(net-prevNet)/prevNet*100).toFixed(2)+'%';stab=Math.abs(net-prevNet)/prevNet<=STABILITY_THRESHOLD?'Yes':'No';}
        }
        dryingRows.push([label,idx+1,entry.date||'',parseFloat(entry.raw),net.toFixed(2),pct,stab]);
      });
    });
  }

  if (typeof XLSX==='undefined') {
    showToast('Loading export library...');
    const script=document.createElement('script');
    script.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    script.onload=function(){buildXLSX(summaryRows,plantRows,harvestRows,dryingRows,date);};
    document.head.appendChild(script);
  } else { buildXLSX(summaryRows,plantRows,harvestRows,dryingRows,date); }
}
function buildXLSX(summaryRows,plantRows,harvestRows,dryingRows,date) {
  const wb=XLSX.utils.book_new();
  const isHarvest=currentSession.type==='Harvest';
  if (isHarvest) {
    // Harvest export: Harvest Data + Drying Log only
    if (harvestRows) XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(harvestRows),'Harvest Data');
    if (dryingRows) XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(dryingRows),'Drying Log');
    XLSX.writeFile(wb,'harvest_data_'+currentSession.side+'_'+date+'.xlsx');
  } else {
    // Weekly export: Summary + Individual Readings only
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(summaryRows),'Summary');
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(plantRows),'Individual Readings');
    XLSX.writeFile(wb,'field_data_'+currentSession.side+'_'+date+'.xlsx');
  }
  showToast('Export ready!');
}
function getDOY(dateStr) {
  const d=new Date(dateStr);
  return Math.floor((d-new Date(d.getFullYear(),0,0))/86400000);
}
function showToast(msg) {
  const el=document.getElementById('toast');
  el.textContent=msg; el.classList.add('show');
  setTimeout(function(){el.classList.remove('show');},2500);
}
window.addEventListener('load',function(){renderHome();});
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(regs){regs.forEach(function(r){r.unregister();});});
}

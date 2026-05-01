// ============================================
// FIELD SAMPLER PWA - App Logic
// ============================================

const SPANS = [2, 3, 4, 7, 8, 9];
const LYSIMETER_SPANS = [3, 8];
const QUADRANTS = ['NE', 'NW', 'SE', 'SW'];
const ROWS = ['R1', 'R2', 'R3', 'R4'];
const STABILITY_THRESHOLD = 0.01;

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
    dryingLog: { dates: [], weights: {} },
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

function getHarvestBoxKeys() {
  // East = NE + SE, West = NW + SW
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

  // Destructive plots
  const plotList = document.getElementById('plot-list');
  plotList.innerHTML = '';
  SPANS.forEach(function(span){
    ['A','B'].forEach(function(ab){
      const key=span+sideChar+ab;
      const data=currentSession.plots[key]||{};
      const isLys=LYSIMETER_SPANS.indexOf(span)>=0;
      const item=document.createElement('div');
      item.className='plot-item'+(isLys?' lysimeter':'');
      item.innerHTML='<div style="flex:1"><div class="plot-item-name">Span '+span+sideChar+' \u00b7 '+ab+'</div>'+
        '<div class="plot-item-sub">'+(isLys?'\ud83e\uddea Lysimeter span':'Destructive sample')+'</div></div>'+
        '<div class="status-dots"><div class="dot'+(data.field_saved?' filled-field':'')+'"></div>'+
        '<div class="dot'+(data.lab_saved?' filled-lab':'')+'"></div></div>'+
        '<span style="font-size:20px;color:#bbb">\u203a</span>';
      item.onclick=(function(k){return function(){openPlotEntry(k);};})(key);
      plotList.appendChild(item);
    });
  });

  // Reference rows
  const refList=document.getElementById('ref-list');
  refList.innerHTML='';
  QUADRANTS.forEach(function(q){
    ROWS.forEach(function(r){
      const key=q+'_'+r;
      const data=currentSession.refs[key]||{};
      const item=document.createElement('div');
      item.className='plot-item';
      item.innerHTML='<div style="flex:1"><div class="plot-item-name">'+q+' \u00b7 '+r+'</div>'+
        '<div class="plot-item-sub">Reference row</div></div>'+
        '<div class="status-dots"><div class="dot'+(data.saved?' filled-lab':'')+'"></div></div>'+
        '<span style="font-size:20px;color:#bbb">\u203a</span>';
      item.onclick=(function(k,qq,rr){return function(){openRefEntry(k,qq,rr);};})(key,q,r);
      refList.appendChild(item);
    });
  });

  // Lysimeter boxes (weekly height/leaf only)
  const lysList=document.getElementById('lys-list');
  lysList.innerHTML='';
  getHarvestBoxKeys().concat(
    currentSession.side==='East'?[]:[]
  );
  // Show all 4 quadrant boxes for weekly, side-appropriate for harvest
  const lysKeys = isHarvest ? getHarvestBoxKeys() : QUADRANTS.map(function(q){return q+'_BOX';});
  lysKeys.forEach(function(key){
    const q=key.replace('_BOX','');
    const data=currentSession.lys[key]||{};
    const item=document.createElement('div');
    item.className='plot-item lysimeter';
    item.innerHTML='<div style="flex:1"><div class="plot-item-name">'+q+' Box</div>'+
      '<div class="plot-item-sub">Height & leaf count</div></div>'+
      '<div class="status-dots"><div class="dot'+(data.saved?' filled-lab':'')+'"></div></div>'+
      '<span style="font-size:20px;color:#bbb">\u203a</span>';
    item.onclick=(function(k,qq){return function(){openLysEntry(k,qq);};})(key,q);
    lysList.appendChild(item);
  });

  // Harvest section
  const harvestSection=document.getElementById('harvest-section');
  const harvestList=document.getElementById('harvest-list');
  if (isHarvest) {
    harvestSection.style.display='block';
    harvestList.innerHTML='';
    getAllHarvestPlotKeys().forEach(function(key){
      const data=currentSession.harvest[key]||{};
      const label=key.indexOf('_BOX')>=0?key.replace('_BOX',' Box'):key;
      const item=document.createElement('div');
      item.className='plot-item'+(key.indexOf('_BOX')>=0?' lysimeter':'');
      item.innerHTML='<div style="flex:1"><div class="plot-item-name">'+label+'</div>'+
        '<div class="plot-item-sub">Harvest data</div></div>'+
        '<div class="status-dots"><div class="dot'+(data.saved?' filled-lab':'')+'"></div></div>'+
        '<span style="font-size:20px;color:#bbb">\u203a</span>';
      item.onclick=(function(k){return function(){openHarvestEntry(k);};})(key);
      harvestList.appendChild(item);
    });
    // Drying log button
    const stable=getDryingStableCount();
    const total=getAllHarvestPlotKeys().length;
    const log=currentSession.dryingLog||{dates:[]};
    const dryBtn=document.createElement('div');
    dryBtn.className='plot-item';
    dryBtn.style.background='#fff8e8';
    dryBtn.style.borderLeft='4px solid #c17f24';
    dryBtn.innerHTML='<div style="flex:1"><div class="plot-item-name">\ud83d\udcca Drying Log</div>'+
      '<div class="plot-item-sub">'+log.dates.length+' weigh date(s) \u00b7 '+stable+'/'+total+' stable</div></div>'+
      '<span style="font-size:20px;color:#bbb">\u203a</span>';
    dryBtn.onclick=function(){openDryingLog();};
    harvestList.appendChild(dryBtn);
  } else {
    harvestSection.style.display='none';
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
    '<div class="field-group"><label>LAI (auto-calculated)</label>'+
    '<div class="calc-field'+(data.lai?' has-value':'')+'" id="lab-lai">'+(data.lai?parseFloat(data.lai).toFixed(4):'\u2014')+'</div></div>'+
    '<div class="field-group"><label>Above Ground Dry Matter (g/m\u00b2)</label>'+
    '<div class="calc-field'+(data.agdm?' has-value':'')+'" id="lab-agdm">'+(data.agdm?parseFloat(data.agdm).toFixed(2)+' g/m\u00b2':'\u2014')+'</div></div>'+
    '<div class="field-group"><label>Lab Notes</label>'+
    '<textarea id="lab-notes" placeholder="Any issues with this sample...">'+(data.lab_notes||'')+'</textarea></div></div>';
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

// --- REF ROW ---
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

// --- LYSIMETER BOX (weekly height/leaf only) ---
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
  currentPlotKey=key;
  const data=currentSession.harvest[key]||{};
  const bw=currentSession.bagWeights||{};
  const label=key.indexOf('_BOX')>=0?key.replace('_BOX',' Box'):key;
  document.getElementById('harvest-entry-title').textContent=label;
  document.getElementById('harvest-entry-form').innerHTML=
    '<div class="field-group"><label>Plot Length (ft)</label>'+
    '<input type="number" inputmode="decimal" id="h-plot-ft" value="'+(data.plot_ft||'')+'" placeholder="e.g. 60"></div>'+
    '<div class="field-group"><label>Nutrient Sample Weight (g)</label>'+
    '<input type="number" inputmode="decimal" id="h-nutrient-wt" value="'+(data.nutrient_wt||'')+'"></div>'+
    '<div class="field-group"><label>Biomass Wet Weight (lbs)</label>'+
    '<input type="number" inputmode="decimal" id="h-biomass-wet-lbs" value="'+(data.biomass_wet_lbs||'')+'"></div>'+
    '<div class="field-group"><label>Biomass Sub Wet Weight (g) <span style="font-size:11px;color:#999;">purple bag subtracted</span></label>'+
    '<input type="number" inputmode="decimal" id="h-biomass-sub-wet" value="'+(data.biomass_sub_wet||'')+'"></div>'+
    '<div class="form-section-title">BAG WEIGHTS (session reference)</div>'+
    '<div class="field-group"><label>Zip Lock Bag Weight (g)</label>'+
    '<div class="calc-field has-value">'+(bw.ziplock||'\u2014')+'</div></div>'+
    '<div class="field-group"><label>Purple Bag Weight (g)</label>'+
    '<div class="calc-field has-value">'+(bw.purple||'\u2014')+'</div></div>'+
    '<div class="field-group"><label>Brown Paper Bag Avg Weight (g)</label>'+
    '<div class="calc-field has-value">'+(bw.brownPaper||'\u2014')+'</div></div>'+
    '<div class="field-group"><label>Notes</label>'+
    '<textarea id="h-notes" placeholder="Any observations...">'+(data.notes||'')+'</textarea></div>';
  showScreen('screen-harvest-entry');
}
function saveHarvestEntry() {
  if (!currentSession.harvest[currentPlotKey]) currentSession.harvest[currentPlotKey]={};
  Object.assign(currentSession.harvest[currentPlotKey],{
    plot_ft:parseFloat(document.getElementById('h-plot-ft').value)||null,
    nutrient_wt:parseFloat(document.getElementById('h-nutrient-wt').value)||null,
    biomass_wet_lbs:parseFloat(document.getElementById('h-biomass-wet-lbs').value)||null,
    biomass_sub_wet:parseFloat(document.getElementById('h-biomass-sub-wet').value)||null,
    notes:document.getElementById('h-notes').value||'',
    saved:true
  });
  saveCurrentSession(); showToast('Saved \u2713'); setTimeout(function(){backToSessionMenu();},800);
}

// --- DRYING LOG ---
function isPlotStable(key) {
  const log=currentSession.dryingLog;
  if (!log||log.dates.length<2) return false;
  const weights=log.weights[key]||{};
  const last=log.dates.slice(-2);
  const w1=parseFloat(weights[last[0]]);
  const w2=parseFloat(weights[last[1]]);
  if (isNaN(w1)||isNaN(w2)||w1===0) return false;
  return Math.abs(w2-w1)/w1<=STABILITY_THRESHOLD;
}
function getDryingStableCount() {
  if (!currentSession||!currentSession.dryingLog) return 0;
  if (currentSession.dryingLog.dates.length<2) return 0;
  return getAllHarvestPlotKeys().filter(function(k){return isPlotStable(k);}).length;
}
function getFinalDryWeight(key) {
  const log=currentSession.dryingLog;
  if (!log||!log.dates.length) return null;
  const weights=log.weights[key]||{};
  return weights[log.dates[log.dates.length-1]]||null;
}
function openDryingLog() {
  if (!currentSession.dryingLog) currentSession.dryingLog={dates:[],weights:{}};
  document.getElementById('drying-info-bar').textContent=
    currentSession.date+' \u00b7 '+currentSession.side+' \u00b7 '+currentSession.crop;
  renderDryingLog();
  showScreen('screen-drying-log');
}
function renderDryingLog() {
  const log=currentSession.dryingLog;
  const keys=getAllHarvestPlotKeys();
  const content=document.getElementById('drying-log-content');
  if (!log.dates.length) {
    content.innerHTML='<div style="padding:32px;text-align:center;color:#999;">'+
      '<div style="font-size:48px;margin-bottom:12px;">\u2696\ufe0f</div>'+
      '<div style="font-size:16px;font-weight:600;">No weigh dates yet</div>'+
      '<div style="font-size:14px;margin-top:8px;">Tap + Add Weigh Date to start tracking</div></div>';
    return;
  }
  const stable=getDryingStableCount();
  const total=keys.length;
  const allStable=stable===total;
  let html='<div style="margin:12px 16px;padding:12px 16px;border-radius:10px;background:'+
    (allStable?'#e8f5e8':'#fff8e8')+';border:1.5px solid '+(allStable?'#c3e6c3':'#f0c060')+';">'+
    '<div style="font-weight:700;font-size:15px;color:'+(allStable?'#2d6a2d':'#c17f24')+';">'+
    (allStable?'\u2705 All samples stable!':'\ud83d\udd04 '+stable+' of '+total+' samples stable')+'</div>'+
    '<div style="font-size:12px;color:#777;margin-top:2px;">Threshold: \u22641% change between last two weighings</div></div>';
  html+='<div style="overflow-x:auto;padding:0 16px 16px;"><table style="width:100%;border-collapse:collapse;font-size:13px;">';
  html+='<thead><tr style="background:#f5f5f5;"><th style="padding:8px 6px;text-align:left;font-weight:700;border-bottom:2px solid #ddd;white-space:nowrap;">Plot</th>';
  log.dates.forEach(function(d){html+='<th style="padding:8px 6px;text-align:center;font-weight:700;border-bottom:2px solid #ddd;white-space:nowrap;">'+d+'</th>';});
  if (log.dates.length>=2) {
    html+='<th style="padding:8px 6px;text-align:center;font-weight:700;border-bottom:2px solid #ddd;">% Chg</th>';
    html+='<th style="padding:8px 6px;text-align:center;font-weight:700;border-bottom:2px solid #ddd;">Status</th>';
  }
  html+='</tr></thead><tbody>';
  keys.forEach(function(key,idx){
    const label=key.indexOf('_BOX')>=0?key.replace('_BOX',' Box'):key;
    const weights=log.weights[key]||{};
    const stable=isPlotStable(key);
    html+='<tr style="background:'+(idx%2===0?'#fff':'#fafafa')+'">';
    html+='<td style="padding:8px 6px;font-weight:600;white-space:nowrap;">'+label+'</td>';
    log.dates.forEach(function(d){
      html+='<td style="padding:4px 2px;text-align:center;">'+
        '<input type="number" inputmode="decimal" '+
        'style="width:64px;text-align:center;padding:4px;border:1.5px solid #ddd;border-radius:6px;font-size:13px;" '+
        'value="'+(weights[d]||'')+'" '+
        'onchange="updateDryWeight(\''+key+'\',\''+d+'\',this.value)"></td>';
    });
    if (log.dates.length>=2) {
      const last=log.dates.slice(-2);
      const w1=parseFloat(weights[last[0]]);
      const w2=parseFloat(weights[last[1]]);
      let pct='\u2014';
      if (!isNaN(w1)&&!isNaN(w2)&&w1>0) pct=(Math.abs(w2-w1)/w1*100).toFixed(2)+'%';
      html+='<td style="padding:8px 6px;text-align:center;color:#555;">'+pct+'</td>';
      html+='<td style="padding:8px 6px;text-align:center;">'+(stable?'\u2705':'\ud83d\udd04')+'</td>';
    }
    html+='</tr>';
  });
  html+='</tbody></table></div>';
  content.innerHTML=html;
}
function updateDryWeight(key,date,value) {
  if (!currentSession.dryingLog.weights[key]) currentSession.dryingLog.weights[key]={};
  currentSession.dryingLog.weights[key][date]=value?parseFloat(value):null;
  saveCurrentSession();
  renderDryingLog();
}
function addDryingDate() {
  const date=prompt('Enter weigh date (YYYY-MM-DD):');
  if (!date) return;
  if (!currentSession.dryingLog) currentSession.dryingLog={dates:[],weights:{}};
  if (currentSession.dryingLog.dates.indexOf(date)>=0){showToast('Date already exists');return;}
  currentSession.dryingLog.dates.push(date);
  currentSession.dryingLog.dates.sort();
  saveCurrentSession();
  renderDryingLog();
  showToast('Added '+date);
}

// --- SESSIONS LIST ---
function renderSessionsList() {
  const sessions=getSessions();
  const list=document.getElementById('sessions-list');
  const all=Object.values(sessions).sort(function(a,b){return b.id-a.id;});
  if (!all.length){list.innerHTML='<p style="color:#999;text-align:center;padding:40px;">No sessions yet</p>';return;}
  list.innerHTML=all.map(function(s){
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
  if (!currentSession.dryingLog) currentSession.dryingLog={dates:[],weights:{}};
  if (!currentSession.bagWeights) currentSession.bagWeights={};
  showScreen('screen-session-menu'); renderSessionMenu();
}

// --- EXPORT ---
function exportSession() {
  if (!currentSession) return;
  showToast('Preparing export...');
  const date=currentSession.date;
  const doy=getDOY(date);
  const sideChar=currentSession.side.charAt(0);
  const isHarvest=currentSession.type==='Harvest';

  // Sheet 1: Summary
  const summaryHeader=['Date','DOY','Plot Name','Growth Stage/#Leaves','Plot Size m2',
    'Row 1 Count','Row 2 Count','# Plants/m2','Plant Height in','Plant Height m','Leaf Area cm2',
    'Leaf Wet Weight g','Stem Wet Weight g','Leaf Dry Weight g','Stem Dry Weight g',
    'LAI','Above Ground Dry Matter g/m2','GPS Lat','GPS Lng',
    'Cal Card Actual cm2','Cal Machine Reading cm2','Notes'];
  const summaryRows=[summaryHeader];
  SPANS.forEach(function(span){
    ['A','B'].forEach(function(ab){
      const key=span+sideChar+ab;
      const d=currentSession.plots[key]||{};
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
    });
  });
  QUADRANTS.forEach(function(q){
    ROWS.forEach(function(r){
      const key=q+'_'+r;
      const d=currentSession.refs[key]||{};
      const hm=d.avg_height?parseFloat((parseFloat(d.avg_height)*0.0254).toFixed(4)):'';
      summaryRows.push([date,doy,q+' '+r,
        d.avg_leaves?parseFloat(d.avg_leaves):'',1.524,'','','',
        d.avg_height?parseFloat(d.avg_height):'',hm,
        '','','','','','','','','','','',d.notes||'']);
    });
  });
  // Lysimeter boxes in summary (weekly height/leaf)
  const lysKeys=isHarvest?getHarvestBoxKeys():QUADRANTS.map(function(q){return q+'_BOX';});
  lysKeys.forEach(function(key){
    const q=key.replace('_BOX','');
    const d=currentSession.lys[key]||{};
    const hm=d.avg_height?parseFloat((parseFloat(d.avg_height)*0.0254).toFixed(4)):'';
    summaryRows.push([date,doy,q+' BOX',
      d.avg_leaves?parseFloat(d.avg_leaves):'','','','','',
      d.avg_height?parseFloat(d.avg_height):'',hm,
      '','','','','','','','','','','',d.notes||'']);
  });

  // Sheet 2: Individual readings
  const plantHeader=['Date','DOY','Plot Name',
    'H1 in','H2 in','H3 in','H4 in','H5 in','Avg Height in',
    'L1','L2','L3','L4','L5','Avg Leaves'];
  const plantRows=[plantHeader];
  SPANS.forEach(function(span){['A','B'].forEach(function(ab){
    const key=span+sideChar+ab;
    const d=currentSession.plots[key]||{};
    plantRows.push([date,doy,key,
      d.h1||'',d.h2||'',d.h3||'',d.h4||'',d.h5||'',
      d.avg_height?parseFloat(d.avg_height):'',
      d.l1||'',d.l2||'',d.l3||'',d.l4||'',d.l5||'',
      d.avg_leaves?parseFloat(d.avg_leaves):''
    ]);
  });});
  QUADRANTS.forEach(function(q){ROWS.forEach(function(r){
    const key=q+'_'+r; const d=currentSession.refs[key]||{};
    plantRows.push([date,doy,q+' '+r,
      d.h1||'',d.h2||'',d.h3||'',d.h4||'',d.h5||'',
      d.avg_height?parseFloat(d.avg_height):'',
      d.l1||'',d.l2||'',d.l3||'',d.l4||'',d.l5||'',
      d.avg_leaves?parseFloat(d.avg_leaves):''
    ]);
  });});
  lysKeys.forEach(function(key){
    const q=key.replace('_BOX',''); const d=currentSession.lys[key]||{};
    plantRows.push([date,doy,q+' BOX',
      d.h1||'',d.h2||'',d.h3||'',d.h4||'',d.h5||'',
      d.avg_height?parseFloat(d.avg_height):'',
      d.l1||'',d.l2||'',d.l3||'',d.l4||'',d.l5||'',
      d.avg_leaves?parseFloat(d.avg_leaves):''
    ]);
  });

  // Sheets 3 & 4: Harvest only
  let harvestRows=null, dryingRows=null;
  if (isHarvest) {
    const bw=currentSession.bagWeights||{};
    const harvestHeader=['Plot Name','Plot Ft','Nutrient Sample Wt g',
      'Biomass Wet Wt lbs','Biomass Sub Wet Wt g (purple bag subtracted)',
      'Zip Lock Bag Wt g','Purple Bag Wt g','Brown Paper Bag Avg Wt g',
      'Biomass Sub Dry Wt g Final','Notes'];
    harvestRows=[harvestHeader];
    getAllHarvestPlotKeys().forEach(function(key){
      const h=currentSession.harvest[key]||{};
      const label=key.indexOf('_BOX')>=0?key.replace('_BOX',' Box'):key;
      harvestRows.push([label,
        h.plot_ft||'',h.nutrient_wt||'',h.biomass_wet_lbs||'',h.biomass_sub_wet||'',
        bw.ziplock||'',bw.purple||'',bw.brownPaper||'',
        getFinalDryWeight(key)||'',h.notes||''
      ]);
    });

    const log=currentSession.dryingLog||{dates:[],weights:{}};
    if (log.dates.length) {
      const dryingHeader=['Plot Name'].concat(log.dates).concat(['% Last Change','Stable?','Final Dry Wt g']);
      dryingRows=[dryingHeader];
      getAllHarvestPlotKeys().forEach(function(key){
        const label=key.indexOf('_BOX')>=0?key.replace('_BOX',' Box'):key;
        const weights=log.weights[key]||{};
        const vals=log.dates.map(function(d){return weights[d]||'';});
        let pct='',stab='';
        if (log.dates.length>=2){
          const last=log.dates.slice(-2);
          const w1=parseFloat(weights[last[0]]);
          const w2=parseFloat(weights[last[1]]);
          if (!isNaN(w1)&&!isNaN(w2)&&w1>0){
            pct=(Math.abs(w2-w1)/w1*100).toFixed(2)+'%';
            stab=Math.abs(w2-w1)/w1<=STABILITY_THRESHOLD?'Yes':'No';
          }
        }
        dryingRows.push([label].concat(vals).concat([pct,stab,getFinalDryWeight(key)||'']));
      });
    }
  }

  if (typeof XLSX==='undefined') {
    showToast('Loading export library...');
    const script=document.createElement('script');
    script.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    script.onload=function(){buildXLSX(summaryRows,plantRows,harvestRows,dryingRows,date);};
    document.head.appendChild(script);
  } else {
    buildXLSX(summaryRows,plantRows,harvestRows,dryingRows,date);
  }
}
function buildXLSX(summaryRows,plantRows,harvestRows,dryingRows,date) {
  const wb=XLSX.utils.book_new();
  const ws1=XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb,ws1,'Summary');
  const ws2=XLSX.utils.aoa_to_sheet(plantRows);
  XLSX.utils.book_append_sheet(wb,ws2,'Individual Readings');
  if (harvestRows){const ws3=XLSX.utils.aoa_to_sheet(harvestRows);XLSX.utils.book_append_sheet(wb,ws3,'Harvest Data');}
  if (dryingRows){const ws4=XLSX.utils.aoa_to_sheet(dryingRows);XLSX.utils.book_append_sheet(wb,ws4,'Drying Log');}
  XLSX.writeFile(wb,'field_data_'+currentSession.side+'_'+date+'.xlsx');
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

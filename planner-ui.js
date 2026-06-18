/* ============================================================
   EZTube Layout Planner — UI
   Sections:
     1.  Palette data (assemblies, templates, type names, field defs)
     2.  Palette rendering (tabs, search, collapsible groups)
     3.  Layers panel
     4.  Selection model (multi-select, groups) & highlight
     5.  Properties panel
     6.  Status bar
     7.  Pointer interaction (drag, hover, wall-snap, image drag)
     8.  Measure mode
     9.  Draw-walls mode, outline presets, image calibration
     10. Keyboard shortcuts
     11. Views, camera, presentation mode
     12. Planning checks
     13. BOM modal (full / shopping list / layout objects) & exports
     14. PNG / print / summary exports
     15. Settings wiring & boot
   ============================================================ */

/* ---------- 1. palette data ---------- */
const TYPE_NAMES={wall:'Divider / Frame',booth:'Booth Frame',tube:'Tube',part:'Connector',
                  rwall:'Building Wall',lrun:'L Divider',urun:'U Enclosure',frame:'Tube Frame',
                  sign:'Hanging Sign',truss:'Stage Truss',paint:'Wall Paint',obj:'Object'};
function dispName(it){
  if(it.label) return it.label;
  if(it.type==='obj'){ const k=OBJ_KINDS[it.params.kind]; return (k?k.n:'Object')+' #'+it.id; }
  return (TYPE_NAMES[it.type]||it.type)+' #'+it.id;
}

const ASSEMBLIES = [
  {t:'wall', ic:'▤', n:'Divider Wall', d:'posts + rails, adj. feet', params:{w:6,h:8,sys:'QR',color:'BK',tubeColor:'SI',base:'feet',panel:true,bays:1}},
  {t:'wall', ic:'▤', n:'Straight Divider Run', d:'multi-panel run', params:{w:18,h:8,sys:'QR',color:'BK',tubeColor:'SI',base:'feet',panel:true,bays:3}},
  {t:'lrun', ic:'∟', n:'Corner / L Divider', d:'two arms at 90°', params:{w1:8,w2:8,h:8,sys:'QR',color:'BK',tubeColor:'SI',panel:true}},
  {t:'urun', ic:'⊔', n:'U Enclosure', d:'three-sided booth wall', params:{w:10,d:8,h:8,sys:'QR',color:'BK',tubeColor:'SI',panel:true}},
  {t:'wall', ic:'▦', n:'Banner / Sign Frame', d:'freestanding, T-base feet', params:{w:4,h:7,sys:'QR',color:'BK',tubeColor:'SI',base:'tubes',panel:true,bays:1}},
  {t:'sign', ic:'⌐', n:'Ceiling-Hung Sign Frame', d:'suspended from ceiling', params:{w:6,ph:2,elev:9,sys:'HF',color:'BK',tubeColor:'SI',panel:true}},
  {t:'booth', ic:'▣', n:'Booth / Bay Frame', d:'4-post room frame', params:{w:8,d:8,h:8,sys:'QR',color:'BK',tubeColor:'SI',midRail:false,bays:1}},
  {t:'booth', ic:'▣', n:'Room / Enclosure Frame', d:'multi-bay frame', params:{w:16,d:10,h:8,sys:'QR',color:'BK',tubeColor:'SI',midRail:false,bays:2}},
  {t:'wall', ic:'≡', n:'Queue Barrier / Railing', d:'42″ rail, no panel', params:{w:12,h:3.5,sys:'QR',color:'BK',tubeColor:'SI',base:'feet',panel:false,bays:2}},
  {t:'frame', ic:'☰', n:'Storage Shelf Frame', d:'perimeter rails + shelves', params:{w:4,d:1.5,h:6,levels:3,shelves:true,sys:'HF',color:'BK',tubeColor:'SI'}},
  {t:'frame', ic:'☰', n:'Equipment Rack Frame', d:'square rack', params:{w:2,d:2,h:6,levels:3,shelves:true,sys:'HF',color:'BK',tubeColor:'SI'}},
  {t:'frame', ic:'☰', n:'Display / Merch Frame', d:'retail display', params:{w:3,d:1.5,h:5,levels:2,shelves:true,sys:'HF',color:'BK',tubeColor:'SI'}},
  {t:'frame', ic:'▢', n:'Custom Box Frame', d:'w × d × h, optional levels', params:{w:4,d:4,h:6,levels:0,shelves:false,sys:'QR',color:'BK',tubeColor:'SI'}},
  {t:'tube', ic:'▬', n:'Single Tube', d:'custom cut length', params:{len:48,orient:'horizontal',tubeColor:'SI'}},
  {t:'rwall', ic:'▮', n:'Building Wall', d:'solid wall — not EZTube', params:{len:10,h:10,thick:5,color:'WH'}},
];

// Global Truss F-series stage-truss presets (all type:'truss')
const TRUSS_ASSEMBLIES = [
  {t:'truss', ic:'╥', n:'Goal Post Truss',   d:'2 towers + top beam',     params:{config:'goalpost', series:'F34', color:'SI', w:12, d:8, h:10, elev:9}},
  {t:'truss', ic:'━', n:'Straight Truss Span',d:'horizontal beam at height',params:{config:'span',     series:'F34', color:'SI', w:12, d:8, h:10, elev:9}},
  {t:'truss', ic:'╪', n:'Truss Tower / Totem',d:'vertical column + base',  params:{config:'tower',    series:'F34', color:'SI', w:12, d:8, h:10, elev:9}},
  {t:'truss', ic:'▦', n:'Overhead Truss Grid',d:'4 towers + perimeter',    params:{config:'grid',     series:'F34', color:'SI', w:16, d:12,h:10, elev:9}},
];

// wall paint / finishes presets (all type:'paint')
const PAINT_ASSEMBLIES = [
  {t:'paint', ic:'▰', n:'Area Paint',  d:'colored wall panel',      params:{mode:'area', w:6, h:8, elev:0, color:'#d23b3b', opacity:1}},
  {t:'paint', ic:'─', n:'Line Paint',  d:'painted stripe / border', params:{mode:'line', len:8, thick:4, orient:'horizontal', elev:4, color:'#ffffff', opacity:1}},
];

const SHAPE_ORDER = ['cap','foot','L-HF','L-QR','I-HF','I-QR','T-HF','T-QR','C3-HF','C3-QR','X4-HF','X4-QR','T3D-HF','T3D-QR','W5-HF','W5-QR','L-S','T-S','C3-S','X4-S','T3D-S','W5-S','W6-S'];

// templates: multi-object preset blocks (positions in feet, converted on insert)
const TEMPLATES = [
  {n:'8×8 VR Station', d:'zone + PC + monitor', items:[
    {type:'obj',params:{kind:'vrStation',w:8,d:8},label:'VR Station'},
    {type:'obj',params:{kind:'computerStation'},dx:-2.7,dz:-2.9},
    {type:'obj',params:{kind:'tvWall',w:4},dx:1.5,dz:-3.8},
  ]},
  {n:'10×10 VR Station', d:'larger play space', items:[
    {type:'obj',params:{kind:'vrStation',w:10,d:10},label:'VR Station'},
    {type:'obj',params:{kind:'computerStation'},dx:-3.7,dz:-3.9},
    {type:'obj',params:{kind:'tvWall',w:5},dx:2,dz:-4.8},
  ]},
  {n:'12×12 Free-Roam Zone', d:'open arena', items:[
    {type:'obj',params:{kind:'arcadeZone',w:12,d:12},label:'Free-Roam'},
  ]},
  {n:'Two-Station Divider Layout', d:'2 bays + divider', items:[
    {type:'obj',params:{kind:'vrStation',w:8,d:8},dx:-4.5,label:'Station 1'},
    {type:'obj',params:{kind:'vrStation',w:8,d:8},dx:4.5,label:'Station 2'},
    {type:'wall',params:{w:8,h:8,sys:'QR',color:'BK',tubeColor:'SI',base:'feet',panel:true,bays:1},rot:90},
  ]},
  {n:'Four-Station Pod', d:'4 bays + cross dividers', items:[
    {type:'obj',params:{kind:'vrStation',w:8,d:8},dx:-4.5,dz:-4.5,label:'Station 1'},
    {type:'obj',params:{kind:'vrStation',w:8,d:8},dx:4.5,dz:-4.5,label:'Station 2'},
    {type:'obj',params:{kind:'vrStation',w:8,d:8},dx:-4.5,dz:4.5,label:'Station 3'},
    {type:'obj',params:{kind:'vrStation',w:8,d:8},dx:4.5,dz:4.5,label:'Station 4'},
    {type:'wall',params:{w:17,h:8,sys:'QR',color:'BK',tubeColor:'SI',base:'feet',panel:true,bays:3}},
    {type:'wall',params:{w:17,h:8,sys:'QR',color:'BK',tubeColor:'SI',base:'feet',panel:true,bays:3},rot:90},
  ]},
  {n:'Reception + Waiting Area', d:'counter, POS, benches', items:[
    {type:'obj',params:{kind:'waitingArea',w:12,d:9},label:'Waiting'},
    {type:'obj',params:{kind:'reception'},dz:-2.8},
    {type:'obj',params:{kind:'pos'},dx:3.5,dz:-2.8},
    {type:'obj',params:{kind:'bench'},dx:-3,dz:2.8},
    {type:'obj',params:{kind:'bench'},dx:3,dz:2.8},
  ]},
  {n:'Party Room Divider Setup', d:'zone + walls', items:[
    {type:'obj',params:{kind:'partyZone',w:14,d:12},label:'Party Room'},
    {type:'wall',params:{w:14,h:8,sys:'QR',color:'BK',tubeColor:'SI',base:'feet',panel:true,bays:2},dz:-6},
    {type:'wall',params:{w:12,h:8,sys:'QR',color:'BK',tubeColor:'SI',base:'feet',panel:true,bays:2},dx:-7,rot:90},
  ]},
  {n:'Repair / Intake Counter', d:'desk + shelving + zone', items:[
    {type:'obj',params:{kind:'repairArea',w:9,d:7},label:'Repair / Intake'},
    {type:'obj',params:{kind:'workbench'},dz:-2},
    {type:'obj',params:{kind:'shelving'},dz:2.5},
  ]},
  {n:'Sign / Banner Frame', d:'freestanding banner', items:[
    {type:'wall',params:{w:4,h:7,sys:'QR',color:'BK',tubeColor:'SI',base:'tubes',panel:true,bays:1}},
  ]},
  {n:'Merchandise Display Rack', d:'EZTube display frame', items:[
    {type:'frame',params:{w:3,d:1.5,h:5,levels:2,shelves:true,sys:'HF',color:'BK',tubeColor:'SI'}},
  ]},
  {n:'Storage Shelf', d:'EZTube shelf frame', items:[
    {type:'frame',params:{w:4,d:1.5,h:6,levels:3,shelves:true,sys:'HF',color:'BK',tubeColor:'SI'}},
  ]},
  {n:'Queue Line Barrier', d:'42″ railing run', items:[
    {type:'wall',params:{w:12,h:3.5,sys:'QR',color:'BK',tubeColor:'SI',base:'feet',panel:false,bays:2}},
  ]},
];

// property field definitions per type: [key,label,kind,a,b]
const SEL_SYS={QR:'Quick-Release',HF:'Press-Fit (HF)'};
const SEL_CCOL={BK:'Black',GY:'Gray',WH:'White'};
const SEL_TCOL={SI:'Silver',BK:'Black',WH:'White'};
const SEL_YN={true:'Yes',false:'No'};
const SEL_TRUSSCFG={span:'Straight span',goalpost:'Goal post',tower:'Tower / totem',grid:'Overhead grid'};
const SEL_TRUSSSER={F34:'F34 box (290mm)',F44P:'F44P box (HD)',F33:'F33 triangle',F31:'F31 single tube'};
const SEL_TRUSSCOL={SI:'Silver',BK:'Black'};
const FIELD_DEFS = {
  wall:[['w','Width (ft)','num',1,40],['h','Height (ft)','num',2,12],['bays','Bays','num',1,8],
        ['sys','Connectors','sel',SEL_SYS],
        ['base','Base','sel',{feet:'Adjustable feet',tubes:'T-base tubes'}],
        ['color','Conn. color','sel',SEL_CCOL],['tubeColor','Tube finish','sel',SEL_TCOL],
        ['panel','Panel infill','sel',SEL_YN]],
  booth:[['w','Width (ft)','num',2,30],['d','Depth (ft)','num',2,30],['h','Height (ft)','num',2,12],
        ['bays','Bays (X)','num',1,6],
        ['sys','Connectors','sel',SEL_SYS],['color','Conn. color','sel',SEL_CCOL],
        ['tubeColor','Tube finish','sel',SEL_TCOL],['midRail','Mid rails','sel',SEL_YN]],
  lrun:[['w1','Arm 1 (ft)','num',2,30],['w2','Arm 2 (ft)','num',2,30],['h','Height (ft)','num',2,12],
        ['sys','Connectors','sel',SEL_SYS],['color','Conn. color','sel',SEL_CCOL],
        ['tubeColor','Tube finish','sel',SEL_TCOL],['panel','Panel infill','sel',SEL_YN]],
  urun:[['w','Width (ft)','num',2,30],['d','Depth (ft)','num',2,30],['h','Height (ft)','num',2,12],
        ['sys','Connectors','sel',SEL_SYS],['color','Conn. color','sel',SEL_CCOL],
        ['tubeColor','Tube finish','sel',SEL_TCOL],['panel','Panel infill','sel',SEL_YN]],
  frame:[['w','Width (ft)','num',1,20],['d','Depth (ft)','num',1,20],['h','Height (ft)','num',1,12],
        ['levels','Shelf levels','num',0,8],['shelves','Shelf boards','sel',SEL_YN],
        ['sys','Connectors','sel',SEL_SYS],['color','Conn. color','sel',SEL_CCOL],
        ['tubeColor','Tube finish','sel',SEL_TCOL]],
  sign:[['w','Width (ft)','num',1,16],['ph','Panel height (ft)','num',0.5,6],['elev','Bottom height (ft)','num',4,14],
        ['sys','Connectors','sel',SEL_SYS],['color','Conn. color','sel',SEL_CCOL],
        ['tubeColor','Tube finish','sel',SEL_TCOL],['panel','Panel infill','sel',SEL_YN]],
  tube:[['len','Length (in)','num',1,240],['orient','Orientation','sel',{horizontal:'Horizontal',vertical:'Vertical'}],
        ['tubeColor','Finish','sel',SEL_TCOL]],
  truss:[['config','Configuration','sel',SEL_TRUSSCFG],['series','Truss series','sel',SEL_TRUSSSER],
        ['w','Width (ft)','num',1,60],['d','Depth (ft)','num',1,60],['h','Height (ft)','num',2,20],
        ['elev','Span height (ft)','num',2,20],['color','Finish','sel',SEL_TRUSSCOL]],
  part:[['color','Color','sel',SEL_CCOL]],
  rwall:[['len','Length (ft)','num',1,100],['h','Height (ft)','num',1,16],['thick','Thickness (in)','num',1,24],
        ['color','Finish','sel',{WH:'White / drywall',GY:'Gray',CN:'Concrete',BK:'Dark'}]],
};
function fieldDefsFor(it){
  if(it.type==='paint'){
    const defs=[];
    if(it.params.mode==='line'){
      defs.push(['len','Length (ft)','num',0.5,80],['thick','Thickness (in)','num',0.25,36],
                ['orient','Orientation','sel',{horizontal:'Horizontal',vertical:'Vertical'}]);
    } else {
      defs.push(['w','Width (ft)','num',0.5,40],['h','Height (ft)','num',0.5,16]);
    }
    defs.push(['elev','Bottom height (ft)','num',0,16],['opacity','Opacity','num',0.1,1],['color','Color','color']);
    return defs;
  }
  if(it.type!=='obj') return FIELD_DEFS[it.type]||[];
  const k=OBJ_KINDS[it.params.kind]||{};
  const defs=[];
  if(k.shape==='zone'){ defs.push(['w','Width (ft)','num',1,60],['d','Depth (ft)','num',1,60]); }
  else if(k.shape==='box'){
    defs.push(['w','Width (ft)','num',0.5,40],['d','Depth (ft)','num',0.5,40],['h','Height (ft)','num',0.5,16]);
    if(k.elev!==undefined || it.params.elev!==undefined) defs.push(['elev','Elevation (ft)','num',0,15]);
  }
  else if(k.shape==='opening'){
    defs.push(['w','Width (ft)','num',1,12],['h','Height (ft)','num',1,12]);
    if(k.elev!==undefined || it.params.elev!==undefined) defs.push(['elev','Sill height (ft)','num',0,10]);
  }
  defs.push(['color','Color','color']);
  return defs;
}

/* ---------- 2. palette rendering ---------- */
const palEl=document.getElementById('palette');
let activeTab='struct';
function pitem(ic, name, sub, onclick){
  const el=document.createElement('div'); el.className='pitem';
  el.innerHTML=`<div class="ic">${ic}</div><div><b>${name}</b><span>${sub}</span></div>`;
  el.onclick=onclick;
  el.dataset.search=(name+' '+sub).toLowerCase();
  return el;
}
function pgroup(title, open=true){
  const grp=document.createElement('div'); grp.className='pgroup'+(open?'':' closed');
  const h=document.createElement('h3'); h.textContent=title;
  h.onclick=()=>grp.classList.toggle('closed');
  grp.appendChild(h);
  return grp;
}
function addAtCenter(type, params, extra){
  pushUndo();
  const it=addItem(type, JSON.parse(JSON.stringify(params)), extra);
  setSelection([it]); save();
}
function renderPalette(){
  palEl.innerHTML='';
  if(activeTab==='struct'){
    const g1=pgroup('Parametric structures');
    ASSEMBLIES.forEach(a=>g1.appendChild(pitem(a.ic, a.n, a.d, ()=>addAtCenter(a.t, a.params))));
    palEl.appendChild(g1);
    const gT=pgroup('Stage truss (Global Truss)');
    TRUSS_ASSEMBLIES.forEach(a=>gT.appendChild(pitem(a.ic, a.n, a.d, ()=>addAtCenter(a.t, a.params))));
    palEl.appendChild(gT);
    const gP=pgroup('Wall paint / finishes');
    PAINT_ASSEMBLIES.forEach(a=>gP.appendChild(pitem(a.ic, a.n, a.d, ()=>addAtCenter(a.t, a.params))));
    palEl.appendChild(gP);
    const g2=pgroup('Templates (multi-object)');
    TEMPLATES.forEach(t=>g2.appendChild(pitem('⊞', t.n, t.d, ()=>insertTemplate(t))));
    palEl.appendChild(g2);
  }
  else if(activeTab==='parts'){
    const COLOR_NAMES={BK:'Black',GY:'Gray',WH:'White'};
    const GROUPS=[
      ['Caps & feet', k=>k==='cap'||k==='foot'],
      ['Press-fit (HF)', k=>k.endsWith('-HF')],
      ['Quick-release (QR)', k=>k.endsWith('-QR')],
      ['Steel-core (S)', k=>k.endsWith('-S')],
    ];
    GROUPS.forEach(([title,match])=>{
      const grp=pgroup(title);
      SHAPE_ORDER.forEach(k=>{
        if(!EZTUBE_PARTS[k]||!match(k)) return;
        const p=EZTUBE_PARTS[k];
        const pns=EZTUBE_PN[k]||{BK:k};
        Object.entries(pns).forEach(([col,pn])=>{
          grp.appendChild(pitem('⬡', `${p.name} — ${COLOR_NAMES[col]||col}`, `${pn} · ${p.legs.length}-leg`,
            ()=>addAtCenter('part',{shape:k,color:col})));
        });
      });
      palEl.appendChild(grp);
    });
  }
  else if(activeTab==='plan'){
    const CATS=[
      ['Zones & areas', k=>OBJ_KINDS[k].shape==='zone', '◰'],
      ['Furniture & equipment', k=>OBJ_KINDS[k].shape==='box'&&OBJ_KINDS[k].layer==='furniture', '▦'],
      ['Building elements', k=>OBJ_KINDS[k].shape==='box'&&OBJ_KINDS[k].layer==='building', '▮'],
      ['Doors & windows', k=>OBJ_KINDS[k].shape==='opening', '◫'],
      ['Markers (electrical / safety)', k=>OBJ_KINDS[k].shape==='marker', '◉'],
    ];
    CATS.forEach(([title,match,ic])=>{
      const grp=pgroup(title);
      Object.keys(OBJ_KINDS).forEach(k=>{
        if(!match(k)) return;
        const kd=OBJ_KINDS[k];
        const dims = kd.shape==='marker' ? 'point marker'
          : kd.shape==='zone' ? `${kd.w}×${kd.d} ft zone`
          : `${kd.w}×${kd.d}${kd.h?'×'+kd.h:''} ft`;
        grp.appendChild(pitem(ic, kd.n, dims, ()=>addAtCenter('obj',{kind:k})));
      });
      palEl.appendChild(grp);
    });
  }
  else if(activeTab==='site'){
    renderSiteTab();
  }
  applyPaletteSearch();
}
function renderSiteTab(){
  // building shell
  const g1=pgroup('Building shell');
  g1.appendChild(pitem('▮','Building Wall','solid wall — not EZTube',
    ()=>addAtCenter('rwall',{len:10,h:room.h,thick:5,color:'WH'})));
  g1.appendChild(pitem('◼','Column / Obstruction','structural column',
    ()=>addAtCenter('obj',{kind:'column',h:room.h})));
  g1.appendChild(pitem('▭','Ceiling Beam','overhead obstruction',
    ()=>addAtCenter('obj',{kind:'beam',elev:room.h-2})));
  const b1=document.createElement('div'); b1.className='pbody';
  b1.innerHTML=`<div class="brow">
    <button id="siteRect">Rect outline</button>
    <button id="siteL">L-shape outline</button>
    <button id="siteDraw">Draw walls</button>
  </div>
  <div class="brow" style="font-size:11px">Outlines use current room size. Draw mode: click points in top view; Esc to finish.</div>`;
  g1.appendChild(b1);
  palEl.appendChild(g1);

  // floor plan image
  const g2=pgroup('Floor-plan reference image');
  const b2=document.createElement('div'); b2.className='pbody';
  const fi=floorImg;
  b2.innerHTML=`<div class="brow">
      <button id="imgImport">${fi?'Replace image':'Import image…'}</button>
      ${fi?'<button id="imgRemove">Remove</button>':''}
    </div>
    ${fi?`
    <div class="brow"><button id="imgCalib">Calibrate scale</button>
      <label><input type="checkbox" id="imgLock" ${fi.locked?'checked':''}> lock</label>
      <label><input type="checkbox" id="imgVis" ${fi.visible!==false?'checked':''}> visible</label></div>
    <div class="brow">opacity <input type="range" id="imgOpacity" min="10" max="100" value="${Math.round((fi.opacity??0.55)*100)}"></div>
    <div class="brow" style="font-size:11px">Calibrate: click two points on the image, then enter the real distance.</div>
    `:`<div class="brow" style="font-size:11px">Import a PNG/JPG of your floor plan, place it on the floor, then calibrate its scale.</div>`}`;
  g2.appendChild(b2);
  palEl.appendChild(g2);

  // project notes
  const g3=pgroup('Project notes');
  const b3=document.createElement('div'); b3.className='pbody';
  b3.innerHTML=`<textarea id="projNotes" placeholder="Notes about this location plan…">${projectNotes||''}</textarea>`;
  g3.appendChild(b3);
  palEl.appendChild(g3);

  // wire site controls
  document.getElementById('siteRect').onclick=()=>insertOutline('rect');
  document.getElementById('siteL').onclick=()=>insertOutline('L');
  document.getElementById('siteDraw').onclick=()=>setMode(mode==='draw'?'normal':'draw');
  document.getElementById('imgImport').onclick=()=>document.getElementById('fileImg').click();
  if(fi){
    document.getElementById('imgRemove').onclick=()=>{ floorImg=null; rebuildFloorImg(); renderPalette(); save(); };
    document.getElementById('imgCalib').onclick=()=>setMode('calib');
    document.getElementById('imgLock').onchange=e=>{ floorImg.locked=e.target.checked; save(); };
    document.getElementById('imgVis').onchange=e=>{ floorImg.visible=e.target.checked; rebuildFloorImg(); save(); };
    document.getElementById('imgOpacity').oninput=e=>{ floorImg.opacity=e.target.value/100; if(imgMesh) imgMesh.material.opacity=floorImg.opacity; };
    document.getElementById('imgOpacity').onchange=()=>save();
  }
  document.getElementById('projNotes').onchange=e=>{ projectNotes=e.target.value; save(); };
}
// tabs
const TAB_IDS={tabStruct:'struct',tabParts:'parts',tabPlan:'plan',tabSite:'site'};
Object.keys(TAB_IDS).forEach(id=>{
  document.getElementById(id).onclick=()=>{
    Object.keys(TAB_IDS).forEach(i=>document.getElementById(i).classList.toggle('on', i===id));
    activeTab=TAB_IDS[id]; renderPalette();
  };
});
// search
document.getElementById('palSearch').addEventListener('input', applyPaletteSearch);
function applyPaletteSearch(){
  const q=document.getElementById('palSearch').value.trim().toLowerCase();
  palEl.querySelectorAll('.pitem').forEach(el=>{
    el.style.display=(!q || (el.dataset.search||'').includes(q))?'':'none';
  });
  palEl.querySelectorAll('.pgroup').forEach(g=>{
    if(!q) return;
    const any=[...g.querySelectorAll('.pitem')].some(el=>el.style.display!=='none');
    g.classList.toggle('closed', !any && g.querySelector('.pitem'));
  });
}

function insertTemplate(t){
  pushUndo();
  const grp=nextGrp++;
  const added=[];
  t.items.forEach(d=>{
    const it=addItem(d.type, JSON.parse(JSON.stringify(d.params)), {grp, label:d.label});
    it.x=(d.dx||0)*FT; it.z=(d.dz||0)*FT; it.rot=(d.rot||0)*Math.PI/180;
    rebuildItem(it); added.push(it);
  });
  setSelection(added); save();
}

/* ---------- 3. layers panel ---------- */
function renderLayers(){
  const box=document.getElementById('layersBox');
  box.innerHTML='<h3>Layers</h3>';
  Object.keys(LAYER_NAMES).forEach(k=>{
    const l=document.createElement('label');
    l.innerHTML=`<input type="checkbox" ${layers[k]?'checked':''}> ${LAYER_NAMES[k]}`;
    l.querySelector('input').onchange=e=>{ layers[k]=e.target.checked; applyLayerVisibility(); save(); };
    box.appendChild(l);
  });
  const hiddenCount=items.filter(i=>i.hidden).length;
  if(hiddenCount){
    const b=document.createElement('button');
    b.textContent=`Show ${hiddenCount} hidden item${hiddenCount>1?'s':''}`;
    b.style.cssText='margin-top:6px;padding:4px 8px;border-radius:6px;border:1px solid var(--bd);background:var(--panel2);color:var(--txt);cursor:pointer;font-size:11.5px';
    b.onclick=()=>{ pushUndo(); items.forEach(i=>i.hidden=false); applyLayerVisibility(); renderLayers(); save(); };
    box.appendChild(b);
  }
}

/* ---------- 4. selection model ---------- */
let selection=[];
let selectedMeasure=null;
function setHighlight(g,on,hover){
  g.traverse(o=>{ if(o.isMesh && o.material && o.material.emissive) o.material.emissive.setHex(on?(hover?0x1b2040:0x33277a):0x000000); });
}
function setSelection(arr){
  selection.forEach(it=>{ if(meshById[it.id]) setHighlight(meshById[it.id],false); });
  if(selectedMeasure){ const m=selectedMeasure; selectedMeasure=null; rebuildMeasure(m,false); }
  selection=arr.filter((it,i)=>arr.indexOf(it)===i && items.includes(it));
  selection.forEach(it=>{ if(meshById[it.id]) setHighlight(meshById[it.id],true); });
  renderProps(); updateStatus();
}
function selectMeasure(ms){
  setSelection([]);
  selectedMeasure=ms;
  if(ms){ rebuildMeasure(ms,true); renderMeasureProps(); }
  updateStatus();
}
function expandGroup(it){
  if(!it.grp) return [it];
  return items.filter(i=>i.grp===it.grp);
}

/* ---------- 5. properties panel ---------- */
const propsEl=document.getElementById('props');
function renderProps(){
  if(selectedMeasure){ renderMeasureProps(); return; }
  if(!selection.length){ propsEl.style.display='none'; return; }
  propsEl.style.display='block';
  if(selection.length>1){ renderMultiProps(); return; }
  const it=selection[0];
  const fp=it._fp||{w:0,d:0,h:0};
  let html=`<h3>${dispName(it)}${it.locked?' 🔒':''}</h3>
    <div class="row"><label>Footprint</label><span class="val">${fmtFtIn(fp.w)} × ${fmtFtIn(fp.d)}</span></div>`;
  if(isZone(it)) html+=`<div class="row"><label>Area</label><span class="val">${sqft(itemAreaM2(it)).toFixed(0)} ft²</span></div>`;
  html+=`<h4>Transform</h4>
    <div class="row"><label>X (ft)</label><input type="number" data-pos="x" value="${ft2(it.x)}" step="0.25"></div>
    <div class="row"><label>Z (ft)</label><input type="number" data-pos="z" value="${ft2(it.z)}" step="0.25"></div>
    <div class="row"><label>Rotation</label><input type="number" data-rot="1" value="${Math.round(it.rot*180/Math.PI)}" step="15"></div>`;
  const defs=fieldDefsFor(it);
  if(defs.length){
    html+=`<h4>Dimensions & options</h4>`;
    defs.forEach(([k,label,kind,a,b])=>{
      const v=it.params[k];
      if(kind==='num') html+=`<div class="row"><label>${label}</label><input type="number" data-k="${k}" value="${v??''}" min="${a}" max="${b}" step="${(k==='len'||k==='bays'||k==='levels')?1:0.5}"></div>`;
      else if(kind==='color') html+=`<div class="row"><label>${label}</label><input type="color" data-k="${k}" value="${v||(OBJ_KINDS[it.params.kind]||{}).color||'#8a8d93'}"></div>`;
      else html+=`<div class="row"><label>${label}</label><select data-k="${k}">`+Object.entries(a).map(([ov,on])=>`<option value="${ov}" ${String(v)===ov?'selected':''}>${on}</option>`).join('')+`</select></div>`;
    });
  }
  html+=`<h4>Label & notes</h4>
    <div class="row"><label>Label</label><input type="text" data-meta="label" value="${(it.label||'').replace(/"/g,'&quot;')}"></div>
    <textarea data-meta="notes" placeholder="Notes…">${it.notes||''}</textarea>
    <div class="actions">
      <button id="pDup">Duplicate</button>
      <button id="pLock">${it.locked?'Unlock':'Lock'}</button>
      <button id="pHide">Hide</button>
      <button id="pDel" class="del">Delete</button>
    </div>`;
  propsEl.innerHTML=html;

  propsEl.querySelectorAll('[data-k]').forEach(inp=>{
    inp.addEventListener('change',()=>{
      let v=inp.value;
      if(inp.type==='number') v=parseFloat(v)||0;
      if(v==='true')v=true; if(v==='false')v=false;
      pushUndo();
      it.params[inp.dataset.k]=v;
      rebuildItem(it); setHighlight(meshById[it.id],true); save(); renderProps();
    });
  });
  propsEl.querySelectorAll('[data-pos]').forEach(inp=>{
    inp.addEventListener('change',()=>{
      pushUndo();
      it[inp.dataset.pos]=(parseFloat(inp.value)||0)*FT;
      meshById[it.id].position.set(it.x,0,it.z); save();
    });
  });
  propsEl.querySelector('[data-rot]').addEventListener('change',e=>{
    pushUndo();
    it.rot=(parseFloat(e.target.value)||0)*Math.PI/180;
    meshById[it.id].rotation.y=it.rot; save();
  });
  propsEl.querySelectorAll('[data-meta]').forEach(inp=>{
    inp.addEventListener('change',()=>{
      pushUndo();
      it[inp.dataset.meta]=inp.value;
      rebuildItem(it); setHighlight(meshById[it.id],true); save();
      if(inp.dataset.meta==='label') renderProps();
    });
  });
  document.getElementById('pDup').onclick=()=>duplicateSelection();
  document.getElementById('pLock').onclick=()=>{ pushUndo(); it.locked=!it.locked; save(); renderProps(); };
  document.getElementById('pHide').onclick=()=>{ pushUndo(); it.hidden=true; applyLayerVisibility(); setSelection([]); renderLayers(); save(); };
  document.getElementById('pDel').onclick=()=>{ pushUndo(); removeItems(expandSelectionForDelete()); setSelection([]); renderLayers(); save(); };
}
function renderMultiProps(){
  const sameGrp=selection.every(i=>i.grp && i.grp===selection[0].grp);
  propsEl.innerHTML=`<h3>${selection.length} items selected</h3>
    <h4>Align</h4>
    <div class="alignGrid">
      <button data-al="left">Left</button><button data-al="cx">Center X</button><button data-al="right">Right</button>
      <button data-al="top">Front</button><button data-al="cz">Center Z</button><button data-al="bottom">Back</button>
    </div>
    <div class="alignGrid" style="grid-template-columns:repeat(2,1fr)">
      <button data-al="distX">Distribute X</button><button data-al="distZ">Distribute Z</button>
    </div>
    <div class="actions">
      <button id="pGroup">${sameGrp?'Ungroup':'Group'}</button>
      <button id="pDup">Duplicate</button>
      <button id="pDel" class="del">Delete</button>
    </div>`;
  propsEl.querySelectorAll('[data-al]').forEach(b=>b.onclick=()=>alignSelection(b.dataset.al));
  document.getElementById('pGroup').onclick=()=>toggleGroup();
  document.getElementById('pDup').onclick=()=>duplicateSelection();
  document.getElementById('pDel').onclick=()=>{ pushUndo(); removeItems(selection.slice()); setSelection([]); renderLayers(); save(); };
}
function renderMeasureProps(){
  const ms=selectedMeasure; if(!ms){ propsEl.style.display='none'; return; }
  propsEl.style.display='block';
  if(ms.type==='area'){
    const areaM2=measureAreaM2(ms);
    const w=Math.abs(ms.b[0]-ms.a[0]), d=Math.abs(ms.b[1]-ms.a[1]);
    propsEl.innerHTML=`<h3>Area #${ms.id}</h3>
      <div class="row"><label>Area</label><span class="val">${sqft(areaM2).toFixed(0)} ft²</span></div>
      <div class="row"><label>Size</label><span class="val">${fmtFtIn(w)} × ${fmtFtIn(d)}</span></div>
      <div class="row"><label>Metric</label><span class="val">${areaM2.toFixed(2)} m²</span></div>
      <h4>Label</h4>
      <div class="row"><label>Text</label><input type="text" id="msLabel" value="${(ms.label||'').replace(/"/g,'&quot;')}"></div>
      <div class="actions">
        <button id="mDel" class="del">Delete</button>
        <button id="mClr">Clear all dims</button>
      </div>`;
  } else {
    const len=Math.hypot(ms.b[0]-ms.a[0], ms.b[1]-ms.a[1]);
    propsEl.innerHTML=`<h3>Dimension #${ms.id}</h3>
      <div class="row"><label>Distance</label><span class="val">${fmtFtIn(len)}</span></div>
      <div class="row"><label>Decimal</label><span class="val">${ft2(len)} ft</span></div>
      <div class="row"><label>Metric</label><span class="val">${len.toFixed(3)} m</span></div>
      <h4>Label</h4>
      <div class="row"><label>Text</label><input type="text" id="msLabel" value="${(ms.label||'').replace(/"/g,'&quot;')}"></div>
      <div class="actions">
        <button id="mDel" class="del">Delete</button>
        <button id="mClr">Clear all dims</button>
      </div>`;
  }
  document.getElementById('msLabel').onchange=e=>{ pushUndo(); ms.label=e.target.value; rebuildMeasure(ms,true); save(); };
  document.getElementById('mDel').onclick=()=>{ pushUndo(); removeMeasure(ms); selectedMeasure=null; propsEl.style.display='none'; save(); };
  document.getElementById('mClr').onclick=()=>{ pushUndo(); [...measures].forEach(removeMeasure); selectedMeasure=null; propsEl.style.display='none'; save(); };
}

/* selection ops */
function expandSelectionForDelete(){ return selection.slice(); }
function duplicateSelection(){
  if(!selection.length) return;
  pushUndo();
  const grpMap={};
  const clones=selection.map(it=>{
    let g;
    if(it.grp){ g=grpMap[it.grp]||(grpMap[it.grp]=nextGrp++); }
    const c=addItem(it.type, JSON.parse(JSON.stringify(it.params)),
      {label:it.label, notes:it.notes, grp:g});
    c.x=it.x+1*FT; c.z=it.z+1*FT; c.rot=it.rot;
    rebuildItem(c);
    return c;
  });
  setSelection(clones); save();
}
function selBounds(){
  let minX=1e9,maxX=-1e9,minZ=1e9,maxZ=-1e9;
  selection.forEach(it=>rectCorners(it).forEach(([x,z])=>{
    minX=Math.min(minX,x); maxX=Math.max(maxX,x); minZ=Math.min(minZ,z); maxZ=Math.max(maxZ,z);
  }));
  return {minX,maxX,minZ,maxZ};
}
function itemBounds(it){
  let minX=1e9,maxX=-1e9,minZ=1e9,maxZ=-1e9;
  rectCorners(it).forEach(([x,z])=>{ minX=Math.min(minX,x); maxX=Math.max(maxX,x); minZ=Math.min(minZ,z); maxZ=Math.max(maxZ,z); });
  return {minX,maxX,minZ,maxZ,cx:(minX+maxX)/2,cz:(minZ+maxZ)/2};
}
function alignSelection(op){
  if(selection.length<2) return;
  pushUndo();
  const sb=selBounds();
  const movable=selection.filter(i=>!i.locked);
  if(op==='distX'||op==='distZ'){
    const key=op==='distX'?'cx':'cz', axis=op==='distX'?'x':'z';
    const sorted=[...movable].sort((a,b)=>itemBounds(a)[key]-itemBounds(b)[key]);
    if(sorted.length>2){
      const first=itemBounds(sorted[0])[key], last=itemBounds(sorted[sorted.length-1])[key];
      sorted.forEach((it,i)=>{
        const want=first+(last-first)*i/(sorted.length-1);
        it[axis]+=want-itemBounds(it)[key];
      });
    }
  } else {
    movable.forEach(it=>{
      const b=itemBounds(it);
      if(op==='left')   it.x+=sb.minX-b.minX;
      if(op==='right')  it.x+=sb.maxX-b.maxX;
      if(op==='cx')     it.x+=(sb.minX+sb.maxX)/2-b.cx;
      if(op==='top')    it.z+=sb.minZ-b.minZ;
      if(op==='bottom') it.z+=sb.maxZ-b.maxZ;
      if(op==='cz')     it.z+=(sb.minZ+sb.maxZ)/2-b.cz;
    });
  }
  movable.forEach(it=>meshById[it.id].position.set(it.x,0,it.z));
  save();
}
function toggleGroup(){
  if(selection.length<2) return;
  pushUndo();
  const sameGrp=selection.every(i=>i.grp && i.grp===selection[0].grp);
  if(sameGrp) selection.forEach(i=>delete i.grp);
  else { const g=nextGrp++; selection.forEach(i=>i.grp=g); }
  save(); renderProps();
}

/* ---------- 6. status bar ---------- */
function updateStatus(){
  const el=document.getElementById('status'); if(!el) return;
  const parts=[];
  if(selectedMeasure){
    if(selectedMeasure.type==='area'){
      const a=measureAreaM2(selectedMeasure);
      parts.push(`<b>Area</b> ${sqft(a).toFixed(0)} ft²`);
    } else {
      const len=Math.hypot(selectedMeasure.b[0]-selectedMeasure.a[0], selectedMeasure.b[1]-selectedMeasure.a[1]);
      parts.push(`<b>Dimension</b> ${fmtFtIn(len)} (${ft2(len)} ft)`);
    }
  } else if(selection.length===1){
    const it=selection[0], fp=it._fp||{w:0,d:0};
    parts.push(`<b>${dispName(it)}</b> @ ${ft2(it.x)}, ${ft2(it.z)} ft · ${fmtFtIn(fp.w)} × ${fmtFtIn(fp.d)}${fp.h>0.2?' × '+fmtFtIn(fp.h)+' h':''}`);
  } else if(selection.length>1){
    parts.push(`<b>${selection.length} items selected</b>`);
  } else {
    parts.push(`No selection`);
  }
  parts.push(`Snap <b>${settings.snapOn?settings.snapIn+'″':'off'}</b>`);
  const a=areasSummary();
  parts.push(`Room <b>${sqft(a.room).toFixed(0)} ft²</b>`);
  parts.push(`Items <b>${sqft(a.used).toFixed(0)} ft²</b>`);
  parts.push(`Open ≈ <b>${sqft(a.free).toFixed(0)} ft²</b>`);
  parts.push(`Mode <b>${mode}</b>`);
  el.innerHTML=parts.join('<span style="opacity:.35">|</span>');
}

/* ---------- 7. pointer interaction ---------- */
const ray=new THREE.Raycaster(), mouse=new THREE.Vector2();
const floorPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
let mode='normal';                 // normal | measure | measureArea | draw | calib
let dragging=null;                 // array of {it,dx,dz} during item drag
let dragPendingUndo=null, dragMoved=false;
let dragImgOff=null;               // floor image drag offset
let hovered=null, lastHover=0;

function setMouse(e){ const r=renderer.domElement.getBoundingClientRect(); mouse.x=((e.clientX-r.left)/r.width)*2-1; mouse.y=-((e.clientY-r.top)/r.height)*2+1; }
function floorPoint(e){
  setMouse(e); ray.setFromCamera(mouse,camera);
  const p=new THREE.Vector3();
  return ray.ray.intersectPlane(floorPlane,p)?p:null;
}
function snapPt(p,e){
  if(settings.snapOn && !e.shiftKey){
    const s=snapStepM();
    p.x=Math.round(p.x/s)*s; p.z=Math.round(p.z/s)*s;
  }
}
function itemAt(e){
  setMouse(e); ray.setFromCamera(mouse,camera);
  const hits=ray.intersectObjects(itemGroup.children,true);
  for(const h of hits){
    let o=h.object;
    while(o && o.userData.itemId===undefined) o=o.parent;
    if(o){
      const it=items.find(i=>i.id===o.userData.itemId);
      if(it && !it.hidden && layers[layerOf(it)]) return it;
    }
  }
  return null;
}
function measureAt(e){
  setMouse(e); ray.setFromCamera(mouse,camera);
  const hits=ray.intersectObjects(measureGroup.children,true);
  for(const h of hits){
    let o=h.object;
    while(o && o.userData.measureId===undefined) o=o.parent;
    if(o && o.userData.measureId>0) return measures.find(m=>m.id===o.userData.measureId);
  }
  return null;
}
function imgAt(e){
  if(!imgMesh || !imgMesh.visible || !floorImg || floorImg.locked) return false;
  setMouse(e); ray.setFromCamera(mouse,camera);
  return ray.intersectObject(imgMesh).length>0;
}
// snap an opening (door/window) onto the nearest building wall
function snapToWall(it, nx, nz){
  const kind=OBJ_KINDS[it.params.kind];
  if(!kind || !kind.snapWall) return {x:nx, z:nz, rot:it.rot};
  let best=null, bestD=0.6; // snap radius 0.6 m
  items.forEach(w=>{
    if(w.type!=='rwall'||w.hidden) return;
    const L=w.params.len*FT/2;
    const c=Math.cos(w.rot), s=Math.sin(w.rot);
    // wall local +X axis in world: (c,-s)
    const dx=nx-w.x, dz=nz-w.z;
    const t=Math.max(-L,Math.min(L, dx*c + dz*(-s)));
    const px=w.x+c*t, pz=w.z+(-s)*t;
    const d=Math.hypot(nx-px,nz-pz);
    if(d<bestD){ bestD=d; best={x:px,z:pz,rot:w.rot}; }
  });
  return best||{x:nx,z:nz,rot:it.rot};
}

renderer.domElement.addEventListener('pointerdown',e=>{
  if(e.button!==0) return;
  if(mode==='measure'||mode==='measureArea'){ measureClick(e); return; }
  if(mode==='draw'){ drawClick(e); return; }
  if(mode==='calib'){ calibClick(e); return; }
  const it=itemAt(e);
  if(it){
    let sel;
    if(e.shiftKey){
      sel=selection.includes(it) ? selection.filter(i=>i!==it) : [...selection, it];
    } else if(selection.includes(it)){
      sel=selection;                              // keep multi-selection when starting drag
    } else {
      sel=expandGroup(it);
    }
    setSelection(sel);
    if(!sel.length) return;
    const movable=sel.filter(i=>!i.locked);
    if(!movable.length) return;
    const p=floorPoint(e); if(!p) return;
    dragging=movable.map(i=>({it:i, dx:i.x-p.x, dz:i.z-p.z}));
    dragPendingUndo=coreState(); dragMoved=false;
    controls.enabled=false;
  } else {
    const ms=measureAt(e);
    if(ms){ selectMeasure(ms); return; }
    if(imgAt(e)){
      const p=floorPoint(e); if(!p) return;
      dragImgOff={dx:floorImg.x-p.x, dz:floorImg.z-p.z};
      dragPendingUndo=coreState(); dragMoved=false;
      controls.enabled=false;
      setSelection([]);
      return;
    }
    setSelection([]); selectMeasure(null);
  }
});

renderer.domElement.addEventListener('pointermove',e=>{
  if(mode==='measure'||mode==='measureArea'){ measureMove(e); return; }
  if(mode==='draw'){ drawMove(e); return; }
  if(dragImgOff){
    const p=floorPoint(e); if(!p) return;
    if(!dragMoved){ undoStack.push(dragPendingUndo); if(undoStack.length>60)undoStack.shift(); redoStack.length=0; dragMoved=true; }
    let nx=p.x+dragImgOff.dx, nz=p.z+dragImgOff.dz;
    if(settings.snapOn && !e.shiftKey){ const s=snapStepM(); nx=Math.round(nx/s)*s; nz=Math.round(nz/s)*s; }
    floorImg.x=nx; floorImg.z=nz;
    imgMesh.position.set(nx,0.003,nz);
    return;
  }
  if(dragging){
    const p=floorPoint(e); if(!p) return;
    if(!dragMoved){ undoStack.push(dragPendingUndo); if(undoStack.length>60)undoStack.shift(); redoStack.length=0; dragMoved=true; }
    const W=room.w*FT/2, D=room.d*FT/2;
    const primary=dragging[0];
    let px=p.x+primary.dx, pz=p.z+primary.dz;
    if(settings.snapOn && !e.shiftKey){ const s=snapStepM(); px=Math.round(px/s)*s; pz=Math.round(pz/s)*s; }
    const ddx=px-(p.x+primary.dx), ddz=pz-(p.z+primary.dz);   // snap delta applied to all
    dragging.forEach(d=>{
      let nx=p.x+d.dx+ddx, nz=p.z+d.dz+ddz;
      nx=Math.max(-W,Math.min(W,nx)); nz=Math.max(-D,Math.min(D,nz));
      const snapped=snapToWall(d.it,nx,nz);
      d.it.x=snapped.x; d.it.z=snapped.z;
      if(snapped.rot!==d.it.rot){ d.it.rot=snapped.rot; meshById[d.it.id].rotation.y=snapped.rot; }
      meshById[d.it.id].position.set(snapped.x,0,snapped.z);
    });
    updateStatus();
    return;
  }
  // hover highlight (throttled)
  const now=performance.now();
  if(now-lastHover>70){
    lastHover=now;
    const it=itemAt(e);
    if(hovered!==it){
      if(hovered && meshById[hovered.id] && !selection.includes(hovered)) setHighlight(meshById[hovered.id],false);
      hovered=it;
      if(it && !selection.includes(it)) setHighlight(meshById[it.id],true,true);
      renderer.domElement.style.cursor = it ? 'move' : (mode==='normal'?'':'crosshair');
    }
  }
});
addEventListener('pointerup',()=>{
  if(dragging||dragImgOff){
    dragging=null; dragImgOff=null; dragPendingUndo=null;
    controls.enabled=true; save(); renderProps();
  }
});

/* ---------- 8. measure mode ---------- */
let measureStart=null, previewMeasure=null;
function clearPreviewMeasure(){ if(previewMeasure){ measureGroup.remove(previewMeasure); previewMeasure=null; } }
function measureClick(e){
  const p=floorPoint(e); if(!p) return;
  snapPt(p,e);
  if(!measureStart){ measureStart=p.clone(); }
  else {
    pushUndo();
    const ms={id:nextMeasureId++, type: mode==='measureArea'?'area':'line',
              a:[measureStart.x,measureStart.z], b:[p.x,p.z]};
    measures.push(ms); rebuildMeasure(ms,false);
    measureStart=null; clearPreviewMeasure(); save();
  }
}
function measureMove(e){
  if(!measureStart) return;
  const p=floorPoint(e); if(!p) return;
  snapPt(p,e);
  clearPreviewMeasure();
  previewMeasure=measureMesh(
    {id:-1, type: mode==='measureArea'?'area':'line',
     a:[measureStart.x,measureStart.z], b:[p.x,p.z]}, 0x7c5cff);
  measureGroup.add(previewMeasure);
}

/* ---------- 9. draw-walls mode, outlines, calibration ---------- */
let drawPts=[], drawPreview=null;
function clearDrawPreview(){ if(drawPreview){ scene.remove(drawPreview); drawPreview=null; } }
function drawClick(e){
  const p=floorPoint(e); if(!p) return;
  snapPt(p,e);
  if(drawPts.length){
    const a=drawPts[drawPts.length-1];
    if(a.distanceTo(p)>0.05) addWallSegment(a,p);
  }
  drawPts.push(p.clone());
}
function drawMove(e){
  if(!drawPts.length) return;
  const p=floorPoint(e); if(!p) return;
  snapPt(p,e);
  clearDrawPreview();
  const a=drawPts[drawPts.length-1];
  drawPreview=new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a.x,0.05,a.z), new THREE.Vector3(p.x,0.05,p.z)]),
    new THREE.LineBasicMaterial({color:0xffb84d, depthTest:false}));
  drawPreview.renderOrder=9;
  scene.add(drawPreview);
}
function addWallSegment(a,b){
  pushUndo();
  const dx=b.x-a.x, dz=b.z-a.z;
  const len=Math.hypot(dx,dz);
  const it=addItem('rwall', {len:+(len/FT).toFixed(2), h:room.h, thick:5, color:'WH'});
  it.x=(a.x+b.x)/2; it.z=(a.z+b.z)/2;
  it.rot=Math.atan2(-dz,dx);
  rebuildItem(it); save();
}
function insertOutline(shape){
  pushUndo();
  const grp=nextGrp++;
  const W=room.w, D=room.d, T=5/12/2; // half thickness in feet
  const seg=(x1,z1,x2,z2)=>{
    const len=Math.hypot(x2-x1,z2-z1);
    const it=addItem('rwall',{len:+len.toFixed(2),h:room.h,thick:5,color:'WH'},{grp});
    it.x=(x1+x2)/2*FT; it.z=(z1+z2)/2*FT;
    it.rot=Math.atan2(-(z2-z1),(x2-x1));
    rebuildItem(it);
  };
  if(shape==='rect'){
    seg(-W/2+T,-D/2+T, W/2-T,-D/2+T);
    seg(-W/2+T, D/2-T, W/2-T, D/2-T);
    seg(-W/2+T,-D/2+T,-W/2+T, D/2-T);
    seg( W/2-T,-D/2+T, W/2-T, D/2-T);
  } else { // L-shape: notch removed at +X/+Z corner
    const nx=W/4, nz=D/4; // notch size
    seg(-W/2+T,-D/2+T,  W/2-T,-D/2+T);          // back full width
    seg( W/2-T,-D/2+T,  W/2-T, D/2-nz);          // right side partial
    seg( W/2-T, D/2-nz, W/2-nx, D/2-nz);         // notch inner horizontal
    seg( W/2-nx, D/2-nz, W/2-nx, D/2-T);         // notch inner vertical
    seg(-W/2+T, D/2-T,  W/2-nx, D/2-T);          // front partial
    seg(-W/2+T,-D/2+T, -W/2+T, D/2-T);           // left side
  }
  save(); renderLayers();
}
// floor image scale calibration
let calibPts=[];
function calibClick(e){
  if(!floorImg){ setMode('normal'); return; }
  const p=floorPoint(e); if(!p) return;
  calibPts.push(p.clone());
  if(calibPts.length===2){
    const measured=calibPts[0].distanceTo(calibPts[1]);
    const ans=prompt(`Measured ${ft2(measured)} ft on screen.\nEnter the REAL distance between those two points, in feet:`, '10');
    const real=parseFloat(ans);
    if(real>0 && measured>0.001){
      pushUndo();
      scaleFloorImg(real*FT/measured);
      save();
    }
    calibPts=[];
    setMode('normal');
  }
}

/* mode management */
const btnMeasure=document.getElementById('btnMeasure');
const btnMeasureArea=document.getElementById('btnMeasureArea');
const btnWalls=document.getElementById('btnWalls');
function setMode(m){
  // teardown previous
  measureStart=null; clearPreviewMeasure();
  drawPts=[]; clearDrawPreview();
  calibPts=[];
  mode=m;
  btnMeasure.classList.toggle('tog-on', m==='measure');
  btnMeasure.textContent = m==='measure' ? 'Measuring… (Esc)' : 'Measure';
  btnMeasureArea.classList.toggle('tog-on', m==='measureArea');
  btnMeasureArea.textContent = m==='measureArea' ? 'Area… (Esc)' : 'Area';
  btnWalls.classList.toggle('tog-on', m==='draw');
  btnWalls.textContent = m==='draw' ? 'Drawing… (Esc)' : 'Draw Walls';
  renderer.domElement.style.cursor=(m==='normal')?'':'crosshair';
  if(m!=='normal'){ setSelection([]); selectMeasure(null); }
  if(m==='draw'||m==='calib'){ viewTopFn(); }
  updateStatus();
}
btnMeasure.onclick=()=>setMode(mode==='measure'?'normal':'measure');
btnMeasureArea.onclick=()=>setMode(mode==='measureArea'?'normal':'measureArea');
btnWalls.onclick=()=>setMode(mode==='draw'?'normal':'draw');

/* ---------- 10. keyboard ---------- */
addEventListener('keydown',e=>{
  const tag=e.target.tagName;
  if(tag==='INPUT'||tag==='SELECT'||tag==='TEXTAREA') return;
  const meta=e.metaKey||e.ctrlKey;

  if(meta && (e.key==='z'||e.key==='Z')){ e.preventDefault(); e.shiftKey?redo():undo(); return; }
  if(meta && (e.key==='c'||e.key==='C')){ copySelection(); return; }
  if(meta && (e.key==='v'||e.key==='V')){ pasteClipboard(); return; }

  if(e.key==='m'||e.key==='M'){ setMode(mode==='measure'?'normal':'measure'); return; }
  if(e.key==='a'||e.key==='A'){ setMode(mode==='measureArea'?'normal':'measureArea'); return; }
  if(e.key==='Escape'){
    if(document.body.classList.contains('present')){ exitPresent(); return; }
    if(mode!=='normal'){
      if((mode==='measure'||mode==='measureArea')&&measureStart){ measureStart=null; clearPreviewMeasure(); return; }
      setMode('normal'); return;
    }
    setSelection([]); selectMeasure(null);
    return;
  }
  if(selectedMeasure && (e.key==='Delete'||e.key==='Backspace')){
    pushUndo(); removeMeasure(selectedMeasure); selectedMeasure=null;
    propsEl.style.display='none'; save(); return;
  }
  if(e.key==='g'||e.key==='G'){ toggleGroup(); return; }
  if(!selection.length) return;

  if(e.key==='l'||e.key==='L'){
    pushUndo(); const lock=!selection[0].locked;
    selection.forEach(i=>i.locked=lock); save(); renderProps(); return;
  }
  if(e.key==='r'||e.key==='R'){
    pushUndo();
    selection.forEach(it=>{ if(!it.locked){ it.rot+=Math.PI/2; meshById[it.id].rotation.y=it.rot; } });
    renderProps(); save(); return;
  }
  if(e.key==='d'||e.key==='D'){ duplicateSelection(); return; }
  if(e.key==='Delete'||e.key==='Backspace'){
    pushUndo(); removeItems(selection.slice()); setSelection([]); renderLayers(); save(); return;
  }
  // arrow nudges
  const NUDGE={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
  if(NUDGE){
    e.preventDefault();
    const step=e.shiftKey?12*IN:(settings.snapOn?snapStepM():1*IN);
    pushUndo();
    selection.forEach(it=>{
      if(it.locked) return;
      it.x+=NUDGE[0]*step; it.z+=NUDGE[1]*step;
      meshById[it.id].position.set(it.x,0,it.z);
    });
    save(); renderProps();
  }
});
let clipboard=null;
function copySelection(){
  if(!selection.length) return;
  clipboard=JSON.stringify(selection.map(it=>({type:it.type, params:it.params, x:it.x, z:it.z, rot:it.rot,
                                               label:it.label, notes:it.notes, grp:it.grp})));
}
function pasteClipboard(){
  if(!clipboard) return;
  pushUndo();
  const data=JSON.parse(clipboard);
  const grpMap={};
  const added=data.map(d=>{
    let g;
    if(d.grp){ g=grpMap[d.grp]||(grpMap[d.grp]=nextGrp++); }
    const it=addItem(d.type, JSON.parse(JSON.stringify(d.params)), {label:d.label, notes:d.notes, grp:g});
    it.x=d.x+1*FT; it.z=d.z+1*FT; it.rot=d.rot;
    rebuildItem(it);
    return it;
  });
  setSelection(added); save();
}

/* ---------- 11. views, camera, presentation ---------- */
function viewTopFn(){
  camera.position.set(0, Math.max(room.w,room.d)*FT*1.1, 0.001);
  controls.target.set(0,0,0); controls.update();
}
document.getElementById('viewTop').onclick=viewTopFn;
document.getElementById('view3d').onclick=()=>{
  camera.position.set(room.w*FT*.45, room.h*FT*1.1, room.d*FT*.55);
  controls.target.set(0,1,0); controls.update();
};
document.getElementById('viewFit').onclick=()=>{
  const r=Math.max(room.w,room.d)*FT;
  camera.position.set(r*.4, r*.55, r*.6);
  controls.target.set(0,0.5,0); controls.update();
};
document.getElementById('viewFitSel').onclick=()=>{
  if(!selection.length) return;
  const sb=selBounds();
  const cx=(sb.minX+sb.maxX)/2, cz=(sb.minZ+sb.maxZ)/2;
  const r=Math.max(sb.maxX-sb.minX, sb.maxZ-sb.minZ, 2);
  camera.position.set(cx+r*.8, r*1.1, cz+r*1.1);
  controls.target.set(cx,0.5,cz); controls.update();
};
document.getElementById('lockOrbit').onchange=e=>{
  controls.enableRotate=!e.target.checked;
  if(e.target.checked) viewTopFn();
};
document.getElementById('btnPresent').onclick=()=>{
  document.body.classList.add('present');
  setSelection([]); selectMeasure(null);
};
function exitPresent(){ document.body.classList.remove('present'); }
document.getElementById('btnPresentExit').onclick=exitPresent;
document.getElementById('btnHelp').onclick=()=>document.getElementById('help').style.display='flex';
document.getElementById('helpClose').onclick=()=>document.getElementById('help').style.display='none';

/* ---------- 12. planning checks ---------- */
const checksEl=document.getElementById('checks');
document.getElementById('btnChecks').onclick=()=>{
  syncCheckSettingsUI();
  checksEl.style.display='flex';
  runChecksUI();
};
document.getElementById('checksClose').onclick=()=>checksEl.style.display='none';
document.getElementById('runChecks').onclick=()=>{ readCheckSettingsUI(); runChecksUI(); };
function syncCheckSettingsUI(){
  document.getElementById('setAisle').value=settings.minAisleIn;
  document.getElementById('setBuffer').value=settings.vrBufferIn;
  document.getElementById('setStock').value=settings.stockIn;
  document.getElementById('setWaste').value=settings.wastePct;
}
function readCheckSettingsUI(){
  settings.minAisleIn=parseFloat(document.getElementById('setAisle').value)||36;
  settings.vrBufferIn=parseFloat(document.getElementById('setBuffer').value)||24;
  settings.stockIn=parseFloat(document.getElementById('setStock').value)||96;
  settings.wastePct=parseFloat(document.getElementById('setWaste').value)||10;
  save();
}
function expandedCorners(it, pad){
  const fp=it._fp||{w:.1,d:.1,ox:0,oz:0};
  const c=Math.cos(it.rot), s=Math.sin(it.rot);
  const hw=fp.w/2+pad, hd=fp.d/2+pad;
  return [[-hw,-hd],[hw,-hd],[hw,hd],[-hw,hd]].map(([x,z])=>{
    const lx=x+fp.ox, lz=z+fp.oz;
    return [it.x + lx*c + lz*s, it.z - lx*s + lz*c];
  });
}
function runChecks(){
  const out=[];
  const W=room.w*FT, D=room.d*FT;
  const vis=items.filter(it=>!it.hidden);
  const entries=vis.map(it=>({it, poly:rectCorners(it)}));

  // 1) outside room
  entries.forEach(({it,poly})=>{
    if(poly.some(([x,z])=>x<-W/2-0.011||x>W/2+0.011||z<-D/2-0.011||z>D/2+0.011))
      out.push({sev:'warn', msg:`“${dispName(it)}” extends outside the room boundary.`});
  });
  // 2) height vs ceiling
  vis.forEach(it=>{
    const elevFt=(it.params&&it.params.elev)||0;
    const topFt=(it._fp?it._fp.h/FT:0)+(it.type==='obj'?0:0);
    if(topFt>room.h+0.05 || (elevFt && elevFt+((it.params.h||0))>room.h+0.05))
      out.push({sev:'warn', msg:`“${dispName(it)}” is taller than the ${room.h} ft ceiling.`});
  });
  // 3) overlaps among solid items
  const solids=entries.filter(({it})=>isSolid(it));
  let overlapCount=0;
  for(let i=0;i<solids.length && overlapCount<25;i++){
    for(let j=i+1;j<solids.length && overlapCount<25;j++){
      const A=solids[i], B=solids[j];
      if(A.it.grp && A.it.grp===B.it.grp) continue;
      if(polysOverlap(A.poly,B.poly)){
        overlapCount++;
        const ezBuild=(layerOf(A.it)==='ez')!==(layerOf(B.it)==='ez');
        out.push({sev:'err', msg:`${ezBuild?'EZTube structure intersects building element: ':'Overlap: '}“${dispName(A.it)}” ↔ “${dispName(B.it)}”.`});
      }
    }
  }
  // 4) aisle clearance between solid items
  const minAisle=settings.minAisleIn*IN;
  let aisleCount=0;
  for(let i=0;i<solids.length && aisleCount<15;i++){
    for(let j=i+1;j<solids.length && aisleCount<15;j++){
      const A=solids[i], B=solids[j];
      if(A.it.grp && A.it.grp===B.it.grp) continue;
      const gap=polyGap(A.poly,B.poly);
      if(gap>0.03 && gap<minAisle){
        aisleCount++;
        out.push({sev:'warn', msg:`Aisle between “${dispName(A.it)}” and “${dispName(B.it)}” is ${fmtFtIn(gap)} (< ${settings.minAisleIn}″ minimum).`});
      }
    }
  }
  // 5) VR play-area buffer
  const vrKinds=['vrArena','vrStation','arcadeZone'];
  entries.forEach(({it})=>{
    if(!(it.type==='obj'&&vrKinds.includes(it.params.kind))) return;
    const exp=expandedCorners(it, settings.vrBufferIn*IN);
    solids.forEach(({it:o,poly})=>{
      if(o===it) return;
      if(it.grp && it.grp===o.grp) return;
      if(polysOverlap(exp,poly))
        out.push({sev:'warn', msg:`“${dispName(o)}” is within the ${settings.vrBufferIn}″ buffer of VR zone “${dispName(it)}”.`});
    });
  });
  // 6) missing labels on zones
  vis.forEach(it=>{
    if(isZone(it) && !(it.label||'').trim())
      out.push({sev:'info', msg:`Zone #${it.id} (${(OBJ_KINDS[it.params.kind]||{}).n}) has no label.`});
  });
  // 6b) door swing clearance
  function doorSwingPoly(it){
    const kind=OBJ_KINDS[it.params.kind];
    if(!kind||!kind.swing) return null;
    const W=(it.params.w??kind.w??3)*FT, D=(it.params.d??kind.d??0.4)*FT;
    const c=Math.cos(it.rot), s=Math.sin(it.rot);
    const toW=(lx,lz)=>[it.x+lx*c+lz*s, it.z-lx*s+lz*c];
    const poly=[toW(-W/2, D/2)];
    for(let i=0;i<=10;i++){
      const a=i/10*Math.PI/2;
      poly.push(toW(-W/2+Math.cos(a)*W, D/2+Math.sin(a)*W));
    }
    return poly;
  }
  vis.forEach(it=>{
    if(it.type!=='obj') return;
    const swing=doorSwingPoly(it);
    if(!swing) return;
    solids.forEach(({it:o,poly})=>{
      if(o===it) return;
      if(it.grp && it.grp===o.grp) return;
      if(polysOverlap(swing, poly))
        out.push({sev:'warn', msg:`Door swing of “${dispName(it)}” may be blocked by “${dispName(o)}”.`});
    });
  });
  // 7) cut length vs stock + 8) PN mapping
  const bom=computeBom();
  Object.keys(bom.cutCount).map(Number).forEach(k=>{
    const L=k/16*IN;
    if(L>settings.stockIn*IN+1e-9)
      out.push({sev:'err', msg:`Tube cut ${fmtIn(L)} exceeds the ${settings.stockIn}″ stock tube length (${bom.cutCount[k]}×).`});
  });
  bom.missingPN.forEach(shape=>{
    out.push({sev:'warn', msg:`No part-number mapping for connector shape “${shape}” — check EZTUBE_PN.`});
  });
  if(!out.length) out.push({sev:'info', msg:'No issues found. (Planning heuristics only — verify on site.)'});
  return out;
}
function runChecksUI(){
  const list=document.getElementById('checksList');
  const res=runChecks();
  list.innerHTML=res.map(r=>`<div class="warnItem ${r.sev==='err'?'err':r.sev==='info'?'info':''}">${r.msg}</div>`).join('');
}

/* ---------- 13. BOM modal & exports ---------- */
let bomView='all';
const PRICE_KEY='eztube-prices';
function loadPrices(){ try{ return JSON.parse(localStorage.getItem(PRICE_KEY)||'{}'); }catch(e){ return {}; } }
function savePrices(p){ try{ localStorage.setItem(PRICE_KEY, JSON.stringify(p)); }catch(e){} }

function computeBom(){
  const connCount={};     // 'pn|name|color|sys' -> qty
  const cutCount={};      // 1/16" bucket -> qty
  const rwallCount={};    // desc -> qty
  const objCount={};      // kind label -> qty
  const trussCount={};    // 'pn|name' -> qty
  const paintByColor={};  // '#RRGGBB' -> {area m², line m}
  const missingPN=new Set();
  const cutsArr=[];
  let totalTube=0, zoneArea=0, paintArea=0, paintLine=0;
  items.forEach(it=>{
    if(it.type==='rwall'){
      const key=`${it.params.len} ft × ${it.params.h} ft × ${it.params.thick}″`;
      rwallCount[key]=(rwallCount[key]||0)+1;
      return;
    }
    if(it.type==='truss'){
      (it._parts||[]).forEach(pt=>{ const key=pt.pn+'|'+pt.name; trussCount[key]=(trussCount[key]||0)+pt.qty; });
      return;
    }
    if(it.type==='paint'){
      const pa=it._paint||{}; const c=(it.params.color||'#d23b3b').toUpperCase();
      const e=paintByColor[c]||(paintByColor[c]={area:0, line:0});
      e.area+=pa.area||0; e.line+=pa.lineLen||0;
      paintArea+=pa.area||0; paintLine+=pa.lineLen||0;
      return;
    }
    if(it.type==='obj'){
      const k=OBJ_KINDS[it.params.kind]||{};
      objCount[k.n||it.params.kind]=(objCount[k.n||it.params.kind]||0)+1;
      if(isZone(it)) zoneArea+=itemAreaM2(it);
      return;
    }
    (it._conns||[]).forEach(shape=>{
      const color=it.params.color||'BK';
      const pnMap=EZTUBE_PN[shape]||{};
      const pn=pnMap[color]||pnMap.BK||shape;
      if(!pnMap[color] && !pnMap.BK) missingPN.add(shape);
      const nm=EZTUBE_PARTS[shape].name;
      const sys=shape.endsWith('-QR')?'Quick-Release':shape.endsWith('-S')?'Steel-Core':shape.endsWith('-HF')?'Press-Fit (HF)':'Universal';
      const key=[pn,nm,color,sys].join('|');
      connCount[key]=(connCount[key]||0)+1;
    });
    (it._cuts||[]).forEach(L=>{
      const key=Math.round(L/IN*16);
      cutCount[key]=(cutCount[key]||0)+1;
      totalTube+=L; cutsArr.push(L);
    });
  });
  const stockM=settings.stockIn*IN;
  const sorted=[...cutsArr].sort((a,b)=>b-a);
  const bins=[]; const overlong=[];
  sorted.forEach(c=>{
    if(c>stockM+1e-9){ overlong.push(c); return; }
    let placed=false;
    for(const b of bins){ if(b.rem>=c){ b.rem-=c; placed=true; break; } }
    if(!placed) bins.push({rem:stockM-c});
  });
  const stockNeeded=bins.length;
  const stockWithWaste=Math.ceil((totalTube*(1+settings.wastePct/100))/stockM);
  return {connCount, cutCount, totalTube, rwallCount, objCount, trussCount, zoneArea,
          paintByColor, paintArea, paintLine,
          missingPN:[...missingPN], stockNeeded, stockWithWaste, overlong};
}

function bomConnRowsBySys(connCount){
  const groups={};
  Object.keys(connCount).sort().forEach(k=>{
    const [pn,nm,color,sys]=k.split('|');
    (groups[sys]=groups[sys]||[]).push({pn,nm,color,qty:connCount[k]});
  });
  return groups;
}
function renderBom(){
  const b=computeBom();
  const el=document.getElementById('bomtables');
  document.getElementById('bomTabAll').classList.toggle('on', bomView==='all');
  document.getElementById('bomTabShop').classList.toggle('on', bomView==='shop');
  document.getElementById('bomTabObj').classList.toggle('on', bomView==='obj');
  const prices=loadPrices();

  if(bomView==='all'){
    let html='';
    const groups=bomConnRowsBySys(b.connCount);
    Object.keys(groups).sort().forEach(sys=>{
      html+=`<table><tr><th colspan="4">${sys} connectors</th></tr><tr><th>Part #</th><th>Description</th><th>Color</th><th>Qty</th></tr>`;
      groups[sys].forEach(r=>{ html+=`<tr><td>${r.pn}</td><td>${r.nm}</td><td>${r.color}</td><td>${r.qty}</td></tr>`; });
      html+='</table>';
    });
    html+='<table><tr><th>Tube cut length</th><th>Qty</th><th></th></tr>';
    Object.keys(b.cutCount).map(Number).sort((a,b2)=>b2-a).forEach(k=>{
      const L=k/16*IN;
      const over=L>settings.stockIn*IN+1e-9;
      html+=`<tr><td>${fmtIn(L)} (${(k/16*2.54).toFixed(1)} cm)</td><td>${b.cutCount[k]}</td><td>${over?'<span style="color:var(--err)">⚠ longer than stock</span>':''}</td></tr>`;
    });
    html+=`</table>
      <div class="sub">Total 1″×1″ tube: <b>${(b.totalTube/FT).toFixed(1)} ft</b> (${b.totalTube.toFixed(2)} m).
      Stock ${settings.stockIn}″ tubes — bin-packed: <b>${b.stockNeeded}</b>,
      with ${settings.wastePct}% waste allowance: <b>${Math.max(b.stockNeeded,b.stockWithWaste)}</b>.</div>`;
    if(Object.keys(b.trussCount).length){
      html+='<table><tr><th colspan="3">Stage truss — Global Truss F-series</th></tr><tr><th>Part</th><th>Description</th><th>Qty</th></tr>';
      Object.keys(b.trussCount).sort().forEach(k=>{ const [pn,nm]=k.split('|'); html+=`<tr><td>${pn}</td><td>${nm}</td><td>${b.trussCount[k]}</td></tr>`; });
      html+='</table><div class="sub">Standard Global Truss segment lengths; labels are descriptive — match against the supplier catalog for exact SKUs.</div>';
    }
    if(Object.keys(b.paintByColor).length){
      html+='<table><tr><th colspan="3">Finishes / paint</th></tr><tr><th>Color</th><th>Area (ft²)</th><th>Line (ft)</th></tr>';
      Object.keys(b.paintByColor).sort().forEach(c=>{ const e=b.paintByColor[c];
        html+=`<tr><td><span style="display:inline-block;width:11px;height:11px;border:1px solid #555;background:${c};vertical-align:middle;margin-right:5px"></span>${c}</td>`+
              `<td>${e.area?sqft(e.area).toFixed(1):'—'}</td><td>${e.line?(e.line/FT).toFixed(1):'—'}</td></tr>`;
      });
      html+=`</table><div class="sub">Total painted area: <b>${sqft(b.paintArea).toFixed(1)} ft²</b> · line paint: <b>${(b.paintLine/FT).toFixed(1)} ft</b>. Visual finishes — confirm coverage and coats against paint specs.</div>`;
    }
    if(Object.keys(b.rwallCount).length){
      html+='<table><tr><th>Building wall (non-EZTube)</th><th>Qty</th></tr>';
      Object.keys(b.rwallCount).sort().forEach(k=>{ html+=`<tr><td>${k}</td><td>${b.rwallCount[k]}</td></tr>`; });
      html+='</table>';
    }
    el.innerHTML=html;
  }
  else if(bomView==='shop'){
    const groups=bomConnRowsBySys(b.connCount);
    let html=`<div class="sub">EZTube purchasing list. Enter unit prices to estimate cost (saved locally in your browser).</div>
      <table><tr><th>Part #</th><th>Description</th><th>Qty</th><th>Unit $</th><th>Ext $</th></tr>`;
    let total=0, missing=false;
    Object.keys(groups).sort().forEach(sys=>{
      groups[sys].forEach(r=>{
        const pr=prices[r.pn];
        const ext=pr!==undefined?pr*r.qty:null;
        if(ext!==null) total+=ext; else missing=true;
        html+=`<tr><td>${r.pn}</td><td>${r.nm} (${r.color})</td><td>${r.qty}</td>
          <td><input class="price" type="number" min="0" step="0.01" data-pn="${r.pn}" value="${pr??''}"></td>
          <td>${ext!==null?'$'+ext.toFixed(2):'—'}</td></tr>`;
      });
    });
    const tubeQty=Math.max(b.stockNeeded,b.stockWithWaste);
    const tubePr=prices.STOCK_TUBE;
    const tubeExt=tubePr!==undefined?tubePr*tubeQty:null;
    if(tubeExt!==null) total+=tubeExt; else if(tubeQty>0) missing=true;
    html+=`<tr><td>—</td><td>Stock tube ${settings.stockIn}″ (incl. ${settings.wastePct}% waste)</td><td>${tubeQty}</td>
      <td><input class="price" type="number" min="0" step="0.01" data-pn="STOCK_TUBE" value="${tubePr??''}"></td>
      <td>${tubeExt!==null?'$'+tubeExt.toFixed(2):'—'}</td></tr>`;
    Object.keys(b.trussCount).sort().forEach(k=>{
      const [pn,nm]=k.split('|'); const qty=b.trussCount[k];
      const pr=prices[pn]; const ext=pr!==undefined?pr*qty:null;
      if(ext!==null) total+=ext; else missing=true;
      html+=`<tr><td>${pn}</td><td>${nm}</td><td>${qty}</td>
        <td><input class="price" type="number" min="0" step="0.01" data-pn="${pn}" value="${pr??''}"></td>
        <td>${ext!==null?'$'+ext.toFixed(2):'—'}</td></tr>`;
    });
    const paintRows=[];
    if(b.paintArea>0) paintRows.push(['PAINT_AREA', 'Wall paint area ($/ft²)', sqft(b.paintArea), 'ft²']);
    if(b.paintLine>0) paintRows.push(['PAINT_LINE', 'Line paint ($/ft)', b.paintLine/FT, 'ft']);
    paintRows.forEach(([pn,nm,qty])=>{
      const q=+qty.toFixed(1); const pr=prices[pn]; const ext=pr!==undefined?pr*q:null;
      if(ext!==null) total+=ext; else missing=true;
      html+=`<tr><td>${pn}</td><td>${nm}</td><td>${q}</td>
        <td><input class="price" type="number" min="0" step="0.01" data-pn="${pn}" value="${pr??''}"></td>
        <td>${ext!==null?'$'+ext.toFixed(2):'—'}</td></tr>`;
    });
    html+=`</table><div class="sub">Estimated material cost: <b>$${total.toFixed(2)}</b>${missing?' (some prices missing)':''}</div>`;
    el.innerHTML=html;
    el.querySelectorAll('input.price').forEach(inp=>{
      inp.onchange=()=>{
        const p=loadPrices();
        const v=parseFloat(inp.value);
        if(isNaN(v)) delete p[inp.dataset.pn]; else p[inp.dataset.pn]=v;
        savePrices(p); renderBom();
      };
    });
  }
  else { // layout objects
    let html='<table><tr><th>Layout object</th><th>Qty</th></tr>';
    Object.keys(b.objCount).sort().forEach(k=>{ html+=`<tr><td>${k}</td><td>${b.objCount[k]}</td></tr>`; });
    html+='</table>';
    if(Object.keys(b.rwallCount).length){
      html+='<table><tr><th>Building wall</th><th>Qty</th></tr>';
      Object.keys(b.rwallCount).sort().forEach(k=>{ html+=`<tr><td>${k}</td><td>${b.rwallCount[k]}</td></tr>`; });
      html+='</table>';
    }
    const a=areasSummary();
    html+=`<div class="sub">Room ${room.w}×${room.d} ft = <b>${sqft(a.room).toFixed(0)} ft²</b> ·
      zones marked: <b>${sqft(b.zoneArea).toFixed(0)} ft²</b> ·
      solid items footprint: <b>${sqft(a.used).toFixed(0)} ft²</b> ·
      open ≈ <b>${sqft(a.free).toFixed(0)} ft²</b></div>`;
    el.innerHTML=html;
  }
}
document.getElementById('btnBom').onclick=()=>{ document.getElementById('bom').style.display='flex'; renderBom(); };
document.getElementById('bomClose').onclick=()=>document.getElementById('bom').style.display='none';
document.getElementById('bomTabAll').onclick=()=>{ bomView='all'; renderBom(); };
document.getElementById('bomTabShop').onclick=()=>{ bomView='shop'; renderBom(); };
document.getElementById('bomTabObj').onclick=()=>{ bomView='obj'; renderBom(); };

function download(name, content, mime){
  const a=document.createElement('a');
  a.href=typeof content==='string'&&content.startsWith('data:')?content:URL.createObjectURL(new Blob([content],{type:mime||'text/plain'}));
  a.download=name; a.click();
}
document.getElementById('bomCsv').onclick=()=>{
  const b=computeBom();
  let csv='type,part_number,description,color,system,qty\n';
  Object.keys(b.connCount).sort().forEach(k=>{
    const [pn,nm,color,sys]=k.split('|');
    csv+=`connector,${pn},"${nm}",${color},${sys},${b.connCount[k]}\n`;
  });
  Object.keys(b.cutCount).map(Number).sort((a,b2)=>b2-a).forEach(k=>{
    csv+=`tube_cut,,"${fmtIn(k/16*IN)} cut of 1x1 tube",,,${b.cutCount[k]}\n`;
  });
  csv+=`tube_total,,total linear feet,,,${(b.totalTube/FT).toFixed(1)}\n`;
  csv+=`stock_tubes,,${settings.stockIn}in stock tubes incl waste,,,${Math.max(b.stockNeeded,b.stockWithWaste)}\n`;
  Object.keys(b.trussCount).sort().forEach(k=>{ const [pn,nm]=k.split('|'); csv+=`truss,${pn},"${nm}",,,${b.trussCount[k]}\n`; });
  Object.keys(b.paintByColor).sort().forEach(c=>{ const e=b.paintByColor[c];
    if(e.area>0) csv+=`paint_area,,"Wall paint ${c}",${c},,${sqft(e.area).toFixed(1)} ft2\n`;
    if(e.line>0) csv+=`paint_line,,"Line paint ${c}",${c},,${(e.line/FT).toFixed(1)} ft\n`; });
  Object.keys(b.rwallCount).sort().forEach(k=>{ csv+=`building_wall,,"${k} solid wall (non-EZTube)",,,${b.rwallCount[k]}\n`; });
  download('eztube-bom.csv', csv, 'text/csv');
};
document.getElementById('bomCutCsv').onclick=()=>{
  const b=computeBom();
  let csv='cut_length_in,cut_length_label,qty\n';
  Object.keys(b.cutCount).map(Number).sort((a,b2)=>b2-a).forEach(k=>{
    csv+=`${(k/16).toFixed(3)},"${fmtIn(k/16*IN)}",${b.cutCount[k]}\n`;
  });
  download('eztube-cutlist.csv', csv, 'text/csv');
};
document.getElementById('bomJson').onclick=()=>{
  download('eztube-bom.json', JSON.stringify(computeBom(),null,1), 'application/json');
};
document.getElementById('bomPrintBtn').onclick=()=>openPrintWindow(true);

/* ---------- 14. PNG / print / summary exports ---------- */
function captureTopPNG(){
  const W=room.w*FT, D=room.d*FT;
  const pad=1.04;
  const aspect=renderer.domElement.width/renderer.domElement.height;
  let hw=W/2*pad, hh=D/2*pad;
  if(hw/hh<aspect) hw=hh*aspect; else hh=hw/aspect;
  const ocam=new THREE.OrthographicCamera(-hw,hw,hh,-hh,0.1,100);
  ocam.position.set(0,50,0); ocam.up.set(0,0,-1); ocam.lookAt(0,0,0);
  renderer.render(scene,ocam);
  const url=renderer.domElement.toDataURL('image/png');
  renderer.render(scene,camera);
  return url;
}
document.getElementById('btnShotTop').onclick=()=>download('eztube-plan-top.png', captureTopPNG());
document.getElementById('btnShot3d').onclick=()=>{
  renderer.render(scene,camera);
  download('eztube-plan-3d.png', renderer.domElement.toDataURL('image/png'));
};
function projectSummaryHTML(){
  const a=areasSummary();
  const b=computeBom();
  const vrCount=items.filter(it=>it.type==='obj'&&['vrArena','vrStation','arcadeZone'].includes(it.params.kind)).length;
  const ezCount=items.filter(it=>!['obj','rwall','truss','paint'].includes(it.type)).length;
  const trussCt=items.filter(it=>it.type==='truss').length;
  const connTotal=Object.values(b.connCount).reduce((x,y)=>x+y,0);
  return `<h2>Project summary</h2>
    <table border="0" cellpadding="4" style="border-collapse:collapse;font-size:13px">
      <tr><td><b>Room</b></td><td>${room.w} × ${room.d} ft, ceiling ${room.h} ft — ${sqft(a.room).toFixed(0)} ft²</td></tr>
      <tr><td><b>VR zones / stations</b></td><td>${vrCount}</td></tr>
      <tr><td><b>EZTube structures</b></td><td>${ezCount}</td></tr>
      <tr><td><b>EZTube connectors</b></td><td>${connTotal}</td></tr>
      ${trussCt?`<tr><td><b>Stage truss assemblies</b></td><td>${trussCt}</td></tr>`:''}
      ${b.paintArea||b.paintLine?`<tr><td><b>Wall paint / finishes</b></td><td>${sqft(b.paintArea).toFixed(0)} ft² area · ${(b.paintLine/FT).toFixed(0)} ft line</td></tr>`:''}
      <tr><td><b>Tube</b></td><td>${(b.totalTube/FT).toFixed(1)} linear ft · ${Math.max(b.stockNeeded,b.stockWithWaste)} stock ${settings.stockIn}″ tubes incl. ${settings.wastePct}% waste</td></tr>
      <tr><td><b>Open floor</b></td><td>≈ ${sqft(a.free).toFixed(0)} ft²</td></tr>
      ${projectNotes?`<tr><td valign="top"><b>Notes</b></td><td>${projectNotes.replace(/</g,'&lt;').replace(/\n/g,'<br>')}</td></tr>`:''}
    </table>`;
}
function openPrintWindow(includeBom){
  const top=captureTopPNG();
  const b=computeBom();
  const groups=bomConnRowsBySys(b.connCount);
  let bomHtml='';
  if(includeBom){
    Object.keys(groups).sort().forEach(sys=>{
      bomHtml+=`<h3>${sys} connectors</h3><table><tr><th>Part #</th><th>Description</th><th>Color</th><th>Qty</th></tr>`;
      groups[sys].forEach(r=>{ bomHtml+=`<tr><td>${r.pn}</td><td>${r.nm}</td><td>${r.color}</td><td>${r.qty}</td></tr>`; });
      bomHtml+='</table>';
    });
    bomHtml+='<h3>Cut list</h3><table><tr><th>Length</th><th>Qty</th></tr>';
    Object.keys(b.cutCount).map(Number).sort((a,b2)=>b2-a).forEach(k=>{
      bomHtml+=`<tr><td>${fmtIn(k/16*IN)}</td><td>${b.cutCount[k]}</td></tr>`;
    });
    bomHtml+='</table>';
    if(Object.keys(b.trussCount).length){
      bomHtml+='<h3>Stage truss (Global Truss F-series)</h3><table><tr><th>Part</th><th>Description</th><th>Qty</th></tr>';
      Object.keys(b.trussCount).sort().forEach(k=>{ const [pn,nm]=k.split('|'); bomHtml+=`<tr><td>${pn}</td><td>${nm}</td><td>${b.trussCount[k]}</td></tr>`; });
      bomHtml+='</table>';
    }
    if(Object.keys(b.paintByColor).length){
      bomHtml+='<h3>Finishes / paint</h3><table><tr><th>Color</th><th>Area (ft²)</th><th>Line (ft)</th></tr>';
      Object.keys(b.paintByColor).sort().forEach(c=>{ const e=b.paintByColor[c];
        bomHtml+=`<tr><td>${c}</td><td>${e.area?sqft(e.area).toFixed(1):'—'}</td><td>${e.line?(e.line/FT).toFixed(1):'—'}</td></tr>`; });
      bomHtml+='</table>';
    }
    if(Object.keys(b.rwallCount).length||Object.keys(b.objCount).length){
      bomHtml+='<h3>Layout objects (non-EZTube)</h3><table><tr><th>Item</th><th>Qty</th></tr>';
      Object.keys(b.objCount).sort().forEach(k=>{ bomHtml+=`<tr><td>${k}</td><td>${b.objCount[k]}</td></tr>`; });
      Object.keys(b.rwallCount).sort().forEach(k=>{ bomHtml+=`<tr><td>Building wall ${k}</td><td>${b.rwallCount[k]}</td></tr>`; });
      bomHtml+='</table>';
    }
  }
  const w=window.open('','_blank');
  w.document.write(`<!DOCTYPE html><html><head><title>EZTube Layout Plan</title>
    <style>body{font:13px/1.5 -apple-system,sans-serif;color:#111;margin:24px}
    h1{font-size:20px}h2{font-size:16px;margin-top:18px}h3{font-size:14px;margin-top:14px}
    table{border-collapse:collapse;margin:6px 0 12px}th,td{border:1px solid #bbb;padding:4px 8px;text-align:left;font-size:12px}
    img{max-width:100%;border:1px solid #ccc;margin:8px 0}
    .foot{color:#777;font-size:11px;margin-top:20px}</style></head><body>
    <h1>EZTube Layout Plan</h1>
    <div>${new Date().toLocaleDateString()}</div>
    <img src="${top}">
    ${projectSummaryHTML()}
    ${bomHtml}
    <div class="foot">Generated by EZTube Layout Planner. Planning document only — verify all dimensions on site and check local code requirements.</div>
    <script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script>
    </body></html>`);
  w.document.close();
}
document.getElementById('btnPrint').onclick=()=>openPrintWindow(true);

/* ---------- 15. settings wiring & boot ---------- */
['roomW','roomD','roomH'].forEach((id,i)=>{
  document.getElementById(id).addEventListener('change', e=>{
    pushUndo();
    room[['w','d','h'][i]] = parseFloat(e.target.value)||room[['w','d','h'][i]];
    buildRoom(); save();
  });
});
document.getElementById('snapSize').onchange=e=>{ settings.snapIn=parseFloat(e.target.value)||3; save(); };
document.getElementById('snapOn').onchange=e=>{ settings.snapOn=e.target.checked; save(); };
document.getElementById('gridOn').onchange=e=>{ settings.gridOn=e.target.checked; if(gridRef) gridRef.visible=settings.gridOn; save(); };
document.getElementById('dimsOn').onchange=e=>{ settings.dimsOn=e.target.checked; applyLayerVisibility(); save(); };
function syncSettingsUI(){
  document.getElementById('snapSize').value=String(settings.snapIn);
  document.getElementById('snapOn').checked=settings.snapOn;
  document.getElementById('gridOn').checked=settings.gridOn;
  document.getElementById('dimsOn').checked=settings.dimsOn;
  if(gridRef) gridRef.visible=settings.gridOn;
}

// project save / load (file)
document.getElementById('btnSave').onclick=()=>{
  download('eztube-layout.json', JSON.stringify(snapshot(),null,1), 'application/json');
};
document.getElementById('btnLoad').onclick=()=>document.getElementById('fileLoad').click();
document.getElementById('fileLoad').addEventListener('change',e=>{
  const f=e.target.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=()=>{ try{ restore(JSON.parse(r.result)); save(); }catch(err){ alert('Invalid layout file'); } };
  r.readAsText(f);
  e.target.value='';
});
// floor image import
document.getElementById('fileImg').addEventListener('change',e=>{
  const f=e.target.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=()=>{ setFloorImage(r.result, ()=>{ renderPalette(); save(); }); };
  r.readAsDataURL(f);
  e.target.value='';
});

// called by core restore()/applyCore() so UI follows data
function onRestored(){
  selection=[]; selectedMeasure=null;
  propsEl.style.display='none';
  syncSettingsUI();
  renderLayers();
  if(activeTab==='site') renderPalette();
  updateStatus();
}

// boot
loadParts().then(()=>{
  document.getElementById('loading').style.display='none';
  renderPalette();
  renderLayers();
  try{
    const saved=localStorage.getItem(SAVE_KEY);
    if(saved) restore(JSON.parse(saved));
  }catch(e){}
  syncSettingsUI();
  document.getElementById('view3d').click();
  updateStatus();
});
(function animate(){ requestAnimationFrame(animate); controls.update(); renderer.render(scene,camera); })();

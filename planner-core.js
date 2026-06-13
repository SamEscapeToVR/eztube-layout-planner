/* ============================================================
   EZTube Layout Planner — CORE
   Units: internal = meters. UI = feet/inches.
   Sections:
     1.  Constants & unit helpers
     2.  Settings, layers, project state
     3.  three.js base scene
     4.  Room shell & grid
     5.  EZTube part meshes & connector orientation
     6.  Tube/connector build helpers
     7.  EZTube assembly builders (wall, booth, run, frame, sign, …)
     8.  Building wall + space-plan object builders
     9.  Item lifecycle (add/rebuild/remove, layers, labels)
     10. Footprints, bounding boxes, collision helpers
     11. Measurements (data + meshes)
     12. Floor-plan reference image
     13. Serialization (v2 + legacy), undo/redo
   ============================================================ */

/* ---------- 1. constants & unit helpers ---------- */
const FT = 0.3048, IN = 0.0254, TUBE = 1*IN;       // 1" sq tube
const INSET = {HF:12.7e-3, S:12.7e-3, QR:14.3e-3}; // tube end inset per connector system
const COLORS = {BK:0x1b1b1f, GY:0x8a8d93, WH:0xf2f2f4};
const TUBE_COLORS = {SI:0xc9cdd4, BK:0x222227, WH:0xf0f0f2};
const FOOT_H = 0.060;                              // exposed adjustable-foot height

function fmtIn(m){ const inches=m/IN; const whole=Math.floor(inches); let fr=Math.round((inches-whole)*16), den=16; if(fr===16) return `${whole+1}"`; if(fr===0) return `${whole}"`; while(fr%2===0){fr/=2;den/=2;} return `${whole} ${fr}/${den}"`; }
function fmtFtIn(m){
  const totIn=m/IN, ft=Math.floor(totIn/12), rem=(totIn-ft*12)*IN;
  const inStr=fmtIn(rem);
  return ft>0 ? (inStr==='0"' ? `${ft}'` : `${ft}' ${inStr}`) : inStr;
}
function ft2(m){ return (m/FT).toFixed(2); }       // decimal feet string
function sqft(m2){ return m2/(FT*FT); }

/* ---------- 2. settings, layers, project state ---------- */
const DEFAULT_SETTINGS = {snapIn:3, snapOn:true, gridOn:true, dimsOn:true,
                          minAisleIn:36, vrBufferIn:24, stockIn:96, wastePct:10};
const DEFAULT_LAYERS = {ez:true, building:true, doors:true, zones:true,
                        furniture:true, elec:true, labels:true, floorimg:true};
const LAYER_NAMES = {ez:'EZTube structures', building:'Building walls / columns', doors:'Doors & windows',
                     zones:'VR & operational zones', furniture:'Furniture / equipment',
                     elec:'Electrical / data / markers', labels:'Labels', floorimg:'Floor-plan image'};

let settings = {...DEFAULT_SETTINGS};
let layers = {...DEFAULT_LAYERS};
let projectNotes = '';
let room = {w:40, d:60, h:12}; // feet

function snapStepM(){ return settings.snapIn*IN; }

/* ---------- 3. three.js base ---------- */
const vp = document.getElementById('viewport');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x14161a);
const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 500);
camera.position.set(8, 9, 12);
const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
vp.appendChild(renderer.domElement);
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1, 0);
controls.maxPolarAngle = Math.PI/2 - 0.02;
scene.add(new THREE.AmbientLight(0xffffff, .55));
const sun = new THREE.DirectionalLight(0xffffff, .85);
sun.position.set(10, 18, 8); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left=-20; sun.shadow.camera.right=20; sun.shadow.camera.top=20; sun.shadow.camera.bottom=-20;
scene.add(sun);
function resize(){ const w=vp.clientWidth,h=vp.clientHeight; camera.aspect=w/h; camera.updateProjectionMatrix(); renderer.setSize(w,h); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); }
addEventListener('resize', resize); resize();

/* ---------- 4. room shell & grid ---------- */
const roomGroup = new THREE.Group(); scene.add(roomGroup);
let gridRef = null;
function buildRoom(){
  roomGroup.clear();
  const W=room.w*FT, D=room.d*FT, H=room.h*FT;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({color:0x23262d, roughness:.95}));
  floor.rotation.x = -Math.PI/2; floor.receiveShadow = true; roomGroup.add(floor);
  gridRef = new THREE.GridHelper(Math.max(W,D), Math.max(room.w,room.d), 0x3a3f4c, 0x2b2f3a);
  gridRef.position.y = 0.001;
  gridRef.scale.set(W/Math.max(W,D), 1, D/Math.max(W,D));
  gridRef.visible = settings.gridOn;
  roomGroup.add(gridRef);
  const wallsGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(W, H, D));
  const walls = new THREE.LineSegments(wallsGeo, new THREE.LineBasicMaterial({color:0x4a5060}));
  walls.position.y = H/2; roomGroup.add(walls);
}
buildRoom();

/* ---------- 5. EZTube part meshes & connector orientation ---------- */
const partProtos = {};   // shapeKey -> normalized THREE.Group
const loader = new THREE.GLTFLoader();
function b64buf(b64){ const s=atob(b64),a=new Uint8Array(s.length); for(let i=0;i<s.length;i++)a[i]=s.charCodeAt(i); return a.buffer; }
function loadParts(){
  const keys = Object.keys(EZTUBE_PARTS);
  return Promise.all(keys.map(k => new Promise(res=>{
    loader.parse(b64buf(EZTUBE_PARTS[k].b64), '', g=>{
      const obj = g.scene;
      const box = new THREE.Box3().setFromObject(obj);
      const c = box.getCenter(new THREE.Vector3());
      const wrap = new THREE.Group();
      obj.position.sub(c);
      wrap.add(obj);
      partProtos[k] = wrap;
      res();
    }, ()=>{ partProtos[k]=null; res(); });
  })));
}
function connectorMesh(shape, color){
  const proto = partProtos[shape];
  const mat = new THREE.MeshStandardMaterial({color:COLORS[color]??COLORS.BK, roughness:.6, metalness:.1});
  if(proto){
    const m = proto.clone(true);
    m.traverse(o=>{ if(o.isMesh){ o.material = mat; o.castShadow = true; } });
    return m;
  }
  // fallback: simple box body + legs
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.3*TUBE,1.3*TUBE,1.3*TUBE), mat); g.add(body);
  (EZTUBE_PARTS[shape].legs||[]).forEach(l=>{
    const v = legVec(l);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(.9*TUBE,.9*TUBE,.9*TUBE), mat);
    leg.position.copy(v).multiplyScalar(1.1*TUBE); g.add(leg);
  });
  return g;
}
function legVec(s){ const sgn = s[0]==='+'?1:-1, ax = s[1]; return new THREE.Vector3(ax==='X'?sgn:0, ax==='Y'?sgn:0, ax==='Z'?sgn:0); }

// 24 axis-aligned rotations for connector orientation solving
const ROTS = (()=>{
  const qs=[], dirs=[new THREE.Vector3(1,0,0),new THREE.Vector3(-1,0,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,-1,0),new THREE.Vector3(0,0,1),new THREE.Vector3(0,0,-1)];
  dirs.forEach(z=>{ dirs.forEach(x=>{
    if(Math.abs(z.dot(x))>.5) return;
    const y = new THREE.Vector3().crossVectors(z,x);
    const m = new THREE.Matrix4().makeBasis(x,y,z);
    qs.push(new THREE.Quaternion().setFromRotationMatrix(m));
  });});
  return qs;
})();
function keyOf(v){ return [Math.round(v.x),Math.round(v.y),Math.round(v.z)].join(','); }
function orientFor(shape, desired){
  const legs = EZTUBE_PARTS[shape].legs.map(legVec);
  const want = new Set(desired.map(keyOf));
  for(const q of ROTS){
    const got = legs.map(l=>l.clone().applyQuaternion(q));
    if(got.every(g=>want.has(keyOf(g))) && got.length===want.size) return q;
  }
  return new THREE.Quaternion();
}

/* ---------- 6. tube/connector build helpers ---------- */
function sysIns(sys){ return INSET[sys] ?? INSET.HF; }
function lk(base, sys){ return base + '-' + sys; }  // shape key by system

function tubeMesh(len, color){
  const m = new THREE.Mesh(new THREE.BoxGeometry(TUBE, TUBE, len),
    new THREE.MeshStandardMaterial({color:TUBE_COLORS[color]??TUBE_COLORS.SI, roughness:.35, metalness:.75}));
  m.castShadow = true;
  return m;
}
// tube between two centerline points, shortened by ins at each end
function tubeBetween(a, b, insA, insB, color, cuts){
  const dir = new THREE.Vector3().subVectors(b,a);
  const full = dir.length(); dir.normalize();
  const len = full - insA - insB;
  if(len <= 0.01) return null;
  const m = tubeMesh(len, color);
  const mid = new THREE.Vector3().addVectors(a, dir.clone().multiplyScalar(insA + len/2));
  m.position.copy(mid);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1), dir);
  if(cuts) cuts.push(len);
  return m;
}
function addConn(group, shape, color, pos, dirs, bom){
  const m = connectorMesh(shape, color);
  m.position.copy(pos);
  m.quaternion.copy(orientFor(shape, dirs));
  group.add(m);
  if(bom) bom.push(shape);
}
function addFoot(group, x, z, conns){
  const up = new THREE.Vector3(0,1,0);
  const fm = connectorMesh('foot', 'BK');
  fm.position.set(x, 0.048, z);
  fm.quaternion.copy(orientFor('foot',[up]));
  group.add(fm); conns.push('foot');
}

/* ---------- 7. EZTube assembly builders ----------
   Each returns {group, conns:[shapeKeys], cuts:[lengths m]} */

function buildWall(p){
  // p: {w ft, h ft, sys HF|QR, color, tubeColor, base feet|tubes, panel, bays}
  const g = new THREE.Group(), conns=[], cuts=[];
  const W = p.w*FT, H = p.h*FT, ins = sysIns(p.sys);
  const half = W/2, topY = H - 0.013;
  const railY = p.base==='feet' ? 0.25 : 0.013;
  const bays = Math.max(1, p.bays|0);
  const postXs = [];
  for(let i=0;i<=bays;i++) postXs.push(-half + W*i/bays);
  const up = new THREE.Vector3(0,1,0), dn = new THREE.Vector3(0,-1,0);
  const px = new THREE.Vector3(1,0,0), nx = new THREE.Vector3(-1,0,0);
  const pz = new THREE.Vector3(0,0,1), nz = new THREE.Vector3(0,0,-1);

  postXs.forEach((x,i)=>{
    const isEnd = (i===0||i===bays);
    const topNode = new THREE.Vector3(x, topY, 0);
    if(p.base==='feet'){
      const railNode = new THREE.Vector3(x, railY, 0);
      const footTop = new THREE.Vector3(x, FOOT_H, 0);
      const t1 = tubeBetween(railNode, topNode, ins, ins, p.tubeColor, cuts); if(t1) g.add(t1);
      const t2 = tubeBetween(footTop, railNode, 0.04, ins, p.tubeColor, cuts); if(t2) g.add(t2);
      addFoot(g, x, 0, conns);
      if(isEnd){
        addConn(g, lk('T',p.sys), p.color, railNode, [up,dn, i===0?px:nx], conns);
      } else {
        addConn(g, lk('X4',p.sys), p.color, railNode, [up,dn,px,nx], conns);
      }
    } else {
      // tube base: bottom rail at floor level + ±Z stabilizer feet
      const railNode = new THREE.Vector3(x, 0.013, 0);
      const t1 = tubeBetween(railNode, topNode, ins, ins, p.tubeColor, cuts); if(t1) g.add(t1);
      if(isEnd){
        addConn(g, lk('T3D',p.sys), p.color, railNode, [up, i===0?px:nx, pz, nz], conns);
      } else {
        addConn(g, lk('W5',p.sys), p.color, railNode, [up,px,nx,pz,nz], conns);
      }
      [pz,nz].forEach(zd=>{
        const end = railNode.clone().add(zd.clone().multiplyScalar(12*IN));
        const t = tubeBetween(railNode, end, ins, INSET.HF, p.tubeColor, cuts); if(t) g.add(t);
        addConn(g, 'cap', p.color==='WH'?'BK':p.color==='GY'?'GY':'BK', end, [zd.clone().negate()], conns);
      });
    }
    // top junction
    if(isEnd){
      addConn(g, lk('L',p.sys), p.color, topNode, [dn, i===0?px:nx], conns);
    } else {
      addConn(g, lk('T',p.sys), p.color, topNode, [px,nx,dn], conns);
    }
  });
  // top + bottom rails between adjacent posts
  for(let i=0;i<bays;i++){
    const a = new THREE.Vector3(postXs[i], topY, 0), b = new THREE.Vector3(postXs[i+1], topY, 0);
    const t = tubeBetween(a,b,ins,ins,p.tubeColor,cuts); if(t) g.add(t);
    const ra = new THREE.Vector3(postXs[i], p.base==='feet'?railY:0.013, 0), rb = new THREE.Vector3(postXs[i+1], p.base==='feet'?railY:0.013, 0);
    const t2 = tubeBetween(ra,rb,ins,ins,p.tubeColor,cuts); if(t2) g.add(t2);
  }
  // fabric panel visual
  if(p.panel===true || p.panel==='true'){
    const py0 = (p.base==='feet'?railY:0.013)+0.02, py1 = topY-0.02;
    const pm = new THREE.Mesh(new THREE.PlaneGeometry(W-0.06, py1-py0),
      new THREE.MeshStandardMaterial({color:0x5a4fcf, transparent:true, opacity:.45, side:THREE.DoubleSide}));
    pm.position.set(0,(py0+py1)/2,0); g.add(pm);
  }
  return {group:g, conns, cuts};
}

function buildBooth(p){
  // p: {w,d,h ft, sys, color, tubeColor, midRail, bays}
  const g = new THREE.Group(), conns=[], cuts=[];
  const W=p.w*FT, D=p.d*FT, H=p.h*FT, ins=sysIns(p.sys);
  const topY = H-0.013;
  const bays = Math.max(1, (p.bays|0)||1);
  const cz=[-D/2,D/2];
  const up=new THREE.Vector3(0,1,0), dn=new THREE.Vector3(0,-1,0);
  const px=new THREE.Vector3(1,0,0), nx=new THREE.Vector3(-1,0,0);
  const postXs=[]; for(let i=0;i<=bays;i++) postXs.push(-W/2 + W*i/bays);

  postXs.forEach((x,xi)=>{
    const isEndX=(xi===0||xi===bays);
    cz.forEach((z,zi)=>{
      const top=new THREE.Vector3(x,topY,z), bot=new THREE.Vector3(x,FOOT_H,z);
      const t=tubeBetween(bot,top,0.04,ins,p.tubeColor,cuts); if(t) g.add(t);
      addFoot(g, x, z, conns);
      const dz=new THREE.Vector3(0,0,zi===0?1:-1);
      if(isEndX){
        const dx=new THREE.Vector3(xi===0?1:-1,0,0);
        addConn(g, lk('C3',p.sys), p.color, top, [dn,dx,dz], conns);
      } else {
        // interior post on long edge: rails continue ±X plus cross rail toward other edge
        addConn(g, lk('T3D',p.sys), p.color, top, [dn,px,nx,dz], conns);
      }
    });
  });
  // top rails: long edges segmented by posts, plus a cross rail at every post pair
  cz.forEach(z=>{
    for(let i=0;i<bays;i++){
      const a=new THREE.Vector3(postXs[i],topY,z), b=new THREE.Vector3(postXs[i+1],topY,z);
      const t=tubeBetween(a,b,ins,ins,p.tubeColor,cuts); if(t) g.add(t);
    }
  });
  postXs.forEach(x=>{
    const a=new THREE.Vector3(x,topY,cz[0]), b=new THREE.Vector3(x,topY,cz[1]);
    const t=tubeBetween(a,b,ins,ins,p.tubeColor,cuts); if(t) g.add(t);
  });
  if(p.midRail===true || p.midRail==='true'){
    const my = H*0.5;
    // perimeter rails at mid height with T3D junctions at the 4 corners
    const corners=[[-W/2,cz[0]],[W/2,cz[0]],[W/2,cz[1]],[-W/2,cz[1]]];
    for(let i=0;i<4;i++){
      const [x1,z1]=corners[i], [x2,z2]=corners[(i+1)%4];
      const t=tubeBetween(new THREE.Vector3(x1,my,z1), new THREE.Vector3(x2,my,z2), ins,ins,p.tubeColor,cuts); if(t) g.add(t);
    }
    corners.forEach(([x,z])=>{
      const node=new THREE.Vector3(x,my,z);
      const dx=new THREE.Vector3(x<0?1:-1,0,0), dz=new THREE.Vector3(0,0,z<0?1:-1);
      addConn(g, lk('T3D',p.sys), p.color, node, [up,dn,dx,dz], conns);
    });
  }
  return {group:g, conns, cuts};
}

function buildTube(p){
  const g=new THREE.Group(), cuts=[];
  const L=p.len*IN;
  const m=tubeMesh(L,p.tubeColor);
  if(p.orient==='vertical'){ m.rotation.x=Math.PI/2; m.position.y=L/2; }
  else { m.position.y=TUBE/2; }
  g.add(m); cuts.push(L);
  return {group:g, conns:[], cuts};
}

function buildPart(p){
  const g=new THREE.Group();
  const m=connectorMesh(p.shape, p.color);
  const ext=EZTUBE_PARTS[p.shape].ext_mm;
  m.position.y=(Math.min(...ext)/2000)+0.002;
  g.add(m);
  return {group:g, conns:[p.shape], cuts:[]};
}

/* polyline divider run on adjustable feet (axis-aligned segments only).
   pts: array of THREE.Vector2 (x,z meters). Used for L-walls, U-enclosures, queue rails. */
function buildRun(pts, p){
  const g=new THREE.Group(), conns=[], cuts=[];
  const H=p.h*FT, ins=sysIns(p.sys);
  const topY=H-0.013, railY=0.25;
  const up=new THREE.Vector3(0,1,0), dn=new THREE.Vector3(0,-1,0);

  // subdivide segments so a bay never exceeds ~6 ft
  const nodes=[];           // {pos:Vector2, dirs:[Vector3 horizontal legs]}
  const segs=[];            // [Vector2 a, Vector2 b] consecutive node pairs
  const maxBay=6*FT;
  const ptsM=pts.map(q=>q.clone());
  const allPts=[];
  for(let i=0;i<ptsM.length-1;i++){
    const a=ptsM[i], b=ptsM[i+1];
    const n=Math.max(1, Math.ceil(a.distanceTo(b)/maxBay));
    for(let j=0;j<n;j++) allPts.push(a.clone().lerp(b, j/n));
  }
  allPts.push(ptsM[ptsM.length-1].clone());
  for(let i=0;i<allPts.length-1;i++) segs.push([allPts[i],allPts[i+1]]);

  allPts.forEach((q,i)=>{
    const dirs=[];
    if(i>0){ const d=new THREE.Vector2().subVectors(allPts[i-1],q).normalize(); dirs.push(new THREE.Vector3(Math.round(d.x),0,Math.round(d.y))); }
    if(i<allPts.length-1){ const d=new THREE.Vector2().subVectors(allPts[i+1],q).normalize(); dirs.push(new THREE.Vector3(Math.round(d.x),0,Math.round(d.y))); }
    nodes.push({pos:q, dirs});
  });

  nodes.forEach(nd=>{
    const x=nd.pos.x, z=nd.pos.y;
    const topNode=new THREE.Vector3(x,topY,z), railNode=new THREE.Vector3(x,railY,z), footTop=new THREE.Vector3(x,FOOT_H,z);
    const t1=tubeBetween(railNode,topNode,ins,ins,p.tubeColor,cuts); if(t1) g.add(t1);
    const t2=tubeBetween(footTop,railNode,0.04,ins,p.tubeColor,cuts); if(t2) g.add(t2);
    addFoot(g, x, z, conns);
    const h=nd.dirs;
    const opposite = h.length===2 && h[0].clone().add(h[1]).length()<0.5;
    // top junction: 1 leg → L, straight-through → T, 90° corner → C3
    if(h.length===1)      addConn(g, lk('L',p.sys),  p.color, topNode, [dn,...h], conns);
    else if(opposite)     addConn(g, lk('T',p.sys),  p.color, topNode, [dn,...h], conns);
    else                  addConn(g, lk('C3',p.sys), p.color, topNode, [dn,...h], conns);
    // rail junction: 1 leg → T, straight → X4, corner → T3D (post pair + two perpendicular rails)
    if(h.length===1)      addConn(g, lk('T',p.sys),  p.color, railNode, [up,dn,...h], conns);
    else if(opposite)     addConn(g, lk('X4',p.sys), p.color, railNode, [up,dn,...h], conns);
    else                  addConn(g, lk('T3D',p.sys),p.color, railNode, [up,dn,...h], conns);
  });

  segs.forEach(([a,b])=>{
    const t=tubeBetween(new THREE.Vector3(a.x,topY,a.y), new THREE.Vector3(b.x,topY,b.y), ins,ins,p.tubeColor,cuts); if(t) g.add(t);
    const t2=tubeBetween(new THREE.Vector3(a.x,railY,a.y), new THREE.Vector3(b.x,railY,b.y), ins,ins,p.tubeColor,cuts); if(t2) g.add(t2);
    if(p.panel===true||p.panel==='true'){
      const len=a.distanceTo(b);
      const mid=a.clone().lerp(b,0.5);
      const pm=new THREE.Mesh(new THREE.PlaneGeometry(len-0.06, topY-railY-0.04),
        new THREE.MeshStandardMaterial({color:0x5a4fcf, transparent:true, opacity:.45, side:THREE.DoubleSide}));
      pm.position.set(mid.x,(railY+topY)/2,mid.y);
      pm.rotation.y=Math.atan2(-(b.y-a.y), b.x-a.x);
      g.add(pm);
    }
  });
  return {group:g, conns, cuts};
}

function buildLRun(p){  // corner / L-shaped divider: arms along +X and +Z from the corner
  return buildRun([new THREE.Vector2(p.w1*FT,0), new THREE.Vector2(0,0), new THREE.Vector2(0,p.w2*FT)], p);
}
function buildURun(p){  // U-shaped enclosure opening toward +Z
  const W=p.w*FT, D=p.d*FT;
  return buildRun([new THREE.Vector2(-W/2,D/2), new THREE.Vector2(-W/2,-D/2),
                   new THREE.Vector2(W/2,-D/2), new THREE.Vector2(W/2,D/2)], p);
}

/* rectangular frame with perimeter rails at bottom, top, and N intermediate levels.
   Doubles as storage shelf / equipment rack / merch display. */
function buildFrame(p){
  const g=new THREE.Group(), conns=[], cuts=[];
  const W=p.w*FT, D=p.d*FT, H=p.h*FT, ins=sysIns(p.sys);
  const levels=Math.max(0, p.levels|0);
  const up=new THREE.Vector3(0,1,0), dn=new THREE.Vector3(0,-1,0);
  const ys=[0.013];
  for(let i=1;i<=levels;i++) ys.push(0.013 + (H-0.026)*i/(levels+1));
  ys.push(H-0.013);
  const corners=[[-W/2,-D/2],[W/2,-D/2],[W/2,D/2],[-W/2,D/2]];
  // posts (segmented between levels) + junction connectors
  corners.forEach(([x,z])=>{
    const dx=new THREE.Vector3(x<0?1:-1,0,0), dz=new THREE.Vector3(0,0,z<0?1:-1);
    for(let i=0;i<ys.length-1;i++){
      const t=tubeBetween(new THREE.Vector3(x,ys[i],z), new THREE.Vector3(x,ys[i+1],z), ins,ins,p.tubeColor,cuts); if(t) g.add(t);
    }
    ys.forEach((y,i)=>{
      const node=new THREE.Vector3(x,y,z);
      if(i===0)               addConn(g, lk('C3',p.sys), p.color, node, [up,dx,dz], conns);
      else if(i===ys.length-1)addConn(g, lk('C3',p.sys), p.color, node, [dn,dx,dz], conns);
      else                    addConn(g, lk('T3D',p.sys),p.color, node, [up,dn,dx,dz], conns);
    });
  });
  // perimeter rails at every level
  ys.forEach(y=>{
    for(let i=0;i<4;i++){
      const [x1,z1]=corners[i],[x2,z2]=corners[(i+1)%4];
      const t=tubeBetween(new THREE.Vector3(x1,y,z1), new THREE.Vector3(x2,y,z2), ins,ins,p.tubeColor,cuts); if(t) g.add(t);
    }
    // shelf board visual at intermediate levels
    if(y>0.1 && y<H-0.1 && (p.shelves===true||p.shelves==='true')){
      const sm=new THREE.Mesh(new THREE.BoxGeometry(W-0.04, 0.012, D-0.04),
        new THREE.MeshStandardMaterial({color:0x4a4136, roughness:.85}));
      sm.position.y=y+0.013; g.add(sm);
    }
  });
  return {group:g, conns, cuts};
}

/* ceiling-hung sign frame: rectangular tube frame with panel, suspended by two drop tubes */
function buildSign(p){
  const g=new THREE.Group(), conns=[], cuts=[];
  const W=p.w*FT, Hp=p.ph*FT, elev=p.elev*FT, ceil=room.h*FT, ins=sysIns(p.sys);
  const y0=elev, y1=elev+Hp;
  const xs=[-W/2,W/2];
  const up=new THREE.Vector3(0,1,0), dn=new THREE.Vector3(0,-1,0);
  const px=new THREE.Vector3(1,0,0), nx=new THREE.Vector3(-1,0,0);
  // frame corners (L) + verticals + horizontals
  xs.forEach((x,i)=>{
    const dx=i===0?px:nx;
    addConn(g, lk('L',p.sys), p.color, new THREE.Vector3(x,y0,0), [up,dx], conns);
    const t=tubeBetween(new THREE.Vector3(x,y0,0), new THREE.Vector3(x,y1,0), ins,ins,p.tubeColor,cuts); if(t) g.add(t);
  });
  const tb=tubeBetween(new THREE.Vector3(xs[0],y0,0), new THREE.Vector3(xs[1],y0,0), ins,ins,p.tubeColor,cuts); if(tb) g.add(tb);
  // top edge: T junctions at hang points, L at corners; 3 segments across the top
  const hang=[-W/4, W/4];
  const topPts=[xs[0], hang[0], hang[1], xs[1]];
  xs.forEach((x,i)=>addConn(g, lk('L',p.sys), p.color, new THREE.Vector3(x,y1,0), [dn, i===0?px:nx], conns));
  hang.forEach(hx=>{
    addConn(g, lk('T',p.sys), p.color, new THREE.Vector3(hx,y1,0), [px,nx,up], conns);
    const t=tubeBetween(new THREE.Vector3(hx,y1,0), new THREE.Vector3(hx,ceil,0), ins, 0, p.tubeColor, cuts); if(t) g.add(t);
  });
  for(let i=0;i<3;i++){
    const t=tubeBetween(new THREE.Vector3(topPts[i],y1,0), new THREE.Vector3(topPts[i+1],y1,0), ins,ins,p.tubeColor,cuts); if(t) g.add(t);
  }
  if(p.panel===true||p.panel==='true'){
    const pm=new THREE.Mesh(new THREE.PlaneGeometry(W-0.06,Hp-0.06),
      new THREE.MeshStandardMaterial({color:0x5a4fcf, transparent:true, opacity:.5, side:THREE.DoubleSide}));
    pm.position.set(0,(y0+y1)/2,0); g.add(pm);
  }
  return {group:g, conns, cuts};
}

/* ---------- 8. building wall + space-plan object builders ---------- */
const RWALL_COLORS = {WH:0xe8e4da, GY:0x8d9097, CN:0xb6b3ac, BK:0x3a3d44};
function buildRwall(p){
  const g=new THREE.Group();
  const L=p.len*FT, H=p.h*FT, T=(p.thick||5)*IN;
  const m=new THREE.Mesh(new THREE.BoxGeometry(L,H,T),
    new THREE.MeshStandardMaterial({color:RWALL_COLORS[p.color]??RWALL_COLORS.WH, roughness:.9, metalness:0}));
  m.position.y=H/2; m.castShadow=true; m.receiveShadow=true;
  g.add(m);
  return {group:g, conns:[], cuts:[]};
}

/* Space-plan object catalog.
   shape: zone (flat translucent), box (solid), opening (wall-mounted), marker (small post).
   Dimensions in feet. snapWall: drags snap onto nearest building wall. */
const OBJ_KINDS = {
  // zones
  vrArena:        {n:'VR Play Arena',          shape:'zone',   layer:'zones',     w:12,d:12,        color:'#7c5cff'},
  vrStation:      {n:'VR Station / Bay',       shape:'zone',   layer:'zones',     w:8, d:8,         color:'#4f8ef7'},
  arcadeZone:     {n:'Arcade / Free-Roam Zone',shape:'zone',   layer:'zones',     w:12,d:12,        color:'#46d4e0'},
  waitingArea:    {n:'Customer Waiting Area',  shape:'zone',   layer:'zones',     w:10,d:8,         color:'#3ddc84'},
  staffArea:      {n:'Staff-Only Area',        shape:'zone',   layer:'zones',     w:8, d:6,         color:'#ffb84d'},
  partyZone:      {n:'Party / Event Room',     shape:'zone',   layer:'zones',     w:14,d:12,        color:'#ff6bd6'},
  repairArea:     {n:'Repair / Intake Area',   shape:'zone',   layer:'zones',     w:8, d:6,         color:'#c9a24b'},
  restroom:       {n:'Restroom',               shape:'zone',   layer:'zones',     w:6, d:8,         color:'#9aa0ad'},
  genericRect:    {n:'Generic Area',           shape:'zone',   layer:'zones',     w:6, d:6,         color:'#8a8d93'},
  // furniture / equipment
  reception:      {n:'Reception Counter',      shape:'box',    layer:'furniture', w:6,  d:2,  h:3.5, color:'#6b4f2a'},
  pos:            {n:'POS / Checkout Stand',   shape:'box',    layer:'furniture', w:2,  d:2,  h:3.5, color:'#566074'},
  bench:          {n:'Waiting Bench',          shape:'box',    layer:'furniture', w:5,  d:1.5,h:1.5, color:'#3f5e52'},
  shelving:       {n:'Storage Shelving',       shape:'box',    layer:'furniture', w:4,  d:1.5,h:6,   color:'#5b5246'},
  workbench:      {n:'Workbench / Repair Desk',shape:'box',    layer:'furniture', w:6,  d:2.5,h:3,   color:'#4d5666'},
  displayRack:    {n:'Display Rack',           shape:'box',    layer:'furniture', w:3,  d:1.5,h:5,   color:'#6e5a7e'},
  computerStation:{n:'Computer Station',       shape:'box',    layer:'furniture', w:2.5,d:2,  h:3.5, color:'#39536b'},
  tvWall:         {n:'TV / Monitor Wall',      shape:'box',    layer:'furniture', w:6,  d:0.5,h:3,  elev:3, color:'#1f242e'},
  // building elements
  column:         {n:'Column / Obstruction',   shape:'box',    layer:'building',  w:1,  d:1,  h:12,  color:'#7a7e88'},
  beam:           {n:'Ceiling Beam',           shape:'box',    layer:'building',  w:12, d:1,  h:1,  elev:10, color:'#666b76'},
  hvac:           {n:'HVAC Drop',              shape:'box',    layer:'building',  w:4,  d:4,  h:2,  elev:9,  color:'#5a6068'},
  // openings (snap to building walls)
  door:           {n:'Door (36″)',             shape:'opening',layer:'doors',     w:3,  d:0.4,h:7,   color:'#9b6a3f', snapWall:true, swing:true},
  doubleDoor:     {n:'Double Door (72″)',      shape:'opening',layer:'doors',     w:6,  d:0.4,h:7,   color:'#9b6a3f', snapWall:true, swing:true},
  exitDoor:       {n:'Emergency Exit',         shape:'opening',layer:'doors',     w:3,  d:0.4,h:7,   color:'#3ddc84', snapWall:true, swing:true},
  window:         {n:'Window',                 shape:'opening',layer:'doors',     w:4,  d:0.35,h:4, elev:3, color:'#7fb2d8', snapWall:true},
  // markers
  outlet:         {n:'Electrical Outlet',      shape:'marker', layer:'elec', color:'#ffd54a'},
  dataDrop:       {n:'Network / Data Drop',    shape:'marker', layer:'elec', color:'#46d4e0'},
  camera:         {n:'Camera / Security',      shape:'marker', layer:'elec', color:'#ff6b6b'},
  fireExt:        {n:'Fire Extinguisher',      shape:'marker', layer:'elec', color:'#ff3b30'},
};

function buildObj(p){
  const kind=OBJ_KINDS[p.kind]||OBJ_KINDS.genericRect;
  const g=new THREE.Group();
  const col=new THREE.Color(p.color||kind.color||'#8a8d93');
  const W=(p.w??kind.w??2)*FT, D=(p.d??kind.d??2)*FT, H=(p.h??kind.h??0)*FT, EL=(p.elev??kind.elev??0)*FT;

  if(kind.shape==='zone'){
    const pm=new THREE.Mesh(new THREE.PlaneGeometry(W,D),
      new THREE.MeshStandardMaterial({color:col, transparent:true, opacity:.22, side:THREE.DoubleSide, depthWrite:false}));
    pm.rotation.x=-Math.PI/2; pm.position.y=0.006; g.add(pm);
    const edges=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(W,D)),
      new THREE.LineBasicMaterial({color:col}));
    edges.rotation.x=-Math.PI/2; edges.position.y=0.012; g.add(edges);
    // corner posts make the zone easier to see/click in 3D
    [[-W/2,-D/2],[W/2,-D/2],[W/2,D/2],[-W/2,D/2]].forEach(([x,z])=>{
      const c=new THREE.Mesh(new THREE.CylinderGeometry(0.015,0.015,0.35,8), new THREE.MeshStandardMaterial({color:col}));
      c.position.set(x,0.18,z); g.add(c);
    });
  } else if(kind.shape==='marker'){
    const mat=new THREE.MeshStandardMaterial({color:col});
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.018,1.0,8),
      new THREE.MeshStandardMaterial({color:0x4a4f5a}));
    pole.position.y=0.5; g.add(pole);
    const ball=new THREE.Mesh(new THREE.SphereGeometry(0.07,12,10), mat);
    ball.position.y=1.05; g.add(ball);
  } else { // box / opening
    const m=new THREE.Mesh(new THREE.BoxGeometry(W,H||0.1,D),
      new THREE.MeshStandardMaterial({color:col, roughness:.8, metalness:.05,
        transparent:kind.shape==='opening'&&p.kind==='window', opacity:p.kind==='window'?0.55:1}));
    m.position.y=EL+(H||0.1)/2; m.castShadow=true; m.receiveShadow=true;
    g.add(m);
    if(kind.swing){ // door swing arc on the floor
      const pts=[];
      for(let i=0;i<=20;i++){ const a=i/20*Math.PI/2; pts.push(new THREE.Vector3(-W/2+Math.cos(a)*W, 0.01, D/2+Math.sin(a)*W)); }
      pts.unshift(new THREE.Vector3(-W/2,0.01,D/2));
      const arc=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({color:col, transparent:true, opacity:.6}));
      g.add(arc);
    }
  }
  return {group:g, conns:[], cuts:[]};
}

const BUILDERS = {wall:buildWall, booth:buildBooth, tube:buildTube, part:buildPart,
                  rwall:buildRwall, lrun:buildLRun, urun:buildURun, frame:buildFrame,
                  sign:buildSign, obj:buildObj};

/* ---------- 9. item lifecycle ---------- */
let items = [];   // {id,type,x,z,rot,params, label?,notes?,locked?,hidden?,grp?}
let nextId = 1;
let nextGrp = 1;
const itemGroup = new THREE.Group(); scene.add(itemGroup);
const meshById = {};

function layerOf(it){
  if(it.type==='rwall') return 'building';
  if(it.type==='obj'){ const k=OBJ_KINDS[it.params.kind]; return k?k.layer:'zones'; }
  return 'ez';
}
function isZone(it){ return it.type==='obj' && (OBJ_KINDS[it.params.kind]||{}).shape==='zone'; }
function isMarker(it){ return it.type==='obj' && (OBJ_KINDS[it.params.kind]||{}).shape==='marker'; }
function isSolid(it){ return !isZone(it) && !isMarker(it); }

// label sprite (shared with measurements; different colors)
function textSprite(text, fg, bg){
  const font='600 28px -apple-system,BlinkMacSystemFont,sans-serif';
  const mc=document.createElement('canvas');
  let ctx=mc.getContext('2d'); ctx.font=font;
  const w=Math.ceil(ctx.measureText(text).width)+26, h=44;
  mc.width=w; mc.height=h;
  ctx=mc.getContext('2d'); ctx.font=font;
  ctx.fillStyle=bg||'rgba(20,22,26,.88)'; ctx.fillRect(0,0,w,h);
  ctx.fillStyle=fg||'#e8eaf0'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(text,w/2,h/2+1);
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(mc), depthTest:false, transparent:true}));
  const sc=0.0035; sp.scale.set(w*sc,h*sc,1); sp.renderOrder=10;
  return sp;
}

function rebuildItem(it){
  if(meshById[it.id]){ itemGroup.remove(meshById[it.id]); }
  const built = BUILDERS[it.type](it.params);
  const g = built.group;
  // measure local footprint before transform (used for snapping, checks, areas)
  const box = new THREE.Box3().setFromObject(g);
  if(box.isEmpty()) box.set(new THREE.Vector3(-.05,0,-.05), new THREE.Vector3(.05,.1,.05));
  it._fp = {w:box.max.x-box.min.x, d:box.max.z-box.min.z, h:box.max.y, minY:box.min.y,
            ox:(box.min.x+box.max.x)/2, oz:(box.min.z+box.max.z)/2};
  g.position.set(it.x, 0, it.z);
  g.rotation.y = it.rot;
  g.userData.itemId = it.id;
  it._conns = built.conns; it._cuts = built.cuts;
  // label sprite
  const text = it.label || (it.type==='obj' && isMarker(it) ? (OBJ_KINDS[it.params.kind]||{}).n : '');
  if(text){
    const sp=textSprite(text, '#e8eaf0');
    sp.position.set(it._fp.ox, Math.max(it._fp.h,0.4)+0.35, it._fp.oz);
    sp.name='__label';
    sp.visible=layers.labels;
    g.add(sp);
  }
  g.visible = !it.hidden && layers[layerOf(it)];
  itemGroup.add(g);
  meshById[it.id] = g;
  return g;
}
/* NOTE: addItem/removeItems do NOT push undo — callers do, so batch
   operations (templates, paste, outline presets) are one undo step. */
function addItem(type, params, extra){
  const it = {id:nextId++, type, x:0, z:0, rot:0, params, ...(extra||{})};
  if(type==='obj' && !it.label){ const k=OBJ_KINDS[params.kind]; if(k && k.shape==='zone') it.label=k.n; }
  items.push(it); rebuildItem(it);
  return it;
}
function removeItems(list){
  if(!list.length) return;
  list.forEach(it=>{
    if(meshById[it.id]){ itemGroup.remove(meshById[it.id]); delete meshById[it.id]; }
  });
  const ids=new Set(list.map(i=>i.id));
  items = items.filter(i=>!ids.has(i.id));
}
function applyLayerVisibility(){
  items.forEach(it=>{
    const g=meshById[it.id]; if(!g) return;
    g.visible = !it.hidden && layers[layerOf(it)];
    const lb=g.getObjectByName('__label'); if(lb) lb.visible=layers.labels;
  });
  if(typeof imgMesh!=='undefined' && imgMesh) imgMesh.visible = layers.floorimg && (floorImg?floorImg.visible:false);
  measureGroup.visible = settings.dimsOn;
}

/* ---------- 10. footprints / collision helpers ---------- */
function rectCorners(it){
  const fp=it._fp||{w:.1,d:.1,ox:0,oz:0};
  const c=Math.cos(it.rot), s=Math.sin(it.rot);
  const hw=fp.w/2, hd=fp.d/2;
  return [[-hw,-hd],[hw,-hd],[hw,hd],[-hw,hd]].map(([x,z])=>{
    const lx=x+fp.ox, lz=z+fp.oz;
    return [it.x + lx*c + lz*s, it.z - lx*s + lz*c];
  });
}
function polysOverlap(A,B){ // SAT for two convex quads [[x,z],...]
  for(const poly of [A,B]){
    for(let i=0;i<poly.length;i++){
      const [x1,z1]=poly[i], [x2,z2]=poly[(i+1)%poly.length];
      const nx=-(z2-z1), nz=x2-x1;
      let minA=1e9,maxA=-1e9,minB=1e9,maxB=-1e9;
      A.forEach(([x,z])=>{ const p=x*nx+z*nz; minA=Math.min(minA,p); maxA=Math.max(maxA,p); });
      B.forEach(([x,z])=>{ const p=x*nx+z*nz; minB=Math.min(minB,p); maxB=Math.max(maxB,p); });
      if(maxA<minB+1e-9 || maxB<minA+1e-9) return false;
    }
  }
  return true;
}
function segDist(a,b,c,d){ // min distance between segments ab and cd (2D)
  function ptSeg(p,a,b){
    const abx=b[0]-a[0], abz=b[1]-a[1];
    const t=Math.max(0,Math.min(1,((p[0]-a[0])*abx+(p[1]-a[1])*abz)/((abx*abx+abz*abz)||1e-12)));
    const dx=p[0]-(a[0]+abx*t), dz=p[1]-(a[1]+abz*t);
    return Math.hypot(dx,dz);
  }
  return Math.min(ptSeg(a,c,d),ptSeg(b,c,d),ptSeg(c,a,b),ptSeg(d,a,b));
}
function polyGap(A,B){ // min gap between two convex quads (0 if overlapping)
  if(polysOverlap(A,B)) return 0;
  let best=1e9;
  for(let i=0;i<4;i++) for(let j=0;j<4;j++)
    best=Math.min(best, segDist(A[i],A[(i+1)%4], B[j],B[(j+1)%4]));
  return best;
}
function itemAreaM2(it){ const fp=it._fp||{w:0,d:0}; return fp.w*fp.d; }
function areasSummary(){
  const roomA = room.w*FT * room.d*FT;
  let used=0;
  items.forEach(it=>{ if(isSolid(it) && !it.hidden) used+=itemAreaM2(it); });
  return {room:roomA, used, free:Math.max(0,roomA-used)};
}

/* ---------- 11. measurements ----------
   type: 'line' (default) | 'area' — a,b are corner/end points in world XZ */
let measures=[];
let nextMeasureId=1;
const measureGroup=new THREE.Group(); scene.add(measureGroup);
const measureMeshById={};

function measureAreaM2(ms){
  const x0=Math.min(ms.a[0],ms.b[0]), x1=Math.max(ms.a[0],ms.b[0]);
  const z0=Math.min(ms.a[1],ms.b[1]), z1=Math.max(ms.a[1],ms.b[1]);
  return (x1-x0)*(z1-z0);
}

function measureMesh(ms, colorHex){
  const g=new THREE.Group();
  const mat=new THREE.LineBasicMaterial({color:colorHex, depthTest:false});

  if(ms.type==='area'){
    const x0=Math.min(ms.a[0],ms.b[0]), x1=Math.max(ms.a[0],ms.b[0]);
    const z0=Math.min(ms.a[1],ms.b[1]), z1=Math.max(ms.a[1],ms.b[1]);
    const y=0.025;
    const corners=[[x0,y,z0],[x1,y,z0],[x1,y,z1],[x0,y,z1],[x0,y,z0]];
    const line=new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(corners.map(c=>new THREE.Vector3(c[0],c[1],c[2]))), mat);
    line.renderOrder=9; g.add(line);
    const fill=new THREE.Mesh(new THREE.PlaneGeometry(Math.max(x1-x0,0.01), Math.max(z1-z0,0.01)),
      new THREE.MeshBasicMaterial({color:colorHex, transparent:true, opacity:0.14, depthWrite:false}));
    fill.rotation.x=-Math.PI/2;
    fill.position.set((x0+x1)/2, 0.018, (z0+z1)/2);
    g.add(fill);
    const areaM2=measureAreaM2(ms);
    const w=x1-x0, d=z1-z0;
    const txt=(ms.label?ms.label+': ':'')+sqft(areaM2).toFixed(0)+' ft² ('+fmtFtIn(w)+' × '+fmtFtIn(d)+')';
    const label=textSprite(txt, '#ffd54a');
    label.position.set((x0+x1)/2, 0.35, (z0+z1)/2);
    g.add(label);
    g.userData.measureId=ms.id;
    return g;
  }

  const a=new THREE.Vector3(ms.a[0],0.02,ms.a[1]), b=new THREE.Vector3(ms.b[0],0.02,ms.b[1]);
  const dir=new THREE.Vector3().subVectors(b,a), len=dir.length();
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([a,b]), mat);
  line.renderOrder=9; g.add(line);
  if(len>1e-6){
    const perp=new THREE.Vector3(-dir.z,0,dir.x).normalize().multiplyScalar(0.07);
    [a,b].forEach(p=>{
      const tick=new THREE.Line(new THREE.BufferGeometry().setFromPoints([p.clone().add(perp),p.clone().sub(perp)]), mat);
      tick.renderOrder=9; g.add(tick);
    });
    const hit=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,len,6), new THREE.MeshBasicMaterial({visible:false}));
    hit.position.copy(a).add(b).multiplyScalar(0.5);
    hit.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir.clone().normalize());
    g.add(hit);
  }
  const txt=(ms.label?ms.label+': ':'')+fmtFtIn(len);
  const label=textSprite(txt, '#ffd54a');
  label.position.copy(a).add(b).multiplyScalar(0.5); label.position.y=0.3;
  g.add(label);
  g.userData.measureId=ms.id;
  return g;
}
function rebuildMeasure(ms, selected){
  if(measureMeshById[ms.id]) measureGroup.remove(measureMeshById[ms.id]);
  const g=measureMesh(ms, selected?0xff6b6b:0xffd54a);
  measureGroup.add(g); measureMeshById[ms.id]=g;
}
function removeMeasure(ms){
  if(measureMeshById[ms.id]){ measureGroup.remove(measureMeshById[ms.id]); delete measureMeshById[ms.id]; }
  measures=measures.filter(m=>m!==ms);
}

/* ---------- 12. floor-plan reference image ---------- */
let floorImg=null;   // {data,x,z,rot,wm,hm,opacity,locked,visible}
let imgMesh=null;
function rebuildFloorImg(){
  if(imgMesh){ scene.remove(imgMesh); imgMesh=null; }
  if(!floorImg||!floorImg.data) return;
  const tex=new THREE.TextureLoader().load(floorImg.data, ()=>{});
  imgMesh=new THREE.Mesh(new THREE.PlaneGeometry(floorImg.wm, floorImg.hm),
    new THREE.MeshBasicMaterial({map:tex, transparent:true, opacity:floorImg.opacity??0.55, depthWrite:false}));
  imgMesh.rotation.x=-Math.PI/2;
  imgMesh.rotation.z=floorImg.rot||0;
  imgMesh.position.set(floorImg.x||0, 0.003, floorImg.z||0);
  imgMesh.visible=layers.floorimg && floorImg.visible!==false;
  imgMesh.userData.isFloorImg=true;
  scene.add(imgMesh);
}
function setFloorImage(dataURL, cb){
  const im=new Image();
  im.onload=()=>{
    const wm=Math.min(room.w*FT, 20*FT*2);     // initial guess: image spans room width
    floorImg={data:dataURL, x:0, z:0, rot:0, wm, hm:wm*im.naturalHeight/im.naturalWidth,
              opacity:0.55, locked:false, visible:true};
    rebuildFloorImg();
    if(cb) cb();
  };
  im.src=dataURL;
}
function scaleFloorImg(factor){
  if(!floorImg) return;
  floorImg.wm*=factor; floorImg.hm*=factor;
  rebuildFloorImg();
}

/* ---------- 13. serialization & undo ---------- */
const SAVE_KEY='eztube-layout';
function cleanItems(){ return items.map(({_conns,_cuts,_fp,...rest})=>rest); }
function snapshot(){
  return {version:2, room, items:cleanItems(), nextId, measures, nextMeasureId,
          settings, layers, floorImg, notes:projectNotes, nextGrp};
}
function save(){
  try{ localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot())); }
  catch(e){ console.warn('Save to localStorage failed (likely floor image too large). Use Save button to export JSON.', e); }
  if(typeof updateStatus==='function') updateStatus();   // status bar lives in planner-ui.js
}
function restore(data){
  // defaults make old (v1) saves load cleanly
  room = data.room||room;
  nextId = data.nextId||1;
  nextGrp = data.nextGrp||1;
  settings = {...DEFAULT_SETTINGS, ...(data.settings||{})};
  layers = {...DEFAULT_LAYERS, ...(data.layers||{})};
  projectNotes = data.notes||'';
  document.getElementById('roomW').value=room.w;
  document.getElementById('roomD').value=room.d;
  document.getElementById('roomH').value=room.h;
  buildRoom();
  Object.values(meshById).forEach(m=>itemGroup.remove(m));
  for(const k in meshById) delete meshById[k];
  items=(data.items||[]).map(it=>({...it}));
  items.forEach(rebuildItem);
  // measurements
  Object.values(measureMeshById).forEach(m=>measureGroup.remove(m));
  for(const k in measureMeshById) delete measureMeshById[k];
  measures=(data.measures||[]).map(m=>({...m}));
  nextMeasureId=data.nextMeasureId||(measures.reduce((a,m)=>Math.max(a,m.id),0)+1);
  measures.forEach(m=>rebuildMeasure(m,false));
  // floor image
  floorImg=data.floorImg||null;
  rebuildFloorImg();
  applyLayerVisibility();
  if(typeof onRestored==='function') onRestored();
}

// snapshot-based undo/redo (floor image pixel data excluded to keep snapshots small)
let undoStack=[], redoStack=[];
function coreState(){
  return JSON.stringify({room, items:cleanItems(), nextId, measures, nextMeasureId, nextGrp,
                         img: floorImg ? {x:floorImg.x,z:floorImg.z,rot:floorImg.rot,wm:floorImg.wm,hm:floorImg.hm,opacity:floorImg.opacity,locked:floorImg.locked,visible:floorImg.visible} : null});
}
function applyCore(json){
  const d=JSON.parse(json);
  room=d.room; nextId=d.nextId; nextGrp=d.nextGrp||1;
  document.getElementById('roomW').value=room.w;
  document.getElementById('roomD').value=room.d;
  document.getElementById('roomH').value=room.h;
  buildRoom();
  Object.values(meshById).forEach(m=>itemGroup.remove(m));
  for(const k in meshById) delete meshById[k];
  items=d.items.map(it=>({...it}));
  items.forEach(rebuildItem);
  Object.values(measureMeshById).forEach(m=>measureGroup.remove(m));
  for(const k in measureMeshById) delete measureMeshById[k];
  measures=d.measures.map(m=>({...m}));
  nextMeasureId=d.nextMeasureId;
  measures.forEach(m=>rebuildMeasure(m,false));
  if(floorImg && d.img) Object.assign(floorImg, d.img);
  rebuildFloorImg();
  applyLayerVisibility();
  if(typeof onRestored==='function') onRestored();
}
function pushUndo(){
  undoStack.push(coreState());
  if(undoStack.length>60) undoStack.shift();
  redoStack.length=0;
}
function undo(){
  if(!undoStack.length) return;
  redoStack.push(coreState());
  applyCore(undoStack.pop());
  save();
}
function redo(){
  if(!redoStack.length) return;
  undoStack.push(coreState());
  applyCore(redoStack.pop());
  save();
}

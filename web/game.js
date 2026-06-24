const cv = document.getElementById('game');
const ctx = cv.getContext('2d', {alpha:false});
let W=0, H=0, DPR=Math.min(window.devicePixelRatio||1, 2);
function resize(){ W=cv.clientWidth; H=cv.clientHeight; cv.width=Math.floor(W*DPR); cv.height=Math.floor(H*DPR); ctx.setTransform(DPR,0,0,DPR,0,0); }
addEventListener('resize', resize); resize();

// ---------- Audio (synthesized, no files) ----------
let actx=null, paused=false, muted=false;
try{ if(localStorage.getItem('tower_mute')==='1') muted=true; }catch(e){}   // v201: persist mute like tower_zoom
let bossIntroT=0, bossIntroName='', bossIntroSub='';
function audioOn(){ if(!actx){ try{ actx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } if(actx&&actx.state==='suspended') actx.resume(); }
function tone(wave,f0,f1,dur,vol,t0){
  if(!actx) return; const t=t0||actx.currentTime;
  const o=actx.createOscillator(), g=actx.createGain();
  o.type=wave; o.frequency.setValueAtTime(f0,t); o.frequency.exponentialRampToValueAtTime(Math.max(1,f1),t+dur);
  g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.0008,t+dur);
  o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t+dur+0.02);
}
function sfx(k){
  if(!actx || muted) return; const t=actx.currentTime;
  if(k==='swing') tone('triangle',520,170,0.12,0.06);
  else if(k==='hit') tone('square',210,70,0.10,0.10);
  else if(k==='coin'){ tone('square',880,1300,0.08,0.08); }
  else if(k==='hurt') tone('sawtooth',170,55,0.18,0.11);
  else if(k==='dash') tone('sine',300,640,0.12,0.05);
  else if(k==='shoot') tone('square',680,430,0.08,0.05);
  else if(k==='level'){ [523,659,784,1047].forEach((f,i)=>tone('triangle',f,f,0.12,0.08,t+i*0.07)); }
  else if(k==='boss'){ [110,98,87].forEach((f,i)=>tone('sawtooth',f,f*1.4,0.3,0.10,t+i*0.18)); }
  else if(k==='win'){ [523,659,784,1047,1319].forEach((f,i)=>tone('triangle',f,f,0.18,0.09,t+i*0.10)); }
}

// ---------- Input ----------
const keys={}, justPressed={};
addEventListener('keydown', e=>{
  audioOn();
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','Tab'].includes(e.key)) e.preventDefault();
  if(!keys[e.code]) justPressed[e.code]=true;
  keys[e.code]=true;
});
addEventListener('keyup', e=>{ keys[e.code]=false; });
function down(...c){ return c.some(k=>keys[k]); }
// mouse: aim with the cursor, LMB melee, RMB ranged
let mouseX=480, mouseY=270, mouseActive=false, devMode=false;
let camPeekX=0, camPeekY=0;   // smoothed mouse look-ahead offset (screen px)
cv.addEventListener('mousemove', e=>{ const r=cv.getBoundingClientRect(); mouseX=e.clientX-r.left; mouseY=e.clientY-r.top; mouseActive=true; });
cv.addEventListener('mousedown', e=>{ audioOn(); if(e.button===0) justPressed['LMB']=true; if(e.button===2) justPressed['RMB']=true; });
cv.addEventListener('contextmenu', e=>e.preventDefault());

// ---------- Constants ----------
const PPU=40; let ZOOM=1.30, SCALE; const CHAR_DRAW=1.25;   // sprite-size multiplier for readability (visual only)            // adjustable camera (— / = keys); close default — mouse look-ahead reveals the periphery
try{ const _z=parseFloat(localStorage.getItem('tower_zoom')); if(_z>=0.6 && _z<=1.5) ZOOM=_z; }catch(e){}
SCALE=PPU*ZOOM;
function setZoom(z){ ZOOM=Math.max(0.60,Math.min(1.5,Math.round(z*100)/100)); SCALE=PPU*ZOOM;
  if(typeof TILE_CHUNKS!=='undefined') TILE_CHUNKS.clear();   // ground re-bakes crisp at the new scale
  try{ localStorage.setItem('tower_zoom',ZOOM.toFixed(3)); }catch(e){}
  try{ showToast('Camera zoom '+Math.round(ZOOM*100)+'% (— wider / = closer)'); }catch(e){} }
const rand=(a,b)=>a+Math.random()*(b-a);
const len=(x,y)=>Math.hypot(x,y);
const clamp01=v=>v<0?0:v>1?1:v;

// ========================================================================
// PIXEL UI KIT (Trial Towers 3.0 — Streets-of-Rogue-flavoured chrome)
// A small self-contained toolkit: palette, a 5x7 bitmap font, hard-edged
// panels/buttons/bars, and a code-drawn logo. All synthesized in code.
// ========================================================================
const PIXEL=true;                                  // master switch for the 3.0 pixel look
const PAL={                                        // SoR-ish: warm, desaturated, strong ink outline
  ink:'#13111c', inkSoft:'rgba(15,13,22,.78)',
  panel:'#23222f', panelLite:'#34384a', panelDark:'#181722',
  bevelHi:'rgba(124,132,164,.55)', bevelLo:'rgba(8,8,14,.7)',
  text:'#e8e6dc', textDim:'#9a9cae',
  hp:'#d6404a', mana:'#3f8ce0', stam:'#b9bfca',
  gold:'#f0c450', green:'#78c860', red:'#e05a52', cyan:'#7ad0e8', purple:'#b48cf0',
  bg0:'#0c0a14', bg1:'#070610'
};
// 5x7 glyphs ('1' = lit). Uppercase only (drawer upper-cases input). Unknown chars advance blank.
const PXFONT=(()=>{ const g=s=>s.trim().split('\n').map(r=>r.trim());
 return {
  A:g(`01110\n10001\n10001\n11111\n10001\n10001\n10001`), B:g(`11110\n10001\n10001\n11110\n10001\n10001\n11110`),
  C:g(`01110\n10001\n10000\n10000\n10000\n10001\n01110`), D:g(`11110\n10001\n10001\n10001\n10001\n10001\n11110`),
  E:g(`11111\n10000\n10000\n11110\n10000\n10000\n11111`), F:g(`11111\n10000\n10000\n11110\n10000\n10000\n10000`),
  G:g(`01110\n10001\n10000\n10111\n10001\n10001\n01111`), H:g(`10001\n10001\n10001\n11111\n10001\n10001\n10001`),
  I:g(`11111\n00100\n00100\n00100\n00100\n00100\n11111`), J:g(`00111\n00010\n00010\n00010\n00010\n10010\n01100`),
  K:g(`10001\n10010\n10100\n11000\n10100\n10010\n10001`), L:g(`10000\n10000\n10000\n10000\n10000\n10000\n11111`),
  M:g(`10001\n11011\n10101\n10101\n10001\n10001\n10001`), N:g(`10001\n11001\n10101\n10101\n10011\n10001\n10001`),
  O:g(`01110\n10001\n10001\n10001\n10001\n10001\n01110`), P:g(`11110\n10001\n10001\n11110\n10000\n10000\n10000`),
  Q:g(`01110\n10001\n10001\n10001\n10101\n10010\n01101`), R:g(`11110\n10001\n10001\n11110\n10100\n10010\n10001`),
  S:g(`01111\n10000\n10000\n01110\n00001\n00001\n11110`), T:g(`11111\n00100\n00100\n00100\n00100\n00100\n00100`),
  U:g(`10001\n10001\n10001\n10001\n10001\n10001\n01110`), V:g(`10001\n10001\n10001\n10001\n10001\n01010\n00100`),
  W:g(`10001\n10001\n10001\n10101\n10101\n11011\n10001`), X:g(`10001\n10001\n01010\n00100\n01010\n10001\n10001`),
  Y:g(`10001\n10001\n01010\n00100\n00100\n00100\n00100`), Z:g(`11111\n00001\n00010\n00100\n01000\n10000\n11111`),
  '0':g(`01110\n10011\n10101\n10101\n10101\n11001\n01110`), '1':g(`00100\n01100\n00100\n00100\n00100\n00100\n01110`),
  '2':g(`01110\n10001\n00001\n00010\n00100\n01000\n11111`), '3':g(`11110\n00001\n00001\n01110\n00001\n00001\n11110`),
  '4':g(`00010\n00110\n01010\n10010\n11111\n00010\n00010`), '5':g(`11111\n10000\n11110\n00001\n00001\n10001\n01110`),
  '6':g(`00110\n01000\n10000\n11110\n10001\n10001\n01110`), '7':g(`11111\n00001\n00010\n00100\n01000\n01000\n01000`),
  '8':g(`01110\n10001\n10001\n01110\n10001\n10001\n01110`), '9':g(`01110\n10001\n10001\n01111\n00001\n00010\n01100`),
  ' ':g(`00000\n00000\n00000\n00000\n00000\n00000\n00000`), '.':g(`00000\n00000\n00000\n00000\n00000\n00110\n00110`),
  ':':g(`00000\n00110\n00110\n00000\n00110\n00110\n00000`), '/':g(`00001\n00001\n00010\n00100\n01000\n10000\n10000`),
  '-':g(`00000\n00000\n00000\n11111\n00000\n00000\n00000`), '+':g(`00000\n00100\n00100\n11111\n00100\n00100\n00000`),
  '%':g(`11001\n11010\n00100\n01011\n10011\n00000\n00000`), '!':g(`00100\n00100\n00100\n00100\n00100\n00000\n00100`),
  X2:g(`00000\n10001\n01010\n00100\n01010\n10001\n00000`),  // multiply sign (use char '*')
  "'":g(`00100\n00100\n01000\n00000\n00000\n00000\n00000`), ',':g(`00000\n00000\n00000\n00000\n00110\n00110\n01100`),
  '(':g(`00010\n00100\n01000\n01000\n01000\n00100\n00010`), ')':g(`01000\n00100\n00010\n00010\n00010\n00100\n01000`),
  '?':g(`01110\n10001\n00010\n00100\n00100\n00000\n00100`), '#':g(`01010\n11111\n01010\n01010\n11111\n01010\n00000`)
 }; })();
function pxGlyph(ch){ if(ch==='*') return PXFONT.X2; return PXFONT[ch]; }
function pxTextW(str,scale){ scale=scale||2; const n=(''+str).length; return Math.max(0,n*(5+1)*scale - scale); }
// draw bitmap text. opts: align 'left'|'center'|'right', shadow(bool), shadowCol, alpha
function pxText(str,x,y,scale,col,opts){ opts=opts||{}; scale=Math.max(1,Math.round(scale||2)); col=col||PAL.text;
  str=(''+str).toUpperCase(); let cx=Math.round(x); const adv=(5+1)*scale;
  if(opts.align==='center') cx=Math.round(x - pxTextW(str,scale)/2);
  else if(opts.align==='right') cx=Math.round(x - pxTextW(str,scale));
  y=Math.round(y); const pa=ctx.globalAlpha; if(opts.alpha!=null) ctx.globalAlpha=pa*opts.alpha;
  const blit=(ox,oy,c)=>{ ctx.fillStyle=c; let px2=cx+ox; for(const ch of str){ const G=pxGlyph(ch);
      if(G){ for(let r=0;r<7;r++){ const row=G[r]; for(let c2=0;c2<5;c2++){ if(row[c2]==='1') ctx.fillRect(px2+c2*scale, y+oy+r*scale, scale, scale); } } }
      px2+=adv; } };
  if(opts.shadow) blit(scale,scale, opts.shadowCol||PAL.ink);
  blit(0,0,col); ctx.globalAlpha=pa;
}
// hard-edged inked panel with a subtle bevel. opts: fill, border, bevel(bool)
function pxPanel(x,y,w,h,opts){ opts=opts||{}; x=Math.round(x);y=Math.round(y);w=Math.round(w);h=Math.round(h);
  ctx.fillStyle=opts.border||PAL.ink; ctx.fillRect(x,y,w,h);
  ctx.fillStyle=opts.fill||PAL.panel; ctx.fillRect(x+2,y+2,w-4,h-4);
  if(opts.bevel!==false){ ctx.fillStyle=PAL.bevelHi; ctx.fillRect(x+2,y+2,w-4,1); ctx.fillRect(x+2,y+2,1,h-4);
    ctx.fillStyle=PAL.bevelLo; ctx.fillRect(x+2,y+h-3,w-4,1); ctx.fillRect(x+w-3,y+2,1,h-4); }
}
function pxButton(x,y,w,h,label,hover,opts){ opts=opts||{};
  pxPanel(x,y,w,h,{fill:hover?(opts.fillHover||PAL.panelLite):(opts.fill||PAL.panel), border:hover?(opts.accent||PAL.gold):PAL.ink});
  const sc=opts.scale||3; pxText(label, x+w/2, y+Math.round((h-7*sc)/2), sc, hover?(opts.accent||PAL.gold):PAL.text, {align:'center', shadow:true});
}
// resource/progress bar. col = fill colour
function pxBar(x,y,w,h,frac,col,opts){ opts=opts||{}; x=Math.round(x);y=Math.round(y);w=Math.round(w);h=Math.round(h); frac=clamp01(frac);
  ctx.fillStyle=opts.border||PAL.ink; ctx.fillRect(x,y,w,h);
  ctx.fillStyle=opts.track||'rgba(0,0,0,.5)'; ctx.fillRect(x+1,y+1,w-2,h-2);
  const fw=Math.round((w-2)*frac); if(fw>0){ ctx.fillStyle=col; ctx.fillRect(x+1,y+1,fw,h-2);
    ctx.fillStyle='rgba(255,255,255,.16)'; ctx.fillRect(x+1,y+1,fw,1);
    ctx.fillStyle='rgba(0,0,0,.22)'; ctx.fillRect(x+1,y+h-2,fw,1); }
}
// blit an offscreen pixel canvas at integer crispness (smoothing off, restored after)
function pxBlit(img,x,y,w,h,flip){ const sm=ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled=false;
  ctx.save(); ctx.translate(Math.round(x),Math.round(y)); if(flip&&flip<0) ctx.scale(-1,1);
  ctx.drawImage(img, -w/2, -h/2, w, h); ctx.restore(); ctx.imageSmoothingEnabled=sm; }
// code-drawn wordmark — replaces ui_logo.png on the home screen
function drawLogo(cx, topY, scale){ scale=scale||7;
  pxText('TRIAL', cx, topY, scale, PAL.gold, {align:'center', shadow:true, shadowCol:PAL.ink});
  pxText('TOWERS', cx, topY+9*scale, scale, PAL.text, {align:'center', shadow:true, shadowCol:PAL.ink});
}

// ---------- World ----------
let walls=[], floors=[], world=null, exit=null, npcs=[], props=[], nestSpots=[], vaultSpot=null, bossDead=false, championsList=[], safeZones=[], decos=[];
let districtPlan=null, operation=null;   // systemic district layer: floor identity + non-combat stair route
let poiList=[], lastPoiName=null, lastPoiReward=null;   // discoverable points of interest (+ builder-named places)
let mapOpen=false, floorStats={elites:0,coins0:0,kills0:0};   // world-map overlay + per-floor scorecard
let codexOpen=false, waypoint=null, ngPlus=0, killsBy={};   // codex, personal map pin, ascension, bestiary
let homeSettings=false, heroSelect=false, heroPick=0, kitOpen=false, kitAnim=0, kitSel=0, kitHeld=null;   // home Settings panel + character-select preview index + the 5x4 inventory (hand row + bag); kitHeld = the item being dragged
let shopStock={apothecary:null,trinketer:null}, shopSold={};   // v203: per-floor deterministic shop stock + persisted sold-locks
// ---- FEATS: deeds remembered across every run; each grants +2 max HP and +1 damage forever ----
const FEAT_KEY='tower_feats_v1';
let FT={ lt:{}, done:{} };
let covenants={};   // active Ascension Covenants (Heat modifiers), persisted in FT
try{ FT=JSON.parse(localStorage.getItem(FEAT_KEY))||FT; FT.lt=FT.lt||{}; FT.done=FT.done||{}; FT.npcs=FT.npcs||[]; FT.covenants=FT.covenants||{}; covenants=FT.covenants; FT.bestiary=FT.bestiary||{}; }catch(e){}
const FEATS=[
  { k:'blood',   name:'First Blood',  need:1,    f:'kills',    desc:'slay your first creature' },
  { k:'cent',    name:'Centurion',    need:100,  f:'kills',    desc:'100 lifetime kills' },
  { k:'myriad',  name:'Myriad Blade', need:1000, f:'kills',    desc:'1000 lifetime kills' },
  { k:'slime',   name:'Slimecide',    need:50,   f:'slimes',   desc:'50 slimes burst' },
  { k:'elite',   name:'Elite Hunter', need:10,   f:'elites',   desc:'10 marked elites slain' },
  { k:'boss',    name:'Boss Breaker', need:5,    f:'bosses',   desc:'5 gatekeepers felled' },
  { k:'stairs',  name:'Stairmaster',  need:25,   f:'floors',   desc:'climb 25 floors' },
  { k:'crown',   name:'Crowned',      need:1,    f:'wins',     desc:'conquer the Tower' },
  { k:'ghost',   name:'Untouchable',  need:10,   f:'perfects', desc:'10 perfect dodges' },
];
function saveFeats(){ try{ localStorage.setItem(FEAT_KEY, JSON.stringify(FT)); }catch(e){} }
function featCount(){ return Object.keys(FT.done).length; }
function cacheRank(){ return Math.min(12, Math.floor(Math.sqrt((FT.cache||0)/45))); }   // banked-coin meta: soft permanent ranks
// ===== BESTIARY MASTERY — lifetime kills per species grant a permanent damage bonus vs them =====
const MASTERY_TIERS=[[250,1.22,'Nemesis'],[100,1.15,'Mastered'],[25,1.08,'Studied']];
function masteryTier(type){ const k=(FT.bestiary&&FT.bestiary[type])||0; for(const t of MASTERY_TIERS){ if(k>=t[0]) return t; } return null; }
function masteryMul(type){ const t=masteryTier(type); return t?t[1]:1; }
// ===== ASCENSION COVENANTS (Heat) — opt-in difficulty for greater spoils =====
const COVENANTS=[
  { k:'bloodthirst', n:'Bloodthirst', d:'foes deal +25% damage' },
  { k:'swarm',       n:'Swarm',       d:'+30% more foes' },
  { k:'alacrity',    n:'Alacrity',    d:'foes move +20% faster' },
  { k:'legion',      n:'Legion',      d:'far more elites stalk you' },
  { k:'frailty',     n:'Frailty',     d:'−20% your max HP' },
];
function covActive(k){ return !!covenants[k]; }
function covHeat(){ let h=0; for(const c of COVENANTS) if(covenants[c.k]) h++; return h; }
function covDmgMul(){ return covActive('bloodthirst')?1.25:1; }
function covSpeedMul(){ return covActive('alacrity')?1.20:1; }
function covCountMul(){ return covActive('swarm')?1.30:1; }
function covEliteBonus(){ return covActive('legion')?4:0; }
function covFrailty(){ return covActive('frailty')?0.80:1; }
function covRewardMul(){ return 1 + 0.15*covHeat(); }
function openCovenant(p){
  const opts=COVENANTS.map(c=>({ label:(covenants[c.k]?'[✓] ':'[  ] ')+c.n+' — '+c.d, f(){ covenants[c.k]=!covenants[c.k]; FT.covenants=Object.assign({},covenants); saveFeats(); sfx(covenants[c.k]?'boss':'hit'); openCovenant(p); } }));
  opts.push({ label:'Seal the terms', f(){ dialogue='The Tower accepts your terms — Heat '+covHeat()+'.'; sfx('level'); } });
  openChoices(p, '⚜ COVENANT STONE — raise the Heat for richer spoils. (Heat '+covHeat()+' · +'+Math.round((covRewardMul()-1)*100)+'% rewards)', opts);
}
function allEchoes(){ return (FT.lore||[]).length>=ECHOES.length; }
function bankRun(){ FT.cache=(FT.cache||0)+coinCount+floor*5; saveFeats(); }   // unspent coin + climb endows the Cache forever
function bumpLT(field,n){ FT.lt[field]=(FT.lt[field]||0)+(n||1);
  for(const ft of FEATS){ if(!FT.done[ft.k] && ft.f===field && (FT.lt[field]||0)>=ft.need){
    FT.done[ft.k]=true; saveFeats(); sfx('win');
    showToast('🏅 FEAT: '+ft.name+' — all your heroes gain +2 HP & +1 damage, forever.'); } } }
let restricted=[], wantedT=0, jailT=0, jailCell=null, jailDoor=null;
let pendingMobs=[], arenaState=null, arenaDone=false, arenaSpot=null;
let choiceNpc=null, choiceOpts=null;   // an open conversation menu (pick with 1-3)   // queued camp spawns + the arena challenge   // trespass law: restricted grounds, heat, and the cell
function palacePos(){ return [WORLD_HW*0.16, -WORLD_HH*0.55]; }
function inSafe(x,y){ for(const z of safeZones){ if(Math.abs(x-z.x)<z.w/2 && Math.abs(y-z.y)<z.h/2) return z; } return null; }
function onRoad(x,y,pad){ pad=pad||0; for(const f of floors){ if(!f.road) continue; if(Math.abs(x-f.x)<f.w/2+pad && Math.abs(y-f.y)<f.h/2+pad) return true; } return false; }
function offRoad(x,y){ if(!onRoad(x,y,1.6)) return [x,y];          // nudge a hostile spawn off the carriageway onto the nearest verge
  for(let s=2;s<=12;s+=2){ for(const d of [[0,1],[0,-1],[1,0],[-1,0],[1,1],[-1,-1],[1,-1],[-1,1]]){ const nx=x+d[0]*s, ny=y+d[1]*s;
    if(!onRoad(nx,ny,1.6) && !inWall(nx,ny,1.0) && !inSafe(nx,ny)) return [nx,ny]; } } return [x,y]; }
const TW=0.8, WORLD_HW=165, WORLD_HH=112;
const TOTAL_FLOORS=10, FLOORS_PER_REALM=1;   // prototype: 10 compressed floors (expands to 50/100 later)
const LEAN=true;   // v2 lean-core: strip half-baked features (draft/pacts/covenants/black-market/mythic/trial-obelisk/missions/kit/trinkets/relic-accum). flip false to restore v1 systems.
// 10 bespoke floors — each a compressed abstraction of a slice of the final Tower.
const REALMS = [
  { name:'The Trial Grounds', accent:[150,210,120], bg:'#0d0c12', floor:'#2c2a35', wall:'#45444c', pool:['slime','darter','splitter'], item:'Trial', atk:'slam', atk2:'summon', sig:'splitter', weather:'dust', bossLook:'beast',
    boss:'Warden of First Steps', bossList:['The Warden of First Steps','Mossback, the Trial Tortoise','The Bellringer of Beginnings'],
    mapgen:'gauntlet',
    feats:['garden','cache','inn'],
    sageLines:["Sage: The Trial Grounds. Every climber's first steps — and many's last.",
      "Sage: Pieces of the Tower's lore hide on every floor. Gather what you can.",
      "Sage: The Warden ahead tests all newcomers. Semi-kind. Semi-lethal.",
      "Sage: Each floor hides a gatekeeper guarding the portal up. Cut it down, buy it off, or slip past with a writ \u2014 the Tower cares not how you climb."] },
  { name:'The Verdant Jungle', accent:[110,205,90], bg:'#071107', floor:'#16290f', wall:'#3d4a3c', pool:['vinesnap','prowler','dartfrog','stinger'], item:'Jungle', atk:'summon', atk2:'charge', sig:'silverback', weather:'rain', bossLook:'beast', dense:true, mapgen:'jungle',
    boss:'Raukan, the Jungle Tyrant',
    feats:['nest','nest','pond','garden','ruins'],
    sageLines:["Sage: The Verdant Jungle. The Tower grows wild here — and so do its teeth.",
      "Sage: Everything in this green is hungry. The vines included.",
      "Sage: Raukan rules the canopy. Past him, the creatures begin to THINK."],
    folkLines:["Trapper: Lost two mules and a partner to the vines. Mules were worth more.","Trapper: The frogs spit. The cats stalk. The flowers heal. Strange floor.","Trapper: Raukan's roar knocks birds dead out of the sky."] },
  { name:'The Human Empire', accent:[120,170,235], bg:'#0a1018', floor:'#1f2a36', wall:'#414b59', pool:['legion','arbalist','warhound'], item:'Imperial', atk:'charge', atk2:'volley', sig:'sentinel', weather:'rain', bossLook:'knight', cityName:'IMPERIA, SEAT OF MAN', layout:'roads', palace:'the Royal Palace', warden:'legion', mapgen:'legion',
    boss:'Grand Marshal of the Human Empire',
    feats:['city','ruins','cache','farm'],
    sageLines:["Sage: The Human Empire — first power of the middle level, built on steel and ambition.",
      "Sage: From this floor up, the Tower's creatures think. They flank. They dodge. They hunt as one.",
      "Sage: The empires send their elites to train with the Two Families. Remember that name."],
    folkLines:["Citizen: The Empire conscripts anyone who can hold a spear.","Citizen: They say the Marshal once dueled a 獸人族 war-chief to a draw.","Citizen: Don't speak ill of the Families. Even the Emperor bows to them."] },
  { name:'The 獸人族 Empire', accent:[235,150,60], bg:'#160a08', floor:'#332018', wall:'#4e4038', pool:['packwolf','bruiser','spearhunt'], item:'Beastfang', atk:'summon', atk2:'charge', sig:'lurker', weather:'leaves', bossLook:'beast', layout:'roads', mapgen:'packs',
    boss:'Khan of the 獸人族',
    feats:['nest','nest','ruins','farm'],
    sageLines:["Sage: The 獸人族 Empire — beastfolk who measure worth in the hunt.",
      "Sage: Their packs converge the moment one is struck. Strike wisely.",
      "Sage: The Khan respects only strength. Show him yours."],
    folkLines:["Hunter: The pack is family. The hunt is prayer.","Hunter: Humans build walls. We build warriors.","Hunter: Even the Khan sent his heir to train with the Sword Family."] },
  { name:'The Elves Forest', accent:[120,210,110], bg:'#0a130b', floor:'#1e2e1c', wall:'#414c42', pool:['wardenE','dancer','treant'], item:'Sylvan', atk:'volley', atk2:'nova', sig:'wisp', weather:'leaves', special:'peaceful', bossLook:'elf', mapgen:'groves',
    boss:'High Keeper of the Elder Grove',
    feats:['garden','garden','shrines','pond','inn'],
    sageLines:["Sage: The Elves Forest. They draw magic straight from the higher spirits.",
      "Sage: They are harmless — unless provoked. Then they are fierce beyond telling.",
      "Sage: Walk gently. Or don't, and learn."],
    folkLines:["Elf: The spirits sing today. Do not interrupt.","Elf: We harm none who harm none.","Elf: The higher spirits answer only those at peace."] },
  { name:'The 魔物 Empire', accent:[200,90,160], bg:'#140709', floor:'#2e1820', wall:'#4a3a42', pool:['impling','hexcaster','brute','bombfiend'], item:'Fiend', atk:'nova', atk2:'summon', sig:'voidling', weather:'ash', bossLook:'imp', cityName:'KHORVASH OF THE HORNED', layout:'roads', palace:'the Horned Court', warden:'brute', mapgen:'scorched',
    boss:'Horned Sovereign of the 魔物',
    feats:['city','graveyard','vault'],
    sageLines:["Sage: The 魔物 Empire — magic monsters of every kind, horned and proud.",
      "Sage: Do not mistake them for beasts. Their sword masters rival any human's.",
      "Sage: The Horned Sovereign rules by raw magic. Bring more than steel."],
    folkLines:["魔物: You stare at my horns. Rude.","魔物: Our blades are taught. Our magic is born.","魔物: The Families accept even us, if the talent is real."] },
  { name:'Peak of the Two Families', accent:[245,225,150], bg:'#10100a', floor:'#2e2c1e', wall:'#4c4a3e', pool:['swordsman','arcanist'], item:'Twinhouse', atk:'charge', atk2:'volley', sig:'seraphling', weather:'glimmer', special:'families', layout:'roads', mapgen:'ridge',
    boss:'the Two Families',
    feats:['cache','shrines','inn'],
    sageLines:["Sage: The Peak of the Two Families — but they were ONE house once, sworn to both blade AND spell, keepers of the seventh stair.",
      "Sage: The Tower's Vow demanded a child of the house. The Sword Master's youngest son was born with both gifts at once — the very thing the Vow forbids.",
      "Sage: Rather than yield the boy to the Tower, the Master broke his own house: the Blade kept the Vow, the Arcane fled with the child. They have warred for a generation.",
      "Sage: Walk both estates freely. Pledge to a head to win their patronage and open the stair — or let the youngest son broker peace, and claim the favour of both."],
    folkLines:["Adept: The youngest son? Only a boy — a blade in one little hand, a spell in the other. Both houses fear what he'll become.","Adept: The Matriarch turned a general to glass for sneering. The Patriarch once split his own anvil with a single word.","Adept: We do not speak the child's name in the compound. The Master still grieves the boy he could not keep."] },
  { name:'Court of the Upper Beings', accent:[180,110,255], bg:'#08060e', floor:'#1c1630', wall:'#382a55', pool:['thrall','spiritling','drakeling','felguard'], item:'Sovereign', atk:'nova', atk2:'void', sig:'bloodbat', weather:'motes', special:'champions', mapgen:'nexus',
    boss:'the Court',
    feats:['shrines'],
    sageLines:["Sage: The Court of Upper Beings — Vampire, Higher Spirit, Dragon, 高階魔族.",
      "Sage: Each will rule a floor of its own, one day. Here they hold court together.",
      "Sage: Defeat each one — or befriend them, which is harder. Their egos are... considerable."] },
  { name:'The Hall of Echoes', accent:[150,215,255], bg:'#0a1018', floor:'#1f2a36', wall:'#3a4a5c', pool:['shade','echoarcher','darter'], item:'Echo', atk:'void', atk2:'charge', sig:'froster', weather:'snow', mapgen:'cathedral', bossLook:'ghost',
    boss:"The First Climber's Echo",
    feats:['graveyard','graveyard','ruins','shrines'],
    sageLines:["Sage: The Hall of Echoes. This is the prototype's ninth floor — the Tower's memory compressed into a ruined archive.",
      "Sage: Every climber who died below leaves a reflection here. Some remember hope. Some remember teeth.",
      "Sage: At the end waits the echo of the very first climber. It fights like... you."] },
  { name:"The Tower's Crown", accent:[255,235,170], bg:'#100c06', floor:'#2e2818', wall:'#5a4a2a', pool:['seraph','templar','darter'], item:'Crown', atk:'void', atk2:'nova', sig:'wisp', weather:'sparks', bossLook:'spirit', layout:'roads', mapgen:'ascent',
    boss:'AETHON, SOVEREIGN OF THE TOWER',
    feats:['cache','inn'],
    sageLines:["Sage: The Crown. Beyond this throne there is no higher stair.",
      "Sage: Aethon has watched you since floor one. It is... curious.",
      "Sage: Whatever you came for — lore, glory, the top — it ends here. Go."] },
];
function realmFor(f){ return REALMS[Math.min(REALMS.length-1, Math.floor((f-1)/FLOORS_PER_REALM))]; }
// the climb's 4-act arc: the mortal world's empires -> the Two Families apex -> the dimensions beyond
function actFor(f){ return f<=1?'ACT I \u00B7 THE TRIAL' : f<=6?'ACT II \u00B7 THE MORTAL WORLD' : f===7?'ACT III \u00B7 THE TWO FAMILIES' : 'ACT IV \u00B7 THE DIMENSIONS BEYOND'; }
const ACT_TAG={ 1:'Where every climb begins.', 2:'Empires of flesh and steel \u2014 jungle, three crowns, and the elder wood.', 7:'The two strongest families the world has ever bred. Even emperors bow.', 8:'Past the families, the Tower opens onto other planes. What waits is not of this world.' };
function actTag(f){ return f<=1?ACT_TAG[1] : f<=6?ACT_TAG[2] : f===7?ACT_TAG[7] : ACT_TAG[8]; }
const pick=a=>a[Math.floor(rand(0,a.length))];

// The bestiary — every species is a base archetype + a look + twists. Per-floor rosters live in REALMS.pool.
const SPECIES = {
  // elites & classics
  splitter:  { name:'Trial Mimic',    base:'slime',   look:'slime',  color:[150,235,120], onDeath:'split' },
  froster:   { name:'Frostbinder',    base:'slime',   look:'ghost',  color:[150,215,255], slow:true },
  wisp:      { name:'Sparkwisp',      base:'darter',  look:'spirit', color:[185,175,255], blink:true },
  lurker:    { name:'Ambush Hunter',  base:'slime',   look:'beast',  color:[90,215,205],  stealth:true, lunge:true, hp:1.3 },
  sentinel:  { name:'Imperial Sentry',base:'spitter', look:'knight', color:[235,205,110], stationary:true, hp:1.7 },
  bloodbat:  { name:'Bloodbat',       base:'darter',  look:'bat',    color:[235,95,115],  lifedrain:true },
  seraphling:{ name:'Family Adept',   base:'spitter', look:'mage',   color:[255,238,165], spread:3 },
  voidling:  { name:'Voidling',       base:'slime',   look:'imp',    color:[195,125,255], onDeath:'shock' },
  // F2 — the Verdant Jungle
  vinesnap:  { name:'Vine Snapper',   base:'slime',   look:'plant',  color:[90,200,80],  hp:1.1 },
  prowler:   { name:'Jade Prowler',   base:'darter',  look:'beast',  color:[70,170,100], speed:1.1 },
  dartfrog:  { name:'Dart Frog',      base:'spitter', look:'frog',   color:[240,180,60] },
  stinger:   { name:'Stinger Drone',  base:'darter',  look:'bug',    color:[220,200,90], hp:0.6, speed:1.15 },
  silverback:{ name:'Silverback',     base:'slime',   look:'beast',  color:[170,170,180], hp:2.0, lunge:true, speed:1.2 },
  // F3 — the Human Empire
  legion:    { name:'Legionnaire',    base:'darter',  look:'knight', color:[150,170,220] },
  arbalist:  { name:'Arbalist',       base:'spitter', look:'knight', color:[120,140,200] },
  warhound:  { name:'War Hound',      base:'darter',  look:'beast',  color:[150,125,95], speed:1.15 },
  // F4 — the 獸人族 Empire
  packwolf:  { name:'Pack Wolf',      base:'darter',  look:'beast',  color:[185,140,90] },
  bruiser:   { name:'Tusked Bruiser', base:'slime',   look:'beast',  color:[205,120,70], hp:1.6 },
  spearhunt: { name:'Spear Hunter',   base:'spitter', look:'beast',  color:[215,165,85] },
  // F5 — the Elves Forest
  wardenE:   { name:'Grove Warden',   base:'spitter', look:'elf',    color:[140,220,130] },
  dancer:    { name:'Blade Dancer',   base:'darter',  look:'elf',    color:[175,230,150], speed:1.1 },
  treant:    { name:'Treant Sapling', base:'slime',   look:'plant',  color:[110,170,90], hp:1.5 },
  // F6 — the 魔物 Empire
  impling:   { name:'Horned Impling', base:'darter',  look:'imp',    color:[225,115,165] },
  hexcaster: { name:'Hex Caster',     base:'spitter', look:'mage',   color:[195,95,205] },
  brute:     { name:'Horned Brute',   base:'slime',   look:'imp',    color:[175,85,125], hp:1.7 },
  bombfiend: { name:'Bomb Fiend',     base:'bomber',  look:'imp',    color:[230,95,85] },
  // F7 — the Two Families
  swordsman: { name:'House Blade',    base:'darter',  look:'knight', color:[235,220,170] },
  arcanist:  { name:'House Arcanist', base:'spitter', look:'mage',   color:[185,155,255], spread:2 },
  // F8 — the Court
  thrall:    { name:'Vampire Thrall', base:'darter',  look:'bat',    color:[220,95,105] },
  spiritling:{ name:'Spiritling',     base:'darter',  look:'spirit', color:[175,235,255], blink:true },
  drakeling: { name:'Drakeling',      base:'spitter', look:'dragon', color:[235,150,65] },
  felguard:  { name:'Felguard',       base:'slime',   look:'imp',    color:[185,115,255], hp:1.5 },
  // F9 — the Hall of Echoes
  shade:     { name:'Climber Shade',  base:'slime',   look:'ghost',  color:[150,200,235] },
  echoarcher:{ name:'Echo Archer',    base:'spitter', look:'ghost',  color:[135,185,225] },
  // F10 — the Crown
  seraph:    { name:'Crown Seraph',   base:'darter',  look:'spirit', color:[255,235,170] },
  templar:   { name:'Crown Templar',  base:'slime',   look:'knight', color:[240,220,155], hp:1.6 },
  // Expansion reserve — forge-lineage foes that can return when the 50/100-floor tower opens up
  magmite:   { name:'Magmite',         base:'slime',   look:'imp',    color:[255,120,40],  hp:1.4, onDeath:'shock' },
  cinderdart:{ name:'Cinder Dart',     base:'darter',  look:'bug',    color:[255,160,60],  speed:1.1 },
  pyrecaster:{ name:'Pyre Caster',     base:'spitter', look:'mage',   color:[255,140,70],  spread:2 },
  emberhound:{ name:'Ember Hound',     base:'darter',  look:'beast',  color:[240,110,50],  speed:1.15 },
  slagbrute: { name:'Slag Brute',      base:'slime',   look:'beast',  color:[255,90,30],   hp:2.0, lunge:true, speed:1.1 },
};

// Per-floor modifier — gives each floor its own flavour and twist, layered over the realm theme.
const FLOOR_MODS = [
  { name:'Tranquil',  enemyMult:0.65, force:['town'] },
  { name:'Bustling',  enemyMult:0.85, force:['town','cache'] },
  { name:'Overgrown', enemyMult:1.0,  force:['garden','garden'] },
  { name:'Infested',  enemyMult:1.45, force:['nest','nest'] },
  { name:'Haunted',   enemyMult:1.25, force:['graveyard'], dim:true },
  { name:'Bountiful', enemyMult:1.0,  force:['cache'], chests:2 },
  { name:'Ancient',   enemyMult:1.05, force:['ruins','vault'] },
  { name:'Cursed',    enemyMult:1.15, force:['graveyard'], eHp:1.35, bigLoot:true, dim:true },
  { name:'Flooded',   enemyMult:1.0,  force:['pond','pond'] },
  { name:'Wild',      enemyMult:1.25, force:[] },
  { name:'Sanctified',enemyMult:0.9,  force:['shrines','garden'] },
];

// District layer: every floor is also a civic "problem box" with rules, factions,
// secure sites, and a non-combat route to the stair. The names and systems are
// original, but the design grammar is systemic urban roguelite: break in, talk
// your way through, bribe, disguise, sabotage, or just fight.
const DISTRICTS=[
  { key:'checkpoint', name:'Gatehouse Checkpoint', tag:'permits, tolls, patrols', faction:'watch', col:[120,170,235],
    feats:['tower','market','square','tavern'], ops:['permit','heist','bribe'], law:1.4, crowd:1.1 },
  { key:'marketmaze', name:'Copper Market Maze', tag:'shops, cutpurses, hidden dealers', faction:'underworld', col:[230,180,80],
    feats:['market','market','tavern','caravan','shanty'], ops:['bribe','blackmail','heist'], law:.85, crowd:1.35 },
  { key:'foundry', name:'Ash Foundry Ward', tag:'machines, oil, sabotage', faction:'guild', col:[255,125,60],
    feats:['mine','tower','banditcamp','cache','tavern'], ops:['sabotage','permit','blackmail'], law:1.0, hazards:1 },
  { key:'greenbelt', name:'Greenbelt Commune', tag:'gardens, healers, rival claims', faction:'commune', col:[120,210,110],
    feats:['garden','farm','orchard','chapel','shrines'], ops:['rescue','permit','sabotage'], law:.7, crowd:.9 },
  { key:'campus', name:'Veiled Campus', tag:'libraries, wards, quiet crimes', faction:'cult', col:[185,145,255],
    feats:['library','enchanter','chapel','shrines','vault'], ops:['blackmail','permit','rescue'], law:1.1, crowd:.8 },
  { key:'docks', name:'Rain Dock Exchange', tag:'caravans, smugglers, shortcuts', faction:'underworld', col:[105,190,220],
    feats:['caravan','market','pond','inn','cart'], ops:['heist','bribe','rescue'], law:.95, crowd:1.2 },
  { key:'citadel', name:'Magistrate Citadel', tag:'restricted halls, records, jail cells', faction:'watch', col:[190,165,220],
    feats:['tower','chapel','square','library','cache'], ops:['permit','blackmail','heist'], law:1.7, crowd:1.0 },
  { key:'shanties', name:'Lantern Shantyrow', tag:'crowds, rumours, fragile homes', faction:'commune', col:[210,160,120],
    feats:['shanty','shanty','hamlet','tavern','market'], ops:['rescue','bribe','sabotage'], law:.55, crowd:1.45 },
];
const OP_LABEL={
  permit:'Get a stair permit from the records desk',
  heist:'Steal the stair key from a secure locker',
  sabotage:'Disable the district relay that seals the stair',
  blackmail:'Recover leverage from the evidence room',
  bribe:'Buy an exit arrangement from the fixer',
  rescue:'Extract the informant to any waystone',
};
// each RUN shuffles which district falls on which floor (derived from player.runSeed), so no two climbs share a civic layout.
// realm/difficulty/boss progression stays fixed; only the faction overlay reshuffles. Legacy saves with no seed keep the old order.
function runDistrictOrder(){
  const n=DISTRICTS.length;
  const seed=(typeof player!=='undefined' && player && (player.runSeed>>>0)) || 0;
  if(!seed){ const id=[]; for(let i=0;i<n;i++) id.push(i); return id; }        // no seed yet -> identity (old behaviour)
  if(player._distOrderSeed===seed && player.districtOrder) return player.districtOrder;   // stable within a run
  const ord=[]; for(let i=0;i<n;i++) ord.push(i);
  let s=(seed^0x9e3779b9)>>>0;
  const rnd=()=>{ s=(s+0x6D2B79F5)>>>0; let t=s; t=Math.imul(t^(t>>>15), t|1); t^=t+Math.imul(t^(t>>>7), t|61); return ((t^(t>>>14))>>>0)/4294967296; };
  for(let i=n-1;i>0;i--){ const j=Math.floor(rnd()*(i+1)); const tmp=ord[i]; ord[i]=ord[j]; ord[j]=tmp; }   // seeded Fisher-Yates
  player.districtOrder=ord; player._distOrderSeed=seed; return ord;
}
function districtFor(f){
  const n=DISTRICTS.length, ord=runDistrictOrder();
  const d=DISTRICTS[ord[(Math.max(1,f)-1)%n]];
  return Object.assign({}, d, { feats:(d.feats||[]).slice(), ops:(d.ops||[]).slice() });
}
function newOperation(d,f){
  if(!d || (realm && (realm.special==='champions' || realm.special==='families'))) return null;
  const type=pick(d.ops||['permit']);
  const target=OP_LABEL[type]||'Find an alternate way to open the stair';
  return { type, target, done:false, faction:d.faction, district:d.name, reward:14+f*3,
    hint:'Combat route still works: defeat the gatekeeper. System route: '+target+'.' };
}
function ensureRep(){
  player.rep=Object.assign({watch:0,cult:0,guild:0,underworld:0,commune:0}, player.rep||{});
  return player.rep;
}
function gainDistrictRep(fac,n){
  if(!player || !fac) return;
  const rep=ensureRep(); rep[fac]=(rep[fac]||0)+(n||1);
}
function hasCover(){
  return !!(player && ((player.disguiseT||0)>0 || (player.permitT||0)>0 || (player.stealthT||0)>0 || (player.writT||0)>0));
}
function blowCover(){
  if(player && (player.disguiseT||0)>0){ player.disguiseT=0; showToast('Your cover is blown.'); }
}
function districtHeat(n, why){
  if(hasCover()) return;
  wantedT=Math.max(wantedT,n||10);
  if(player && player.rep) player.rep.watch=(player.rep.watch||0)-1;
  if(why) showToast(why);
}
// the gatekeeper stands aside without a fight (bribe / writ / parley) -> opens the portal, boss optional
function openGate(how){
  bossDead=true; if(exit){ exit.open=true; exit.found=true; }
  if(boss){ boss.resolved=true; boss.friendly=true; boss.provoked=false; boss.neutralC=true; boss.touch=0; }
  sfx('win'); addShake(.3); flashT=Math.max(flashT||0,.05); burst(player.x,player.y,[255,225,150],28,5);
  if(typeof saveRun==='function') saveRun();
  showToast('The gatekeeper stands aside (you '+how+'). The portal flares open.');
}
function completeOperation(method){
  if(!operation || operation.done) return false;
  operation.done=true; operation.method=method||'improvised';
  bossDead=true;
  if(exit){ exit.open=true; exit.found=true; }
  gainDistrictRep(operation.faction, 1);
  const reward=operation.reward||20;
  coinCount+=Math.round(reward*0.55); gainXP(12+floor*2); player.prestige=(player.prestige||0)+20;   // 3.0: prestige for the district operation
  player.charge=Math.min(player.maxMana, player.charge+18);
  sfx('win'); addShake(.38); flashT=Math.max(flashT||0,.05);
  burst(player.x,player.y,(districtPlan&&districtPlan.col)||[255,220,120],30,5);
  showToast('Operation complete: '+(method||operation.target)+'. The stair opens; the gatekeeper is optional.');
  try{ saveRun(); }catch(e){}
  return true;
}
function buildSecureSite(cx,cy,label,kind){
  const w=13,h=9,L=cx-w/2,R=cx+w/2,T=cy-h/2,B=cy+h/2,g=1.8;
  floors.push({x:cx,y:cy,w,h,col:'#2b2d38'});
  hwall(L,R,T); vwall(T,B,L); vwall(T,B,R); hwall(L,cx-g,B); hwall(cx+g,R,B);
  props.push({kind:'sign',x:cx,y:T-1.7,text:label});
  restricted.push({x:cx,y:cy,w:w-1,h:h-1,name:label.replace(/^[^A-Za-z]+/,'')});
  props.push({kind,x:cx,y:cy-0.5,used:false});
  return {x:cx,y:cy};
}
function placeDistrictOperation(spawnPool){
  if(!districtPlan) return;
  const d=districtPlan;
  const sx=-WORLD_HW+22, sy=-8;
  props.push({kind:'sign',x:sx,y:sy,text:'DISTRICT: '+d.name+' — '+d.tag,big:true});
  props.push({kind:'wardrobe',x:-WORLD_HW+25,y:7,used:false});
  const fx=-WORLD_HW+30, fy=-6;
  const fixer=makeNPC('fixer',fx,fy); fixer.roam=false; fixer.post={x:fx,y:fy,r:2}; npcs.push(fixer);
  if(realm && (realm.special==='champions'||realm.special==='families')) return;
  operation=newOperation(d,floor);
  if(!operation) return;
  let spot=scatterPos();
  if(operation.type==='permit' || operation.type==='bribe'){
    buildSecureSite(spot[0],spot[1],'Records Office', 'records');
  } else if(operation.type==='heist'){
    buildSecureSite(spot[0],spot[1],'Key Locker — Authorized Only', 'evidence');
  } else if(operation.type==='blackmail'){
    buildSecureSite(spot[0],spot[1],'Evidence Room — No Entry', 'evidence');
  } else if(operation.type==='sabotage'){
    buildSecureSite(spot[0],spot[1],'Relay Station — Do Not Tamper', 'relaybox');
    if(d.hazards){ const o=scatterPos(); props.push({kind:'oilslick',x:o[0],y:o[1]}); }
  } else if(operation.type==='rescue'){
    spot=scatterPos();
    const inf=makeNPC('informant',spot[0],spot[1]); inf.roam=false; inf.operationInformant=true; inf.follow=false; npcs.push(inf);
    props.push({kind:'sign',x:spot[0],y:spot[1]-3.8,text:'whispered meet'});
  }
  operation.x=spot[0]; operation.y=spot[1];
  if(pings) pings.push({x:spot[0],y:spot[1],col:'#9fd6ff',life:9999});
  const guardN=Math.min(5,2+Math.round((d.law||1)*1.3));
  for(let i=0;i<guardN;i++){
    const gx=spot[0]+rand(-5,5), gy=spot[1]+rand(-3,3);
    const m=MOB((spawnPool&&spawnPool.length)?pick(spawnPool):'legion', gx, gy);
    if(m){ m.warden=true; m.neutralC=true; m.smart=true; m.districtGuard=true; m.hp=Math.round(m.maxHp*(1.15+(d.law||1)*0.12)); m.maxHp=m.hp; }
  }
}

// Procedurally-rolled items with random stat suffixes.
const ITEM_NOUNS = ['Charm','Idol','Sigil','Totem','Relic','Amulet','Ring','Talisman','Brand','Locket','Crown','Fang'];
const ITEM_SUFFIX = [
  { s:'of Vigor',    f:()=>{ const v=10+Math.floor(rand(0,16)); player.maxHp+=v; player.hp+=v; return '+'+v+' max HP'; } },
  { s:'of Wrath',    f:()=>{ const v=4+Math.floor(rand(0,8)); player.ad+=v; return '+'+v+' damage'; } },
  { s:'of Haste',   f:()=>{ const v=+(0.3+rand(0,0.6)).toFixed(2); player.speed+=v; return '+'+v+' speed'; } },
  { s:'of Leeching', f:()=>{ const v=2+Math.floor(rand(0,3)); player.lifesteal+=v; return '+'+v+' lifesteal'; } },
  { s:'of Thorns',   f:()=>{ const v=5+Math.floor(rand(0,6)); player.thorns+=v; return '+'+v+' thorns'; } },
  { s:'of Reach',    f:()=>{ player.magnet+=0.8; return '+coin magnet'; } },
  { s:'of Swiftness',f:()=>{ player.dashCdBase=Math.max(.3,player.dashCdBase-0.12); return 'faster dash'; } },
  { s:'of Fury',     f:()=>{ player.atkCdBase*=0.9; return 'faster attacks'; } },
];
// ===== RELICS — collectible passives & combat procs that define a run =====
const RELICS=[
  // on-hit element appliers (these set up Elemental Reactions)
  { key:'ember',  n:'Ember Heart',      e:'hits sometimes ignite',           onHit(s){ if(rand(0,1)<0.13){ s.burnT=2.6; s.burnDps=Math.max(s.burnDps||0,PDMG()*0.10); tryReact(s,'burn'); } } },
  { key:'frost',  n:'Frostfang Charm',  e:'hits sometimes chill',            onHit(s){ if(rand(0,1)<0.13){ s.eSlowT=1.8; tryReact(s,'frost'); } } },
  { key:'venom',  n:'Venom Idol',       e:'hits sometimes poison',           onHit(s){ if(rand(0,1)<0.13){ s.poisonT=3.2; s.poisonDps=Math.max(s.poisonDps||0,PDMG()*0.08); tryReact(s,'venom'); } } },
  { key:'storm',  n:'Storm Sigil',      e:'hits sometimes arc to a foe',     onHit(s){ if(rand(0,1)<0.11){ let b=null,bd=49; for(const o of mobs){ if(o===s||o.friendly||o.type==='nest') continue; const d=(o.x-s.x)**2+(o.y-s.y)**2; if(d<bd){bd=d;b=o;} } if(b){ dealDamage(b,PDMG()*0.5*wStormMul(),{noCrit:true}); bolts.push({x1:s.x,y1:s.y,x2:b.x,y2:b.y,life:.12}); } } } },
  // on-kill
  { key:'coil',   n:"Vampire's Coil",   e:'kills mend you',                  onKill(m){ player.hp=Math.min(player.maxHp,player.hp+Math.ceil(player.maxHp*0.03)); } },
  { key:'tithe',  n:"Reaper's Tithe",   e:'kills charge your ultimate',      onKill(m){ player.charge=Math.min(player.maxMana,player.charge+3); } },
  { key:'soul',   n:'Soulbrand',        e:'kills grant 11% heal (8 HP)',      onKill(m){ if(rand(0,1)<0.11){ player.hp=Math.min(player.maxHp,player.hp+8); burst(m.x,m.y,[120,255,160],8,2.5); } } },
  { key:'hoard',  n:'Hoarder Locket',   e:'kills sometimes spill coin',      onKill(m){ if(rand(0,1)<0.18) dropCoins(m.x,m.y,3); } },
  // on-hurt
  { key:'thorn',  n:'Thornmail Shard',  e:'attackers bleed for it',          onHurt(n,sx,sy){ let b=null,bd=9; for(const o of mobs){ if(o.friendly||o.type==='nest') continue; const d=(o.x-sx)**2+(o.y-sy)**2; if(d<bd){bd=d;b=o;} } if(b) dealDamage(b,Math.max(4,n*0.25),{noCrit:true}); } },
  { key:'stone',  n:'Stoneheart Ward',  e:'being struck briefly hardens you',onHurt(n,sx,sy){ if(rand(0,1)<0.3) player.shieldT=Math.max(player.shieldT||0,0.8); } },
  // passive stats (stackable up to 3)
  { key:'gambler',n:"Gambler's Eye",    e:'+6% crit',            stack:true, passive(a){ a.crit+=0.06; } },
  { key:'brand',  n:"Berserker's Brand",e:'+16% damage scaling',         stack:true, passive(a){ a.dmg+=Math.round(player.ad*0.16); } },
  { key:'ironwood',n:'Ironwood Heart',  e:'+28 max HP',          stack:true, passive(a){ a.maxHp+=28; } },
  { key:'swift',  n:'Swiftboot Sigil',  e:'+0.6 speed',          stack:true, passive(a){ a.speed+=0.6; } },
  { key:'leech',  n:'Bloodthirst Idol', e:'+3 lifesteal',        stack:true, passive(a){ a.lifesteal+=3; } },
  { key:'chrono', n:'Chrono Sliver',    e:'cooldowns recover 25% faster',        tick(dt){ player.atkCd=Math.max(0,player.atkCd-dt*0.25); player.rangedCd=Math.max(0,player.rangedCd-dt*0.25); player.dashCd=Math.max(0,player.dashCd-dt*0.25); player.abilCd=Math.max(0,player.abilCd-dt*0.25); } },
];
const RELIC_MAP={}; for(const _R of RELICS) RELIC_MAP[_R.key]=_R;
// ====== THE CLIMBER'S SATCHEL — usable consumables (separate registry; recomputeRelics never reads it) ======
function kitThrowTarget(){ const fx=(player.faceX!==undefined?player.faceX:player.fx)||0, fy=(player.faceY!==undefined?player.faceY:player.fy)||1; return [player.x+fx*1.5, player.y+fy*1.5]; }
const KIT_DEFS=[
  {key:'draught', n:'Tower Draught', e:'restores 45 HP', max:5, col:[150,235,150], sfx:'coin', useMsg:'You drink — warmth floods the wound.',
    use(){ if(player.hp>=player.maxHp-1) return false; player.hp=Math.min(player.maxHp,player.hp+45); return true; },
    icon(c,x,y,s){ c.fillStyle='#5a4a32'; c.fillRect(x-s*0.18,y-s*1.1,s*0.36,s*0.35); c.fillStyle='#7dd87d'; if(c.roundRect){c.beginPath();c.roundRect(x-s*0.45,y-s*0.78,s*0.9,s*1.4,s*0.3);c.fill();}else c.fillRect(x-s*0.45,y-s*0.78,s*0.9,s*1.4); c.fillStyle='rgba(255,255,255,.4)'; c.beginPath(); c.ellipse(x-s*0.18,y-s*0.2,s*0.12,s*0.3,0,0,7); c.fill(); } },
  {key:'greater', n:'Greater Draught', e:'restores 60% max HP', max:3, rarity:'uncommon', col:[120,210,200], sfx:'level', useMsg:'A deep restorative — vigor returns.',
    use(){ if(player.hp>=player.maxHp-1) return false; player.hp=Math.min(player.maxHp,player.hp+Math.round(player.maxHp*0.6)); return true; },
    icon(c,x,y,s){ const g=c.createLinearGradient(0,y-s,0,y+s); g.addColorStop(0,'#7dd87d'); g.addColorStop(1,'#49c2ff'); c.fillStyle='#5a4a32'; c.fillRect(x-s*0.16,y-s*1.2,s*0.32,s*0.35); c.fillStyle=g; if(c.roundRect){c.beginPath();c.roundRect(x-s*0.42,y-s*0.85,s*0.84,s*1.6,s*0.3);c.fill();}else c.fillRect(x-s*0.42,y-s*0.85,s*0.84,s*1.6); c.globalCompositeOperation='lighter'; c.fillStyle='rgba(120,210,255,.5)'; c.beginPath(); c.arc(x,y-s*0.7,s*0.4,0,7); c.fill(); c.globalCompositeOperation='source-over'; } },
  {key:'swift', n:'Swiftfoot Tonic', e:'+18% move speed (10s) & cleanses slow', max:3, col:[255,202,160], sfx:'coin', useMsg:'Fleetness fills your legs.',
    use(){ player.buffT=Math.max(player.buffT||0,10); player.slowT=0; return true; },
    icon(c,x,y,s){ c.fillStyle='#ffcaa0'; if(c.roundRect){c.beginPath();c.roundRect(x-s*0.3,y-s*0.7,s*0.6,s*1.3,s*0.2);c.fill();}else c.fillRect(x-s*0.3,y-s*0.7,s*0.6,s*1.3); c.strokeStyle='rgba(255,180,120,.9)'; c.lineWidth=2; for(let k=0;k<3;k++){ c.beginPath(); c.moveTo(x+s*0.5,y-s*0.4+k*s*0.4); c.lineTo(x+s*0.95,y-s*0.4+k*s*0.4); c.stroke(); } c.lineWidth=1; } },
  {key:'ember', n:'Ember Flask', e:'hurls fire — burns nearby foes', max:5, col:[255,140,50], sfx:'boss', useMsg:'The flask shatters in flame!',
    use(){ const t=kitThrowTarget(),tx=t[0],ty=t[1]; shocks.push({x:tx,y:ty,r:.2,maxR:2.8,life:.45,max:.45,dmg:0,hit:true,col:[255,140,50]}); addShake(.3); burst(tx,ty,[255,150,60],20,4); for(const o of mobs){ if(o.friendly||o.type==='nest'||o.hp<=0) continue; if(len(o.x-tx,o.y-ty)<2.8){ o.burnT=Math.max(o.burnT||0,2.4); o.burnDps=Math.max(o.burnDps||0,PDMG()*0.10); tryReact(o,'burn'); dealDamage(o,Math.round(18+floor*1.3),{noCrit:true}); } } return true; },
    icon(c,x,y,s){ c.fillStyle='#3a3340'; c.beginPath(); c.arc(x,y+s*0.2,s*0.7,0,7); c.fill(); c.strokeStyle='#777'; c.beginPath(); c.moveTo(x,y-s*0.5); c.lineTo(x+s*0.3,y-s*0.9); c.stroke(); c.globalCompositeOperation='lighter'; c.fillStyle='rgba(255,150,40,.9)'; c.beginPath(); c.arc(x,y+s*0.2,s*0.35,0,7); c.fill(); c.globalCompositeOperation='source-over'; } },
  {key:'frost', n:'Frost Phial', e:'hurls ice — chills & slows foes', max:5, col:[150,210,255], sfx:'coin', useMsg:'A burst of biting cold!',
    use(){ const t=kitThrowTarget(),tx=t[0],ty=t[1]; shocks.push({x:tx,y:ty,r:.2,maxR:2.8,life:.45,max:.45,dmg:0,hit:true,col:[150,210,255]}); burst(tx,ty,[150,210,255],16,3); for(const o of mobs){ if(o.friendly||o.hp<=0) continue; if(len(o.x-tx,o.y-ty)<2.8){ o.eSlowT=Math.max(o.eSlowT||0,2.5); tryReact(o,'frost'); } } return true; },
    icon(c,x,y,s){ c.fillStyle='#9fd6ff'; for(let k=0;k<3;k++){ c.save(); c.translate(x,y); c.rotate(k*2.1); c.fillRect(-s*0.12,-s*0.6,s*0.24,s*1.2); c.restore(); } c.globalCompositeOperation='lighter'; c.fillStyle='rgba(255,255,255,.7)'; c.beginPath(); c.arc(x,y,s*0.25,0,7); c.fill(); c.globalCompositeOperation='source-over'; } },
  {key:'aether', n:'Aether Cell', e:'+35 mana', max:5, rarity:'uncommon', col:[180,110,255], sfx:'level', useMsg:'Power crackles into your reserve.',
    use(){ player.charge=Math.min(player.maxMana,player.charge+35); return true; },
    icon(c,x,y,s){ c.fillStyle='#b46fff'; c.beginPath(); for(let k=0;k<6;k++){ const a=k*Math.PI/3; c[k?'lineTo':'moveTo'](x+Math.cos(a)*s*0.7,y+Math.sin(a)*s*0.7); } c.closePath(); c.fill(); c.globalCompositeOperation='lighter'; c.fillStyle='rgba(200,150,255,.7)'; c.beginPath(); c.moveTo(x,y-s*0.4); c.lineTo(x-s*0.2,y); c.lineTo(x+s*0.1,y); c.lineTo(x,y+s*0.4); c.fill(); c.globalCompositeOperation='source-over'; } },
  {key:'warding', n:'Warding Charm', e:'half damage for 4s', max:5, col:[207,224,255], sfx:'level', useMsg:'A ward shimmers around you.',
    use(){ player.shieldT=Math.max(player.shieldT||0,4); return true; },
    icon(c,x,y,s){ c.fillStyle='#cfe0ff'; c.beginPath(); c.moveTo(x,y-s*0.7); c.lineTo(x+s*0.55,y-s*0.4); c.lineTo(x+s*0.4,y+s*0.5); c.lineTo(x,y+s*0.8); c.lineTo(x-s*0.4,y+s*0.5); c.lineTo(x-s*0.55,y-s*0.4); c.closePath(); c.fill(); c.strokeStyle=realm?'rgba('+realm.accent.join(',')+',.9)':'#8fe06a'; c.lineWidth=2; c.beginPath(); c.moveTo(x,y-s*0.4); c.lineTo(x,y+s*0.4); c.stroke(); c.lineWidth=1; } },
  {key:'skeleton', n:'Skeleton Key', e:'opens a locked chest within reach', max:9, col:[255,224,102], sfx:'coin', useMsg:'The lock yields with a click.',
    use(){ let best=null,bd=1.8; for(const pp of props){ if(pp.kind==='chest'&&pp.locked){ const d=len(pp.x-player.x,pp.y-player.y); if(d<bd){ bd=d; best=pp; } } } if(!best){ showToast('No lock within reach.'); return false; } if(best.arenaChest){ showToast('The Arena Master’s lock answers only to victory.'); return false; } best.locked=false; interactProp(best); return true; },
    icon(c,x,y,s){ c.strokeStyle='#ffe066'; c.fillStyle='#ffe066'; c.lineWidth=Math.max(2,s*0.18); c.beginPath(); c.arc(x,y-s*0.4,s*0.32,0,7); c.stroke(); c.beginPath(); c.moveTo(x,y-s*0.1); c.lineTo(x,y+s*0.7); c.lineTo(x+s*0.3,y+s*0.7); c.moveTo(x,y+s*0.35); c.lineTo(x+s*0.22,y+s*0.35); c.stroke(); c.lineWidth=1; } },
];
const KIT_DEFS_MAP={}; for(const d of KIT_DEFS) KIT_DEFS_MAP[d.key]=d;
// ====== TRINKETS — passive EQUIP gear (own registry; recomputeRelics never reads it; NOT in player.items/RELIC_MAP) ======
const TRINKET_SLOTS=3;
const TRINKET_DEFS=[
  {key:'stoneheart',n:'Stoneheart Locket',e:'+24 max HP',rarity:'common',col:[150,160,170],passive(a){a.maxHp+=24;},
    icon(c,x,y,s){ c.fillStyle='#969aa6'; if(c.roundRect){c.beginPath();c.roundRect(x-s*0.6,y-s*0.6,s*1.2,s*1.2,s*0.35);c.fill();}else c.fillRect(x-s*0.6,y-s*0.6,s*1.2,s*1.2); c.fillStyle='#d24a4a'; c.beginPath(); c.arc(x,y,s*0.3,0,7); c.fill(); }},
  {key:'keen',n:'Keen Charm',e:'+12 damage',rarity:'common',col:[185,190,200],passive(a){a.dmg+=12;},
    icon(c,x,y,s){ c.strokeStyle='#c8ccd6'; c.lineWidth=Math.max(2,s*0.3); c.beginPath(); c.moveTo(x-s*0.6,y+s*0.5); c.lineTo(x+s*0.5,y-s*0.6); c.stroke(); c.lineWidth=1; c.fillStyle='#fff'; c.beginPath(); c.arc(x+s*0.5,y-s*0.55,s*0.16,0,7); c.fill(); }},
  {key:'fleetfoot',n:'Fleetfoot Anklet',e:'+0.5 speed',rarity:'common',col:[200,170,120],passive(a){a.speed+=0.5;},
    icon(c,x,y,s){ c.strokeStyle='#c8a878'; c.lineWidth=Math.max(2,s*0.22); c.beginPath(); c.arc(x,y,s*0.5,0,7); c.stroke(); c.lineWidth=1; c.strokeStyle='rgba(200,170,120,.8)'; for(let k=0;k<3;k++){ c.beginPath(); c.moveTo(x+s*0.6,y-s*0.3+k*s*0.3); c.lineTo(x+s*0.95,y-s*0.3+k*s*0.3); c.stroke(); } }},
  {key:'sovereign',n:'Lucky Sovereign',e:'+7% crit',rarity:'uncommon',col:[235,200,90],passive(a){a.crit+=0.07;},
    icon(c,x,y,s){ c.fillStyle='#ebc85a'; c.beginPath(); c.arc(x,y,s*0.6,0,7); c.fill(); c.strokeStyle='#b8941f'; c.lineWidth=1.5; c.stroke(); c.lineWidth=1; c.fillStyle='#fff8e0'; c.beginPath(); c.arc(x-s*0.18,y-s*0.18,s*0.14,0,7); c.fill(); }},
  {key:'fang',n:'Sanguine Tooth',e:'+4 lifesteal',rarity:'uncommon',col:[230,120,140],passive(a){a.lifesteal+=4;},
    icon(c,x,y,s){ c.fillStyle='#f0e6d2'; c.beginPath(); c.moveTo(x-s*0.4,y-s*0.6); c.lineTo(x+s*0.4,y-s*0.6); c.lineTo(x,y+s*0.7); c.closePath(); c.fill(); c.fillStyle='#d23a5a'; c.beginPath(); c.arc(x,y+s*0.55,s*0.16,0,7); c.fill(); }},
  {key:'headsman',n:"Headsman's Edge",e:'+40% crit damage',rarity:'rare',col:[200,90,90],passive(a){a.critM+=0.4;},
    icon(c,x,y,s){ c.fillStyle='#3a2a2a'; if(c.roundRect){c.beginPath();c.roundRect(x-s*0.5,y-s*0.5,s*0.9,s*0.7,s*0.12);c.fill();}else c.fillRect(x-s*0.5,y-s*0.5,s*0.9,s*0.7); c.fillStyle='#e0b050'; c.fillRect(x-s*0.5,y+s*0.18,s*0.9,s*0.12); c.fillStyle='#6a5030'; c.fillRect(x+s*0.34,y-s*0.2,s*0.18,s*0.9); }},
];
const TRINKET_DEFS_MAP={}; for(const d of TRINKET_DEFS) TRINKET_DEFS_MAP[d.key]=d;
// ===== GRIMOIRES (Trial Towers 3.0) — books that grant an active ability when slotted in the 3 ability circles =====
// kind: 'AD' physical / 'AP' magic / 'defense' / 'movement'. Damage scales off the holder's AD/AP via pAtk(). Cast cost = mana.
const GRIMOIRE_DEFS=[
  {key:'g_fireball', n:'Grimoire: Fireball', e:'AP fire nova that ignites foes', rarity:'uncommon', kind:'AP', col:[255,140,60], mana:24, cd:3.5,
    icon(c,x,y,s){ c.fillStyle='#3a2a20'; c.fillRect(x-s*0.5,y-s*0.62,s,s*1.24); c.globalCompositeOperation='lighter'; c.fillStyle='rgba(255,150,40,.95)'; c.beginPath(); c.arc(x,y,s*0.42,0,7); c.fill(); c.globalCompositeOperation='source-over'; },
    cast(){ const R=4.4, D=pAtk('magic')*1.6; shocks.push({x:player.x,y:player.y,r:.2,maxR:R,life:.5,max:.5,dmg:0,hit:true,col:[255,140,60]}); burst(player.x,player.y,[255,150,60],28,5); addShake(.3);
      for(const s of [...mobs]){ if(s.friendly||s.hp<=0) continue; if(len(s.x-player.x,s.y-player.y)>R+s.r) continue; dealDamage(s,D,{noCrit:true,kind:'magic'}); if(mobs.includes(s)){ s.burnT=Math.max(s.burnT||0,2.4); s.burnDps=Math.max(s.burnDps||0,pAtk('magic')*0.10); tryReact(s,'burn'); } } } },
  {key:'g_quake', n:'Grimoire: Stone Fist', e:'AD shockwave, stuns nearby', rarity:'common', kind:'AD', col:[200,170,120], mana:18, cd:5,
    icon(c,x,y,s){ c.fillStyle='#b0986a'; c.fillRect(x-s*0.5,y-s*0.38,s,s*0.76); c.fillStyle='#7a6747'; c.fillRect(x-s*0.5,y+s*0.04,s,s*0.12); },
    cast(){ const R=3.4, D=pAtk('physical')*1.4; shocks.push({x:player.x,y:player.y,r:.2,maxR:R,life:.5,max:.5,dmg:0,hit:true,col:[200,170,120]}); addShake(.5); sfx('boss');
      for(const s of [...mobs]){ if(s.friendly||s.hp<=0) continue; if(len(s.x-player.x,s.y-player.y)>R+s.r) continue; dealDamage(s,D,{noCrit:true,kind:'physical'}); if(mobs.includes(s)){ provoke(s); s.stunT=Math.max(s.stunT||0,(s.type==='boss'||s.type==='general')?0.4:1.1); } } } },
  {key:'g_aegis', n:'Grimoire: Aegis', e:'half damage taken for 4s', rarity:'common', kind:'defense', col:[150,200,255], mana:20, cd:9,
    icon(c,x,y,s){ c.fillStyle='#9fc8ff'; c.beginPath(); c.moveTo(x,y-s*0.6); c.lineTo(x+s*0.5,y-s*0.3); c.lineTo(x+s*0.35,y+s*0.5); c.lineTo(x,y+s*0.7); c.lineTo(x-s*0.35,y+s*0.5); c.lineTo(x-s*0.5,y-s*0.3); c.closePath(); c.fill(); },
    cast(){ player.shieldT=Math.max(player.shieldT||0,4); shocks.push({x:player.x,y:player.y,r:.2,maxR:1.8,life:.4,max:.4,dmg:0,hit:true,col:[150,200,255]}); sfx('level'); } },
  {key:'g_phase', n:'Grimoire: Phase Step', e:'blink forward, brief iframes', rarity:'uncommon', kind:'movement', col:[180,140,255], mana:14, cd:2.5,
    icon(c,x,y,s){ c.globalCompositeOperation='lighter'; c.fillStyle='rgba(180,140,255,.9)'; c.beginPath(); c.arc(x-s*0.22,y,s*0.3,0,7); c.fill(); c.fillStyle='rgba(180,140,255,.45)'; c.beginPath(); c.arc(x+s*0.3,y,s*0.34,0,7); c.fill(); c.globalCompositeOperation='source-over'; },
    cast(){ const steps=22, st=5/steps; let bx=player.x, by=player.y; for(let i=0;i<steps;i++){ const nx=bx+player.fx*st, ny=by+player.fy*st; if(inWall(nx,ny,player.r*0.9)) break; bx=nx; by=ny; } burst(player.x,player.y,[180,140,255],12,3); player.x=bx; player.y=by; burst(bx,by,[180,140,255],14,4); player.iframe=Math.max(player.iframe,.3); sfx('dash'); } },
  {key:'g_leech', n:'Grimoire: Blooddraw', e:'drain the nearest foe, heal', rarity:'rare', kind:'AP', col:[230,80,110], mana:22, cd:4,
    icon(c,x,y,s){ c.fillStyle='#e0506e'; c.beginPath(); c.moveTo(x,y-s*0.6); c.bezierCurveTo(x+s*0.6,y-s*0.1,x+s*0.3,y+s*0.62,x,y+s*0.62); c.bezierCurveTo(x-s*0.3,y+s*0.62,x-s*0.6,y-s*0.1,x,y-s*0.6); c.fill(); },
    cast(){ let best=null,bd=49; for(const s of mobs){ if(s.friendly||s.hp<=0) continue; const d2=(s.x-player.x)**2+(s.y-player.y)**2; if(d2<bd){bd=d2;best=s;} } if(!best){ showToast('No foe in range.'); return false; } const amt=Math.round(pAtk('magic')*1.8), got=Math.min(amt,best.hp); dealDamage(best,amt,{noCrit:true,kind:'magic'}); player.hp=Math.min(player.maxHp,player.hp+Math.round(got*0.5)); bolts.push({x1:player.x,y1:player.y,x2:best.x,y2:best.y,life:.2}); burst(player.x,player.y,[230,80,110],10,3); sfx('hit'); } },
  {key:'g_meteor', n:'Grimoire: Meteor', e:'big AP strike at the cursor', rarity:'rare', kind:'AP', col:[255,90,50], mana:38, cd:8,
    icon(c,x,y,s){ c.fillStyle='#ff6a3a'; c.beginPath(); c.arc(x+s*0.2,y-s*0.2,s*0.44,0,7); c.fill(); c.strokeStyle='rgba(255,180,80,.85)'; c.lineWidth=2; c.beginPath(); c.moveTo(x-s*0.6,y+s*0.6); c.lineTo(x,y); c.stroke(); c.lineWidth=1; },
    cast(){ const t=kitThrowTarget(), tx=t[0], ty=t[1], R=3.2, D=pAtk('magic')*2.6; shocks.push({x:tx,y:ty,r:.2,maxR:R,life:.5,max:.5,dmg:0,hit:true,col:[255,90,50]}); burst(tx,ty,[255,120,50],36,6); addShake(.5); sfx('boss');
      for(const s of [...mobs]){ if(s.friendly||s.hp<=0) continue; if(len(s.x-tx,s.y-ty)>R+s.r) continue; dealDamage(s,D,{noCrit:true,kind:'magic'}); if(mobs.includes(s)){ s.burnT=Math.max(s.burnT||0,2); s.burnDps=Math.max(s.burnDps||0,pAtk('magic')*0.08); tryReact(s,'burn'); } } } },
];
const GRIMOIRE_MAP={}; for(const d of GRIMOIRE_DEFS) GRIMOIRE_MAP[d.key]=d;
const RARITY={common:'#b9bfca', uncommon:'#78c860', rare:'#3f8ce0', epic:'#b48cf0', legendary:'#f0c450'};
function rarityCol(r){ return RARITY[r]||RARITY.common; }
function itemDef(key){ return KIT_DEFS_MAP[key] || GRIMOIRE_MAP[key]; }   // a kit cell may hold a consumable OR a grimoire book
function grantGrimoire(key){ if(!GRIMOIRE_MAP[key]) return false; if(!player.grimoire) player.grimoire=[null,null,null];
  for(let i=0;i<3;i++){ if(!player.grimoire[i]){ player.grimoire[i]=key; return '✦ '+GRIMOIRE_MAP[key].n+' — slotted'; } }
  for(let i=0;i<25;i++){ if(!player.kit[i]){ player.kit[i]={key,q:1}; return GRIMOIRE_MAP[key].n+' (stashed — open I, drag onto a slot)'; } }
  return false; }
function castGrimoire(slot){ const key=player.grimoire&&player.grimoire[slot]; if(!key) return; const G=GRIMOIRE_MAP[key]; if(!G) return;
  if(!player.grimCd) player.grimCd=[0,0,0];
  if((player.grimCd[slot]||0)>0) return;
  const cost=G.mana||20; if((player.charge||0)<cost){ showToast('Not enough mana — need '+cost); player.grimCd[slot]=.25; return; }
  if(G.cast()===false) return;   // cast aborted (e.g. no target) — no cost
  player.charge-=cost; player.grimCd[slot]=G.cd||4; }
function rollGrimoire(tier){ const rar=tier>=3?'rare':tier>=1?'uncommon':'common'; let pool=GRIMOIRE_DEFS.filter(d=>d.rarity===rar); if(!pool.length) pool=GRIMOIRE_DEFS; return pick(pool).key; }
// ===== STAR RANKING (Trial Towers 3.0) — your most dominant power sets a title + star tier (1-10) =====
function starRank(p){ p=p||player; const ad=p.ad||0, ap=p.ap||0, def=(p.adDef||0)+(p.apDef||0);
  const cand=[['Warrior','AD',ad,1],['Mage','AP',ap,1],['Guardian','DEF',def,0.7]];   // defence weighted so a high-AD knight still reads as Warrior
  let best=cand[0]; for(const c of cand){ if(c[2]*c[3] > best[2]*best[3]) best=c; }
  const val=best[2], TH=[28,42,58,76,98,124,156,196,244,300]; let stars=0; for(const t of TH){ if(val>=t) stars++; } if(stars<1) stars=1; if(stars>10) stars=10;
  return {title:best[0], axis:best[1], stars, val:Math.round(val)}; }
function starStr(p){ const r=starRank(p); return r.stars+'★ '+r.title.toUpperCase(); }
function trinketCount(){ let n=0; for(const t of (player&&player.trinkets||[])) if(t) n++; return n; }
function normalizeTrinkets(arr){ const out=Array(TRINKET_SLOTS).fill(null); if(Array.isArray(arr)){ let j=0; for(let i=0;i<arr.length&&j<TRINKET_SLOTS;i++){ const o=arr[i]; if(o&&TRINKET_DEFS_MAP[o.key]) out[j++]={key:o.key}; } } return out; }
function kitCount(){ let n=0; for(const s of (player&&player.kit||[])) if(s) n+=s.q; return n; }
function kitAdd(key,q){ q=q||1; const def=KIT_DEFS_MAP[key]; if(!def) return false; const max=def.max||5; for(const s of player.kit){ if(s&&s.key===key&&s.q<max){ s.q=Math.min(max,s.q+q); return true; } } for(let i=0;i<25;i++){ if(!player.kit[i]){ player.kit[i]={key,q:Math.min(max,q)}; return true; } } return false; }
function useKitItem(i){ const s=player.kit[i]; if(!s||player.kitCd>0) return; const def=KIT_DEFS_MAP[s.key]; if(!def||!def.use) return; const r=def.use(); if(r===false){ return; } s.q--; if(s.q<=0) player.kit[i]=null; player.kitCd=0.6; burst(player.x,player.y,def.col||[150,200,255],10,2.5); sfx(def.sfx||'level'); showToast(def.useMsg||('Used '+def.n)); saveRun(); }
function dropKitItem(i){ const s=player.kit[i]; if(!s) return; s.q--; if(s.q<=0) player.kit[i]=null; showToast('Discarded.'); saveRun(); }
function normalizeKit(a){ const k=Array(25).fill(null); if(Array.isArray(a)) for(let i=0;i<25&&i<a.length;i++){ const o=a[i]; const def=o&&itemDef(o.key); if(def&&(o.q|0)>0) k[i]={key:o.key,q:Math.min(def.max||1,o.q|0)}; } return k; }
function kitCellRect(i){ const cell=Math.max(38,Math.min(76,(Math.min(W,H)-200)/5)),gap=10,sep=22,cols=5,gw=cols*cell+(cols-1)*gap,gh=5*cell+4*gap+sep,gx=(W-gw)/2,gy=(H-gh)/2+30,row=(i/5)|0; return [gx+(i%5)*(cell+gap), gy+row*(cell+gap)+(row>0?sep:0), cell]; }
function spawnWorldKit(x,y,key){ if(LEAN) return; if(!KIT_DEFS_MAP[key]) return; const a=rand(0,6.28); worldKit.push({x,y,vx:Math.cos(a)*rand(1,2.4),vy:Math.sin(a)*rand(1,2.4),life:45,r:.3,key}); burst(x,y,KIT_DEFS_MAP[key].col||[150,200,255],10,3); }
function rollKitDrop(tier){ const common=['draught','swift','frost','warding'], mid=['greater','ember','aether'], rare=['skeleton','greater','aether']; if(tier>=3) return pick(rare.concat(mid)); if(tier>=2) return pick(mid); if(tier>=1) return pick(rand(0,1)<.5?mid:common); return pick(common); }
// ===== CORPSE DETONATION CHAINS — status deaths detonate and cascade across packs =====
const CHAIN_MAX_DEPTH=4;    // recursion cap: killMob->dealDamage->killMob nesting (stack-overflow guard)
const CHAIN_FRAME_CAP=14;   // detonations allowed to FIRE per update() frame (work guard)
const CHAIN_NEIGH_CAP=5;    // neighbours a single detonation directly damages (fan-out guard)
const CHAIN_RADIUS=3.2, CHAIN_LINGER=1.8;
// --- Incident Director (autonomous NPC-vs-NPC feuds) tunables ---
const INCIDENT_CAP=1;
const FEUD_DMG=8, FEUD_RECOIL=5;
const WARFAC_RANGE2=2.6*2.6, WARFAC_SCAN2=12*12;
const REPRISAL_T=-4, SALUTE_T=3, ALLY_LIFE=32, GRUDGE_R2=4.5*4.5, RECRUIT_RANGE2=18*18;   // v196 Feud Aftermath tuning
let _chainDepth=0, chainBudget=CHAIN_FRAME_CAP, chainN=0, chainTimer=0, chainPop=0;
function chainElemOf(m){ if(m._elem) return m._elem; if(m.burnT>0) return 'burn'; if(m.poisonT>0) return 'venom'; if(m.eSlowT>0) return 'frost'; return null; }
function applyChainElem(o, elem){ if(!o || o.hp<=0 || !elem) return;
  if(elem==='burn'){ o.burnT=Math.max(o.burnT||0,2.4); o.burnDps=Math.max(o.burnDps||0, player.ad*0.10*Math.max(1,player.burn||1)); tryReact(o,'burn'); }
  else if(elem==='venom'){ o.poisonT=Math.max(o.poisonT||0,3.2); o.poisonDps=Math.max(o.poisonDps||0, player.ad*0.08*Math.max(1,player.venom||1)); tryReact(o,'venom'); }
  else if(elem==='frost'){ o.eSlowT=Math.max(o.eSlowT||0,1.6); tryReact(o,'frost'); } }
function chainDetonate(m, elem, seed){
  if(chainBudget<=0) return;                 // GUARD 1: per-frame work budget
  if(_chainDepth>=CHAIN_MAX_DEPTH) return;    // GUARD 2: call-stack depth cap
  chainBudget--; _chainDepth++;
  try{
    chainN = seed ? Math.max(1, chainN+1) : chainN+1; chainTimer=CHAIN_LINGER; chainPop=.22;
    const tier=Math.min(4, Math.floor(chainN/4));
    const col = elem==='burn'?[255,150,50] : elem==='frost'?[170,225,255] : elem==='venom'?[150,230,90] : [255,200,120];
    burst(m.x,m.y,col,8+tier*4,3.2+tier*0.8); addShake(0.12+0.05*tier); freezeT=Math.max(freezeT,0.02+0.012*tier); sfx(tier>=2?'boss':'hit');
    const R=CHAIN_RADIUS+tier*0.5, dmg=Math.round(PDMG()*(0.45+0.12*tier)+(m.maxHp||0)*0.06);
    const sh={x:m.x,y:m.y,r:.2,maxR:R,life:.4,max:.4,dmg,hit:false,col,chain:true,chainElem:elem};
    if(elem==='venom'){ sh.poison=true; sh.tick=0; sh.life=.6; sh.max=.6; }
    shocks.push(sh);
    const R2=R*R, cand=[];
    for(const o of mobs){ if(o===m||o.friendly||o.type==='nest'||o.hp<=0) continue; const dx=o.x-m.x,dy=o.y-m.y,d2=dx*dx+dy*dy; if(d2<R2){ cand.push([d2,o]); if(cand.length>=24) break; } }
    cand.sort((a,b)=>a[0]-b[0]);
    const hits=Math.min(CHAIN_NEIGH_CAP, cand.length);
    for(let i=0;i<hits;i++){ if(chainBudget<=0) break; const o=cand[i][1]; if(o.hp<=0) continue; applyChainElem(o, elem); dealDamage(o, dmg, {noCrit:true, chained:true}); }
    if(chainN>=4 && chainN%4===0){ const bonus=Math.min(20,2+chainN); dropCoins(m.x,m.y,bonus); player.charge=Math.min(player.maxMana,player.charge+4+tier*2); pushDmgText(m.x,m.y-1.2,'CHAIN x'+chainN,'crit'); sfx('coin'); if(chainN>=8) showToast('✦ CHAIN x'+chainN+' — +'+bonus+' coins, ult charging!'); }
  } finally { _chainDepth--; }   // GUARANTEED unwind: depth never leaks even if dealDamage throws
}
function react(s, e1, e2){                       // two different elements on one foe detonate
  s.reactCd=0.5; const set={}; set[e1]=1; set[e2]=1; const has=(a,b)=>set[a]&&set[b];
  const RX=bmReactMul();                        // CRIMSON MOON makes reactions detonate harder
  if(has('burn','frost')){                        // THERMAL SHOCK — shatter-burn
    s.burnT=0; s.eSlowT=0; s.stunT=Math.max(s.stunT||0,0.7);
    burst(s.x,s.y,[180,220,255],18,5); burst(s.x,s.y,[255,160,60],14,4);
    shocks.push({x:s.x,y:s.y,r:.2,maxR:player.evoThermal?3.6:2.7,life:.4,max:.4,dmg:Math.round(PDMG()*(player.evoThermal?1.0:0.6)*RX),hit:false,col:[200,222,255]});
    pushDmgText(s.x,s.y-s.r,'THERMAL SHOCK','crit'); sfx('boss'); addShake(.2);
    dealDamage(s, PDMG()*(player.evoThermal?4.6:2.4)*RX, {noCrit:true});
  } else if(has('venom','burn')){                 // CAUSTIC BLOOM — toxic cloud
    const cd=PDMG()*0.08*(player.evoPlague?7:4);
    shocks.push({x:s.x,y:s.y,r:.2,maxR:player.evoPlague?4.2:3.0,life:player.evoPlague?1.0:.7,max:player.evoPlague?1.0:.7,dmg:Math.round(cd),hit:false,col:[140,230,90],poison:true});
    burst(s.x,s.y,[150,230,90],18,4); pushDmgText(s.x,s.y-s.r,'CAUSTIC BLOOM','crit'); sfx('hit'); addShake(.12);
  } else if(has('venom','frost')){                // BRITTLE ROT — frozen flesh crumbles
    s.eSlowT=0; burst(s.x,s.y,[200,230,210],16,4);
    shocks.push({x:s.x,y:s.y,r:.2,maxR:2.4,life:.4,max:.4,dmg:Math.round(PDMG()*0.5),hit:false,col:[180,210,200]});
    pushDmgText(s.x,s.y-s.r,'BRITTLE ROT','crit'); sfx('hit');
    dealDamage(s, PDMG()*(player.evoPerma?3.0:1.5), {noCrit:true});
  }
}
function tryReact(s,elem){                         // record the element, or detonate against a different live one
  if(!s || s.hp<=0) return;
  const old=s._elem;
  if(old && old!==elem && (s.reactCd||0)<=0){ react(s, old, elem); s._elem=null; }
  else { s._elem=elem; }
}
function relicAccum(){   // v203fix: the EXACT stat contribution recomputeRelics computes as `n` (passives + school resonance), no side effects
  const n={dmg:0,maxHp:0,speed:0,crit:0,critM:0,lifesteal:0,thorns:0,ap:0,adDef:0,apDef:0};
  for(const it of (player.items||[])){ const R=it.key&&RELIC_MAP[it.key]; if(R&&R.passive) R.passive(n); }
  const sc={}; for(const it of (player.items||[])){ const sk=RELIC_SCHOOL[it.key]; if(sk) sc[sk]=(sc[sk]||0)+1; }
  for(const k in sc){ if(sc[k]>=3){ const t=sc[k]>=5?2:1; if(SCHOOL_BONUS[k]) SCHOOL_BONUS[k](n,t); } }
  return n;
}
function recomputeRelics(){                   // idempotent: strip prior relic contribution, re-add from owned
  const a=player._relic||{dmg:0,maxHp:0,speed:0,crit:0,critM:0,lifesteal:0,thorns:0,ap:0,adDef:0,apDef:0};
  player.ad-=a.dmg; player.maxHp-=a.maxHp; player.speed-=a.speed; player.critC-=a.crit; player.critM-=(a.critM||0); player.lifesteal-=a.lifesteal; player.thorns-=a.thorns; player.ap-=(a.ap||0); player.adDef-=(a.adDef||0); player.apDef-=(a.apDef||0);
  const n={dmg:0,maxHp:0,speed:0,crit:0,critM:0,lifesteal:0,thorns:0,ap:0,adDef:0,apDef:0};
  player.relicsHit=[]; player.relicsKill=[]; player.relicsHurt=[]; player.relicsTick=[];
  for(const it of (player.items||[])){ const R=it.key&&RELIC_MAP[it.key]; if(!R) continue;
    if(R.passive) R.passive(n);
    if(R.onHit) player.relicsHit.push(R); if(R.onKill) player.relicsKill.push(R); if(R.onHurt) player.relicsHurt.push(R); if(R.tick) player.relicsTick.push(R); }
  // ---- RELIC RESONANCE: tally schools, fold escalating set bonuses into the accumulator ----
  { const sc={}; for(const it of (player.items||[])){ const sk=RELIC_SCHOOL[it.key]; if(sk) sc[sk]=(sc[sk]||0)+1; }
    const res={}; for(const k in sc){ if(sc[k]>=3){ const t=sc[k]>=5?2:1; res[k]=t; if(SCHOOL_BONUS[k]) SCHOOL_BONUS[k](n,t); } }
    if(typeof phase!=='undefined' && phase==='explore'){ const seen=player._resSeen||{};
      for(const k in res){ if((seen[k]||0)<res[k]){ const I=SCHOOL_INFO[k]; try{ showToast(I.icon+' '+I.n.toUpperCase()+' RESONANCE '+(res[k]>1?'II':'I')+' — '+SCHOOL_DESC[k]); sfx('level'); }catch(e){} } } }
    player._resSeen=Object.assign({},res); player.res=res; }
  player.ad+=n.dmg; player.maxHp+=n.maxHp; player.speed+=n.speed; player.critC+=n.crit; player.critM+=n.critM; player.lifesteal+=n.lifesteal; player.thorns+=n.thorns; player.ap+=(n.ap||0); player.adDef+=(n.adDef||0); player.apDef+=(n.apDef||0);
  const hpGain=Math.max(0,n.maxHp-(a.maxHp||0)); if(hpGain>0) player.hp=Math.min(player.maxHp,player.hp+hpGain);
  player.hp=Math.min(player.hp,player.maxHp); player._relic=n;
}
function trinketAccum(){ const n={dmg:0,maxHp:0,speed:0,crit:0,critM:0,lifesteal:0,thorns:0,ap:0,adDef:0,apDef:0};
  for(const t of (player.trinkets||[])){ const D=t&&TRINKET_DEFS_MAP[t.key]; if(D&&D.passive) D.passive(n); } return n; }
function recomputeTrinkets(){   // idempotent sibling of recomputeRelics; own accumulator player._trinket; HP-NEUTRAL (no heal-up)
  const a=player._trinket||{dmg:0,maxHp:0,speed:0,crit:0,critM:0,lifesteal:0,thorns:0,ap:0,adDef:0,apDef:0};
  const hp0=player.hp;
  player.ad-=a.dmg; player.maxHp-=a.maxHp; player.speed-=a.speed; player.critC-=a.crit; player.critM-=(a.critM||0); player.lifesteal-=a.lifesteal; player.thorns-=a.thorns; player.ap-=(a.ap||0); player.adDef-=(a.adDef||0); player.apDef-=(a.apDef||0);
  const n=trinketAccum();
  player.ad+=n.dmg; player.maxHp+=n.maxHp; player.speed+=n.speed; player.critC+=n.crit; player.critM+=n.critM; player.lifesteal+=n.lifesteal; player.thorns+=n.thorns; player.ap+=(n.ap||0); player.adDef+=(n.adDef||0); player.apDef+=(n.apDef||0);
  player.hp=Math.min(hp0,player.maxHp); player._trinket=n;
}
function grantTrinket(key){ const D=TRINKET_DEFS_MAP[key]; if(!D) return false;
  const free=player.trinkets.indexOf(null); if(free<0) return false;
  player.trinkets[free]={key}; recomputeTrinkets(); return '◈ '+D.n+' — '+D.e; }
function grantTrinketTier(tier){ const rar=tier>=3?'rare':tier>=1?'uncommon':'common'; let pool=TRINKET_DEFS.filter(d=>d.rarity===rar); if(!pool.length) pool=TRINKET_DEFS; return grantTrinket(pick(pool).key); }
function rollTrinket(tier){ const rar=tier>=3?'rare':tier>=1?'uncommon':'common'; let pool=TRINKET_DEFS.filter(d=>d.rarity===rar); if(!pool.length) pool=TRINKET_DEFS; return pick(pool).key; }
function spawnWorldTrinket(x,y,key){ if(LEAN) return; if(!TRINKET_DEFS_MAP[key]) return; const a=rand(0,6.28); worldKit.push({x,y,vx:Math.cos(a)*rand(1,2.4),vy:Math.sin(a)*rand(1,2.4),life:60,r:.32,key,trinket:true}); burst(x,y,TRINKET_DEFS_MAP[key].col||[200,150,255],12,3); }
function trinketSlotRect(i){ const r0=kitCellRect(0), cell=r0[2], gw=5*cell+4*10, gx=r0[0], gy=r0[1]; return [gx+gw-22-(2-i)*30, gy-37, 12]; }
function grimSlotRect(i){ const r0=kitCellRect(0), gx=r0[0], gy=r0[1]; const rad=15; return [gx+rad+i*(rad*2+16), gy-38, rad]; }
function unequipGrimoire(i){ const k=player.grimoire&&player.grimoire[i]; if(!k) return; player.grimoire[i]=null; const f=player.kit.indexOf(null); if(f>=0) player.kit[f]={key:k,q:1}; else { kitHeld={key:k,q:1}; } sfx('coin'); saveRun(); }
function unequipTrinket(i){ const t=player.trinkets&&player.trinkets[i]; if(!t) return; const D=TRINKET_DEFS_MAP[t.key]; player.trinkets[i]=null; recomputeTrinkets(); spawnWorldTrinket(player.x,player.y,t.key); sfx('coin'); showToast('Unequipped '+(D?D.n:'a trinket')+' — it lies at your feet.'); saveRun(); }
function grantRelic(big){
  if(LEAN){ player._relic=player._relic||{dmg:0}; player.ad+=4; player._relic.dmg=(player._relic.dmg||0)+4; return 'a surge of power (+4 dmg)'; }   // lean core: flat boss reward, no relic items
  const cnt={}; for(const it of player.items) if(it.key) cnt[it.key]=(cnt[it.key]||0)+1;
  const avail=RELICS.filter(R=> R.stack ? (cnt[R.key]||0)<3 : !cnt[R.key]);
  if(!avail.length){ player._relic=player._relic||{dmg:0}; player.ad+=4; player._relic.dmg=(player._relic.dmg||0)+4; return 'a surge of power (+4 dmg)'; }
  const take=R=>player.items.push({key:R.key,n:R.n,e:R.e});
  const R1=pick(avail); take(R1); let nm='✦ '+R1.n, ef=R1.e;
  if(big){ const a2=avail.filter(R=>R!==R1); if(a2.length){ const R2=pick(a2); take(R2); nm+=' & '+R2.n; ef+='; '+R2.e; } }
  recomputeRelics();
  return nm+' — '+ef;
}
function grantItem(big){ return grantRelic(big); }
// ===== WEAPON EVOLUTIONS — fuse drafted upgrade PAIRS into named evolved weapons =====
// Registered into RELIC_MAP (so recomputeRelics applies their hooks) but NOT the RELICS random pool.
const EVOLUTIONS = [
  { key:'evo_cryo', n:'Cryoclasm Brand', e:'fire & ice fuse — every Thermal Shock detonates for massive damage',
    needs:['Burning Blade','Frostbite'],
    grant(){ player.burn=Math.max(1,player.burn); player.frostHit=true; player.evoThermal=true; } },
  { key:'evo_plague', n:'Plagueblade', e:'venom & flame coat the blade — Caustic Bloom clouds erupt huge and often',
    needs:['Venom','Burning Blade'],
    grant(){ player.venom=Math.max(1,player.venom); player.burn=Math.max(1,player.burn); player.evoPlague=true; } },
  { key:'evo_perma', n:'Permafrost Fang', e:'poison seeps into every chill — Brittle Rot shatters frozen foes for triple',
    needs:['Venom','Frostbite'],
    grant(){ player.venom=Math.max(1,player.venom); player.frostHit=true; player.evoPerma=true; } },
  { key:'evo_tempest', n:'Tempest Coil', e:'lightning arcs to two more foes and strikes them with the element you wield',
    needs:['Chain Spark','Twin Shot'],
    grant(){ player.chain=true; player.evoTempest=true; },
    onHit(s,amt,opts){ if((opts&&opts.noCrit)||!player.evoTempest) return;
      let hits=0; for(let pass=0;pass<2;pass++){ let best=null,bd=49;
        for(const o of mobs){ if(o===s||o.friendly||o.type==='nest'||o.hp<=0) continue; const d=(o.x-s.x)**2+(o.y-s.y)**2; if(d<bd){ bd=d; best=o; } }
        if(!best) break; bolts.push({x1:s.x,y1:s.y,x2:best.x,y2:best.y,life:.12}); dealDamage(best,player.ad*0.45*wStormMul(),{noCrit:true}); provoke(best);
        if(player.burn>0){ best.burnT=Math.max(best.burnT||0,2); best.burnDps=Math.max(best.burnDps||0,player.ad*0.10); tryReact(best,'burn'); }
        else if(player.frostHit){ best.eSlowT=Math.max(best.eSlowT||0,1.6); tryReact(best,'frost'); }
        else if(player.venom>0){ best.poisonT=Math.max(best.poisonT||0,3); best.poisonDps=Math.max(best.poisonDps||0,player.ad*0.08); tryReact(best,'venom'); }
        if(++hits>=2) break; } } },
  { key:'evo_death', n:'Deathmark Edge', e:'+8% crit, +60% crit damage, and every crit MARKS the foe (+30% damage taken)',
    needs:['Keen Edge','Executioner'],
    grant(){ player.evoDeath=true; },
    passive(a){ a.crit+=0.08; a.critM+=0.6; } },
  { key:'evo_sang', n:'Sanguine Aegis', e:'attackers bleed double — and that reflected blood mends you',
    needs:['Vampirism','Thorns'],
    grant(){ player.evoSang=true; },
    passive(a){ a.thorns+=10; a.lifesteal+=2; },
    onHurt(n,sx,sy){ if(!player.evoSang) return; let b=null,bd=81;
      for(const o of mobs){ if(o.friendly||o.type==='nest'||o.hp<=0) continue; const d=(o.x-sx)**2+(o.y-sy)**2; if(d<bd){ bd=d; b=o; } }
      if(b){ const ref=Math.max(6,n*0.6); dealDamage(b,ref,{noCrit:true}); player.hp=Math.min(player.maxHp,player.hp+Math.ceil(ref*0.3)); burst(player.x,player.y,[255,80,110],6,2.5); } } },
  { key:'evo_storm', n:'Bladestorm Rig', e:'attacks & shots fire even faster, and every 6th strike lands a guaranteed riposte-crit',
    needs:['Frenzy','Quick Draw'],
    grant(){ player.atkCdBase*=0.88; player.rangedCdBase*=0.88; player.evoStorm=true; player.evoStormN=player.evoStormN||0; },
    onHit(s,amt,opts){ if(opts&&opts.noCrit) return; player.evoStormN=(player.evoStormN||0)+1; if(player.evoStormN>=6){ player.evoStormN=0; player.riposteT=Math.max(player.riposteT,0.05); } } },
  { key:'evo_apex', n:'Apex Cleaver', e:'+10 damage, +25 max HP — any foe you strike below 30% HP is EXECUTED outright',
    needs:['Sharper Blade','Vitality'],
    grant(){ player.evoApex=true; },
    passive(a){ a.dmg+=10; a.maxHp+=25; },
    onHit(s,amt,opts){ if(!player.evoApex||s.hp<=0||s._apexDone) return;
      if(s.type==='nest'||s.gateBoss||s.champion||s.type==='boss'||s.type==='general'||s.worldboss||s.isGate) return;
      if(s.hp>0 && s.hp<=s.maxHp*0.30){ s._apexDone=1; pushDmgText(s.x,s.y-s.r,'EXECUTE','crit'); burst(s.x,s.y,[255,60,60],16,5); sfx('boss'); addShake(.14); s.hp=0; } } },
];
for(const _E of EVOLUTIONS) RELIC_MAP[_E.key]=_E;   // recompute finds them; grantRelic (reads RELICS[]) never rolls them
// ===== RELIC RESONANCE — relics belong to schools; owning 3+ of a school triggers an escalating set bonus =====
const RELIC_SCHOOL = {
  ember:'ember', brand:'ember', ironwood:'ember',
  frost:'frost', stone:'frost', chrono:'frost',
  venom:'venom', leech:'venom', soul:'venom',
  storm:'storm', swift:'storm', gambler:'storm',
  coil:'blood', tithe:'blood', hoard:'blood', thorn:'blood',
};
const SCHOOL_INFO = {
  ember:{n:'Ember', icon:'\u{1F525}', col:[255,140,60]},
  frost:{n:'Frost', icon:'❄', col:[150,210,255]},
  venom:{n:'Venom', icon:'☠', col:[150,230,90]},
  storm:{n:'Storm', icon:'⚡', col:[255,225,110]},
  blood:{n:'Blood', icon:'\u{1FA78}', col:[255,90,110]},
};
const SCHOOL_DESC = {
  ember:'searing power (+damage)', frost:'frozen poise (+max HP, cooldowns recover faster)',
  venom:'creeping rot (+lifesteal)', storm:'crackling speed (+crit & move speed)', blood:'iron vitality (+max HP & thorns)',
};
const SCHOOL_BONUS = {
  ember(n,t){ n.dmg += Math.round(player.ad*0.14*t); },
  frost(n,t){ n.maxHp += 24*t; },
  venom(n,t){ n.lifesteal += 3*t; },
  storm(n,t){ n.crit += 0.05*t; n.speed += 0.4*t; },
  blood(n,t){ n.maxHp += 16*t; n.thorns += 6*t; },
};
// ===== ALTARS OF PACT — Faustian bargains: a powerful boon for a lasting curse =====
const PACTS=[
  { n:'Glass Pact',          boon:'+40% power scaling',          curse:'-30% max HP',
    apply(){ player.pactPow=(player.pactPow||1)*1.4; player.maxHp=Math.max(20,Math.round(player.maxHp*0.70)); player.hp=Math.min(player.hp,player.maxHp); } },
  { n:'Reckless Fury',       boon:'attacks 15% faster & +1.2 speed',  curse:'you take +30% damage',
    apply(){ player.speed+=1.2; player.atkCdBase*=0.85; player.rangedCdBase*=0.85; player.pactVuln=Math.min(3,(player.pactVuln||1)*1.3); } },
  { n:'Sanguine Pact',       boon:'+6 lifesteal',               curse:'-25 max HP',
    apply(){ player.lifesteal+=6; player.maxHp=Math.max(20,player.maxHp-25); player.hp=Math.min(player.hp,player.maxHp); } },
  { n:"Executioner's Oath",  boon:'+100% crit damage, +8% crit',curse:'you take +20% damage',
    apply(){ player.critM+=1.0; player.critC=Math.min(.6,player.critC+0.08); player.pactVuln=Math.min(3,(player.pactVuln||1)*1.2); } },
  { n:'Ironblood Vow',       boon:'+55 max HP & +1 life',       curse:'-15% damage output',
    apply(){ player.maxHp+=55; player.hp+=55; player.lives=Math.min((player.maxLives||3)+3,(player.lives||3)+1); player.maxLives=Math.max(player.maxLives||3,player.lives); player.pactPow=(player.pactPow||1)*0.85; } },
  { n:'Pyre Pact',           boon:'every hit ignites fiercely', curse:'-15% max HP',
    apply(){ player.burn=(player.burn||0)+2; player.maxHp=Math.max(20,Math.round(player.maxHp*0.85)); player.hp=Math.min(player.hp,player.maxHp); } },
  { n:'Stormcaller Bargain', boon:'+move speed & chain lightning', curse:'-22 max HP',
    apply(){ player.speed+=1.4; player.chain=true; player.maxHp=Math.max(20,player.maxHp-22); player.hp=Math.min(player.hp,player.maxHp); } },
  { n:"Gambler's Ruin",      boon:'+30% damage',                curse:'+25% damage taken',
    apply(){ player.pactPow=(player.pactPow||1)*1.3; player.pactVuln=Math.min(3,(player.pactVuln||1)*1.25); } },
];
function readyEvolutions(){   // recipes the player owns both halves of and hasn't fused yet
  const d=player.drafted||{}, ev=player.evolved||{};
  const owns=name=> (d[name]||0)>0 || (name==='Frostbite'&&player.frostHit) || (name==='Chain Spark'&&player.chain)
    || (name==='Burning Blade'&&player.burn>0) || (name==='Venom'&&player.venom>0);
  const out=[]; for(const E of EVOLUTIONS){ if(ev[E.key]) continue; if(E.needs.every(owns)) out.push(E); } return out;
}
function fuseEvolution(E){
  if(!E || (player.evolved&&player.evolved[E.key])) return;
  player.evolved=player.evolved||{}; player.evolved[E.key]=true;
  if(E.grant) E.grant();
  player.items.push({key:E.key,n:E.n,e:E.e,evo:true});
  recomputeRelics();
  flashT=Math.max(flashT||0,.09); addShake(.4); sfx('win'); burst(player.x,player.y,[255,224,102],46,6);
  showToast('✦ WEAPON EVOLVED: '+E.n+' — '+E.e);
}

// ---------- Hero classes (chosen on the title screen) ----------
// each hero class wields its own starting weapon with a distinct attack method
const WEAPONS = {
  Knight: { name:'Broadsword',   type:'melee',  reach:1.55, arc:Math.PI*0.62, dmgMul:1.35, knock:.62, flash:.20, swing:'heavy', animDur:.52, noThrow:true },
  Rogue:  { name:'Twin Daggers', type:'melee',  reach:1.20, arc:Math.PI*0.55, dmgMul:.72, knock:.30, flash:.10, swing:'quick', combo:true, animDur:.30 },
  Ranger: { name:'Longbow',      type:'ranged', speed:15,   dmgMul:.90, projR:.16, col:[255,228,130], proj:'arrow', pierce:0, animDur:.44 },
  Mage:   { name:'Arcane Staff', type:'ranged', speed:10.5, dmgMul:1.25, projR:.34, col:[150,170,255], proj:'orb',   pierce:2, animDur:.50, kind:'magic' },
  Gorilla:{ name:'Mighty Fists', type:'melee',  reach:1.70, arc:Math.PI*0.58, dmgMul:1.5,  knock:1.0, flash:.22, swing:'heavy', animDur:.55, noThrow:true, rock:true },
  Vampire:{ name:'Blood Claws',  type:'melee',  reach:1.32, arc:Math.PI*0.6, dmgMul:1.1, knock:.45, flash:.14, swing:'quick', animDur:.42 },
  Joker:  { name:'Razor Cards',  type:'ranged', speed:14,   dmgMul:.75,  projR:.15, col:[255,255,255], proj:'knife', pierce:1, animDur:.35 },
  Necromancer:{ name:'Soul Lash', type:'ranged', speed:10,  dmgMul:1.05, projR:.26, col:[160,255,200], proj:'orb',  pierce:1, animDur:.48, kind:'magic' },
};
const CLASSES = [
  { key:'Knight', blurb:'Broadsword sweeps. E: Bulwark stance. No ranged — pure steel.', apply:p=>{ p.weaponKey='Knight'; p.atkCdBase=.42; p.maxHp+=45; p.hp=p.maxHp; p.thorns+=3; p.speed-=0.3; p.ad=40; p.ap=0; p.adDef=35; p.apDef=15; p.maxStamina=120; p.staRegen=22; p.maxMana=80; p.manaRegen=6; } },
  { key:'Ranger', blurb:'Longbow volleys. E: Hunter\u2019s Mark (+30% dmg to one foe).', apply:p=>{ p.weaponKey='Ranger'; p.rangedStart=true; p.rangedCdBase=0.30; p.maxHp-=10; p.hp=p.maxHp; p.ad=42; p.ap=0; p.adDef=8; p.apDef=8; p.maxStamina=110; p.staRegen=20; p.maxMana=100; p.manaRegen=8; } },
  { key:'Mage',   blurb:'Piercing bolts, biggest ult. E: Blink teleport.', apply:p=>{ p.weaponKey='Mage'; p.rangedCdBase=0.50; p.chargeMul=1.7; p.ultBoost=1.55; p.maxHp-=15; p.hp=p.maxHp; p.ad=14; p.ap=48; p.adDef=6; p.apDef=20; p.maxStamina=80; p.staRegen=14; p.maxMana=130; p.manaRegen=12; } },
  { key:'Rogue',  blurb:'Dagger crits, fastest dash. E: Smoke Bomb (stealth evasion).', apply:p=>{ p.weaponKey='Rogue'; p.atkCdBase=.18; p.critC=.25; p.dashCdBase=0.5; p.speed+=0.9; p.maxHp-=10; p.hp=p.maxHp; p.ad=38; p.ap=0; p.adDef=10; p.apDef=8; p.maxStamina=130; p.staRegen=26; p.maxMana=90; p.manaRegen=9; } },
  { key:'Gorilla', art:'mob_silverback', mute:true, blurb:'Huge HP, crushing fists, hurls rocks. Cannot speak with humans. E: Ground Pound.', apply:p=>{ p.weaponKey='Gorilla'; p.atkCdBase=.5; p.maxHp+=80; p.hp=p.maxHp; p.speed-=0.2; p.rangedStart=true; p.ad=50; p.ap=0; p.adDef=30; p.apDef=10; p.maxStamina=140; p.staRegen=24; p.maxMana=70; p.manaRegen=5; } },
  { key:'Vampire', art:'champ_1', blurb:'Rakes with blood-claws and feasts on the wound. E: Bloody Bite.', apply:p=>{ p.weaponKey='Vampire'; p.atkCdBase=.36; p.lifesteal+=3; p.maxHp-=5; p.hp=p.maxHp; p.ad=34; p.ap=12; p.adDef=14; p.apDef=14; p.maxStamina=110; p.staRegen=20; p.maxMana=100; p.manaRegen=9; } },
  { key:'Joker', art:'npc_gambler', blurb:'Razor cards & a cruel dagger. E: Wild Card — pure chaos.', apply:p=>{ p.weaponKey='Joker'; p.rangedStart=true; p.rangedCdBase=.22; p.critC=.18; p.speed+=0.4; p.maxHp-=15; p.hp=p.maxHp; p.ad=34; p.ap=10; p.adDef=8; p.apDef=8; p.maxStamina=110; p.staRegen=22; p.maxMana=100; p.manaRegen=10; } },
  { key:'Necromancer', art:'mob_hexcaster', blurb:'Soul bolts; the slain rise to serve you. E: Raise Dead.', apply:p=>{ p.weaponKey='Necromancer'; p.rangedStart=true; p.rangedCdBase=.45; p.chargeMul=1.3; p.maxHp-=10; p.hp=p.maxHp; p.ad=22; p.ap=36; p.adDef=8; p.apDef=16; p.maxStamina=90; p.staRegen=14; p.maxMana=120; p.manaRegen=11; } },
];
let heroClass = CLASSES[0];

function realmIndex(f){ return Math.min(REALMS.length-1, Math.floor((f-1)/FLOORS_PER_REALM)); }
// ---------- Weather (per-realm ambient particle layer, screen-space) ----------
const WEATHER = {
  dust:   { vy:8,  vx:5,  sway:6,  col:[205,205,215], sz:[1,2.5] },
  snow:   { vy:55, vx:9,  sway:18, col:[235,245,255], sz:[2,4] },
  leaves: { vy:32, vx:22, sway:30, col:[130,200,110], sz:[2,4] },
  rain:   { vy:330,vx:34, sway:0,  col:[160,185,255], sz:[1,2], streak:true, lightning:true },
  sparks: { vy:-22,vx:11, sway:22, col:[245,210,120], sz:[1,2.5] },
  ash:    { vy:36, vx:11, sway:14, col:[230,120,120], sz:[1.5,3] },
  glimmer:{ vy:12, vx:9,  sway:24, col:[255,240,170], sz:[1,3], twinkle:true },
  motes:  { vy:7,  vx:20, sway:42, col:[195,135,255], sz:[1.5,3.5] },
  fog:    { vy:5,  vx:16, sway:26, col:[200,206,216], sz:[10,22] },
};

let weatherP=[], weatherType='dust', lightningT=0, lightningCd=0;
let weatherInt=0, weatherTarget=0, weatherCd=10;   // weather comes and goes — long clear spells between
let floorClock=0.30; const CLOCK_LEN=90;
let bloodMoon=false;                                   // CRIMSON MOON: deep-night blood event on a non-boss floor
function bmEligible(f){ return f>=3 && f<TOTAL_FLOORS && realm && !realm.special; }   // never on boss/peaceful/champions/families/final
function bmRoll(f){ let h=(f*2654435761 + (ngPlus|0)*40503 + 1013904223)>>>0; h^=h>>>15; h=Math.imul(h,2246822519)>>>0; h^=h>>>13; return (h%3)===0; }
function bmHurtMul(){ return bloodMoon?1.45:1; }       // enraged foes bite ~45% harder (applied in hurtPlayer)
function bmSpeedMul(){ return bloodMoon?1.28:1; }      // enraged foes move ~28% faster (applied at the mob-move site)
function bmReactMul(){ return bloodMoon?1.5:1; }       // reactions detonate harder under the red moon
let weatherAnn=false;   // announced this weather spell?
// ===== WEATHER COMBAT EFFECTS — foul skies bend the fight (gated on an active spell) =====
function wOn(t){ return weatherType===t && weatherInt>0.5; }
function wBurnMul(){ return wOn('rain')?0.55 : wOn('ash')?1.35 : 1; }   // rain douses fire; ashfall feeds it
function wStormMul(){ return wOn('rain')?1.4 : 1; }                      // wet air conducts lightning
function wFoeSpeed(){ return wOn('snow')?0.85 : 1; }                     // a blizzard slows the foe
function wSelfSpeed(){ return wOn('snow')?0.93 : 1; }                    // ...and you, a little
function wSight(){ return wOn('fog')?0.5 : wOn('snow')?0.8 : 1; }        // fog hides you from foes
const WEATHER_FX_TXT={ rain:'🌧 Rain — fire sputters, lightning sings.', snow:'❄ Blizzard — the cold slows all who move.', ash:'🔥 Ashfall — the very air smoulders.', fog:'🌫 Fog rolls in — foes lose sight of you.' };
let cheered=false, crowdCheer=0, fleePulse=0;   // crowd reactions: boss-cheer + panic ripple             // a day-cycle: dawn -> day -> dusk -> night, persists across floors
function clockPhase(){ return floorClock<0.16?'dawn':floorClock<0.60?'day':floorClock<0.74?'dusk':'night'; }
function skyTint(){                                   // time-of-day wash over the world
  const t=floorClock;
  if(t<0.15){ const k=1-t/0.15; return {c:[30,33,76], a:0.34*k}; }                  // last of night fading to dawn
  if(t<0.55) return null;                                                            // broad day: clear
  if(t<0.70){ const k=(t-0.55)/0.15; return {c:[156,74,28], a:0.26*k}; }            // dusk amber
  const k=Math.min(1,(t-0.70)/0.07); return {c:[18,24,78], a:0.20+0.22*k};          // night blue (to ~0.42)
}
function nightAmt(){ const t=floorClock; if(t<0.15) return 1-t/0.15; if(t<0.55) return 0; if(t<0.70) return (t-0.55)/0.15; return 1; }
function initWeather(){ weatherType=(realm&&realm.weather)||'dust'; weatherAnn=false;
  if(realm && !realm.special){ let _wh=(floor*374761393+(ngPlus|0)*668265263)>>>0; _wh^=_wh>>>13; if((_wh%4)===0) weatherType='fog'; }
  weatherP=[]; for(let i=0;i<110;i++) weatherP.push(spawnWeather(true));
  weatherInt=0; weatherTarget=0; weatherCd=rand(6,16); lightningCd=rand(3,8); }
function spawnWeather(anywhere){ const w=WEATHER[weatherType]||WEATHER.dust;
  return { x:rand(0,W||960), y:anywhere?rand(0,H||540):(w.vy>=0?-10:(H||540)+10), ph:rand(0,6.28), spd:rand(.7,1.3), sz:rand(w.sz[0],w.sz[1]), a:rand(.25,.6) }; }
function updateWeather(dt){ const w=WEATHER[weatherType]||WEATHER.dust;
  // intermittent cycles: a spell of weather (10-22s), then a long clear stretch (25-50s)
  weatherCd-=dt;
  if(weatherCd<=0){ weatherTarget = weatherTarget>0 ? 0 : 1; weatherCd = weatherTarget>0 ? rand(10,22) : rand(25,50); }
  weatherInt += (weatherTarget-weatherInt)*Math.min(1,dt*0.7);
  if(weatherInt>0.6 && !weatherAnn && WEATHER_FX_TXT[weatherType]){ weatherAnn=true; try{ showToast(WEATHER_FX_TXT[weatherType]); }catch(e){} }
  if(weatherInt<0.2) weatherAnn=false;
  if(weatherInt<0.02) return;
  for(const p of weatherP){ p.ph+=dt*p.spd;
    p.x += (w.vx*p.spd + Math.sin(p.ph)*w.sway)*dt; p.y += w.vy*p.spd*dt;
    if(p.y>H+12){ p.y=-10; p.x=rand(0,W); } else if(p.y<-12){ p.y=H+10; p.x=rand(0,W); }
    if(p.x>W+12) p.x=-10; else if(p.x<-12) p.x=W+10; }
  if(w.lightning && weatherInt>0.6){ lightningT=Math.max(0,lightningT-dt); lightningCd-=dt; if(lightningCd<=0){ lightningCd=rand(4,10); lightningT=.18; if(!muted) sfx('boss'); } }
}
function renderWeather(){ if(weatherInt<0.03) return; const w=WEATHER[weatherType]||WEATHER.dust; const c=w.col;
  for(const p of weatherP){ ctx.globalAlpha=p.a*weatherInt;
    if(w.streak){ ctx.strokeStyle=`rgb(${c[0]},${c[1]},${c[2]})`; ctx.lineWidth=p.sz; ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.x-2,p.y-9); ctx.stroke(); }
    else if(w.ring){ ctx.strokeStyle=`rgb(${c[0]},${c[1]},${c[2]})`; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(p.x,p.y,p.sz,0,7); ctx.stroke(); }
    else { const tw=w.twinkle?(0.4+0.6*Math.abs(Math.sin(p.ph))):1; ctx.globalAlpha=p.a*tw*weatherInt; ctx.fillStyle=`rgb(${c[0]},${c[1]},${c[2]})`; ctx.beginPath(); ctx.arc(p.x,p.y,p.sz,0,7); ctx.fill(); }
  }
  ctx.globalAlpha=1; ctx.lineWidth=1;
  if(lightningT>0){ ctx.fillStyle='rgba(200,215,255,'+(lightningT*1.6)+')'; ctx.fillRect(0,0,W,H); }
}

// ---------- Ambient generative music (per-realm evolving pad) ----------
const REALM_MUSIC = [196.0,164.8,146.8,220.0,174.6,130.8,207.7,155.6,246.9,138.6];
let musicTimer=0, musicStep=0;
function padTone(f,dur,vol){ if(!actx||muted) return; const t=actx.currentTime;
  const o=actx.createOscillator(), g=actx.createGain(), o2=actx.createOscillator();
  o.type='sine'; o2.type='triangle'; o.frequency.value=f; o2.frequency.value=f*2.003;
  g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+0.5); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.connect(g); o2.connect(g); g.connect(actx.destination); o.start(t); o2.start(t); o.stop(t+dur+0.05); o2.stop(t+dur+0.05);
}
function musicTick(dt){ if(muted||!actx||(phase!=='explore'&&phase!=='title')) return;
  musicTimer-=dt; if(musicTimer>0) return; musicTimer=rand(2.0,3.6);
  const root=REALM_MUSIC[realmIndex(floor||1)]||196, scale=[0,2,3,5,7,10];
  const semi=scale[Math.floor(rand(0,scale.length))] + (rand(0,1)<0.45?12:0);
  padTone(root*Math.pow(2,semi/12), rand(2.4,3.8), 0.045);
  if(musicStep%4===0) padTone(root/2, 5, 0.03);   // slow bass drone
  musicStep++;
}

const WALL_SEG=1.5;   // structures are built from small breakable wall segments for systemic entry routes
const WALL_TIER=[
  {hp:0.5, col:'#6a5436', tex:'wood',  crackCol:'rgba(40,26,12,.85)', dust:[176,138,92]},   // 0 timber — smashes fast
  {hp:1.0, col:null,      tex:null,    crackCol:'rgba(30,22,16,.88)', dust:[200,170,130]},  // 1 stone — the default (wallCol/biome look)
  {hp:2.4, col:'#5a6472', tex:'brick', crackCol:'rgba(18,22,30,.92)', dust:[150,160,175]},  // 2 reinforced — slow to breach
];
function brkHp(t){ const m=(t!=null&&WALL_TIER[t])?WALL_TIER[t].hp:1; return Math.round((50+(floor||1)*5)*m); }
function hwall(x1,x2,y,solid,tier){ const A=Math.min(x1,x2),Z=Math.max(x1,x2),L=Z-A;
  if(solid){ walls.push({x:(A+Z)/2,y,w:Math.max(TW,L),h:TW}); return; }
  const n=Math.max(1,Math.round(L/WALL_SEG)),st=L/n,hp=brkHp(tier);
  for(let i=0;i<n;i++) walls.push({x:A+st*(i+0.5),y,w:st,h:TW,brk:true,hp,maxHp:hp,struct:true,tier}); }
function vwall(y1,y2,x,solid,tier){ const A=Math.min(y1,y2),Z=Math.max(y1,y2),L=Z-A;
  if(solid){ walls.push({x,y:(A+Z)/2,w:TW,h:Math.max(TW,L)}); return; }
  const n=Math.max(1,Math.round(L/WALL_SEG)),st=L/n,hp=brkHp(tier);
  for(let i=0;i<n;i++) walls.push({x,y:A+st*(i+0.5),w:TW,h:st,brk:true,hp,maxHp:hp,struct:true,tier}); }

// ----- NPCs: archetypes you meet roaming the floor -----
// Fragments of the Tower's lore, told by Scholars. Collect the story as you climb.
// ---- THE TWELVE ECHOES: the Tower's story, recovered orb by orb, remembered forever ----
const ECHOES=[
  'The Tower was not built. The first stone was found — and the finding woke it. It has grown a floor for every age of the world since.',
  'Each floor was a world once. A meadow. A jungle. An empire. The Tower does not destroy what it takes. It keeps.',
  'The people you pass came from every realm the Tower swallowed. Their roads still cross its floors. Their hamlets still light their lamps. Life insists.',
  'Every gatekeeper was a climber once. The Tower offers every conqueror a seat. Most accept a small one, and guard a stair forever.',
  'Aethon\u2019s line did not raise their palace to rule a floor. They raised it to stand upon the lid of something, and they do not speak of what.',
  'The waystones are the first climbers. They gave their bones to the road so that those who came after might travel it. Press your ear close — they still answer.',
  'One great house guarded the seventh stair: blade and spell, sworn as one. The Tower\u2019s Vow demanded a child, and the Sword Master\u2019s youngest son was born with both gifts at once: the very thing the Vow forbids. Rather than surrender the boy, the house broke in two. It has not healed.',
  'Four beings outgrew their floors — the Count, the Spirit, the Dragon, and the 魔族. They hold court below the Crown and wait, politely, for the seat to empty.',
  'The Warden is not a beast. It is the Tower\u2019s own hand, sent for climbers who linger like splinters in its skin.',
  'The Hall of Echoes is the Tower\u2019s memory. Everyone it has ever kept walks there, softly, wearing the hour of their best day.',
  'The first climber reached the Crown and refused the seat. The Tower has never forgiven her, nor forgotten — her echo walks the ninth floor still, looking up.',
  'The Crown is not a prize. It is a hunger wearing a chair\u2019s shape. Sit, and you feed the Tower for an age. Refuse — and it grows a sharper floor to break you.',
];
const EPIGRAPHS=[
  'Every climb begins as a meadow.',
  'The jungle remembers being a world.',
  'Imperia stands upon the lid of something.',
  'The horde sharpened itself on the sky-spear.',
  'The elves lend voices. The spirits keep everything else.',
  'The 魔物 lit fires to make the dark blink first.',
  'One vow. Two houses. No forgiveness.',
  'Four thrones-in-waiting, pretending patience.',
  'Walk softly. Everyone here is remembered.',
  'The seat is empty. It is always empty.',
];
const GATE_LORE=[
  'GATEKEEPER — a climber who took the first seat',
  'GATEKEEPER — the jungle\u2019s side of an old bargain',
  'GATEKEEPER — sworn warden of Aethon\u2019s lid',
  'GATEKEEPER — the Khan who stopped climbing',
  'GATEKEEPER — the grove\u2019s rooted sentence',
  'GATEKEEPER — a sovereign who chose the small throne',
  'GATEKEEPER — the living edge of the vow',
  'UPPER BEING — defeat or befriend',
  'GATEKEEPER — an echo with a name left',
  'THE LAST SEAT BUT ONE',
];
const LORE=[
  'Scholar: They say the Tower grew a floor for every age of the world.',
  'Scholar: The first climber never reached the Crown. Her echo still walks the ninth floor.',
  'Scholar: Aethon was not built to RULE the Tower. It was built to keep something below it.',
  'Scholar: The Two Families were one house, once. The vow split them.',
  'Scholar: Elves lend the spirits their voices. In return, the spirits lend everything else.',
  'Scholar: The Upper Beings have each waited an age for a floor of their own.',
  'Scholar: Every relic you carry hums louder the higher you climb. Listen.',
  'Scholar: 獸人族 sagas call the Tower a spear pinning the sky to the earth.',
  'Scholar: The memory orbs are the Tower thinking out loud. Touch one and it will think AT you.',
  'Scholar: The Warden is not sent to punish you. You are simply a splinter, and the Tower has hands.',
  'Scholar: Ask any gatekeeper what they were before. Watch the answer hurt them.',
  'Scholar: The Crown has been refused exactly once. The Tower built the tenth floor that same night.',
  'Scholar: Win, and you will be offered a chair. Read the fine print. There is no fine print. That IS the warning.',
  'Scholar: Twelve echoes, scattered where the Tower dreams. Collect them and you will know it better than it knows itself.',
  'Scholar: The 魔物 were not born monsters. The Tower remembers what they were.',
  'Scholar: Gather the lore pieces. The top only makes sense to those who did.',
];
const CIV_AS={ villager:'wanderer', peasant:'farmer', noble:'merchant', beggar:'hermit', pilgrim:'monk', laborer:'miner', urchin:'child', pedlar:'caravaneer', shepherd:'farmer', climber:'wanderer',
  crier:'storyteller', drunkard:'tavernkeep', busker:'bard', seer:'enchanter', lamplighter:'watchman', gravedigger:'miner', fishmonger:'fisher', herbalist:'monk', taxman:'noble', dancer:'bard', acolyte:'monk', ratcatcher:'hermit', errant:'guard', washer:'peasant' };
const TRAIT_FORCE={ crier:'brave', drunkard:'merry', busker:'merry', seer:'devout', lamplighter:'gruff', gravedigger:'weary', fishmonger:'gruff', herbalist:'devout', taxman:'greedy', dancer:'merry', acolyte:'devout', ratcatcher:'gruff', errant:'brave', washer:'weary',
  guard:'brave', watchman:'brave', priest:'devout', monk:'devout', pilgrim:'devout', child:'curious', urchin:'curious', beggar:'greedy', gambler:'greedy', hermit:'weary', scholar:'curious', bard:'merry', tavernkeep:'merry', noble:'greedy' };
const WORK_TYPE={ busker:'busker', fishmonger:'fishmonger', herbalist:'herbalist' };
const PLAIN_FOLK={ villager:1, peasant:1, laborer:1, wanderer:1, urchin:1, washer:1, climber:1, shepherd:1, drunkard:1, ratcatcher:1 };
const WATCH_TYPES={ guard:1, watchman:1, errant:1, magistrate:1, ranger:1 };
const CULT_TYPES={ priest:1, monk:1, pilgrim:1, acolyte:1, seer:1, pilgrimkeeper:1 };
const WAR_RIVALS={ sword:['magic'], magic:['sword'], watch:['outlaw'], outlaw:['watch'], raider:['caravan'], caravan:['raider'] };   // symmetric; deliberately NO player/town token
const CLOTH_TONES=[[122,96,70],[94,108,82],[86,100,126],[138,106,84],[108,90,110],[150,128,84],[98,116,112],[142,114,94],[120,72,66],[80,92,110]];
function pickCloth(x,y){ return CLOTH_TONES[(Math.abs(Math.round(x*7+y*13)))%CLOTH_TONES.length].slice(); }
const KID_TONES=[[200,84,72],[78,128,170],[96,160,96],[210,168,72],[170,96,160],[200,120,72]];
function pickKid(x,y){ return KID_TONES[(Math.abs(Math.round(x*9+y*17)))%KID_TONES.length].slice(); }
const CIV_LINES={
  villager:['Another climber! We get three a season. Most go down in buckets.','Fine weather for the floor, if it holds.','The roads are safer than the wilds. Usually.'],
  peasant:['The fields don\u2019t plow themselves, hero.','We pay the wardens in grain. They pay us in not-burning-things.','You\u2019d think a tower had no farms. You\u2019d starve thinking that.'],
  noble:['Mind the mud on your... everything, peasant. Oh — a CLIMBER. Do carry on.','I own three homesteads on this floor. The beasts own the rest.','Coin opens more doors than steel. But do keep the steel.'],
  beggar:['Spare a coin? The well took my last one and gave back a wish I didn\u2019t want.','I climbed once. Floor two. Never again.','Even the Tower\u2019s rats have it better than me, friend.'],
  pilgrim:['I walk to the stair shrine on every floor. The Tower listens to walkers.','Blessings on your blade, climber.','The waystones hum hymns, if you press your ear close.'],
  laborer:['These roads? Laid them myself. Mind the potholes.','Work\u2019s steady when the monsters keep breaking the walls.','A coin a brick. A climber a week. The Tower provides.'],
  urchin:['Saw the gatekeeper once! It\u2019s HUGE. You\u2019re gonna die!','Race you to the well! ...Maybe not in that armour.','Psst — the tavernkeep waters the ale. Everyone knows.'],
  shepherd:['Mind the flock. They\u2019re slow, but they\u2019re mine.','Raised these slimes from puddles, I did.','A shepherd\u2019s life: walk, whistle, worry.'],
};
const NPC_KINDS={
  pedlar:  { name:'a Pedlar',    color:[220,190,140] },
  shepherd:{ name:'a Shepherd',  color:[200,210,180] },
  climber: { name:'a Fellow Climber', color:[180,200,230] },
  villager:{ name:'a Villager',  color:[200,200,210] },
  peasant: { name:'a Peasant',   color:[190,180,150] },
  noble:   { name:'a Noble',     color:[230,200,120] },
  beggar:  { name:'a Beggar',    color:[150,145,140] },
  pilgrim: { name:'a Pilgrim',   color:[220,220,240] },
  laborer: { name:'a Labourer',  color:[180,150,120] },
  urchin:  { name:'an Urchin',   color:[210,190,160] },
  guard:  { name:'the Guard',     color:[160,170,200], lines:["Guard: The gatekeeper lairs east. Past the wilds. Don't die.","Guard: Inside these walls you're safe. Out there is yours to handle.","Guard: I guard. You climb. Fair split of labor."] },
  scholar:{ name:'the Scholar',   color:[200,180,255] },
  cook:   { name:'the Cook',      color:[240,170,120] },
  gambler:{ name:'the Gambler',   color:[220,140,200] },
  bard:   { name:'the Bard',      color:[150,220,220] },
  monk:   { name:'the Monk',      color:[180,200,160] },
  child:  { name:'a Child',       color:[255,210,170], lines:["Child: Are you the hero? You look squishy.","Child: I saw the gatekeeper once. I cried. It's THAT big.","Child: Race you to the fountain! ...okay you win."] },
  innkeep:{ name:'the Innkeeper', color:[230,190,140] },
  enchanter:{ name:'the Enchanter', color:[190,150,255] },
  fisher:   { name:'the Fisherman', color:[140,190,220] },
  arenamaster:{ name:'the Arena Master', color:[230,150,90] },
  watchman: { name:'the Watchman',  color:[170,180,210] },
  priest:   { name:'the Priest',    color:[235,225,200] },
  storyteller:{ name:'the Storyteller', color:[210,180,150] },
  caravaneer:{ name:'the Caravaneer', color:[220,190,110] },
  courier:  { name:'the Courier',   color:[150,220,180] },
  miner:    { name:'the Miner',     color:[180,160,140] },
  tavernkeep:{ name:'the Tavernkeeper', color:[225,170,110] },
  hermit:   { name:'the Hermit',    color:[160,170,160], lines:["Hermit: I keep to the wilds. Fewer fools out here.","Hermit: The Tower whispers to those who listen alone.","Hermit: Bring me echoes of the fallen and I’ll share what they knew."] },
  crier:    { name:'the Town Crier', color:[235,205,120], lines:["Crier: Hear ye! A climber walks among us!","Crier: By order of the Watch \u2014 the east stair stays sealed till the gatekeeper falls!","Crier: Lost: one mule, last seen fleeing a slime. Reward offered!"] },
  drunkard: { name:'a Drunkard',    color:[205,165,120], lines:["Drunkard: I’sh not drunk, the *floor’s* tilted.","Drunkard: I fought the gatekeeper once. Lost. Bought it a drink.","Drunkard: One more ale and I’ll climb the whole Tower meself."] },
  busker:   { name:'a Busker',      color:[150,225,210] },
  seer:     { name:'the Fortune Teller', color:[205,140,235], lines:["Seer: I see\u2026 stairs. So many stairs in your future.","Seer: A great fall awaits \u2014 or a great climb. The cards are smudged.","Seer: Cross my palm with coin and I’ll lie to you beautifully."] },
  lamplighter:{ name:'the Lamplighter', color:[185,180,150] },
  gravedigger:{ name:'the Gravedigger', color:[150,150,140], lines:["Gravedigger: Dug three graves for climbers this week. Plenty of room left.","Gravedigger: You'll want a plot? Best reserve early.","Gravedigger: The dead don't climb. Lucky them."] },
  fishmonger:{ name:'the Fishmonger', color:[140,190,212], lines:["Fishmonger: Fresh from the Tower\u2019s cisterns. Don\u2019t ask what swims there.","Fishmonger: Scales and tales, climber \u2014 both cheap today.","Fishmonger: A fish a floor keeps the wraiths away. Probably."] },
  herbalist:{ name:'the Herbalist',  color:[170,210,150], lines:["Herbalist: Moonpetal for wounds, ashroot for nerve. Both grow up here, oddly.","Herbalist: Chew this before the next floor. Trust me.","Herbalist: The wilds poison and cure in equal measure."] },
  taxman:   { name:'the Tax Collector', color:[210,190,110], lines:["Tax Collector: Climbing income IS taxable, you know.","Tax Collector: The Crown takes its tithe, even of glory.","Tax Collector: Coin, coin, where is the Crown's coin?"] },
  dancer:   { name:'a Dancer',      color:[242,160,200] },
  acolyte:  { name:'an Acolyte',    color:[228,228,208], lines:["Acolyte: Light guide your blade, climber.","Acolyte: We keep the shrine lit for those who fall.","Acolyte: Kneel a moment. The floor above is unkind."] },
  ratcatcher:{ name:'the Rat-catcher', color:[172,162,142], lines:["Rat-catcher: Tower's crawling with vermin. Job security.","Rat-catcher: Bigger the floor, bigger the rats.","Rat-catcher: Mind your boots."] },
  errant:   { name:'a Knight-Errant', color:[182,192,218], lines:["Knight-Errant: I too sought the Crown. My squire didn't make it.","Knight-Errant: Keep your guard high on the seventh floor.","Knight-Errant: Honour above the climb. Always."] },
  washer:   { name:'a Washerwoman', color:[196,190,202], lines:["Washerwoman: Blood doesn't come out of mail. I've tried.","Washerwoman: You climbers are hard on good linen.","Washerwoman: Mind you don't track wilds-mud through my square."] },
  farmer: { name:'the Farmer',    color:[200,210,140], lines:["Farmer: Crops grow strange this high up. Taste fine though.","Farmer: Help yourself to a row — folk pay me in monster ears anyway.","Farmer: Beasts trample the fields some nights. The walls don't reach out here."] },
  quartermaster:{ name:'the Quartermaster', color:[212,182,120], lines:["Quartermaster: Your Climber's Cache is good as gold here — at a small spread.","Quartermaster: Bank a little now, draw it down when the climb turns sour."] },
  bountymaster:{ name:'the Bounty Master', color:[205,120,92], lines:["Bounty Master: There's a name on my board worth chasing across floors.","Bounty Master: Kill it once and it sends back something nastier. Good coin, though."] },
  magistrate:{ name:'the Magistrate', color:[186,156,214], lines:["Magistrate: The Watch answers to me. A fine settles most sins.","Magistrate: Coin buys a writ — twenty seconds of looking the other way."] },
  ranger:{ name:'the Ranger Captain', color:[150,184,142], lines:["Ranger Captain: The wilds need thinning. Take a cull-bounty.","Ranger Captain: Bank your coin with us — safer than your pockets out here."] },
  pilgrimkeeper:{ name:'the Wayshrine Keeper', color:[224,224,206], lines:["Keeper: Kneel, climber. The shrine remembers those who fall.","Keeper: A life given back is a life owed to the climb."] },
  mythic:{ name:'the Mythic Dealer', color:[176,120,224], lines:["Mythic Dealer: I deal in doors others cannot open.","Mythic Dealer: A pass to the black market? Everything has its price.","Mythic Dealer: Secrets, passes, names worth killing — coin opens them all."] },
  fixer:{ name:'the Fixer', color:[210,170,90], lines:["Fixer: I sell exits, not miracles.","Fixer: A locked stair is just a price wearing a uniform.","Fixer: Keep your blade sheathed and your purse open."] },
  informant:{ name:'the Informant', color:[145,210,220], lines:["Informant: Walk me to a waystone and I can open the stair.","Informant: I know which seal they forgot to change. I just need out.","Informant: No heroics. Get me to a waystone."] },
};
const SPRITE_ALIAS={ quartermaster:'caravaneer', bountymaster:'guard', magistrate:'enchanter', ranger:'courier', pilgrimkeeper:'monk', mythic:'enchanter', fixer:'gambler', informant:'courier' };
function makeNPC(type,x,y){
  const n={ type, x, y, r:.5, line:-1, used:false };
  if(CIV_AS[type]){ n.spriteAs=CIV_AS[type]; n.civ=true; }
  const kind=NPC_KINDS[type];
  if(kind){ n.name=kind.name; n.color=kind.color.slice();
    if(SPRITE_ALIAS[type]) n.spriteAs=SPRITE_ALIAS[type];
    if(PLAIN_FOLK[type]) n.color=pickCloth(x,y);
    if(type==='child'||type==='urchin') n.color=pickKid(x,y);
    if(type==='scholar'){ const l=shuffle(LORE.slice()).slice(0,3); n.lines=l; }
    else if(kind.lines){ n.lines=kind.lines.slice(); if(['crier','seer','gravedigger','herbalist','acolyte','ratcatcher','errant','washer','drunkard','taxman'].includes(type)) n.barkLines=kind.lines.map(l=>l.replace(/^[^:]+:\s*/,'')); }
    if(TRAIT_FORCE[type]) n.traitForce=TRAIT_FORCE[type];
    if(WORK_TYPE[type]) n.workFx=WORK_TYPE[type];
    // some locals carry work for a willing climber
    if(['guard','scholar','farmer','herbalist','errant'].includes(type) && rand(0,1)<0.45) n.giver=true;
    if(['guard','farmer','child','bard','courier','storyteller','hermit','wanderer','crier','drunkard','lamplighter','dancer','ratcatcher','errant','busker','acolyte','washer','seer'].includes(type)) n.roam=true;   // these folk stroll about
    return n;
  }
  if(type==='sage'){ n.name='the Sage'; n.color=[120,170,235];
    n.lines = (realm&&realm.sageLines) ? realm.sageLines.slice() : [
      'Sage: Welcome to '+realm.name+', floor '+floor+' of the Tower.',
      'Sage: A gatekeeper guards the stair to the east. Only its fall opens the way.',
      'Sage: Spend coins with the Merchant and Smith. The Healer mends for free — once.' ]; }
  else if(type==='merchant'){ n.name='the Merchant'; n.color=[230,200,90]; }
  else if(type==='healer'){ n.name='the Healer'; n.color=[120,220,140]; }
  else if(type==='smith'){ n.name='the Smith'; n.color=[210,135,85]; }
  else if(type==='quester'){ n.name='the Herald'; n.color=[255,185,80]; }
  else { n.type='wanderer'; n.name='a Local'; n.color=pickCloth(x,y);
    if(rand(0,1)<0.35) n.giver=true;
    n.roam=true;
    n.lines = (realm&&realm.folkLines) ? realm.folkLines.slice() : [
      'Wanderer: I have climbed and fallen a hundred times. Yet here I am.',
      'Wanderer: The deeper realms twist the eye. Trust your blade, not the walls.',
      'Wanderer: Some say the top floor holds no enemy at all. Only a door.' ]; }
  return n;
}

function hireMerc(n, kind){
  if(mobs.some(m=>m.merc)){ dialogue='Tavernkeep: Your hire\u2019s still out there earning the coin.'; return; }
  const cost = kind==='blade'?35:45;
  if(coinCount<cost){ dialogue='Tavernkeep: '+cost+' coins. Good help isn\u2019t cheap.'; return; }
  coinCount-=cost;
  const sp = kind==='blade'?'swordsman': kind==='bow'?'echoarcher':'seraphling';
  const m=MOB(sp, n.x+1.2, n.y+0.6); m.friendly=true; m.merc=true; m.mercKind=kind; m.peaceful=false; m.provoked=false;
  m.hp=m.maxHp= kind==='cleric'? 50+floor*12 : 60+floor*18;
  m.mDmg= kind==='bow'? 8+floor*3 : 10+floor*4;
  m.speed=5.2; m.sight=0; m.touch=0; m.xp=0; m.drop=0; m.elite=null; m.orbit=null; m.faction=null; m.smart=false;
  sfx('coin');
  dialogue= kind==='blade' ? 'Tavernkeep: Borin\u2019s yours till the stair. Keep him out of the ale.'
          : kind==='bow' ? 'Tavernkeep: Wren shoots first and never asks twice. Till the stair.'
          : 'Tavernkeep: Sister Lys will keep you breathing. Till the stair.';
}
function openChoices(n, prompt, opts){ choiceNpc=n; choiceOpts=opts; dialogue=prompt; }
// ===== v199 LIVING CONVERSATIONS — the social hub =====
function dirTo(x,y){ const dx=x-player.x, dy=y-player.y; return (Math.abs(dx)>Math.abs(dy))?(dx>0?'east':'west'):(dy>0?'south':'north'); }
function nearIncident(){ let best=null,bd=1e9; for(const e of incidents){ if(e.done) continue; const d=len(e.x-player.x,e.y-player.y); if(d<bd){bd=d;best=e;} } return (best&&bd<40)?best:null; }
function openSocial(n){
  if(!npcs.includes(n)){ dialogue=''; return; }                       // converted/despawned -> never re-enter
  if(n.cowed){ dialogue=n.name.replace(/^the |^a |^an /,'')+': I have nothing more to say.'; return; }   // v199-fix: a cowed/shaken soul won't parley
  const disp=n.name.replace(/^the |^a |^an /,'');
  const fac=npcFaction(n), al=(fac==='watch'||fac==='cult')?fac:null;
  const peaceful=!!realm.special;
  const isHouse=(n.house==='sword'||n.house==='magic') && n.type!=='househead';
  const MIGHT=player.level*2+Math.floor(player.ad/12)+Math.min(20,kills/8)+(wantedT>0?6:0);
  const opts=[];
  opts.push({label:'Ask for news', f(){ socAsk(n,disp); }});
  if(!n.socBribe && WATCH_TYPES[n.type] && (wantedT>0 || (player.rep&&player.rep.watch<0))){ const c=Math.min(40,14+floor*2); opts.push({label:'Slip a bribe \u2014 '+c+'c', f(){ socBribe(n,disp,'watch',c); }}); }
  else if(!n.socBribe && isHouse && player.houseStand && (player.houseStand[n.house]||0)<0){ const c=Math.min(45,10+floor*3); opts.push({label:'Make amends \u2014 '+c+'c', f(){ socBribe(n,disp,'house',c); }}); }
  else if(!n.socPersuade && al && player.rep && (player.rep[al]||0)>=1){ opts.push({label:'Call in a favour ('+al+')', f(){ socPersuade(n,disp,al); }}); }
  else if(!n.socPersuade && isHouse && realm.special!=='families' && player.houseStand && (player.houseStand[n.house]||0)>=SALUTE_T){ opts.push({label:'Press your standing', f(){ socPersuade(n,disp,null); }}); }
  if(!n.headHouse && !n.grateful && !n.socIntim && (!peaceful || wantedT>0)){
    const tr=n.trait, hard=(tr==='brave'||tr==='devout'||tr==='gruff')?12:0;
    const fighter=npcFighter(n), watch=(al==='watch');
    const resist=(watch?floor*3+40:fighter?floor*3+25:floor*1.5)+hard;
    if(MIGHT>=resist){
      if(fighter||watch) opts.push({label:'Lean on them (back off)', f(){ socIntimidate(n,disp,al,fighter,watch); }});
      else if(extortsThisFloor<2) opts.push({label:'Shake them down', f(){ socIntimidate(n,disp,al,fighter,watch); }});
    }
  }
  if(SERVICE_NPC[n.type]) opts.push({label:'Trade / services', f(){ n._social=false; if(choiceNpc) choiceNpc._social=false; n._svc=true; interactNPC(n); }});
  addRequestOption(n,disp,opts);
  opts.push({label:'Leave', f(){ dialogue=disp+': '+pick(['Climb safe.','Mind the stairs.','The Tower waits.']); }});
  n._social=true; openChoices(n, disp+': '+pick(['What is it, climber?','Speak.','You want something?'])+'  ('+coinCount+'c)', opts.slice(0,6));
}
function socAsk(n,disp){ const e=nearIncident(); const poi=poiList.filter(q=>!q.found)[0];
  if(e){ dialogue=disp+': Trouble to the '+dirTo(e.x,e.y)+' \u2014 '+({feud:'the Two Houses are at each other\u2019s throats',crackdown:'the Watch has cornered someone',ambush:'raiders fell on a caravan'}[e.kind]||'blood in the streets')+'.'; }
  else if(poi){ dialogue=disp+': Folk whisper of '+poi.name+', off to the '+dirTo(poi.x,poi.y)+'.'; }
  else dialogue=disp+': '+pick(n.barkLines||CIV_LINES[n.type]||(TRAITS[n.trait]||TRAITS.gruff).barks||['Quiet floor today.']);
  if(!askedThisFloor){ askedThisFloor=true; gainXP(1); }
  openSocial(n); }
function socBribe(n,disp,kind,cost){
  if(coinCount<cost){ dialogue=disp+': That\u2019s not enough to look away.'; openSocial(n); return; }
  coinCount-=cost; n.socBribe=true; sfx('coin');
  if(kind==='watch'){ wantedT=0; calmWardens(); if(player.rep) player.rep.watch=Math.min(SALUTE_T,(player.rep.watch||0)+1); dialogue=disp+': \u2026I saw nothing. Move along.'; }
  else { player.houseStand[n.house]=Math.min(0,(player.houseStand[n.house]||0)+2); dialogue=disp+': The slate is\u2026 cleaner.'; }
  openSocial(n); }
function socPersuade(n,disp,al){ n.socPersuade=true; sfx('level');
  if(al==='watch'){ player.writT=Math.max(player.writT||0,8); dialogue=disp+': Go on through \u2014 quick now.'; }
  else if(al==='cult'){ player.regenT=Math.max(player.regenT||0,10); dialogue=disp+': A small blessing for the road.'; }
  else { if(player.house===n.house||player.house==='vael') gainFavor(1); dialogue=disp+': The House remembers its friends.'; }
  openSocial(n); }
function socIntimidate(n,disp,al,fighter,watch){ n.socIntim=true;
  if(fighter||watch){ n.cowed=true; if(watch && wantedT>0) wantedT=Math.max(0,wantedT-4); sfx('boss'); dialogue=disp+': \u2026fine. No trouble here.'; }
  else { const g=Math.min(8,3+Math.floor(floor/2)); coinCount+=g; extortsThisFloor++; n.mind='flee'; n.mindT=2.5; n.scaredT=3; sfx('coin'); if((n.emoteT||0)<=0){n.emote='!';n.emoteT=1.3;} dialogue=disp+': T-take it, just leave me be! (+'+g+'c)'; }
}
// ===== THE BLACK MARKET — a hooded merchant; coins finally have a sink =====
function waresPrice(key,kind){ if(kind==='trinket'){ const r=TRINKET_DEFS_MAP[key].rarity; return Math.round(({common:45,uncommon:65,rare:90}[r]||60)*(1+floor*0.10)); }
  const base={draught:14,swift:16,frost:16,warding:18,greater:30,ember:24,aether:26}[key]||20; return Math.round(base+floor*3); }
function seedShopStock(kind){ let h=(floor*2654435761+((typeof ngPlus!=='undefined'?ngPlus:0)|0)*40503+(kind==='trinketer'?2246822519:1013904223))>>>0; h^=h>>>15; h=Math.imul(h,2246822519)>>>0; h^=h>>>13;
  const tierFor=floor>=6?2:floor>=3?1:0, out=[], seen={};
  const push=(key,knd)=>{ if(!key || (knd==='kit'&&key==='skeleton') || seen[key]) return; seen[key]=1; out.push({key,price:waresPrice(key,knd==='trinket'?'trinket':'kit'),kind:knd}); };
  push('draught','kit');
  for(let i=0;i<6 && out.length<3;i++){ const t=(h>>>(i*4))&3; push(rollKitDrop(t<=tierFor?t:tierFor),'kit'); }
  if(kind==='trinketer' && floor>=3 && ((h>>>24)&0xff)<179){ const rar=floor>=7?'rare':floor>=4?'uncommon':'common', pool=TRINKET_DEFS.filter(d=>d.rarity===rar); if(pool.length){ const D=pool[((h>>>16)&0xffff)%pool.length]; out.push({key:D.key,price:waresPrice(D.key,'trinket'),kind:'trinket'}); } }
  if(kind==='trinketer' && floor>=2 && ((h>>>8)&0xff)<140){ const cnt={}; for(const it of (player.items||[])) if(it.key) cnt[it.key]=(cnt[it.key]||0)+1; const avail=RELICS.filter(R=> R.stack?((cnt[R.key]||0)<3):!cnt[R.key]); if(avail.length){ const R=avail[((h>>>20)&0xffff)%avail.length]; out.push({key:R.key,price:Math.round(70+floor*8),kind:'relic'}); } }
  for(let i=0;i<out.length;i++) out[i].sold=!!shopSold[floor+'|'+kind+'|'+i];
  shopStock[kind]=out; return out; }
function openShopWares(n,kind){ if(!shopStock[kind]) seedShopStock(kind); const st=shopStock[kind];
  const title=(kind==='trinketer'?'Trinketer\u2019s curios':'Apothecary wares')+' \u2014 you carry '+coinCount+'c';
  const opts=st.map((e,idx)=>({ label: e.sold?'\u2014 SOLD \u2014':((e.kind==='relic'?('✦ '+RELIC_MAP[e.key].n):e.kind==='trinket'?TRINKET_DEFS_MAP[e.key].n:KIT_DEFS_MAP[e.key].n)+'  '+e.price+'c'),
    f(){ const live=shopStock[kind]; if(!live||live[idx]!==e) return;
      if(e.sold) return;
      if(coinCount<e.price){ dialogue=e.price+' coins, climber.'; sfx('hurt'); openShopWares(n,kind); return; }
      if(e.kind==='kit'){ if(!kitAdd(e.key,1)){ showToast('Your Satchel is full.'); sfx('hurt'); openShopWares(n,kind); return; } }
      else if(e.kind==='relic'){ const R=RELIC_MAP[e.key]; const cnt={}; for(const it of player.items) if(it.key) cnt[it.key]=(cnt[it.key]||0)+1; const can=R.stack?((cnt[e.key]||0)<3):!cnt[e.key]; if(!can){ showToast('You already carry that relic.'); sfx('hurt'); openShopWares(n,kind); return; } player.items.push({key:R.key,n:R.n,e:R.e}); recomputeRelics(); showToast('✦ '+R.n+' — '+R.e); }
      else { const msg=grantTrinket(e.key); if(msg===false){ showToast('Your trinket slots are full.'); sfx('hurt'); openShopWares(n,kind); return; } showToast(msg); }
      coinCount-=e.price; e.sold=true; shopSold[floor+'|'+kind+'|'+idx]=true; sfx('coin'); saveRun(); openShopWares(n,kind); } }));
  opts.push({ label:'Back', f(){} });
  openChoices(n, title, opts); }
function openMarket(p){
  const F=floor, cursed=(player.pactVuln||1)>1.01, priceRelic=65+F*10, priceMend=25+F*3+(cursed?Math.ceil(40*((player.pactVuln||1)-1)):0), priceLife=80+F*5;
  const lack=(c)=>{ showToast('Not enough coin ('+coinCount+'/'+c+').'); sfx('hurt'); openMarket(p); };
  openChoices(p, '⚖ BLACK MARKET — you carry '+coinCount+' coin. What’ll it be?', [
    { label:'Buy a relic  ('+priceRelic+'c)', f(){ if(coinCount>=priceRelic){ coinCount-=priceRelic; sfx('coin'); showToast('Bought: '+grantRelic(false)); openMarket(p); } else lack(priceRelic); } },
    { label:(cursed?'Cleanse curses & full heal':'Full heal')+'  ('+priceMend+'c)', f(){ if(coinCount>=priceMend){ coinCount-=priceMend; player.hp=player.maxHp; player.pactVuln=1; sfx('level'); burst(player.x,player.y,[120,255,160],16,3); showToast(cursed?'Curses cleansed, wounds mended.':'Wounds mended.'); openMarket(p); } else lack(priceMend); } },
    { label:'Bind a life — +1 max life  ('+priceLife+'c)', f(){ if(coinCount>=priceLife){ coinCount-=priceLife; player.maxLives=(player.maxLives||3)+1; player.lives=(player.lives||3)+1; sfx('level'); addShake(.2); burst(player.x,player.y,[255,120,140],18,3); showToast('A life bound to you ('+player.lives+').'); openMarket(p); } else lack(priceLife); } },
    { label:'Leave', f(){ dialogue='“Coin always finds its way back to me.”'; } },
  ]);
}
// ===== THE BLACKSMITH — spend coin to permanently upgrade your gear (re-opening menu; tiers persist via save) =====
function openForge(n){
  player.forge=player.forge||{wpn:0,arm:0,edge:0};
  const F=player.forge, fl=floor, CAPW=5, CAPA=5, CAPE=4;
  const cw=30+F.wpn*28+fl*4, ca=30+F.arm*26+fl*4, ce=42+F.edge*34+fl*5;
  const lack=(c)=>{ showToast('Not enough coin ('+coinCount+'/'+c+').'); sfx('hurt'); openForge(n); };
  openChoices(n, '✦ THE BLACKSMITH — you carry '+coinCount+' coin. What shall I forge?', [
    { label: F.wpn>=CAPW ? '◆ Weapon — fully forged' : '◆ Sharpen Weapon  +4 dmg   ('+cw+'c)   ['+F.wpn+'/'+CAPW+']',
      f(){ if(F.wpn>=CAPW){ openForge(n); return; } if(coinCount>=cw){ coinCount-=cw; F.wpn++; player.ad+=4; sfx('level'); burst(player.x,player.y,[255,180,90],16,3.2); showToast('The smith sharpens your weapon. (+4 dmg)'); openForge(n); } else lack(cw); } },
    { label: F.arm>=CAPA ? '✚ Armour — fully reinforced' : '✚ Reinforce Armour  +18 max HP   ('+ca+'c)   ['+F.arm+'/'+CAPA+']',
      f(){ if(F.arm>=CAPA){ openForge(n); return; } if(coinCount>=ca){ coinCount-=ca; F.arm++; player.maxHp+=18; player.hp=Math.min(player.maxHp,player.hp+18); sfx('level'); burst(player.x,player.y,[150,200,255],16,3.2); showToast('Armour reinforced. (+18 max HP)'); openForge(n); } else lack(ca); } },
    { label: F.edge>=CAPE ? '✦ Edge — honed to perfection' : '✦ Hone Edge  +4% crit, +0.1 crit dmg   ('+ce+'c)   ['+F.edge+'/'+CAPE+']',
      f(){ if(F.edge>=CAPE){ openForge(n); return; } if(coinCount>=ce){ coinCount-=ce; F.edge++; player.critC=Math.min(.6,player.critC+0.04); player.critM+=0.1; sfx('level'); burst(player.x,player.y,[255,230,140],16,3.2); showToast('Your edge is honed. (+crit)'); openForge(n); } else lack(ce); } },
    { label:'Leave', f(){ dialogue='Smith: Come back when your purse is heavier.'; } },
  ]);
}
// ===== THE MYTHIC DEALER — a lone broker of black-market passes & floor secrets =====
function openMythic(n){
  const F=floor, mk=props.find(function(p){return p.kind==='market';});
  const passC=120+F*15, revealC=40+F*5, secretC=30+F*4;
  const lack=function(c){ showToast('Not enough coin ('+coinCount+'/'+c+').'); sfx('hurt'); openMythic(n); };
  const opts=[];
  opts.push({ label:'◆ Buy a Black Market pass   ('+passC+'c)', f:function(){ if(coinCount>=passC){ coinCount-=passC; player.bmTickets=(player.bmTickets||0)+1; sfx('level'); burst(player.x,player.y,[200,140,255],16,3.2); showToast('A black pass slips into your hand. (passes: '+player.bmTickets+')'); openMythic(n); } else lack(passC); } });
  if(mk && !mk.revealed) opts.push({ label:'Where is the black market?   ('+revealC+'c)', f:function(){ if(coinCount>=revealC){ coinCount-=revealC; mk.revealed=true; pings.push({x:mk.x,y:mk.y,col:'#c060ff',life:9999}); sfx('coin'); showToast('The den is marked on your map.'); openMythic(n); } else lack(revealC); } });
  else if(mk && mk.revealed) opts.push({ label:'The black market — already marked', f:function(){ dialogue='Mythic Dealer: You know the way. A pass is all you lack.'; } });
  else opts.push({ label:'Where is the black market?   (no den here)', f:function(){ dialogue='Mythic Dealer: No den breathes on this floor. Climb on.'; } });
  opts.push({ label:'Sell me a secret   ('+secretC+'c)', f:function(){ if(coinCount<secretC){ lack(secretC); return; } const un=poiList.filter(function(q){return !q.found;});
      if(exit && !exit.found){ coinCount-=secretC; exit.found=true; pings.push({x:exit.x,y:exit.y,col:'#7dff8a',life:9999}); sfx('level'); dialogue='Mythic Dealer: The stair lies bared. Mind what guards it.'; openMythic(n); }
      else if(un.length){ coinCount-=secretC; const q=pick(un); q.found=true; pings.push({x:q.x,y:q.y,col:'#c9a0ff',life:9999}); sfx('level'); dialogue='Mythic Dealer: '+q.name+' — now you know.'; openMythic(n); }
      else dialogue='Mythic Dealer: You have seen all this floor hides.'; } });
  opts.push({ label:'Leave', f:function(){ dialogue='Mythic Dealer: Coin opens every door, climber.'; } });
  openChoices(n, '☾ THE MYTHIC DEALER — passes & secrets   ('+coinCount+'c · passes: '+(player.bmTickets||0)+')', opts);
}
// ===== NEWS STANDS — floor intel, mission leads, and black-market rumours =====
function openNewsStand(p){
  const bump=(p.reads||0)*2;
  const cLocal=4+floor+bump, cBoss=10+floor*2+bump, cOp=8+floor*2+bump, cBlack=18+floor*3+bump;
  const spend=function(c){ if(coinCount<c){ showToast('Not enough coin ('+coinCount+'/'+c+').'); sfx('hurt'); openNewsStand(p); return false; } coinCount-=c; p.reads=(p.reads||0)+1; sfx('coin'); return true; };
  const mark=function(x,y,col,msg){ if(pings) pings.push({x,y,col:col||'#9fd6ff',life:9999}); waypoint={x,y}; dialogue=msg; };
  const unseen=function(){ const u=poiList.filter(function(q){return !q.found;});
    if(!u.length) return null; u.sort(function(a,b){ return len(a.x-player.x,a.y-player.y)-len(b.x-player.x,b.y-player.y); }); return u[0]; };
  const opts=[
    { label:'Local bulletin — '+cLocal+'c', f:function(){ if(!spend(cLocal)) return; const q=unseen();
        if(q){ q.found=true; mark(q.x,q.y,'#9fd6ff','News Stand: '+q.name+' is marked on your map.'); }
        else if(exit){ exit.found=true; mark(exit.x,exit.y,'#7dff8a','News Stand: No fresh gossip. The stair is marked instead.'); }
        else dialogue='News Stand: Quiet floor. Too quiet.'; } },
    { label:'Boss-room report — '+cBoss+'c', f:function(){ if(!spend(cBoss)) return;
        if(boss && boss.hp>0) mark(boss.x,boss.y,'#ffd34d','News Stand: The gatekeeper arena is marked. Bring courage.');
        else if(championsList && championsList.length){ const c=championsList.find(function(x){return !x.resolved && x.hp>0;})||championsList[0]; mark(c.x,c.y,'#ffd34d','News Stand: One of the Upper Beings is marked. Mind the ego.'); }
        else if(exit){ exit.found=true; mark(exit.x,exit.y,'#7dff8a','News Stand: The stair is marked.'); }
        else dialogue='News Stand: No boss report today.'; } },
    { label:'District dossier — '+cOp+'c', f:function(){ if(!spend(cOp)) return;
        if(operation && !operation.done){ mark(operation.x,operation.y,'#6ee0ff','News Stand: '+operation.target+'. Dossier pinned.'); }
        else if(operation && operation.done){ dialogue='News Stand: This district is already handled. The stair should be open.'; }
        else dialogue='News Stand: This floor has politics too large for paper.'; } },
    { label:'Black-market whisper — '+cBlack+'c', f:function(){ if(!spend(cBlack)) return; const mk=props.find(function(q){return q.kind==='market';});
        if(mk){ mk.revealed=true; mark(mk.x,mk.y,'#c060ff','News Stand: The hidden market is marked. You still need a pass.'); }
        else dialogue='News Stand: No den is open on this floor. Ask the Mythic Dealer another day.'; } },
    { label:'Leave', f:function(){ dialogue='News Stand: Fresh ink tomorrow. Fresh danger today.'; } },
  ];
  openChoices(p, 'NEWS STAND — rumours, routes, and dangerous little truths. ('+coinCount+'c)', opts);
}
// ===== TRIAL OBELISK — a player-summoned arena of escalating waves for a guaranteed relic =====
let obeliskTrial=null;
function obeliskNextWave(){
  const T=obeliskTrial; T.wave++; T.waveT=0;
  const n=Math.min(14, 3+T.wave*2+Math.floor(floor/2));
  T.foes=[];
  for(let i=0;i<n;i++){ const a=i/n*6.28+rand(0,0.6), d=5+rand(0,3.5), sp=offRoad(player.x+Math.cos(a)*d, player.y+Math.sin(a)*d);
    const m=MOB(pick(realm.pool||['slime']), sp[0], sp[1]); if(m){ m.provoked=true; m.trial=true; if(T.wave>=2 && rand(0,1)<0.30) makeElite(m); T.foes.push(m); } }
  pings.push({x:player.x,y:player.y,col:'#ffd34d',life:50});
  showToast('⟁ Trial Wave '+T.wave+' of 3!'); sfx('boss');
}
function startObeliskTrial(p){
  obeliskTrial={ prop:p, wave:0, foes:[] };
  bossIntroT=2.4; bossIntroName='THE TRIAL'; bossIntroSub='survive three waves — a relic awaits the worthy';
  addShake(.3); burst(p.x,p.y,[255,220,120],26,5);
  obeliskNextWave();
}
// faction voice for the posted gate sentinels: ambient barks + the challenge / pass / point-the-way / refuse lines
const GATE_VOICE={
  watch:     { bark:['Halt. The Watch holds this gate.','No writ, no passage.','State your business, climber.'], greet:'Halt. The Watch holds this gate.', pass:'Papers in order — the Watch lets you through.', point:'No clearance, no passage. The permit is issued at the records desk.', off:'Force this gate and you are a wanted criminal.' },
  guild:     { bark:['Guild ground. Mind yourself.','No charter, no entry.','Works only past this point.'], greet:'This is Guild ground, climber.', pass:'Guild seal checks out. Mind the machinery.', point:'No charter? The works office stamps passage.', off:'Push past and the foremen will mark you.' },
  underworld:{ bark:['Far enough, stranger.','This row answers to its own.','Coin or business — which is it?'], greet:'Far enough. This row answers to its own.', pass:'Coin talks. You are clear — move.', point:'No paper? The Fixer sells exits — he keeps to the west wall.', off:'Shove through and someone bleeds.' },
  commune:   { bark:['Peace, climber. State your need.','The commune watches its own.','Walk easy, or not at all.'], greet:'Peace, climber — the commune watches its own.', pass:'You are welcome here. Walk easy.', point:'Settle your task and the way is yours.', off:'We will not have trouble here.' },
  cult:      { bark:['Halt, seeker.','The cloister is sealed to the unproven.','Speak your purpose.'], greet:'Halt, seeker. This cloister is sealed.', pass:'The veil parts for you. Enter.', point:'Complete the rite and the threshold will open.', off:'Defile the threshold and be cast out.' },
  town:      { bark:['Hold there, climber.','State your business.','Move along, now.'], greet:'Hold there, climber.', pass:'All is in order. Go on.', point:'Sort your business and the way opens.', off:'No trouble, now.' },
};
// the gate sentinel reacts: waved through if cleared (cover / op done), else challenges in faction voice and points you to the fix
function gateGuardTalk(n){
  const disp=n.name.replace(/^the |^a |^an /,'');
  const fac=n.factionGate||'town', v=GATE_VOICE[fac]||GATE_VOICE.town;
  const law=(districtPlan&&districtPlan.law)||1;
  if(hasCover() || !operation || operation.done){ dialogue=disp+': '+v.pass; if(operation&&operation.done) gainDistrictRep(fac,0); return; }
  const opts=[];
  if(fac==='underworld'){
    opts.push({ label:'Ask the way up', f(){ waypoint={x:-WORLD_HW+30,y:-6}; dialogue=disp+': '+v.point; } });
  } else {
    opts.push({ label:'Ask where to get clearance', f(){ if(operation&&operation.x!=null) waypoint={x:operation.x,y:operation.y}; dialogue=disp+': '+((operation&&operation.hint)||v.point); } });
  }
  if(law<1.2){ const toll=Math.max(10,14+floor*2);
    opts.push({ label:'Slip them coin — '+toll+'c (brief pass)', f(){ if(coinCount<toll){ dialogue=disp+': '+toll+' coin, climber, or move on.'; return; } coinCount-=toll; player.writT=Math.max(player.writT||0,18); sfx('coin'); dialogue=disp+': …go on. And you never saw me.'; } }); }
  opts.push({ label:'Push past anyway', f(){ districtHeat(Math.round(8+law*8), disp+': '+v.off+' — WANTED!'); dialogue=disp+': '+v.off; } });
  opts.push({ label:'Step back', f(){ dialogue=disp+': '+v.greet; } });
  openChoices(n, disp+': '+v.greet+'  ('+coinCount+'c)', opts);
  n._social=true;
}
function interactNPC(n){
  n.talkHold=3.0;   // anchor the conversation partner so they can't wander off mid-talk
  if(heroClass && heroClass.mute){ dialogue=pick(['You pound your chest. The '+(n.type||'villager')+' backs away slowly...','They cannot understand the great beast. Nobody sells to a gorilla.','A wary silence. Words are not your weapon.']); return; }
  const disp=n.name.replace(/^the |^a |^an /,'');
  if(n.gateSentinel){ gateGuardTalk(n); return; }   // posted district gate-guard: faction-voiced challenge, wins over its type branch
  if(n.headHouse){ openHouseHead(n); return; }
  if(n.type==='youngson'){ youngsonTalk(n); return; }
  if(n.grateful){
    if(n.gaveThanks){ dialogue=(n.given||'A traveller')+': I owe you my life, climber. Tell me if you ever need anything.'; return; }
    n.gaveThanks=true; const gift=8+floor*2; coinCount+=gift; player.hp=Math.min(player.maxHp,player.hp+15); sfx('coin'); burst(player.x,player.y,[255,220,120],18,3);
    dialogue=(n.given||'A traveller')+': You! You led me to safety once \u2014 I never forgot. Take this, with my thanks. (+'+gift+'c +15HP)'; return;
  }
  if(n.type==='fixer'){
    const permitCost=Math.max(18,32+floor*3-(ensureRep().underworld||0)*3);
    const bribeCost=Math.max(25,42+floor*4-(ensureRep()[operation&&operation.faction]||0)*3);
    openChoices(n, 'Fixer: Quiet doors, loud prices. ('+coinCount+'c)', [
      { label:'Buy a disguise — 12c (30s cover)', f(){ if(coinCount<12){ dialogue='Fixer: Twelve coins for a face nobody remembers.'; return; }
          coinCount-=12; player.disguiseT=Math.max(player.disguiseT||0,30); wantedT=Math.max(0,wantedT-8); sfx('coin'); dialogue='Fixer: Walk like you belong. Do not sprint past guards.'; } },
      { label:'Buy a stair permit — '+permitCost+'c', f(){ if(coinCount<permitCost){ dialogue='Fixer: Come back when your purse can speak.'; return; }
          coinCount-=permitCost; player.permitT=Math.max(player.permitT||0,45); gainDistrictRep('underworld',1); sfx('level');
          if(operation && (operation.type==='bribe'||operation.type==='permit')) completeOperation('paperwork arranged by the fixer');
          else dialogue='Fixer: The paper will get you through most doors for a little while.'; } },
      { label:'Arrange this floor\'s exit — '+bribeCost+'c', f(){ if(!operation){ dialogue='Fixer: This floor has bigger politics than me.'; return; }
          if(coinCount<bribeCost){ dialogue='Fixer: '+bribeCost+' coins, and the stair forgets your name.'; return; }
          coinCount-=bribeCost; player.permitT=Math.max(player.permitT||0,35); gainDistrictRep('underworld',1); completeOperation('exit bought through the Fixer'); } },
      { label:'Ask about the operation', f(){ dialogue='Fixer: '+(operation?operation.hint:'This floor is all ceremony. Keep your head down.'); } },
    ]); return;
  }
  if(n.type==='informant'){
    if(operation && operation.type==='rescue'){
      if(n.escortDone){ dialogue='Informant: The seal is already in your hands. Go use the stair.'; return; }
      if(!n.follow){ openChoices(n, 'Informant: I can open the stair, but not from here. Get me to any waystone.', [
          { label:'Follow me', f(){ n.follow=true; n.operationInformant=true; dialogue='Informant: Fast and quiet. Please.'; } },
          { label:'Where is the waystone?', f(){ const w=props.find(p=>p.kind==='waystone'); if(w){ waypoint={x:w.x,y:w.y}; dialogue='Informant: I marked the nearest one on your map.'; } else dialogue='Informant: Find the blue stone. There is always one.'; } },
          { label:'Not now', f(){ dialogue='Informant: Then I keep hiding.'; } },
        ]); return; }
      dialogue='Informant: Keep moving. The waystone, remember?'; return;
    }
    dialogue='Informant: Wrong district, wrong secret. Try the fixer.'; return;
  }
  // \u2500\u2500 v199 Living Conversations: ordinary NPCs (and vendors on first E) route through the social hub; Trade re-enters with _svc set \u2500\u2500
  if(!n._svc){ openSocial(n); return; }
  n._svc=false;
  if(n.type==='pilgrimkeeper'){
    if(player.lives>=(player.maxLives||3)){ dialogue='Keeper: You stand whole, climber. Save my prayer for a darker hour.'; return; }
    if(n.used){ dialogue='Keeper: The shrine has given what it can. Go on.'; return; }
    n.used=true; player.lives=Math.min((player.maxLives||3)+2,player.lives+1); player.hp=player.maxHp; sfx('level'); burst(player.x,player.y,[255,240,180],26,5); addShake(.2);
    dialogue='Keeper: Rise. The shrine returns a life to you \u2014 spend it well.'; return;
  }
  if(n.type==='quartermaster'){
    const rankNow=cacheRank();
    openChoices(n, "Quartermaster: Your Cache holds "+(FT.cache||0)+" (rank "+rankNow+").  ("+coinCount+"c on you)", [
      { label:'Withdraw 20 Cache \u2192 18 coins', f(){ if((FT.cache||0)<20){ dialogue='Quartermaster: Not enough banked for that.'; return; }
          FT.cache-=20; coinCount+=18; saveFeats(); sfx('coin'); const rk=cacheRank();
          dialogue='Quartermaster: Eighteen coins. '+(rk<rankNow?'Your Cache rank falls to '+rk+' next climb.':'Cache rank holds at '+rk+'.'); } },
      { label:'Deposit 20 coins \u2192 Cache', f(){ if(coinCount<20){ dialogue='Quartermaster: Come back with twenty coins.'; return; }
          coinCount-=20; FT.cache=(FT.cache||0)+20; saveFeats(); sfx('coin'); dialogue='Quartermaster: Banked. Safe from any fall.'; } },
    ]); return;
  }
  if(n.rangerCaptain){
    openChoices(n, 'Ranger Captain: The wilds need thinning. ('+coinCount+'c)', [
      { label:'Take a cull-bounty', f(){ if(player.quest && player.quest.accepted && !player.quest.done){ dialogue='Ranger Captain: Finish your current task first.'; return; }
          const tgt=8+Math.floor(floor/2); player.quest={type:'cull',target:tgt,progress:0,accepted:true,done:false,desc:'Cull '+tgt+' wild foes',rewardItem:true}; sfx('coin');
          dialogue='Ranger Captain: '+tgt+' of them. Bring me proof in blood.'; } },
      { label:'Bank 20 coins to your Cache', f(){ if(coinCount<20){ dialogue='Ranger Captain: Twenty coins to bank, climber.'; return; }
          coinCount-=20; FT.cache=(FT.cache||0)+20; saveFeats(); sfx('coin'); dialogue='Ranger Captain: Logged \u2014 the Cache keeps it forever.'; } },
    ]); return;
  }
  if(n.type==='hermit' && n.wildTower){
    const lore=(FT.lore||[]).length;
    if(lore<3){ dialogue='Hermit: Bring me echoes of the fallen \u2014 three at least. ('+lore+'/3)'; return; }
    if(player.usedHermit){ dialogue='Hermit: I have taught you all I can this climb.'; return; }
    player.usedHermit=true; const gain=2*lore; player.maxHp+=gain; player.hp=player.maxHp; sfx('level'); burst(player.x,player.y,[180,220,255],22,4);
    dialogue='Hermit: '+lore+' echoes carried \u2014 take their strength. +'+gain+' vitality.'; return;
  }
  if(n.type==='bountymaster'){
    const c=player.contract;
    if(c && c.active){ dialogue='Bounty Master: '+c.name+' still draws breath (tier '+c.tier+'). It stalks the floors ahead \u2014 hunt it down.'; return; }
    openChoices(n, 'Bounty Master: A name worth chasing across the whole Tower. ('+coinCount+'c)', [
      { label:'Accept the contract', f(){
          player.contract={ name:pick(BOUNTY_NAMES), affix:pick(Object.keys(AFFIXES)), tier:1, active:true };
          sfx('coin'); dialogue='Bounty Master: '+player.contract.name+' is marked \u2014 it walks the next floor. Kill it and I pay, and it returns angrier.'; } },
      { label:'Not yet', f(){ dialogue='Bounty Master: The board keeps its names.'; } },
    ]); return;
  }
  if(n.type==='magistrate'){
    const opts=[];
    if(wantedT>0 || (player.rep&&player.rep.watch<0)){
      const fine=Math.min(30,12+floor*2);
      opts.push({ label:'Pay a fine \u2014 '+fine+'c (clear heat, +Watch favour)', f(){ if(coinCount<fine){ dialogue='Magistrate: Come back when you can pay.'; return; }
        coinCount-=fine; wantedT=0; calmWardens(); if(player.rep) player.rep.watch+=2; sfx('coin'); dialogue='Magistrate: Paid in full. The Watch forgets \u2014 for now.'; } });
    }
    if(jailT>0){
      const bail=Math.min(25,10+floor*2);
      opts.push({ label:'Post bail \u2014 '+bail+'c (walk free now)', f(){ if(coinCount<bail){ dialogue='Magistrate: No coin, no freedom.'; return; }
        coinCount-=bail; jailT=0.3; if(jailDoor){ walls=walls.filter(w=>w!==jailDoor); jailDoor=null; } sfx('coin'); dialogue='Magistrate: Bail posted. The cell opens.'; } });
    }
    const writ=Math.min(40,18+floor*3);
    opts.push({ label:'Buy a writ \u2014 '+writ+'c (20s the Watch looks away)', f(){ if(coinCount<writ){ dialogue='Magistrate: A writ is not cheap.'; return; }
      coinCount-=writ; player.writT=20; sfx('level'); dialogue='Magistrate: Twenty seconds, climber. The Watch sees nothing. Be quick.'; } });
    if(!opts.length){ opts.push({ label:'Nothing today', f(){ dialogue='Magistrate: Keep your nose clean.'; } }); }
    openChoices(n, 'Magistrate: Justice has its price. ('+coinCount+'c)', opts); return;
  }
  if(n.type==='mythic'){ openMythic(n); return; }
  if(n.type==='seer'){
    const un=poiList.filter(p=>!p.found);
    openChoices(n, 'Seer: Cross my palm with coin and the mist will part. ('+coinCount+'c)', [
      { label:'Read my fortune \u2014 6c (reveal a place)', f(){ if(coinCount<6){ dialogue='Seer: Six coins. The future isn\u2019t free.'; return; }
          if(!un.length){ dialogue='Seer: I see\u2026 you have already found all this floor holds.'; return; }
          coinCount-=6; const p9=pick(un); p9.found=true; pings.push({x:p9.x,y:p9.y,col:'#c9a0ff',life:9999}); gainXP(4); sfx('level');
          dialogue='Seer: I see\u2026 '+p9.name+'. It waits for you.'; } },
      { label:'A blessing of fortune \u2014 12c', f(){ if(coinCount<12){ dialogue='Seer: Twelve. Fortune favours the paying.'; return; }
          coinCount-=12; player.buffT=Math.max(player.buffT||0,10); sfx('coin'); dialogue='Seer: The stars lean your way, for a while.'; } },
    ]); return;
  }
  if(n.type==='herbalist'){
    openChoices(n, 'Herbalist: Roots and remedies, climber. ('+coinCount+'c)', [
      { label:'Healing draught \u2014 8c (regen)', f(){ if(coinCount<8){ dialogue='Herbalist: Eight coins for the good stuff.'; return; }
          coinCount-=8; player.regenT=Math.max(player.regenT||0,30); player.hp=Math.min(player.maxHp,player.hp+10); sfx('coin'); dialogue='Herbalist: Chew slow \u2014 it mends as you walk.'; } },
      { label:'Antidote sachet \u2014 6c (cure + heal)', f(){ if(coinCount<6){ dialogue='Herbalist: Six coins, no haggling.'; return; }
          coinCount-=6; player.slowT=0; player.hp=Math.min(player.maxHp,player.hp+18); sfx('coin'); dialogue='Herbalist: There \u2014 whatever ailed you is gone.'; } },
    ]); return;
  }
  if(n.type==='pedlar'){
    openChoices(n, 'Pedlar: Wares and wonders, friend! ('+coinCount+'c)', [
      { label:'Travel tonic — 8c (heal 35)', f(){ if(coinCount<8){ dialogue='Pedlar: Eight coins, friend. The road isn\u2019t free.'; return; }
          coinCount-=8; player.hp=Math.min(player.maxHp,player.hp+35); sfx('coin'); dialogue='Pedlar: Brewed it myself. Mostly berries. Mostly.'; } },
      { label:'Mystery trinket — 22c', f(){ if(coinCount<22){ dialogue='Pedlar: Twenty-two. Mystery has a price.'; return; }
          coinCount-=22; sfx('coin'); dialogue='Pedlar: No refunds! '+grantItem(false); } },
      { label:'Road gossip (free)', f(){ const un=poiList.filter(p=>!p.found);
          if(!un.length){ dialogue='Pedlar: You\u2019ve seen more of this floor than I have!'; return; }
          const p9=pick(un); const dxx=p9.x-n.x, dyy=p9.y-n.y, dir=(Math.abs(dxx)>Math.abs(dyy))?(dxx>0?'east':'west'):(dyy>0?'south':'north');
          dialogue='Pedlar: '+Math.round(len(dxx,dyy))+' paces '+dir+' — I passed '+p9.name+'. Worth a look.'; } },
      { label:'Browse wares', f(){ openShopWares(n,'apothecary'); } },
    ]); return; }
  if(n.type==='climber'){
    if(exit && !exit.found){ const dxx=exit.x-n.x, dyy=exit.y-n.y, dir=(Math.abs(dxx)>Math.abs(dyy))?(dxx>0?'EAST':'WEST'):(dyy>0?'SOUTH':'NORTH');
      dialogue='Climber: I scouted the stair — it hides '+dir+' of here, '+Math.round(len(dxx,dyy))+' paces or so. The gatekeeper\u2019s no joke.'; return; }
    dialogue=pick(['Climber: Floor '+floor+', eh? I peeked at four, twice.','Climber: We climbers must stick together. Figuratively. You go first.','Climber: I fought a '+(realm.sig||'beast')+' once. I have the scars and the nightmares.']); return; }
  if(CIV_LINES[n.type]){ dialogue=disp.charAt(0).toUpperCase()+disp.slice(1)+': '+pick(CIV_LINES[n.type]); return; }
  if(n.type==='quester' || n.giver){
    const q=player.quest;
    if(q && q.done && n.giver){ // a quest-giver hands out fresh work — but the floor only has so much
      if(floorQuestsGiven>=3){ dialogue=disp+': That\u2019s all the work this floor holds. Climb on.'; return; }
      floorQuestsGiven++; player.quest=genQuest(floor); player.quest.accepted=true; sfx('coin');
      dialogue=disp+': More work, climber — '+player.quest.desc+'. Reward as usual.'; return;
    }
    if(n.type==='quester'){
      if(!q){ dialogue='Herald: No task for you today.'; return; }
      if(q.done){ dialogue='Herald: The deed is done — the Tower thanks you.'; return; }
      if(!q.accepted){ q.accepted=true; sfx('coin'); dialogue='Herald: A task — '+q.desc+'. Complete it for a reward.'; }
      else dialogue='Herald: '+q.desc+(q.target>1?' ('+q.progress+'/'+q.target+')':'')+'. Press on!';
      return;
    }
    // giver with quest still active: fall through to their normal chatter
  }
if(n.type==='enchanter'){
    if(coinCount>=30){ coinCount-=30; sfx('level'); dialogue='Enchanter: Let fate choose your gift.'; openDraft(); }
    else dialogue='Enchanter: Thirty coins, and fate picks you a boon.'; return;
  }
  if(n.type==='fisher'){
    if(n.casts==null) n.casts=3;   // per-floor stock (creator-mode floor jumps reset it — accepted dev-tool quirk)
    if(n.casts<=0){ dialogue='Fisherman: Fish are spooked. Next floor, friend.'; return; }
    n.casts--; const r=rand(0,1);
    if(r<.5){ player.hp=Math.min(player.maxHp,player.hp+15); sfx('coin'); dialogue='Fisherman: A fat silverfin! (+15 HP)'; }
    else if(r<.8){ coinCount+=8; sfx('coin'); dialogue='Fisherman: A coin purse on the line! (+8 coins)'; }
    else if(r<.95){ dialogue='Fisherman: ...a boot. A really nice boot, though.'; }
    else { sfx('level'); dialogue='Fisherman: BY THE TOWER — '+grantItem(false); }
    return;
  }
  if(n.type==='arenamaster'){
    if(arenaDone){ dialogue='Arena Master: CHAMPION! Your chest stands open.'; return; }
    if(arenaState){ dialogue='Arena Master: FIGHT ON! Wave '+arenaState.wave+' of '+arenaState.total+'!'; return; }
    arenaState={wave:0,total:3,cx:arenaSpot?arenaSpot.x:n.x,cy:arenaSpot?arenaSpot.y:n.y};
    spawnArenaWave(); sfx('boss'); addShake(.3);
    dialogue='Arena Master: THREE WAVES! Survive them and the prize is yours!'; return;
  }
  if(n.type==='watchman'){
    const el=mobs.filter(m=>m.elite&&!m.warden).length, wd=mobs.some(m=>m.warden);
    if(wd){ dialogue='Watchman: The WARDEN walks this floor. I\u2019d climb, were I you.'; return; }
    if(el>0 && Math.random()<.5){ const e=mobs.find(m=>m.elite&&!m.warden);
      const dxe=e.x-n.x, dye=e.y-n.y, dire=(Math.abs(dxe)>Math.abs(dye))?(dxe>0?'east':'west'):(dye>0?'south':'north');
      dialogue='Watchman: '+(el===1?'A marked beast prowls':el+' marked beasts prowl')+' this floor. Nearest — a '+e.elite+' '+e.type+', '+Math.round(len(dxe,dye))+' paces '+dire+'. Steel yourself.'; return; }
    const t=vaultSpot||exit, what=vaultSpot?'sealed vault':'stair';
    const dxx=t.x-n.x, dyy=t.y-n.y;
    const dir=(Math.abs(dxx)>Math.abs(dyy))?(dxx>0?'east':'west'):(dyy>0?'south':'north');
    dialogue='Watchman: From up here I can see the '+what+' — '+dir+' of this tower. Also: everything out there wants to eat you.'; return;
  }
  if(n.type==='priest'){
    if(n.used){ dialogue='Priest: Walk in grace, climber.'; return; }
    if(coinCount>=10){ coinCount-=10; n.used=true; player.regenT=30; sfx('level'); dialogue='Priest: The Tower itself shall mend you as you walk. (+regeneration, 30s)'; }
    else dialogue='Priest: A ten-coin offering, and the Tower will knit your wounds.'; return;
  }
  if(n.type==='storyteller'){
    openChoices(n, 'Storyteller: Tales... or tidings?', [
      { label:'A tale of the Tower (+10 charge, once)', f(){ if(!n.used){ n.used=true; player.charge=Math.min(player.maxMana,player.charge+10); } dialogue=pick(LORE).replace('Scholar:','Storyteller:'); } },
      { label:'Tidings of danger (marks a site)', f(){ const w=mobs.find(m=>m.warlord&&m.hp>0);
          if(w){ pings.push({x:w.x,y:w.y,col:'#ff5a5a',life:60}); dialogue='Storyteller: '+(w.eliteName||'A warlord')+' musters '+Math.round(len(w.x-n.x,w.y-n.y))+' paces out — marked on your map. Mind the camp guards.'; }
          else dialogue='Storyteller: The wilds are quiet... for once. Savor it.'; } },
    ]); return;
  }
  if(n.type==='caravaneer'){
    if(coinCount>=25){ coinCount-=25; sfx('coin'); dialogue='Caravaneer: Fine goods, fair-ish prices! '+grantItem(false); }
    else dialogue='Caravaneer: Twenty-five coins. Exotic relics from nine floors away.'; return;
  }
  if(n.type==='courier'){
    if(player.parcel){ dialogue='Courier: The SAGE. Near the entrance. Legs, friend, use them!'; return; }
    if(n.used){ dialogue='Courier: No more letters today. My legs are jelly.'; return; }
    n.used=true; player.parcel=true; sfx('coin');
    dialogue='Courier: You there! Deliver this parcel to the Sage and the tip is yours!'; return;
  }
if(n.type==='tavernkeep'){
    openChoices(n, 'Tavernkeep: Welcome to the hearth! What\u2019ll it be? ('+coinCount+'c)', [
      { label:'A hot drink — 6c (heal + vigor)', f(){ if(coinCount>=6){ coinCount-=6; player.hp=Math.min(player.maxHp,player.hp+25); player.buffT=8; sfx('coin'); dialogue='Tavernkeep: Down the hatch! Warmth in your boots.'; } else dialogue='Tavernkeep: Six coins. Even warmth has a price.'; } },
      { label:'Hear a rumor — 5c', f(){ if(coinCount<5){ dialogue='Tavernkeep: Rumors are five.'; return; } coinCount-=5;
          if(!wardenSpawned && floorAge>40 && floor>=2 && Math.random()<.5){ dialogue='Tavernkeep: Old rule of the Tower — linger past your welcome and the floor sends its WARDEN. You\u2019ve been here a while...'; return; }
          if(encounters.camps.length && Math.random()<.5){ const c=pick(encounters.camps);
            const dxx=c.x-n.x, dyy=c.y-n.y, dir=(Math.abs(dxx)>Math.abs(dyy))?(dxx>0?'east':'west'):(dyy>0?'south':'north');
            dialogue='Tavernkeep: A '+c.species+' camp burns its fires '+Math.round(len(dxx,dyy))+' paces '+dir+'. Loud lot. Someone should quiet them.'; return; }
          const ch=props.filter(p=>p.kind==='chest'&&!p.opened).sort((a,b)=>(b.big?1:0)-(a.big?1:0))[0];
          if(!ch){ dialogue='Tavernkeep: Rumor is... the floor\u2019s been picked clean. Keep the fiver in spirit.'; coinCount+=5; return; }
          const dxx=ch.x-n.x, dyy=ch.y-n.y, dir=(Math.abs(dxx)>Math.abs(dyy))?(dxx>0?'east':'west'):(dyy>0?'south':'north');
          dialogue='Tavernkeep: A '+(ch.big?'GREAT':'tidy')+' chest, '+Math.round(len(dxx,dyy))+' paces '+dir+' of here. You didn\u2019t hear it from me.'; } },
      { label:'A song (free, once)', f(){ if(n.used){ dialogue='Tavernkeep: Bard\u2019s on break. Voice like a dying cart.'; return; } n.used=true; player.charge=Math.min(player.maxMana,player.charge+10); sfx('level'); dialogue='Tavernkeep: ...AND THE CLIMBER CAME DOWN NEVERMORE! Ha! (+10 charge)'; } },
      { label:'Hire Borin, blade — 35c', f(){ hireMerc(n,'blade'); } },
      { label:'Hire Wren, bow — 45c', f(){ hireMerc(n,'bow'); } },
      { label:'Hire Sister Lys, cleric — 45c (heals you)', f(){ hireMerc(n,'cleric'); } },
    ]); return;
  }
    if(n.type==='miner'){ dialogue=pick(['Miner: The ore here hums. Tower-song, we call it.','Miner: Three swings a vein. Then she is spent.','Miner: Found a relic once. Traded it for soup. No regrets.']); return; }
  if(n.type==='hermit'){ dialogue=pick(['Hermit: The Tower is a question. Climbers are its punctuation.','Hermit: Came up forty years ago. Forgot what for. Stayed.','Hermit: The stones whisper. The waystones SHOUT.']); return; }
    if(n.type==='cook'){
    if(coinCount>=8){ coinCount-=8; player.hp=Math.min(player.maxHp,player.hp+40); player.slowT=0; player.buffT=7; sfx('coin');
      dialogue='Cook: Hot stew! +40 HP and a spring in your step.'; }
    else dialogue='Cook: Stew is 8 coins. Smells worth it, no?'; return;
  }
  if(n.type==='gambler'){
    const bet=(stake,pay)=>{ if(coinCount<stake){ dialogue='Gambler: Your purse disagrees.'; return; }
      coinCount-=stake;
      if(rand(0,1)<0.5){ coinCount+=pay; sfx('coin'); dialogue='Gambler: ...the climber takes the pot! +'+pay+'.'; }
      else dialogue='Gambler: House wins. The Tower always collects.'; };
    openChoices(n, 'Gambler: Pick your stake, climber. Double or dust. ('+coinCount+'c)', [
      { label:'Small — 10c, win 18', f(){ bet(10,18); } },
      { label:'Bold — 25c, win 45', f(){ bet(25,45); } },
      { label:'Reckless — 50c, win 92', f(){ bet(50,92); } },
    ]); return;
  }
  if(n.type==='bard'){
    openChoices(n, 'Bard: A tune for the road? ('+coinCount+'c)', [
      { label:'Song of Valor — 8c (+8% dmg & speed this floor)', f(){ if(player.songT>0){ dialogue='Bard: The song already rides with you!'; } else if(coinCount>=8){ coinCount-=8; player.songT=9999; sfx('level'); dialogue='Bard: March to the beat — strike on the chorus!'; } else dialogue='Bard: Eight coins keeps the lute strung.'; } },
      { label:'A rousing chord (+20 ult charge, once)', f(){ if(!n.used){ n.used=true; player.charge=Math.min(player.maxMana,player.charge+20); sfx('level'); dialogue='Bard: For the climber! (+20 charge)'; } else dialogue='Bard: Encore after the next floor, friend.'; } },
      { label:'Just listen', f(){ dialogue='Bard: ♪ The Tower eats the brave for breakfast — be lunch instead ♪'; } },
    ]); return;
  }
  if(n.type==='monk'){
    if(n.used) dialogue='Monk: Balance, once found, need not be found again today.';
    else if(coinCount>=15){ coinCount-=15; n.used=true; player.maxHp+=10; player.hp+=10; sfx('level'); dialogue='Monk: Breathe. Endure. (+10 max HP)'; }
    else dialogue='Monk: A 15-coin offering steadies the soul.'; return;
  }
  if(n.type==='innkeep'){
    if(coinCount>=12){ coinCount-=12; player.hp=player.maxHp; player.slowT=0; sfx('level'); dialogue='Innkeeper: A warm bed works miracles. Fully rested!'; }
    else dialogue='Innkeeper: Twelve coins for a bed. Cheaper than a funeral.'; return;
  }
  if(n.type==='merchant'){
    openChoices(n, 'Merchant: Finest goods on the floor! What will it be? (you have '+coinCount+'c)', [
      { label:'Full heal — 15c', f(){ if(coinCount>=15){ coinCount-=15; player.hp=player.maxHp; sfx('coin'); dialogue='Merchant: Patched up! Come again.'; } else dialogue='Merchant: Short on coin, friend.'; } },
      { label:'Whetstone, +3 damage — 20c', f(){ if(coinCount>=20){ coinCount-=20; player.ad+=3; sfx('level'); dialogue='Merchant: A keener edge! (+3 damage)'; } else dialogue='Merchant: Twenty coins, no less.'; } },
      { label:'Mystery relic — 30c', f(){ if(coinCount>=30){ coinCount-=30; sfx('level'); dialogue='Merchant: Sold! '+grantItem(false); } else dialogue='Merchant: Mysteries are not cheap.'; } },
      { label:'Browse wares', f(){ openShopWares(n,'trinketer'); } },
    ]); return;
  }
  if(n.type==='healer'){
    if(!n.used){ n.used=true; player.hp=player.maxHp; sfx('level'); dialogue='Healer: Be whole again. Walk bravely.'; }
    else dialogue='Healer: My gift is spent until the next floor.'; return;
  }
  if(n.type==='smith'){ openForge(n); return; }
if(n.type==='wanderer' && !n.escortDone && props.some(p=>p.kind==='waystone')){
    if(!n.follow){ openChoices(n, 'Local: These wilds chew up travellers. Walk me to a waystone and I\u2019ll make it worth your while.', [
        { label:'Follow me. (escort)', f(){ n.follow=true; dialogue='Local: Right behind you, climber.'; } },
        { label:'Not now.', f(){ dialogue='Local: Then I\u2019ll wait. Carefully.'; } } ]); return; }
    else { dialogue='Local: Lead on — to a waystone, please.'; return; }
  }
  if(n.type==='sage' && player.parcel){ player.parcel=false; coinCount+=20; gainXP(10); sfx('level');
    dialogue='Sage: My letters! Wonderful. A little something for your trouble. (+20 coins)'; return; }
    // sage / wanderer: cycle their lines
  if(!n.lines || !n.lines.length){ dialogue=disp+': '+pick(['Climb well, then.','The Tower waits for no one.','Mind the wilds past the walls.']); return; }
  n.line++; if(n.line>=n.lines.length){ n.line=-1; dialogue=''; } else dialogue=n.lines[n.line];
}
function interactProp(p){
  if(p.kind==='wardrobe'){
    player.disguiseT=Math.max(player.disguiseT||0,32);
    player.stealthT=Math.max(player.stealthT||0,1.2);
    wantedT=Math.max(0,wantedT-8);
    sfx('coin'); burst(p.x,p.y,[160,180,210],10,2.5);
    dialogue='You change coat, scarf, and posture. For a little while, you look like you belong here.';
    return;
  }
  if(p.kind==='records'){
    if(p.used){ dialogue='The records desk has already done its damage.'; return; }
    const rep=ensureRep(), fac=(operation&&operation.faction)||'watch';
    const cost=Math.max(14,28+floor*3-(rep[fac]||0)*3-(hasCover()?6:0));
    openChoices(p, 'Records Desk: papers, seals, and a tired clerk-stamp. ('+coinCount+'c)', [
      { label:'Forge a stair permit — '+cost+'c', f(){ if(coinCount<cost){ dialogue='The clerk-stamp waits for more convincing coin.'; return; }
          coinCount-=cost; p.used=true; player.permitT=Math.max(player.permitT||0,50); gainDistrictRep(fac,1); sfx('level'); burst(p.x,p.y,[120,190,255],16,3);
          if(operation && (operation.type==='permit'||operation.type==='bribe')) completeOperation('stair permit forged');
          else dialogue='A clean permit slides from the desk. Guards will hesitate for a while.'; } },
      { label:'Search district files (reveal objective)', f(){ if(operation){ pings.push({x:p.x,y:p.y,col:'#9fd6ff',life:18}); if(exit) exit.found=true; dialogue='Files: '+operation.hint; }
          else dialogue='The files are mostly old fines and newer lies.'; } },
      { label:'Walk away', f(){ dialogue='The desk keeps humming.'; } },
    ]);
    return;
  }
  if(p.kind==='evidence'){
    if(p.used){ dialogue='The secure locker hangs open.'; return; }
    openChoices(p, 'Secure Locker: a quiet lock, a loud consequence.', [
      { label:'Pick it quietly', f(){ p.used=true; if(!hasCover()) districtHeat(12,'A witness clocks the theft — heat rises.');
          dropCoins(p.x,p.y,10+floor*2); if(rand(0,1)<0.45) spawnWorldKit(p.x,p.y,rollKitDrop(1)); sfx('coin'); burst(p.x,p.y,[255,220,120],16,3);
          if(operation && (operation.type==='heist'||operation.type==='blackmail')) completeOperation(operation.type==='heist'?'stair key stolen':'leverage recovered');
          else dialogue='Inside: coins, seals, and the kind of paperwork that ruins people.'; } },
      { label:'Smash it open', f(){ p.used=true; districtHeat(20,'The locker screams open — WANTED!');
          addShake(.35); dropCoins(p.x,p.y,16+floor*3); burst(p.x,p.y,[255,160,80],24,4);
          if(operation && (operation.type==='heist'||operation.type==='blackmail')) completeOperation(operation.type==='heist'?'stair key taken by force':'blackmail taken by force');
          else dialogue='Subtle? No. Effective? Yes.'; } },
      { label:'Leave it', f(){ dialogue='The lock remains smug.'; } },
    ]);
    return;
  }
  if(p.kind==='relaybox'){
    if(p.used){ dialogue='The relay is dark and harmless.'; return; }
    openChoices(p, 'District Relay: the stair seal runs through this box.', [
      { label:'Disable it carefully', f(){ p.used=true; sfx('level'); burst(p.x,p.y,[120,220,255],18,4);
          if(operation && operation.type==='sabotage') completeOperation('relay disabled quietly');
          else { player.charge=Math.min(player.maxMana,player.charge+20); dialogue='The relay goes quiet. Useful, even if it was not your main problem.'; } } },
      { label:'Overload it loudly', f(){ p.used=true; districtHeat(18,'The relay blows — every guard heard it.');
          addShake(.5); shocks.push({x:p.x,y:p.y,r:.2,maxR:4.2,life:.55,max:.55,dmg:18+floor*2,hit:false,col:[120,220,255]}); burst(p.x,p.y,[120,220,255],34,5); sfx('boss');
          if(operation && operation.type==='sabotage') completeOperation('relay overloaded');
          else dialogue='The box detonates in a blue-white cough.'; } },
      { label:'Back away', f(){ dialogue='The relay ticks on.'; } },
    ]);
    return;
  }
  if(p.kind==='runestone'){
    if(!vaultSeal || vaultSeal.open){ dialogue='The runestone is quiet.'; return; }
    if(p.lit){ dialogue='This rune already burns.'; return; }
    if(p.idx===vaultSeal.order[vaultSeal.progress]){
      p.lit=true; vaultSeal.progress++; sfx('level'); burst(p.x,p.y,vaultSeal.cols[p.idx],14,3);
      if(vaultSeal.progress>=3){ vaultSeal.open=true; walls=walls.filter(w=>!w.vaultDoor);
        burst(vaultSeal.x-8,vaultSeal.y,[255,210,80],30,5); addShake(.4); sfx('boss');
        pings.push({x:vaultSeal.x,y:vaultSeal.y,col:'#ffd34d',life:9999});
        showToast('The three runes blaze — the Vault unseals!'); }
      else showToast('The '+vaultSeal.names[p.idx]+' rune ignites... ('+vaultSeal.progress+'/3)'); }
    else { vaultSeal.progress=0; for(const q of props){ if(q.kind==='runestone') q.lit=false; }
      sfx('hurt'); addShake(.3); showToast('The seal rejects that order — wardens stir!');
      for(let i2=0;i2<2;i2++){ const mm=MOB(pick(realm.pool||['slime']), p.x+rand(-2,2), p.y+rand(-2,2)); mm.provoked=true; mm.assistT=5; } }
    return;
  }
  if(p.kind==='chest'){
    if(p.locked){ dialogue='Sealed tight. The Arena Master holds the key — survive his three waves.'; return; }
    if(p.opened){ dialogue='The chest is empty.'; return; }
    p.opened=true;
    if(!p.big && rand(0,1)<0.15){   // MIMIC! the chest springs to life
      sfx('boss'); addShake(.45); burst(p.x,p.y,[190,50,50],28,5);
      const mm=MOB(pick(realm.pool||['slime']), p.x, p.y); if(mm){ makeElite(mm); mm.provoked=true; mm.mimic=true; mm.hp=Math.round(mm.hp*1.6); mm.maxHp=mm.hp; mm.drop=(mm.drop||5)+18; }
      showToast('It’s a MIMIC! Cut it down for its hoard.'); questBump('treasure'); return;
    }
    sfx('coin'); burst(p.x,p.y,[255,210,90],22,3);
    if(p.big){ dropCoins(p.x,p.y,14); player.hp=Math.min(player.maxHp,player.hp+20); spawnWorldKit(p.x,p.y,rollKitDrop(floor>=6?3:1)); if(rand(0,1)<0.18){ spawnWorldTrinket(p.x,p.y,rollTrinket(floor>=6?3:1)); } showToast('Vault hoard! Coins + '+grantItem(true)); if(rand(0,1)<0.45){ const gr=grantGrimoire(rollGrimoire(floor>=6?3:1)); if(gr) showToast(gr); } questBump('vault'); }
    else { dropCoins(p.x,p.y,6); if(rand(0,1)<.45){ spawnWorldKit(p.x,p.y,rollKitDrop(floor>=5?1:0)); } if(rand(0,1)<0.16){ const gr=grantGrimoire(rollGrimoire(floor>=4?1:0)); if(gr){ showToast(gr); } else if(rand(0,1)<.6){ showToast('A chest! '+grantItem(false)); } } else if(rand(0,1)<.6){ showToast('A chest! '+grantItem(false)); } else if(rand(0,1)<.5){ player.hp=Math.min(player.maxHp,player.hp+15); showToast('A chest! Coins + 15 HP.'); } else showToast('A chest! Coins.'); }
    questBump('treasure');
  } else if(p.kind==='obelisk'){
    if(p.used){ dialogue='The obelisk has tested you already.'; return; }
    if(obeliskTrial){ dialogue='A trial already rages — survive it!'; return; }
    openChoices(p, '⟁ TRIAL OBELISK — face three escalating waves for a relic?', [
      { label:'Face the trial', f(){ startObeliskTrial(p); } },
      { label:'Not now', f(){ dialogue='The obelisk dims, waiting.'; } },
    ]); return;
  } else if(p.kind==='covenant'){
    sfx('level'); openCovenant(p); return;
  } else if(p.kind==='market'){
    if(p.entered){ openMarket(p); return; }
    if((player.bmTickets||0)>0){ player.bmTickets--; p.entered=true; p.revealed=true; sfx('level'); burst(p.x,p.y,[200,140,255],14,3); showToast('The doorman takes your pass — you’re in.'); openMarket(p); }
    else { sfx('hurt'); dialogue='A hooded doorman bars the way: “No pass, no entry. Find the mythic dealer — or earn a patron’s favour.”'; }
    return;
  } else if(p.kind==='altar'){
    if(LEAN){ dialogue='A cold stone altar, long abandoned.'; return; }   // lean core: room-decor altars are inert (no pact)
    if(p.used){ dialogue='The altar’s pact is sealed.'; return; }
    if(!p.pact) p.pact = pick(PACTS.filter(P=>!(player.pacts||[]).includes(P.n))) || pick(PACTS);
    const P=p.pact; sfx('level');
    openChoices(p, '⛧ ALTAR OF PACT — '+P.n+': '+P.boon+', but '+P.curse+'.', [
      { label:'Seal the pact  ('+P.boon+'  /  '+P.curse+')', f(){ p.used=true; P.apply(); player.pacts=player.pacts||[]; player.pacts.push(P.n);
          player.hp=Math.min(player.hp,player.maxHp); sfx('boss'); addShake(.3); burst(p.x,p.y,[200,60,255],32,5); flashT=Math.max(flashT||0,.05);
          showToast('⛧ Pact sealed: '+P.n+' — '+P.boon+', '+P.curse); dialogue='The pact is written in blood.'; } },
      { label:'Refuse — step away', f(){ dialogue='You turn from the altar… for now.'; } },
    ]);
    return;
  } else if(p.kind==='shrine'){
    if(p.used){ dialogue='The shrine lies dormant.'; return; }
    p.used=true; if(player.rep) player.rep.cult+=1; sfx('level'); showToast('The shrine offers a blessing...'); openDraft();
} else if(p.kind==='beacon'){
    if(p.used){ dialogue='The beacon already blazes.'; return; }
    p.used=true; sfx('level'); addShake(.3); burst(p.x,p.y,[255,200,90],30,6);
    const total=poiList.length, found0=poiList.filter(q=>q.found).length; let revealed=0;
    for(const q of poiList){ if(q.found) continue; if(len(q.x-p.x,q.y-p.y)<70){ q.found=true; revealed++; pings.push({x:q.x,y:q.y,col:'#9fd6ff',life:9999}); } }
    gainXP(8+floor*2);
    if(total && found0/total>=0.4 && exit){ exit.found=true; showToast('\u25b3 Beacon lit \u2014 the stair is revealed!'); }
    else showToast('\u25b3 Beacon lit \u2014 '+revealed+' place'+(revealed===1?'':'s')+' revealed nearby.');
    dialogue='';
} else if(p.kind==='wardoor'){
    const have=(FT.lore||[]).length, need=p.need||3;
    if(p.used){ dialogue='The vault stands open.'; return; }
    if(have<need){ dialogue='Sealed Vault: '+need+' echoes of the fallen open this door. ('+have+'/'+need+')'; return; }
    p.used=true; if(p.doorWall) walls=walls.filter(w=>w!==p.doorWall); sfx('level'); addShake(.35); burst(p.x,p.y,[180,160,255],26,5);
    showToast('\u26ec The echoes answer \u2014 the vault opens.'); dialogue='';
} else if(p.kind==='weathervane'){
    if(p.used){ dialogue='The weathervane turns, its blessing spent.'; return; }
    if(weatherInt<0.4){ dialogue='Weathervane: the sky is too calm. Return when the weather turns.'; return; }
    const b=WEATHER_BOON[weatherType]||WEATHER_BOON.dust; p.used=true; b.f(); sfx('level'); burst(p.x,p.y,[200,220,255],22,4);
    showToast('\u263c '+b.msg+' (read from the '+weatherType+' sky)'); dialogue='';
} else if(p.kind==='waystone'){
    const stones=props.filter(q=>q.kind==='waystone');
    if(!p.attuned){ p.attuned=true; sfx('level'); burst(p.x,p.y,[120,200,255],18,3);
      showToast('Waystone attuned ('+stones.filter(q=>q.attuned).length+'/'+stones.length+')'); return; }
    const att=stones.filter(q=>q.attuned);
    if(att.length<2){ dialogue='The waystone hums, waiting for its kin to wake.'; return; }
    const i=att.indexOf(p), nx=att[(i+1)%att.length];
    let lx=nx.x, ly=nx.y+1.5;   // spiral outward until the landing is safe
    for(let t=0;t<28;t++){ const a=t*0.9, r=1.5+t*0.45;
      const tx=nx.x+Math.cos(a)*r, ty=nx.y+Math.sin(a)*r;
      if(Math.abs(tx)>WORLD_HW-3||Math.abs(ty)>WORLD_HH-3) continue;
      if(inWall(tx,ty,0.6)) continue;
      if(floors.some(f=>f.hazard && Math.abs(tx-f.x)<f.w/2 && Math.abs(ty-f.y)<f.h/2)) continue;
      if(restricted.some(z=>Math.abs(tx-z.x)<z.w/2+1 && Math.abs(ty-z.y)<z.h/2+1)) continue;
      lx=tx; ly=ty; break; }
    player.x=lx; player.y=ly; collideWalls(player); player.iframe=.6; sfx('dash'); burst(nx.x,nx.y,[120,200,255],22,3.5);
    showToast('The Tower folds — waystone '+(att.indexOf(nx)+1)+' of '+att.length);
} else if(p.kind==='newsstand'){ openNewsStand(p);
} else if(p.kind==='board'){ openMissions(p);
  } else if(p.kind==='well'){
    openChoices(p, 'A FORTUNE WELL — tempt fate? (you carry '+coinCount+'c)', [
      { label:'Toss 1 coin — a small wish', f(){ if(coinCount<1){ dialogue='Empty pockets. Even a wish costs a coin.'; return; }
          coinCount--; const r=rand(0,1);
          if(r<.10){ sfx('level'); dialogue='The well GLOWS. '+grantItem(false); }
          else if(r<.32){ coinCount+=6; sfx('coin'); dialogue='A clatter — an old purse! (+6 coins)'; }
          else dialogue=pick(['Plink. The well keeps your secret.','Plink. Somewhere a fish is annoyed.','Plink. You feel marginally luckier.']); } },
      { label:'Toss 20 coins — a DEEP wish (big stakes)', f(){ if(coinCount<20){ dialogue='The deep wish needs 20 coins.'; return; }
          coinCount-=20; const r=rand(0,1);
          if(r<.20){ sfx('level'); addShake(.3); burst(player.x,player.y,[255,220,120],26,5); dialogue='✦ JACKPOT — the well overflows! '+grantItem(true); }
          else if(r<.45){ coinCount+=55; sfx('coin'); dialogue='Coins erupt from the dark! (+55 coins)'; }
          else if(r<.68){ player.hp=Math.min(player.maxHp,player.hp+40); player.charge=Math.min(player.maxMana,player.charge+20); sfx('level'); dialogue='A cool blessing — wounds close, power gathers.'; }
          else if(r<.85){ dialogue='The coins vanish without a sound. The well is greedy today.'; }
          else { player.pactVuln=Math.min(3,(player.pactVuln||1)*1.12); sfx('hurt'); addShake(.2); dialogue='A cold hand grips you — the well takes more than coin.'; } } },
      { label:'Walk away', f(){ dialogue='The well waits, patient as stone.'; } },
    ]); return;
  } else if(p.kind==='fountain'){
    if(coinCount<1){ dialogue='The fountain glistens. A wish costs a coin.'; return; }
    coinCount--; const r=rand(0,1);
    if(r<.08){ sfx('level'); dialogue='The well GLOWS. '+grantItem(false); }
    else if(r<.3){ coinCount+=6; sfx('coin'); dialogue='A clatter — someone\u2019s old purse! (+6 coins)'; }
    else dialogue=pick(['Plink. The well keeps your secret.','Plink. Somewhere, a fish is annoyed.','Plink. You feel marginally luckier.']);
  } else if(p.kind==='guildplatform'){
    const sr=starRank(player); sfx('level'); addShake(.3); burst(player.x,player.y,[240,196,80],26,4);
    showToast('★ GUILD RANK: '+sr.stars+'★ '+sr.title+'  ('+sr.axis+' '+sr.val+')');
    let extra='';
    if((player.prestige||0)>=80 && !player.guildSeen){ player.guildSeen=true; const g=40+floor*5; coinCount+=g; extra=' For your prestige, the guild rewards you — +'+g+'c.'; try{ const r=grantItem(false); if(r) extra+=' '+r; }catch(e){} sfx('win'); }
    dialogue='Guildmaster: The dais reads you a '+sr.stars+'-star '+sr.title+' (dominant '+sr.axis+').'+((player.prestige||0)<80?' Build your prestige to 80 and the guild will see you rewarded.':extra);
  } else if(p.kind==='dummy'){
    if(p.uses<=0){ dialogue='The dummy hangs in tatters. It has taught all it can.'; return; }
    p.uses--; player.charge=Math.min(player.maxMana,player.charge+12); sfx('swing'); burst(p.x,p.y,[210,190,140],8,2);
    showToast('Training! +12 charge'+(p.uses>0?' ('+p.uses+' left)':' — dummy destroyed'));
  } else if(p.kind==='book'){
    if(p.used){ dialogue='You have read this one. The margins are full of dead climbers\u2019 notes.'; return; }
    p.used=true; gainXP(6); sfx('level'); dialogue=pick(LORE).replace('Scholar:','The tome reads:');
    } else if(p.kind==='ore'){
    if(p.uses<=0){ dialogue='The vein is spent.'; return; }
    p.uses--; const c=4+Math.floor(rand(0,4)); coinCount+=c; sfx('coin'); burst(p.x,p.y,[220,200,140],8,2);
    showToast('Mined +'+c+' coins'+(p.uses>0?' ('+p.uses+' swings left)':' — vein spent'));
    } else if(p.kind==='plaque'){ dialogue=p.read||'The inscription has worn away.';
  } else if(p.kind==='orb'||p.kind==='monolith'){
    if(p.used){ dialogue='The orb is quiet now.'; return; }
    p.used=true; player.charge=Math.min(player.maxMana,player.charge+12); sfx('level'); burst(p.x,p.y,[150,215,255],14,2.5);
    FT.lore=FT.lore||[];
    let next=-1; for(let i9=0;i9<ECHOES.length;i9++){ if(!FT.lore.includes(i9)){ next=i9; break; } }
    if(next>=0){ FT.lore.push(next); saveFeats();
      showToast('✦ Echo of the Tower recovered ('+FT.lore.length+'/'+ECHOES.length+')');
      dialogue='Echo '+(next+1)+' — \u201C'+ECHOES[next]+'\u201D'; }
    else dialogue=pick(ECHO_LORE);
  } else if(p.kind==='stone'){
    if(p.used){ dialogue='The stone\'s light is spent.'; return; }
    p.used=true; player.hp=Math.min(player.maxHp,player.hp+12); player.charge=Math.min(player.maxMana,player.charge+20); sfx('level');
    burst(p.x,p.y,[150,235,150],14,2.5); showToast('The spirits bless you. (+12 HP, +20 charge)');
  } else if(p.kind==='anvil'){
    if(p.used){ dialogue='The anvil has cooled.'; return; }
    p.used=true; player.charge=Math.min(player.maxMana,player.charge+18); sfx('hit'); burst(p.x,p.y,[240,180,90],10,2.5);
    showToast('You temper your gear by the forge. (+18 charge)');
  } else if(p.kind==='keg'){
    if(p.used){ dialogue='The keg runs dry.'; return; }
    p.used=true; player.hp=Math.min(player.maxHp,player.hp+14); sfx('coin'); burst(p.x,p.y,[200,160,90],8,2);
    showToast('A hearty draught. (+14 HP)');
  } else if(p.kind==='cookfire'){
    if(p.used){ dialogue='Only embers remain.'; return; }
    p.used=true; player.hp=Math.min(player.maxHp,player.hp+18); sfx('level'); burst(p.x,p.y,[255,150,70],14,3);
    showToast('You rest a moment by the fire. (+18 HP)');
  }
}
// ----- per-floor quests offered by the Herald -----
function genQuest(f){
  const opts=['treasure'];
  if(!realm || realm.special!=='peaceful') opts.push('cull');     // no culling the peaceful elves
  if(!realm || realm.special!=='champions') opts.push('bounty');  // the Court has no single gatekeeper
  if(nestSpots.length) opts.push('nest');
  if(vaultSpot) opts.push('vault');
  const type=pick(opts); let target=1, desc='';
  if(type==='cull'){ target=8+Math.floor(f/2); desc='Defeat '+target+' foes'; }
  else if(type==='treasure'){ target=2+Math.floor(rand(0,2)); desc='Open '+target+' chests'; }
  else if(type==='nest'){ desc='Destroy a monster nest'; }
  else if(type==='vault'){ desc='Loot the sealed vault'; }
  else { desc="Slay this floor's gatekeeper"; }
  return { type, target, progress:0, accepted:false, done:false, desc, rewardItem: rand(0,1)<0.5 };
}
function genMission(tier, f, used){
  const TN=['Recruit','Veteran','Elite'][tier-1];
  const opts=['treasure'];
  if(!realm || realm.special!=='peaceful') opts.push('cull');
  if(nestSpots.length) opts.push('nest');
  if(vaultSpot) opts.push('vault');
  if(!realm || realm.special!=='champions') opts.push('bounty');
  let pool=used?opts.filter(function(o){return used.indexOf(o)<0;}):opts; if(!pool.length) pool=opts;
  let type=pick(pool), target=1, desc=''; if(used) used.push(type);
  if(type==='cull'){ target=[5,10,16][tier-1]+Math.floor(f/2); desc='Defeat '+target+' foes'; }
  else if(type==='treasure'){ target=[1,2,3][tier-1]; desc='Open '+target+(target>1?' chests':' chest'); }
  else if(type==='nest'){ desc='Destroy a monster nest'; }
  else if(type==='vault'){ desc='Loot the sealed vault'; }
  else { desc='Slay the floor gatekeeper'; }
  const coin=[18,40,70][tier-1]+f*[3,5,8][tier-1], relic=(tier>=3?1:(tier===2?0.5:0));
  const m={ type, target, progress:0, accepted:false, done:false, desc, tier, tierName:TN, reward:{coin,relic}, rewardStr:'+'+coin+'c'+(tier>=3?' + relic':(tier===2?' + relic 50%':'')), rewardItem:relic>=1 };
  if(tier===3 && rand(0,1)<0.4){ m.tierName='Underworld'; m.reward={coin,relic:0,ticket:true}; m.rewardStr='+'+coin+'c + ◆ Black Market pass'; m.rewardItem=false; m.highAuth=true; }
  return m;
}
function openMissions(src){
  if(player.quest && player.quest.accepted && !player.quest.done){ dialogue='Mission Board: Finish your current mission first — '+player.quest.desc+(player.quest.target>1?' ('+player.quest.progress+'/'+player.quest.target+')':'')+'.'; return; }
  const F=floor, used=[], missions=[genMission(1,F,used),genMission(2,F,used),genMission(3,F,used)];
  const opts=missions.map(function(q){ return { label:q.tierName+'  ·  '+q.desc+'   ('+q.rewardStr+')', f:function(){ player.quest=q; q.accepted=true; sfx('coin'); showToast(q.tierName+' mission accepted — '+q.desc); dialogue='Mission Board: '+q.desc+'. Return when the deed is done.'; } }; });
  if(operation && !operation.done){ opts.unshift({ label:'District Operation  ·  '+operation.target+'   (+rep + stair access)', f:function(){
      waypoint={x:operation.x,y:operation.y}; sfx('coin'); dialogue='Mission Board: Operation pinned. '+operation.hint; } }); }
  opts.push({ label:'Leave', f:function(){ dialogue='Mission Board: The board keeps its names, climber.'; } });
  openChoices(src, '◆ THE MISSION BOARD — take a contract  ('+coinCount+'c)', opts);
}
function questBump(type){ const q=player&&player.quest; if(q&&q.accepted&&!q.done&&q.type===type){ q.progress++; if(q.progress>=q.target) questComplete(); } }
function questComplete(){ const q=player.quest; q.done=true; sfx('level'); addShake(.25); burst(player.x,player.y,[255,210,90],24,4);
  if(player.rep) player.rep.watch+=1;
  if(q.reward){ const r=q.reward; dropCoins(player.x,player.y,r.coin);
    let msg=(q.tierName?q.tierName+' ':'')+'mission complete!  +'+r.coin+'c';
    if(r.ticket){ player.bmTickets=(player.bmTickets||0)+1; msg+='  +  ◆ Black Market pass'; }
    else if(r.relic>=1 || (r.relic>0 && rand(0,1)<r.relic)) msg+='  +  '+grantItem(false);
    else { player.hp=Math.min(player.maxHp,player.hp+25); msg+='  +  25 HP'; }
    showToast(msg);
  } else {
    dropCoins(player.x,player.y,Math.min(22,12+floor));
    if(q.rewardItem) showToast('Quest complete! Reward: '+grantItem(false));
    else { player.hp=Math.min(player.maxHp,player.hp+30); showToast('Quest complete! Coins + 30 HP.'); }
  }
}
function addRequestOption(n,disp,opts){
  if(!n.escortDone && !n.follow && escortsThisFloor<2 && ['wanderer','shepherd','pedlar','climber'].includes(n.type) && props.some(p=>p.kind==='waystone')){
    opts.push({label:'Escort to a waystone', f(){ n.follow=true; escortsThisFloor++; dialogue=(n.given||(n.name.replace(/^the |^a |^an /,'')||'Local'))+': Right behind you.'; }}); return; }
  if(!(n.giver||n.type==='quester')) return;
  if(player.quest && !player.quest.done) return;
  if(floorQuestsGiven>=3 || realm.special) return;
  opts.push({label:'Take a task', f(){ if(n.socRequest){ dialogue=disp+': That\u2019s the task \u2014 go.'; return; } n.socRequest=true; floorQuestsGiven++;
    const e=nearIncident();
    if(e && e.kind==='feud'){ const tgt=4+Math.floor(floor/2); player.quest={type:'cull',target:tgt,progress:0,accepted:true,done:false,desc:'End the feud \u2014 cull '+tgt+' fighters',rewardItem:true}; }
    else { player.quest=genQuest(floor); player.quest.accepted=true; }
    sfx('coin'); dialogue=disp+': '+player.quest.desc+'. Reward as usual.'; openSocial(n); }});
}

// ----- Open-world floor generation -----
function inWall(x,y,pad){ pad=pad||0; for(const w of walls){ if(Math.abs(x-w.x)<w.w/2+pad && Math.abs(y-w.y)<w.h/2+pad) return true; } return false; }
function onHazardFloor(x,y,pad){ pad=pad||0; for(const f of floors){ if(!(f.water||f.hazard||f.spring)) continue;
    if(Math.abs(x-f.x)<f.w/2+pad && Math.abs(y-f.y)<f.h/2+pad) return f; } return null; }
function scatterPos(){ // an open spot away from entrance/exit, not inside walls, never on lava/water
  for(let i=0;i<80;i++){ const x=rand(-WORLD_HW+5,WORLD_HW-5), y=rand(-WORLD_HH+5,WORLD_HH-5);
    if(x<-WORLD_HW+20 && Math.abs(y)<6) continue;          // entrance lane
    if(exit && len(x-exit.x,y-exit.y)<8) continue;          // exit approach
    if(inWall(x,y,1.2)) continue;
    if(inSafe(x,y)) continue;                              // towns and cities are sanctuary
    if(onHazardFloor(x,y,1.0)) continue;                  // not in ponds, lava or void
    if(floors.some(f=>f.road && Math.abs(x-f.x)<f.w/2+2.6 && Math.abs(y-f.y)<f.h/2+2.6)) continue;   // keep sites & solids off the streets
    return [x,y]; }
  for(let gx=-WORLD_HW+14; gx<WORLD_HW-14; gx+=18) for(let gy=-WORLD_HH+12; gy<WORLD_HH-12; gy+=16){   // last resort: a scanned open cell, never the road
    if(!inWall(gx,gy,1.2) && !inSafe(gx,gy) && !onHazardFloor(gx,gy,1) && !onRoad(gx,gy,2.6)) return [gx,gy]; }
  return [WORLD_HW-12, WORLD_HH-12];
}
function building(cx,cy,w,h){ const L=cx-w/2,R=cx+w/2,T=cy-h/2,B=cy+h/2,g=1.6;
  const pad={x:cx,y:cy,w:w-TW,h:h-TW,col:'#2a2730'}; floors.push(pad);
  const w0=walls.length;
  hwall(L,R,T); vwall(T,B,L); vwall(T,B,R); hwall(L,cx-g,B); hwall(cx+g,R,B); // door gap on the south wall
  const _b={x:cx,y:cy,w,h,pad,wallRefs:walls.slice(w0)}; buildings.push(_b);   // roof, doorway, warm windows
  return _b;
}
function vaultRoom(cx,cy,w,h){ const L=cx-w/2,R=cx+w/2,T=cy-h/2,B=cy+h/2,g=1.6;
  floors.push({x:cx,y:cy,w:w,h:h,col:'#241c30'});
  hwall(L,R,T,false,2); hwall(L,R,B,false,2); vwall(T,B,R,false,2); vwall(T,cy-g,L,false,2); vwall(cy+g,B,L,false,2); // reinforced vault walls; entrance gap on the west wall
}
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(rand(0,i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
// ----- feature builders (each places its structure near cx,cy) -----
function buildTown(cx,cy){
  floors.push({x:cx,y:cy,w:26,h:20,col:'#3a3742'});
  safeZones.push({x:cx,y:cy,w:26,h:20});
  building(cx-8,cy-5,7,5); building(cx+7,cy-5,7,5); building(cx,cy+6,8,5);
  props.push({kind:'sign',x:cx,y:cy-8.5,text:'✦ TOWN ✦',big:true});
  const tp=shuffle(['merchant','healer','smith','wanderer','guard','child','cook','gambler','tavernkeep','storyteller']).slice(0,8);
  const ns=[[cx-8,cy-1],[cx+7,cy-1],[cx,cy+2],[cx+3,cy-8],[cx-4,cy+2],[cx+10,cy+6],[cx-10,cy+5],[cx+1,cy-3]];
  for(let i=0;i<8;i++) npcs.push(makeNPC(tp[i],ns[i][0],ns[i][1]));
  props.push({kind:'well',x:cx+2,y:cy-1,used:false});
  props.push({kind:'stall',x:cx-5,y:cy+3},{kind:'stall',x:cx+6,y:cy+3});
  props.push({kind:'lamp',x:cx-11,y:cy-8},{kind:'lamp',x:cx+11,y:cy-8},{kind:'lamp',x:cx-11,y:cy+8},{kind:'lamp',x:cx+11,y:cy+8});
  props.push({kind:'anvil',x:cx+9,y:cy-3});
  props.push({kind:'chest',x:cx-8,y:cy-8,opened:false,big:false});
  props.push({kind:'board',x:cx+4,y:cy-2}); props.push({kind:'newsstand',x:cx-4,y:cy-2,reads:0}); props.push({kind:'dummy',x:cx+10,y:cy+2,uses:3});
}
// a walled CITY — the floor's civilised heart: gates, market stalls, a crowd of citizens
function buildCity(cx,cy){
  const w=54,h=36,L=cx-w/2,R=cx+w/2,T=cy-h/2,B=cy+h/2,g=2.8;
  floors.push({x:cx,y:cy,w,h,col:'#3d3a46'});
  safeZones.push({x:cx,y:cy,w,h});
  hwall(L,R,T); hwall(L,R,B);
  vwall(T,cy-g,L); vwall(cy+g,B,L); vwall(T,cy-g,R); vwall(cy+g,B,R);   // west + east gates
  props.push({kind:'sign',x:cx,y:T-1.7,text:'✦ '+(realm.cityName||'THE FREE CITY')+' ✦',big:true});
  props.push({kind:'lamp',x:L+1.3,y:cy-3.4,tall:true},{kind:'lamp',x:L+1.3,y:cy+3.4,tall:true},
             {kind:'lamp',x:R-1.3,y:cy-3.4,tall:true},{kind:'lamp',x:R-1.3,y:cy+3.4,tall:true});
  building(cx-14,cy-8,8,6); building(cx-3,cy-8,8,6); building(cx+9,cy-8,9,6);
  building(cx-10,cy+8,9,6); building(cx+7,cy+8,8,6);
  props.push({kind:'lamp',x:cx-18,y:cy-10},{kind:'lamp',x:cx+18,y:cy-10},{kind:'lamp',x:cx-18,y:cy+10},{kind:'lamp',x:cx+18,y:cy+10},{kind:'lamp',x:cx,y:cy-12});
  props.push({kind:'anvil',x:cx+14,y:cy+5});
  for(let i=0;i<6;i++) props.push({kind:'stall',x:cx-15+i*6,y:cy+3,hue:i});
  props.push({kind:'fountain',x:cx,y:cy-3});
  building(cx-22,cy,7,5); building(cx+19,cy,7,5);
  const cast=shuffle(['merchant','healer','smith','guard','guard','scholar','cook','gambler','bard','monk','child','wanderer','storyteller','priest','tavernkeep','courier']).slice(0,12);
  cast.forEach((t,i)=>{ npcs.push(makeNPC(t, cx-15+(i%4)*10+rand(-2,2), cy-4+Math.floor(i/4)*4+rand(-1,1))); });
  props.push({kind:'chest',x:cx+17,y:cy+11,opened:false,big:false});
  props.push({kind:'board',x:cx+8,y:cy-3}); props.push({kind:'newsstand',x:cx+2,y:cy-3,reads:0}); props.push({kind:'well',x:cx-8,y:cy-3}); props.push({kind:'dummy',x:cx-18,y:cy+10,uses:3});
}
// a roadside INN — small sanctuary; resting inside slowly mends you
function buildInn(cx,cy){
  floors.push({x:cx,y:cy,w:11,h:8,col:'#3a3026'});
  safeZones.push({x:cx,y:cy,w:11,h:8,heal:true});
  building(cx,cy-1,7,5);
  props.push({kind:'sign',x:cx,y:cy-5.4,text:'⌂ The Resting Flame ⌂'});
  npcs.push(makeNPC('innkeep',cx-3,cy+1.5)); if(rand(0,1)<0.6) npcs.push(makeNPC('bard',cx+3,cy+1.5));
}
// a WAYSTONE — attune it, then fold space between attuned stones
function buildWaystone(cx,cy){ props.push({kind:'waystone',x:cx,y:cy,attuned:false}); }
// the ARENA — three opt-in waves for a sealed prize
function buildArena(cx,cy){
  for(let k=0;k<14;k++){ const a=k/14*6.28; if(Math.abs(Math.sin(a))>.93) continue;
    walls.push({x:cx+Math.cos(a)*12, y:cy+Math.sin(a)*9.5, w:1.7, h:1.7}); }
  floors.push({x:cx,y:cy,w:22,h:17,col:'#473a2a'});
  props.push({kind:'sign',x:cx,y:cy-11,text:'⚔ THE ARENA ⚔',big:true});
  props.push({kind:'chest',x:cx,y:cy-5,opened:false,big:true,locked:true,arenaChest:true});
  npcs.push(makeNPC('arenamaster',cx+3,cy+5)); arenaSpot={x:cx,y:cy};
}
function buildTowerWatch(cx,cy){
  floors.push({x:cx,y:cy,w:8,h:8,col:'#3a3c4a'});
  hwall(cx-4,cx+4,cy-4); vwall(cy-4,cy+4,cx-4); vwall(cy-4,cy+4,cx+4); hwall(cx-4,cx-1.2,cy+4); hwall(cx+1.2,cx+4,cy+4);
  props.push({kind:'sign',x:cx,y:cy-5.4,text:'♜ Watchtower'});
  npcs.push(makeNPC('watchman',cx,cy-1)); props.push({kind:'chest',x:cx+2,y:cy+2,opened:false,big:false});
}
function buildEnchanter(cx,cy){
  floors.push({x:cx,y:cy,w:9,h:9,col:'#2e2440'});
  props.push({kind:'sign',x:cx,y:cy-5.6,text:'☆ Enchanter\u2019s Tower ☆'});
  npcs.push(makeNPC('enchanter',cx,cy)); props.push({kind:'shrine',x:cx+3,y:cy+2,used:false});
}
function buildBanditCamp(cx,cy){
  floors.push({x:cx,y:cy,w:16,h:12,col:'#3a2e26'});
  for(const t of [[-5,-3],[5,-3],[0,4]]) walls.push({x:cx+t[0],y:cy+t[1],w:2.6,h:2.2});   // tents
  props.push({kind:'sign',x:cx,y:cy-7,text:'⚑ Bandit Camp ⚑'});
  props.push({kind:'chest',x:cx,y:cy,opened:false,big:true});
  pendingMobs.push({x:cx,y:cy,pack:4});   // a pack of this realm's foes squats here
}
function buildMonument(cx,cy){
  floors.push({x:cx,y:cy,w:12,h:10,col:'#3c3c44'});
  props.push({kind:'statue',x:cx,y:cy-1});
  props.push({kind:'plaque',x:cx,y:cy+3.4,read:'Plaque: \u201CTo every climber who fell so others could map the way.\u201D'});
  npcs.push(makeNPC('priest',cx+3,cy+1));
}
function buildSpring(cx,cy){ floors.push({x:cx,y:cy,w:9,h:7,col:'#1e4a4a',spring:true}); props.push({kind:'sign',x:cx,y:cy-4.6,text:'♨ Hot Spring'}); }
function buildMine(cx,cy){
  floors.push({x:cx,y:cy,w:13,h:10,col:'#33302c'});
  props.push({kind:'sign',x:cx,y:cy-6,text:'⛏ Mine'});
  for(let i=0;i<3;i++) props.push({kind:'ore',x:cx-4+i*4,y:cy+rand(-2,2),uses:3});
  npcs.push(makeNPC('miner',cx,cy+3));
}
// the TAVERN — a hearth, a menu, and rumors worth their coin
function buildTavern(cx,cy){
  floors.push({x:cx,y:cy,w:13,h:10,col:'#3c2f22'});
  safeZones.push({x:cx,y:cy,w:13,h:10});
  building(cx,cy-1.5,9,6);
  props.push({kind:'sign',x:cx,y:cy-6.4,text:'☕ '+pick(['The Drunken Griffin','The Resting Blade','The Tipsy Slime','The Climber\u2019s Rest'])+' ☕'});
  npcs.push(makeNPC('tavernkeep',cx-2,cy+2)); npcs.push(makeNPC(pick(['gambler','bard','wanderer']),cx+3,cy+2));
  props.push({kind:'keg',x:cx+4.5,y:cy+3.4});
  { const d=makeNPC('drunkard',cx+4.5,cy+3.6); d.civ=true; d.roam=true; d.post={x:cx,y:cy+3,r:6}; npcs.push(d); }
  { const b=makeNPC('busker',cx-4.5,cy+3.6); b.civ=true; b.post={x:b.x,y:b.y,r:1.6}; b.roam=true; npcs.push(b); }
}
// the LIBRARY — quiet shelves and three readable tomes
function buildLibrary(cx,cy){
  floors.push({x:cx,y:cy,w:12,h:9,col:'#2c2c3a'});
  building(cx,cy-1,8,5);
  props.push({kind:'sign',x:cx,y:cy-5.8,text:'📜 The Athenaeum'});
  npcs.push(makeNPC('scholar',cx-3,cy+2)); npcs.push(makeNPC('scholar',cx+3,cy+2));
  for(let i=0;i<3;i++) props.push({kind:'book',x:cx-3+i*3,y:cy+3.3,used:false});
}
function buildCaravan(cx,cy){
  floors.push({x:cx,y:cy,w:15,h:9,col:'#3e352a'});
  props.push({kind:'wagon',x:cx-4,y:cy-1}); props.push({kind:'wagon',x:cx+4,y:cy+1});
  props.push({kind:'sign',x:cx,y:cy-5.4,text:'☷ Caravan'});
  npcs.push(makeNPC('caravaneer',cx,cy)); npcs.push(makeNPC('guard',cx-5,cy+2));
}
// the arena's waves draw from the floor's own bestiary
function spawnArenaWave(){
  arenaState.wave++;
  const n=3+arenaState.wave+Math.floor(floor/3);
  for(let i=0;i<n;i++){ const a=rand(0,6.28);
    const m=MOB(pick([...realm.pool,realm.sig]), arenaState.cx+Math.cos(a)*7, arenaState.cy+Math.sin(a)*5);
    m.arena=true; m.provoked=true; }
  showToast('ARENA — WAVE '+arenaState.wave+' / '+arenaState.total); 
}
// the PALACE — restricted ground. Enter it and the wardens demand answers, then attempt an arrest.
function buildPalace(cx,cy,name,wardenKind){
  const w=28,h=19,L=cx-w/2,R=cx+w/2,T=cy-h/2,B=cy+h/2,g=2.4;
  floors.push({x:cx,y:cy,w,h,col:'#3c3346'});
  hwall(L,R,T); vwall(T,B,L); vwall(T,B,R); hwall(L,cx-g,B); hwall(cx+g,R,B);   // south gate
  props.push({kind:'sign',x:cx,y:T-1.7,text:'♛ '+name.toUpperCase()+' — NO ENTRY ♛',big:true});
  restricted.push({x:cx,y:cy,w:w-1.5,h:h-1.5,name});
  // the throne treasury: rich, and very illegal to touch
  props.push({kind:'chest',x:cx-4,y:cy-4,opened:false,big:true});
  props.push({kind:'chest',x:cx+4,y:cy-4,opened:false,big:true});
  props.push({kind:'shrine',x:cx,y:cy-5.5,used:false});
  for(let i=0;i<3;i++) props.push({kind:'stall',x:cx-6+i*6,y:cy+4,hue:i});      // royal galleries
  // warden detail: stationed, courteous, and entirely willing to throw you in a cell
  for(const sp of [[cx-7,cy],[cx+7,cy],[cx,cy-2],[cx-2,cy+6]]){
    const wd=MOB(wardenKind, sp[0], sp[1]);
    wd.warden=true; wd.neutralC=true; wd.hp=Math.round(wd.maxHp*1.9); wd.maxHp=wd.hp; wd.speed*=1.15;
  }
  // the jail annex — east wall, one door
  const jx=R+5, jy=cy+4;
  floors.push({x:jx,y:jy,w:6.5,h:6.5,col:'#241f28'});
  hwall(jx-3.2,jx+3.2,jy-3.2); hwall(jx-3.2,jx+3.2,jy+3.2); vwall(jy-3.2,jy+3.2,jx+3.2);
  vwall(jy-3.2,jy-1,jx-3.2); vwall(jy+1,jy+3.2,jx-3.2);                          // west door gap
  props.push({kind:'sign',x:jx,y:jy-4.6,text:'⛓ Jail ⛓'});
  jailCell={x:jx,y:jy,doorX:jx-3.2,doorY:jy,doorW:TW,doorH:2.2};
  // the Magistrate keeps a bench by the cells — fines, bail and writs, for the right coin
  { const mg=makeNPC('magistrate', jx, jy-0.6); mg.post={x:mg.x,y:mg.y,r:1.5}; npcs.push(mg);
    props.push({kind:'sign',x:jx,y:jy-4.6-1.4,text:'⚖ Magistrate\u2019s Bench'}); }
}
function calmWardens(){ for(const m of mobs){ if(m.warden){ m.provoked=false; m.assistT=0; } } }
function arrestPlayer(){
  if(!jailCell) return;                       // no jail on this floor (non-palace) — never crash
  const fine=Math.min(20,coinCount); coinCount-=fine;
  player.x=jailCell.x; player.y=jailCell.y; player.iframe=1.2;
  wantedT=0; calmWardens(); jailT=5; if(player.rep) player.rep.watch-=2;
  if(jailDoor) walls=walls.filter(w=>w!==jailDoor);
  jailDoor={x:jailCell.doorX,y:jailCell.doorY,w:jailCell.doorW,h:jailCell.doorH,door:true}; walls.push(jailDoor);
  projectiles=[]; eProjectiles=[];
  sfx('hurt'); addShake(.45);
  showToast('ARRESTED! Fined '+fine+' coins. The cell door slams shut.');
  dialogue='Warden: "Sit. Think about what you did."';
}
// a FARMSTEAD — crop rows you may harvest; the farmer doesn't mind
function buildFarm(cx,cy){
  floors.push({x:cx,y:cy,w:20,h:13,col:'#2e3a1e'});
  props.push({kind:'sign',x:cx,y:cy-6,text:'⚘ Farmstead ⚘'});
  for(let r=0;r<3;r++) for(let c=0;c<5;c++) props.push({kind:'crop',x:cx-8+c*4,y:cy-3.5+r*3.5,used:false});
  building(cx+7,cy-3,5,4);
  npcs.push(makeNPC('farmer',cx+7,cy+1));
}
function buildGarden(cx,cy){
  floors.push({x:cx,y:cy,w:24,h:18,col:'#243a22'});
  props.push({kind:'sign',x:cx,y:cy-7,text:'❀ Garden ❀'});
  for(let i=0;i<13;i++) props.push({kind:'flower',x:cx+rand(-10,10),y:cy+rand(-7,7),used:false});
  props.push({kind:'shrine',x:cx,y:cy,used:false});
}
const POI_NAMES={ town:'a Town', city:'the Great City', inn:'a Wayside Inn', farm:'a Farmstead', garden:'a Garden', square:'a Town Square', guild:'the Guild Hall',
  vault:'the Sealed Vault', ruins:'Ancient Ruins', graveyard:'a Graveyard', pond:'a Pond', shrines:'Wayshrines',
  cache:'a Supply Cache', tavern:'a Tavern', library:'a Library', arena:'the Fighting Pit', tower:'a Watchtower',
  enchanter:"the Enchanter's Hut", banditcamp:'a Bandit Camp', monument:'an Old Monument', spring:'a Hot Spring',
  mine:'a Mine', caravan:'a Caravan Rest', homestead:'a Homestead', nest:'a Monster Warren',
  cart:'a Looted Cart', campsite:'a Wayfarers\u2019 Camp', orchard:'an Orchard', hamlet:'a Hamlet', market:'a Market', chapel:'a Quiet Chapel', shanty:'the Shantyrow' };
function spawnGangs(){
  if(realm.special) return;   // highwaymen ride the streets of every built (non-special) floor
  const roadF=floors.filter(f9=>f9.road && f9.w>6);
  const nG=1+(rand(0,1)<.5?1:0);
  for(let g9=0; g9<nG && roadF.length; g9++){
    const rd=pick(roadF), gx=rd.x+rand(-rd.w/2+3, rd.w/2-3), gy=rd.y+(rand(0,1)<.5?-3.2:3.2), gid='gang'+floor+'_'+g9;
    for(let i=0;i<3;i++){ const m=MOB(i===0?'swordsman':pick(['spearhunt','darter','swordsman']), gx+rand(-1.6,1.6), gy+rand(-1.2,1.2));
      m.gang=gid; m.sprung=false; m.sight=0; m.peaceful=false; m.provoked=false; m.elite=null;
      m.drop=(i===0?10:5); if(i===0){ m.hp=Math.round(m.hp*1.5); m.maxHp=m.hp; m.gangLeader=true; }
      m.stealth=true; }   // they lie low until you're close
  }
}
// ===================== STRUCTURAL SETS =====================
// The civilised land is laid out in distinct, often WALLED locations — a town, a garrison,
// a trading center and so on. Each is one big building, several buildings, or structures
// combined behind walls with a gate, and the people inside behave to match.
function compound(cx,cy,w,h,opts){
  opts=opts||{}; const gates=opts.gates||['S'], gw=opts.gateW||3.8;
  const L=cx-w/2,R=cx+w/2,T=cy-h/2,B=cy+h/2;
  floors.push({x:cx,y:cy,w,h,col:opts.col||'#34303c',dtint:opts.dtint});
  if(opts.safe!==false) safeZones.push({x:cx,y:cy,w,h});
  const tr=opts.tier;
  const segH=(x1,x2,y)=>{ const A=Math.min(x1,x2),Z=Math.max(x1,x2),n=Math.max(1,Math.round((Z-A)/WALL_SEG)),st=(Z-A)/n,hp=brkHp(tr);
    for(let i=0;i<n;i++) walls.push({x:A+st*(i+0.5),y,w:st,h:TW,cwall:true,brk:true,hp,maxHp:hp,struct:true,tier:tr}); };
  const segV=(y1,y2,x)=>{ const A=Math.min(y1,y2),Z=Math.max(y1,y2),n=Math.max(1,Math.round((Z-A)/WALL_SEG)),st=(Z-A)/n,hp=brkHp(tr);
    for(let i=0;i<n;i++) walls.push({x,y:A+st*(i+0.5),w:TW,h:st,cwall:true,brk:true,hp,maxHp:hp,struct:true,tier:tr}); };
  segH(L,R,T); segH(L,R,B); segV(T,B,L); segV(T,B,R);
  const gp=(gx,gy)=>{ walls=walls.filter(w9=> !(w9.cwall && Math.abs(w9.x-gx)<gw && Math.abs(w9.y-gy)<gw)); };
  for(const gt of gates){ const p = gt==='N'?[cx,T]:gt==='S'?[cx,B]:gt==='W'?[L,cy]:[R,cy];
    gp(p[0],p[1]); if(!opts.noLamp) props.push({kind:'lamp',x:p[0]+(gt==='W'?0.7:gt==='E'?-0.7:0),y:p[1]+(gt==='N'?0.7:gt==='S'?-0.7:0),tall:true}); }
  return {L,R,T,B};
}
// ===== SYSTEMIC DISTRICTS: packed blocks of small enclosed, furnished rooms with doors onto alleys =====
// Each room kind = floor tint + interior PROPS (furn, drawn via drawProp) + DECOS (deco e.g. crate/barrel,
// drawn via drawDeco — note: those render as decos[], NOT props) + resident NPCs (+ optional sign / hostile mobs).
const ROOM_KINDS={
  home:    { col:'#332e3a', npcs:['villager','peasant'],    furn:['well'],                   deco:['crate','barrel'] },
  shop:    { col:'#37302a', npcs:['merchant'],              furn:['stall','chest'],          sign:'⚖' },
  market:  { col:'#39312a', npcs:['pedlar','gambler'],      furn:['stall','awning'],         deco:['crate'], sign:'⚖' },
  tavern:  { col:'#352b20', npcs:['tavernkeep','drunkard'], furn:['keg','bench'],            deco:['barrel'], sign:'☕' },
  smithy:  { col:'#2f2a26', npcs:['smith'],                 furn:['anvil','ore','cookfire'], sign:'⚒' },
  forge:   { col:'#33271f', npcs:['smith','laborer'],       furn:['anvil','beacon'],         deco:['crate'], sign:'⚒' },
  chapel:  { col:'#2c2c3a', npcs:['priest'],                furn:['shrine','altar'] },
  cloister:{ col:'#2e2840', npcs:['monk','acolyte'],        furn:['shrine','obelisk'] },
  study:   { col:'#2e2a3a', npcs:['scholar'],               furn:['book','board'] },
  archive: { col:'#2b2b34', npcs:['scholar','magistrate'],  furn:['records','evidence'] },
  watch:   { col:'#2c303a', npcs:['guard'],                 furn:['dummy','board'] },
  garden:  { col:'#283224', npcs:['farmer'],                furn:['flower','planter'],       deco:['tree','bush'] },
  store:   { col:'#302c30', npcs:[],                        furn:['chest'],                  deco:['crate','barrel'] },
  den:     { col:'#2a2228', hostile:true, npcs:[],          furn:['chest','powderkeg'],      deco:['crate'], mobs:2 },
};
// A faction builds its district from a weighted mix of room kinds, fills the alleys with its own folk,
// and washes the ground in its banner colour (DISTRICTS[i].col -> the floor dtint honoured by paintGround).
const FACTION_THEME={
  watch:     { rooms:{watch:4,archive:3,study:2,home:2,shop:1,smithy:1},  folk:['watchman','errant','crier'],          gate:'watchman', block:'the Watch Quarter' },
  underworld:{ rooms:{market:4,shop:3,tavern:3,den:2,store:2,home:1},     folk:['gambler','beggar','pedlar','urchin'], gate:'gambler',  block:'the Market Rows' },
  guild:     { rooms:{forge:4,smithy:3,store:3,shop:1,tavern:1,home:1},   folk:['laborer','miner','caravaneer'],       gate:'laborer',  block:'the Forge Lane' },
  commune:   { rooms:{home:4,garden:3,chapel:2,shop:1,tavern:1,store:1},  folk:['farmer','washer','child'],            gate:'farmer',   block:'the Garden Walk' },
  cult:      { rooms:{cloister:4,chapel:3,study:3,archive:1,home:1},      folk:['acolyte','pilgrim','seer'],           gate:'acolyte',  block:'the Cloister' },
  town:      { rooms:{home:4,shop:3,tavern:2,smithy:2,study:1,watch:1,store:2,garden:1}, folk:['villager','drunkard','busker','dancer'], gate:'guard', block:'a Crowded District' },
};
function buildRoom(cx,cy,w,h,door,kind,tint){
  compound(cx,cy,w,h,{gates:[door], gateW:2.6, safe:!kind.hostile, col:kind.col, noLamp:true, dtint:tint, tier:0});   // district interior rooms = timber (smash-through)
  const corners=shuffle([[cx-w*0.30,cy-h*0.30],[cx+w*0.30,cy-h*0.30],[cx-w*0.30,cy+h*0.30],[cx+w*0.30,cy+h*0.30]]);
  // the door midpoint — keep furniture & folk clear of it
  const dmid = door==='S'?[cx,cy+h/2]:door==='N'?[cx,cy-h/2]:door==='W'?[cx-w/2,cy]:[cx+w/2,cy];
  let ci2=0; const slot=()=>{ let p=corners[ci2++%4]; if(len(p[0]-dmid[0],p[1]-dmid[1])<2.4) p=corners[ci2++%4]; return p; };
  for(const fk of (kind.furn||[])){ const p=slot();
    const o={kind:fk,x:p[0],y:p[1]}; if(fk==='ore'||fk==='dummy')o.uses=3; if(fk==='chest')o.opened=false; if(['book','stall'].includes(fk))o.used=false; props.push(o); }
  for(const dk of (kind.deco||[])){ const p=slot(); decos.push({type:dk,x:p[0],y:p[1],s:0.75+rand(0,0.3),seed:(ci2*13)&255,struct:true}); }
  for(const t of (kind.npcs||[])){ const n=makeNPC(t, cx+rand(-w*0.18,w*0.18), cy+rand(-h*0.14,h*0.14));
    n.civ=true; n.roam=true; n.post={x:n.x,y:n.y,r:1.8}; n.home={x:n.x,y:n.y}; npcs.push(n); }
  if(kind.hostile){ const nm=kind.mobs||1; for(let i=0;i<nm;i++) pendingMobs.push({kind:pick((realm&&realm.pool)||['slime']), x:cx+rand(-w*0.22,w*0.22), y:cy+rand(-h*0.22,h*0.22), setMob:true}); }
  if(kind.sign){ props.push({kind:'sign', x:cx, y:cy-h/2-0.8, text:kind.sign}); }
}
function buildDistrict(cx,cy,cols,rows,plan){
  const fac=(plan&&plan.faction)||'town', theme=FACTION_THEME[fac]||FACTION_THEME.town;
  const fc=(plan&&plan.col)||null, tint=fc?fc.join(','):null;
  const lampCol=fc?[Math.round(fc[0]*0.7+255*0.3),Math.round(fc[1]*0.7+205*0.3),Math.round(fc[2]*0.7+120*0.3)]:null;  // faction-tinted lamplight (blended toward warm)
  const RWd=9, RHd=7.4, AL=2.8;
  const cw=cols*RWd+(cols-1)*AL, ch=rows*RHd+(rows-1)*AL;
  const x0=cx-cw/2+RWd/2, y0=cy-ch/2+RHd/2;
  const bag=[]; for(const k in theme.rooms){ for(let i=0;i<theme.rooms[k];i++) bag.push(k); }
  const sides=['S','N','E','W'];
  for(let j=0;j<rows;j++) for(let i=0;i<cols;i++){
    const rxc=x0+i*(RWd+AL), ryc=y0+j*(RHd+AL);
    buildRoom(rxc,ryc, RWd-0.8, RHd-0.8, pick(sides), ROOM_KINDS[pick(bag)], tint);
  }
  // a few lamps down the alleys for the lived-in street feel — glowing in the faction's colour
  for(let i=0;i<cols-1;i++){ const lx=x0+i*(RWd+AL)+RWd/2+AL/2;
    props.push({kind:'lamp',x:lx,y:cy,tall:true,col:lampCol}); }
  // faction folk drift through the alleys (not pinned to a single room)
  const nf=2+Math.floor(rand(0,3));
  for(let i=0;i<nf;i++){ const n=makeNPC(pick(theme.folk), cx+rand(-cw*0.42,cw*0.42), cy+rand(-ch*0.42,ch*0.42));
    n.civ=true; n.roam=true; n.post={x:cx,y:cy,r:Math.max(cw,ch)*0.42}; n.home={x:n.x,y:n.y}; npcs.push(n); }
  // ---- a faction GATEWAY on the south threshold: colour banners + tinted lamps + a name sign + a posted sentinel ----
  const gy=cy+ch/2+1.6;
  decos.push({type:'banner',x:cx-2.4,y:gy,s:1.1,seed:7,col:fc||undefined,struct:true});
  decos.push({type:'banner',x:cx+2.4,y:gy,s:1.1,seed:8,col:fc||undefined,struct:true});
  props.push({kind:'lamp',x:cx-3.7,y:gy,tall:true,col:lampCol},{kind:'lamp',x:cx+3.7,y:gy,tall:true,col:lampCol});
  props.push({kind:'sign',x:cx,y:gy-1.3,text:theme.block});
  { const g=makeNPC(theme.gate||'guard', cx, gy+0.8); g.civ=true; g.gateSentinel=true; g.factionGate=fac;
    g.roam=true; g.post={x:g.x,y:g.y,r:1.0}; g.home={x:g.x,y:g.y};   // stays at the gate but turns to face & challenges passers-by
    g.barkLines=(GATE_VOICE[fac]||GATE_VOICE.town).bark.slice(); npcs.push(g); }
  poiList.push({x:cx,y:cy,kind:'set',name:theme.block,found:false});
}

const SET_SIZES = { S:[16,13], M:[24,18], L:[31,23] };
// each set: name, sigil, size S/M/L, walled, gates, building count (bn) or a central hall,
// a courtyard feature, props, decos, npc roles ([type,count,where]), hostile mobs, flags.
const STRUCT_SETS = [
  { key:'town',     name:'the Walled Town',     sigil:'❖', size:'L', gates:['S','E'], bn:5, feat:'well',
    props:['stall','stall'], decos:['barrel','bush'], npcs:[['guard',2,'gate'],['tavernkeep',1,'in'],['villager',3,'in'],['merchant',1,'in'],['child',2,'in'],['gambler',1,'in']] },
  { key:'garrison', name:'the Garrison',         sigil:'⚔', size:'L', gates:['S'], bn:4, feat:'dummy',
    props:['dummy','dummy','board'], decos:['banner','banner','crate'], npcs:[['guard',3,'gate'],['guard',2,'in'],['smith',1,'in'],['noble',1,'in']] },
  { key:'trade',    name:'the Trading Center',   sigil:'⚜', size:'L', gates:['S','W'], bn:4, feat:'stall',
    props:['stall','stall','stall','chest'], decos:['crate','crate','barrel'], npcs:[['guard',1,'gate'],['merchant',3,'in'],['pedlar',2,'in'],['gambler',1,'in'],['caravaneer',1,'in']] },
  { key:'keep',     name:'the Keep',             sigil:'♜', size:'L', gates:['S'], hall:[14,11], feat:'board',
    props:['board'], decos:['banner','banner','pillar','pillar'], npcs:[['guard',4,'gate'],['noble',1,'in'],['watchman',1,'in']] },
  { key:'monastery',name:'the Monastery',        sigil:'✝', size:'M', gates:['S'], bn:3, feat:'shrine',
    props:['monolith'], decos:['brazier','brazier','pillar'], npcs:[['priest',1,'in'],['monk',2,'in'],['pilgrim',2,'in']] },
  { key:'manor',    name:'the Manor Estate',     sigil:'⚐', size:'L', gates:['S'], hall:[15,11], feat:'fountain',
    props:['flower','flower'], decos:['tree','bush','bush','pillar'], npcs:[['guard',2,'gate'],['noble',1,'in'],['villager',3,'in'],['cook',1,'in']] },
  { key:'gaol',     name:'the Gaol',             sigil:'⛓', size:'M', gates:['S'], bn:2, feat:'board', cage:true,
    props:['board'], decos:['banner','bones'], npcs:[['watchman',2,'gate'],['guard',1,'in'],['beggar',1,'caged'],['urchin',1,'caged']] },
  { key:'academy',  name:'the Academy',          sigil:'⚛', size:'M', gates:['S'], bn:3, feat:'book',
    props:['book','book'], decos:['pillar','pillar'], npcs:[['scholar',2,'in'],['sage',1,'in'],['storyteller',1,'in']] },
  { key:'bazaar',   name:'the Grand Bazaar',     sigil:'☂', size:'L', gates:['S','E','W'], bn:2, feat:'fountain',
    props:['stall','stall','stall','stall'], decos:['crate','barrel','banner'], npcs:[['merchant',3,'in'],['cook',1,'in'],['pedlar',2,'in'],['bard',1,'in']] },
  { key:'farmstead',name:'the Farmstead',        sigil:'⚘', size:'M', gates:['S','N'], bn:3, feat:'well',
    props:['board'], decos:['bush','bush','bush','barrel'], npcs:[['farmer',2,'in'],['peasant',2,'in'],['laborer',1,'in']] },
  { key:'watchpost',name:'the Watchtower Post',  sigil:'⌖', size:'S', gates:['S'], bn:1, feat:'board',
    props:['board'], decos:['banner','crate'], npcs:[['watchman',2,'gate'],['guard',1,'in']] },
  { key:'forge',    name:'the Forge',            sigil:'⚒', size:'M', gates:['S'], bn:3, feat:'anvil',
    props:['anvil','cookfire','ore'], decos:['crate','rock'], npcs:[['smith',2,'in'],['miner',1,'in'],['laborer',1,'in']] },
  { key:'chapel',   name:'the Chapel',           sigil:'✚', size:'S', gates:['S'], bn:1, feat:'shrine', graves:true,
    props:[], decos:['pillar','bones'], npcs:[['priest',1,'in'],['pilgrim',2,'in']] },
  { key:'inn',      name:'the Wayhouse Inn',     sigil:'⌂', size:'M', gates:['S'], bn:2, feat:'well',
    props:['stall','board'], decos:['barrel','barrel','bush'], npcs:[['tavernkeep',1,'in'],['bard',1,'in'],['wanderer',2,'in'],['courier',1,'in']] },
  { key:'apothecary',name:'the Apothecary',      sigil:'✤', size:'S', gates:['S'], bn:1, feat:'shrine',
    props:['flower','flower'], decos:['bush','mushroom'], npcs:[['healer',1,'in'],['hermit',1,'in']] },
  { key:'guildhall', name:'the Bounty Guild',     sigil:'⚔', size:'M', gates:['S','E'], bn:2, feat:'board',
    props:['board','keg'], decos:['crate','barrel'], npcs:[['bountymaster',1,'in'],['errant',2,'in'],['guard',1,'gate']] },
  { key:'bandit',   name:'a Bandit Hideout',     sigil:'☠', size:'M', gates:['S','E'], bn:2, feat:'cookfire', hostile:true,
    props:['cookfire','chest'], decos:['crate','barrel','banner'], mobs:[['swordsman',3],['spearhunt',2]] },
  { key:'hermitage',name:'the Hermitage',        sigil:'☖', size:'S', gates:['S'], bn:1, feat:'shrine',
    props:[], decos:['rock','bush','crystal'], npcs:[['hermit',1,'in'],['pilgrim',1,'in']] },
  { key:'caravan',  name:'the Caravan Yard',     sigil:'⛟', size:'M', gates:['S','W'], bn:2, feat:'stall',
    props:['stall','chest','board'], decos:['crate','crate','barrel'], npcs:[['caravaneer',2,'in'],['merchant',1,'in'],['guard',1,'gate']] },
  { key:'necropolis',name:'the Necropolis',      sigil:'†', size:'M', gates:['S'], bn:2, feat:'monolith', graves:true,
    props:[], decos:['pillar','bones','pillar','bones'], npcs:[['pilgrim',2,'in'],['hermit',1,'in'],['storyteller',1,'in']] },
  { key:'pit',      name:'the Fighting Pit',     sigil:'⚐', size:'M', gates:['S','N'], bn:0, feat:'dummy',
    props:['dummy','dummy'], decos:['banner','banner','banner'], npcs:[['arenamaster',1,'in'],['guard',1,'gate'],['villager',2,'in'],['gambler',1,'in']] },
  { key:'grove',    name:'the Shrine Grove',     sigil:'❀', size:'S', gates:['S','N'], bn:0, feat:'shrine',
    props:['flower','flower'], decos:['tree','tree','bush','bush'], npcs:[['monk',2,'in'],['pilgrim',1,'in']] },
  { key:'minecamp', name:'the Mine Camp',        sigil:'⛏', size:'M', gates:['S'], bn:2, feat:'ore',
    props:['ore','cookfire','chest'], decos:['rock','rock','crate'], npcs:[['miner',2,'in'],['guard',1,'gate'],['laborer',1,'in']] },
];
function buildSet(cx,cy,S,faceGate){
  const sz=SET_SIZES[S.size]||SET_SIZES.M, w=sz[0], h=sz[1];
  const walled = S.walled!==false;
  let gates=(S.gates||['S']).slice(); if(faceGate && !gates.includes(faceGate)) gates.push(faceGate);
  if(walled) compound(cx,cy,w,h,{gates, safe:!S.hostile, col:S.hostile?'#2c2630':'#34303c'});
  else { floors.push({x:cx,y:cy,w,h,col:'#322e3a'}); if(!S.hostile) safeZones.push({x:cx,y:cy,w,h}); }
  props.push({kind:'sign',x:cx,y:cy-h/2-1.4,text:S.sigil+' '+S.name+' '+S.sigil,big:true});
  const bw=Math.min(5.4,w*0.30), bh=Math.min(4.2,h*0.30);
  if(S.hall){ const b=building(cx,cy-0.5,S.hall[0],S.hall[1]); b.fixed=true; }
  const ring=[[-w*0.27,-h*0.25],[w*0.27,-h*0.25],[-w*0.27,h*0.25],[w*0.27,h*0.25],[0,-h*0.30],[-w*0.32,h*0.10]];
  for(let i=0;i<(S.bn||0) && i<ring.length;i++){ const p=ring[i]; const b=building(cx+p[0],cy+p[1],bw,bh); b.fixed=true; }
  if(S.feat){ const f={kind:S.feat,x:cx,y:cy+0.4}; if(S.feat==='dummy'||S.feat==='ore') f.uses=3; if(['book','shrine','stall'].includes(S.feat)) f.used=false; props.push(f); }
  let pi=0; for(const pk of (S.props||[])){ const a=(pi++/Math.max(1,S.props.length))*6.28+0.5;
    const pp={kind:pk,x:cx+Math.cos(a)*w*0.26,y:cy+Math.sin(a)*h*0.20}; if(pk==='dummy'||pk==='ore')pp.uses=3; if(['book','stall'].includes(pk))pp.used=false; if(pk==='chest')pp.opened=false; props.push(pp); }
  let di=0; for(const dk of (S.decos||[])){ const a=(di++/Math.max(1,S.decos.length))*6.28+2.0;
    decos.push({type:dk,x:cx+Math.cos(a)*w*0.33,y:cy+Math.sin(a)*h*0.30,s:0.7+rand(0,0.4),seed:di*7,struct:true}); }
  if(S.graves){ for(let i=0;i<6;i++) walls.push({x:cx-w*0.28+(i%3)*(w*0.26),y:cy-2+Math.floor(i/3)*5,w:0.9,h:1.6,ruin:true}); }
  if(S.cage){ for(let i=0;i<5;i++) walls.push({x:cx-3+i*1.5,y:cy+h*0.22,w:0.4,h:2.4,cage:true}); }   // cell bars (kept by the road-punch)
  for(const role of (S.npcs||[])){ const type=role[0], cnt=role[1], where=role[2];
    for(let k=0;k<cnt;k++){ let nx,ny;
      if(where==='gate'){ const gt=gates[0];
        if(gt==='N'){ nx=cx+rand(-2.5,2.5); ny=cy-h/2+1.8; }
        else if(gt==='S'){ nx=cx+rand(-2.5,2.5); ny=cy+h/2-1.8; }
        else if(gt==='W'){ nx=cx-w/2+1.8; ny=cy+rand(-2.5,2.5); }
        else { nx=cx+w/2-1.8; ny=cy+rand(-2.5,2.5); } }
      else if(where==='caged'){ nx=cx-2+k*2; ny=cy+h*0.30; }
      else { const a=rand(0,6.28), rr=rand(2.5,Math.min(w,h)*0.30); nx=cx+Math.cos(a)*rr; ny=cy+Math.sin(a)*rr*0.8; }
      const n=makeNPC(type,nx,ny); n.civ=true; n.roam=(where==='in'); n.post={x:n.x,y:n.y,r:where==='gate'?2.2:3}; n.home={x:n.x,y:n.y};
      npcs.push(n); } }
  for(const ms of (S.mobs||[])){ const type=ms[0], cnt=ms[1]; for(let k=0;k<cnt;k++){ pendingMobs.push({kind:type, x:cx+rand(-w*0.3,w*0.3), y:cy+rand(-h*0.3,h*0.3), setMob:true}); } }
  return S.name;
}
function fillBuildings(){
  let added=0; const cap = floor<=2 ? 16 : 9, chance = floor<=2 ? .22 : .15;
  for(let gx=-WORLD_HW+14; gx<WORLD_HW-12 && added<cap; gx+=13){
    for(let gy=-WORLD_HH+12; gy<WORLD_HH-10 && added<cap; gy+=12){
      if(rand(0,1)>chance) continue;
      const x=gx+rand(-3,3), y=gy+rand(-2.5,2.5);
      if(len(x-exit.x,y-exit.y)<15 || len(x-(-WORLD_HW+8),y-0)<12) continue;
      if(inSafe(x,y)) continue;
      let ok=true;
      for(const b of buildings){ if(len(b.x-x,b.y-y)<7){ ok=false; break; } }
      if(ok) for(const w9 of walls){ if(!w9.deco && Math.abs(x-w9.x)<w9.w/2+3 && Math.abs(y-w9.y)<w9.h/2+2.6){ ok=false; break; } }
      if(ok) for(const p of poiList){ if(len(p.x-x,p.y-y)<8.5){ ok=false; break; } }
      if(ok) for(const f9 of floors){ if(f9.road && Math.abs(x-f9.x)<f9.w/2+3.4 && Math.abs(y-f9.y)<f9.h/2+3.0){ ok=false; break; } }
      if(!ok) continue;
      const bw9=3.8+rand(0,1.6), bh9=3.2+rand(0,1.2);
      building(x,y,bw9,bh9); added++;
      if(rand(0,1)<.3){ const n=makeNPC(pick(['villager','peasant','laborer','child','beggar']), x+rand(-1,1), y+2.5); n.civ=true; n.roam=true; n.post={x:n.x,y:n.y,r:3}; npcs.push(n); }
      if(rand(0,1)<.18) props.push({kind:'lamp',x:x+bw9/2+0.9,y:y+0.8});
    } }
}
function populateHaven(){
  // visitors: species from the higher realms come down to see the lower floors
  for(let i=0;i<10+Math.floor(rand(0,5));i++){ const r9=pick(REALMS.filter((r,ri)=>ri!==realmIndex(floor)));
    const [x,y]=scatterPos(); const m=MOB(pick(r9.pool), x, y);
    m.peaceful=true; m.visitor=true; m.elite=null; m.eliteName=null; }
  // the city watch: police who warn, then act
  for(let i=0;i<5;i++){ const [x,y]=scatterPos(); const g=MOB('legion', x, y);
    g.police=true; g.neutralC=true; g.elite=null; g.touch=Math.round(10+floor*2);
    const [bx,by]=scatterPos(); g.patrol={ax:x,ay:y,bx,by,toB:true}; }
  // cutpurses work the crowds
  for(let i=0;i<3+Math.floor(rand(0,3));i++){ const [x,y]=scatterPos(); const t=MOB('shade', x, y);
    t.thief=true; t.peaceful=false; t.provoked=false; t.touch=0; t.sight=0; t.speed=4.6;
    t.hp=t.maxHp=30+floor*8; t.xp=6; t.drop=3; t.elite=null; t.color=[120,110,140]; }
}
function populateWilds(){
  const nPed=2+Math.floor(rand(0,2)), nCli=1+Math.floor(rand(0,2)), nShep=2+Math.floor(rand(0,2));
  for(let i=0;i<nPed;i++){ const [x,y]=scatterPos(); const n=makeNPC('pedlar',x,y); n.roam=true; n.travel=true; npcs.push(n); }
  for(let i=0;i<nCli;i++){ const [x,y]=scatterPos(); const n=makeNPC('climber',x,y); n.roam=true; n.travel=true; npcs.push(n); }
  for(let i=0;i<nShep;i++){ const [x,y]=scatterPos(); const n=makeNPC('shepherd',x,y); n.roam=true; n.travel=true; n.civ=true; npcs.push(n);
    for(let k=0;k<3;k++){ const m=MOB('slime', x+rand(-1.5,1.5), y+rand(-1.5,1.5));
      m.friendly=true; m.flockN=n; m.r*=.6; m.speed=3.4; m.hp=m.maxHp=20; m.touch=0; m.xp=0; m.drop=0; m.color=[235,235,242]; m.elite=null; } }
}
function scatterMicroSites(){
  const wantN=85+Math.floor(rand(0,15)); let made=0;
  for(let t=0;t<wantN*4 && made<wantN;t++){
    const [x,y]=scatterPos();
    let clear=true; for(const p of poiList){ if(len(p.x-x,p.y-y)<9){ clear=false; break; } }
    if(!clear) continue;
    made++;
    const kind=pick(['stones','shack','field','woodpile','graves','meadow','watchpost','rubble','hives','shrinestone','shed','shed','shack','cottage','cottage','cottage','meadow','field','memorial','gallery','lanterncourt']);
    if(kind==='shed'){ const w9=4+rand(0,1), h9=3.4+rand(0,0.8), L=x-w9/2, R9=x+w9/2, T=y-h9/2, B9=y+h9/2, g=1.1;
      floors.push({x,y,w:w9,h:h9,col:'#262230'});
      hwall(L,R9,T); vwall(T,B9,L); vwall(T,B9,R9); hwall(L,x-g,B9); hwall(x+g,R9,B9);   // open south door
      decos.push({type:'crate',x:x-0.8,y:y,s:.8,seed:5},{type:'barrel',x:x+0.8,y:y-0.3,s:.7,seed:6});
      const r9=rand(0,1);
      if(r9<.4) props.push({kind:'chest',x:x,y:y+0.2,opened:false,big:false});
      else if(r9<.6){ const m=MOB(pick(realm.pool), x, y); m.provoked=false; }   // something made this its den
    }
    else if(kind==='cottage'){ building(x,y,4.2+rand(0,1.4),3.4+rand(0,1));
      if(rand(0,1)<.4){ const n=makeNPC(pick(['villager','peasant','hermit','wanderer','child']), x+rand(-1,1), y+2.6); n.civ=true; n.roam=true; n.post={x:n.x,y:n.y,r:3}; npcs.push(n); }
      if(rand(0,1)<.3) props.push({kind:'lamp',x:x+3,y:y+1}); }
    else if(kind==='stones'){ for(let i=0;i<5;i++){ const a=i/5*6.28; decos.push({type:'rock',x:x+Math.cos(a)*1.7,y:y+Math.sin(a)*1.2,s:.6+rand(0,.3),seed:i*7}); }
      decos.push({type:'crystal',x:x,y:y,s:.5,seed:99}); }
    else if(kind==='shack'){ building(x,y,3.2,2.7);
      if(rand(0,1)<.4){ const n=makeNPC(pick(['beggar','hermit','wanderer']), x, y+2.2); n.civ=true; n.roam=true; n.post={x:n.x,y:n.y,r:2.5}; npcs.push(n); }
      else if(rand(0,1)<.3){ const m=MOB(pick(realm.pool), x, y+2); m.provoked=false; } }
    else if(kind==='field'){ for(let r9=0;r9<2;r9++) for(let c9=0;c9<5;c9++) decos.push({type:'bush',x:x-3+c9*1.5,y:y-0.8+r9*1.6,s:.45,seed:r9*9+c9});
      if(rand(0,1)<.35){ const n=makeNPC('peasant', x, y+2.4); n.civ=true; n.roam=true; n.post={x:n.x,y:n.y,r:3}; npcs.push(n); } }
    else if(kind==='woodpile'){ decos.push({type:'crate',x:x,y:y,s:.9,seed:1},{type:'crate',x:x+0.8,y:y+0.3,s:.7,seed:2},{type:'rock',x:x-1,y:y+0.3,s:.7,seed:3});
      if(rand(0,1)<.5){ const n=makeNPC('laborer', x+0.2, y+1.4); n.civ=true; n.roam=true; n.post={x:n.x,y:n.y,r:1.6}; n.workFx='wood'; npcs.push(n); } }
    else if(kind==='graves'){ for(let i=0;i<3;i++) decos.push({type:'pillar',x:x-1.2+i*1.2,y:y,s:.42,seed:i*5}); decos.push({type:'bones',x:x+0.4,y:y+1.1,s:.7,seed:8}); }
    else if(kind==='meadow'){ for(let i=0;i<6;i++) props.push({kind:'flower',x:x+rand(-2.5,2.5),y:y+rand(-1.8,1.8),used:false});
      decos.push({type:'bush',x:x+rand(-2,2),y:y+rand(-1.5,1.5),s:.6,seed:4}); }
    else if(kind==='watchpost'){ decos.push({type:'banner',x:x,y:y,s:1,seed:6},{type:'crate',x:x+1,y:y+0.5,s:.8,seed:7}); props.push({kind:'lamp',x:x-1,y:y+0.4});
      if(rand(0,1)<.4){ const n=makeNPC('guard', x+0.3, y+1.3); n.roam=true; n.post={x:n.x,y:n.y,r:2}; npcs.push(n); } }
    else if(kind==='rubble'){ for(let i=0;i<3;i++) decos.push({type:'rock',x:x+rand(-1.5,1.5),y:y+rand(-1,1),s:.5+rand(0,.4),seed:i*3}); decos.push({type:'pillar',x:x+0.5,y:y-0.5,s:.5,seed:11}); }
    else if(kind==='hives'){ for(let i=0;i<3;i++) decos.push({type:'barrel',x:x-1.2+i*1.2,y:y,s:.62,seed:i*13}); for(let i=0;i<3;i++) props.push({kind:'flower',x:x+rand(-2,2),y:y+1.2+rand(0,0.8),used:false}); }
    else if(kind==='shrinestone'){ decos.push({type:'rock',x:x,y:y,s:.9,seed:21},{type:'crystal',x:x+0.1,y:y-0.5,s:.45,seed:22}); props.push({kind:'flower',x:x+0.9,y:y+0.4,used:false}); }
    else if(kind==='memorial'){ floors.push({x,y,w:7.5,h:7.5});                  // Climber's Memorial
      props.push({kind:'monolith',x:x,y:y-0.6});
      for(let i=0;i<5;i++){ const a=i/5*6.28+0.6; decos.push({type:'rock',x:x+Math.cos(a)*2.6,y:y+Math.sin(a)*1.9,s:.55+((i*7)%3)*0.12,seed:i*9}); }
      props.push({kind:'plaque',x:x,y:y+2.3,used:false,read:'Memorial: for every climber the Tower kept. The names are cut deeper each year.'});
      if(rand(0,1)<.5){ const n=makeNPC('pilgrim',x+1.6,y+1.4); n.roam=true; n.post={x:n.x,y:n.y,r:2.5}; npcs.push(n); } }
    else if(kind==='gallery'){ floors.push({x,y,w:9,h:6});                       // a gallery of older bones
      for(let i=0;i<3;i++) decos.push({type:'pillar',x:x-3+i*3,y:y-1.6,s:.85,seed:i*5});
      decos.push({type:'pillar',x:x-3,y:y+1.6,s:.8,seed:17});
      decos.push({type:'rock',x:x+0.2,y:y+1.7,s:.7,seed:18},{type:'rock',x:x+3,y:y+1.5,s:.6,seed:19});
      props.push({kind:'chest',x:x+2.2,y:y+0.2,opened:false,big:false});
      props.push({kind:'sign',x:x,y:y-3.2,text:'⌗ a gallery of the Tower\u2019s older bones'}); }
    else if(kind==='lanterncourt'){ floors.push({x,y,w:7,h:7});                  // a court of lanterns
      props.push({kind:'fountain',x:x,y:y});
      for(let i=0;i<5;i++){ const a=i/5*6.28-1.57; props.push({kind:'lamp',x:x+Math.cos(a)*2.7,y:y+Math.sin(a)*2.2,tall:i===0}); }
      for(let i=0;i<2;i++){ const n=makeNPC(pick(['wanderer','bard','child','villager']),x+rand(-1.8,1.8),y+rand(1.0,2.2)); n.civ=true; n.roam=true; n.post={x:n.x,y:n.y,r:3}; npcs.push(n); } }
  }
}
function populateCivilians(){
  const civFloor = !realm.special;
  const N = civFloor ? 44 : 22;
  const TYPES = civFloor ? ['villager','villager','peasant','peasant','noble','beggar','laborer','laborer','urchin','urchin','pilgrim','courier','bard','child','wanderer','villager']
                         : ['pilgrim','wanderer','hermit','peasant','beggar','storyteller','pilgrim','wanderer'];
  const spots = poiList.filter(p=>!p.arena);
  for(let i=0;i<N;i++){
    const p = spots.length ? pick(spots) : {x:rand(-WORLD_HW+24,WORLD_HW-24), y:rand(-WORLD_HH+16,WORLD_HH-16)};
    const n = makeNPC(pick(TYPES), p.x+rand(-7,7), p.y+rand(-5,5));
    n.civ=true; n.roam=true; if(rand(0,1)<.45) n.travel=true;   // some wander the whole floor, POI to POI
    npcs.push(n);
  }
}
function stationNPCs(){
  const ST={ smith:'anvil', merchant:'stall', cook:'cookfire', tavernkeep:'keg', scholar:'book' };
  for(const n of npcs){
    if(n.post) continue;
    if(n.type==='healer'){ for(let i=0;i<3;i++) props.push({kind:'flower',x:n.x+rand(-1.2,1.2),y:n.y+rand(-.9,.9),used:false});
      n.post={x:n.x,y:n.y,r:1.8}; n.roam=false; continue; }
    const st=ST[n.type]; if(!st) continue;
    props.push({kind:st, x:n.x+1.05, y:n.y+0.2, used:false});
    n.post={x:n.x,y:n.y,r:1.5}; n.roam=false; n.workFx=n.type;
  }
}
const HAM_A=['Oak','Mud','Ash','Brook','Stone','Fox','Thorn','Mill','Crow','Elder','Bram','Hazel'], HAM_B=['rest','foot','hollow','stead','wick','den','bridge','fen','mark','shade','barrow','combe'];
function buildHamlet(cx,cy){   // a cluster of plain homes — folk simply LIVE here
  lastPoiName='the hamlet of '+pick(HAM_A)+pick(HAM_B);
  const n0=3+Math.floor(rand(0,3)), ang0=rand(0,6.28);
  for(let i=0;i<n0;i++){ const a=ang0+i/n0*6.28;
    building(cx+Math.cos(a)*6.8, cy+Math.sin(a)*4.8, 4.6+rand(0,1.2), 3.8+rand(0,0.8)); }
  props.push({kind:'well',x:cx,y:cy,used:false});
  for(let i=0;i<2;i++) props.push({kind:'flower',x:cx+rand(-3,3),y:cy+rand(-2,2),used:false});
  props.push({kind:'sign',x:cx,y:cy-7.2,text:'⌂ '+lastPoiName+' ⌂'});
  props.push({kind:'lamp',x:cx+1.4,y:cy+0.8});
  const TY=['villager','peasant','child','urchin','laborer','villager'];
  for(let i=0;i<n0+1;i++){ const n=makeNPC(pick(TY), cx+rand(-4,4), cy+rand(-3,3)); n.civ=true; n.roam=true; n.post={x:n.x,y:n.y,r:5}; npcs.push(n); }
}
function buildMarketSq(cx,cy){   // stalls, hawkers and browsers
  lastPoiName='the '+pick(['Copper','Silk','Salt','Amber','Iron','Honey'])+' Market';
  floors.push({x:cx,y:cy,w:16,h:12,col:'#3a3640'});
  for(let i=0;i<4;i++) props.push({kind:'stall',x:cx-5+i*3.4,y:cy-2});
  props.push({kind:'newsstand',x:cx+1.5,y:cy-4.4,reads:0});
  decos.push({type:'crate',x:cx-6,y:cy+2.5,s:1,seed:1},{type:'barrel',x:cx+6,y:cy+2.4,s:1,seed:2});
  props.push({kind:'lamp',x:cx-7,y:cy-5},{kind:'lamp',x:cx+7,y:cy-5});
  for(let i=0;i<2;i++){ const m=makeNPC('merchant',cx-4+i*7,cy-3); m.post={x:m.x,y:m.y,r:1.4}; m.workFx='merchant'; m.roam=true; npcs.push(m); }
  const browse=['noble','villager','peasant','cook','urchin','villager','washer','beggar'];
  for(let i=0;i<4;i++){ const n=makeNPC(pick(browse),cx+rand(-5,5),cy+rand(-1,3)); n.civ=true; n.roam=true; n.post={x:cx,y:cy,r:6}; npcs.push(n); }
  { const fm=makeNPC('fishmonger',cx+5,cy-2); fm.post={x:fm.x,y:fm.y,r:1.4}; fm.roam=false; npcs.push(fm); props.push({kind:'stall',x:cx+5,y:cy-2}); }
  { const hb=makeNPC('herbalist',cx-6,cy+1); hb.post={x:hb.x,y:hb.y,r:1.6}; hb.civ=true; hb.roam=true; npcs.push(hb); }
  if(rand(0,1)<0.6){ const tx=makeNPC('taxman',cx,cy+2); tx.civ=true; tx.roam=true; tx.post={x:cx,y:cy,r:7}; npcs.push(tx); }
}
function buildSquare(cx,cy){   // a lively town square: a fountain, street performers, a crier and a gathered crowd
  lastPoiName='the '+pick(['Market','Fountain','Cathedral','Old','Guildhall','Lantern','Founders'])+' Square';
  floors.push({x:cx,y:cy,w:21,h:16,col:'#3a3742'});
  safeZones.push({x:cx,y:cy,w:21,h:16});
  props.push({kind:'fountain',x:cx,y:cy});
  props.push({kind:'lamp',x:cx-8.5,y:cy-6,tall:true},{kind:'lamp',x:cx+8.5,y:cy-6,tall:true},{kind:'lamp',x:cx-8.5,y:cy+6,tall:true},{kind:'lamp',x:cx+8.5,y:cy+6,tall:true});
  props.push({kind:'sign',x:cx,y:cy-8.6,text:'\u2756 '+lastPoiName+' \u2756'});
  decos.push({type:'crate',x:cx-9,y:cy+3,s:.9,seed:7},{type:'barrel',x:cx+9,y:cy+3.2,s:.9,seed:8});
  { const c=makeNPC('crier',cx-6,cy-3.5); c.post={x:c.x,y:c.y,r:2}; c.roam=true; c.civ=true; npcs.push(c); }
  { const b=makeNPC('busker',cx+5,cy+3); b.post={x:b.x,y:b.y,r:1.6}; b.roam=true; b.civ=true; npcs.push(b); props.push({kind:'keg',x:b.x+1.2,y:b.y+0.8}); }
  { const d=makeNPC('dancer',cx+5.6,cy+4.6); d.post={x:cx+5,y:cy+3.6,r:2.6}; d.roam=true; d.civ=true; npcs.push(d); }
  if(rand(0,1)<0.7){ const s=makeNPC('seer',cx-6.5,cy+4); s.post={x:s.x,y:s.y,r:1.6}; s.roam=false; s.civ=true; npcs.push(s); props.push({kind:'orb',x:s.x+1,y:s.y+0.3}); }
  const crowd=['villager','peasant','noble','child','urchin','wanderer','washer','beggar','monk','laborer','pedlar'];
  const n0=7+Math.floor(rand(0,4));
  for(let i=0;i<n0;i++){ const a=rand(0,6.28), rr=rand(3,8.5); const n=makeNPC(pick(crowd),cx+Math.cos(a)*rr,cy+Math.sin(a)*rr*0.78); n.civ=true; n.roam=true; n.post={x:cx,y:cy,r:9}; npcs.push(n); }
}
function buildGuildHall(cx,cy){   // Trial Towers 3.0: a guild hall with a ranking dais — step on it to read your star rank
  lastPoiName='the Guild Hall';
  floors.push({x:cx,y:cy,w:15,h:12,col:'#2e2a3a'}); safeZones.push({x:cx,y:cy,w:15,h:12});
  props.push({kind:'guildplatform',x:cx,y:cy+1,used:false});
  props.push({kind:'sign',x:cx,y:cy-5,text:'⚔ Guild Hall — stand on the dais (E) to read your ★ rank'});
  props.push({kind:'lamp',x:cx-6,y:cy-4.5,tall:true},{kind:'lamp',x:cx+6,y:cy-4.5,tall:true},{kind:'lamp',x:cx-6,y:cy+4.5,tall:true},{kind:'lamp',x:cx+6,y:cy+4.5,tall:true});
  decos.push({type:'pillar',x:cx-6.6,y:cy,s:1,seed:3},{type:'pillar',x:cx+6.6,y:cy,s:1,seed:5},{type:'banner',x:cx,y:cy-4.2,s:1,seed:7});
  const gm=makeNPC('arenamaster',cx-3.6,cy-2.6); gm.post={x:gm.x,y:gm.y,r:2}; gm.roam=true; gm.guildmaster=true; npcs.push(gm);
}
function buildChapel(cx,cy){   // a quiet chapel, its priest, a praying pilgrim
  lastPoiName='a Quiet Chapel';
  building(cx,cy,7,5.4);
  props.push({kind:'shrine',x:cx,y:cy+4.6,used:false});
  const p=makeNPC('priest',cx-1,cy+3.6); p.post={x:p.x,y:p.y,r:2}; p.roam=true; npcs.push(p);
  const q=makeNPC('pilgrim',cx+1.5,cy+3.8); q.post={x:q.x,y:q.y,r:2.4}; q.roam=true; q.civ=true; npcs.push(q);
  const ac=makeNPC('acolyte',cx-2,cy+4.2); ac.post={x:ac.x,y:ac.y,r:2.2}; ac.roam=true; ac.civ=true; npcs.push(ac);
  props.push({kind:'lamp',x:cx-3,y:cy-3},{kind:'lamp',x:cx+3,y:cy-3});
}
function buildShanty(cx,cy){   // lean-to shacks at the edge of fortune
  lastPoiName='the Shantyrow';
  for(let i=0;i<3;i++) building(cx-4.2+i*4.2, cy+rand(-1,1), 3.2, 2.8);
  decos.push({type:'crate',x:cx-5.6,y:cy+2.6,s:.8,seed:3},{type:'bones',x:cx+5.7,y:cy+2.4,s:.8,seed:4});
  const TY=['beggar','urchin','laborer','beggar'];
  for(let i=0;i<3;i++){ const n=makeNPC(pick(TY),cx+rand(-5,5),cy+rand(2,3.6)); n.civ=true; n.roam=true; n.post={x:n.x,y:n.y,r:4}; npcs.push(n); }
}
function buildCart(cx,cy){   // a wrecked trader's cart — scavenge what's left
  decos.push({type:'crate',x:cx,y:cy,s:1,seed:3},{type:'crate',x:cx+0.9,y:cy+0.4,s:.8,seed:7},{type:'barrel',x:cx-1,y:cy+0.5,s:.9,seed:5});
  props.push({kind:'sign',x:cx,y:cy-1.6,text:'a looted cart...'});
  if(rand(0,1)<.45) props.push({kind:'chest',x:cx+rand(-1,1),y:cy+1.2,opened:false,big:false});
  if(rand(0,1)<.4){ const m=MOB(pick(realm.pool), cx+rand(-2,2), cy+rand(-2,2)); m.provoked=false; }   // scavengers linger
}
function buildCampsite(cx,cy){   // wanderers around a fire — a moment of peace
  props.push({kind:'cookfire',x:cx,y:cy,used:false});
  decos.push({type:'rock',x:cx-1.2,y:cy+0.7,s:.7,seed:2},{type:'rock',x:cx+1.2,y:cy+0.6,s:.6,seed:4});
  decos.push({type:'banner',x:cx+2,y:cy-1,s:.9,seed:6});
  const a=makeNPC(pick(['wanderer','storyteller','pilgrim']), cx-1.1, cy-0.4); a.post={x:a.x,y:a.y,r:1.6}; a.roam=true; npcs.push(a);
  const b=makeNPC(pick(['hermit','bard','peasant']), cx+1.2, cy-0.3); b.post={x:b.x,y:b.y,r:1.6}; b.roam=true; npcs.push(b);
}
function buildOrchard(cx,cy){   // tended rows of fruit trees
  for(let i=0;i<3;i++) for(let j=0;j<2;j++) decos.push({type:'tree',x:cx-3+i*3,y:cy-1.5+j*3,s:.9+rand(0,.25),seed:i*9+j});
  for(let i=0;i<3;i++) props.push({kind:'flower',x:cx+rand(-3,3),y:cy+rand(-2,2),used:false});
  const f=makeNPC('farmer', cx, cy+3); f.post={x:f.x,y:f.y,r:3}; f.roam=true; npcs.push(f);
}
function buildHomestead(cx,cy){
  const w=5.5+rand(0,1.5), h=4.2+rand(0,1);
  building(cx,cy,w,h);
  const t=pick(['farmer','wanderer','cook','child','hermit','storyteller','miner']);
  const n=makeNPC(t, cx+rand(-1,1), cy+h/2+1.4); n.post={x:n.x,y:n.y,r:2.4}; n.roam=true; npcs.push(n);
  for(let i=0;i<4;i++) decos.push({type:'bush', x:cx-w/2-1, y:cy-h/2+i*(h/3), s:.65, seed:i*17});
  props.push({kind:'flower',x:cx+w/2+1.1,y:cy+rand(-1,1),used:false});
  if(rand(0,1)<.5) decos.push({type:'crate',x:cx+w/2+0.9,y:cy-h/2+0.6,s:.9,seed:9});
  if(rand(0,1)<.35) props.push({kind:'lamp',x:cx-w/2-1,y:cy+h/2+0.8});
  if(rand(0,1)<.35) props.push({kind:'chest',x:cx+rand(-0.8,0.8), y:cy, opened:false, big:false});   // a chest behind their door
}
// every realm stages its gatekeeper in a themed arena before the stair
function bossArena(cx,cy){
  const A=[ {pad:'#33312c', ring:'pillar',  n:8,  r:7  },   // 0 trial ring
            {pad:'#1d3018', ring:'tree',    n:9,  r:7.5},   // 1 overgrown temple clearing
            {pad:'#2c3340', ring:'banner',  n:8,  r:7  },   // 2 imperial courtyard
            {pad:'#3a2418', ring:'totem',   n:7,  r:7  },   // 3 war-camp of the horde
            {pad:'#243620', ring:'tree',    n:9,  r:7.5},   // 4 sacred grove
            {pad:'#301418', ring:'brazier', n:8,  r:7  },   // 5 infernal core
            {pad:'#34301e', ring:'banner',  n:8,  r:7  },   // 6 duelling terrace
            {pad:'#221a38', ring:'crystal', n:9,  r:7.5},   // 7 court of the void
            {pad:'#202a36', ring:'pillar',  n:9,  r:7.5},   // 8 echoing nave
            {pad:'#322a16', ring:'brazier', n:10, r:8  } ][realmIndex(floor)]||{pad:'#333',ring:'pillar',n:8,r:7};
  walls=walls.filter(w=>w.vaultDoor || len(w.x-cx,w.y-cy)>A.r+2.5);          // the arena grounds are kept clear
  decos=decos.filter(d=>len(d.x-cx,d.y-cy)>A.r-0.5);
  floors.push({x:cx,y:cy,w:A.r*2+4,h:A.r*2+4,col:A.pad,arena:true});
  for(let i=0;i<A.n;i++){ const a=i/A.n*6.28+0.39;
    decos.push({type:A.ring, x:cx+Math.cos(a)*A.r, y:cy+Math.sin(a)*A.r, s:1+(A.ring==='tree'?0.35:0.1), seed:i*131}); }
  decos.push({type:'banner',x:cx-A.r-1.4,y:cy-2,s:1.1,seed:11});
  decos.push({type:'banner',x:cx-A.r-1.4,y:cy+2,s:1.1,seed:12});
}
// v2: a SEALED boss chamber (one gate, reinforced walls, the portal inside) — hidden, never added to the map
function bossRoom(cx,cy){
  const ri=realmIndex(floor);
  const pad=['#2a2620','#1d2818','#26242e','#2e2018','#202a1c','#2a1418','#2a2418','#1e1a2e','#1c222c','#2a2216'][ri]||'#26222c';
  const w=19, h=15.5;
  walls=walls.filter(w9=> w9.vaultDoor || !(Math.abs(w9.x-cx)<w/2+1 && Math.abs(w9.y-cy)<h/2+1));   // clear the chamber footprint of stray walls
  decos=decos.filter(d=> !(Math.abs(d.x-cx)<w/2 && Math.abs(d.y-cy)<h/2));
  props=props.filter(pp=> !(Math.abs(pp.x-cx)<w/2 && Math.abs(pp.y-cy)<h/2));
  const side=pick(['S','N','E','W']);
  compound(cx,cy,w,h,{gates:[side], gateW:3.6, safe:false, col:pad, dtint:'150,55,55', tier:2});   // reinforced; find the gate or smash in
  props.push({kind:'lamp',x:cx-w/2+1.4,y:cy-h/2+1.4,tall:true,col:[255,120,90]},{kind:'lamp',x:cx+w/2-1.4,y:cy-h/2+1.4,tall:true,col:[255,120,90]},
             {kind:'lamp',x:cx-w/2+1.4,y:cy+h/2-1.4,tall:true,col:[255,120,90]},{kind:'lamp',x:cx+w/2-1.4,y:cy+h/2-1.4,tall:true,col:[255,120,90]});
}
function buildVault(cx,cy){
  vaultSpot={x:cx,y:cy}; vaultRoom(cx,cy,16,12);
  walls.push({x:cx-8,y:cy,w:0.7,h:3.4,vaultDoor:true});   // a rune-sealed slab plugs the entrance
  const names=['CRIMSON','AZURE','GOLD'], cols=[[230,70,80],[90,150,255],[255,210,80]];
  const order=shuffle([0,1,2]);
  vaultSeal={order, progress:0, open:false, names, cols, x:cx, y:cy};
  props.push({kind:'sign',x:cx,y:cy-7.5,text:'⛨ Sealed Vault — wake the runes: '+order.map(i=>names[i]).join(' → ')});
  props.push({kind:'chest',x:cx+3,y:cy,opened:false,big:true});
  for(let i=0;i<3;i++){ const [rx,ry]=scatterPos(); props.push({kind:'runestone', x:rx, y:ry, idx:i, lit:false}); }
}
function buildNest(cx,cy){ nestSpots.push([cx,cy]); for(let i=0;i<3;i++) walls.push({x:cx+rand(-6,6),y:cy+rand(-5,5),w:rand(1,2.4),h:rand(1,2.2),ruin:true}); }
function buildRuins(cx,cy){
  props.push({kind:'sign',x:cx,y:cy-7,text:'⌂ Ruins ⌂'});
  for(let i=0;i<7;i++) walls.push({x:cx+rand(-9,9),y:cy+rand(-7,7),w:rand(1,2.6),h:rand(1,2.4),ruin:true});
  props.push({kind:'chest',x:cx+rand(-4,4),y:cy+rand(-3,3),opened:false,big:rand(0,1)<0.25});
}
function buildGraveyard(cx,cy){
  floors.push({x:cx,y:cy,w:22,h:16,col:'#22202a'});
  props.push({kind:'sign',x:cx,y:cy-7,text:'† Graveyard †'});
  for(let i=0;i<8;i++) walls.push({x:cx-8+(i%4)*5.2,y:cy-3+Math.floor(i/4)*6,w:0.9,h:1.6}); // tombstones
  props.push({kind:'chest',x:cx,y:cy+5,opened:false,big:false});
  props.push({kind:'shrine',x:cx+8,y:cy-4,used:false});
  { const g=makeNPC('gravedigger',cx-6,cy+4); g.civ=true; g.roam=true; g.post={x:cx,y:cy,r:8}; npcs.push(g); }
  if(rand(0,1)<0.5){ const m=makeNPC('pilgrim',cx+3,cy+4); m.civ=true; m.roam=true; m.post={x:cx,y:cy,r:7}; npcs.push(m); }
}
function buildPond(cx,cy){
  floors.push({x:cx,y:cy,w:22,h:15,col:'#163a4c',water:true});
  props.push({kind:'sign',x:cx,y:cy-6,text:'~ Pond ~'});
  for(let i=0;i<8;i++){ const a=i/8*6.28; props.push({kind:'flower',x:cx+Math.cos(a)*11.5,y:cy+Math.sin(a)*8,used:false}); }
  props.push({kind:'chest',x:cx+12.5,y:cy,opened:false,big:rand(0,1)<0.3});  // on the far bank
  floors.push({x:cx-12.5,y:cy+2,w:5,h:3,col:'#4a3a28'});
  npcs.push(makeNPC('fisher',cx-12.5,cy+2));
}
function buildShrines(cx,cy){
  props.push({kind:'sign',x:cx,y:cy-5,text:'⛩ Shrines ⛩'});
  props.push({kind:'shrine',x:cx-4,y:cy,used:false}); props.push({kind:'shrine',x:cx+4,y:cy,used:false});
}
function buildCache(cx,cy){
  props.push({kind:'sign',x:cx,y:cy-5,text:'$ Cache $'});
  for(let i=0;i<3;i++) props.push({kind:'chest',x:cx+rand(-5,5),y:cy+rand(-3,3),opened:false,big:rand(0,1)<0.2});
}
const WEATHER_BOON={
  rain:   {f(){ player.lifesteal=(player.lifesteal||0)+0.04; }, msg:'Rain-blessing \u2014 +lifesteal'},
  snow:   {f(){ player.frostHit=true; }, msg:'Frost-blessing \u2014 your hits chill'},
  ash:    {f(){ player.burn=(player.burn||0)+1; }, msg:'Ash-blessing \u2014 +burn'},
  dust:   {f(){ player.speed+=0.4; }, msg:'Dust-blessing \u2014 +move speed'},
  leaves: {f(){ player.thorns=(player.thorns||0)+4; }, msg:'Grove-blessing \u2014 +thorns'},
  glimmer:{f(){ player.critC=Math.min(.6,(player.critC||0)+0.05); }, msg:'Glimmer-blessing \u2014 +crit'},
  motes:  {f(){ player.charge=Math.min(100,(player.charge||0)+40); }, msg:'Mote-blessing \u2014 +ult charge'},
  sparks: {f(){ player.critM=(player.critM||1.5)+0.25; }, msg:'Spark-blessing \u2014 +crit damage'},
};
function buildWeathervane(cx,cy){
  lastPoiName='a Weathervane Altar';
  floors.push({x:cx,y:cy,w:7,h:6,col:'#2a2c34'});
  props.push({kind:'weathervane',x:cx,y:cy-0.4,used:false});
  props.push({kind:'sign',x:cx,y:cy+3,text:'\u263c Weathervane Altar'});
}
// ===== WILDERNESS STRUCTURES — frontier sites with real purpose, placed in the edge ring =====
function buildWayshrine(cx,cy){
  lastPoiName='a Frontier Wayshrine';
  floors.push({x:cx,y:cy,w:9,h:8,col:'#2c2a36'});
  safeZones.push({x:cx,y:cy,w:9,h:8,heal:true});
  props.push({kind:'shrine',x:cx,y:cy+1.4,used:false});
  props.push({kind:'lamp',x:cx-3,y:cy-2,tall:true},{kind:'lamp',x:cx+3,y:cy-2,tall:true});
  props.push({kind:'sign',x:cx,y:cy-4.6,text:'\u2720 Wayshrine \u2720'});
  const k=makeNPC('pilgrimkeeper',cx,cy-0.4); k.post={x:k.x,y:k.y,r:2}; npcs.push(k);
}
function buildBeacon(cx,cy){
  lastPoiName='a Watch-Beacon';
  floors.push({x:cx,y:cy,w:7,h:6,col:'#2a2832'});
  props.push({kind:'beacon',x:cx,y:cy-0.5,used:false});
  props.push({kind:'sign',x:cx,y:cy+3,text:'\u25b3 Watch-Beacon'});
}
function buildRuinedOutpost(cx,cy){
  lastPoiName='a Ruined Outpost';
  floors.push({x:cx,y:cy,w:11,h:9,col:'#272530'});
  for(let i=0;i<5;i++){ const a=i/5*6.28; walls.push({x:cx+Math.cos(a)*4.4,y:cy+Math.sin(a)*3.4,w:rand(1.2,2.2),h:rand(1.2,2),ruin:true}); }
  props.push({kind:'chest',x:cx,y:cy,opened:false,big:true});
  props.push({kind:'sign',x:cx,y:cy-4.6,text:'\u2691 Ruined Outpost'});
  lastPoiReward={coin:10,buff:8,msg:'The outpost stores still held something useful. (+coin +vigor)'};
}
function buildQuartermasterVault(cx,cy){
  lastPoiName="the Quartermaster's Post";
  building(cx,cy,7,5.4);
  safeZones.push({x:cx,y:cy,w:8,h:6});
  props.push({kind:'sign',x:cx,y:cy-4.2,text:'\u25c8 Quartermaster'});
  const q=makeNPC('quartermaster',cx,cy+2.6); q.post={x:q.x,y:q.y,r:2}; npcs.push(q);
}
function buildRangerCamp(cx,cy){
  lastPoiName='a Ranger Camp';
  floors.push({x:cx,y:cy,w:12,h:10,col:'#262a26'});
  props.push({kind:'cookfire',x:cx,y:cy});
  building(cx-3.5,cy-2.2,4,3.4);
  props.push({kind:'sign',x:cx,y:cy-5,text:'\u2691 Ranger Camp'});
  decos.push({type:'crate',x:cx+4,y:cy+2,s:.9,seed:11},{type:'barrel',x:cx-4.4,y:cy+2.4,s:.9,seed:12});
  const r=makeNPC('ranger',cx+2,cy+1.4); r.post={x:r.x,y:r.y,r:3}; r.roam=true; r.rangerCaptain=true; npcs.push(r);
  const g=makeNPC('guard',cx-1,cy+2.2); g.roam=true; g.post={x:g.x,y:g.y,r:4}; npcs.push(g);
}
function buildHermitTower(cx,cy){
  lastPoiName="a Hermit's Tower";
  floors.push({x:cx,y:cy,w:8,h:8,col:'#262430'});
  building(cx,cy-0.5,5,5);
  props.push({kind:'orb',x:cx-2.6,y:cy+2.6,used:false});
  props.push({kind:'sign',x:cx,y:cy-4.8,text:'\u263c Hermit\u2019s Tower'});
  const h=makeNPC('hermit',cx,cy+2.8); h.post={x:h.x,y:h.y,r:2}; h.wildTower=true; npcs.push(h);
}
function buildLoreVault(cx,cy){
  lastPoiName='a Sealed Vault';
  vaultRoom(cx,cy,9,7);
  const door={x:cx-4.5,y:cy,w:TW*1.4,h:3.2,door:true,wardoor:true};
  walls.push(door);
  props.push({kind:'wardoor',x:cx-4.3,y:cy,used:false,doorWall:door,gate:'lore',need:3});
  props.push({kind:'chest',x:cx+2,y:cy,opened:false,big:true});
  props.push({kind:'sign',x:cx,y:cy-4.4,text:'\u26ec Sealed Vault'});
}
const FEATURE_FNS = { homestead:buildHomestead, cart:buildCart, campsite:buildCampsite, orchard:buildOrchard, hamlet:buildHamlet, market:buildMarketSq, chapel:buildChapel, shanty:buildShanty, town:buildTown, city:buildCity, inn:buildInn, farm:buildFarm, garden:buildGarden, vault:buildVault, nest:buildNest, ruins:buildRuins, graveyard:buildGraveyard, pond:buildPond, shrines:buildShrines, cache:buildCache, tavern:buildTavern, library:buildLibrary, square:buildSquare, arena:buildArena, tower:buildTowerWatch, enchanter:buildEnchanter, banditcamp:buildBanditCamp, monument:buildMonument, spring:buildSpring, mine:buildMine, caravan:buildCaravan, guild:buildGuildHall };
const WILD_FNS = { wayshrine:buildWayshrine, beacon:buildBeacon, outpost:buildRuinedOutpost, quartervault:buildQuartermasterVault, rangercamp:buildRangerCamp, hermittower:buildHermitTower, lorevault:buildLoreVault, weathervane:buildWeathervane };
const UNIQUE_FEATS = { town:1, city:1, vault:1, inn:2, farm:2, arena:1, enchanter:1, monument:1, caravan:1, tower:2, banditcamp:2, spring:2, mine:2, tavern:1, library:1, market:2, chapel:2, shanty:3, square:1 };

// fragments left by climbers who never made it — heard at memory orbs on floor 9
const ECHO_LORE=[
  'Memory: \"...third time falling past the frost floor. I did not scream. I am getting better at this.\"',
  'Memory: \"The elves let me sleep in the grove. I dreamt the Tower was breathing.\"',
  'Memory: \"Sword or magic. The Families ask everyone. I chose wrong.\"',
  'Memory: \"The Count offered me a bargain on floor eight. I should have taken it.\"',
  'Memory: \"I saw the Crown once, through the clouds. One more floor. One more.\"',
  'Memory: \"If you find this — the Warden on floor one is kinder than he looks. Start again.\"',
];
// a creature slain by another creature: no spoils, just consequences
function skirmishKill(m){ burst(m.x,m.y,m.color,12,3); mobs=mobs.filter(x=>x!==m); }
// spawn a pack: one leader, the rest follow it while idle
function spawnPack(kind,n,x,y){
  const s0=offRoad(x,y), lead=MOB(kind,s0[0],s0[1]); const out=[lead];
  for(let i=1;i<n;i++){ const sp=offRoad(x+rand(-2.5,2.5), y+rand(-2.5,2.5)); const m=MOB(kind, sp[0], sp[1]); m.leader=lead; out.push(m); }
  return out;
}

// ---------- Per-floor map direction: bespoke terrain + enemy placement ----------
const MAPGEN={
  gauntlet:{ // F1 — three training rings along a worn path, each with a lesson
    terrain(){
      floors.splice(1,0,{x:-17,y:0,w:150,h:4,road:true});   // a worn path linking the rings (not the whole map)
      const rings=[-78,-18,44];
      const lessons=['LESSON I — STRIKE: hold nothing back.','LESSON II — DASH: what you cannot beat, you avoid.','LESSON III — FOCUS: the ultimate rewards patience.'];
      rings.forEach((rx,i)=>{
        for(let k=0;k<10;k++){ const a=k/10*6.28; if(Math.abs(Math.cos(a))>.82) continue;   // east-west openings
          walls.push({x:rx+Math.cos(a)*9, y:Math.sin(a)*7, w:1.6, h:1.6}); }
        floors.push({x:rx,y:0,w:16,h:12,col:'#34303c'});
        props.push({kind:'plaque',x:rx,y:-8.6,read:'Plaque: \"'+lessons[i]+'\"'});
      });
    },
    populate(pool){
      const rings=[-78,-18,44];
      rings.forEach((rx,i)=>{ for(let k=0;k<i+3;k++) MOB(pick(pool), rx+rand(-5,5), rand(-4,4)); });
      for(let i=0;i<6;i++){ const [x,y]=scatterPos(); MOB(pick(pool),x,y); }
    } },
  jungle:{ // F2 — a winding river splits the wild; ambush packs wait near the fords
    terrain(){
      for(let y=-WORLD_HH+6; y<WORLD_HH-4; y+=12){
        if(y>-16 && y<-2) continue;                       // north ford
        if(y>26 && y<40) continue;                        // south ford
        floors.push({x:-12+Math.sin(y*0.05)*10, y:y+6, w:7, h:13, col:'#163a4c', water:true});
      }
      floors.push({x:-12+Math.sin(-9*0.05)*10, y:-9, w:8, h:6, col:'#4a4034', road:true});
      floors.push({x:-12+Math.sin(33*0.05)*10, y:33, w:8, h:6, col:'#4a4034', road:true});
      props.push({kind:'sign',x:-12,y:-13,text:'~ ford ~'}); props.push({kind:'sign',x:-9,y:29,text:'~ ford ~'});
    },
    populate(pool){
      for(let c=0;c<6;c++){ const [x,y]=scatterPos(); spawnPack(pick(pool),3,x,y); }   // ambush clusters
      for(let i=0;i<8;i++){ const [x,y]=scatterPos(); MOB(pick(pool),x,y); }
    } },
  legion:{ // F3 — the Empire marches: squads in rank, hounds at heel, lawful patrols on the roads
    populate(pool){
      for(let s=0;s<4;s++){ const [x,y]=scatterPos();
        for(let k=0;k<3;k++){ const m=MOB('legion', x+k*1.6-1.6, y); m.orbit={x:x+k*1.6-1.6,y:y,r:.4,a:rand(0,6.28),w:.5}; } }
      for(let s=0;s<3;s++){ const [x,y]=scatterPos(); spawnPack('warhound',2,x,y); }
      for(let s=0;s<4;s++){ const [x,y]=scatterPos(); const m=MOB('arbalist',x,y); m.orbit={x:x,y:y,r:.4,a:rand(0,6.28),w:.4}; }
      for(let s=0;s<3;s++){ const m=MOB('legion', rand(-WORLD_HW+16,exit.x-12), rand(-2,2)); m.warden=true; m.neutralC=true; }   // street patrols: lawful until you are WANTED
      for(let i=0;i<7;i++){ const [x,y]=scatterPos(); MOB(pick(pool),x,y); }
    } },
  packs:{ // F4 — the Great Hunt: wolf packs range the steppe; the Khan's fighting pit stands at the centre
    terrain(){
      for(let k=0;k<12;k++){ const a=k/12*6.28; if(Math.abs(Math.sin(a))>.92) continue;   // north-south gates
        walls.push({x:Math.cos(a)*11, y:Math.sin(a)*9, w:1.7, h:1.7}); }
      floors.push({x:0,y:0,w:20,h:15,col:'#3c2c20'});
      props.push({kind:'plaque',x:0,y:-10.4,read:'Plaque: \"THE KHAN\'S PIT — enter with teeth.\"'});
      props.push({kind:'chest',x:0,y:5,opened:false,big:true});
    },
    populate(pool){
      for(let p=0;p<4;p++){ const [x,y]=scatterPos(); spawnPack('packwolf',4,x,y); }
      const el=MOB('bruiser',0,-2); el.hp=Math.round(el.maxHp*1.5); el.maxHp=el.hp;   // pit champion
      for(let k=0;k<3;k++) MOB('spearhunt', rand(-6,6), rand(-5,5));
      for(let i=0;i<6;i++){ const [x,y]=scatterPos(); MOB(pick(pool),x,y); }
    } },
  groves:{ // F5 — ritual circles turn slowly around the spirit stones; tread lightly
    terrain(){ for(let i=0;i<3;i++){ const [x,y]=scatterPos(); props.push({kind:'stone',x:x,y:y,used:false}); } },
    populate(pool){
      for(let c=0;c<3;c++){ const [cx,cy]=scatterPos();
        for(let k=0;k<5;k++){ const m=MOB(pick(['wardenE','dancer']), cx+Math.cos(k/5*6.28)*3.2, cy+Math.sin(k/5*6.28)*3.2);
          m.orbit={x:cx,y:cy,r:3.2,a:k/5*6.28,w:(c%2?0.22:-0.22)}; } }
      for(let i=0;i<7;i++){ const [x,y]=scatterPos(); MOB(pick(pool),x,y); }
    } },
  scorched:{ // F6 — lava fissures vent across the ash; obelisks pulse with hex-light
    terrain(){
      let fis=0, ftry=0;
      while(fis<3 && ftry++<24){ const fx=rand(-WORLD_HW+18,WORLD_HW-24);
        if(Math.abs(fx-palacePos()[0])<18) continue;
        floors.push({x:fx, y:rand(-12,12), w:4.5, h:rand(28,44), col:'#4a1f14', hazard:'burn'}); fis++; }
      for(let i=0;i<4;i++){ const [x,y]=scatterPos(); props.push({kind:'obelisk',x:x,y:y,pt:rand(2,4)}); }
    },
    populate(pool){
      for(let p=0;p<3;p++){ const [x,y]=scatterPos(); spawnPack('impling',3,x,y); }
      for(const p of props){ if(p.kind==='obelisk'){ const m=MOB('hexcaster', p.x+2.5, p.y); m.orbit={x:p.x,y:p.y,r:2.6,a:rand(0,6.28),w:.3}; } }
      for(let k=0;k<4;k++){ const [x,y]=scatterPos(); MOB('bombfiend',x,y); }
      for(let i=0;i<6;i++){ const [x,y]=scatterPos(); MOB(pick(pool),x,y); }
    } },
  ridge:{ // F7 — a mountain spine splits sword from sorcery; their skirmishes never end
    terrain(){
      vwall(-WORLD_HH-TW,-24,0,true); vwall(-15,13,0,true); vwall(22,WORLD_HH+TW,0,true);
      floors.push({x:0,y:-19.5,w:7,h:9,road:true}); floors.push({x:0,y:17.5,w:7,h:9,road:true});
      props.push({kind:'plaque',x:-4,y:-19.5,read:'Plaque: \"WEST — HOUSE OF THE BLADE. Steel only.\"'});
      props.push({kind:'plaque',x:4,y:17.5,read:'Plaque: \"EAST — HOUSE OF THE ARCANE. Words are spells.\"'});
    },
    populate(pool){
      for(let k=0;k<7;k++){ const m=MOB('swordsman', rand(-WORLD_HW+10,-6), rand(-WORLD_HH+8,WORLD_HH-8)); m.faction='sword'; }
      for(let k=0;k<7;k++){ const m=MOB('arcanist', rand(6,WORLD_HW-14), rand(-WORLD_HH+8,WORLD_HH-8)); m.faction='magic'; }
      for(let i=0;i<4;i++){ const [x,y]=scatterPos(); MOB(pick(pool),x,y); }
    } },
  nexus:{ // F8 — a void moat rings the Court's treasury; four bridges, four sanctums
    terrain(){
      const M=15,Wd=5;
      floors.push({x:0,y:-M,w:M*2+Wd,h:Wd,col:'#120b22',hazard:'void'});
      floors.push({x:0,y:M,w:M*2+Wd,h:Wd,col:'#120b22',hazard:'void'});
      floors.push({x:-M,y:0,w:Wd,h:M*2-Wd,col:'#120b22',hazard:'void'});
      floors.push({x:M,y:0,w:Wd,h:M*2-Wd,col:'#120b22',hazard:'void'});
      floors.push({x:0,y:-M,w:6,h:Wd+2,road:true}); floors.push({x:0,y:M,w:6,h:Wd+2,road:true});
      floors.push({x:-M,y:0,w:Wd+2,h:6,road:true}); floors.push({x:M,y:0,w:Wd+2,h:6,road:true});
      floors.push({x:0,y:0,w:18,h:13,col:'#241c38'});
      props.push({kind:'chest',x:-2.5,y:0,opened:false,big:true}); props.push({kind:'shrine',x:3,y:0,used:false});
      props.push({kind:'plaque',x:0,y:-4.6,read:'Plaque: \"The Court\'s tithe. Cross the void if you dare.\"'});
    },
    populate(pool){
      const spots=[[WORLD_HW*0.42,-WORLD_HH*0.52],[WORLD_HW*0.42,WORLD_HH*0.52],[-WORLD_HW*0.05,-WORLD_HH*0.6],[-WORLD_HW*0.05,WORLD_HH*0.62]];
      for(const sp of spots){ for(let k=0;k<3;k++){ const m=MOB(pick(pool), sp[0]+rand(-3,3), sp[1]+rand(-3,3)); m.orbit={x:sp[0],y:sp[1],r:4,a:rand(0,6.28),w:.28}; } }
      for(let i=0;i<6;i++){ const [x,y]=scatterPos(); MOB(pick(pool),x,y); }
    } },
  cathedral:{ // F9 — the ruined nave: pillar rows, drifting shades, memory orbs
    terrain(){
      floors.splice(1,0,{x:-5,y:0,w:200,h:18,col:'#232838'});
      for(let x=-100;x<=90;x+=12){ walls.push({x:x,y:-7,w:1.6,h:1.6}); walls.push({x:x,y:7,w:1.6,h:1.6}); }
      for(let i=0;i<7;i++) props.push({kind:'orb',x:-95+i*31,y:rand(-3,3),used:false});
      floors.push({x:exit.x-9,y:0,w:12,h:14,col:'#2c3346'});
    },
    populate(pool){
      for(let k=0;k<14;k++){ const [x,y]=scatterPos(); const m=MOB('shade',x,y); m.orbit={x:x,y:y,r:rand(2,5),a:rand(0,6.28),w:rand(.08,.22)*(rand(0,1)<.5?1:-1)}; }
      for(let i=0;i<7;i++){ const [x,y]=scatterPos(); MOB(pick(pool),x,y); }
    } },
  ascent:{ // F10 — the final approach: an honour guard flanks the causeway to the dais
    terrain(){
      floors.push({x:exit.x-7,y:0,w:14,h:14,col:'#4a3c1c'});
      props.push({kind:'plaque',x:WORLD_HW*0.18,y:-8,read:'Plaque: \"THE CROWN — all climbs end.\"'});
    },
    populate(pool){
      for(let k=0;k<7;k++){ const px=WORLD_HW*0.22+k*11, m=MOB('templar', px, -8.5); m.orbit={x:px,y:-8.5,r:.4,a:rand(0,6.28),w:.4}; }
      for(let k=0;k<7;k++){ const px=WORLD_HW*0.22+k*11, m=MOB('seraph', px, 8.5); m.orbit={x:px,y:8.5,r:.4,a:rand(0,6.28),w:.4}; }
      let asc=0, atry=0;
      while(asc<14 && atry++<90){ const [x,y]=scatterPos(); if(x>WORLD_HW*0.15) continue; MOB(pick(pool),x,y); asc++; }
    } },
};
function genWorld(f){
  walls=[]; floors=[]; npcs=[]; props=[]; decos=[]; nestSpots=[]; vaultSpot=null; bossDead=false; safeZones=[]; buildings=[]; poiList=[]; TILE_CHUNKS.clear();
  restricted=[]; wantedT=0; jailT=0; jailCell=null; jailDoor=null;
  pendingMobs=[]; arenaState=null; arenaDone=false; arenaSpot=null; choiceNpc=null; choiceOpts=null;
  world={ hw:WORLD_HW, hh:WORLD_HH, w:WORLD_HW*2, h:WORLD_HH*2 };
  floors.push({x:0,y:0,w:world.w,h:world.h,base:true});
  hwall(-WORLD_HW-TW,WORLD_HW+TW,-WORLD_HH,true); hwall(-WORLD_HW-TW,WORLD_HW+TW,WORLD_HH,true);
  vwall(-WORLD_HH-TW,WORLD_HH+TW,-WORLD_HW,true); vwall(-WORLD_HH-TW,WORLD_HH+TW,WORLD_HW,true);
  exit={ x:WORLD_HW-6, y:0, r:1.8, open:false, found:true };  // stair (classic east; most floors relocate it below)
  if(!realm.special && f<TOTAL_FLOORS){   // hide the stair somewhere in the wilds — go find it
    let bx=WORLD_HW-10, by=0, bd=0;
    for(let t9=0;t9<18;t9++){ const cx9=rand(-WORLD_HW+24, WORLD_HW-12), cy9=rand(-WORLD_HH+12, WORLD_HH-12);
      const d9=len(cx9-(-WORLD_HW+8), cy9-0); if(d9>bd){ bd=d9; bx=cx9; by=cy9; } }
    exit.x=bx; exit.y=by; exit.found=false;
  }
  npcs.push(makeNPC('sage', -WORLD_HW+14, 0));              // greeter
  if(!LEAN) npcs.push(makeNPC('quester', -WORLD_HW+18, 6));           // Herald with this floor's quest

  // candidate cells (grid), shuffled; skip cells near the exit
  // ----- a clean city GRID: full-span avenues divide the map into blocks; one structure per block -----
  const AVX=[-104,-52,0,52,104], AVY=[-66,-22,22,66];                    // avenues sit between block columns/rows (denser SoR grid)
  const BLOCKX=[-130,-78,-26,26,78,130], BLOCKY=[-88,-44,0,44,88];       // 6x5 = 30 blocks, packed (edge ring sits out in the wilds)
  const [palX,palY]=palacePos();
  let coreCells=[], edgeCells=[]; for(const bx of BLOCKX) for(const by of BLOCKY){
    if(len(bx-exit.x,by-exit.y)<22) continue;                            // the stair keeps its own block
    if(len(bx-(-WORLD_HW+8),by-0)<26) continue;                          // and the entrance approach
    if(realm.palace && len(bx-palX,by-palY)<26) continue;                // and the palace grounds
    ((Math.abs(bx)>=130||Math.abs(by)>=88)?edgeCells:coreCells).push([bx,by]); }
  shuffle(coreCells); shuffle(edgeCells);
  // a few outer-ring blocks become the WILD FRONTIER (purposeful detours); the settlement fills the rest
  const wildCells = edgeCells.slice(0, (realm.special?0:(3+Math.floor(rand(0,3)))));
  let cells = coreCells.concat(edgeCells.slice(wildCells.length)); shuffle(cells);

  // assemble this floor's feature list: lore-forced by the floor, flavoured by the modifier, then random fill
  const want = realm.special ? 12 : 52 + Math.floor(rand(0,10));
  const bag = ['garden','nest','ruins','graveyard','pond','cache','shrines','nest','garden','ruins','inn','farm','farm','arena','tower','enchanter','banditcamp','monument','spring','mine','caravan','tower','banditcamp','spring','tavern','library','tavern','homestead','homestead','homestead','homestead','homestead','homestead','cart','cart','cart','campsite','campsite','campsite','orchard','orchard','hamlet','hamlet','hamlet','hamlet','hamlet','market','market','square','square','chapel','chapel','shanty','shanty','shanty'];
  let feats = [...(districtPlan&&districtPlan.feats||[]), ...(realm.feats||[]), ...(floorMod.force||[])];
  if(!realm.special) feats.unshift('hamlet','homestead','market','square','garden');   // baseline simple structures every built floor
  const used = {}; feats.forEach(k=>used[k]=(used[k]||0)+1);
  if(!used['town'] && !realm.special && rand(0,1)<0.5){ feats.unshift('town'); used['town']=1; }
  if(!used['guild'] && !realm.special && rand(0,1)<0.6){ feats.unshift('guild'); used['guild']=1; }   // 3.0: a Guild Hall with a ranking dais
  while(feats.length < want){
    const k = pick(bag);
    if(UNIQUE_FEATS[k] && (used[k]||0) >= UNIQUE_FEATS[k]) continue;
    used[k]=(used[k]||0)+1; feats.push(k);
  }
  const placed=[];
  const setRoles=new Set();
  const SET_ROLE={town:'town',keep:'town',manor:'town',chapel:'chapel',monastery:'chapel',necropolis:'graveyard',pit:'arena',minecamp:'mine',academy:'library',inn:'tavern',bazaar:'market',trade:'market',caravan:'caravan',farmstead:'farm',grove:'garden',bandit:'banditcamp'};
  const FEAT_ROLE={chapel:'chapel',arena:'arena',mine:'mine',library:'library',tavern:'tavern',market:'market',caravan:'caravan',farm:'farm',garden:'garden',orchard:'garden',graveyard:'graveyard',town:'town',city:'town',banditcamp:'banditcamp'};
  let ci=0;
  // ----- STRUCTURAL SETS first: the walled locations claim their blocks -----
  if(!realm.special){
    const sbag=shuffle(STRUCT_SETS.slice());
    const nS = 9 + Math.floor(rand(0,5));   // 9-13 walled locations a floor (packed)
    let si=0;
    for(let d=0; d<nS; d++){
      const set=sbag[si++ % sbag.length], half=(SET_SIZES[set.size]||SET_SIZES.M)[0]*0.5;
      let cell=null;
      while(ci<cells.length){ const c=cells[ci++]; if(Math.abs(c[1])>WORLD_HH-half-4) continue; cell=c; break; }
      if(!cell) break;
      // face a gate toward the nearest avenue so the entrance fronts the street
      let nvx=AVX[0],nvy=AVY[0]; for(const a of AVX) if(Math.abs(a-cell[0])<Math.abs(nvx-cell[0])) nvx=a; for(const a of AVY) if(Math.abs(a-cell[1])<Math.abs(nvy-cell[1])) nvy=a;
      const fg = Math.abs(nvx-cell[0])<=Math.abs(nvy-cell[1]) ? (nvx>cell[0]?'E':'W') : (nvy>cell[1]?'S':'N');
      const nm=buildSet(cell[0],cell[1],set,fg);
      setRoles.add(SET_ROLE[set.key]||set.key);
      placed.push({kind:set.size==='L'?'town':set.size==='M'?'inn':'shanty',x:cell[0],y:cell[1]});
      poiList.push({x:cell[0],y:cell[1],kind:'set',name:nm,found:false});
    }
  }
  // ----- DENSE DISTRICTS: packed blocks of small enclosed rooms give the floor Streets-of-Rogue density -----
  if(!realm.special){
    const nDist = 4 + Math.floor(rand(0,3));
    for(let d=0; d<nDist && ci<cells.length; d++){
      let cell=null;
      while(ci<cells.length){ const c=cells[ci++]; if(Math.abs(c[1])>WORLD_HH-26 || Math.abs(c[0])>WORLD_HW-24) continue; cell=c; break; }
      if(!cell) break;
      buildDistrict(cell[0], cell[1], 3, 3, districtPlan);
      placed.push({kind:'town', x:cell[0], y:cell[1]});   // counts as built so the street network reaches it
    }
  }
  // ----- POIs fill the remaining blocks -----
  const STRUCT_CAP = 24 + Math.floor(rand(0,7));   // packed, but leave a few blocks for the wilds & road-gaps
  for(let i=0;i<feats.length;i++){
    if(ci>=cells.length || placed.length>=STRUCT_CAP) break;
    if(FEAT_ROLE[feats[i]] && setRoles.has(FEAT_ROLE[feats[i]])) continue;   // a walled set already covers this role
    const cell=cells[ci++];
    const fx=cell[0]+rand(-1,1), fy=cell[1]+rand(-1,1);
    lastPoiName=null; FEATURE_FNS[feats[i]](fx,fy); placed.push({kind:feats[i],x:fx,y:fy});
    poiList.push({x:fx,y:fy,kind:feats[i],name:lastPoiName||POI_NAMES[feats[i]]||('a '+feats[i]),found:false});
  }
  // ----- WILD FRONTIER: purposeful structures ring the settlement out in the wilds (off the road grid) -----
  if(wildCells.length){
    const wbag=shuffle(Object.keys(WILD_FNS));
    for(let w=0; w<wildCells.length; w++){
      const bx=wildCells[w][0], by=wildCells[w][1], k=wbag[w % wbag.length];
      const fx=Math.max(-WORLD_HW+10,Math.min(WORLD_HW-10,bx+rand(-2,2))), fy=Math.max(-WORLD_HH+8,Math.min(WORLD_HH-8,by+rand(-2,2)));
      lastPoiName=null; lastPoiReward=null; WILD_FNS[k](fx,fy);
      const pe={x:fx,y:fy,kind:k,name:lastPoiName||('a '+k),found:false,wild:true}; if(lastPoiReward) pe.reward=lastPoiReward;
      poiList.push(pe);
    }
  }

  // ----- every built (non-special) floor: a street network that hugs the settled blocks (never blankets the wilds) -----
  if(!realm.special){
    const roadFloors=[], RW=3.6, MG=13, ribK=[];
    const idxOf=(arr,v)=>{ let bi=0; for(let i=1;i<arr.length;i++) if(Math.abs(arr[i]-v)<Math.abs(arr[bi]-v)) bi=i; return bi; };
    const colRows={};                                                      // occupied rows, per block-column
    for(const p of placed){ const c=idxOf(BLOCKX,p.x), r=idxOf(BLOCKY,p.y); (colRows[c]=colRows[c]||{})[r]=1; }
    const colHas=(c)=>colRows[c]&&Object.keys(colRows[c]).length>0;
    const runsOf=(idxs)=>{ idxs=[...new Set(idxs)].sort((a,b)=>a-b); const out=[];     // contiguous clusters, no gap-bridging
      for(const i of idxs){ const last=out[out.length-1]; if(last && i-last[1]<=1) last[1]=i; else out.push([i,i]); } return out; };
    // ---- MAIN STREET (spine): the cross-avenue fronting the most blocks becomes the high street ----
    let m0=1, best=-1;
    for(let m=0;m<AVY.length;m++){ let s=0; for(let c=0;c<BLOCKX.length;c++) if(colRows[c]&&(colRows[c][m]||colRows[c][m+1])) s++; if(s>best){best=s;m0=m;} }
    const spineY=AVY[m0];
    const occCols=[]; for(let c=0;c<BLOCKX.length;c++) if(colHas(c)) occCols.push(c);
    let spineX0=1e9, spineX1=-1e9;
    for(const [c0,c1] of runsOf(occCols)){                                 // one high street across the built columns (split only at true gaps)
      const x0=Math.max(-WORLD_HW+6,BLOCKX[c0]-MG), x1=Math.min(WORLD_HW-6,BLOCKX[c1]+MG);
      roadFloors.push({x:(x0+x1)/2, y:spineY, w:(x1-x0), h:RW, road:true});
      spineX0=Math.min(spineX0,x0); spineX1=Math.max(spineX1,x1); }
    // ---- RIBS: vertical lanes branch off the spine ONLY to reach blocks genuinely set back from it ----
    for(let k=0;k<AVX.length;k++){
      const rows=[]; for(let r=0;r<BLOCKY.length;r++) if((colRows[k]&&colRows[k][r])||(colRows[k+1]&&colRows[k+1][r])) rows.push(r);
      const far=rows.filter(r=>r!==m0 && r!==m0+1);                        // rows that the high street does NOT already serve
      if(!far.length) continue; let laid=false;                           // spine-adjacent-only columns lean on the high street
      for(const [r0,r1] of runsOf(rows)){
        if(!(r0<m0 || r1>m0+1)) continue;                                  // this cluster sits on the spine band — no rib needed
        const y0=Math.min(spineY, Math.max(-WORLD_HH+6, BLOCKY[r0]-MG)), y1=Math.max(spineY, Math.min(WORLD_HH-6, BLOCKY[r1]+MG));
        if(y1-y0 < RW*2.2) continue;
        roadFloors.push({x:AVX[k], y:(y0+y1)/2, w:RW, h:(y1-y0), road:true}); laid=true; }
      if(laid && AVX[k]>=spineX0-2 && AVX[k]<=spineX1+2) ribK.push(k); }
    // ---- entrance lane from the west wall, joining the spine's west end ----
    { const lx0=-WORLD_HW+8, joinX=Math.max(spineX0, lx0+10);
      roadFloors.push({x:(lx0+joinX)/2, y:0, w:(joinX-lx0), h:RW, road:true});
      if(Math.abs(spineY)>RW) roadFloors.push({x:joinX, y:spineY/2, w:RW, h:Math.abs(spineY)+RW, road:true}); }
    // ---- a small plaza + lamp where each rib meets the high street ----
    for(const k of ribK){ roadFloors.push({x:AVX[k], y:spineY, w:RW+2.6, h:RW+2.6, road:true});
      props.push({kind:'lamp', x:AVX[k]-3.4, y:spineY-3.4, tall:true}); }
    floors.splice(1,0,...roadFloors);
    walls = walls.filter(w9 => !(w9.cwall && !w9.cage && roadFloors.some(f9=>Math.abs(w9.x-f9.x)<(w9.w+f9.w)/2-0.2 && Math.abs(w9.y-f9.y)<(w9.h+f9.h)/2-0.2)));   // streets open a gate where they meet a wall
    // ---- street lamps pace every road, alternating sides ----
    let li=0;
    for(const f of roadFloors){ if(props.filter(p=>p.kind==='lamp').length>=132) break;
      const horiz=f.w>f.h, L=horiz?f.w:f.h; if(L<14) continue;
      const n9=Math.max(1,Math.floor(L/16));
      for(let i=1;i<=n9;i++){ const t=i/(n9+1), side=(li++%2)?1:-1;
        const x=horiz?(f.x-f.w/2+t*f.w):(f.x+side*(RW/2+1.3));
        const y=horiz?(f.y+side*(RW/2+1.3)):(f.y-f.h/2+t*f.h);
        props.push({kind:'lamp',x,y,tall:(li%3===0)}); } }
    // ---- kerb furniture: a ribbon of benches, planters & bollards down the streets ----
    const FURN_CAP=84; let furnN=0;
    for(const f of roadFloors){ if(furnN>=FURN_CAP) break;
      const horiz=f.w>f.h, L=horiz?f.w:f.h; if(L<16) continue;
      const step=5.4, n9=Math.floor(L/step);
      for(let i=1;i<=n9 && furnN<FURN_CAP;i++){ const t=i/(n9+1);
        const seed=(Math.abs(Math.round(f.x*31+f.y*53+i*17)))%100;
        if(seed<26) continue;                                          // gaps keep the ribbon natural
        const side=(seed&1)?1:-1, off=RW/2+1.05;
        const x=horiz?(f.x-f.w/2+t*f.w):(f.x+side*off);
        const y=horiz?(f.y+side*off):(f.y-f.h/2+t*f.h);
        if(props.some(p=>(p.kind==='lamp'||p.kind==='bench'||p.kind==='planter'||p.kind==='bollard')&&Math.abs(p.x-x)<2.2&&Math.abs(p.y-y)<2.2)) continue;
        if(buildings.some(b=>Math.abs(b.x-x)<b.w/2+1&&Math.abs(b.y-y)<b.h/2+1)) continue;
        const kind = seed<52?'planter' : seed<78?'bench' : 'bollard';
        props.push({kind, x, y, face:horiz?1:0}); furnN++; }
    }
    // banners flank each rib-plaza for a civic flourish (banner is a DECO, not a prop; fly the district colour if set)
    for(const k of ribK){ decos.push({type:'banner',x:AVX[k]+3.4,y:spineY-3.4,s:1,seed:(k*5+3)&255,col:(districtPlan&&districtPlan.col)||undefined,struct:true}); }
    // ---- a Tollhouse of the Watch beside the entrance lane ----
    { const tx=-WORLD_HW+22, ty=8;
      const clear=!placed.some(p=>Math.abs(p.x-tx)<14&&Math.abs(p.y-ty)<12) && !buildings.some(b=>Math.abs(b.x-tx)<8&&Math.abs(b.y-ty)<8);
      if(clear){ building(tx,ty,4.6,3.6);
        props.push({kind:'sign',x:tx,y:ty-3.0,text:'\ud83d\udee1 Tollhouse of the Watch'});
        const tg=makeNPC('guard',tx+0.6,ty+2.6); tg.roam=true; tg.post={x:tg.x,y:tg.y,r:3}; npcs.push(tg); } }
    // ---- travellers walking the streets (sampled along the actual road rects) ----
    const kinds=['wanderer','child','guard','farmer','wanderer','bard','courier','storyteller','villager','peasant','pedlar','laborer',
      'crier','drunkard','busker','lamplighter','dancer','ratcatcher','errant','acolyte','washer','beggar','noble','monk'];
    const longRoads=roadFloors.filter(f=>Math.max(f.w,f.h)>12);
    const spineRoads=roadFloors.filter(f=>Math.abs(f.y-spineY)<RW && f.w>30);   // the high street draws the crowd
    const crowdPool=[...longRoads, ...spineRoads, ...spineRoads, ...spineRoads];  // spine weighted ~4x
    const nT=Math.round((34+Math.floor(rand(0,12))) * ((districtPlan&&districtPlan.crowd)||1));
    for(let i=0;i<nT;i++){
      let rx,ry; const f=crowdPool.length?pick(crowdPool):roadFloors[0];
      if(f){ const horiz=f.w>f.h;
        rx=horiz?rand(f.x-f.w/2+3, f.x+f.w/2-3):(f.x+rand(-1.2,1.2));
        ry=horiz?(f.y+rand(-1.2,1.2)):rand(f.y-f.h/2+3, f.y+f.h/2-3);
      } else { rx=rand(-40,40); ry=rand(-30,30); }
      const n=makeNPC(pick(kinds), rx, ry); n.civ=true; n.roam=true; n.post={x:rx,y:ry,r:5}; n.home={x:rx,y:ry}; npcs.push(n);
    }
  }

  // if no town, leave a lone merchant + healer in the wild
  if(!used['town']){ const a=scatterPos(), b=scatterPos(); npcs.push(makeNPC('merchant',a[0],a[1])); npcs.push(makeNPC('healer',b[0],b[1])); }

  // obstacle pillars + loose chests
  for(let i=0;i<28;i++){ const [x,y]=scatterPos(); if(len(x-exit.x,y-exit.y)<10) continue;
    if(inSafe(x,y)) continue;
    let clear9=true; for(const b9 of buildings){ if(len(b9.x-x,b9.y-y)<6){ clear9=false; break; } }
    if(clear9) walls.push({x,y,w:rand(1.6,3.4),h:rand(1.4,3),ruin:true}); }
  const nChest = 4 + (floorMod.chests||0);
  for(let i=0;i<nChest;i++){ const [x,y]=scatterPos(); props.push({kind:'chest',x,y,opened:false,big:floorMod.bigLoot&&rand(0,1)<0.3}); }

// the waystone network: one at the entrance, three hidden across the world
  buildWaystone(-WORLD_HW+28,5);   // just past the entrance lane
  { // one stone per far-flung quadrant, with a guaranteed fallback spot
    const quads=[[-WORLD_HW*0.35,-WORLD_HH*0.45],[WORLD_HW*0.15,WORLD_HH*0.45],[WORLD_HW*0.55,-WORLD_HH*0.35]];
    for(const q of quads){ let done=false, t=0;
      while(!done && t++<40){ const x=q[0]+rand(-22,22), y=q[1]+rand(-16,16);
        if(inWall(x,y,1.2) || inSafe(x,y)) continue;
        if(len(x-exit.x,y-exit.y)<25) continue;
        buildWaystone(x,y); done=true; }
      if(!done) buildWaystone(q[0],q[1]); } }
  if(!realm.layout){ for(let i=0;i<2;i++){ const [x,y]=scatterPos(); npcs.push(makeNPC('hermit',x,y)); } }
    // bespoke floor direction: terrain pass
  { const mg = realm.mapgen && MAPGEN[realm.mapgen]; if(mg && mg.terrain) mg.terrain(); }
  { const roadF=floors.filter(f9=>f9.road); floors = floors.filter(f9 => !(f9.hazard && roadF.some(r=>Math.abs(f9.x-r.x)<(f9.w+r.w)/2-1 && Math.abs(f9.y-r.y)<(f9.h+r.h)/2-1))); }   // a street is never lava
  // jungle floors are dense: thick undergrowth + scattered trees
  if(realm.dense){ for(let i=0;i<72;i++){ const [x,y]=scatterPos(); if(len(x-exit.x,y-exit.y)<10) continue; walls.push({x,y,w:rand(1.2,2.2),h:rand(1.2,2.2)}); } }
  let s=((((f*9301+49297) ^ ((typeof player!=='undefined'&&player&&player.runSeed)|0)) >>> 0) % 233280) || 1;   // seeded by run+floor: deco scatter is stable within a run but differs each climb
  const r=()=>(s=(s*9301+49297)%233280)/233280;
  // biome landmark props — give the open ground character (purely decorative, drawn under characters)
  const _keepD=decos.filter(d=>d.struct); decos=[]; const dset=DECO[realmIndex(f)]||DECO[0]; let solidN=0;   // structural decos (set/room/gateway furniture & banners) survive the wild repopulate
  const SOLID={ tree:0.7, rock:0.95, pillar:0.85, crystal:0.75, brazier:0.65, totem:0.85, crate:0.95, barrel:0.85 };
  const target=Math.round(dset.count*1.6);                       // denser, biome-true cover
  const addDeco=(type,x,y,s)=>{ decos.push({type,x,y,s,seed:(r()*1e9)|0}); if(SOLID[type] && solidN<18){ const sz=SOLID[type]*s; walls.push({x,y,w:sz,h:sz,deco:true}); solidN++; } };
  // ---- groves & fields: clusters of one type, biased to the terrain ----
  const nClust=4+Math.floor(r()*4);
  for(let c=0; c<nClust && decos.length<target; c++){ const[cx,cy]=scatterPos(); const ctype=dset.types[(r()*dset.types.length)|0]; const nC=3+Math.floor(r()*5);
    for(let k=0;k<nC && decos.length<target;k++){ const a=r()*6.28, rr=1.6+r()*5.4, x=cx+Math.cos(a)*rr, y=cy+Math.sin(a)*rr;
      if(Math.abs(x)>WORLD_HW-4||Math.abs(y)>WORLD_HH-4) continue;
      if(onRoad(x,y,2)||inSafe(x,y)||inWall(x,y,0.8)||onHazardFloor(x,y,1)) continue;
      if(decos.some(d=>len(d.x-x,d.y-y)<2.2)) continue;
      addDeco(ctype, x, y, 0.8+r()*0.7); } }
  // ---- scattered singles fill the rest ----
  for(let t=0; decos.length<target && t<target*7; t++){ const[x,y]=scatterPos();
    if(decos.some(d=>len(d.x-x,d.y-y)<3.0)) continue;
    addDeco(dset.types[(r()*dset.types.length)|0], x, y, 0.8+r()*0.6); }
  if(_keepD.length) decos.push(..._keepD);   // re-add structural banners / room furniture after the wild scatter
}
// builds the two family compounds (floor 7): walled estate, elite guards, a family head who gates the stair
function grantPatronage(house){
  if(house==='sword'){ player.ad+=12; player.maxHp+=40; player.hp=Math.min(player.maxHp,player.hp+40); }
  else { player.critC=Math.min(.6,player.critC+0.10); player.critM+=0.4; }
}
function pledgeHouse(house){
  if(player.house) return;
  player.house=house; player.housePledged=true; grantPatronage(house);
  bossDead=true; if(exit) exit.open=true;
  sfx('win'); addShake(.3); flashT=Math.max(flashT||0,.05); burst(player.x,player.y,[255,232,165],30,5);
  showToast((house==='sword'?"⚔ You take up the Blade — +12 damage, +40 max HP.":"✦ You join the Arcane — sharper crits, swifter sorcery.")+" The seventh stair opens.");
}
function openHouseHead(n){
  const house=n.headHouse, blade=house==='sword';
  if(blade) player.metBlade=true; else player.metArcane=true;
  if(player.house){
    dialogue = (player.house===house||player.house==='vael')
      ? n.name+": You carry our favour, climber. The stair stands open to you."
      : n.name+": You have chosen the "+(player.house==='sword'?'Blade':'Arcane')+". No quarrel — but no boon, either. The stair lies east.";
    return;
  }
  openChoices(n, n.name+": "+(blade?"Steel remembers what sorcery forgets. Will you take up the Blade's cause?":"Power answers the patient mind. Will you stand with the Arcane?"), [
    { label:"Pledge to the "+(blade?'Blade':'Arcane')+"  (their patronage; the stair opens)", f(){ pledgeHouse(house); } },
    { label:"Hear the house's story", f(){ dialogue=pick(n.tale); } },
    { label:"Step back", f(){ dialogue=n.name+": The seventh stair waits for the decided."; } },
  ]);
}
function youngsonTalk(n){
  if(player.house==='vael'){ n.line++; if(n.line>=n.lines.length){ n.line=-1; dialogue=''; } else dialogue=n.lines[n.line]; return; }   // v199-fix: cycle the reunion lines, never re-offer reunion
  if(player.house){ dialogue = "The boy: You picked a side. ...I hoped you wouldn't have to."; return; }
  if(player.metBlade && player.metArcane){
    openChoices(n, "The boy: You've spoken to Papa AND Mama both. You could... make them one house again? Please?", [
      { label:"Broker peace — reunite the house", f(){ reunionVael(); } },
      { label:"Not yet", f(){ dialogue="The boy: Okay... but please don't make them fight."; } },
    ]); return;
  }
  n.line++; if(n.line>=n.lines.length){ n.line=-1; dialogue=''; } else dialogue=n.lines[n.line];
}
function mkHouseNpc(role, x, y, kind){
  const blade=kind==='sword';
  const D={
    knight:{ name:'a Blade Knight', as:'guard', col:[210,205,180], roam:true, lines:["Knight: Dawn drills, noon drills, dusk drills. The Blade never rests.","Knight: We keep the Vow. Steel, and steel alone.","Knight: The Master's forms could cut falling rain. I have seen it."] },
    errant:{ name:'a Sword-Errant', as:'errant', col:[200,200,180], roam:true, lines:["Sword-Errant: I ride the floors for the House, then home to spar.","Sword-Errant: Honour before the climb. Always.","Sword-Errant: Guard high, climber — even in peace."] },
    smith:{ name:'the House Smith', as:'smith', col:[210,135,85], lines:["Smith: Every blade in this house came off my anvil.","Smith: Folded a thousand times — like the Vow, and just as brittle once it broke.","Smith: We forged for the Arcane too, once. Their orders stopped a generation ago."] },
    steward:{ name:'the House Steward', as:'caravaneer', col:[200,190,150], lines:["Steward: The estate runs on ledgers, not legends.","Steward: Mind the yard — the Heir is drilling, and he is in a mood.","Steward: We do not speak the Arcane's name across this wall. House rule."] },
    arcanist:{ name:'an Arcanist', as:'enchanter', col:[185,160,255], lines:["Arcanist: The mind is the blade here — sharper than any steel.","Arcanist: We broke from the Blade to keep what they would burn: knowledge.","Arcanist: Mind the circle. Step wrong and the wards bite."] },
    scholar:{ name:'a House Scholar', as:'scholar', col:[200,180,255], lines:["Scholar: This library holds the whole house's history — half of it now forbidden across the yard.","Scholar: The Vow, the schism, the boy — it is all written here, for those who can read it.","Scholar: Knowledge outlives grudges. Usually."] },
    enchant:{ name:'the House Enchanter', as:'enchanter', col:[205,150,255], lines:["Enchanter: A blade is a tool. An enchanted blade is an argument.","Enchanter: We would gild the Blade's swords, once. Now they would sooner rust.","Enchanter: Bring me a trinket and I will wake the sleep in it."] },
    acolyte:{ name:'an Apprentice', as:'acolyte', col:[225,225,210], roam:true, lines:["Apprentice: I am learning the third ward. I keep setting my sleeves alight.","Apprentice: The Matriarch is terrifying, and I want to be exactly like her.","Apprentice: Is it true the Blade Heir cannot cast at all? How sad."] },
    heir:{ name: blade?'the Blade Heir':'the Arcane Heir', as: blade?'errant':'enchanter', col: blade?[235,225,160]:[200,160,255],
      lines: blade ? ["Blade Heir: I inherit the sword and the grudge both. Lucky me.","Blade Heir: Father drills me till my hands bleed. He says the Arcane do worse to their own.","Blade Heir: My littlest brother... we do not mention him."]
                   : ["Arcane Heir: Mother says I will surpass her. Mother says many things.","Arcane Heir: We are not the villains the Blade paints. We refused to give up a child, that is all.","Arcane Heir: My cousin across the yard... we were friends, once."] },
  };
  const d=D[role]||D.knight;
  return { type:'house_'+role, x, y, r:.5, line:-1, used:false, name:d.name, color:d.col.slice(), spriteAs:d.as, lines:d.lines.slice(), roam:!!d.roam, house:kind };
}
function buildHouse(cx, cy, kind){
  const blade=kind==='sword', w=32, h=24, L=cx-w/2, R=cx+w/2, T=cy-h/2, B=cy+h/2, g=2.8;
  floors.push({x:cx,y:cy,w,h,col:blade?'#33301f':'#241f38'});
  safeZones.push({x:cx,y:cy,w:w-2,h:h-2});
  vwall(T,B,L); vwall(T,B,R); hwall(L,R,T); hwall(L,cx-g,B); hwall(cx+g,R,B);   // entrance gap, south
  props.push({kind:'sign', x:cx, y:T-1.4, text: blade?"⚔  HOUSE OF THE BLADE  ⚔":"✦  HOUSE OF THE ARCANE  ✦", big:true});
  const head={ type:'househead', headHouse:kind, x:cx, y:cy-h*0.28, r:.62, big:true, line:-1, used:false,
    name: blade?"劍聖 — the Sword Master":"法聖 — the Matriarch of the Arcane",
    color: blade?[235,225,180]:[190,150,255], spriteAs: blade?'errant':'enchanter',
    tale: blade ? ["The Sword Master: We were one house, sworn to blade and spell. The Tower's Vow asked a child of us. I would sooner break the house than feed my son to a stair.","The Sword Master: The Arcane fled with the boy and name ME the betrayer. Let them. The Vow is unbroken on my side.","The Sword Master: Steel is honest. It does not promise what sorcery promises, then take a child to pay the price."]
      : ["The Matriarch: The Blade would have surrendered the boy to the Vow and called it duty. We refused. That is the whole of the schism.","The Matriarch: They keep their precious Vow. We kept a child alive. History will know which mattered.","The Matriarch: Power is patience. One day the Blade will need us — and we will remember this yard."] };
  npcs.push(head);
  if(blade){
    for(let i=0;i<3;i++) props.push({kind:'dummy', x:cx-9+i*2.4, y:cy+4, uses:6});
    for(let i=0;i<4;i++) npcs.push(mkHouseNpc('knight', cx-10+rand(0,7), cy+2+rand(0,4), kind));
    props.push({kind:'anvil', x:cx+9, y:cy-1}); npcs.push(mkHouseNpc('smith', cx+8, cy-1, kind));
    npcs.push(mkHouseNpc('errant', cx+5, cy+3, kind));
    npcs.push(mkHouseNpc('steward', cx-3, cy+6, kind));
    npcs.push(mkHouseNpc('heir', cx-1, cy-h*0.10, kind));
  } else {
    props.push({kind:'orb', x:cx, y:cy+4});
    for(let i=0;i<4;i++){ const a=i/4*6.28; npcs.push(mkHouseNpc('arcanist', cx+Math.cos(a)*3.6, cy+4+Math.sin(a)*2.4, kind)); }
    for(let i=0;i<2;i++) props.push({kind:'book', x:cx-9+i*1.4, y:cy-1});
    npcs.push(mkHouseNpc('scholar', cx-8, cy-1, kind));
    npcs.push(mkHouseNpc('enchant', cx+9, cy-1, kind));
    for(let i=0;i<3;i++) npcs.push(mkHouseNpc('acolyte', cx+5+i*1.4, cy+6, kind));
    npcs.push(mkHouseNpc('heir', cx+1, cy-h*0.10, kind));
  }
}
function buildCompound(cx,cy,kind){
  const w=28,h=22,L=cx-w/2,R=cx+w/2,T=cy-h/2,B=cy+h/2,g=2.2;
  floors.push({x:cx,y:cy,w,h,col:kind==='sword'?'#33301f':'#241f38'});
  hwall(L,R,T); vwall(T,B,L); vwall(T,B,R); hwall(L,cx-g,B); hwall(cx+g,R,B);
  props.push({kind:'sign',x:cx,y:T-1.6,text:kind==='sword'?'⚔ House of the Blade ⚔':'✦ House of the Arcane ✦',big:true});
  for(let k=0;k<3;k++){ const e=MOB(pick(realm.pool), cx+rand(-9,9), cy+rand(-6,6)); e.hp=Math.round(e.maxHp*1.8); e.maxHp=e.hp; }
  props.push({kind:'chest',x:cx+8,y:cy-6,opened:false,big:true});
  const ld=MOB('boss', cx, cy-3); ld.isGate=true; ld.gateBoss=true;
  ld.familyHead=kind;
  if(kind==='sword'){ ld.bossName='★ 劍聖 — Patriarch of the Blade ★'; ld.atk='charge'; ld.atk2='slam'; ld.color=[235,225,180]; ld.look='knight'; }
  else { ld.bossName='★ 法聖 — Matriarch of the Arcane ★'; ld.atk='volley'; ld.atk2='nova'; ld.color=[180,150,255]; ld.look='mage'; }
  if(!boss) boss=ld;
  return ld;
}
// builds an Upper Being's sanctum (floor 8): pillar ring + the champion at its heart
function buildSanctum(cx,cy){
  for(let i=0;i<8;i++){ const a=i/8*6.28; walls.push({x:cx+Math.cos(a)*8, y:cy+Math.sin(a)*6, w:1.3, h:1.3}); }
  floors.push({x:cx,y:cy,w:14,h:10,col:'#241c38'});
}
const SURNAMES=['Ashford','Bellrow','Coldfen','Dray','Elder','Fench','Garrow','Hale','Ives','Kettle','Larch','Mire','Noll','Orme','Pike','Reed','Sallow','Thorn','Underhill','Vane','Wick','Yarrow'];
function linkHouseholds(){                                   // bind nearby civilians into named families
  const civ=npcs.filter(n=>n.civ && n.roam && !n.workFx && !n.grateful);
  shuffle(civ); const taken=new Set();
  for(const n of civ){ if(taken.has(n) || rand(0,1)>0.45) continue;
    const fam=[n]; taken.add(n);
    for(const o of civ){ if(taken.has(o)||o===n) continue; if(Math.abs(o.x-n.x)<15 && Math.abs(o.y-n.y)<13){ fam.push(o); taken.add(o); if(fam.length>=3) break; } }
    if(fam.length<2){ taken.delete(n); continue; }
    const sur=pick(SURNAMES); let hx=0,hy=0; fam.forEach(m=>{hx+=m.x;hy+=m.y;}); hx/=fam.length; hy/=fam.length;
    fam.forEach(m=>{ m.surname=sur; m.kin=fam.filter(x=>x!==m); m.famHome={x:hx,y:hy}; }); }
}
function buildFloor(f){
  floor=f; realm=realmFor(f); floorMod=pick(FLOOR_MODS); districtPlan=districtFor(f); operation=null; floorScale=(1+(f-1)*0.30)*(1+0.45*ngPlus);   // steep curve; NG+ sharpens it
  floorAge=0; wardenSpawned=false; encounters={camps:[],warband:false}; vaultSeal=null; fadeT=1; mapOpen=false;
  cheered=false; crowdCheer=0; fleePulse=0;
  encDist=0; encCd=8; encLastX=0; encLastY=0;
  worldEvents=[]; eventCd=55+Math.floor(rand(0,35)); obeliskTrial=null;
  incidents=[]; incidentCd=70+Math.floor(rand(0,45));   // feuds start later than the world event so it leads
  bloodMoon = bmEligible(f) && bmRoll(f);              // CRIMSON MOON: a deep-night blood event on some non-boss floors
  if(bloodMoon){ floorClock=0.82; eventCd+=14; }       // slam to deep night; hold the regular Event Director back — the moon IS the event
  floorStats={elites:0, coins0:coinCount, kills0:kills}; floorQuestsGiven=0;
  extortsThisFloor=0; escortsThisFloor=0; askedThisFloor=false;   // v199: reset social budgets each floor
  if(choiceNpc) choiceNpc._social=false; choiceOpts=null; choiceNpc=null; dialogue='';   // v199: a stale social menu (and its text) can never survive a floor rebuild
  bgCol=realm.bg; floorCol=realm.floor; wallCol=realm.wall;
  realm.bossPick = realm.bossList ? pick(realm.bossList) : null;
  genWorld(f);
  mobs=[]; boss=null; championsList=[]; projectiles=[]; eProjectiles=[]; shocks=[]; coins=[]; worldKit=[]; bolts=[]; shopStock={apothecary:null,trinketer:null};
  for(const _k in shopSold){ if(_k.indexOf(floor+'|')!==0) delete shopSold[_k]; }   // v203: keep only THIS floor's sold-locks
  pings=[]; mortars=[]; eliteBudget=4+ngPlus*2+covEliteBonus(); if(player) player.songT=0;
  const spawnPool=[...realm.pool, realm.sig, realm.sig];
  placeDistrictOperation(spawnPool);
  // roaming foes across the larger world (count + toughness flavoured by the modifier)
  const count=Math.round(Math.min(96, 26+f*3) * (floorMod.enemyMult||1) * (realm.dense?1.6:1) * (trialActive?1.35:1) * covCountMul());
  { const mg = realm.mapgen && MAPGEN[realm.mapgen];
    if(mg && mg.populate){ mg.populate(spawnPool);
      let topup=0;   // each floor's set-pieces stay; the wider wilds get filled to par
      while(mobs.filter(m=>!m.isGate&&!m.champion&&m.type!=='nest').length < Math.round(count*0.85) && topup++<90){ const [x,y]=scatterPos(); MOB(pick(spawnPool),x,y); }
    } else for(let i=0;i<count;i++){ const [x,y]=scatterPos(); MOB(pick(spawnPool),x,y); }
    for(const pm of pendingMobs){ const kind=pm.kind||pick(realm.pool); if(pm.pack) spawnPack(kind,pm.pack,pm.x,pm.y); else { const mm=MOB(kind,pm.x,pm.y); if(pm.setMob) mm.provoked=false; } } pendingMobs=[];
    if(floorMod.eHp){ for(const e of mobs){ if(!e.isGate&&!e.champion){ e.hp=Math.round(e.hp*floorMod.eHp); e.maxHp=e.hp; } } } }
  // monster nests: a spawner core ringed by foes
  for(const ns of nestSpots){ MOB('nest', ns[0], ns[1]); for(let k=0;k<3;k++) MOB(pick(spawnPool), ns[0]+rand(-4,4), ns[1]+rand(-4,4)); }
  // ---- a roving Titan warband stalks the mid/late floors (camps & road patrols come from the floor's own direction) ----
  if(f>=4 && f<10){ const [wx,wy]=scatterPos(); const sp=realm.sig||pick(spawnPool);
    const wb=MOB(sp,wx,wy); makeElite(wb,'Titan'); wb.patrol={ax:wx,ay:wy,bx:-wx,by:-wy,toB:true};
    for(let i=0;i<4;i++){ const m=MOB(pick(spawnPool), wx+rand(-2.5,2.5), wy+rand(-2.5,2.5)); m.leader=wb; }
    encounters.warband={x:wx,y:wy,species:sp}; }
  // vault elites (tougher)
  if(vaultSpot){ for(let k=0;k<3;k++){ const e=MOB(pick(realm.pool), vaultSpot.x+rand(-4,4), vaultSpot.y+rand(-3,3)); e.hp=Math.round(e.maxHp*1.6); e.maxHp=e.hp; } }

  // ----- the floor's gate -----
  if(realm.special==='champions'){
    // Floor 8: four Upper Beings — resolve each (defeat or befriend) to open the stair
    const defs=[ ['The Crimson Count · Vampire','charge',[230,80,90],'bat'],
                 ['Aurelia · Higher Spirit','nova',[170,235,255],'spirit'],
                 ['Vermithrax · Elder Dragon','volley',[235,150,60],'dragon'],
                 ["Mal'goth · 高階魔族",'summon',[180,110,255],'imp'] ];
    const spots=[[WORLD_HW*0.42,-WORLD_HH*0.52],[WORLD_HW*0.42,WORLD_HH*0.52],[-WORLD_HW*0.05,-WORLD_HH*0.6],[-WORLD_HW*0.05,WORLD_HH*0.62]];
    defs.forEach((d,i)=>{ buildSanctum(spots[i][0],spots[i][1]);
      const c=MOB('general', spots[i][0], spots[i][1]);
      c.bossName=d[0]; c.atk=d[1]; c.color=d[2]; c.look=d[3]; c.champion=true; c.neutralC=true; c.r=1.05;
      c.hp=Math.round(c.hp*2.4); c.maxHp=c.hp; c.touch=Math.round(c.touch*1.3);
      championsList.push(c); });
  } else if(realm.special==='families'){
    // Floor 7: the Two Families in peacetime — two living estates, each with its head, knights and departments
    buildHouse(-WORLD_HW*0.40, -WORLD_HH*0.34, 'sword');
    buildHouse( WORLD_HW*0.16,  WORLD_HH*0.40, 'magic');
    { const child={ type:'youngson', x:-WORLD_HW*0.12, y:0, r:.42, kid:true, line:-1, used:false, name:'the Youngest Son', color:[206,196,255], spriteAs:'child',
        lines:[ "The boy: Papa's house is that way. Mama's is the other. I run between them all day.",
          "The boy: They were all one house once. Then I was born... and they weren't.",
          "The boy: Papa says my magic is a curse. Mama says my sword is. I only ever liked them both.",
          "The boy: Talk to them — to BOTH. Maybe you can do what I can't.",
          "The boy: I don't want a side. I just want them home again." ] };
      npcs.push(child); }
  } else {
    let arx=exit.x, ary=exit.y;
    if(onHazardFloor(arx,ary,2)){ const sp9=scatterPos(); if(sp9&&(sp9[0]||sp9[1])){ arx=sp9[0]; ary=sp9[1]; } }   // keep the chamber off lava/water
    arx=Math.max(-WORLD_HW+13,Math.min(WORLD_HW-13,arx)); ary=Math.max(-WORLD_HH+13,Math.min(WORLD_HH-13,ary));
    exit.x=arx; exit.y=ary;                                     // the portal sits inside the sealed boss room
    bossRoom(arx, ary);
    boss=MOB('boss', arx, ary-2.5); boss.isGate=true; boss.gateBoss=true; if(f<TOTAL_FLOORS) boss.neutralC=true;   // gatekeeper guards the portal: fight it, pay it, or bypass it (final floor stays hostile)
    if(f===TOTAL_FLOORS){ boss.hp=Math.round(boss.hp*2.4); boss.maxHp=boss.hp; boss.r=1.9; boss.speed*=0.9; buildColonnade(); }
  }
  // palaces: restricted ground patrolled by wardens
  if(realm.palace){ const [px,py]=palacePos(); buildPalace(px,py,realm.palace,realm.warden||'legion'); }

  // Floor 5: elves are harmless until provoked
  if(realm.special==='peaceful'||realm.special==='families'){ for(const m of mobs){ if(!m.isGate && !m.champion && m.type!=='nest'){ m.peaceful=true; } } }
  // ----- the bounty-contract mark: a named elite hunts the floors alongside you -----
  if(player && player.contract && player.contract.active && !realm.special){
    const c=player.contract; let sx9=0,sy9=0,t9=0;
    do{ const sp=scatterPos(); sx9=sp[0]; sy9=sp[1]; t9++; } while((len(sx9-exit.x,sy9-exit.y)<16 || inSafe(sx9,sy9) || inWall(sx9,sy9,1.2)) && t9<32);
    const cm=MOB(realm.sig||pick(realm.pool), sx9, sy9);
    if(cm && !cm.isGate){ makeElite(cm, c.name, c.affix); cm.contractTgt=true; cm.smart=true; cm.sight=999; cm.provoked=false;
      cm.hp=Math.round(cm.hp*(1+c.tier*0.22)); cm.maxHp=cm.hp; cm.drop=(cm.drop||5)+8+c.tier*3;
      pings.push({x:sx9,y:sy9,col:'#ff5a8a',life:9999}); }
  }

  if(realm.mapgen==='ridge'){ for(const m of mobs){ if(!m.isGate && (m.type==='swordsman'||m.type==='arcanist') && !m.faction) m.faction = m.x<0?'sword':'magic'; } }
  spawnHouseInfluence();   // the Two Families' reach extends across the whole climb
  // —— encounter sites: themed pockets garrisoned by a named elite, marked on the map ——
  if(!realm.special || realm.special==='peaceful'){
    const ri=realmIndex(f);
    const THEME = (ri===7||ri===5) ? 'crystal' : (ri===8||ri===3) ? 'grave' : 'camp';
    for(let c=0;c<2;c++){
      const [cx2,cy2]=scatterPos();
      if(THEME==='camp'){ decos.push({type:'banner',x:cx2,y:cy2-1.2,s:1.1,seed:1},{type:'brazier',x:cx2-1.5,y:cy2+0.8,s:0.9,seed:2},{type:'crate',x:cx2+1.6,y:cy2+0.7,s:0.9,seed:3}); }
      else if(THEME==='grave'){ for(let g2=0; g2<5; g2++) decos.push({type:'pillar',x:cx2+Math.cos(g2/5*6.28)*2.2,y:cy2+Math.sin(g2/5*6.28)*2.2,s:0.55,seed:g2}); decos.push({type:'bones',x:cx2,y:cy2+0.6,s:1,seed:9}); }
      else { for(let g2=0; g2<5; g2++) decos.push({type:'crystal',x:cx2+Math.cos(g2/5*6.28)*2.4,y:cy2+Math.sin(g2/5*6.28)*2.4,s:0.9,seed:g2}); }
      const campId='c'+f+'_'+c;
      for(let i=0;i<4;i++){ const m=MOB(pick(realm.pool), cx2+rand(-2,2), cy2+rand(-2,2)); m.campId=campId; m.orbit={x:cx2,y:cy2,r:2.4+rand(0,1),a:rand(0,6.28),w:.35}; }
      const w=MOB(pick(realm.pool), cx2, cy2); w.campId=campId; w.warlord=true;
      makeElite(w, (THEME==='grave'?'Restless ':THEME==='crystal'?'Warded ':'Warlord ')+pick(['Gor','Vex','Skarn','Mol','Thar','Ish'])+pick(['ak','uz','eth','or','im']),
        THEME==='crystal'?'Stoneskin':THEME==='grave'?'Vampiric':'Frenzied');
      w.hp=Math.round(w.hp*1.5); w.maxHp=w.hp;
      pings.push({x:cx2,y:cy2,col:'#ff8a5a',life:9999});
      encounters.camps.push({x:cx2,y:cy2,species:w.type});
    }
  }
  // ambush mounds — disturbed earth that erupts when approached
  for(let a2=0;a2<5;a2++){ const [ax2,ay2]=scatterPos(); props.push({kind:'mound', x:ax2, y:ay2, sprung:false, shakeT:0}); }
  for(let c2=0;c2<3;c2++){ const [cx2,cy2]=scatterPos(); props.push({kind:'chest', x:cx2, y:cy2, opened:false, big:rand(0,1)<.25}); }   // loot waits in the wilds
  for(let o2=0;o2<3;o2++){ const [ox2,oy2]=scatterPos(); props.push({kind:'ore', x:ox2, y:oy2, uses:3}); }
  // road patrols — squads marching the highways between settlements
  { const roadF=floors.filter(f2=>f2.road);
    if(roadF.length>=2){ for(let sq=0; sq<2; sq++){ const A=pick(roadF), B=pick(roadF); if(A===B) continue;
      for(let i=0;i<3;i++){ const m=MOB(pick(realm.pool), A.x+rand(-1,1), A.y+rand(-1,1)); m.patrol={ax:A.x,ay:A.y,bx:B.x,by:B.y,toB:true}; } } } }
  stationNPCs();                // craftsfolk take their posts beside their tools
  populateCivilians();          // crowds gather where the structures are
  populateWilds();              // pedlars, climbers and shepherds wander the open land
  scatterMicroSites();          // small sights fill the spaces between structures
  fillBuildings();              // houses pack whatever land is left
  spawnGangs();                 // highwaymen lurk along the streets
  if(floor!==9){ const[ox9,oy9]=scatterPos(); props.push({kind:'orb',x:ox9,y:oy9,used:false});
    if(rand(0,1)<.4){ const[ox8,oy8]=scatterPos(); props.push({kind:'orb',x:ox8,y:oy8,used:false}); } }
  // structures yield to the streets: shift perpendicular off the road, or be demolished
  for(let bi9=buildings.length-1; bi9>=0; bi9--){ const b=buildings[bi9];
    if(b.fixed) continue;   // compound buildings stay put inside their walls
    let rd=null; for(const f9 of floors){ if(f9.road && !f9.lane && Math.abs(b.x-f9.x)<(b.w+f9.w)/2-0.1 && Math.abs(b.y-f9.y)<(b.h+f9.h)/2-0.1){ rd=f9; break; } }
    if(!rd) continue;
    const horiz=rd.w>=rd.h; let moved=false;
    for(const dir of [1,-1]){
      const need = horiz ? (rd.h/2 + b.h/2 + 0.5) : (rd.w/2 + b.w/2 + 0.5);
      const tx = horiz ? b.x : rd.x + dir*need;
      const ty = horiz ? rd.y + dir*need : b.y;
      const dx=tx-b.x, dy=ty-b.y;
      if(Math.abs(dx)+Math.abs(dy) > 7) continue;
      let ok=true;
      for(const ob of buildings){ if(ob===b) continue;
        if(Math.abs(tx-ob.x)<(b.w+ob.w)/2+0.4 && Math.abs(ty-ob.y)<(b.h+ob.h)/2+0.4){ ok=false; break; } }
      if(ok) for(const f9 of floors){ if(!(f9.road||f9.water||f9.hazard||f9.spring)) continue;
        if(Math.abs(tx-f9.x)<(b.w+f9.w)/2-0.1 && Math.abs(ty-f9.y)<(b.h+f9.h)/2-0.1){ ok=false; break; } }
      if(!ok) continue;
      b.x=tx; b.y=ty; if(b.pad){ b.pad.x+=dx; b.pad.y+=dy; }
      if(b.wallRefs) for(const w9 of b.wallRefs){ w9.x+=dx; w9.y+=dy; }
      moved=true; break;
    }
    if(!moved){
      if(b.wallRefs){ const set9=new Set(b.wallRefs); walls=walls.filter(w9=>!set9.has(w9)); }
      if(b.pad){ const fi9=floors.indexOf(b.pad); if(fi9>0) floors.splice(fi9,1); }
      buildings.splice(bi9,1);
    }
  }
  // tidy pass: nothing may stand inside a house that was built after it
  props=props.filter(p=> p.kind!=='lamp' || !buildings.some(b=>Math.abs(p.x-b.x)<b.w/2+0.3 && Math.abs(p.y-b.y)<b.h/2+0.3));
  const inHouse=(x9,y9)=>buildings.some(b=>Math.abs(x9-b.x)<b.w/2 && Math.abs(y9-b.y)<b.h/2);
  for(const n of npcs){ const hb=buildings.find(b9=>Math.abs(n.x-b9.x)<b9.w/2 && Math.abs(n.y-b9.y)<b9.h/2);
    if(hb){ n.y=hb.y+hb.h/2+1.0; if(n.post){ n.post.x=n.x; n.post.y=n.y; } } }
  const evict=new Set(); decos=decos.filter(d=>{ if(inHouse(d.x,d.y)){ evict.add(d.x+','+d.y); return false; } return true; });
  walls=walls.filter(w9=> !(w9.deco && evict.has(w9.x+','+w9.y)));
  if(floor<=2 && !realm.special) populateHaven();   // the lower floors: watch, cutpurses, visitors
  player.quest = LEAN ? null : genQuest(f); floorQuestsGiven=1;   // the Herald's task for this floor
  // ---- terrain reconciliation: hazards never bury settlements, and nothing important sits in lava/water ----
  floors = floors.filter(f9 => !((f9.water||f9.hazard||f9.spring) && safeZones.some(z=>Math.abs(f9.x-z.x)<(f9.w+z.w)/2-1 && Math.abs(f9.y-z.y)<(f9.h+z.h)/2-1)));
  if(exit && onHazardFloor(exit.x,exit.y,1.2)){ const ox9=exit.x, oy9=exit.y; const[ex9,ey9]=scatterPos();
    if(ex9||ey9){ exit.x=ex9; exit.y=ey9; } else if(!onHazardFloor(WORLD_HW-6,0,1.2)){ exit.x=WORLD_HW-6; exit.y=0; }
    const dxe=exit.x-ox9, dye=exit.y-oy9;                                          // the arena follows its stair
    if(dxe||dye){ for(const m of mobs){ if(m.isGate){ m.x+=dxe; m.y+=dye; } }
      for(const f9 of floors){ if(f9.arena){ f9.x+=dxe; f9.y+=dye; } }
      const pm9=poiList.find(p=>p.kind==='bossarena'); if(pm9){ pm9.x+=dxe; pm9.y+=dye; } } }
  for(const p of props){ if(onHazardFloor(p.x,p.y,0.6)){ const[sx9,sy9]=scatterPos(); if(sx9||sy9){ p.x=sx9; p.y=sy9; } } }
  for(const d of decos){ if(onHazardFloor(d.x,d.y,0.4)){ const[sx9,sy9]=scatterPos(); if(sx9||sy9){ d.x=sx9; d.y=sy9; } } }
  for(const m of mobs){ if(!m.stationary && !m.isGate && onHazardFloor(m.x,m.y,0.6)){ const[sx9,sy9]=scatterPos(); if(sx9||sy9){ m.x=sx9; m.y=sy9; } } }
  for(const m of mobs){ if(m.isGate||m.champion) continue; if(onRoad(m.x,m.y,0.4)){ const sp=offRoad(m.x,m.y); m.x=sp[0]; m.y=sp[1]; if(m.orbit){ m.orbit.x=m.x; m.orbit.y=m.y; } if(m.patrol){ m.patrol.ax=m.x; m.patrol.ay=m.y; } } }   // enemies never sit on the street
  for(const n of npcs){ if(onHazardFloor(n.x,n.y,0.6)){ const[sx9,sy9]=scatterPos(); if(sx9||sy9){ n.x=sx9; n.y=sy9; if(n.post){ n.post.x=n.x; n.post.y=n.y; } if(n.home){ n.home.x=n.x; n.home.y=n.y; } } } }
  if(!LEAN && !realm.special && floor>=2){   // ALTAR OF PACT: a Faustian bargain waits in the wilds
    let t9=0, sp=null; do{ sp=scatterPos(); t9++; } while(sp && inSafe(sp[0],sp[1]) && t9<10);
    if(sp) props.push({kind:'altar', x:sp[0], y:sp[1], used:false});
  }
  if(!realm.special){   // VOLATILE HAZARDS: explosive kegs + oil slicks scattered in the wilds
    const nK=2+Math.floor(rand(0,3)), nO=1+Math.floor(rand(0,2));
    for(let i=0;i<nK;i++){ const s2=scatterPos(); if(s2 && !inSafe(s2[0],s2[1])) props.push({kind:'powderkeg', x:s2[0], y:s2[1]}); }
    for(let i=0;i<nO;i++){ const s2=scatterPos(); if(s2 && !inSafe(s2[0],s2[1])) props.push({kind:'oilslick', x:s2[0], y:s2[1]}); }
  }
  if(!LEAN && floor===1){ let t7=0, sc=null; do{ sc=scatterPos(); t7++; } while(sc && inSafe(sc[0],sc[1]) && t7<10); if(sc) props.push({kind:'covenant', x:sc[0], y:sc[1]}); }   // COVENANT STONE at the climb's start
  if(!realm.special && floor>=2 && rand(0,1)<0.25){   // SECRET VAULT: a room sealed behind a cracked wall
    let tv=0, sv=null; do{ sv=scatterPos(); tv++; } while(sv && (inSafe(sv[0],sv[1])||onRoad(sv[0],sv[1],3)) && tv<14);
    if(sv){ const cx=sv[0], cy=sv[1]; vaultRoom(cx, cy, 8, 6);
      walls.push({x:cx-4, y:cy, w:TW, h:3.4, crack:true, hp:55, maxHp:55, vault:true});
      props.push({kind:'chest', x:cx+1.6, y:cy, opened:false, big:true}); }
  }
  if(!LEAN && !realm.special && floor>=2 && rand(0,1)<0.6){   // BLACK MARKET: a hooded merchant deals in the wilds
    let t9=0, sm=null; do{ sm=scatterPos(); t9++; } while(sm && inSafe(sm[0],sm[1]) && t9<10);
    if(sm) props.push({kind:'market', x:sm[0], y:sm[1], revealed:false, entered:false});
  }
  if(!LEAN && !realm.special && floor>=2){   // a lone Mythic Dealer stands somewhere on the floor (black-market passes + secrets)
    let td=0, dm=null; do{ dm=scatterPos(); td++; } while(dm && inSafe(dm[0],dm[1]) && td<10);
    if(dm){ const md=makeNPC('mythic', dm[0], dm[1]); md.roam=false; npcs.push(md); }
  }
  if(!LEAN && !realm.special && floor>=2 && rand(0,1)<0.30){   // TRIAL OBELISK: an opt-in arena challenge
    let t8=0, so=null; do{ so=scatterPos(); t8++; } while(so && inSafe(so[0],so[1]) && t8<10);
    if(so) props.push({kind:'obelisk', x:so[0], y:so[1], used:false});
  }
  if(realm.special==='peaceful'||realm.special==='families'){ for(const m of mobs){ if(!m.isGate && !m.champion && m.type!=='nest'){ m.peaceful=true; m.provoked=false; } } }   // final sweep: a settled floor stays peaceful (catches late encounter spawns)
  initWeather();                // per-floor ambient weather
  linkHouseholds();
  if(bloodMoon){                 // herald the CRIMSON MOON with the boss-intro letterbox + toast + a deep chord
    bossIntroT=2.8; bossIntroName='CRIMSON MOON'; bossIntroSub='the moon bleeds — every foe is enraged, but the dead pay double';
    showToast('🌑 A CRIMSON MOON rises — survive the floor for a relic.'); sfx('boss'); addShake(.3); flashT=Math.max(flashT,.06); }
  if((FT.npcs||[]).length && rand(0,1)<0.4){ const cs=npcs.filter(n=>n.civ && n.roam && !n.surname); if(cs.length){ const g=pick(cs); g.grateful=true; g.savedName=pick(FT.npcs); g.given=g.savedName; g.kin=null; } }
  // ---- shopfronts: street-fronting buildings get an awning over the door and/or a hanging sign ----
  if(!realm.special){
    const roadF2=floors.filter(f9=>f9.road), SIGN_GLYPHS=['\u2692','\u2696','\u269c','\u2702','\u2615','\u2728','\u2660','\u269a','\u2693'];
    for(const b of buildings){
      let near=null,nd=1e9; for(const f of roadF2){ const dx=Math.max(0,Math.abs(b.x-f.x)-f.w/2), dy=Math.max(0,Math.abs(b.y-f.y)-f.h/2); const d=Math.hypot(dx,dy); if(d<nd){ nd=d; near=f; } }
      if(!near || nd>13) continue;
      const h2=(Math.abs(Math.round(b.x*13+b.y*29))|0)%100;
      const dxr=near.x-b.x, dyr=near.y-b.y, road_h=Math.abs(dxr)>Math.abs(dyr);
      if(h2<48) props.push({kind:'awning', x:b.x, y:b.y+b.h/2-0.1, face:1});
      if(h2>=22){ const sx0=road_h?(b.x+(dxr>0?1:-1)*(b.w/2-0.1)):b.x, sy0=road_h?b.y:(b.y+(dyr>0?1:-1)*(b.h/2-0.1)); props.push({kind:'shopsign', x:sx0, y:sy0, glyph:SIGN_GLYPHS[h2%SIGN_GLYPHS.length] }); }
    }
  }
  placePrototypeLandmark(f);
}
// Floor 10: a pillared approach to the throne
function buildColonnade(){
  for(let x=WORLD_HW*0.2; x<WORLD_HW-14; x+=8){ walls.push({x, y:-5.5, w:1.5, h:1.5}); walls.push({x, y:5.5, w:1.5, h:1.5}); }
  floors.push({x:(WORLD_HW*0.2+WORLD_HW-12)/2, y:0, w:WORLD_HW-14-WORLD_HW*0.2+4, h:9, col:'#3a3322'});
}
const PROTOTYPE_LANDMARKS=[
  { name:'First-Step Yard', title:'FIRST-STEP YARD', note:'The Warden, Mossback, and the Bellringer teach the beginner trial with real teeth.', props:['dummy','dummy','board'], npcs:['guard','healer'] },
  { name:'Canopy Ford Camp', title:'CANOPY FORD CAMP', note:'Jungle scouts mark river crossings before the vines move them again.', props:['cookfire','shrine','chest'], npcs:['ranger','herbalist'] },
  { name:'Imperial Notice Row', title:'IMPERIAL NOTICE ROW', note:'Imperia records every climber, conscript, fine, debt, and suspicious silence.', props:['records','board','anvil'], npcs:['magistrate','guard','crier'] },
  { name:"Khan's Hunt Lodge", title:"KHAN'S HUNT LODGE", note:'The beastfolk measure rank by the hunt, then sing the kill until dawn.', props:['dummy','cookfire','chest'], npcs:['ranger','errant'] },
  { name:'Spirit-Pact Grove', title:'SPIRIT-PACT GROVE', note:'The elves borrow magic from higher spirits and return it with interest.', props:['shrine','orb','book'], npcs:['monk','seer'] },
  { name:'Horned Bazaar', title:'HORNED BAZAAR', note:'The 魔物 empire buys sword forms, spell scars, black candles, and polite apologies.', props:['stall','anvil','orb'], npcs:['merchant','smith'] },
  { name:'Cold-War Embassy', title:'COLD-WAR EMBASSY', note:'The Blade and the Arcane recruit the middle level while pretending they are not at war.', props:['book','dummy','board'], npcs:['scholar','errant'] },
  { name:'Four Thrones Antechamber', title:'FOUR THRONES ANTECHAMBER', note:'Vampire, Spirit, Dragon, and 高階魔族 wait for floors of their own.', props:['shrine','orb','chest'], npcs:['seer','scholar'] },
  { name:'Mirror Archive', title:'MIRROR ARCHIVE', note:'The ninth floor stores failed climbs, future deaths, and the first climber who refused the seat.', props:['orb','book','wardoor'], npcs:['scholar','gravedigger'] },
  { name:'Crown Causeway', title:'CROWN CAUSEWAY', note:'Aethon waits where the Tower stops pretending the climb is a test.', props:['shrine','orb','board'], npcs:['sage','pilgrimkeeper'] },
];
function placePrototypeLandmark(f){
  const L=PROTOTYPE_LANDMARKS[f-1]; if(!L) return;
  const x=-WORLD_HW+48, y=-18;
  floors.push({x,y,w:31,h:14,col:realm&&realm.floor?realm.floor:'#2b2c36',road:true,signature:true});
  walls=walls.filter(function(w){ return !(Math.abs(w.x-x)<17 && Math.abs(w.y-y)<9 && !w.vaultDoor && !w.cage); });
  props.push({kind:'sign',x,y:y-8.4,text:L.title,big:true});
  props.push({kind:'plaque',x:x-11,y:y-4.0,read:'Plaque: "'+L.note+'"'});
  props.push({kind:'newsstand',x:x+11,y:y-4.1,reads:0});
  for(let i=0;i<(L.props||[]).length;i++){
    const pk=L.props[i], pp={kind:pk,x:x-8+i*8,y:y+2.8};
    if(pk==='dummy'||pk==='ore') pp.uses=pk==='dummy'?4:3;
    if(['book','shrine','orb','stall','wardoor'].includes(pk)) pp.used=false;
    if(pk==='chest') pp.opened=false;
    if(pk==='wardoor'){ pp.need=2; pp.gate='archive'; }
    props.push(pp);
  }
  for(let i=0;i<(L.npcs||[]).length;i++){
    const n=makeNPC(L.npcs[i], x-9+i*7, y+5.0);
    n.roam=false; n.civ=true; n.post={x:n.x,y:n.y,r:2.2}; npcs.push(n);
  }
  poiList.push({x,y,kind:'signature',name:L.name,found:false});
}
function entrance(){ return [-WORLD_HW+6, 0]; }
const WG_CELL=8; let _wgrid=null, _wgridN=-1;
function rebuildWallGrid(){
  _wgrid=new Map();
  for(const wl of walls){
    const x0=Math.floor((wl.x-wl.w/2-1)/WG_CELL), x1=Math.floor((wl.x+wl.w/2+1)/WG_CELL);
    const y0=Math.floor((wl.y-wl.h/2-1)/WG_CELL), y1=Math.floor((wl.y+wl.h/2+1)/WG_CELL);
    for(let cx=x0;cx<=x1;cx++) for(let cy=y0;cy<=y1;cy++){ const k=cx+','+cy; let a=_wgrid.get(k); if(!a){a=[];_wgrid.set(k,a);} a.push(wl); }
  }
  _wgridN=walls.length;
}
function collideWalls(e){
  if(!_wgrid || _wgridN!==walls.length) rebuildWallGrid();   // walls only change count on build/break, so length is a sound dirty signal
  const cx=Math.floor(e.x/WG_CELL), cy=Math.floor(e.y/WG_CELL);
  for(let gx=cx-1;gx<=cx+1;gx++) for(let gy=cy-1;gy<=cy+1;gy++){
    const a=_wgrid.get(gx+','+gy); if(!a) continue;
    for(const wl of a){ const hx=wl.w/2, hy=wl.h/2;
      if(Math.abs(e.x-wl.x)>hx+e.r || Math.abs(e.y-wl.y)>hy+e.r) continue;
      const nx=Math.max(wl.x-hx,Math.min(e.x,wl.x+hx)), ny=Math.max(wl.y-hy,Math.min(e.y,wl.y+hy));
      let dx=e.x-nx, dy=e.y-ny, d=Math.hypot(dx,dy);
      if(d<e.r){ if(d===0){dx=e.x-wl.x;dy=e.y-wl.y;d=Math.hypot(dx,dy)||1;} const p=(e.r-d)/d; e.x+=dx*p; e.y+=dy*p; }
    }
  }
}

// ---------- State ----------
let player, mobs, coins, particles, projectiles, eProjectiles, shocks, draftCards, kills, coinCount, dialogue, toast, toastT, shake, freezeT, phase, boss, worldKit;
let dmgTexts=[], slashes=[], slowmoT=0, kickX=0, kickY=0, flashT=0;   // combat-juice state
let floorAge=0, wardenSpawned=false, encounters={camps:[],warband:false};   // world-event state
let encDist=0, encCd=6, encLastX=0, encLastY=0;   // Encounter Director: never a long quiet walk
let worldEvents=[], eventCd=20;   // Event Director: a floor-scale world event that drops relics
let incidents=[], incidentCd=0;   // Incident Director: contained NPC-vs-NPC feuds with their own clock
let vaultSeal=null, fadeT=0, heroSwap=false;   // vault rune puzzle, floor-transition fade, title hero-switch
let buildings=[];   // structures that get roofs, doors and lit windows
const ROOFS=['#48525f','#3d5238','#5e3a3a','#5c4a30','#3e523a','#3a3148','#5d5a6a','#3f3a58','#41506b','#5a5036'];
const DECO_H={tree:2.7,bush:1.0,rock:0.95,reed:1.3,mushroom:0.95,crystal:1.5,brazier:1.7,pillar:1.9,banner:2.0,totem:1.9,bones:0.7,crate:0.95,barrel:0.95,flower:0.65};
const PROP_H={beacon:2.4,wardoor:1.8,weathervane:2.2,stall:1.9,lamp:2.1,bench:0.8,planter:1.5,bollard:0.7,shopsign:2.0,awning:1.7,records:1.35,evidence:1.45,relaybox:1.65,wardrobe:1.85,newsstand:1.55,anvil:0.95,keg:0.95,cookfire:0.95,well:1.5,shrine:1.7,waystone:1.9,mound:0.85,board:1.5,dummy:1.6,ore:1.05,book:0.9,orb:1.0,flower:0.6};
let pings=[], mortars=[], eliteBudget=0;   // minimap pings, mortar telegraphs, per-floor elite allowance
let bargainPick=-1, trialNext=false, floorQuestsGiven=0, deathFloor=0;   // descent bargain, pending trial, per-floor quest cap, last death depth
let deathHeroKey=null, deathAt=0;   // hero + timestamp captured at final death so the dead screen can play the death animation
let extortsThisFloor=0, escortsThisFloor=0, askedThisFloor=false;   // v199 Living Conversations: per-floor social budgets (anti-farm), reset in buildFloor
let floor, realm, floorMod, floorScale, bgCol, floorCol, wallCol, trialActive=false;
function MOB(type,x,y){
  const sig = SPECIES[type];
  const base = sig ? sig.base : type;
  // m.sig marks the floor's ELITE species (white ring); every species still gets its look
  const m={x,y,type,base,sig:(realm&&type===realm.sig),smart:(floor>=3),touchCd:0,hitFlash:0,wdx:0,wdy:0,wt:0,bob:rand(0,6)};
  if(base==='slime') Object.assign(m,{r:.45,speed:2.2,sight:5,hp:70,maxHp:70,touch:12,color:[115,217,102],xp:3,drop:1});
  if(base==='darter') Object.assign(m,{r:.35,speed:4.7,sight:8,hp:40,maxHp:40,touch:10,color:[232,93,155],xp:4,drop:1});
  if(base==='spitter') Object.assign(m,{r:.4,speed:1.7,sight:9,hp:50,maxHp:50,touch:8,color:[235,150,60],xp:5,drop:2,fireCd:rand(.6,1.6)});
  if(base==='bomber') Object.assign(m,{r:.42,speed:3.1,sight:8,hp:30,maxHp:30,touch:0,color:[210,80,60],xp:4,drop:1});
  if(base==='nest') Object.assign(m,{r:1.0,speed:0,sight:24,hp:140,maxHp:140,touch:0,color:[70,55,65],xp:12,drop:6,stationary:true,spawnCd:rand(2,4)});
  if(base==='general') Object.assign(m,{r:.85,speed:2.3,sight:14,hp:300,maxHp:300,touch:16,color:[155,89,255],xp:18,drop:5,atkTimer:2.2,slamCount:0});
  if(base==='boss') Object.assign(m,{r:1.15,speed:1.7,sight:16,hp:650,maxHp:650,touch:22,color:[155,89,255],xp:40,drop:10,atkTimer:2.5,slamCount:0});
  // species identity + twists
  m.look = sig ? sig.look : (base==='slime'?'slime':base==='spitter'?'mage':null);
  if(sig){ m.name=sig.name; m.onDeath=sig.onDeath||null;
    m.slow=!!sig.slow; m.trail=!!sig.trail; m.blink=!!sig.blink; m.stealth=!!sig.stealth;
    m.lunge=!!sig.lunge; m.stationary=!!sig.stationary; m.lifedrain=!!sig.lifedrain; m.spread=sig.spread||0;
    if(sig.hp) m.hp=Math.round(m.hp*sig.hp); if(sig.speed) m.speed*=sig.speed;
    m.maxHp=m.hp; if(m.sig){ m.xp+=2; m.drop+=1; } if(sig.blink) m.blinkCd=rand(1,2.5);
  }
  // heavy melee species slam the ground with a telegragraphed crater; long-range spitters can lob mortars
  if(['brute','bruiser','silverback','treant','felguard'].includes(type)){ m.slamAtk=true; m.slamCd=rand(1.5,3); }
  if(base==='spitter' && floor>=4 && rand(0,1)<0.35) m.mortar=true;
  // floor scaling
  const sc=floorScale||1;
  m.hp=Math.round(m.hp*sc); m.maxHp=m.hp; m.touch=Math.round(m.touch*(1+(sc-1)*0.6));
  m.speed*=1+Math.min(0.5,(sc-1)*0.15);
  // 3.0: per-mob defences (floor-scaled) + outgoing damage kind (casters hit as magic)
  m.dmgKind = (base==='spitter' || m.look==='mage' || (sig&&sig.magic)) ? 'magic' : 'physical';
  { const df=(base==='boss')?14:(base==='general')?9:(base==='nest')?0:5, dscale=1+(sc-1)*0.5;
    m.adDef=Math.round(df*dscale); m.apDef=Math.round(df*0.8*dscale); }
  // a few field foes rise as named ELITES with an affix (camps/warlords use makeElite directly)
  if(eliteBudget>0 && !['nest','general','boss'].includes(base) && !m.sig && rand(0,1)<0.07){ eliteBudget--; makeElite(m); }
  // colour: signatures keep their own hue (light realm tint); others tint more strongly
  const baseCol = sig ? sig.color : m.color;
  if(realm){ const a=realm.accent, t=sig?0.18:0.38; m.color=[Math.round(baseCol[0]*(1-t)+a[0]*t),Math.round(baseCol[1]*(1-t)+a[1]*t),Math.round(baseCol[2]*(1-t)+a[2]*t)]; }
  else m.color=baseCol.slice();
  if(base==='boss' || base==='general'){
    if(realm) m.color=realm.accent.slice();
    m.look=(realm&&realm.bossLook)||'imp';
    m.atk=realm?realm.atk:'slam'; m.windup=0; m.chargeT=0; m.chargeDir=[0,0]; m.phase=1; m.seen=false;
    if(base==='boss'){ m.bossName=realm?(realm.bossPick||realm.boss):'Boss'; m.atk2=realm?realm.atk2:'summon'; m.hp=Math.round(m.hp*1.5); m.maxHp=m.hp; m.r=1.45; m.bossName='★ '+m.bossName+' ★'; }
    else { m.bossName='Champion'; m.atk2=null; }   // generals: single-phase mini-bosses (named after creation)
  }
  mobs.push(m); return m;
}

// the canonical base player — one source of truth shared by reset() and getBaseline()
function freshBasePlayer(){
  return { x:0,y:0,r:.45,speed:5.5,hp:100,maxHp:100,fx:0,fy:1,faceX:0,faceY:1,faceLock:0,shootFlash:0,attackAnimT:0,attackAnimDur:.5,comboT:0,comboW:null,weaponKey:'Knight',atkCd:0,atkFlash:0,hurtFlash:0,
           dashCd:0,dashT:0,iframe:0,rangedCd:0,level:1,xp:0,xpNext:12, ad:35, ap:0, adDef:0, apDef:0,
           stamina:100, maxStamina:100, staRegen:18, charge:0, maxMana:100, manaRegen:8, ultCost:100,
           atkCdBase:.35,rangedCdBase:.4,dashCdBase:.8,multishot:1,lifesteal:0,thorns:0,magnet:1.4, slowT:0, regenT:0, parcel:false,
           critC:0, critM:2.0, pdCd:0, riposteT:0, comboN:0, comboTimer:0, comboPop:0, shieldT:0, stormT:0, stormTick:0, hurtDir:0, adrenWas:false,
           abilCd:0, bulwarkT:0, stealthT:0, disguiseT:0, permitT:0, rageT:0, stormKind:null,
           rangedStart:false, chargeMul:1, ultBoost:1, burn:0, venom:0, frostHit:false, chain:false, items:[], kit:Array(25).fill(null), trinkets:[null,null,null], grimoire:[null,null,null], grimCd:[0,0,0], prestige:0, guildSeen:false, kitCd:0, kitMagnetT:0, _trinket:null, rep:{watch:0,cult:0,guild:0,underworld:0,commune:0}, houseStand:{sword:0,magic:0}, contract:null, writT:0, relicsHit:[], relicsKill:[], relicsHurt:[], relicsTick:[], _relic:null, drafted:{}, evolved:{}, evoStormN:0, pactPow:1, pactVuln:1, pacts:[], house:null, housePledged:false, houseFavor:0, houseRank:0, housePow:1, arcMaster:false };
}
// derive a class's starting baseline by running its apply() onto a fresh base (no drift vs CLASSES)
function getBaseline(key){ const t=freshBasePlayer(); const c=CLASSES.find(x=>x.key===key); if(c) c.apply(t); return t; }
function reset(){
  player=freshBasePlayer();
  if(heroClass) heroClass.apply(player);
  { const fb=featCount(); if(fb>0){ player.maxHp+=2*fb; player.hp=player.maxHp; player.ad+=fb; } }   // feats: earned forever
  { const cr=cacheRank(); if(cr>0){ player.maxHp+=4*cr; player.ad+=cr; player.hp=player.maxHp; } }    // Climber's Cache: banked coins, forever
  player.lives = 3 + Math.floor(cacheRank()/3) + (allEchoes()?1:0);   // falls the Tower allows before it keeps you for good
  player.maxLives = player.lives;
  player._relic=null; player.relicsHit=[]; player.relicsKill=[]; player.relicsHurt=[]; player.relicsTick=[];
  if(allEchoes()){ player.charge=10; if(heroClass){ grantItem(false); } }   // the full story arms the climber with a relic
  if(covFrailty()<1){ player.maxHp=Math.max(20,Math.round(player.maxHp*covFrailty())); player.hp=player.maxHp; }   // COVENANT of Frailty
  player.stamina=player.maxStamina; player.charge=Math.min(player.maxMana, Math.max(player.charge, Math.round(player.maxMana*0.4)));  // start full stamina, ~40% mana
  recomputeRelics(); recomputeTrinkets();
  mobs=[]; coins=[]; particles=[]; projectiles=[]; eProjectiles=[]; shocks=[]; draftCards=[];
  kills=0; coinCount=0; dialogue=""; toast=""; toastT=0; shake=0; freezeT=0; ngPlus=0; killsBy={}; waypoint=null; codexOpen=false; trialActive=false; trialNext=false; kitOpen=false; kitSel=0; kitHeld=null; homeSettings=false; heroSelect=false; heroSwap=false; worldKit=[];
  chainN=0; chainTimer=0; chainPop=0; chainBudget=CHAIN_FRAME_CAP; _chainDepth=0;   // corpse-chain state is transient — wipe on a fresh climb
  dmgTexts=[]; slashes=[]; slowmoT=0; kickX=0; kickY=0; flashT=0;
  phase='title'; boss=null; bossIntroT=0; paused=false;
  player.runSeed=(Math.random()*0x7fffffff)>>>0;   // fresh climb -> fresh world: reshuffles districts + deco scatter
  buildFloor(1);
  const [ex,ey]=entrance(); player.x=ex; player.y=ey;
}
function updateHint(){ try{ const h=document.getElementById('hint'); if(!h) return; const k=heroClass?heroClass.key:'Knight';
  const D=' \u00b7 ';
  const txt={ Knight:'LMB sword sweep'+D+'RMB Bulwark'+D+'Q Sunder Quake', Rogue:'LMB daggers'+D+'RMB Smoke Bomb'+D+'Q Dance of Knives',
    Ranger:'LMB longbow'+D+'RMB Mark'+D+'Q Arrow Storm', Mage:'LMB arcane bolt'+D+'RMB Blink'+D+'Q Cataclysm',
    Gorilla:'LMB fists'+D+'RMB Ground Pound'+D+'Q Rampage', Vampire:'LMB blood claws'+D+'RMB Bite'+D+'Q Blood Moon',
    Joker:'LMB razor cards'+D+'RMB Wild Card'+D+'Q 52 Pickup', Necromancer:'LMB soul lash'+D+'RMB Raise Dead'+D+'Q Legion' }[k] || 'LMB attack'+D+'RMB skill';
  h.style.display='block'; h.innerHTML='WASD move'+D+'mouse aim'+D+txt+D+'Shift dash'+D+'E talk/use'+D+'M map'+D+'Esc pause'; }catch(e){} }
function startGame(){ phase='explore'; saveRun(); updateHint(); }
function nextFloor(){
  bumpLT('floors'); saveFeats(); if(covHeat()>0) coinCount+=covHeat()*8;   // Heat dividend on each floor cleared
  if(player) player.prestige=(player.prestige||0)+15;   // 3.0: prestige for clearing a floor
  const wasTrial=trialNext; trialNext=false;
  const wasBloodMoon=bloodMoon;   // snapshot the floor being LEFT — buildFloor() re-rolls for the new floor
  floor++; if(floor>TOTAL_FLOORS){ phase='win'; bumpLT('wins'); saveFeats(); sfx('win'); clearRun(); return; }
  const prev=realm; trialActive=wasTrial; buildFloor(floor);
  if(wasTrial){ for(const m of mobs){ if(!m.isGate&&!m.champion&&m.type!=='nest'){ m.hp=Math.round(m.hp*1.2); m.maxHp=m.hp; m.drop=(m.drop||3)+2; } } }
  projectiles=[]; eProjectiles=[]; shocks=[]; mortars=[]; dmgTexts=[]; slashes=[]; particles=[]; bolts=[];   // no stale FX carry into the new floor
  player.stormT=0; player.shieldT=0; player.bulwarkT=0; player.stealthT=0; player.disguiseT=0; player.permitT=0; player.rageT=0; player.comboN=0; player.comboTimer=0; chainN=0; chainTimer=0; chainPop=0; chainBudget=CHAIN_FRAME_CAP; _chainDepth=0;
  const [ex,ey]=entrance(); player.x=ex; player.y=ey; player.iframe=1; player.hp=Math.min(player.maxHp,player.hp+20);
  if(player.houseStand){ for(const k in player.houseStand){ const v=player.houseStand[k]||0; player.houseStand[k]= v>1?v-2 : v>0?v-1 : v<-1?v+2 : v<0?v+1 : 0; } }   // v196: grudges/welcomes fade unless reinforced
  phase='explore'; saveRun();
  if(wasBloodMoon){             // outlasting a CRIMSON MOON floor pays a relic + coin + a forever-meta tally
    FT.crimson=(FT.crimson||0)+1; saveFeats();
    coinCount+=30+floor*4; dropCoins(player.x,player.y,6); player.charge=Math.min(player.maxMana,player.charge+15);
    showToast('🌑 You outlast the Crimson Moon ('+FT.crimson+') — '+grantRelic(false)); sfx('win'); }
  showToast(realm!==prev ? '✦ Entering '+realm.name+' — Floor '+floor+' ✦' : 'Floor '+floor);
}
function creatorJumpFloor(f){
  f=Math.max(1,Math.min(TOTAL_FLOORS,Math.round(f||1)));
  floor=f; trialActive=false; buildFloor(f);
  const [ex,ey]=entrance(); player.x=ex; player.y=ey; player.iframe=1;
  phase='explore'; mapOpen=false; codexOpen=false; kitOpen=false; saveRun();
  showToast('creator: floor '+f+' — '+(realm?realm.name:''));
}
function creatorWarp(x,y,msg){
  if(x==null||y==null) return false;
  player.x=Math.max(-WORLD_HW+2,Math.min(WORLD_HW-2,x));
  player.y=Math.max(-WORLD_HH+2,Math.min(WORLD_HH-2,y));
  for(let t9=0;t9<60 && inWall(player.x,player.y,player.r);t9++){ player.x+=rand(-1.6,1.6); player.y+=rand(-1.6,1.6); }
  player.iframe=Math.max(player.iframe,1); sfx('dash'); burst(player.x,player.y,[150,200,255],16,4);
  if(msg) showToast(msg);
  return true;
}
function creatorWarpObjective(){
  if(operation && !operation.done) return creatorWarp(operation.x,operation.y,'creator: operation');
  const ch=championsList.find(function(c){return !c.resolved && c.hp>0;});
  if(ch) return creatorWarp(ch.x,ch.y,'creator: champion');
  if(boss && boss.hp>0) return creatorWarp(boss.x-3,boss.y,'creator: gatekeeper');
  const mk=props.find(function(p){return p.kind==='market';});
  if(mk) return creatorWarp(mk.x,mk.y,'creator: black market');
  if(exit) return creatorWarp(exit.x-4,exit.y,'creator: stair');
  showToast('creator: no objective found'); return false;
}
function creatorRevealFloor(){
  let n=0;
  for(const q of poiList){ if(!q.found){ q.found=true; n++; if(pings) pings.push({x:q.x,y:q.y,col:q.arena?'#ffd34d':'#9fd6ff',life:9999}); } }
  for(const p of props){ if(p.kind==='market'){ p.revealed=true; if(pings) pings.push({x:p.x,y:p.y,col:'#c060ff',life:9999}); } }
  if(exit){ exit.found=true; if(pings) pings.push({x:exit.x,y:exit.y,col:'#7dff8a',life:9999}); }
  showToast('creator: revealed '+n+' places, markets, and stair');
}
// ----- save / continue (localStorage) -----
const SAVE_KEY='tower_save_v4', SAVE_KEY_V3='tower_save_v3', SAVE_KEY_V2='tower_save_v2';   // v4: grimoire slots + 25-slot kit
function saveRun(){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify({ floor, kills, coinCount, ng:ngPlus, bes:killsBy, cls:heroClass?heroClass.key:'Knight', p:{
  level:player.level, xp:player.xp, xpNext:player.xpNext, hp:player.hp, maxHp:player.maxHp, ad:player.ad, ap:player.ap, adDef:player.adDef, apDef:player.apDef, stamina:player.stamina, maxStamina:player.maxStamina, staRegen:player.staRegen, maxMana:player.maxMana, manaRegen:player.manaRegen, ultCost:player.ultCost, speed:player.speed,
  atkCdBase:player.atkCdBase, rangedCdBase:player.rangedCdBase, dashCdBase:player.dashCdBase,
  multishot:player.multishot, lifesteal:player.lifesteal, thorns:player.thorns, magnet:player.magnet, critC:player.critC, critM:player.critM,
  burn:player.burn, venom:player.venom, frostHit:player.frostHit, chain:player.chain, charge:player.charge, disguiseT:player.disguiseT, permitT:player.permitT, items:player.items, lives:player.lives, maxLives:player.maxLives, rep:player.rep, houseStand:player.houseStand, usedHermit:player.usedHermit, contract:player.contract, drafted:player.drafted, evolved:player.evolved, evoThermal:player.evoThermal, evoPlague:player.evoPlague, evoPerma:player.evoPerma, evoTempest:player.evoTempest, evoDeath:player.evoDeath, evoSang:player.evoSang, evoStorm:player.evoStorm, evoStormN:player.evoStormN, evoApex:player.evoApex, pactPow:player.pactPow, pactVuln:player.pactVuln, pacts:player.pacts, house:player.house, housePledged:player.housePledged, houseFavor:player.houseFavor, houseRank:player.houseRank, housePow:player.housePow, arcMaster:player.arcMaster, kit:player.kit, trinkets:player.trinkets, grimoire:player.grimoire, prestige:player.prestige, guildSeen:player.guildSeen, forge:player.forge, bmTickets:player.bmTickets, runSeed:player.runSeed }, q:player.quest, wp:waypoint, bm:bloodMoon, ss:shopSold })); }catch(e){} }
function loadRun(){ try{ const v4=localStorage.getItem(SAVE_KEY); if(v4) return JSON.parse(v4);
    const v3=localStorage.getItem(SAVE_KEY_V3); if(v3) return JSON.parse(v3);
    const v2=localStorage.getItem(SAVE_KEY_V2); if(v2){ const s=JSON.parse(v2); if(s&&s.p&&s.p.ad==null) s.p.ad=(s.p.dmg!=null?s.p.dmg:35); return s; }   // migrate legacy v2 -> AD
    return null; }catch(e){ return null; } }
function clearRun(){ try{ localStorage.removeItem(SAVE_KEY); localStorage.removeItem(SAVE_KEY_V3); localStorage.removeItem(SAVE_KEY_V2); }catch(e){} }
function hasSave(){ const s=loadRun(); return s && s.floor>1; }
function continueRun(){ const s=loadRun(); if(!s) return false;
  heroClass = CLASSES.find(c=>c.key===s.cls) || CLASSES[0];
  reset(); Object.assign(player, s.p); ensureRep(); player.items=(s.p.items||[]).slice(); player.kit=normalizeKit(s.p.kit); player.trinkets=normalizeTrinkets(s.p.trinkets); player.drafted=s.p.drafted||{}; player.evolved=s.p.evolved||{}; player._relic=relicAccum(); recomputeRelics(); player._trinket=trinketAccum(); recomputeTrinkets(); shopSold=s.ss||{}; if(allEchoes()){ player.charge=Math.max(player.charge,10); grantItem(false); }
  kills=s.kills||0; coinCount=s.coinCount||0; ngPlus=s.ng||0; killsBy=s.bes||{}; floor=Math.min(TOTAL_FLOORS,Math.max(1,s.floor||1));
  buildFloor(floor); if(typeof s.bm==='boolean'){ bloodMoon=s.bm; if(bloodMoon){ floorClock=0.82; bossIntroT=0; } } if(s.q){ player.quest=s.q; } if(s.wp){ waypoint=s.wp; } const [ex,ey]=entrance(); player.x=ex; player.y=ey; player.hp=Math.min(player.hp,player.maxHp);
  phase='explore'; showToast('Continuing — Floor '+floor); return true;
}
// continue the saved climb as a DIFFERENT hero: class baseline swaps, earned progression carries over
function continueAsHero(idx){
  const s=loadRun(); if(!s) return false;
  const oldC=s.cls||'Knight', newC=CLASSES[idx].key;
  if(oldC===newC) return continueRun();
  const ob=getBaseline(oldC), p=s.p||{};   // baseline of the class we're leaving — carry earned-over-baseline gains
  heroClass=CLASSES[idx]; reset();
  const sav=(k,fb)=>(p[k]!=null?p[k]:fb);
  const savedAd=(p.ad!=null?p.ad:(p.dmg!=null?p.dmg:ob.ad));
  player.level=p.level||1; player.xp=p.xp||0; player.xpNext=p.xpNext||12;
  player.ad   =Math.max(1, player.ad    + (savedAd - ob.ad));
  player.ap   =Math.max(0, player.ap    + (sav('ap',ob.ap) - ob.ap));
  player.adDef=Math.max(0, player.adDef + (sav('adDef',ob.adDef) - ob.adDef));
  player.apDef=Math.max(0, player.apDef + (sav('apDef',ob.apDef) - ob.apDef));
  player.maxHp=Math.max(40, Math.round(player.maxHp + ((p.maxHp||ob.maxHp)-ob.maxHp))); player.hp=player.maxHp;
  player.speed=player.speed + ((p.speed||ob.speed)-ob.speed);
  player.atkCdBase=player.atkCdBase*((p.atkCdBase||ob.atkCdBase)/ob.atkCdBase);
  player.rangedCdBase=player.rangedCdBase*((p.rangedCdBase||ob.rangedCdBase)/ob.rangedCdBase);
  player.dashCdBase=Math.max(.3, player.dashCdBase*((p.dashCdBase||ob.dashCdBase)/ob.dashCdBase));
  player.critC=Math.min(.9, player.critC + ((p.critC!=null?p.critC:ob.critC)-ob.critC));
  if(p.critM) player.critM=p.critM;
  player.multishot=p.multishot||1; player.lifesteal=p.lifesteal||0;
  player.thorns=player.thorns + ((p.thorns||ob.thorns)-ob.thorns);
  player.maxStamina=Math.max(40, player.maxStamina + (sav('maxStamina',ob.maxStamina)-ob.maxStamina)); player.stamina=player.maxStamina;
  player.maxMana=Math.max(40, player.maxMana + (sav('maxMana',ob.maxMana)-ob.maxMana)); player.charge=Math.min(player.maxMana, p.charge!=null?p.charge:Math.round(player.maxMana*0.4));
  player.magnet=p.magnet||1.4; player.items=(p.items||[]).slice(); player.kit=normalizeKit(p.kit); player.trinkets=normalizeTrinkets(p.trinkets); player.grimoire=(Array.isArray(p.grimoire)?p.grimoire.slice(0,3):[null,null,null]); while(player.grimoire.length<3) player.grimoire.push(null); player.prestige=p.prestige||0; player.guildSeen=!!p.guildSeen; if(p.rep) player.rep=p.rep; ensureRep(); player.houseStand=Object.assign({sword:0,magic:0}, p.houseStand||{}); player.usedHermit=p.usedHermit; player.contract=p.contract||null; player.drafted=p.drafted||{}; player.evolved=p.evolved||{}; ['evoThermal','evoPlague','evoPerma','evoTempest','evoDeath','evoSang','evoApex'].forEach(k=>{ if(p[k]) player[k]=p[k]; }); if(p.evoStorm){ player.evoStorm=true; player.evoStormN=p.evoStormN||0; } player.pactPow=p.pactPow||1; player.pactVuln=p.pactVuln||1; player.pacts=p.pacts||[]; player.house=p.house||null; player.housePledged=!!p.housePledged; player.houseFavor=p.houseFavor||0; player.houseRank=p.houseRank||0; player.housePow=p.housePow||1; player.arcMaster=!!p.arcMaster; player._relic=relicAccum(); recomputeRelics(); player._trinket=trinketAccum(); recomputeTrinkets();
  kills=s.kills||0; coinCount=s.coinCount||0; ngPlus=s.ng||0; killsBy=s.bes||{}; floor=Math.min(TOTAL_FLOORS,Math.max(1,s.floor||1));
  buildFloor(floor); if(typeof s.bm==='boolean'){ bloodMoon=s.bm; if(bloodMoon){ floorClock=0.82; bossIntroT=0; } } if(s.q){ player.quest=s.q; } if(s.wp){ waypoint=s.wp; } const [ex,ey]=entrance(); player.x=ex; player.y=ey;
  phase='explore'; saveRun(); updateHint();
  showToast('The '+newC+' takes up the climb — Floor '+floor+'!'); return true;
}

const UPGRADES = [
  { n:'Sharper Blade', d:'+8 melee damage',        f:()=>player.ad+=8 },
  { n:'Vitality',      d:'+25 max HP & full heal',  f:()=>{ player.maxHp+=25; player.hp=player.maxHp; } },
  { n:'Swift Boots',   d:'+0.8 move speed',         f:()=>player.speed+=0.8 },
  { n:'Frenzy',        d:'attack 20% faster',       f:()=>player.atkCdBase*=0.8 },
  { n:'Twin Shot',     d:'+1 bolt per shot',        f:()=>player.multishot+=1 },
  { n:'Vampirism',     d:'+4 lifesteal (heal per damage dealt)',  f:()=>player.lifesteal+=4 },
  { n:'Thorns',        d:'+8 thorns (reflects melee)', f:()=>player.thorns+=8 },
  { n:'Long Dash',     d:'dash recharges faster',   f:()=>player.dashCdBase=Math.max(.3,player.dashCdBase-0.2) },
  { n:'Quick Draw',    d:'shoot 30% faster',        f:()=>player.rangedCdBase*=0.7 },
  { n:'Greed',         d:'wider coin magnet',       f:()=>player.magnet+=1.0 },
  { n:'Burning Blade', d:'attacks ignite foes (fire DoT)',   f:()=>player.burn+=1 },
  { n:'Frostbite',     d:'attacks chill & slow foes',        f:()=>player.frostHit=true },
  { n:'Venom',         d:'attacks apply poison (4s DoT, scales with damage)',    f:()=>player.venom+=1 },
  { n:'Chain Spark',   d:'attacks arc to a nearby foe',      f:()=>player.chain=true },
  { n:'Keen Edge',     d:'+6% crit chance',          f:()=>player.critC=Math.min(.5,player.critC+.06) },
  { n:'Executioner',   d:'crits deal +50% more damage',      f:()=>player.critM+=.5 },
];
function openDraft(){
  if(LEAN){ phase='explore'; return; }   // lean core: no boon-draft screen after bosses
  const pool=UPGRADES.filter(u=>!(u.n==='Frostbite'&&player.frostHit)&&!(u.n==='Chain Spark'&&player.chain)); draftCards=[];
  const ready=(typeof readyEvolutions==='function')?readyEvolutions():[];
  if(ready.length){ const E=pick(ready); draftCards.push({n:E.n,d:E.e,evo:true,E}); }   // one highlighted EVOLUTION card
  while(draftCards.length<3 && pool.length){ draftCards.push(pool.splice(Math.floor(rand(0,pool.length)),1)[0]); }
  phase='draft';
}
function proceed(){ phase='explore'; }   // after picking an upgrade, resume exploring
function explode(m){ addShake(.45); burst(m.x,m.y,[255,150,60],28,5); shocks.push({x:m.x,y:m.y,r:.2,maxR:2.4,life:.45,max:.45,dmg:22,hit:false,col:[255,140,50]}); sfx('boss'); killMob(m); }

let bolts=[];   // transient chain-lightning arcs for rendering
// provoke a docile creature (and, in the elves' forest, alert its kin)
function provoke(s){
  if(s.friendly) return;
  if(s.warFac){                                 // struck a feud mob: it (and a few same-incident kin) turn on the player
    const flip=(m)=>{ m.lastWarFac=m.warFac; m.warFac=null; m.rivalFac=null; m.warAgg=0; m.warHostilePlayer=false;
                      m.provoked=true; m.hostileNpc=true; m.smart=true; m.sight=999; };   // m.icId PRESERVED for attribution
    let flipped=0;
    for(const o of mobs){ if(o===s || flipped>=2) continue;
      if(o.warFac===s.warFac && o.icId===s.icId && len(o.x-s.x,o.y-s.y)<6){ flip(o); flipped++; } }   // bounded same-incident cascade
    flip(s);
    return;
  }
  if(s.provoked || s.friendly) return;
  if(s.peaceful || s.neutralC){
    s.provoked=true; s.speed*=1.3; if(s.peaceful) s.orbit=null;   // fierce — and the ritual is abandoned
    if(s.champion) showToast((s.bossName||'The being')+': "You DARE?!"');
    if(s.visitor && floor<=2){ wantedT=Math.max(wantedT,14); showToast('The watch saw that — you are MARKED!'); }
    if(realm && realm.special==='peaceful'){
      let n=0; for(const o of mobs){ if(o!==s && o.peaceful && !o.provoked && len(o.x-s.x,o.y-s.y)<14){ o.provoked=true; o.speed*=1.3; o.orbit=null; n++; } }
      if(n>0) showToast('The forest turns against you!');
    }
  } else s.provoked=true;
}
// apply the player's elemental on-hit effects to a struck enemy
function applyStatus(s){
  if(s.type==='nest') return;
  provoke(s);
  // smart packs: striking one alerts its kin to your position
  if(s.smart){ for(const o of mobs){ if(o!==s && o.type===s.type && len(o.x-s.x,o.y-s.y)<11){ o.assistT=3; if(!(o.peaceful||o.neutralC)) o.provoked=true; } } }
  if(player.burn>0){ s.burnT=3; s.burnDps=player.ad*0.10*player.burn; tryReact(s,'burn'); }
  if(player.venom>0){ s.poisonT=4; s.poisonDps=player.ad*0.08*player.venom; tryReact(s,'venom'); }
  if(player.frostHit){ s.eSlowT=1.6; tryReact(s,'frost'); }
  if(player.chain){
    let best=null,bd=6*6; for(const o of mobs){ if(o===s||o.type==='nest') continue; const d=(o.x-s.x)**2+(o.y-s.y)**2; if(d<bd){ bd=d; best=o; } }
    if(best){ dealDamage(best, player.ad*0.5, {noCrit:true}); provoke(best); bolts.push({x1:s.x,y1:s.y,x2:best.x,y2:best.y,life:.12}); }
  }
}

// Each realm boss attacks differently. nx,ny = unit direction toward the player.
function bossAttack(s, nx, ny, kind){
  kind = kind || s.atk;
  const acc = realm ? realm.accent : [180,90,255];
  const dmg = Math.round((13 + floor*1.0) * (1 + 0.30*ngPlus));   // bosses bite harder with depth & ascension
  const nm = s.bossName || 'The boss';
  s.atkCount=(s.atkCount||0)+1;
  switch(kind){
    case 'volley': { const N=12; for(let i=0;i<N;i++){ const a=i/N*6.28; eProjectiles.push({x:s.x+Math.cos(a)*1.2,y:s.y+Math.sin(a)*1.2,vx:Math.cos(a)*6.2,vy:Math.sin(a)*6.2,life:2.8}); }
      if(s.phase>=2){ for(let i=0;i<N;i++){ const a=(i+0.5)/N*6.28; eProjectiles.push({x:s.x+Math.cos(a)*1.2,y:s.y+Math.sin(a)*1.2,vx:Math.cos(a)*4.4,vy:Math.sin(a)*4.4,life:3.4}); } }
      sfx('shoot'); addShake(.3); showToast(nm+' looses a volley!'); break; }
    case 'charge': { s.windup=.5; s.chargeT=1.05; s.chargeDir=[nx,ny]; sfx('boss'); addShake(.25); showToast(nm+' winds up a charge!'); break; }
    case 'summon': { for(let i=0;i<3;i++){ const a=rand(0,6.28); MOB(pick(realm.pool), s.x+Math.cos(a)*2.6, s.y+Math.sin(a)*2.6); } sfx('boss'); addShake(.3); showToast(nm+' summons minions!'); break; }
    case 'nova': { mortars.push({x:s.x,y:s.y,t:.85,r:9,dmg:dmg+4,col:acc}); sfx('boss'); addShake(.3); showToast(nm+' gathers a cataclysm — RUN!'); break; }
    case 'void': {
      if(s.atkCount%2===0){ for(let i=0;i<4;i++){ const a=rand(0,6.28); MOB(pick(realm.pool), s.x+Math.cos(a)*3, s.y+Math.sin(a)*3); } showToast(nm+' tears open the void!'); }
      else { shocks.push({x:s.x,y:s.y,r:.3,maxR:9.5,life:1,max:1,dmg:dmg+6,hit:false,col:acc}); }
      sfx('boss'); addShake(.65); break; }
    default: {
      shocks.push({x:s.x,y:s.y,r:.3,maxR:5.6,life:.7,max:.7,dmg:dmg,hit:false,col:acc}); addShake(.5); sfx('boss');
      if(s.atkCount%2===0){ for(let i=0;i<2;i++){ const a=rand(0,6.28); MOB(pick(realm.pool), s.x+Math.cos(a)*2.2, s.y+Math.sin(a)*2.2); } showToast(nm+' summons aid!'); } }
  }
}

function addShake(m){ shake=Math.min(.7,Math.max(shake,m)); }
// ===== BOSS PHASE-3 SIGNATURES — each realm's gatekeeper has a distinct FINAL FURY (keyed by realm NAME so biome inserts can't misalign it) =====
const BOSS_SIG = {
  'The Trial Grounds': (s,fd)=>{ for(let b=0;b<2;b++) shocks.push({x:s.x,y:s.y,r:.2,maxR:5+b*2.5,life:.7+b*.2,max:.7+b*.2,dmg:fd,hit:false,col:[200,180,120]}); },   // double stomp rings
  'The Verdant Jungle': (s,fd)=>{ const v=MOB('vinesnap', s.x+rand(-2,2), s.y+rand(-2,2)); if(v) v.provoked=true; shocks.push({x:player.x,y:player.y,r:2.2,maxR:2.2,life:2.4,max:2.4,dmg:6,hit:false,col:[150,220,120],poison:true}); },   // spawns + spore cloud
  'The Human Empire': (s,fd)=>{ for(let v=0;v<4;v++){ const a=v*1.5708+0.785; for(let j=0;j<3;j++) eProjectiles.push({x:s.x+Math.cos(a)*(1+j*0.8),y:s.y+Math.sin(a)*(1+j*0.8),vx:Math.cos(a)*7.5,vy:Math.sin(a)*7.5,life:2.4}); } },   // cross volleys
  'The 獸人族 Empire': (s,fd,dpx,dpy,dist)=>{ s.atkTimer=Math.min(s.atkTimer,.5); s.windup=.35; s.chargeT=.85; s.chargeDir=[dpx/dist,dpy/dist]; },   // relentless chain charges
  'The Elves Forest': (s,fd)=>{ for(let p=0;p<10;p++){ const a=p/10*6.28; eProjectiles.push({x:s.x+Math.cos(a)*1.2,y:s.y+Math.sin(a)*1.2,vx:Math.cos(a)*4.2,vy:Math.sin(a)*4.2,life:3.4}); } },   // petal ring
  'The 魔物 Empire': (s,fd)=>{ for(let l=0;l<2;l++) shocks.push({x:player.x+rand(-3,3),y:player.y+rand(-2,2),r:2.0,maxR:2.0,life:3,max:3,dmg:7,hit:false,col:[255,120,40],poison:true}); },   // burning ground
  'Peak of the Two Families': (s,fd)=>{ for(let b=0;b<4;b++) mortars.push({x:player.x+rand(-3,3), y:player.y+rand(-3,3), t:.8+b*0.12, r:1.5, dmg:fd}); },   // blade rain
  'The Hall of Echoes': (s,fd)=>{ for(let p=0;p<8;p++){ const a=p/8*6.28; eProjectiles.push({x:s.x+Math.cos(a)*1.2,y:s.y+Math.sin(a)*1.2,vx:Math.cos(a)*3.6,vy:Math.sin(a)*3.6,life:3.8}); } mortars.push({x:player.x,y:player.y,t:.9,r:2.2,dmg:fd,col:[150,220,255]}); },   // frost ring + comet
  "The Tower's Crown": (s,fd)=>{ for(let v=0;v<12;v++){ const a=v/12*6.28; eProjectiles.push({x:s.x+Math.cos(a)*1.4,y:s.y+Math.sin(a)*1.4,vx:Math.cos(a)*6.8,vy:Math.sin(a)*6.8,life:2.6}); } mortars.push({x:s.x,y:s.y,t:.95,r:7,dmg:fd+4,col:[255,235,170]}); },   // radiant burst + sunfall
};
function burst(x,y,col,n,spd,dir,spread){ for(let i=0;i<n;i++){ const a=(dir==null)?rand(0,6.28):dir+rand(-(spread||0.7),(spread||0.7)),s=rand(.3,1)*spd; particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rand(.3,.7),max:.7,color:col,size:rand(2,5)}); }
  if(particles.length>450) particles.splice(0, particles.length-450); }
function dropCoins(x,y,n){ for(let i=0;i<n;i++){ const a=rand(0,6.28); coins.push({x,y,vx:Math.cos(a)*rand(1,3),vy:Math.sin(a)*rand(1,3),life:8,r:.22}); } }
function showToast(s){ toast=s; toastT=1.6; }

// ===== Trial Towers 3.0 damage model =====
// armour mitigation curve: 100 armour -> ×0.5, 200 -> ×0.33. Bounded (0,1], never amplifies.
function mitig(armor){ const a=armor>0?armor:0; return 100/(100+a); }
// multiplicative buffs that apply to ALL outgoing player damage (no stat scaling)
function atkBuffs(){ return (player.devPow?25:1)*(player.hp<player.maxHp*.3?1.12:1)*(player.songT>0?1.08:1)*(player.rageT>0?1.5:1)*(player.pactPow||1)*(player.housePow||1); }   // creator ×; adrenaline; song; rampage
// attacker scaling: physical scales off AD, magic off AP
function pAtk(kind){ const stat=(kind==='magic')?(player.ap||0):(player.ad||0); return stat*atkBuffs(); }
function PDMG(){ return pAtk('physical'); }   // back-compat alias — untouched physical call sites keep working

// ---- central damage funnel: crits, riposte, floating numbers, tiered hit-stop, overkill ----
function pushDmgText(x,y,txt,kind){ dmgTexts.push({x,y,vy:-2.2,life:.7,max:.7,txt,kind,age:0}); if(dmgTexts.length>40) dmgTexts.shift(); }
function dealDamage(s, amt, opts){ opts=opts||{};
  if(!s || s.hp<=0) return false;
  const kind=opts.kind||'physical';
  let crit=false, riposte=false;
  if(!opts.noCrit){
    if(player.riposteT>0){ crit=true; riposte=true; amt*=player.critM+0.4; player.riposteT=0; }   // riposte: one guaranteed mega-crit
    else if(rand(0,1)<player.critC){ crit=true; amt*=player.critM; }
  }
  if(s.stoneskin && s.hp>s.maxHp*0.5 && !(s.stunT>0)) amt*=0.5;   // Stoneskin: crack it with stuns or whittle below half
  if(s.warded>0) amt*=0.5;                              // shielded by a nearby Warding elite
  if(s.markT>0) amt*=1.3;                               // Hunter's Mark
  if(s.type) amt*=masteryMul(s.type);                  // Bestiary mastery: permanent bonus vs studied species
  amt *= mitig(kind==='magic' ? (s.apDef||0) : (s.adDef||0));   // 3.0: target defence mitigates by damage kind
  if(s.gate) amt=Math.min(amt, s.gate);                 // Shielded elites cap any single hit
  amt=Math.round(amt); if(amt<1) amt=1;
  const over=Math.max(0, amt-s.hp);
  s.hp-=amt; s.hitFlash=.25;
  let merged=false;   // rapid hits on one target roll into a single climbing number
  for(const t of dmgTexts){ if(t.m===s && (t.age||0)<0.12 && t.kind!=='dot'){ t.amt=(t.amt||0)+amt; t.txt=t.amt; if(crit) t.kind='crit'; merged=true; break; } }
  if(!merged){ dmgTexts.push({x:s.x,y:s.y-s.r,vy:-2.2,life:.7,max:.7,txt:amt,amt,kind:crit?'crit':'hit',m:s,age:0}); if(dmgTexts.length>40) dmgTexts.shift(); }
  if(crit){ freezeT=Math.max(freezeT,.045); burst(s.x,s.y,[255,215,80],6,3,opts.ang); }
  else if(opts.melee && opts.heavy){ freezeT=Math.max(freezeT,.025); }
  if(riposte) riposteStrike(s);   // perfect-dodge -> riposte: the counter erupts across the pack
  if(opts.ang!=null) burst(s.x,s.y,[255,255,255],2,2.4,opts.ang,0.5);
  player.comboN=(player.comboN||0)+1; player.comboTimer=2.5; player.comboPop=.18;
  if(player.comboN>0 && player.comboN%10===0){ const bonus=player.comboN; dropCoins(player.x,player.y,bonus); sfx('coin');
    player.charge=Math.min(player.maxMana,player.charge+8);
    showToast('✦ '+player.comboN+'-HIT STREAK — +'+bonus+' coins, ult charged!'); }
  if(crit && player.evoDeath) s.markT=Math.max(s.markT||0,3);   // Deathmark: crits mark for +30% taken
  if(player.relicsHit.length) for(const r of player.relicsHit) r.onHit(s,amt,opts);
  if(s.hp<=0){ if(opts.chained) s._chained=true; killMob(s, over); return true; }
  return false;
}
function comboChargeMul(){ return player.comboN>=20?2:player.comboN>=10?1.5:player.comboN>=5?1.25:1; }
// ---- single choke point for ALL damage the player takes ----
function hurtPlayer(n, sx, sy, opts){ opts=opts||{};
  if(player.god) return;                               // creator god-mode: untouchable
  if(player.shieldT>0) n*=0.5;                         // Sunder Quake aegis
  if(player.bulwarkT>0) n*=0.45;                       // Knight bulwark stance
  if(player.rageT>0) n*=0.7;                           // Gorilla rampage hide
  if(!opts.soft) n*=mitig((opts.kind==='magic')?player.apDef:player.adDef);   // 3.0: player AD/AP defence mitigates incoming
  if(bloodMoon && !opts.soft) n*=bmHurtMul();          // CRIMSON MOON: enraged foes hit harder (touch, projectiles, shocks, boss attacks)
  if(!opts.soft) n*=(player.pactVuln||1);              // ALTAR pacts that raise your vulnerability
  if(!opts.soft) n*=covDmgMul();                       // COVENANT of Bloodthirst
  player.hp-=n; player.hurtFlash=Math.max(player.hurtFlash, opts.soft?.12:.3);
  if(!opts.soft && player.relicsHurt.length) for(const r of player.relicsHurt) r.onHurt(n,sx,sy);
  if(!opts.soft){ sfx('hurt'); addShake(.25); player.comboN=0; player.comboTimer=0; player.hitAnimT=Math.max(player.hitAnimT||0,.2);
    const d=len(player.x-sx,player.y-sy)||1; kickX=(player.x-sx)/d*5; kickY=(player.y-sy)/d*5;
    player.hurtDir=Math.atan2(sy-player.y, sx-player.x); }
}
// ---- perfect dodge: graze a hit during a deliberate dash -> slow-mo + dash refund + riposte ----
function perfectDodge(sx,sy){
  bumpLT('perfects');
  player.pdCd=1.2; slowmoT=.35; player.dashCd=0; player.riposteT=1.8;
  player.charge=Math.min(player.maxMana, player.charge+10*player.chargeMul);
  sfx('dash'); addShake(.15);
  shocks.push({x:player.x,y:player.y,r:.2,maxR:1.4,life:.25,max:.25,dmg:0,hit:true,col:[220,240,255]});
  pushDmgText(player.x, player.y-.8, 'PERFECT!', 'perfect');
}
// ---- riposte PAYOFF: the perfect-dodge counter-strike erupts, punishing the surrounding pack ----
function riposteStrike(s){
  freezeT=Math.max(freezeT,.10); addShake(.35); flashT=Math.max(flashT||0,.05);
  burst(s.x,s.y,[255,240,180],26,6); pushDmgText(s.x,s.y-(s.r||.4)-.3,'RIPOSTE!','perfect'); sfx('boss');
  player.charge=Math.min(player.maxMana, player.charge+10*(player.chargeMul||1));
  shocks.push({x:s.x,y:s.y,r:.2,maxR:3.2,life:.35,max:.35,dmg:0,hit:true,col:[255,235,170]});   // golden counter-ring (visual)
  const dmg=Math.round(PDMG()*1.1), targets=[];
  for(const o of mobs){ if(o===s||o.friendly||o.type==='nest'||o.hp<=0) continue; if(len(o.x-s.x,o.y-s.y)<3.2){ targets.push(o); if(targets.length>=8) break; } }
  for(const o of targets){ if(o.hp<=0) continue; o.stunT=Math.max(o.stunT||0,.6); dealDamage(o,dmg,{noCrit:true}); }
}
// ---- VOLATILE HAZARDS: explosive kegs + oil slicks that feed the burn/reaction/chain systems ----
function breakWall(wl){   // a cracked wall shatters, opening what it sealed
  walls=walls.filter(w=>w!==wl); _wgridN=-1;
  if(wl.brk && !wl.crack){ const td=(wl.tier!=null)?WALL_TIER[wl.tier]:null, k=wl.tier===0?0.7:wl.tier===2?1.7:1, dust=(td&&td.dust)||[200,170,130];
    burst(wl.x,wl.y,dust,Math.round(14*k),4.2*(0.8+0.3*k)); burst(wl.x,wl.y,[120,100,80],Math.round(8*k),3); addShake(.12*k); sfx(wl.tier===2?'boss':'hit'); return; }   // tier-scaled breach: timber light, reinforced heavy
  burst(wl.x,wl.y,[200,170,130],34,5.5); burst(wl.x,wl.y,[120,100,80],16,4); addShake(.35); sfx('boss'); flashT=Math.max(flashT||0,.04);
  showToast(wl.vault?'✦ A sealed vault breaks open!':'The cracked wall shatters!');
  if(wl.vault) pings.push({x:wl.x,y:wl.y,col:'#ffe066',life:25});
}
function detonateKeg(p){
  if(p.boom) return; p.boom=true; p.used=true;
  addShake(.5); burst(p.x,p.y,[255,150,60],44,7); burst(p.x,p.y,[90,80,80],14,4); sfx('boss'); flashT=Math.max(flashT||0,.05);
  const R=3.6, dmg=Math.round(34+floor*7);
  shocks.push({x:p.x,y:p.y,r:.2,maxR:R,life:.45,max:.45,dmg:0,hit:true,col:[255,140,50]});   // visual blast ring
  const hit=[];
  for(const o of mobs){ if(o.friendly||o.type==='nest'||o.hp<=0) continue; if(len(o.x-p.x,o.y-p.y)<R) hit.push(o); }
  for(const o of hit){ if(o.hp<=0) continue; o.burnT=Math.max(o.burnT||0,2.6); o.burnDps=Math.max(o.burnDps||0,PDMG()*0.12); tryReact(o,'burn'); dealDamage(o,dmg,{noCrit:true}); }
  if(player.iframe<=0 && player.dashT<=0 && len(player.x-p.x,player.y-p.y)<R*0.85) hurtPlayer(Math.round(12+floor), p.x, p.y);   // kegs cut both ways
  for(const q of props){ if(q===p||q.boom) continue; const dd=len(q.x-p.x,q.y-p.y); if(q.kind==='powderkeg' && dd<R+1.2){ q.fuse=(q.fuse==null)?.16:Math.min(q.fuse,.16); } else if(q.kind==='oilslick' && dd<R+1.4){ igniteOil(q); } }
}
function igniteOil(p){ if(p.lit>0||p.boom) return; p.lit=4.0; burst(p.x,p.y,[255,160,60],20,4); sfx('hit'); }
// ---- per-class ultimates ----
// ---- elite affixes: rare modified enemies with auras, names and bonus loot ----
const AFFIXES={
  Frenzied:{ col:[255,90,60],  apply(m){ m.speed*=1.35; m.touch=Math.round(m.touch*1.25); } },
  Shielded:{ col:[120,200,255], apply(m){ m.gate=Math.max(8, Math.round(m.maxHp*0.35)); } },
  Volatile:{ col:[255,150,40], apply(m){ m.volatile=true; } },
  Vampiric:{ col:[200,60,130], apply(m){ m.lifedrain=true; } },
  Stoneskin:{ col:[170,174,190], apply(m){ m.stoneskin=true; } },
  Titan:{    col:[230,205,120], apply(m){ m.r*=1.3; m.hp=Math.round(m.hp*1.6); m.knockResist=true; } },
  Warding:{  col:[140,255,210], apply(m){ m.warding=true; } },       // shields nearby allies
  Summoner:{ col:[200,120,255], apply(m){ m.summoner=true; } },      // conjures minions
  Regenerator:{ col:[120,230,140], apply(m){ m.regen=true; } },      // knits its wounds
  Hexer:{    col:[230,120,210], apply(m){ m.hexer=true; } },         // its touch slows you
};
function makeElite(m, a, b){   // accepts (m) | (m, affix) | (m, displayName, affix) — legacy camp-warlord order included
  if(!m || m.isGate || m.champion || m.type==='nest' || m.type==='boss' || m.type==='general' || m.friendly || m.elite) return m;
  const MAP={}; const norm=k=>AFFIXES[k]?k:(MAP[k]||null);
  let affix=null, disp=null;
  if(a){ if(norm(a)) affix=norm(a); else disp=a; }
  if(b){ if(!affix && norm(b)) affix=norm(b); else if(!disp && !norm(b)) disp=b; }
  affix=affix||pick(Object.keys(AFFIXES)); const af=AFFIXES[affix];
  m.elite=affix; m.eliteCol=af.col; if(disp) m.eliteName=disp;
  m.hp=Math.round(m.hp*1.6); m.maxHp=m.hp; m.xp=Math.round((m.xp||3)*2.5); m.drop=(m.drop||1)+5;
  af.apply(m); m.maxHp=Math.max(m.maxHp,m.hp);
  return m;
}
// ---- telegraphed special attacks (windup shown on the ground, then the strike) ----
const TELE_LEAP={ packwolf:1, warhound:1, prowler:1, lurker:1, bloodbat:1 };
const TELE_VOLLEY={ arbalist:1, echoarcher:1, templar:1, hexcaster:1, arcanist:1 };
const ULT_NAMES={ Knight:'SUNDER QUAKE', Rogue:'DANCE OF KNIVES', Ranger:'ARROW STORM', Mage:'CATACLYSM', Gorilla:'RAMPAGE', Vampire:'BLOOD MOON', Joker:'52 PICKUP', Necromancer:'DEATHLESS LEGION' };
const ULTS={
  Knight(){ // seismic slam: heavy damage + stun + 3s half-damage aegis
    shocks.push({x:player.x,y:player.y,r:.3,maxR:6,life:.6,max:.6,dmg:0,hit:true,col:[235,225,180]});
    burst(player.x,player.y,[235,225,180],40,7); addShake(.6);
    for(const s of [...mobs]){ if(s.friendly) continue; const d=len(s.x-player.x,s.y-player.y); if(d>6+s.r) continue;
      dealDamage(s, PDMG()*2.2, {noCrit:true});
      if(mobs.includes(s)){ provoke(s); s.stunT=(s.type==='boss'||s.type==='general')?0.5:1.2;
        if(!s.stationary){ const k=d||1, sc=(s.type==='boss'||s.type==='general')?0.25:1; s.kx=(s.kx||0)+(s.x-player.x)/k*12*sc; s.ky=(s.ky||0)+(s.y-player.y)/k*12*sc; } } }
    player.shieldT=3;
  },
  Rogue(){ // teleport-flurry: 6 strikes cycling through nearby foes (crits allowed — the boss-deleter)
    const targets=mobs.filter(m=>!m.friendly && m.type!=='nest' && len(m.x-player.x,m.y-player.y)<9)
      .sort((a,b)=>len(a.x-player.x,a.y-player.y)-len(b.x-player.x,b.y-player.y));
    if(!targets.length){ player.charge=player.maxMana; shocks.push({x:player.x,y:player.y,r:.2,maxR:1.6,life:.3,max:.3,dmg:0,hit:true,col:[200,255,235]}); showToast('No target in range — charge kept.'); return; }
    for(let i=0;i<6;i++){ const t=targets[i%targets.length]; if(!t || t.hp<=0) continue;
      bolts.push({x1:player.x,y1:player.y,x2:t.x,y2:t.y,life:.18});
      player.x=t.x+0.6; player.y=t.y; collideWalls(player);
      burst(t.x,t.y,[200,255,235],8,4);
      dealDamage(t, PDMG()*0.9, {}); applyStatus(t); }
    player.iframe=Math.max(player.iframe,.6); player.dashT=.1; freezeT=Math.max(freezeT,.08); addShake(.5);
  },
  Ranger(){ // arrow storm: 2.5s of auto-volleys at the nearest threat while you kite (+speed)
    player.stormT=2.5; player.stormTick=0; player.buffT=Math.max(player.buffT||0,2.5);
  },
  Mage(){ // cataclysm: the great nova, now applying on-hit statuses + 3 lingering rift zones
    const R=9*player.ultBoost, DMG=pAtk('magic')*3*player.ultBoost;
    shocks.push({x:player.x,y:player.y,r:.3,maxR:R,life:.7,max:.7,dmg:0,hit:true,col:[150,170,255]});
    burst(player.x,player.y,[150,170,255],60,8);
    for(const s of [...mobs]){ if(s.friendly) continue; const d=len(s.x-player.x,s.y-player.y); if(d>R) continue;
      dealDamage(s, DMG, {noCrit:true, kind:'magic'});
      if(mobs.includes(s)){ applyStatus(s); if(!s.stationary){ const k=d||1; s.kx=(s.kx||0)+(s.x-player.x)/k*10; s.ky=(s.ky||0)+(s.y-player.y)/k*10; } } }
    for(let i=0;i<3;i++) shocks.push({x:player.x+rand(-3.5,3.5), y:player.y+rand(-3.5,3.5), r:2.2, maxR:2.2, life:3, max:3, dmg:0, friendly:true, tick:0, col:[150,170,255]});
  },
  Gorilla(){ // RAMPAGE: 5s of primal fury — stronger, faster, tougher
    player.rageT=5; addShake(.6); burst(player.x,player.y,[255,120,60],40,7);
    shocks.push({x:player.x,y:player.y,r:.3,maxR:4,life:.5,max:.5,dmg:0,hit:true,col:[255,120,60]});
  },
  Vampire(){ // BLOOD MOON: drain every foe nearby, feast on the sum
    let drained=0;
    shocks.push({x:player.x,y:player.y,r:.3,maxR:7.5,life:.7,max:.7,dmg:0,hit:true,col:[255,60,90]});
    for(const s of [...mobs]){ if(s.friendly) continue; const d=len(s.x-player.x,s.y-player.y); if(d>7.5) continue;
      const amt=Math.round(pAtk('magic')*1.2); drained+=Math.min(amt,s.hp);
      dealDamage(s,amt,{noCrit:true,kind:'magic'}); if(mobs.includes(s)){ s.eSlowT=2; provoke(s); bolts.push({x1:player.x,y1:player.y,x2:s.x,y2:s.y,life:.22}); } }
    player.hp=Math.min(player.maxHp, player.hp+Math.round(drained*0.4)); burst(player.x,player.y,[255,60,90],30,5);
  },
  Joker(){ // 52 PICKUP: a screaming deck in every direction
    player.stormT=1.1; player.stormTick=0; player.stormKind='cards';
  },
  Necromancer(){ // DEATHLESS LEGION: the dead answer at once — a host beyond the usual cap, and a soul nova
    for(let i=0;i<7;i++){ const a=i/7*6.28; summonSkeleton(player.x+Math.cos(a)*1.8, player.y+Math.sin(a)*1.8, true); }
    for(const m of mobs){ if(m.minion){ m.hp=m.maxHp; m.lifeT=Math.max(m.lifeT||0,30); m.mDmg=Math.round((m.mDmg||8)*1.4); } }
    { const NR=6.5, ND=Math.round(pAtk('magic')*1.6); shocks.push({x:player.x,y:player.y,r:.3,maxR:NR,life:.6,max:.6,dmg:0,hit:true,col:[150,255,200]});
      for(const s of [...mobs]){ if(s.friendly||s.type==='nest') continue; if(len(s.x-player.x,s.y-player.y)>NR+s.r) continue; dealDamage(s, ND, {noCrit:true, kind:'magic'}); if(mobs.includes(s)) applyStatus(s); } }
    burst(player.x,player.y,[150,255,200],30,5); addShake(.5);
  },
};
// ---- class abilities on E (used away from NPCs/props) ----
function summonSkeleton(x,y,force){
  if(!force && mobs.filter(m=>m.minion).length>=4) return false;
  const m=MOB('thrall', x, y); m.friendly=true; m.minion=true; m.peaceful=false; m.provoked=false;
  m.hp=m.maxHp=40+floor*10; m.mDmg=8+floor*3; m.speed=5.0; m.sight=0; m.touch=0; m.xp=0; m.drop=0; m.elite=null; m.orbit=null; m.faction=null; m.lifeT=25;
  burst(x,y,[160,255,200],10,3); return true;
}
const ABILITY={
  Knight:{ name:'Bulwark', cd:9, fn(){ player.bulwarkT=2.5; player.iframe=Math.max(player.iframe,.2);
    shocks.push({x:player.x,y:player.y,r:.2,maxR:1.6,life:.3,max:.3,dmg:0,hit:true,col:[255,233,160]}); sfx('boss'); } },
  Ranger:{ name:'Hunter\u2019s Mark', cd:6, fn(){ let best=null,bd=121;
    for(const s of mobs){ if(s.friendly) continue; const d2=(s.x-player.x)**2+(s.y-player.y)**2; if(d2<bd){bd=d2;best=s;} }
    if(best){ best.markT=8; provoke(best); burst(best.x,best.y,[255,228,130],10,3); pushDmgText(best.x,best.y-best.r,'MARKED','perfect'); } else player.abilCd=.5; } },
  Mage:{ name:'Blink', cd:5, fn(){ const steps=20, st=4/steps; let bx=player.x, by=player.y;
    for(let i=0;i<steps;i++){ const nx2=bx+player.fx*st, ny2=by+player.fy*st; if(inWall(nx2,ny2,player.r*0.9)) break; bx=nx2; by=ny2; }
    burst(player.x,player.y,[150,170,255],10,3); player.x=bx; player.y=by; burst(bx,by,[150,170,255],14,4);
    player.iframe=Math.max(player.iframe,.25); sfx('dash'); } },
  Rogue:{ name:'Smoke Bomb', cd:9, fn(){ player.stealthT=1.8; burst(player.x,player.y,[120,120,140],26,4);
    shocks.push({x:player.x,y:player.y,r:.2,maxR:2.2,life:.4,max:.4,dmg:0,hit:true,col:[120,120,140]}); } },
  Gorilla:{ name:'Ground Pound', cd:8, fn(){ addShake(.5); sfx('boss');
    shocks.push({x:player.x,y:player.y,r:.3,maxR:3.2,life:.5,max:.5,dmg:0,hit:true,col:[200,170,130]});
    for(const s of [...mobs]){ if(s.friendly) continue; const d=len(s.x-player.x,s.y-player.y); if(d>3.2+s.r) continue;
      dealDamage(s,PDMG()*1.3,{noCrit:true}); if(mobs.includes(s)){ provoke(s); s.stunT=Math.max(s.stunT||0,(s.type==='boss'||s.type==='general')?0.4:1.0); } } } },
  Vampire:{ name:'Bloody Bite', cd:5, fn(){ let best=null,bd=5.76;
    for(const s of mobs){ if(s.friendly) continue; const d2=(s.x-player.x)**2+(s.y-player.y)**2; if(d2<bd){bd=d2;best=s;} }
    if(best){ const amt=Math.round(pAtk('magic')*1.2); const got=Math.min(amt,best.hp);
      dealDamage(best,amt,{noCrit:true,kind:'magic'}); player.hp=Math.min(player.maxHp,player.hp+Math.round(got*0.6));
      bolts.push({x1:player.x,y1:player.y,x2:best.x,y2:best.y,life:.18}); burst(player.x,player.y,[255,60,90],8,2.5); sfx('hit'); }
    else player.abilCd=.5; } },
  Joker:{ name:'Wild Card', cd:10, fn(){ const roll=Math.floor(rand(0,4));
    if(roll===0){ player.hp=Math.min(player.maxHp,player.hp+30); showToast('🂱 Full House — +30 HP!'); burst(player.x,player.y,[120,255,140],16,3); }
    else if(roll===1){ showToast('🂡 Dead Man\u2019s Hand — card nova!'); for(let i=0;i<12;i++){ const a=i/12*6.28;
      projectiles.push({x:player.x+Math.cos(a)*.5,y:player.y+Math.sin(a)*.5,vx:Math.cos(a)*13,vy:Math.sin(a)*13,life:.9,dmg:Math.round(PDMG()*0.7),col:[255,255,255],r:.15,proj:'knife',pierce:1,ang:a}); } }
    else if(roll===2){ dropCoins(player.x,player.y,15); showToast('🂾 Jackpot — coins rain!'); }
    else { player.buffT=Math.max(player.buffT||0,4); player.dashCd=0; showToast('🃏 The Fool — haste!'); burst(player.x,player.y,[255,228,130],14,3); } } },
  Necromancer:{ name:'Raise Dead', cd:6, fn(){ if(player.hp<=12){ showToast('Too weak to pay the toll of flesh.'); player.abilCd=.5; return; }
    if(summonSkeleton(player.x+rand(-1,1), player.y+rand(-1,1))){ player.hp-=8; pushDmgText(player.x,player.y-.8,'RISE','perfect'); sfx('boss'); }
    else { showToast('Your legion is at full strength (4).'); player.abilCd=.5; } } },
};
const SKILL_MANA={Knight:20,Ranger:18,Mage:22,Rogue:20,Gorilla:24,Vampire:18,Joker:26,Necromancer:20};
function classAbility(){
  const A=ABILITY[player.weaponKey]; if(!A) return;
  if(player.abilCd>0) return;
  const cost=SKILL_MANA[player.weaponKey]||22;
  if((player.charge||0)<cost){ showToast('Not enough mana — need '+cost); player.abilCd=.2; return; }
  player.charge-=cost; player.abilCd=A.cd; A.fn();
}
// ---- per-class attacks -------------------------------------------------
function curWeapon(){ return WEAPONS[player.weaponKey] || WEAPONS.Knight; }
function primaryAttack(){
  blowCover();
  const Wp=curWeapon();
  if(Wp.type==='ranged'){
    if(player.rangedCd>0 || player.stamina<10) return;
    player.stamina-=10; player.rangedCd=player.rangedCdBase; sfx('shoot'); player.shootFlash=.12;
    if(Wp.hpCost) player.hp=Math.max(1,player.hp-Wp.hpCost);
    fireWeapon(Wp); kickX=-player.fx*2; kickY=-player.fy*2;
  } else {
    if(player.atkCd>0 || player.stamina<12) return;
    const dashStrike=(player.dashT||0)>0;            // attacking mid-dash -> a lunging dash-strike (bonus reach/damage, carries i-frames)
    player._dashStrike=dashStrike;
    player.stamina-=12; player.atkCd=player.atkCdBase; player.atkFlash=Wp.flash||.16; sfx('swing');
    if(dashStrike){ player.dashT=Math.max(player.dashT,.12); player.iframe=Math.max(player.iframe,.14); addShake(.16); sfx('dash'); }
    const hits=meleeSwing(dashStrike?Object.assign({},Wp,{reach:(Wp.reach||1.6)+0.6,arc:(Wp.arc||2)*0.7}):Wp, dashStrike?1.7:1); kickX=player.fx*5; kickY=player.fy*5;
    if(hits>0){ addShake(Math.min(.18,.035+hits*.018)); player.comboPop=Math.max(player.comboPop||0,.14);
      if(hits>=3) pushDmgText(player.x,player.y-.9,'CLEAVE','perfect'); }
    if(Wp.combo){ player.comboT=.085; player.comboW=Wp; }     // daggers flick twice
  }
  // turn to face the strike for the duration of the swing/shot, then walk-facing resumes
  const dur=Wp.animDur||.5;
  player.attackAnimT=player.attackAnimDur=dur;          // drives the attack sprite animation (all classes)
  player.faceLock=Math.max(.16, dur);                   // turn to face the strike for the whole swing
  player.faceX=player.fx; player.faceY=player.fy;
}
function secondaryAttack(){
  blowCover();
  const Wp=curWeapon();
  if(Wp.type==='melee'){
    if(Wp.rock){   // the Gorilla's one ranged trick: a hurled boulder
      if(player.rangedCd>0) return;
      player.rangedCd=Math.max(player.rangedCdBase,.8); sfx('shoot'); player.shootFlash=.12;
      fireWeapon({ speed:11, col:[185,175,160], projR:.30, proj:'orb', pierce:0, dmgMul:1.15 });
    } else if(Wp.noThrow){   // the Knight never throws his steel: a shield jab instead
      if(player.atkCd>0) return;
      player.atkCd=Math.max(player.atkCdBase,.34); player.atkFlash=.14; sfx('swing');
      meleeSwing({ reach:1.35, arc:Math.PI*0.5, dmgMul:.55, knock:1.3 }, 1);
    } else {
      // other melee heroes hurl a thrown weapon — unlocked at level 2
      if(!(player.level>=2||player.rangedStart) || player.rangedCd>0) return;
      player.rangedCd=player.rangedCdBase; sfx('shoot'); player.shootFlash=.12;
      fireWeapon({ speed:14, col:[200,255,235], projR:.14, proj:'knife', pierce:0, dmgMul:.55 });
    }
  } else {
    // ranged heroes keep a close-quarters melee to shove foes off them
    if(player.atkCd>0) return;
    player.atkCd=Math.max(player.atkCdBase,.30); player.atkFlash=.14; sfx('swing');
    meleeSwing({ reach:1.30, arc:Math.PI*0.75, dmgMul:.80, knock:.75 }, 1);
  }
  player.faceLock=.24; player.faceX=player.fx; player.faceY=player.fy;
}
// ===== SYSTEMIC NPC BEHAVIOUR — anyone can be struck; they fight back or flee, and the Watch remembers =====
const NPC_FIGHTER_T={ guard:1, watchman:1, errant:1, magistrate:1, ranger:1, bountymaster:1, arenamaster:1, house_knight:1, house_errant:1, house_heir:1, househead:1, hermit:1 };
function npcFighter(n){ return !!NPC_FIGHTER_T[n.type] || !!n.headHouse; }
function npcFaction(n){ if(n.headHouse||n.house) return n.house||n.headHouse; if(WATCH_TYPES[n.type]) return 'watch'; if(CULT_TYPES[n.type]) return 'cult'; return 'town'; }
function npcMaxHp(n){ return Math.round((npcFighter(n)?55:16) + floor*5); }
function convertHostile(n, quiet){
  if(!npcs.includes(n)) return;
  const cast=(n.house==='magic'||n.headHouse==='magic'||['enchanter','scholar','acolyte'].includes(n.spriteAs));
  npcs=npcs.filter(x=>x!==n);
  const m=MOB(cast?'arcanist':'swordsman', n.x, n.y);
  if(m){ m.peaceful=false; m.provoked=true; m.smart=true; m.sight=999; m.hostileNpc=true;
    m.hp=m.maxHp=npcMaxHp(n)+20; m.touch=Math.max(m.touch||8, 9+floor); m.eliteName=(n.name||'A defender').replace(/^the |^a |^an /,'');
    if(n.color) m.color=n.color.slice();
    const fac=npcFaction(n); m.npcFac=fac; if(fac==='watch') m.watch=true;
    if(n.headHouse) m.familyHead=n.headHouse;
    burst(m.x,m.y,[255,130,80],12,3.5); }
  if(!quiet) showToast((n.name||'A defender').replace(/^the |^a |^an /,'')+' draws steel on you!');
}
function convertDefender(n){   // armed folk take up arms FOR the populace (friendly) when monsters threaten
  if(!npcs.includes(n)) return;
  const cast=(n.house==='magic'||n.headHouse==='magic'||['enchanter','scholar','acolyte'].includes(n.spriteAs));
  npcs=npcs.filter(x=>x!==n);
  const m=MOB(cast?'arcanist':'swordsman', n.x, n.y);
  if(m){ m.friendly=true; m.merc=true; m.mercKind=cast?'bow':'blade'; m.peaceful=false; m.provoked=false;
    m.hp=m.maxHp=npcMaxHp(n)+30; m.mDmg=10+floor*3; m.speed=5.2; m.sight=0; m.touch=0; m.xp=0; m.drop=0; m.faction=null; m.smart=false; m.defender=true;
    m.eliteName=(n.name||'A defender').replace(/^the |^a |^an /,''); if(n.color) m.color=n.color.slice();
    burst(m.x,m.y,[150,200,255],10,3); }
}
function witnessCrime(n){
  wantedT=Math.max(wantedT,14); if(player.rep) player.rep.watch=(player.rep.watch||0)-1;
  const fac=npcFaction(n);
  for(const o of [...npcs]){ if(o===n) continue; const d=len(o.x-n.x,o.y-n.y); if(d>13) continue;
    if(npcFighter(o) && (npcFaction(o)===fac || WATCH_TYPES[o.type])) convertHostile(o,true);
    else { o.mind='flee'; o.mindT=3; o.scaredT=4; if(o.emoteT<=0){ o.emote='!'; o.emoteT=1.2; } } }
  fleePulse=Math.max(fleePulse,2.5);
}
function npcFalls(n){
  burst(n.x,n.y,[200,60,60],22,4.5); addShake(.25); sfx('hit'); dropCoins(n.x,n.y, 2+Math.floor(rand(0,4)));
  npcs=npcs.filter(x=>x!==n);
  wantedT=Math.max(wantedT,20)+8; if(player.rep) player.rep.watch=(player.rep.watch||0)-2;
  fleePulse=Math.max(fleePulse,3);
  showToast('You cut down '+((n.name||'an innocent').replace(/^the |^a |^an /,''))+' — the Watch wants your head!');
  for(const o of [...npcs]){ const d=len(o.x-n.x,o.y-n.y); if(d>16) continue; if(npcFighter(o)) convertHostile(o,true); else { o.mind='flee'; o.mindT=4; o.scaredT=5; } }
}
function hitNPC(n, dmg){
  if(!npcs.includes(n)) return;
  if(n.type==='youngson'){ n.mind='flee'; n.mindT=2.2; n.scaredT=3; fleePulse=Math.max(fleePulse,2); if(n.emoteT<=0){ n.emote='!'; n.emoteT=1.3; } if(!n._crime){ n._crime=true; witnessCrime(n); } return; }
  if(n.hp===undefined){ n.hp=n.maxHp=npcMaxHp(n); }
  n.hp-=dmg; n.hitFlash=.25; pushDmgText(n.x,n.y-(n.r||.5)-.2,Math.round(dmg),'hit'); burst(n.x,n.y,n.color||[230,200,160],5,2.5);
  if(!n._crime){ n._crime=true; witnessCrime(n); }
  if(n.hp<=0){ npcFalls(n); return; }
  if(npcFighter(n)) convertHostile(n,false);
  else { n.mind='flee'; n.mindT=3; n.scaredT=4; fleePulse=Math.max(fleePulse,2.5); if(n.emoteT<=0){ n.emote='!'; n.emoteT=1.3; } }
}
function meleeSwing(Wp, mul){
  const ang=Math.atan2(player.fy,player.fx), half=(Wp.arc||2)/2;
  slashes.push({x:player.x,y:player.y,ang,arc:Wp.arc||2,reach:Wp.reach||1.6,life:.14,max:.14,heavy:Wp.swing==='heavy'});
  let hits=0;
  for(const s of [...mobs]){
    if(s.friendly) continue;                              // never strike your own merc / befriended beings
    const dx=s.x-player.x, dy=s.y-player.y, d=len(dx,dy);
    if(d > (Wp.reach||1.6) + s.r) continue;
    let da=Math.abs((((Math.atan2(dy,dx)-ang)%(Math.PI*2))+Math.PI*3)%(Math.PI*2)-Math.PI);
    if(da > half) continue;
    const died=dealDamage(s, PDMG()*(Wp.dmgMul||1)*(mul||1), {melee:true, heavy:Wp.swing==='heavy', ang});
    hits++;
    applyStatus(s); provoke(s);
    player.charge=Math.min(player.maxMana,player.charge+3*player.chargeMul*comboChargeMul());
    if(!died && player.lifesteal>0 && player.hp<player.maxHp) player.hp=Math.min(player.maxHp, player.hp+player.lifesteal);
    if(!died && !s.stationary){ const k=d||1, sc=(s.type==='boss'||s.type==='general'||s.knockResist)?0.25:1;   // knockback is velocity now, not a teleport
      s.kx=(s.kx||0)+dx/k*(Wp.knock||.4)*9*sc; s.ky=(s.ky||0)+dy/k*(Wp.knock||.4)*9*sc; }
  }
  for(const n of [...npcs]){   // SoR: you can strike anyone
    const dx=n.x-player.x, dy=n.y-player.y, d=len(dx,dy);
    if(d > (Wp.reach||1.6) + (n.r||.5)) continue;
    let da=Math.abs((((Math.atan2(dy,dx)-ang)%(Math.PI*2))+Math.PI*3)%(Math.PI*2)-Math.PI);
    if(da > half) continue;
    hitNPC(n, PDMG()*(Wp.dmgMul||1)*(mul||1));
    hits++;
  }
  return hits;
}
function fireWeapon(Wp){
  const base=Math.atan2(player.fy,player.fx), n=player.multishot||1, k=Wp.kind||'physical';
  for(let i=0;i<n;i++){ const a=base+(i-(n-1)/2)*0.16;
    projectiles.push({ x:player.x+Math.cos(a)*.5, y:player.y+Math.sin(a)*.5,
      vx:Math.cos(a)*(Wp.speed||12), vy:Math.sin(a)*(Wp.speed||12), life:1.15,
      dmg:Math.round(pAtk(k)*(Wp.dmgMul||.6)), col:Wp.col||[127,255,255],
      r:Wp.projR||.18, proj:Wp.proj||'bolt', pierce:Wp.pierce||0, ang:a, kind:k }); }
}
function gainXP(n){
  player.xp+=n;
  while(player.xp>=player.xpNext){
    player.xp-=player.xpNext; player.level++; player.xpNext=Math.floor(player.xpNext*1.6);
    player.maxHp+=18; player.hp=player.maxHp;
    if((player.ap||0) >= (player.ad||0)*0.6){ player.ap+=6; } else { player.ad+=6; }   // grow the relevant offence stat
    player.maxStamina+=4; player.maxMana+=3;
    sfx('level'); showToast("Level "+player.level+"!  +power +vitality");
    burst(player.x,player.y,[255,224,102],24,4);
  }
}

// ===== THE TWO FAMILIES — allegiance & climb-wide influence =====
// Felling a Family Head pledges you to the RIVAL House: steel over sorcery, or sorcery over steel.
const HOUSE_RANKS=[3,7,12];   // favor thresholds for ranks I/II/III
function gainFavor(n){
  if(!player.house || !n) return;
  player.houseFavor=(player.houseFavor||0)+n;
  let nr=0; for(const t of HOUSE_RANKS){ if(player.houseFavor>=t) nr++; }
  if(nr>(player.houseRank||0)){ player.houseRank=nr; grantHouseRank(nr); }
}
function grantHouseRank(r){
  const blade=(player.house==='sword'||player.house==='vael'), RN=['','I','II','III'][r]||(''+r);
  sfx('win'); addShake(.35); flashT=Math.max(flashT||0,.05); burst(player.x,player.y,[255,232,165],36,6);
  if(blade){
    if(r===1) player.ad+=10;
    else if(r===2) player.lifesteal+=5;
    else if(r>=3){ player.ad+=12; player.housePow=(player.housePow||1)*1.2; try{ grantRelic(false); }catch(e){} }
    showToast('⚔ HOUSE OF THE BLADE — Favor '+RN+'. '+(r>=3?'You are named Blademaster — the Blade arms its champion.':'Your standing rises; the Blade rewards you.'));
  } else {
    if(r===1) player.critC=Math.min(.6,player.critC+0.08);
    else if(r===2) player.critM+=0.5;
    else if(r>=3){ player.arcMaster=true; try{ grantRelic(false); }catch(e){} }
    showToast('✦ HOUSE OF THE ARCANE — Favor '+RN+'. '+(r>=3?'You are named Archmage — the deepest secrets open to you.':'The Arcane shares its craft.'));
  }
}
function reunionVael(){
  if(player.house==='vael') return;
  const hadBlade=player.house==='sword', hadArcane=player.house==='magic';
  player.house='vael'; player.housePledged=true;
  bossDead=true; if(exit) exit.open=true;
  if(!hadBlade){ player.ad+=12; player.maxHp+=40; player.hp=Math.min(player.maxHp,player.hp+40); }
  if(!hadArcane){ player.critC=Math.min(.6,player.critC+0.10); player.critM+=0.4; }
  sfx('boss'); addShake(.55); flashT=Math.max(flashT||0,.07); burst(player.x,player.y,[255,240,180],52,7);
  try{ grantRelic(true); }catch(e){}
  const kid=npcs.find(nn=>nn.type==='youngson');   // the feud ends; the boy is free
  if(kid){ kid.line=-1; kid.lines=["The boy: They've stopped. They've really stopped...","The boy: One house again. I can go home. Thank you, climber."];
    if(kid.emoteT===undefined) kid.emoteT=0; kid.emote='♥'; kid.emoteT=4; pings.push({x:kid.x,y:kid.y,col:'#cdbcff',life:40}); }
  player.hp=Math.min(player.maxHp,player.hp+30); player.charge=Math.min(player.maxMana,player.charge+20);
  showToast('⚷ Both heads have fallen — the feud dies with them. The youngest son is free, and the broken house is yours: the favour of BOTH blade and spell.');
}
function swearAllegiance(slain){
  if(player.housePledged) return;
  const house = slain==='sword' ? 'magic' : 'sword';
  player.housePledged=true; player.house=house;
  sfx('win'); addShake(.4); flashT=Math.max(flashT||0,.05); burst(player.x,player.y,[255,232,165],36,6);
  if(house==='sword'){ player.ad+=12; player.maxHp+=40; player.hp=Math.min(player.maxHp,player.hp+40);
    showToast('⚔ You broke the Arcane — the HOUSE OF THE BLADE claims you. +12 damage, +40 max HP, and Blade champions ride at your side.'); }
  else { player.critC=Math.min(.6,player.critC+0.10); player.critM+=0.4;
    showToast('✦ You broke the Blade — the HOUSE OF THE ARCANE claims you. Sharper crits, swifter sorcery, and Arcane adepts answer your call.'); }
}
// Once pledged, both Houses reach across the climb: yours sends champions, the spurned House sends hunters.
function spawnHouseInfluence(){
  if(!player.house || realm.special || floor<=7) return;
  if(rand(0,1)<0.5){   // allied House champion fights beside you
    const sp=scatterPos(); if(sp){ const stype=(player.house==='magic'||(player.house==='vael'&&(floor&1)===0))?'arcanist':'swordsman';
      const ch=MOB(stype, sp[0], sp[1]);
      if(ch && !ch.isGate){ ch.friendly=true; ch.merc=true; ch.mercKind=player.house==='sword'?'blade':'bow'; ch.peaceful=false; ch.provoked=false;
        ch.hp=ch.maxHp=80+floor*16; ch.mDmg=12+floor*4; ch.speed=5.4; ch.sight=0; ch.touch=0; ch.xp=0; ch.drop=0; ch.faction=null; ch.smart=false; ch.houseAlly=true;
        ch.name=player.house==='sword'?'Blade Champion':'Arcane Adept'; ch.color=player.house==='sword'?[235,225,180]:[185,150,255];
        pings.push({x:sp[0],y:sp[1],col:'#9fe0a0',life:26}); } } }
  if(player.house!=='vael' && rand(0,1)<0.5){   // the spurned House sends an enforcer to hunt you
    const rival=player.house==='sword'?'magic':'sword'; let sx9=0,sy9=0,t9=0;
    do{ const sp=scatterPos(); sx9=sp[0]; sy9=sp[1]; t9++; } while((inSafe(sx9,sy9)||len(sx9-exit.x,sy9-exit.y)<14)&&t9<20);
    const ag=MOB(rival==='sword'?'swordsman':'arcanist', sx9, sy9);
    if(ag && !ag.isGate){ makeElite(ag, rival==='sword'?'Blade Enforcer of the Spurned House':'Arcane Enforcer of the Spurned House', rival==='sword'?'Frenzied':'Hexer');
      ag.houseAgent=rival; ag.smart=true; ag.sight=999; ag.provoked=true; ag.hp=Math.round(ag.hp*1.3); ag.maxHp=ag.hp; ag.drop=(ag.drop||5)+6;
      pings.push({x:sx9,y:sy9,col:'#ff7a6a',life:9999}); } }
}
function killMob(m, over){
  kills++; sfx('hit'); addShake(.18); freezeT=Math.max(freezeT,(m.gateBoss||m.champion||m.type==='boss')?.12:.06);
  if(m.coinwraith){ dropCoins(m.x,m.y,28+floor*2); burst(m.x,m.y,[255,215,90],30,5); sfx('level'); addShake(.4); showToast('Coinwraith felled! '+grantItem(rand(0,1)<.4)); }
  if(m.mimic){ dropCoins(m.x,m.y,16+floor*3); burst(m.x,m.y,[255,210,90],30,5); sfx('level'); addShake(.3); showToast('Mimic slain — '+grantItem(true)); }
  if(m.houseAgent && player.house){ dropCoins(m.x,m.y,12+floor*2); burst(m.x,m.y,[255,200,120],22,4); showToast('The spurned House\u2019s enforcer falls — your favor grows.'); gainFavor(3); }
  if(!m.friendly) encDist=Math.max(0,encDist-6);   // a kill is an encounter — ease the director
  if(m.noCredit){ kills--; burst(m.x,m.y,m.color||[180,180,190],10,3); mobs=mobs.filter(x=>x!==m); return; }   // v196: a feud ally/routed loser yields no XP/coins/drops/kill-credit
  if(m.icId){ const wf=m.warFac||m.lastWarFac; const e=incidents.find(ic=>!ic.done && ic.id===m.icId);
    if(e && wf){ e.playerKills++; e.playerSide = (wf===e.facA) ? e.facB : e.facA; } }   // killing one side => you HELP the other
  if(m.bounty){ dropCoins(m.x,m.y,20+floor*3); sfx('win'); showToast('★ Bounty claimed — '+(m.eliteName||'the marked')+' lies slain.'); }
  if(m.contractTgt && player.contract && player.contract.active){
    const c=player.contract; dropCoins(m.x,m.y,30+floor*4+c.tier*10); sfx('win'); addShake(.4); burst(m.x,m.y,[255,90,140],32,5); c.tier++;
    if(c.tier>4){ c.active=false; showToast('★ Contract complete — '+c.name+' is destroyed forever! '+grantItem(true)); }
    else { c.affix=pick(Object.keys(AFFIXES)); showToast('★ '+c.name+' falls (tier '+(c.tier-1)+')! '+grantItem(true)+' — it will return stronger.'); }
  }
  if(m.worldboss){ const ev=worldEvents.find(e=>e.id===m.eventId); if(ev && !ev.done){ ev.done=true; for(const p of pings){ if(p.evId===ev.id) p.life=0; } }
    dropCoins(m.x,m.y,40+floor*5); player.charge=Math.min(player.maxMana,player.charge+30); addShake(.5); burst(m.x,m.y,m.color||[255,120,120],50,7);
    showToast('★ The colossus falls! '+grantRelic(true)); }
  if(m.gateBoss||m.champion||m.type==='boss') flashT=.09;   // boss-kill white flash (alpha-capped)
  if(m.elite) floorStats.elites++;
  killsBy[m.type]=(killsBy[m.type]||0)+1;
  if(m.type && !m.friendly){ FT.bestiary=FT.bestiary||{}; FT.bestiary[m.type]=(FT.bestiary[m.type]||0)+1;
    const _b=FT.bestiary[m.type]; if(_b===25||_b===100||_b===250){ const mt=masteryTier(m.type); if(mt) showToast('✦ '+m.type.toUpperCase()+' '+mt[2].toUpperCase()+' — +'+Math.round((mt[1]-1)*100)+'% damage vs them, forever.'); } }
  bumpLT('kills'); if(m.type==='slime') bumpLT('slimes'); if(m.elite) bumpLT('elites'); if(m.gateBoss) bumpLT('bosses');
  player.charge=Math.min(player.maxMana, player.charge+ (m.type==='boss'?40:m.type==='general'?22:m.type==='nest'?15:11)*player.chargeMul*comboChargeMul());
  if(m.type!=='nest' && !m._noQuest) questBump('cull');
  burst(m.x,m.y,m.color,(m.type==='boss'?40:14)+Math.min(22,(over||0)*.2),(m.type==='boss'?6:3.5)+Math.min(4,(over||0)*.03));   // overkill = bigger eruption
  { const k=len(m.x-player.x,m.y-player.y)||1; for(let i=0;i<3;i++) particles.push({x:m.x,y:m.y,vx:(m.x-player.x)/k*rand(4,8),vy:(m.y-player.y)/k*rand(4,8),life:rand(.6,1),max:1,color:m.color,size:rand(4,7)}); }
  dropCoins(m.x,m.y, m.friendly ? m.drop : Math.round((bloodMoon?(m.drop||1)*1.6+1:(m.drop||0))*covRewardMul())); gainXP(m.xp);
  if(!m.friendly) player.prestige=(player.prestige||0) + (m.type==='boss'?25:m.gateBoss?20:m.champion?12:m.elite?5:m.type==='general'?8:m.type==='nest'?4:1);   // 3.0: prestige from felled foes
  if(npcs.length && !m.friendly){ for(const n of npcs){ if(!n.civ) continue; const dd=len(n.x-m.x,n.y-m.y); if(dd>7) continue;   // bystanders react to a death nearby
    if(n.emoteT<=0 && rand(0,1)<0.5){ n.emote=pick(['!','Gods!','A death!','...']); n.emoteT=1.6; }
    if(n.mind!=='flee' && rand(0,1)<0.3){ n.mind='flee'; n.mindT=1.6; fleePulse=Math.max(fleePulse,1); } } }
  if(!m.friendly && player.relicsKill.length) for(const r of player.relicsKill) r.onKill(m);
  if(!m.friendly && (m.elite||m.champion||m.mimic||m.type==='boss')){ const _kc = m.type==='boss'?1 : m.champion?0.5 : m.mimic?0.6 : 0.22; if(rand(0,1) < _kc*covRewardMul()){ spawnWorldKit(m.x,m.y, rollKitDrop(m.type==='boss'?3 : (m.champion?2:1))); }
    if(m.type==='boss'){ if(rand(0,1)<0.5) spawnWorldTrinket(m.x,m.y,rollTrinket(3)); } else if(m.champion){ if(rand(0,1)<0.25) spawnWorldTrinket(m.x,m.y,rollTrinket(1)); } }
  if(player.lifesteal>0) player.hp=Math.min(player.maxHp, player.hp+player.lifesteal);
  // signature enemy death effects
  if(m.onDeath==='split'){ for(let i=0;i<2;i++){ const mm=MOB('slime', m.x+rand(-1,1), m.y+rand(-1,1)); mm.r*=.7; mm.speed*=1.3; mm.hp=Math.max(1,Math.round(mm.maxHp*.45)); mm.maxHp=mm.hp; mm.onDeath=null; } }
  else if(m.onDeath==='shock'){ shocks.push({x:m.x,y:m.y,r:.2,maxR:3,life:.5,max:.5,dmg:Math.round(10+floor*0.15),hit:false,col:realm?realm.accent:[190,120,255]}); }
  if(m.volatile){ addShake(.4); burst(m.x,m.y,[255,150,60],26,5); shocks.push({x:m.x,y:m.y,r:.2,maxR:2.6,life:.5,max:.5,dmg:Math.round(10+floor*1.2),hit:false,col:[255,140,50]}); sfx('boss'); }
  // ---- CORPSE DETONATION CHAINS: a status death (or a chained death) detonates and cascades ----
  if(!m.friendly && m.type!=='nest'){
    const _ce=chainElemOf(m);
    if(_ce || m._chained) chainDetonate(m, _ce, !m._chained);   // seed only when this was the player's own kill
  }
  if(m.warlord){   // the camp breaks: survivors rout, the war-chest is yours
    for(const o of mobs){ if(o.campId===m.campId){ o.fleeT=5; o.orbit=null; } }
    props.push({kind:'chest', x:m.x, y:m.y, big:true, opened:false});
    pings.push({x:m.x,y:m.y,col:'#ffd34d',life:30});
    showToast((m.eliteName||'The warlord')+' falls — the camp breaks!'); }
  if(m.type==='nest'){ showToast('Monster nest destroyed!'); burst(m.x,m.y,m.color,26,4); addShake(.35); questBump('nest'); }
  if(m.champion){ m.dead=true; m.resolved=true; addShake(.5); burst(m.x,m.y,m.color,50,7);
    showToast((m.bossName||'The Upper Being')+' falls! '+grantItem(true)); }
  if(m.warden){ showToast('The Warden falls! '+grantItem(true)); player.charge=Math.min(player.maxMana,player.charge+30); addShake(.5); }
  if(heroClass && heroClass.key==='Necromancer' && !m.friendly && m.type!=='nest' && rand(0,1)<.25){ summonSkeleton(m.x,m.y); }
  if(m.isGate) questBump('bounty');
  if(m.familyHead){
    bossDead=true; if(exit) exit.open=true;
    if(m.familyHead==='sword') player.swordHeadDead=true; else player.magicHeadDead=true;
    if(player.swordHeadDead && player.magicHeadDead) reunionVael();
    else if(!player.housePledged) swearAllegiance(m.familyHead);
  }
  if(m.isGate){ // the floor's gatekeeper (general or boss) falls -> the stair unlocks
    bossDead=true; if(exit) exit.open=true;
    if(player.house && !m.familyHead) gainFavor(1);   // climbing as a House champion earns standing
    if(player.lives!==undefined){ player.lives=Math.min((player.maxLives||3)+2, player.lives+1); showToast('The gatekeeper falls — the Tower grants you another life. ('+player.lives+')'); }
    addShake(.5); burst(m.x,m.y, realm.accent, m.gateBoss?60:36, 7);
    if(m.gateBoss){ showToast((m.bossName||'The boss')+' falls! You claim '+grantItem(true)+'. The portal flares open.'); }
    else showToast((m.bossName||'The general')+' falls! The portal flares open.');
    mobs=mobs.filter(x=>x!==m);
    openDraft();   // pick a boon as the floor reward
    return;
  }
  mobs=mobs.filter(x=>x!==m);
}

// ---------- Update ----------
const WORK_EMOTE={smith:'\u2692',cook:'\u2615',merchant:'\u26b2',wood:'\u2767',tavernkeep:'\u2615',busker:'\u266a',fishmonger:'\u2767',lamplighter:'\u2726',herbalist:'\u2698'};
// ----- personality: each soul gets a trait that colours how it moves, reacts and speaks -----
const TRAITS={
  merry:  { emo:['\u266a','\u263a','\u2665','!'], fear:0.7, gawk:0.4, barks:['Lovely day for a climb!','Ha! Mind the slimes.','Songs and ale \u2014 that\u2019s the life.','Cheer up, the Tower\u2019s always like this.'] },
  timid:  { emo:['\u2026','?','!'],      fear:1.6, gawk:0.0, barks:['I don\u2019t want any trouble\u2026','Stay near the walls.','Is it safe? It\u2019s never safe.','Please don\u2019t bring those things here.'] },
  brave:  { emo:['!','\u2694'],          fear:0.35, gawk:1.0, barks:['Give \u2019em steel!','I\u2019ve seen far worse.','Stand your ground, climber.','Bah, monsters. Tuesday.'] },
  curious:{ emo:['?','!','\u2026'],       fear:0.6, gawk:1.0, barks:['Oh? What\u2019s this?','A real climber! Truly?','I simply must see this.','Where do you suppose the stair leads?'] },
  gruff:  { emo:['\u2026','\u2692'],      fear:0.6, gawk:0.5, barks:['Hmph.','Work to do.','Mind yourself.','Out of my way, climber.'] },
  weary:  { emo:['\u2026','\u2615'],      fear:0.9, gawk:0.2, barks:['So tired of this climb.','One more floor. Always one more.','Let an old soul rest.','My feet have walked a hundred towers.'] },
  greedy: { emo:['\u25c6','!','\u2665'],  fear:0.85, gawk:0.6, barks:['Coin? Where? Show me.','Everything has a price.','Spare a coin for me, climber?','Now THAT looks valuable.'] },
  devout: { emo:['\u2726','\u2026'],      fear:0.7, gawk:0.3, barks:['The spirits are watching.','Climb true, climb pure.','Pray before you pass on.','The Tower tests the faithful.'] },
};
const TRAIT_KEYS=Object.keys(TRAITS);
const CHAT_LINES={
  weather:['Foul sky today.','Rain again? My bones knew it.','Clear enough to climb, I\u2019d say.','The ash gets in everything.'],
  climber:['Did you see the climber?','Another one for the buckets, mark me.','Brave or foolish, hard to say.','They cleared a whole floor, I heard.'],
  gossip:['You didn\u2019t hear it from me\u2026','The Watch is on edge lately.','They say the magistrate takes bribes.','Old Mara saw a coinwraith again.'],
  prices:['Coin buys less each floor.','The smith\u2019s gone up again.','Tithe collector came by twice.','Bread or blade \u2014 can\u2019t afford both.'],
  tower:['The Tower remembers, they say.','Nobody\u2019s reached the Crown.','Floor by floor, that\u2019s all we get.','The stair always hides east.'],
  family:['How are the little ones?','Did you eat? You look thin.','Mind your sister, now.','We should get inside before dark.','Father always said: climb low, climb slow.'],
};
const CHAT_TOPICS=Object.keys(CHAT_LINES);
const NAMES=['Mara','Toly','Bram','Senna','Garrick','Pell','Oda','Wick','Cael','Bryn','Hester','Dob','Lyra','Fenn','Marl','Ona','Quill','Reeve','Sable','Tam','Vesna','Wren','Yorrick','Zeb','Alda','Corin','Dunn','Esk','Fira','Goss'];
const CHEERS=['Huzzah!','The gate falls!','We\u2019re saved!','Hooray!','The climber did it!','\u266a'];
const USE_PROPS={ well:'\u2615', fountain:'\u2615', cookfire:'\u266a', anvil:'\u2692', dummy:'\u2694', shrine:'\u2726', board:'\u2026', newsstand:'\u2026', stall:'\u25c6', book:'\u2026', orb:'\u2726', waystone:'\u2726', keg:'\u2615' };
// ----- daily life: what a soul DOES at a prop, coloured by who they are -----
const ACT_PROP={ shrine:'pray', orb:'pray', waystone:'pray', dummy:'train', keg:'drink', cookfire:'warm', book:'read', board:'read', newsstand:'read' };
const TRAIT_PROP={ devout:'shrine', timid:'shrine', brave:'dummy', gruff:'dummy', merry:'keg', weary:'keg', greedy:'keg', curious:'book' };
const ACT_ICON={ pray:'✦', train:'⚔', drink:'☕', warm:'♨', read:'✎' };
const ACT_COL={ pray:'#ffe6a0', train:'#cfe0ff', drink:'#ffcaa0', warm:'#ffb070', read:'#dfe4f0' };
const ACT_BARK={
  pray:['The spirits hear us.','Climb true, climb pure.','Watch over the climb.','…','Blessings on this floor.'],
  train:['Hah! Again.','Guard up!','Steel keeps you breathing.','One more pass.','Mind your footwork.'],
  drink:['Another round!','Ahh, that’s the stuff.','To the climbers!','*hic*','Pour me one more.'],
  warm:['Cold to the bone.','Bless this fire.','Mmh, warmth.','Closer to the coals.'],
  read:['Hm, interesting.','It says here…','Knowledge is the true climb.','…'],
};
function npcUseProp(n){                                          // find a nearby prop worth lingering at (souls favour their kind)
  const fav=TRAIT_PROP[n.trait];
  let best=null,bd=260;
  for(const p of props){ const e=USE_PROPS[p.kind]; if(!e) continue;
    const dx=p.x-n.x, dy=p.y-n.y; let d2=dx*dx+dy*dy; if(p.kind===fav) d2*=0.32; if(d2<bd && d2>1){ bd=d2; best=p; } }
  if(!best) return null;
  const a=rand(0,6.28);
  return { x:best.x+Math.cos(a)*1.7, y:best.y+Math.sin(a)*1.2, fx:best.x, fy:best.y, use:USE_PROPS[best.kind], kind:best.kind };
}
const WORK_PROP={stall:1,anvil:1,well:1,cookfire:1,keg:1,dummy:1,board:1,newsstand:1,ore:1};
function npcSeedHaunts(n){                                       // tie a soul to a home, a workplace and a social spot
  let home=null,social=null,bd=1e18,sd=1e18;
  for(const b of buildings){ const d=(b.x-n.x)*(b.x-n.x)+(b.y-n.y)*(b.y-n.y); if(d<bd){ bd=d; home={x:b.x,y:b.y}; } }
  for(const z of safeZones){ const d=(z.x-n.x)*(z.x-n.x)+(z.y-n.y)*(z.y-n.y); if(d<sd){ sd=d; social={x:z.x,y:z.y}; } }
  let work = n.post ? {x:n.post.x,y:n.post.y} : null;
  if(!work){ let wd=1e18; for(const p of props){ if(!WORK_PROP[p.kind]) continue; const d=(p.x-n.x)*(p.x-n.x)+(p.y-n.y)*(p.y-n.y); if(d<wd){ wd=d; work={x:p.x,y:p.y}; } } }
  home = n.famHome ? {x:n.famHome.x,y:n.famHome.y} : (home||(n.home?{x:n.home.x,y:n.home.y}:{x:n.x,y:n.y})); work=work||home; social=social||work;
  return {home,work,social};
}
const FOCAL_TYPE={busker:1,dancer:1,crier:1,storyteller:1,bard:1};   // street performers draw a crowd
function npcGather(n){
  let foc=null,fd=144; for(const o of npcs){ if(o===n||!FOCAL_TYPE[o.type]) continue; const dx=o.x-n.x,dy=o.y-n.y,d2=dx*dx+dy*dy; if(d2<fd){ fd=d2; foc=o; } }
  if(!foc) return null;
  const a=rand(0,6.28), r=2.2+rand(0,1.8);
  return { x:foc.x+Math.cos(a)*r, y:foc.y+Math.sin(a)*r, fx:foc.x, fy:foc.y };
}
const FOUL_WEATHER={rain:1,snow:1,ash:1};
function npcWorkFx(n){
  if(n.workFx==='smith'){ burst(n.x+1.05,n.y,[255,190,80],5,2.6); }
  else if(n.workFx==='cook'){ for(let s9=0;s9<3;s9++) particles.push({x:n.x+1.05+rand(-.1,.1),y:n.y-0.1,vx:rand(-.2,.2),vy:-rand(.8,1.4),life:rand(.6,1),max:1,color:[165,165,175],size:rand(3,5)}); }
  else if(n.workFx==='merchant'){ burst(n.x+1.05,n.y-.3,[255,215,90],2,1.4); }
  else if(n.workFx==='wood'){ burst(n.x+0.4,n.y-.2,[190,150,90],5,2.2); }
  else if(n.workFx==='tavernkeep'){ burst(n.x+1.05,n.y-.2,[230,180,90],2,1.2); }
  else if(n.workFx==='busker'){ for(let s9=0;s9<2;s9++) particles.push({x:n.x+rand(-.4,.4),y:n.y-0.4,vx:rand(-.3,.3),vy:-rand(.8,1.3),life:rand(.7,1.1),max:1.1,color:[150,225,210],size:rand(3,5)}); }
}
function npcGoal(n){
  const r=rand(0,1);
  if(r<0.80){                                                  // mostly: walk the streets, end to end
    const roads=floors.filter(f=>f.road && Math.max(f.w,f.h)>10);
    if(roads.length){
      // sometimes step onto the NEAREST street, sometimes pick ANY street and stroll its length
      let f;
      if(rand(0,1)<0.45){ let bd=1e9; for(const rf of roads){ const nx=Math.max(rf.x-rf.w/2+1.5,Math.min(rf.x+rf.w/2-1.5,n.x)), ny=Math.max(rf.y-rf.h/2+1.5,Math.min(rf.y+rf.h/2-1.5,n.y)); const d=(nx-n.x)*(nx-n.x)+(ny-n.y)*(ny-n.y); if(d<bd){ bd=d; f=rf; } } }
      else { f=pick(roads); }
      const horiz=f.w>=f.h;
      const gx=horiz? rand(f.x-f.w/2+2, f.x+f.w/2-2) : Math.max(f.x-f.w/2+1.2,Math.min(f.x+f.w/2-1.2,n.x));
      const gy=horiz? Math.max(f.y-f.h/2+1.2,Math.min(f.y+f.h/2-1.2,n.y)) : rand(f.y-f.h/2+2, f.y+f.h/2-2);
      return {x:gx,y:gy}; } }
  else if(r<0.92 && poiList.length){ const p=pick(poiList); return {x:p.x+rand(-6,6), y:p.y+rand(-5,5)}; }
  const a=rand(0,6.28), rr=rand(2,8), h=n.post||n.home; return {x:h.x+Math.cos(a)*rr, y:h.y+Math.sin(a)*rr};
}
const BOUNTY_NAMES=['Gorehowl the Unbroken','Vexia, Wraith of Coin','the Pale Stalker','Brakka Two-Axe','the Hollow Cantor','Sythe, the Bone Collector','Mire-Mother','the Gilded Tyrant','Karsk the Render','the Ashen Widow'];
const WORLDBOSS_NAMES=['Gor the Mountain','the Hollow King','Vakthar Worldsplitter','the Bone Colossus','Mourngrim the Vast','the Ashen Behemoth'];
function stageWorldEvent(){
  if(realm.special) return;
  const k = pick(floor>=4 ? ['raid','worldboss','raid','worldboss'] : ['raid','raid','worldboss']);
  let x=0,y=0,t9=0; do{ const sp=scatterPos(); x=sp[0]; y=sp[1]; t9++; } while((len(x-player.x,y-player.y)<22 || (exit&&len(x-exit.x,y-exit.y)<14)) && t9<26);
  const ev={ kind:k, x, y, t:55+rand(0,20), done:false, id:'ev'+floor+'_'+worldEvents.length, foes:[] };
  if(k==='raid'){
    const n=4+(floor>4?2:0);
    for(let i=0;i<n;i++){ const a=i/n*6.28, sp=offRoad(x+Math.cos(a)*3, y+Math.sin(a)*3.5); const m=MOB(pick(realm.pool),sp[0],sp[1]); if(m){ m.provoked=false; m.eventId=ev.id; m.raider=true; ev.foes.push(m); } }
    for(let i=0;i<3;i++){ const nn=makeNPC(pick(['villager','peasant','child','washer']), x+rand(-3,3), y+rand(-3,3)); nn.civ=true; nn.roam=true; nn.post={x:nn.x,y:nn.y,r:3}; npcs.push(nn); }
    decos.push({type:'brazier',x,y,s:1.2,seed:7});
    pings.push({x,y,col:'#ff7a4a',life:9999,evId:ev.id});
    bossIntroT=2.4; bossIntroName='RAIDERS STRIKE'; bossIntroSub='A village burns in the wilds — drive them off for a relic';
    showToast('\ud83d\udd25 Raiders fall on a village — save it for a relic!');
  } else {
    const m=MOB('general', x, y);
    if(m){ makeElite(m, pick(WORLDBOSS_NAMES), pick(Object.keys(AFFIXES)));
      m.worldboss=true; m.eventId=ev.id; m.neutralC=true; m.provoked=false;
      m.hp=Math.round(m.hp*2.4); m.maxHp=m.hp; m.r*=1.35; m.touch=Math.round((m.touch||10)*1.2); m.drop=(m.drop||5)+20;
      m.patrol={ax:x,ay:y,bx:-x,by:-y,toB:true}; ev.boss=m; }
    ev.t=99999;
    pings.push({x,y,col:'#ff4060',life:9999,evId:ev.id});
    bossIntroT=2.6; bossIntroName=((ev.boss&&ev.boss.eliteName)||'A COLOSSUS').toUpperCase(); bossIntroSub='A colossus stalks the wilds — slay it for a relic';
    showToast('\u2694 A colossus stalks the floor — hunt it for a relic!');
  }
  worldEvents.push(ev);
}
function stageIncident(){
  if(realm.special) return;                                    // HARD invariant guard (defense-in-depth)
  let x=0,y=0,t9=0; do{ const sp=scatterPos(); x=sp[0]; y=sp[1]; t9++; }
    while((len(x-player.x,y-player.y)<20 || (exit&&len(x-exit.x,y-exit.y)<14) || inSafe(x,y)) && t9<24);
  if(len(x-player.x,y-player.y)<14 || (exit&&len(x-exit.x,y-exit.y)<10) || inSafe(x,y)) return;   // bail rather than spawn on player/exit
  let kind=pick(floor<=3?['feud','crackdown','feud']:['feud','ambush','feud']);
  if(kind==='crackdown' && wantedT>0) kind='feud';            // the Watch is busy with you
  const FAC={ feud:['sword','magic'], crackdown:['watch','outlaw'], ambush:['caravan','raider'] }[kind];
  const e={ kind, x, y, t:42+rand(0,18), done:false, id:'ic'+floor+'_'+incidents.length,
            facA:FAC[0], facB:FAC[1], sideA:[], sideB:[], playerKills:0, playerSide:null };
  const n=(floor>=5?4:3);
  const NAME={sword:'a Blade of the Spurned House',magic:'an Arcanist of the Spurned House',watch:'a Watchman',outlaw:'an Outlaw',raider:'a Raider',caravan:'a Caravan Guard'};
  const TYPEOF=(fac)=>fac==='magic'?'arcanist':(fac==='outlaw'?'shade':'swordsman');
  const spawnSide=(fac,cx,cy,arr)=>{ for(let i=0;i<n;i++){ const a=i/n*6.28, sp=offRoad(cx+Math.cos(a)*2.6, cy+Math.sin(a)*2.8);
    const m=MOB(TYPEOF(fac), sp[0], sp[1]);
    if(m && !m.isGate){ m.warFac=fac; m.rivalFac=(WAR_RIVALS[fac]||[]).slice(); m.icId=e.id; m.warAgg=3;
      m.provoked=false; m.peaceful=false; m.friendly=false; m.faction=null; m.smart=true; m.sight=0;
      m.hp=m.maxHp=Math.round(m.maxHp*1.15); m.drop=0; m.xp=0; m.elite=null; m._noQuest=true; m.eliteName=NAME[fac];
      if(fac==='watch') m.warHostilePlayer=(wantedT>6);
      if((fac==='sword'||fac==='magic') && (player.houseStand&&player.houseStand[fac]||0)<=REPRISAL_T
         && !(player.house && player.house!=='vael' && fac===(player.house==='sword'?'magic':'sword'))) m.feudGrudge=true;   // v196: this house holds a grudge
      arr.push(m); } } };
  spawnSide(e.facA, x-3, y, e.sideA);
  spawnSide(e.facB, x+3, y, e.sideB);
  pings.push({x,y,col:'#ffb84a',life:e.t+8,icId:e.id});
  bossIntroT=2.0; bossIntroName='A FEUD ERUPTS';
  bossIntroSub={feud:'The Two Houses draw steel — pick a side, or let them bleed',crackdown:'The Watch corners the outlaws — stay clean and you are safe',ambush:'Raiders fall on a caravan — save it, or scavenge the dead'}[kind];
  showToast('⚔ '+{feud:'The Two Families clash in the streets!',crackdown:'The Watch hunts outlaws nearby!',ambush:'Raiders ambush a caravan!'}[kind]);
  incidents.push(e);
}
function resolveEvent(e, success){
  if(e.done) return; e.done=true;
  for(const p of pings){ if(p.evId===e.id) p.life=0; }
  if(success){ burst(e.x,e.y,[255,220,120],32,6); sfx('win'); addShake(.3);
    showToast('\u2726 Saved! '+grantRelic(true)); dropCoins(e.x,e.y,18+floor*3); player.charge=Math.min(player.maxMana,player.charge+15);
    pings.push({x:player.x,y:player.y,col:'#ffe066',life:26});
  } else if(e.kind==='raid'){ showToast('Too late \u2014 the village is ash.'); addShake(.2);
    decos.push({type:'bones',x:e.x,y:e.y,s:1,seed:3}); for(const m of e.foes){ if(m && m.hp>0) m.fleeT=6; } }
}
function resolveIncident(e, aliveA, aliveB){
  if(e.done) return; e.done=true;
  for(const p of pings){ if(p.icId===e.id) p.life=0; }
  for(const m of mobs){ if(m.warFac && m.icId===e.id){ m._afFac=m.warFac; m.warFac=null; m.rivalFac=null; m.warAgg=0; m.warHostilePlayer=false; m.fleeT=4; } }   // v196: _afFac stashed before warFac null
  const winner = aliveA>aliveB ? e.facA : aliveB>aliveA ? e.facB : null;   // v196: more-alive side wins (so the loser keeps fleeing survivors to rout)
  if(e.playerKills>0 && e.playerSide){
    if(player.house){ if(player.house===e.playerSide || player.house==='vael') gainFavor(2); else gainFavor(-1); }
    if(e.kind==='crackdown' && e.playerSide==='watch' && wantedT<=0 && player.rep){ player.rep.watch=(player.rep.watch||0)+1; }
  }
  if(e.kind==='ambush' && winner==='caravan'){ dropCoins(e.x,e.y,14+floor*2); }
  showToast(winner ? ({sword:'The Blades hold the street.',magic:'The Arcanists hold the street.',watch:'The Watch restores order.',caravan:'The caravan is saved!',raider:'The caravan is lost.',outlaw:'The outlaws own the night.'})[winner] : 'The feud burns itself out.');
  decos.push({type:'bones',x:e.x,y:e.y,s:1,seed:3});
  if(e.playerKills>=2){ dropCoins(e.x,e.y,8+floor*2); }
  // ---- v196 Feud Aftermath & Allegiance: one guarded scene (mob-only, no npcs mutation, no killMob) ----
  if(!e._aftermath){ e._aftermath=true;
    const loser = winner ? (winner===e.facA ? e.facB : e.facA) : null;
    const survFac=(fac)=> [...e.sideA, ...e.sideB].filter(m=> m && m.hp>0 && mobs.includes(m) && m._afFac===fac && !m.friendly && !m.hostileNpc);
    if(loser){ fleePulse=Math.max(fleePulse,3); pings.push({x:e.x,y:e.y,col:'#ff6a5a',life:10});
      for(const m of survFac(loser)){ m.peaceful=true; m.provoked=false; m.noCredit=true; m.afRout=true; m.fleeX=e.x; m.fleeY=e.y; m.fleeT=7;
        if(m.emoteT<=0){ m.emote=pick(['Fall back!','We\u2019re broken!','Run!']); m.emoteT=2; } burst(m.x,m.y,m.color,4,2); } }
    if(winner){ for(const m of survFac(winner)){ m.peaceful=true; m.provoked=false;
        if(m.emoteT<=0){ m.emote=pick(['We hold!','For the House!']); m.emoteT=2.2; } } }
    if(e.kind==='feud' && e.playerKills>=2 && e.playerSide){
      const HS=(player.houseStand=player.houseStand||{sword:0,magic:0});
      const against = e.playerSide===e.facA ? e.facB : e.facA;
      if(HS[e.playerSide]!=null) HS[e.playerSide]=Math.max(-6,Math.min(6,HS[e.playerSide]+1));
      if(HS[against]!=null)      HS[against]=Math.max(-6,Math.min(6,HS[against]-1));
      const _hc = e.playerSide==='sword'?[120,200,255]:[200,150,255];
      burst(e.x,e.y,_hc,20,4);
      showToast('The '+({sword:'Blades',magic:'Arcane'})[e.playerSide]+' will remember this. The '+({sword:'Blades',magic:'Arcane'})[against]+' will not forgive it.');
    }
    if(winner && e.kind==='feud' && e.playerKills>=2 && e.playerSide===winner && !mobs.some(m=>m.merc)
       && (player.x-e.x)*(player.x-e.x)+(player.y-e.y)*(player.y-e.y) < RECRUIT_RANGE2){
      const a=survFac(winner)[0];
      if(a){ a.friendly=true; a.merc=true; a.feudAlly=true; a.noCredit=true; a.mercKind=(a.type==='arcanist'?'bow':'blade');
        a.peaceful=false; a.provoked=false; a.warFac=null; a.rivalFac=null; a.warAgg=0; a.lastWarFac=null; a._afFac=null; a.icId=null; a.afRout=false; a.fleeT=0;
        a.faction=null; a.smart=false; a.sight=0; a.touch=0; a.xp=0; a.drop=0; a.elite=null; a._noQuest=true; a.allyT=ALLY_LIFE;
        a.mDmg=(a.mercKind==='bow'?6+floor*2:8+floor*2); a.speed=5.2;
        burst(a.x,a.y,[150,200,255],14,3); sfx('level'); addShake(.2); pings.push({x:a.x,y:a.y,col:'#78e68c',life:20});
        showToast('A survivor of '+({sword:'the Blades',magic:'the Arcanists'})[winner]+' owes you their life \u2014 they fight at your side (briefly).'); }
    }
  }
}
function aheadSpot(d){
  let fx=(player.faceX!==undefined?player.faceX:player.fx)||1, fy=(player.faceY!==undefined?player.faceY:player.fy)||0;
  const fl=len(fx,fy)||1; fx/=fl; fy/=fl;
  for(let t=0;t<12;t++){ const r=d+t*2.2;
    let x=player.x+fx*r+rand(-5,5), y=player.y+fy*r+rand(-5,5);
    x=Math.max(-WORLD_HW+5,Math.min(WORLD_HW-5,x)); y=Math.max(-WORLD_HH+5,Math.min(WORLD_HH-5,y));
    if(!inWall(x,y,1.3) && !inSafe(x,y) && !onHazardFloor(x,y,1) && !onRoad(x,y,1.4)) return [x,y]; }
  const a=rand(0,6.28); return offRoad(Math.max(-WORLD_HW+5,Math.min(WORLD_HW-5,player.x+Math.cos(a)*d)), Math.max(-WORLD_HH+5,Math.min(WORLD_HH-5,player.y+Math.sin(a)*d)));
}
function stageEncounter(){
  const pool=realm.pool, sig=realm.sig||pick(pool), f=floor;
  // weighted creative pool — variety so the road always surprises
  const types=['ambush','ambush','patrol','patrol','bounty','runner','rescue','pedlar','cache','wildshrine','swarm','duel'];
  const t=types[Math.floor(rand(0,types.length))];
  if(t==='ambush'){
    const n=3+(f>3?1:0)+(f>6?1:0);
    for(let i=0;i<n;i++){ const a=i/n*6.28+rand(-.3,.3), r=4.5+rand(0,2.5);
      const sp=offRoad(player.x+Math.cos(a)*r, player.y+Math.sin(a)*r), x=sp[0], y=sp[1]; burst(x,y,[150,110,70],14,4);
      const m=MOB(pick(pool),x,y); m.provoked=true; m.assistT=4; }
    addShake(.3); sfx('boss'); showToast('Ambush! Foes erupt from the ground.');
  } else if(t==='patrol'){
    const[x,y]=aheadSpot(15); const pk=spawnPack(pick(pool),3+(f>4?1:0),x,y);
    for(const m of pk){ m.provoked=true; m.smart=true; m.assistT=5; }
    pings.push({x,y,col:'#ff8a5a',life:18}); showToast('A hostile patrol crosses your path.');
  } else if(t==='bounty'){
    const[x,y]=aheadSpot(17); const m=MOB(sig,x,y);
    makeElite(m, pick(BOUNTY_NAMES), pick(['Frenzied','Titan','Volatile','Vampiric','Shielded']));
    m.bounty=true; m.provoked=true; m.smart=true; m.sight=999; m.hp=Math.round(m.hp*1.3); m.maxHp=m.hp; m.drop=(m.drop||5)+10;
    pings.push({x,y,col:'#ffd34d',life:40}); showToast('★ BOUNTY: '+m.eliteName+' prowls nearby — slay it for a rich purse.'); sfx('boss');
  } else if(t==='runner'){
    const[x,y]=aheadSpot(11); const m=MOB('darter',x,y);
    m.coinwraith=true; m.speed=Math.max(5.6,m.speed*1.5); m.hp=Math.round(m.hp*1.6+f*9); m.maxHp=m.hp; m.color=[255,215,90]; m.touch=0; m.xp=8;
    pings.push({x,y,col:'#ffe066',life:22}); showToast('A Coinwraith! Catch it before it escapes — it bleeds treasure.'); sfx('coin');
  } else if(t==='rescue'){
    const[x,y]=aheadSpot(14); const n=makeNPC(pick(['villager','pedlar','peasant','child','wanderer']),x,y);
    n.roam=true; n.scaredT=99; n.rescue=true; n.home={x,y}; n.post={x,y,r:2}; npcs.push(n);
    for(let i=0;i<2+(f>4?1:0);i++){ const m=MOB(pick(pool),x+rand(-3.5,3.5),y+rand(-3.5,3.5)); m.provoked=true; m.assistT=5; }
    pings.push({x,y,col:'#7dff8a',life:26}); showToast('Someone cries for help nearby — save them!');
  } else if(t==='pedlar'){
    const[x,y]=aheadSpot(10); const n=makeNPC('pedlar',x,y); n.roam=true; n.travel=true; npcs.push(n);
    pings.push({x,y,col:'#9fe8ff',life:16}); showToast('A wandering pedlar plies the road — fancy a trade?');
  } else if(t==='cache'){
    const[x,y]=aheadSpot(13); props.push({kind:'chest',x,y,opened:false,big:rand(0,1)<.4});
    for(let i=0;i<3;i++){ const m=MOB(pick(pool),x+rand(-3,3),y+rand(-3,3)); m.provoked=true; m.assistT=4; }
    pings.push({x,y,col:'#ffe066',life:24}); showToast('A guarded cache — fight through for the loot.');
  } else if(t==='wildshrine'){
    const[x,y]=aheadSpot(12); props.push({kind:'shrine',x,y,used:false});
    pings.push({x,y,col:'#c79bff',life:24}); showToast('A wild shrine hums in the open — a boon awaits the bold.');
  } else if(t==='swarm'){
    const[x,y]=aheadSpot(12); const n=5+Math.floor(rand(0,4));
    for(let i=0;i<n;i++){ const m=MOB('darter',x+rand(-4,4),y+rand(-4,4)); m.provoked=true; m.assistT=5; m.hp=Math.round(m.hp*0.7); m.maxHp=m.hp; }
    pings.push({x,y,col:'#ff6a8a',life:16}); showToast('A swarm rushes the road!');
  } else if(t==='duel'){
    const[x,y]=aheadSpot(15); const m=MOB(sig,x,y);
    makeElite(m, pick(['Frenzied','Titan','Shielded'])); m.provoked=true; m.smart=true; m.sight=999;
    m.hp=Math.round(m.hp*1.5); m.maxHp=m.hp; m.drop=(m.drop||5)+6;
    pings.push({x,y,col:'#ff5a5a',life:24}); showToast('A lone champion bars the way — face it.'); sfx('boss');
  }
}
const DASH_DUR=0.34;   // dash lasts the full special-dash animation (was a 0.16s blink)
function update(dt){
  if(!LEAN && (justPressed['KeyI']||justPressed['Tab']) && !paused && !devMode && phase==='explore'){   // inventory toggle (owns I/Tab; consumes the key so the suspend block can't re-close it the same frame)
    if(kitOpen){ if(kitHeld){ const _f=player.kit.indexOf(null); player.kit[_f>=0?_f:0]=kitHeld; kitHeld=null; saveRun(); } kitOpen=false; }
    else { kitOpen=true; kitAnim=0; mapOpen=false; codexOpen=false; kitSel=Math.min(kitSel,24); }
    delete justPressed['KeyI']; delete justPressed['Tab'];
  }
  if(freezeT>0){ freezeT-=dt; clearPressed(); return; } // hit-stop
  if(slowmoT>0){ slowmoT-=dt; dt*=0.45; }                // perfect-dodge graze slow-motion
  floorClock=(floorClock+dt/CLOCK_LEN)%1;                // advance the day-cycle (persists across floors)

  // title — choose a hero (1-4 or click a card) or continue (C)
  if(phase==='title'){
    // Settings is a single clean toggle that NEVER early-returns
    if(justPressed['KeyS']) homeSettings=!homeSettings;
    if(homeSettings){ if(justPressed['Escape']||justPressed['KeyS']) homeSettings=false;
      if(justPressed['KeyM']){ muted=!muted; try{ localStorage.setItem('tower_mute', muted?'1':'0'); }catch(e){} }
      if(justPressed['Minus']||justPressed['NumpadSubtract']) setZoom(ZOOM-0.1);
      if(justPressed['Equal']||justPressed['NumpadAdd']) setZoom(ZOOM+0.1);
      clearPressed(); return; }
    if(!heroSelect){
      // ----- LANDING: Play / Continue / Switch / Settings -----
      const goPlay=()=>{ heroSwap=false; heroSelect=true; };
      const menu=buildHomeMenu(); let act=null;
      if(justPressed['LMB']){ for(let i=0;i<menu.length;i++){ const it=menu[i], r=homeMenuRect(i,menu.length); if(mouseX>=r[0]&&mouseX<=r[0]+r[2]&&mouseY>=r[1]&&mouseY<=r[1]+r[3]){ act=it.act; break; } } }
      if(justPressed['Enter']||justPressed['NumpadEnter']||justPressed['Space']) act='play';
      if(justPressed['KeyC'] && hasSave()) act='continue';
      if(justPressed['KeyH'] && hasSave()) act='swap';
      if(act==='play') goPlay();
      else if(act==='continue' && hasSave()) continueRun();
      else if(act==='swap' && hasSave()){ heroSwap=true; heroSelect=true; }
      else if(act==='settings') homeSettings=true;
      clearPressed(); return;
    }
    // ----- HERO SELECT: pick 1-8 / click a card; Esc or Back returns to landing -----
    if(justPressed['Escape']){ heroSelect=false; heroSwap=false; clearPressed(); return; }
    if(justPressed['LMB']){ const r=heroBackRect(); if(mouseX>=r[0]&&mouseX<=r[0]+r[2]&&mouseY>=r[1]&&mouseY<=r[1]+r[3]){ heroSelect=false; heroSwap=false; clearPressed(); return; } }
    let picked=-1;
    for(let i=0;i<CLASSES.length;i++){ if(justPressed['Digit'+(i+1)]||justPressed['Numpad'+(i+1)]) picked=i; }
    if(justPressed['LMB']){ for(let i=0;i<CLASSES.length;i++){ const [x,y,cw,ch]=titleCardRect(i); if(mouseX>=x&&mouseX<=x+cw&&mouseY>=y&&mouseY<=y+ch) picked=i; } }
    if(picked>=0){ if(heroSwap && hasSave()){ heroSwap=false; heroSelect=false; continueAsHero(picked); }
      else { heroClass=CLASSES[picked]; reset(); startGame(); } }
    clearPressed(); return;
  }
  // win/restart
  if(phase==='win'){
    if(justPressed['KeyN']){ bankRun(); ngPlus++; killsBy={}; kills=0; coinCount=0; player.items=[]; player.kit=Array(25).fill(null); player.trinkets=[null,null,null]; player.bmTickets=0; player.kitCd=0; player.kitMagnetT=0; worldKit=[]; waypoint=null;
      player.stormT=0; player.shieldT=0; player.bulwarkT=0; player.stealthT=0; player.disguiseT=0; player.permitT=0; player.rageT=0; player.songT=0; player.comboN=0; player.comboTimer=0; player.abilCd=0; player.usedHermit=false; player.contract=null; player._relic=null; player._trinket=null; recomputeRelics(); recomputeTrinkets();   // clear transient buffs + per-climb one-shots (keep earned upgrades)
      projectiles=[]; eProjectiles=[]; shocks=[]; mortars=[]; dmgTexts=[]; particles=[]; bolts=[];
      player.runSeed=(Math.random()*0x7fffffff)>>>0;   // each ascension is a fresh layout, not a repeat of the last climb
      floor=1; buildFloor(1);
      player.lives=player.maxLives||player.lives||3;   // ascend with a full set of lives
      const[ex,ey]=entrance(); player.x=ex; player.y=ey; player.hp=player.maxHp; player.charge=0;
      phase='explore'; saveRun(); updateHint(); sfx('boss');
      showToast('ASCENSION '+ngPlus+' — the Tower remembers you, and sharpens.'); clearPressed(); return; }
    if(justPressed['KeyR']||justPressed['LMB']){ bankRun(); clearRun(); heroClass=null; reset(); } clearPressed(); return; }
  // death — the run ends; feats, echoes and the Cache endure
  if(phase==='dead'){
    if(justPressed['KeyR']||justPressed['Space']||justPressed['Enter']||justPressed['NumpadEnter']||justPressed['LMB']){ heroClass=null; reset(); }
    clearPressed(); return;
  }
  // ascend to next floor (or back out)
  if(phase==='ascend'){
    let pk=-1;
    if(justPressed['Digit1']||justPressed['Numpad1']) pk=0;
    else if(justPressed['Digit2']||justPressed['Numpad2']) pk=1;
    else if(justPressed['Digit3']||justPressed['Numpad3']) pk=2;
    else if(justPressed['LMB']){ const bw=Math.min(300,(W-120)/3),gap=22,total=3*bw+2*gap,x0=(W-total)/2,by=H/2+8,bh=150;
      for(let i=0;i<3;i++){ const x=x0+i*(bw+gap); if(mouseX>=x&&mouseX<=x+bw&&mouseY>=by&&mouseY<=by+bh){ pk=i; break; } } }
    if(pk>=0 && bargainPick<0){ bargainPick=pk;
      if(pk===0){ player.hp=player.maxHp; sfx('level'); }
      else if(pk===1){ const g=22+floor*6; coinCount+=g; sfx('coin'); }
      else { trialNext=true; sfx('boss'); dialogue=''; showToast('A Trial relic — '+grantItem(false)); }
      nextFloor(); clearPressed(); return; }
    if(justPressed['KeyA']||justPressed['ArrowLeft']||justPressed['KeyS']||justPressed['KeyW']){ phase='explore'; player.x-=3.5; player.iframe=.3; }
    clearPressed(); return;
  }
  // upgrade draft — pick 1/2/3 or click a card
  if(phase==='draft'){
    let pickI=-1;
    for(let i=0;i<draftCards.length;i++){ if(justPressed['Digit'+(i+1)]||justPressed['Numpad'+(i+1)]) pickI=i; }
    if(justPressed['LMB']){ const cw=240,gap=24,total=draftCards.length*cw+(draftCards.length-1)*gap,x0=(W-total)/2,y=H/2-70,ch=200;
      for(let i=0;i<draftCards.length;i++){ const x=x0+i*(cw+gap); if(mouseX>=x&&mouseX<=x+cw&&mouseY>=y&&mouseY<=y+ch) pickI=i; } }
    if(pickI>=0){ const _c=draftCards[pickI];
      if(_c.evo){ fuseEvolution(_c.E); }
      else { _c.f(); player.drafted=player.drafted||{}; player.drafted[_c.n]=(player.drafted[_c.n]||0)+1; sfx('level'); showToast('Gained: '+_c.n); }
      proceed(); }
    clearPressed(); return;
  }
  // pause / settings menu (Esc or P) — reached only during exploration
  if(justPressed['Minus']||justPressed['NumpadSubtract']) setZoom(ZOOM-0.1);   // — : wider view
  if(justPressed['Equal']||justPressed['NumpadAdd']) setZoom(ZOOM+0.1);          // = : closer view
  if(justPressed['KeyM'] && !paused && !kitOpen && !devMode && phase==='explore'){ mapOpen=!mapOpen; codexOpen=false; }
  if(justPressed['KeyB'] && !paused && !kitOpen && !devMode && phase==='explore'){ codexOpen=!codexOpen; mapOpen=false; }
  if(mapOpen){
    if(justPressed['LMB']){   // pin (or clear) a personal waypoint
      const s9=Math.min((W-200)/world.w,(H-190)/world.h), pw=world.w*s9, ph=world.h*s9, px0=(W-pw)/2, py0=(H-ph)/2+16;
      if(mouseX>=px0&&mouseX<=px0+pw&&mouseY>=py0&&mouseY<=py0+ph){
        const wx9=(mouseX-px0)/s9-world.hw, wy9=(mouseY-py0)/s9-world.hh;
        if(waypoint && len(waypoint.x-wx9,waypoint.y-wy9)<6){ waypoint=null; showToast('Waypoint cleared.'); }
        else { waypoint={x:wx9,y:wy9}; showToast('Waypoint pinned — follow the gold marker.'); } } }
    if(justPressed['Escape']) mapOpen=false; clearPressed(); return; }   // world stands still while you read the map
  if(codexOpen){ if(justPressed['Escape']) codexOpen=false; clearPressed(); return; }
  if(kitOpen){   // 5x4 inventory: hand row (0-4, quick-use 1-5) + bag (5-19); LMB drag to rearrange; suspends the world; always closeable
    const _closeKit=()=>{ if(kitHeld){ const f=player.kit.indexOf(null); player.kit[f>=0?f:0]=kitHeld; kitHeld=null; saveRun(); } kitOpen=false; };
    if(justPressed['Escape']||justPressed['KeyI']||justPressed['Tab']){ _closeKit(); clearPressed(); return; }
    let hov=-1; for(let i=0;i<25;i++){ const r=kitCellRect(i); if(mouseX>=r[0]&&mouseX<=r[0]+r[2]&&mouseY>=r[1]&&mouseY<=r[1]+r[2]){ hov=i; break; } }
    const col=kitSel%5,row=(kitSel/5)|0;
    if((justPressed['ArrowRight']||justPressed['KeyD'])&&col<4) kitSel++;
    if((justPressed['ArrowLeft']||justPressed['KeyA'])&&col>0) kitSel--;
    if((justPressed['ArrowDown']||justPressed['KeyS'])&&row<4) kitSel+=5;
    if((justPressed['ArrowUp']||justPressed['KeyW'])&&row>0) kitSel-=5;
    for(let d=1;d<=5;d++){ if(justPressed['Digit'+d]||justPressed['Numpad'+d]) useKitItem(d-1); }   // hand quick-use
    if(justPressed['LMB']){
      if(hov>=0){ if(kitHeld){ const tmp=player.kit[hov]; player.kit[hov]=kitHeld; kitHeld=tmp; kitSel=hov; saveRun(); }
                  else if(player.kit[hov]){ kitHeld=player.kit[hov]; player.kit[hov]=null; kitSel=hov; sfx('coin'); } }
      else { let done=false;
        for(let i=0;i<3;i++){ const gr=grimSlotRect(i); if(mouseX>=gr[0]-gr[2]&&mouseX<=gr[0]+gr[2]&&mouseY>=gr[1]-gr[2]&&mouseY<=gr[1]+gr[2]){
          if(kitHeld){ if(GRIMOIRE_MAP[kitHeld.key]){ const old=player.grimoire[i]; player.grimoire[i]=kitHeld.key; kitHeld=old?{key:old,q:1}:null; sfx('coin'); saveRun(); } }
          else if(player.grimoire&&player.grimoire[i]){ kitHeld={key:player.grimoire[i],q:1}; player.grimoire[i]=null; sfx('coin'); saveRun(); }
          done=true; break; } }
        if(!done) for(let i=0;i<3;i++){ const tr=trinketSlotRect(i); if(mouseX>=tr[0]-tr[2]&&mouseX<=tr[0]+tr[2]&&mouseY>=tr[1]-tr[2]&&mouseY<=tr[1]+tr[2]){ unequipTrinket(i); break; } } } }
    if((justPressed['KeyE']||justPressed['Enter']||justPressed['NumpadEnter']) && !kitHeld) useKitItem(hov>=0?hov:kitSel);
    if(justPressed['KeyX'] && !kitHeld) dropKitItem(hov>=0?hov:kitSel);
    clearPressed(); return;
  }
  // v199 LIVING CONVERSATIONS \u2014 a SOCIAL menu suspends the world so a feud can't resolve mid-talk
  if(choiceOpts && choiceNpc && choiceNpc._social){
    if(len(choiceNpc.x-player.x,choiceNpc.y-player.y)>3.0){ choiceNpc._social=false; choiceOpts=null; choiceNpc=null; dialogue=''; }
    else {
      for(let i=0;i<choiceOpts.length;i++){ if(justPressed['Digit'+(i+1)]||justPressed['Numpad'+(i+1)]){ const o=choiceOpts[i]; choiceOpts=null; if(o) o.f(); break; } }
      if(justPressed['Escape']){ if(choiceNpc) choiceNpc._social=false; choiceOpts=null; choiceNpc=null; dialogue=''; }
    }
    clearPressed(); return;
  }
  if(justPressed['Escape']||justPressed['KeyP']) paused=!paused;
  if(paused){
    if(justPressed['KeyM']){ muted=!muted; try{ localStorage.setItem('tower_mute', muted?'1':'0'); }catch(e){} }
    if(justPressed['KeyC']){ devMode=!devMode; showToast(devMode?'⚙ CREATOR MODE ON':'⚙ creator mode off'); }   // IME-proof fallback
    if(justPressed['KeyR']){ paused=false; clearRun(); heroClass=null; reset(); }   // back to the home screen — pick any hero
    if(justPressed['LMB']) paused=false;
    clearPressed(); return;
  }

  // ----- CREATOR MODE — ` or F9 (some keyboard layouts/IMEs swallow backtick; F9 always works) -----
  if(justPressed['Backquote']||justPressed['IntlBackslash']||justPressed['F9']){ devMode=!devMode; showToast(devMode?'⚙ CREATOR MODE ON':'⚙ creator mode off'); }
  if(devMode){
    if(justPressed['KeyN']){ clearPressed(); nextFloor(); return; }                       // skip to next floor
    if(justPressed['BracketRight']||justPressed['PageUp']){ clearPressed(); creatorJumpFloor(floor+1); return; }
    if(justPressed['BracketLeft']||justPressed['PageDown']){ clearPressed(); creatorJumpFloor(floor-1); return; }
    for(let d=0; d<=9; d++){ if(!choiceOpts && justPressed['Digit'+d]){ const f=d===0?10:d; clearPressed();   // jump straight to floor 1-10
      creatorJumpFloor(f); return; } }
    if(justPressed['KeyB']){ exit.open=true; bossDead=true; championsList.forEach(c=>c.resolved=true); showToast('⚙ stair unlocked'); }
    if(justPressed['KeyK']){ for(const s of [...mobs]){ if(!s.isGate && !s.champion) killMob(s); } showToast('⚙ field cleared'); }
    if(justPressed['KeyG']){ coinCount+=200; for(let i=0;i<3;i++) gainXP(player.xpNext); showToast('⚙ riches + levels'); }
    if(justPressed['KeyH']){ player.hp=player.maxHp; showToast('⚙ healed'); }
    if(justPressed['KeyU']){ player.charge=player.maxMana; showToast('⚙ ultimate ready'); }
    if(justPressed['KeyT']){ player.x=exit.x-4; player.y=exit.y; player.iframe=1; showToast('⚙ teleported to stair'); }
    if(justPressed['KeyY']){ creatorWarpObjective(); }
    if(justPressed['KeyL']){ creatorRevealFloor(); }
    if(justPressed['KeyI']){ player.god=!player.god; showToast('⚙ god mode '+(player.god?'ON':'off')); }
    if(justPressed['KeyO']){ player.devPow=!player.devPow; showToast('⚙ overpower ×25 '+(player.devPow?'ON':'off')); }
    if(justPressed['KeyV']){ player.devFast=!player.devFast; showToast('⚙ super speed '+(player.devFast?'ON':'off')); }
    if(justPressed['KeyJ']){ if(player.quest && !player.quest.done){ player.quest.accepted=true; player.quest.progress=player.quest.target; questComplete(); showToast('⚙ quest force-completed'); } }
    if(justPressed['KeyX']){ if(operation && !operation.done) completeOperation('creator override'); else showToast('⚙ no active operation'); }
  }
  if(player.god) player.hp=player.maxHp;   // invincible while god mode holds

  // movement (+ dash)
  // v203 QUICK-BELT — satchel slots 0-4 on FREE keys 1-5 (after devMode so creator-mode owns digits; !choiceOpts so a vendor menu's digit-pick isn't double-fired)
  if(phase==='explore' && !paused && !kitOpen && !devMode && !choiceOpts){ for(let d=1; d<=5; d++){ if(justPressed['Digit'+d]||justPressed['Numpad'+d]) useKitItem(d-1); } }
  let ix=(down('KeyD','ArrowRight')?1:0)-(down('KeyA','ArrowLeft')?1:0);
  let iy=(down('KeyS','ArrowDown')?1:0)-(down('KeyW','ArrowUp')?1:0);
  const m=len(ix,iy); if(m>0){ ix/=m; iy/=m; } player.moving=m>0;
  // MOUSE LOOK-AHEAD: ease the camera toward the cursor once it passes a dead radius, so a close zoom still sees ahead
  { let tpx=0, tpy=0;
    if(mouseActive && (phase==='explore'||phase==='boss')){
      const rx=mouseX-W/2, ry=mouseY-H/2, rl=len(rx,ry), dead=Math.min(W,H)*0.085;
      if(rl>dead){ const t=Math.min(1,(rl-dead)/(Math.min(W,H)*0.42)), mag=Math.min(W,H)*0.20*t; tpx=-(rx/rl)*mag; tpy=-(ry/rl)*mag; }
    }
    const lk=Math.min(1,dt*8); camPeekX+=(tpx-camPeekX)*lk; camPeekY+=(tpy-camPeekY)*lk;
  }
  // AIM (fx/fy) always tracks the cursor so attacks fire toward it; with no mouse it follows the walk dir
  // (subtract the peek so aim still points exactly at the cursor once the hero slides off-centre)
  if(mouseActive){ const ax=mouseX-W/2-camPeekX, ay=mouseY-H/2-camPeekY, al=len(ax,ay); if(al>6){ player.fx=ax/al; player.fy=ay/al; } }
  else if(m>0){ player.fx=ix; player.fy=iy; }
  // VISUAL facing: look where you WALK; snap to the aim only for the brief window of an attack, then resume
  player.faceLock=Math.max(0,(player.faceLock||0)-dt);
  if(player.faceLock>0){ player.faceX=player.fx; player.faceY=player.fy; }
  else if(m>0){ player.faceX=ix; player.faceY=iy; }
  if(player.faceX===undefined){ player.faceX=player.fx; player.faceY=player.fy; }
  player.dashCd-=dt; player.dashT-=dt; player.iframe-=dt;
  if(justPressed['ShiftLeft']||justPressed['ShiftRight']){ if(player.dashCd<=0 && player.stamina>=25){ player.stamina-=25; player.dashT=DASH_DUR; player.dashCd=player.dashCdBase; player.iframe=DASH_DUR+.04; sfx('dash'); } }   // dash runs the full spin animation
  if(player.kitCd>0) player.kitCd-=dt; if(player.kitMagnetT>0) player.kitMagnetT-=dt;
  player.slowT=Math.max(0,player.slowT-dt); player.buffT=Math.max(0,(player.buffT||0)-dt);
  if(player.regenT>0){ player.regenT-=dt; player.hp=Math.min(player.maxHp, player.hp+1.5*dt); }
  let spd=player.speed*(player.dashT>0?2.55:1)*(player.slowT>0?0.55:1)*(player.buffT>0?1.18:1)*(player.devFast?2.6:1)*(player.hp<player.maxHp*.3?1.08:1)*(player.songT>0?1.08:1)*(player.rageT>0?1.35:1)*wSelfSpeed();
  { const z=inSafe(player.x,player.y); if(z&&z.heal&&player.hp<player.maxHp) player.hp=Math.min(player.maxHp, player.hp+4*dt); }   // inns mend the resting
  for(const fl of floors){ if(fl.spring && Math.abs(player.x-fl.x)<fl.w/2 && Math.abs(player.y-fl.y)<fl.h/2){ if(player.hp<player.maxHp) player.hp=Math.min(player.maxHp,player.hp+3*dt); break; } }   // hot springs soothe
  // VOLATILE HAZARDS: kegs explode when struck/ignited; oil slicks ignite and burn the ground
  for(const p of props){
    if(p.kind==='powderkeg' && !p.boom){
      if(p.fuse!=null){ p.fuse-=dt; burst(p.x,p.y-0.5,[255,210,120],1,1); if(p.fuse<=0){ detonateKeg(p); continue; } }
      let trig=false;
      for(const sl of slashes){ if(len(sl.x-p.x,sl.y-p.y)<(sl.reach||1.6)+0.5){ trig=true; break; } }
      if(!trig) for(const pr of projectiles){ if(len(pr.x-p.x,pr.y-p.y)<0.7){ trig=true; pr.life=0; break; } }
      if(!trig && p.fuse==null){ for(const o of mobs){ if(o.burnT>0 && !o.friendly && o.type!=='nest' && len(o.x-p.x,o.y-p.y)<1.2){ p.fuse=.3; break; } } }
      if(trig) detonateKeg(p);
    } else if(p.kind==='oilslick' && !p.boom){
      if(!(p.lit>0)){
        let fire=false;
        for(const o of mobs){ if(o.burnT>0 && !o.friendly && o.type!=='nest' && len(o.x-p.x,o.y-p.y)<1.5){ fire=true; break; } }
        if(!fire) for(const sh of shocks){ if(sh.col && sh.col[0]>=200 && sh.col[2]<120 && len(sh.x-p.x,sh.y-p.y)<(sh.maxR||1)+0.8){ fire=true; break; } }
        if(fire && !wOn('rain')) igniteOil(p);
      } else { p.lit-=dt;
        if(rand(0,1)<0.5) burst(p.x+rand(-0.7,0.7),p.y+rand(-0.4,0.4),[255,170,60],1,1.5);
        for(const o of mobs){ if(o.friendly||o.type==='nest'||o.hp<=0) continue; if(len(o.x-p.x,o.y-p.y)<1.7){ o.burnT=Math.max(o.burnT||0,1.6); o.burnDps=Math.max(o.burnDps||0,PDMG()*0.10); tryReact(o,'burn'); } }
        if(player.iframe<=0 && player.dashT<=0 && len(player.x-p.x,player.y-p.y)<1.7) hurtPlayer(7*dt, player.x, player.y, {soft:true});
        if(p.lit<=0) p.boom=true;
      }
    }
  }
  // ---- Destructible walls: strike a cracked wall to break it open ----
  { let toBreak=null;
    for(const wl of walls){ if(!wl.crack && !wl.brk) continue;
      if(wl.hitFlash>0) wl.hitFlash-=dt;
      if(wl.hitCd>0){ wl.hitCd-=dt; continue; }
      let hit=false, dmg=0; const pad=wl.brk?0.25:1.0;
      for(const sl of slashes){ if(len(sl.x-wl.x,sl.y-wl.y)<(sl.reach||1.6)+pad){ hit=true; dmg=Math.max(dmg, PDMG()*0.6+8); } }
      if(!hit) for(const pr of projectiles){ if(len(pr.x-wl.x,pr.y-wl.y)<(wl.brk?0.9:1.2)){ hit=true; dmg=Math.max(dmg,(pr.dmg||10)); pr.life=0; } }
      if(hit){ wl.hp-=dmg; wl.hitCd=0.16; wl.hitFlash=0.25; burst(wl.x,wl.y,[190,160,120],4,2.4); sfx('hit'); if(wl.hp<=0){ (toBreak||(toBreak=[])).push(wl); } }
    }
    if(toBreak) for(const w9 of toBreak) breakWall(w9);
  }
  for(const fl of floors){ if(fl.hazard && Math.abs(player.x-fl.x)<fl.w/2 && Math.abs(player.y-fl.y)<fl.h/2){
    if(player.dashT<=0 && player.iframe<=0){ hurtPlayer((fl.hazard==='void'?6:9)*dt, player.x, player.y, {soft:true});
      if(rand(0,1)<.12) burst(player.x,player.y, fl.hazard==='void'?[180,110,255]:[255,140,40], 2, 1.6);
      if(fl.hazard==='void') player.slowT=Math.max(player.slowT,.25); }
    break; } }
  for(const fl of floors){ if(fl.water && Math.abs(player.x-fl.x)<fl.w/2 && Math.abs(player.y-fl.y)<fl.h/2){ spd*=0.6; break; } } // wading through water
  player.x+=ix*spd*dt; player.y+=iy*spd*dt;
  if(player.dashT>0) burst(player.x,player.y,[120,180,255],1,1);
  collideWalls(player);

// open conversation menu: pick with 1-3, walk away to close
  if(choiceOpts && !(choiceNpc && choiceNpc._social)){   // v199: SOCIAL menus are handled in the suspend block above; this stays for non-pausing vendor menus
    if(!choiceNpc || len(choiceNpc.x-player.x,choiceNpc.y-player.y)>3.0){ choiceOpts=null; choiceNpc=null; }
    else for(let i=0;i<choiceOpts.length;i++){ if(justPressed['Digit'+(i+1)]||justPressed['Numpad'+(i+1)]){ const o=choiceOpts[i]; choiceOpts=null; o.f(); break; } }
  }

    // ULTIMATE (Q) — each class unleashes its own signature
  if(justPressed['KeyQ'] && player.charge>=player.maxMana){
    player.charge=0; sfx('boss'); addShake(.7); player.iframe=Math.max(player.iframe,.35);
    showToast(ULT_NAMES[player.weaponKey]+'!');
    (ULTS[player.weaponKey]||ULTS.Mage)();
  }
  // 3.0 resource regen: stamina refills fully; mana regens passively only to a soft cap (the rest is earned in combat for the ult)
  player.stamina=Math.min(player.maxStamina, (player.stamina||0)+player.staRegen*dt);
  { const msc=player.maxMana*0.6; if(player.charge<msc) player.charge=Math.min(msc, player.charge+player.manaRegen*dt); }

  // attack
  player.atkCd-=dt; player.atkFlash=Math.max(0,player.atkFlash-dt); player.hurtFlash=Math.max(0,player.hurtFlash-dt); player.shootFlash=Math.max(0,(player.shootFlash||0)-dt); player.attackAnimT=Math.max(0,(player.attackAnimT||0)-dt); player.hitAnimT=Math.max(0,(player.hitAnimT||0)-dt);
  player.pdCd=Math.max(0,(player.pdCd||0)-dt); player.riposteT=Math.max(0,(player.riposteT||0)-dt); player.shieldT=Math.max(0,(player.shieldT||0)-dt);
  if(player.res&&player.res.frost){ const f=player.res.frost*0.18; player.atkCd=Math.max(0,player.atkCd-dt*f); player.rangedCd=Math.max(0,player.rangedCd-dt*f); player.dashCd=Math.max(0,player.dashCd-dt*f); player.abilCd=Math.max(0,(player.abilCd||0)-dt*f); }
  if((player.house==='magic'||player.house==='vael')){ const hf=player.arcMaster?0.30:0.16; player.atkCd=Math.max(0,player.atkCd-dt*hf); player.rangedCd=Math.max(0,player.rangedCd-dt*hf); player.dashCd=Math.max(0,player.dashCd-dt*hf); player.abilCd=Math.max(0,(player.abilCd||0)-dt*hf); }   // Arcane patronage
  player.abilCd=Math.max(0,(player.abilCd||0)-dt); if(player.grimCd){ for(let _g=0;_g<3;_g++) player.grimCd[_g]=Math.max(0,(player.grimCd[_g]||0)-dt); } player.bulwarkT=Math.max(0,(player.bulwarkT||0)-dt); player.stealthT=Math.max(0,(player.stealthT||0)-dt); player.disguiseT=Math.max(0,(player.disguiseT||0)-dt); player.permitT=Math.max(0,(player.permitT||0)-dt); player.rageT=Math.max(0,(player.rageT||0)-dt);
  if(player.disguiseT>0 && wantedT>0) wantedT=Math.max(0,wantedT-dt*1.5);
  player.comboTimer-=dt; if(player.comboTimer<=0) player.comboN=0; player.comboPop=Math.max(0,(player.comboPop||0)-dt);
  chainBudget=CHAIN_FRAME_CAP; _chainDepth=0;   // refill per-frame detonation budget; reset re-entrancy guard
  if(chainTimer>0){ chainTimer-=dt; if(chainTimer<=0) chainN=0; } chainPop=Math.max(0,chainPop-dt);
  if(player.relicsTick && player.relicsTick.length) for(const r of player.relicsTick) r.tick(dt);
  kickX*=Math.pow(.001,dt); kickY*=Math.pow(.001,dt); flashT=Math.max(0,flashT-dt); fadeT=Math.max(0,fadeT-dt*1.25);
  for(let w9=0; w9<3 && warmQ.length; w9++){ const it=warmQ.shift();   // pre-scale newly loaded art off the hot path
    const k9=it.key||'';
    const h9 = k9.startsWith('boss')?125 : k9.startsWith('champ')?115 : k9.startsWith('deco_tree')?113 : k9.startsWith('deco')?60 : k9.startsWith('prop')?70 : 50;
    try{ spriteFor(it.im, h9); }catch(e){} }
  if(!restricted.length && wantedT>0){ wantedT-=dt*0.5; if(wantedT<=0) showToast('The Watch lets it go. Behave.'); }
  if(player.hp<player.maxHp*.3 && !player.adrenWas){ player.adrenWas=true; showToast('ADRENALINE!'); }
  else if(player.hp>=player.maxHp*.4) player.adrenWas=false;
  if(devMode && justPressed['LMB']){   // creator hack: click the minimap to teleport
    const mw9=170, mh9=mw9*(world.h/world.w), mx9=W-mw9-16, my9=52;
    if(mouseX>=mx9 && mouseX<=mx9+mw9 && mouseY>=my9 && mouseY<=my9+mh9){
      const wx9=((mouseX-mx9)/mw9)*world.w - world.hw, wy9=((mouseY-my9)/mh9)*world.h - world.hh;
      player.x=Math.max(-WORLD_HW+2,Math.min(WORLD_HW-2,wx9)); player.y=Math.max(-WORLD_HH+2,Math.min(WORLD_HH-2,wy9));
      for(let t9=0;t9<60 && inWall(player.x,player.y,player.r);t9++){ player.x+=rand(-1.6,1.6); player.y+=rand(-1.6,1.6); }
      player.iframe=Math.max(player.iframe,.6); justPressed['LMB']=false; sfx('dash');
      burst(player.x,player.y,[150,200,255],16,4); showToast('⚙ warped');
    } }
  if(justPressed['Space']||justPressed['LMB']) primaryAttack();
  if(player.comboT>0){ player.comboT-=dt; if(player.comboT<=0 && player.comboW){ meleeSwing(player.comboW,.85); player.atkFlash=Math.max(player.atkFlash,.10); player.comboW=null; } }
  if(player.stormT>0){ player.stormT-=dt; player.stormTick-=dt; if(player.stormT<=0){ player.stormKind=null; }          // ARROW STORM: auto-volley nearest threat
    if(player.stormTick<=0){ player.stormTick=.09;
      let best=null,bd=144; for(const s of mobs){ if(s.friendly||s.type==='nest') continue; const d2=(s.x-player.x)*(s.x-player.x)+(s.y-player.y)*(s.y-player.y); if(d2<bd){ bd=d2; best=s; } }
      if(player.stormKind==='cards'){ const a=(player.stormN=(player.stormN||0)+1)*2.39996;   // golden-angle fan: even sweep
        for(let cc=0;cc<2;cc++){ const a2=a+cc*3.14159;
          projectiles.push({ x:player.x+Math.cos(a2)*.5, y:player.y+Math.sin(a2)*.5, vx:Math.cos(a2)*14, vy:Math.sin(a2)*14, life:1.0, dmg:Math.round(PDMG()*0.7), col:[255,255,255], r:.15, proj:'knife', pierce:1, ang:a2 }); }
        player.stormTick=.03; }
      else if(best){ const a=Math.atan2(best.y-player.y,best.x-player.x);
        projectiles.push({ x:player.x+Math.cos(a)*.5, y:player.y+Math.sin(a)*.5, vx:Math.cos(a)*16, vy:Math.sin(a)*16, life:1.1, dmg:Math.round(PDMG()*0.7), col:[255,228,130], r:.16, proj:'arrow', pierce:1, ang:a });
        if(((player.stormN=(player.stormN||0)+1)%3)===0) sfx('shoot'); } } }
  // ---- discovery: stumbling onto a structure names it, marks the map, grants XP ----
  for(const poi of poiList){ if(poi.found) continue;
    if(len(player.x-poi.x, player.y-poi.y)<9){ poi.found=true;
      gainXP(5+floor*2); sfx('coin');
      pings.push({x:poi.x,y:poi.y,col:poi.arena?'#ffd34d':'#9fd6ff',life:9999});
      showToast('✦ Discovered: '+poi.name+' (+XP)');
      if(poi.reward){ const rw=poi.reward;                                  // some places pay more than XP
        if(rw.coin) dropCoins(poi.x,poi.y,rw.coin);
        if(rw.buff) player.buffT=Math.max(player.buffT||0,rw.buff);
        if(rw.charge) player.charge=Math.min(player.maxMana,player.charge+rw.charge);
        if(rw.heal) player.hp=Math.min(player.maxHp,player.hp+rw.heal);
        if(rw.msg) showToast(rw.msg); }
      if(poi.arena){ exit.found=true; } } }
  if(exit && !exit.found && !exit.hinted && floorAge>45){ exit.hinted=true;
    const dxh=exit.x-player.x, dyh=exit.y-player.y;
    const dirh=(Math.abs(dxh)>Math.abs(dyh))?(dxh>0?'EAST':'WEST'):(dyh>0?'SOUTH':'NORTH');
    showToast('The Herald calls out: "The stair lies somewhere '+dirh+' of you!"'); }
  if(exit && !exit.found && len(player.x-exit.x,player.y-exit.y)<13) exit.found=true;
  if(waypoint && len(player.x-waypoint.x,player.y-waypoint.y)<3){ waypoint=null; showToast('Waypoint reached.'); burst(player.x,player.y,[255,210,90],10,3); }
  // ---- the FLOOR WARDEN: linger too long and the floor sends its hunter ----
  floorAge+=dt;
  if(!wardenSpawned && floorAge>75 && floor>=2 && floor<10 && phase==='explore'){
    wardenSpawned=true;
    const a=rand(0,6.28); let wx=player.x+Math.cos(a)*16, wy=player.y+Math.sin(a)*16;
    wx=Math.max(-WORLD_HW+3,Math.min(WORLD_HW-3,wx)); wy=Math.max(-WORLD_HH+3,Math.min(WORLD_HH-3,wy));
    const w=MOB(realm.sig||pick(realm.pool), wx, wy);
    makeElite(w,'Frenzied'); w.warden=true; w.elite='Warden'; w.eliteCol=[255,70,90];
    w.hp=Math.round(w.hp*2.2); w.maxHp=w.hp; w.sight=999; w.smart=true; w.provoked=true; w.speed*=1.12;
    w.bossName='THE FLOOR WARDEN';
    bossIntroT=2.4; bossIntroName='THE FLOOR WARDEN'; bossIntroSub='it has your scent — slay it or climb';
    showToast('The floor stirs... its Warden hunts you.'); sfx('boss'); addShake(.4);
  }

  // ===================== ENCOUNTER DIRECTOR =====================
  // never let the climber walk far in silence — stage something interesting in their path
  if(phase==='explore' && floorAge>4 && !inSafe(player.x,player.y)){
    let moved=len(player.x-encLastX, player.y-encLastY); encLastX=player.x; encLastY=player.y; if(moved>5) moved=0;   // ignore teleports
    const threat=mobs.some(m=>!m.friendly && !m.peaceful && !m.warFac && m.type!=='nest' && (m.coinwraith || (m.provoked && len(m.x-player.x,m.y-player.y)<11) || len(m.x-player.x,m.y-player.y)<7));
    encCd-=dt;
    if(!threat) encDist+=moved;
    if(encDist>14 && encCd<=0 && !threat){ encDist=0; encCd=rand(4,7); const _em0=mobs.length; stageEncounter();
      for(let i9=_em0;i9<mobs.length;i9++){ const m9=mobs[i9]; if(!m9.friendly && onRoad(m9.x,m9.y,0.4)){ const sp9=offRoad(m9.x,m9.y); m9.x=sp9[0]; m9.y=sp9[1]; } } }
  }
  // ---- Event Director: one floor-scale world event with its own clock ----
  if(phase==='explore' && floorAge>5 && !realm.special){
    eventCd-=dt;
    if(eventCd<=0 && worldEvents.filter(e=>!e.done).length < 1){ eventCd=80+rand(0,50); stageWorldEvent(); }
    for(const e of worldEvents){ if(e.done) continue; e.t-=dt;
      if(e.kind==='raid'){
        for(const m of e.foes){ if(m && m.hp>0 && !m.provoked && len(m.x-player.x,m.y-player.y)<13) m.provoked=true; }
        const alive=e.foes.filter(m=>m && m.hp>0 && !m.dead && mobs.includes(m));
        if(alive.length===0) resolveEvent(e,true); else if(e.t<=0) resolveEvent(e,false);
      } else if(e.kind==='worldboss'){
        const m=e.boss;
        if(!m || m.hp<=0 || m.dead || !mobs.includes(m)){ e.done=true; for(const p of pings){ if(p.evId===e.id) p.life=0; } continue; }
        if(len(m.x-player.x,m.y-player.y)<15) m.provoked=true;
      }
    }
  }
  // ---- Incident Director: contained NPC-vs-NPC feuds (staging is explore-only) ----
  if(phase==='explore' && floorAge>6 && !realm.special && !bloodMoon){
    incidentCd-=dt;
    if(incidentCd<=0 && incidents.filter(e=>!e.done).length < INCIDENT_CAP){ incidentCd=95+rand(0,55); stageIncident(); }
  }
  if(incidents.length){   // countdown + resolution run EVERY frame so a feud always ends, even mid boss-phase
    for(const e of incidents){ if(e.done) continue; e.t-=dt;
      const aliveA=e.sideA.filter(m=>m && m.hp>0 && m.warFac && mobs.includes(m)).length;
      const aliveB=e.sideB.filter(m=>m && m.hp>0 && m.warFac && mobs.includes(m)).length;
      if(e.t>0 && aliveA && aliveB){
        for(const m of e.sideA){ if(m && m.hp>0 && m.warFac && (m.warAgg||0)<=0 && len(m.x-e.x,m.y-e.y)<18) m.warAgg=2; }
        for(const m of e.sideB){ if(m && m.hp>0 && m.warFac && (m.warAgg||0)<=0 && len(m.x-e.x,m.y-e.y)<18) m.warAgg=2; }
      }
      const broken = aliveA>0 && aliveB>0 && Math.min(aliveA,aliveB)<=1 && Math.abs(aliveA-aliveB)>=2;   // v196: a routed side breaks before total annihilation
      if(aliveA===0 || aliveB===0 || e.t<=0 || broken) resolveIncident(e, aliveA, aliveB);
    }
  }
  // ---- Trial Obelisk: escalating arena waves; clear all three for a relic ----
  if(obeliskTrial){
    const T=obeliskTrial; T.waveT=(T.waveT||0)+dt;
    for(const m of T.foes){ if(m && m.hp>0 && !m.provoked) m.provoked=true; }
    let alive=T.foes.filter(m=>m && m.hp>0 && !m.dead && mobs.includes(m));
    if(alive.length && T.waveT>45){ for(const m of alive){ m.hp=0; mobs=mobs.filter(x=>x!==m); } burst(player.x,player.y,[160,160,200],14,4); alive=[]; }   // anti-softlock: abandon unreachable foes
    if(alive.length===0){
      if(T.wave>=3){ const p=T.prop; if(p) p.used=true;
        burst(player.x,player.y,[255,220,120],44,7); sfx('win'); addShake(.45); flashT=Math.max(flashT||0,.05);
        coinCount+=40+floor*6; dropCoins(player.x,player.y,12); player.charge=Math.min(player.maxMana,player.charge+25);
        showToast('⟁ Trial conquered! '+grantRelic(true)); obeliskTrial=null;
      } else obeliskNextWave();
    }
  }
  // rescued souls thank their saviour once their attackers are dead
  for(const n of npcs){ if(!n.rescue) continue;
    const danger=mobs.some(m=>!m.friendly && !m.peaceful && len(m.x-n.x,m.y-n.y)<11);
    if(!danger){ n.rescue=false; n.scaredT=0;
      const rw=14+floor*3; dropCoins(n.x,n.y,rw); gainXP(12); sfx('level'); burst(n.x,n.y,[255,225,120],18,4);
      if(n.emoteT<=0){ n.emote='\u2665'; n.emoteT=2; }
      showToast('Saved! \u201CBless you, climber.\u201D (+'+rw+' coins, +XP)'); } }

  // ranged attack (unlocked at level 2)
  player.rangedCd-=dt;
  if(justPressed['KeyF']) secondaryAttack();   // F keeps the old secondary; RMB is now the class skill
  for(const pr of projectiles){
    pr.x+=pr.vx*dt; pr.y+=pr.vy*dt; pr.life-=dt;
    for(const s of mobs){ if(s.hp>0 && !s.friendly && len(s.x-pr.x,s.y-pr.y)<s.r+(pr.r||.18)){
        if(pr.hitset && pr.hitset.indexOf(s)>=0) continue;
        dealDamage(s, pr.dmg, {ang:pr.ang, kind:pr.kind||'physical'});
        applyStatus(s); provoke(s); player.charge=Math.min(player.maxMana,player.charge+2*player.chargeMul*comboChargeMul()); burst(pr.x,pr.y,pr.col||[127,255,255],4,2,pr.ang);
        if((pr.pierce|0)>0){ pr.pierce--; (pr.hitset=pr.hitset||[]).push(s); } else { pr.life=0; break; }
      } }
    if(pr.life>0) for(const n of npcs){ if(len(n.x-pr.x,n.y-pr.y)<(n.r||.5)+(pr.r||.18)){ hitNPC(n, pr.dmg); pr.life=0; break; } }
    if(pr.life>0) for(const wl of walls){ if(Math.abs(pr.x-wl.x)<wl.w/2 && Math.abs(pr.y-wl.y)<wl.h/2){ pr.life=0; break; } }
  }
  projectiles=projectiles.filter(p=>p.life>0);

  // mortar shells fall where they were aimed
  for(const mo of mortars){ if(mo.max===undefined) mo.max=mo.t; mo.t-=dt;
    if(mo.t<=0){ const mc=mo.col||[255,150,60], big=mo.r>4;
      shocks.push({x:mo.x,y:mo.y,r:.2,maxR:mo.r,life:big?.85:.35,max:big?.85:.35,dmg:mo.dmg,hit:false,col:mc});
      burst(mo.x,mo.y,mc,big?26:12,big?6:4); sfx('boss'); } }
  mortars=mortars.filter(m=>m.t>0);
  // ambush mounds: rustle, then erupt
  for(const p of props){ if(p.kind!=='mound' || p.sprung) continue;
    const d=len(player.x-p.x,player.y-p.y);
    if(p.shakeT>0){ p.shakeT-=dt;
      if(p.shakeT<=0){ p.sprung=true; burst(p.x,p.y,[150,110,70],22,5); addShake(.3); sfx('boss');
        for(let i=0;i<3;i++){ const m=MOB(pick(realm.pool), p.x+rand(-1,1), p.y+rand(-1,1)); m.provoked=true; m.assistT=4; }
        showToast('Ambush!'); } }
    else if(d<2.3){ p.shakeT=.6; sfx('dash'); } }
  for(const pg of pings) pg.life-=dt; pings=pings.filter(p=>p.life>0);
  // mobs (snapshot so spawns/removals mid-loop are safe)
  for(const s of [...mobs]){
    if(s.hp<=0) continue;
    // elemental status ticks (burn / poison damage over time, frost slow)
    if(s.reactCd>0) s.reactCd-=dt;
    if(s.emoteT>0) s.emoteT-=dt;   // mob speech bark fades
    if(s.warded>0) s.warded-=dt;   // protection from a Warding elite fades
    if(s.elite){   // ---- elite affix behaviours ----
      if(s.regen && s.hp>0 && s.hp<s.maxHp) s.hp=Math.min(s.maxHp, s.hp+s.maxHp*0.05*dt);
      if(s.warding){ s.wardCd=(s.wardCd||0)-dt; if(s.wardCd<=0){ s.wardCd=2.5; let any=false;
        for(const o of mobs){ if(o===s||o.friendly||o.type==='nest'||o.hp<=0) continue; if(len(o.x-s.x,o.y-s.y)<5.5){ o.warded=2.6; any=true; } }
        if(any) burst(s.x,s.y,[140,255,210],10,3); } }
      if(s.summoner && s.provoked){ s.sumCd=(s.sumCd==null?rand(3,6):s.sumCd)-dt; if(s.sumCd<=0){ s.sumCd=rand(5,8);
        if(mobs.length<88){ const mm=MOB(pick(realm.pool||['slime']), s.x+rand(-1.2,1.2), s.y+rand(-1.2,1.2)); if(mm){ mm.provoked=true; mm.r*=0.85; mm.hp=Math.round(mm.maxHp*0.6); mm.maxHp=mm.hp; mm.summoned=true; burst(s.x,s.y,[200,120,255],10,3); } } } }
    }
    if(s.burnT>0){ s.burnT-=dt; const bd=(s.burnDps||4)*dt*wBurnMul(); s.hp-=(s.gate?Math.min(bd,s.gate):bd); if(rand(0,1)<.25) burst(s.x,s.y,[255,140,40],1,1.2); if(s.hp<=0){ if(s.warFac) skirmishKill(s); else killMob(s); continue; } }
    if(s.poisonT>0){ s.poisonT-=dt; const vd=(s.poisonDps||3)*dt; s.hp-=(s.gate?Math.min(vd,s.gate):vd); if(rand(0,1)<.2) burst(s.x,s.y,[120,220,90],1,1); if(s.hp<=0){ if(s.warFac) skirmishKill(s); else killMob(s); continue; } }
    if(s.dotAcc>0){ s.dotFlushT=(s.dotFlushT||0)-dt; if(s.dotFlushT<=0){ s.dotFlushT=.5; pushDmgText(s.x,s.y-s.r,Math.round(s.dotAcc)||1,'dot'); s.dotAcc=0; } }
    if(s.eSlowT>0) s.eSlowT-=dt;
    s.hitFlash=Math.max(0,s.hitFlash-dt); s.touchCd=Math.max(0,s.touchCd-dt); s.bob+=dt*8; if(s.markT>0) s.markT-=dt;
    const dpx=player.x-s.x, dpy=player.y-s.y, dist=len(dpx,dpy)||1;
    // docile = peaceful elf / neutral Upper Being / befriended champion — wanders, never hunts
    const docile = s.friendly || ((s.peaceful||s.neutralC) && !s.provoked);
    const pSafe = inSafe(player.x,player.y);          // player inside a town/city/inn — off-limits
    const mZone = inSafe(s.x,s.y);                    // mob strayed into a safe zone — leave
    const pCover = (player.stealthT||0)>0 || (((player.disguiseT||0)>0 || (player.permitT||0)>0) && (s.warden||s.districtGuard||s.hostileNpc||s.watch));
    if(s.assistT>0) s.assistT-=dt;                    // pack memory of where you are
    if(s.fleeT>0) s.fleeT-=dt;
    let dx,dy;
    if(s.minion){ s.lifeT=(s.lifeT||20)-dt; if(s.lifeT<=0){ burst(s.x,s.y,[160,255,200],10,2.5); mobs=mobs.filter(x=>x!==s); continue; } }
    if(s.allyT!=null){ s.allyT-=dt; if(s.allyT<=0){ burst(s.x,s.y,[150,200,255],10,2.5); mobs=mobs.filter(x=>x!==s); continue; } }   // v196: time-limited feud ally
    if(s.afRout){ if(s.fleeT>0){ const fl=len(s.x-s.fleeX,s.y-s.fleeY)||1; const mv=s.speed*1.1*dt; s.x+=(s.x-s.fleeX)/fl*mv; s.y+=(s.y-s.fleeY)/fl*mv; collideWalls(s); s.moving=true; s.bob+=dt*8; continue; } else { s.afRout=false; } }   // v196: routed losers actually flee, regardless of docile
    if(s.merc||s.minion){   // hired companion / risen minion: blade duels, bow kites, cleric heals
      let tg=null, td=(s.mercKind==='bow'?81:49);
      if(s.mercKind!=='cleric'){
        for(const o of mobs){ if(o.friendly||o.type==='nest'||o.warFac||((o.peaceful||o.neutralC)&&!o.provoked)) continue;
          const d2=(o.x-s.x)*(o.x-s.x)+(o.y-s.y)*(o.y-s.y); if(d2<td){ td=d2; tg=o; } } }
      if(tg && s.mercKind==='bow'){ const dl=Math.sqrt(td)||1;
        if(dl<3.5){ dx=(s.x-tg.x)/dl; dy=(s.y-tg.y)/dl; }
        else if(dl>8){ dx=(tg.x-s.x)/dl; dy=(tg.y-s.y)/dl; }
        else { dx=0; dy=0; }
        s.mCd=(s.mCd||0)-dt;
        if(s.mCd<=0 && dl<=9){ s.mCd=1.1; bolts.push({x1:s.x,y1:s.y,x2:tg.x,y2:tg.y,life:.12});
          tg.hp-=s.mDmg||10; tg.hitFlash=.2; provoke(tg); burst(tg.x,tg.y,[200,255,235],3,2);
          if(tg.hp<=0) killMob(tg); } }
      else if(tg){ const dl=Math.sqrt(td)||1;
        if(dl>1.3){ dx=(tg.x-s.x)/dl; dy=(tg.y-s.y)/dl; }
        else { dx=0; dy=0; s.mCd=(s.mCd||0)-dt;
          if(s.mCd<=0){ s.mCd=.8; const ang=Math.atan2(tg.y-s.y,tg.x-s.x);
            slashes.push({x:s.x,y:s.y,ang,arc:1.2,reach:1.3,life:.12,max:.12,heavy:false});
            tg.hp-=s.mDmg||12; tg.hitFlash=.2; provoke(tg); burst(tg.x,tg.y,[200,255,235],3,2);
            if(tg.hp<=0) killMob(tg); } } }
      else { const pd=len(player.x-s.x,player.y-s.y);
        if(pd>2.2){ dx=(player.x-s.x)/pd; dy=(player.y-s.y)/pd; } else { dx=0; dy=0; } }
      if(s.mercKind==='cleric'){ s.hCd=(s.hCd||0)-dt;
        if(s.hCd<=0){ s.hCd=.5; const pd2=len(player.x-s.x,player.y-s.y);
          if(pd2<4.5 && player.hp<player.maxHp){ player.hp=Math.min(player.maxHp, player.hp+1.8);
            if(rand(0,1)<.5) burst(player.x,player.y,[180,255,200],2,1.2); } } }
    }
    else if(s.coinwraith){   // a Coinwraith: bolts from the climber, trailing coins, and vanishes if not caught
      const fl=len(s.x-player.x,s.y-player.y)||1; dx=(s.x-player.x)/fl; dy=(s.y-player.y)/fl;
      if(rand(0,1)<0.4){ const a=rand(0,6.28); dx+=Math.cos(a)*0.5; dy+=Math.sin(a)*0.5; const dl=len(dx,dy)||1; dx/=dl; dy/=dl; }   // jink
      s.coinT=(s.coinT||0)-dt; if(s.coinT<=0){ s.coinT=0.45; coins.push({x:s.x,y:s.y,vx:rand(-1.5,1.5),vy:rand(-1.5,1.5),life:9,r:.22}); }
      s.coinLife=(s.coinLife===undefined?20:s.coinLife)-dt;
      if(s.coinLife<=0){ burst(s.x,s.y,[255,215,90],18,4); sfx('coin'); mobs=mobs.filter(x9=>x9!==s); showToast('The Coinwraith slips into the Tower\u2019s seams...'); continue; }
    }
    else if(s.gang && !s.sprung){   // highwaymen: lie in wait, then spring as one
      if(dist<6.5 && !pSafe){ const myGang=s.gang;
        for(const o of mobs){ if(o.gang===myGang){ o.sprung=true; o.stealth=false; o.sight=99; o.provoked=true; o.smart=true; } }
        showToast('\u201CStand and deliver!\u201D — highwaymen spring from the roadside!'); sfx('boss'); addShake(.3);
        burst(s.x,s.y,[200,180,120],10,3); }
      else { dx=0; dy=0; }
    }
    else if(s.police){   // the city watch: catch looted cutpurses; warn, then run down the WANTED
      let tgt=null, td=121;
      for(const o of mobs){ if(o.thief && o.loot){ const d2=(o.x-s.x)*(o.x-s.x)+(o.y-s.y)*(o.y-s.y); if(d2<td){ td=d2; tgt=o; } } }
      if(tgt){ const dl=Math.sqrt(td)||1; dx=(tgt.x-s.x)/dl; dy=(tgt.y-s.y)/dl;
        if(dl<1.1){ showToast('The watch caught a cutpurse!'); dropCoins(tgt.x,tgt.y,(tgt.loot||0)+2); burst(tgt.x,tgt.y,[200,200,220],10,3); mobs=mobs.filter(x9=>x9!==tgt); dx=0; dy=0; } }
      else if(wantedT>0 && dist<13){ if(!s.warned){ s.warned=true; showToast('Watch: "HALT, troublemaker! Stand down!"'); sfx('boss'); }
        s.provoked=true; dx=dpx/dist; dy=dpy/dist; }
      else { if(s.provoked && wantedT<=0){ s.provoked=false; s.warned=false; }
        if(s.patrol){ const Pt=s.patrol, tx9=Pt.toB?Pt.bx:Pt.ax, ty9=Pt.toB?Pt.by:Pt.ay, dl=len(tx9-s.x,ty9-s.y);
          if(dl<1.5) Pt.toB=!Pt.toB; else { dx=(tx9-s.x)/dl*.6; dy=(ty9-s.y)/dl*.6; } } else { dx=0; dy=0; } }
    }
    else if(s.thief){   // cutpurse: pick a mark, snatch, scarper
      if(s.fleeT2>0){ s.fleeT2-=dt; const fl=len(s.x-s.fleeX,s.y-s.fleeY)||1; dx=(s.x-s.fleeX)/fl; dy=(s.y-s.fleeY)/fl; }
      else { s.stealCd=(s.stealCd===undefined?rand(1,3):s.stealCd)-dt;
        if(s.stealCd>0){ dx=0; dy=0; }
        else {
          if(!s.mark || (s.mark!==player && !npcs.includes(s.mark))){ s.mark=null;
            if(coinCount>0 && dist<14 && rand(0,1)<.5) s.mark=player;
            else { let best=null,bd=900; for(const n9 of npcs){ if(!n9.civ) continue; const d2=(n9.x-s.x)*(n9.x-s.x)+(n9.y-s.y)*(n9.y-s.y); if(d2<bd){ bd=d2; best=n9; } } s.mark=best; } }
          if(s.mark){ const dl=len(s.mark.x-s.x,s.mark.y-s.y)||1;
            if(dl>0.9){ dx=(s.mark.x-s.x)/dl; dy=(s.mark.y-s.y)/dl; }
            else { if(s.mark===player){ const take=Math.min(6, coinCount); coinCount-=take; s.loot=(s.loot||0)+take; s.drop=(s.drop||0)+take;
                showToast('A cutpurse lifts '+take+' of your coins — get them back!'); sfx('hurt'); }
              else { s.mark.scaredT=2.2; s.loot=(s.loot||0)+1; burst(s.mark.x,s.mark.y,[255,220,120],5,2); }
              s.fleeT2=3.5; s.fleeX=s.x; s.fleeY=s.y; s.mark=null; s.stealCd=rand(4,7); dx=0; dy=0; } }
          else { dx=0; dy=0; }
        } }
    }
    else if(mZone){ const ox=s.x-mZone.x, oy=s.y-mZone.y, ol=len(ox,oy)||1; dx=ox/ol; dy=oy/ol; }  // walk out of the walls
    else if((dist<s.sight*wSight() || (s.smart&&s.assistT>0)) && !docile && !pSafe && !(pCover && dist>1.2)){
      dx=dpx/dist; dy=dpy/dist;
      if(s.smart && s.fleeT>0){ dx=-dx; dy=-dy; }     // wounded: break off, regroup
      else {
        if(s.base==='darter'){
          // smart darters flank in an arc instead of beelining
          const fl = s.smart ? (s.flank||(s.flank=rand(0,1)<.5?1:-1)) : 0;
          const pw = s.smart && dist>3 ? .55*fl : 0;
          dx+= -dpy/dist*pw + Math.sin(s.bob)*.35; dy+= dpx/dist*pw + Math.cos(s.bob)*.35;
          const n=len(dx,dy)||1; dx/=n; dy/=n;
        }
        if(s.base==='spitter'){
          if(dist<5){ dx=-dx; dy=-dy; }                                  // keep range
          else if(s.smart && dist<s.sight){ const st=Math.sin(s.bob*.7); dx+=-dpy/dist*st*.7; dy+=dpx/dist*st*.7; const n=len(dx,dy)||1; dx/=n; dy/=n; }  // strafe
        }
      }
    } else {
      // idle behaviours: hold an orbit post, hunt rival factions, follow the pack leader, or wander
      let idleDone=false;
      if(s.orbit){ s.orbit.a+=s.orbit.w*dt;
        const tx=s.orbit.x+Math.cos(s.orbit.a)*s.orbit.r, ty=s.orbit.y+Math.sin(s.orbit.a)*s.orbit.r;
        const dl=len(tx-s.x,ty-s.y); if(dl>0.25){ dx=(tx-s.x)/dl; dy=(ty-s.y)/dl; } else { dx=0; dy=0; }
        idleDone=true; }
      else if(s.faction){
        let bo=null,bd=100;
        for(const o of [...mobs]){ if(o.faction && o.faction!==s.faction && !o.isGate){ const d=(o.x-s.x)*(o.x-s.x)+(o.y-s.y)*(o.y-s.y); if(d<bd){ bd=d; bo=o; } } }
        if(bo){ const dl=Math.sqrt(bd)||1; dx=(bo.x-s.x)/dl; dy=(bo.y-s.y)/dl; idleDone=true;
          if(dl<1.8){ s.fCd=(s.fCd||0)-dt;
            if(s.fCd<=0){ s.fCd=1.2; bo.hp-=9; bo.hitFlash=.2; s.hp-=7; s.hitFlash=.15;
              burst((s.x+bo.x)/2,(s.y+bo.y)/2,[255,220,140],5,2.2);
              if(bo.hp<=0) skirmishKill(bo);
              if(s.hp<=0){ skirmishKill(s); continue; } }
            dx*=.15; dy*=.15; } }
      }
      else if(s.warFac){            // ALWAYS-ON FEUD PRIMITIVE — the director sets s.warFac; here it just resolves
        let bo=null, bd=WARFAC_SCAN2;
        for(const o of mobs){
          if(o===s || o.hp<=0 || o.friendly || o.type==='nest' || o.isGate || !o.warFac) continue;
          if(s.rivalFac && s.rivalFac.indexOf(o.warFac)<0) continue;   // only a RIVAL warFac
          const d=(o.x-s.x)*(o.x-s.x)+(o.y-s.y)*(o.y-s.y); if(d<bd){ bd=d; bo=o; }
        }
        if(s.warHostilePlayer || s.feudGrudge){
          if(s.warHostilePlayer && wantedT<=6){ s.warHostilePlayer=false; }
          else if(!inSafe(player.x,player.y)){
            const pd2=(player.x-s.x)*(player.x-s.x)+(player.y-s.y)*(player.y-s.y);
            const flipR = s.feudGrudge ? Math.min(bd,GRUDGE_R2) : bd;   // v196: a grudge needs the player INSIDE the cluster (4.5u)
            if(pd2<flipR){ const wasGrudge=s.feudGrudge, gf=s.warFac;
              s.provoked=true; s.hostileNpc=true; s.smart=true; s.sight=999; s.warFac=null; s.rivalFac=null; s.warAgg=0; s.feudGrudge=false;
              if(wasGrudge){ for(const o of mobs){ if(o!==s && o.feudGrudge && o.icId===s.icId && len(o.x-s.x,o.y-s.y)<6){ o.feudGrudge=false; } } }   // bound the cascade like provoke
              if(!s.warned){ s.warned=true; showToast(wasGrudge ? ('The '+({sword:'Blades',magic:'Arcane'}[gf]||'House')+' have not forgotten — a fighter turns on you!') : 'Watch: \u201cHALT, troublemaker!\u201d'); sfx('boss'); } }
          }
        }
        if(s.warFac && bo && bo.hp>0){ s.warAgg=1.5;
          const dl=Math.sqrt(bd)||1; dx=(bo.x-s.x)/dl; dy=(bo.y-s.y)/dl; idleDone=true;
          if(bd<WARFAC_RANGE2){ s.warCd=(s.warCd||0)-dt;
            if(s.warCd<=0){ s.warCd=1.1;
              const dmg=Math.round(FEUD_DMG*(1+floor*0.12)), rec=Math.round(FEUD_RECOIL*(1+floor*0.10));
              bo.hp-=dmg; bo.hitFlash=.2; s.hp-=rec; s.hitFlash=.15;
              burst((s.x+bo.x)/2,(s.y+bo.y)/2,[255,200,120],5,2.2);
              if(bo.hp<=0){ skirmishKill(bo); }              // SAME removal path as the faction block — NOT killMob
              if(s.hp<=0){ skirmishKill(s); continue; } }
            dx*=.15; dy*=.15; }
        } else if(s.warFac){ s.warAgg=(s.warAgg||0)-dt; if(s.warAgg>0){ idleDone=true; dx=0; dy=0; } }
      }
      if(!idleDone && s.flockN){ const fd=len(s.flockN.x-s.x,s.flockN.y-s.y);
        if(fd>2.2){ dx=(s.flockN.x-s.x)/fd; dy=(s.flockN.y-s.y)/fd; } else { dx=0; dy=0; }
        idleDone=true; }
      if(!idleDone && s.patrol){ const Pt=s.patrol, tx=Pt.toB?Pt.bx:Pt.ax, ty=Pt.toB?Pt.by:Pt.ay, dl=len(tx-s.x,ty-s.y);
        if(dl<1.2) Pt.toB=!Pt.toB; else { dx=(tx-s.x)/dl*.55; dy=(ty-s.y)/dl*.55; }
        idleDone=true; }
      if(!idleDone){
        if(s.leader && mobs.includes(s.leader) && len(s.leader.x-s.x,s.leader.y-s.y)>3.5){
          const dl=len(s.leader.x-s.x,s.leader.y-s.y); dx=(s.leader.x-s.x)/dl; dy=(s.leader.y-s.y)/dl;
        } else { s.wt-=dt; if(s.wt<=0){ const a=rand(0,6.28); s.wdx=Math.cos(a); s.wdy=Math.sin(a); s.wt=rand(1,2.5); } dx=s.wdx; dy=s.wdy; }
      }
    }
    // smart foes juke incoming bolts
    if(s.smart && !docile && s.dodgeT>0){ s.dodgeT-=dt; dx=s.dodgeX; dy=s.dodgeY; }
    else if(s.smart && !docile && s.base!=='nest'){
      for(const pr of projectiles){ const ddx=s.x-pr.x, ddy=s.y-pr.y, dd=len(ddx,ddy);
        if(dd<3 && (ddx*pr.vx+ddy*pr.vy)>0){ const pl=len(pr.vx,pr.vy)||1, side=((-pr.vy*ddx+pr.vx*ddy)>0?1:-1);
          s.dodgeT=.22; s.dodgeX=-pr.vy/pl*side; s.dodgeY=pr.vx/pl*side; break; } }
    }
    if(s.smart && !s.retreated && s.hp<s.maxHp*0.22 && s.type!=='boss' && s.type!=='general'){ s.retreated=true; s.fleeT=1.2; }
    const _csm=((!s.friendly&&!s.peaceful)?covSpeedMul()*wFoeSpeed():1); let mvx=dx*s.speed*(s.eSlowT>0?0.5:1)*((bloodMoon&&!s.friendly&&!s.peaceful)?bmSpeedMul():1)*_csm, mvy=dy*s.speed*(s.eSlowT>0?0.5:1)*((bloodMoon&&!s.friendly&&!s.peaceful)?bmSpeedMul():1)*_csm;
    if(s.dodgeT>0){ mvx*=1.8; mvy*=1.8; }
    // signature behaviours
    if(s.stationary){ mvx=0; mvy=0; }
    if(s.stunT>0){ s.stunT-=dt; mvx=0; mvy=0; if(s.tele) s.tele=null; }   // Sunder Quake daze (also cancels windups)
    if(s.parleyHold>0){ s.parleyHold-=dt; mvx=0; mvy=0; }   // held in parley — don't wander off
    // ---- telegraphed special attacks: windup (held still, marker on the ground), then strike ----
    if(s.tele){ mvx=0; mvy=0; s.tele.t-=dt;
      if(s.tele.t<=0){ const T=s.tele; s.tele=null; s.teleCd=rand(2.5,4.5);
        if(T.kind==='leap'){ const ddx=T.x-s.x, ddy=T.y-s.y, dl=len(ddx,ddy)||1;
          s.kx=(s.kx||0)+ddx/dl*Math.min(dl,6)/0.22; s.ky=(s.ky||0)+ddy/dl*Math.min(dl,6)/0.22;
          shocks.push({x:T.x,y:T.y,r:.2,maxR:T.r,life:.32,max:.32,dmg:Math.round((s.touch||8)*0.8),hit:false,col:[255,120,60]}); sfx('dash'); }
        else if(T.kind==='volley'){ for(let vi=-1;vi<=1;vi++){ const a=T.ang+vi*0.22;
          eProjectiles.push({x:s.x+Math.cos(a)*.6,y:s.y+Math.sin(a)*.6,vx:Math.cos(a)*7.5,vy:Math.sin(a)*7.5,life:2.4}); } sfx('shoot'); } } }
    else if(floor>=2 && !docile && !pSafe && !(s.stunT>0) && dist<s.sight && s.type!=='boss' && s.type!=='general'){
      s.teleCd=(s.teleCd===undefined?rand(1,3):s.teleCd)-dt;
      if(s.teleCd<=0){
        if(TELE_LEAP[s.type] && dist>3 && dist<7.5){ s.tele={kind:'leap', t:.55, max:.55, x:player.x, y:player.y, r:1.5}; }
        else if(TELE_VOLLEY[s.type] && !s.mortar && dist>3.5 && dist<11){ s.tele={kind:'volley', t:.6, max:.6, ang:Math.atan2(dpy,dpx)}; }
        else s.teleCd=.8;
      } }
    if(s.lunge && dist<4.5){ mvx*=2.3; mvy*=2.3; }
    if(s.slamAtk && !docile && !pSafe && !(s.stunT>0)){
      if(s.slamT>0){ s.slamT-=dt; mvx=0; mvy=0;
        if(s.slamT<=0){ shocks.push({x:s.slamX,y:s.slamY,r:.2,maxR:1.7,life:.4,max:.4,dmg:Math.round((s.touch||10)*1.15),hit:false,col:[255,90,60]});
          burst(s.slamX,s.slamY,[180,130,80],14,4); addShake(.3); sfx('boss'); } }
      else { s.slamCd-=dt; if(s.slamCd<=0 && dist<3.4 && player.iframe<=0){ s.slamCd=rand(2.6,4); s.slamT=.6; s.slamX=player.x; s.slamY=player.y; } }
    }
    if(s.blink){ s.blinkCd-=dt; if(s.blinkCd<=0 && !(s.stunT>0) && dist<s.sight && dist>2){ s.blinkCd=rand(1.6,3); const b=Math.min(dist-1.5,4.5); s.x+=dpx/dist*b; s.y+=dpy/dist*b; burst(s.x,s.y,s.color,7,2.2); sfx('dash'); } }
    if(s.trail){ s.trailCd=(s.trailCd||0)-dt; if(s.trailCd<=0){ s.trailCd=.3; shocks.push({x:s.x,y:s.y,r:.8,maxR:.9,life:.5,max:.5,dmg:6,hit:false,col:s.color,poison:true}); } }
    // boss / general: realm attack pattern (bosses also phase-2 enrage); docile gatekeepers hold their peace
    if((s.type==='boss' || s.type==='general') && !docile){
      s.atkTimer-=dt;
      if(s.type==='boss' && s.phase===1 && s.hp<=s.maxHp*0.5){ s.phase=2; s.atkTimer=.6; s.speed*=1.25; s.adDef=Math.round((s.adDef||0)*0.6); s.apDef=Math.round((s.apDef||0)*0.6);
        addShake(.7); sfx('boss'); burst(s.x,s.y,realm.accent,40,6); showToast((s.bossName||'The boss')+' ENRAGES!');
        shocks.push({x:s.x,y:s.y,r:.3,maxR:7,life:.7,max:.7,dmg:0,hit:true,col:realm.accent}); }
      if(s.type==='boss' && s.phase===2 && s.hp<=s.maxHp*0.22){ s.phase=3; s.atkTimer=.4; s.speed*=1.15; s.adDef=Math.round((s.adDef||0)*0.6); s.apDef=Math.round((s.apDef||0)*0.6);
        addShake(.8); sfx('boss'); burst(s.x,s.y,[255,90,60],50,7); flashT=Math.max(flashT,.07);
        showToast((s.bossName||'The boss')+' — FINAL FURY!'); }
      if(s.chargeT>0){                                    // mid-charge: telegraph, then dash
        s.chargeT-=dt;
        if(s.windup>0){ s.windup-=dt; mvx=0; mvy=0; }      // wind-up: hold still (telegraph)
        else { mvx=s.chargeDir[0]*14; mvy=s.chargeDir[1]*14; if(rand(0,1)<.6) burst(s.x,s.y,s.color,1,2.5); }
      } else if(s.atkTimer<=0 && !(s.stunT>0) && dist<15 && !pSafe){
        s.atkTimer = s.phase===3 ? 1.1 : s.phase===2 ? 1.7 : (s.type==='general'?2.9:2.6);
        let kind=s.atk;
        if(s.phase>=2){ s.slamCount=(s.slamCount||0)+1; kind = (s.slamCount%2===0)?s.atk2:s.atk; }
        bossAttack(s, dpx/dist, dpy/dist, kind);
        if(s.phase>=3){ const fdmg=Math.round((10+floor*1.3)*(1+0.30*ngPlus));
          const sig = realm && BOSS_SIG[realm.name];
          if(sig) sig(s, fdmg, dpx, dpy, dist);
          else for(let b3=0;b3<3;b3++) mortars.push({x:player.x+rand(-2.6,2.6), y:player.y+rand(-2.6,2.6), t:.9+b3*0.15, r:1.7, dmg:fdmg}); }
      }
    }
    if(s.kx||s.ky){ s.x+=s.kx*dt; s.y+=s.ky*dt; const kf=Math.pow(.0001,dt); s.kx*=kf; s.ky*=kf; if(Math.abs(s.kx)+Math.abs(s.ky)<.05){ s.kx=0; s.ky=0; } }
    s.x+=mvx*dt; s.y+=mvy*dt; collideWalls(s);
    s.moving=(Math.abs(mvx)+Math.abs(mvy))>0.6;
    if(Math.abs(mvx)>0.4) s.face = mvx>0?1:-1;   // sprites face where they walk

    // monster nest: periodically hatch a foe while not too crowded
    if(s.type==='nest'){ s.spawnCd-=dt;
      if(s.spawnCd<=0){ const near=mobs.filter(o=>o.type!=='nest'&&o.type!=='boss'&&o.type!=='general'&&len(o.x-s.x,o.y-s.y)<11).length;
        if(near<5){ s.spawnCd=rand(2.5,4.5); const a=rand(0,6.28); MOB(pick([...realm.pool,realm.sig]), s.x+Math.cos(a)*2.4, s.y+Math.sin(a)*2.4); burst(s.x,s.y,s.color,6,2); }
        else s.spawnCd=1.5; } }

    // ranged fire (spitter-based foes; signatures may fire a spread)
    if(s.base==='spitter' && !docile && !pSafe && !mZone){ s.fireCd-=dt; if(dist<s.sight && s.fireCd<=0 && !(s.stunT>0)){
      if(s.mortar){ s.fireCd=2.6; mortars.push({x:player.x,y:player.y,t:.85,r:1.5,dmg:Math.round(8+floor*1.4)}); sfx('shoot'); }
      else { s.fireCd=1.7; const a=Math.atan2(dpy,dpx), n=s.spread||1;
        for(let i=0;i<n;i++){ const aa=a+(i-(n-1)/2)*0.26; eProjectiles.push({x:s.x,y:s.y,vx:Math.cos(aa)*6.5,vy:Math.sin(aa)*6.5,life:2.4,kind:'magic'}); } sfx('shoot'); } } }

    // bomber detonates on contact
    if(s.base==='bomber' && dist<s.r+player.r+.35){ explode(s); continue; }

    // wardens don't wound trespassers — they ARREST them
    if(s.warden && jailCell && wantedT>0 && jailT<=0 && !pSafe && !pCover && dist<s.r+player.r+.25){ arrestPlayer(); continue; }

    // contact damage (+ thorns reflect, + signature effects) — the docile never strike first; towns are sanctuary
    if(s.touch>0 && !docile && !pSafe && dist<s.r+player.r+.05 && s.touchCd<=0 && player.iframe<=0){
      hurtPlayer(s.touch, s.x, s.y, {kind:s.dmgKind||'physical'}); s.touchCd=.8; if(s.hexer) player.slowT=Math.max(player.slowT||0,1.6);
      if(s.slow){ player.slowT=1.6; showToast("Frozen — slowed!"); }
      if(s.lifedrain){ s.hp=Math.min(s.maxHp, s.hp+8); }
      const k=len(player.x-s.x,player.y-s.y)||1; player.x+=(player.x-s.x)/k*.3; player.y+=(player.y-s.y)/k*.3;
      if(player.thorns>0){ dealDamage(s, player.thorns, {noCrit:true}); }
    }
    else if(s.touch>0 && !docile && !pSafe && s.touchCd<=0 && player.dashT>0 && player.pdCd<=0 && dist<s.r+player.r+.15){ s.touchCd=.6; perfectDodge(s.x,s.y); }
  }

  // enemy projectiles (fizzle at sanctuary walls)
  for(const ep of eProjectiles){ ep.x+=ep.vx*dt; ep.y+=ep.vy*dt; ep.life-=dt;
    if(inSafe(ep.x,ep.y)) ep.life=0;
    if(player.iframe<=0 && len(player.x-ep.x,player.y-ep.y)<player.r+.2){ hurtPlayer(Math.round((8+floor)*(1+0.30*ngPlus)), ep.x, ep.y, {kind:ep.kind||'physical'}); ep.life=0; }
    else if(player.dashT>0 && player.pdCd<=0 && !ep.dodged && len(player.x-ep.x,player.y-ep.y)<player.r+.45){ ep.dodged=true; perfectDodge(ep.x,ep.y); }
    if(ep.life>0) for(const wl of walls){ if(Math.abs(ep.x-wl.x)<wl.w/2 && Math.abs(ep.y-wl.y)<wl.h/2){ ep.life=0; break; } }
  }
  eProjectiles=eProjectiles.filter(e=>e.life>0);

  // shockwaves: expanding rings (slams/blasts) + static clouds (poison/fire trail)
  for(const sh of shocks){ sh.life-=dt;
    if(sh.friendly){ sh.r=sh.maxR; sh.tick=(sh.tick||0)-dt;                       // Cataclysm rifts: hurt mobs, NEVER the player
      if(sh.tick<=0){ sh.tick=.5; for(const s of [...mobs]){ if(!s.friendly && s.type!=='nest' && len(s.x-sh.x,s.y-sh.y)<sh.maxR+s.r) dealDamage(s, PDMG()*0.18, {noCrit:true}); } }
      continue; }
    if(sh.poison){ sh.r=sh.maxR; sh.tick=(sh.tick||0)-dt;
      if(sh.tick<=0 && player.iframe<=0 && len(player.x-sh.x,player.y-sh.y)<sh.maxR+player.r){ hurtPlayer(sh.dmg, sh.x, sh.y, {soft:true}); sh.tick=.5; } }
    else { sh.r=sh.maxR*(1-sh.life/sh.max);
      if(!sh.hit && player.iframe<=0 && Math.abs(len(player.x-sh.x,player.y-sh.y)-sh.r)<player.r+.35){ hurtPlayer(sh.dmg, sh.x, sh.y); sh.hit=true; }
      else if(!sh.hit && sh.dmg>0 && player.dashT>0 && player.pdCd<=0 && Math.abs(len(player.x-sh.x,player.y-sh.y)-sh.r)<player.r+.4){ perfectDodge(sh.x,sh.y); } }
  }
  shocks=shocks.filter(s=>s.life>0);

  // coins
  for(const c of coins){ c.vx*=.9; c.vy*=.9; c.x+=c.vx*dt; c.y+=c.vy*dt; c.life-=dt;
    const d=len(player.x-c.x,player.y-c.y);
    if(d<player.magnet){ c.x+=(player.x-c.x)*6*dt; c.y+=(player.y-c.y)*6*dt; } // magnet
    if(d<.5){ c.life=0; coinCount++; gainXP(1); sfx('coin'); }
  }
  coins=coins.filter(c=>c.life>0);
  for(const g of worldKit){ g.vx*=.9; g.vy*=.9; g.x+=g.vx*dt; g.y+=g.vy*dt; g.life-=dt;
    const d=len(player.x-g.x,player.y-g.y);
    if(d<player.magnet){ g.x+=(player.x-g.x)*5*dt; g.y+=(player.y-g.y)*5*dt; }
    if(d<.6){
      if(g.trinket){ const msg=grantTrinket(g.key); if(msg){ g.life=0; sfx('level'); burst(g.x,g.y,(TRINKET_DEFS_MAP[g.key]&&TRINKET_DEFS_MAP[g.key].col)||[200,150,255],14,3); showToast('Equipped '+msg); }
          else { g.life=Math.max(g.life,3); if(!player._trinketFullHint){ player._trinketFullHint=true; showToast('Trinket slots full — open the Satchel (I) and click a worn ◈ to unequip one.'); } } }
      else if(kitAdd(g.key,1)){ g.life=0; sfx('coin'); const def=KIT_DEFS_MAP[g.key]; burst(g.x,g.y,def.col||[150,200,255],12,3);
        if(!player._satchelHinted){ player._satchelHinted=true; showToast('Picked up '+def.n+' — press I or Tab to open your Satchel'); } else showToast('Picked up '+def.n); }
      else { g.life=Math.max(g.life,2); } } }
  worldKit=worldKit.filter(g=>g.life>0);

  // particles
  for(const p of particles){ p.x+=p.vx*dt; p.y+=p.vy*dt; p.vx*=.92; p.vy*=.92; p.life-=dt; }
  particles=particles.filter(p=>p.life>0);
  for(const b of bolts) b.life-=dt; bolts=bolts.filter(b=>b.life>0);
  for(const t of dmgTexts){ t.y+=t.vy*dt; t.age=(t.age||0)+dt; t.life-=dt; } dmgTexts=dmgTexts.filter(t=>t.life>0);
  for(const sl of slashes) sl.life-=dt; slashes=slashes.filter(s=>s.life>0);

  // player death — drag back to the floor entrance; refresh the boss if it survived
  if(player.hp<=0){
    if((player.lives||0)>1){
      player.lives--; player.hp=player.maxHp; player.iframe=1.6; addShake(.5); coinCount=Math.round(coinCount*0.85);
      projectiles=[]; eProjectiles=[]; shocks=[];
      for(const g of mobs){ if((g.isGate||g.champion)&&!g.friendly) g.hp=g.maxHp; }   // gatekeepers heal so the fight restarts fair
      const [ex,ey]=entrance(); player.x=ex; player.y=ey;
      burst(player.x,player.y,[255,80,80],26,5);
      showToast("You fell — the Tower keeps you, this once. "+player.lives+" lives remain.");
    } else {
      player.lives=0; player.hp=0; phase='dead'; deathFloor=floor; deathHeroKey=heroClass?heroClass.key:'Knight'; deathAt=s_now(); bankRun(); clearRun(); sfx('boss'); addShake(.6);
    }
  }

  // ----- trespass law: restricted grounds, WANTED heat, and serving time -----
  if(jailT>0){ jailT-=dt;
    if(jailT<=0){ if(jailDoor){ walls=walls.filter(w=>w!==jailDoor); jailDoor=null; } showToast('Warden: "Released. Behave yourself."'); } }
  if(player.writT>0) player.writT-=dt;
  if(restricted.length && jailT<=0 && !hasCover()){
    const rz=restricted.find(z=>Math.abs(player.x-z.x)<z.w/2 && Math.abs(player.y-z.y)<z.h/2);
    if(rz){
      if(wantedT<=0){ sfx('boss'); addShake(.25);
        showToast('Warden: "HALT! Why are you in '+rz.name+'?!"');
        dialogue='Warden: "Intruder in '+rz.name+'! Seize them!"';
        for(const m of mobs){ if(m.warden){ m.provoked=true; m.assistT=999; } } }
      wantedT=3.5;
    } else if(wantedT>0){ wantedT-=dt; if(wantedT<=0){ calmWardens(); showToast('The wardens lose interest.'); } }
  }

  // ----- boss intro cinematic (first time you near a gatekeeper or Upper Being) -----
  if(bossIntroT>0) bossIntroT-=dt;
  for(const g of mobs){ if(!(g.isGate||g.champion) || g.seen || g.friendly) continue;
    if(len(player.x-g.x,player.y-g.y)<16){ g.seen=true; bossIntroT=2.6; bossIntroName=(g.bossName||'BOSS').toUpperCase();
      bossIntroSub = g.champion ? 'UPPER BEING — defeat or befriend' : (GATE_LORE[realmIndex(floor)]||('GATEKEEPER — '+(realm?realm.name:'')));
      sfx('boss'); addShake(.4); break; }
  }

  // ----- Floor 8: the Court opens the stair when every Upper Being is resolved -----
  if(realm && realm.special==='champions' && exit && !exit.open && championsList.length===4 && championsList.every(c=>c.resolved)){
    exit.open=true; bossDead=true; sfx('win'); addShake(.4); showToast('The Court is satisfied. The stair awakens.');
  }

  // ----- floor exit (boss-gated stair) -----
  if(phase==='explore' && exit){
    if(exit.open && len(player.x-exit.x, player.y-exit.y) < exit.r+player.r){
      if(floor>=TOTAL_FLOORS){ phase='win'; bumpLT('wins'); saveFeats(); sfx('win'); clearRun(); } else { phase='ascend'; bargainPick=-1; sfx('win'); }
    }
  }

  // ----- Upper Being parley (E near an unresolved, unprovoked champion) -----
  let nearChamp=null;
  for(const c of championsList){ if(!c.dead && !c.friendly && mobs.includes(c) && len(c.x-player.x,c.y-player.y)<2.8){ nearChamp=c; break; } }
  if(nearChamp){
    if(!nearChamp.provoked) nearChamp.parleyHold=Math.max(nearChamp.parleyHold||0,0.5);   // stay put while the climber considers a parley
    if(justPressed['KeyE']){
      if(nearChamp.provoked) dialogue=nearChamp.bossName+': "Words ended when you drew blood."';
      else if(coinCount>=60 && player.items.length>=3 && player.level>=5){
        coinCount-=60; nearChamp.resolved=true; nearChamp.friendly=true; nearChamp.touch=0;
        sfx('level'); burst(nearChamp.x,nearChamp.y,[255,225,140],30,4);
        showToast(nearChamp.bossName+' acknowledges you as an equal.'); dialogue='';
      } else dialogue=nearChamp.bossName+': "Tribute: 60 coins, 3 relics, and be at least level 5. Prove your worth — or draw your blade."';
    }
    if(!dialogue && !choiceOpts && toastT<=0) showToast('Press E — parley with '+nearChamp.bossName);
  }

  // ----- Gatekeeper parley: face the gate boss before blood is drawn (writ / bribe / challenge) -----
  let nearBoss = (boss && boss.isGate && !boss.dead && mobs.includes(boss) && !boss.provoked && !boss.resolved && len(boss.x-player.x,boss.y-player.y)<3.0) ? boss : null;
  if(nearBoss && !nearChamp){
    nearBoss.parleyHold=Math.max(nearBoss.parleyHold||0,0.5);
    if(justPressed['KeyE']){
      const disp=nearBoss.bossName||'The Gatekeeper', toll=Math.max(40, 55+floor*12);
      openChoices(nearBoss, disp+': None pass the gate unproven. Choose, climber.  ('+coinCount+'c)', [
        (hasCover() ? { label:'Show your writ \u2014 pass freely', f(){ openGate('showed a writ'); } } : null),
        { label:'Offer tribute \u2014 '+toll+'c', f(){ if(coinCount<toll){ dialogue=disp+': '+toll+' coin. Not a copper less.'; return; } coinCount-=toll; openGate('paid the toll'); } },
        { label:'Challenge the gatekeeper', f(){ nearBoss.provoked=true; nearBoss.neutralC=false; nearBoss.assistT=999; sfx('boss'); dialogue=disp+': Then we settle it in blood.'; } },
        { label:'Step back', f(){ dialogue=disp+': Decide quickly.'; } },
      ].filter(Boolean));
      nearBoss._social=true;
    }
    if(!dialogue && !choiceOpts && toastT<=0) showToast('Press E \u2014 face '+(nearBoss.bossName||'the Gatekeeper'));
  }

  // ----- NPC + prop interaction (scanned together so reading a plaque doesn't get wiped) -----
  let activeProp=null;
  for(const p of props){ if(['chest','shrine','plaque','orb','stone','waystone','ore','board','newsstand','well','dummy','book','runestone','beacon','wardoor','weathervane','fountain','monolith','anvil','keg','cookfire','altar','market','obelisk','covenant','records','evidence','relaybox','wardrobe','guildplatform'].includes(p.kind) && len(p.x-player.x,p.y-player.y)<1.8){ activeProp=p; break; } }
  let activeNpc=null;
  for(const n of npcs){ if(len(n.x-player.x, n.y-player.y) < 1.6){ activeNpc=n; break; } }
  if(activeNpc){
    if(dialogue||choiceOpts) activeNpc.talkHold=Math.max(activeNpc.talkHold||0,1.2);   // sustain the anchor while the conversation is live
    if(justPressed['KeyE']) interactNPC(activeNpc);
    if(activeNpc.line<0 && !dialogue && !choiceOpts && toastT<=0) showToast('Press E — '+activeNpc.name);
  } else if(dialogue && !activeProp && !nearChamp && !nearBoss){ dialogue=''; if(choiceNpc) choiceNpc._social=false; choiceOpts=null; choiceNpc=null; npcs.forEach(n=>n.line=-1); }
  if(activeProp){
    if(justPressed['KeyE'] && !activeNpc) interactProp(activeProp);
    if(!activeNpc && !dialogue && toastT<=0){
      const done = activeProp.kind==='chest' ? activeProp.opened : (activeProp.kind==='ore'||activeProp.kind==='dummy') ? activeProp.uses<=0 : ['waystone','board','newsstand','well','fountain','runestone','wardrobe','guildplatform'].includes(activeProp.kind) ? false : activeProp.used;
      const verb={chest:'open chest',shrine:'pray at shrine',plaque:'read the plaque',orb:'touch the memory orb',stone:'commune with the stone',waystone:(activeProp.attuned?'travel by waystone':'attune the waystone'),ore:'mine the vein',board:'read the notice board',newsstand:'buy floor intel',well:'toss a coin in the well',dummy:'train on the dummy',book:'read the tome',runestone:'touch the runestone',beacon:'light the beacon',wardoor:'open the sealed vault',weathervane:'read the weathervane',fountain:'toss a coin in the fountain',monolith:'read the monolith',anvil:'temper at the anvil',keg:'drink from the keg',cookfire:'rest by the fire',records:'use the records desk',evidence:'open the secure locker',relaybox:'tamper with the relay',wardrobe:'take a disguise',guildplatform:'read your ★ ranking'}[activeProp.kind];
      showToast(done ? '(nothing left here)' : 'Press E — '+verb); }
  }
  if(!activeNpc && !activeProp && justPressed['RMB']) classAbility();   // 3.0: RMB = class skill (mana). E stays talk/use
  if(!activeNpc && !activeProp){ if(justPressed['KeyZ']) castGrimoire(0); if(justPressed['KeyX']) castGrimoire(1); if(justPressed['KeyC']) castGrimoire(2); }   // 3.0: grimoire ability slots
  for(const p of props){
    if(p.kind==='flower' && !p.used && len(p.x-player.x,p.y-player.y)<0.95){ p.used=true; player.hp=Math.min(player.maxHp,player.hp+12); burst(p.x,p.y,[150,235,150],8,2); sfx('coin'); }
    if(p.kind==='crop' && !p.used && len(p.x-player.x,p.y-player.y)<0.95){ p.used=true; player.hp=Math.min(player.maxHp,player.hp+6); coinCount+=1; burst(p.x,p.y,[210,220,120],6,2); sfx('coin'); }
  }

// the arena: when a wave falls, the next rises — or the prize unlocks
  if(arenaState && !mobs.some(m=>m.arena)){
    if(arenaState.wave>=arenaState.total){
      arenaDone=true; const ch=props.find(p=>p.arenaChest); if(ch) ch.locked=false;
      dropCoins(ch?ch.x:player.x, ch?ch.y:player.y, 16);
      sfx('win'); addShake(.4); showToast('★ ARENA CHAMPION! The prize chest unlocks. ★');
      arenaState=null;
    } else spawnArenaWave();
  }

    // hex obelisks: a persistent hazard — while you linger within 10 units it discharges every 4s (move on or eat the pulses)
  for(const p of props){ if(p.kind!=='obelisk') continue;
    const d=len(p.x-player.x,p.y-player.y);
    if(d<10){ p.pt-=dt; if(p.pt<=0){ p.pt=4; shocks.push({x:p.x,y:p.y,r:.3,maxR:4.6,life:.6,max:.6,dmg:10,hit:false,col:[200,90,160]}); sfx('boss'); } }
    else p.pt=Math.min(4,(p.pt||4)+dt*.5);
  }
    // ----- roaming folk: wander near home, pause politely when you approach -----
    if(bossDead && !cheered){ cheered=true; crowdCheer=4; }            // the town cheers a gatekeeper's fall
    if(crowdCheer>0) crowdCheer-=dt; if(fleePulse>0) fleePulse-=dt;
  for(const n of npcs){
    if(!n.roam) continue;
    n.home=n.home||{x:n.x,y:n.y};
    if(n.spd===undefined) n.spd=1.45+((Math.abs((n.x*7+n.y*13))|0)%10)/10*0.8;   // each soul keeps its own pace
    if(!n.trait){ n.trait=n.traitForce||TRAIT_KEYS[(Math.abs((n.x*13+n.y*29))|0)%TRAIT_KEYS.length]; n.barkCd=rand(5,16); }
    const tr=TRAITS[n.trait]||TRAITS.gruff;
    if(n.tipsy>0) n.tipsy-=dt;
    if(n.emoteT===undefined) n.emoteT=0;                              // undefined<=0 is false in JS — without this no emote setter ever fires
    if(n.emoteT>0) n.emoteT-=dt;
    if(n.talkHold>0){ n.talkHold-=dt; n.moving=false; n.mind='watch'; n.chatWith=null; const _s=Math.max(0.1,len(player.x-n.x,player.y-n.y)); n.faceX=(player.x-n.x)/_s; n.faceY=(player.y-n.y)/_s; continue; }   // held in conversation — stand and face the climber
    // ambient chatter — a passing thought spoken aloud when the climber is near enough to hear
    if(n.barkCd!==undefined){ n.barkCd-=dt;
      if(n.barkCd<=0){ n.barkCd=rand(11,26);
        if(n.emoteT<=0 && len(player.x-n.x,player.y-n.y)<22 && (n.mind===undefined||n.mind==='idle'||n.mind==='walk'||n.mind==='work') && rand(0,1)<0.6){
          n.emote=pick(n.barkLines||tr.barks); n.emoteT=2.6; } } }
    // --- daily rhythm: drift toward the right haunt for the hour (workers hold their station by day) ---
    if(n.civ){
      const foul = FOUL_WEATHER[weatherType] && weatherInt>0.62;
      if(foul && !n.sheltering){ n.sheltering=true; let hb=null,bd=1e18; for(const b of buildings){ const d=(b.x-n.x)*(b.x-n.x)+(b.y-n.y)*(b.y-n.y); if(d<bd){ bd=d; hb=b; } }
        if(hb){ if(!n.post) n.post={x:hb.x,y:hb.y+hb.h/2+0.6,r:3}; else { n.post.x=hb.x; n.post.y=hb.y+hb.h/2+0.6; } if(n.emoteT<=0&&rand(0,1)<0.25){ n.emote=pick(['Rotten weather.','Inside, quick!','This storm!']); n.emoteT=2; } } }
      else if(!foul && n.sheltering){ n.sheltering=false; }
      if(!n.haunts) n.haunts=npcSeedHaunts(n);
      if(n.schedCd===undefined) n.schedCd=rand(2,9);
      n.schedCd-=dt;
      if(n.schedCd<=0){ n.schedCd=rand(7,13);
        if(!(n.workFx && clockPhase()==='day') && !n.follow && !n.sheltering){
          const ph=clockPhase(), h=n.haunts;
          const dest = ph==='night'?h.home : ph==='dusk'?h.social : ph==='dawn'?h.home : h.work;
          if(dest){ if(!n.post) n.post={x:dest.x,y:dest.y,r:5}; else { n.post.x=dest.x; n.post.y=dest.y; } }
        }
      }
    }
    if(n.civ && n.given===undefined) n.given=NAMES[(Math.abs((n.x*31+n.y*17))|0)%NAMES.length];   // a name, shown up close
    if(n.panicImmune>0) n.panicImmune-=dt;
    if(fleePulse>0 && n.civ && n.mind!=='flee' && (n.panicImmune||0)<=0 && (n.mind===undefined||n.mind==='idle'||n.mind==='walk'||n.mind==='watch'||n.mind==='sleep')){
      for(const o of npcs){ if(o.mind!=='flee') continue; const dx=o.x-n.x; if(dx>5||dx<-5) continue; const dy=o.y-n.y; if(dy>5||dy<-5) continue;
        if(dx*dx+dy*dy<22){ n.mind='flee'; n.mindT=1.4; n.panicImmune=6; fleePulse=Math.max(fleePulse,1.2); if(n.emoteT<=0){ n.emote='!'; n.emoteT=1.0; } break; } }
    }
    if(crowdCheer>0 && n.civ && n.mind!=='flee' && len(player.x-n.x,player.y-n.y)<30 && n.emoteT<=0 && rand(0,1)<0.05){ n.emote=pick(CHEERS); n.emoteT=2; }
    if(n.civ && n.mind!=='flee' && (n.panicImmune||0)<=0){   // SoR: scatter from prowling monsters
      for(const m of mobs){ if(m.friendly||m.peaceful||m.type==='nest'||!m.provoked) continue; const dx=m.x-n.x; if(dx>9||dx<-9) continue; const dy=m.y-n.y; if(dy>9||dy<-9) continue;
        if(dx*dx+dy*dy<64){ n.mind='flee'; n.mindT=2; fleePulse=Math.max(fleePulse,1.5); if(n.emoteT<=0){ n.emote='!'; n.emoteT=1; } break; } }
    }
    // --- civic defenders: armed folk rush to fight monsters threatening the people (if you're no criminal) ---
    if(npcFighter(n) && wantedT<=0 && !realm.special && !n.cowed){
      let answered=false;
      for(const m of mobs){ if(m.friendly||m.peaceful||m.type==='nest'||m.hostileNpc||!m.provoked) continue; const dx=m.x-n.x; if(dx>9||dx<-9) continue; const dy=m.y-n.y; if(dy>9||dy<-9) continue;
        if(dx*dx+dy*dy<81 && rand(0,1)<0.5){ if(n.emoteT<=0){ n.emote=pick(['For the people!','To arms!','Hold the line!','Stand back, climber!']); n.emoteT=1.8; } convertDefender(n); answered=true; break; } }
      if(answered) continue;
    }
    // --- recognition: a known criminal clears the streets on sight ---
    if(n.civ && wantedT>6 && n.mind!=='flee' && len(player.x-n.x,player.y-n.y)<8){ n.mind='flee'; n.mindT=2.2; fleePulse=Math.max(fleePulse,1.5); if(n.emoteT<=0){ n.emote=pick(['Murderer!','Run!','It\u2019s the killer!']); n.emoteT=1.4; } }
    // --- escort: follow the climber to safety ---
    if(n.follow){ const fd=len(player.x-n.x,player.y-n.y);
      if(fd>1.6){ n.faceX=(player.x-n.x)/fd; n.faceY=(player.y-n.y)/fd; n.x+=n.faceX*3.4*dt; n.y+=n.faceY*3.4*dt; collideWalls(n); n.moving=true; } else n.moving=false;
      for(const p of props){ if(p.kind==='waystone' && len(n.x-p.x,n.y-p.y)<3){
        n.follow=false; n.escortDone=true; dropCoins(n.x,n.y,12); gainXP(12); sfx('level'); burst(n.x,n.y,[255,220,120],18,4);
        FT.npcs=FT.npcs||[]; FT.npcs.push(n.given||pick(NAMES)); if(FT.npcs.length>12) FT.npcs.shift(); saveFeats();
        const opDone = n.operationInformant && operation && operation.type==='rescue' && completeOperation('informant extracted');
        if(!opDone) showToast('The traveller is safe — gratitude! They will remember you. (+coins +XP)'); break; } }
      continue; }
    // --- fear: flee when the climber fights nearby ---
    if(n.civ && (player.atkFlash>0||player.shootFlash>0) && n.mind!=='flee'){
      const fd=len(player.x-n.x,player.y-n.y), fearR=6.5*tr.fear;
      if(fd<fearR){ n.mind='flee'; n.mindT=1.9; fleePulse=2; if(n.emoteT<=0){ n.emote=tr.fear>1?'!':pick(tr.emo); n.emoteT=1.3; } n.chatWith=null; }
      else if(fd<24 && tr.gawk>0.6 && (n.mind===undefined||n.mind==='idle'||n.mind==='walk') && rand(0,1)<0.05){ n.mind='gawk'; n.mindT=rand(2.2,4.5); n.chatWith=null; } }
    if(n.mind==='flee'){ n.mindT-=dt; const sd=len(n.x-player.x,n.y-player.y)||1;
      n.faceX=(n.x-player.x)/sd; n.faceY=(n.y-player.y)/sd; n.x+=n.faceX*3.6*dt*(0.8+tr.fear*0.4); n.y+=n.faceY*3.6*dt*(0.8+tr.fear*0.4); collideWalls(n); n.moving=true;
      if(n.mindT<=0) n.mind='idle'; continue; }
    if(n.mind==='gawk'){ n.mindT-=dt; const d=len(player.x-n.x,player.y-n.y)||1;       // the bold draw NEAR to watch the fight
      n.faceX=(player.x-n.x)/d; n.faceY=(player.y-n.y)/d;
      if(d>9){ n.x+=n.faceX*2.5*dt; n.y+=n.faceY*2.5*dt; collideWalls(n); n.moving=true; } else n.moving=false;
      if(d<6.5*tr.fear){ n.mind='flee'; n.mindT=1.6; }
      else if(n.emoteT<=0 && rand(0,1)<0.04){ n.emote=pick(tr.emo); n.emoteT=1.1; }
      if(n.mindT<=0) n.mind='idle'; continue; }
    // --- travellers hop POI to POI ---
    if(n.travel){
      if(!n.tgt || len(n.tgt.x-n.x,n.tgt.y-n.y)<3){ const c9=poiList.length?pick(poiList):null;
        n.tgt=c9?{x:c9.x+rand(-5,5),y:c9.y+rand(-4,4)}:{x:rand(-60,60),y:rand(-40,40)}; }
      const td=len(n.tgt.x-n.x,n.tgt.y-n.y)||1; n.faceX=(n.tgt.x-n.x)/td; n.faceY=(n.tgt.y-n.y)/td;
      n.x+=n.faceX*2.1*dt; n.y+=n.faceY*2.1*dt; collideWalls(n); n.moving=true; continue; }
    // --- notice the climber: stop, turn, sometimes greet ---
    const pdist=len(player.x-n.x,player.y-n.y);
    if(pdist<3.0){ n.moving=false; const s=pdist||1; n.faceX=(player.x-n.x)/s; n.faceY=(player.y-n.y)/s; n.mind='watch'; n.chatWith=null;
      if(!n.greeted){ n.greeted=true;
        if(n.grateful){ if(n.emoteT<=0){ n.emote=pick(['You came back!','My friend!','\u2665','Bless you, climber.']); n.emoteT=2.4; } continue; }
        const al = WATCH_TYPES[n.type]?'watch':CULT_TYPES[n.type]?'cult':null;
        const rv = al&&player.rep?(player.rep[al]||0):0;
        if(al && rv>=3){ if(n.emoteT<=0){ n.emote=pick(al==='watch'?['Salute, climber!','The Watch stands with you.','An honour.']:['Blessings upon you.','The faithful favour you.','Walk in light.']); n.emoteT=2.2; } }
        else if(al==='watch' && rv<=-3){ if(n.emoteT<=0){ n.emote=pick(['We\u2019re watching you.','Troublemaker.','Step carefully.']); n.emoteT=2; } if(pdist<2.2) wantedT=Math.max(wantedT,2); }
        else if(!al && (n.house && n.type!=='househead') && player.houseStand && player.houseStand[n.house]!=null && realm.special!=='families' && (player.houseStand[n.house]>=SALUTE_T || player.houseStand[n.house]<=-3)){
          const hv=player.houseStand[n.house];
          if(n.emoteT<=0){ n.emote = hv>=SALUTE_T ? pick({sword:['The Blades honour you.','Well met, friend of the House.'],magic:['The Arcane bows to you.','A friend of the craft.']}[n.house]||['Well met.'])
                                                  : pick(['You spilled our blood.','You\u2019re not welcome here.','Murderer of the House.']); n.emoteT=2.2; }
        }
        else if(n.emoteT<=0){ n.emote=pick(['\u2665','!','?','\u2026','\u266a']); n.emoteT=1.5; } }
      continue; }
    if(pdist>5) n.greeted=false;
    if(n.mind==='watch') n.mind=n.goal?'walk':'idle';
    // --- chatting with a neighbour: face them, trade emotes ---
    if(n.mind==='chat'){ const o=n.chatWith;
      if(o && o.mind==='chat' && o.chatWith===n && len(o.x-n.x,o.y-n.y)<3.2){ n.mindT-=dt; n.moving=false;
        const s=len(o.x-n.x,o.y-n.y)||1; n.faceX=(o.x-n.x)/s; n.faceY=(o.y-n.y)/s;
        if(n.chatBeat>0) n.chatBeat-=dt;
        if(n.chatTurn && n.chatBeat<=0 && n.emoteT<=0){ n.emote=pick(CHAT_LINES[n.topic]||CHAT_LINES.tower); n.emoteT=2.2; n.chatTurn=false; if(o){ o.chatTurn=true; o.chatBeat=2.1; } }
        if(n.mindT<=0){ n.mind='idle'; n.mindT=rand(.8,2.2); n.chatWith=null; } continue; }
      else { n.mind='idle'; n.chatWith=null; } }
    // --- maybe strike up a chat with someone idling nearby ---
    if(n.chatCd===undefined) n.chatCd=rand(2,8);
    n.chatCd-=dt;
    if(n.chatCd<=0){ n.chatCd=rand(5,12);
      let o=null,kin=null;
      for(const q of npcs){ if(q===n||!q.roam||q.follow||q.travel||!(q.mind===undefined||q.mind==='idle'||q.mind==='walk')) continue;
        if(len(q.x-n.x,q.y-n.y)<2.6){ if(n.kin && n.kin.indexOf(q)>=0){ kin=q; break; } if(!o) o=q; } }
      o=kin||o;
      if(o){ const near=len(player.x-n.x,player.y-n.y)<22;
        const tp=kin?'family':(near?pick(CHAT_TOPICS):pick(CHAT_TOPICS.filter(t=>t!=='climber')));
        n.mind='chat'; n.chatWith=o; n.mindT=rand(4,8); n.topic=tp; n.chatTurn=true; n.chatBeat=0;
        o.mind='chat'; o.chatWith=n; o.mindT=n.mindT; o.topic=tp; o.chatTurn=false; o.chatBeat=1.4; } }
    if(n.mind==='chat') continue;
    // --- night rest: drift home and doze after dark ---
    if(n.civ && !n.follow && !n.sheltering && n.mind!=='use' && n.mind!=='sleep' && clockPhase()==='night'){
      const h9=n.haunts&&n.haunts.home;
      if(h9 && len(h9.x-n.x,h9.y-n.y)<5 && (n.mind===undefined||n.mind==='idle') && rand(0,1)<0.07){ n.mind='sleep'; n.asleep=true; n.mindT=rand(5,12); n.moving=false; }
    }
    if(n.mind==='sleep'){ n.moving=false; n.mindT-=dt;
      if(clockPhase()!=='night' || (n.scaredT||0)>0){ n.mind='idle'; n.mindT=rand(.5,1.5); n.asleep=false; }
      else if(n.emoteT<=0 && rand(0,1)<0.01){ n.emote=pick(['…','Mmf…','*snore*']); n.emoteT=1.6; }
      continue; }
    // --- posted workers tend their station ---
    if(n.workFx && n.post && len(n.post.x-n.x,n.post.y-n.y)<1.8){
      n.mind='work'; n.moving=false; n.faceX=1; n.faceY=0;
      n.fxT=(n.fxT===undefined?rand(1,3):n.fxT)-dt;
      if(n.fxT<=0){ n.fxT=rand(2.6,4.6); npcWorkFx(n); if(n.emoteT<=0&&rand(0,1)<0.45){ n.emote=WORK_EMOTE[n.workFx]||'\u2692'; n.emoteT=1.0; } }
      if(rand(0,1)<0.003){ n.mind='walk'; n.goal=null; }   // a worker takes the occasional break
      continue; }
    // --- lingering at a well, fire, shrine or stall ---
    if(n.goal && n.willUse && n.mind!=='use' && len(n.goal.x-n.x,n.goal.y-n.y)<1.5){
      n.mind='use'; n.mindT=rand(3,6.5); n.willUse=false; n.moving=false; n.act=ACT_PROP[n.useKind]||'use';
      if(n.act==='drink') n.mindT=rand(4.5,9);
      if(n.useFace){ const s=len(n.useFace.x-n.x,n.useFace.y-n.y)||1; n.faceX=(n.useFace.x-n.x)/s; n.faceY=(n.useFace.y-n.y)/s; } }
    if(n.mind==='use'){ n.mindT-=dt; n.moving=false; const a9=n.act||'use';
      if(a9==='train' && rand(0,1)<0.07){ burst(n.x+n.faceX*0.8, n.y+n.faceY*0.6-0.2,[210,222,238],3,2.3); }                 // a practice cut
      else if(a9==='warm' && rand(0,1)<0.06){ for(let s9=0;s9<2;s9++) particles.push({x:n.x+rand(-.3,.3),y:n.y-0.3,vx:rand(-.15,.15),vy:-rand(.5,.9),life:rand(.6,1),max:1,color:[210,150,90],size:rand(2,4)}); }
      if(n.emoteT<=0 && rand(0,1)<0.06){ n.emote=rand(0,1)<0.7?pick(ACT_BARK[a9]||[n.useEmote||'…']):pick(tr.emo); n.emoteT=1.4; }
      if(n.mindT<=0){ if(a9==='drink') n.tipsy=rand(7,15); n.mind='idle'; n.mindT=rand(.8,2); n.goal=null; n.act=null; } continue; }
    // --- goal-directed life: stroll the streets, visit places, drift home ---
    if(!n.goal || len(n.goal.x-n.x,n.goal.y-n.y)<1.4){
      if(n.mind==='walk' && rand(0,1)<0.55){ n.mind='idle'; n.mindT=rand(1.2,4); n.moving=false; n.goal=null; n.willUse=false; }
      else { const fo=(rand(0,1)<0.32)?npcGather(n):null;
        const u=!fo&&(rand(0,1)<0.5)?npcUseProp(n):null;
        if(fo){ n.goal={x:fo.x,y:fo.y}; n.useEmote='\u266a'; n.useFace={x:fo.fx,y:fo.fy}; n.willUse=true; }
        else if(u){ n.goal={x:u.x,y:u.y}; n.useEmote=u.use; n.useFace={x:u.fx,y:u.fy}; n.useKind=u.kind; n.willUse=true; }
        else { n.goal=npcGoal(n); n.willUse=false; }
        n.mind='walk'; }
    }
    if(n.mind==='idle'){ n.mindT-=dt; n.moving=false;
      if(n.mindT<=0){ n.mind='walk'; n.goal=npcGoal(n); }
      else { if(rand(0,1)<0.012){ const a=rand(0,6.28); n.faceX=Math.cos(a); n.faceY=Math.sin(a); } continue; } }
    if(n.goal){ let gx=n.goal.x-n.x, gy=n.goal.y-n.y; const gd=len(gx,gy)||1; gx/=gd; gy/=gd;
      let sx=0,sy=0;                                                    // gently keep their distance from each other
      for(const o of npcs){ if(o===n) continue; const ddx=n.x-o.x; if(ddx>1.45||ddx<-1.45) continue; const ddy=n.y-o.y; if(ddy>1.45||ddy<-1.45) continue; const d2=ddx*ddx+ddy*ddy; if(d2<2.0 && d2>0.0001){ const inv=0.7/Math.sqrt(d2); sx+=ddx*inv; sy+=ddy*inv; } }
      const mvx=gx+sx, mvy=gy+sy, ml=len(mvx,mvy)||1; n.faceX=mvx/ml; n.faceY=mvy/ml;
      if(n.tipsy>0){ const w=Math.sin(s_now()/150+n.x*3)*0.5, px=-n.faceY, py=n.faceX; n.faceX+=px*w; n.faceY+=py*w; const wl=len(n.faceX,n.faceY)||1; n.faceX/=wl; n.faceY/=wl; }
      n.x+=n.faceX*n.spd*dt; n.y+=n.faceY*n.spd*dt; collideWalls(n); n.moving=true;
      const anchor=n.post||n.home, ad=len(anchor.x-n.x,anchor.y-n.y), amax=n.civ ? (n.post?n.post.r+34:46) : (n.post?n.post.r+12:22);
      if(ad>amax) n.goal={x:anchor.x+rand(-3,3), y:anchor.y+rand(-2,2)};
    }
  }

  if(toastT>0) toastT-=dt;
  if(shake>0) shake=Math.max(0,shake-dt*2.2);
  clearPressed();
}
function clearPressed(){ for(const k in justPressed) delete justPressed[k]; }

function s_now(){ return (typeof performance!=='undefined'?performance.now():0); }
// ---------- Render ----------
let ox=0, oy=0;
function w2s(wx,wy){ return [ (wx-player.x)*SCALE+W/2+ox, (wy-player.y)*SCALE+H/2+oy ]; }
function titleCardRect(i){ const cols=4, rows=2, gap=10, side=Math.max(16,W*0.04);
  const cw=(W-side*2-gap*(cols-1))/cols, ch=Math.min(60,(H*0.24-gap)/rows);
  const x0=side, y0=H-rows*ch-(rows-1)*gap-16;
  return [x0+(i%cols)*(cw+gap), y0+Math.floor(i/cols)*(ch+gap), cw, ch]; }
// v201 Tower Hall: a clickable menu strip seated in the free band below the feats line (roster row1 bottom = H/2+130; feats ~H/2+193)
function buildHomeMenu(){ const sv=loadRun(); const cont=!!(sv&&sv.floor>1); const m=[];
  m.push({label:'START', key:'Enter', act:'play', enabled:true, accent:'#8fe06a'});
  if(cont){ m.push({label:'CONTINUE  F'+sv.floor, key:'C', act:'continue', enabled:true, accent:'#9fd0ff'});
            m.push({label:'SWITCH HERO', key:'H', act:'swap', enabled:true, accent:'#ecd070'}); }
  m.push({label:'SETTINGS', key:'S', act:'settings', enabled:true, accent:'#c8d2eb'});
  return m; }
function homeMenuRect(i,n){ const w=Math.min(360,W-120), h=52, gap=14, total=n*h+(n-1)*gap, x0=(W-w)/2, y0=H*0.5-total/2+24; return [x0, y0+i*(h+gap), w, h]; }
function heroBackRect(){ return [14, 14, 96, 30]; }
// deterministic 2D hash -> uint32 (stable per world cell, so ground never shimmers)
function hash2(x,y){ let h=(x*374761393 + y*668265263) ^ 0x5bf03635; h=Math.imul(h^(h>>>13),1274126177); return (h^(h>>>16))>>>0; }
function macroNoise(wx,wy){                                    // smooth 3-octave value noise, 0..1 — terrain field for the wilds
  let v=0, amp=1, tot=0, L=46;
  for(let o=0;o<3;o++){
    const gx=Math.floor(wx/L), gy=Math.floor(wy/L), fx=wx/L-gx, fy=wy/L-gy;
    const h=(a,b)=>((hash2(a,b)&4095)/4095);
    const a=h(gx,gy), b=h(gx+1,gy), c=h(gx,gy+1), d=h(gx+1,gy+1);
    const sx=fx*fx*(3-2*fx), sy=fy*fy*(3-2*fy);
    v += (a+(b-a)*sx+(c-a)*sy+(a-b-c+d)*sx*sy)*amp; tot+=amp; amp*=0.5; L*=0.45;
  }
  return v/tot;
}
const SUBSTRATE=[ [64,50,38], null, [48,64,46], [74,70,56] ];   // packed dirt / base stone / mossy / pale dust (nudge targets)
function hex3(h){ h=h.replace('#',''); return parseInt(h.slice(0,2),16)+','+parseInt(h.slice(2,4),16)+','+parseInt(h.slice(4,6),16); }
// per-realm ground/biome look (index matches REALMS order)
const BIOME=[   // palettes tuned for the dark stone tile: moss, dust and ember — not open meadow
  { style:'grass',  det1:'#44563a', det2:'#5e7a4a', lift:'#8a937e', wall:'stone'   },   // 0 Trial Grounds
  { style:'leaf',   det1:'#33502e', det2:'#4e7a40', lift:'#7e9378', wall:'hedge'   },   // 1 Verdant Jungle
  { style:'cobble', det1:'#3e4a5c', det2:'#5c7088', lift:'#8e9aac', wall:'brick'   },   // 2 Human Empire
  { style:'crack',  det1:'#54402e', det2:'#7a5838', lift:'#a08a70', wall:'wood'    },   // 3 Orc Empire
  { style:'grass',  det1:'#3a5638', det2:'#567a4e', lift:'#86987e', wall:'hedge'   },   // 4 Elves Forest
  { style:'ember',  det1:'#5c2424', det2:'#e8662e', lift:'#c08a6b', wall:'crystal' },   // 5 魔物 Empire
  { style:'cobble', det1:'#6a6452', det2:'#9a906e', lift:'#b0a890', wall:'marble'  },   // 6 Two Families
  { style:'rune',   det1:'#4e3a78', det2:'#a888e0', lift:'#9a8ab8', wall:'crystal' },   // 7 Court of Upper Beings
  { style:'cobble', det1:'#3a4a58', det2:'#6a8aa0', lift:'#90a4b4', wall:'marble'  },   // 8 Hall of Echoes
  { style:'mote',   det1:'#8a7444', det2:'#e0c890', lift:'#c0ae84', wall:'marble'  },   // 9 Tower's Crown
];
function hexA(h){ h=h.replace('#',''); return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]; }
function biomeNow(){ return BIOME[realmIndex(floor)] || BIOME[0]; }
// painterly pass: soft mottle + biome detail, clipped to the floor regions, viewport-bounded
function paintGround(){
  if(!floors.length) return;
  ctx.save(); ctx.beginPath();
  for(const fl of floors){ if(fl.water||fl.hazard||fl.spring) continue; const[sx,sy]=w2s(fl.x-fl.w/2,fl.y-fl.h/2); ctx.rect(sx,sy,fl.w*SCALE,fl.h*SCALE); }
  ctx.clip();
  const bi=biomeNow();
  const ri0=realmIndex(floor);
  { const CT=12, TWU=2/3, CW=CT*TWU, px=Math.round(SCALE*TWU);   // twelve small stones per 8-unit chunk
    const cx0=Math.floor((player.x-(W/2)/SCALE-1)/CW), cx1=Math.floor((player.x+(W/2)/SCALE+1)/CW);
    const cy0=Math.floor((player.y-(H/2)/SCALE-1)/CW), cy1=Math.floor((player.y+(H/2)/SCALE+1)/CW);
    for(let cy=cy0;cy<=cy1;cy++) for(let cx=cx0;cx<=cx1;cx++){
      const key=cx+','+cy;
      let ch=TILE_CHUNKS.get(key);
      if(!ch){ ch=bakeChunk(cx,cy,CT,px,ri0,TWU); TILE_CHUNKS.set(key,ch);
        if(TILE_CHUNKS.size>140) TILE_CHUNKS.delete(TILE_CHUNKS.keys().next().value); }
      const[sx9,sy9]=w2s(cx*CW, cy*CW);
      ctx.drawImage(ch, sx9, sy9, CW*SCALE, CW*SCALE);
    } }
  // faction districts wash their own banner colour onto each room's floor (clipped to the floor regions)
  for(const fl of floors){ if(!fl.dtint) continue; const[dx9,dy9]=w2s(fl.x-fl.w/2,fl.y-fl.h/2); ctx.fillStyle='rgba('+fl.dtint+',0.17)'; ctx.fillRect(dx9,dy9,fl.w*SCALE,fl.h*SCALE); }
  ctx.fillStyle='rgba('+hex3(bi.det1)+',0.03)'; ctx.fillRect(0,0,W,H);   // faint realm colour wash over the stone
  ctx.restore();
}

function rect(wx,wy,ww,wh,fill){ const[sx,sy]=w2s(wx-ww/2,wy-wh/2); ctx.fillStyle=fill; ctx.fillRect(sx,sy,ww*SCALE,wh*SCALE); }
function rgb(a){ return `rgb(${a[0]},${a[1]},${a[2]})`; }
// ---------- Procedural sprite images ----------
// Every character is generated ONCE into an offscreen canvas (a real image) and cached.
function shade(c,f){ const m=f<0?0:255, t=Math.abs(f);
  return 'rgb('+Math.round(c[0]+(m-c[0])*t)+','+Math.round(c[1]+(m-c[1])*t)+','+Math.round(c[2]+(m-c[2])*t)+')'; }
const spriteCache={};
// ---- optional image assets: put PNGs in web/assets/ and they replace the generated art ----
// naming: hero_<Class>.png, npc_<kind>.png, mob_<species>.png, boss_f<floor>.png, champ_<1-4>.png (face RIGHT, transparent bg)
const IMG_CACHE={};
function assetImg(key){
  if(IMG_CACHE[key]!==undefined) return IMG_CACHE[key]||null;   // false = missing/still loading -> use generated art
  IMG_CACHE[key]=false;
  const im=new Image();
  im.onload=()=>{ let done=false; const reg=()=>{ if(done) return; done=true; IMG_CACHE[key]=im; warmQ.push({im,key}); };
    if(im.decode){ im.decode().then(reg).catch(reg); setTimeout(reg,250); } else reg(); };   // decode off-thread, but never block on it (hidden tabs starve decode())
  im.onerror=()=>{ IMG_CACHE[key]=false; };
  im.src='assets/'+key+'.png?v='+ASSET_VER;
  return null;
}
// ---- frame animation: assets/anim/<key>_<state>_<n>.png  (n = 1,2,3... up to 16) ----
// states: 'idle', 'walk' (and 'attack' for heroes). Missing state falls back to idle,
// missing animation falls back to the static assets/<key>.png, then to generated art.
const ANIM_VER='20';   // bump when animation frames are re-exported
const ASSET_VER='4';   // bump when static assets are re-exported
const ANIM_CACHE={};
function animFrames(key,state){
  const ck=key+'_'+state;
  if(ANIM_CACHE[ck]!==undefined) return ANIM_CACHE[ck];   // false = none, array = ready, null = probing
  ANIM_CACHE[ck]=null;
  const frames=[];
  const probe=(n)=>{ const im=new Image();
    im.onload=()=>{ let done=false; const reg=()=>{ if(done) return; done=true; frames.push(im); warmQ.push({im,key:ck}); if(n<16) probe(n+1); else ANIM_CACHE[ck]=frames; };
      if(im.decode){ im.decode().then(reg).catch(reg); setTimeout(reg,250); } else reg(); };
    im.onerror=()=>{ ANIM_CACHE[ck]=frames.length?frames:false; };
    im.src='assets/anim/'+ck+'_'+n+'.png?v='+ANIM_VER; };
  probe(1);
  return null;
}
// plays ~10fps; adjacent frames are crossfaded for perceived smoothness; each entity
// gets a random phase so crowds don't animate in lockstep
function drawAnim(frames, ent, x, y, targetH, flip){
  if(ent._aph===undefined) ent._aph=Math.random()*100;
  if(frames.length===1){ drawAsset(frames[0],x,y,targetH,flip); return; }
  const t=s_now()/1000*10 + ent._aph;
  const i=Math.floor(t)%frames.length, j=(i+1)%frames.length, frac=t-Math.floor(t);
  // nearest frame fully opaque so the body never goes see-through (no ground / ghost-pose bleed);
  // the next frame is blended softly on top purely for motion smoothness
  if(frac<0.5){ drawAsset(frames[i],x,y,targetH,flip); drawAsset(frames[j],x,y,targetH,flip,frac*0.6); }
  else { drawAsset(frames[j],x,y,targetH,flip); drawAsset(frames[i],x,y,targetH,flip,(1-frac)*0.6); }
}
// plays a frame set ONCE across prog 0..1 (used for deliberate one-shot attack swings)
function drawAnimOnce(frames, x, y, targetH, flip, prog){
  if(frames.length===1){ drawAsset(frames[0],x,y,targetH,flip); return; }
  const t=Math.max(0,Math.min(0.9999,prog))*(frames.length-1);
  const i=Math.floor(t), j=Math.min(frames.length-1,i+1), frac=t-i;
  if(j===i || frac<=0){ drawAsset(frames[i],x,y,targetH,flip); return; }
  // opaque base = no idle/background showing through the attacking hero; light overlay smooths the swing
  if(frac<0.5){ drawAsset(frames[i],x,y,targetH,flip); drawAsset(frames[j],x,y,targetH,flip,frac*0.5); }
  else { drawAsset(frames[j],x,y,targetH,flip); drawAsset(frames[i],x,y,targetH,flip,(1-frac)*0.5); }
}
const SPRCACHE=new Map();   // pre-scaled offscreen sprites: kills per-frame rescale + browser re-decode hitching
const GLOWS={}, VSTRIPS={};
function glowSprite(r,g,b){ const k=r+','+g+','+b; if(GLOWS[k]) return GLOWS[k];
  const c=document.createElement('canvas'); c.width=c.height=128; const g2=c.getContext('2d');
  const gr=g2.createRadialGradient(64,64,0,64,64,64); gr.addColorStop(0,'rgba('+r+','+g+','+b+',1)'); gr.addColorStop(1,'rgba('+r+','+g+','+b+',0)');
  g2.fillStyle=gr; g2.fillRect(0,0,128,128); return GLOWS[k]=c; }
function drawGlow(x,y,rad,r,g,b,a){ const p=ctx.globalAlpha; ctx.globalAlpha=p*a; ctx.drawImage(glowSprite(r,g,b), x-rad, y-rad, rad*2, rad*2); ctx.globalAlpha=p; }
let SHADOW_SPR=null;
function shadowSprite(){ if(SHADOW_SPR) return SHADOW_SPR; const c=document.createElement('canvas'); c.width=c.height=64; const g2=c.getContext('2d');
  const gr=g2.createRadialGradient(32,32,0,32,32,32); gr.addColorStop(0,'rgba(0,0,8,.55)'); gr.addColorStop(.55,'rgba(0,0,8,.30)'); gr.addColorStop(1,'rgba(0,0,8,0)');
  g2.fillStyle=gr; g2.fillRect(0,0,64,64); return SHADOW_SPR=c; }
function contactShadow(sx,sy,rw,rh,a){ const p=ctx.globalAlpha; ctx.globalAlpha=p*(a===undefined?1:a); ctx.drawImage(shadowSprite(), sx-rw, sy-rh, rw*2, rh*2); ctx.globalAlpha=p; }
function bakeOutline(c){                                            // dark contour + cool top rim, baked once into the cached sprite
  const S=c.width, g=c.getContext('2d');
  const tmp=document.createElement('canvas'); tmp.width=S; tmp.height=S; const tg=tmp.getContext('2d');
  tg.drawImage(c,0,0); tg.globalCompositeOperation='source-in'; tg.fillStyle='rgba(10,9,15,1)'; tg.fillRect(0,0,S,S);
  g.globalCompositeOperation='destination-over';
  const o=Math.max(1.5,S*0.013);
  for(let a=0;a<8;a++){ const ang=a/8*Math.PI*2; g.drawImage(tmp, Math.cos(ang)*o, Math.sin(ang)*o); }
  g.globalCompositeOperation='source-atop';
  const rg=g.createLinearGradient(0,0,0,S*0.55); rg.addColorStop(0,'rgba(196,218,255,.20)'); rg.addColorStop(1,'rgba(196,218,255,0)');
  g.fillStyle=rg; g.fillRect(0,0,S,S);
  g.globalCompositeOperation='source-over';
}
const TILE_CHUNKS=new Map();   // ground baked in world chunks: every tile wholly one colour, edges on the grout
let TILE_STYLE={ mix:0.05, base:[   // per-realm stone, distinct but kept dark so characters read
  [52,52,57],   // 0 Trial      — neutral granite
  [42,53,45],   // 1 Jungle     — mossy green-stone
  [43,50,63],   // 2 Empire     — cool blue flagstone
  [63,52,41],   // 3 Horde      — warm sandstone
  [43,57,53],   // 4 Elves      — pale teal-stone
  [59,42,45],   // 5 魔物       — ember basalt
  [65,59,46],   // 6 Families   — golden sandstone
  [49,42,64],   // 7 Court      — violet basalt
  [44,51,60],   // 8 Echoes     — steel slate
  [64,59,46],   // 9 Crown      — gold marble
]};
function chunkRegion(x,y,roads,pads){
  for(const f of roads){ if(Math.abs(x-f.x)<f.w/2 && Math.abs(y-f.y)<f.h/2) return 1; }
  for(const f of pads){ if(Math.abs(x-f.x)<f.w/2 && Math.abs(y-f.y)<f.h/2) return 2; }
  const SW=1.35;                                                          // a pale footpath hugs each road's long edges
  for(const f of roads){ if(f.w>=f.h){ if(Math.abs(x-f.x)<f.w/2 && Math.abs(y-f.y)<f.h/2+SW) return 3; }
    else { if(Math.abs(y-f.y)<f.h/2 && Math.abs(x-f.x)<f.w/2+SW) return 3; } }
  return 0;
}
function bakeChunk(cx,cy,CT,px,ri,TWU){
  const acc=(REALMS[ri]||REALMS[0]).accent;
  const rb=(TILE_STYLE.base&&TILE_STYLE.base[ri])||[44,44,50];
  const SETS=[
    { b:rb, mix:TILE_STYLE.mix },                                          // 0 base flagstone
    { b:[rb[0]*.4+54, rb[1]*.4+40, rb[2]*.4+28], mix:.04 },                // 1 road — warm worn cobble (clearly distinct)
    { b:[rb[0]+26, rb[1]+25, rb[2]+27], mix:.06 },                         // 2 settlement slab — pale dressed stone
    { b:[rb[0]+38, rb[1]+37, rb[2]+39], mix:.06 },                         // 3 sidewalk — pale dressed footpath flanking the road
  ];
  const c=document.createElement('canvas'); c.width=c.height=CT*px; const g=c.getContext('2d');
  g.fillStyle='#0d0d14'; g.fillRect(0,0,CT*px,CT*px);                      // dark mortar bed = baked AO in the gaps
  const m=(b,a,f)=>Math.round(b+(a-b)*f);
  const wx0=(cx*CT-3)*TWU, wy0=(cy*CT-3)*TWU, wx1=((cx+1)*CT+3)*TWU, wy1=((cy+1)*CT+3)*TWU;
  const roads=[], pads=[];
  for(const f of floors){ if(f.base||f.water||f.hazard||f.spring) continue;
    if(f.x+f.w/2<wx0||f.x-f.w/2>wx1||f.y+f.h/2<wy0||f.y-f.h/2>wy1) continue;
    (f.road?roads:pads).push(f); }
  for(let r=-1;r<=CT;r++){
    const row=cy*CT+r;
    for(let t=-1;t<=CT;t++){
      const col=cx*CT+t, qx=(col+0.5)*TWU, qy=(row+0.5)*TWU;
      const reg=chunkRegion(qx,qy,roads,pads), S9=SETS[reg];
      const hv=hash2(col*5+ri*131+reg*97, row*7+ri*17+reg*131);
      const fine=((hv&15)/15-0.5)*9;
      const coarse=hash2((col>>3)+ri*131, (row>>3)+ri*53), zone=((coarse&63)/63-0.5)*17 + ((hash2((col>>1)+ri*61,(row>>1)+ri*29)&15)/15-0.5)*5;   // big tonal patches + medium grain = worn, non-gridded stone
      let r0=m(S9.b[0]+fine+zone,acc[0],S9.mix), g0=m(S9.b[1]+fine+zone,acc[1],S9.mix), b0=m(S9.b[2]+fine+zone,acc[2],S9.mix);
      if(reg===0){ const mv=macroNoise(qx,qy);                                              // the wilds become mottled terrain
        const sub = mv<0.30?SUBSTRATE[0] : mv<0.56?null : mv<0.79?SUBSTRATE[2] : SUBSTRATE[3];
        if(sub){ const sf=0.24; r0=Math.round(r0+(sub[0]-r0)*sf); g0=Math.round(g0+(sub[1]-g0)*sf); b0=Math.round(b0+(sub[2]-b0)*sf); }
        const lift=Math.max(-22,Math.min(22,(mv-macroNoise(qx-TWU,qy-TWU))*120));            // ridges catch light, hollows pool shadow — stronger relief
        r0=Math.max(8,Math.min(122,r0+lift)); g0=Math.max(8,Math.min(122,g0+Math.round(lift*0.96))); b0=Math.max(8,Math.min(122,b0+Math.round(lift*0.82))); }
      let eL=false,eR=false,eU=false,eD=false;
      if(reg===1){ const eK=(xx,yy)=>{ const z=chunkRegion(xx,yy,roads,pads); return z===0||z===3; };   // kerb where carriageway meets footpath or wild
        eL=eK(qx-TWU,qy); eR=eK(qx+TWU,qy); eU=eK(qx,qy-TWU); eD=eK(qx,qy+TWU);
        if(eL||eR||eU||eD){ r0=Math.round(r0*.9); g0=Math.round(g0*.9); b0=Math.round(b0*.9); } }
      else if(reg===2){ eL=chunkRegion(qx-TWU,qy,roads,pads)===0; eR=chunkRegion(qx+TWU,qy,roads,pads)===0;
        eU=chunkRegion(qx,qy-TWU,roads,pads)===0; eD=chunkRegion(qx,qy+TWU,roads,pads)===0; }
      else if(reg===3){ eL=chunkRegion(qx-TWU,qy,roads,pads)===0; eR=chunkRegion(qx+TWU,qy,roads,pads)===0;   // soft footpath edge against the wild
        eU=chunkRegion(qx,qy-TWU,roads,pads)===0; eD=chunkRegion(qx,qy+TWU,roads,pads)===0; }
      const X=t*px, Y=r*px;
      if(reg===1){                                                          // ----- cobblestone road: small rounded setts, running bond -----
        g.save(); g.beginPath(); g.rect(X,Y,px,px); g.clip();
        const gp=1.7, nc=2, cw3=px/nc;
        for(let ccy=0;ccy<nc;ccy++){ const ofx=((row*nc+ccy)&1)?cw3*0.5:0;
          for(let ccx=-1;ccx<=nc;ccx++){
            const ch3=hash2((col*nc+ccx)*13+ri*97, (row*nc+ccy)*7+97);
            const cvv=((ch3&7)/7-0.5)*16;
            const cr=m(Math.max(10,r0+cvv),acc[0],S9.mix), cgc=m(Math.max(10,g0+cvv),acc[1],S9.mix), cbc=m(Math.max(10,b0+cvv),acc[2],S9.mix);
            const ox=X+ccx*cw3+ofx+gp/2, oy=Y+ccy*cw3+gp/2, ow=cw3-gp, oh=cw3-gp, rr3=Math.min(ow,oh)*0.32;
            g.fillStyle='rgb('+cr+','+cgc+','+cbc+')';
            if(g.roundRect){ g.beginPath(); g.roundRect(ox,oy,ow,oh,rr3); g.fill(); } else g.fillRect(ox,oy,ow,oh);
            g.fillStyle='rgba(255,255,255,.11)'; if(g.roundRect){ g.beginPath(); g.roundRect(ox,oy,ow,oh*0.46,rr3); g.fill(); }   // lit crown
            g.fillStyle='rgba(0,0,0,.34)'; g.fillRect(ox, oy+oh-1.7, ow, 1.7); }   // base shadow between setts
        }
        g.restore();
      } else {                                                              // ----- flagstone slab (base & plaza) -----
        const jl=0.5+((hv>>16)&3)*0.45, jt=0.5+((hv>>18)&3)*0.45,
              jr=0.5+((hv>>20)&3)*0.45, jb=0.5+((hv>>22)&3)*0.45;
        const SX=X+jl, SY=Y+jt, SW=px-jl-jr, SH=px-jt-jb;
        g.fillStyle='rgb('+r0+','+g0+','+b0+')'; g.fillRect(SX,SY,SW,SH);
        if(reg===0 && ((hv>>13)&7)===0){ g.fillStyle='rgba(74,92,58,.15)'; g.fillRect(SX,SY+SH*0.45,SW,SH*0.55); }   // moss
        g.fillStyle='rgba(255,255,255,.07)'; g.fillRect(SX,SY,SW,1.3); g.fillRect(SX,SY,1.3,SH);
        g.fillStyle='rgba(0,0,0,.34)'; g.fillRect(SX,SY+SH-1.4,SW,1.4); g.fillRect(SX+SW-1.4,SY,1.4,SH);
        for(let s=0;s<3;s++){ const sp=hash2(hv&1023, s*29+7);
          g.fillStyle=(sp&8192)?'rgba(0,0,0,.15)':'rgba(255,255,255,.05)';
          g.beginPath(); g.arc(SX+2+(sp&31)/31*(SW-4), SY+2+((sp>>5)&31)/31*(SH-4), 0.7+((sp>>10)&3)*0.4, 0, 7); g.fill(); }
        if(((hv>>6)&7)===0){ g.strokeStyle='rgba(0,0,0,.28)'; g.lineWidth=1; g.beginPath();
          let kx=SX+4+((hv>>9)&15)/15*(SW-8), ky=SY+3; g.moveTo(kx,ky);
          for(let s2=0;s2<3;s2++){ kx+=(((hv>>(s2*3+3))&7)/7-0.5)*7; ky+=(SH-6)/3; g.lineTo(kx,ky); } g.stroke(); }
      }
      if(((hv>>4)&63)===0){ g.save(); g.translate(X+px/2,Y+px/2); g.rotate(Math.PI/4);     // rare accent inlay (a detail, not a grid motif)
        g.strokeStyle='rgba('+acc[0]+','+acc[1]+','+acc[2]+',.14)'; g.lineWidth=1; g.strokeRect(-3,-3,6,6); g.restore(); }
      if(eU||eD||eL||eR){                                              // clean solid curb hugging the boundary
        const lip=(reg===2)?'rgba(150,154,168,.92)':'rgba(156,142,114,.92)', LW=2.6;
        g.fillStyle=lip;
        if(eU) g.fillRect(X,Y,px,LW); if(eD) g.fillRect(X,Y+px-LW,px,LW);
        if(eL) g.fillRect(X,Y,LW,px); if(eR) g.fillRect(X+px-LW,Y,LW,px);
        g.fillStyle='rgba(255,255,255,.16)';                            // lit top of the curb stone
        if(eU) g.fillRect(X,Y,px,0.9); if(eL) g.fillRect(X,Y,0.9,px);
        g.fillStyle='rgba(0,0,0,.46)';                                  // gutter seam at the very edge
        if(eU) g.fillRect(X,Y,px,0.9); if(eD) g.fillRect(X,Y+px-0.9,px,0.9);
        if(eL) g.fillRect(X,Y,0.9,px); if(eR) g.fillRect(X+px-0.9,Y,0.9,px);
      }
    }
  }
  return c;
}
function vstrip(c0,c1){ const k=c0+'|'+c1; if(VSTRIPS[k]) return VSTRIPS[k];
  const c=document.createElement('canvas'); c.width=2; c.height=64; const g2=c.getContext('2d');
  const gr=g2.createLinearGradient(0,0,0,64); gr.addColorStop(0,c0); gr.addColorStop(1,c1);
  g2.fillStyle=gr; g2.fillRect(0,0,2,64); return VSTRIPS[k]=c; }
let warmQ=[];               // images waiting to be pre-bucketed off the critical path
function spriteFor(im, targetH){
  if(!im.width || im.width<=targetH*DPR*1.4) return im;
  const bucket=Math.min(640, Math.ceil(targetH*DPR/16)*16);
  const key=(im.src||'')+'@'+bucket;
  let c=SPRCACHE.get(key);
  if(!c){ const hh=bucket, ww=Math.max(1,Math.round(im.width/im.height*hh));
    c=document.createElement('canvas'); c.width=ww; c.height=hh;
    c.getContext('2d').drawImage(im,0,0,ww,hh); SPRCACHE.set(key,c);
    if(SPRCACHE.size>500){ SPRCACHE.delete(SPRCACHE.keys().next().value); } }
  return c;
}
function drawAsset(im, x, y, targetH, flip, alpha){
  const w=im.width/im.height*targetH;
  const src=spriteFor(im, targetH);
  ctx.save();
  if(alpha!==undefined) ctx.globalAlpha*=alpha;
  else if(!CHAR_NOCONTOUR){ ctx.shadowColor='rgba(5,7,13,0.62)'; ctx.shadowBlur=Math.max(3,targetH*0.05); ctx.shadowOffsetX=0; ctx.shadowOffsetY=0; }   // unified dark contour — every character reads as one cohesive set against any backdrop
  ctx.translate(x,y); ctx.scale(flip||1,1); ctx.drawImage(src,-w/2,-targetH/2,w,targetH); ctx.restore();
}
let CHAR_NOCONTOUR=false;   // (escape hatch — UI sprites that shouldn't get the world contour can set this)
function getSprite(look,col,px,opts){
  opts=opts||{};
  const key=look+'|'+col.join()+'|'+Math.round(px)+'|'+(opts.crown?'c':'');
  if(spriteCache[key]) return spriteCache[key];
  const S=Math.ceil(px*4.8), c=document.createElement('canvas'); c.width=S; c.height=S;
  const g=c.getContext('2d');
  drawCharacter(g,S/2,S/2,px,look,col,opts);
  bakeOutline(c); spriteCache[key]=c; return c;
}
function gBlob(g,x,y,rx,ry,col,rot){ // shaded, outlined body mass
  g.save(); g.translate(x,y); if(rot) g.rotate(rot);
  const grd=g.createRadialGradient(-rx*.35,-ry*.45,rx*.15,0,0,Math.max(rx,ry)*1.2);
  grd.addColorStop(0,shade(col,.45)); grd.addColorStop(.55,shade(col,.02)); grd.addColorStop(1,shade(col,-.28));
  g.fillStyle=grd; g.beginPath(); g.ellipse(0,0,rx,ry,0,0,7); g.fill();
  g.lineWidth=Math.max(1.5,rx*.09); g.strokeStyle=shade(col,-.55); g.stroke(); g.restore();
}
function gEyes(g,x,y,R,opt){ opt=opt||{};
  const er=Math.max(2,R*(opt.big?.2:.14)), ex=R*(opt.wide?.42:.3);
  g.fillStyle=opt.hollow?'rgba(10,14,28,.9)':'#fff';
  g.beginPath(); g.arc(x-ex,y,er,0,7); g.arc(x+ex,y,er,0,7); g.fill();
  if(!opt.hollow){ g.fillStyle='#16202c'; g.beginPath(); g.arc(x-ex+er*.25,y,er*.45,0,7); g.arc(x+ex+er*.25,y,er*.45,0,7); g.fill();
    g.fillStyle='rgba(255,255,255,.9)'; g.beginPath(); g.arc(x-ex-er*.25,y-er*.3,er*.2,0,7); g.arc(x+ex-er*.25,y-er*.3,er*.2,0,7); g.fill(); }
}
function gTri(g,x1,y1,x2,y2,x3,y3,fill){ g.fillStyle=fill; g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.lineTo(x3,y3); g.closePath(); g.fill(); }
function gCrown(g,x,y,R){ g.fillStyle='#ffd34d'; g.strokeStyle='#8a6a1a'; g.lineWidth=1.5;
  g.beginPath(); g.moveTo(x-R*.42,y); g.lineTo(x-R*.42,y-R*.3); g.lineTo(x-R*.2,y-R*.12); g.lineTo(x,y-R*.38);
  g.lineTo(x+R*.2,y-R*.12); g.lineTo(x+R*.42,y-R*.3); g.lineTo(x+R*.42,y); g.closePath(); g.fill(); g.stroke(); }

// The character artist. Faces RIGHT; the renderer flips for direction.
function drawCharacter(g,cx,cy,R,look,col,opts){
  opts=opts||{};
  const dark=shade(col,-.5), lite=shade(col,.4);
  switch(look){
    case 'beast': { // quadruped hunter: haunch, head, ears, tail, legs
      g.strokeStyle=dark; g.lineWidth=Math.max(2,R*.16); g.beginPath();
      g.moveTo(cx-R*.8,cy+R*.1); g.quadraticCurveTo(cx-R*1.6,cy-R*.5,cx-R*1.3,cy-R*.9); g.stroke(); // tail
      for(const lx of [-R*.45,-R*.05,R*.4]) gBlob(g,cx+lx,cy+R*.75,R*.18,R*.3,col);                 // legs
      gBlob(g,cx-R*.1,cy,R*.95,R*.62,col);                                                          // body
      gBlob(g,cx+R*.75,cy-R*.35,R*.5,R*.45,col);                                                    // head
      gTri(g,cx+R*.45,cy-R*.6,cx+R*.55,cy-R*1.05,cx+R*.8,cy-R*.65,g.fillStyle);                     // ears keep the head's gradient
      gTri(g,cx+R*.85,cy-R*.68,cx+R*1.05,cy-R*1.0,cx+R*1.1,cy-R*.6,g.fillStyle);
      gBlob(g,cx+R*1.15,cy-R*.25,R*.22,R*.16,col);                                                  // snout
      g.fillStyle='#1c1410'; g.beginPath(); g.arc(cx+R*1.3,cy-R*.3,R*.08,0,7); g.fill();            // nose
      gEyes(g,cx+R*.8,cy-R*.45,R*.55); break; }
    case 'slime': {
      gBlob(g,cx,cy+R*.1,R*1.0,R*.85,col);
      gBlob(g,cx+R*.1,cy-R*.55,R*.28,R*.2,col);                                                     // drip
      gEyes(g,cx,cy-R*.05,R,{big:true});
      g.strokeStyle=dark; g.lineWidth=2; g.beginPath(); g.arc(cx,cy+R*.35,R*.25,.2,Math.PI-.2); g.stroke(); break; }
    case 'frog': {
      gBlob(g,cx,cy+R*.15,R*.95,R*.7,col);
      gBlob(g,cx-R*.45,cy-R*.55,R*.3,R*.3,col); gBlob(g,cx+R*.45,cy-R*.55,R*.3,R*.3,col);           // eye stalks
      g.fillStyle='#fff'; g.beginPath(); g.arc(cx-R*.45,cy-R*.6,R*.16,0,7); g.arc(cx+R*.45,cy-R*.6,R*.16,0,7); g.fill();
      g.fillStyle='#16202c'; g.beginPath(); g.arc(cx-R*.42,cy-R*.6,R*.08,0,7); g.arc(cx+R*.48,cy-R*.6,R*.08,0,7); g.fill();
      gBlob(g,cx-R*.65,cy+R*.6,R*.3,R*.16,col); gBlob(g,cx+R*.65,cy+R*.6,R*.3,R*.16,col);           // feet
      g.strokeStyle=dark; g.lineWidth=2; g.beginPath(); g.moveTo(cx-R*.3,cy+R*.3); g.quadraticCurveTo(cx,cy+R*.45,cx+R*.3,cy+R*.3); g.stroke(); break; }
    case 'bug': {
      g.fillStyle='rgba(255,255,255,.30)';                                                          // wings
      g.beginPath(); g.ellipse(cx-R*.5,cy-R*.55,R*.6,R*.28,-.7,0,7); g.fill();
      g.beginPath(); g.ellipse(cx+R*.5,cy-R*.55,R*.6,R*.28,.7,0,7); g.fill();
      gBlob(g,cx,cy,R*.7,R*.55,col); gBlob(g,cx+R*.6,cy-R*.1,R*.4,R*.35,col);
      g.strokeStyle=dark; g.lineWidth=2; g.beginPath();
      g.moveTo(cx+R*.7,cy-R*.4); g.lineTo(cx+R*.9,cy-R*.9); g.moveTo(cx+R*.5,cy-R*.4); g.lineTo(cx+R*.5,cy-R*.95); g.stroke();
      gEyes(g,cx+R*.6,cy-R*.15,R*.5); break; }
    case 'plant': {
      g.fillStyle='#2f7a2f';
      g.beginPath(); g.ellipse(cx-R*.5,cy-R*.85,R*.5,R*.18,-.7,0,7); g.fill();
      g.beginPath(); g.ellipse(cx+R*.5,cy-R*.85,R*.5,R*.18,.7,0,7); g.fill();
      g.beginPath(); g.ellipse(cx,cy-R*1.05,R*.16,R*.42,0,0,7); g.fill();
      gBlob(g,cx,cy+R*.05,R*.9,R*.8,col);
      gEyes(g,cx,cy-R*.05,R);
      g.strokeStyle=dark; g.lineWidth=2; g.beginPath(); g.arc(cx,cy+R*.35,R*.2,.3,Math.PI-.3); g.stroke(); break; }
    case 'ghost': {
      g.globalAlpha=.92; gBlob(g,cx,cy-R*.1,R*.85,R*.8,col);
      g.fillStyle=shade(col,-.05);                                                                  // wavy hem
      g.beginPath(); g.moveTo(cx-R*.85,cy+R*.1);
      for(let i=0;i<4;i++){ const x=cx-R*.85+(i+.5)*R*.425; g.quadraticCurveTo(x,cy+R*(i%2?1.0:.75),cx-R*.85+(i+1)*R*.425,cy+R*.55); }
      g.lineTo(cx+R*.85,cy+R*.1); g.closePath(); g.fill();
      gEyes(g,cx,cy-R*.15,R,{hollow:true}); g.globalAlpha=1; break; }
    case 'bat': {
      for(const sgn of [-1,1]){ g.fillStyle=shade(col,-.15);                                        // ribbed wings
        g.beginPath(); g.moveTo(cx+sgn*R*.4,cy-R*.1);
        g.quadraticCurveTo(cx+sgn*R*1.5,cy-R*.9,cx+sgn*R*1.7,cy-R*.1);
        g.quadraticCurveTo(cx+sgn*R*1.3,cy+R*.05,cx+sgn*R*1.1,cy+R*.25);
        g.quadraticCurveTo(cx+sgn*R*.8,cy+R*.05,cx+sgn*R*.4,cy+R*.3); g.closePath(); g.fill(); }
      gBlob(g,cx,cy,R*.6,R*.55,col);
      gTri(g,cx-R*.35,cy-R*.4,cx-R*.45,cy-R*.85,cx-R*.1,cy-R*.5,g.fillStyle);
      gTri(g,cx+R*.35,cy-R*.4,cx+R*.45,cy-R*.85,cx+R*.1,cy-R*.5,g.fillStyle);
      gEyes(g,cx,cy-R*.1,R*.7);
      g.fillStyle='#fff'; gTri(g,cx-R*.15,cy+R*.25,cx-R*.05,cy+R*.45,cx,cy+R*.25,'#fff'); gTri(g,cx+R*.15,cy+R*.25,cx+R*.05,cy+R*.45,cx,cy+R*.25,'#fff'); break; }
    case 'spirit': {
      const a=g.createRadialGradient(cx,cy,R*.1,cx,cy,R*1.5);
      a.addColorStop(0,'rgba(255,255,255,.95)'); a.addColorStop(.4,shade(col,.2)); a.addColorStop(1,'rgba(0,0,0,0)');
      g.fillStyle=a; g.beginPath(); g.arc(cx,cy,R*1.5,0,7); g.fill();
      g.strokeStyle='rgba(255,255,255,.7)'; g.lineWidth=2; g.beginPath(); g.ellipse(cx,cy-R*1.05,R*.55,R*.16,0,0,7); g.stroke();
      gEyes(g,cx,cy-R*.05,R*.8); break; }
    case 'dragon': {
      for(const sgn of [-1,1]){ g.fillStyle=shade(col,-.12);
        g.beginPath(); g.moveTo(cx+sgn*R*.3,cy-R*.2);
        g.quadraticCurveTo(cx+sgn*R*1.4,cy-R*1.2,cx+sgn*R*1.75,cy-R*.3);
        g.quadraticCurveTo(cx+sgn*R*1.2,cy-R*.05,cx+sgn*R*.4,cy+R*.15); g.closePath(); g.fill(); }
      g.strokeStyle=dark; g.lineWidth=Math.max(2,R*.14);                                            // tail
      g.beginPath(); g.moveTo(cx-R*.7,cy+R*.3); g.quadraticCurveTo(cx-R*1.4,cy+R*.7,cx-R*1.6,cy+R*.3); g.stroke();
      gBlob(g,cx,cy,R*.85,R*.7,col);
      gBlob(g,cx+R*.75,cy-R*.45,R*.45,R*.38,col); gBlob(g,cx+R*1.15,cy-R*.4,R*.25,R*.16,col);       // head + snout
      gTri(g,cx+R*.55,cy-R*.75,cx+R*.6,cy-R*1.15,cx+R*.85,cy-R*.8,'#efe6c8');
      gTri(g,cx+R*.85,cy-R*.75,cx+R*.95,cy-R*1.05,cx+R*1.1,cy-R*.7,'#efe6c8');
      g.fillStyle='#f3e9c9'; g.beginPath(); g.ellipse(cx,cy+R*.25,R*.5,R*.3,0,0,7); g.fill();        // belly
      gEyes(g,cx+R*.8,cy-R*.5,R*.5); break; }
    case 'imp': {
      g.strokeStyle=dark; g.lineWidth=Math.max(2,R*.13);                                            // tail w/ tip
      g.beginPath(); g.moveTo(cx-R*.5,cy+R*.4); g.quadraticCurveTo(cx-R*1.2,cy+R*.6,cx-R*1.25,cy); g.stroke();
      gTri(g,cx-R*1.35,cy+R*.1,cx-R*1.15,cy-R*.05,cx-R*1.18,cy+R*.25,dark);
      gBlob(g,cx,cy+R*.2,R*.7,R*.65,col);                                                           // body
      gBlob(g,cx,cy-R*.5,R*.5,R*.45,col);                                                           // head
      g.strokeStyle=lite; g.lineWidth=Math.max(2.5,R*.16);                                          // horns
      g.beginPath(); g.moveTo(cx-R*.3,cy-R*.8); g.quadraticCurveTo(cx-R*.7,cy-R*1.2,cx-R*.45,cy-R*1.45); g.stroke();
      g.beginPath(); g.moveTo(cx+R*.3,cy-R*.8); g.quadraticCurveTo(cx+R*.7,cy-R*1.2,cx+R*.45,cy-R*1.45); g.stroke();
      gEyes(g,cx,cy-R*.55,R*.6); break; }
    case 'mage': {
      g.fillStyle=shade(col,-.2);                                                                   // robe
      g.beginPath(); g.moveTo(cx-R*.7,cy+R*.9); g.lineTo(cx-R*.3,cy-R*.3); g.lineTo(cx+R*.3,cy-R*.3); g.lineTo(cx+R*.7,cy+R*.9); g.closePath(); g.fill();
      g.strokeStyle=dark; g.lineWidth=2; g.stroke();
      gBlob(g,cx,cy-R*.5,R*.42,R*.4,[235,205,175]);                                                 // face
      g.fillStyle=shade(col,-.35);                                                                  // hat
      gTri(g,cx-R*.75,cy-R*.72,cx+R*.75,cy-R*.72,cx+R*.1,cy-R*1.6,shade(col,-.35));
      g.fillStyle=lite; g.fillRect(cx-R*.75,cy-R*.8,R*1.5,R*.14);
      g.strokeStyle='#7a5a2a'; g.lineWidth=Math.max(2,R*.12);                                       // staff
      g.beginPath(); g.moveTo(cx+R*.75,cy+R*.9); g.lineTo(cx+R*.75,cy-R*.7); g.stroke();
      g.fillStyle=lite; g.beginPath(); g.arc(cx+R*.75,cy-R*.85,R*.18,0,7); g.fill();
      gEyes(g,cx,cy-R*.55,R*.55); break; }
    case 'knight': {
      g.strokeStyle='#999fae'; g.lineWidth=Math.max(2,R*.14);                                       // sword
      g.beginPath(); g.moveTo(cx+R*.7,cy+R*.6); g.lineTo(cx+R*1.2,cy-R*.7); g.stroke();
      g.fillStyle='#777d8c'; g.fillRect(cx+R*.62,cy+R*.05,R*.4,R*.1);
      gBlob(g,cx,cy+R*.15,R*.72,R*.68,col);                                                         // armored body
      g.fillStyle='rgba(255,255,255,.18)'; g.beginPath(); g.ellipse(cx-R*.2,cy,R*.3,R*.45,0,0,7); g.fill();
      gBlob(g,cx,cy-R*.55,R*.45,R*.4,[150,158,175]);                                                // helm
      g.fillStyle='#2a2f3a'; g.fillRect(cx-R*.38,cy-R*.66,R*.76,R*.16);                              // visor
      g.fillStyle='#d44a4a'; g.fillRect(cx-R*.07,cy-R*1.25,R*.14,R*.5);                              // plume
      gBlob(g,cx-R*.75,cy+R*.1,R*.3,R*.4,col.map(v=>Math.round(v*.8)));                             // shield
      break; }
    case 'elf': {
      g.fillStyle=shade(col,-.15);                                                                  // tunic
      g.beginPath(); g.moveTo(cx-R*.5,cy+R*.9); g.lineTo(cx-R*.25,cy-R*.25); g.lineTo(cx+R*.25,cy-R*.25); g.lineTo(cx+R*.5,cy+R*.9); g.closePath(); g.fill();
      gBlob(g,cx,cy-R*.5,R*.4,R*.38,[235,210,180]);                                                 // face
      gTri(g,cx-R*.38,cy-R*.55,cx-R*.95,cy-R*.75,cx-R*.35,cy-R*.75,'#ebd2b4'); // ears
      gTri(g,cx+R*.38,cy-R*.55,cx+R*.95,cy-R*.75,cx+R*.35,cy-R*.75,'#ebd2b4');
      g.fillStyle=shade(col,.1); g.beginPath(); g.arc(cx,cy-R*.72,R*.4,Math.PI,0); g.fill();         // hair
      g.strokeStyle='#7a5a2a'; g.lineWidth=2;                                                        // bow
      g.beginPath(); g.arc(cx+R*.8,cy,R*.5,-1.1,1.1); g.stroke();
      g.beginPath(); g.moveTo(cx+R*.8+R*.5*Math.cos(-1.1),cy+R*.5*Math.sin(-1.1)); g.lineTo(cx+R*.8+R*.5*Math.cos(1.1),cy+R*.5*Math.sin(1.1)); g.stroke();
      gEyes(g,cx,cy-R*.55,R*.5); break; }
    case 'nest': {
      gBlob(g,cx,cy+R*.15,R*1.05,R*.7,col);
      g.fillStyle='rgba(245,240,225,.92)';
      for(const e of [[-.4,-.1],[.35,-.15],[0,.2]]){ g.beginPath(); g.ellipse(cx+e[0]*R,cy+e[1]*R,R*.22,R*.3,0,0,7); g.fill();
        g.strokeStyle='rgba(120,100,80,.5)'; g.lineWidth=1.5; g.stroke(); }
      break; }
    default: { gBlob(g,cx,cy,R*.95,R*.85,col); gEyes(g,cx,cy-R*.1,R); }
  }
  if(opts.crown) gCrown(g,cx,cy-R*1.5,R);
}

// hero sprites per class + villager sprites per NPC kind
function drawHero(g,cx,cy,R,cls){
  if(cls==='Ranger'){ // hooded archer
    g.fillStyle='#2e4d33'; g.beginPath(); g.moveTo(cx-R*.55,cy+R*.9); g.lineTo(cx-R*.3,cy-R*.3); g.lineTo(cx+R*.3,cy-R*.3); g.lineTo(cx+R*.55,cy+R*.9); g.closePath(); g.fill();
    gBlob(g,cx,cy-R*.5,R*.42,R*.4,[225,195,165]);
    g.fillStyle='#3a6342'; g.beginPath(); g.arc(cx,cy-R*.55,R*.5,Math.PI*.95,Math.PI*2.05); g.fill();   // hood
    g.strokeStyle='#7a5a2a'; g.lineWidth=2.5; g.beginPath(); g.arc(cx+R*.85,cy,R*.55,-1.15,1.15); g.stroke();
    g.beginPath(); g.moveTo(cx+R*.85+R*.55*Math.cos(-1.15),cy+R*.55*Math.sin(-1.15)); g.lineTo(cx+R*.85+R*.55*Math.cos(1.15),cy+R*.55*Math.sin(1.15)); g.stroke();
    gEyes(g,cx,cy-R*.52,R*.5);
  } else if(cls==='Rogue'){ // scarfed knife-fighter
    g.fillStyle='#3a3a46'; g.beginPath(); g.moveTo(cx-R*.5,cy+R*.9); g.lineTo(cx-R*.28,cy-R*.3); g.lineTo(cx+R*.28,cy-R*.3); g.lineTo(cx+R*.5,cy+R*.9); g.closePath(); g.fill();
    gBlob(g,cx,cy-R*.5,R*.4,R*.38,[225,195,165]);
    g.fillStyle='#8c2f3a'; g.fillRect(cx-R*.42,cy-R*.32,R*.84,R*.2);                                  // scarf
    g.fillStyle='#2a2a35'; g.beginPath(); g.arc(cx,cy-R*.62,R*.42,Math.PI,0); g.fill();                // hood-cap
    for(const sgn of [-1,1]){ g.strokeStyle='#aab2c2'; g.lineWidth=2.5;                                // daggers
      g.beginPath(); g.moveTo(cx+sgn*R*.6,cy+R*.4); g.lineTo(cx+sgn*R*.95,cy-R*.15); g.stroke(); }
    gEyes(g,cx,cy-R*.52,R*.5);
  }
}
function drawFolk(g,cx,cy,R,kind,col){
  const skin=[228,194,162];
  g.fillStyle=shade(col,-.58);                                                                       // feet
  g.fillRect(cx-R*.26,cy+R*.78,R*.2,R*.27); g.fillRect(cx+R*.06,cy+R*.78,R*.2,R*.27);
  { const tgr=g.createLinearGradient(cx,cy-R*.3,cx,cy+R*.9); tgr.addColorStop(0,shade(col,.16)); tgr.addColorStop(1,shade(col,-.24)); g.fillStyle=tgr; }   // tunic, lit top to shadowed hem
  g.beginPath(); g.moveTo(cx-R*.55,cy+R*.9); g.quadraticCurveTo(cx-R*.42,cy-R*.08,cx-R*.28,cy-R*.26); g.lineTo(cx+R*.28,cy-R*.26); g.quadraticCurveTo(cx+R*.42,cy-R*.08,cx+R*.55,cy+R*.9); g.closePath(); g.fill();
  g.strokeStyle=shade(col,-.45); g.lineWidth=2; g.stroke();
  g.fillStyle='rgba(0,0,0,.09)'; g.fillRect(cx-R*.035,cy-R*.18,R*.07,R*1.02);                         // a soft centre fold
  g.fillStyle=shade(col,-.5); g.fillRect(cx-R*.42,cy+R*.32,R*.84,R*.12);                              // belt
  g.lineCap='round'; g.lineWidth=R*.22; g.strokeStyle=shade(col,-.16);                               // arms
  g.beginPath(); g.moveTo(cx-R*.3,cy-R*.12); g.lineTo(cx-R*.5,cy+R*.4); g.stroke();
  g.beginPath(); g.moveTo(cx+R*.3,cy-R*.12); g.lineTo(cx+R*.5,cy+R*.4); g.stroke();
  g.fillStyle='rgb('+skin[0]+','+skin[1]+','+skin[2]+')';                                            // hands
  g.beginPath(); g.arc(cx-R*.5,cy+R*.42,R*.1,0,7); g.arc(cx+R*.5,cy+R*.42,R*.1,0,7); g.fill();
  g.lineCap='butt'; g.lineWidth=1;
  gBlob(g,cx,cy-R*.5,R*.4,R*.4,skin);                                                                // face
  const hsh=(kind.charCodeAt(0)+kind.charCodeAt(kind.length-1))%4;                                   // a cap of hair (pro headwear draws over it)
  g.fillStyle=shade([[78,54,36],[54,40,30],[148,128,96],[120,120,128]][hsh],0);
  g.beginPath(); g.arc(cx,cy-R*.6,R*.43,Math.PI*1.03,Math.PI*1.97); g.fill();
  gEyes(g,cx,cy-R*.5,R*.5);
  switch(kind){
    case 'guard': g.fillStyle='#8a93a6'; g.beginPath(); g.arc(cx,cy-R*.6,R*.42,Math.PI,0); g.fill(); g.fillStyle='#d44a4a'; g.fillRect(cx-R*.05,cy-R*1.2,R*.1,R*.35);
      g.strokeStyle='#7a5a2a'; g.lineWidth=2.5; g.beginPath(); g.moveTo(cx+R*.7,cy+R*.9); g.lineTo(cx+R*.7,cy-R*1.0); g.stroke(); gTri(g,cx+R*.6,cy-R*1.0,cx+R*.8,cy-R*1.0,cx+R*.7,cy-R*1.3,'#aab2c2'); break;
    case 'merchant': g.fillStyle='#caa64a'; g.beginPath(); g.arc(cx+R*.6,cy+R*.4,R*.25,0,7); g.fill(); g.fillStyle='#8a6a1a'; g.fillRect(cx+R*.5,cy+R*.18,R*.2,R*.1); break;
    case 'healer': g.fillStyle='#e8f0e8'; g.beginPath(); g.arc(cx,cy-R*.66,R*.4,Math.PI,0); g.fill(); g.fillStyle='#d44a4a'; g.fillRect(cx-R*.06,cy-R*.05,R*.12,R*.4); g.fillRect(cx-R*.2,cy+R*.05,R*.4,R*.12); break;
    case 'smith': g.fillStyle='#5a4a3a'; g.fillRect(cx-R*.3,cy-R*.1,R*.6,R*.8); g.strokeStyle='#777d8c'; g.lineWidth=3; g.beginPath(); g.moveTo(cx+R*.65,cy+R*.5); g.lineTo(cx+R*.85,cy-R*.4); g.stroke(); g.fillStyle='#555c68'; g.fillRect(cx+R*.7,cy-R*.6,R*.34,R*.22); break;
    case 'sage': g.fillStyle='#e8e8f0'; g.beginPath(); g.moveTo(cx-R*.25,cy-R*.3); g.lineTo(cx+R*.25,cy-R*.3); g.lineTo(cx,cy+R*.25); g.closePath(); g.fill(); break; // beard
    case 'scholar': g.strokeStyle='#333'; g.lineWidth=1.5; g.beginPath(); g.arc(cx-R*.15,cy-R*.52,R*.12,0,7); g.arc(cx+R*.15,cy-R*.52,R*.12,0,7); g.stroke(); g.fillStyle='#7a4a2a'; g.fillRect(cx-R*.75,cy+R*.1,R*.4,R*.3); break; // glasses+book
    case 'cook': g.fillStyle='#f2f2f2'; g.fillRect(cx-R*.3,cy-R*1.05,R*.6,R*.4); g.beginPath(); g.arc(cx-R*.2,cy-R*1.05,R*.16,0,7); g.arc(cx,cy-R*1.12,R*.18,0,7); g.arc(cx+R*.2,cy-R*1.05,R*.16,0,7); g.fill(); break;
    case 'gambler': g.fillStyle='#fff'; g.fillRect(cx+R*.5,cy-R*.1,R*.3,R*.42); g.strokeStyle='#c33'; g.strokeRect(cx+R*.5,cy-R*.1,R*.3,R*.42); break;
    case 'bard': g.fillStyle='#3a7a6a'; g.beginPath(); g.arc(cx,cy-R*.6,R*.4,Math.PI,0); g.fill(); gTri(g,cx+R*.2,cy-R*.9,cx+R*.6,cy-R*1.25,cx+R*.35,cy-R*.8,'#e8d44a'); g.fillStyle='#7a5a2a'; g.beginPath(); g.ellipse(cx-R*.65,cy+R*.3,R*.22,R*.32,-.4,0,7); g.fill(); break;
    case 'monk': g.fillStyle='#caa'; g.beginPath(); g.arc(cx,cy-R*.62,R*.36,Math.PI,0); g.fill(); g.fillStyle='#9a8a5a'; for(let i=0;i<4;i++){ g.beginPath(); g.arc(cx-R*.3+i*R*.2,cy+R*.05,R*.07,0,7); g.fill(); } break;
    case 'innkeep': g.fillStyle='#caa64a'; g.fillRect(cx+R*.5,cy-R*.15,R*.26,R*.34); g.fillStyle='#f2e8d8'; g.fillRect(cx+R*.5,cy-R*.22,R*.26,R*.1); break; // mug
    case 'farmer': g.fillStyle='#d8b85a'; g.beginPath(); g.ellipse(cx,cy-R*.6,R*.62,R*.16,0,0,7); g.fill(); g.beginPath(); g.arc(cx,cy-R*.68,R*.34,Math.PI,0); g.fill(); break; // straw hat
    case 'quester': g.fillStyle='#ffb850'; gTri(g,cx+R*.55,cy-R*1.1,cx+R*.55,cy-R*.5,cx+R*1.05,cy-R*.8,'#ffb850'); g.strokeStyle='#7a5a2a'; g.lineWidth=2; g.beginPath(); g.moveTo(cx+R*.55,cy+R*.9); g.lineTo(cx+R*.55,cy-R*1.15); g.stroke(); break; // banner
case 'watchman': g.fillStyle='#8a93a6'; g.beginPath(); g.arc(cx,cy-R*.6,R*.4,Math.PI,0); g.fill(); break;
    case 'priest': g.fillStyle='#efe9da'; g.beginPath(); g.arc(cx,cy-R*.62,R*.42,Math.PI,0); g.fill(); g.fillStyle='#caa64a'; g.fillRect(cx-R*.05,cy-R*.1,R*.1,R*.4); g.fillRect(cx-R*.16,cy,R*.32,R*.1); break;
    case 'enchanter': g.fillStyle='#4a2e6e'; gTri(g,cx-R*.6,cy-R*.5,cx+R*.6,cy-R*.5,cx+R*.05,cy-R*1.3,'#4a2e6e'); break;
    case 'fisher': g.strokeStyle='#7a5a2a'; g.lineWidth=2; g.beginPath(); g.moveTo(cx+R*.5,cy+R*.6); g.lineTo(cx+R*.95,cy-R*.9); g.stroke(); g.beginPath(); g.moveTo(cx+R*.95,cy-R*.9); g.lineTo(cx+R*.95,cy-R*.3); g.stroke(); break;
    case 'arenamaster': g.fillStyle='#8a4a2e'; g.beginPath(); g.arc(cx,cy-R*.6,R*.42,Math.PI,0); g.fill(); g.fillStyle='#d44a4a'; g.fillRect(cx-R*.05,cy-R*1.15,R*.1,R*.45); break;
    case 'caravaneer': g.fillStyle='#b08a4a'; g.beginPath(); g.ellipse(cx,cy-R*.58,R*.6,R*.16,0,0,7); g.fill(); g.beginPath(); g.arc(cx,cy-R*.66,R*.3,Math.PI,0); g.fill(); break;
    case 'courier': g.fillStyle='#6a4e32'; g.fillRect(cx+R*.4,cy-R*.05,R*.36,R*.42); g.strokeStyle='#3e2e1e'; g.strokeRect(cx+R*.4,cy-R*.05,R*.36,R*.42); break;
    case 'storyteller': gTri(g,cx+R*.2,cy-R*.85,cx+R*.55,cy-R*1.2,cx+R*.32,cy-R*.75,'#e8d44a'); break;
    case 'miner': g.strokeStyle='#777d8c'; g.lineWidth=2.5; g.beginPath(); g.moveTo(cx+R*.6,cy+R*.5); g.lineTo(cx+R*.9,cy-R*.5); g.stroke(); g.beginPath(); g.arc(cx+R*.9,cy-R*.55,R*.22,Math.PI*.8,Math.PI*1.9); g.stroke(); break;
    case 'hermit': g.fillStyle='#5e645e'; g.beginPath(); g.arc(cx,cy-R*.55,R*.46,Math.PI*.95,Math.PI*2.05); g.fill(); break;
    case 'wanderer': g.fillStyle=shade(col,-.3); g.beginPath(); g.arc(cx,cy-R*.58,R*.47,Math.PI*.93,Math.PI*2.07); g.fill();   // travelling hood
      g.strokeStyle='#6a4e32'; g.lineWidth=2.5; g.beginPath(); g.moveTo(cx+R*.6,cy+R*.95); g.lineTo(cx+R*.66,cy-R*1.05); g.stroke();   // walking staff
      g.fillStyle='#7a5a36'; g.beginPath(); g.ellipse(cx-R*.6,cy+R*.34,R*.2,R*.26,-.3,0,7); g.fill(); break;   // satchel
    case 'villager': g.fillStyle=shade(col,-.34); g.fillRect(cx-R*.34,cy-R*.9,R*.68,R*.18); break;   // simple cap
    case 'child': g.fillStyle=shade([74,52,34],0); g.beginPath(); g.arc(cx,cy-R*.62,R*.4,Math.PI*.96,Math.PI*2.04); g.fill();   // mop of hair
      g.fillStyle='rgba(232,140,120,.5)'; g.beginPath(); g.arc(cx-R*.22,cy-R*.42,R*.09,0,7); g.arc(cx+R*.22,cy-R*.42,R*.09,0,7); g.fill();   // rosy cheeks
      g.fillStyle=shade(col,.12); g.fillRect(cx-R*.16,cy-R*.05,R*.32,R*.5); break; // bright smock front
  }
}
function getFolkSprite(kind,col,px){
  const key='folk:'+kind+'|'+col.join()+'|'+Math.round(px);
  if(spriteCache[key]) return spriteCache[key];
  const S=Math.ceil(px*4.8), c=document.createElement('canvas'); c.width=S; c.height=S;
  drawFolk(c.getContext('2d'),S/2,S/2,px,kind,col);
  bakeOutline(c); spriteCache[key]=c; return c;
}
function getHeroSprite(cls,px){
  const key='hero:'+cls+'|'+Math.round(px);
  if(spriteCache[key]) return spriteCache[key];
  const S=Math.ceil(px*4.8), c=document.createElement('canvas'); c.width=S; c.height=S;
  const g=c.getContext('2d');
  if(cls==='Ranger'||cls==='Rogue') drawHero(g,S/2,S/2,px,cls);
  else drawCharacter(g,S/2,S/2,px, cls==='Mage'?'mage':'knight', cls==='Mage'?[120,140,235]:[90,130,210], {});
  bakeOutline(c); spriteCache[key]=c; return c;
}

// ===== PROCEDURAL PIXEL HEROES (Trial Towers 3.0) =====================
// Each of the 8 classes is drawn from a compact spec onto a tiny native-res
// canvas (20x26, gorilla 24x24), given a hard 1px ink outline, and cached per
// (class, state, frame). Blitted scaled-up with smoothing off for crisp pixels.
const HEROPX={};
function heroSpec(key){
  const S={
    Knight:{ skin:'#caa07a', hat:'helm', metal:'#aeb6c4', metalDk:'#727a8c', shirt:'#3a5fb0', pants:'#2a2f44', boots:'#3a3a48', weapon:'sword', wcol:'#dfe6f0', accent:'#5478c8' },
    Ranger:{ skin:'#c79a6e', hair:'#5a3a22', hat:'hood', hatcol:'#3d6b3a', shirt:'#3d6b3a', pants:'#46402c', boots:'#352b1c', cloak:'#2f5230', weapon:'bow', wcol:'#9a6a38', accent:'#7bd06a' },
    Mage:{ skin:'#caa07a', hat:'wizard', hatcol:'#39499a', shirt:'#3f57c0', robe:'#3f57c0', pants:'#2c356e', boots:'#23204a', weapon:'staff', wcol:'#8a6a3a', orb:'#7fd0ff', accent:'#9ab4ff' },
    Rogue:{ skin:'#b48a64', hat:'hood', hatcol:'#2a2c38', shirt:'#2f313e', pants:'#24252f', boots:'#1b1c24', cloak:'#23242e', mask:true, weapon:'daggers', wcol:'#cfd6e2', accent:'#8a96b4' },
    Gorilla:{ fur:'#3a322b', furDk:'#241f1a', face:'#7a6656', big:true, weapon:'fists', accent:'#7a6a58' },
    Vampire:{ skin:'#e6dde6', hair:'#16131c', shirt:'#1a1620', pants:'#15121a', boots:'#100e16', cloak:'#2a0d14', capelin:'#7a1020', fang:true, weapon:'none', accent:'#d23a52' },
    Joker:{ skin:'#ece7df', hat:'jester', hatA:'#6a3aa0', hatB:'#3aa05a', shirt:'#6a3aa0', shirt2:'#3aa05a', pants:'#2a2440', boots:'#221c34', weapon:'cards', wcol:'#ffffff', accent:'#c0a0ff' },
    Necromancer:{ skin:'#c8c2cc', hat:'hood', hatcol:'#2a2236', shirt:'#2c2438', robe:'#2c2438', pants:'#221c30', boots:'#181426', cloak:'#221a30', skull:true, weapon:'scythe', wcol:'#9aa0ac', accent:'#a06ae0' }
  };
  return S[key]||S.Knight;
}
function drawApe(tg, spec, state, frame){
  const R=(x,y,w,h,c)=>{ if(!c) return; tg.fillStyle=c; tg.fillRect(x,y,w,h); };
  let armR=0, bob=0;
  if(state==='walk'){ const k=frame&3; armR=(k===0?-1:k===2?1:0); bob=(k&1)?0:1; }
  else if(state==='attack'){ armR=frame===0?-2:3; }
  else { bob=frame%2?0:1; }
  // legs
  R(7,18+bob,4,6,spec.furDk); R(13,18+bob,4,6,spec.furDk);
  // torso (big, hunched)
  R(6,8+bob,12,11,spec.fur); R(6,8+bob,12,1,'rgba(255,255,255,.08)');
  R(9,11+bob,6,6,spec.face);                 // chest/belly patch
  // arms (long, knuckle reach)
  R(3,9+bob,3,12,spec.fur); R(2,20+bob,4,3,spec.furDk);                 // back/left arm + fist
  R(18,9+bob+armR,3,12-armR,spec.fur); R(18,20+bob+armR,4,3,spec.furDk); // front/right arm + fist
  // head sunk into shoulders
  R(9,4+bob,6,6,spec.fur); R(10,6+bob,4,3,spec.face);
  R(10,6+bob,1,1,'#15110e'); R(13,6+bob,1,1,'#15110e');  // eyes
  R(9,4+bob,6,1,spec.furDk);                              // brow
}
function drawHumanoid(tg, spec, state, frame){
  if(spec.big) return drawApe(tg, spec, state, frame);
  const R=(x,y,w,h,c)=>{ if(!c) return; tg.fillStyle=c; tg.fillRect(x,y,w,h); };
  let bob=0, sl=0, sr=0, arm=0;
  if(state==='idle'){ bob=(frame%2)?1:0; }
  else if(state==='walk'){ const k=frame&3; bob=(k&1)?0:1; const s=(k===0?1:k===2?-1:0); sl=s; sr=-s; }
  else if(state==='attack'){ arm=(frame===0?-1:frame===1?2:4); }
  const body=spec.shirt||spec.robe||'#444';
  // cloak / cape (behind)
  if(spec.cloak){ R(5,9+bob,3,12,spec.cloak); R(4,12+bob,2,8,spec.cloak); if(spec.capelin) R(7,9+bob,1,11,spec.capelin); }
  // legs + boots
  R(7+sl,18,3,7,spec.pants); R(11+sr,18,3,7,spec.pants);
  R(7+sl,23,3,2,spec.boots); R(11+sr,23,3,2,spec.boots);
  // back arm
  R(5,10+bob,2,7,body); R(5,16+bob,2,2,spec.skin);
  // torso
  const ty=9+bob; R(6,ty,8,10,body);
  if(spec.robe) R(5,ty+8,10,4,spec.robe);              // robe flares (mage/necro)
  R(6,ty,8,1,'rgba(255,255,255,.12)');
  if(spec.accent) R(9,ty+1,2,8,spec.accent);            // center placket / sash
  // front arm (weapon hand)
  const ax=13+(state==='attack'?arm:0);
  R(ax,10+bob,2,7,body); R(ax,16+bob,2,2,spec.skin);
  // head
  const hy=2+bob; R(7,hy,7,7,spec.skin); R(7,hy,7,1,'rgba(255,255,255,.10)');
  if(spec.skull){ R(8,hy+2,2,2,'#1a1622'); R(11,hy+2,2,2,'#1a1622'); R(9,hy+5,3,1,'#1a1622'); }  // skull face
  else { R(11,hy+3,1,2,'#15121c'); if(spec.fang){ R(11,hy+5,1,1,'#d23a52'); R(11,hy+6,1,1,'#fff'); } }
  if(spec.mask) R(7,hy+3,7,1,'#15161c');                // rogue eye-mask band
  // headgear
  if(spec.hat==='helm'){ R(6,hy-1,8,4,spec.metal); R(6,hy+3,8,1,spec.metalDk); R(8,hy+2,4,1,'#0a0a10'); R(9,hy-2,2,1,spec.metalDk); }
  else if(spec.hat==='wizard'){ R(6,hy,8,1,spec.hatcol); R(7,hy-2,5,2,spec.hatcol); R(8,hy-5,3,3,spec.hatcol); R(9,hy-7,2,2,spec.hatcol); R(9,hy-3,1,1,'#ffd34d'); }
  else if(spec.hat==='hood'){ R(6,hy-1,8,4,spec.hatcol); R(6,hy+3,2,4,spec.hatcol); R(13,hy+3,1,3,spec.hatcol); }
  else if(spec.hat==='jester'){ R(6,hy-1,8,2,spec.hatA); R(4,hy-3,3,2,spec.hatA); R(13,hy-3,3,2,spec.hatB); R(4,hy-4,1,1,'#f0c450'); R(15,hy-4,1,1,'#f0c450'); }
  else if(spec.hair){ R(6,hy-1,8,2,spec.hair); R(6,hy+1,1,3,spec.hair); R(13,hy+1,1,3,spec.hair); }
  // weapon in front hand
  const w=spec.weapon, wc=spec.wcol;
  if(w==='sword'){ R(ax+1,5+bob,1,9,wc); R(ax,13+bob,3,1,'#6a4a2a'); }
  else if(w==='bow'){ R(ax+2,7+bob,1,11,wc); R(ax+1,7+bob,1,1,wc); R(ax+1,17+bob,1,1,wc); R(ax+3,9+bob,1,7,'rgba(230,230,230,.5)'); }
  else if(w==='staff'){ R(ax+1,5+bob,1,13,wc); R(ax,3+bob,3,3,spec.orb); R(ax+1,2+bob,1,1,'rgba(255,255,255,.7)'); }
  else if(w==='daggers'){ R(ax+1,12+bob,1,5,wc); R(6,16+bob,1,4,wc); }
  else if(w==='cards'){ R(ax+1,12+bob,2,3,wc); R(ax+1,12+bob,1,3,'#d23a52'); }
  else if(w==='scythe'){ R(ax+1,4+bob,1,15,wc); R(ax+2,4+bob,4,1,wc); R(ax+5,5+bob,1,3,wc); }
}
function pixelHeroSprite(cls, state, frame){
  const key=cls+'|'+state+'|'+frame;
  if(HEROPX[key]) return HEROPX[key];
  const spec=heroSpec(cls), big=spec.big, NW=big?24:20, NH=big?24:26, pad=2;
  const tw=document.createElement('canvas'); tw.width=NW; tw.height=NH;
  drawHumanoid(tw.getContext('2d'), spec, state, frame);
  const sil=document.createElement('canvas'); sil.width=NW; sil.height=NH; const sg=sil.getContext('2d');
  sg.drawImage(tw,0,0); sg.globalCompositeOperation='source-in'; sg.fillStyle=PAL.ink; sg.fillRect(0,0,NW,NH);
  const out=document.createElement('canvas'); out.width=NW+pad*2; out.height=NH+pad*2; const og=out.getContext('2d');
  for(const o of [[-1,0],[1,0],[0,-1],[0,1]]) og.drawImage(sil, pad+o[0], pad+o[1]);
  og.drawImage(tw, pad, pad);
  HEROPX[key]=out; return out;
}
// pick state+frame from player motion/attack, then return the cached sprite
function pixelHeroFor(cls, ent){
  let state='idle', frame=0;
  if(ent && ent.attackAnimT>0){ state='attack'; const prog=1-ent.attackAnimT/(ent.attackAnimDur||.5); frame=Math.min(2,Math.max(0,Math.floor(prog*3))); }
  else if(ent && ent.moving){ state='walk'; frame=Math.floor(s_now()/110 + (ent._aph||0)*4)&3; }
  else { state='idle'; frame=Math.floor(s_now()/420)%2; }
  return pixelHeroSprite(cls, state, frame);
}
// ===== KENNEY CC0 art pack (Roguelike Characters, public domain / CC0) =====
let ART_PACK='kenney';   // 'kenney' = Kenney CC0 spritesheet for heroes; 'pixel' = in-code procedural fallback
const KENNEY_T=16, KENNEY_S=17, KCACHE={};
const KENNEY_HERO={ Knight:[0,11], Ranger:[0,5], Mage:[1,5], Rogue:[0,8], Gorilla:[0,3], Vampire:[0,10], Joker:[1,7], Necromancer:[1,11] };  // [col,row] of kenney_char.png (16x16, 1px margin)
function kenneyTile(col,row,targetH){ const sheet=assetImg('kenney_char'); if(!sheet) return null;
  const scale=Math.max(1,Math.round((targetH||64)/KENNEY_T)), key=col+','+row+','+scale;
  if(KCACHE[key]) return KCACHE[key];
  const c=document.createElement('canvas'); c.width=c.height=KENNEY_T*scale; const g=c.getContext('2d'); g.imageSmoothingEnabled=false;
  g.drawImage(sheet, col*KENNEY_S,row*KENNEY_S,KENNEY_T,KENNEY_T, 0,0,c.width,c.height);
  KCACHE[key]=c; return c; }
// NPC type -> Kenney character tile [col,row] (full chars live in cols 0-1, rows 0-11). Thematic where it matters, else a stable hash pick.
const KENNEY_NPC={ merchant:[1,5],caravaneer:[1,5],pedlar:[0,7],trader:[1,5],healer:[1,5],priest:[1,11],monk:[1,11],acolyte:[1,5],sage:[1,11],scholar:[1,11],storyteller:[0,9],enchanter:[1,11],seer:[1,11],smith:[1,8],blacksmith:[1,8],guard:[0,11],watchman:[0,11],warden:[0,11],soldier:[0,11],knight:[0,11],arenamaster:[0,11],king:[1,11],queen:[1,5],noble:[0,5],crier:[0,9],busker:[0,7],dancer:[1,7],gambler:[0,8],hermit:[1,11],farmer:[0,7],fisher:[0,7],miner:[1,8],innkeep:[0,9],tavernkeep:[0,9],child:[0,0],urchin:[0,0],beggar:[0,2],wanderer:[0,7],villager:[0,7],peasant:[1,9],laborer:[1,8],washer:[1,7],pilgrim:[1,11],courier:[0,7],quester:[0,5],coinwraith:[0,2] };
function kenneyNpcTile(n){ const m=KENNEY_NPC[n.type]||KENNEY_NPC[n.spriteAs]; if(m) return m;
  let h=0; const s=(n.type||'x'); for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))|0; h=Math.abs(h); const idx=h%24; return [idx<12?0:1, idx%12]; }
// REWORKED hero art: ONE fully-animated character (SHADOW "Blind Huntress") for every class, kept distinct by a per-class hue tint.
// Full set sliced to web/assets/anim/hero_Huntress_<state>_<n>.png: idle/walk/dash/hit/death + directional attack (side/up/down) + dashatk/special.
const HERO_SPRITE={ Knight:'Huntress', Ranger:'Huntress', Mage:'Huntress', Rogue:'Huntress', Gorilla:'Huntress', Vampire:'Huntress', Joker:'Huntress', Necromancer:'Huntress' };
const HERO_TINT={ Knight:'#7e9cff', Ranger:'#79d07a', Mage:'#b07cff', Rogue:'#aab2c6', Gorilla:'#74d04a', Vampire:'#e2415e', Joker:'#e6952f', Necromancer:'#46d7b0' };
const HERO_RIG={ Huntress:{ anc:[0.5,0.617], kh:1 } };   // 240x128 frames: body centred (x~120), feet on the ground line (y~79)
function heroAnimKey(cls){ return 'hero_'+(HERO_SPRITE[cls]||cls); }
function heroRig(cls){ return HERO_RIG[HERO_SPRITE[cls]||cls]||{kh:1}; }
function heroTint(cls){ return HERO_TINT[cls]; }
function heroAttack(ak,dir){   // the directional swing frames for an aim direction (up/down, falling back to the side swing)
  const A=(s)=>{ const f=animFrames(ak,s); return f&&f.length?f:null; };
  const fr=(dir==='up'?A('attackup'):dir==='down'?A('attackdown'):null)||A('attack'); return fr?{fr}:null;
}
// preload the whole Huntress set at boot so sprites are ready before a run (no placeholder flash mid-game)
function preloadHeroArt(){ ['idle','walk','attack','attackup','attackdown','dash','dashatk','special','hit','death'].forEach(st=>animFrames('hero_Huntress',st)); }
preloadHeroArt();
const TINTCACHE={};
// recolour a sprite frame to a class hue (preserving its shading), masked to the sprite's alpha; cached
function tintFrame(img, col, kid){ if(!col) return img; if(TINTCACHE[kid]) return TINTCACHE[kid];
  const w=img.width||img.naturalWidth, h=img.height||img.naturalHeight; if(!w||!h) return img;
  const c=document.createElement('canvas'); c.width=w; c.height=h; const g=c.getContext('2d'); g.imageSmoothingEnabled=false;
  g.drawImage(img,0,0); g.globalCompositeOperation='color'; g.globalAlpha=0.72; g.fillStyle=col; g.fillRect(0,0,w,h);
  g.globalAlpha=1; g.globalCompositeOperation='destination-in'; g.drawImage(img,0,0); g.globalCompositeOperation='source-over';
  TINTCACHE[kid]=c; return c; }
// crop an image to its alpha bounding box (for portraits — fills the frame); cached
function trimImage(img, kid){ if(TINTCACHE[kid]) return TINTCACHE[kid]; const w=img.width||img.naturalWidth, h=img.height||img.naturalHeight; if(!w||!h) return img;
  const c=document.createElement('canvas'); c.width=w; c.height=h; const g=c.getContext('2d'); g.drawImage(img,0,0);
  let dt; try{ dt=g.getImageData(0,0,w,h).data; }catch(e){ return img; }
  let x0=w,y0=h,x1=-1,y1=-1; for(let y=0;y<h;y++)for(let x=0;x<w;x++){ if(dt[(y*w+x)*4+3]>16){ if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; } }
  if(x1<x0) return img; const cw=x1-x0+1, ch=y1-y0+1, o=document.createElement('canvas'); o.width=cw; o.height=ch;
  const og=o.getContext('2d'); og.imageSmoothingEnabled=false; og.drawImage(c,x0,y0,cw,ch,0,0,cw,ch); TINTCACHE[kid]=o; return o; }
// crisp (smoothing-off) animation: feet-anchored at (footX,footY), fixed scale K (consistent across anims of any frame size)
const FEET={};   // per-frame feet anchor {ax,ay,w,h} so animations lock to the feet (not the bbox centre, which an extended weapon would swing)
function feetOf(im){ const k=im.src; if(k && FEET[k]) return FEET[k];
  const w=im.width||im.naturalWidth, h=im.height||im.naturalHeight; let r={ax:w/2,ay:h,w,h};
  if(w&&h){ const c=document.createElement('canvas'); c.width=w; c.height=h; const g=c.getContext('2d'); g.drawImage(im,0,0);
    try{ const d=g.getImageData(0,0,w,h).data; let y1=-1; for(let y=h-1;y>=0&&y1<0;y--){ for(let x=0;x<w;x++){ if(d[(y*w+x)*4+3]>16){ y1=y; break; } } }
      if(y1>=0){ let sx=0,n=0; for(let y=Math.max(0,y1-4);y<=y1;y++)for(let x=0;x<w;x++){ if(d[(y*w+x)*4+3]>16){ sx+=x; n++; } } r={ax:n?sx/n:w/2, ay:y1+1, w, h}; } }catch(e){}
  }
  if(k) FEET[k]=r; return r; }
function drawHeroAnchored(frames,footX,footY,K,flip,prog,tint,cid,anc){ if(!frames||!frames.length) return;
  const sm=ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled=false; const rfx=Math.round(footX), rfy=Math.round(footY);
  const blit=(idx,alpha)=>{ const orig=frames[idx]; if(!orig) return; const ow=orig.width||orig.naturalWidth, oh=orig.height||orig.naturalHeight;
    const f=anc?{ax:ow*anc[0], ay:oh*anc[1], w:ow, h:oh}:feetOf(orig);   // anc=[fracX,fracY] fixed pivot (for rigs whose effects extend past the feet); else auto feet-anchor
    const im=tint?tintFrame(orig,tint,(cid||'')+idx):orig;
    ctx.save(); if(alpha<1) ctx.globalAlpha=alpha; ctx.translate(rfx,rfy); if(flip<0) ctx.scale(-1,1);
    ctx.drawImage(im, -f.ax*K, -f.ay*K, f.w*K, f.h*K); ctx.restore(); };
  let i,j,fr;
  if(prog!=null){ const p=clamp01(prog)*(frames.length-1); i=Math.floor(p); j=Math.min(frames.length-1,i+1); fr=p-i; }   // one-shot (attack/death/dash): interpolated across prog
  else if(frames.length<2){ i=j=0; fr=0; }
  else { const t=s_now()/1000*14; i=Math.floor(t)%frames.length; j=(i+1)%frames.length; fr=t-Math.floor(t); }            // looping (idle/walk): ~14fps with crossfade
  if(fr<0.5){ blit(i,1); if(j!==i) blit(j,fr*0.6); } else { blit(j,1); if(j!==i) blit(i,(1-fr)*0.6); }                    // nearest frame solid + soft blend of the next = smooth motion
  ctx.globalAlpha=1; ctx.imageSmoothingEnabled=sm; }
// like drawHeroAnchored but the sprite is centred at (cx,cy) and SPUN to point its forward (+x) along the aim angle (used for dash + attack so they face any direction); vertical-flip on left aims keeps it head-up
function drawHeroRot(frames,cx,cy,K,prog,tint,cid,ang){ if(!frames||!frames.length) return;
  const sm=ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled=false; const fV=Math.cos(ang)<0?-1:1, rcx=Math.round(cx), rcy=Math.round(cy);
  const blit=(idx,alpha)=>{ const orig=frames[idx]; if(!orig) return; const ow=orig.width||orig.naturalWidth, oh=orig.height||orig.naturalHeight;
    const im=tint?tintFrame(orig,tint,(cid||'')+idx):orig;
    ctx.save(); if(alpha<1) ctx.globalAlpha=alpha; ctx.translate(rcx,rcy); ctx.rotate(ang); ctx.scale(1,fV);
    ctx.drawImage(im, -ow*K/2, -oh*K/2, ow*K, oh*K); ctx.restore(); };
  const p=clamp01(prog)*(frames.length-1), i=Math.floor(p), j=Math.min(frames.length-1,i+1), fr=p-i;
  if(fr<0.5){ blit(i,1); if(j!==i) blit(j,fr*0.6); } else { blit(j,1); if(j!==i) blit(i,(1-fr)*0.6); }
  ctx.globalAlpha=1; ctx.imageSmoothingEnabled=sm; }
// portrait/card canvas for a hero — trimmed+tinted sprite-pack idle frame > Kenney tile > in-code pixel sprite
function heroSprite(cls){ const fr=animFrames(heroAnimKey(cls),'idle'); if(fr&&fr.length){ let im=trimImage(fr[0],'trim_'+heroAnimKey(cls)); const t=heroTint(cls); if(t) im=tintFrame(im,t,cls+'_p0'); return im; }
  if(ART_PACK==='kenney'){ const m=KENNEY_HERO[cls]; if(m && assetImg('kenney_char')){ const t=kenneyTile(m[0],m[1],96); if(t) return t; } }
  return pixelHeroSprite(cls,'idle',0); }

// a wall drawn as a solid structure: drop shadow, volume gradient, realm material, lit lip + outline
function drawWall(wl){
  if(wl.deco) return;                                                // collision-only landmark base; art is drawn by drawDeco
  const[wx,wy]=w2s(wl.x-wl.w/2, wl.y-wl.h/2), ww=wl.w*SCALE, wh=wl.h*SCALE;
  if(wx>W+30 || wy>H+30 || wx+ww<-30 || wy+wh<-30) return;          // off-screen cull
  if(wl.ruin){                                                       // collapsed masonry: stacked broken stones
    ctx.fillStyle='rgba(0,0,8,.25)'; ctx.fillRect(wx+3,wy+5,ww,wh);
    const hv9=hash2(Math.round(wl.x*7),Math.round(wl.y*7));
    const n9=2+(hv9&1)+(wl.w>2.4?1:0);
    for(let i9=0;i9<n9;i9++){ const sp=hash2(hv9,i9*31);
      const sw9=ww*(0.45+((sp&7)/7)*0.35), sh9=wh*(0.42+(((sp>>3)&7)/7)*0.34);
      const sx9=wx+((sp>>6)&15)/15*(ww-sw9), sy9=wy+((sp>>10)&15)/15*(wh-sh9);
      const v9=((sp>>14)&7)*3;
      ctx.fillStyle='rgb('+(63+v9)+','+(62+v9)+','+(69+v9)+')';
      if(ctx.roundRect){ ctx.beginPath(); ctx.roundRect(sx9,sy9,sw9,sh9,Math.min(sw9,sh9)*0.3); ctx.fill(); } else ctx.fillRect(sx9,sy9,sw9,sh9);
      ctx.fillStyle='rgba(255,255,255,.12)'; ctx.fillRect(sx9+2,sy9+2,sw9-4,2.5);
      ctx.fillStyle='rgba(0,0,0,.28)'; ctx.fillRect(sx9+2,sy9+sh9-3,sw9-4,3); }
    return; }
  const td = (wl.tier!=null) ? WALL_TIER[wl.tier] : null;
  const st = wl.door ? 'wood' : wl.vaultDoor ? 'marble' : (td&&td.tex) ? td.tex : (biomeNow().wall||'stone');
  const base = wl.door ? [124,92,52] : wl.vaultDoor ? [128,108,58] : (td&&td.col) ? hexA(td.col) : hexA(wallCol||'#46434f');
  ctx.fillStyle='rgba(0,0,0,.30)'; ctx.fillRect(wx+5, wy+6, ww, wh);             // drop shadow
  ctx.drawImage(vstrip(shade(base,0.20), shade(base,-0.30)), wx, wy, ww, wh);    // body volume (cached strip)
  ctx.save(); ctx.beginPath(); ctx.rect(wx,wy,ww,wh); ctx.clip(); wallTex(st,wx,wy,ww,wh,wl); ctx.restore();
  const lip=Math.max(2,Math.min(4,wh*.12));
  ctx.fillStyle='rgba(255,255,255,.20)'; ctx.fillRect(wx,wy,ww,lip);             // lit top lip
  ctx.fillStyle='rgba(0,0,0,.30)';      ctx.fillRect(wx,wy+wh-lip,ww,lip);       // grounded base
  ctx.strokeStyle='rgba(0,0,0,.40)'; ctx.lineWidth=1.5; ctx.strokeRect(wx+0.75,wy+0.75,ww-1.5,wh-1.5); ctx.lineWidth=1;
  if(wl.crack || (wl.brk && (wl.hp<wl.maxHp || wl.hitFlash>0))){ const fr=Math.max(0,(wl.hp||1)/(wl.maxHp||1));
    ctx.strokeStyle=(td&&td.crackCol)?td.crackCol:'rgba(30,22,16,.88)'; ctx.lineWidth=Math.max(1.5,ww*0.10);
    ctx.beginPath(); ctx.moveTo(wx+ww*0.5,wy); ctx.lineTo(wx+ww*0.34,wy+wh*0.42); ctx.lineTo(wx+ww*0.62,wy+wh*0.64); ctx.lineTo(wx+ww*0.44,wy+wh); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(wx+ww*0.5,wy+wh*0.42); ctx.lineTo(wx+ww*0.84,wy+wh*0.5); ctx.stroke(); ctx.lineWidth=1;
    if(wl.crack) ctx.fillStyle='rgba(255,220,120,'+(0.05+0.05*Math.sin(s_now()/1000*3)+0.20*(1-fr))+')';   // vault: treasure glow
    else ctx.fillStyle='rgba(0,0,0,'+(0.22*(1-fr)).toFixed(3)+')';                                        // structure: damage darkening
    ctx.fillRect(wx,wy,ww,wh);
    if(wl.hitFlash>0){ ctx.fillStyle='rgba(255,210,140,'+(wl.hitFlash*1.4)+')'; ctx.fillRect(wx,wy,ww,wh); }
  }
}
function wallTex(st, wx, wy, ww, wh, wl){
  const x0=Math.max(wx,-20), x1=Math.min(wx+ww,W+20), y0=Math.max(wy,-20), y1=Math.min(wy+wh,H+20);  // visible bounds (clip keeps it correct, this keeps it cheap)
  const seed=(Math.round(wl.x*13)^Math.round(wl.y*7))>>>0;
  if(st==='brick' || st==='stone'){
    const rh=Math.max(9, SCALE*0.34), step=(st==='brick'?rh*1.7:rh*1.2);
    ctx.strokeStyle='rgba(0,0,0,.20)'; ctx.lineWidth=1;
    for(let y=wy+rh; y<wy+wh; y+=rh){ if(y<y0||y>y1) continue; ctx.beginPath(); ctx.moveTo(x0,y); ctx.lineTo(x1,y); ctx.stroke(); }
    let row=0;
    for(let y=wy; y<wy+wh; y+=rh){ if(y+rh>=y0 && y<=y1){ const off=(row&1)?rh*0.5:0;
      for(let x=wx+off; x<wx+ww; x+=step){ if(x<x0||x>x1) continue; ctx.beginPath(); ctx.moveTo(x,Math.max(y,y0)); ctx.lineTo(x,Math.min(y+rh,wy+wh,y1)); ctx.stroke(); } } row++; }
  } else if(st==='hedge'){
    // grid in WALL-LOCAL space so the foliage is glued to the wall (never swims as the camera moves)
    const cell=SCALE*0.5, nx=Math.ceil(ww/cell), ny=Math.ceil(wh/cell);
    for(let gx=0; gx<=nx; gx++) for(let gy=0; gy<=ny; gy++){
      const h=hash2(gx+seed, gy*3+1); const x=wx+gx*cell+(h&7)/7*cell, y=wy+gy*cell+((h>>3)&7)/7*cell;
      if(x<x0-cell||x>x1+cell||y<y0-cell||y>y1+cell) continue; const r=cell*(0.45+((h>>6)&7)/7*0.5), lit=(h>>9)&1;
      ctx.fillStyle=lit?'rgba(150,210,110,.45)':'rgba(18,54,22,.42)'; ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill(); }
  } else if(st==='wood'){
    const pw=Math.max(10, SCALE*0.55); ctx.lineWidth=1.5;
    for(let x=wx+pw; x<wx+ww-1; x+=pw){ if(x<x0||x>x1) continue; ctx.strokeStyle='rgba(0,0,0,.25)'; ctx.beginPath(); ctx.moveTo(x,y0); ctx.lineTo(x,y1); ctx.stroke();
      ctx.strokeStyle='rgba(255,255,255,.06)'; ctx.beginPath(); ctx.moveTo(x+1.5,y0); ctx.lineTo(x+1.5,y1); ctx.stroke(); }
    ctx.lineWidth=1;
  } else if(st==='marble'){
    // veins span the WALL's own extent (wx..wx+ww), not the visible screen bounds — no swimming
    ctx.strokeStyle='rgba(255,255,255,.13)'; ctx.lineWidth=1.5;
    for(let i=0;i<4;i++){ const h=hash2(seed+i,5); const yy=wy+(h%1000)/1000*wh; if(yy<y0-wh*0.4||yy>y1+wh*0.4) continue;
      ctx.beginPath(); ctx.moveTo(wx,yy); ctx.lineTo(wx+ww, yy+(((h>>10)%200)/200-0.5)*wh*0.5); ctx.stroke(); }
    ctx.lineWidth=1;
  } else if(st==='crystal'){
    // grid in WALL-LOCAL space (same anchoring fix as hedge)
    const cell=SCALE*0.8, nx=Math.ceil(ww/cell), ny=Math.ceil(wh/cell);
    for(let gx=0; gx<=nx; gx++) for(let gy=0; gy<=ny; gy++){
      const h=hash2(gx*5+seed, gy*5+2); if((h&1)) continue; const x=wx+gx*cell+(h&7)/7*cell, y=wy+gy*cell+((h>>3)&7)/7*cell;
      if(x<x0-cell||x>x1+cell||y<y0-cell||y>y1+cell) continue; const r=cell*0.4;
      ctx.fillStyle='rgba(255,255,255,.10)'; ctx.beginPath(); ctx.moveTo(x,y-r); ctx.lineTo(x+r*0.7,y); ctx.lineTo(x,y+r); ctx.lineTo(x-r*0.7,y); ctx.closePath(); ctx.fill(); }
  }
}
// per-realm decorative landmark sets
const DECO=[
  { count:34, types:['tree','bush','rock','bush','tree','flower'] }, // 0 Trial Grounds
  { count:46, types:['tree','tree','bush','mushroom','reed','bush'] },// 1 Verdant Jungle
  { count:26, types:['crate','banner','crate','bush','barrel'] },   // 2 Human Empire
  { count:30, types:['totem','bones','rock','bush'] },              // 3 Orc Empire
  { count:44, types:['tree','mushroom','bush','reed','flower'] },   // 4 Elves Forest
  { count:28, types:['brazier','rock','bones','crystal'] },         // 5 魔物 Empire
  { count:26, types:['pillar','banner','tree'] },                   // 6 Two Families
  { count:26, types:['crystal','pillar','brazier'] },               // 7 Court of Upper Beings
  { count:26, types:['pillar','crystal','rock'] },                  // 8 Hall of Echoes
  { count:24, types:['brazier','banner','pillar'] },                // 9 Tower's Crown
];
function drawDeco(d){
  const[sx,sy]=w2s(d.x,d.y), S=SCALE*(d.s||1);
  if(!isFinite(sx)||!isFinite(sy)||!isFinite(S)) return;     // never feed a non-finite into a gradient
  if(sx<-90||sx>W+90||sy<-150||sy>H+90) return;
  const ri=realmIndex(floor), acc=realm?realm.accent:[200,180,120], T=s_now();
  { const dh=(DECO_H[d.type]||1); contactShadow(sx,sy, S*(0.46+dh*0.1), S*(0.16+dh*0.035)); }   // taller things cast longer shadows
  if(d.type==='tree'||d.type==='bush'){                       // stone planter: the Tower keeps its worlds potted
    ctx.fillStyle='#221f28'; ctx.beginPath(); ctx.ellipse(sx,sy,S*0.6,S*0.23,0,0,7); ctx.fill();
    ctx.strokeStyle='rgba(160,155,175,.28)'; ctx.lineWidth=2; ctx.beginPath(); ctx.ellipse(sx,sy,S*0.6,S*0.23,0,0,7); ctx.stroke(); ctx.lineWidth=1;
    ctx.fillStyle='#202a1c'; ctx.beginPath(); ctx.ellipse(sx,sy,S*0.46,S*0.16,0,0,7); ctx.fill(); }
  { const DH=DECO_H;
    if(DH[d.type]){ const im=assetImg('deco_'+d.type+'_f'+realmIndex(floor))||assetImg('deco_'+d.type);
      if(im){ const hh=DH[d.type]*S; drawAsset(im, sx, sy-hh*0.42, hh, 1); return; } } }
  switch(d.type){
    case 'tree': { const blossom=(ri===6); ctx.fillStyle='#553a24'; ctx.fillRect(sx-S*0.08,sy-S*0.85,S*0.16,S*0.85);
      const fol = blossom?['#c85a86','#e886aa','#ffb6cf'] : (ri===4?['#2f7a4a','#46a868','#86d8a0']:['#2f6e2a','#3f8a34','#5aa843']);
      for(let i=0;i<3;i++){ ctx.fillStyle=fol[i]; ctx.beginPath(); ctx.arc(sx+(i-1)*S*0.26, sy-S*(0.95+(i===1?0.32:0.1)), S*0.46,0,7); ctx.fill(); }
      ctx.fillStyle='rgba(255,255,255,.14)'; ctx.beginPath(); ctx.arc(sx-S*0.18,sy-S*1.25,S*0.2,0,7); ctx.fill(); break; }
    case 'bush': { const g=(ri===5||ri===7)?['#3a3050','#52436e']:['#2f6e2a','#46944a','#63b85e'];
      for(let i=0;i<3;i++){ ctx.fillStyle=g[i%g.length]; ctx.beginPath(); ctx.arc(sx+(i-1)*S*0.22, sy-S*0.18, S*0.3,0,7); ctx.fill(); }
      ctx.fillStyle='rgba(255,255,255,.12)'; ctx.beginPath(); ctx.arc(sx-S*0.12,sy-S*0.3,S*0.12,0,7); ctx.fill(); break; }
    case 'rock': { ctx.fillStyle='#5b5d68'; ctx.beginPath(); ctx.ellipse(sx,sy-S*0.18,S*0.42,S*0.3,0,0,7); ctx.fill();
      ctx.fillStyle='#6f7280'; ctx.beginPath(); ctx.ellipse(sx-S*0.1,sy-S*0.28,S*0.26,S*0.18,0,0,7); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.16)'; ctx.beginPath(); ctx.ellipse(sx-S*0.14,sy-S*0.34,S*0.12,S*0.07,0,0,7); ctx.fill(); break; }
    case 'reed': { ctx.strokeStyle='#3f7a6a'; ctx.lineWidth=Math.max(2,S*0.06); ctx.lineCap='round';
      for(let i=0;i<5;i++){ const a=-Math.PI/2+((i/4)-0.5)*0.7; ctx.strokeStyle=(i&1)?'#5aa890':'#3f7a6a'; ctx.beginPath(); ctx.moveTo(sx+(i-2)*S*0.07,sy);
        ctx.quadraticCurveTo(sx+Math.cos(a)*S*0.4, sy-S*0.55, sx+Math.cos(a)*S*0.55, sy-S*0.95); ctx.stroke(); } ctx.lineWidth=1; break; }
    case 'mushroom': { const glow=(ri===4); ctx.fillStyle='#d8cdb0'; ctx.fillRect(sx-S*0.06,sy-S*0.38,S*0.12,S*0.38);
      if(glow){ ctx.globalCompositeOperation='lighter'; ctx.fillStyle='rgba(120,220,255,.5)'; ctx.beginPath(); ctx.arc(sx,sy-S*0.42,S*0.34,0,7); ctx.fill(); ctx.globalCompositeOperation='source-over'; }
      ctx.fillStyle=glow?'#7fe0ff':'#c0413a'; ctx.beginPath(); ctx.ellipse(sx,sy-S*0.42,S*0.26,S*0.2,0,Math.PI,0); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.8)'; for(let i=0;i<3;i++) { ctx.beginPath(); ctx.arc(sx+(i-1)*S*0.12, sy-S*0.46, S*0.03,0,7); ctx.fill(); } break; }
    case 'crystal': { const c = ri===5?[255,90,80]: ri===8?[150,220,255]: acc;
      const g=ctx.createLinearGradient(sx,sy-S*0.9,sx,sy); g.addColorStop(0,'rgba('+c[0]+','+c[1]+','+c[2]+',.95)'); g.addColorStop(1,'rgba('+Math.round(c[0]*0.4)+','+Math.round(c[1]*0.4)+','+Math.round(c[2]*0.4)+',.95)');
      ctx.globalCompositeOperation='lighter'; ctx.fillStyle='rgba('+c[0]+','+c[1]+','+c[2]+',.25)'; ctx.beginPath(); ctx.arc(sx,sy-S*0.5,S*0.5,0,7); ctx.fill(); ctx.globalCompositeOperation='source-over';
      ctx.fillStyle=g; ctx.beginPath(); ctx.moveTo(sx,sy-S*0.95); ctx.lineTo(sx+S*0.22,sy-S*0.35); ctx.lineTo(sx+S*0.12,sy); ctx.lineTo(sx-S*0.12,sy); ctx.lineTo(sx-S*0.22,sy-S*0.35); ctx.closePath(); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.5)'; ctx.beginPath(); ctx.moveTo(sx,sy-S*0.95); ctx.lineTo(sx+S*0.06,sy-S*0.4); ctx.lineTo(sx-S*0.04,sy-S*0.4); ctx.closePath(); ctx.fill(); break; }
    case 'brazier': { const gold=(ri===9); ctx.fillStyle=gold?'#8a6a2a':'#3a3340'; ctx.fillRect(sx-S*0.07,sy-S*0.6,S*0.14,S*0.6);
      ctx.fillStyle=gold?'#b8902f':'#4a4250'; ctx.beginPath(); ctx.ellipse(sx,sy-S*0.62,S*0.22,S*0.1,0,0,7); ctx.fill();
      ctx.globalCompositeOperation='lighter'; const fl=0.8+0.2*Math.sin(T/120+d.seed);
      ctx.fillStyle='rgba(255,150,40,'+(.55*fl)+')'; ctx.beginPath(); ctx.arc(sx,sy-S*0.8,S*0.3*fl,0,7); ctx.fill();
      ctx.fillStyle='rgba(255,230,120,.9)'; ctx.beginPath(); ctx.ellipse(sx,sy-S*0.78,S*0.1,S*0.18*fl,0,0,7); ctx.fill(); ctx.globalCompositeOperation='source-over'; break; }
    case 'pillar': { const broken=(ri===8); const h=broken?(0.7+((d.seed&3)/3)*0.5):1.3, top=sy-S*h;
      const g=ctx.createLinearGradient(sx-S*0.2,0,sx+S*0.2,0); g.addColorStop(0,'#8d8a96'); g.addColorStop(0.5,'#c8c6cf'); g.addColorStop(1,'#7a7884');
      ctx.fillStyle=g; ctx.fillRect(sx-S*0.16, top, S*0.32, sy-top);
      ctx.fillStyle='#d8d6df'; ctx.fillRect(sx-S*0.22, sy-S*0.14, S*0.44, S*0.14);                          // base
      if(!broken){ ctx.fillRect(sx-S*0.22, top, S*0.44, S*0.12); }                                          // capital
      ctx.fillStyle='rgba(0,0,0,.14)'; ctx.fillRect(sx+S*0.06, top, S*0.10, sy-top); break; }
    case 'banner': { ctx.fillStyle='#4a3a2a'; ctx.fillRect(sx-S*0.04,sy-S*1.2,S*0.08,S*1.2);                // pole
      const w=S*0.4, top=sy-S*1.1, bc=d.col||acc; ctx.fillStyle='rgb('+bc[0]+','+bc[1]+','+bc[2]+')';      // faction colour if d.col set, else realm accent
      ctx.beginPath(); ctx.moveTo(sx-w*0.1,top); ctx.lineTo(sx-w*0.1+w,top); ctx.lineTo(sx-w*0.1+w,top+S*0.7); ctx.lineTo(sx-w*0.1+w*0.5,top+S*0.55); ctx.lineTo(sx-w*0.1,top+S*0.7); ctx.closePath(); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(sx-w*0.1+w*0.5, top+S*0.28, S*0.08,0,7); ctx.fill(); break; }
    case 'totem': { const cols=['#7a4a28','#5a3a22','#8a5a30']; for(let i=0;i<3;i++){ ctx.fillStyle=cols[i]; ctx.fillRect(sx-S*0.2, sy-S*(0.4+i*0.4), S*0.4, S*0.38);
      ctx.fillStyle='rgba(255,230,160,.7)'; ctx.beginPath(); ctx.arc(sx-S*0.07, sy-S*(0.22+i*0.4), S*0.05,0,7); ctx.arc(sx+S*0.07, sy-S*(0.22+i*0.4), S*0.05,0,7); ctx.fill(); }
      ctx.fillStyle='#caa24a'; ctx.beginPath(); ctx.moveTo(sx-S*0.3,sy-S*1.2); ctx.lineTo(sx,sy-S*1.0); ctx.lineTo(sx+S*0.3,sy-S*1.2); ctx.lineTo(sx,sy-S*1.05); ctx.closePath(); ctx.fill(); break; }
    case 'bones': { ctx.fillStyle='#d8d2c0'; ctx.beginPath(); ctx.arc(sx,sy-S*0.22,S*0.2,0,7); ctx.fill();   // skull
      ctx.fillStyle='#2a2620'; ctx.beginPath(); ctx.arc(sx-S*0.07,sy-S*0.24,S*0.05,0,7); ctx.arc(sx+S*0.07,sy-S*0.24,S*0.05,0,7); ctx.fill();
      ctx.strokeStyle='#cfc8b6'; ctx.lineWidth=Math.max(2,S*0.05); ctx.beginPath(); ctx.moveTo(sx-S*0.3,sy-S*0.05); ctx.lineTo(sx+S*0.28,sy-S*0.1); ctx.moveTo(sx-S*0.2,sy+S*0.02); ctx.lineTo(sx+S*0.3,sy-S*0.02); ctx.stroke(); ctx.lineWidth=1; break; }
    case 'crate': { const g=ctx.createLinearGradient(0,sy-S*0.5,0,sy); g.addColorStop(0,'#9a6a38'); g.addColorStop(1,'#6e4a26');
      ctx.fillStyle=g; ctx.fillRect(sx-S*0.28,sy-S*0.5,S*0.56,S*0.5);
      ctx.strokeStyle='#4a3018'; ctx.lineWidth=Math.max(1.5,S*0.04); ctx.strokeRect(sx-S*0.28,sy-S*0.5,S*0.56,S*0.5);
      ctx.beginPath(); ctx.moveTo(sx-S*0.28,sy-S*0.5); ctx.lineTo(sx+S*0.28,sy); ctx.moveTo(sx+S*0.28,sy-S*0.5); ctx.lineTo(sx-S*0.28,sy); ctx.stroke(); ctx.lineWidth=1; break; }
    case 'barrel': { ctx.fillStyle='#8a5a30'; ctx.fillRect(sx-S*0.2,sy-S*0.46,S*0.4,S*0.46);
      ctx.fillStyle='rgba(255,255,255,.10)'; ctx.fillRect(sx-S*0.2,sy-S*0.46,S*0.12,S*0.46);
      ctx.strokeStyle='#4a3018'; ctx.lineWidth=Math.max(1.5,S*0.05); ctx.strokeRect(sx-S*0.2,sy-S*0.46,S*0.4,S*0.46);
      ctx.beginPath(); ctx.moveTo(sx-S*0.2,sy-S*0.32); ctx.lineTo(sx+S*0.2,sy-S*0.32); ctx.moveTo(sx-S*0.2,sy-S*0.14); ctx.lineTo(sx+S*0.2,sy-S*0.14); ctx.stroke(); ctx.lineWidth=1; break; }
    case 'flower': { ctx.lineWidth=Math.max(1.5,S*0.04); const cols=['#ff7ab3','#ffd34d','#b88cff','#7ad0ff','#ff8a5a'], n=3+(d.seed&1);
      for(let i=0;i<n;i++){ const dx=((((d.seed>>(i*3))&7)/7)-0.5)*S*0.55; ctx.strokeStyle='#3a6a3a'; ctx.beginPath(); ctx.moveTo(sx+dx,sy); ctx.lineTo(sx+dx,sy-S*0.3); ctx.stroke();
        ctx.fillStyle=cols[(d.seed>>(i+1))%cols.length]; ctx.beginPath(); ctx.arc(sx+dx,sy-S*0.33,S*0.07,0,7); ctx.fill();
        ctx.fillStyle='#ffe9a0'; ctx.beginPath(); ctx.arc(sx+dx,sy-S*0.33,S*0.025,0,7); ctx.fill(); }
      ctx.lineWidth=1; break; }
  }
}
function drawExit(){
  const[sx,sy]=w2s(exit.x,exit.y), R=exit.r*SCALE, t=s_now()/1000, acc=realm?realm.accent:[120,230,150];
  const gate=assetImg('void_gate');
  if(gate){                                                       // SHADOW "Abyssal Gate" portal sprite — its teal ring sits ~3/4 down the image, placed on the exit tile
    const dw=R*3.4, dh=dw*gate.height/gate.width, gx=sx-dw/2, gy=sy-dh*0.76, sm=ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled=false;
    if(exit.open){ const pulse=0.5+0.5*Math.sin(t*2.2);
      ctx.globalCompositeOperation='lighter'; drawGlow(sx,sy,R*2.4,acc[0],acc[1],acc[2],0.26+0.16*pulse); ctx.globalCompositeOperation='source-over';
      ctx.drawImage(gate,gx,gy,dw,dh);
      ctx.globalCompositeOperation='lighter'; ctx.fillStyle=rgb(acc);
      for(let i=0;i<5;i++){ const ph=(t*0.6+i/5)%1, my=sy-ph*R*2.0, mx=sx+Math.sin(t*2+i*1.3)*R*0.4; ctx.globalAlpha=(1-ph)*0.8; ctx.beginPath(); ctx.arc(mx,my,R*0.08,0,7); ctx.fill(); }
      ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over';
      ctx.strokeStyle='rgba(255,255,255,.9)'; ctx.lineWidth=Math.max(2.5,R*0.1); ctx.lineCap='round'; ctx.lineJoin='round';
      for(let k=0;k<2;k++){ const yo=sy-R*0.02-k*R*0.26; ctx.beginPath(); ctx.moveTo(sx-R*0.26,yo); ctx.lineTo(sx,yo-R*0.26); ctx.lineTo(sx+R*0.26,yo); ctx.stroke(); }
      ctx.lineWidth=1;
    } else { ctx.globalAlpha=0.45; ctx.drawImage(gate,gx,gy,dw,dh); ctx.globalAlpha=1; }
    ctx.imageSmoothingEnabled=sm; return;
  }
  if(exit.open){
    const pulse=0.5+0.5*Math.sin(t*2.2);
    ctx.globalCompositeOperation='lighter';
    drawGlow(sx,sy,R*2.6,acc[0],acc[1],acc[2],0.30+0.16*pulse);
    ctx.globalCompositeOperation='source-over';
    { ctx.fillStyle='rgba(8,6,16,.78)'; ctx.beginPath(); ctx.ellipse(sx,sy,R,R*0.82,0,0,7); ctx.fill(); }   // portal mouth (procedural)
    ctx.lineWidth=Math.max(2,R*0.13); ctx.lineCap='round';
    for(let i=0;i<3;i++){ const a0=t*1.6*(i%2?1:-1)+i*2.1; ctx.strokeStyle='rgba('+acc[0]+','+acc[1]+','+acc[2]+','+(0.75-i*0.2)+')';
      ctx.beginPath(); ctx.arc(sx,sy,R*(0.82-i*0.2),a0,a0+Math.PI*1.25); ctx.stroke(); }
    ctx.lineWidth=1;
    ctx.globalCompositeOperation='lighter';
    ctx.fillStyle='#fff'; ctx.globalAlpha=0.5+0.35*pulse; ctx.beginPath(); ctx.arc(sx,sy,R*0.22,0,7); ctx.fill(); ctx.globalAlpha=1;
    ctx.fillStyle=rgb(acc);
    for(let i=0;i<5;i++){ const ph=(t*0.6+i/5)%1, my=sy-ph*R*2.3, mx=sx+Math.sin(t*2+i*1.3)*R*0.45; ctx.globalAlpha=(1-ph)*0.8; ctx.beginPath(); ctx.arc(mx,my,R*0.09,0,7); ctx.fill(); }
    ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over';
    ctx.strokeStyle='rgba(255,255,255,.9)'; ctx.lineWidth=Math.max(2.5,R*0.12); ctx.lineCap='round'; ctx.lineJoin='round';
    for(let k=0;k<2;k++){ const yo=sy+R*0.18-k*R*0.30; ctx.beginPath(); ctx.moveTo(sx-R*0.32,yo); ctx.lineTo(sx,yo-R*0.32); ctx.lineTo(sx+R*0.32,yo); ctx.stroke(); }
    ctx.lineWidth=1;
  } else {
    { ctx.fillStyle='#3a3640'; ctx.beginPath(); ctx.ellipse(sx,sy,R*1.04,R*0.88,0,0,7); ctx.fill();   // carved stone ring
      ctx.fillStyle='#15131c'; ctx.beginPath(); ctx.ellipse(sx,sy,R*0.82,R*0.68,0,0,7); ctx.fill(); }   // sealed dark void (procedural)
    ctx.lineWidth=Math.max(2,R*0.13); ctx.strokeStyle='#3a3742'; ctx.stroke(); ctx.lineWidth=1;
    ctx.strokeStyle='rgba('+acc[0]+','+acc[1]+','+acc[2]+',.28)'; ctx.lineWidth=Math.max(1.5,R*0.06);
    for(let i=0;i<5;i++){ const a=i*1.256+0.4; ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(sx+Math.cos(a)*R*0.85,sy+Math.sin(a)*R*0.7); ctx.stroke(); }
    ctx.lineWidth=1;
    ctx.fillStyle='#888'; ctx.font='700 '+Math.round(.55*SCALE)+'px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('🔒',sx,sy); ctx.textAlign='left'; ctx.textBaseline='top';
  }
}
const TALL_PROP={lamp:1,monolith:1,stall:1,waystone:1,dummy:1,board:1,newsstand:1,obelisk:1,shrine:1,banner:1,statue:1,wagon:1,planter:1,shopsign:1,awning:1,records:1,evidence:1,relaybox:1,wardrobe:1};
const TALL_DECO={tree:1,pillar:1,banner:1,totem:1,brazier:1,crystal:1,reed:1};
function drawProp(p){ const[sx,sy]=w2s(p.x,p.y);
    const PH9=PROP_H, hh9=(PH9[p.kind]||1)*SCALE;
    if(sx<-120-hh9||sx>W+120||sy<-120-hh9||sy>H+120+hh9) return;   // offscreen cull (allow tall props past edges)
    { const PH=PROP_H;
      if(PH[p.kind]){ const im=assetImg('prop_'+p.kind);
        if(im){ const hh=PH[p.kind]*SCALE; drawAsset(im, sx, sy-hh*0.40, hh, 1); return; } } }
    if(p.kind==='sign'){ ctx.fillStyle=p.big?'#ffe066':'rgba(255,255,255,.5)'; ctx.font='700 '+(p.big?17:14)+'px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(p.text,sx,sy); ctx.textAlign='left'; ctx.textBaseline='top'; }
    else if(p.kind==='guildplatform'){ const t9=s_now()/1000, pr=0.5+0.5*Math.sin(t9*2), R=1.5*SCALE;
      ctx.fillStyle='#211f30'; ctx.beginPath(); ctx.arc(sx,sy,R,0,7); ctx.fill();
      ctx.fillStyle='rgba(240,196,80,'+(0.22+0.18*pr).toFixed(2)+')'; ctx.beginPath(); ctx.arc(sx,sy,R*0.62,0,7); ctx.fill();
      ctx.strokeStyle='rgba(240,196,80,'+(0.55+0.4*pr).toFixed(2)+')'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(sx,sy,R,0,7); ctx.stroke(); ctx.lineWidth=1;
      ctx.fillStyle='#f0c450'; ctx.font='800 '+Math.round(R*0.85)+'px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('★',sx,sy); ctx.textAlign='left'; ctx.textBaseline='top';
      if(len(p.x-player.x,p.y-player.y)<3.0){ const sr=starRank(player); ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font='800 18px system-ui'; ctx.lineWidth=3; ctx.strokeStyle='rgba(0,0,0,.85)'; ctx.strokeText(sr.stars+'★ '+sr.title, sx, sy-R-20); ctx.fillStyle='#ffe9a0'; ctx.fillText(sr.stars+'★ '+sr.title, sx, sy-R-20); ctx.textAlign='left'; ctx.textBaseline='top'; } }
    else if(p.kind==='flower'){ const fc=p.used?'#5a7a55':['#ff7ab3','#ffd34d','#b88cff','#7ad0ff'][Math.floor(p.x*7+p.y)&3]; ctx.fillStyle='#3a6a3a'; ctx.fillRect(sx-1,sy,2,7); ctx.fillStyle=fc; ctx.beginPath(); ctx.arc(sx,sy,5,0,7); ctx.fill(); }
    else if(p.kind==='crop'){ ctx.fillStyle=p.used?'#3a3a28':'#7aa83a'; ctx.fillRect(sx-2,sy-6,4,9); if(!p.used){ ctx.fillStyle='#d8c84a'; ctx.beginPath(); ctx.arc(sx,sy-8,4,0,7); ctx.fill(); } }
    else if(p.kind==='stall'){ const hues=['#d96a6a','#d9b86a','#6ad98f','#6aa6d9']; ctx.fillStyle='#5a4a32'; ctx.fillRect(sx-10,sy-4,20,9);
      ctx.fillStyle=hues[p.hue%4]; ctx.fillRect(sx-12,sy-10,24,7); ctx.fillStyle='rgba(255,255,255,.35)'; for(let k=0;k<3;k++) ctx.fillRect(sx-12+k*8+4,sy-10,4,7); }
    else if(p.kind==='plaque'){ ctx.fillStyle='#6a6a74'; ctx.fillRect(sx-9,sy-7,18,14); ctx.strokeStyle='#3a3a44'; ctx.strokeRect(sx-9,sy-7,18,14); ctx.fillStyle='#3a3a44'; ctx.fillRect(sx-6,sy-3,12,2); ctx.fillRect(sx-6,sy+1,9,2); }
    else if(p.kind==='orb'){ const pu=.6+.4*Math.sin(s_now()/300); ctx.fillStyle=p.used?'rgba(110,130,150,.5)':'rgba(150,215,255,'+(.5+.3*pu)+')'; ctx.beginPath(); ctx.arc(sx,sy,7+(p.used?0:pu*2),0,7); ctx.fill(); if(!p.used){ ctx.strokeStyle='rgba(200,235,255,.7)'; ctx.beginPath(); ctx.arc(sx,sy,11,0,7); ctx.stroke(); } }
    else if(p.kind==='stone'){ ctx.fillStyle=p.used?'#555a58':'#7a8a7a'; ctx.fillRect(sx-5,sy-14,10,20); ctx.fillStyle=p.used?'#666':'#b6f0c0'; ctx.fillRect(sx-2,sy-9,4,4); }
else if(p.kind==='waystone'){ const gl=p.attuned?(.55+.35*Math.sin(s_now()/280)):.18;
      ctx.fillStyle='#2c3a55'; ctx.fillRect(sx-5,sy-20,10,26); ctx.fillStyle='rgba(120,200,255,'+gl+')'; ctx.fillRect(sx-3,sy-16,6,18);
      if(p.attuned){ ctx.strokeStyle='rgba(120,200,255,.5)'; ctx.beginPath(); ctx.arc(sx,sy,12,0,7); ctx.stroke(); } }
    else if(p.kind==='statue'){ ctx.fillStyle='#55565f'; ctx.fillRect(sx-8,sy+4,16,5); ctx.fillStyle='#7a7c88'; ctx.fillRect(sx-4,sy-14,8,18);
      ctx.beginPath(); ctx.arc(sx,sy-17,5,0,7); ctx.fill(); ctx.fillRect(sx+3,sy-14,2.5,12); }
    else if(p.kind==='wagon'){ ctx.fillStyle='#6a4e32'; ctx.fillRect(sx-11,sy-8,22,12); ctx.fillStyle='#8a6a44'; ctx.fillRect(sx-11,sy-12,22,5);
      ctx.fillStyle='#2e2620'; ctx.beginPath(); ctx.arc(sx-6,sy+5,4,0,7); ctx.arc(sx+6,sy+5,4,0,7); ctx.fill(); }
    else if(p.kind==='ore'){ ctx.fillStyle=p.uses>0?'#5a5a52':'#3c3c38'; ctx.beginPath(); ctx.arc(sx,sy,9,0,7); ctx.fill();
      if(p.uses>0){ ctx.fillStyle='#e6c84a'; ctx.fillRect(sx-4,sy-3,3,3); ctx.fillRect(sx+2,sy,3,3); ctx.fillRect(sx-1,sy+3,2,2); } }
else if(p.kind==='board'){ ctx.fillStyle='#5a4630'; ctx.fillRect(sx-2,sy-4,4,12); ctx.fillStyle='#6e5638'; ctx.fillRect(sx-11,sy-15,22,12); ctx.fillStyle='#e8e0c8'; ctx.fillRect(sx-8,sy-13,6,8); ctx.fillRect(sx+1,sy-12,7,6); }
    else if(p.kind==='newsstand'){ const S=SCALE, acc9=realm?realm.accent:[220,190,90];
      ctx.fillStyle='rgba(0,0,10,.25)'; ctx.beginPath(); ctx.ellipse(sx,sy+0.06*S,0.72*S,0.18*S,0,0,7); ctx.fill();
      ctx.fillStyle='#4a3522'; ctx.fillRect(sx-0.42*S,sy-1.05*S,0.84*S,1.05*S);
      ctx.fillStyle='rgb('+Math.round(acc9[0]*0.55+45)+','+Math.round(acc9[1]*0.55+35)+','+Math.round(acc9[2]*0.55+28)+')';
      ctx.fillRect(sx-0.50*S,sy-1.22*S,1.0*S,0.24*S);
      ctx.fillStyle='#eee3c8'; for(let i=0;i<4;i++) ctx.fillRect(sx-0.34*S+i*0.18*S,sy-0.82*S,0.13*S,0.42*S);
      ctx.fillStyle='#151018'; ctx.font='800 '+Math.round(0.22*S)+'px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('NEWS',sx,sy-1.10*S); ctx.textAlign='left'; ctx.textBaseline='top'; }
    else if(p.kind==='beacon'){ const S=SCALE; ctx.fillStyle='#37302a'; ctx.fillRect(sx-0.13*S,sy-2.0*S,0.26*S,2.0*S);   // pole
      ctx.fillStyle='#4a4038'; ctx.beginPath(); ctx.moveTo(sx-0.55*S,sy-1.9*S); ctx.lineTo(sx+0.55*S,sy-1.9*S); ctx.lineTo(sx+0.36*S,sy-2.5*S); ctx.lineTo(sx-0.36*S,sy-2.5*S); ctx.closePath(); ctx.fill();   // brazier
      if(p.used){ const fl=.6+.4*Math.sin(s_now()/110); ctx.fillStyle='rgba(255,180,70,'+(0.32*fl)+')'; ctx.beginPath(); ctx.arc(sx,sy-2.4*S,1.5*S,0,7); ctx.fill();
        ctx.fillStyle='#ffd05a'; ctx.beginPath(); ctx.moveTo(sx,sy-3.3*S); ctx.lineTo(sx+0.3*S,sy-2.4*S); ctx.lineTo(sx-0.3*S,sy-2.4*S); ctx.closePath(); ctx.fill(); }
      else { ctx.fillStyle='#5a5048'; ctx.beginPath(); ctx.arc(sx,sy-2.4*S,0.3*S,0,7); ctx.fill(); } }
    else if(p.kind==='wardoor'){ const S=SCALE; ctx.fillStyle=p.used?'rgba(70,62,100,.25)':'#34304a'; ctx.fillRect(sx-0.32*S,sy-1.6*S,0.64*S,3.2*S);
      if(!p.used){ const gl=.4+.3*Math.sin(s_now()/300); ctx.strokeStyle='rgba(180,160,255,'+gl+')'; ctx.lineWidth=2; ctx.strokeRect(sx-0.32*S,sy-1.6*S,0.64*S,3.2*S);
        ctx.fillStyle='rgba(190,170,255,'+gl+')'; ctx.beginPath(); ctx.arc(sx,sy,0.16*S,0,7); ctx.fill(); ctx.lineWidth=1; } }
    else if(p.kind==='weathervane'){ const S=SCALE; ctx.strokeStyle='#6a6258'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(sx,sy-2.0*S); ctx.stroke();
      const a=s_now()/700 + (p.x+p.y); ctx.save(); ctx.translate(sx,sy-2.0*S); ctx.rotate(Math.sin(a)*0.5);
      ctx.fillStyle='#b9c2cf'; ctx.beginPath(); ctx.moveTo(-0.7*S,0); ctx.lineTo(0.7*S,-0.18*S); ctx.lineTo(0.7*S,0.18*S); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#8a93a0'; ctx.fillRect(-0.06*S,-0.5*S,0.12*S,1.0*S); ctx.restore(); ctx.lineWidth=1; }
    else if(p.kind==='well'){ ctx.fillStyle='#5c5e68'; ctx.beginPath(); ctx.arc(sx,sy,9,0,7); ctx.fill(); ctx.fillStyle='#1e3a55'; ctx.beginPath(); ctx.arc(sx,sy,5.5,0,7); ctx.fill(); ctx.strokeStyle='#3a3c44'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(sx-8,sy-2); ctx.lineTo(sx-8,sy-12); ctx.lineTo(sx+8,sy-12); ctx.lineTo(sx+8,sy-2); ctx.stroke(); ctx.lineWidth=1; }
    else if(p.kind==='bench'){ const S=SCALE, wd=p.face?0.9:0.5, dp=p.face?0.5:0.9;
      ctx.fillStyle='rgba(0,0,10,.22)'; ctx.beginPath(); ctx.ellipse(sx,sy+0.05*S,wd*0.6*S,0.16*S,0,0,7); ctx.fill();
      ctx.fillStyle='#5a4632'; ctx.fillRect(sx-wd*0.5*S, sy-0.18*S, wd*S, 0.16*S);                 // seat plank
      ctx.fillStyle='#6e5740'; ctx.fillRect(sx-wd*0.5*S, sy-0.18*S, wd*S, 0.05*S);                 // lit top
      ctx.fillStyle='#46371f'; ctx.fillRect(sx-wd*0.5*S+1, sy-0.02*S, 0.07*S, 0.2*S); ctx.fillRect(sx+wd*0.5*S-0.07*S-1, sy-0.02*S, 0.07*S, 0.2*S);   // legs
      ctx.fillStyle='#52402c'; ctx.fillRect(sx-wd*0.5*S, sy-0.44*S, wd*S, 0.1*S);                  // backrest
      ctx.fillStyle='#3c2e1e'; ctx.fillRect(sx-wd*0.5*S+1, sy-0.44*S, 0.06*S, 0.28*S); ctx.fillRect(sx+wd*0.5*S-0.06*S-1, sy-0.44*S, 0.06*S, 0.28*S); }
    else if(p.kind==='planter'){ const S=SCALE; ctx.fillStyle='rgba(0,0,10,.22)'; ctx.beginPath(); ctx.ellipse(sx,sy+0.05*S,0.5*S,0.16*S,0,0,7); ctx.fill();
      ctx.fillStyle='#6b6358'; ctx.beginPath(); ctx.moveTo(sx-0.42*S,sy); ctx.lineTo(sx+0.42*S,sy); ctx.lineTo(sx+0.34*S,sy-0.4*S); ctx.lineTo(sx-0.34*S,sy-0.4*S); ctx.closePath(); ctx.fill();   // stone box
      ctx.fillStyle='rgba(255,255,255,.1)'; ctx.fillRect(sx-0.34*S,sy-0.4*S,0.68*S,2);
      const acc9=realm?realm.accent:[120,180,110];
      for(let fb=0;fb<4;fb++){ const fx=sx-0.28*S+fb*0.18*S, fh=0.5+( (Math.abs(Math.round(p.x*7+fb))%3) )*0.12;
        ctx.fillStyle='rgb('+Math.round(40+acc9[0]*0.25)+','+Math.round(70+acc9[1]*0.3)+','+Math.round(38+acc9[2]*0.2)+')';
        ctx.beginPath(); ctx.arc(fx, sy-0.4*S-0.18*S*fh, 0.16*S, 0, 7); ctx.fill();
        ctx.fillStyle='rgba(180,220,140,.4)'; ctx.beginPath(); ctx.arc(fx-0.04*S, sy-0.4*S-0.22*S*fh, 0.07*S, 0, 7); ctx.fill(); } }
    else if(p.kind==='bollard'){ const S=SCALE; ctx.fillStyle='rgba(0,0,10,.22)'; ctx.beginPath(); ctx.ellipse(sx,sy+0.03*S,0.22*S,0.08*S,0,0,7); ctx.fill();
      ctx.fillStyle='#54505c'; if(ctx.roundRect){ ctx.beginPath(); ctx.roundRect(sx-0.12*S,sy-0.5*S,0.24*S,0.55*S,0.1*S); ctx.fill(); } else ctx.fillRect(sx-0.12*S,sy-0.5*S,0.24*S,0.55*S);
      ctx.fillStyle='#6a6676'; ctx.beginPath(); ctx.arc(sx,sy-0.5*S,0.13*S,Math.PI,0); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.12)'; ctx.fillRect(sx-0.1*S,sy-0.48*S,0.06*S,0.4*S); }
    else if(p.kind==='shopsign'){ const S=SCALE, sw=Math.sin(s_now()/700+p.x)*0.11, acc9=realm?realm.accent:[180,150,90];
      ctx.strokeStyle='#3a2e1e'; ctx.lineWidth=2.5; ctx.beginPath(); ctx.moveTo(sx,sy-1.7*S); ctx.lineTo(sx,sy-0.55*S); ctx.lineTo(sx+0.46*S,sy-0.55*S); ctx.stroke();   // wall bracket
      ctx.save(); ctx.translate(sx+0.46*S, sy-0.55*S); ctx.rotate(sw);
      ctx.strokeStyle='#2a2218'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(-0.04*S,0); ctx.lineTo(-0.04*S,0.18*S); ctx.moveTo(0.04*S,0); ctx.lineTo(0.04*S,0.18*S); ctx.stroke();
      ctx.fillStyle='rgb('+Math.round(acc9[0]*0.6+40)+','+Math.round(acc9[1]*0.6+34)+','+Math.round(acc9[2]*0.6+28)+')';
      if(ctx.roundRect){ ctx.beginPath(); ctx.roundRect(-0.32*S,0.18*S,0.64*S,0.46*S,3); ctx.fill(); } else ctx.fillRect(-0.32*S,0.18*S,0.64*S,0.46*S);
      ctx.strokeStyle='rgba(0,0,0,.45)'; ctx.lineWidth=1.5; ctx.strokeRect(-0.32*S,0.18*S,0.64*S,0.46*S);
      ctx.fillStyle='rgba(20,16,10,.85)'; ctx.font='700 '+Math.round(0.32*S)+'px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(p.glyph||'\u2692', 0, 0.42*S); ctx.textAlign='left'; ctx.textBaseline='top';
      if(nightAmt()>0.3) drawGlow(0,0.4*S,0.7*S,255,210,130,0.22*nightAmt());
      ctx.restore(); ctx.lineWidth=1; }
    else if(p.kind==='awning'){ const S=SCALE, acc9=realm?realm.accent:[180,120,90], w2=0.72*S, h2=0.5*S;
      ctx.fillStyle='rgba(0,0,12,.20)'; ctx.beginPath(); ctx.ellipse(sx,sy+0.04*S,w2*0.7,0.12*S,0,0,7); ctx.fill();
      for(let st=0; st<5; st++){ ctx.fillStyle=(st&1)?'rgb('+Math.round(acc9[0]*0.8+30)+','+Math.round(acc9[1]*0.8+24)+','+Math.round(acc9[2]*0.8+20)+')':'#e6ddcb';
        const x0=sx-w2+st*(2*w2/5), x1=x0+2*w2/5;
        ctx.beginPath(); ctx.moveTo(x0,sy-h2); ctx.lineTo(x1,sy-h2); ctx.lineTo(x1-0.05*S,sy-0.06*S); ctx.lineTo(x0-0.05*S,sy-0.06*S); ctx.closePath(); ctx.fill(); }
      ctx.fillStyle='rgba(255,255,255,.12)'; ctx.fillRect(sx-w2,sy-h2,2*w2,2);
      ctx.fillStyle='rgba(0,0,0,.22)'; ctx.fillRect(sx-w2-0.05*S, sy-0.1*S, 2*w2, 0.05*S); }
    else if(p.kind==='records'){ const S=SCALE, used=p.used;
      ctx.fillStyle='rgba(0,0,10,.24)'; ctx.beginPath(); ctx.ellipse(sx,sy+0.06*S,0.58*S,0.14*S,0,0,7); ctx.fill();
      ctx.fillStyle=used?'#4b4650':'#5a4632'; ctx.fillRect(sx-0.52*S,sy-0.42*S,1.04*S,0.48*S);
      ctx.fillStyle=used?'#6a6570':'#7a5d3c'; ctx.fillRect(sx-0.52*S,sy-0.42*S,1.04*S,0.12*S);
      ctx.fillStyle=used?'#8e8a90':'#efe3c4'; ctx.fillRect(sx-0.36*S,sy-0.66*S,0.28*S,0.24*S); ctx.fillRect(sx-0.04*S,sy-0.62*S,0.34*S,0.20*S);
      ctx.fillStyle=used?'#777':'#b92f2f'; ctx.beginPath(); ctx.arc(sx+0.38*S,sy-0.52*S,0.12*S,0,7); ctx.fill();
      ctx.fillStyle='#211b16'; ctx.font=Math.round(0.20*S)+'px ui-monospace,monospace'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('ID',sx+0.38*S,sy-0.52*S); ctx.textAlign='left'; ctx.textBaseline='alphabetic'; }
    else if(p.kind==='evidence'){ const S=SCALE, used=p.used, gl=used?0.1:(0.45+0.2*Math.sin(s_now()/350+p.x));
      ctx.fillStyle='rgba(0,0,10,.26)'; ctx.beginPath(); ctx.ellipse(sx,sy+0.04*S,0.42*S,0.12*S,0,0,7); ctx.fill();
      ctx.fillStyle=used?'#444650':'#303542'; ctx.fillRect(sx-0.32*S,sy-1.02*S,0.64*S,1.02*S);
      ctx.strokeStyle=used?'#60626a':'#8890a0'; ctx.lineWidth=1.5; ctx.strokeRect(sx-0.32*S,sy-1.02*S,0.64*S,1.02*S); ctx.lineWidth=1;
      ctx.fillStyle='rgba(255,255,255,.08)'; ctx.fillRect(sx-0.26*S,sy-0.92*S,0.16*S,0.82*S);
      ctx.fillStyle='rgba(255,210,90,'+gl+')'; ctx.fillRect(sx+0.14*S,sy-0.58*S,0.08*S,0.10*S);
      if(used){ ctx.fillStyle='#17191f'; ctx.fillRect(sx-0.22*S,sy-0.68*S,0.44*S,0.08*S); } }
    else if(p.kind==='relaybox'){ const S=SCALE, used=p.used, pulse=0.5+0.5*Math.sin(s_now()/260+p.x);
      ctx.fillStyle='rgba(0,0,10,.24)'; ctx.beginPath(); ctx.ellipse(sx,sy+0.04*S,0.38*S,0.11*S,0,0,7); ctx.fill();
      ctx.fillStyle=used?'#3c4148':'#263848'; ctx.fillRect(sx-0.30*S,sy-0.90*S,0.60*S,0.82*S);
      ctx.strokeStyle=used?'#59606a':'#6fbfff'; ctx.lineWidth=1.5; ctx.strokeRect(sx-0.30*S,sy-0.90*S,0.60*S,0.82*S); ctx.lineWidth=1;
      ctx.strokeStyle=used?'#545a60':'rgba(120,220,255,'+(0.55+0.35*pulse)+')'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(sx-0.18*S,sy-0.72*S); ctx.lineTo(sx+0.04*S,sy-0.56*S); ctx.lineTo(sx-0.10*S,sy-0.38*S); ctx.lineTo(sx+0.18*S,sy-0.20*S); ctx.stroke(); ctx.lineWidth=1;
      if(!used){ ctx.globalCompositeOperation='lighter'; drawGlow(sx,sy-0.46*S,0.72*S,120,220,255,0.10*pulse); ctx.globalCompositeOperation='source-over'; } }
    else if(p.kind==='wardrobe'){ const S=SCALE, active=(player&&player.disguiseT>0), pulse=0.5+0.5*Math.sin(s_now()/500+p.x);
      ctx.fillStyle='rgba(0,0,10,.24)'; ctx.beginPath(); ctx.ellipse(sx,sy+0.04*S,0.52*S,0.13*S,0,0,7); ctx.fill();
      ctx.strokeStyle='#3a2a20'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(sx,sy-1.12*S); ctx.moveTo(sx-0.38*S,sy-0.88*S); ctx.lineTo(sx+0.38*S,sy-0.88*S); ctx.stroke(); ctx.lineWidth=1;
      ctx.fillStyle=active?'#7d9fbc':'#6b4a34'; ctx.beginPath(); ctx.moveTo(sx-0.34*S,sy-0.86*S); ctx.lineTo(sx-0.12*S,sy-0.42*S); ctx.lineTo(sx-0.30*S,sy-0.06*S); ctx.lineTo(sx-0.48*S,sy-0.44*S); ctx.closePath(); ctx.fill();
      ctx.fillStyle=active?'#b6cce0':'#465a78'; ctx.beginPath(); ctx.moveTo(sx+0.28*S,sy-0.86*S); ctx.lineTo(sx+0.44*S,sy-0.42*S); ctx.lineTo(sx+0.22*S,sy-0.05*S); ctx.lineTo(sx+0.08*S,sy-0.44*S); ctx.closePath(); ctx.fill();
      if(active){ ctx.strokeStyle='rgba(180,220,255,'+(0.35+0.25*pulse)+')'; ctx.beginPath(); ctx.arc(sx,sy-0.55*S,0.62*S,0,7); ctx.stroke(); } }
    else if(p.kind==='dummy'){ ctx.fillStyle='#7a5a2a'; ctx.fillRect(sx-1.5,sy-12,3,18); ctx.fillRect(sx-8,sy-8,16,3); ctx.fillStyle=p.uses>0?'#d2b878':'#8a7a55'; ctx.beginPath(); ctx.arc(sx,sy-14,5,0,7); ctx.fill(); }
    else if(p.kind==='book'){ ctx.fillStyle=p.used?'#555':'#8a4a3a'; ctx.fillRect(sx-6,sy-4,12,8); ctx.fillStyle='#e8e0c8'; ctx.fillRect(sx-4,sy-2,8,4); }
        else if(p.kind==='fountain'){ ctx.fillStyle='#5a5c66'; ctx.beginPath(); ctx.arc(sx,sy,12,0,7); ctx.fill();
      ctx.fillStyle='#3a7ab0'; ctx.beginPath(); ctx.arc(sx,sy,9,0,7); ctx.fill();
      ctx.fillStyle='rgba(180,220,255,.8)'; ctx.beginPath(); ctx.arc(sx,sy-3-2*Math.abs(Math.sin(s_now()/400)),2.5,0,7); ctx.fill(); }
        else if(p.kind==='obelisk'){ const g=1-(p.pt||4)/4; ctx.fillStyle='#241826'; ctx.fillRect(sx-5,sy-22,10,28); ctx.fillStyle='rgba(200,90,160,'+(0.25+g*0.6)+')'; ctx.fillRect(sx-3,sy-18,6,20); }
    else if(p.kind==='chest'){ const ci=assetImg('prop_chest');
      if(ci && !p.opened){ drawAsset(ci, sx, sy-4, (p.big?1.5:1.1)*SCALE, 1); if(p.locked){ ctx.fillStyle='rgba(40,40,60,.45)'; ctx.beginPath(); ctx.arc(sx,sy-4,(p.big?.8:.6)*SCALE,0,7); ctx.fill(); } }
      else { const w=p.big?1.0:0.8, hh=p.big?0.7:0.55, x0=sx-w*SCALE/2, y0=sy-hh*SCALE/2;
      ctx.fillStyle=p.opened?'#5a4a32':(p.big?'#c79a32':'#b8862f'); ctx.fillRect(x0,y0,w*SCALE,hh*SCALE);
      ctx.strokeStyle=p.big?'#ffe066':'#7a5a22'; ctx.lineWidth=2; ctx.strokeRect(x0,y0,w*SCALE,hh*SCALE); ctx.lineWidth=1;
      if(!p.opened){ ctx.fillStyle='#5a3'; ctx.fillRect(x0,sy-2,w*SCALE,3); } } }
    else if(p.kind==='mound'){ const jx=p.shakeT>0?rand(-2.5,2.5):0, jy=p.shakeT>0?rand(-2,2):0;
      if(!p.sprung){ ctx.fillStyle='rgba(0,0,0,.22)'; ctx.beginPath(); ctx.ellipse(sx,sy+0.26*SCALE,0.5*SCALE,0.13*SCALE,0,0,7); ctx.fill();
        ctx.fillStyle='#5a4632'; ctx.beginPath(); ctx.ellipse(sx+jx,sy+jy,0.55*SCALE,0.34*SCALE,0,0,7); ctx.fill();
        ctx.fillStyle='#6e5840'; ctx.beginPath(); ctx.ellipse(sx+jx-3,sy+jy-4,0.3*SCALE,0.18*SCALE,0,0,7); ctx.fill(); }
      else { ctx.fillStyle='rgba(40,30,22,.55)'; ctx.beginPath(); ctx.ellipse(sx,sy,0.5*SCALE,0.3*SCALE,0,0,7); ctx.fill(); } }
    else if(p.kind==='cookfire'){ const S=SCALE, fl9=0.7+0.3*Math.sin(s_now()/160+p.x*5);
      ctx.fillStyle='#4a4440'; for(let i9=0;i9<5;i9++){ const a9=i9/5*6.28; ctx.beginPath(); ctx.arc(sx+Math.cos(a9)*0.3*S, sy+Math.sin(a9)*0.14*S, 0.08*S,0,7); ctx.fill(); }
      ctx.globalCompositeOperation='lighter';
      ctx.fillStyle='rgba(255,150,50,'+(.5*fl9)+')'; ctx.beginPath(); ctx.arc(sx,sy-0.18*S,0.26*S*fl9,0,7); ctx.fill();
      ctx.fillStyle='rgba(255,230,140,.9)'; ctx.beginPath(); ctx.ellipse(sx,sy-0.16*S,0.09*S,0.16*S*fl9,0,0,7); ctx.fill();
      ctx.globalCompositeOperation='source-over'; }
    else if(p.kind==='keg'){ const S=SCALE;
      ctx.fillStyle='#7a5230'; ctx.fillRect(sx-0.22*S, sy-0.5*S, 0.44*S, 0.5*S);
      ctx.fillStyle='rgba(255,255,255,.10)'; ctx.fillRect(sx-0.22*S, sy-0.5*S, 0.13*S, 0.5*S);
      ctx.strokeStyle='#3c2814'; ctx.lineWidth=Math.max(1.5,S*0.045);
      ctx.beginPath(); ctx.moveTo(sx-0.22*S, sy-0.36*S); ctx.lineTo(sx+0.22*S, sy-0.36*S); ctx.moveTo(sx-0.22*S, sy-0.16*S); ctx.lineTo(sx+0.22*S, sy-0.16*S); ctx.stroke(); ctx.lineWidth=1;
      ctx.fillStyle='#2c1c0e'; ctx.beginPath(); ctx.arc(sx, sy-0.26*S, 0.05*S, 0, 7); ctx.fill(); }
    else if(p.kind==='monolith'){ const S=SCALE, acc9=realm?realm.accent:[160,170,200];
      ctx.fillStyle='rgba(0,0,10,.30)'; ctx.beginPath(); ctx.ellipse(sx,sy+2,0.55*S,0.16*S,0,0,7); ctx.fill();
      ctx.fillStyle='#34323c'; ctx.beginPath();
      ctx.moveTo(sx-0.30*S,sy); ctx.lineTo(sx-0.20*S,sy-1.55*S); ctx.lineTo(sx+0.16*S,sy-1.62*S); ctx.lineTo(sx+0.30*S,sy); ctx.closePath(); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.10)'; ctx.beginPath();
      ctx.moveTo(sx-0.30*S,sy); ctx.lineTo(sx-0.20*S,sy-1.55*S); ctx.lineTo(sx-0.08*S,sy-1.58*S); ctx.lineTo(sx-0.13*S,sy); ctx.closePath(); ctx.fill();
      { const gl=0.5+0.5*Math.sin(s_now()/700+p.x);
        ctx.fillStyle='rgba('+acc9[0]+','+acc9[1]+','+acc9[2]+','+(0.35+0.3*gl).toFixed(3)+')';
        for(let i9=0;i9<4;i9++) ctx.fillRect(sx-0.04*S, sy-1.4*S+i9*0.32*S, 0.08*S, 0.16*S);
        drawGlow(sx,sy-0.8*S,0.9*S,acc9[0],acc9[1],acc9[2],0.10*gl); } }
    else if(p.kind==='lamp'){ const S=SCALE, t9=s_now(), fl3=0.78+0.22*Math.sin(t9/300+p.x*7), tl=p.tall?1.32:1;
      const LH=p.col||[255,195,105], LG=p.col||[255,214,130];   // faction-tinted glow when p.col is set, else warm lamplight
      const ph=1.18*S*tl;
      ctx.fillStyle='rgba(0,0,10,.30)'; ctx.beginPath(); ctx.ellipse(sx,sy+0.02*S,0.26*S,0.09*S,0,0,7); ctx.fill();
      ctx.fillStyle='#2b2733'; ctx.fillRect(sx-0.14*S, sy-0.12*S, 0.28*S, 0.13*S);                 // stone plinth
      ctx.fillStyle='rgba(255,255,255,.10)'; ctx.fillRect(sx-0.14*S, sy-0.12*S, 0.28*S, 2);
      ctx.fillStyle='#15121c'; ctx.fillRect(sx-0.045*S, sy-ph, 0.09*S, ph-0.10*S);                 // iron post
      ctx.fillStyle='#3a3446'; ctx.fillRect(sx-0.045*S, sy-ph, 0.032*S, ph-0.10*S);                // rim light
      ctx.fillStyle='#241f2c'; ctx.fillRect(sx-0.085*S, sy-ph-0.02*S, 0.17*S, 0.045*S);            // collar
      const hw=0.30*S, hh=0.30*S, hx=sx-hw/2, hy=sy-ph-0.02*S-hh;
      ctx.globalCompositeOperation='lighter';
      const ng9=nightAmt(); drawGlow(sx, hy+hh/2, (p.tall?2.3:1.7)*S*(0.8+ng9*0.8), LH[0],LH[1],LH[2], (p.tall?0.40:0.34)*fl3*(0.5+ng9*1.0));   // halo surges at night
      ctx.globalCompositeOperation='source-over';
      ctx.fillStyle='rgba('+LG[0]+','+LG[1]+','+LG[2]+','+(0.80+0.18*fl3).toFixed(3)+')'; ctx.fillRect(hx+1.5, hy+1.5, hw-3, hh-3);   // glass
      ctx.fillStyle='rgba(255,255,235,.95)'; ctx.beginPath(); ctx.arc(sx, hy+hh*0.58, 0.045*S+0.012*S*fl3, 0, 7); ctx.fill();  // flame
      ctx.strokeStyle='#191521'; ctx.lineWidth=2; ctx.strokeRect(hx, hy, hw, hh);                  // frame
      ctx.lineWidth=1.2; ctx.beginPath(); ctx.moveTo(sx, hy); ctx.lineTo(sx, hy+hh);
      ctx.moveTo(hx, hy+hh*0.5); ctx.lineTo(hx+hw, hy+hh*0.5); ctx.stroke();                        // mullions
      ctx.fillStyle='#241f2c'; ctx.beginPath(); ctx.moveTo(hx-0.03*S, hy); ctx.lineTo(sx, hy-0.14*S);
      ctx.lineTo(hx+hw+0.03*S, hy); ctx.closePath(); ctx.fill();                                    // pitched cap
      ctx.fillStyle='rgba(255,255,255,.12)'; ctx.beginPath(); ctx.moveTo(hx-0.03*S, hy);
      ctx.lineTo(sx, hy-0.14*S); ctx.lineTo(sx+0.02*S, hy-0.112*S); ctx.lineTo(hx+hw*0.38, hy); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#3a3446'; ctx.beginPath(); ctx.arc(sx, hy-0.165*S, 0.035*S, 0, 7); ctx.fill(); // finial
      drawGlow(sx,sy,(p.tall?1.7:1.25)*S,LH[0],LH[1],LH[2],0.12*fl3); }
    else if(p.kind==='anvil'){ const S=SCALE;
      ctx.fillStyle='#54381e'; ctx.fillRect(sx-0.3*S, sy-0.2*S, 0.6*S, 0.3*S);
      ctx.fillStyle='#3c3f47'; ctx.fillRect(sx-0.42*S, sy-0.46*S, 0.84*S, 0.26*S);
      ctx.fillStyle='#565a64'; ctx.fillRect(sx-0.42*S, sy-0.46*S, 0.84*S, 0.08*S);
      ctx.beginPath(); ctx.moveTo(sx+0.42*S, sy-0.46*S); ctx.lineTo(sx+0.62*S, sy-0.38*S); ctx.lineTo(sx+0.42*S, sy-0.26*S); ctx.closePath(); ctx.fillStyle='#3c3f47'; ctx.fill(); }
    else if(p.kind==='runestone'){ const cc=(vaultSeal&&vaultSeal.cols[p.idx])||[200,200,220];
      ctx.fillStyle='#3c3a48'; ctx.fillRect(sx-0.28*SCALE, sy-0.8*SCALE, 0.56*SCALE, 0.95*SCALE);
      ctx.fillStyle='rgba(255,255,255,.10)'; ctx.fillRect(sx-0.28*SCALE, sy-0.8*SCALE, 0.18*SCALE, 0.95*SCALE);
      const gl=p.lit?0.95:(0.35+0.15*Math.sin(s_now()/300+p.idx*2));
      if(p.lit){ ctx.globalCompositeOperation='lighter'; ctx.fillStyle='rgba('+cc[0]+','+cc[1]+','+cc[2]+',.35)'; ctx.beginPath(); ctx.arc(sx,sy-0.35*SCALE,0.55*SCALE,0,7); ctx.fill(); ctx.globalCompositeOperation='source-over'; }
      ctx.fillStyle='rgba('+cc[0]+','+cc[1]+','+cc[2]+','+gl+')'; ctx.beginPath(); ctx.arc(sx,sy-0.35*SCALE,0.14*SCALE,0,7); ctx.fill(); }
    else if(p.kind==='obelisk'){ const S=SCALE, pulse=0.5+0.5*Math.sin(s_now()/1000*2), lit=!p.used;
      if(lit){ ctx.fillStyle='rgba(255,210,90,'+(0.12*pulse)+')'; ctx.beginPath(); ctx.arc(sx, sy-0.4*S, 0.72*S*(0.85+0.25*pulse), 0, 7); ctx.fill(); }
      ctx.fillStyle='#3a3526'; ctx.fillRect(sx-0.34*S, sy+0.04*S, 0.68*S, 0.16*S);
      ctx.fillStyle=lit?'#6b5a32':'#48433a'; ctx.beginPath(); ctx.moveTo(sx-0.22*S, sy+0.08*S); ctx.lineTo(sx-0.13*S, sy-0.95*S); ctx.lineTo(sx+0.13*S, sy-0.95*S); ctx.lineTo(sx+0.22*S, sy+0.08*S); ctx.closePath(); ctx.fill();
      ctx.fillStyle=lit?'rgba(255,'+Math.round(200+40*pulse)+',90,'+(0.6+0.4*pulse)+')':'rgba(90,84,70,.6)'; ctx.fillRect(sx-0.06*S, sy-0.78*S, 0.12*S, 0.54*S);
    }
    else if(p.kind==='covenant'){ const S=SCALE, h=covHeat(), pulse=0.5+0.5*Math.sin(s_now()/1000*2);
      const gr=h>0?[255,Math.max(40,120-h*16),60]:[150,150,170];
      if(h>0){ ctx.fillStyle='rgba('+gr[0]+','+gr[1]+','+gr[2]+','+((0.10+0.03*h)*pulse)+')'; ctx.beginPath(); ctx.arc(sx, sy-0.4*S, 0.82*S*(0.85+0.25*pulse), 0, 7); ctx.fill(); }
      ctx.fillStyle='#3a3640'; ctx.fillRect(sx-0.36*S, sy+0.02*S, 0.72*S, 0.18*S);
      ctx.fillStyle='#4c4754'; ctx.fillRect(sx-0.26*S, sy-0.85*S, 0.52*S, 0.9*S);
      ctx.fillStyle='rgba('+gr[0]+','+gr[1]+','+gr[2]+','+(h>0?(0.6+0.35*pulse):0.5)+')';
      for(let i=0;i<3;i++) ctx.fillRect(sx-0.12*S, sy-0.7*S+i*0.22*S, 0.24*S, 0.08*S);
      ctx.fillStyle=h>0?('rgb('+gr[0]+','+gr[1]+','+gr[2]+')'):'#888'; ctx.font=Math.round(0.26*S)+'px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('⚜', sx, sy-0.4*S); ctx.textAlign='left'; ctx.textBaseline='alphabetic';
    }
    else if(p.kind==='market'){ const S=SCALE;
      for(let i=0;i<4;i++){ ctx.fillStyle=i%2?'#b23b3b':'#e8d8c0'; ctx.fillRect(sx-0.6*S+i*0.3*S, sy-0.82*S, 0.3*S, 0.22*S); }   // striped awning
      ctx.fillStyle='#5b3f28'; ctx.fillRect(sx-0.62*S, sy-0.6*S, 0.06*S, 0.62*S); ctx.fillRect(sx+0.56*S, sy-0.6*S, 0.06*S, 0.62*S);   // posts
      ctx.fillStyle='#6b4a2c'; ctx.fillRect(sx-0.64*S, sy-0.1*S, 1.28*S, 0.2*S);   // counter
      ctx.fillStyle='#c0654a'; ctx.fillRect(sx-0.5*S, sy-0.24*S, 0.12*S, 0.14*S);   // wares
      ctx.fillStyle='#66ccff'; ctx.fillRect(sx-0.3*S, sy-0.26*S, 0.1*S, 0.16*S);
      ctx.fillStyle='#ffd34d'; ctx.fillRect(sx-0.12*S, sy-0.22*S, 0.1*S, 0.12*S);
      ctx.fillStyle='#2a2438'; ctx.beginPath(); ctx.arc(sx+0.3*S, sy-0.36*S, 0.2*S, 0, 7); ctx.fill();   // hooded merchant
      ctx.fillStyle='#0c0a14'; ctx.beginPath(); ctx.arc(sx+0.3*S, sy-0.32*S, 0.12*S, 0, 7); ctx.fill();
      ctx.fillStyle='rgba(255,220,120,.95)'; ctx.fillRect(sx+0.25*S, sy-0.36*S, 0.03*S, 0.03*S); ctx.fillRect(sx+0.33*S, sy-0.36*S, 0.03*S, 0.03*S);   // eyes
    }
    else if(p.kind==='powderkeg'){ const S=SCALE;
      ctx.fillStyle='#5b3a1e'; ctx.fillRect(sx-0.26*S, sy-0.52*S, 0.52*S, 0.52*S);
      ctx.fillStyle='#6e4724'; ctx.fillRect(sx-0.26*S, sy-0.52*S, 0.08*S, 0.52*S);
      ctx.fillStyle='#2e1d0f'; ctx.fillRect(sx-0.26*S, sy-0.40*S, 0.52*S, 0.05*S); ctx.fillRect(sx-0.26*S, sy-0.14*S, 0.52*S, 0.05*S);
      ctx.fillStyle='#15110c'; ctx.fillRect(sx-0.12*S, sy-0.58*S, 0.24*S, 0.10*S);
      ctx.fillStyle='#d8c050'; ctx.font=Math.round(0.3*S)+'px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('☣', sx, sy-0.22*S); ctx.textAlign='left'; ctx.textBaseline='alphabetic';
    }
    else if(p.kind==='oilslick'){ const S=SCALE, lit=p.lit>0;
      ctx.fillStyle=lit?'rgba(50,28,14,.9)':'rgba(18,16,24,.85)'; ctx.beginPath(); ctx.ellipse(sx, sy, 0.95*S, 0.5*S, 0, 0, 7); ctx.fill();
      if(lit){ const f=0.5+0.5*Math.sin(s_now()/1000*16); ctx.fillStyle='rgba(255,150,50,'+(0.45+0.3*f).toFixed(2)+')'; ctx.beginPath(); ctx.ellipse(sx, sy, 0.72*S, 0.38*S, 0, 0, 7); ctx.fill();
        for(let i=0;i<6;i++){ const a=i/6*6.28+s_now()/1000*1.5; ctx.fillStyle='rgba(255,190,80,.65)'; ctx.fillRect(sx+Math.cos(a)*0.55*S-1.5, sy+Math.sin(a)*0.30*S-0.22*S, 3, 0.22*S); } }
      else { ctx.fillStyle='rgba(140,130,160,.22)'; ctx.beginPath(); ctx.ellipse(sx-0.22*S, sy-0.1*S, 0.32*S, 0.16*S, 0, 0, 7); ctx.fill(); }
    }
    else if(p.kind==='altar'){ const S=SCALE, pulse=0.5+0.5*Math.sin(s_now()/1000*2.5);
      if(!p.used){ ctx.fillStyle='rgba(190,70,255,'+(0.16*pulse)+')'; ctx.beginPath(); ctx.arc(sx, sy-0.18*S, 0.62*S*(0.85+0.25*pulse), 0, 7); ctx.fill(); }
      ctx.fillStyle='#1a1620'; ctx.fillRect(sx-0.46*S, sy+0.12*S, 0.92*S, 0.16*S);
      ctx.fillStyle='#2c2434'; ctx.fillRect(sx-0.36*S, sy-0.26*S, 0.72*S, 0.42*S);
      ctx.fillStyle=p.used?'rgba(80,70,90,.7)':'rgba(210,'+Math.round(60+70*pulse)+',255,'+(0.55+0.4*pulse)+')';
      ctx.fillRect(sx-0.14*S, sy-0.40*S, 0.28*S, 0.16*S);
      ctx.fillStyle=p.used?'#5a5460':'#e070ff'; ctx.font=Math.round(0.3*S)+'px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('⛧', sx, sy-0.30*S); ctx.textAlign='left'; ctx.textBaseline='alphabetic';
    }
    else if(p.kind==='shrine'){ ctx.fillStyle=p.used?'#444':'#9b8cff'; ctx.fillRect(sx-0.25*SCALE,sy-0.7*SCALE,0.5*SCALE,1.0*SCALE);
      ctx.beginPath(); ctx.arc(sx,sy-0.75*SCALE,0.32*SCALE,0,7); ctx.fillStyle=p.used?'#555':'#cfc4ff'; ctx.fill(); }
}

function render(){
  const sh=shake*SCALE; ox=rand(-sh,sh)+kickX+camPeekX; oy=rand(-sh,sh)+kickY+camPeekY;
  ctx.fillStyle=bgCol||'#0d0c12'; ctx.fillRect(0,0,W,H);          // void between rooms
  for(const fl of floors){ const[ax9,ay9]=w2s(fl.x-fl.w/2,fl.y-fl.h/2);            // liquid/hazard beds only — the tile covers all stone
    if(ax9>W+40||ay9>H+40||ax9+fl.w*SCALE<-40||ay9+fl.h*SCALE<-40) continue;
    if(!(fl.water||fl.hazard||fl.spring)) continue;
    rect(fl.x,fl.y,fl.w,fl.h, fl.col||floorCol||'#2c2a35'); }
  for(const fl of floors){ const[ax,ay]=w2s(fl.x-fl.w/2,fl.y-fl.h/2), aw=fl.w*SCALE, ah=fl.h*SCALE;
    if(ax>W+40||ay>H+40||ax+aw<-40||ay+ah<-40) continue;
    if(fl.water||fl.spring){ ctx.strokeStyle='rgba(190,230,255,.30)'; ctx.lineWidth=2; ctx.strokeRect(ax+1,ay+1,aw-2,ah-2); ctx.lineWidth=1; }
    else if(fl.hazard){ const hc=fl.hazard==='void'?'150,90,255':'255,120,40';
      ctx.strokeStyle='rgba('+hc+','+(0.35+0.15*Math.sin(s_now()/400))+')'; ctx.lineWidth=2.5; ctx.strokeRect(ax+1,ay+1,aw-2,ah-2); ctx.lineWidth=1; } }
    paintGround();
  for(const b of buildings){                                   // buildings sit ON the floor: soft drop shadow
    const [sbx,sby]=w2s(b.x-b.w/2, b.y-b.h/2), sbw=b.w*SCALE, sbh=b.h*SCALE;
    if(sbx>W+80||sby>H+80||sbx+sbw<-80||sby+sbh<-80) continue;
    ctx.fillStyle='rgba(0,0,8,.22)'; ctx.fillRect(sbx+0.10*SCALE, sby+0.16*SCALE, sbw+3, sbh+3); }
  for(const wl of walls) drawWall(wl);
  { const ri9=realmIndex(floor), rc=ROOFS[ri9]||'#4a4a55', t2=s_now();
    const rcA=hexA(rc), roofHi=shade(rcA,.26), roofLo=shade(rcA,-.22);
    const wb=hexA(wallCol||'#46434f'), facHi=shade(wb,.14), facLo=shade(wb,-.34);
    const acc=realm?realm.accent:[185,165,125];
    for(const b of buildings){
      const [bx,by]=w2s(b.x-b.w/2, b.y-b.h/2), bw=b.w*SCALE, bh=b.h*SCALE;
      if(bx>W+60||by>H+60||bx+bw<-60||by+bh<-60) continue;
      const ov=0.16*SCALE, fh=Math.min(0.70*SCALE, bh*0.34), rh=bh-fh;
      const rx=bx-ov, ry=by-ov, rw=bw+ov*2, rhh=rh+ov;
      const rv=((b.x*73+b.y*131)|0)&255, nA=nightAmt();
      // ---- hipped roof: a real ridge with four shaded slopes ----
      const rcb=shade(rcA, ((rv&7)/7-0.5)*0.34 + (((rv>>3)&1)?0.04:-0.10));
      const rHi=shade(rcb,.34), rMid=shade(rcb,.06), rLo=shade(rcb,-.24), rBot=shade(rcb,-.14), rCap=shade(rcb,.20);
      const inx=Math.min(rw*0.30, rhh*0.62), iny=rhh*0.34;
      const TL=[rx,ry],TR=[rx+rw,ry],BR=[rx+rw,ry+rhh],BL=[rx,ry+rhh];
      const dTL=[rx+inx,ry+iny],dTR=[rx+rw-inx,ry+iny],dBR=[rx+rw-inx,ry+rhh-iny],dBL=[rx+inx,ry+rhh-iny];
      const quad=(a,b2,c,d,f)=>{ ctx.fillStyle=f; ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b2[0],b2[1]); ctx.lineTo(c[0],c[1]); ctx.lineTo(d[0],d[1]); ctx.closePath(); ctx.fill(); };
      quad(BL,BR,dBR,dBL,rBot); quad(TL,TR,dTR,dTL,rHi); quad(TL,dTL,dBL,BL,rMid); quad(TR,BR,dBR,dTR,rLo); quad(dTL,dTR,dBR,dBL,rCap);
      ctx.strokeStyle='rgba(255,255,255,.22)'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(dTL[0],dTL[1]); ctx.lineTo(dTR[0],dTR[1]); ctx.stroke();   // ridge highlight
      ctx.strokeStyle='rgba(0,0,0,.22)'; ctx.lineWidth=1; ctx.beginPath();                       // hip lines down to the corners
      ctx.moveTo(TL[0],TL[1]); ctx.lineTo(dTL[0],dTL[1]); ctx.moveTo(TR[0],TR[1]); ctx.lineTo(dTR[0],dTR[1]);
      ctx.moveTo(BR[0],BR[1]); ctx.lineTo(dBR[0],dBR[1]); ctx.moveTo(BL[0],BL[1]); ctx.lineTo(dBL[0],dBL[1]); ctx.stroke();
      ctx.strokeStyle='rgba(0,0,0,.10)';                                                          // shingle courses on the front slope
      for(let k=1;k<3;k++){ const ty=dBL[1]+(BL[1]-dBL[1])*k/3; ctx.beginPath(); ctx.moveTo(rx+rw*0.13,ty); ctx.lineTo(rx+rw*0.87,ty); ctx.stroke(); }
      ctx.fillStyle='rgba('+acc[0]+','+acc[1]+','+acc[2]+',.5)'; ctx.fillRect(rx, ry+rhh-2.5, rw, 2);   // accent eave trim
      ctx.strokeStyle='rgba(0,0,0,.40)'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(TL[0],TL[1]); ctx.lineTo(TR[0],TR[1]); ctx.lineTo(BR[0],BR[1]); ctx.lineTo(BL[0],BL[1]); ctx.closePath(); ctx.stroke(); ctx.lineWidth=1;
      // chimney + a curl of smoke (now on more homes)
      const hb=rv;
      if((hb&3)===0 && bw>30){ const chx=rx+rw*(0.24+(hb>>4&3)*0.17), chy=ry+iny*0.5;
        ctx.fillStyle='#2a2730'; ctx.fillRect(chx-3.5, chy-10, 7, 12);
        ctx.fillStyle='#4a4654'; ctx.fillRect(chx-4, chy-11, 8, 2.4);                              // glowing cap
        ctx.fillStyle='rgba(255,255,255,.12)'; ctx.fillRect(chx-3.5, chy-10, 7, 2);
        for(let pf=0; pf<3; pf++){ const pp=((t2/2600)+pf/3+hb/255)%1;
          const smy=chy-12-pp*26, smx=chx+Math.sin(t2/900+pf*2.1+hb)*3*pp, rr=2.5+pp*4.5;
          ctx.fillStyle='rgba(190,188,200,'+(0.14*(1-pp)).toFixed(3)+')';
          ctx.beginPath(); ctx.arc(smx,smy,rr,0,7); ctx.fill(); } }
      // ---- stone facade under the eave ----
      ctx.fillStyle='rgba(0,0,0,.32)'; ctx.fillRect(rx, by+rh-3, rw, 4);                          // eave underside shadow
      ctx.drawImage(vstrip(facHi, facLo), bx, by+rh, bw, fh);
      ctx.fillStyle='rgba(0,0,0,.28)'; ctx.fillRect(bx, by+rh+fh-0.13*SCALE, bw, 0.13*SCALE);     // plinth / base course
      ctx.strokeStyle='rgba(0,0,0,.38)'; ctx.lineWidth=1; ctx.strokeRect(bx+0.5, by+rh+0.5, bw-1, fh-1);
      for(let qy=by+rh+3; qy<by+rh+fh-4; qy+=7){ ctx.fillStyle='rgba(255,255,255,.08)';            // corner quoins
        ctx.fillStyle='rgba(255,255,255,.09)'; ctx.fillRect(bx+1.5,qy,4.5,4.5); ctx.fillRect(bx+bw-6,qy,4.5,4.5);
        ctx.fillStyle='rgba(0,0,0,.18)'; ctx.fillRect(bx+1.5,qy+4.5,4.5,1.2); ctx.fillRect(bx+bw-6,qy+4.5,4.5,1.2); }
      const fl2=0.72+0.28*Math.sin(t2/420+b.x);
      // arched, framed doorway with a step and warm light spilling out
      const dw=Math.min(1.2*SCALE, bw*0.32), dxc=bx+bw/2, dy0=by+rh+fh*0.30, dhh=fh*0.70;
      ctx.fillStyle='rgba(0,0,0,.25)'; ctx.fillRect(dxc-dw/2-3, dy0+dhh-2, dw+6, 4);              // door step shadow
      ctx.fillStyle='#3a2a18'; ctx.fillRect(dxc-dw/2-2, dy0-3, dw+4, dhh+3);                       // jamb
      ctx.fillStyle='#120e0a'; ctx.fillRect(dxc-dw/2, dy0, dw, dhh);                               // recess
      ctx.beginPath(); ctx.arc(dxc, dy0, dw/2, Math.PI, 0); ctx.fillStyle='#3a2a18'; ctx.fill();
      ctx.beginPath(); ctx.arc(dxc, dy0+1, dw/2-2, Math.PI, 0); ctx.fillStyle='#120e0a'; ctx.fill();
      ctx.fillStyle='rgba('+acc[0]+','+acc[1]+','+acc[2]+',.6)'; ctx.fillRect(dxc-1.5, dy0-dw/2-1.5, 3, 3);  // keystone
      drawGlow(dxc, by+rh+fh*0.7, 1.5*SCALE, 255,190,90, (0.12+0.28*nA)*fl2);
      // lit mullioned windows — glow with the night
      for(const wxr of [-0.31, 0.31]){ const wx2=bx+bw/2+bw*wxr;
        if(Math.abs(wxr)*bw < dw*0.5+0.24*SCALE+4) continue;
        const ww=0.34*SCALE, wh=fh*0.42, wy=by+rh+fh*0.28, wlx=wx2-ww/2;
        ctx.fillStyle='#2a1d12'; ctx.fillRect(wlx-2.5, wy-2.5, ww+5, wh+5);                        // window frame + sill
        ctx.fillStyle='#1a120c'; ctx.fillRect(wlx-3, wy+wh+1, ww+6, 2);                            // sill
        const wg=(0.22+0.55*nA)*(0.7+0.3*Math.sin(t2/500+b.x*3+wxr*9));
        ctx.fillStyle='rgba(255,205,110,'+Math.max(0.12,wg).toFixed(3)+')'; ctx.fillRect(wlx, wy, ww, wh);
        if(nA>0.3) drawGlow(wx2, wy+wh/2, 0.9*SCALE, 255,200,120, 0.18*nA);
        ctx.strokeStyle='rgba(20,14,10,.85)'; ctx.lineWidth=1.5;                                   // mullions
        ctx.beginPath(); ctx.moveTo(wx2,wy); ctx.lineTo(wx2,wy+wh); ctx.moveTo(wlx,wy+wh/2); ctx.lineTo(wlx+ww,wy+wh/2); ctx.stroke(); ctx.lineWidth=1; }
    } }

// living liquids: shimmer bands on water/springs, pulse on lava, breathing dark on void
  { const tn=s_now();
    for(const fl of floors){ if(!(fl.water||fl.hazard||fl.spring)) continue;
      const[ax,ay]=w2s(fl.x-fl.w/2, fl.y-fl.h/2), aw=fl.w*SCALE, ah=fl.h*SCALE, ccx=ax+aw/2, ccy=ay+ah/2;
      const grd=ctx.createRadialGradient(ccx,ccy,Math.min(aw,ah)*0.08, ccx,ccy,Math.max(aw,ah)*0.62);   // deeper in the middle, shallow at the shore
      if(fl.water||fl.spring){ grd.addColorStop(0,'rgba(0,12,24,.40)'); grd.addColorStop(0.7,'rgba(40,90,120,.12)'); grd.addColorStop(1,'rgba(120,170,200,0)'); }
      else if(fl.hazard==='burn'){ grd.addColorStop(0,'rgba(255,150,50,'+(0.22+0.1*Math.sin(tn/300)).toFixed(3)+')'); grd.addColorStop(0.6,'rgba(150,40,12,.22)'); grd.addColorStop(1,'rgba(70,12,0,0)'); }
      else { grd.addColorStop(0,'rgba(150,90,230,'+(0.18+0.08*Math.sin(tn/700)).toFixed(3)+')'); grd.addColorStop(1,'rgba(40,20,70,0)'); }
      ctx.fillStyle=grd; ctx.fillRect(ax,ay,aw,ah);
      ctx.strokeStyle=(fl.water||fl.spring)?'rgba(160,205,235,.28)':(fl.hazard==='burn'?'rgba(255,190,100,.32)':'rgba(190,150,255,.26)');   // wet shoreline rim
      ctx.lineWidth=2.2; ctx.strokeRect(ax+1.5,ay+1.5,aw-3,ah-3); ctx.lineWidth=1;
      if(fl.water||fl.spring){ ctx.fillStyle='rgba(255,255,255,.10)';
        for(let b=0;b<3;b++){ const yy=ay+((tn/1400+b*0.34)%1)*ah; ctx.fillRect(ax+4, yy, aw-8, 1.8); } } } }

    // shockwaves: filled clouds (poison/trail) + expanding rings (slams)
  for(const sh of shocks){ const[sx,sy]=w2s(sh.x,sh.y); ctx.beginPath(); ctx.arc(sx,sy,sh.r*SCALE,0,7);
    if(sh.poison||sh.friendly){ ctx.fillStyle=`rgba(${sh.col[0]},${sh.col[1]},${sh.col[2]},${0.18*clamp01(sh.life/sh.max)+0.08})`; ctx.fill(); }
    else { ctx.lineWidth=Math.max(2,6*(sh.life/sh.max)); ctx.strokeStyle=`rgba(${sh.col[0]},${sh.col[1]},${sh.col[2]},${clamp01(sh.life/sh.max)})`; ctx.stroke(); } }
  ctx.lineWidth=1;
  for(const sl of slashes){ const[sx,sy]=w2s(sl.x,sl.y), t=sl.life/sl.max;     // weapon swing arcs (true hitbox)
    ctx.strokeStyle=sl.heavy?('rgba(255,255,255,'+(.85*t)+')'):('rgba(200,255,235,'+(.8*t)+')'); ctx.lineWidth=(sl.heavy?8:4)*t+1; ctx.lineCap='round';
    ctx.beginPath(); ctx.arc(sx,sy,sl.reach*SCALE*(0.8+0.25*(1-t)),sl.ang-sl.arc/2,sl.ang+sl.arc/2); ctx.stroke(); }
  ctx.lineWidth=1;
  for(const c of coins){ const[sx,sy]=w2s(c.x,c.y); ctx.beginPath(); ctx.arc(sx,sy,c.r*SCALE,0,7); ctx.fillStyle='#ffd34d'; ctx.fill(); ctx.strokeStyle='#b8860b'; ctx.stroke(); }
  for(const g of worldKit){ const def=(g.trinket?TRINKET_DEFS_MAP:KIT_DEFS_MAP)[g.key]; if(!def) continue; const[sx,sy]=w2s(g.x,g.y); contactShadow(sx,sy+g.r*SCALE*.7,g.r*SCALE,g.r*SCALE*.4,.5); const bob=Math.sin(performance.now()/300+g.x)*3; def.icon(ctx,sx,sy+bob,g.r*SCALE*1.1); }

  // exit stair to the next floor
  if(exit) drawExit();

  for(const mo of mortars){ const[mx2,my2]=w2s(mo.x,mo.y), k=1-(mo.t/(mo.max||1)); const mc=mo.col||[255,150,60];
    ctx.globalAlpha=.35+.3*k; ctx.strokeStyle='rgba('+mc[0]+','+mc[1]+','+mc[2]+',.9)'; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.arc(mx2,my2,mo.r*SCALE,0,7); ctx.stroke();
    ctx.fillStyle='rgba('+mc[0]+','+mc[1]+','+mc[2]+','+(0.08+0.2*k)+')'; ctx.beginPath(); ctx.arc(mx2,my2,mo.r*SCALE*k,0,7); ctx.fill();
    ctx.globalAlpha=1; ctx.lineWidth=1; }
  for(const s of mobs){ if(!s.tele) continue; const T=s.tele, pgt=1-T.t/T.max;       // attack telegraphs on the ground
    if(T.kind==='volley'){ const[ax,ay]=w2s(s.x,s.y);
      ctx.save(); ctx.globalAlpha=.5*pgt; ctx.strokeStyle='#ff8a5a'; ctx.lineWidth=3; ctx.setLineDash([8,7]);
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(ax+Math.cos(T.ang)*7*SCALE, ay+Math.sin(T.ang)*7*SCALE); ctx.stroke();
      ctx.setLineDash([]); ctx.restore(); }
    else { const[tx2,ty2]=w2s(T.x,T.y);
      ctx.globalAlpha=.30+.3*pgt; ctx.strokeStyle='#ff7a4a'; ctx.lineWidth=2.5;
      ctx.beginPath(); ctx.arc(tx2,ty2,T.r*SCALE,0,7); ctx.stroke();
      ctx.fillStyle='rgba(255,110,60,'+(0.10+0.22*pgt)+')'; ctx.beginPath(); ctx.arc(tx2,ty2,T.r*SCALE*pgt,0,7); ctx.fill();
      ctx.globalAlpha=1; ctx.lineWidth=1; } }
  ctx.globalAlpha=1;
  for(const d of decos){ if(!TALL_DECO[d.type]) drawDeco(d); }
  // props split into ground-level (under characters) and tall standing props (depth-sorted with the player)
  for(const p of props){ if(TALL_PROP[p.kind]) continue; drawProp(p); }


  // NPCs — generated villager sprites with profession gear
  for(const n of npcs){ const[sx,sy]=w2s(n.x,n.y);
    if(sx<-90||sx>W+90||sy<-110||sy>H+90) continue;   // offscreen cull (crowds are big now)
    const nR=n.r*SCALE*((n.type==='child'||n.type==='urchin'||n.kid)?0.72:1)*(n.big?1.6:1)*CHAR_DRAW;
    const nyd=(n.mind==='sleep')?nR*0.5:0;

    contactShadow(sx, sy+nR*.82, nR*.95, nR*.34);
    const nflip=(n.faceX!==undefined && n.faceX<-0.08)?-1:1;
    const km=(ART_PACK==='kenney' && assetImg('kenney_char')) ? kenneyNpcTile(n) : null;
    const ktile=km && kenneyTile(km[0],km[1],nR*2.6);
    if(ktile){ const oy=n.moving?-Math.abs(Math.sin(s_now()/110+n.x))*nR*0.12:0; pxBlit(ktile, sx, sy+nyd-nR*0.18+oy, ktile.width, ktile.height, nflip); }
    else { const nk0='npc_'+n.type, nkey=assetImg(nk0)?nk0:('npc_'+(n.spriteAs||n.type));
      const nfr = animFrames(nkey, n.moving?'walk':'idle') || animFrames(nkey,'idle');
      const naimg=assetImg(nkey);
      if(nfr && nfr.length){ drawAnim(nfr, n, sx, sy+nyd, nR*2.6, nflip); }
      else if(naimg){ drawAsset(naimg, sx, sy+nyd, nR*2.6, nflip); }
      else { const nspr=getFolkSprite(n.spriteAs||n.type, n.color, nR);
        ctx.drawImage(nspr, sx-nspr.width/2, sy+nyd-nspr.height/2); } }
    // --- a small floating glyph shows what the soul is busy with ---
    const act9=(n.mind==='sleep')?'sleep':(n.mind==='use'?n.act:null);
    if(act9 && n.emoteT<=0){ ctx.textAlign='center'; ctx.textBaseline='middle';
      if(act9==='sleep'){ for(let zq=0; zq<2; zq++){ const zt=((s_now()/820)+zq*0.5)%1; ctx.globalAlpha=0.92*(1-zt);
          const zx=sx+nR*0.6+zt*9, zy=sy-nR*0.66-2-zt*13; ctx.font='800 13px system-ui';
          ctx.fillStyle='#15131e'; ctx.fillText('z', zx+0.7, zy+0.7); ctx.fillStyle='#e3e7ff'; ctx.fillText('z', zx, zy); } ctx.globalAlpha=1; }
      else { const ic9=ACT_ICON[act9]; if(ic9){ const bb=Math.sin(s_now()/400+n.x)*1.6, gx=sx+nR*0.86, gy=sy-nR*0.5+bb;
        ctx.globalAlpha=0.95; ctx.fillStyle='rgba(16,14,24,0.56)'; ctx.beginPath(); ctx.arc(gx,gy,9.5,0,7); ctx.fill();
        ctx.fillStyle=ACT_COL[act9]||'#dfe4f0'; ctx.font='800 14px system-ui'; ctx.fillText(ic9, gx, gy+0.5); ctx.globalAlpha=1; } }
      ctx.textAlign='left'; ctx.textBaseline='top'; }
    const pdL=len(n.x-player.x,n.y-player.y), svc=SERVICE_NPC[n.type];
    if(pdL<7 || n.grateful || n.giver || (svc && pdL<15)){              // only label who's near, or a shop/quest you can seek out
      const lbl=(n.given && pdL<7) ? (n.given+(n.surname?' '+n.surname:'')) : n.name.replace(/^the |^a |^an /,'');
      const lcol = n.grateful?'#ffd9a0' : svc?'#bfe0ff' : (n.given?'rgba(236,238,246,.96)':'rgba(222,225,235,.9)');
      namePill(lbl, sx, sy+n.r*SCALE*0.6+3, {size:11, color:lcol, bg:(pdL<7?'rgba(6,7,12,.6)':'rgba(6,7,12,.42)')});
    }
    if(player.quest && ((n.type==='quester' && !player.quest.accepted) || (n.giver && player.quest.done))){ ctx.fillStyle='#ffd000'; ctx.font='900 20px system-ui'; ctx.fillText('!', sx, sy-n.r*SCALE-18); }
    if(n.emoteT>0 && n.emote){ ctx.globalAlpha=Math.min(1,n.emoteT*2.2);   // speech floats above the head
      speechPill(n.emote, sx, sy-n.r*SCALE-7, {size: n.emote.length>2?11:13, weight: n.emote.length>2?'600':'800'});
      ctx.globalAlpha=1; }
    ctx.textAlign='left'; ctx.textBaseline='top';
  }

  for(const s of mobs){
    const bob=1+Math.sin(s.bob)*.06; const[sx,sy]=w2s(s.x,s.y);
    // stealth signatures (lurkers) fade in only when close
    let al=1; if(s.stealth){ const d=len(s.x-player.x,s.y-player.y); al = d>7?0.16 : d>4?0.5 : 1; }
    ctx.globalAlpha=al;
contactShadow(sx, sy+s.r*SCALE*.74, s.r*SCALE*1.02, s.r*SCALE*.36);
    if(s.elite){ const ec=s.eliteCol||[255,200,80], pu=.6+.4*Math.sin(s_now()/240+(s.bob||0));   // elite aura
      ctx.strokeStyle='rgba('+ec[0]+','+ec[1]+','+ec[2]+','+(.45*pu+.25)+')'; ctx.lineWidth=2.5;
      ctx.beginPath(); ctx.ellipse(sx, sy+s.r*SCALE*.72, s.r*SCALE*1.15, s.r*SCALE*.42, 0,0,7); ctx.stroke(); ctx.lineWidth=1;
      const lbl='✦ '+(s.warden?'THE WARDEN':(s.eliteName||s.elite+' '+s.type));
      namePill(lbl, sx, sy+s.r*SCALE*0.8+2, {size:11, weight:'700', color:'rgb('+ec[0]+','+ec[1]+','+ec[2]+')', bg:'rgba(6,7,12,.64)'});
      ctx.textAlign='left'; ctx.textBaseline='top'; }
    if(s.visitor && !s.provoked){ ctx.font='700 10px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.lineWidth=3; ctx.strokeStyle='rgba(0,0,0,.6)'; ctx.strokeText('✈ visiting', sx, sy-s.r*SCALE*1.9);
      ctx.fillStyle='rgba(200,210,230,.85)'; ctx.fillText('✈ visiting', sx, sy-s.r*SCALE*1.9);
      ctx.lineWidth=1; ctx.textAlign='left'; ctx.textBaseline='top'; }
    if(s.emoteT>0 && s.emote){ ctx.globalAlpha=al*Math.min(1,s.emoteT*2.2);   // enemy speech floats above the head
      speechPill(s.emote, sx, sy-s.r*SCALE*1.5-6, {size:11}); ctx.globalAlpha=al; ctx.textAlign='left'; ctx.textBaseline='top'; }
    if(s.merc){ ctx.strokeStyle='rgba(120,230,140,.7)'; ctx.lineWidth=2;   // ally ring
      ctx.beginPath(); ctx.ellipse(sx, sy+s.r*SCALE*.72, s.r*SCALE*1.05, s.r*SCALE*.38, 0,0,7); ctx.stroke(); ctx.lineWidth=1; }
        // image asset if provided, else the generated sprite — flipped toward travel direction
    const R=s.r*SCALE*CHAR_DRAW;
    const akey = s.type==='boss' ? 'boss_wetlands' : s.champion ? ('champ_'+(championsList.indexOf(s)+1)) : ('mob_'+s.type);   // SHADOW Shadowed Wetlands Boss for every realm boss
    const fr = animFrames(akey, s.moving?'walk':'idle') || animFrames(akey,'idle');
    const aimg = assetImg(akey);
    if(fr && fr.length){ drawAnim(fr, s, sx, sy, R*2.6, (s.face||1)); }
    else if(aimg){ drawAsset(aimg, sx, sy, R*2.6, (s.face||1)); }
    else { const spr=getSprite(s.type==='nest'?'nest':(s.look||'slime'), s.color, R, {crown:!!s.gateBoss||!!s.champion});
      ctx.save(); ctx.translate(sx,sy); ctx.scale((s.face||1)*1.04/bob,bob);
      ctx.drawImage(spr,-spr.width/2,-spr.height/2);
      ctx.restore(); }
    // status overlays
    if(s.hitFlash>0){ ctx.globalAlpha=al*Math.min(1,s.hitFlash*4); ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(sx,sy,R,0,7); ctx.fill(); ctx.globalAlpha=al; }
    if(s.eSlowT>0){ ctx.fillStyle='rgba(150,215,255,.35)'; ctx.beginPath(); ctx.arc(sx,sy,R,0,7); ctx.fill(); }
    if(s.burnT>0){ ctx.strokeStyle='rgba(255,140,40,.85)'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(sx,sy,R*1.12,0,7); ctx.stroke(); ctx.lineWidth=1; }
    else if(s.poisonT>0){ ctx.strokeStyle='rgba(120,220,90,.85)'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(sx,sy,R*1.12,0,7); ctx.stroke(); ctx.lineWidth=1; }
    if(s.sig){ ctx.lineWidth=2; ctx.strokeStyle='rgba(255,255,255,.65)'; ctx.beginPath(); ctx.arc(sx,sy,R*1.2,0,7); ctx.stroke(); ctx.lineWidth=1; } // elite ring
    ctx.globalAlpha=1;
    // charge wind-up telegraph: a bright line in the charge direction
    if((s.type==='boss'||s.type==='general') && s.windup>0){
      ctx.strokeStyle=realm?`rgba(${realm.accent[0]},${realm.accent[1]},${realm.accent[2]},.8)`:'#fff';
      ctx.lineWidth=4; ctx.beginPath(); ctx.moveTo(sx,sy);
      ctx.lineTo(sx+s.chargeDir[0]*7*SCALE, sy+s.chargeDir[1]*7*SCALE); ctx.stroke(); ctx.lineWidth=1;
    }
    if(s.slamT>0){ const kk=1-s.slamT/.6, [tx2,ty2]=w2s(s.slamX,s.slamY);   // incoming crater: get out of the circle
      ctx.strokeStyle='rgba(255,80,60,'+(0.5+0.35*Math.sin(s_now()/60))+')'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(tx2,ty2,1.7*SCALE,0,7); ctx.stroke();
      ctx.fillStyle='rgba(255,80,60,.16)'; ctx.beginPath(); ctx.arc(tx2,ty2,1.7*SCALE*kk,0,7); ctx.fill(); ctx.lineWidth=1; }
    if(s.hp<s.maxHp && s.type!=='boss' && s.type!=='general'){ ctx.fillStyle='#000a'; ctx.fillRect(sx-16,sy-s.r*SCALE-10,32,5); ctx.fillStyle='#7d4'; ctx.fillRect(sx-16,sy-s.r*SCALE-10,32*(s.hp/s.maxHp),5); }
  }

  for(const p of props){ if(TALL_PROP[p.kind]) drawProp(p); }   // tall standing props draw over characters (no clipping through lamp posts)
  for(const d of decos){ if(TALL_DECO[d.type]) drawDeco(d); }   // tall decos (trees/pillars/banners) draw over characters too

  for(const b of bolts){ const[ax,ay]=w2s(b.x1,b.y1),[bx,by]=w2s(b.x2,b.y2); ctx.strokeStyle='#aef'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke(); ctx.lineWidth=1; }
  for(const pr of projectiles){ const[sx,sy]=w2s(pr.x,pr.y); const c=pr.col||[127,255,255], rgb='rgb('+c[0]+','+c[1]+','+c[2]+')';
    { const vl=len(pr.vx,pr.vy)||1, tl=Math.min(1.0,vl*0.07)*SCALE; ctx.globalAlpha=.35; ctx.strokeStyle=rgb; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(sx-pr.vx/vl*tl, sy-pr.vy/vl*tl); ctx.stroke(); ctx.globalAlpha=1; ctx.lineWidth=1; }
    if(pr.proj==='arrow'||pr.proj==='knife'){ const a=pr.ang!==undefined?pr.ang:Math.atan2(pr.vy,pr.vx);
      ctx.save(); ctx.translate(sx,sy); ctx.rotate(a); ctx.strokeStyle=rgb; ctx.lineWidth=Math.max(2,(pr.r||.16)*SCALE*0.8); ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(-.34*SCALE,0); ctx.lineTo(.22*SCALE,0); ctx.stroke(); ctx.lineWidth=1; ctx.restore(); }
    else { const R=(pr.r||.18)*SCALE;
      drawGlow(sx,sy,R*1.7,c[0],c[1],c[2],1);
      ctx.fillStyle=rgb; ctx.beginPath(); ctx.arc(sx,sy,R*.7,0,7); ctx.fill(); } }
  for(const ep of eProjectiles){ const[sx,sy]=w2s(ep.x,ep.y); ctx.beginPath(); ctx.arc(sx,sy,.16*SCALE,0,7); ctx.fillStyle='#ff9b3d'; ctx.fill(); }

  ctx.globalCompositeOperation='lighter';
  for(const p of particles){ const[sx,sy]=w2s(p.x,p.y); const a=clamp01(p.life/p.max); if(a<=0) continue;
    const rr=p.size*0.5*(0.55+a*0.55); ctx.globalAlpha=a*0.5; ctx.fillStyle=rgb(p.color);
    ctx.beginPath(); ctx.arc(sx,sy,rr*1.5,0,7); ctx.fill(); }                 // additive glow
  ctx.globalCompositeOperation='source-over';
  for(const p of particles){ const[sx,sy]=w2s(p.x,p.y); const a=clamp01(p.life/p.max); if(a<=0) continue;
    const rr=p.size*0.5*(0.55+a*0.55); ctx.globalAlpha=Math.min(1,a*1.2); ctx.fillStyle=rgb(p.color);
    ctx.beginPath(); ctx.arc(sx,sy,rr,0,7); ctx.fill(); }                     // ember core
  ctx.globalAlpha=1;
  // floating damage numbers
  ctx.textAlign='center'; ctx.textBaseline='middle';
  for(const t of dmgTexts){ const[sx,sy]=w2s(t.x,t.y), a=clamp01(t.life/t.max);
    ctx.globalAlpha=a; ctx.font='800 '+(t.kind==='crit'?19:t.kind==='perfect'?16:t.kind==='dot'?11:13)+'px system-ui';
    ctx.lineWidth=3; ctx.strokeStyle='rgba(0,0,0,.8)'; ctx.strokeText(t.txt,sx,sy);
    ctx.fillStyle=t.kind==='crit'?'#ffd34d':t.kind==='dot'?'#9aa0b0':t.kind==='perfect'?'#9fe8ff':'#fff'; ctx.fillText(t.txt,sx,sy); }
  ctx.globalAlpha=1; ctx.lineWidth=1; ctx.textAlign='left'; ctx.textBaseline='top';

  // player
  // the hero — a generated class sprite
  const[px,py]=w2s(player.x,player.y), pR=player.r*SCALE*1.15*CHAR_DRAW;

  contactShadow(px, py+pR*.8, pR*.95, pR*.34);
  const hflip=(player.faceX!==undefined?player.faceX:player.fx)<0?-1:1;
  if(PIXEL){                                                          // Trial Towers 3.0 — hero sprite: animated pack > Kenney tile > in-code pixel
    if(player._aph===undefined) player._aph=Math.random();
    const cls=heroClass?heroClass.key:'Knight', ak=heroAnimKey(cls), idleFr=animFrames(ak,'idle');
    if(idleFr && idleFr.length){                                       // sliced sprite-pack animation (per-rig anchor + normalised size; see HERO_RIG)
      const rig=heroRig(cls), footY=py+pR*0.8, tint=heroTint(cls), walkFr=animFrames(ak,'walk')||idleFr;
      const K=pR*0.056*(rig.kh||1), anc=rig.anc;                       // anc set => fixed pivot (Huntress); else feet-anchored
      const aimAng=Math.atan2((player.faceY!==undefined?player.faceY:player.fy)||0, (player.faceX!==undefined?player.faceX:player.fx)||1e-4);   // facing/aim angle
      if(player.attackAnimT>0){                                        // attack: the swing SPINS to point at the aim (any direction), centred on the body
        const prog=clamp01(1-player.attackAnimT/(player.attackAnimDur||.5));
        const af = player._dashStrike ? (animFrames(ak,'dashatk')||animFrames(ak,'attack')) : animFrames(ak,'attack');
        drawHeroRot(af||idleFr, px, py-pR*0.3, K, prog, tint, cls+'ar', aimAng);
      }
      else if((player.dashT||0)>0){ const df=animFrames(ak,'dash')||animFrames(ak,'special');   // dash SPINS along the dash direction and plays across the whole dash (use the body-centred 'dash' frames so rotation stays put)
        if(df&&df.length) drawHeroRot(df, px, py-pR*0.3, K, clamp01(1-(player.dashT/DASH_DUR)), tint, cls+'dr', aimAng);
        else drawHeroAnchored(walkFr, px, footY, K, hflip, null, tint, cls+'w', anc); }
      else if((player.hitAnimT||0)>0){ const hf=animFrames(ak,'hit');   // recoil frame when struck
        if(hf&&hf.length) drawHeroAnchored(hf, px, footY, K, hflip, 0, tint, cls+'h', anc);
        else drawHeroAnchored(player.moving?walkFr:idleFr, px, footY, K, hflip, null, tint, cls+(player.moving?'w':'i'), anc); }
      else if(player.moving) drawHeroAnchored(walkFr, px, footY, K, hflip, null, tint, cls+'w', anc);
      else drawHeroAnchored(idleFr, px, footY, K, hflip, null, tint, cls+'i', anc);
    } else { const spr=pixelHeroFor(cls, player); const th=pR*2.45, tw=spr.width/spr.height*th; pxBlit(spr, px, py-pR*0.12, tw, th, hflip); }   // sliced frames still loading -> in-code pixel hero (consistent), never a Kenney tile
  } else {
  const hk0='hero_'+(heroClass?heroClass.key:'Knight'), hk0i=animFrames(hk0,'idle');
  const hkey=(assetImg(hk0)||(hk0i&&hk0i.length))?hk0:((heroClass&&heroClass.art)||hk0);   // real hero art wins over the stand-in
  const atkFr=animFrames(hkey,'attack');
  const attacking=(player.attackAnimT>0) && atkFr && atkFr.length;
  const hfr = attacking ? atkFr : (animFrames(hkey, player.moving?'walk':'idle') || animFrames(hkey,'idle'));
  const haimg=assetImg(hkey);
  if(attacking){ const prog=1-player.attackAnimT/(player.attackAnimDur||.5); drawAnimOnce(atkFr, px, py, pR*2.6, hflip, prog); }
  else if(hfr && hfr.length){ drawAnim(hfr, player, px, py, pR*2.6, hflip); }
  else if(haimg){ drawAsset(haimg, px, py, pR*2.6, hflip); }
  else { const hk2=heroClass?heroClass.key:'Knight'; const hspr=getHeroSprite(['Knight','Ranger','Mage','Rogue'].includes(hk2)?hk2:'Knight', pR);
    ctx.save(); ctx.translate(px,py); ctx.scale((player.faceX!==undefined?player.faceX:player.fx)<0?-1:1,1);
    ctx.drawImage(hspr,-hspr.width/2,-hspr.height/2);
    ctx.restore(); }
  }
  if(player.stealthT>0){ ctx.globalAlpha=.5; ctx.fillStyle='rgba(120,120,150,.35)'; ctx.beginPath(); ctx.arc(px,py,pR*1.3,0,7); ctx.fill(); ctx.globalAlpha=1; }
  if(player.iframe>0){ ctx.strokeStyle='rgba(190,224,255,.8)'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(px,py,pR*1.25,0,7); ctx.stroke(); ctx.lineWidth=1; }
  if(player.riposteT>0){ const _rp=0.5+0.5*Math.sin(s_now()/1000*13); ctx.strokeStyle='rgba(255,226,120,'+(0.45+0.4*_rp).toFixed(2)+')'; ctx.lineWidth=2.5; ctx.beginPath(); ctx.arc(px,py,pR*(1.4+0.12*_rp),0,7); ctx.stroke(); ctx.lineWidth=1; }   // riposte-ready aura
  if(player.hurtFlash>0){ ctx.globalAlpha=Math.min(1,player.hurtFlash*3); ctx.fillStyle='rgba(255,90,90,.5)'; ctx.beginPath(); ctx.arc(px,py,pR,0,7); ctx.fill(); ctx.globalAlpha=1; }
  {
    if(player.shootFlash>0){ ctx.save(); ctx.translate(px,py); ctx.rotate(Math.atan2(player.fy,player.fx));
      ctx.globalAlpha=Math.min(1,player.shootFlash*7); ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(.58*SCALE,0,.12*SCALE,0,7); ctx.fill(); ctx.globalAlpha=1; ctx.restore(); } }

  if(phase==='explore'){ const T9=s_now()/1000, ri9=realmIndex(floor), acc9=realm?realm.accent:[210,200,180];
    const glowy=(ri9===5||ri9===7||ri9===9);                                   // dust hangs only in the Tower's strangest air
    const MD=11, mx0=player.x-(W/2)/SCALE-1, mx1=player.x+(W/2)/SCALE+1, my0=player.y-(H/2)/SCALE-1, my1=player.y+(H/2)/SCALE+1;
    if(glowy){ ctx.globalCompositeOperation='lighter';
    for(let gx=Math.floor(mx0/MD); gx<=Math.ceil(mx1/MD); gx++) for(let gy=Math.floor(my0/MD); gy<=Math.ceil(my1/MD); gy++){
      const h9=hash2(gx*13+5,gy*11+3);
      const spd=0.10+((h9>>4)&3)*0.04, rise=MD-((T9*spd+(h9&255)/255*MD)%MD);
      const wx=gx*MD+((h9>>2)&15)/15*MD+Math.sin(T9*(0.22+((h9>>6)&3)*0.07)+h9)*0.55;
      const wy=gy*MD+rise;
      const[dxm,dym]=w2s(wx,wy);
      const am=0.045+0.05*(0.5+0.5*Math.sin(T9*1.25+h9));
      ctx.fillStyle=glowy?('rgba('+acc9[0]+','+acc9[1]+','+acc9[2]+','+am.toFixed(3)+')'):('rgba(222,216,200,'+am.toFixed(3)+')');
      ctx.beginPath(); ctx.arc(dxm,dym,1.1+((h9>>8)&3)*0.5,0,7); ctx.fill(); }
    ctx.globalCompositeOperation='source-over'; }
    if(player.hp>0){ const[tpx,tpy]=w2s(player.x,player.y);                     // the climber carries a light
      const fl9=0.93+0.05*Math.sin(T9*9.7)+0.02*Math.sin(T9*23.3);
      ctx.globalCompositeOperation='lighter';
      drawGlow(tpx,tpy-0.3*SCALE, 4.6*SCALE*fl9, 255,170,80, 0.055);
      drawGlow(tpx,tpy-0.3*SCALE, 2.2*SCALE*fl9, 255,200,120, 0.05);
      ctx.globalCompositeOperation='source-over'; } }
  { let st=skyTint(); if(bloodMoon){ const _bp=0.5+0.5*Math.sin(s_now()/1000*1.6); st={c:[150,14+Math.round(10*_bp),22],a:0.40+0.06*_bp}; } if(st){                                                                 // time-of-day wash, with a readable light-pool around the climber
      let threat=0; for(const m of mobs){ if(m.friendly||m.peaceful) continue; if((m.provoked||m.isGate||m.champion||m.coinwraith) && Math.abs(m.x-player.x)<15 && Math.abs(m.y-player.y)<13){ threat=1; break; } }
      const a=st.a*(bloodMoon?1:(threat?0.42:1))*(bossIntroT>0?0.5:1), cc=st.c[0]+','+st.c[1]+','+st.c[2];
      const px9=W/2+ox, py9=H/2+oy, g9=ctx.createRadialGradient(px9,py9,5*SCALE,px9,py9,13*SCALE);
      g9.addColorStop(0,'rgba('+cc+','+(a*0.28).toFixed(3)+')'); g9.addColorStop(1,'rgba('+cc+','+a.toFixed(3)+')');
      ctx.fillStyle=g9; ctx.fillRect(0,0,W,H); } }
  if(realm){ ctx.save(); ctx.globalCompositeOperation='soft-light'; ctx.globalAlpha=0.17;   // per-realm colour grade — richer for mood & cohesion
    ctx.fillStyle=rgb(realm.accent); ctx.fillRect(0,0,W,H); ctx.restore(); }
  // the climber carries light: a warm pool lifts the near ground so the dark can press in around it
  { const _a=realm?realm.accent:[255,210,150], _px=W/2+ox, _py=H/2+oy;
    const warm=Math.round(186+_a[0]*0.22)+','+Math.round(150+_a[1]*0.18)+','+Math.round(108+_a[2]*0.16);
    ctx.save(); ctx.globalCompositeOperation='lighter';
    const lp=ctx.createRadialGradient(_px,_py,1.4*SCALE,_px,_py,11*SCALE);
    lp.addColorStop(0,'rgba('+warm+',0.11)'); lp.addColorStop(0.5,'rgba('+warm+',0.045)'); lp.addColorStop(1,'rgba('+warm+',0)');
    ctx.fillStyle=lp; ctx.fillRect(0,0,W,H); ctx.restore(); }
  if(floorMod && floorMod.dim){ ctx.fillStyle='rgba(2,2,10,.22)'; ctx.fillRect(0,0,W,H); }   // haunted/cursed gloom
  // vignette — deeper, frames the scene; the periphery falls to shadow (dramatic, dark-fantasy)
  { if(!render.vig || render.vw!==W || render.vh!==H){ const g2=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*.30,W/2,H/2,Math.max(W,H)*.75);
      g2.addColorStop(0,'rgba(0,0,0,0)'); g2.addColorStop(0.62,'rgba(5,6,14,.18)'); g2.addColorStop(1,'rgba(3,4,11,.64)'); render.vig=g2; render.vw=W; render.vh=H; }
    ctx.fillStyle=render.vig; ctx.fillRect(0,0,W,H); }
  renderWeather();   // ambient weather drifts over the scene

  drawHUD();
}

const SERVICE_NPC={merchant:1,smith:1,healer:1,enchanter:1,tavernkeep:1,gambler:1,priest:1,cook:1,monk:1,innkeep:1,fisher:1,caravaneer:1,arenamaster:1,pedlar:1,quester:1,sage:1,quartermaster:1,bountymaster:1,magistrate:1,ranger:1,pilgrimkeeper:1,seer:1,herbalist:1};
const SHOP_NPC={merchant:1,pedlar:1,smith:1,healer:1,enchanter:1,tavernkeep:1,gambler:1,caravaneer:1,quartermaster:1,herbalist:1,innkeep:1};   // vendors you can BUY from — flagged gold on the maps
function drawHotbar(){ const n=5, cs=42, gap=5, bx=12, by=H-cs-14;
  // 3 grimoire ability slots (keys Z/X/C) sit on top of the hand bar
  const GK=['Z','X','C'], cr=16, cyc=by-cr-13, cx0=bx+cr+2;
  for(let i=0;i<3;i++){ const ccx=cx0+i*(cr*2+12); const gk=player.grimoire&&player.grimoire[i], G=gk&&GRIMOIRE_MAP[gk];
    ctx.fillStyle=PAL.ink; ctx.beginPath(); ctx.arc(ccx,cyc,cr+2,0,7); ctx.fill();
    ctx.fillStyle=G?'#1a1726':'#141320'; ctx.beginPath(); ctx.arc(ccx,cyc,cr,0,7); ctx.fill();
    if(G){ const cd=(player.grimCd&&player.grimCd[i])||0, onCd=cd>0, lowMana=(player.charge||0)<(G.mana||20);
      ctx.save(); ctx.beginPath(); ctx.arc(ccx,cyc,cr-2,0,7); ctx.clip(); G.icon(ctx,ccx,cyc,cr*0.74); ctx.restore();
      if(onCd){ ctx.fillStyle='rgba(0,0,0,.62)'; ctx.beginPath(); ctx.moveTo(ccx,cyc); ctx.arc(ccx,cyc,cr,-Math.PI/2,-Math.PI/2+6.28*clamp01(cd/(G.cd||4))); ctx.closePath(); ctx.fill(); }
      ctx.strokeStyle=onCd?'rgba(90,96,120,.7)':(lowMana?'rgba(120,120,140,.7)':rarityCol(G.rarity)); }
    else { pxText('+', ccx, cyc-7, 2, 'rgba(120,126,150,.4)', {align:'center'}); ctx.strokeStyle='rgba(90,96,120,.45)'; }
    ctx.lineWidth=2; ctx.beginPath(); ctx.arc(ccx,cyc,cr,0,7); ctx.stroke(); ctx.lineWidth=1;
    pxText(GK[i], ccx, cyc+cr-1, 1, G?PAL.text:'rgba(120,126,150,.5)', {align:'center'}); }
  // 5 hand slots (keys 1-5)
  for(let i=0;i<n;i++){ const cx=bx+i*(cs+gap), cy=by;
    pxPanel(cx,cy,cs,cs,{fill:'rgba(14,13,20,.85)'});
    const it=player.kit[i]; if(it){ const def=itemDef(it.key); if(def){ def.icon(ctx,cx+cs/2,cy+cs/2,cs*0.30); if(it.q>1) labelPill('×'+it.q, cx+cs-11, cy+cs-3, {size:9,color:'#ffd34d',bg:'rgba(0,0,0,.6)'}); } }
    if(player.kitCd>0){ const f=clamp01(player.kitCd/0.6); ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillRect(cx+2,cy+2,cs-4,(cs-4)*f); }
    pxText(String(i+1), cx+4, cy+4, 1, PAL.cyan);
    ctx.textAlign='left'; ctx.textBaseline='top';
  }
}
function labelPill(text,x,y,opt){ opt=opt||{};
  ctx.font=(opt.weight||'600')+' '+(opt.size||12)+'px system-ui,sans-serif';
  const tw=ctx.measureText(text).width, padX=opt.padX||7, bh=(opt.size||12)+6, bw=tw+padX*2, bx=x-bw/2, by=y-bh;
  ctx.fillStyle=opt.bg||'rgba(12,12,20,.58)';
  if(ctx.roundRect){ ctx.beginPath(); ctx.roundRect(bx,by,bw,bh,bh/2); ctx.fill(); } else ctx.fillRect(bx,by,bw,bh);
  if(opt.border){ ctx.strokeStyle=opt.border; ctx.lineWidth=1; if(ctx.roundRect){ ctx.beginPath(); ctx.roundRect(bx+.5,by+.5,bw-1,bh-1,bh/2); ctx.stroke(); } }
  ctx.fillStyle=opt.color||'#e8e8f0'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(text,x,by+bh/2+0.5); ctx.textAlign='left'; ctx.textBaseline='top';
}
// --- character labels: translucent-black pill + "dark white" text. speech sits ABOVE the head, names BELOW the feet. ---
function speechPill(text,x,anchorY,opt){ opt=opt||{}; opt.bg=opt.bg||'rgba(6,7,12,.66)'; opt.color=opt.color||'rgba(238,240,248,.97)'; opt.size=opt.size||11; opt.weight=opt.weight||'600'; labelPill(text,x,anchorY,opt); }
function namePill(text,x,topY,opt){ opt=opt||{}; opt.bg=opt.bg||'rgba(6,7,12,.5)'; opt.color=opt.color||'rgba(228,231,240,.93)'; opt.size=opt.size||11; opt.weight=opt.weight||'600'; const bh=opt.size+6; labelPill(text,x,topY+bh,opt); }
// --- shared overlay chrome (full-screen menus share the home screen's mood) ---
function rrct(x,y,w,h,rd){ if(ctx.roundRect){ctx.beginPath();ctx.roundRect(x,y,w,h,rd);}else{ctx.beginPath();ctx.rect(x,y,w,h);} }
function overlayVeil(tint,topA,botA){ const c=tint||'7,9,16';
  const g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,'rgba('+c+','+(topA!=null?topA:0.82)+')'); g.addColorStop(1,'rgba('+c+','+(botA!=null?botA:0.92)+')'); ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  const vg=ctx.createRadialGradient(W/2,H*0.42,Math.min(W,H)*0.26,W/2,H*0.42,Math.max(W,H)*0.72); vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,0.45)'); ctx.fillStyle=vg; ctx.fillRect(0,0,W,H); }
function drawHUD(){
  // ===== Trial Towers 3.0 vitals: portrait + HP / Mana / Stamina =====
  const rrR=(x,y,w,h,r)=>{ if(ctx.roundRect){ ctx.beginPath(); ctx.roundRect(x,y,w,h,r); ctx.fill(); } else ctx.fillRect(x,y,w,h); };
  const PX=8, PY=8, PW=270, PH=74;
  pxPanel(PX,PY,PW,PH,{fill:'rgba(18,17,26,.9)'});
  const portS=56, portX=PX+7, portY=PY+8;
  pxPanel(portX,portY,portS,portS,{fill:'#14121d', bevel:false});
  { const cls=heroClass?heroClass.key:'Knight', spr=heroSprite(cls);
    const th=portS-8, tw=spr.width/spr.height*th; pxBlit(spr, portX+portS/2, portY+portS/2+2, tw, th, 1); }
  { const bx=portX+portS+10, bw=PW-(portS+26);
    pxText((heroClass?heroClass.key:'HERO').toUpperCase()+'  LV'+player.level, bx, PY+7, 2, PAL.gold, {shadow:true});
    { const lv=player.lives||0; for(let i=0;i<Math.min(8,lv);i++){ ctx.fillStyle=PAL.ink; ctx.fillRect(PX+PW-12-i*9, PY+8, 7,7); ctx.fillStyle=PAL.hp; ctx.fillRect(PX+PW-11-i*9, PY+9, 5,5);} }
    let yy=PY+22;
    pxBar(bx,yy,bw,13, player.hp/player.maxHp, PAL.hp); pxText('HP '+Math.max(0,Math.ceil(player.hp))+'/'+player.maxHp, bx+3, yy+4, 1, PAL.text, {shadow:true}); yy+=17;
    pxBar(bx,yy,bw,10, (player.charge||0)/player.maxMana, PAL.mana); pxText('MP '+Math.round(player.charge||0)+'/'+player.maxMana, bx+3, yy+3, 1, PAL.text, {shadow:true}); yy+=14;
    pxBar(bx,yy,bw,10, player.stamina/player.maxStamina, PAL.stam); pxText('SP '+Math.round(player.stamina)+'/'+player.maxStamina, bx+3, yy+3, 1, PAL.ink); }
  if(false){   // (legacy XP/stat readout retired in 3.0; block kept inert to preserve following braces)
  ctx.fillStyle='#49c2ff'; rrR(20,50,Math.max(4,220*clamp01(player.xp/player.xpNext)),8,4);
  ctx.fillStyle='#fff'; ctx.font='600 14px system-ui,sans-serif'; ctx.textBaseline='top'; ctx.textAlign='left';
  { const _rl=(heroClass?heroClass.key+'  ':'')+'Lv '+player.level+'   ⚔'+player.ad+'   ♦'+(player.items?player.items.length:0)+(kitCount()>0?'   🎒'+kitCount():'')+(trinketCount()>0?'   ◈'+trinketCount():'')+(covHeat()>0?'   ⚜'+covHeat():'')+(player.house?('   ['+(player.house==='vael'?'⚷ Vael':player.house==='sword'?'⚔ Blade':'✦ Arcane')+(player.houseRank?' '+['','I','II','III'][player.houseRank]:'')+']'):'');
    ctx.fillText(_rl, 18, 66);
    if(player.res && Object.keys(player.res).length){ let rx=18+ctx.measureText(_rl).width+20; ctx.font='700 12px system-ui,sans-serif';
      for(const k in player.res){ const I=SCHOOL_INFO[k], t=player.res[k], lbl=I.icon+I.n+(t>1?' II':' I');
        ctx.fillStyle='rgba('+I.col[0]+','+I.col[1]+','+I.col[2]+',0.96)'; ctx.fillText(lbl, rx, 67); rx+=ctx.measureText(lbl).width+12; }
      ctx.fillStyle='#fff'; } } }
  // floor / realm banner
  ctx.fillStyle=realm?rgb(realm.accent):'#fff'; ctx.font='800 18px system-ui,sans-serif';
  ctx.fillText('FLOOR '+floor+' / '+TOTAL_FLOORS+(ngPlus>0?'  ·  NG+'+ngPlus:''), 18, 86);
  ctx.fillStyle='rgba(255,255,255,.7)'; ctx.font='13px system-ui,sans-serif';
  ctx.fillText((realm?realm.name:'')+(floorMod?'  ·  '+floorMod.name:'')+(districtPlan?'  ·  '+districtPlan.name:''), 18, 108);
  // tower progress bar
  ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fillRect(18,124,224,7);
  ctx.fillStyle=realm?rgb(realm.accent):'#8fe06a'; ctx.fillRect(19,125,222*clamp01(floor/TOTAL_FLOORS),5);
  { const found=poiList.filter(p=>p.found).length; if(poiList.length){ ctx.fillStyle='rgba(255,255,255,.45)'; ctx.font='11px system-ui';
    ctx.fillText('◈ '+found+'/'+poiList.length+' discovered  ·  M map', 18, 137); } }
  // trespass status
  if(wantedT>0 || jailT>0){
    ctx.textAlign='center'; ctx.textBaseline='top';
    ctx.fillStyle=jailT>0?'#aab2c2':'#ff5a4a'; ctx.font='800 22px system-ui';
    ctx.fillText(jailT>0?('⛓ JAILED — '+Math.ceil(jailT)+'s'):'⚠ WANTED ⚠', W/2, 44);
    ctx.textAlign='left';
  }
  // creator panel
  if(devMode){
    const lines=['⚙ CREATOR MODE  (`/F9 to close)','1-9, 0 jump · [ ] / PgUp/PgDn floors','N next floor · T stair · Y objective','L reveal map · B open stair · X finish op','K clear field · G riches+levels','H heal · U ult · J finish quest','I god '+(player.god?'[ON]':'[off]')+' · O ×25 dmg '+(player.devPow?'[ON]':'[off]'),'V super speed '+(player.devFast?'[ON]':'[off]'),'click minimap to warp'];
    const bw=316, bh=18*lines.length+14, bx=12, by=H-bh-58;
    ctx.fillStyle='rgba(8,10,18,.85)'; ctx.fillRect(bx,by,bw,bh);
    ctx.strokeStyle='#ffd000'; ctx.strokeRect(bx,by,bw,bh);
    ctx.textAlign='left'; ctx.textBaseline='top';
    lines.forEach((l,i)=>{ ctx.fillStyle=i===0?'#ffd000':'rgba(255,255,255,.85)'; ctx.font=(i===0?'700 ':'')+'12px ui-monospace,monospace'; ctx.fillText(l, bx+10, by+8+i*18); });
  }
  // active operation / quest
  let hy=152;
  if(operation){ ctx.fillStyle=operation.done?'#7dd87d':'#9fd6ff'; ctx.font='600 13px system-ui,sans-serif'; ctx.textBaseline='top'; ctx.textAlign='left';
    ctx.fillText((operation.done?'✓ OPERATION DONE: ':'◆ DISTRICT OP: ')+(operation.done?'stair open':operation.target), 18, hy); hy+=18; }
  if(player.quest && player.quest.accepted){ const q=player.quest;
    ctx.fillStyle=q.done?'#7dd87d':'#ffd86b'; ctx.font='600 13px system-ui,sans-serif'; ctx.textBaseline='top'; ctx.textAlign='left';
    ctx.fillText('✦ '+(q.done?'MISSION DONE — claim it at any board/giver':((q.tierName?q.tierName.toUpperCase()+' MISSION: ':'QUEST: ')+q.desc+(q.target>1?' ('+Math.min(q.progress,q.target)+'/'+q.target+')':''))), 18, hy); hy+=18; }
  if((player.disguiseT||0)>0 || (player.permitT||0)>0){ ctx.fillStyle='#cfe0ff'; ctx.font='600 13px system-ui,sans-serif'; ctx.textBaseline='top'; ctx.textAlign='left';
    const bits=[]; if((player.disguiseT||0)>0) bits.push('disguise '+Math.ceil(player.disguiseT)+'s'); if((player.permitT||0)>0) bits.push('permit '+Math.ceil(player.permitT)+'s');
    ctx.fillText('◇ Cover: '+bits.join(' · '), 18, hy); hy+=18; }
  if((player.bmTickets||0)>0){ ctx.fillStyle='#c79cff'; ctx.font='600 13px system-ui,sans-serif'; ctx.textBaseline='top'; ctx.textAlign='left'; ctx.fillText('◆ Black Market pass × '+player.bmTickets, 18, hy); hy+=18; }
  // counters
  ctx.textAlign='right'; ctx.font='600 20px system-ui,sans-serif';
  ctx.fillStyle='#fff'; ctx.fillText('🪙 '+coinCount+'    Kills: '+kills, W-18, 18);
  { const sr=starRank(player); ctx.font='600 14px system-ui,sans-serif'; ctx.fillStyle='rgba(240,196,80,.95)'; ctx.fillText('✦ '+(player.prestige||0)+' Prestige   ·   '+sr.stars+'★ '+sr.title, W-18, 40); } ctx.textAlign='left';

  // minimap (top-right) — overview of the open floor
  if(world){
    const mw=170, mh=mw*(world.h/world.w), mx=W-mw-16, my=52, ms=2;
    if(!render.mmCv) render.mmCv=document.createElement('canvas');
    const MM=render.mmCv;
    if(MM.width!==Math.round(mw*ms) || MM.height!==Math.round(mh*ms)){ MM.width=Math.round(mw*ms); MM.height=Math.round(mh*ms); render.mmT=-1e9; }
    if(render.mmFloor!==floor){ render.mmFloor=floor; render.mmT=-1e9; }
    if(s_now()-(render.mmT||-1e9)>200){ render.mmT=s_now();   // static layer redrawn 5x/s, not 60
      const g=MM.getContext('2d'); g.setTransform(ms,0,0,ms,0,0); g.clearRect(0,0,mw,mh);
      g.fillStyle='rgba(0,0,0,.5)'; g.fillRect(0,0,mw,mh);
      g.strokeStyle='rgba(255,255,255,.18)'; g.strokeRect(0,0,mw,mh);
      const gx=v=>((v+world.hw)/world.w)*mw, gy=v=>((v+world.hh)/world.h)*mh;
      for(let i=1;i<floors.length;i++){ const f=floors[i];
        g.fillStyle = f.road ? 'rgba(150,142,124,.5)' : f.water ? 'rgba(60,140,180,.6)' : f.hazard ? 'rgba(200,80,60,.55)' : 'rgba(120,120,142,.38)';
        g.fillRect(gx(f.x-f.w/2), gy(f.y-f.h/2), Math.max(1.5,f.w/world.w*mw), Math.max(1.5,f.h/world.h*mh));
      }
      for(const z of restricted){ g.strokeStyle='rgba(255,90,74,.95)'; g.strokeRect(gx(z.x-z.w/2), gy(z.y-z.h/2), z.w/world.w*mw, z.h/world.h*mh); }
      const gdot=(x,y,c,r)=>{ g.fillStyle=c; g.beginPath(); g.arc(gx(x),gy(y),r,0,7); g.fill(); };
      if(exit && (exit.found||exit.open)) gdot(exit.x,exit.y, exit.open?'#7dff8a':'#777', 4);   // the stair must be FOUND first
      for(const p of props){ if(p.kind==='chest'&&!p.opened) gdot(p.x,p.y, p.big?'#ffe066':'#d9a93a', p.big?3:2); }
      for(const nm of mobs){ if(nm.type==='nest') gdot(nm.x,nm.y,'#c0405a',3); }
      for(const p of props){ if(p.kind==='waystone') gdot(p.x,p.y, p.attuned?'#6ee7ff':'#39606e', 3); }
      for(const p of props){ if(['records','evidence','relaybox','wardrobe'].includes(p.kind)) gdot(p.x,p.y, p.kind==='wardrobe'?'#cfe0ff':'#9fd6ff', p.kind==='wardrobe'?2.5:3.2); }
      for(const p of props){ if(p.kind==='newsstand') gdot(p.x,p.y,'#ffe6a0',3); }
      for(const n of npcs){ if(!SHOP_NPC[n.type]) gdot(n.x,n.y,'#5cc8ff',2.2); }
      for(const gm of mobs){ if(gm.isGate) gdot(gm.x,gm.y,'#ff5a5a',4); else if(gm.champion) gdot(gm.x,gm.y, gm.friendly?'#7dff8a':'#ffd34d', 4); }
      const gshop=(x,y)=>{ g.fillStyle='#ffcf4d'; g.beginPath(); g.arc(gx(x),gy(y),4.2,0,7); g.fill(); g.strokeStyle='rgba(20,16,6,.95)'; g.lineWidth=1.4; g.stroke(); g.lineWidth=1; };
      for(const p of props){ if(p.kind==='market' && p.revealed) gshop(p.x,p.y); }
      for(const n of npcs){ if(n.type==='mythic'){ g.fillStyle='#c79cff'; g.beginPath(); g.arc(gx(n.x),gy(n.y),4,0,7); g.fill(); g.strokeStyle='rgba(20,8,28,.9)'; g.lineWidth=1; g.stroke(); g.lineWidth=1; } }
      for(const n of npcs){ if(SHOP_NPC[n.type]) gshop(n.x,n.y); }   // gold = a shop — go here to buy
    }
    ctx.drawImage(MM, mx, my, mw, mh);
    const sx=v=>mx+((v+world.hw)/world.w)*mw, sy=v=>my+((v+world.hh)/world.h)*mh;
    const dot=(x,y,c,r)=>{ ctx.fillStyle=c; ctx.beginPath(); ctx.arc(sx(x),sy(y),r,0,7); ctx.fill(); };
    for(const pg of pings){ const bl=0.5+0.5*Math.sin(s_now()/300); ctx.globalAlpha=bl; dot(pg.x,pg.y,pg.col||'#ff8a5a',3.5); ctx.globalAlpha=1; }
    if(waypoint) dot(waypoint.x,waypoint.y,'#ffd34d',3.5);
    dot(player.x,player.y,'#fff',3);
  }

  // boss bar — nearest gatekeeper / Upper Being while engaged
  { let barM=null, bd=20;
    for(const g of mobs){ if(!(g.isGate||g.champion) || g.friendly) continue; const d=len(player.x-g.x,player.y-g.y); if(d<bd){ bd=d; barM=g; } }
    if(barM){
      const bw=Math.min(560,W-80), bx=(W-bw)/2, enraged=barM.phase===2;
      ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillRect(bx,18,bw,18);
      ctx.fillStyle=enraged?'#ff5a4a':(realm?rgb(realm.accent):'#9b59ff'); ctx.fillRect(bx+2,20,(bw-4)*clamp01(barM.hp/barM.maxHp),14);
      ctx.fillStyle='rgba(255,255,255,.5)'; ctx.fillRect(bx+2+(bw-4)*0.5,19,1,16);
      ctx.fillStyle='#fff'; ctx.font='600 13px system-ui,sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText((barM.bossName||'BOSS').toUpperCase()+(enraged?'  —  ENRAGED':''), W/2, 27); ctx.textAlign='left'; ctx.textBaseline='top';
    } }

  // ULT charge meter (bottom-centre)
  if(phase==='explore' && !kitOpen && H>360) drawHotbar();   // 3.0: hand slots + ability circles always shown
  { const mw=260, mx=(W-mw)/2, my=H-44, ready=player.charge>=player.maxMana, acc=realm?realm.accent:[180,120,255];
    ctx.fillStyle='rgba(0,0,0,.55)'; ctx.fillRect(mx,my,mw,12);
    ctx.fillStyle=ready?'#fff':`rgb(${acc[0]},${acc[1]},${acc[2]})`; ctx.fillRect(mx+2,my+2,(mw-4)*clamp01(player.charge/player.maxMana),8);
    ctx.fillStyle=ready?'#ffe066':'rgba(255,255,255,.65)'; ctx.font='700 11px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(ready?('★ '+(ULT_NAMES[player.weaponKey]||'ULTIMATE')+' READY — Q ★'):'ULTIMATE', W/2, my+6); ctx.textAlign='left'; ctx.textBaseline='top'; }
  { const A=ABILITY[player.weaponKey]; if(A && phase==='explore'){ ctx.font='700 11px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle=player.abilCd>0?'rgba(255,255,255,.4)':'#9fe8ff';
    ctx.fillText('[RMB] '+A.name+(player.abilCd>0?' · '+player.abilCd.toFixed(1)+'s':' · READY')+'    ⇢ DASH '+(player.dashCd<=0?'◆':'◇'), W/2, H-56);
    ctx.textAlign='left'; ctx.textBaseline='top'; } }
  if(player.comboN>=3 && phase==='explore'){ const jit=player.comboN>=10?Math.min(3,player.comboN/8):0;   // hit-streak counter
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font='800 '+Math.round(14+player.comboPop*30)+'px system-ui';
    const cx2=W/2+rand(-jit,jit), cy2=H/2-52+rand(-jit,jit);
    ctx.lineWidth=3; ctx.strokeStyle='rgba(0,0,0,.75)'; ctx.strokeText(player.comboN+'x', cx2, cy2);
    ctx.fillStyle=player.comboN>=10?'#ffe066':'#fff'; ctx.fillText(player.comboN+'x', cx2, cy2);
    ctx.textAlign='left'; ctx.textBaseline='top'; ctx.lineWidth=1; }
  if(chainN>=2 && phase==='explore'){ const cjit=chainN>=8?Math.min(4,chainN/6):0;   // corpse-chain counter
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font='800 '+Math.round(13+chainPop*26)+'px system-ui';
    const chx=W/2+rand(-cjit,cjit), chy=H/2-30+rand(-cjit,cjit), lbl='CHAIN x'+chainN;
    ctx.lineWidth=3; ctx.strokeStyle='rgba(0,0,0,.78)'; ctx.strokeText(lbl, chx, chy);
    ctx.fillStyle=chainN>=8?'#ff8a4d':(chainN>=4?'#ffd34d':'#bfe9ff'); ctx.fillText(lbl, chx, chy);
    ctx.textAlign='left'; ctx.textBaseline='top'; ctx.lineWidth=1; }
  if(player.shieldT>0){ ctx.globalAlpha=Math.min(.6,player.shieldT); ctx.strokeStyle='#ffe9a0'; ctx.lineWidth=3;   // aegis ring
    ctx.beginPath(); ctx.arc(W/2+ox,H/2+oy,player.r*SCALE*1.6,0,7); ctx.stroke(); ctx.globalAlpha=1; ctx.lineWidth=1; }
  if(player.hp<player.maxHp*.3 && phase==='explore'){ const beat=.5+.5*Math.sin(s_now()/(player.hp<player.maxHp*.15?160:300));   // danger vignette (cached gradient)
    if(!render.dvg || render.dvw!==W || render.dvh!==H){ const dg=ctx.createRadialGradient(W/2,H/2,H*.42,W/2,H/2,H*.72);
      dg.addColorStop(0,'rgba(200,30,30,0)'); dg.addColorStop(1,'rgba(200,30,30,0.28)'); render.dvg=dg; render.dvw=W; render.dvh=H; }
    const pa=ctx.globalAlpha; ctx.globalAlpha=pa*(0.57+0.43*beat); ctx.fillStyle=render.dvg; ctx.fillRect(0,0,W,H); ctx.globalAlpha=pa; }
  if(player.hurtFlash>0.13){ const a=.35*Math.min(1,player.hurtFlash/.3);   // directional hurt edge flash
    const dx2=Math.cos(player.hurtDir||0), dy2=Math.sin(player.hurtDir||0); let g2;
    if(Math.abs(dx2)>Math.abs(dy2)) g2= dx2>0?ctx.createLinearGradient(W,0,W-70,0):ctx.createLinearGradient(0,0,70,0);
    else g2= dy2>0?ctx.createLinearGradient(0,H,0,H-70):ctx.createLinearGradient(0,0,0,70);
    g2.addColorStop(0,'rgba(255,40,40,'+a+')'); g2.addColorStop(1,'rgba(255,40,40,0)');
    ctx.fillStyle=g2; ctx.fillRect(0,0,W,H); }

  if(kitOpen && phase==='explore'){
    kitAnim=Math.min(1, kitAnim+0.16); const _kEase=1-(1-kitAnim)*(1-kitAnim), _kSlide=Math.round((1-_kEase)*H*0.5);
    ctx.fillStyle='rgba(5,7,13,'+(0.93*_kEase).toFixed(3)+')'; ctx.fillRect(0,0,W,H);
    ctx.save(); ctx.translate(0,_kSlide); ctx.globalAlpha=_kEase;
    const r0=kitCellRect(0), cell=r0[2], cols=5, gw=cols*cell+(cols-1)*10, gx=r0[0], gy=r0[1], pad=20;
    const rLast=kitCellRect(24), gbot=rLast[1]+cell, pTop=gy-62, pBot=gbot+54;
    ctx.fillStyle='rgba(18,22,32,.97)'; if(ctx.roundRect){ ctx.beginPath(); ctx.roundRect(gx-pad,pTop,gw+pad*2,pBot-pTop,16); ctx.fill(); } else ctx.fillRect(gx-pad,pTop,gw+pad*2,pBot-pTop);
    ctx.strokeStyle='rgba(160,170,200,.45)'; ctx.lineWidth=2; if(ctx.roundRect){ ctx.beginPath(); ctx.roundRect(gx-pad,pTop,gw+pad*2,pBot-pTop,16); ctx.stroke(); } ctx.lineWidth=1;
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle='#ffd34d'; ctx.font='800 22px system-ui'; ctx.fillText('THE CLIMBER’S SATCHEL', W/2, gy-42);
    ctx.font='12px system-ui'; ctx.fillStyle='rgba(255,255,255,.5)'; ctx.fillText('drag to rearrange  ·  1–5 use hand  ·  E use  ·  X drop  ·  I / Tab / Esc close', W/2, gy-24);
    let trHover=-1, grimHover=-1;
    for(let i=0;i<3;i++){ const tr=trinketSlotRect(i),tx=tr[0],ty=tr[1],th=tr[2]; const t=player.trinkets&&player.trinkets[i]; const hv=mouseX>=tx-th&&mouseX<=tx+th&&mouseY>=ty-th&&mouseY<=ty+th; if(hv&&t) trHover=i;
      ctx.save(); ctx.translate(tx,ty); ctx.rotate(0.785); ctx.fillStyle=hv?'rgba(40,44,58,.95)':'rgba(0,0,0,.4)'; ctx.fillRect(-th,-th,th*2,th*2); ctx.strokeStyle=(hv&&t)?'#8fe06a':'rgba(160,170,200,.5)'; ctx.lineWidth=(hv&&t)?2:1; ctx.strokeRect(-th,-th,th*2,th*2); ctx.lineWidth=1; ctx.restore();
      if(t){ const D=TRINKET_DEFS_MAP[t.key]; if(D) D.icon(ctx,tx,ty,th*0.78); } }
    // grimoire ability slots (top-left) — drag a grimoire book here to equip (cast in play with Z/X/C)
    for(let i=0;i<3;i++){ const gr=grimSlotRect(i),gxx=gr[0],gyy=gr[1],grad=gr[2]; const gk=player.grimoire&&player.grimoire[i], G=gk&&GRIMOIRE_MAP[gk]; const hv=mouseX>=gxx-grad&&mouseX<=gxx+grad&&mouseY>=gyy-grad&&mouseY<=gyy+grad; if(hv&&G) grimHover=i;
      ctx.fillStyle=PAL.ink; ctx.beginPath(); ctx.arc(gxx,gyy,grad+2,0,7); ctx.fill();
      ctx.fillStyle=hv?'#26243a':'#15141f'; ctx.beginPath(); ctx.arc(gxx,gyy,grad,0,7); ctx.fill();
      if(G){ ctx.save(); ctx.beginPath(); ctx.arc(gxx,gyy,grad-2,0,7); ctx.clip(); G.icon(ctx,gxx,gyy,grad*0.74); ctx.restore(); ctx.strokeStyle=rarityCol(G.rarity); } else ctx.strokeStyle=(hv&&kitHeld&&GRIMOIRE_MAP[kitHeld.key])?'#8fe06a':'rgba(160,170,200,.5)';
      ctx.lineWidth=2; ctx.beginPath(); ctx.arc(gxx,gyy,grad,0,7); ctx.stroke(); ctx.lineWidth=1;
      pxText(['Z','X','C'][i], gxx, gyy+grad+3, 1, 'rgba(200,205,220,.85)', {align:'center'}); }
    ctx.textAlign='left'; ctx.fillStyle='rgba(255,224,102,.85)'; ctx.font='700 12px system-ui'; ctx.textBaseline='alphabetic'; ctx.fillText('✋ HAND', gx, gy-6); ctx.textAlign='center'; ctx.textBaseline='middle';
    let hov=-1;
    for(let i=0;i<25;i++){ const r=kitCellRect(i),cx=r[0],cy=r[1],cs=r[2]; const isHand=i<5; const sel=i===kitSel, hv=(mouseX>=cx&&mouseX<=cx+cs&&mouseY>=cy&&mouseY<=cy+cs); if(hv) hov=i;
      ctx.fillStyle=sel?'rgba(48,54,70,.97)':hv?'rgba(36,40,54,.95)':(isHand?'rgba(40,32,14,.55)':'rgba(0,0,0,.45)'); if(ctx.roundRect){ ctx.beginPath(); ctx.roundRect(cx,cy,cs,cs,9); ctx.fill(); } else ctx.fillRect(cx,cy,cs,cs);
      ctx.strokeStyle=sel?'#8fe06a':hv?'rgba(255,224,102,.75)':(isHand?'rgba(255,200,90,.6)':'#4a5570'); ctx.lineWidth=sel?3:(isHand?2:1.5); if(ctx.roundRect){ ctx.beginPath(); ctx.roundRect(cx+1,cy+1,cs-2,cs-2,9); ctx.stroke(); } else ctx.strokeRect(cx,cy,cs,cs); ctx.lineWidth=1;
      if(isHand){ ctx.fillStyle='rgba(255,224,102,.65)'; ctx.font='700 10px system-ui'; ctx.textAlign='left'; ctx.textBaseline='top'; ctx.fillText(String(i+1), cx+4, cy+3); ctx.textAlign='center'; ctx.textBaseline='middle'; }
      const it=player.kit[i]; if(it){ const def=itemDef(it.key); if(def){ if(def.rarity&&def.rarity!=='common'){ ctx.strokeStyle=rarityCol(def.rarity); ctx.lineWidth=2.5; if(ctx.roundRect){ ctx.beginPath(); ctx.roundRect(cx+1,cy+1,cs-2,cs-2,9); ctx.stroke(); } ctx.lineWidth=1; } def.icon(ctx,cx+cs/2,cy+cs/2,cs*0.32); if(it.q>1){ const bs=Math.max(9,Math.round(cs*0.14)); labelPill('×'+it.q, cx+cs-Math.min(16,cs*0.3), cy+cs-3, {size:bs,color:'#ffd34d',bg:'rgba(0,0,0,.6)'}); } } } }
    if(kitHeld){ const def=itemDef(kitHeld.key); if(def){ ctx.globalAlpha=0.92; def.icon(ctx,mouseX,mouseY,cell*0.34); ctx.globalAlpha=1; if(kitHeld.q>1) labelPill('×'+kitHeld.q, mouseX+15, mouseY+15, {size:10,color:'#ffd34d',bg:'rgba(0,0,0,.6)'}); } }
    const dyy=gbot+22; ctx.textAlign='center';
    if(grimHover>=0 && player.grimoire[grimHover]){ const G=GRIMOIRE_MAP[player.grimoire[grimHover]]; ctx.fillStyle=rarityCol(G.rarity); ctx.font='700 16px system-ui'; ctx.fillText(G.n, W/2, dyy); ctx.fillStyle='rgba(143,224,106,.9)'; ctx.font='13px system-ui'; ctx.fillText(G.e+'  ·  '+(G.mana||20)+' mana  ·  click to unslot', W/2, dyy+20); }
    else if(trHover>=0 && player.trinkets[trHover]){ const D=TRINKET_DEFS_MAP[player.trinkets[trHover].key]; ctx.fillStyle='#cfe0ff'; ctx.font='700 16px system-ui'; ctx.fillText('◈ '+D.n, W/2, dyy); ctx.fillStyle='rgba(143,224,106,.9)'; ctx.font='13px system-ui'; ctx.fillText(D.e+'  ·  click to unequip', W/2, dyy+20); }
    else { const di=hov>=0?hov:kitSel; const cur=player.kit[di]; if(cur){ const def=itemDef(cur.key); const isG=!!GRIMOIRE_MAP[cur.key]; ctx.fillStyle=def.rarity?rarityCol(def.rarity):'#fff'; ctx.font='700 16px system-ui'; ctx.fillText(def.n+(cur.q>1?'  ×'+cur.q:''), W/2, dyy); ctx.fillStyle='rgba(143,224,106,.9)'; ctx.font='13px system-ui'; ctx.fillText(def.e+(isG?'  ·  drag onto a Z/X/C slot':''), W/2, dyy+20); }
      else { ctx.fillStyle='rgba(255,255,255,.4)'; ctx.font='italic 13px Georgia,serif'; ctx.fillText('Empty. Loot chests and the fallen, or buy wares.', W/2, dyy); } }
    ctx.textAlign='left'; ctx.textBaseline='top';
    ctx.restore();
  }
  if(dialogue){ const bw=Math.min(620,W-40), extra=choiceOpts?choiceOpts.length*26+10:0, bh=90+extra, bx=(W-bw)/2, by=Math.max(20,H-bh-70);
    ctx.fillStyle='rgba(12,12,26,.92)'; ctx.fillRect(bx,by,bw,bh); ctx.strokeStyle='#556'; ctx.strokeRect(bx,by,bw,bh);
    ctx.fillStyle='#fff'; ctx.font='18px system-ui,sans-serif'; ctx.textBaseline='middle'; wrap(dialogue,bx+18,by+45,bw-36,22);
    if(choiceOpts){ ctx.font='600 16px system-ui,sans-serif'; ctx.textBaseline='middle';
      choiceOpts.forEach((o,i)=>{ ctx.fillStyle='#ffe066'; ctx.fillText('['+(i+1)+']', bx+24, by+86+i*26);
        ctx.fillStyle='rgba(255,255,255,.92)'; ctx.fillText(o.label, bx+58, by+86+i*26); }); } }

  if(toastT>0){ ctx.globalAlpha=clamp01(toastT*1.5); ctx.font='700 21px system-ui,sans-serif';
    const tw=ctx.measureText(toast).width, bw=Math.min(W-40,tw+44), bh=42, by=H*.26, slide=(1-clamp01((1.6-toastT)*3))*14, bx=W/2-bw/2;
    ctx.fillStyle='rgba(10,10,18,.8)'; if(ctx.roundRect){ ctx.beginPath(); ctx.roundRect(bx,by-slide,bw,bh,bh/2); ctx.fill(); } else ctx.fillRect(bx,by-slide,bw,bh);
    ctx.strokeStyle=realm?('rgba('+realm.accent.join(',')+',.55)'):'rgba(255,224,102,.55)'; ctx.lineWidth=1.5; if(ctx.roundRect){ ctx.beginPath(); ctx.roundRect(bx,by-slide,bw,bh,bh/2); ctx.stroke(); }
    ctx.fillStyle='#ffeec0'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(toast,W/2,by-slide+bh/2); ctx.textAlign='left'; ctx.textBaseline='top'; ctx.globalAlpha=1; }

  if(phase==='title'){
    try{ const _h=document.getElementById('hint'); if(_h) _h.style.display='none'; }catch(e){}   // the in-game control bar is a DOM <div> — hide it on the home screen
    const RR=(x,y,w,h,rd)=>{ if(ctx.roundRect){ctx.beginPath();ctx.roundRect(x,y,w,h,rd);}else{ctx.beginPath();ctx.rect(x,y,w,h);} };
    const T=performance.now()/1000;
    // ---- backdrop: deep gradient + cool moon-glow ----
    { const bg=ctx.createLinearGradient(0,0,0,H); bg.addColorStop(0,'#0a0c1a'); bg.addColorStop(0.5,'#0a0d1c'); bg.addColorStop(1,'#05060e'); ctx.fillStyle=bg; ctx.fillRect(0,0,W,H); }
    { const rg=ctx.createRadialGradient(W/2,H*0.14,18,W/2,H*0.14,H*0.8); rg.addColorStop(0,'rgba(78,100,160,0.22)'); rg.addColorStop(1,'rgba(78,100,160,0)'); ctx.fillStyle=rg; ctx.fillRect(0,0,W,H); }
    // ---- the Tower: a faint monolith rising behind the hall, lit windows flickering ----
    { const baseW=Math.min(250,W*0.2), peakY=H*0.06, baseY=H+12, segs=11, segH=(baseY-peakY)/segs;
      for(let i=0;i<segs;i++){ const f=i/(segs-1), w=baseW*(1-f*0.62), yTop=baseY-(i+1)*segH, bx=W/2-w/2;
        ctx.fillStyle='rgba(28,33,54,'+(0.13+f*0.05).toFixed(3)+')'; ctx.fillRect(bx,yTop,w,segH+0.6);
        ctx.fillStyle='rgba(0,0,0,0.16)'; ctx.fillRect(bx,yTop,w,2);
        for(let q=0;q<2;q++){ const fl=0.10+0.12*Math.abs(Math.sin(T*1.5+i*1.7+q*2.3)); ctx.fillStyle='rgba(255,206,124,'+fl.toFixed(3)+')'; ctx.fillRect(bx+w*(0.32+q*0.36)-2, yTop+segH*0.34, 4, segH*0.42); } }
      ctx.globalCompositeOperation='lighter'; const bgl=0.30+0.16*Math.sin(T*2.2); ctx.fillStyle='rgba(150,230,140,'+bgl.toFixed(3)+')'; ctx.beginPath(); ctx.arc(W/2,peakY,16,0,7); ctx.fill(); ctx.globalCompositeOperation='source-over'; }
    // ---- rising embers (wall-clock; stable per-index drift) ----
    ctx.globalCompositeOperation='lighter';
    for(let i=0;i<46;i++){ const hs=(Math.sin(i*19.7)*0.5+0.5), hx=(Math.sin(i*73.1)*0.5+0.5), sp=0.4+hs*0.8;
      const yy=H+20-((T*34*sp+hs*H*1.4)%(H+60)), xx=hx*W+Math.sin(T*0.5+i)*16, fl=0.22+0.26*(Math.sin(T*1.7+i)*0.5+0.5);
      ctx.globalAlpha=fl; ctx.fillStyle='rgba(255,196,116,1)'; ctx.beginPath(); ctx.arc(xx,yy,1+hs*1.6,0,7); ctx.fill(); }
    ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over';
    // ---- vignette + bottom scrim (keeps footer text readable over the tower base) ----
    { const vg=ctx.createRadialGradient(W/2,H*0.42,Math.min(W,H)*0.28,W/2,H*0.42,Math.max(W,H)*0.72); vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,0.5)'); ctx.fillStyle=vg; ctx.fillRect(0,0,W,H); }
    { const sc=ctx.createLinearGradient(0,H*0.6,0,H); sc.addColorStop(0,'rgba(5,6,14,0)'); sc.addColorStop(1,'rgba(5,6,14,0.85)'); ctx.fillStyle=sc; ctx.fillRect(0,H*0.6,W,H*0.4); }
    ctx.textAlign='center'; ctx.textBaseline='middle';
    // ---- logo / title ----
    // ---- code-drawn pixel wordmark (replaces ui_logo.png) — landing only ----
    if(!heroSelect){ const ls=Math.max(5, Math.min(12, Math.floor(W/108))); drawLogo(W/2, H*0.085, ls); }
    if(!heroSelect){
      // ===== LANDING =====
      pxText('THE SYSTEMIC DISTRICT CLIMB', W/2, H*0.355, 2, PAL.textDim, {align:'center'});
      const menu=buildHomeMenu();
      for(let i=0;i<menu.length;i++){ const it=menu[i], r=homeMenuRect(i,menu.length), bx=r[0],by=r[1],bw=r[2],bh=r[3], hov=mouseX>=bx&&mouseX<=bx+bw&&mouseY>=by&&mouseY<=by+bh;
        pxButton(bx,by,bw,bh, it.label, hov, {accent: it.accent||PAL.gold, scale:3});
        pxText('['+it.key+']', bx+bw-10, by+bh/2-3, 1, hov?PAL.gold:PAL.textDim, {align:'right'});
      }
      { const cr=cacheRank(), fc=featCount(), ec=(FT.lore||[]).length, bits=[]; if(fc>0) bits.push(fc+' feats'); if(cr>0) bits.push('Cache rank '+cr); if(ec>0) bits.push(ec+'/'+ECHOES.length+' echoes'+(allEchoes()?' ✦':''));
        if(bits.length){ ctx.fillStyle='rgba(196,206,232,0.6)'; ctx.font='13px system-ui'; ctx.textAlign='center'; ctx.fillText('The Tower remembers:    '+bits.join('      ·      '), W/2, H-56); } }
      ctx.fillStyle='rgba(170,180,205,0.45)'; ctx.font='12px system-ui'; ctx.textAlign='center'; ctx.fillText('a systemic district climb  ·  WASD move · LMB attack · RMB special · Q ultimate · E talk/use · M map', W/2, H-30);
    } else {
      // ===== CHARACTER SELECT =====
      for(let k=0;k<CLASSES.length;k++){ const cr2=titleCardRect(k); if(mouseX>=cr2[0]&&mouseX<=cr2[0]+cr2[2]&&mouseY>=cr2[1]&&mouseY<=cr2[1]+cr2[3]) heroPick=k; }
      if(heroPick>=CLASSES.length) heroPick=0; const sel=CLASSES[heroPick];
      pxText(heroSwap?'SWITCH HERO':'CHARACTER SELECT', W/2, H*0.045, 3, heroSwap?PAL.cyan:PAL.gold, {align:'center', shadow:true});
      // ---- left: large pixel portrait ----
      const pvX=Math.max(14,W*0.05), pvY=H*0.15, pvW=Math.min(300,W*0.28), pvH=H*0.50;
      pxPanel(pvX,pvY,pvW,pvH,{fill:'#14121d'});
      { const spr=heroSprite(sel.key); const th=Math.min(pvH-46,pvW*1.1), tw=spr.width/spr.height*th; pxBlit(spr, pvX+pvW/2, pvY+pvH/2-6, tw, th, 1); }
      pxText(sel.key, pvX+pvW/2, pvY+pvH-26, 3, PAL.text, {align:'center', shadow:true});
      // ---- right: name + stats + skills ----
      const rx=pvX+pvW+22, rw=W-rx-Math.max(14,W*0.05);
      pxPanel(rx,pvY,rw,32,{fill:'#1b1a26'}); pxText(sel.key.toUpperCase(), rx+10, pvY+9, 3, PAL.gold, {shadow:true});
      { const sr=starRank(getBaseline(sel.key)); pxText(sr.stars+'★ '+sr.title.toUpperCase(), rx+rw-10, pvY+11, 2, PAL.cyan, {align:'right'}); }
      if(sel.mute) pxText('SILENT', rx+rw-10, pvY-9, 1, PAL.red, {align:'right'});
      const colW=(rw-12)/2, sY=pvY+42, sH=pvH-42, b=getBaseline(sel.key);
      pxPanel(rx,sY,colW,sH,{fill:'#191824'}); pxText('STATS', rx+10, sY+9, 2, PAL.cyan, {shadow:true});
      { const stats=[['HP',Math.round(b.maxHp)],['STAMINA',b.maxStamina],['MANA',b.maxMana],['ATK DMG',b.ad],['ATK POWER',b.ap],['AD DEF',b.adDef],['AP DEF',b.apDef],['CRIT RATE',Math.round(b.critC*100)+'%'],['CRIT DMG',b.critM+'X']];
        const step=Math.min(20,(sH-40)/stats.length);
        for(let k=0;k<stats.length;k++){ const yy=sY+30+k*step; pxText(stats[k][0], rx+10, yy, 1, PAL.textDim); pxText(''+stats[k][1], rx+colW-10, yy, 1, PAL.text, {align:'right'}); } }
      const kX=rx+colW+12;
      pxPanel(kX,sY,colW,sH,{fill:'#191824'}); pxText('SKILLS', kX+10, sY+9, 2, PAL.purple, {shadow:true});
      { const W2=WEAPONS[sel.key]||{}, A2=ABILITY[sel.key]||{}, U2=ULT_NAMES[sel.key]||'ULTIMATE';
        const sk=[['LMB  BASIC',W2.name||'ATTACK'],['RMB  SKILL',A2.name||'SKILL'],['Q  ULTIMATE',U2]];
        for(let k=0;k<sk.length;k++){ const yy=sY+34+k*32; pxText(sk[k][0], kX+10, yy, 1, PAL.gold); pxText((''+sk[k][1]).toUpperCase(), kX+10, yy+11, 1, PAL.text); } }
      // ---- bottom: 8 hero cards (hover previews, click begins) ----
      CLASSES.forEach((c,k)=>{ const [x,y,cw,ch]=titleCardRect(k), hov=(k===heroPick);
        pxPanel(x,y,cw,ch,{fill:hov?'#2a2c3e':'#16151f', border:hov?PAL.gold:PAL.ink});
        const spr=heroSprite(c.key); const th=ch-12, tw=spr.width/spr.height*th; pxBlit(spr, x+18, y+ch/2, tw, th, 1);
        pxText(c.key, x+34, y+ch/2-3, 1, hov?PAL.gold:PAL.text);
        pxText(''+(k+1), x+cw-7, y+6, 1, PAL.textDim, {align:'right'}); });
      pxText(heroSwap?'CLICK A HERO TO CONTINUE THE CLIMB':'CLICK A HERO OR PRESS 1-8 TO BEGIN', W/2, titleCardRect(0)[1]-12, 1, PAL.textDim, {align:'center'});
      { const r=heroBackRect(), bx=r[0],by=r[1],bw=r[2],bh=r[3], hov=mouseX>=bx&&mouseX<=bx+bw&&mouseY>=by&&mouseY<=by+bh;
        pxButton(bx,by,bw,bh,'BACK',hov,{scale:2}); }
    }
    // ---- Settings sub-panel (input handler never early-returns through it) ----
    if(homeSettings){ const pw=340, ph=168, px=(W-pw)/2, py=H/2-ph/2;
      ctx.fillStyle='rgba(5,7,13,0.92)'; ctx.fillRect(0,0,W,H);
      ctx.fillStyle='rgba(18,22,34,0.98)'; RR(px,py,pw,ph,16); ctx.fill();
      ctx.strokeStyle='rgba(160,170,200,0.45)'; ctx.lineWidth=2; RR(px,py,pw,ph,16); ctx.stroke(); ctx.lineWidth=1;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillStyle='#ffd34d'; ctx.font='800 19px system-ui'; ctx.fillText('SETTINGS', W/2, py+28);
      ctx.font='15px system-ui'; ctx.fillStyle='rgba(236,240,250,0.9)';
      ctx.fillText('M  —  '+(muted?'Unmute sound':'Mute sound'), W/2, py+68);
      ctx.fillText('−  /  =   —   Zoom  '+Math.round(ZOOM*100)+'%', W/2, py+100);
      ctx.fillStyle='rgba(196,206,232,0.5)'; ctx.font='12px system-ui'; ctx.fillText('S or Esc to close   ·   press 1–8 to start a run anytime', W/2, py+138); }
    ctx.textAlign='left'; ctx.textBaseline='alphabetic';
  }

  if(paused){
    overlayVeil('6,8,16',0.55,0.72);   // lighter veil — the frozen world still shows behind
    const pw=Math.min(440,W-80), ph=350, px=(W-pw)/2, py=H/2-ph/2;
    ctx.fillStyle='rgba(14,17,28,0.96)'; rrct(px,py,pw,ph,18); ctx.fill();
    ctx.strokeStyle='rgba(120,134,170,0.4)'; ctx.lineWidth=1.5; rrct(px+0.75,py+0.75,pw-1.5,ph-1.5,18); ctx.stroke(); ctx.lineWidth=1;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle='#e8ecf6'; ctx.font='800 38px system-ui,sans-serif'; ctx.fillText('PAUSED', W/2, py+48);
    ctx.fillStyle='rgba(190,200,224,0.72)'; ctx.font='14px system-ui,sans-serif';
    ctx.fillText('Floor '+floor+' / '+TOTAL_FLOORS+'  ·  '+(realm?realm.name:'')+(floorMod?'  ·  '+floorMod.name:''), W/2, py+80);
    const rows=[ ['Esc / P','Resume','#8fe06a'], ['M',(muted?'Unmute sound':'Mute sound'),'#9fd0ff'], ['C','Creator Mode '+(devMode?'ON':'off'),'#d8b06a'], ['R','Abandon & New Climb','#ff9a8f'] ];
    const rw=pw-56, rx=px+28, rh=42, rgap=10; let ry=py+112;
    for(let i=0;i<rows.length;i++){ const r=rows[i];
      ctx.fillStyle='rgba(22,27,42,0.92)'; rrct(rx,ry,rw,rh,10); ctx.fill();
      ctx.strokeStyle='rgba(92,106,144,0.4)'; ctx.lineWidth=1; rrct(rx+0.5,ry+0.5,rw-1,rh-1,10); ctx.stroke();
      ctx.font='700 13px system-ui'; const kw=Math.max(46, ctx.measureText(r[0]).width+22);
      ctx.fillStyle='rgba(8,10,18,0.82)'; rrct(rx+8,ry+8,kw,rh-16,7); ctx.fill();
      ctx.fillStyle=r[2]; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(r[0], rx+8+kw/2, ry+rh/2+1);
      ctx.fillStyle='rgba(228,232,242,0.92)'; ctx.font='15px system-ui'; ctx.textAlign='left'; ctx.fillText(r[1], rx+8+kw+14, ry+rh/2+1); ctx.textAlign='center';
      ry+=rh+rgap; }
    ctx.fillStyle='rgba(180,190,214,0.5)'; ctx.font='italic 12px Georgia,serif';
    ctx.fillText('Progress saves each floor  ·  ` or F9 toggles creator mode', W/2, py+ph-20);
    ctx.textAlign='left'; ctx.textBaseline='alphabetic';
  }

  if(phase==='ascend'){
    overlayVeil('8,10,18',0.8,0.9);
    ctx.textAlign='center'; ctx.textBaseline='middle';
    const acc=realm?rgb(realm.accent):'#8fe06a';
    ctx.fillStyle=acc; ctx.font='800 46px system-ui,sans-serif'; ctx.fillText('FLOOR '+floor+' CLEARED', W/2, H/2-150);
    ctx.fillStyle='rgba(236,240,250,0.92)'; ctx.font='19px system-ui,sans-serif';
    const nextRealm=realmFor(floor+1);
    ctx.fillText(nextRealm!==realm ? 'Ahead lies '+nextRealm.name+'…' : 'The stair to floor '+(floor+1)+' opens above you.', W/2, H/2-114);
    ctx.fillStyle='rgba(200,210,235,0.72)'; ctx.font='15px system-ui,sans-serif';
    ctx.fillText('Lv '+player.level+'   ·   '+(player.items?player.items.length:0)+' relics   ·   '+coinCount+' coins', W/2, H/2-84);
    { const mm=Math.floor(floorAge/60), ss=(''+Math.floor(floorAge%60)).padStart(2,'0'), fnd=poiList.filter(p=>p.found).length;
      ctx.fillStyle='rgba(170,180,205,0.6)'; ctx.font='13px system-ui,sans-serif';
      ctx.fillText('floor time '+mm+':'+ss+'   ·   '+fnd+'/'+poiList.length+' places   ·   '+floorStats.elites+' elites   ·   +'+Math.max(0,coinCount-floorStats.coins0)+' coins   ·   '+(kills-floorStats.kills0)+' kills', W/2, H/2-60); }
    ctx.fillStyle='rgba(220,224,240,0.72)'; ctx.font='italic 16px Georgia,serif';
    ctx.fillText('“The Tower offers every climber a bargain. Choose.”', W/2, H/2-26);
    const cards=[ {t:'REST', d:'Heal to full', c:'#7dd87d', k:'1', ic:'♥'},
                  {t:'RICHES', d:'+'+(22+floor*6)+' coins', c:'#ffd34d', k:'2', ic:'◆'},
                  {t:'TRIAL', d:'A relic now — but a harsher floor', c:'#ff7a6a', k:'3', ic:'✦'} ];
    const bw=Math.min(300,(W-120)/3), gap=22, total=3*bw+2*gap, x0=(W-total)/2, by=H/2+8, bh=150;
    for(let i=0;i<3;i++){ const cd=cards[i], x=x0+i*(bw+gap), hov=mouseX>=x&&mouseX<=x+bw&&mouseY>=by&&mouseY<=by+bh;
      ctx.save(); if(hov){ ctx.shadowColor=cd.c; ctx.shadowBlur=20; } ctx.fillStyle=hov?'rgba(32,38,56,0.97)':'rgba(18,22,34,0.93)'; rrct(x,by,bw,bh,14); ctx.fill(); ctx.restore();
      ctx.fillStyle=cd.c; rrct(x,by+12,3.5,bh-24,2); ctx.fill();
      ctx.strokeStyle=hov?cd.c:'rgba(92,106,144,0.5)'; ctx.lineWidth=hov?2.6:1.5; rrct(x+0.8,by+0.8,bw-1.6,bh-1.6,14); ctx.stroke(); ctx.lineWidth=1;
      ctx.fillStyle='rgba(8,10,18,0.85)'; rrct(x+14,by+14,30,30,8); ctx.fill(); ctx.fillStyle=cd.c; ctx.font='800 16px system-ui,sans-serif'; ctx.fillText(cd.k, x+29, by+30);
      ctx.fillStyle=cd.c; ctx.font='800 29px system-ui,sans-serif'; ctx.fillText(cd.ic+' '+cd.t, x+bw/2, by+64);
      ctx.fillStyle='rgba(220,226,240,0.85)'; ctx.font='15px system-ui,sans-serif'; wrap(cd.d, x+bw/2, by+106, bw-34, 20); }
    ctx.fillStyle='rgba(170,180,205,0.5)'; ctx.font='13px system-ui,sans-serif'; ctx.fillText('press 1 / 2 / 3 — or click a card   ·   A / W / S to step back', W/2, by+bh+24);
    ctx.textAlign='left'; ctx.textBaseline='alphabetic';
  }

  if(phase==='dead'){
    try{ const _h=document.getElementById('hint'); if(_h) _h.style.display='none'; }catch(e){}
    overlayVeil('14,5,8',0.85,0.95);
    { const dfr=animFrames('hero_Huntress','death');   // play the fallen-hero death animation above the epitaph (once, then holds the final frame), backlit so the silhouette reads
      if(dfr&&dfr.length&&deathHeroKey){ const dp=clamp01((s_now()-deathAt)/1300), natural=(HERO_RIG[HERO_SPRITE[deathHeroKey]||deathHeroKey]||{}).natural, dyc=H/2-150;
        ctx.globalCompositeOperation='lighter'; drawGlow(W/2,dyc-30,170,200,60,66,0.34+0.10*dp); ctx.globalCompositeOperation='source-over';
        drawHeroAnchored(dfr, W/2, dyc, 3.3, 1, dp, natural?null:HERO_TINT[deathHeroKey], 'dead', HERO_RIG.Huntress.anc); } }
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle='#c0303a'; ctx.font='800 54px system-ui,sans-serif'; ctx.fillText('THE TOWER KEEPS YOU', W/2, H/2-86);
    ctx.fillStyle='rgba(232,220,224,0.85)'; ctx.font='19px system-ui,sans-serif';
    ctx.fillText('You fell on floor '+(deathFloor||floor)+(realm?' — '+realm.name:'')+'.', W/2, H/2-42);
    const pw=Math.min(460,W-80), ph=84, px=(W-pw)/2, py=H/2-14;
    ctx.fillStyle='rgba(20,12,15,0.88)'; rrct(px,py,pw,ph,14); ctx.fill();
    ctx.strokeStyle='rgba(150,70,80,0.4)'; ctx.lineWidth=1.5; rrct(px+0.75,py+0.75,pw-1.5,ph-1.5,14); ctx.stroke(); ctx.lineWidth=1;
    ctx.fillStyle='rgba(255,255,255,0.85)'; ctx.font='15px system-ui,sans-serif';
    ctx.fillText('Lv '+player.level+'   ·   '+kills+' kills   ·   '+(player.items?player.items.length:0)+' relics', W/2, py+30);
    ctx.fillStyle='#ffd34d'; ctx.font='700 14px system-ui,sans-serif';
    ctx.fillText('Your coins endow the Climber\u2019s Cache — Rank '+cacheRank()+' endures.', W/2, py+58);
    ctx.fillStyle='rgba(230,220,224,0.55)'; ctx.font='italic 14px Georgia,serif';
    ctx.fillText('“What the Tower takes, it keeps. What you earned, it remembers.”', W/2, H/2+94);
    const bw=240, bh=44, bx=(W-bw)/2, byy=H/2+126;
    ctx.fillStyle='rgba(40,20,24,0.9)'; rrct(bx,byy,bw,bh,bh/2); ctx.fill();
    ctx.strokeStyle='#ffe066'; ctx.lineWidth=1.5; rrct(bx+0.75,byy+0.75,bw-1.5,bh-1.5,bh/2); ctx.stroke(); ctx.lineWidth=1;
    ctx.fillStyle='#ffe066'; ctx.font='700 16px system-ui,sans-serif'; ctx.fillText('Press R to begin anew', W/2, byy+bh/2+1);
    ctx.textAlign='left'; ctx.textBaseline='alphabetic';
  }
  if(phase==='draft'){
    overlayVeil('8,10,18',0.78,0.9);
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle='#ffe066'; ctx.font='800 36px system-ui,sans-serif'; ctx.fillText('CHOOSE AN UPGRADE', W/2, H/2-150);
    ctx.fillStyle='rgba(200,210,235,0.7)'; ctx.font='15px system-ui,sans-serif'; ctx.fillText('press 1, 2 or 3 — or click a card', W/2, H/2-118);
    const cw=240, gap=24, total=draftCards.length*cw+(draftCards.length-1)*gap, x0=(W-total)/2;
    draftCards.forEach((card,i)=>{
      const x=x0+i*(cw+gap), y=H/2-70, ch=200, evo=!!card.evo, hov=mouseX>=x&&mouseX<=x+cw&&mouseY>=y&&mouseY<=y+ch, acc=evo?'#ffd34d':'#8fe06a';
      ctx.save(); if(hov||evo){ ctx.shadowColor=evo?'rgba(255,211,77,0.5)':'rgba(143,224,106,0.4)'; ctx.shadowBlur=evo?24:16; }
      ctx.fillStyle=evo?'rgba(36,29,8,0.97)':(hov?'rgba(30,36,54,0.97)':'rgba(18,22,34,0.93)'); rrct(x,y,cw,ch,14); ctx.fill(); ctx.restore();
      ctx.strokeStyle=evo?'#ffd34d':(hov?'#8fe06a':'rgba(92,106,144,0.55)'); ctx.lineWidth=evo?3:(hov?2.4:1.5); rrct(x+0.8,y+0.8,cw-1.6,ch-1.6,14); ctx.stroke(); ctx.lineWidth=1;
      let yy=y+28;
      if(evo){ ctx.fillStyle='#ffd34d'; ctx.font='800 13px system-ui,sans-serif'; ctx.fillText('✦ EVOLUTION ✦', x+cw/2, yy); yy+=10; }
      ctx.fillStyle='rgba(8,10,18,0.85)'; rrct(x+cw/2-19,yy,38,38,9); ctx.fill(); ctx.fillStyle=acc; ctx.font='800 24px system-ui,sans-serif'; ctx.fillText((i+1), x+cw/2, yy+20);
      ctx.fillStyle=acc; ctx.font='700 21px system-ui,sans-serif'; ctx.fillText(card.n, x+cw/2, y+108);
      ctx.fillStyle='rgba(224,228,242,0.88)'; ctx.font='15px system-ui,sans-serif'; wrap(card.d, x+cw/2, y+150, cw-30, 20);
    });
    ctx.textAlign='left'; ctx.textBaseline='alphabetic';
  }

  if(phase==='win'){
    try{ const _h=document.getElementById('hint'); if(_h) _h.style.display='none'; }catch(e){}
    overlayVeil('16,14,6',0.82,0.93);
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle='#ffe066'; ctx.font='800 50px system-ui,sans-serif'; ctx.fillText('★ THE TOWER IS YOURS ★', W/2, H/2-110);
    ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.font='20px system-ui,sans-serif';
    ctx.fillText('All floors conquered. The Empty Throne ahead. The Tower holds its breath.', W/2, H/2-66);
    const pw=Math.min(480,W-80), ph=64, px=(W-pw)/2, py=H/2-40;
    ctx.fillStyle='rgba(26,22,10,0.85)'; rrct(px,py,pw,ph,14); ctx.fill();
    ctx.strokeStyle='rgba(200,170,80,0.45)'; ctx.lineWidth=1.5; rrct(px+0.75,py+0.75,pw-1.5,ph-1.5,14); ctx.stroke(); ctx.lineWidth=1;
    ctx.fillStyle='rgba(255,255,255,0.85)'; ctx.font='16px system-ui,sans-serif';
    ctx.fillText('Level '+player.level+'   ·   '+kills+' kills   ·   '+(player.items?player.items.length:0)+' relics   ·   '+coinCount+' coins', W/2, py+ph/2+1);
    const rows=[ ['R','Take the seat & rest — the climb ends, a new one may begin','#8fe06a'], ['N','Refuse the Throne (NG+'+(ngPlus+1)+') — the Tower sharpens every floor','#ff9a8f'] ];
    const rw=Math.min(560,W-80), rx=(W-rw)/2, rh=46, rgap=12; let ry=H/2+50;
    for(let i=0;i<rows.length;i++){ const r=rows[i];
      ctx.fillStyle='rgba(22,20,12,0.9)'; rrct(rx,ry,rw,rh,10); ctx.fill();
      ctx.strokeStyle='rgba(120,108,70,0.4)'; ctx.lineWidth=1; rrct(rx+0.5,ry+0.5,rw-1,rh-1,10); ctx.stroke();
      ctx.font='700 15px system-ui'; ctx.fillStyle='rgba(8,10,18,0.85)'; rrct(rx+10,ry+9,34,rh-18,8); ctx.fill();
      ctx.fillStyle=r[2]; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(r[0], rx+10+17, ry+rh/2+1);
      ctx.fillStyle='rgba(232,236,246,0.92)'; ctx.font='14.5px system-ui'; ctx.textAlign='left'; ctx.fillText(r[1], rx+58, ry+rh/2+1); ctx.textAlign='center';
      ry+=rh+rgap; }
    ctx.textAlign='left'; ctx.textBaseline='alphabetic';
  }

  // boss-intro cinematic: letterbox bars + name card
  if(bossIntroT>0 && phase==='explore' && !paused){
    const k = Math.min(1, Math.min(2.6-bossIntroT, bossIntroT)/0.4);   // ease in/out
    const bh = k*72;
    ctx.fillStyle='rgba(0,0,0,.82)'; ctx.fillRect(0,0,W,bh); ctx.fillRect(0,H-bh,W,bh);
    ctx.globalAlpha=k; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle='#fff'; ctx.font='800 42px system-ui,sans-serif'; ctx.fillText(bossIntroName, W/2, H/2-12);
    ctx.fillStyle=realm?rgb(realm.accent):'#ffe066'; ctx.font='700 18px system-ui,sans-serif'; ctx.fillText(bossIntroSub, W/2, H/2+24);
    ctx.globalAlpha=1; ctx.textAlign='left'; ctx.textBaseline='top';
  }

  if(waypoint && phase==='explore' && !mapOpen && !codexOpen){   // the gold guide to your pinned waypoint
    const [wx9,wy9]=w2s(waypoint.x,waypoint.y), t9=s_now();
    if(wx9>40&&wx9<W-40&&wy9>40&&wy9<H-40){
      const bob=Math.sin(t9/260)*4; ctx.fillStyle='#ffd34d';
      ctx.beginPath(); ctx.moveTo(wx9,wy9-14+bob); ctx.lineTo(wx9+7,wy9-24+bob); ctx.lineTo(wx9,wy9-34+bob); ctx.lineTo(wx9-7,wy9-24+bob); ctx.closePath(); ctx.fill();
      ctx.globalAlpha=.35; ctx.fillRect(wx9-1.5,wy9-14+bob,3,14); ctx.globalAlpha=1; }
    else { const dx9=wx9-W/2, dy9=wy9-H/2, dd=Math.max(Math.abs(dx9)/(W/2-56),Math.abs(dy9)/(H/2-56));
      const ex9=W/2+dx9/dd, ey9=H/2+dy9/dd, a9=Math.atan2(dy9,dx9);
      ctx.save(); ctx.translate(ex9,ey9); ctx.rotate(a9); ctx.fillStyle='rgba(255,211,77,.9)';
      ctx.beginPath(); ctx.moveTo(12,0); ctx.lineTo(-7,-8); ctx.lineTo(-7,8); ctx.closePath(); ctx.fill(); ctx.restore();
      ctx.fillStyle='rgba(255,211,77,.85)'; ctx.font='700 11px system-ui'; ctx.textAlign='center';
      ctx.fillText(Math.round(len(waypoint.x-player.x,waypoint.y-player.y))+'p', ex9, ey9+20); ctx.textAlign='left'; } }
  if(codexOpen && phase==='explore'){   // ❖ THE CLIMBER'S CODEX
    ctx.fillStyle='rgba(5,7,13,.93)'; ctx.fillRect(0,0,W,H);
    const cw9=Math.min(W-120,1040), cx9=(W-cw9)/2, cy9=70, colW=cw9/3;
    ctx.fillStyle='rgba(18,22,32,.95)'; ctx.fillRect(cx9,cy9,cw9,H-150);
    ctx.strokeStyle='rgba(160,170,200,.4)'; ctx.lineWidth=2; ctx.strokeRect(cx9,cy9,cw9,H-150); ctx.lineWidth=1;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle='#fff'; ctx.font='800 22px system-ui'; ctx.fillText('THE CLIMBER\u2019S CODEX', W/2, cy9+26);
    ctx.font='12px system-ui'; ctx.fillStyle='rgba(255,255,255,.5)'; ctx.fillText('B or Esc to close', W/2, cy9+46);
    ctx.textAlign='left';
    // — column 1: the hero —
    let y9=cy9+78, x1=cx9+24;
    ctx.fillStyle='#8fe06a'; ctx.font='700 15px system-ui'; ctx.fillText((heroClass?heroClass.key:'?')+'  ·  Lv '+player.level+(ngPlus>0?'  ·  NG+'+ngPlus:''), x1, y9); y9+=24;
    ctx.font='12px system-ui'; ctx.fillStyle='rgba(255,255,255,.85)';
    const stats=[ ['Max HP', Math.round(player.maxHp)], ['Damage', Math.round(player.ad)],
      ['Crit', Math.round(player.critC*100)+'% / x'+(Math.round(player.critM*10)/10)],
      ['Attacks/s', Math.round(10/Math.max(.05,(curWeapon().type==='ranged'?player.rangedCdBase:player.atkCdBase)))/10],
      ['Move speed', Math.round(player.speed*10)/10], ['Lifesteal', player.lifesteal+'/kill'],
      ['Thorns', player.thorns], ['Multishot', player.multishot],
      ['Ability', (ABILITY[player.weaponKey]||{}).name||'—'], ['Ultimate', ULT_NAMES[player.weaponKey]||'—'] ];
    for(const st9 of stats){ ctx.fillStyle='rgba(255,255,255,.5)'; ctx.fillText(st9[0], x1, y9);
      ctx.fillStyle='#fff'; ctx.fillText(''+st9[1], x1+92, y9); y9+=19; }
    y9+=10; ctx.fillStyle='#c9a8ff'; ctx.font='700 15px system-ui'; ctx.fillText('FEATS  ('+featCount()+'/'+FEATS.length+'  ·  +'+(2*featCount())+' HP, +'+featCount()+' dmg)', x1, y9); y9+=22;
    ctx.font='11px system-ui';
    for(const ft of FEATS){ const got=!!FT.done[ft.k], cur=Math.min(FT.lt[ft.f]||0, ft.need);
      ctx.fillStyle=got?'#8fe06a':'rgba(255,255,255,.55)';
      ctx.fillText((got?'✓ ':'· ')+ft.name+'  —  '+ft.desc+(got?'':'  ('+cur+'/'+ft.need+')'), x1, y9); y9+=16; }
    // — column 2: relics —
    let y2=cy9+78; const x2=cx9+colW+18;
    ctx.fillStyle='#ffd34d'; ctx.font='700 15px system-ui'; ctx.fillText('RELICS  ('+player.items.length+')', x2, y2); y2+=24;
    ctx.font='11px system-ui';
    const shown=player.items.slice(-14);
    for(const it9 of shown){ const o9=(typeof it9==='string')?{n:it9,e:''}:it9;
      ctx.fillStyle='#fff'; ctx.fillText(o9.n.slice(0,34), x2, y2); y2+=14;
      if(o9.e){ ctx.fillStyle='rgba(143,224,106,.8)'; ctx.fillText('   '+o9.e, x2, y2); y2+=16; } else y2+=4; }
    if(player.items.length>14){ ctx.fillStyle='rgba(255,255,255,.45)'; ctx.fillText('…and '+(player.items.length-14)+' more', x2, y2); }
    if(!player.items.length){ ctx.fillStyle='rgba(255,255,255,.4)'; ctx.fillText('No relics yet — bosses, vaults and wardens carry them.', x2, y2); }
    // — column 3: bestiary —
    let y3=cy9+78; const x3=cx9+colW*2+18;
    const entries=Object.entries(killsBy).sort((a,b)=>b[1]-a[1]);
    ctx.fillStyle='#ff8a8a'; ctx.font='700 15px system-ui'; ctx.fillText('BESTIARY  ('+kills+' slain)', x3, y3); y3+=24;
    ctx.font='12px system-ui';
    for(const [k9,v9] of entries.slice(0,16)){ ctx.fillStyle='rgba(255,255,255,.85)'; ctx.fillText(k9, x3, y3);
      ctx.fillStyle='rgba(255,255,255,.5)'; ctx.fillText('×'+v9, x3+118, y3);
      const mt9=masteryTier(k9); if(mt9){ ctx.fillStyle='rgba(255,210,120,.95)'; ctx.fillText(mt9[2], x3+168, y3); } y3+=18; }
    if(!entries.length){ ctx.fillStyle='rgba(255,255,255,.4)'; ctx.fillText('Nothing slain yet. The Tower waits.', x3, y3); }
    y3=Math.max(y3, cy9+78+24+16*8)+18; FT.lore=FT.lore||[];
    ctx.fillStyle='#9fd6ff'; ctx.font='700 15px system-ui'; ctx.fillText('ECHOES OF THE TOWER  ('+FT.lore.length+'/'+ECHOES.length+')', x3, y3); y3+=20;
    ctx.font='11px system-ui';
    for(let i9=0;i9<ECHOES.length;i9++){ const got=FT.lore.includes(i9);
      ctx.fillStyle=got?'rgba(180,220,255,.9)':'rgba(255,255,255,.25)';
      ctx.fillText(got? ((i9+1)+'. '+ECHOES[i9].slice(0,42)+'…') : ((i9+1)+'. ?????'), x3, y3); y3+=14; }
    ctx.textBaseline='top';
  }
  if(mapOpen && phase==='explore'){   // ◈ THE SURVEYOR'S MAP — everything you've discovered
    ctx.fillStyle='rgba(5,7,13,.93)'; ctx.fillRect(0,0,W,H);
    const s9=Math.min((W-200)/world.w,(H-190)/world.h), pw=world.w*s9, ph=world.h*s9, px0=(W-pw)/2, py0=(H-ph)/2+16;
    const MX=v=>px0+(v+world.hw)*s9, MY=v=>py0+(v+world.hh)*s9;
    ctx.fillStyle='rgba(18,22,32,.95)'; ctx.fillRect(px0-10,py0-10,pw+20,ph+20);
    ctx.strokeStyle='rgba(160,170,200,.4)'; ctx.lineWidth=2; ctx.strokeRect(px0-10,py0-10,pw+20,ph+20); ctx.lineWidth=1;
    for(let i=1;i<floors.length;i++){ const f9=floors[i];
      ctx.fillStyle = f9.road ? 'rgba(170,158,132,.5)' : f9.water ? 'rgba(60,140,180,.55)' : f9.hazard ? 'rgba(200,80,60,.5)' : f9.arena ? ((exit.found||exit.open)?'rgba(255,210,90,.25)':'rgba(150,150,175,.20)') : 'rgba(150,150,175,.20)';
      ctx.fillRect(MX(f9.x-f9.w/2), MY(f9.y-f9.h/2), Math.max(1.5,f9.w*s9), Math.max(1.5,f9.h*s9)); }
    for(const b of buildings){ ctx.fillStyle='rgba(190,190,210,.5)'; ctx.fillRect(MX(b.x)-1.5, MY(b.y)-1.5, 3, 3); }
    ctx.textBaseline='middle'; ctx.font='11px system-ui';
    for(const poi of poiList){ if(!poi.found) continue;
      ctx.fillStyle=poi.arena?'#ffd34d':'#9fd6ff'; ctx.beginPath(); ctx.arc(MX(poi.x),MY(poi.y),3.4,0,7); ctx.fill();
      ctx.fillStyle='rgba(235,240,255,.85)'; ctx.textAlign='left'; ctx.fillText(poi.name, MX(poi.x)+6, MY(poi.y)); }
    if(exit && (exit.found||exit.open)){ ctx.fillStyle='#7dff8a'; ctx.font='800 14px system-ui'; ctx.textAlign='center';
      ctx.fillText('▲', MX(exit.x), MY(exit.y)); ctx.font='10px system-ui'; ctx.fillText('THE STAIR', MX(exit.x), MY(exit.y)+11); }
    { const w9=mobs.find(m=>m.warden); if(w9){ ctx.fillStyle='#ff5a6a'; ctx.font='800 12px system-ui'; ctx.textAlign='center';
      ctx.fillText('☠ WARDEN', MX(w9.x), MY(w9.y)); } }
    // gold diamonds mark shops — where you buy stuff
    { ctx.font='11px system-ui'; const SHOP_LBL={merchant:'Trinketer',pedlar:'Apothecary',smith:'Smith',healer:'Healer',enchanter:'Enchanter',tavernkeep:'Tavern',gambler:'Gambler',caravaneer:'Caravan',quartermaster:'Quartermaster',herbalist:'Herbalist',innkeep:'Inn'};
      const gem=(X,Y,lbl)=>{ ctx.fillStyle='#ffcf4d'; ctx.beginPath(); ctx.moveTo(X,Y-5); ctx.lineTo(X+5,Y); ctx.lineTo(X,Y+5); ctx.lineTo(X-5,Y); ctx.closePath(); ctx.fill(); ctx.strokeStyle='rgba(20,16,6,.9)'; ctx.lineWidth=1; ctx.stroke(); ctx.fillStyle='rgba(255,228,150,.95)'; ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.fillText(lbl, X+8, Y); };
      for(const n of npcs){ if(SHOP_NPC[n.type]) gem(MX(n.x),MY(n.y), SHOP_LBL[n.type]||'Shop'); }
      for(const pr of props){ if(pr.kind==='market' && pr.revealed) gem(MX(pr.x),MY(pr.y),'Black Market'); }
      const gemC=(X,Y,lbl)=>{ ctx.fillStyle='#6ee0ff'; ctx.beginPath(); ctx.moveTo(X,Y-5); ctx.lineTo(X+5,Y); ctx.lineTo(X,Y+5); ctx.lineTo(X-5,Y); ctx.closePath(); ctx.fill(); ctx.strokeStyle='rgba(6,18,24,.9)'; ctx.lineWidth=1; ctx.stroke(); ctx.fillStyle='rgba(170,228,255,.95)'; ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.fillText(lbl, X+8, Y); };
      for(const pr of props){ if(pr.kind==='board') gemC(MX(pr.x),MY(pr.y),'Missions'); }   // cyan = mission boards
      for(const pr of props){ if(pr.kind==='newsstand') gemC(MX(pr.x),MY(pr.y),'News'); }
      for(const pr of props){ if(['records','evidence','relaybox'].includes(pr.kind)) gemC(MX(pr.x),MY(pr.y), pr.kind==='records'?'Records':pr.kind==='relaybox'?'Relay':'Locker'); }
      for(const pr of props){ if(pr.kind==='wardrobe') gemC(MX(pr.x),MY(pr.y),'Disguise'); }
      { const gemP=(X,Y,lbl)=>{ ctx.fillStyle='#c79cff'; ctx.beginPath(); ctx.moveTo(X,Y-5); ctx.lineTo(X+5,Y); ctx.lineTo(X,Y+5); ctx.lineTo(X-5,Y); ctx.closePath(); ctx.fill(); ctx.strokeStyle='rgba(20,8,28,.9)'; ctx.lineWidth=1; ctx.stroke(); ctx.fillStyle='rgba(214,180,255,.95)'; ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.fillText(lbl, X+8, Y); };
        for(const n of npcs){ if(n.type==='mythic') gemP(MX(n.x),MY(n.y),'Mythic Dealer'); } }
      ctx.textBaseline='alphabetic'; }
    { const blink=.6+.4*Math.sin(s_now()/240); ctx.globalAlpha=blink; ctx.fillStyle='#fff';
      ctx.beginPath(); const ppx=MX(player.x), ppy=MY(player.y);
      ctx.moveTo(ppx,ppy-6); ctx.lineTo(ppx+4.5,ppy+4); ctx.lineTo(ppx-4.5,ppy+4); ctx.closePath(); ctx.fill(); ctx.globalAlpha=1; }
    ctx.fillStyle='#fff'; ctx.font='800 22px system-ui'; ctx.textAlign='center';
    ctx.fillText('FLOOR '+floor+' — '+(realm?realm.name:''), W/2, py0-28);
    if(waypoint){ ctx.strokeStyle='#ffd34d'; ctx.lineWidth=2.5; const wxm=MX(waypoint.x), wym=MY(waypoint.y);
      ctx.beginPath(); ctx.moveTo(wxm-5,wym-5); ctx.lineTo(wxm+5,wym+5); ctx.moveTo(wxm+5,wym-5); ctx.lineTo(wxm-5,wym+5); ctx.stroke(); ctx.lineWidth=1; }
    ctx.fillStyle='rgba(255,255,255,.55)'; ctx.font='13px system-ui';
    const fnd2=poiList.filter(p=>p.found).length;
    ctx.fillText(fnd2+' / '+poiList.length+' places discovered   ·   ◆ shops · missions · dealer   ·   click to pin a waypoint   ·   M to close', W/2, py0+ph+26);
    ctx.textAlign='left'; ctx.textBaseline='top';
  }
  if(flashT>0){ ctx.fillStyle='rgba(255,255,255,'+Math.min(.5,flashT*5.5)+')'; ctx.fillRect(0,0,W,H); }   // boss-kill flash (alpha-capped, <0.1s)

  if(fadeT>0 && (phase==='explore'||phase==='ascend')){   // smooth floor-entry fade + realm card
    ctx.fillStyle='rgba(5,6,12,'+Math.min(1,fadeT*1.15)+')'; ctx.fillRect(0,0,W,H);
    const ta=Math.max(0,Math.min(1,(fadeT-0.15)*2));
    if(ta>0){ ctx.globalAlpha=ta; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillStyle='rgba(255,255,255,.5)'; ctx.font='700 15px system-ui,sans-serif';
      ctx.fillText(actFor(floor), W/2, H/2-66);
      ctx.fillStyle=realm?rgb(realm.accent):'#fff'; ctx.font='800 40px system-ui,sans-serif';
      ctx.fillText('FLOOR '+floor, W/2, H/2-24);
      ctx.fillStyle='rgba(255,255,255,.9)'; ctx.font='22px system-ui,sans-serif';
      ctx.fillText((realm?realm.name:'')+(floorMod?'  ·  '+floorMod.name:'')+(districtPlan?'  ·  '+districtPlan.name:''), W/2, H/2+18);
      ctx.fillStyle='rgba(255,255,255,.55)'; ctx.font='italic 15px Georgia,serif';
      ctx.fillText('\u201C'+(EPIGRAPHS[realmIndex(floor)]||'')+'\u201D', W/2, H/2+52);
      ctx.fillStyle='rgba(255,255,255,.42)'; ctx.font='italic 13px Georgia,serif';
      ctx.fillText(actTag(floor), W/2, H/2+84);
      ctx.globalAlpha=1; ctx.textAlign='left'; ctx.textBaseline='top'; } }
}
function wrap(text,x,y,maxW,lh){ const words=text.split(' '); let line=''; const lines=[];
  for(const w of words){ const t=line?line+' '+w:w; if(ctx.measureText(t).width>maxW){lines.push(line);line=w;} else line=t; } lines.push(line);
  const sy=y-(lines.length-1)*lh/2; lines.forEach((l,i)=>ctx.fillText(l,x,sy+i*lh)); }

// ---------- Loop ----------
reset();
let last=performance.now();
let lastErrT=0;
let perfAcc=0, perfN=0, perfCd=0;   // adaptive resolution: shrink the backbuffer when real frames run long
function frame(now){ const dtRaw=(now-last)/1000; let dt=dtRaw; last=now; if(dt>.05)dt=.05;
  try{ update(dt); updateWeather(dt); musicTick(dt); render(); }
  catch(e){ console.error('frame error:', e); if(now-lastErrT>3000){ lastErrT=now; try{ showToast('⚠ engine hiccup (see console) — recovering'); }catch(_){} } }
  if(!document.hidden && dtRaw<0.25 && phase==='explore'){ perfAcc+=dtRaw; perfN++; perfCd-=dtRaw;
    if(perfN>=90 && perfCd<=0){ const avg=perfAcc/perfN; perfAcc=0; perfN=0;
      const native=Math.min(window.devicePixelRatio||1, 2);
      if(avg>0.024 && DPR>1){ DPR=Math.max(1, DPR-0.25); resize(); perfCd=2; }          // under ~42fps: drop sharpness for smoothness
      else if(avg<0.013 && DPR<native){ DPR=Math.min(native, DPR+0.25); resize(); perfCd=5; } } }   // comfortably 60fps: claw it back
  requestAnimationFrame(frame); }
requestAnimationFrame(frame);


// v7.3: fullscreen map with torch (no page scroll while exploring) + keep v7.2 progression
const TOTAL_STEPS = 12;
const EXPECTED_HOST = location.host;
const VERSION = '2025-08-13-v7.3';
const CODE_GATES = { 4: { value: '1024' } };
let SND_ITEM, SND_PAPER;
function loadSounds(){ SND_ITEM = new Audio('assets/item.wav'); SND_PAPER = new Audio('assets/paper.wav'); }
function playItem(){ try{ SND_ITEM && SND_ITEM.play(); }catch(e){} }
function playPaper(){ try{ SND_PAPER && SND_PAPER.play(); }catch(e){} }

function qs(s){ return document.querySelector(s); }
function getStepFromURL(){ const url = new URL(window.location.href); const s=url.searchParams.get('step'); let n=parseInt(s||'1',10); if(isNaN(n)||n<1||n>TOTAL_STEPS) n=1; return n; }
function getProgress(){ const v = localStorage.getItem('auguste_progress'); return v?parseInt(v,10):0; }
function setProgress(s){ const c=getProgress(); if(s>c) localStorage.setItem('auguste_progress', String(s)); }
function resetProgress(){ localStorage.removeItem('auguste_progress'); window.location.href = window.location.pathname + '?step=1&v='+VERSION; }

async function startScanner(){
  const step = getStepFromURL();
  const progress = getProgress();
  if(step===9 && progress<8){ alert("Tu dois d’abord valider l’étape 8 (décryptage) avant de pouvoir scanner la suivante."); return; }
  const video = qs('#video'), videoWrap = qs('.videoWrap');
  const scanBtn = qs('#scanBtn'), stopBtn = qs('#stopBtn');
  if(!('BarcodeDetector' in window)){
    alert("Scanner intégré indisponible sur ce navigateur. Utilisez 'Scanner depuis une photo' ou la caméra native.");
    qs('.uploadWrap').style.display='block'; 
    return;
  }
  const detector = new BarcodeDetector({ formats:['qr_code'] });
  try{
    const stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'environment' } });
    video.srcObject = stream; await video.play();
    videoWrap.style.display='block'; scanBtn.disabled=true; stopBtn.disabled=false;
    let rafId;
    const tick = async()=>{
      try{
        const codes = await detector.detect(video);
        if(codes && codes.length){ playPaper(); setTimeout(()=>{ handleScannedURL(codes[0].rawValue); }, 120); return; }
      }catch(e){}
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    stopBtn.onclick = ()=>{ cancelAnimationFrame(rafId); stream.getTracks().forEach(t=>t.stop()); videoWrap.style.display='none'; scanBtn.disabled=false; stopBtn.disabled=true; };
  }catch(err){ alert("Impossible d’ouvrir la caméra : "+err.message); }
}

function setupUploadScan(){
  const uploadBtn=qs('#uploadBtn'), fileInput=qs('#fileInput');
  uploadBtn.onclick = ()=>{ qs('.uploadWrap').style.display='block'; fileInput.click(); };
  fileInput.addEventListener('change', async e=>{
    const file=e.target.files[0]; if(!file) return;
    if(!('BarcodeDetector' in window)){ alert("Lecture d'image non supportée. Utilisez la caméra native."); return; }
    const detector = new BarcodeDetector({ formats:['qr_code'] });
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async()=>{
      try{
        const bmp = await createImageBitmap(img);
        const res = await detector.detect(bmp);
        if(res && res.length){ playPaper(); setTimeout(()=>{ handleScannedURL(res[0].rawValue); }, 120); } else { alert("Aucun QR détecté."); }
      }catch(err){ alert("Erreur de lecture : "+err.message); }
      finally{ URL.revokeObjectURL(url); }
    };
    img.onerror = ()=>{ alert("Image invalide."); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

function handleScannedURL(urlStr){
  try{
    const url=new URL(urlStr);
    if(url.host !== EXPECTED_HOST){ alert("QR inconnu (mauvais domaine)."); return; }
    const stepParam = parseInt(new URLSearchParams(url.search).get('step')||'0',10);
    if(!stepParam){ alert("QR invalide."); return; }
    const progress = getProgress();
    if(stepParam !== progress + 1){ alert("Pas encore prêt… scanne d'abord l'étape "+(progress+1)+"."); return; }
    window.location.href = url.pathname + '?step=' + stepParam + '&v=' + VERSION;
  }catch{ alert("Lien QR invalide."); }
}

/* -------- Crosswords (step 7) -------- */
const CW_ROWS = ["BICHE","CHAMP","JONCS","BENNE","FLEUR"];
const CW_SIZE = 5;
function buildCrossword(container){
  container.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'grid';
  for(let r=0;r<CW_SIZE;r++){
    for(let c=0;c<CW_SIZE;c++){
      const inp = document.createElement('input');
      inp.maxLength = 1; inp.autocomplete='off'; inp.spellcheck=false;
      inp.setAttribute('data-r', r); inp.setAttribute('data-c', c);
      inp.addEventListener('input', (e)=>{
        let v=(e.target.value||'').toUpperCase().replace(/[^A-Z]/g,'');
        if(v.length>1) v=v.slice(-1);
        e.target.value=v;
        if(v && c<CW_SIZE-1){
          const next=container.querySelector('input[data-r="'+r+'"][data-c="'+(c+1)+'"]');
          if(next) next.focus();
        }
      });
      grid.appendChild(inp);
    }
  }
  container.appendChild(grid);
  const clues = document.createElement('div');
  clues.className='clues';
  clues.innerHTML="<strong>Définitions (horizontales) — 5 lettres :</strong><br>1) Cervidé des bois • 2) Terre cultivée • 3) Tiges du lavoir • 4) Chariot de ferme • 5) Partie de la plante";
  container.appendChild(clues);
  const btn = document.createElement('button');
  btn.textContent="Valider la grille";
  btn.style.marginTop='10px';
  btn.onclick=()=>{
    const target=["BICHE","CHAMP","JONCS","BENNE","FLEUR"];
    for(let r=0;r<CW_SIZE;r++){
      let row='';
      for(let c=0;c<CW_SIZE;c++){
        const val=(grid.children[r*CW_SIZE+c].value||' ').toUpperCase();
        row+=val;
      }
      if(row!==target[r]){ alert("Pas encore bon. Indice : ferme, champ, lavoir, charrette, botanique."); return; }
    }
    for(let r=0;r<CW_SIZE;r++){
      for(let c=0;c<CW_SIZE;c++){
        const cell=grid.children[r*CW_SIZE+c];
        if(c===2) cell.classList.add('hl'); else cell.classList.add('ok');
        cell.disabled=true;
      }
    }
    playItem();
    alert("✅ Mot secret révélé : CANNE. Étape validée !");
    setProgress(7);
  };
  container.appendChild(btn);
}

/* -------- Caesar (step 8) -------- */
function setupCaesar(){
  const box = qs('#caesarBox');
  box.style.display='block';
  const input = qs('#caesarInput'); input.value='';
}
function validateCaesar(){
  const input = qs('#caesarInput');
  let v=(input.value||'').toUpperCase().replace(/\s+/g,' ').trim();
  if(v==='GAME OF STONES'){
    playItem(); alert('✅ Décryptage correct. Étape validée !'); setProgress(8);
  } else {
    alert("Ce n’est pas encore ça. Pense à César : décale les lettres…");
  }
}

/* -------- Fullscreen Map with Torch (step 11) -------- */
function openMapFullscreen(){
  // prevent page scroll
  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  const overlay = document.createElement('div');
  overlay.className = 'fsOverlay';
  overlay.setAttribute('role','dialog');
  overlay.setAttribute('aria-modal','true');

  const inner = document.createElement('div');
  inner.className = 'fsInner flashlight';

  const img = document.createElement('img');
  img.src = 'assets/carte2025.png';
  img.alt = 'Carte au trésor';

  const close = document.createElement('button');
  close.className = 'fsClose';
  close.textContent = 'Fermer ❌';

  inner.appendChild(img);
  inner.appendChild(close);
  overlay.appendChild(inner);
  document.body.appendChild(overlay);

  const move=(x,y)=>{
    const rect = inner.getBoundingClientRect();
    // spotlight radius proportional to viewport
    const r = Math.max(120, Math.min(220, Math.min(rect.width, rect.height)*0.18));
    inner.style.setProperty('--r', r+'px');
    inner.style.setProperty('--x', (x - rect.left) + 'px');
    inner.style.setProperty('--y', (y - rect.top) + 'px');
  };
  const onMouseMove = (e)=>{ move(e.clientX, e.clientY); };
  const onTouchMove = (e)=>{
    const t=e.touches[0]; move(t.clientX, t.clientY);
    e.preventDefault(); // stop page scroll
  };

  overlay.addEventListener('mousemove', onMouseMove);
  overlay.addEventListener('touchmove', onTouchMove, {passive:false});

  const closeAll = ()=>{
    overlay.removeEventListener('mousemove', onMouseMove);
    overlay.removeEventListener('touchmove', onTouchMove);
    document.body.removeChild(overlay);
    document.body.style.overflow = prevOverflow;
  };
  close.addEventListener('click', closeAll);
  overlay.addEventListener('click', (e)=>{
    // click outside inner closes too
    if(e.target === overlay) closeAll();
  });
}

function setupMapViewer(){
  const wrap = qs('#mapWrap'); wrap.style.display='block';
  const frame = wrap.querySelector('.mapFrame');
  // Single tap/click opens full-screen viewer
  frame.addEventListener('click', openMapFullscreen);
}

const gated = new Set([4,7,8]);

const TEXTS = {
  1: "« Bien le bonjour, étranger curieux ! Si tu lis ces lignes, c’est que tu t’es aventuré sur mes terres… et que tu comptes bien fouiller dans mes affaires.\nSache que j’ai laissé derrière moi un trésor… ou peut‑être une malédiction… ou les deux.\nIl y a cent ans, j’avais déjà plus de secrets que de dents dans ma bouche — et encore, à l’époque, j’en avais déjà perdu la moitié.\nPour commencer, cherche la pierre qui porte le chiffre gravé de mon année la plus chère. Sous ce regard de granit, tu trouveras le début de ton voyage. »",
  2: "« Elle a nourri plus de ventres que le curé n’a donné de sermons ! Regarde‑la bien, mais sache que ce que tu cherches n’est pas pour tes yeux seuls… Cherche à voir autrement, comme la chouette qui chasse sous la lune. »",
  3: "« Ah, la vieille marmite… Combien de repas, combien de secrets aussi — la doyenne du hameau y perdit même son dentier. Si tu le retrouves, évite de goûter la soupe.\nÀ présent, cherche l’endroit où la vie commence… protégée par une coquille. »",
  4: "« Mes dames à plumes n’aiment pas les inconnus. Les couleurs te parlent, mais pas comme à l’arc‑en‑ciel : compte‑les, multiplie‑les… et ajoute mille.\nLe chiffre final ouvrira ta prochaine porte. »\n\n⤷ Entre le code pour révéler la suite.",
  5: "« Écoute‑moi bien : là où l’eau danse et chante encore, même par les plus grandes chaleurs, tu trouveras ce que tu cherches. Ici, les secrets flottent comme les feuilles à l’automne… Tire sur la corde, mais pas trop fort : j’ai déjà perdu deux seaux comme ça. »",
  6: "« Ah… tu as trouvé ma source secrète, oubliée de beaucoup. À présent, fais l’inverse : cherche un endroit sec… où les calories dorment à l’abri de la pluie. »",
  7: "« L’odeur du bois sec… presque aussi bonne que celle du pain chaud. Remplis la grille, et observe les lettres qui se tiennent bien droites : elles te révéleront un objet que j’ai toujours gardé près de moi. »",
  8: "« Voilà ma vieille canne… Elle m’a soutenu dans les champs comme dans les chemins de traverse. »\n\nTexte chiffré :\nJDPH RI VWRQH\n\n⤷ Écris ci‑dessous la phrase déchiffrée pour valider.",
  9: "« Assieds‑toi donc sur mon fauteuil minéral… moins confortable qu’un coussin, mais plus durable. Derrière, tu trouveras un morceau de vérité… et une énigme qui te fera lever les yeux… et peut‑être les pieds. »",
  10:"« Tu veux monter haut ? Alors trouve la chaleur sans feu, celle qui fait lever sans braise… Cherche à sa gauche un recoin non scellé. Derrière, ton destin t’attend. »",
  11:"« Ah… le vieux four. Combien de miches, combien de tartes… et combien de secrets a‑t‑il cuits en silence ? Cherche une pierre pas comme les autres : ce que tu trouveras ouvrira le dernier secret. »\n\n⤷ Touchez la carte pour l’explorer en plein écran à la lampe.",
  12:"« Bravo ! Tu as trouvé l’emplacement du trésor. Marque ta victoire… et prépare le terrain pour le prochain aventurier. »"
};

function render(){
  const step = getStepFromURL(); const progress = getProgress();
  qs('#stepNum').textContent = step;
  const story = qs('#story');
  // reset UI parts
  document.querySelectorAll('.lock').forEach(n=>n.remove());
  qs('#codeGate').style.display='none';
  qs('#crossword').style.display='none';
  qs('#caesarBox').style.display='none';
  qs('#mapWrap').style.display='none';
  story.textContent = TEXTS[step] || '';

  if(step===1){
    if(progress<1) setProgress(1);
  } else {
    const lockNeeded = step > (progress + 1);
    if(lockNeeded){
      const lock = document.createElement('div'); lock.className='lock';
      lock.textContent = "Pas encore prêt… scanne d’abord l’étape " + (progress+1) + ".";
      story.after(lock);
      const scanBtn = qs('#scanBtn'); if(scanBtn) scanBtn.disabled = true;
      return;
    }
    // auto-validate non-gated steps when they are exactly the next step
    if(step === progress + 1 && !gated.has(step)){
      setProgress(step);
    }
    if(step===4){ qs('#codeGate').style.display='block'; }
    if(step===7){ const cw=qs('#crossword'); cw.style.display='block'; buildCrossword(cw); }
    if(step===8){ qs('#caesarBox').style.display='block'; }
    if(step===11){ setupMapViewer(); }
  }
}

window.addEventListener('DOMContentLoaded', render);

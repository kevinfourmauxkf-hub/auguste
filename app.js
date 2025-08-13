
// v7.5.2: Map overlay fully opaque + proper torch (no transparency to page) + cross close button
const TOTAL_STEPS = 12;
const EXPECTED_HOST = location.host;
const VERSION = '2025-08-13-v7.5.2';
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
    if(url.host !== location.host){ alert("QR inconnu (mauvais domaine)."); return; }
    const stepParam = parseInt(new URLSearchParams(url.search).get('step')||'0',10);
    if(!stepParam){ alert("QR invalide."); return; }
    const progress = getProgress();
    if(stepParam !== progress + 1){ alert("Pas encore prêt… scanne d'abord l'étape "+(progress+1)+"."); return; }
    window.location.href = url.pathname + '?step=' + stepParam + '&v=' + VERSION;
  }catch{ alert("Lien QR invalide."); }
}

/* -------- Fullscreen Map with solid torch -------- */
function openMapFullscreen(){
  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  const overlay = document.createElement('div');
  overlay.className = 'fsOverlay solidBg';
  overlay.setAttribute('role','dialog');
  overlay.setAttribute('aria-modal','true');
  overlay.style.zIndex = 99999; // above everything

  const inner = document.createElement('div');
  inner.className = 'fsInner';

  const img = document.createElement('img');
  img.src = 'assets/carte2025.png';
  img.alt = 'Carte au trésor';

  // Torch layer (dark overlay with a transparent "hole")
  const torch = document.createElement('div');
  torch.className = 'torch';
  // starting center
  torch.style.setProperty('--x','50%');
  torch.style.setProperty('--y','50%');
  torch.style.setProperty('--r','160px');

  const close = document.createElement('button');
  close.className = 'fsClose xonly';
  close.setAttribute('aria-label','Fermer la carte');
  close.textContent = '✖';

  inner.appendChild(img);
  inner.appendChild(torch);
  inner.appendChild(close);
  overlay.appendChild(inner);
  document.body.appendChild(overlay);

  const move = (x,y)=>{
    const rect = inner.getBoundingClientRect();
    const rx = (x - rect.left);
    const ry = (y - rect.top);
    const r = Math.max(130, Math.min(240, Math.min(rect.width, rect.height)*0.20));
    torch.style.setProperty('--r', r+'px');
    torch.style.setProperty('--x', rx+'px');
    torch.style.setProperty('--y', ry+'px');
  };
  const onMouseMove = (e)=>{ move(e.clientX, e.clientY); };
  const onTouchMove = (e)=>{ const t=e.touches[0]; move(t.clientX, t.clientY); e.preventDefault(); };

  overlay.addEventListener('mousemove', onMouseMove);
  overlay.addEventListener('touchmove', onTouchMove, {passive:false});

  const closeAll = ()=>{
    overlay.removeEventListener('mousemove', onMouseMove);
    overlay.removeEventListener('touchmove', onTouchMove);
    document.body.removeChild(overlay);
    document.body.style.overflow = prevOverflow;
  };
  close.addEventListener('click', closeAll);
}

function showMapButton(){
  const wrap = qs('#mapWrap'); if(wrap){ wrap.style.display='none'; }
  const old = document.getElementById('mapOpenBtn'); if(old) old.remove();
  const btn = document.createElement('button'); btn.id='mapOpenBtn'; btn.textContent='📜 Ouvrir la carte (plein écran)'; btn.onclick=openMapFullscreen;
  qs('#story').after(btn);
}

/* -------- Minimal render for map test only (other logic unchanged in user's main app) -------- */
window.addEventListener('DOMContentLoaded', ()=>{
  const url = new URL(window.location.href);
  const step = parseInt(url.searchParams.get('step')||'11',10);
  if(step===11){
    const story = document.getElementById('story') || document.body.appendChild(document.createElement('p'));
    story.textContent = "Touchez le bouton pour ouvrir la carte en plein écran.";
    showMapButton();
  }
});

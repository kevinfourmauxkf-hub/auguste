
const TOTAL_STEPS = 12;
const EXPECTED_HOST = location.host;
const VERSION = '2025-08-12-restored'; // cache-busting
const CODE_GATES = { 4: { value: '1024', prompt: "Entrez le code pour valider cette étape :" } };

function qs(s){ return document.querySelector(s); }
function getStepFromURL(){ const url = new URL(window.location.href); const s=url.searchParams.get('step'); let n=parseInt(s||'1',10); if(isNaN(n)||n<1||n>TOTAL_STEPS) n=1; return n; }
function getProgress(){ const v = localStorage.getItem('auguste_progress'); return v?parseInt(v,10):0; }
function setProgress(s){ const c=getProgress(); if(s>c) localStorage.setItem('auguste_progress', String(s)); }
function resetProgress(){ localStorage.removeItem('auguste_progress'); window.location.href = window.location.pathname + '?step=1&v='+VERSION; }

async function startScanner(){
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
        if(codes && codes.length){ handleScannedURL(codes[0].rawValue); return; }
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
        if(res && res.length){ handleScannedURL(res[0].rawValue); } else { alert("Aucun QR détecté."); }
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
    if(stepParam !== progress + 1){
      alert("Pas encore prêt… scanne d'abord l'étape "+(progress+1)+".");
      return;
    }
    window.location.href = url.pathname + '?step=' + stepParam + '&v=' + VERSION;
  }catch{ alert("Lien QR invalide."); }
}

function render(){
  const step = getStepFromURL();
  const progress = getProgress();
  qs('#step').textContent = 'Étape '+step+' / '+TOTAL_STEPS;

  const story = qs('#story'); const lock = qs('#lock');
  const gateWrap = qs('.codegate'); const gateMsg=qs('#codeMsg'); const gateInput=qs('#codeInput'); const gateBtn=qs('#codeBtn');
  gateWrap.style.display='none'; lock.style.display='none'; story.textContent='';

  if(step === 1){
    story.textContent = window.TEXTS[1] || '';
    if(progress < 1) setProgress(1);
  }else{
    if(step > progress + 1){
      lock.style.display='block'; lock.textContent = "Pas encore prêt… scanne d’abord l’étape " + (progress+1) + "."; return;
    }
    if(step <= progress){
      story.textContent = window.TEXTS[step] || ''; return;
    }
    // expected next
    story.textContent = window.TEXTS[step] || '';
    if(step === 4){
      gateWrap.style.display='block'; gateMsg.textContent = CODE_GATES[4].prompt; gateInput.value='';
      gateBtn.onclick = ()=>{
        const v = (gateInput.value||'').trim();
        if(v === CODE_GATES[4].value){
          setProgress(4);
          gateWrap.style.display='none';
          alert("✅ Étape 4 validée. Tu peux scanner la suivante.");
        }else{
          alert('Mauvais code.');
        }
      };
    }else{
      setProgress(step);
    }
  }

  qs('#scanBtn').onclick = startScanner;
  qs('#resetBtn').onclick = resetProgress;
  setupUploadScan();
}

window.addEventListener('DOMContentLoaded', render);

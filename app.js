
const TOTAL_STEPS = 12;
const EXPECTED_HOST = location.host;

function getStepFromURL(){
  const url = new URL(window.location.href);
  const s = url.searchParams.get('step');
  let n = parseInt(s||'1',10);
  if(isNaN(n) || n<1 || n>TOTAL_STEPS) n = 1;
  return n;
}

function getProgress(){ const v = localStorage.getItem('auguste_progress'); return v?parseInt(v,10):0; }
function setProgress(s){ const c=getProgress(); if(s>c) localStorage.setItem('auguste_progress', String(s)); }
function resetProgress(){ localStorage.removeItem('auguste_progress'); window.location.href = window.location.pathname + '?step=1'; }

async function startScanner(){
  const video = document.getElementById('video');
  const videoWrap = document.querySelector('.videoWrap');
  const scanBtn = document.getElementById('scanBtn');
  const stopBtn = document.getElementById('stopBtn');
  const detectorSupported = ('BarcodeDetector' in window);
  if(!detectorSupported){
    alert("Le scanner intégré n'est pas pris en charge par ce navigateur. Essayez le mode 'Scanner depuis une photo', ou utilisez la caméra native.");
    document.querySelector('.uploadWrap').style.display = 'block';
    return;
  }
  const detector = new BarcodeDetector({ formats: ['qr_code'] });
  try{
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = stream;
    await video.play();
    videoWrap.style.display = 'block';
    scanBtn.disabled = true;
    stopBtn.disabled = false;

    let rafId;
    const tick = async () => {
      try{
        const barcodes = await detector.detect(video);
        if(barcodes && barcodes.length){
          handleScannedURL(barcodes[0].rawValue);
          return;
        }
      }catch(e){}
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    stopBtn.onclick = () => {
      cancelAnimationFrame(rafId);
      const tracks = stream.getTracks(); tracks.forEach(t=>t.stop());
      videoWrap.style.display = 'none';
      scanBtn.disabled = false;
      stopBtn.disabled = true;
    };
  }catch(err){ alert("Impossible d'ouvrir la caméra : " + err.message); }
}

function setupUploadScan(){
  const uploadWrap = document.querySelector('.uploadWrap');
  const uploadBtn = document.getElementById('uploadBtn');
  const fileInput = document.getElementById('fileInput');

  uploadBtn.onclick = () => {
    uploadWrap.style.display = 'block';
    fileInput.click();
  };

  fileInput.addEventListener('change', async (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    if(!('BarcodeDetector' in window)){
      alert("Lecture d'image non supportée sur ce navigateur. Utilisez la caméra native.");
      return;
    }
    const detector = new BarcodeDetector({ formats: ['qr_code'] });
    const imgURL = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      try{
        const bitmap = await createImageBitmap(img);
        const results = await detector.detect(bitmap);
        if(results && results.length){
          handleScannedURL(results[0].rawValue);
        }else{
          alert("Aucun QR détecté dans cette image. Réessayez avec une photo nette et bien éclairée.");
        }
      }catch(err){ alert("Erreur de lecture : " + err.message); }
      finally{ URL.revokeObjectURL(imgURL); }
    };
    img.onerror = () => { alert("Impossible de lire l'image."); URL.revokeObjectURL(imgURL); };
    img.src = imgURL;
  });
}

function handleScannedURL(urlStr){
  try{
    const url = new URL(urlStr);
    if(url.host !== EXPECTED_HOST){ alert("QR inconnu (mauvais domaine)."); return; }
    const stepParam = parseInt(new URLSearchParams(url.search).get('step')||'0',10);
    if(!stepParam){ alert("QR invalide."); return; }
    window.location.href = url.href; // La page de destination appliquera le verrou strict
  }catch{ alert("Lien QR invalide."); }
}

function render(){
  const step = getStepFromURL();
  const progress = getProgress();

  const stepEl = document.getElementById('step');
  const story = document.getElementById('story');
  const lock = document.getElementById('lock');

  stepEl.textContent = 'Étape ' + step + ' / ' + TOTAL_STEPS;
  story.textContent = window.STEP_TEXTS[step] || '...';

  // STRICT : visible si précédent validé, sinon blocage
  if(step === 1 || progress >= (step-1)){
    lock.style.display = 'none';
    // Marquer automatiquement cette étape comme validée
    setProgress(step);
  }else{
    lock.style.display = 'block';
  }

  document.getElementById('scanBtn').onclick = startScanner;
  document.getElementById('resetBtn').onclick = resetProgress;
  setupUploadScan();
}

window.addEventListener('DOMContentLoaded', render);

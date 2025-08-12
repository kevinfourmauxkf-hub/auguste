
const TOTAL_STEPS = 12;
const EXPECTED_HOST = location.host;
// gates
const CODE_GATES = { 4: { type: 'number', value: '1024', prompt: "Entrez le code pour valider l'étape 4 :" } };
const PUZZLE_GATES = { 6: 'crossword', 7: 'caesar' };

function getStepFromURL(){ const url = new URL(window.location.href); const s=url.searchParams.get('step'); let n=parseInt(s||'1',10); if(isNaN(n)||n<1||n>TOTAL_STEPS) n=1; return n; }
function getProgress(){ const v = localStorage.getItem('auguste_progress'); return v?parseInt(v,10):0; }
function setProgress(s){ const c=getProgress(); if(s>c){ localStorage.setItem('auguste_progress', String(s)); playPaper(); } }
function resetProgress(){ localStorage.removeItem('auguste_progress'); window.location.href = window.location.pathname + '?step=1'; }

// ---- Sounds via WebAudio ----
let audioCtx;
function getCtx(){ if(!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)(); return audioCtx; }
function playTone(freq, time=0.15, type='sine', when=0){
  const ctx = getCtx();
  const o = ctx.createOscillator(); const g=ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.value = 0.0; g.gain.setValueAtTime(0.0, ctx.currentTime+when);
  g.gain.linearRampToValueAtTime(0.12, ctx.currentTime+when+0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+when+time);
  o.connect(g); g.connect(ctx.destination);
  o.start(ctx.currentTime+when); o.stop(ctx.currentTime+when+time+0.02);
}
function playZelda(){ // simple triumphant arpeggio
  [784, 988, 1318, 1568].forEach((f,i)=>playTone(f, 0.18, 'triangle', i*0.12));
}
function playWow(){ // descending sweep
  const ctx=getCtx(); const o=ctx.createOscillator(); const g=ctx.createGain();
  o.type='sawtooth'; o.frequency.setValueAtTime(1000, ctx.currentTime);
  o.frequency.exponentialRampToValueAtTime(220, ctx.currentTime+0.5);
  g.gain.setValueAtTime(0.12, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+0.5);
  o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime+0.5);
}
function playPaper(){ // short noise burst like paper
  const ctx=getCtx();
  const bufferSize = 2 * ctx.sampleRate;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random()*2-1) * (1 - i/bufferSize);
  const noise = ctx.createBufferSource(); noise.buffer = buffer;
  const filter = ctx.createBiquadFilter(); filter.type='lowpass'; filter.frequency.value = 800;
  const g=ctx.createGain(); g.gain.value=0.3;
  noise.connect(filter); filter.connect(g); g.connect(ctx.destination);
  noise.start(); noise.stop(ctx.currentTime+0.2);
}

// ---- QR scanner ----
async function startScanner(){
  const video = document.getElementById('video');
  const videoWrap = document.querySelector('.videoWrap');
  const scanBtn = document.getElementById('scanBtn');
  const stopBtn = document.getElementById('stopBtn');
  const detectorSupported = ('BarcodeDetector' in window);
  if(!detectorSupported){
    alert("Le scanner intégré n'est pas pris en charge par ce navigateur. Essayez 'Scanner depuis une photo', ou la caméra native.");
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
    window.location.href = url.href; // page destination applique le verrou strict
  }catch{ alert("Lien QR invalide."); }
}

// ---- Gates UI ----
function showCodeGate(step){
  const gate = CODE_GATES[step];
  if(!gate) return false;
  const wrap = document.querySelector('.codegate');
  const input = document.getElementById('codeInput');
  const btn = document.getElementById('codeBtn');
  const msg = document.getElementById('codeMsg');

  wrap.style.display = 'block';
  msg.textContent = gate.prompt;
  input.value = '';

  btn.onclick = () => {
    const val = (input.value || '').trim();
    if(val === gate.value){
      setProgress(step);
      wrap.style.display = 'none';
      const s = document.createElement('div');
      s.className='success'; s.textContent = '✅ Code correct. Étape validée !';
      document.querySelector('.card').appendChild(s);
      playZelda(); playWow();
    }else{
      alert('Mauvais code.');
    }
  };
  return true;
}

// Crossword step 6
const CROSS_ROWS = 5, CROSS_COLS = 5;
// Across solutions
const ACROSS = [
  { row:0, word:'BICHE', clue:'Cervidé des bois (5)' },
  { row:1, word:'CHAMP', clue:'Terre cultivée (5)' },
  { row:2, word:'JONCS', clue:'Tiges du lavoir / marais (5)' },
  { row:3, word:'BENNE', clue:'Chariot de ferme pour foin/bois (5)' },
  { row:4, word:'FLEUR', clue:'Partie de la plante qu’on offre (5)' },
]; // Column 2 (index 2) forms C-A-N-N-E => CANNE

function renderCrossword(container){
  container.style.display = 'block';
  const grid = document.createElement('div');
  grid.className='grid';
  const cells = [];
  for(let r=0;r<CROSS_ROWS;r++){
    cells[r]=[];
    for(let c=0;c<CROSS_COLS;c++){
      const div = document.createElement('div'); div.className='cell';
      const inp = document.createElement('input'); inp.maxLength=1; inp.autocapitalize='characters';
      inp.addEventListener('input', checkCrossword);
      div.appendChild(inp); grid.appendChild(div);
      cells[r][c]=inp;
    }
  }
  container.appendChild(grid);
  const clues = document.createElement('div'); clues.className='clues';
  const ul = document.createElement('ul');
  ACROSS.forEach((a,i)=>{
    const li=document.createElement('li'); li.textContent = (i+1)+'. '+a.clue; ul.appendChild(li);
  });
  clues.appendChild(ul);
  container.appendChild(clues);

  function checkCrossword(){
    // check each across word
    let allGood = true;
    ACROSS.forEach(a=>{
      for(let c=0;c<CROSS_COLS;c++){
        const ch = (cells[a.row][c].value||'').toUpperCase();
        const need = a.word[c];
        if(ch !== need){ allGood = false; }
      }
    });
    if(allGood){
      // highlight CANNE vertical (col index 2)
      for(let r=0;r<CROSS_ROWS;r++){
        cells[r][2].classList.add('highlight');
      }
      // mark step as validated, play sounds
      setProgress(6);
      playZelda(); playWow();
    }
  }
}

// Caesar step 7
function renderCaesar(container){
  container.style.display='block';
  const p = document.createElement('div');
  p.className='small';
  p.textContent = 'Texte chiffré : "JDPH RI VWRQH"';
  const input = document.createElement('input');
  input.placeholder = 'Écris ici ta réponse…';
  const btn = document.createElement('button'); btn.textContent='Valider';
  const wrap = document.createElement('div'); wrap.appendChild(p); wrap.appendChild(input); wrap.appendChild(btn);
  container.appendChild(wrap);
  btn.onclick = () => {
    const val = (input.value||'').toUpperCase().replaceAll(/\s+/g,'');
    const target = 'GAMEOFSTONES';
    if(val === target){
      setProgress(7);
      input.classList.add('highlight');
      playZelda();
    }else{
      alert('Pas tout à fait… Essaye encore (indice : décalage César).');
    }
  };
}

function render(){
  const step = getStepFromURL();
  const progress = getProgress();

  const stepEl = document.getElementById('step');
  const story = document.getElementById('story');
  const lock = document.getElementById('lock');

  stepEl.textContent = 'Étape ' + step + ' / ' + TOTAL_STEPS;

  // Strict unlock: must visit in order. Validation rules:
  // - Step 1 auto-validates on first visit.
  // - Steps with gates (code/crossword/caesar) only validate when solved.
  // - Other steps validate upon first visit as next expected step.
  const hasCodeGate = !!CODE_GATES[step];
  const hasPuzzleGate = !!PUZZLE_GATES[step];

  if(step === 1){
    lock.style.display='none';
    story.textContent = STEP_TEXTS[1];
    if(progress < 1){ setProgress(1); }
  }else{
    if(step <= progress){
      lock.style.display='none';
      story.textContent = STEP_TEXTS[step];
    }else if(step === progress + 1){
      lock.style.display='none';
      story.textContent = STEP_TEXTS[step];
      // Gated steps: do NOT auto-validate; show gate UI
      if(hasCodeGate){
        showCodeGate(step);
      }else if(hasPuzzleGate){
        // show puzzle UI
        if(PUZZLE_GATES[step] === 'crossword'){
          renderCrossword(document.querySelector('.crosswrap'));
        }else if(PUZZLE_GATES[step] === 'caesar'){
          renderCaesar(document.querySelector('.cipher'));
        }
      }else{
        // Non-gated: validate immediately on first arrival
        setProgress(step);
      }
    }else{
      lock.style.display='block';
      story.textContent = "";
      const need = progress + 1;
      lock.textContent = "Pas encore prêt… Scanne d’abord l’étape " + need + ".";
    }
  }

  document.getElementById('scanBtn').onclick = startScanner;
  document.getElementById('resetBtn').onclick = resetProgress;
  setupUploadScan();
}

window.addEventListener('DOMContentLoaded', render);

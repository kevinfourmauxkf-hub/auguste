
// v7.6.5: strict pre-req gates (5→gate4, 8→gate7, 9→gate8) + robust step-4 display
const TOTAL_STEPS = 12;
const EXPECTED_HOST = location.host;
const VERSION = '2025-08-13-v7.6.5';
const CODE_GATES = { 4: { value: '1024' } };

let SND_ITEM, SND_PAPER;
function loadSounds(){ SND_ITEM = new Audio('assets/item.wav'); SND_PAPER = new Audio('assets/paper.wav'); }
function playItem(){ try{ SND_ITEM && SND_ITEM.play(); }catch(e){} }
function playPaper(){ try{ SND_PAPER && SND_PAPER.play(); }catch(e){} }

function qs(s){ return document.querySelector(s); }
function getStepFromURL(){ const url = new URL(window.location.href); const s=url.searchParams.get('step'); let n=parseInt(s||'1',10); if(isNaN(n)||n<1||n>TOTAL_STEPS) n=1; return n; }
function getProgress(){ const v = localStorage.getItem('auguste_progress'); return v?parseInt(v,10):0; }
function setProgress(s){ const c=getProgress(); if(s>c) localStorage.setItem('auguste_progress', String(s)); }

function getGate(key){ return localStorage.getItem('auguste_'+key)==='ok'; }
function setGate(key){ localStorage.setItem('auguste_'+key, 'ok'); }

function resetProgress(){ localStorage.removeItem('auguste_progress'); ['gate4','gate7','gate8'].forEach(k=>localStorage.removeItem('auguste_'+k)); window.location.href = window.location.pathname + '?step=1&v='+VERSION; }

function requireGateForStep(step){
  // Step you are TRYING to open must satisfy certain pre-req gates
  if(step>=5 && !getGate('gate4')) return {ok:false, need:'4'};
  if(step>=8 && !getGate('gate7')) return {ok:false, need:'7'};
  if(step>=9 && !getGate('gate8')) return {ok:false, need:'8'};
  return {ok:true};
}

async function startScanner(){
  const step = getStepFromURL();
  const progress = getProgress();
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

    // Allow reopening past steps
    if(stepParam <= progress){
      window.location.href = url.pathname + '?step=' + stepParam + '&v=' + VERSION;
      return;
    }

    // Next step only, with pre-req gates
    if(stepParam === progress + 1){
      const gate = requireGateForStep(stepParam);
      if(!gate.ok){
        alert("Tu dois d’abord valider l’étape "+gate.need+" avant d’ouvrir celle‑ci.");
        return;
      }
      window.location.href = url.pathname + '?step=' + stepParam + '&v=' + VERSION;
      return;
    }

    // Too far ahead
    alert("Pas encore prêt… scanne d'abord l'étape "+(progress+1)+".");
  }catch{ alert("Lien QR invalide."); }
}

/* -------- Map (unchanged from 7.6.4) -------- */
function openMapFullscreen(){
  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  const overlay = document.createElement('div');
  overlay.className = 'fsOverlay solidBg';
  overlay.setAttribute('role','dialog'); overlay.setAttribute('aria-modal','true');
  overlay.style.zIndex = 99999;
  const inner = document.createElement('div'); inner.className = 'fsInner';
  const img = document.createElement('img'); img.src='assets/carte2025.png'; img.alt='Carte au trésor';
  const torch = document.createElement('div'); torch.className='torch';
  torch.style.setProperty('--x','50%'); torch.style.setProperty('--y','50%'); torch.style.setProperty('--r','110px');
  const close = document.createElement('button'); close.className='fsClose xonly'; close.textContent='✖'; close.setAttribute('aria-label','Fermer la carte');
  inner.appendChild(img); inner.appendChild(torch); inner.appendChild(close); overlay.appendChild(inner); document.body.appendChild(overlay);
  const move=(x,y)=>{
    const rect=inner.getBoundingClientRect();
    const rx=x-rect.left; const ry=y-rect.top;
    const r=Math.max(90, Math.min(170, Math.min(rect.width,rect.height)*0.12));
    torch.style.setProperty('--r',r+'px'); torch.style.setProperty('--x',rx+'px'); torch.style.setProperty('--y',ry+'px');
  };
  overlay.addEventListener('mousemove', e=>move(e.clientX,e.clientY));
  overlay.addEventListener('touchmove', e=>{ const t=e.touches[0]; move(t.clientX,t.clientY); e.preventDefault(); }, {passive:false});
  const closeAll=()=>{ document.body.removeChild(overlay); document.body.style.overflow = prevOverflow; };
  close.addEventListener('click', closeAll);
}
function showMapButton(){
  const wrap = qs('#mapWrap'); if(wrap){ wrap.style.display='none'; }
  const old = document.getElementById('mapOpenBtn'); if(old) old.remove();
  const btn = document.createElement('button'); btn.id='mapOpenBtn'; btn.textContent='📜 Ouvrir la carte (plein écran)'; btn.onclick=openMapFullscreen;
  qs('#story').after(btn);
}

/* -------- Caesar (8) -------- */
function setupCaesar(){
  const box = qs('#caesarBox');
  box.style.display='block';
  const input = qs('#caesarInput'); input.value='';
}
function validateCaesar(){
  const input = qs('#caesarInput');
  let v=(input.value||'').toUpperCase().replace(/\s+/g,' ').trim();
  if(v==='GAME OF STONES'){
    try{ localStorage.setItem('auguste_gate8','ok'); }catch(e){}
    try{ SND_ITEM && SND_ITEM.play(); }catch(e){}
    alert('✅ Bien joué. Étape validée !'); setProgress(8);
  } else {
    alert("Raté ! Si tu échoues encore, César te jettera aux lions.");
  }
}

/* -------- Crossword (7) -------- */
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
    try{ localStorage.setItem('auguste_gate7','ok'); }catch(e){}
    try{ SND_ITEM && SND_ITEM.play(); }catch(e){}
    alert("✅ Mot secret révélé : CANNE. Étape validée !");
    setProgress(7);
  };
  container.appendChild(btn);
}

/* -------- Texts (kept from 7.6.4) -------- */
const TEXTS = {
  1: "« Bien le bonjour, étranger curieux ! Si tu lis ces lignes, c’est que tu t’es aventuré sur mes terres… et que tu comptes bien fouiller dans mes affaires.\nSache que j’ai laissé derrière moi un trésor… ou peut‑être une malédiction… ou les deux.\nIl y a cent ans, j’avais déjà plus de secrets que de dents dans ma bouche — et encore, à l’époque, j’en avais déjà perdu la moitié.\nPour commencer, cherche la pierre qui porte le chiffre gravé de mon année la plus chère. Sous ce regard de granit, tu trouveras le début de ton voyage. »",
  2: "« Elle a nourri plus de ventres que le curé n’a donné de sermons ! Regarde‑la bien, mais sache que ce que tu cherches n’est pas pour tes yeux seuls… Cherche à voir autrement, comme la chouette qui chasse sous la lune. »",
  3: "« Ah, la vieille marmite… Combien de repas, combien de secrets aussi — la doyenne du hameau y perdit même son dentier. Si tu le retrouves, évite de goûter la soupe.\nÀ présent, cherche l’endroit où la vie commence… protégée par une coquille. »",
  4: "« Mes dames à plumes n’aiment pas les inconnus. Les couleurs te parlent, mais pas comme à l’arc‑en‑ciel : compte‑les, multiplie‑les… et ajoute mille.\nLe chiffre final ouvrira ta prochaine porte. »\n\n⤷ Entre le code pour révéler la suite.",
  5: "« Écoute‑moi bien : là où l’eau danse et chante encore, même par les plus grandes chaleurs, tu trouveras ce que tu cherches. Ici, les secrets flottent comme les feuilles à l’automne… Tire sur la corde, mais pas trop fort : j’ai déjà perdu deux seaux comme ça. »",
  6: "« Ah… tu as trouvé ma source secrète, oubliée de beaucoup. À présent, fais l’inverse : cherche un endroit sec… où les calories dorment à l’abri de la pluie. »",
  7: "« L’odeur du bois sec… presque aussi bonne que celle du pain chaud. Remplis la grille, et observe les lettres qui se tiennent bien droites : elles te révéleront un objet que j’ai toujours gardé près de moi. »",
  8: "« Voilà ma vieille canne… Elle m’a soutenu dans les champs comme dans les chemins de traverse. »\n\nTexte chiffré :\nJDPH RI VWRQH\n\n⤷ Écris ci‑dessous la phrase déchiffrée pour valider.",
  9: "« Assieds‑toi donc sur mon fauteuil minéral… moins confortable qu’un coussin, mais plus durable. Devant tu verras… et peut‑être les pieds si tu y sautes. Mais le secret n’est pas dessus. »",
  10:"« Tu veux monter haut ? Alors trouve la chaleur sans feu, celle qui fait lever sans braise… Cherche à sa droite un recoin non scellé. Derrière, ton destin t’attend. »",
  11:"« Ah… le vieux four. Combien de miches, combien de tartes… et combien de secrets a‑t‑il cuits en silence ? Voici ma carte. Touchez le bouton ci‑dessous pour l’explorer à la lampe, en plein écran. »",
  12:"« Félicitations, tu as trouvé mon précieux !\nÀ mon époque, on disait que j’avais plus de chance que de pain dans le four — ce qui n’est pas peu dire, car j’oubliais souvent d’allumer le feu. Si tu lis ceci, c’est que tu as suivi mes bêtises… et mes ruses.\nMarque ta victoire et ta fierté pour montrer aux autres ! Et surtout, participe : cache ailleurs le QR de l’emplacement du trésor qui était derrière la pierre… et remplace‑le par une énigme manuscrite de ton cru.\nN’oublie pas de laisser le crayon et le bloc‑notes dans le coffre pour que chacun y ajoute une nouvelle énigme. Le secret d’Auguste vivra tant qu’on continuera de le compliquer. »"
};

/* -------- Render -------- */
function render(){
  const step = getStepFromURL();
  const progress = getProgress();
  const story = qs('#story');
  const stepNum = qs('#stepNum');
  if(stepNum) stepNum.textContent = step;

  // reset UI
  document.querySelectorAll('.lock').forEach(n=>n.remove());
  const cg = qs('#codeGate'); if(cg) cg.style.display='none';
  const cw = qs('#crossword'); if(cw) cw.style.display='none';
  const cz = qs('#caesarBox'); if(cz) cz.style.display='none';
  const mapWrap = qs('#mapWrap'); if(mapWrap) mapWrap.style.display='none';

  story.textContent = TEXTS[step] || TEXTS[1];

  // Step-1 init
  if(step===1){
    if(progress<1) setProgress(1);
    return;
  }

  // Hard lock if pre-req missing for the currently opened step
  const gate = requireGateForStep(step);
  if(!gate.ok){
    const lock = document.createElement('div'); lock.className='lock';
    lock.textContent = "Tu dois d’abord valider l’étape "+gate.need+".";
    story.after(lock);
    const scanBtn = qs('#scanBtn'); if(scanBtn) scanBtn.disabled = true;
    // Show gate UI if it's step 4
    if(gate.need==='4' && step===4){
      cg.style.display='block';
      const input = qs('#codeInput'); if(input){ input.value=''; input.focus(); }
    }
    return;
  }

  // Normal lock for jumping too far
  if(step > progress + 1){
    const lock = document.createElement('div'); lock.className='lock';
    lock.textContent = "Pas encore prêt… scanne d’abord l’étape " + (progress+1) + ".";
    story.after(lock);
    const scanBtn = qs('#scanBtn'); if(scanBtn) scanBtn.disabled = true;
    return;
  }

  // Info if revisiting older step
  if(step < progress){
    const info = document.createElement('div'); info.className='lock';
    info.style.background='#eef6ea'; info.style.borderColor='#9cc59a'; info.style.color='#2f5530';
    info.textContent = "Étape déjà validée. Tu peux relire, ou scanner l’étape " + (progress+1) + " pour poursuivre.";
    story.after(info);
  }

  // Auto-validate non-gated when it's exactly the next step
  const gated = new Set([4,7,8]);
  if(step === progress + 1 && !gated.has(step)){
    setProgress(step);
  }

  // Show special UIs
  if(step===4){
    if(!getGate('gate4')){
      cg.style.display='block';
      const input = qs('#codeInput'); if(input){ input.value=''; input.focus(); }
    } else if(progress<4){ setProgress(4); }
  }
  if(step===7){ cw.style.display='block'; buildCrossword(cw); }
  if(step===8){ cz.style.display='block'; }
  if(step===11){ showMapButton(); }
}

function validateCode(){
  const input = qs('#codeInput'); let v=(input.value||'').trim().replace(/\D+/g,'');
  if(v===CODE_GATES[4].value){
    try{ localStorage.setItem('auguste_gate4','ok'); }catch(e){}
    setProgress(Math.max(getProgress(),4));
    try{ SND_ITEM && SND_ITEM.play(); }catch(e){}
    alert("✅ Étape 4 validée. Tu peux scanner la suivante.");
    const cg = qs('#codeGate'); if(cg) cg.style.display='none';
  } else {
    alert('Mauvais code.');
  }
}

window.addEventListener('DOMContentLoaded', render);

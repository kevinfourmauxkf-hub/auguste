
const TOTAL_STEPS = 12;
const EXPECTED_HOST = location.host;

// ONLY step 4 has a code gate here
const CODE_GATES = { 4: { type: 'number', value: '1024', prompt: "Entrez le code pour valider l'étape 4 :" } };

function getStepFromURL(){ const url = new URL(window.location.href); const s=url.searchParams.get('step'); let n=parseInt(s||'1',10); if(isNaN(n)||n<1||n>TOTAL_STEPS) n=1; return n; }
function getProgress(){ const v = localStorage.getItem('auguste_progress'); return v?parseInt(v,10):0; }
function setProgress(s){ const c=getProgress(); if(s>c) localStorage.setItem('auguste_progress', String(s)); }
function resetProgress(){ localStorage.removeItem('auguste_progress'); window.location.href = window.location.pathname + '?step=1'; }

function render(){
  const step = getStepFromURL();
  const progress = getProgress();

  const stepEl = document.getElementById('step');
  const story = document.getElementById('story');
  const lock = document.getElementById('lock');
  const post = document.getElementById('post');

  stepEl.textContent = 'Étape ' + step + ' / ' + TOTAL_STEPS;

  // default: nothing in post
  post.textContent = '';

  if(step === 1){
    lock.style.display='none';
    story.textContent = STEP_TEXTS_PRE[1] || '';
    if(progress < 1) setProgress(1);
    return;
  }

  if(step > progress + 1){
    lock.style.display='block';
    story.textContent='';
    lock.textContent="Pas encore prêt… Scanne d’abord l’étape " + (progress + 1) + ".";
    return;
  }

  // If revisiting an already validated step
  if(step <= progress){
    lock.style.display='none';
    // For step 4, when revisiting and already validated, show both pre + post
    if(step === 4){
      story.textContent = (STEP_TEXTS_PRE[4]||'');
      post.textContent = (STEP_TEXTS_POST[4]||'');
    }else{
      story.textContent = STEP_TEXTS_PRE[step] || '';
    }
    return;
  }

  // Here: step === progress + 1 (the next expected step)
  lock.style.display='none';
  story.textContent = STEP_TEXTS_PRE[step] || '';

  // Do not auto-validate step 4; show code UI and only on success set progress and reveal post text
  if(step === 4){
    const gate = CODE_GATES[4];
    const wrap = document.querySelector('.codegate');
    const input = document.getElementById('codeInput');
    const btn = document.getElementById('codeBtn');
    const msg = document.getElementById('codeMsg');
    wrap.style.display='block';
    msg.textContent = gate.prompt;
    input.value='';
    btn.onclick = () => {
      const val = (input.value||'').trim();
      if(val === gate.value){
        setProgress(4);
        wrap.style.display='none';
        post.textContent = STEP_TEXTS_POST[4] || '';
      }else{
        alert('Mauvais code.');
      }
    };
  }else{
    // non-gated steps auto-validate on first arrival
    setProgress(step);
  }
}

// dummy scanner buttons removed in this minimal fix; your full app has them.
// Keep structure so you can copy only app.js + index.html if needed.
window.addEventListener('DOMContentLoaded', render);

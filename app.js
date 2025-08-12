
const TOTAL_STEPS = 12;

function getStepFromURL(){
  const url = new URL(window.location.href);
  const s = url.searchParams.get('step');
  let n = parseInt(s||'1',10);
  if(isNaN(n) || n<1 || n>TOTAL_STEPS) n = 1;
  return n;
}

function getProgress(){
  const val = localStorage.getItem('auguste_progress');
  return val ? parseInt(val,10) : 0;
}

function setProgress(step){
  const current = getProgress();
  if(step > current) localStorage.setItem('auguste_progress', String(step));
}

function resetProgress(){
  localStorage.removeItem('auguste_progress');
  window.location.href = window.location.pathname + '?step=1';
}

function render(){
  const step = getStepFromURL();
  const progress = getProgress();

  const title = document.getElementById('title');
  const stepEl = document.getElementById('step');
  const story = document.getElementById('story');
  const lock = document.getElementById('lock');
  const nextBtn = document.getElementById('nextBtn');
  const homeBtn = document.getElementById('homeBtn');
  const resetBtn = document.getElementById('resetBtn');
  const seal = document.getElementById('seal');

  title.textContent = 'Le Dernier Secret d\u2019Auguste Le Du';
  stepEl.textContent = 'Étape ' + step + ' / ' + TOTAL_STEPS;
  story.textContent = window.STEP_TEXTS[step] || '...';

  // strict progression
  if(step === 1){
    lock.style.display = 'none';
    nextBtn.disabled = false;
  } else {
    if(progress >= (step-1)){
      lock.style.display = 'none';
      nextBtn.disabled = false;
    } else {
      lock.style.display = 'block';
      nextBtn.disabled = true;
    }
  }

  nextBtn.onclick = () => {
    setProgress(step);
    const next = step < TOTAL_STEPS ? step+1 : TOTAL_STEPS;
    window.location.href = window.location.pathname + '?step=' + next;
  };

  homeBtn.onclick = () => {
    window.location.href = window.location.pathname + '?step=1';
  };

  resetBtn.onclick = resetProgress;
}

window.addEventListener('DOMContentLoaded', render);

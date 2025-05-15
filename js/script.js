// js/script.js
(() => {
  'use strict';

  const app     = document.getElementById('app');
  const timerEl = document.getElementById('timer');
  const progEl  = document.getElementById('progress');
  const navBtns = {
    play: document.getElementById('nav-play'),
    var:  document.getElementById('nav-var'),
    kamp: document.getElementById('nav-kamp'),
    help: document.getElementById('nav-help')
  };
  const sounds = {
    correct: document.getElementById('audio-correct'),
    wrong:   document.getElementById('audio-wrong'),
    finish:  document.getElementById('audio-finish')
  };

  let puzzles, staticPages, validNames;
  let current     = 0;
  let startTime   = 0;
  let timerId     = null;
  let puzzleAudio = null;
  let failCount   = 0;
  let started     = false;

  const LS_STARTED    = 'varkamp_started';
  const LS_START_TIME = 'varkamp_startTime';
  const LS_CURRENT    = 'varkamp_current';

  // reset via ?reset=1
  if (location.search.includes('reset=1')) {
    localStorage.clear();
  }

  function isPrime(n) {
    if (n < 2) return false;
    for (let i=2; i*i<=n; i++) if(n % i===0) return false;
    return true;
  }
  function vibrate(p){ navigator.vibrate?.(p); }
  function play(type){
    const a = sounds[type];
    if(a){ a.currentTime=0; a.play().catch(()=>{}); }
    if(type==='correct') vibrate(200);
    if(type==='wrong')   vibrate([100,50,100]);
  }
  function showError(el,msg){ el.textContent = msg; }
  function clearAnim(card){ card.classList.remove('correct','shake'); }
  function updateTimer(){
    const d = Date.now()-startTime;
    const mm=String(Math.floor(d/60000)).padStart(2,'0'),
          ss=String(Math.floor((d%60000)/1000)).padStart(2,'0');
    timerEl.textContent=`${mm}:${ss}`;
  }

  async function init(){
    const res  = await fetch('assets/data/puzzles.json');
    const data = await res.json();
    puzzles     = data.puzzles;
    staticPages = data.staticPages;
    validNames  = data.validNames;

    Object.values(sounds).forEach(a=>a.load());
    const steg = puzzles.find(p=>p.type==='stego');
    if(steg?.img) new Image().src=steg.img;

    Object.entries(navBtns).forEach(([key,btn])=>
      btn.addEventListener('click',()=>activateTab(key))
    );

    if(localStorage.getItem(LS_STARTED)==='1'){
      started   = true;
      startTime = parseInt(localStorage.getItem(LS_START_TIME),10)||Date.now();
      current   = parseInt(localStorage.getItem(LS_CURRENT),10)||0;
      setNavEnabled(true);
      updateTimer();
      timerId = setInterval(updateTimer,500);
      renderPuzzle(current);
    } else {
      setNavEnabled(false);
      showIntro();
    }
  }

  function setNavEnabled(en){
    ['var','kamp','help'].forEach(k=>{
      navBtns[k].disabled = !en;
      navBtns[k].classList.toggle('disabled', !en);
    });
  }

  function activateTab(tab){
    Object.values(navBtns).forEach(b=>b.classList.remove('active'));
    navBtns[tab].classList.add('active');
    if(tab==='play'){
      if(!started) showIntro();
      else renderPuzzle(current);
    } else {
      showStatic(tab);
    }
  }

  function showIntro(){
    progEl.textContent='';
    app.innerHTML=`
      <div class="card start-card">
        <img src="assets/icons/icon-512.png" class="start-icon" alt="Logo">
        <p class="prompt">Välkommen till tävlingen!</p>
        <button id="startBtn" class="start-btn">Starta tävlingen</button>
      </div>`;
    document.getElementById('startBtn').addEventListener('click',()=>{
      started=true;
      localStorage.setItem(LS_STARTED,'1');
      startTime=Date.now();
      localStorage.setItem(LS_START_TIME,String(startTime));
      current=0;
      localStorage.setItem(LS_CURRENT,'0');
      setNavEnabled(true);
      updateTimer();
      timerId=setInterval(updateTimer,500);
      renderPuzzle(0);
    });
  }

  function showStatic(key){
    const d=staticPages[key];
    progEl.textContent=d.title;
    app.innerHTML=`
      <div class="card">
        <img src="${d.icon}" class="static-icon" alt="">
        <h2>${d.title}</h2>
        <p class="static-text">${d.text.replace(/\n/g,'<br>')}</p>
        ${d.thumb?`<img src="${d.thumb}" id="static-thumb" class="static-thumb">`:``}
      </div>`;
    if(key==='var'&&d.thumb) bindModal(d.full);
  }

  function bindModal(full){
    const thumb=document.getElementById('static-thumb'),
          modal=document.getElementById('img-modal'),
          img=document.getElementById('modal-img'),
          close=document.getElementById('modal-close');
    thumb.addEventListener('click',()=>{
      img.src=full; modal.classList.remove('hidden');
    });
    close.addEventListener('click',()=>{
      img.src=''; modal.classList.add('hidden');
    });
    modal.addEventListener('click',e=>{
      if(e.target===modal){ img.src=''; modal.classList.add('hidden'); }
    });
  }

  function renderPuzzle(i){
    const p=puzzles[i];
    if(!p) return renderFinal();
    current=i;
    localStorage.setItem(LS_CURRENT,String(i));
    failCount=0;
    progEl.textContent=`Gåta ${i+1} av ${puzzles.length}`;
    app.innerHTML='';
    puzzleAudio?.pause();

    const card=document.createElement('div'); card.className='card';
    const prm=document.createElement('div'); prm.className='prompt';
    prm.textContent=p.prompt;
    card.append(prm);

    let inputEl,msgEl,hintEl;
    switch(p.type){
      case 'name':
      case 'text':
        inputEl=document.createElement('input');
        inputEl.placeholder=p.hint;
        card.append(inputEl);
        break;
      case 'number':
      case 'count':
        if(p.img){
          const im=document.createElement('img');
          im.src=p.img; im.alt='';
          im.style.width='100%';
          card.append(im);
        }
        inputEl=document.createElement('input');
        inputEl.type='number';
        inputEl.placeholder=p.hint;
        card.append(inputEl);
        break;
      case 'word':
        inputEl=document.createElement('input');
        inputEl.placeholder=p.hint;
        card.append(inputEl);
        break;
      case 'stego':
        puzzleAudio=null;
        const si=document.createElement('img');
        si.src=p.img; si.alt='Stegobild';
        si.style.filter='brightness(0)';
        si.addEventListener('click',()=>si.style.filter='');
        card.append(si);
        inputEl=document.createElement('input');
        inputEl.placeholder=p.hint;
        card.append(inputEl);
        break;
      case 'audio':
        puzzleAudio=new Audio(p.src); puzzleAudio.preload='auto';
        const ba=document.createElement('button');
        ba.textContent='Spela baklänges';
        ba.addEventListener('click',()=>{
          puzzleAudio.currentTime=0;
          puzzleAudio.play().catch(()=>{});
        });
        card.append(ba);
        inputEl=document.createElement('input');
        inputEl.placeholder=p.hint;
        card.append(inputEl);
        break;
      case 'prime':
        inputEl=document.createElement('input');
        inputEl.placeholder=p.hint;
        card.append(inputEl);
        break;
      case 'morse':
        puzzleAudio=new Audio(p.src); puzzleAudio.preload='auto';
        const bm=document.createElement('button');
        bm.textContent='Spela morse';
        bm.addEventListener('click',()=>{
          puzzleAudio.currentTime=0;
          puzzleAudio.play().catch(()=>{});
        });
        card.append(bm);
        inputEl=document.createElement('input');
        inputEl.placeholder=p.hint;
        card.append(inputEl);
        break;
      case 'magic':
        const grid=document.createElement('div');
        grid.className='magic-grid';
        for(let r=0;r<p.size;r++){
          for(let c=0;c<p.size;c++){
            const v=p.grid[r][c];
            const cell=document.createElement('div');
            if(v===""){
              cell.className='magic-cell';
              const inp=document.createElement('input');
              inp.type='number'; inp.placeholder='';
              cell.append(inp);
            } else {
              cell.className='magic-fixed';
              cell.textContent=v;
            }
            grid.append(cell);
          }
        }
        card.append(grid);
        inputEl=grid;
        break;
    }
    msgEl=document.createElement('div'); msgEl.className='error-msg';
    hintEl=document.createElement('div'); hintEl.className='hint-msg';
    if(p.hint) hintEl.textContent=`Tips: ${p.hint}`;
    card.append(msgEl,hintEl);

    const btn=document.createElement('button');
    btn.textContent='Skicka';
    btn.addEventListener('click',()=>checkAnswer(p,inputEl,msgEl,hintEl,card));
    card.append(btn);

    app.append(card);
    inputEl?.focus();
  }

  function checkAnswer(p,inputEl,msgEl,hintEl,card){
    clearAnim(card);
    if(p.type==='prime'){
      const mins=Math.floor((Date.now()-startTime)/60000);
      if(!isPrime(mins)){
        showError(msgEl,'⏳ Vänta till primtal-minut!'); return;
      }
    }
    const ans=inputEl?.value?.trim().toLowerCase()||'';
    let ok=false;
    switch(p.type){
      case 'name':
        ok=validNames.includes(ans);
        break;
      case 'text':
      case 'number':
      case 'count':
        ok=ans===String(p.answer).toLowerCase();
        break;
      case 'word':
        ok=ans.replace(/\s+/g,'')===String(p.answer).toLowerCase();
        break;
      case 'stego':
      case 'audio':
        ok=ans===String(p.answer);
        break;
      case 'prime':
        ok=true;
        break;
      case 'morse':
        const clean=ans.replace(/\s+/g,'').toLowerCase();
        ok=Array.isArray(p.answers)&&p.answers.some(a=>
          a.replace(/\s+/g,'').toLowerCase()===clean
        );
        break;
      case 'magic':
        const inputs=Array.from(inputEl.querySelectorAll('input'));
        const vals=inputs.map(i=>parseInt(i.value,10));
        if(vals.some(isNaN)){
          showError(msgEl,'Fyll alla rutor!'); return;
        }
        const sz=p.size, tgt=p.target, M=[], diag1,diag2;
        let idx=0;
        for(let r=0;r<sz;r++){
          M[r]=[];
          for(let c=0;c<sz;c++){
            M[r][c]=p.grid[r][c]===""?vals[idx++]:p.grid[r][c];
          }
        }
        const rowsOk=M.every(row=>row.reduce((a,b)=>a+b,0)===tgt);
        const colsOk=Array.from({length:sz}).every(c=>
          M.reduce((s,row)=>s+row[c],0)===tgt
        );
        diag1=M.reduce((s,row,r)=>s+row[r],0)===tgt;
        diag2=M.reduce((s,row,r)=>s+row[sz-1-r],0)===tgt;
        ok=rowsOk&&colsOk&&diag1&&diag2;
        break;
    }
    if(ok){
      play(current+1<puzzles.length?'correct':'finish');
      card.classList.add('correct');
      setTimeout(()=>renderPuzzle(current+1),500);
    } else {
      play('wrong');
      card.classList.add('shake');
      showError(msgEl,'❌ Fel – försök igen!');
      failCount++;
      if(failCount>=2&&p.hint){
        hintEl.textContent=`Tips: ${p.hint}`;
      }
    }
  }

  function renderFinal(){
    clearInterval(timerId);
    app.innerHTML=`
      <div class="card" id="final-form">
        <fieldset>
          <legend>Dokumentera trädet</legend>
          <label>1. Ta en gruppbild med trädet</label>
          <input type="file" id="photo" accept="image/*">
          <img id="preview" style="display:none;">
          <label>2. Trädets latinska namn</label>
          <input type="text" id="latin" placeholder="Ex: Quercus robur">
          <label>3. Ditt lagnamn</label>
          <input type="text" id="team" placeholder="Ex: Tigerlaget">
          <button id="submit" disabled>Skicka</button>
        </fieldset>
      </div>
      <div class="card summary" id="summary">
        <h2>Sammanfattning</h2>
        <div class="field"><strong>Latinskt namn:</strong> <span id="out-latin"></span></div>
        <div class="field"><strong>Lagnamn:</strong> <span id="out-team"></span></div>
        <div class="field"><strong>Tid:</strong> <span id="out-time"></span></div>
        <div class="field"><strong>Bild:</strong><br><img id="out-image"></div>
        <p>📸 Ta en skärmdump och skicka till domaren.</p>
      </div>`;
    const photo=document.getElementById('photo'),
          latinI=document.getElementById('latin'),
          teamI=document.getElementById('team'),
          submit=document.getElementById('submit'),
          preview=document.getElementById('preview'),
          outLat=document.getElementById('out-latin'),
          outTeam=document.getElementById('out-team'),
          outTime=document.getElementById('out-time'),
          outImg=document.getElementById('out-image');
    function validate(){
      submit.disabled=!(photo.files.length===1&&latinI.value.trim()!==''&&teamI.value.trim()!=='');
    }
    [photo,latinI,teamI].forEach(el=>el.addEventListener('input',validate));
    photo.addEventListener('change',()=>{
      validate();
      const f=photo.files[0];
      if(f&&f.size>5*1024*1024){
        alert('Max 5 MB.'); photo.value=''; preview.style.display='none'; validate(); return;
      }
      const fr=new FileReader();
      fr.onload=e=>{
        preview.src=e.target.result; preview.style.display='block';
      };
      fr.readAsDataURL(f);
    });
    submit.addEventListener('click',()=>{
      const d=Date.now()-startTime;
      const mm=String(Math.floor(d/60000)).padStart(2,'0'),
            ss=String(Math.floor((d%60000)/1000)).padStart(2,'0');
      outTime.textContent=`${mm}:${ss}`;
      outLat.textContent=latinI.value.trim();
      outTeam.textContent=teamI.value.trim();
      const fr=new FileReader();
      fr.onload=e=>{
        outImg.src=e.target.result;
        document.getElementById('final-form').style.display='none';
        document.getElementById('summary').classList.add('visible');
        play('finish');
      };
      fr.readAsDataURL(photo.files[0]);
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();

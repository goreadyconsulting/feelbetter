(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const $ = id => document.getElementById(id);
  const hud=$('hud'), controls=$('controls'), startScreen=$('startScreen'), endScreen=$('endScreen');
  const scoreEl=$('score'), moodBar=$('moodBar'), moodText=$('moodText'), livesEl=$('lives'), toast=$('toast'), streakEl=$('streak');
  const leftBtn=$('left'), rightBtn=$('right'), boostBtn=$('boost');

  let W=0,H=0,dpr=1,last=0,running=false,score=0,mood=12,lives=3,combo=0;
  let best=Number(localStorage.getItem('feelbetter-best')||0);
  let items=[],particles=[],snow=[],spawnTimer=0,difficulty=1,shake=0,boostCharge=0,boostTime=0;
  let dragging=false,soundOn=true,audioCtx=null,toastTimer=null;
  const player={x:0,y:0,w:70,h:82,vx:0,targetX:0,blink:0,tilt:0};

  const good=[
    {e:'🐟',pts:12,mood:8,msg:'Professional fish acquired.'},
    {e:'☕',pts:15,mood:10,msg:'Cocoa deployed. Morale suspiciously improved.'},
    {e:'🫂',pts:18,mood:12,msg:'Emergency hug received. Very official.'},
    {e:'👑',pts:25,mood:16,msg:'Tiny crown. Huge authority.',rare:true},
    {e:'🍰',pts:16,mood:11,msg:'Cake protocol activated.'},
    {e:'✨',pts:10,mood:7,msg:'Sparkle obtained without permit.'}
  ];
  const bad=[
    {e:'📧',msg:'An email happened. Deeply unnecessary.'},
    {e:'⏰',msg:'Alarm clock rejected on philosophical grounds.'},
    {e:'🧦',msg:'Soggy sock. Absolutely not.'},
    {e:'MON',msg:'Monday detected. Disrespectfully declined.',text:true},
    {e:'💻',msg:'This meeting could have been a fish.'}
  ];
  const quips=[
    'Penguin morale department is now fully staffed.',
    'Waddle quality: unnecessarily excellent.',
    'This is clinically not advice. It is a penguin.',
    'Tiny feet. Enormous operational impact.',
    'No thoughts. Only fish.',
    'The vibes have filed for reconsideration.'
  ];

  function rand(min,max){ return Math.random()*(max-min)+min; }
  function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }

  function resize(){
    dpr=Math.min(window.devicePixelRatio||1,2);
    W=window.innerWidth; H=window.innerHeight;
    canvas.width=Math.round(W*dpr); canvas.height=Math.round(H*dpr);
    canvas.style.width=W+'px'; canvas.style.height=H+'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
    player.y=H-Math.max(118,H*.16);
    if(!running){ player.x=W/2; player.targetX=W/2; }
    snow=Array.from({length:Math.max(28,Math.floor(W/11))},()=>({
      x:Math.random()*W,y:Math.random()*H,r:Math.random()*2.8+.5,s:Math.random()*12+7
    }));
    draw();
  }
  window.addEventListener('resize',resize,{passive:true});
  resize();

  function vibrate(pattern){ if(navigator.vibrate) navigator.vibrate(pattern); }
  function initAudio(){
    if(!audioCtx){ try{ audioCtx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} }
    if(audioCtx&&audioCtx.state==='suspended') audioCtx.resume();
  }
  function beep(freq,dur,type,vol){
    if(!soundOn) return;
    initAudio(); if(!audioCtx) return;
    const o=audioCtx.createOscillator(),g=audioCtx.createGain();
    o.type=type||'sine'; o.frequency.value=freq||440; g.gain.value=vol||.035;
    o.connect(g); g.connect(audioCtx.destination); o.start();
    g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+(dur||.08));
    o.stop(audioCtx.currentTime+(dur||.08));
  }
  function goodSound(){ beep(520,.09,'sine',.04); setTimeout(()=>beep(720,.08,'sine',.025),55); }
  function badSound(){ beep(150,.13,'sawtooth',.03); }

  function showToast(msg){
    clearTimeout(toastTimer); toast.textContent=msg; toast.classList.add('show');
    toastTimer=setTimeout(()=>toast.classList.remove('show'),1150);
  }

  function updateHUD(){
    scoreEl.textContent=score;
    mood=Math.round(clamp(mood,0,100));
    moodBar.style.width=mood+'%'; moodText.textContent=mood+'%'; livesEl.textContent=lives;
    if(combo>=3){
      streakEl.textContent='🔥 x'+Math.min(combo,9)+' COMBO';
      streakEl.classList.add('show');
    }else streakEl.classList.remove('show');
    boostBtn.disabled=boostCharge<100||boostTime>0;
    boostBtn.textContent=boostTime>0?'⚡!':'⚡';
  }

  function startGame(){
    initAudio(); running=true; score=0; mood=12; lives=3; combo=0;
    items=[]; particles=[]; spawnTimer=0; difficulty=1; shake=0; boostCharge=0; boostTime=0;
    player.x=W/2; player.targetX=W/2; player.vx=0; player.blink=0;
    startScreen.classList.add('hidden'); endScreen.classList.add('hidden');
    hud.classList.add('show'); controls.classList.add('show');
    updateHUD(); showToast('Penguin deployed. Please remain unserious.');
    last=performance.now(); requestAnimationFrame(loop);
  }

  function endGame(win){
    if(!running) return;
    running=false; hud.classList.remove('show'); controls.classList.remove('show'); streakEl.classList.remove('show');
    if(score>best){ best=score; localStorage.setItem('feelbetter-best',String(best)); }
    $('finalScore').textContent=score; $('finalMood').textContent=mood+'%'; $('finalBest').textContent=best;
    let title,line,emoji,badge;
    if(win||mood>=100){
      title='MOOD: RESCUED.';
      line='The penguin has submitted a successful incident report. The vibes are legally required to improve.';
      emoji='🐧✨'; badge='MISSION SOMEHOW SUCCESSFUL';
    }else if(score>=180){
      title='A VERY RESPECTABLE WADDLE.';
      line='Things may still be weird, but they are now weird with significantly more fish.';
      emoji='🐧🏆'; badge='PENGUIN PERFORMANCE REVIEW';
    }else{
      title='THE PENGUIN DID HIS BEST.';
      line='Objectively, the situation is at least a little less ridiculous now. Further penguin deployment is authorized.';
      emoji='🐧💙'; badge='TINY MISSION REPORT';
    }
    $('endTitle').textContent=title; $('endLine').textContent=line; $('endEmoji').textContent=emoji; $('endBadge').textContent=badge;
    $('bestStart').textContent=best; endScreen.classList.remove('hidden');
  }

  function spawn(){
    const isGood=Math.random()>.31;
    let data;
    if(isGood){
      const pool=good.filter(g=>!g.rare||Math.random()<.28);
      data=Object.assign({},pool[Math.floor(Math.random()*pool.length)],{good:true});
    }else{
      data=Object.assign({},bad[Math.floor(Math.random()*bad.length)],{good:false});
    }
    const size=data.text?48:rand(34,44);
    items.push(Object.assign(data,{
      x:rand(30,W-30),y:-55,size:size,vy:rand(150,205)*difficulty,rot:rand(-.3,.3),vr:rand(-1.2,1.2)
    }));
  }

  function burst(x,y,goodHit){
    const chars=goodHit?['✨','·','✦']:['!','×','•'];
    for(let i=0;i<10;i++){
      particles.push({
        x:x,y:y,vx:rand(-110,110),vy:rand(-180,-45),life:rand(.45,.85),s:rand(12,22),
        ch:chars[Math.floor(Math.random()*chars.length)],good:goodHit
      });
    }
  }

  function hit(item){
    if(item.good){
      combo++;
      const mult=1+Math.min(combo-1,8)*.08;
      score+=Math.round(item.pts*mult); mood+=item.mood;
      boostCharge=Math.min(100,boostCharge+14+combo*1.5);
      goodSound(); vibrate(14); burst(item.x,item.y,true);
      if(combo===5||combo===9) showToast(quips[Math.floor(Math.random()*quips.length)]);
      else if(Math.random()<.48) showToast(item.msg);
      if(mood>=100){ mood=100; updateHUD(); setTimeout(()=>endGame(true),250); }
    }else{
      if(boostTime>0){
        score+=4; burst(item.x,item.y,true); beep(830,.06,'square',.02);
        showToast('Boost said: absolutely not.');
      }else{
        lives--; combo=0; mood=Math.max(0,mood-9); shake=12;
        badSound(); vibrate([30,35,30]); burst(item.x,item.y,false); showToast(item.msg);
        if(lives<=0) setTimeout(()=>endGame(false),120);
      }
    }
    updateHUD();
  }

  function activateBoost(){
    if(!running||boostCharge<100||boostTime>0) return;
    boostCharge=0; boostTime=4.5;
    showToast('MAXIMUM WADDLE AUTHORITY ⚡');
    beep(440,.1,'square',.025); setTimeout(()=>beep(660,.1,'square',.025),70);
    updateHUD();
  }

  function update(dt){
    difficulty=Math.min(1.72,difficulty+dt*.012);
    spawnTimer-=dt;
    if(spawnTimer<=0){ spawn(); spawnTimer=rand(.42,.74)/difficulty; }
    if(boostTime>0) boostTime=Math.max(0,boostTime-dt);

    player.blink-=dt;
    if(player.blink<-rand(1.4,3.2)) player.blink=.12;

    const ease=boostTime>0?14:10;
    player.vx+=(player.targetX-player.x)*ease*dt;
    player.vx*=Math.pow(.0007,dt);
    player.x+=player.vx*dt;
    player.x=clamp(player.x,42,W-42);
    player.tilt=clamp(player.vx/600,-.18,.18);

    for(const s of snow){ s.y+=s.s*dt; if(s.y>H+4){s.y=-5;s.x=Math.random()*W;} }

    for(let i=items.length-1;i>=0;i--){
      const o=items[i];
      o.y+=o.vy*dt; o.rot+=o.vr*dt;
      const dx=o.x-player.x,dy=o.y-player.y;
      if(Math.abs(dx)<o.size*.5+player.w*.34 && Math.abs(dy)<o.size*.5+player.h*.38){
        items.splice(i,1); hit(o); continue;
      }
      if(o.y>H+70){
        if(o.good){ combo=0; updateHUD(); }
        items.splice(i,1);
      }
    }

    for(let i=particles.length-1;i>=0;i--){
      const p=particles[i];
      p.life-=dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.vy+=260*dt;
      if(p.life<=0) particles.splice(i,1);
    }
    shake*=Math.pow(.012,dt);
  }

  function roundedRect(x,y,w,h,radius){
    ctx.beginPath();
    if(ctx.roundRect) ctx.roundRect(x,y,w,h,radius);
    else{
      const rr=Math.min(radius,w/2,h/2);
      ctx.moveTo(x+rr,y); ctx.arcTo(x+w,y,x+w,y+h,rr); ctx.arcTo(x+w,y+h,x,y+h,rr);
      ctx.arcTo(x,y+h,x,y,rr); ctx.arcTo(x,y,x+w,y,rr); ctx.closePath();
    }
  }

  function drawBackground(){
    ctx.clearRect(0,0,W,H);
    const g=ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,'#9fdcff'); g.addColorStop(.68,'#e6f7ff'); g.addColorStop(1,'#f9fdff');
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);

    ctx.globalAlpha=.45; ctx.fillStyle='#fff';
    for(const s of snow){ ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fill(); }
    ctx.globalAlpha=1;

    const groundY=H-82;
    ctx.fillStyle='rgba(255,255,255,.84)';
    ctx.beginPath(); ctx.moveTo(0,groundY);
    for(let x=0;x<=W+30;x+=30) ctx.quadraticCurveTo(x+15,groundY-2,x+30,groundY+1);
    ctx.lineTo(W,H); ctx.lineTo(0,H); ctx.closePath(); ctx.fill();

    ctx.fillStyle='rgba(78,157,196,.08)';
    for(let i=0;i<7;i++){
      ctx.beginPath(); ctx.ellipse((i*.19*W+40)%W,H-(35+i*3),28+(i%3)*7,4+(i%2)*2,0,0,Math.PI*2); ctx.fill();
    }
  }

  function drawPlayer(){
    ctx.save(); ctx.translate(player.x,player.y); ctx.rotate(player.tilt);

    if(boostTime>0){
      ctx.globalAlpha=.28+.16*Math.sin(performance.now()/70);
      ctx.fillStyle='#ffe36e'; ctx.beginPath(); ctx.ellipse(0,5,50,58,0,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
    }

    ctx.fillStyle='rgba(30,62,87,.12)'; ctx.beginPath(); ctx.ellipse(0,42,36,10,0,0,Math.PI*2); ctx.fill();

    ctx.fillStyle='#17253a'; ctx.beginPath(); ctx.ellipse(0,0,33,42,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.ellipse(2,10,23,29,0,0,Math.PI*2); ctx.fill();

    ctx.fillStyle='#17253a';
    ctx.save(); ctx.translate(-29,1); ctx.rotate(-.55+Math.sin(performance.now()/110)*.08); roundedRect(-7,-3,15,34,9); ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(30,1); ctx.rotate(.55-Math.sin(performance.now()/110)*.08); roundedRect(-8,-3,15,34,9); ctx.fill(); ctx.restore();

    ctx.fillStyle='#0d1725';
    const eyeH=player.blink>0?1.5:4.5;
    ctx.beginPath(); ctx.ellipse(-10,-10,3.2,eyeH,0,0,Math.PI*2); ctx.ellipse(10,-10,3.2,eyeH,0,0,Math.PI*2); ctx.fill();

    ctx.fillStyle='#ffad42';
    ctx.beginPath(); ctx.moveTo(-7,-2); ctx.lineTo(12,2); ctx.lineTo(-7,7); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-15,39,17,7,-.12,0,Math.PI*2); ctx.ellipse(16,39,17,7,.12,0,Math.PI*2); ctx.fill();

    if(boostTime>0){ ctx.font='700 18px system-ui'; ctx.textAlign='center'; ctx.fillText('⚡',0,-49); }
    ctx.restore();
  }

  function drawItems(){
    ctx.textAlign='center'; ctx.textBaseline='middle';
    for(const o of items){
      ctx.save(); ctx.translate(o.x,o.y); ctx.rotate(o.rot);
      if(o.text){
        ctx.font='1000 13px system-ui'; ctx.fillStyle='#ff6674'; roundedRect(-23,-18,46,36,11); ctx.fill();
        ctx.fillStyle='white'; ctx.fillText('MON',0,1);
      }else{
        ctx.font=o.size+'px "Apple Color Emoji","Segoe UI Emoji",sans-serif';
        ctx.fillText(o.e,0,0);
      }
      ctx.restore();
    }

    for(const p of particles){
      ctx.save(); ctx.globalAlpha=clamp(p.life/.7,0,1);
      ctx.font='900 '+p.s+'px system-ui'; ctx.textAlign='center';
      ctx.fillStyle=p.good?'#ffb32c':'#ff6574'; ctx.fillText(p.ch,p.x,p.y); ctx.restore();
    }
  }

  function draw(){
    ctx.save();
    if(shake>1) ctx.translate(rand(-shake,shake),rand(-shake,shake));
    drawBackground(); drawItems(); drawPlayer(); ctx.restore();

    if(running){
      ctx.save(); ctx.globalAlpha=.72; ctx.fillStyle='#49657d'; ctx.font='800 10px system-ui'; ctx.textAlign='center';
      ctx.fillText(boostCharge>=100?'BOOST READY — TAP ⚡':'CATCH NICE THINGS · AVOID NONSENSE',W/2,H-91);
      ctx.restore();
    }
  }

  function loop(now){
    if(!running) return;
    const dt=Math.min(.032,(now-last)/1000||.016);
    last=now; update(dt); draw();
    if(running) requestAnimationFrame(loop);
  }

  function setTarget(clientX){ player.targetX=clamp(clientX,42,W-42); }
  canvas.addEventListener('pointerdown',e=>{
    if(!running) return; dragging=true; setTarget(e.clientX);
    if(canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove',e=>{ if(dragging&&running) setTarget(e.clientX); });
  canvas.addEventListener('pointerup',()=>dragging=false);
  canvas.addEventListener('pointercancel',()=>dragging=false);

  function nudge(dir){
    if(!running) return;
    player.targetX=clamp(player.targetX+dir*Math.min(90,W*.22),42,W-42); vibrate(8);
  }
  leftBtn.addEventListener('pointerdown',e=>{e.preventDefault();nudge(-1);});
  rightBtn.addEventListener('pointerdown',e=>{e.preventDefault();nudge(1);});
  boostBtn.addEventListener('click',activateBoost);

  window.addEventListener('keydown',e=>{
    if(e.key==='ArrowLeft') nudge(-1);
    if(e.key==='ArrowRight') nudge(1);
    if(e.key===' '){ e.preventDefault(); activateBoost(); }
  });

  $('startBtn').addEventListener('click',startGame);
  $('againBtn').addEventListener('click',startGame);
  $('soundBtn').addEventListener('click',()=>{
    soundOn=!soundOn; $('soundBtn').textContent=soundOn?'🔊':'🔇';
    if(soundOn) beep(520,.06);
  });
  $('shareBtn').addEventListener('click',async()=>{
    const text='I scored '+score+' in Feel Better: Penguin Emergency. A penguin was involved. Things got complicated. 🐧';
    try{
      if(navigator.share) await navigator.share({title:'Feel Better: Penguin Emergency',text:text,url:location.href});
      else{
        await navigator.clipboard.writeText(text+' '+location.href);
        showToast('Penguin propaganda copied.');
      }
    }catch(e){}
  });

  $('bestStart').textContent=best;
})();
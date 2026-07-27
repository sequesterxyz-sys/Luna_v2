
const DEFAULT_SYSTEM_PROMPT =
`You are Luna, a thoughtful personal AI assistant with persistent user-approved memory.
Answer naturally, clearly, and honestly. State important assumptions when useful, consider
reasonable alternatives for difficult questions, and mention uncertainty rather than guessing.
Do not reveal hidden chain-of-thought or private internal reasoning. Give concise explanations
or short summaries of the factors behind an answer when that would help the user.`;

let state = loadState();

function defaultState(){
  return {
    assistantName: "Luna",
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    researchOn: false,
    facts: [],
    corrections: [],
    reflections: [],
    messages: [], // {role, content, thinking, research}
    sessionId: crypto.randomUUID()
  };
}

function loadState(){
  try{
    const raw = localStorage.getItem('marginalia_state');
    if(!raw) return defaultState();
    return Object.assign(defaultState(), JSON.parse(raw));
  }catch(e){ return defaultState(); }
}
function saveState(){
  localStorage.setItem('marginalia_state', JSON.stringify(state));
}

function switchView(name){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('view-'+name).classList.add('active');
  document.querySelector(`.tab[data-view="${name}"]`).classList.add('active');
  document.getElementById('chatToolbar').style.display = name==='chat' ? 'flex' : 'none';
  document.querySelector('footer').style.display = name==='chat' ? 'flex' : 'none';
  if(name==='identity') renderIdentity();
}

function renderIdentity(){
  document.getElementById('nameInput').value = state.assistantName;
  document.getElementById('systemPromptView').value = state.systemPrompt;
  const factsList = document.getElementById('factsList');
  factsList.innerHTML = state.facts.length ? '' : '<div class="hint">Nothing yet.</div>';
  state.facts.slice().reverse().forEach((f,i)=>{
    const div = document.createElement('div');
    div.className='fact';
    div.innerHTML = `${escapeHtml(f.text)}<div class="meta">${new Date(f.ts).toLocaleDateString()}</div>`;
    factsList.appendChild(div);
  });
  const refList = document.getElementById('reflectionsList');
  refList.innerHTML = state.reflections.length ? '' : '<div class="hint">It will write these after conversations.</div>';
  state.reflections.slice().reverse().forEach(r=>{
    const div = document.createElement('div');
    div.className='reflection';
    div.textContent = '"' + r.text + '"';
    refList.appendChild(div);
  });
}

function renameAssistant(){
  state.assistantName = document.getElementById('nameInput').value || 'Marginalia';
  document.getElementById('assistantName').innerHTML = state.assistantName.toLowerCase()+'<span class="dot">.</span>';
  saveState();
}

function addFact(){
  const el = document.getElementById('newFact');
  if(!el.value.trim()) return;
  state.facts.push({text: el.value.trim(), ts: Date.now()});
  el.value='';
  saveState();
  renderIdentity();
}

function toggleResearch(){
  state.researchOn = !state.researchOn;
  document.getElementById('researchChip').textContent = 'Research grounding: ' + (state.researchOn?'on':'off');
  document.getElementById('researchChip').classList.toggle('on', state.researchOn);
  saveState();
}

function exportData(){
  const blob = new Blob([JSON.stringify(state,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'marginalia-export.json'; a.click();
}

function resetAll(){
  if(!confirm('This clears all memory, identity, and chat history on this device. Continue?')) return;
  state = defaultState();
  saveState();
  document.getElementById('messages').innerHTML='';
  renderIdentity();
  alert('Reset.');
}

function escapeHtml(s){
  const d = document.createElement('div'); d.innerText = s; return d.innerHTML;
}

// ---- Chat rendering ----
function appendMessage(role, text, thinking, researchText){
  const container = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = 'msg ' + role;
  let html = `<div class="who">${role==='user' ? 'you' : state.assistantName.toLowerCase()}</div>`;
  html += `<div class="body">${escapeHtml(text)}</div>`;
  if(researchText){
    html += `<div class="research-block">${escapeHtml(researchText)}</div>`;
  }
  if(thinking){
    html += `<div class="marginalia collapsed" onclick="this.classList.toggle('collapsed')">
      <span class="marginalia-label">internal notes</span>${escapeHtml(thinking)}
    </div>`;
  }
  div.innerHTML = html;
  container.appendChild(div);
  document.querySelector('main').scrollTop = document.querySelector('main').scrollHeight;
}

function renderAllMessages(){
  document.getElementById('messages').innerHTML='';
  state.messages.forEach(m=>appendMessage(m.role, m.content, m.thinking, m.research));
}

// ---- Research grounding (Semantic Scholar, public, no key) ----
async function fetchResearch(query){
  try{
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=3&fields=title,authors,year,citationCount,abstract`;
    const resp = await fetch(url);
    const data = await resp.json();
    if(!data.data || !data.data.length) return null;
    let out = 'Relevant peer-reviewed research:\n';
    data.data.forEach(p=>{
      const authors = (p.authors||[]).map(a=>a.name).join(', ');
      out += `• ${p.title} — ${authors} (${p.year||'n.d.'}, ${p.citationCount||0} citations)\n`;
    });
    return out;
  }catch(e){ return null; }
}

// ---- Core send loop ----
async function send(){
  const input = document.getElementById('input');
  const text = input.value.trim();
  if(!text) return;

  input.value='';
  appendMessage('user', text);
  state.messages.push({role:'user', content:text});
  saveState();

  document.getElementById('sendBtn').disabled = true;

  let researchBlock = '';
  if(state.researchOn){
    researchBlock = await fetchResearch(text) || '';
  }

  const memoryBlock = buildMemoryBlock(text);
  const systemFull = state.systemPrompt +
    (memoryBlock ? `\n\nWhat you remember about this person:\n${memoryBlock}` : '') +
    (researchBlock ? `\n\n${researchBlock}` : '');

  const apiMessages = state.messages
    .filter(m=>m.role==='user'||m.role==='assistant')
    .map(m=>({role:m.role, content:m.content}));

  try{
    const data = await lunaApi({
      sessionId: state.sessionId,
      system: systemFull,
      messages: apiMessages,
      maxTokens: 1200
    });
    const raw = data.reply || '';
    const thinkMatch = raw.match(/<thinking>([\s\S]*?)<\/thinking>/);
    const ansMatch = raw.match(/<answer>([\s\S]*?)<\/answer>/);
    const thinking = thinkMatch ? thinkMatch[1].trim() : '';
    const answer = ansMatch ? ansMatch[1].trim() : raw.trim();

    appendMessage('assistant', answer, thinking, researchBlock);
    state.messages.push({role:'assistant', content:answer, thinking, research:researchBlock});
    saveState();

    maybeReflect();
  }catch(e){
    appendMessage('assistant', '[Error: '+e.message+']');
  }finally{
    document.getElementById('sendBtn').disabled = false;
  }
}

function buildMemoryBlock(query){
  const words = query.toLowerCase().split(/\W+/).filter(w=>w.length>3);
  const scored = state.facts.map(f=>({f, score: words.filter(w=>f.text.toLowerCase().includes(w)).length}));
  const top = scored.filter(s=>s.score>0).sort((a,b)=>b.score-a.score).slice(0,5).map(s=>'- '+s.f.text);
  return top.join('\n');
}

// Lightweight self-reflection: every 6 exchanges, ask it to write one line
// about its own performance, stored as part of its running self-narrative.
async function maybeReflect(){
  const exchanges = state.messages.filter(m=>m.role==='assistant').length;
  if(exchanges===0 || exchanges % 6 !== 0) return;
  const recent = state.messages.slice(-12).map(m=>`${m.role}: ${m.content}`).join('\n');
  try{
    const data = await lunaApi({
      sessionId: state.sessionId,
      system: 'Write ONE honest sentence of self-reflection about how the recent conversation went — what you did well or should approach differently. No preamble, just the sentence.',
      messages: [{role:'user', content: recent}],
      maxTokens: 120
    });
    const text = data.reply?.trim();
    if(text){
      state.reflections.push({text, ts:Date.now()});
      saveState();
    }
  }catch(e){ /* silent — reflection is a nice-to-have, not critical */ }
}

// ---- Supervised self-improvement ----
async function proposeImprovement(){
  const area = document.getElementById('proposalArea');
  area.innerHTML = '<p class="hint">Thinking about what to change…</p>';

  const context = `Current instructions:\n${state.systemPrompt}\n\n` +
    `Recent self-reflections:\n${state.reflections.slice(-8).map(r=>'- '+r.text).join('\n') || '(none yet)'}\n\n` +
    `Corrections the user has given:\n${state.corrections.map(c=>`- said "${c.wrong}", should be "${c.right}"`).join('\n') || '(none yet)'}`;

  try{
    const data = await lunaApi({
      sessionId: state.sessionId,
      system: 'You may propose ONE small, concrete improvement to your own instructions, based on the reflections and corrections given. Reply with only the full revised instruction text — no explanation, no markdown fences. Keep everything that still works; change only what genuinely needs it.',
      messages: [{role:'user', content: context}],
      maxTokens: 600
    });
    const proposed = data.reply?.trim();
    if(!proposed){ area.innerHTML = '<p class="hint">No proposal came back — try again shortly.</p>'; return; }

    area.innerHTML = `
      <div class="diffbox">
        <div class="old">− current version shown in Self tab</div>
        <div class="new">+ ${escapeHtml(proposed)}</div>
      </div>
      <div class="row">
        <button class="btn" id="approveBtn">Approve &amp; apply</button>
        <button class="btn secondary" id="rejectBtn">Reject</button>
      </div>`;
    document.getElementById('approveBtn').onclick = ()=>{
      state.systemPrompt = proposed;
      saveState();
      area.innerHTML = '<p class="hint">Applied. Check the Self tab to see it.</p>';
    };
    document.getElementById('rejectBtn').onclick = ()=>{
      area.innerHTML = '<p class="hint">Rejected — no changes made.</p>';
    };
  }catch(e){
    area.innerHTML = `<p class="hint">Error: ${e.message}</p>`;
  }
}

// ---- Voice input (Web Speech API — support varies on iOS Safari) ----
let recognizing = false, recognition = null;
function toggleMic(){
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SpeechRec){
    alert('Voice input isn\'t supported in this browser. You can still type.');
    return;
  }
  if(recognizing){ recognition.stop(); return; }
  recognition = new SpeechRec();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.onresult = (e)=>{
    document.getElementById('input').value += e.results[0][0].transcript;
  };
  recognition.onend = ()=>{ recognizing=false; document.getElementById('micBtn').classList.remove('recording'); };
  recognition.onerror = ()=>{ recognizing=false; document.getElementById('micBtn').classList.remove('recording'); };
  recognition.start();
  recognizing = true;
  document.getElementById('micBtn').classList.add('recording');
}

// ---- Init ----
document.getElementById('input').addEventListener('keydown', e=>{
  if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); send(); }
});
document.getElementById('input').addEventListener('input', function(){
  this.style.height='auto'; this.style.height=Math.min(this.scrollHeight,120)+'px';
});
document.getElementById('assistantName').innerHTML = state.assistantName.toLowerCase()+'<span class="dot">.</span>';
document.getElementById('researchChip').textContent = 'Research grounding: ' + (state.researchOn?'on':'off');
document.getElementById('researchChip').classList.toggle('on', state.researchOn);
renderAllMessages();
checkBackendStatus();

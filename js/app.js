// ===================== Andiany Mamikely — app.js =====================
// Toute personne qui ouvre l'app et entre un prénom peut lire ET modifier
// le calendrier, la discussion et les réglages : il n'y a pas de rôle
// "admin" à part. Les règles Firestore (firestore.rules) reflètent ça.

const db = firebase.firestore();
const auth = firebase.auth();

const COLORS = [
  { id: 'gold', name: 'Rappel', hex: '#d99a2b' },
  { id: 'green', name: 'Travail', hex: '#3f7a4a' },
  { id: 'brown', name: 'Perso', hex: '#8a5a30' },
  { id: 'blue', name: 'Famille', hex: '#3f6fa8' },
  { id: 'red', name: 'Autre', hex: '#b3442f' },
];
const WEEKDAYS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

let myName = localStorage.getItem('am_name') || '';
let myUid = null;
let current = new Date(); current.setDate(1);
let selectedDate = fmtDate(new Date());
let events = {};
let editingId = null;

function fmtDate(d){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function escapeHtml(s){
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}
function setStatus(state, text){
  document.getElementById('statusDot').className = 'dot ' + state;
  document.getElementById('statusText').textContent = text;
}

// ---------------- Connexion (prénom, pas de mot de passe) ----------------
const nameGate = document.getElementById('nameGate');
const appRoot = document.getElementById('appRoot');

function showApp(){
  nameGate.classList.add('hidden');
  appRoot.classList.remove('hidden');
  document.getElementById('whoAmI').textContent = myName;
  startAppData();
}

document.getElementById('gateBtn').addEventListener('click', enterApp);
document.getElementById('gateName').addEventListener('keydown', (e) => { if(e.key === 'Enter') enterApp(); });
function enterApp(){
  const val = document.getElementById('gateName').value.trim();
  if(!val) return;
  myName = val;
  localStorage.setItem('am_name', myName);
  ensureAudio(); // le clic sert de "geste utilisateur" pour autoriser le son
  if('Notification' in window && Notification.permission === 'default'){
    Notification.requestPermission();
  }
  goAuth();
}

// ---------------- Son de rappel ----------------
let audioCtx = null;
function ensureAudio(){
  if(!audioCtx){
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if(Ctx) audioCtx = new Ctx();
  }
  if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}
function playReminderChime(){
  ensureAudio();
  if(!audioCtx) return;
  const ctx = audioCtx;
  const now = ctx.currentTime;
  [660, 880, 660].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const t = now + i * 0.22;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.32);
  });
}

const notifiedToday = new Set();
function checkReminders(){
  const now = new Date();
  const todayStr = fmtDate(now);
  const nowHM = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  Object.entries(events).forEach(([id, e]) => {
    if(!e.reminder || e.date !== todayStr || !e.time) return;
    if(e.time !== nowHM) return;
    if(notifiedToday.has(id)) return;
    notifiedToday.add(id);
    playReminderChime();
    if('Notification' in window && Notification.permission === 'granted'){
      new Notification(e.title, {
        body: e.note || 'Rappel Andiany Mamikely',
        icon: 'icons/icon.svg',
      });
    }
  });
}
setInterval(checkReminders, 20000); // vérifie toutes les 20 secondes
document.getElementById('changeNameBtn').addEventListener('click', () => {
  localStorage.removeItem('am_name');
  location.reload();
});

function goAuth(){
  auth.signInAnonymously().then((cred) => {
    myUid = cred.user.uid;
    db.collection('members').doc(myUid).set({
      name: myName,
      lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    showApp();
  }).catch(() => {
    // Pas de réseau au premier lancement : on ne peut pas encore créer de
    // session anonyme. On informe et on laisse réessayer.
    alert("Impossible de te connecter pour le moment (pas de réseau ?). Réessaie une fois connecté au moins une première fois.");
  });
}

if(myName){
  // Reprend automatiquement la session si le prénom est déjà connu
  if(auth.currentUser){ myUid = auth.currentUser.uid; showApp(); }
  else {
    auth.onAuthStateChanged((u) => {
      if(u){ myUid = u.uid; showApp(); }
    });
    goAuth();
  }
}

// ---------------- Onglets ----------------
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('view-' + btn.dataset.tab).classList.add('active');
  });
});

// ---------------- Hors-ligne / en ligne ----------------
window.addEventListener('offline', () => document.getElementById('offlineBanner')?.classList.add('show'));
window.addEventListener('online', () => document.getElementById('offlineBanner')?.classList.remove('show'));

// ================= CALENDRIER =================
const colorRow = document.getElementById('colorRow');
let selectedColor = COLORS[0].id;
COLORS.forEach(c => {
  const dot = document.createElement('div');
  dot.className = 'color-dot';
  dot.style.background = c.hex;
  dot.title = c.name;
  dot.dataset.id = c.id;
  dot.addEventListener('click', () => {
    selectedColor = c.id;
    [...colorRow.children].forEach(ch => ch.classList.remove('active'));
    dot.classList.add('active');
  });
  colorRow.appendChild(dot);
});
function colorHex(id){ const c = COLORS.find(c => c.id === id); return c ? c.hex : COLORS[0].hex; }

const weekdayRow = document.getElementById('weekdayRow');
WEEKDAYS.forEach(w => { const th = document.createElement('th'); th.textContent = w; weekdayRow.appendChild(th); });

function eventsForDate(dateStr){
  return Object.entries(events)
    .filter(([id, e]) => e.date === dateStr)
    .map(([id, e]) => ({ id, ...e }))
    .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
}

function renderCalendar(){
  document.getElementById('monthLabel').textContent = `${MONTHS[current.getMonth()]} ${current.getFullYear()}`;
  const body = document.getElementById('calBody');
  body.innerHTML = '';
  const year = current.getFullYear(), month = current.getMonth();
  const firstDay = new Date(year, month, 1);
  let startOffset = firstDay.getDay() - 1; if(startOffset < 0) startOffset = 6;
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const todayStr = fmtDate(new Date());

  let cells = [];
  for(let i = startOffset; i > 0; i--) cells.push({ day: daysInPrevMonth - i + 1, other: true, month: month-1 });
  for(let d = 1; d <= daysInMonth; d++) cells.push({ day: d, other: false, month });
  while(cells.length % 7 !== 0) cells.push({ day: cells.length - startOffset - daysInMonth + 1, other: true, month: month+1 });

  let row;
  cells.forEach((cell, idx) => {
    if(idx % 7 === 0){ row = document.createElement('tr'); body.appendChild(row); }
    const td = document.createElement('td');
    const cellDate = new Date(year, cell.month, cell.day);
    const dateStr = fmtDate(cellDate);
    if(cell.other) td.classList.add('other-month');
    if(dateStr === todayStr) td.classList.add('today');
    if(dateStr === selectedDate) td.classList.add('selected');

    const num = document.createElement('span');
    num.className = 'daynum';
    num.textContent = cell.day;
    td.appendChild(num);

    eventsForDate(dateStr).slice(0, 3).forEach(e => {
      const chip = document.createElement('span');
      chip.className = 'ev-chip';
      chip.style.background = colorHex(e.color);
      chip.textContent = e.title;
      td.appendChild(chip);
    });

    td.addEventListener('click', () => {
      selectedDate = dateStr;
      if(cell.other) current = new Date(year, cell.month, 1);
      renderCalendar(); renderDayPanel();
    });
    row.appendChild(td);
  });
}

function renderDayPanel(){
  const d = new Date(selectedDate + 'T00:00:00');
  document.getElementById('dayPanelTitle').textContent = d.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  const list = document.getElementById('dayEventList');
  list.innerHTML = '';
  const evs = eventsForDate(selectedDate);
  if(evs.length === 0){
    list.innerHTML = '<div style="color:var(--text-dim); font-size:0.85rem;">Aucun événement ce jour-là.</div>';
    return;
  }
  evs.forEach(e => {
    const item = document.createElement('div');
    item.className = 'event-item';
    item.innerHTML = `
      <div class="swatch" style="background:${colorHex(e.color)}"></div>
      <div style="flex:1;">
        <div class="event-title">${escapeHtml(e.title)}${e.reminder ? ' 🔔' : ''}</div>
        <div class="event-meta">${e.time || 'Toute la journée'}${e.createdBy ? ' · ajouté par ' + escapeHtml(e.createdBy) : ''}</div>
        ${e.note ? `<div class="event-note">${escapeHtml(e.note)}</div>` : ''}
      </div>
      <div class="event-actions">
        <button data-act="edit">✎</button>
        <button data-act="del">🗑</button>
      </div>`;
    item.querySelector('[data-act="edit"]').addEventListener('click', () => openModal(e));
    item.querySelector('[data-act="del"]').addEventListener('click', () => deleteEvent(e.id));
    list.appendChild(item);
  });
}

document.getElementById('prevBtn').addEventListener('click', () => { current = new Date(current.getFullYear(), current.getMonth()-1, 1); renderCalendar(); });
document.getElementById('nextBtn').addEventListener('click', () => { current = new Date(current.getFullYear(), current.getMonth()+1, 1); renderCalendar(); });
document.getElementById('todayBtn').addEventListener('click', () => { current = new Date(); current.setDate(1); selectedDate = fmtDate(new Date()); renderCalendar(); renderDayPanel(); });

const overlay = document.getElementById('overlay');
function openModal(ev){
  editingId = ev ? ev.id : null;
  document.getElementById('modalTitle').textContent = ev ? "Modifier l'événement" : 'Nouvel événement';
  document.getElementById('fTitle').value = ev ? ev.title : '';
  document.getElementById('fDate').value = ev ? ev.date : selectedDate;
  document.getElementById('fTime').value = ev ? (ev.time || '') : '';
  document.getElementById('fNote').value = ev ? (ev.note || '') : '';
  document.getElementById('fReminder').checked = ev ? !!ev.reminder : false;
  selectedColor = ev ? ev.color : COLORS[0].id;
  [...colorRow.children].forEach(ch => ch.classList.toggle('active', ch.dataset.id === selectedColor));
  document.getElementById('deleteBtn').style.display = ev ? 'block' : 'none';
  overlay.classList.add('open');
}
function closeModal(){ overlay.classList.remove('open'); editingId = null; }
document.getElementById('addFab').addEventListener('click', () => openModal(null));
document.getElementById('cancelBtn').addEventListener('click', closeModal);
overlay.addEventListener('click', (e) => { if(e.target === overlay) closeModal(); });

document.getElementById('saveBtn').addEventListener('click', () => {
  const title = document.getElementById('fTitle').value.trim();
  const date = document.getElementById('fDate').value;
  if(!title || !date) return;
  const data = {
    title, date,
    time: document.getElementById('fTime').value || null,
    color: selectedColor,
    note: document.getElementById('fNote').value.trim() || null,
    reminder: document.getElementById('fReminder').checked,
    createdBy: myName,
    updatedAt: Date.now(),
  };
  const ref = editingId ? db.collection('events').doc(editingId) : db.collection('events').doc();
  ref.set(data, { merge: true });
  selectedDate = date;
  closeModal();
});
document.getElementById('deleteBtn').addEventListener('click', () => { if(editingId) deleteEvent(editingId); closeModal(); });
function deleteEvent(id){ db.collection('events').doc(id).delete(); }

function listenEvents(){
  db.collection('events').orderBy('date', 'asc').onSnapshot((snap) => {
    const next = {};
    snap.forEach(d => { next[d.id] = d.data(); });
    events = next;
    renderCalendar(); renderDayPanel();
    setStatus('', 'Synchronisé avec le groupe');
  }, () => setStatus('off', 'Connexion perdue — mode hors-ligne'));
}

// ================= DISCUSSION =================
document.getElementById('chatForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if(!text) return;
  db.collection('messages').add({
    text, author: myName, authorUid: myUid,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
  input.value = '';
});

function listenChat(){
  db.collection('messages').orderBy('createdAt', 'asc').limitToLast(200).onSnapshot((snap) => {
    const box = document.getElementById('chatMessages');
    box.innerHTML = '';
    snap.forEach(d => {
      const m = d.data();
      const mine = m.authorUid === myUid;
      const div = document.createElement('div');
      div.className = 'chat-msg' + (mine ? ' mine' : '');
      div.innerHTML = `<div class="meta">${escapeHtml(m.author || '?')}</div><div class="bubble">${escapeHtml(m.text)}</div>`;
      box.appendChild(div);
    });
    box.scrollTop = box.scrollHeight;
  });
}

// ================= PERSONNALISATION =================
const accentRow = document.getElementById('accentRow');
const ACCENTS = ['#d99a2b', '#3f7a4a', '#8a5a30', '#3f6fa8', '#b3442f', '#6b8f4e'];
let chosenAccent = ACCENTS[0];
let chosenMode = 'day';
ACCENTS.forEach(hex => {
  const dot = document.createElement('div');
  dot.className = 'color-dot';
  dot.style.background = hex;
  dot.dataset.hex = hex;
  dot.addEventListener('click', () => {
    chosenAccent = hex;
    [...accentRow.children].forEach(ch => ch.classList.remove('active'));
    dot.classList.add('active');
  });
  accentRow.appendChild(dot);
});
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    chosenMode = btn.dataset.mode;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

function applySettings(s){
  if(!s) return;
  if(s.appName){ document.getElementById('appTitle').textContent = s.appName; document.title = s.appName; document.getElementById('setAppName').value = s.appName; }
  if(s.accent){
    document.documentElement.style.setProperty('--accent', s.accent);
    chosenAccent = s.accent;
    [...accentRow.children].forEach(ch => ch.classList.toggle('active', ch.dataset.hex === s.accent));
  }
  if(s.mode){
    document.body.dataset.mode = s.mode;
    chosenMode = s.mode;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === s.mode));
  }
  if(s.bgUrl){
    document.documentElement.style.setProperty('--bg-image', `url("${s.bgUrl}")`);
    document.getElementById('bgUrlInput').value = s.bgUrl;
    document.getElementById('bgPreview').style.backgroundImage = `url("${s.bgUrl}")`;
  } else {
    document.documentElement.style.setProperty('--bg-image', 'none');
    document.getElementById('bgPreview').style.backgroundImage = '';
  }
}

document.getElementById('saveSettingsBtn').addEventListener('click', () => {
  db.collection('app').doc('settings').set({
    appName: document.getElementById('setAppName').value.trim() || 'Andiany Mamikely',
    accent: chosenAccent,
    mode: chosenMode,
    bgUrl: document.getElementById('bgUrlInput').value.trim() || null,
    updatedBy: myName,
  }, { merge: true });
});

function listenSettings(){
  db.collection('app').doc('settings').onSnapshot((doc) => applySettings(doc.data()));
}

// ================= Démarrage des données =================
function startAppData(){
  listenEvents();
  listenChat();
  listenSettings();
}

// Enregistre le service worker (support hors-ligne pour la coquille de l'app)
if('serviceWorker' in navigator){
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

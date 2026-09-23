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

// Prend un fichier choisi dans la galerie, le redimensionne et le compresse
// en JPEG, puis renvoie une chaîne "data:image/jpeg;base64,...." qu'on peut
// stocker directement dans Firestore (pas besoin de service de stockage en plus).
function fileToCompressedDataURL(file, maxDim, quality){
  return new Promise((resolve, reject) => {
    if(!file) { resolve(''); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('lecture impossible'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('image invalide'));
      img.onload = () => {
        let { width, height } = img;
        if(width > height && width > maxDim){ height = Math.round(height * maxDim / width); width = maxDim; }
        else if(height > maxDim){ width = Math.round(width * maxDim / height); height = maxDim; }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

let myName = localStorage.getItem('am_name') || '';
let myPhoto = localStorage.getItem('am_photo') || '';
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
if(myName) document.getElementById('gateName').value = myName;
if(myPhoto){
  document.getElementById('gatePhotoPreview').src = myPhoto;
  document.getElementById('gatePhotoPreviewWrap').style.display = 'block';
}
document.getElementById('gatePhotoFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if(!file) return;
  try {
    myPhoto = await fileToCompressedDataURL(file, 200, 0.7);
    document.getElementById('gatePhotoPreview').src = myPhoto;
    document.getElementById('gatePhotoPreviewWrap').style.display = 'block';
  } catch(err){
    alert("Impossible de lire cette photo, essaie une autre image.");
  }
});
function enterApp(){
  const val = document.getElementById('gateName').value.trim();
  if(!val) return;
  myName = val;
  localStorage.setItem('am_name', myName);
  localStorage.setItem('am_photo', myPhoto || '');
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
      photoUrl: myPhoto || null,
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

let membersCache = {};
function listenMembers(){
  db.collection('members').onSnapshot((snap) => {
    const next = {};
    snap.forEach(d => { next[d.id] = d.data(); });
    membersCache = next;
    listenChat.lastRender && listenChat.lastRender();
  });
}

function listenChat(){
  db.collection('messages').orderBy('createdAt', 'asc').limitToLast(200).onSnapshot((snap) => {
    const render = () => {
      const box = document.getElementById('chatMessages');
      box.innerHTML = '';
      snap.forEach(d => {
        const m = d.data();
        const mine = m.authorUid === myUid;
        const div = document.createElement('div');
        div.className = 'chat-msg' + (mine ? ' mine' : '');
        const initial = (m.author || '?').trim().charAt(0).toUpperCase() || '?';
        const photo = (membersCache[m.authorUid] && membersCache[m.authorUid].photoUrl) || '';
        const avatarHtml = photo
          ? `<img class="avatar" src="${escapeHtml(photo)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'avatar-fallback',textContent:'${initial}'}))">`
          : `<div class="avatar-fallback">${initial}</div>`;
        div.innerHTML = `${avatarHtml}<div class="bubble-col"><div class="meta">${escapeHtml(m.author || '?')}</div><div class="bubble">${escapeHtml(m.text)}</div></div>`;
        box.appendChild(div);
      });
      box.scrollTop = box.scrollHeight;
    };
    listenChat.lastRender = render;
    render();
  });
}

// ================= PERSONNALISATION =================
const accentRow = document.getElementById('accentRow');
const ACCENTS = [
  '#d99a2b', '#e8663c', '#b3442f', '#c94f7c', '#8a3fa8', '#5a4fcf',
  '#3f6fa8', '#2f9bb0', '#3f9a5c', '#7a9e3f', '#8a5a30', '#5c6c7a',
  '#2b2b2b', '#e0e0e0', '#f2c14e', '#4dd0e1',
];
let chosenAccent = ACCENTS[0];
let chosenMode = 'day';
let chosenIcons = '🐘 🐻 🐺 🐆';
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
document.querySelectorAll('.mode-btn[data-mode]').forEach(btn => {
  btn.addEventListener('click', () => {
    chosenMode = btn.dataset.mode;
    document.querySelectorAll('.mode-btn[data-mode]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

const accentColorInput = document.getElementById('accentColorInput');
if(accentColorInput){
  accentColorInput.addEventListener('input', () => {
    chosenAccent = accentColorInput.value;
    [...accentRow.children].forEach(ch => ch.classList.remove('active'));
  });
}

// Icônes animaux au choix
const ICONSETS = ['🐘 🐻 🐺 🐆', '🦁 🦓 🦒 🐘', '🦉 🦌 🦊 🐿️', '🐸 🐊 🦩 🐢'];
const iconSetRow = document.getElementById('iconSetRow');
if(iconSetRow){
  ICONSETS.forEach(combo => {
    const btn = document.createElement('button');
    btn.className = 'mode-btn';
    btn.textContent = combo;
    btn.dataset.icons = combo;
    btn.addEventListener('click', () => {
      chosenIcons = combo;
      [...iconSetRow.children].forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
    iconSetRow.appendChild(btn);
  });
}

// Éclaircit (pct > 0) ou assombrit (pct < 0) une couleur hex, pour dériver
// un joli dégradé à partir de la seule couleur choisie par l'utilisatrice.
function shadeColor(hex, pct){
  const num = parseInt(hex.replace('#',''), 16);
  let r = (num >> 16) + Math.round(255 * pct);
  let g = ((num >> 8) & 0x00FF) + Math.round(255 * pct);
  let b = (num & 0x0000FF) + Math.round(255 * pct);
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return '#' + (0x1000000 + r*0x10000 + g*0x100 + b).toString(16).slice(1);
}

function applySettings(s){
  if(!s) return;
  if(s.appName){ document.getElementById('appTitle').textContent = s.appName; document.title = s.appName; document.getElementById('setAppName').value = s.appName; }
  if(s.accent){
    document.documentElement.style.setProperty('--accent', s.accent);
    chosenAccent = s.accent;
    [...accentRow.children].forEach(ch => ch.classList.toggle('active', ch.dataset.hex === s.accent));
    if(accentColorInput) accentColorInput.value = s.accent;
  }
  if(s.mode){
    document.body.dataset.mode = s.mode;
    chosenMode = s.mode;
    document.querySelectorAll('.mode-btn[data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === s.mode));
  }
  if(s.font !== undefined){
    document.body.style.fontFamily = s.font || '';
    const sel = document.getElementById('fontSelect');
    if(sel) sel.value = s.font || '';
  }
  if(s.bgColor){
    document.documentElement.style.setProperty('--jungle-mid', s.bgColor);
    document.documentElement.style.setProperty('--jungle-deep', shadeColor(s.bgColor, -0.35));
    document.documentElement.style.setProperty('--jungle-light', shadeColor(s.bgColor, 0.35));
    const input = document.getElementById('bgColorInput');
    if(input) input.value = s.bgColor;
  }
  if(s.icons){
    chosenIcons = s.icons;
    document.querySelectorAll('.leaf').forEach(el => el.textContent = s.icons);
    if(iconSetRow) [...iconSetRow.children].forEach(b => b.classList.toggle('active', b.dataset.icons === s.icons));
  }
  if(s.bgImage){
    document.documentElement.style.setProperty('--bg-image', `url("${s.bgImage}")`);
    document.getElementById('bgPreview').style.backgroundImage = `url("${s.bgImage}")`;
  } else {
    document.documentElement.style.setProperty('--bg-image', 'none');
    document.getElementById('bgPreview').style.backgroundImage = '';
  }
}

let newBgImage; // undefined = pas changé cette session ; string = nouvelle image choisie
const bgImageFile = document.getElementById('bgImageFile');
if(bgImageFile){
  bgImageFile.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if(!file) return;
    try {
      newBgImage = await fileToCompressedDataURL(file, 1000, 0.6);
      document.getElementById('bgPreview').style.backgroundImage = `url("${newBgImage}")`;
    } catch(err){
      alert("Impossible de lire cette image, essaie une autre photo.");
    }
  });
}

document.getElementById('saveSettingsBtn').addEventListener('click', () => {
  const fontSel = document.getElementById('fontSelect');
  const bgColorEl = document.getElementById('bgColorInput');
  const payload = {
    appName: document.getElementById('setAppName').value.trim() || 'Andiany Mamikely',
    accent: chosenAccent,
    mode: chosenMode,
    font: fontSel ? fontSel.value : '',
    bgColor: bgColorEl ? bgColorEl.value : null,
    icons: chosenIcons,
    updatedBy: myName,
  };
  if(newBgImage !== undefined) payload.bgImage = newBgImage;
  db.collection('app').doc('settings').set(payload, { merge: true });
});

function listenSettings(){
  db.collection('app').doc('settings').onSnapshot((doc) => applySettings(doc.data()));
}

// ================= SUIVI LOVITAO =================
const LOVITAO_COLS = ['mm', 'vkm1', 'vkm2', 'mpiremby', 'talenta', 'date', 'fort', 'faible', 'evolution'];
let lovitaoData = {};

function listenLovitao(){
  db.collection('lovitao').orderBy('name').onSnapshot((snap) => {
    const next = {};
    snap.forEach(d => { next[d.id] = d.data(); });
    lovitaoData = next;
    renderLovitaoList();
  });
}

// Sauvegarde une seule case du tableau, sans redessiner (pour ne pas perdre
// le focus pendant que la personne tape).
function saveLovitaoCell(id, field, value){
  db.collection('lovitao').doc(id).set({ [field]: value }, { merge: true });
}

function renderLovitaoList(){
  const tbody = document.getElementById('childList');
  if(!tbody) return;
  tbody.innerHTML = '';
  const entries = Object.entries(lovitaoData);
  if(entries.length === 0){
    tbody.innerHTML = '<tr><td colspan="11" style="padding:14px; color:var(--text-dim); font-size:0.85rem; border:none;">Aucune ligne pour l’instant — clique sur "+ Ajouter une ligne".</td></tr>';
    return;
  }
  entries.forEach(([id, child]) => {
    const tr = document.createElement('tr');

    const nameTd = document.createElement('td');
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = child.name || '';
    nameInput.placeholder = 'Nom';
    nameInput.addEventListener('change', () => saveLovitaoCell(id, 'name', nameInput.value.trim()));
    nameTd.appendChild(nameInput);
    tr.appendChild(nameTd);

    LOVITAO_COLS.forEach(field => {
      const td = document.createElement('td');
      const input = document.createElement('input');
      input.type = field === 'date' ? 'date' : 'text';
      input.value = child[field] || '';
      input.addEventListener('change', () => saveLovitaoCell(id, field, input.value.trim ? input.value.trim() : input.value));
      td.appendChild(input);
      tr.appendChild(td);
    });

    const delTd = document.createElement('td');
    delTd.className = 'suivi-del';
    const delBtn = document.createElement('button');
    delBtn.textContent = '🗑';
    delBtn.title = 'Supprimer cette ligne';
    delBtn.addEventListener('click', () => {
      if(confirm(`Supprimer ${child.name || 'cette ligne'} du suivi ?`)) db.collection('lovitao').doc(id).delete();
    });
    delTd.appendChild(delBtn);
    tr.appendChild(delTd);

    tbody.appendChild(tr);
  });
}

const addChildBtn = document.getElementById('addChildBtn');
if(addChildBtn){
  addChildBtn.addEventListener('click', () => {
    db.collection('lovitao').add({ name: '', createdBy: myName, createdAt: Date.now() });
  });
}

// ================= Démarrage des données =================
function startAppData(){
  listenEvents();
  listenChat();
  listenMembers();
  listenSettings();
  listenLovitao();
}

// Enregistre le service worker (support hors-ligne pour la coquille de l'app)
if('serviceWorker' in navigator){
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

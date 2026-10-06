// ===================== Andiany Mamikely — app.js =====================
// Toute personne qui ouvre l'app et entre un prénom peut lire ET modifier
// le calendrier, la discussion et les réglages : il n'y a pas de rôle
// "admin" à part. Les règles Firestore (firestore.rules) reflètent ça.

const db = firebase.firestore();
const auth = firebase.auth();

const COLORS = [
  { id: 'gold', name: 'Important', hex: '#d99a2b' },
  { id: 'green', name: 'Travail', hex: '#3f7a4a' },
  { id: 'brown', name: 'Perso', hex: '#8a5a30' },
  { id: 'blue', name: 'Famille', hex: '#3f6fa8' },
  { id: 'red', name: 'Urgent', hex: '#b3442f' },
  { id: 'purple', name: 'Scoutisme', hex: '#7a4fa8' },
  { id: 'pink', name: 'Fête', hex: '#c9548a' },
  { id: 'teal', name: 'Santé', hex: '#2f9b8f' },
  { id: 'orange', name: 'Loisir', hex: '#e07b30' },
  { id: 'olive', name: 'Nature', hex: '#7a8a3f' },
  { id: 'navy', name: 'École', hex: '#2b3f6b' },
  { id: 'gray', name: 'Autre', hex: '#6b6b6b' },
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
// Affiche les icônes animaux comme des éléments séparés (pas un seul bloc de texte)
function renderLeafRow(el, iconsStr){
  if(!el) return;
  el.innerHTML = '';
  (iconsStr || '').split(' ').filter(Boolean).forEach(ic => {
    const span = document.createElement('span');
    span.textContent = ic;
    el.appendChild(span);
  });
}

// ---------------- Connexion (prénom, pas de mot de passe) ----------------
const nameGate = document.getElementById('nameGate');
const appRoot = document.getElementById('appRoot');

function showApp(){
  nameGate.classList.add('hidden');
  appRoot.classList.remove('hidden');
  document.getElementById('whoAmI').textContent = myName;
  const welcome = document.getElementById('welcomeMsg');
  if(welcome){
    welcome.textContent = `Bienvenue, ${myName} !`;
    welcome.classList.remove('hidden');
    // relance l'animation de disparition à chaque connexion
    welcome.style.animation = 'none';
    void welcome.offsetWidth;
    welcome.style.animation = '';
    setTimeout(() => welcome.classList.add('hidden'), 4000);
  }
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
  goAuth();
}

// ---------------- Musique de fond ----------------
const bgMusic = document.getElementById('bgMusic');
const musicBtn = document.getElementById('musicBtn');
let musicUrl = '';
musicBtn.addEventListener('click', () => {
  if(!musicUrl){ alert("Aucune musique de fond n'est définie pour l'instant (réglable dans Personnaliser)."); return; }
  if(bgMusic.paused){ bgMusic.play().catch(() => {}); musicBtn.textContent = '🔇'; }
  else { bgMusic.pause(); musicBtn.textContent = '🎵'; }
});
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

renderLeafRow(document.getElementById('leafRow'), '🐘 🐻 🐺 🐆');
renderLeafRow(document.getElementById('gateLeafRow'), '🐘 🐻 🐺 🐆');

// ---------------- Menu (remplace la barre d'onglets) ----------------
const menuOverlay = document.getElementById('menuOverlay');
document.getElementById('menuBtn').addEventListener('click', () => menuOverlay.classList.add('open'));
menuOverlay.addEventListener('click', (e) => { if(e.target === menuOverlay) menuOverlay.classList.remove('open'); });
document.querySelectorAll('.menu-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.menu-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('view-' + btn.dataset.tab).classList.add('active');
    menuOverlay.classList.remove('open');
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
        <div class="event-title">${escapeHtml(e.title)}</div>
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
function formatMsgTime(ts){
  if(!ts || !ts.toDate) return '';
  const d = ts.toDate();
  const today = fmtDate(new Date()) === fmtDate(d);
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if(today) return time;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) + ' ' + time;
}

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

// ---- Envoi d'une photo dans le chat ----
const chatImageBtn = document.getElementById('chatImageBtn');
const chatImageFile = document.getElementById('chatImageFile');
chatImageBtn?.addEventListener('click', () => chatImageFile.click());
chatImageFile?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if(!file) return;
  try {
    const dataUrl = await fileToCompressedDataURL(file, 500, 0.6);
    db.collection('messages').add({
      imageUrl: dataUrl, author: myName, authorUid: myUid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch(err){
    alert("Impossible d'envoyer cette photo, essaie une autre image.");
  }
  chatImageFile.value = '';
});

// ---- Message vocal ----
const chatVoiceBtn = document.getElementById('chatVoiceBtn');
const recordingBar = document.getElementById('recordingBar');
const stopRecordBtn = document.getElementById('stopRecordBtn');
let mediaRecorder = null;
let recordedChunks = [];
let recordTimeout = null;
const MAX_RECORD_MS = 60000; // 1 minute maximum, pour rester léger

chatVoiceBtn?.addEventListener('click', async () => {
  if(!navigator.mediaDevices || !window.MediaRecorder){
    alert("L'enregistrement vocal n'est pas pris en charge par ce navigateur.");
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (e) => { if(e.data.size > 0) recordedChunks.push(e.data); };
    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      recordingBar.classList.add('hidden');
      clearTimeout(recordTimeout);
      if(recordedChunks.length === 0) return;
      const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
      if(blob.size > 700000){
        alert("Ce message vocal est trop long pour être envoyé (limite technique). Essaie un message plus court.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        db.collection('messages').add({
          audioUrl: reader.result, author: myName, authorUid: myUid,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        }).catch(() => alert("L'envoi du message vocal a échoué, réessaie."));
      };
      reader.readAsDataURL(blob);
    };
    mediaRecorder.start();
    recordingBar.classList.remove('hidden');
    recordTimeout = setTimeout(() => { if(mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop(); }, MAX_RECORD_MS);
  } catch(err){
    alert("Impossible d'accéder au micro (vérifie l'autorisation dans les réglages du navigateur).");
  }
});
stopRecordBtn?.addEventListener('click', () => {
  if(mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
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
        let contentHtml;
        if(m.imageUrl){
          contentHtml = `<img class="chat-img" src="${escapeHtml(m.imageUrl)}" alt="photo">`;
        } else if(m.audioUrl){
          contentHtml = `<audio class="chat-audio" controls src="${escapeHtml(m.audioUrl)}"></audio>`;
        } else {
          contentHtml = `<div class="bubble">${escapeHtml(m.text || '')}</div>`;
        }
        div.innerHTML = `${avatarHtml}<div class="bubble-col"><div class="meta"><span>${escapeHtml(m.author || '?')}</span><span class="time">${formatMsgTime(m.createdAt)}</span></div>${contentHtml}</div>`;
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
  if(s.motto !== undefined){
    document.getElementById('appMotto').textContent = s.motto || '';
    document.getElementById('setMotto').value = s.motto || '';
  }
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
    renderLeafRow(document.getElementById('leafRow'), s.icons);
    renderLeafRow(document.getElementById('gateLeafRow'), s.icons);
    if(iconSetRow) [...iconSetRow.children].forEach(b => b.classList.toggle('active', b.dataset.icons === s.icons));
  }
  if(s.musicUrl !== undefined){
    musicUrl = s.musicUrl || '';
    bgMusic.src = musicUrl;
    musicBtn.textContent = '🎵';
    const input = document.getElementById('musicUrlInput');
    if(input) input.value = musicUrl;
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
    motto: document.getElementById('setMotto').value.trim() || null,
    accent: chosenAccent,
    mode: chosenMode,
    font: fontSel ? fontSel.value : '',
    bgColor: bgColorEl ? bgColorEl.value : null,
    icons: chosenIcons,
    musicUrl: document.getElementById('musicUrlInput').value.trim() || null,
    updatedBy: myName,
  };
  if(newBgImage !== undefined) payload.bgImage = newBgImage;
  db.collection('app').doc('settings').set(payload, { merge: true });
});

function listenSettings(){
  db.collection('app').doc('settings').onSnapshot((doc) => applySettings(doc.data()));
}

// ================= SUIVI LOVITAO =================
// Sous-onglets (Tableau / Évolution / Présence)
document.querySelectorAll('.subtab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.subtab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.subview').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('sub-' + btn.dataset.sub).classList.add('active');
  });
});

const LOVITAO_COLS = ['mm', 'vkm1', 'vkm2', 'mpiremby', 'talenta'];
const LOVITAO_LABELS = { mm: 'MM', vkm1: 'VKM I', vkm2: 'VKM II', mpiremby: 'Mpiremby', talenta: 'Talenta' };
let lovitaoData = {};
let lovitaoSearch = '';

function listenLovitao(){
  db.collection('lovitao').orderBy('name').onSnapshot((snap) => {
    const next = {};
    snap.forEach(d => { next[d.id] = d.data(); });
    lovitaoData = next;
    renderLovitaoList();
    renderEvolutionList();
  });
}

// Sauvegarde une seule case du tableau, sans redessiner (pour ne pas perdre
// le focus pendant que la personne tape).
function saveLovitaoCell(id, field, value){
  db.collection('lovitao').doc(id).set({ [field]: value }, { merge: true });
}

function matchesSearch(name){
  if(!lovitaoSearch) return true;
  return (name || '').toLowerCase().includes(lovitaoSearch.toLowerCase());
}

function renderLovitaoList(){
  const tbody = document.getElementById('childList');
  if(!tbody) return;
  tbody.innerHTML = '';
  const entries = Object.entries(lovitaoData).filter(([id, c]) => matchesSearch(c.name));
  if(entries.length === 0){
    const msg = lovitaoSearch ? 'Aucun nom ne correspond à ta recherche.' : 'Aucune ligne pour l’instant — clique sur "+ Ajouter une ligne".';
    tbody.innerHTML = `<tr><td colspan="7" style="padding:14px; color:var(--text-dim); font-size:0.85rem; border:none;">${msg}</td></tr>`;
    return;
  }
  entries.forEach(([id, child]) => {
    const tr = document.createElement('tr');

    const nameTd = document.createElement('td');
    nameTd.setAttribute('data-label', 'Nom');
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = child.name || '';
    nameInput.placeholder = 'Nom';
    nameInput.addEventListener('change', () => saveLovitaoCell(id, 'name', nameInput.value.trim()));
    nameTd.appendChild(nameInput);
    tr.appendChild(nameTd);

    LOVITAO_COLS.forEach(field => {
      const td = document.createElement('td');
      td.setAttribute('data-label', LOVITAO_LABELS[field] || field);
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

// ---- Évolution : plusieurs entrées datées par personne (points forts /
// points faibles / à améliorer), pour suivre dans le temps ----
function renderEvolutionList(){
  const wrap = document.getElementById('evolutionList');
  if(!wrap) return;
  wrap.innerHTML = '';
  const entries = Object.entries(lovitaoData).filter(([id, c]) => matchesSearch(c.name));
  if(entries.length === 0){
    wrap.innerHTML = `<div style="color:var(--text-dim); font-size:0.85rem;">${lovitaoSearch ? 'Aucun nom ne correspond à ta recherche.' : 'Ajoute d’abord une ligne dans l’onglet Tableau.'}</div>`;
    return;
  }
  entries.forEach(([id, child]) => {
    const evols = child.evolutions || [];
    const card = document.createElement('div');
    card.className = 'child-card';
    const rowsHtml = evols.map((ev2, i) => `
      <tr>
        <td><input type="date" data-i="${i}" data-field="date" value="${ev2.date || ''}"></td>
        <td><input type="text" data-i="${i}" data-field="fort" placeholder="Points forts" value="${escapeHtml(ev2.fort || '')}"></td>
        <td><input type="text" data-i="${i}" data-field="faible" placeholder="Points faibles" value="${escapeHtml(ev2.faible || '')}"></td>
        <td><input type="text" data-i="${i}" data-field="ameliorer" placeholder="À améliorer" value="${escapeHtml(ev2.ameliorer || '')}"></td>
        <td class="suivi-del"><button data-act="del-evol" data-i="${i}">🗑</button></td>
      </tr>
    `).join('');
    card.innerHTML = `
      <div class="child-card-head">
        <h4>${escapeHtml(child.name || '(sans nom)')}</h4>
        <button class="btn ghost small" data-act="add-evol">+ Entrée</button>
      </div>
      <div class="grid-wrap" style="padding:2px;">
        <table class="suivi-table">
          <thead><tr><th>Date</th><th>Points forts</th><th>Points faibles</th><th>À améliorer</th><th></th></tr></thead>
          <tbody>${rowsHtml || `<tr><td colspan="5" style="padding:10px; color:var(--text-dim); font-size:0.82rem; border:none;">Aucune entrée pour l’instant.</td></tr>`}</tbody>
        </table>
      </div>
    `;
    card.querySelector('[data-act="add-evol"]').addEventListener('click', () => {
      const newEvols = [...evols, { date: fmtDate(new Date()), fort: '', faible: '', ameliorer: '' }];
      db.collection('lovitao').doc(id).update({ evolutions: newEvols });
    });
    card.querySelectorAll('[data-act="del-evol"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = Number(btn.dataset.i);
        const newEvols = evols.slice(0, i).concat(evols.slice(i + 1));
        db.collection('lovitao').doc(id).update({ evolutions: newEvols });
      });
    });
    card.querySelectorAll('input[data-field]').forEach(input => {
      input.addEventListener('change', () => {
        const i = Number(input.dataset.i);
        const field = input.dataset.field;
        const newEvols = evols.map((ev2, idx) => idx === i ? { ...ev2, [field]: input.value } : ev2);
        db.collection('lovitao').doc(id).update({ evolutions: newEvols });
      });
    });
    wrap.appendChild(card);
  });
}

const lovitaoSearchInput = document.getElementById('lovitaoSearch');
if(lovitaoSearchInput){
  lovitaoSearchInput.addEventListener('input', () => {
    lovitaoSearch = lovitaoSearchInput.value.trim();
    renderLovitaoList();
    renderEvolutionList();
  });
}

const addChildBtn = document.getElementById('addChildBtn');
if(addChildBtn){
  addChildBtn.addEventListener('click', () => {
    db.collection('lovitao').add({ name: '', createdBy: myName, createdAt: Date.now(), date: fmtDate(new Date()) });
  });
}

// ---- Présence : un dimanche par colonne, d'octobre 2026 à septembre 2027 ----
function generateSundays(startYear){
  const list = [];
  let d = new Date(startYear, 9, 1); // 1er octobre
  while(d.getDay() !== 0) d.setDate(d.getDate() + 1);
  const end = new Date(startYear + 1, 8, 30); // 30 septembre de l'année suivante
  while(d <= end){
    list.push(fmtDate(d));
    d.setDate(d.getDate() + 7);
  }
  return list;
}
const SUNDAYS = generateSundays(2026);
const PRES_MONTH_KEYS = [...new Set(SUNDAYS.map(d => d.slice(0, 7)))]; // ex: "2026-10"
let presMonthIdx = 0;
const PRES_MONTH_NAMES = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

function currentMonthSundays(){
  const key = PRES_MONTH_KEYS[presMonthIdx];
  return SUNDAYS.filter(d => d.startsWith(key));
}
function renderPresMonthLabel(){
  const key = PRES_MONTH_KEYS[presMonthIdx];
  const [y, m] = key.split('-').map(Number);
  const label = document.getElementById('presMonthLabel');
  if(label) label.textContent = `${PRES_MONTH_NAMES[m - 1]} ${y}`;
}
document.getElementById('presPrevBtn')?.addEventListener('click', () => {
  if(presMonthIdx > 0){ presMonthIdx--; renderPresMonthLabel(); renderPresenceHead(); renderPresenceBody(); }
});
document.getElementById('presNextBtn')?.addEventListener('click', () => {
  if(presMonthIdx < PRES_MONTH_KEYS.length - 1){ presMonthIdx++; renderPresMonthLabel(); renderPresenceHead(); renderPresenceBody(); }
});

function renderPresenceHead(){
  const row = document.getElementById('presenceHeadRow');
  if(!row) return;
  row.innerHTML = '<th>Nom</th>' + currentMonthSundays().map(dstr => {
    const dt = new Date(dstr + 'T00:00:00');
    return `<th>${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}</th>`;
  }).join('');
}
renderPresMonthLabel();
renderPresenceHead();

let presenceData = {};
function listenPresence(){
  db.collection('presence').orderBy('name').onSnapshot((snap) => {
    const next = {};
    snap.forEach(d => { next[d.id] = d.data(); });
    presenceData = next;
    renderPresenceBody();
  });
}

function renderPresenceBody(){
  const tbody = document.getElementById('presenceBody');
  if(!tbody) return;
  tbody.innerHTML = '';
  const monthSundays = currentMonthSundays();
  const entries = Object.entries(presenceData);
  if(entries.length === 0){
    tbody.innerHTML = `<tr><td colspan="${monthSundays.length + 1}" style="padding:14px; color:var(--text-dim); font-size:0.85rem; border:none;">Aucun nom pour l’instant — clique sur "+ Ajouter un nom".</td></tr>`;
  } else {
    entries.forEach(([id, person]) => {
      const marks = person.marks || {};
      const tr = document.createElement('tr');
      const nameTd = document.createElement('td');
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.value = person.name || '';
      nameInput.placeholder = 'Nom';
      nameInput.addEventListener('change', () => db.collection('presence').doc(id).set({ name: nameInput.value.trim() }, { merge: true }));
      nameTd.appendChild(nameInput);
      tr.appendChild(nameTd);

      monthSundays.forEach(dateStr => {
        const td = document.createElement('td');
        td.className = 'presence-cell';
        const state = marks[dateStr];
        if(state === true){ td.textContent = '✅'; td.classList.add('present'); }
        else if(state === false){ td.textContent = '❌'; td.classList.add('absent'); }
        else td.textContent = '—';
        td.addEventListener('click', () => {
          let next;
          if(state === true) next = false;
          else if(state === false) next = null;
          else next = true;
          if(next === null){
            db.collection('presence').doc(id).update({ [`marks.${dateStr}`]: firebase.firestore.FieldValue.delete() });
          } else {
            db.collection('presence').doc(id).set({ marks: { [dateStr]: next } }, { merge: true });
          }
        });
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }
  // Les statistiques portent sur l'année complète, pas seulement le mois affiché
  let present = 0, absent = 0;
  entries.forEach(([, person]) => {
    const marks = person.marks || {};
    SUNDAYS.forEach(d => { if(marks[d] === true) present++; else if(marks[d] === false) absent++; });
  });
  const stats = document.getElementById('presenceStats');
  if(stats) stats.textContent = `Sur l'année : ${present} présence(s) enregistrée(s) · ${absent} absence(s) enregistrée(s)`;
}

document.getElementById('addPresenceNameBtn')?.addEventListener('click', () => {
  const name = prompt('Nom à ajouter au suivi de présence :');
  if(name && name.trim()) db.collection('presence').add({ name: name.trim(), marks: {}, createdBy: myName });
});

// ================= ESPACE CHEFTAINES =================
async function sha256Hex(str){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

let cheftainePinHash = undefined; // undefined = pas encore chargé, null = pas de code créé
const cheftaineGate = document.getElementById('cheftaineGate');
const cheftaineContent = document.getElementById('cheftaineContent');

function updateCheftaineGateUI(){
  if(cheftainePinHash === undefined) return; // en attente des données
  const unlocked = localStorage.getItem('am_cheftaine_ok') === '1';
  if(unlocked){
    cheftaineGate.classList.add('hidden');
    cheftaineContent.classList.remove('hidden');
    return;
  }
  cheftaineGate.classList.remove('hidden');
  cheftaineContent.classList.add('hidden');
  const confirmWrap = document.getElementById('cheftainePinConfirmWrap');
  if(cheftainePinHash === null){
    document.getElementById('cheftaineGateTitle').textContent = "Créer le code d'accès cheftaines";
    document.getElementById('cheftaineGateHint').textContent = "Personne n'a encore créé de code. Choisis-en un (garde-le pour les autres cheftaines).";
    confirmWrap.classList.remove('hidden');
  } else {
    document.getElementById('cheftaineGateTitle').textContent = "Espace réservé aux cheftaines";
    document.getElementById('cheftaineGateHint').textContent = "Entre le code partagé entre cheftaines pour continuer.";
    confirmWrap.classList.add('hidden');
  }
}

function listenCheftaineGate(){
  db.collection('app').doc('cheftaine').onSnapshot((doc) => {
    cheftainePinHash = doc.exists ? (doc.data().pinHash || null) : null;
    updateCheftaineGateUI();
  });
}

document.getElementById('cheftaineSubmitBtn').addEventListener('click', async () => {
  const pin = document.getElementById('cheftainePinInput').value.trim();
  if(!pin){ return; }
  if(cheftainePinHash === null){
    const confirm2 = document.getElementById('cheftainePinConfirm').value.trim();
    if(pin.length < 4){ alert('Choisis un code d’au moins 4 caractères.'); return; }
    if(pin !== confirm2){ alert('Les deux codes ne correspondent pas.'); return; }
    const hash = await sha256Hex(pin);
    await db.collection('app').doc('cheftaine').set({ pinHash: hash, createdBy: myName }, { merge: true });
    localStorage.setItem('am_cheftaine_ok', '1');
    updateCheftaineGateUI();
  } else {
    const hash = await sha256Hex(pin);
    if(hash === cheftainePinHash){
      localStorage.setItem('am_cheftaine_ok', '1');
      updateCheftaineGateUI();
    } else {
      alert('Code incorrect.');
    }
  }
  document.getElementById('cheftainePinInput').value = '';
  document.getElementById('cheftainePinConfirm').value = '';
});

// ---- Rubrique Argent ----
let argentData = {};

function listenArgent(){
  db.collection('cheftaine_argent').orderBy('date', 'asc').onSnapshot((snap) => {
    const next = {};
    snap.forEach(d => { next[d.id] = d.data(); });
    argentData = next;
    renderArgent();
  });
}

function renderArgent(){
  const body = document.getElementById('argentBody');
  if(!body) return;
  body.innerHTML = '';
  const entries = Object.entries(argentData);
  let running = 0;
  entries.forEach(([id, row]) => {
    running += Number(row.somme) || 0;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="date" value="${row.date || ''}" data-field="date"></td>
      <td><input type="text" value="${escapeHtml(row.raison || '')}" data-field="raison" placeholder="Raison"></td>
      <td><input type="number" step="0.01" value="${row.somme != null ? row.somme : ''}" data-field="somme"></td>
      <td style="font-weight:600; white-space:nowrap;">${running.toLocaleString('fr-FR')} Ar</td>
      <td class="suivi-del"><button data-act="del">🗑</button></td>
    `;
    tr.querySelectorAll('input').forEach(input => {
      input.addEventListener('change', () => {
        const field = input.dataset.field;
        const value = field === 'somme' ? Number(input.value) || 0 : input.value;
        db.collection('cheftaine_argent').doc(id).update({ [field]: value });
      });
    });
    tr.querySelector('[data-act="del"]').addEventListener('click', () => {
      if(confirm('Supprimer cette ligne ?')) db.collection('cheftaine_argent').doc(id).delete();
    });
    body.appendChild(tr);
  });
  const stats = document.getElementById('argentStats');
  if(stats) stats.textContent = `Total actuel : ${running.toLocaleString('fr-FR')} Ar`;
}

document.getElementById('addArgentBtn').addEventListener('click', () => {
  db.collection('cheftaine_argent').add({
    date: fmtDate(new Date()), raison: '', somme: 0, createdBy: myName,
  });
});

// ---- Rubriques personnalisées ----
let rubriquesData = {};

function listenRubriques(){
  db.collection('cheftaine_rubriques').orderBy('createdAt', 'asc').onSnapshot((snap) => {
    const next = {};
    snap.forEach(d => { next[d.id] = d.data(); });
    rubriquesData = next;
    renderRubriques();
  });
}

function renderRubriques(){
  const list = document.getElementById('rubriquesList');
  if(!list) return;
  list.innerHTML = '';
  const entries = Object.entries(rubriquesData);
  if(entries.length === 0){
    list.innerHTML = '<div style="color:var(--text-dim); font-size:0.85rem;">Aucune rubrique créée pour l’instant.</div>';
    return;
  }
  entries.forEach(([id, rub]) => {
    const cols = rub.columns || [];
    const rows = rub.rows || [];
    const card = document.createElement('div');
    card.className = 'child-card';
    const theadHtml = `<tr>${cols.map(c => `<th>${escapeHtml(c)}</th>`).join('')}<th></th></tr>`;
    const rowsHtml = rows.map((row, ri) => `
      <tr>
        ${cols.map(c => `<td><input type="text" data-ri="${ri}" data-col="${escapeHtml(c)}" value="${escapeHtml(row[c] || '')}"></td>`).join('')}
        <td class="suivi-del"><button data-act="del-row" data-ri="${ri}">🗑</button></td>
      </tr>
    `).join('');
    card.innerHTML = `
      <div class="child-card-head">
        <h4>${escapeHtml(rub.name || '(sans nom)')}</h4>
        <button data-act="delete-rubrique" title="Supprimer la rubrique">🗑</button>
      </div>
      <div class="grid-wrap" style="padding:2px; margin-bottom:10px;">
        <table class="suivi-table">
          <thead>${theadHtml}</thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
      <button class="btn ghost small" data-act="add-row">+ Ligne</button>
    `;
    card.querySelector('[data-act="delete-rubrique"]').addEventListener('click', () => {
      if(confirm(`Supprimer la rubrique "${rub.name}" ?`)) db.collection('cheftaine_rubriques').doc(id).delete();
    });
    card.querySelector('[data-act="add-row"]').addEventListener('click', () => {
      const newRow = {};
      cols.forEach(c => { newRow[c] = ''; });
      db.collection('cheftaine_rubriques').doc(id).update({ rows: [...rows, newRow] });
    });
    card.querySelectorAll('[data-act="del-row"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const ri = Number(btn.dataset.ri);
        const newRows = rows.slice(0, ri).concat(rows.slice(ri + 1));
        db.collection('cheftaine_rubriques').doc(id).update({ rows: newRows });
      });
    });
    card.querySelectorAll('input[data-col]').forEach(input => {
      input.addEventListener('change', () => {
        const ri = Number(input.dataset.ri);
        const col = input.dataset.col;
        const newRows = rows.map((r, i) => i === ri ? { ...r, [col]: input.value } : r);
        db.collection('cheftaine_rubriques').doc(id).update({ rows: newRows });
      });
    });
    list.appendChild(card);
  });
}

document.getElementById('addRubriqueBtn').addEventListener('click', () => {
  const name = prompt('Nom de la rubrique :');
  if(!name || !name.trim()) return;
  const colsRaw = prompt('Colonnes, séparées par une virgule (ex : Lieu, Participants, Note) :');
  if(!colsRaw) return;
  const columns = colsRaw.split(',').map(c => c.trim()).filter(Boolean);
  if(columns.length === 0) return;
  db.collection('cheftaine_rubriques').add({ name: name.trim(), columns, rows: [], createdBy: myName, createdAt: Date.now() });
});

// ================= Démarrage des données =================
function startAppData(){
  listenEvents();
  listenChat();
  listenMembers();
  listenSettings();
  listenLovitao();
  listenPresence();
  listenCheftaineGate();
  listenArgent();
  listenRubriques();
}

// Enregistre le service worker (support hors-ligne pour la coquille de l'app)
if('serviceWorker' in navigator){
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

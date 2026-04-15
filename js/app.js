// ═══════════════════════════════════════════════════
// INVECTA — Local Storage Edition (no backend)
// ═══════════════════════════════════════════════════

var STORAGE_KEYS = {
  user:     'invecta_user',
  projects: 'invecta_projects',
  structs:  'invecta_structures',
};

// ═══════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════
var state = {
  projects:         [],
  structures:       [],
  currentProjectId: null,
  user:             null,
  profile:          null,
};

var _pendingDeleteId = null;

function getProject(id) {
  return state.projects.find(function(p) { return p.id === id; });
}

// ═══════════════════════════════════════════
// LOCAL STORAGE HELPERS
// ═══════════════════════════════════════════
function lsGet(key, fallback) {
  try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch(e) { return fallback; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {}
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

// ═══════════════════════════════════════════
// PROJECTS — LOCAL
// ═══════════════════════════════════════════
function loadProjects() {
  var all = lsGet(STORAGE_KEYS.projects, []);
  // Each user has their own projects (keyed by user id)
  state.projects = all.filter(function(p) {
    return p.userId === state.user.id;
  });
}

function saveProjects() {
  // Merge current user's projects back into the full list
  var all = lsGet(STORAGE_KEYS.projects, []).filter(function(p) {
    return p.userId !== state.user.id;
  });
  var merged = all.concat(state.projects.map(function(p) {
    return Object.assign({}, p, { userId: state.user.id });
  }));
  lsSet(STORAGE_KEYS.projects, merged);
}

function dbSaveProject(p) {
  if (p._new) {
    var newId = genId();
    var newProject = {
      id:          newId,
      userId:      state.user.id,
      nombre:      p.nombre,
      descripcion: p.descripcion || '',
      propietario: p.propietario || '',
      estado:      p.estado || 'proceso',
      estructuras: p.estructuras || [],
      createdAt:   new Date().toISOString(),
    };
    state.projects.unshift(newProject);
    saveProjects();
    return newId;
  } else {
    var idx = state.projects.findIndex(function(x) { return x.id === p.id; });
    if (idx >= 0) {
      state.projects[idx] = Object.assign(state.projects[idx], {
        nombre:      p.nombre,
        descripcion: p.descripcion || '',
        propietario: p.propietario || '',
        estado:      p.estado || 'proceso',
        estructuras: p.estructuras || [],
      });
      saveProjects();
    }
    return p.id;
  }
}

function dbDeleteProject(id) {
  state.projects = state.projects.filter(function(p) { return p.id !== id; });
  saveProjects();
  return true;
}

function save() {
  if (!state.currentProjectId || !state.user) return;
  var p = getProject(state.currentProjectId);
  if (p) dbSaveProject(p);
}

// ═══════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════
function goTo(screenId) {
  document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('active'); });
  document.getElementById(screenId).classList.add('active');
}

// ═══════════════════════════════════════════
// AUTH — LOCAL
// ═══════════════════════════════════════════
function showLoginError(msg) {
  var el = document.getElementById('login-error');
  el.textContent = msg;
  el.style.display = msg ? '' : 'none';
}

function showRegisterError(msg) {
  var el = document.getElementById('register-error');
  el.textContent = msg;
  el.style.display = msg ? '' : 'none';
}

function hashSimple(str) {
  // Simple non-cryptographic hash for local password storage
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    var c = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + c;
    hash |= 0;
  }
  return hash.toString(36);
}

function getUsers() { return lsGet('invecta_users', []); }
function saveUsers(users) { lsSet('invecta_users', users); }

function doLogin() {
  // Get or create a default local user — no credentials needed
  var users = getUsers();
  var user  = users.length ? users[0] : null;
  if (!user) {
    user = {
      id:          genId(),
      email:       'usuario@invecta.app',
      displayName: 'Usuario',
      engineerCode:'',
      avatarUrl:   '',
      createdAt:   new Date().toISOString(),
    };
    users.push(user);
    saveUsers(users);
  }
  lsSet(STORAGE_KEYS.user, user.id);
  enterApp(user);
}

function doSignUp() {
  var name  = document.getElementById('reg-name').value.trim();
  var code  = document.getElementById('reg-code').value.trim();
  var email = document.getElementById('reg-email').value.trim().toLowerCase();
  var pw    = document.getElementById('reg-pw').value;

  if (!name)            { showRegisterError('Ingresa tu nombre'); return; }
  if (!email)           { showRegisterError('Ingresa tu correo'); return; }
  if (!pw || pw.length < 6) { showRegisterError('La contraseña debe tener al menos 6 caracteres'); return; }

  var users = getUsers();
  if (users.find(function(u) { return u.email === email; })) {
    showRegisterError('Ya existe una cuenta con ese correo');
    return;
  }

  var newUser = {
    id:          genId(),
    email:       email,
    pwHash:      hashSimple(pw),
    displayName: name,
    engineerCode:code,
    avatarUrl:   '',
    createdAt:   new Date().toISOString(),
  };
  users.push(newUser);
  saveUsers(users);
  lsSet(STORAGE_KEYS.user, newUser.id);
  toast('Cuenta creada ✓');
  enterApp(newUser);
}

function doLogout() {
  localStorage.removeItem(STORAGE_KEYS.user);
  state.user = null;
  state.profile = null;
  state.projects = [];
  state.currentProjectId = null;
  document.getElementById('drawer-overlay').classList.remove('open');
  document.getElementById('login-email').value = '';
  document.getElementById('login-pw').value = '';
  showLoginError('');
  goTo('screen-login');
  toast('Sesión cerrada');
}

function enterApp(user) {
  state.user = user;
  state.profile = {
    displayName:  user.displayName  || user.email.split('@')[0],
    engineerCode: user.engineerCode || '',
    avatarUrl:    user.avatarUrl    || '',
  };
  updateProfileUI();
  loadProjects();
  goTo('screen-home');
  renderHome();
}

function updateProfileUI() {
  if (!state.profile) return;
  var name    = state.profile.displayName;
  var initial = name.charAt(0).toUpperCase();
  document.getElementById('home-username').textContent = name;
  document.querySelectorAll('.nav-profile').forEach(function(el) {
    if (state.profile.avatarUrl) {
      el.innerHTML = '<img src="' + state.profile.avatarUrl + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';
    } else {
      el.textContent = initial;
    }
  });
}

// ═══════════════════════════════════════════
// DRAWER
// ═══════════════════════════════════════════
function openDrawer() { document.getElementById('drawer-overlay').classList.add('open'); }
function closeDrawer(e) {
  if (e && e.target !== document.getElementById('drawer-overlay')) return;
  document.getElementById('drawer-overlay').classList.remove('open');
}
function closeDrawerAndGo(screen) {
  document.getElementById('drawer-overlay').classList.remove('open');
  setTimeout(function() {
    goTo(screen);
    if (screen === 'screen-home') renderHome();
    if (screen === 'screen-librerias') {
      document.getElementById('lib-search-input').value = '';
      renderLibrerias('');
    }
  }, 200);
}
function closeDrawerAndShowNew() {
  document.getElementById('drawer-overlay').classList.remove('open');
  setTimeout(function() { showConfirmNewProject(); }, 200);
}

// ═══════════════════════════════════════════
// DIALOGS
// ═══════════════════════════════════════════
function openDlg(id)  { document.getElementById(id).classList.add('open'); }
function closeDlg(id) { document.getElementById(id).classList.remove('open'); }

function showConfirmNewProject() { goTo('screen-home'); renderHome(); openDlg('dlg-confirm'); }
function confirmNewProject() {
  closeDlg('dlg-confirm');
  document.getElementById('new-nombre').value = '';
  document.getElementById('new-desc').value   = '';
  document.getElementById('new-owner').value  = '';
  setTimeout(function() { openDlg('dlg-form'); }, 100);
}

function createProject() {
  var nombre = document.getElementById('new-nombre').value.trim();
  if (!nombre) { toast('Ingresa el nombre del proyecto'); return; }
  var p = {
    _new:        true,
    nombre:      nombre,
    descripcion: document.getElementById('new-desc').value.trim(),
    propietario: document.getElementById('new-owner').value.trim(),
    estado:      'proceso',
    estructuras: [],
  };
  closeDlg('dlg-form');
  var newId = dbSaveProject(p);
  renderHome();
  toast('Proyecto creado ✓');
  setTimeout(function() { openProject(newId); }, 200);
}

// ─── Edit Project ───
function openEditProject(id) {
  var p = getProject(id);
  if (!p) return;
  document.getElementById('edit-nombre').value      = p.nombre      || '';
  document.getElementById('edit-propietario').value = p.propietario || '';
  document.getElementById('edit-descripcion').value = p.descripcion || '';
  document.getElementById('edit-project-id').value  = id;
  openDlg('dlg-edit');
}

function saveEditProject() {
  var id = document.getElementById('edit-project-id').value;
  var p  = getProject(id);
  if (!p) return;
  var nombre = document.getElementById('edit-nombre').value.trim();
  if (!nombre) { toast('El nombre no puede estar vacío'); return; }
  p.nombre      = nombre;
  p.propietario = document.getElementById('edit-propietario').value.trim();
  p.descripcion = document.getElementById('edit-descripcion').value.trim();
  closeDlg('dlg-edit');
  dbSaveProject(p);
  renderHome();
  toast('Proyecto actualizado ✓');
}

// ─── Delete Project ───
function openDeleteProject(id) {
  var p = getProject(id);
  if (!p) return;
  _pendingDeleteId = id;
  document.getElementById('dlg-delete-name').textContent =
    '¿Eliminar "' + p.nombre + '"? Esta acción no se puede deshacer.';
  openDlg('dlg-delete');
}

function confirmDeleteProject() {
  if (!_pendingDeleteId) return;
  var id = _pendingDeleteId;
  _pendingDeleteId = null;
  closeDlg('dlg-delete');
  dbDeleteProject(id);
  if (state.currentProjectId === id) state.currentProjectId = null;
  renderHome();
  toast('Proyecto eliminado');
}

// ═══════════════════════════════════════════
// HOME
// ═══════════════════════════════════════════
function renderHome() {
  var list = document.getElementById('projects-list');
  if (!state.projects.length) {
    list.innerHTML =
      '<div class="empty-state fade-up">'
      + '<div class="empty-icon">⚡</div>'
      + '<div class="empty-title">No hay proyectos creados</div>'
      + '<div class="empty-sub">¡Empieza ahora!<br>Toca + para crear tu primer proyecto eléctrico.</div>'
      + '</div>';
    return;
  }
  var emojis = ['🏗️','⚡','🔌','🏚️','🗼','🔧','📡','🌐'];
  list.innerHTML = state.projects.map(function(p, i) {
    var mats = calcMaterials(p).length;
    var badgeClass = p.estado === 'completado' ? 'badge-completado' : p.estado === 'proceso' ? 'badge-proceso' : 'badge-pendiente';
    var badgeText  = p.estado === 'completado' ? 'Completado'       : p.estado === 'proceso' ? 'En Proceso'    : 'Pendiente';
    return '<div class="proj-card fade-up" style="animation-delay:' + (i*0.05) + 's">'
      + '<div style="display:flex;align-items:center;flex:1;min-width:0;gap:14px;" onclick="openProject(\'' + p.id + '\')">'
      + '<div class="proj-thumb">' + emojis[i % emojis.length] + '</div>'
      + '<div class="proj-info">'
      + '<div class="proj-name">' + p.nombre + '</div>'
      + '<div class="proj-owner">' + (p.propietario || 'Sin propietario') + '</div>'
      + '<div class="proj-budget">' + p.estructuras.length + ' estructura' + (p.estructuras.length!==1?'s':'') + ' · ' + mats + ' material' + (mats!==1?'es':'') + '</div>'
      + '</div>'
      + '<span class="proj-badge ' + badgeClass + '">' + badgeText + '</span>'
      + '</div>'
      + '<div class="proj-actions">'
      + '<button class="proj-action-btn" onclick="duplicateProject(\'' + p.id + '\')" title="Duplicar">⧉</button>'
      + '<button class="proj-action-btn" onclick="openEditProject(\'' + p.id + '\')" title="Editar">✏️</button>'
      + '<button class="proj-action-btn danger" onclick="openDeleteProject(\'' + p.id + '\')" title="Eliminar">🗑️</button>'
      + '</div></div>';
  }).join('');
}

// ═══════════════════════════════════════════
// PROJECT PAGE
// ═══════════════════════════════════════════
function openProject(id) {
  state.currentProjectId = id;
  goTo('screen-project');
  renderProjectPage();
}

function renderProjectPage() {
  var p = getProject(state.currentProjectId);
  if (!p) return;
  document.getElementById('proj-page-name').textContent  = p.nombre;
  document.getElementById('proj-page-owner').textContent = p.propietario || '';
  renderEstadoSelector(p);
  renderStructsSummary(p);
  renderCategoryList(p);
  document.getElementById('project-scroll').scrollTop = 0;
}

function renderEstadoSelector(p) {
  var estados = [
    { key:'pendiente',  label:'🕐 Pendiente'  },
    { key:'proceso',    label:'🔄 En Proceso'  },
    { key:'completado', label:'✅ Completado'  },
  ];
  var cur = p.estado || 'pendiente';
  document.getElementById('estado-selector').innerHTML = estados.map(function(e) {
    return '<button class="estado-chip ' + (cur===e.key ? 'active-'+e.key : '') + '" onclick="setEstado(\'' + e.key + '\')">' + e.label + '</button>';
  }).join('');
}

function setEstado(key) {
  var p = getProject(state.currentProjectId);
  if (!p) return;
  p.estado = key;
  renderEstadoSelector(p);
  dbSaveProject(p);
  renderHome();
  toast('Estado actualizado');
}

function renderStructsSummary(p) {
  var wrap = document.getElementById('structs-summary');
  if (!p.estructuras.length) {
    wrap.innerHTML =
      '<div class="structs-table-head"><span>Estructura</span><span>Cantidad</span><span></span></div>'
      + '<div class="structs-empty">No tienes estructuras, ¡agrégalas!</div>';
    return;
  }
  wrap.innerHTML =
    '<div class="structs-table-head"><span>Estructura</span><span>Cantidad</span><span></span></div>'
    + p.estructuras.map(function(s) {
      return '<div class="structs-table-row">'
        + '<div><div class="str-name">' + s.id + '</div><div class="str-cat">' + s.categoria + '</div></div>'
        + '<div class="str-qty-cell">'
        + '<button class="qty-mini-btn" onclick="changeQty(\'' + s.id + '\',-1)">−</button>'
        + '<span class="qty-num">' + s.cantidad + '</span>'
        + '<button class="qty-mini-btn" onclick="changeQty(\'' + s.id + '\',1)">+</button>'
        + '</div>'
        + '<button class="str-del-btn" onclick="removeStruct(\'' + s.id + '\')">✕</button>'
        + '</div>';
    }).join('');
}

function changeQty(sid, delta) {
  var p = getProject(state.currentProjectId);
  var s = p.estructuras.find(function(x) { return x.id === sid; });
  if (!s) return;
  s.cantidad = Math.max(1, s.cantidad + delta);
  save();
  renderStructsSummary(p);
  var disp = document.getElementById('qty-disp-' + sid);
  if (disp) { disp.textContent = s.cantidad; disp.classList.add('has-value'); }
}

function removeStruct(sid) {
  var p = getProject(state.currentProjectId);
  p.estructuras = p.estructuras.filter(function(x) { return x.id !== sid; });
  save();
  renderStructsSummary(p);
  var disp = document.getElementById('qty-disp-' + sid);
  if (disp) { disp.textContent = '0'; disp.classList.remove('has-value'); }
}

function renderCategoryList(p) {
  var cats = {};
  state.structures.forEach(function(s) {
    if (!cats[s.categoria]) cats[s.categoria] = [];
    cats[s.categoria].push(s);
  });
  var list = document.getElementById('cat-list');
  if (!Object.keys(cats).length) {
    list.innerHTML =
      '<div class="empty-state"><div class="empty-icon">🗄️</div>'
      + '<div class="empty-title">Sin estructuras cargadas</div>'
      + '<div class="empty-sub">El archivo estructuras.csv se carga automáticamente.<br>Asegúrate de abrir la app con Live Server.</div></div>';
    return;
  }
  list.innerHTML = Object.keys(cats).map(function(cat) {
    var structs  = cats[cat];
    var selCount = p.estructuras.filter(function(s) {
      return structs.find(function(x) { return x.id === s.id; });
    }).length;
    var slug = slugify(cat);
    return '<div class="cat-group" id="catg-' + slug + '">'
      + '<div class="cat-header" onclick="toggleCat(\'catg-' + slug + '\')">'
      + '<div class="cat-header-left"><span class="cat-name">' + cat + '</span>'
      + (selCount > 0 ? '<span class="cat-count">' + selCount + ' sel.</span>' : '')
      + '</div><span class="cat-chevron">▼</span></div>'
      + '<div class="cat-items">'
      + structs.map(function(s) {
          var sel = p.estructuras.find(function(x) { return x.id === s.id; });
          var qty = sel ? sel.cantidad : 0;
          return '<div class="struct-row">'
            + '<div><div class="struct-row-name">' + s.id + '</div>'
            + '<div class="struct-row-mats">' + s.materiales.length + ' materiales</div></div>'
            + '<div class="struct-row-ctrl">'
            + '<button class="qty-btn" onclick="catQty(\'' + s.id + '\',\'' + cat.replace(/'/g,"\\'") + '\',-1)">−</button>'
            + '<span class="qty-display ' + (qty>0?'has-value':'') + '" id="qty-disp-' + s.id + '">' + qty + '</span>'
            + '<button class="qty-btn" onclick="catQty(\'' + s.id + '\',\'' + cat.replace(/'/g,"\\'") + '\',1)">+</button>'
            + '</div></div>';
        }).join('')
      + '</div></div>';
  }).join('');
}

function slugify(s) { return s.replace(/[^a-zA-Z0-9]/g, '_'); }

function filterCatList(query) {
  var q = query.trim().toLowerCase();
  var p = getProject(state.currentProjectId);
  if (!p) return;
  if (!q) { renderCategoryList(p); return; }
  var cats = {};
  state.structures.forEach(function(s) {
    if (s.id.toLowerCase().indexOf(q) >= 0 || s.categoria.toLowerCase().indexOf(q) >= 0) {
      if (!cats[s.categoria]) cats[s.categoria] = [];
      cats[s.categoria].push(s);
    }
  });
  var list = document.getElementById('cat-list');
  if (!Object.keys(cats).length) {
    list.innerHTML = '<div style="text-align:center;padding:32px;color:var(--label4);font-size:14px;">Sin resultados</div>';
    return;
  }
  list.innerHTML = Object.keys(cats).map(function(cat) {
    var structs = cats[cat];
    var slug = slugify(cat);
    return '<div class="cat-group open" id="catg-' + slug + '">'
      + '<div class="cat-header" onclick="toggleCat(\'catg-' + slug + '\')">'
      + '<div class="cat-header-left"><span class="cat-name">' + cat + '</span></div>'
      + '<span class="cat-chevron">▼</span></div>'
      + '<div class="cat-items">'
      + structs.map(function(s) {
          var sel = p.estructuras.find(function(x){ return x.id === s.id; });
          var qty = sel ? sel.cantidad : 0;
          return '<div class="struct-row">'
            + '<div><div class="struct-row-name">' + s.id + '</div>'
            + '<div class="struct-row-mats">' + s.materiales.length + ' materiales</div></div>'
            + '<div class="struct-row-ctrl">'
            + '<button class="qty-btn" onclick="catQty(\'' + s.id + '\',\'' + cat.replace(/'/g,"\\'") + '\',-1)">−</button>'
            + '<span class="qty-display ' + (qty>0?'has-value':'') + '" id="qty-disp-' + s.id + '">' + qty + '</span>'
            + '<button class="qty-btn" onclick="catQty(\'' + s.id + '\',\'' + cat.replace(/'/g,"\\'") + '\',1)">+</button>'
            + '</div></div>';
        }).join('')
      + '</div></div>';
  }).join('');
}

function toggleCat(id) {
  var el = document.getElementById(id);
  if (el) el.classList.toggle('open');
}

function catQty(sid, catName, delta) {
  var p = getProject(state.currentProjectId);
  var s = p.estructuras.find(function(x) { return x.id === sid; });
  var struct = state.structures.find(function(x) { return x.id === sid; });
  if (!struct) return;
  if (!s) {
    if (delta < 0) return;
    s = { id: sid, categoria: catName, cantidad: 0 };
    p.estructuras.push(s);
  }
  s.cantidad = Math.max(0, s.cantidad + delta);
  if (s.cantidad === 0) p.estructuras = p.estructuras.filter(function(x) { return x.id !== sid; });
  save();
  var disp = document.getElementById('qty-disp-' + sid);
  if (disp) {
    disp.textContent = s.cantidad || 0;
    disp.classList.toggle('has-value', (s.cantidad || 0) > 0);
  }
  renderStructsSummary(p);
}

// ═══════════════════════════════════════════
// MATERIALS PAGE
// ═══════════════════════════════════════════
function calcMaterials(p) {
  var totals = {};
  p.estructuras.forEach(function(sel) {
    var struct = state.structures.find(function(s) { return s.id === sel.id; });
    if (!struct) return;
    struct.materiales.forEach(function(m) {
      var key = m.nombre + '||' + m.unidad;
      if (!totals[key]) totals[key] = { nombre: m.nombre, unidad: m.unidad, cantidad: 0, precio: m.precio || null };
      totals[key].cantidad += m.cantidad * sel.cantidad;
      if (m.precio && !totals[key].precio) totals[key].precio = m.precio;
    });
  });
  return Object.values(totals).sort(function(a,b){ return a.nombre.localeCompare(b.nombre); });
}

function goToMaterials() {
  var p = getProject(state.currentProjectId);
  if (!p || !p.estructuras.length) { toast('Agrega estructuras primero'); return; }
  var mats = calcMaterials(p);
  document.getElementById('mat-proj-name').textContent  = p.nombre;
  document.getElementById('mat-proj-owner').textContent = p.propietario || '';
  var hasPrices  = mats.some(function(m) { return m.precio; });
  var fmtNum     = function(n) { return n % 1 === 0 ? n : n.toFixed(2); };
  var fmtMoney   = function(n) { return n == null ? null : '$' + n.toLocaleString('es',{minimumFractionDigits:2,maximumFractionDigits:2}); };
  var grandTotal = 0;
  mats.forEach(function(m) { if (m.precio) grandTotal += m.precio * m.cantidad; });

  if (hasPrices) {
    document.getElementById('mat-table').innerHTML =
      '<div class="mat-table-head-cost"><span>Material</span><span>Cant.</span><span>P. Unit.</span><span>Total</span></div>'
      + mats.map(function(m) {
          var total = m.precio ? m.precio * m.cantidad : null;
          return '<div class="mat-row-cost">'
            + '<div><div class="mat-name">' + m.nombre + '</div><div class="mat-unit">' + m.unidad + '</div></div>'
            + '<div class="mat-qty" style="text-align:right">' + fmtNum(m.cantidad) + '</div>'
            + (m.precio ? '<div class="mat-cost-unit-price">' + fmtMoney(m.precio) + '</div>' : '<div class="mat-no-price">—</div>')
            + (total    ? '<div class="mat-cost-total">'      + fmtMoney(total)    + '</div>' : '<div class="mat-no-price">—</div>')
            + '</div>';
        }).join('')
      + (grandTotal > 0
          ? '<div class="mat-grand-total"><span class="mat-grand-label">Presupuesto total estimado</span><span class="mat-grand-value">' + fmtMoney(grandTotal) + '</span></div>'
          : '');
  } else {
    document.getElementById('mat-table').innerHTML =
      '<div class="mat-table-head"><span>Materiales</span><span style="text-align:right">Cantidades</span></div>'
      + mats.map(function(m) {
          return '<div class="mat-row">'
            + '<div><div class="mat-name">' + m.nombre + '</div><div class="mat-unit">' + m.unidad + '</div></div>'
            + '<div><div class="mat-qty">' + fmtNum(m.cantidad) + '</div><div class="mat-qty-unit">' + m.unidad + '</div></div>'
            + '</div>';
        }).join('');
  }

  document.getElementById('mat-summary-card').innerHTML =
    '<div class="mat-summary">'
    + '<div><div class="mat-sum-label">Total materiales</div><div class="mat-sum-value">' + mats.length + ' tipos</div></div>'
    + (grandTotal > 0
        ? '<div style="text-align:right"><div class="mat-sum-label">Presupuesto est.</div><div class="mat-sum-value" style="color:var(--green)">' + fmtMoney(grandTotal) + '</div></div>'
        : '<div style="text-align:right"><div class="mat-sum-label">Estructuras</div><div class="mat-sum-value">' + p.estructuras.length + ' en proyecto</div></div>'
      )
    + '</div>';
  goTo('screen-materials');
}

// ═══════════════════════════════════════════
// PDF EXPORT
// ═══════════════════════════════════════════
function exportPDF() {
  var p = getProject(state.currentProjectId);
  if (!p) return;
  var mats = calcMaterials(p);
  if (!mats.length) { toast('No hay materiales para exportar'); return; }
  var jsPDF      = window.jspdf.jsPDF;
  var doc        = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
  var W          = doc.internal.pageSize.getWidth();
  var H          = doc.internal.pageSize.getHeight();
  var hasPrices  = mats.some(function(m) { return m.precio; });
  var fmtMoney   = function(n) { return n==null ? '—' : '$'+n.toLocaleString('es',{minimumFractionDigits:2,maximumFractionDigits:2}); };
  var fmtNum     = function(n) { return n%1===0 ? String(n) : n.toFixed(2); };
  var grandTotal = 0;
  if (hasPrices) mats.forEach(function(m) { if (m.precio) grandTotal += m.precio * m.cantidad; });

  doc.setFillColor(28,28,30); doc.rect(0,0,W,42,'F');
  doc.setFillColor(0,122,255); doc.rect(0,42,W,2,'F');
  doc.setFontSize(18); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255);
  doc.text('INVECTA', 14, 18);
  doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(150,150,160);
  doc.text('Sistema de Gestión de Proyectos Eléctricos', 14, 26);
  doc.setFontSize(8); doc.setTextColor(120,120,130);
  doc.text('Lista de Materiales', W-14, 20, {align:'right'});
  doc.text(new Date().toLocaleDateString('es-HN',{day:'2-digit',month:'long',year:'numeric'}), W-14, 28, {align:'right'});
  if (state.profile && state.profile.engineerCode) {
    doc.setFontSize(7.5); doc.setTextColor(120,120,130);
    doc.text('Ing. '+(state.profile.displayName||'')+'  |  Código: '+state.profile.engineerCode, W-14, 36, {align:'right'});
  }

  doc.setFillColor(248,248,252); doc.roundedRect(10,48,W-20,32,3,3,'F');
  doc.setFontSize(15); doc.setFont('helvetica','bold'); doc.setTextColor(28,28,30);
  doc.text(p.nombre, 18, 60);
  doc.setFontSize(8.5); doc.setFont('helvetica','normal'); doc.setTextColor(90,90,100);
  var line1 = (p.propietario ? 'Propietario: '+p.propietario+'   ' : '')
    + 'Estado: '+(p.estado==='completado'?'Completado':p.estado==='proceso'?'En Proceso':'Pendiente');
  doc.text(line1, 18, 68);
  doc.text(p.estructuras.length+' estructuras  ·  '+mats.length+' tipos de materiales', 18, 75);

  var y = 88;
  doc.setFontSize(7.5); doc.setFont('helvetica','bold'); doc.setTextColor(120,120,130);
  doc.text('ESTRUCTURAS DEL PROYECTO', 14, y); y += 5;
  var chipX = 14;
  doc.setFontSize(7.5); doc.setFont('helvetica','normal');
  p.estructuras.forEach(function(s) {
    var label = s.id+' ×'+s.cantidad;
    var tw = doc.getTextWidth(label)+8;
    if (chipX+tw > W-14) { chipX=14; y+=8; }
    doc.setFillColor(240,245,255); doc.setDrawColor(200,215,240);
    doc.roundedRect(chipX, y-4.5, tw, 6.5, 1.5, 1.5, 'FD');
    doc.setTextColor(40,80,160);
    doc.text(label, chipX+4, y);
    chipX += tw+4;
  });
  y += 12;

  doc.setFontSize(7.5); doc.setFont('helvetica','bold'); doc.setTextColor(120,120,130);
  doc.text('LISTA DE MATERIALES', 14, y); y += 3;
  var tableHead = hasPrices ? [['#','Material','Unidad','Cant.','P. Unit.','Total']] : [['#','Material','Unidad','Cantidad']];
  var tableBody = mats.map(function(m,i) {
    return hasPrices
      ? [i+1,m.nombre,m.unidad,fmtNum(m.cantidad),m.precio?fmtMoney(m.precio):'—',m.precio?fmtMoney(m.precio*m.cantidad):'—']
      : [i+1,m.nombre,m.unidad,fmtNum(m.cantidad)];
  });
  doc.autoTable({
    startY:y, head:tableHead, body:tableBody, theme:'grid',
    headStyles:{fillColor:[28,28,30],textColor:[255,255,255],fontStyle:'bold',fontSize:7.5,cellPadding:3},
    bodyStyles:{fontSize:7.5,textColor:[28,28,30],cellPadding:2.8},
    alternateRowStyles:{fillColor:[248,248,252]},
    columnStyles: hasPrices
      ? {0:{cellWidth:8,halign:'center'},2:{halign:'center'},3:{halign:'right',fontStyle:'bold'},4:{halign:'right'},5:{halign:'right',fontStyle:'bold',textColor:[34,139,34]}}
      : {0:{cellWidth:8,halign:'center'},2:{halign:'center'},3:{halign:'right',fontStyle:'bold'}},
    margin:{left:14,right:14},
    didDrawPage: function(data) {
      if (data.pageNumber > 1) {
        doc.setFillColor(28,28,30); doc.rect(0,0,W,14,'F');
        doc.setFontSize(7); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255);
        doc.text('INVECTA  —  '+p.nombre, 14, 9);
      }
    }
  });

  if (hasPrices && grandTotal > 0) {
    var fy = doc.lastAutoTable.finalY+4;
    doc.setFillColor(28,28,30); doc.roundedRect(14,fy,W-28,12,2,2,'F');
    doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(255,255,255);
    doc.text('Presupuesto Total Estimado', 20, fy+8);
    doc.setTextColor(100,220,130);
    doc.text(fmtMoney(grandTotal), W-20, fy+8, {align:'right'});
  }

  var pages = doc.internal.getNumberOfPages();
  for (var i=1; i<=pages; i++) {
    doc.setPage(i);
    doc.setFillColor(240,240,245); doc.rect(0,H-12,W,12,'F');
    doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(130,130,140);
    doc.text('Generado con Invecta  —  '+new Date().toLocaleString('es-HN'), 14, H-4.5);
    doc.text('Página '+i+' de '+pages, W-14, H-4.5, {align:'right'});
  }
  doc.save('Invecta_'+p.nombre.replace(/[^a-zA-Z0-9]/g,'_')+'.pdf');
  toast('PDF exportado ✓');
}

// ═══════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════
function toast(msg) {
  var wrap = document.getElementById('toast-wrap');
  var t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(function() {
    t.style.opacity = '0'; t.style.transition = 'opacity 0.3s';
    setTimeout(function() { t.remove(); }, 300);
  }, 2500);
}

// ═══════════════════════════════════════════
// PROFILE
// ═══════════════════════════════════════════
function openProfile() {
  if (!state.user || !state.profile) return;
  document.getElementById('profile-email-sub').textContent  = state.user.email;
  document.getElementById('profile-displayname').value      = state.profile.displayName  || '';
  document.getElementById('profile-code').value             = state.profile.engineerCode || '';
  var av = document.getElementById('profile-avatar-display');
  if (state.profile.avatarUrl) {
    av.innerHTML = '<img src="'+state.profile.avatarUrl+'" style="width:100%;height:100%;object-fit:cover;">';
  } else {
    av.textContent = (state.profile.displayName || '?').charAt(0).toUpperCase();
  }
  goTo('screen-profile');
}

function profilePicSelected(event) {
  var file = event.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    state.profile.avatarUrl = e.target.result;
    var av = document.getElementById('profile-avatar-display');
    av.innerHTML = '<img src="'+e.target.result+'" style="width:100%;height:100%;object-fit:cover;">';
    updateProfileUI();
  };
  reader.readAsDataURL(file);
}

function saveProfile() {
  if (!state.user) return;
  var displayName  = document.getElementById('profile-displayname').value.trim();
  var engineerCode = document.getElementById('profile-code').value.trim();
  if (!displayName) { toast('El nombre no puede estar vacío'); return; }

  // Update user in local storage
  var users = getUsers();
  var idx   = users.findIndex(function(u) { return u.id === state.user.id; });
  if (idx >= 0) {
    users[idx].displayName  = displayName;
    users[idx].engineerCode = engineerCode;
    users[idx].avatarUrl    = state.profile.avatarUrl || '';
    saveUsers(users);
    state.user = users[idx];
  }

  state.profile.displayName  = displayName;
  state.profile.engineerCode = engineerCode;
  updateProfileUI();
  toast('Perfil guardado ✓');
}

// ═══════════════════════════════════════════
// PROJECT DUPLICATION
// ═══════════════════════════════════════════
function duplicateProject(id) {
  var orig = getProject(id);
  if (!orig) return;
  var copy = {
    _new:        true,
    nombre:      orig.nombre + ' (copia)',
    descripcion: orig.descripcion || '',
    propietario: orig.propietario || '',
    estado:      'pendiente',
    estructuras: JSON.parse(JSON.stringify(orig.estructuras)),
  };
  var newId = dbSaveProject(copy);
  renderHome();
  toast('Proyecto duplicado ✓');
}

// ═══════════════════════════════════════════
// LIBRARIES SCREEN
// ═══════════════════════════════════════════
function renderLibrerias(query) {
  var q = (query||'').trim().toLowerCase();
  var structures = state.structures;
  if (q) {
    structures = structures.filter(function(s) {
      return s.id.toLowerCase().includes(q) ||
        s.categoria.toLowerCase().includes(q) ||
        s.materiales.some(function(m){ return m.nombre.toLowerCase().includes(q); });
    });
  }

  var allCats = {};
  state.structures.forEach(function(s) { allCats[s.categoria] = true; });
  document.getElementById('lib-stats').innerHTML =
    '<div class="lib-stat"><div class="lib-stat-val">'+state.structures.length+'</div><div class="lib-stat-label">Estructuras</div></div>'+
    '<div class="lib-stat"><div class="lib-stat-val">'+Object.keys(allCats).length+'</div><div class="lib-stat-label">Categorías</div></div>'+
    '<div class="lib-stat"><div class="lib-stat-val">'+countUniqueMaterials()+'</div><div class="lib-stat-label">Materiales</div></div>';

  var sub = document.getElementById('lib-sub');
  if (sub) sub.textContent = q
    ? structures.length+' resultado'+(structures.length!==1?'s':'')+' para "'+q+'"'
    : 'Base de datos de estructuras';

  var content = document.getElementById('lib-content');
  if (!structures.length) {
    content.innerHTML = '<div class="empty-state"><div class="empty-icon">🗄️</div><div class="empty-title">Sin resultados</div></div>';
    return;
  }
  content.innerHTML = structures.map(function(s, i) {
    return '<div class="lib-struct-card" id="lib-card-'+i+'">'
      + '<div class="lib-struct-header" onclick="toggleLibCard('+i+')">'
      + '<div><div class="lib-struct-id">'+s.id+'</div><div class="lib-struct-cat">'+s.categoria+'</div></div>'
      + '<span class="lib-struct-badge">'+s.materiales.length+' mat.</span></div>'
      + '<div class="lib-mat-list"><div class="lib-mat-head"><span>Material</span><span>Unidad</span><span>Cant.</span></div>'
      + s.materiales.map(function(m) {
          return '<div class="lib-mat-row">'
            +'<div class="lib-mat-name">'+m.nombre+'</div>'
            +'<div class="lib-mat-unit">'+m.unidad+'</div>'
            +'<div class="lib-mat-qty">'+m.cantidad+'</div></div>';
        }).join('')
      + '</div></div>';
  }).join('');
}

function toggleLibCard(i) {
  var el = document.getElementById('lib-card-'+i);
  if (el) el.classList.toggle('open');
}

function countUniqueMaterials() {
  var set = {};
  state.structures.forEach(function(s){ s.materiales.forEach(function(m){ set[m.nombre]=true; }); });
  return Object.keys(set).length;
}

// ═══════════════════════════════════════════
// CSV LOADER
// ═══════════════════════════════════════════
function parseCSVText(csvText) {
  var results = Papa.parse(csvText, { header:true, skipEmptyLines:true });
  var data = results.data;
  if (!data.length) return null;
  var col = function(variants) {
    for (var i=0; i<variants.length; i++) {
      var v = variants[i];
      var found = Object.keys(data[0]).find(function(k){ return k.toLowerCase().trim()===v; });
      if (found) return found;
    }
    return null;
  };
  var cEst = col(['estructura','code','codigo','id']);
  var cCat = col(['categoria','category','tipo','type']);
  var cMat = col(['material','materiales','mat']);
  var cUni = col(['unidad','unit','und']);
  var cCan = col(['cantidad','quantity','cant','qty']);
  if (!cEst || !cMat) return null;
  var structMap = {};
  data.forEach(function(row) {
    var id  = (row[cEst]||'').trim();
    var mat = (row[cMat]||'').trim();
    if (!id || !mat) return;
    var cat = cCat ? (row[cCat]||'Sin categoría').trim() : 'Sin categoría';
    var uni = cUni ? (row[cUni]||'pza').trim()           : 'pza';
    var can = cCan ? parseFloat(row[cCan])||1             : 1;
    if (!structMap[id]) structMap[id] = { id:id, categoria:cat, materiales:[] };
    structMap[id].materiales.push({ nombre:mat, unidad:uni, cantidad:can });
  });
  return Object.values(structMap);
}

async function loadCSV() {
  try {
    var resp   = await fetch('./estructuras.csv');
    if (!resp.ok) throw new Error('HTTP '+resp.status);
    var text   = await resp.text();
    var parsed = parseCSVText(text);
    if (parsed && parsed.length) {
      state.structures = parsed;
      lsSet(STORAGE_KEYS.structs, parsed);
      console.log('[Invecta] '+parsed.length+' estructuras cargadas desde CSV.');
      return;
    }
    throw new Error('CSV vacío');
  } catch(e) {
    console.warn('[Invecta] fetch CSV falló:', e.message);
    var cached = lsGet(STORAGE_KEYS.structs, []);
    if (cached.length) {
      state.structures = cached;
      console.log('[Invecta] '+cached.length+' estructuras desde caché.');
    }
  }
}

// ═══════════════════════════════════════════
// PDF ANALYZER (Subir Plano)
// ═══════════════════════════════════════════
var planoDetected = [];

function openSubirPlano() {
  var p = getProject(state.currentProjectId);
  if (!p) return;
  if (!state.structures.length) { toast('No hay estructuras cargadas'); return; }
  document.getElementById('plano-drop').style.display = '';
  document.getElementById('plano-file-input').value   = '';
  document.getElementById('plano-progress').classList.remove('visible');
  document.getElementById('plano-results').style.display = 'none';
  document.getElementById('plano-add-btn').style.display  = 'none';
  planoDetected = [];
  openDlg('dlg-plano');
}

function planoOnDragOver(e)  { e.preventDefault(); document.getElementById('plano-drop').classList.add('drag-over'); }
function planoOnDragLeave()  { document.getElementById('plano-drop').classList.remove('drag-over'); }
function planoOnDrop(e) {
  e.preventDefault();
  document.getElementById('plano-drop').classList.remove('drag-over');
  var file = e.dataTransfer.files[0];
  if (file) planoProcessFile(file);
}
function planoOnFileSelect(e) {
  var file = e.target.files[0];
  if (file) planoProcessFile(file);
}

function planoSetProgress(pct, label) {
  document.getElementById('plano-progress').classList.add('visible');
  document.getElementById('plano-progress-bar').style.width = pct+'%';
  document.getElementById('plano-progress-label').textContent = label;
}

async function planoProcessFile(file) {
  if (!file.name.toLowerCase().endsWith('.pdf')) { toast('Solo se aceptan archivos PDF'); return; }
  document.getElementById('plano-drop').style.display = 'none';
  planoSetProgress(10, 'Cargando PDF...');
  try {
    if (typeof pdfjsLib === 'undefined') throw new Error('PDF.js no cargado.');
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    var buf  = await file.arrayBuffer();
    planoSetProgress(25, 'Interpretando páginas...');
    var pdf  = await pdfjsLib.getDocument({ data:buf }).promise;
    var n    = pdf.numPages;
    var txt  = '';
    for (var i=1; i<=n; i++) {
      var page = await pdf.getPage(i);
      var tc   = await page.getTextContent();
      txt += ' ' + tc.items.map(function(x){ return x.str; }).join(' ');
      planoSetProgress(25+Math.round((i/n)*55), 'Leyendo página '+i+' de '+n+'...');
    }
    planoSetProgress(85, 'Buscando estructuras...');
    var matches = planoMatchStructures(txt);
    planoSetProgress(100, 'Listo.');
    setTimeout(function(){ planoShowResults(matches, txt); }, 400);
  } catch(err) {
    console.error(err);
    toast('Error: '+err.message);
    document.getElementById('plano-drop').style.display = '';
    document.getElementById('plano-progress').classList.remove('visible');
  }
}

function planoMatchStructures(text) {
  var norm = text.toUpperCase().replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ');
  var results = [];
  state.structures.forEach(function(s) {
    var id = s.id.toUpperCase();
    var count = 0;
    [id, id.replace(/-/g,' '), id.replace(/-/g,'')].forEach(function(v) {
      try {
        var esc = v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
        var re  = new RegExp('(?<![A-Z0-9])'+esc+'(?![A-Z0-9])','g');
        var f   = (norm.match(re)||[]).length;
        if (f > count) count = f;
      } catch(e) {}
    });
    if (count > 0) results.push({ struct:s, count:count });
  });
  results.sort(function(a,b){ return b.count!==a.count ? b.count-a.count : a.struct.id.localeCompare(b.struct.id); });
  return results;
}

function planoShowResults(matches, rawText) {
  planoDetected = matches;
  var container = document.getElementById('plano-results');
  container.style.display = '';
  var snippet = (rawText||'').trim().substring(0,2000)||'(sin texto)';
  if (!matches.length) {
    container.innerHTML = '<div class="plano-no-results">'
      +'<div style="font-size:32px;margin-bottom:8px;">🔍</div>'
      +'<strong>No se detectaron estructuras</strong><br>'
      +'<div class="plano-raw-wrap"><button class="plano-raw-toggle" onclick="toggleRaw()">Ver texto ▾</button>'
      +'<div class="plano-raw-text" id="plano-raw" style="display:none">'+snippet+'</div></div></div>';
    document.getElementById('plano-add-btn').style.display = 'none';
    return;
  }
  var html = '<div class="plano-results-title"><span class="plano-badge">'+matches.length+'</span>&nbsp;Estructuras detectadas</div>';
  matches.forEach(function(m,idx) {
    html += '<label class="plano-struct-check">'
      +'<input type="checkbox" id="plano-chk-'+idx+'" checked>'
      +'<div class="plano-struct-info"><div class="plano-struct-name">'+m.struct.id+'</div>'
      +'<div class="plano-struct-cat">'+m.struct.categoria+' · '+m.struct.materiales.length+' materiales</div></div>'
      +'<div class="plano-struct-qty"><span class="plano-qty-label">Cant.</span>'
      +'<input class="plano-qty-input" id="plano-qty-'+idx+'" type="number" min="1" value="'+m.count+'"></div></label>';
  });
  html += '<div class="plano-raw-wrap"><button class="plano-raw-toggle" onclick="toggleRaw()">Ver texto ▾</button>'
    +'<div class="plano-raw-text" id="plano-raw" style="display:none">'+snippet+'</div></div>';
  container.innerHTML = html;
  document.getElementById('plano-add-btn').style.display = '';
}

function toggleRaw() {
  var el = document.getElementById('plano-raw');
  if (el) el.style.display = (el.style.display==='block') ? 'none' : 'block';
}

async function planoAddSelected() {
  var p = getProject(state.currentProjectId);
  if (!p) return;
  var added = 0;
  planoDetected.forEach(function(m, idx) {
    var chk = document.getElementById('plano-chk-'+idx);
    var qty = Math.max(1, parseInt((document.getElementById('plano-qty-'+idx)||{}).value)||1);
    if (!chk||!chk.checked) return;
    var ex = p.estructuras.find(function(x){ return x.id===m.struct.id; });
    if (ex) { ex.cantidad += qty; } else { p.estructuras.push({id:m.struct.id,categoria:m.struct.categoria,cantidad:qty}); }
    added++;
  });
  closeDlg('dlg-plano');
  save();
  renderProjectPage();
  toast(added+' estructura'+(added!==1?'s':'')+' agregada'+(added!==1?'s':'')+' ✓');
}

// ═══════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════
async function init() {
  await loadCSV();

  // Check for saved session
  var savedUserId = lsGet(STORAGE_KEYS.user, null);
  if (savedUserId) {
    var users = getUsers();
    var found = users.find(function(u) { return u.id === savedUserId; });
    if (found) { enterApp(found); return; }
  }
  goTo('screen-login');
}

init();

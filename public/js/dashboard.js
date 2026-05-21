const API = '';
const DAYS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

let token = null;
let allPatients = [];

async function apiFetch(path, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers || {}) }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error del servidor');
  return data;
}

function showE(id, msg) { const e = document.getElementById(id); e.textContent = msg; e.classList.remove('hidden'); }
function hideE(id) { document.getElementById(id).classList.add('hidden'); }
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ── LOGIN ──────────────────────────────────────────────
document.getElementById('btn-login').addEventListener('click', async () => {
  hideE('login-error');
  const pin = document.getElementById('login-pin').value;
  if (!pin) { showE('login-error', 'Ingresa el PIN'); return; }
  try {
    const data = await apiFetch('/api/auth/login', { method: 'POST', headers: {}, body: JSON.stringify({ pin }) });
    token = data.token;
    enterApp();
  } catch (err) { showE('login-error', err.message); }
});
document.getElementById('login-pin').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('btn-login').click(); });
document.getElementById('btn-logout').addEventListener('click', () => {
  token = null;
  document.getElementById('app-screen').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
});

function enterApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'block';
  const d = new Date();
  document.getElementById('topbar-date').textContent = `${DAYS[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
  loadAll();
}

// ── TABS ──────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
    if (tab.dataset.tab === 'history') loadHistory();
  });
});

// ── LOAD ALL ─────────────────────────────────────────
async function loadAll() {
  await Promise.all([loadOrders(), loadPatients()]);
}

// ── ÓRDENES ──────────────────────────────────────────
async function loadOrders() {
  try {
    const orders = await apiFetch('/api/orders?status=active');
    const patients = await apiFetch('/api/patients');

    document.getElementById('st-active').textContent = orders.length;
    document.getElementById('st-patients').textContent = patients.length;
    const urgents = orders.filter(o => o.last_call?.urgent_flag);
    document.getElementById('st-urgent').textContent = urgents.length;

    const tbody = document.getElementById('orders-tbody');
    if (orders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#a0aec0;padding:20px;">No hay órdenes activas</td></tr>';
      return;
    }

    tbody.innerHTML = orders.map(o => {
      const callsDone = o.calls_completed;
      const totalCalls = Math.ceil(o.eta_minutes / o.call_interval_minutes);
      const urgent = o.last_call?.urgent_flag;
      return `
        <tr>
          <td><strong>${o.patient_name}</strong>${o.patient_age ? `<br><span class="text-gray">${o.patient_age} años</span>` : ''}</td>
          <td style="max-width:180px;font-size:12px;color:#4a5568;">${o.patient_condition || '—'}</td>
          <td style="font-size:13px;">${o.crew_name}</td>
          <td><span class="badge badge-active">~${o.eta_minutes} min</span></td>
          <td>
            <span class="${urgent ? 'badge badge-urgent' : 'badge badge-pending'}">${callsDone}/${totalCalls}</span>
          </td>
          <td style="font-size:12px;color:#718096;">${o.last_call ? o.last_call.started_at.substring(11,16) : '<span style="color:#a0aec0;">Ninguna aún</span>'}</td>
          <td>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button class="btn btn-primary btn-sm" onclick="openCall(${o.id})">📞 Simular llamada</button>
              <button class="btn btn-outline btn-sm" onclick="completeOrder(${o.id})">✓ Completar</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) { console.error(err); }
}

async function completeOrder(id) {
  if (!confirm('¿Marcar esta orden como completada?')) return;
  await apiFetch(`/api/orders/${id}/complete`, { method: 'PATCH' });
  loadOrders();
  loadHistory();
}

function openCall(orderId) {
  window.open(`/call.html?order=${orderId}&token=${token}`, '_blank', 'width=680,height=820');
}

// ── HISTORIAL ────────────────────────────────────────
async function loadHistory() {
  try {
    const orders = await apiFetch('/api/orders?status=completed');
    document.getElementById('st-done').textContent = orders.length;
    const tbody = document.getElementById('history-tbody');
    if (orders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#a0aec0;padding:20px;">Sin historial aún</td></tr>';
      return;
    }
    tbody.innerHTML = orders.map(o => `
      <tr>
        <td><strong>${o.patient_name}</strong></td>
        <td style="font-size:12px;">${o.patient_condition || '—'}</td>
        <td style="font-size:13px;">${o.crew_name}</td>
        <td>${o.calls_completed} llamada(s)</td>
        <td style="font-size:12px;color:#718096;">${o.completed_at?.substring(0,16) || '—'}</td>
        <td><button class="btn btn-outline btn-sm" onclick="viewTranscripts(${o.id})">Ver transcripción</button></td>
      </tr>
    `).join('');
  } catch (err) { console.error(err); }
}

async function viewTranscripts(orderId) {
  try {
    const order = await apiFetch(`/api/orders/${orderId}`);
    document.getElementById('transcript-title').textContent = `Transcripción – ${order.patient_name}`;
    const body = document.getElementById('transcript-body');

    if (!order.calls || order.calls.length === 0) {
      body.innerHTML = '<p style="color:#a0aec0;text-align:center;padding:20px;">Sin llamadas registradas</p>';
    } else {
      body.innerHTML = order.calls.map(call => {
        const messages = JSON.parse(call.transcript || '[]');
        const msgHtml = messages.filter(m => !m.content.startsWith('[INICIO')).map(m => `
          <div style="margin-bottom:10px;display:flex;gap:10px;align-items:flex-start;flex-direction:${m.role === 'assistant' ? 'row' : 'row-reverse'};">
            <div style="flex-shrink:0;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;background:${m.role === 'assistant' ? '#ebf8ff' : '#f0fff4'};">
              ${m.role === 'assistant' ? '🤖' : '👤'}
            </div>
            <div style="background:${m.role === 'assistant' ? '#ebf8ff' : '#f0fff4'};border-radius:12px;padding:10px 14px;max-width:85%;font-size:13px;line-height:1.5;">
              ${m.content}
            </div>
          </div>
        `).join('');
        return `
          <div style="margin-bottom:20px;">
            <div style="font-weight:700;color:#0D4F8B;margin-bottom:10px;font-size:14px;">
              Llamada ${call.call_number} – ${call.started_at?.substring(11,16) || ''}
              ${call.urgent_flag ? '<span class="badge badge-urgent" style="margin-left:8px;">⚠️ URGENTE</span>' : ''}
            </div>
            ${msgHtml || '<p style="color:#a0aec0;font-size:13px;">Sin mensajes</p>'}
          </div>
        `;
      }).join('<hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0;">');
    }

    openModal('modal-transcript');
  } catch (err) { alert(err.message); }
}

document.getElementById('btn-transcript-close').addEventListener('click', () => closeModal('modal-transcript'));

// ── PACIENTES ────────────────────────────────────────
async function loadPatients() {
  try {
    allPatients = await apiFetch('/api/patients');
    renderPatients(allPatients);
    populatePatientSelect(allPatients);
  } catch (err) { console.error(err); }
}

function renderPatients(list) {
  const tbody = document.getElementById('patients-tbody');
  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#a0aec0;padding:20px;">No hay pacientes registrados</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(p => `
    <tr>
      <td><strong>${p.name}</strong></td>
      <td>${p.age || '—'}</td>
      <td style="font-family:monospace;font-size:12px;">${p.id_number || '—'}</td>
      <td style="font-size:12px;max-width:200px;">${p.condition || '—'}</td>
      <td>${p.phone || '—'}</td>
      <td><button class="btn btn-outline btn-sm" onclick="editPatient(${p.id})">Editar</button></td>
    </tr>
  `).join('');
}

document.getElementById('patient-search').addEventListener('input', function () {
  const q = this.value.toLowerCase();
  renderPatients(allPatients.filter(p =>
    p.name.toLowerCase().includes(q) || (p.id_number || '').includes(q)
  ));
});

function populatePatientSelect(patients) {
  const sel = document.getElementById('ord-patient');
  sel.innerHTML = '<option value="">— Selecciona paciente —</option>' +
    patients.map(p => `<option value="${p.id}">${p.name}${p.age ? ` (${p.age} años)` : ''}</option>`).join('');
}

// ── MODAL PACIENTE ────────────────────────────────────
document.getElementById('btn-new-patient').addEventListener('click', () => openPatientModal());
document.getElementById('btn-patient-cancel').addEventListener('click', () => closeModal('modal-patient'));

function openPatientModal(patient = null) {
  hideE('patient-error');
  document.getElementById('patient-modal-title').textContent = patient ? 'Editar paciente' : 'Nuevo paciente';
  ['pat-id','pat-name','pat-age','pat-id-num','pat-phone','pat-blood',
   'pat-ec-name','pat-ec-phone','pat-condition','pat-meds','pat-allergies','pat-instructions']
    .forEach(id => {
      const el = document.getElementById(id);
      const key = {
        'pat-id':'id','pat-name':'name','pat-age':'age','pat-id-num':'id_number',
        'pat-phone':'phone','pat-blood':'blood_type','pat-ec-name':'emergency_contact_name',
        'pat-ec-phone':'emergency_contact_phone','pat-condition':'condition',
        'pat-meds':'medications','pat-allergies':'allergies','pat-instructions':'special_instructions'
      }[id];
      el.value = patient ? (patient[key] || '') : '';
    });
  openModal('modal-patient');
}

async function editPatient(id) {
  try {
    const p = await apiFetch(`/api/patients/${id}`);
    openPatientModal(p);
  } catch (err) { alert(err.message); }
}

document.getElementById('btn-patient-save').addEventListener('click', async () => {
  hideE('patient-error');
  const id = document.getElementById('pat-id').value;
  const body = {
    name: document.getElementById('pat-name').value.trim(),
    age: parseInt(document.getElementById('pat-age').value) || null,
    id_number: document.getElementById('pat-id-num').value.trim() || null,
    phone: document.getElementById('pat-phone').value.trim() || null,
    blood_type: document.getElementById('pat-blood').value.trim() || null,
    emergency_contact_name: document.getElementById('pat-ec-name').value.trim() || null,
    emergency_contact_phone: document.getElementById('pat-ec-phone').value.trim() || null,
    condition: document.getElementById('pat-condition').value.trim() || null,
    medications: document.getElementById('pat-meds').value.trim() || null,
    allergies: document.getElementById('pat-allergies').value.trim() || null,
    special_instructions: document.getElementById('pat-instructions').value.trim() || null,
  };
  if (!body.name) { showE('patient-error', 'El nombre es requerido'); return; }

  const btn = document.getElementById('btn-patient-save');
  btn.innerHTML = '<span class="spinner"></span>'; btn.disabled = true;
  try {
    if (id) {
      await apiFetch(`/api/patients/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    } else {
      await apiFetch('/api/patients', { method: 'POST', body: JSON.stringify(body) });
    }
    closeModal('modal-patient');
    await loadPatients();
  } catch (err) { showE('patient-error', err.message); }
  finally { btn.textContent = 'Guardar paciente'; btn.disabled = false; }
});

// ── MODAL ORDEN ───────────────────────────────────────
document.getElementById('btn-new-order').addEventListener('click', () => {
  hideE('order-error'); hideE('patient-preview');
  document.getElementById('ord-patient').value = '';
  document.getElementById('ord-crew').value = '';
  document.getElementById('ord-eta').value = '30';
  document.getElementById('ord-interval').value = '10';
  document.getElementById('ord-notes').value = '';
  openModal('modal-order');
});
document.getElementById('btn-order-cancel').addEventListener('click', () => closeModal('modal-order'));

document.getElementById('ord-patient').addEventListener('change', function () {
  const p = allPatients.find(p => String(p.id) === this.value);
  const preview = document.getElementById('patient-preview');
  if (p) {
    preview.innerHTML = `<strong>${p.name}</strong>${p.age ? ` · ${p.age} años` : ''}<br>
      ${p.condition ? `<b>Condición:</b> ${p.condition}<br>` : ''}
      ${p.medications ? `<b>Medicamentos:</b> ${p.medications}<br>` : ''}
      ${p.allergies ? `<b>Alergias:</b> ${p.allergies}` : ''}`;
    preview.classList.remove('hidden');
  } else {
    preview.classList.add('hidden');
  }
});

document.getElementById('btn-order-save').addEventListener('click', async () => {
  hideE('order-error');
  const patient_id = document.getElementById('ord-patient').value;
  if (!patient_id) { showE('order-error', 'Selecciona un paciente'); return; }

  const body = {
    patient_id: parseInt(patient_id),
    crew_name: document.getElementById('ord-crew').value.trim() || 'Tripulación asignada',
    eta_minutes: parseInt(document.getElementById('ord-eta').value) || 30,
    call_interval_minutes: parseInt(document.getElementById('ord-interval').value) || 10,
    notes: document.getElementById('ord-notes').value.trim() || null,
  };

  const btn = document.getElementById('btn-order-save');
  btn.innerHTML = '<span class="spinner"></span>'; btn.disabled = true;
  try {
    const result = await apiFetch('/api/orders', { method: 'POST', body: JSON.stringify(body) });
    closeModal('modal-order');
    await loadOrders();
    if (confirm('¿Deseas iniciar la primera llamada simulada ahora?')) {
      openCall(result.id);
    }
  } catch (err) { showE('order-error', err.message); }
  finally { btn.textContent = 'Despachar y programar llamadas'; btn.disabled = false; }
});

// Cerrar modales al clicar fuera
document.querySelectorAll('.modal-overlay').forEach(o => {
  o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); });
});

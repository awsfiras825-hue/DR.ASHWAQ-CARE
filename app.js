const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentRole = 'employee';
let patients = [];

const patientsBody = document.getElementById('patientsBody');
const emptyState = document.getElementById('emptyState');
const toast = document.getElementById('toast');
const modal = document.getElementById('patientModal');

function showToast(msg){
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

async function init(){
  const { data: { session } } = await supa.auth.getSession();
  if (!session){ window.location.href = 'index.html'; return; }
  currentUser = session.user;

  let { data: profile, error } = await supa
    .from('profiles')
    .select('full_name, role')
    .eq('id', currentUser.id)
    .maybeSingle();

  if (!profile){
    const meta = currentUser.user_metadata || {};
    await supa.from('profiles').insert({
      id: currentUser.id,
      full_name: meta.full_name || currentUser.email,
      role: 'employee'
    });
    profile = { full_name: meta.full_name || currentUser.email, role: 'employee' };
  }

  currentRole = profile.role || 'employee';
  const badge = currentRole === 'admin'
    ? '<span class="badge badge-admin">أدمن</span>'
    : '<span class="badge badge-employee">موظف</span>';
  document.getElementById('whoBox').innerHTML =
    `${profile.full_name || currentUser.email}<br>${badge}`;

  await loadPatients();
}

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await supa.auth.signOut();
  window.location.href = 'index.html';
});

async function loadPatients(){
  const { data, error } = await supa
    .from('patients')
    .select('*')
    .order('created_at', { ascending: false });

  if (error){ showToast('خطأ بتحميل البيانات: ' + error.message); return; }
  patients = data || [];
  renderPatients(patients);
}

function renderPatients(list){
  patientsBody.innerHTML = '';
  emptyState.style.display = list.length ? 'none' : 'block';

  list.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="الاسم">${escapeHtml(p.full_name)}</td>
      <td data-label="الهاتف">${escapeHtml(p.phone || '—')}</td>
      <td data-label="العمر">${p.age ?? '—'}</td>
      <td data-label="آخر زيارة">${p.last_visit || '—'}</td>
      <td data-label="الموعد القادم">${p.next_appointment || '—'}</td>
      <td>
        <div class="row-actions">
          <button class="btn btn-ghost btn-sm" data-edit="${p.id}">تعديل</button>
          <button class="btn btn-danger btn-sm" data-del="${p.id}">حذف</button>
        </div>
      </td>`;
    patientsBody.appendChild(tr);
  });

  patientsBody.querySelectorAll('[data-edit]').forEach(btn =>
    btn.addEventListener('click', () => openModal(btn.dataset.edit)));
  patientsBody.querySelectorAll('[data-del]').forEach(btn =>
    btn.addEventListener('click', () => deletePatient(btn.dataset.del)));
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

document.getElementById('searchInput').addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  const filtered = patients.filter(p =>
    (p.full_name || '').toLowerCase().includes(q) ||
    (p.phone || '').includes(q));
  renderPatients(filtered);
});

document.getElementById('addPatientBtn').addEventListener('click', () => openModal());
document.getElementById('cancelModalBtn').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

function openModal(id){
  document.getElementById('patientForm').reset();
  document.getElementById('patientId').value = '';
  document.getElementById('modalTitle').textContent = id ? 'تعديل بيانات مريض' : 'إضافة مريض جديد';

  if (id){
    const p = patients.find(x => String(x.id) === String(id));
    if (p){
      document.getElementById('patientId').value = p.id;
      document.getElementById('p_full_name').value = p.full_name || '';
      document.getElementById('p_phone').value = p.phone || '';
      document.getElementById('p_age').value = p.age ?? '';
      document.getElementById('p_gender').value = p.gender || '';
      document.getElementById('p_last_visit').value = p.last_visit || '';
      document.getElementById('p_next_appointment').value = p.next_appointment || '';
      document.getElementById('p_notes').value = p.medical_notes || '';
    }
  }
  modal.classList.add('show');
}
function closeModal(){ modal.classList.remove('show'); }

document.getElementById('patientForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('patientId').value;
  const payload = {
    full_name: document.getElementById('p_full_name').value.trim(),
    phone: document.getElementById('p_phone').value.trim(),
    age: document.getElementById('p_age').value ? Number(document.getElementById('p_age').value) : null,
    gender: document.getElementById('p_gender').value,
    last_visit: document.getElementById('p_last_visit').value || null,
    next_appointment: document.getElementById('p_next_appointment').value || null,
    medical_notes: document.getElementById('p_notes').value.trim(),
  };

  let error;
  if (id){
    ({ error } = await supa.from('patients').update(payload).eq('id', id));
  } else {
    payload.created_by = currentUser.id;
    ({ error } = await supa.from('patients').insert(payload));
  }

  if (error){ showToast('خطأ: ' + error.message); return; }
  showToast(id ? 'تم تحديث بيانات المريض' : 'تمت إضافة المريض');
  closeModal();
  await loadPatients();
});

async function deletePatient(id){
  if (!confirm('هل أنت متأكد من حذف هذا المريض؟')) return;
  const { error } = await supa.from('patients').delete().eq('id', id);
  if (error){ showToast('خطأ: ' + error.message + (currentRole !== 'admin' ? ' (الحذف مخصص للأدمن فقط)' : '')); return; }
  showToast('تم حذف المريض');
  await loadPatients();
}

init();

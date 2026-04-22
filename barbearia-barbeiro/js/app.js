// app.js — Painel do Barbeiro (consome API)
let barberTab = 'pending';

function showToast(title, msg, duration = 5000) {
  document.getElementById('notifTitle').textContent = title;
  document.getElementById('notifMsg').textContent   = msg;
  const t = document.getElementById('notifToast');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

async function renderStats() {
  try {
    const all      = await loadBookings();
    const today    = new Date().toDateString();
    const todayN   = all.filter(b => b.date_key === today && b.status !== 'cancelled').length;
    const pending  = all.filter(b => b.status === 'pending').length;
    const confirmed= all.filter(b => b.status === 'confirmed').length;
    const revenue  = all.filter(b => b.status === 'confirmed').reduce((s,b) => s + b.price, 0);
    document.getElementById('statToday').textContent     = todayN;
    document.getElementById('statPending').textContent   = pending;
    document.getElementById('statConfirmed').textContent = confirmed;
    document.getElementById('statRevenue').textContent   = 'R$\u00a0' + revenue;
  } catch {}
}

function switchTab(tab) {
  barberTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  renderAppts();
}

async function renderAppts() {
  const el = document.getElementById('apptList');
  el.innerHTML = '<div class="empty-state">Carregando...</div>';
  try {
    const params = barberTab === 'pending' ? { status: 'pending' }
                 : barberTab === 'today'   ? { date: new Date().toDateString() } : {};
    let list = await loadBookings(params);
    if (barberTab === 'today') list = list.filter(b => b.status !== 'cancelled');

    if (!list.length) { el.innerHTML = '<div class="empty-state">Nenhum agendamento aqui.</div>'; return; }

    el.innerHTML = list.map(b => {
      const svc   = SERVICES[b.service_idx];
      const icon  = svc ? svc.icon : '✂️';
      const badge = b.status === 'confirmed' ? 'badge-confirmed' : b.status === 'cancelled' ? 'badge-cancelled' : 'badge-pending';
      const label = b.status === 'confirmed' ? 'Confirmado' : b.status === 'cancelled' ? 'Cancelado' : 'Aguardando';
      const wppLink = b.phone ? buildWhatsAppLink(b.phone, `Olá ${b.client_name}!`) : null;
      return `<div class="appt-card">
        <div class="appt-header">
          <div class="appt-service">${icon} ${b.service}</div>
          <span class="appt-badge ${badge}">${label}</span>
        </div>
        <div class="appt-row">Cliente: <span>${b.client_name}</span></div>
        <div class="appt-row">Data/Hora: <span>${b.date_label} às ${b.slot}</span></div>
        <div class="appt-row">Valor: <span>R$ ${b.price}</span></div>
        ${wppLink ? `<div class="appt-row">WhatsApp: <span><a class="wpp-link" href="${wppLink}" target="_blank">${b.phone}</a></span></div>` : ''}
        <div class="appt-row">Código: <span class="gold-text">${b.id}</span></div>
        ${b.status !== 'cancelled' ? `
        <div class="appt-actions">
          ${b.status === 'pending' ? `<button class="appt-btn appt-btn-confirm" onclick="confirmAppt('${b.id}')">✓ Confirmar</button>` : ''}
          <button class="appt-btn appt-btn-wpp" onclick="sendWpp('${b.id}')">💬</button>
          <button class="appt-btn appt-btn-cancel" onclick="cancelAppt('${b.id}')">✕</button>
        </div>` : ''}
      </div>`;
    }).join('');
  } catch {
    el.innerHTML = '<div class="empty-state">Erro ao carregar. Verifique se o servidor está rodando.</div>';
  }
}

async function confirmAppt(id) {
  const result = await updateBookingStatus(id, 'confirmed');
  if (result.whatsapp?.link) window.open(result.whatsapp.link, '_blank');
  showToast('✅ Confirmado!', 'Cliente notificado.');
  renderAppts(); renderStats();
}

async function cancelAppt(id) {
  if (!confirm('Cancelar este agendamento?')) return;
  const result = await updateBookingStatus(id, 'cancelled');
  if (result.whatsapp?.link) window.open(result.whatsapp.link, '_blank');
  showToast('❌ Cancelado', 'Agendamento cancelado.');
  renderAppts(); renderStats();
}

async function sendWpp(id) {
  const all  = await loadBookings();
  const b    = all.find(x => x.id === id);
  if (!b || !b.phone) { alert('Cliente sem WhatsApp cadastrado.'); return; }
  const svc  = SERVICES[b.service_idx];
  const msg  = `💈 *Barbearia Silva*\n\nOlá ${b.client_name}! Lembrando do seu horário:\n\n${svc ? svc.icon : '✂️'} ${b.service} — ${b.slot}\n📅 ${b.date_label}`;
  window.open(buildWhatsAppLink(b.phone, msg), '_blank');
}

// Polling: atualiza a cada 5s automaticamente
setInterval(() => { renderAppts(); renderStats(); }, 5000);

renderStats();
renderAppts();

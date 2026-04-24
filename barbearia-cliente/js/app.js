// app.js — App Cliente (consome API)
let selectedService = null;
let selectedDate    = null;
let selectedSlot    = null;
let pollInterval    = null;

function goTo(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + view).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const nav = document.getElementById('nav-' + view);
  if (nav) nav.classList.add('active');
  if (view === 'appts') renderClientAppts();
  if (view === 'home')  { renderDates(); renderSlots(); }
}

function showToast(title, msg, duration = 5000) {
  document.getElementById('notifTitle').textContent = title;
  document.getElementById('notifMsg').textContent   = msg;
  const t = document.getElementById('notifToast');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

function renderDates() {
  const el = document.getElementById('datePills');
  el.innerHTML = getDates().map(d =>
    `<div class="date-pill${selectedDate === d.key ? ' selected' : ''}" onclick="selectDate('${d.key}')">
      <div class="day-name">${d.label}</div><div class="day-num">${d.num}</div>
    </div>`
  ).join('');
}

function selectDate(key) {
  selectedDate = key; selectedSlot = null;
  renderDates(); renderSlots(); updateBookBtn();
}

async function renderSlots() {
  if (!selectedDate) {
    document.getElementById('slotsGrid').innerHTML = '<p class="hint">Selecione uma data primeiro</p>';
    return;
  }
  document.getElementById('slotsGrid').innerHTML = '<p class="hint">Carregando...</p>';
  const raw     = await getSlotsTaken(selectedDate);
  const taken   = Array.isArray(raw) ? raw : [];
  const isToday = selectedDate === new Date().toDateString();
  const now     = new Date();

  document.getElementById('slotsGrid').innerHTML = ALL_SLOTS.map(s => {
    const busy = taken.includes(s);

    let passed = false;
    if (isToday) {
      const [h, m] = s.split(':').map(Number);
      const slotTime = new Date();
      slotTime.setHours(h, m, 0, 0);
      passed = slotTime <= now;
    }

    const unavailable = busy || passed;
    const tag = busy ? 'Ocupado' : passed ? 'Encerrado' : '';

    return `<div class="slot${unavailable ? ' unavailable' : ''}${selectedSlot === s ? ' selected' : ''}"
                 onclick="${unavailable ? '' : `selectSlot('${s}')`}">
              ${s}${tag ? `<span class="slot-tag">${tag}</span>` : ''}
            </div>`;
  }).join('');
}

function selectSlot(s) { selectedSlot = s; renderSlots(); updateBookBtn(); }

function selectService(i) {
  selectedService = i;
  document.querySelectorAll('.service-card').forEach((el, j) => el.classList.toggle('selected', j === i));
  document.querySelectorAll('.service-check').forEach((el, j) => {
    el.innerHTML = j === i ? `<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 6.5l3.5 3.5 5.5-6" stroke="white" stroke-width="1.8" stroke-linecap="round"/></svg>` : '';
  });
  updateBookBtn();
}

function updateBookBtn() {
  const name = document.getElementById('clientName').value.trim();
  document.getElementById('bookBtn').disabled = !(selectedService !== null && selectedDate && selectedSlot && name);
}

function openModal() {
  const name = document.getElementById('clientName').value.trim();
  if (!name) return;
  const svc  = SERVICES[selectedService];
  const date = getDates().find(d => d.key === selectedDate);
  document.getElementById('mService').textContent  = '💈 ' + svc.name;
  document.getElementById('mDate').textContent     = date.label + ' ' + date.num + '/' + date.month;
  document.getElementById('mTime').textContent     = selectedSlot;
  document.getElementById('mDuration').textContent = svc.duration || '40 min';
  document.getElementById('mName').textContent     = name;
  document.getElementById('mPrice').textContent    = 'R$ ' + svc.price;
  document.getElementById('confirmModal').classList.add('show');
}

function closeModal() { document.getElementById('confirmModal').classList.remove('show'); }

async function finalizeBooking() {
  closeModal();
  document.getElementById('bookBtn').disabled = true;
  document.getElementById('bookBtn').textContent = 'Agendando...';

  const svc   = SERVICES[selectedService];
  const date  = getDates().find(d => d.key === selectedDate);
  const code  = generateCode();
  const phone = document.getElementById('clientPhone').value.trim();

  const booking = {
    id: code, service: svc.name, serviceIdx: selectedService, price: svc.price,
    date: selectedDate,
    dateLabel: date.label + ' ' + date.num + '/' + date.month,
    slot: selectedSlot,
    name: document.getElementById('clientName').value.trim(),
    phone
  };

  try {
    const result = await createBooking(booking);

    // Monta o link do botão WhatsApp para o Diego
    const msgDiego =
      `💈 *Novo agendamento!*\n\n` +
      `👤 *Cliente:* ${booking.name}\n` +
      `✂️ *Serviço:* ${svc.icon} ${svc.name}\n` +
      `📅 *Data:* ${booking.dateLabel}\n` +
      `⏰ *Horário:* ${booking.slot}\n` +
      `💰 *Valor:* R$ ${svc.price}\n` +
      `📱 *WhatsApp:* ${phone || 'Não informado'}\n` +
      `🔑 *Código:* ${code}`;
    const wppBtn = document.getElementById('wppDiegoBtn');
    if (wppBtn) wppBtn.href = buildWhatsAppLink('5516992063543', msgDiego);

    document.getElementById('bookingCode').textContent = code;
    document.getElementById('successDetails').innerHTML =
      `<div class="modal-row"><span class="label">Serviço</span><span class="value">${svc.icon} ${svc.name}</span></div>
       <div class="modal-row"><span class="label">Data</span><span class="value">${booking.dateLabel}</span></div>
       <div class="modal-row"><span class="label">Horário</span><span class="value">${booking.slot}</span></div>
       <div class="modal-total"><span>Total</span><span>R$ ${svc.price}</span></div>`;

    resetForm();
    goTo('success');

    // Contador regressivo de 30 segundos
    let countdown = 30;
    const timerEl = document.getElementById('successTimer');
    if (timerEl) timerEl.innerHTML = `Voltando ao início em <strong>${countdown}s</strong>`;
    const countInterval = setInterval(() => {
      countdown--;
      if (timerEl) timerEl.innerHTML = `Voltando ao início em <strong>${countdown}s</strong>`;
      if (countdown <= 0) {
        clearInterval(countInterval);
        const successView = document.getElementById('view-success');
        if (successView && successView.classList.contains('active')) {
          goTo('home');
        }
      }
    }, 1000);
  } catch (err) {
    showToast('❌ Erro', err.message);
    document.getElementById('bookBtn').disabled  = false;
    document.getElementById('bookBtn').textContent = 'Confirmar agendamento';
  }
}

function resetForm() {
  selectedService = null; selectedDate = null; selectedSlot = null;
  document.querySelectorAll('.service-card').forEach(el => el.classList.remove('selected'));
  document.querySelectorAll('.service-check').forEach(el => el.innerHTML = '');
  document.getElementById('clientName').value  = '';
  document.getElementById('clientPhone').value = '';
  document.getElementById('bookBtn').disabled  = true;
  document.getElementById('bookBtn').textContent = 'Confirmar agendamento';
}

// ── BUSCA POR TELEFONE ────────────────────────────────
function onSearchInput() {
  const val = document.getElementById('searchPhone').value.trim();
  document.getElementById('searchBtn').disabled = val.length < 8;
}

async function searchAppts() {
  const raw   = document.getElementById('searchPhone').value.trim();
  const phone = raw.replace(/\D/g, '');
  if (phone.length < 8) return;

  const el = document.getElementById('clientApptList');
  el.innerHTML = '<div class="empty-state">Buscando...</div>';

  try {
    const all      = await loadBookings();
    // Compara apenas os dígitos do telefone (ignora formatação)
    const bookings = all.filter(b => b.phone && b.phone.replace(/\D/g,'').includes(phone));

    if (!bookings.length) {
      el.innerHTML = '<div class="empty-state">Nenhum agendamento encontrado para este número.<br>Verifique o WhatsApp digitado.</div>';
      return;
    }

    el.innerHTML = [...bookings].reverse().map(b => {
      const svc   = SERVICES[b.service_idx];
      const badge = b.status === 'confirmed' ? 'badge-confirmed' : b.status === 'cancelled' ? 'badge-cancelled' : 'badge-pending';
      const label = b.status === 'confirmed' ? 'Confirmado' : b.status === 'cancelled' ? 'Cancelado' : 'Aguardando';
      return `<div class="appt-card">
        <div class="appt-header">
          <div class="appt-service">${svc ? svc.icon : '✂️'} ${b.service}</div>
          <span class="appt-badge ${badge}">${label}</span>
        </div>
        <div class="appt-row">Data: <span>${b.date_label}</span></div>
        <div class="appt-row">Horário: <span>${b.slot}</span></div>
        <div class="appt-row">Total: <span>R$ ${b.price}</span></div>
        <div class="appt-row">Código: <span class="gold-text">${b.id}</span></div>
        ${b.status !== 'cancelled'
          ? `<div class="appt-actions"><button class="appt-btn appt-btn-cancel" onclick="cancelAppt('${b.id}', '${phone}')">Cancelar agendamento</button></div>` : ''}
      </div>`;
    }).join('');
  } catch {
    el.innerHTML = '<div class="empty-state">Erro ao buscar. Tente novamente.</div>';
  }
}

async function cancelAppt(id, phone) {
  if (!confirm('Deseja cancelar este agendamento?')) return;
  await updateBookingStatus(id, 'cancelled');
  // Rebusca pelo mesmo telefone após cancelar
  await searchAppts();
  showToast('❌ Cancelado', 'Agendamento cancelado.');
}

// Mantido para compatibilidade (chamado no goTo)
async function renderClientAppts() {
  // Limpa resultado anterior ao trocar de aba
  document.getElementById('clientApptList').innerHTML = '';
  document.getElementById('searchPhone').value = '';
  document.getElementById('searchBtn').disabled = true;
}

// Polling: atualiza slots a cada 10s enquanto está na tela de agendamento
setInterval(() => {
  const home = document.getElementById('view-home');
  if (home && home.classList.contains('active') && selectedDate) renderSlots();
}, 10000);

renderDates();
renderSlots();
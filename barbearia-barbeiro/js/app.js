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
setInterval(() => { renderAppts(); renderStats(); }, 30000);

renderStats();
renderAppts();

// ── ZERAR O DIA ────────────────────────────────────────
async function resetDay() {
  const today = new Date().toDateString();
  const todayLabel = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  if (!confirm(`Zerar todos os agendamentos de hoje (${todayLabel})?\n\nEsta ação cancela todos os horários do dia atual.`)) return;

  const all = await loadBookings();
  const todayList = all.filter(b => b.date_key === today && b.status !== 'cancelled');

  if (!todayList.length) {
    showToast('ℹ️ Nada para zerar', 'Não há agendamentos ativos hoje.');
    return;
  }

  for (const b of todayList) {
    await updateBookingStatus(b.id, 'cancelled');
  }

  showToast('✅ Dia zerado!', `${todayList.length} agendamento(s) cancelado(s).`);
  renderAppts();
  renderStats();
}

// ── DOWNLOAD PDF ───────────────────────────────────────
async function downloadPDF() {
  const all = await loadBookings();
  const today = new Date().toDateString();
  const todayList = all.filter(b => b.date_key === today && b.status !== 'cancelled');

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const W = 210;
  const margin = 18;
  let y = 20;

  const dateLabel = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Cabeçalho
  doc.setFillColor(107, 58, 42);
  doc.rect(0, 0, W, 28, 'F');
  doc.setTextColor(245, 236, 215);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Barbearia Silva', margin, 12);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Relatorio do Dia — ' + dateLabel, margin, 20);

  y = 38;

  // Resumo
  const confirmed = todayList.filter(b => b.status === 'confirmed');
  const pending   = todayList.filter(b => b.status === 'pending');
  const revenue   = confirmed.reduce((s, b) => s + b.price, 0);
  const total     = todayList.length;

  doc.setFillColor(245, 240, 235);
  doc.roundedRect(margin, y, W - margin * 2, 28, 3, 3, 'F');

  doc.setTextColor(60, 30, 15);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Total de cortes: ' + total, margin + 6, y + 9);
  doc.text('Confirmados: '    + confirmed.length, margin + 6, y + 17);
  doc.text('Pendentes: '      + pending.length,   margin + 70, y + 17);
  doc.setFontSize(12);
  doc.setTextColor(107, 58, 42);
  doc.text('Receita confirmada: R$ ' + revenue, margin + 6, y + 25);

  y += 36;

  // Tabela de agendamentos
  if (todayList.length === 0) {
    doc.setTextColor(150, 140, 130);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.text('Nenhum agendamento hoje.', margin, y + 10);
  } else {
    // Header da tabela
    doc.setFillColor(107, 58, 42);
    doc.rect(margin, y, W - margin * 2, 8, 'F');
    doc.setTextColor(245, 236, 215);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Horario', margin + 3,  y + 5.5);
    doc.text('Cliente',  margin + 22, y + 5.5);
    doc.text('Servico',  margin + 80, y + 5.5);
    doc.text('Valor',    margin + 122, y + 5.5);
    doc.text('Status',   margin + 142, y + 5.5);
    y += 8;

    todayList.forEach((b, i) => {
      const rowH = 8;
      const fill = i % 2 === 0 ? [255,252,248] : [245,240,235];
      doc.setFillColor(...fill);
      doc.rect(margin, y, W - margin * 2, rowH, 'F');

      doc.setTextColor(40, 20, 10);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');

      const statusLabel = b.status === 'confirmed' ? 'Confirmado' : 'Pendente';
      const serviceName = b.service.length > 16 ? b.service.substring(0, 14) + '..' : b.service;
      const clientName  = b.client_name.length > 22 ? b.client_name.substring(0, 20) + '..' : b.client_name;

      doc.text(b.slot,         margin + 3,   y + 5.5);
      doc.text(clientName,     margin + 22,  y + 5.5);
      doc.text(serviceName,    margin + 80,  y + 5.5);
      doc.text('R$ ' + b.price, margin + 122, y + 5.5);

      if (b.status === 'confirmed') doc.setTextColor(30, 100, 60);
      else doc.setTextColor(160, 100, 20);
      doc.text(statusLabel, margin + 142, y + 5.5);

      y += rowH;
    });

    // Linha final totalizadora
    y += 2;
    doc.setDrawColor(196, 154, 108);
    doc.setLineWidth(0.3);
    doc.line(margin, y, W - margin, y);
    y += 6;
    doc.setTextColor(107, 58, 42);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Total confirmado: R$ ' + revenue, W - margin - 60, y, { align: 'left' });
  }

  // Rodapé
  y = 285;
  doc.setTextColor(180, 160, 140);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Gerado em ' + new Date().toLocaleString('pt-BR'), margin, y);

  const fileName = 'relatorio-' + new Date().toISOString().slice(0, 10) + '.pdf';
  doc.save(fileName);
  showToast('📄 PDF gerado!', fileName);
}
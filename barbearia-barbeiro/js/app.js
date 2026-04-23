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

// ── RELATÓRIO MENSAL ───────────────────────────────────
async function downloadMonthlyPDF() {
  showToast('⏳ Gerando...', 'Aguarde um momento.');

  const all = await loadBookings();

  // Mês atual
  const now        = new Date();
  const thisMonth  = now.getMonth();
  const thisYear   = now.getFullYear();
  const monthName  = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  // Filtra agendamentos do mês atual
  const monthly = all.filter(b => {
    const d = new Date(b.date_key);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  });

  const confirmed  = monthly.filter(b => b.status === 'confirmed');
  const cancelled  = monthly.filter(b => b.status === 'cancelled');
  const pending    = monthly.filter(b => b.status === 'pending');
  const revenue    = confirmed.reduce((s, b) => s + Number(b.price), 0);
  const lostRev    = cancelled.reduce((s, b) => s + Number(b.price), 0);

  // Contagem por serviço
  const svcCount = {};
  monthly.forEach(b => {
    if (!svcCount[b.service]) svcCount[b.service] = { confirmed: 0, cancelled: 0, pending: 0, revenue: 0 };
    svcCount[b.service][b.status] = (svcCount[b.service][b.status] || 0) + 1;
    if (b.status === 'confirmed') svcCount[b.service].revenue += Number(b.price);
  });

  const { jsPDF } = window.jspdf;
  const doc    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W      = 210;
  const margin = 14;
  let y        = 0;

  // ── Cabeçalho ──────────────────────────────────────
  doc.setFillColor(107, 58, 42);
  doc.rect(0, 0, W, 32, 'F');
  doc.setTextColor(245, 236, 215);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Barbearia Silva', margin, 13);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Relatorio Mensal — ' + monthName.charAt(0).toUpperCase() + monthName.slice(1), margin, 23);
  doc.setFontSize(8);
  doc.text('Gerado em ' + now.toLocaleString('pt-BR'), W - margin, 28, { align: 'right' });

  y = 42;

  // ── Resumo geral ────────────────────────────────────
  doc.setFillColor(245, 240, 235);
  doc.roundedRect(margin, y, W - margin * 2, 40, 3, 3, 'F');
  doc.setDrawColor(196, 154, 108);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, W - margin * 2, 40, 3, 3, 'S');

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60, 30, 15);
  doc.text('Resumo do Mes', margin + 5, y + 10);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  // Linha 1
  doc.setTextColor(30, 100, 60);
  doc.text('Confirmados: ' + confirmed.length, margin + 5, y + 20);
  doc.setTextColor(160, 100, 20);
  doc.text('Pendentes: ' + pending.length, margin + 65, y + 20);
  doc.setTextColor(160, 30, 30);
  doc.text('Cancelados: ' + cancelled.length, margin + 120, y + 20);

  // Linha 2
  doc.setTextColor(107, 58, 42);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Total de atendimentos: ' + monthly.length, margin + 5, y + 30);
  doc.setTextColor(30, 100, 60);
  doc.text('Receita confirmada: R$ ' + revenue, margin + 5, y + 38);
  doc.setTextColor(160, 30, 30);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Receita perdida (cancelados): R$ ' + lostRev, margin + 95, y + 38);

  y += 50;

  // ── Resumo por serviço ──────────────────────────────
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60, 30, 15);
  doc.text('Por Servico', margin, y);
  y += 6;

  // Header tabela serviços
  doc.setFillColor(107, 58, 42);
  doc.rect(margin, y, W - margin * 2, 8, 'F');
  doc.setTextColor(245, 236, 215);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Servico',      margin + 3,   y + 5.5);
  doc.text('Confirmados',  margin + 62,  y + 5.5);
  doc.text('Cancelados',   margin + 100, y + 5.5);
  doc.text('Pendentes',    margin + 135, y + 5.5);
  doc.text('Receita',      margin + 158, y + 5.5);
  y += 8;

  Object.entries(svcCount).forEach(([name, data], i) => {
    const fill = i % 2 === 0 ? [255,252,248] : [245,240,235];
    doc.setFillColor(...fill);
    doc.rect(margin, y, W - margin * 2, 8, 'F');
    doc.setTextColor(40, 20, 10);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text(name,                           margin + 3,   y + 5.5);
    doc.setTextColor(30, 100, 60);
    doc.text(String(data.confirmed || 0),    margin + 72,  y + 5.5);
    doc.setTextColor(160, 30, 30);
    doc.text(String(data.cancelled || 0),    margin + 110, y + 5.5);
    doc.setTextColor(160, 100, 20);
    doc.text(String(data.pending || 0),      margin + 145, y + 5.5);
    doc.setTextColor(107, 58, 42);
    doc.setFont('helvetica', 'bold');
    doc.text('R$ ' + (data.revenue || 0),    margin + 158, y + 5.5);
    y += 8;
  });

  y += 10;

  // ── Lista completa de agendamentos ─────────────────
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60, 30, 15);
  doc.text('Todos os Agendamentos', margin, y);
  y += 6;

  // Header tabela completa
  doc.setFillColor(107, 58, 42);
  doc.rect(margin, y, W - margin * 2, 8, 'F');
  doc.setTextColor(245, 236, 215);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Data',     margin + 3,   y + 5.5);
  doc.text('Horario',  margin + 30,  y + 5.5);
  doc.text('Cliente',  margin + 50,  y + 5.5);
  doc.text('Servico',  margin + 100, y + 5.5);
  doc.text('Valor',    margin + 138, y + 5.5);
  doc.text('Status',   margin + 158, y + 5.5);
  y += 8;

  // Ordena por data/slot
  const sorted = [...monthly].sort((a, b) => {
    if (a.date_key !== b.date_key) return new Date(a.date_key) - new Date(b.date_key);
    return a.slot.localeCompare(b.slot);
  });

  sorted.forEach((b, i) => {
    // Nova página se necessário
    if (y > 270) {
      doc.addPage();
      y = 20;
      // Repete header
      doc.setFillColor(107, 58, 42);
      doc.rect(margin, y, W - margin * 2, 8, 'F');
      doc.setTextColor(245, 236, 215);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Data',    margin + 3,   y + 5.5);
      doc.text('Horario', margin + 30,  y + 5.5);
      doc.text('Cliente', margin + 50,  y + 5.5);
      doc.text('Servico', margin + 100, y + 5.5);
      doc.text('Valor',   margin + 138, y + 5.5);
      doc.text('Status',  margin + 158, y + 5.5);
      y += 8;
    }

    const rowH = 7.5;
    const fill = i % 2 === 0 ? [255,252,248] : [245,240,235];
    doc.setFillColor(...fill);
    doc.rect(margin, y, W - margin * 2, rowH, 'F');

    const dateStr    = new Date(b.date_key).toLocaleDateString('pt-BR');
    const clientName = b.client_name.length > 18 ? b.client_name.substring(0, 16) + '..' : b.client_name;
    const svcName    = b.service.length > 13 ? b.service.substring(0, 11) + '..' : b.service;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 20, 10);
    doc.text(dateStr,    margin + 3,   y + 5);
    doc.text(b.slot,     margin + 30,  y + 5);
    doc.text(clientName, margin + 50,  y + 5);
    doc.text(svcName,    margin + 100, y + 5);
    doc.text('R$ ' + b.price, margin + 138, y + 5);

    if (b.status === 'confirmed')       { doc.setTextColor(30, 100, 60);   doc.text('Confirmado', margin + 158, y + 5); }
    else if (b.status === 'cancelled')  { doc.setTextColor(160, 30, 30);   doc.text('Cancelado',  margin + 158, y + 5); }
    else                                { doc.setTextColor(160, 100, 20);  doc.text('Pendente',   margin + 158, y + 5); }

    y += rowH;
  });

  // ── Totalizador final ───────────────────────────────
  y += 4;
  doc.setDrawColor(196, 154, 108);
  doc.setLineWidth(0.4);
  doc.line(margin, y, W - margin, y);
  y += 7;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 100, 60);
  doc.text('Receita total confirmada: R$ ' + revenue, margin, y);
  doc.setTextColor(160, 30, 30);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Receita perdida com cancelamentos: R$ ' + lostRev, margin, y + 7);

  const fileName = 'relatorio-mensal-' + now.toISOString().slice(0, 7) + '.pdf';
  doc.save(fileName);
  showToast('📄 PDF gerado!', fileName);
}
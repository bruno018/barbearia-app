// server.js — Barbearia Silva Backend
require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const cron    = require('node-cron');
const db      = require('./db');
const wpp     = require('./whatsapp');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middlewares ────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // serve os apps cliente/barbeiro se quiser

// ── Inicializa banco ───────────────────────────────────
db.getDb().then(() => {
  console.log('✅ Banco de dados pronto');
  startServer();
}).catch(err => {
  console.error('❌ Erro ao iniciar banco:', err);
  process.exit(1);
});

// ── ROTAS ──────────────────────────────────────────────

// GET /api/slots?date=Mon Apr 17 2026
// Retorna horários ocupados para uma data
app.get('/api/slots', (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date obrigatório' });
  const taken = db.getSlotsTaken(date);
  res.json({ taken });
});

// GET /api/agendamentos
// Lista todos (painel do barbeiro)
app.get('/api/agendamentos', (req, res) => {
  const { status, date } = req.query;
  let list;
  if (date)             list = db.listByDate(date);
  else if (status === 'pending') list = db.listPending();
  else                  list = db.listAll();
  res.json(list);
});

// GET /api/agendamentos/:id
app.get('/api/agendamentos/:id', (req, res) => {
  const b = db.findById(req.params.id);
  if (!b) return res.status(404).json({ error: 'Não encontrado' });
  res.json(b);
});

// POST /api/agendamentos — cria novo agendamento
app.post('/api/agendamentos', async (req, res) => {
  const { id, service, serviceIdx, price, date, dateLabel, slot, name, phone } = req.body;

  // Valida campos obrigatórios
  if (!id || !service || serviceIdx === undefined || !price || !date || !slot || !name) {
    return res.status(400).json({ error: 'Campos obrigatórios faltando' });
  }

  // Verifica se o horário já está ocupado
  const taken = db.getSlotsTaken(date);
  if (taken.includes(slot)) {
    return res.status(409).json({ error: 'Horário já reservado' });
  }

  const booking = {
    id, service, serviceIdx, price, date, dateLabel,
    slot, name, phone: phone || '',
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  db.insert(booking);

  // Envia confirmação via WhatsApp se tiver telefone
  let wppResult = null;
  if (phone) {
    try {
      wppResult = await wpp.send(phone, wpp.msgConfirmacaoCliente(
        { ...booking, client_name: name, service_idx: serviceIdx, date_label: dateLabel }
      ));
    } catch (err) {
      console.error('WhatsApp erro:', err.message);
    }
  }

  res.status(201).json({ booking, whatsapp: wppResult });
});

// PATCH /api/agendamentos/:id/status — confirmar ou cancelar
app.patch('/api/agendamentos/:id/status', async (req, res) => {
  const { status } = req.body;
  const validStatus = ['pending', 'confirmed', 'cancelled'];

  if (!validStatus.includes(status)) {
    return res.status(400).json({ error: 'Status inválido' });
  }

  const b = db.findById(req.params.id);
  if (!b) return res.status(404).json({ error: 'Não encontrado' });

  db.updateStatus(req.params.id, status);

  // Notifica cliente via WhatsApp
  let wppResult = null;
  if (b.phone) {
    try {
      const msg = status === 'confirmed'
        ? wpp.msgConfirmadoBarbeiro(b)
        : wpp.msgCancelado(b);
      wppResult = await wpp.send(b.phone, msg);
    } catch (err) {
      console.error('WhatsApp erro:', err.message);
    }
  }

  res.json({ id: req.params.id, status, whatsapp: wppResult });
});

// ── CRON: lembrete 15 min antes ───────────────────────
// Roda a cada minuto, verifica agendamentos nos próximos 16 min
cron.schedule('* * * * *', async () => {
  const upcoming = db.getUpcomingReminders(16 * 60 * 1000);
  for (const b of upcoming) {
    if (!b.phone) continue;
    try {
      const result = await wpp.send(b.phone, wpp.msgLembrete15min(b));
      console.log(`📨 Lembrete enviado para ${b.client_name} (${b.slot}) — modo: ${result.mode}`);
    } catch (err) {
      console.error(`Erro lembrete ${b.id}:`, err.message);
    }
  }
});

// ── Rota raiz (health check) ───────────────────────────
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Barbearia Silva API',
    version: '1.0.0',
    endpoints: [
      'GET  /api/slots?date=...',
      'GET  /api/agendamentos',
      'GET  /api/agendamentos/:id',
      'POST /api/agendamentos',
      'PATCH /api/agendamentos/:id/status'
    ]
  });
});

// ── Start ──────────────────────────────────────────────
function startServer() {
  app.listen(PORT, () => {
    console.log(`\n🚀 Barbearia Silva API rodando em http://localhost:${PORT}`);
    console.log(`📋 Endpoints: http://localhost:${PORT}/`);
    console.log(`💬 WhatsApp mode: ${process.env.WHATSAPP_MODE || 'link'}\n`);
  });
}

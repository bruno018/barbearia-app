// server.js — Barbearia Silva Backend
require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const cron    = require('node-cron');
const db      = require('./db');
const wpp     = require('./whatsapp');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ── Inicializa banco ───────────────────────────────────
db.getDb().then(() => {
  startServer();
}).catch(err => {
  console.error('❌ Erro ao iniciar banco:', err);
  process.exit(1);
});

// ── ROTAS ──────────────────────────────────────────────

// GET /api/slots?date=...
app.get('/api/slots', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date obrigatório' });
    const taken = await db.getSlotsTaken(date);
    res.json({ taken });
  } catch (err) {
    console.error('GET /slots erro:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agendamentos
app.get('/api/agendamentos', async (req, res) => {
  try {
    const { status, date } = req.query;
    let list;
    if (date)                    list = await db.listByDate(date);
    else if (status === 'pending') list = await db.listPending();
    else                         list = await db.listAll();
    res.json(list);
  } catch (err) {
    console.error('GET /agendamentos erro:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agendamentos/:id
app.get('/api/agendamentos/:id', async (req, res) => {
  try {
    const b = await db.findById(req.params.id);
    if (!b) return res.status(404).json({ error: 'Não encontrado' });
    res.json(b);
  } catch (err) {
    console.error('GET /agendamentos/:id erro:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agendamentos
app.post('/api/agendamentos', async (req, res) => {
  try {
    const { id, service, serviceIdx, price, date, dateLabel, slot, name, phone } = req.body;

    if (!id || !service || serviceIdx === undefined || !price || !date || !slot || !name) {
      return res.status(400).json({ error: 'Campos obrigatórios faltando' });
    }

    const taken = await db.getSlotsTaken(date);
    if (Array.isArray(taken) && taken.includes(slot)) {
      return res.status(409).json({ error: 'Horário já reservado' });
    }

    const booking = {
      id, service, serviceIdx, price, date, dateLabel,
      slot, name, phone: phone || '',
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    await db.insert(booking);

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
  } catch (err) {
    console.error('POST /agendamentos erro:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/agendamentos/:id/status
app.patch('/api/agendamentos/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatus = ['pending', 'confirmed', 'cancelled'];

    if (!validStatus.includes(status)) {
      return res.status(400).json({ error: 'Status inválido' });
    }

    const b = await db.findById(req.params.id);
    if (!b) return res.status(404).json({ error: 'Não encontrado' });

    await db.updateStatus(req.params.id, status);

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
  } catch (err) {
    console.error('PATCH /status erro:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── CRON: lembrete 15 min antes ───────────────────────
cron.schedule('* * * * *', async () => {
  try {
    const upcoming = await db.getUpcomingReminders(16 * 60 * 1000);
    if (!Array.isArray(upcoming)) return;
    for (const b of upcoming) {
      if (!b.phone) continue;
      try {
        const result = await wpp.send(b.phone, wpp.msgLembrete15min(b));
        console.log(`📨 Lembrete: ${b.client_name} às ${b.slot}`);
      } catch (err) {
        console.error(`Erro lembrete ${b.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('Cron erro:', err.message);
  }
});

// ── Health check ───────────────────────────────────────
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
    console.log(`💬 WhatsApp mode: ${process.env.WHATSAPP_MODE || 'link'}\n`);
  });
}
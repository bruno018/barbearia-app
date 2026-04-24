// db.js — banco de dados PostgreSQL (Supabase)
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function getDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS agendamentos (
      id          TEXT PRIMARY KEY,
      service     TEXT NOT NULL,
      service_idx INTEGER NOT NULL,
      price       INTEGER NOT NULL,
      date_key    TEXT NOT NULL,
      date_label  TEXT NOT NULL,
      slot        TEXT NOT NULL,
      client_name TEXT NOT NULL,
      phone       TEXT DEFAULT '',
      status      TEXT NOT NULL DEFAULT 'pending',
      created_at  TEXT NOT NULL
    )
  `);
  console.log('✅ Banco de dados pronto (Supabase PostgreSQL)');
}

async function listAll() {
  const r = await pool.query('SELECT * FROM agendamentos ORDER BY date_key, slot');
  return r.rows;
}

async function listByDate(dateKey) {
  const r = await pool.query('SELECT * FROM agendamentos WHERE date_key = $1 ORDER BY slot', [dateKey]);
  return r.rows;
}

async function listPending() {
  const r = await pool.query("SELECT * FROM agendamentos WHERE status = 'pending' ORDER BY date_key, slot");
  return r.rows;
}

async function findById(id) {
  const r = await pool.query('SELECT * FROM agendamentos WHERE id = $1', [id]);
  return r.rows[0] || null;
}

async function getSlotsTaken(dateKey) {
  const r = await pool.query(
    "SELECT slot FROM agendamentos WHERE date_key = $1 AND status != 'cancelled'",
    [dateKey]
  );
  return r.rows.map(r => r.slot);
}

async function insert(b) {
  await pool.query(
    `INSERT INTO agendamentos
      (id, service, service_idx, price, date_key, date_label, slot, client_name, phone, status, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [b.id, b.service, b.serviceIdx, b.price, b.date, b.dateLabel,
     b.slot, b.name, b.phone || '', b.status, b.createdAt]
  );
}

async function updateStatus(id, status) {
  await pool.query('UPDATE agendamentos SET status = $1 WHERE id = $2', [status, id]);
}

async function getUpcomingReminders(windowMs = 16 * 60 * 1000) {
  const r = await pool.query("SELECT * FROM agendamentos WHERE status != 'cancelled' AND phone != ''");
  const now = Date.now();
  return r.rows.filter(b => {
    const bookDate = new Date(b.date_key);
    const [h, m]   = b.slot.split(':').map(Number);
    bookDate.setHours(h, m, 0, 0);
    const diff = bookDate - now;
    return diff > 0 && diff <= windowMs;
  });
}

module.exports = { getDb, listAll, listByDate, listPending, findById, getSlotsTaken, insert, updateStatus, getUpcomingReminders };
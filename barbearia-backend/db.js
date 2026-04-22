// db.js — banco de dados SQLite (sql.js, puro JS, sem compilação)
const initSqlJs = require('sql.js');
const fs        = require('fs');
const path      = require('path');

const DB_PATH = path.join(__dirname, 'data', 'barbearia.db');

let db = null;

async function getDb() {
  if (db) return db;

  const SQL = await initSqlJs();

  // Garante que a pasta /data existe
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  // Carrega banco existente ou cria novo
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  createTables();
  return db;
}

function createTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS agendamentos (
      id          TEXT PRIMARY KEY,
      service     TEXT NOT NULL,
      service_idx INTEGER NOT NULL,
      price       INTEGER NOT NULL,
      date_key    TEXT NOT NULL,
      date_label  TEXT NOT NULL,
      slot        TEXT NOT NULL,
      client_name TEXT NOT NULL,
      phone       TEXT,
      status      TEXT NOT NULL DEFAULT 'pending',
      created_at  TEXT NOT NULL
    )
  `);
}

// Persiste o banco em disco após cada escrita
function persist() {
  const data = db.export();
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// ── QUERIES ────────────────────────────────────────────

function all(sql, params = []) {
  const stmt   = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function get(sql, params = []) {
  return all(sql, params)[0] || null;
}

function run(sql, params = []) {
  db.run(sql, params);
  persist();
}

// ── AGENDAMENTOS ───────────────────────────────────────

function listAll() {
  return all('SELECT * FROM agendamentos ORDER BY date_key, slot');
}

function listByDate(dateKey) {
  return all('SELECT * FROM agendamentos WHERE date_key = ? ORDER BY slot', [dateKey]);
}

function listPending() {
  return all("SELECT * FROM agendamentos WHERE status = 'pending' ORDER BY date_key, slot");
}

function findById(id) {
  return get('SELECT * FROM agendamentos WHERE id = ?', [id]);
}

function getSlotsTaken(dateKey) {
  return all(
    "SELECT slot FROM agendamentos WHERE date_key = ? AND status != 'cancelled'",
    [dateKey]
  ).map(r => r.slot);
}

function insert(b) {
  run(
    `INSERT INTO agendamentos
      (id, service, service_idx, price, date_key, date_label, slot, client_name, phone, status, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [b.id, b.service, b.serviceIdx, b.price, b.date, b.dateLabel,
     b.slot, b.name, b.phone || '', b.status, b.createdAt]
  );
}

function updateStatus(id, status) {
  run('UPDATE agendamentos SET status = ? WHERE id = ?', [status, id]);
}

function getUpcomingReminders(windowMs = 16 * 60 * 1000) {
  // Busca agendamentos confirmados/pendentes nas próximas windowMs ms
  const now     = Date.now();
  const cutoff  = now + windowMs;
  const all_active = all(
    "SELECT * FROM agendamentos WHERE status != 'cancelled' AND phone != ''"
  );
  return all_active.filter(b => {
    const bookDate = new Date(b.date_key);
    const [h, m]   = b.slot.split(':').map(Number);
    bookDate.setHours(h, m, 0, 0);
    const diff = bookDate - now;
    return diff > 0 && diff <= cutoff;
  });
}

module.exports = {
  getDb,
  listAll,
  listByDate,
  listPending,
  findById,
  getSlotsTaken,
  insert,
  updateStatus,
  getUpcomingReminders
};

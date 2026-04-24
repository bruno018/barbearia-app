// shared.js — estado compartilhado via API
const API = 'https://barbearia-app-dx1x.onrender.com/api';

const SERVICES = [
  { name: 'Corte Social', price: 25, icon: '✂️',  desc: 'Corte social clássico' },
  { name: 'Degradê',      price: 30, icon: '💈',  desc: 'Degradê moderno' },
  { name: 'Barba',        price: 20, icon: '🪒',  desc: 'Aparar, modelar e hidratar' },
  { name: 'Sobrancelha',  price: 10, icon: '👁️', desc: 'Design de sobrancelha' },
  { name: 'Risco',        price: 10, icon: '✏️',  desc: 'Risco no corte' },
  { name: 'Pezinho',      price: 10, icon: '🔪',  desc: 'Acabamento no pezinho' },
  { name: 'Completo',     price: 60, icon: '⭐',  desc: 'Corte + Barba + Sobrancelha' }
];

const ALL_SLOTS = [
  '09:00','09:40','10:20','11:00','11:40',
  '13:40','14:20','15:00','15:40','16:20','17:00','17:40','18:20','19:00','19:40'
];

function getDates(count = 7) {
  const days = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  return Array.from({ length: count }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return { label: i === 0 ? 'Hoje' : days[d.getDay()], num: d.getDate(), month: d.getMonth()+1, key: d.toDateString() };
  });
}

function generateCode() { return 'BS' + Math.floor(1000 + Math.random() * 9000); }

async function getSlotsTaken(dateKey) {
  try {
    const res  = await fetch(`${API}/slots?date=${encodeURIComponent(dateKey)}`);
    const data = await res.json();
    return Array.isArray(data.taken) ? data.taken : [];
  } catch { return []; }
}

async function createBooking(booking) {
  const res = await fetch(`${API}/agendamentos`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(booking)
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Erro ao agendar'); }
  return res.json();
}

async function loadBookings(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${API}/agendamentos${qs ? '?'+qs : ''}`);
  return res.json();
}

async function updateBookingStatus(id, status) {
  const res = await fetch(`${API}/agendamentos/${id}/status`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status })
  });
  return res.json();
}

function buildWhatsAppLink(phone, message) {
  const n = phone.replace(/\D/g,''); const num = n.startsWith('55') ? n : '55'+n;
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}
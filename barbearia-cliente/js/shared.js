// shared.js — estado compartilhado via API
const API = 'http://localhost:3001/api';

const SERVICES = [
  { name: 'Corte',    price: 35,  icon: '✂️',  desc: 'Corte tradicional ou moderno' },
  { name: 'Barba',    price: 25,  icon: '🪒',  desc: 'Aparar, modelar e hidratar' },
  { name: 'Completo', price: 65,  icon: '⭐',  desc: 'Corte + Barba + Sobrancelha' }
];

const ALL_SLOTS = [
  '08:00','08:40','09:20','10:00','10:40','11:20',
  '13:00','13:40','14:20','15:00','15:40','16:20','17:00','17:40'
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
    const res = await fetch(`${API}/slots?date=${encodeURIComponent(dateKey)}`);
    return (await res.json()).taken || [];
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

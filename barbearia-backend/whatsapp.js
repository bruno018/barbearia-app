// whatsapp.js — disparo de mensagens WhatsApp
// Suporta: 'zapi' | 'twilio' | 'link' (gera link wa.me)
require('dotenv').config();
const axios = require('axios');

const MODE = process.env.WHATSAPP_MODE || 'link';

function cleanPhone(phone) {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.startsWith('55') ? cleaned : '55' + cleaned;
}

// ── Modos de envio ─────────────────────────────────────

async function sendZApi(phone, message) {
  const instance = process.env.ZAPI_INSTANCE;
  const token    = process.env.ZAPI_TOKEN;
  if (!instance || !token) throw new Error('Z-API não configurada');

  await axios.post(
    `https://api.z-api.io/instances/${instance}/token/${token}/send-text`,
    { phone: cleanPhone(phone), message },
    { headers: { 'Content-Type': 'application/json' } }
  );
}

async function sendTwilio(phone, message) {
  const sid  = process.env.TWILIO_ACCOUNT_SID;
  const auth = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!sid || !auth || !from) throw new Error('Twilio não configurado');

  await axios.post(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    new URLSearchParams({
      From: from,
      To:   `whatsapp:+${cleanPhone(phone)}`,
      Body: message
    }),
    { auth: { username: sid, password: auth } }
  );
}

function buildLink(phone, message) {
  return `https://wa.me/${cleanPhone(phone)}?text=${encodeURIComponent(message)}`;
}

// ── Função principal ───────────────────────────────────

async function send(phone, message) {
  if (!phone) return { ok: false, reason: 'sem telefone' };

  if (MODE === 'zapi') {
    await sendZApi(phone, message);
    return { ok: true, mode: 'zapi' };
  }

  if (MODE === 'twilio') {
    await sendTwilio(phone, message);
    return { ok: true, mode: 'twilio' };
  }

  // Modo padrão: retorna link wa.me (cliente abre manualmente)
  return { ok: true, mode: 'link', link: buildLink(phone, message) };
}

// ── Mensagens prontas ──────────────────────────────────

const SERVICES = ['Corte', 'Barba', 'Completo'];
const ICONS    = ['✂️', '🪒', '⭐'];

function msgConfirmacaoCliente(b) {
  const icon = ICONS[b.service_idx] || '✂️';
  return (
    `✂️ *Barbearia Silva* — Agendamento recebido!\n\n` +
    `Olá ${b.client_name}! Seu horário foi registrado.\n\n` +
    `${icon} *Serviço:* ${b.service}\n` +
    `📅 *Data:* ${b.date_label}\n` +
    `⏰ *Horário:* ${b.slot}\n` +
    `💰 *Total:* R$ ${b.price}\n` +
    `🔑 *Código:* ${b.id}\n\n` +
    `Aguarde a confirmação do barbeiro. Até logo! 💈`
  );
}

function msgConfirmadoBarbeiro(b) {
  const icon = ICONS[b.service_idx] || '✂️';
  return (
    `✅ *Barbearia Silva* — Confirmado!\n\n` +
    `Olá ${b.client_name}! Seu horário foi *confirmado*.\n\n` +
    `${icon} *${b.service}* às *${b.slot}*\n` +
    `📅 ${b.date_label}\n\n` +
    `Te esperamos! 💈`
  );
}

function msgCancelado(b) {
  return (
    `❌ *Barbearia Silva*\n\n` +
    `Olá ${b.client_name}, precisamos cancelar seu horário de ` +
    `${b.service} às ${b.slot}.\n\n` +
    `Entre em contato para remarcar. Desculpe o inconveniente! 🙏`
  );
}

function msgLembrete15min(b) {
  const icon = ICONS[b.service_idx] || '✂️';
  return (
    `⏰ *Barbearia Silva* — Lembrete!\n\n` +
    `Olá ${b.client_name}! Seu horário começa em *15 minutos*.\n\n` +
    `${icon} *${b.service}* às *${b.slot}*\n\n` +
    `Te esperamos! 💈`
  );
}

module.exports = {
  send,
  buildLink,
  msgConfirmacaoCliente,
  msgConfirmadoBarbeiro,
  msgCancelado,
  msgLembrete15min
};

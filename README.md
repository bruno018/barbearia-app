# ✂️ Barbearia Silva — Sistema de Agendamentos

Dois apps separados que compartilham dados via `localStorage`.

---

## 📁 Estrutura

```
barbearia-silva/
├── barbearia-cliente/          ← App do CLIENTE
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── shared.js           ← Estado compartilhado
│       └── app.js
│
├── barbearia-barbeiro/         ← App do BARBEIRO
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── shared.js           ← Estado compartilhado (cópia)
│       └── app.js
│
└── README.md
```

---

## 🚀 Como rodar

Abra os dois `index.html` **no mesmo navegador** (duas abas):
- `barbearia-cliente/index.html` → tela do cliente
- `barbearia-barbeiro/index.html` → painel do barbeiro

> **Recomendado:** use a extensão **Live Server** no VS Code e abra cada pasta separadamente.

Os dados são compartilhados via `localStorage`, então:
- Quando o cliente agenda, o horário some automaticamente
- O painel do barbeiro atualiza a cada 2 segundos automaticamente

---

## 💬 Sistema WhatsApp

O sistema usa links `wa.me` que abrem o WhatsApp com mensagem pré-preenchida.

### Mensagens enviadas automaticamente:
| Evento | Destinatário |
|---|---|
| Agendamento realizado | Cliente recebe confirmação |
| Barbeiro confirma | Cliente recebe aviso |
| Barbeiro cancela | Cliente recebe aviso |
| 15 min antes do horário | Cliente recebe lembrete |
| Barbeiro quer contatar | Abre WhatsApp direto |

### Para produção (mensagens automáticas sem clicar):
Substituir `buildWhatsAppLink` em `shared.js` por uma das APIs:
- **Z-API** (brasileira, simples): https://z-api.io
- **Twilio WhatsApp API**: https://twilio.com
- **Evolution API** (open source): https://github.com/EvolutionAPI

Exemplo com Z-API:
```js
async function notifyWhatsApp(phone, message) {
  await fetch('https://api.z-api.io/instances/SEU_ID/token/SEU_TOKEN/send-text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, message })
  });
}
```

---

## ⚙️ Personalização

### Serviços e preços — `shared.js`
```js
const SERVICES = [
  { name: 'Corte',    price: 35, icon: '✂️',  desc: '...' },
  { name: 'Barba',   price: 25, icon: '🪒', desc: '...' },
  { name: 'Completo', price: 65, icon: '⭐', desc: '...' }
];
```

### Horários disponíveis — `shared.js`
```js
const ALL_SLOTS = ['08:00','08:40','09:20', ...];
```

### Cores — `css/style.css` (em ambos)
```css
--brown: #6B3A2A;
--gold:  #C49A6C;
```

---

## 📌 Próximos passos para produção

- [ ] Backend (Node.js / Supabase / Firebase) para persistência real
- [ ] Autenticação do barbeiro com senha
- [ ] API WhatsApp sem interação manual (Z-API, Twilio)
- [ ] Múltiplos barbeiros com agenda individual
- [ ] Histórico e relatórios de receita
- [ ] PWA com notificações push nativas

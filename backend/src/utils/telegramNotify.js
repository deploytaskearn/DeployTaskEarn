const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function callTelegram(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    throw new Error('TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not configured');
  }
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'HTML' }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Telegram API error ${res.status}: ${body}`);
  }
}

// Fire-and-forget — a failed Telegram alert must never break the
// user-facing deposit/withdrawal request that triggered it. Silently
// no-ops if the bot isn't configured, so this is safe to call unconditionally.
function sendTelegramAlert(text) {
  callTelegram(text).catch((err) => console.error('sendTelegramAlert: failed to send:', err.message));
}

module.exports = { sendTelegramAlert, callTelegram };

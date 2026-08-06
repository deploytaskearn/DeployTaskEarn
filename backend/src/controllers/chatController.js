const pool = require('../db/pool');
const { notifyAdmin } = require('../utils/adminNotify');
const { sendTelegramAlert } = require('../utils/telegramNotify');

const MAX_MESSAGE_LENGTH = 2000;

// ───────────── USER ─────────────

async function sendMessage(req, res) {
  try {
    const message = (req.body?.message || '').trim();
    if (!message) return res.status(400).json({ error: 'Message cannot be empty' });
    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters)` });
    }

    const result = await pool.query(
      `INSERT INTO "ChatMessage" (id, "userId", "senderRole", message, "isRead", "createdAt")
       VALUES (gen_random_uuid(), $1, 'USER', $2, false, now()) RETURNING *`,
      [req.user.id, message]
    );

    notifyAdmin('CHAT', `New chat message from ${req.user.email}`, message.slice(0, 200), '/chat');
    sendTelegramAlert(`💬 <b>New Chat Message</b>\nFrom: ${req.user.email}\n${message.slice(0, 300)}`);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('sendMessage error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getMyMessages(req, res) {
  try {
    const result = await pool.query(
      `SELECT * FROM "ChatMessage" WHERE "userId" = $1 ORDER BY "createdAt" ASC`,
      [req.user.id]
    );
    // The user is viewing the thread now, so any admin replies are read.
    await pool.query(
      `UPDATE "ChatMessage" SET "isRead" = true WHERE "userId" = $1 AND "senderRole" = 'ADMIN' AND "isRead" = false`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('getMyMessages error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function getMyUnreadCount(req, res) {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) FROM "ChatMessage" WHERE "userId" = $1 AND "senderRole" = 'ADMIN' AND "isRead" = false`,
      [req.user.id]
    );
    res.json({ count: parseInt(result.rows[0].count, 10) });
  } catch (err) {
    console.error('getMyUnreadCount error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ───────────── ADMIN ─────────────

// One row per user who has ever messaged, with their latest message and how
// many of their messages the admin hasn't read yet — an inbox-style list.
async function adminListConversations(req, res) {
  try {
    const result = await pool.query(`
      SELECT u.id as "userId", u.name, u.email,
        lm.message as "lastMessage", lm."createdAt" as "lastMessageAt", lm."senderRole" as "lastSenderRole",
        COALESCE(uc.count, 0) as "unreadCount"
      FROM "User" u
      JOIN LATERAL (
        SELECT message, "createdAt", "senderRole" FROM "ChatMessage" cm
        WHERE cm."userId" = u.id ORDER BY cm."createdAt" DESC LIMIT 1
      ) lm ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*) as count FROM "ChatMessage" cm2
        WHERE cm2."userId" = u.id AND cm2."senderRole" = 'USER' AND cm2."isRead" = false
      ) uc ON true
      ORDER BY lm."createdAt" DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('adminListConversations error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function adminGetThread(req, res) {
  try {
    const { userId } = req.params;
    const result = await pool.query(
      `SELECT * FROM "ChatMessage" WHERE "userId" = $1 ORDER BY "createdAt" ASC`,
      [userId]
    );
    // The admin is viewing the thread now, so any user messages are read.
    await pool.query(
      `UPDATE "ChatMessage" SET "isRead" = true WHERE "userId" = $1 AND "senderRole" = 'USER' AND "isRead" = false`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('adminGetThread error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function adminReply(req, res) {
  try {
    const { userId } = req.params;
    const message = (req.body?.message || '').trim();
    if (!message) return res.status(400).json({ error: 'Message cannot be empty' });
    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters)` });
    }

    const userCheck = await pool.query(`SELECT id FROM "User" WHERE id = $1`, [userId]);
    if (userCheck.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const result = await pool.query(
      `INSERT INTO "ChatMessage" (id, "userId", "senderRole", message, "isRead", "createdAt")
       VALUES (gen_random_uuid(), $1, 'ADMIN', $2, false, now()) RETURNING *`,
      [userId, message]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('adminReply error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  sendMessage,
  getMyMessages,
  getMyUnreadCount,
  adminListConversations,
  adminGetThread,
  adminReply,
};

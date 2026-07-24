const walletService = require('../services/walletService');

async function myHistory(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 200);
    const offset = parseInt(req.query.offset, 10) || 0;
    const entries = await walletService.getLedgerHistory(req.user.id, limit, offset);
    res.json(entries);
  } catch (err) {
    console.error('myHistory error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { myHistory };

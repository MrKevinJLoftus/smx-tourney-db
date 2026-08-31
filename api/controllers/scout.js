const statmaniaxClient = require('../services/statmaniaxClient');
const pocketVetoService = require('../services/pocketVetoService');

exports.searchPlayers = async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) {
    return res.status(200).json([]);
  }

  const users = await statmaniaxClient.searchUsers(q);
  res.status(200).json(users);
};

exports.resolvePlayer = async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) {
    return res.status(400).json({ message: 'Query is required.' });
  }

  const user = await statmaniaxClient.resolveUser(q);
  if (!user) {
    return res.status(404).json({ message: 'No StatManiaX player found for that query.' });
  }

  res.status(200).json(user);
};

exports.compare = async (req, res) => {
  const { youId, opponentIds, mode, levelMin, levelMax } = req.body || {};

  if (!Array.isArray(opponentIds)) {
    return res.status(400).json({ message: 'opponentIds must be an array.' });
  }

  try {
    const result = await pocketVetoService.comparePlayers({
      youId,
      opponentIds,
      mode,
      levelMin,
      levelMax,
    });
    res.status(200).json(result);
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) {
      console.error('scout.compare:', error);
    }
    res.status(status).json({ message: error.message || 'Failed to compare players.' });
  }
};

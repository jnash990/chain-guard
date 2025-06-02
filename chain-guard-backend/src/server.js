const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { initializeDataStore, readData, writeData, isLeader } = require('./dataStore');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Initialize data store
initializeDataStore().catch(console.error);

// Check role endpoint
app.get('/api/check-role', async (req, res) => {
  try {
    const { player_id } = req.query;
    if (!player_id) {
      return res.status(400).json({ error: 'player_id is required' });
    }

    const data = await readData();
    for (const [factionId, faction] of Object.entries(data.factions)) {
      if (faction.leaders.includes(Number(player_id))) {
        return res.json({
          role: 'leader',
          faction_id: Number(factionId)
        });
      }
    }

    res.json({ role: 'member' });
  } catch (error) {
    console.error('Error checking role:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check chain endpoint
app.get('/api/check-chain', async (req, res) => {
  try {
    const { faction_id } = req.query;
    if (!faction_id) {
      return res.status(400).json({ error: 'faction_id is required' });
    }

    const data = await readData();
    const faction = data.factions[faction_id];
    
    if (!faction || !faction.chain) {
      return res.json({ active: false });
    }

    res.json({
      active: faction.chain.active,
      status: faction.chain.status
    });
  } catch (error) {
    console.error('Error checking chain:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start chain endpoint
app.post('/api/start-chain', async (req, res) => {
  try {
    const { faction_id, player_id } = req.body;
    if (!faction_id || !player_id) {
      return res.status(400).json({ error: 'faction_id and player_id are required' });
    }

    if (!await isLeader(faction_id, player_id)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const data = await readData();
    if (!data.factions[faction_id]) {
      data.factions[faction_id] = { leaders: [] };
    }

    data.factions[faction_id].chain = {
      active: true,
      status: 'green',
      updatedAt: Date.now()
    };

    await writeData(data);
    res.json({ success: true });
  } catch (error) {
    console.error('Error starting chain:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// End chain endpoint
app.post('/api/end-chain', async (req, res) => {
  try {
    const { faction_id, player_id } = req.body;
    if (!faction_id || !player_id) {
      return res.status(400).json({ error: 'faction_id and player_id are required' });
    }

    if (!await isLeader(faction_id, player_id)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const data = await readData();
    if (data.factions[faction_id]) {
      delete data.factions[faction_id].chain;
    }

    await writeData(data);
    res.json({ success: true });
  } catch (error) {
    console.error('Error ending chain:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update chain endpoint
app.post('/api/update-chain', async (req, res) => {
  try {
    const { faction_id, player_id, status } = req.body;
    if (!faction_id || !player_id || !status) {
      return res.status(400).json({ error: 'faction_id, player_id, and status are required' });
    }

    if (!['red', 'yellow', 'green'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    if (!await isLeader(faction_id, player_id)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const data = await readData();
    if (!data.factions[faction_id]?.chain?.active) {
      return res.status(400).json({ error: 'No active chain' });
    }

    data.factions[faction_id].chain.status = status;
    data.factions[faction_id].chain.updatedAt = Date.now();

    await writeData(data);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating chain:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 
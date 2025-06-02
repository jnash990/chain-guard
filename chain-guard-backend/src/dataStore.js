const fs = require('fs').promises;
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/db.json');

// Initialize data structure
const initialData = {
  factions: {}
};

// Ensure data directory exists and initialize file if needed
async function initializeDataStore() {
  try {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    try {
      await fs.access(DATA_FILE);
    } catch {
      await fs.writeFile(DATA_FILE, JSON.stringify(initialData, null, 2));
    }
  } catch (error) {
    console.error('Error initializing data store:', error);
    throw error;
  }
}

// Read data from file
async function readData() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading data:', error);
    throw error;
  }
}

// Write data to file
async function writeData(data) {
  try {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error writing data:', error);
    throw error;
  }
}

// Helper function to check if a player is a leader
async function isLeader(factionId, playerId) {
  const data = await readData();
  const faction = data.factions[factionId];
  return faction && faction.leaders.includes(playerId);
}

module.exports = {
  initializeDataStore,
  readData,
  writeData,
  isLeader
}; 
# Chain Guard Backend

This is the backend API for the Chain Guard browser extension, providing endpoints for managing chain coordination within Torn factions.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

The server will run on port 3000 by default. You can change this by setting the `PORT` environment variable.

## API Endpoints

### Check Role
- **GET** `/api/check-role?player_id=123`
- Returns the role of a player (leader or member) and their faction ID if they are a leader

### Check Chain
- **GET** `/api/check-chain?faction_id=123456`
- Returns the current chain status for a faction

### Start Chain
- **POST** `/api/start-chain`
- Body: `{ "faction_id": 123456, "player_id": 111 }`
- Starts a new chain for a faction (requires leader authorization)

### End Chain
- **POST** `/api/end-chain`
- Body: `{ "faction_id": 123456, "player_id": 111 }`
- Ends the current chain for a faction (requires leader authorization)

### Update Chain
- **POST** `/api/update-chain`
- Body: `{ "faction_id": 123456, "player_id": 111, "status": "yellow" }`
- Updates the chain status (requires leader authorization)
- Valid status values: "red", "yellow", "green"

## Data Storage

The backend uses a local JSON file (`data/db.json`) to store faction and chain data. The file is automatically created when the server starts.

Example data structure:
```json
{
  "factions": {
    "123456": {
      "leaders": [111, 222],
      "chain": {
        "active": true,
        "status": "red",
        "updatedAt": 1728372837
      }
    }
  }
}
``` 
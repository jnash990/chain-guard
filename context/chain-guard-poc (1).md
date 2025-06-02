# Chain Guard – PoC

## 🧠 Context

This project is a proof-of-concept (PoC) for **Chain Guard**, a browser extension for the online game [Torn](https://www.torn.com/). The goal is to improve coordination within factions during chains by providing a synchronized "traffic light" (🔴🟡🟢) system that is controlled by faction leaders.

When the traffic light is red, the extension will **visually block or disable the attack button** to prevent unwanted hits during coordination pauses.

Originally, a Firebase-based real-time system was considered. However, for simplicity, the current architecture relies entirely on a backend API with periodic polling by the extension.

---

## 🧩 Components

### 1. Browser Extension

- On first run, asks the user to enter their **Torn API Key**.
- Uses the key to call `https://api.torn.com/user/?key=API_KEY` to retrieve:
  - `player_id`
  - `faction.faction_id`
- Sends the key to the backend to check if the user is authorized to start and end chain controlsl and to control the traffic light.
- If a chain is active, it will inject a UI panel into the right side of the Torn interface. This Panel should be draggable.
- Displays the current traffic light state for normal users.
- Shows traffic light controls (green/yellow/red) for authorized faction leaders.
- When the user enters a chain-related page (e.g. attack page), the extension:
  - Calls the backend to fetch the current chain status.
  - If the chain is active, displays the UI and disables the attack button if the status is `red`, and show a warning if the status os `yellow`.
  - Optionally polls the backend every 5 seconds to detect status changes.

### 2. Backend API


The backend is responsible for managing registered factions and their authorized leaders. It also stores the current chain state (active or not, and traffic light status).

The only user with access to the admin backoffice is the system owner. Each faction has:
- A `faction_id`
- An array of authorized leader `player_id`s
- An optional chain object if a chain is currently active

### 📦 Example data structure
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

### 🔑 Endpoints

GET /api/check-role?player_id=123
Purpose: Checks if the player is a leader of any faction.

Response:

```json
{
  "role": "leader",    
  "faction_id": 123456
}
```

GET /api/check-chain?faction_id=123456
Purpose: Returns whether a chain is active and the current status.

Response:

```json
{
  "active": true,
  "status": "red"
}
```

POST /api/start-chain
Payload:

```json
{
  "faction_id": 123456,
  "player_id": 111
}
```

Validation:

Check if player_id is a leader of faction_id.

Response:

```json
{
  "success": true
}```


POST /api/end-chain
Payload:

```json
{
  "faction_id": 123456,
  "player_id": 111
}```

Validation:
Check if player_id is a leader.

Response:

```json
{
  "success": true
}```

POST /api/update-chain
Payload:

```json
{
  "faction_id": 123456,
  "player_id": 111,
  "status": "yellow"
}

Validation:
- Check if player_id is a leader.
- Ensure that a chain is currently active.

Response:

```json
{
  "success": true
}

🔐 Internal validation helper
```js
function isLeader(factionId, playerId) {
  const faction = db.factions[factionId];
  return faction && faction.leaders.includes(playerId);
}```

These endpoints allow the browser extension to:
- Verify user roles
- Fetch chain status periodically (polling)
- Let faction leaders control the state of the traffic light

### Tech Stack

For the tech stack, we'll use a node.js + express. and the data will be stored on a local private json.
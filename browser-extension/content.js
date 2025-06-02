// Configuration
const API_BASE_URL = 'https://torn-chain-guard.up.railway.app/api/';
const POLL_INTERVAL = 5000; // 5 seconds

// State
let userData = null;
let chainStatus = null;
let isLeader = false;
let factionId = null;

// UI Elements
let controlPanel = null;
let statusIndicator = null;
let attackButton = null;

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request);
  if (request.action === 'getUserData') {
    sendResponse({
      playerId: userData?.playerId,
      factionId: userData?.factionId,
      isLeader: isLeader
    });
  }
  return true;
});

// Initialize extension
async function initialize() {
  // Check if API key is stored
  const apiKey = await chrome.storage.local.get('tornApiKey');
  if (!apiKey.tornApiKey) {
    return; // Don't show prompt, let popup handle it
  }

  // Check if we have stored user data
  const { playerId, factionId: storedFactionId, isLeader: storedIsLeader } = await chrome.storage.local.get(['playerId', 'factionId', 'isLeader']);
  
  if (playerId && storedFactionId) {
    userData = { playerId, factionId: storedFactionId };
    isLeader = storedIsLeader;
    factionId = storedFactionId;
    startChainMonitoring();
    return;
  }

  // Fetch user data from Torn API
  try {
    const response = await fetch(`https://api.torn.com/user/?key=${apiKey.tornApiKey}`);
    const data = await response.json();
    
    if (data.error) {
      return;
    }

    userData = {
      playerId: data.player_id,
      factionId: data.faction?.faction_id
    };

    // Check if user is a leader
    const roleResponse = await fetch(`${API_BASE_URL}/check-role?player_id=${userData.playerId}`);
    const roleData = await roleResponse.json();
    
    isLeader = roleData.role === 'leader';
    factionId = roleData.faction_id;

    // Store the data
    await chrome.storage.local.set({
      playerId: userData.playerId,
      factionId: userData.factionId,
      isLeader: isLeader
    });

    // Start monitoring chain status
    startChainMonitoring();
  } catch (error) {
    console.error('Error initializing:', error);
  }
}

// Create and inject the control panel
function createControlPanel() {
  // Only create panel if user is a leader and chain is active
  if (!isLeader || !chainStatus) return;

  controlPanel = document.createElement('div');
  controlPanel.id = 'chain-guard-panel';
  controlPanel.className = 'chain-guard-panel';
  
  const header = document.createElement('div');
  header.className = 'chain-guard-header';
  header.innerHTML = `
    <span>Chain Guard</span>
    <button class="chain-guard-close">×</button>
  `;

  statusIndicator = document.createElement('div');
  statusIndicator.className = 'chain-guard-status';
  statusIndicator.innerHTML = '<div class="status-light"></div>';

  const controls = document.createElement('div');
  controls.className = 'chain-guard-controls';
  
  controls.innerHTML = `
    <button class="chain-guard-btn" data-status="green">🟢</button>
    <button class="chain-guard-btn" data-status="yellow">🟡</button>
    <button class="chain-guard-btn" data-status="red">🔴</button>
  `;

  controlPanel.appendChild(header);
  controlPanel.appendChild(statusIndicator);
  controlPanel.appendChild(controls);

  // Make panel draggable
  makeDraggable(controlPanel, header);

  // Add event listeners
  header.querySelector('.chain-guard-close').addEventListener('click', () => {
    controlPanel.remove();
  });

  controls.querySelectorAll('.chain-guard-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const status = btn.dataset.status;
      await updateChainStatus(status);
    });
  });

  document.body.appendChild(controlPanel);
}

// Make an element draggable
function makeDraggable(element, handle) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  
  handle.onmousedown = dragMouseDown;

  function dragMouseDown(e) {
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    element.style.top = (element.offsetTop - pos2) + "px";
    element.style.left = (element.offsetLeft - pos1) + "px";
  }

  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

// Update chain status
async function updateChainStatus(status) {
  try {
    const response = await fetch(`${API_BASE_URL}/update-chain`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        faction_id: factionId,
        player_id: userData.playerId,
        status: status
      })
    });

    if (!response.ok) {
      throw new Error('Failed to update chain status');
    }

    await checkChainStatus();
  } catch (error) {
    console.error('Error updating chain status:', error);
  }
}

// Check chain status
async function checkChainStatus() {
  try {
    const response = await fetch(`${API_BASE_URL}/check-chain?faction_id=${factionId}`);
    const data = await response.json();

    if (data.active) {
      chainStatus = data.status;
      updateUI();
    } else {
      chainStatus = null;
      if (controlPanel) {
        controlPanel.remove();
        controlPanel = null;
      }
    }
  } catch (error) {
    console.error('Error checking chain status:', error);
  }
}

// Update UI based on chain status
function updateUI() {
  if (!chainStatus) return;

  // Update status indicator
  if (statusIndicator) {
    const statusLight = statusIndicator.querySelector('.status-light');
    statusLight.className = `status-light ${chainStatus}`;
  }

  // Handle attack button
  const attackBtn = document.querySelector('button[data-action="attack"]');
  if (attackBtn) {
    if (chainStatus === 'red') {
      attackBtn.disabled = true;
      attackBtn.title = 'Chain is paused (red)';
    } else if (chainStatus === 'yellow') {
      attackBtn.disabled = false;
      attackBtn.title = 'Chain is active but be careful (yellow)';
    } else {
      attackBtn.disabled = false;
      attackBtn.title = 'Chain is active (green)';
    }
  }

  // Show control panel if not already shown
  if (!controlPanel) {
    createControlPanel();
  }
}

// Start monitoring chain status
function startChainMonitoring() {
  checkChainStatus();
  setInterval(checkChainStatus, POLL_INTERVAL);
}

// Initialize when the page loads
initialize(); 
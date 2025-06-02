// Configuration
const API_BASE_URL = 'http://localhost:3000/api';
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

// Initialize extension
async function initialize() {
  // Check if API key is stored
  const apiKey = await chrome.storage.local.get('tornApiKey');
  if (!apiKey.tornApiKey) {
    showApiKeyPrompt();
    return;
  }

  // Fetch user data from Torn API
  try {
    const response = await fetch(`https://api.torn.com/user/?key=${apiKey.tornApiKey}`);
    const data = await response.json();
    
    if (data.error) {
      showError('Invalid API key');
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

    // Start monitoring chain status
    startChainMonitoring();
  } catch (error) {
    console.error('Error initializing:', error);
    showError('Failed to initialize');
  }
}

// Create and inject the control panel
function createControlPanel() {
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
  
  if (isLeader) {
    controls.innerHTML = `
      <button class="chain-guard-btn" data-status="green">🟢</button>
      <button class="chain-guard-btn" data-status="yellow">🟡</button>
      <button class="chain-guard-btn" data-status="red">🔴</button>
    `;
  }

  controlPanel.appendChild(header);
  controlPanel.appendChild(statusIndicator);
  controlPanel.appendChild(controls);

  // Make panel draggable
  makeDraggable(controlPanel, header);

  // Add event listeners
  header.querySelector('.chain-guard-close').addEventListener('click', () => {
    controlPanel.remove();
  });

  if (isLeader) {
    controls.querySelectorAll('.chain-guard-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const status = btn.dataset.status;
        await updateChainStatus(status);
      });
    });
  }

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
    showError('Failed to update chain status');
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

// Show API key prompt
function showApiKeyPrompt() {
  const prompt = document.createElement('div');
  prompt.className = 'chain-guard-prompt';
  prompt.innerHTML = `
    <div class="chain-guard-prompt-content">
      <h3>Chain Guard Setup</h3>
      <p>Please enter your Torn API key:</p>
      <input type="text" id="api-key-input" placeholder="Enter API key">
      <button id="save-api-key">Save</button>
    </div>
  `;

  document.body.appendChild(prompt);

  prompt.querySelector('#save-api-key').addEventListener('click', async () => {
    const apiKey = prompt.querySelector('#api-key-input').value;
    await chrome.storage.local.set({ tornApiKey: apiKey });
    prompt.remove();
    initialize();
  });
}

// Show error message
function showError(message) {
  const error = document.createElement('div');
  error.className = 'chain-guard-error';
  error.textContent = message;
  document.body.appendChild(error);
  setTimeout(() => error.remove(), 3000);
}

// Start monitoring chain status
function startChainMonitoring() {
  checkChainStatus();
  setInterval(checkChainStatus, POLL_INTERVAL);
}

// Initialize when the page loads
initialize(); 
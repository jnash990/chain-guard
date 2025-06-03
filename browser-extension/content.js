// Configuration
const API_BASE_URL = 'https://torn-chain-guard.up.railway.app/api';
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
    isLeader = storedIsLeader === undefined ? false : storedIsLeader;
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

    // Store the data, always set isLeader (true or false)
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
  // Only create panel if chain is active
  if (!chainStatus) return;

  // Remove existing panel if present
  if (controlPanel) {
    controlPanel.remove();
    controlPanel = null;
  }

  controlPanel = document.createElement('div');
  controlPanel.id = 'chain-guard-panel';
  controlPanel.className = 'chain-guard-panel';
  
  const header = document.createElement('div');
  header.className = 'chain-guard-header';
  header.innerHTML = `
    <span>Chain Guard</span>
    <button class="chain-guard-close">×</button>
  `;

  // Status indicator with traffic lights
  statusIndicator = document.createElement('div');
  statusIndicator.className = 'chain-guard-status';
  statusIndicator.innerHTML = `
    <div class="traffic-lights">
      <span class="status-light green${chainStatus === 'green' ? ' active' : ''}"></span>
      <span class="status-light yellow${chainStatus === 'yellow' ? ' active' : ''}"></span>
      <span class="status-light red${chainStatus === 'red' ? ' active' : ''}"></span>
      <span class="status-label">${chainStatus ? chainStatus.charAt(0).toUpperCase() + chainStatus.slice(1) : ''}</span>
    </div>
  `;

  controlPanel.appendChild(header);
  controlPanel.appendChild(statusIndicator);

  // Only show controls for leaders
  if (isLeader) {
    const controls = document.createElement('div');
    controls.className = 'chain-guard-controls';
    controls.innerHTML = `
      <button class="chain-guard-btn" data-status="green">🟢</button>
      <button class="chain-guard-btn" data-status="yellow">🟡</button>
      <button class="chain-guard-btn" data-status="red">🔴</button>
    `;
    controls.querySelectorAll('.chain-guard-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const status = btn.dataset.status;
        await updateChainStatus(status);
      });
    });
    controlPanel.appendChild(controls);
  }

  // Make panel draggable
  makeDraggable(controlPanel, header);

  // Add event listener for close button
  header.querySelector('.chain-guard-close').addEventListener('click', () => {
    controlPanel.remove();
    controlPanel = null;
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

  // Remove and recreate the panel to update status lights and controls
  createControlPanel();

  // Handle attack button(s) on profile page
  const attackButtons = Array.from(document.querySelectorAll('a[id^="button0-profile-"]'));
  attackButtons.forEach(btn => {
    // Remove any previous tooltip
    btn.removeAttribute('data-chain-guard-tooltip');
    btn.removeEventListener('mouseenter', btn._chainGuardTooltipHandler);
    btn.removeEventListener('mouseleave', btn._chainGuardTooltipRemover);
    btn.style.pointerEvents = '';
    btn.title = '';
    btn.classList.remove('chain-guard-disabled');
    btn.removeAttribute('aria-disabled');

    if (chainStatus === 'red') {
      btn.title = 'STOP! Check chat';
      btn.setAttribute('data-chain-guard-tooltip', 'STOP! Check chat');
      btn._chainGuardTooltipHandler = function() {
        showChainGuardTooltip(btn, 'STOP! Check chat');
      };
      btn._chainGuardTooltipRemover = function() {
        hideChainGuardTooltip();
      };
      btn.addEventListener('mouseenter', btn._chainGuardTooltipHandler);
      btn.addEventListener('mouseleave', btn._chainGuardTooltipRemover);
    } else if (chainStatus === 'yellow') {
      btn.title = 'Pause! Check faction chat.';
      btn.setAttribute('data-chain-guard-tooltip', 'Pause! Check faction chat.');
      btn._chainGuardTooltipHandler = function() {
        showChainGuardTooltip(btn, 'Pause! Check faction chat.');
      };
      btn._chainGuardTooltipRemover = function() {
        hideChainGuardTooltip();
      };
      btn.addEventListener('mouseenter', btn._chainGuardTooltipHandler);
      btn.addEventListener('mouseleave', btn._chainGuardTooltipRemover);
    }
    // If green or no chain, button is normal
    if (chainStatus === 'green' || !chainStatus) {
      btn.classList.remove('chain-guard-disabled');
      btn.removeAttribute('aria-disabled');
      btn.style.pointerEvents = '';
    }
  });
}

// Tooltip helpers
let chainGuardTooltipEl = null;
function showChainGuardTooltip(target, text) {
  hideChainGuardTooltip();
  chainGuardTooltipEl = document.createElement('div');
  chainGuardTooltipEl.className = 'chain-guard-tooltip';
  chainGuardTooltipEl.textContent = text;
  document.body.appendChild(chainGuardTooltipEl);
  const rect = target.getBoundingClientRect();
  chainGuardTooltipEl.style.position = 'fixed';
  chainGuardTooltipEl.style.left = `${rect.left + rect.width / 2}px`;
  chainGuardTooltipEl.style.top = `${rect.top - 32}px`;
  chainGuardTooltipEl.style.transform = 'translateX(-50%)';
  chainGuardTooltipEl.style.zIndex = 10001;
}
function hideChainGuardTooltip() {
  if (chainGuardTooltipEl) {
    chainGuardTooltipEl.remove();
    chainGuardTooltipEl = null;
  }
}

// Start monitoring chain status
function startChainMonitoring() {
  checkChainStatus();
  setInterval(checkChainStatus, POLL_INTERVAL);
}

// Initialize when the page loads
initialize(); 
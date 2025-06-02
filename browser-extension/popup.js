// Constants
const API_BASE_URL = 'https://torn-chain-guard.up.railway.app/api';
const TORN_API_URL = 'https://api.torn.com/user/';

// DOM Elements
const statusLight = document.querySelector('.status-light');
const statusText = document.getElementById('status-text');
const errorMessage = document.getElementById('error-message');
const apiKeyContainer = document.getElementById('api-key-container');
const apiKeyInput = document.getElementById('api-key-input');
const saveApiKeyButton = document.getElementById('save-api-key');
const leaderControls = document.getElementById('leader-controls');
const chainActions = document.getElementById('chain-actions');
const startChainButton = document.getElementById('start-chain');
const endChainButton = document.getElementById('end-chain');

// Debug Elements
const debugPlayerId = document.getElementById('debug-player-id');
const debugFactionId = document.getElementById('debug-faction-id');
const debugIsLeader = document.getElementById('debug-is-leader');

// Initialize popup
async function initializePopup() {
  // Check if API key exists
  const { tornApiKey } = await chrome.storage.local.get('tornApiKey');
  console.log('API Key exists:', !!tornApiKey);
  
  if (!tornApiKey) {
    showApiKeyInput();
    return;
  }

  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  console.log('Current tab URL:', tab.url);
  
  // Check if we're on Torn
  if (!tab.url.includes('torn.com')) {
    showError('Please navigate to Torn.com');
    return;
  }

  try {
    // Check if we have stored user data
    const { playerId, factionId, isLeader } = await chrome.storage.local.get(['playerId', 'factionId', 'isLeader']);
    console.log('Stored user data:', { playerId, factionId, isLeader });

    let currentPlayerId = playerId;
    let currentFactionId = factionId;
    let currentIsLeader = isLeader;

    // If we don't have player data, fetch it from Torn API
    if (!currentPlayerId || !currentFactionId) {
      console.log('Fetching user data from Torn API...');
      const tornResponse = await fetch(`${TORN_API_URL}?key=${tornApiKey}`);
      const tornData = await tornResponse.json();
      console.log('Torn API Response:', tornData);

      if (tornData.error) {
        showError('Invalid API key');
        return;
      }

      currentPlayerId = tornData.player_id;
      currentFactionId = tornData.faction?.faction_id;

      // Store the data
      await chrome.storage.local.set({
        playerId: currentPlayerId,
        factionId: currentFactionId
      });
    }

    // If we don't have leader status or it's false, check it
    if (!currentIsLeader) {
      console.log('Checking leader role...');
      const roleResponse = await fetch(`${API_BASE_URL}/check-role?player_id=${currentPlayerId}`);
      const roleData = await roleResponse.json();
      console.log('Role check response:', roleData);
      
      currentIsLeader = roleData.role === 'leader';
      await chrome.storage.local.set({ isLeader: currentIsLeader });
    }

    // Update debug information
    debugPlayerId.textContent = currentPlayerId || 'Not set';
    debugFactionId.textContent = currentFactionId || 'Not set';
    debugIsLeader.textContent = currentIsLeader ? 'Yes' : 'No';

    // Fetch chain status
    const url = `${API_BASE_URL}/check-chain?faction_id=${currentFactionId}`;
    console.log('Making chain status request to:', url);
    
    const chainResponse = await fetch(url);
    const data = await chainResponse.json();
    console.log('Chain status API Response:', data);
    
    // Update UI based on chain active status
    if (data.active) {
      updateStatus(data.status);
      // Show status controls and end chain button
      if (currentIsLeader) {
        console.log('Showing leader controls with end chain button');
        leaderControls.classList.add('active');
        chainActions.classList.remove('active');
      } else {
        console.log('User is not a leader, hiding all controls');
        leaderControls.classList.remove('active');
        chainActions.classList.remove('active');
      }
    } else {
      updateStatus(null);
      // Show start chain button
      if (currentIsLeader) {
        console.log('Showing start chain button');
        chainActions.classList.add('active');
        leaderControls.classList.remove('active');
      } else {
        console.log('User is not a leader, hiding all controls');
        leaderControls.classList.remove('active');
        chainActions.classList.remove('active');
      }
    }
  } catch (error) {
    console.error('API Error:', error);
    showError('Failed to fetch data');
  }
}

// Show API key input
function showApiKeyInput() {
  apiKeyContainer.style.display = 'block';
  leaderControls.classList.remove('active');
  chainActions.classList.remove('active');
}

// Update status display
function updateStatus(status) {
  console.log('Updating status display with:', status);
  
  if (!status) {
    statusLight.className = 'status-light';
    statusText.textContent = 'No active chain';
    return;
  }

  statusLight.className = `status-light ${status}`;
  statusText.textContent = `Chain is ${status}`;
}

// Show error message
function showError(message) {
  console.log('Showing error:', message);
  errorMessage.textContent = message;
}

// Start chain
async function startChain() {
  try {
    const { playerId, factionId } = await chrome.storage.local.get(['playerId', 'factionId']);
    const response = await fetch(`${API_BASE_URL}/start-chain`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        faction_id: factionId,
        player_id: playerId
      })
    });

    if (!response.ok) {
      throw new Error('Failed to start chain');
    }

    // Refresh the status
    initializePopup();
  } catch (error) {
    console.error('Error starting chain:', error);
    showError('Failed to start chain');
  }
}

// End chain
async function endChain() {
  try {
    const { playerId, factionId } = await chrome.storage.local.get(['playerId', 'factionId']);
    const response = await fetch(`${API_BASE_URL}/end-chain`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        faction_id: factionId,
        player_id: playerId
      })
    });

    if (!response.ok) {
      throw new Error('Failed to end chain');
    }

    // Refresh the status
    initializePopup();
  } catch (error) {
    console.error('Error ending chain:', error);
    showError('Failed to end chain');
  }
}

// Update chain status
async function updateChainStatus(status) {
  try {
    const { playerId, factionId } = await chrome.storage.local.get(['playerId', 'factionId']);
    const response = await fetch(`${API_BASE_URL}/update-chain`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        faction_id: factionId,
        player_id: playerId,
        status: status
      })
    });

    if (!response.ok) {
      throw new Error('Failed to update chain status');
    }

    // Refresh the status
    initializePopup();
  } catch (error) {
    console.error('Error updating chain status:', error);
    showError('Failed to update chain status');
  }
}

// Event Listeners
saveApiKeyButton.addEventListener('click', async () => {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    showError('Please enter an API key');
    return;
  }

  await chrome.storage.local.set({ tornApiKey: apiKey });
  apiKeyContainer.style.display = 'none';
  initializePopup();
});

// Start/End chain buttons
startChainButton.addEventListener('click', startChain);
endChainButton.addEventListener('click', endChain);

// Leader control buttons
leaderControls.querySelectorAll('.chain-guard-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const status = btn.dataset.status;
    await updateChainStatus(status);
  });
});

// Initialize when popup opens
document.addEventListener('DOMContentLoaded', initializePopup); 
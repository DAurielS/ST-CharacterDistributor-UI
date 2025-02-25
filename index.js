// UI Extension for Character Distributor
// This extension provides the user interface for configuring and interacting with the server plugin

// Import SillyTavern functions
import { extension_settings, getContext, loadExtensionSettings } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";

// Extension metadata
const MODULE_NAME = 'ST-CharacterDistributor';
const extensionFolderPath = `/scripts/extensions/third-party/${MODULE_NAME}`;

// Default settings
const defaultSettings = {
    dropboxAppKey: '',
    dropboxAppSecret: '',
    autoSync: true,
    syncInterval: 1800, // 30 minutes
    excludeTags: ['Private']
};

// Initialize extension settings if needed
function loadSettings() {
    extension_settings[MODULE_NAME] = extension_settings[MODULE_NAME] || {};
    if (Object.keys(extension_settings[MODULE_NAME]).length === 0) {
        Object.assign(extension_settings[MODULE_NAME], defaultSettings);
        saveSettingsDebounced();
    }
    
    // Update UI with current settings
    $('#dropbox_app_key').val(extension_settings[MODULE_NAME].dropboxAppKey || '');
    $('#dropbox_app_secret').val(extension_settings[MODULE_NAME].dropboxAppSecret || '');
    $('#auto_sync').prop('checked', extension_settings[MODULE_NAME].autoSync || false);
    $('#sync_interval').val(extension_settings[MODULE_NAME].syncInterval / 60);
    $('#exclude_tags').val(extension_settings[MODULE_NAME].excludeTags.join(', '));
}

// Save settings from UI inputs
function saveSettings() {
    console.log('Character Distributor UI: Saving settings...');
    const settings = extension_settings[MODULE_NAME];
    
    Object.assign(settings, {
        dropboxAppKey: $('#dropbox_app_key').val(),
        dropboxAppSecret: $('#dropbox_app_secret').val(),
        autoSync: $('#auto_sync').prop('checked'),
        syncInterval: parseInt($('#sync_interval').val()) * 60,
        excludeTags: $('#exclude_tags').val().split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
    });
    
    saveSettingsDebounced();
    
    // Send settings to server plugin
    sendSettingsToServer();
}

// Send settings to server plugin
async function sendSettingsToServer() {
    try {
        const response = await fetch('/api/plugins/character-distributor/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(extension_settings[MODULE_NAME])
        });
        
        if (response.ok) {
            console.log('Character Distributor UI: Settings sent to server plugin');
            toastr.success('Settings saved and sent to server plugin');
        } else {
            console.error('Character Distributor UI: Failed to send settings to server plugin');
            toastr.error('Failed to send settings to server plugin');
        }
    } catch (error) {
        console.error('Character Distributor UI: Error sending settings to server plugin', error);
        toastr.error('Error sending settings to server plugin');
    }
}

// Initialize UI components and event handlers
async function initializeUI() {
    // Load settings HTML
    const settingsHtml = await fetch(`${extensionFolderPath}/settings.html`).then(response => response.text());
    $('#extensions_settings2').append(settingsHtml);
    
    // Initialize event handlers
    $('#save_settings').on('click', saveSettings);
    $('#force_sync').on('click', triggerSync);
    $('#dropbox_auth').on('click', authenticateWithDropbox);
    $('#dropbox_logout').on('click', logoutFromDropbox);
    $('#get_share_link').on('click', generateShareLink);
    $('#copy_link').on('click', copyShareLink);
    
    // Load current settings
    loadSettings();
    
    // Check server plugin status
    checkServerStatus();
    
    // Listen for Dropbox auth callback
    window.addEventListener('message', handleDropboxAuthCallback);
}

// Trigger synchronization with Dropbox
async function triggerSync() {
    console.log('Character Distributor UI: Triggering sync...');
    $('#force_sync').prop('disabled', true);
    
    try {
        const response = await fetch('/api/plugins/character-distributor/sync', {
            method: 'POST'
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('Character Distributor UI: Sync result', result);
            updateSyncStatus(result);
            toastr.success('Synchronization completed');
        } else {
            console.error('Character Distributor UI: Sync failed');
            toastr.error('Synchronization failed');
        }
    } catch (error) {
        console.error('Character Distributor UI: Error during sync', error);
        toastr.error('Error during synchronization');
    } finally {
        $('#force_sync').prop('disabled', false);
    }
}

// Check if server plugin is running
async function checkServerStatus() {
    console.log('Character Distributor UI: Checking server status...');
    
    try {
        const response = await fetch('/api/plugins/character-distributor/status');
        
        if (response.ok) {
            const status = await response.json();
            console.log('Character Distributor UI: Server status', status);
            updateServerStatus(status);
        } else {
            console.error('Character Distributor UI: Server status check failed');
            updateServerStatus({ running: false });
        }
    } catch (error) {
        console.error('Character Distributor UI: Error checking server status', error);
        updateServerStatus({ running: false });
    }
}

// Update server status in UI
function updateServerStatus(status) {
    const serverStatusElement = $('#server_status');
    
    if (status.running) {
        serverStatusElement.text('Server plugin: Running');
        serverStatusElement.addClass('success').removeClass('error');
        $('#last_sync').text(`Last sync: ${status.lastSync || 'Never'}`);
        $('#shared_characters').text(`Shared characters: ${status.sharedCharacters || 0}`);
    } else {
        serverStatusElement.text('Server plugin: Not running');
        serverStatusElement.addClass('error').removeClass('success');
    }
}

// Update sync status in UI
function updateSyncStatus(result) {
    const syncStatusElement = $('#sync_status');
    
    if (result.success) {
        syncStatusElement.text(`Sync completed: ${result.message || 'Success'}`);
        syncStatusElement.addClass('success').removeClass('error');
        $('#last_sync').text(`Last sync: ${new Date().toLocaleString()}`);
        $('#shared_characters').text(`Shared characters: ${result.sharedCharacters || 0}`);
    } else {
        syncStatusElement.text(`Sync failed: ${result.error || 'Unknown error'}`);
        syncStatusElement.addClass('error').removeClass('success');
    }
}

// Authenticate with Dropbox
function authenticateWithDropbox() {
    const appKey = extension_settings[MODULE_NAME].dropboxAppKey;
    
    if (!appKey) {
        toastr.error('Please enter your Dropbox App Key in the settings');
        return;
    }
    
    const redirectUri = `${window.location.origin}${extensionFolderPath}/public/oauth_callback.html`;
    const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${appKey}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}`;
    
    // Open popup for authentication
    window.open(authUrl, 'dropbox-auth', 'width=800,height=600');
}

// Handle Dropbox auth callback
function handleDropboxAuthCallback(event) {
    if (event.data && event.data.source === 'dropbox-auth') {
        console.log('Character Distributor UI: Received Dropbox auth callback');
        
        const { accessToken, tokenType, expiresIn } = event.data;
        
        if (accessToken) {
            // Send token to server plugin
            fetch('/api/plugins/character-distributor/auth', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ accessToken, tokenType, expiresIn })
            })
            .then(response => {
                if (response.ok) {
                    $('#auth_status').text('Authenticated');
                    $('#auth_status').addClass('success').removeClass('error');
                    toastr.success('Successfully authenticated with Dropbox');
                } else {
                    $('#auth_status').text('Authentication failed');
                    $('#auth_status').addClass('error').removeClass('success');
                    toastr.error('Failed to save Dropbox authentication');
                }
            })
            .catch(error => {
                console.error('Character Distributor UI: Error saving auth token', error);
                toastr.error('Error saving Dropbox authentication');
            });
        } else {
            $('#auth_status').text('Authentication failed');
            $('#auth_status').addClass('error').removeClass('success');
            toastr.error('Dropbox authentication failed');
        }
    }
}

// Logout from Dropbox
function logoutFromDropbox() {
    fetch('/api/plugins/character-distributor/logout', {
        method: 'POST'
    })
    .then(response => {
        if (response.ok) {
            $('#auth_status').text('Not authenticated');
            $('#auth_status').removeClass('success error');
            toastr.success('Logged out from Dropbox');
        } else {
            toastr.error('Failed to logout from Dropbox');
        }
    })
    .catch(error => {
        console.error('Character Distributor UI: Error logging out', error);
        toastr.error('Error logging out from Dropbox');
    });
}

// Generate share link for a character
function generateShareLink() {
    const characterId = $('#share_character').val();
    
    if (!characterId) {
        toastr.error('Please select a character');
        return;
    }
    
    fetch(`/api/plugins/character-distributor/share/${characterId}`)
    .then(response => response.json())
    .then(data => {
        if (data.shareLink) {
            $('#share_link').val(data.shareLink);
            $('#share_link_container').show();
            toastr.success('Share link generated');
        } else {
            toastr.error('Failed to generate share link');
        }
    })
    .catch(error => {
        console.error('Character Distributor UI: Error generating share link', error);
        toastr.error('Error generating share link');
    });
}

// Copy share link to clipboard
function copyShareLink() {
    const shareLink = $('#share_link').val();
    
    if (shareLink) {
        navigator.clipboard.writeText(shareLink)
            .then(() => toastr.success('Link copied to clipboard'))
            .catch(() => toastr.error('Failed to copy link'));
    }
}

// Load character list for sharing
function loadCharacterList() {
    fetch('/api/characters/all')
    .then(response => response.json())
    .then(characters => {
        const selectElement = $('#share_character');
        selectElement.empty();
        
        characters.forEach(character => {
            selectElement.append($('<option></option>')
                .attr('value', character.avatar_url)
                .text(character.name));
        });
    })
    .catch(error => {
        console.error('Character Distributor UI: Error loading characters', error);
    });
}

// Initialize extension when jQuery is ready
jQuery(async () => {
    await initializeUI();
    
    // Set up refresh interval for server status check
    setInterval(checkServerStatus, 60000); // Check every minute
    
    // Load character list
    loadCharacterList();
    
    console.log('Character Distributor UI: Extension initialized');
});

// Add custom styles
const styleElement = document.createElement('style');
styleElement.textContent = `
#character_distributor_settings .success {
    color: #00aa00;
}

#character_distributor_settings .error {
    color: #ff0000;
}
`;
document.head.appendChild(styleElement); 
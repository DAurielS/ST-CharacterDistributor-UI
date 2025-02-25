// UI Extension for Character Distributor
// This extension provides the user interface for configuring and interacting with the server plugin

// Main function to initialize UI extension
function initializeCharacterDistributorUI() {
    // Extension metadata
    const MODULE_NAME = 'ST-CharacterDistributor';
    const extensionFolderPath = `/scripts/extensions/third-party/${MODULE_NAME}`;
    
    // Get references to SillyTavern APIs
    const extension_settings = window.extension_settings || {};
    const saveSettingsDebounced = window.saveSettingsDebounced || function() {
        console.error('Character Distributor UI: saveSettingsDebounced not found');
    };
    
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
            excludeTags: $('#exclude_tags').val()
                .split(',')
                .map(tag => tag.trim())
                .filter(tag => tag)
        });
        
        saveSettingsDebounced();
        
        // Send settings to server plugin
        sendSettingsToServer();
    }
    
    // Send current settings to server plugin
    async function sendSettingsToServer() {
        try {
            const response = await fetch('/api/characterdistributor/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(extension_settings[MODULE_NAME])
            });
            
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${await response.text()}`);
            }
            
            console.log('Character Distributor UI: Settings sent to server');
        } catch (err) {
            console.error('Character Distributor UI: Failed to send settings to server:', err);
        }
    }
    
    // Initialize UI
    async function initializeUI() {
        console.log('Character Distributor UI: Loading UI...');
        try {
            // Load settings HTML
            const settingsHtml = await $.get(`${extensionFolderPath}/dist/settings.html`);
            $('#extensions_settings').append(settingsHtml);
            
            // Bind event handlers
            $('#save_settings').on('click', saveSettings);
            $('#force_sync').on('click', triggerSync);
            
            // Load settings and update UI
            loadSettings();
            
            // Check server plugin status
            checkServerStatus();
        } catch (err) {
            console.error('Character Distributor UI: Error loading UI:', err);
        }
    }
    
    // Trigger sync operation via server plugin
    async function triggerSync() {
        try {
            const response = await fetch('/api/characterdistributor/sync', {
                method: 'POST'
            });
            
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${await response.text()}`);
            }
            
            const result = await response.json();
            console.log('Character Distributor UI: Sync triggered', result);
            
            // Update UI with sync status
            updateSyncStatus(result);
        } catch (err) {
            console.error('Character Distributor UI: Failed to trigger sync:', err);
            $('#sync_status').text('Sync failed');
        }
    }
    
    // Check if the server plugin is available and running
    async function checkServerStatus() {
        try {
            const response = await fetch('/api/characterdistributor/status');
            
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${await response.text()}`);
            }
            
            const status = await response.json();
            console.log('Character Distributor UI: Server status', status);
            
            // Update UI with server status
            updateServerStatus(status);
        } catch (err) {
            console.error('Character Distributor UI: Failed to check server status:', err);
            $('#server_status').text('Server plugin not available');
            $('#force_sync').prop('disabled', true);
        }
    }
    
    // Update UI with server status
    function updateServerStatus(status) {
        $('#server_status').text(`Server plugin: ${status.running ? 'Running' : 'Not running'}`);
        $('#force_sync').prop('disabled', !status.running);
        
        if (status.lastSync) {
            $('#last_sync').text(`Last sync: ${new Date(status.lastSync).toLocaleString()}`);
        }
        
        if (status.sharedCharacters !== undefined) {
            $('#shared_characters').text(`Shared characters: ${status.sharedCharacters}`);
        }
    }
    
    // Update UI with sync status
    function updateSyncStatus(result) {
        $('#sync_status').text(result.success ? 'Sync complete' : 'Sync failed');
        $('#last_sync').text(`Last sync: ${new Date().toLocaleString()}`);
        
        if (result.sharedCharacters !== undefined) {
            $('#shared_characters').text(`Shared characters: ${result.sharedCharacters}`);
        }
    }
    
    // Initialize when extension is loaded
    jQuery(async () => {
        await initializeUI();
    });
}

// Initialize extension when document is ready
if (typeof jQuery !== 'undefined') {
    jQuery(() => {
        initializeCharacterDistributorUI();
    });
} else {
    // If jQuery isn't available yet, wait for it
    document.addEventListener('DOMContentLoaded', () => {
        if (typeof jQuery !== 'undefined') {
            initializeCharacterDistributorUI();
        } else {
            console.error('Character Distributor UI: jQuery not found');
        }
    });
}
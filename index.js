// UI Extension for Character Distributor
// This extension provides the user interface for configuring and interacting with the server plugin

// Import SillyTavern functions
import { extension_settings, getContext, loadExtensionSettings } from "../../../extensions.js";
import { saveSettingsDebounced, getRequestHeaders, eventSource, event_types, getCharacters } from "../../../../script.js";
import { getTagsList, getTagKeyForEntity, tag_map, tags } from "../../../tags.js";

// Module constants
const MODULE_NAME = 'ST-CharacterDistributor-UI';
const extensionFolderPath = `/scripts/extensions/third-party/${MODULE_NAME}`;

// Default settings
const defaultSettings = {
    dropboxAppKey: '',
    dropboxAppSecret: '',
    autoSync: true,
    syncInterval: 1800, // 30 minutes
    excludeTags: ['Private']
};

// Variables to track state
let isLoadingCharacters = false;
let characterLoadDebounceTimer = null;
let charactersLoaded = false;
let serverStatus = 'unknown';
let syncStatus = { lastSync: null, totalShared: 0 };
let authData = {
    accessToken: null,
    refreshToken: null,
    expiresIn: null,
    tokenType: null
};

// Make module name available globally
window.characterDistributorUI = {
    moduleName: MODULE_NAME,
    getSettings: () => extension_settings[MODULE_NAME],
    getRequestHeaders,
    saveSettings: saveSettingsDebounced,
    eventSource,
    event_types
};

// Import UI modules (after defining globals they might need)
import { initializeUI, updateServerStatusUI, updateSyncStatusUI } from "./modules/ui.js";
import { 
    checkLocalStorageForToken, 
    authenticateWithDropbox, 
    logoutFromDropbox,
    sendTokenToServer
} from "./modules/auth.js";
import { 
    checkServerStatus, 
    startAutoSyncInterval, 
    triggerSync 
} from "./modules/sync.js";
import { loadCharacterList } from "./modules/characters.js";

// Initialize extension when jQuery is ready
jQuery(async () => {
    console.log('Character Distributor UI: Extension loaded');
    
    // Make sure the module settings object exists
    if (!extension_settings[MODULE_NAME]) {
        console.log('Character Distributor UI: Creating settings object');
        extension_settings[MODULE_NAME] = {};
    }
    
    // Apply defaults if needed
    if (Object.keys(extension_settings[MODULE_NAME]).length === 0) {
        console.log('Character Distributor UI: Applying default settings');
        Object.assign(extension_settings[MODULE_NAME], defaultSettings);
        saveSettingsDebounced();
    }
    
    try {
        // Initialize UI components
        await initializeUI();
        
        // Set up event listeners for UI interactions
        setupEventListeners();
        
        // Set up refresh interval for server status check
        setInterval(checkServerStatus, 60000); // Check every minute
        
        // Initial server status check
        await checkServerStatus();
        
        // Load character list
        await loadCharacterList();

        // Check for auth token in localStorage after a short delay
        setTimeout(async () => {
            try {
                await checkLocalStorageForToken();
            } catch (error) {
                console.error('Character Distributor UI: Error during localStorage token check:', error);
            }
        }, 2000);
        
        // Set up auto-sync if enabled
        startAutoSyncInterval();
        
        console.log('Character Distributor UI: Extension initialized');
    } catch (error) {
        console.error('Character Distributor UI: Error initializing extension:', error);
    }
});

// Set up event listeners for UI elements
function setupEventListeners() {
    // Settings save button
    $('#save_settings').on('click', function() {
        const settings = extension_settings[MODULE_NAME];
        
        // Update settings from UI inputs
        Object.assign(settings, {
            dropboxAppKey: $('#dropbox_app_key').val(),
            dropboxAppSecret: $('#dropbox_app_secret').val(),
            autoSync: $('#auto_sync').prop('checked'),
            syncInterval: parseInt($('#sync_interval').val()) * 60,
            excludeTags: $('#exclude_tags').val().split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
        });
        
        saveSettingsDebounced();
        
        // Notify user
        toastr.success('Settings saved successfully');
        
        // Send settings to server plugin
        sendSettingsToServer();
    });
    
    // Authentication button
    $('#dropbox_auth').on('click', authenticateWithDropbox);
    
    // Logout button
    $('#dropbox_logout').on('click', logoutFromDropbox);
    
    // Force sync button
    $('#force_sync').on('click', triggerSync);
    
    // Refresh auth status button
    $('#refresh_auth_status').on('click', checkServerStatus);
}

// Send settings to server plugin
async function sendSettingsToServer() {
    try {
        console.log('Character Distributor UI: Sending settings to server...');
        
        // Create a clean copy of the settings to send
        const settingsToSend = JSON.parse(JSON.stringify(extension_settings[MODULE_NAME]));
        
        // Get request headers
        const headers = getRequestHeaders();
        headers['Content-Type'] = 'application/json';
        
        // Make the API call
        const response = await fetch('/api/plugins/character-distributor/settings', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(settingsToSend)
        });
        
        if (response.ok) {
            console.log('Character Distributor UI: Settings sent to server plugin successfully');
            toastr.success('Settings saved and sent to server plugin');
            return true;
        } else {
            const errorText = await response.text();
            console.error(`Character Distributor UI: Failed to send settings to server: ${errorText}`);
            toastr.error(`Failed to send settings to server: ${errorText}`, 'Settings Error');
            return false;
        }
    } catch (error) {
        console.error('Character Distributor UI: Error sending settings to server plugin:', error);
        toastr.error('Error sending settings to server plugin: ' + (error.message || 'Unknown error'));
        return false;
    }
} 
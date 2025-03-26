// Character Distributor UI - SillyTavern Extension
// By MonGauss

import {
    // Settings utilities
    loadSettings,
    saveSettings,
    testEchoEndpoint,
    
    // Server API utilities
    checkServerStatus,
    triggerSync,
    generateShareLink,
    checkDiagnostics,
    calculateNextSyncTime,
    
    // Authentication utilities
    refreshAuthStatus,
    authenticateWithDropbox,
    logoutFromDropbox,
    sendTokenToServer,
    checkLocalStorageForToken,
    clearLocalStorageTokens,
    handleDropboxAuthCallback,
    onAuthStateChanged,
    
    // Character utilities
    getCharacterTags,
    characterHasExcludedTags,
    filterCharactersByTags,
    loadCharacterList,
    refreshCharacterList
} from './src/main.js';

import { saveSettingsDebounced } from "../../../../script.js";

// Extension namespace
export const MODULE_NAME = 'ST-CharacterDistributor-UI';
export const extensionFolderPath = `/scripts/extensions/third-party/ST-CharacterDistributor-UI`;

// Storage for extension settings
export let extension_settings = {};

// Authentication data
let authData = {
    accessToken: null,
    refreshToken: null,
    expiresIn: null,
    tokenType: null
};

// Create a global namespace for Character Distributor functions
window.characterDistributor = {
    // This function will be called when auth state changes
    refreshAfterAuth: async function() {
        console.log('Character Distributor UI: Refreshing after authentication');
        try {
            // Refresh server status first
            await checkServerStatus();
            
            // Then refresh characters if authenticated
            await loadCharacterList();
            
            console.log('Character Distributor UI: Successfully refreshed after authentication');
            toastr.success('Successfully connected and loaded characters', 'Authentication Complete');
        } catch (error) {
            console.error('Character Distributor UI: Error refreshing after auth:', error);
        }
    }
};

/**
 * Initialize UI components and event handlers
 * @returns {Promise<void>}
 */
async function initializeUI() {
    // Load settings HTML
    try {
        console.log('Character Distributor UI: Loading UI template...');
        const settingsHtml = await fetch(`${extensionFolderPath}/settings.html`).then(response => response.text());
        $('#extensions_settings2').append(settingsHtml);
        console.log('Character Distributor UI: UI template loaded and appended');
    } catch (error) {
        console.error('Character Distributor UI: Error loading settings HTML:', error);
        toastr.error('Failed to load UI template', 'UI Error');
    }
}

// Initialize the extension
jQuery(async () => {
    if (!window.SillyTavern) {
        console.error('Character Distributor UI: SillyTavern not found. This extension requires SillyTavern.');
        return;
    }

    // Initialize the extension_settings object for our module
    if (!extension_settings[MODULE_NAME]) {
        extension_settings[MODULE_NAME] = {};
    }

    // Load UI first
    try {
        await initializeUI();
        console.log('Character Distributor UI: UI initialized');
    } catch (error) {
        console.error('Character Distributor UI: Error initializing UI:', error);
    }

    // Load extension settings
    try {
        extension_settings = loadSettings();
        console.log('Character Distributor UI: Settings loaded successfully');
    } catch (error) {
        console.error('Character Distributor UI: Error loading settings:', error);
        // Ensure we have a settings object even if loading fails
        if (!extension_settings[MODULE_NAME]) {
            extension_settings[MODULE_NAME] = {};
        }
    }
    
    // Set up event handlers
    setupEventHandlers();
    
    // Check server status only after settings are loaded
    try {
        await checkServerStatus();
    } catch (error) {
        console.error('Character Distributor UI: Error checking server status:', error);
    }
    
    // Register auth callback handler
    window.addEventListener('message', handleDropboxAuthCallback);
    
    // Set up listener for auth state changes
    onAuthStateChanged((authState) => {
        console.log('Character Distributor UI: Auth state changed', authState);
        if (authState.authenticated) {
            // Update UI elements based on authenticated state
            $('#auth_button, #dropbox_auth, #manual_token_button, #submit_manual_token').hide();
            $('#logout_button, #dropbox_logout, #sync_button, #force_sync').show();
            
            // Update any other UI elements that depend on authentication state
            if ($('#manual_token_section').is(':visible')) {
                $('#manual_token_section').hide();
            }
            
            // Show success message in the UI
            toastr.success('Connected to Dropbox', 'Authentication Successful');
            
            // Refresh character list after successful authentication
            setTimeout(() => {
                loadCharacterList().catch(err => {
                    console.error('Character Distributor UI: Error loading characters after auth change:', err);
                });
            }, 1000);
        } else {
            // Update UI elements based on non-authenticated state
            $('#auth_button, #dropbox_auth, #manual_token_button, #submit_manual_token').show();
            $('#logout_button, #dropbox_logout').hide();
            
            // Check if there was an auth error stored
            const authError = localStorage.getItem('dropbox_auth_error');
            if (authError) {
                // Display the error and remove it
                toastr.error(`Authentication failed: ${authError}`, 'Authentication Error');
                localStorage.removeItem('dropbox_auth_error');
            }
        }
    });
    
    // Attempt to restore authentication
    try {
        await checkLocalStorageForToken();
    } catch (error) {
        console.error('Character Distributor UI: Error checking local storage for token:', error);
    }
    
    // Initial character list loading
    try {
        await loadCharacterList();
        console.log('Character Distributor UI: Character list loaded');
    } catch (error) {
        console.error('Character Distributor UI: Error loading character list:', error);
    }
    
    console.log('Character Distributor UI: Extension initialized');
});

// Set up event handlers
function setupEventHandlers() {
    // Server URL input
    $('#server_url').on('change', function() {
        extension_settings[MODULE_NAME].serverUrl = $(this).val();
        saveSettingsDebounced();
    });
    
    // App Key and Secret inputs
    $('#dropbox_app_key, #dropbox_app_secret').on('change', function() {
        if (this.id === 'dropbox_app_key') {
            extension_settings[MODULE_NAME].dropboxAppKey = $(this).val();
        } else {
            extension_settings[MODULE_NAME].dropboxAppSecret = $(this).val();
        }
        saveSettingsDebounced();
    });
    
    // Save settings button
    $('#save_settings').on('click', function() {
        saveSettings();
    });
    
    // Settings diagnostics button
    $('#test_settings_api').on('click', function() {
        testEchoEndpoint();
    });
    
    // Authentication buttons
    $('#auth_button, #dropbox_auth').on('click', function() {
        authenticateWithDropbox();
    });
    
    $('#logout_button, #dropbox_logout').on('click', function() {
        logoutFromDropbox();
    });
    
    $('#manual_token_button, #submit_manual_token').on('click', function() {
        const token = this.id === 'manual_token_button' ? 
            prompt('Enter your Dropbox access token:') : 
            $('#manual_access_token').val();
            
        if (token) {
            authData = {
                accessToken: token,
                tokenType: 'bearer',
                expiresIn: 14400,
                refreshToken: null
            };
            sendTokenToServer();
        }
    });
    
    // Auto sync checkbox
    $('#auto_sync_enabled, #auto_sync').on('change', function() {
        extension_settings[MODULE_NAME].autoSyncEnabled = $(this).is(':checked');
        $('#auto_sync_config').toggle($(this).is(':checked'));
        saveSettingsDebounced();
    });
    
    // Sync interval input
    $('#sync_interval').on('change', function() {
        const value = parseInt($(this).val());
        if (!isNaN(value) && value >= 1 && value <= 24) {
            extension_settings[MODULE_NAME].syncInterval = value;
            saveSettingsDebounced();
        }
    });
    
    // Sync button
    $('#sync_button, #force_sync').on('click', function() {
        triggerSync();
    });
    
    // Exclude tags input
    $('#exclude_tags').on('change', function() {
        extension_settings[MODULE_NAME].excludeTags = $(this).val().split(',').map(tag => tag.trim()).filter(tag => tag);
        saveSettingsDebounced();
    });
    
    // Character share buttons
    $('#refresh_characters_button').on('click', function() {
        refreshCharacterList();
    });
    
    $('#generate_link_button, #get_share_link').on('click', function() {
        generateShareLink();
    });
    
    $('#copy_link_button, #copy_link').on('click', function() {
        copyShareLink();
    });
    
    // Diagnostics button
    $('#check_diagnostics').on('click', function() {
        checkDiagnostics();
    });
    
    // Refresh auth status button
    $('#refresh_auth_status').on('click', function() {
        refreshAuthStatus();
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
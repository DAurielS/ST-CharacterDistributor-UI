// Character Distributor UI - SillyTavern Extension
// By BogusFrontend
// Entry point as required by SillyTavern extensions system

import {
    // Settings utilities
    loadSettings,
    saveSettings,
    
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
    
    // Character utilities
    getCharacterTags,
    characterHasExcludedTags,
    filterCharactersByTags,
    loadCharacterList,
    refreshCharacterList
} from './src/main.js';

import { eventSource, getRequestHeaders, getCharacters, saveSettingsDebounced } from "../../../../script.js";
import { registerSlashCommand } from "../../../slash-commands.js";

// Extension namespace
export const MODULE_NAME = 'character_distributor';
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
    
    // Register slash commands
    registerCommands();
    
    // Check server status only after settings are loaded
    try {
        await checkServerStatus();
    } catch (error) {
        console.error('Character Distributor UI: Error checking server status:', error);
    }
    
    // Register auth callback handler
    window.addEventListener('message', handleDropboxAuthCallback);
    
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

// Register slash commands
function registerCommands() {
    registerSlashCommand('share-character', async (args) => {
        try {
            const characterName = args.trim();
            if (!characterName) {
                toastr.error('Please specify a character name');
                return;
            }
            
            // Find character by name
            const characters = getCharacters();
            const character = characters.find(c => c.name.toLowerCase() === characterName.toLowerCase());
            
            if (!character) {
                toastr.error(`Character "${characterName}" not found`);
                return;
            }
            
            // Generate share link
            const response = await fetch(`/api/plugins/character-distributor/share/${character.avatar}`, {
                headers: getRequestHeaders()
            });
            
            const data = await response.json();
            if (data.shareLink) {
                navigator.clipboard.writeText(data.shareLink)
                    .then(() => toastr.success(`Share link for ${characterName} copied to clipboard`))
                    .catch(() => {
                        toastr.info(`Share link generated but couldn't copy to clipboard: ${data.shareLink}`);
                    });
            } else {
                toastr.error('Failed to generate share link');
            }
        } catch (error) {
            console.error('Character Distributor UI: Error in share-character command', error);
            toastr.error('Error generating share link');
        }
    }, [], 'Share a character by name: <strong>/share-character Character Name</strong>', true, true);
    
    registerSlashCommand('sync-characters', async () => {
        try {
            toastr.info('Syncing characters...');
            await triggerSync();
        } catch (error) {
            console.error('Character Distributor UI: Error in sync-characters command', error);
            toastr.error('Error syncing characters');
        }
    }, [], 'Sync characters with Dropbox: <strong>/sync-characters</strong>', true, true);
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

// Handle the OAuth callback message from the popup window
function handleDropboxAuthCallback(event) {
    console.log('Character Distributor UI: Received postMessage event');
    
    // Validate message source and data
    if (!event.data || typeof event.data !== 'object' || event.data.source !== 'dropbox-auth') {
        console.log('Character Distributor UI: Ignoring unrelated message event', event.data?.source || 'no source');
        return;
    }
    
    console.log('Character Distributor UI: Processing Dropbox auth callback message');
    
    try {
        // Check for error first
        if (event.data.error) {
            console.error('Character Distributor UI: Received error from auth window:', event.data.error);
            $('#auth_status').text(`Authentication failed: ${event.data.error}`).removeClass('success').addClass('error');
            toastr.error(event.data.error, 'Authentication Failed');
            return;
        }
        
        // Extract token data from the message
        const { accessToken, tokenType, expiresIn, refreshToken } = event.data;
        
        if (!accessToken) {
            console.error('Character Distributor UI: No access token in callback message');
            $('#auth_status').text('Authentication failed: No token received').removeClass('success').addClass('error');
            toastr.error('No access token received from Dropbox', 'Authentication Failed');
            return;
        }
        
        console.log('Character Distributor UI: Received access token from callback');
        console.log('Character Distributor UI: Token length:', accessToken.length);
        console.log('Character Distributor UI: Token type:', tokenType || 'bearer');
        console.log('Character Distributor UI: Refresh token present:', !!refreshToken);
        
        // Store the token in authData
        authData = {
            accessToken: accessToken,
            refreshToken: refreshToken,
            expiresIn: parseInt(expiresIn || '14400'),
            tokenType: tokenType || 'bearer'
        };
        
        // Update UI
        $('#auth_status').text('Processing token from callback...');
        
        // Send the token to the server
        sendTokenToServer().then(success => {
            if (success) {
                console.log('Character Distributor UI: Successfully authenticated with token from callback');
            } else {
                console.error('Character Distributor UI: Failed to authenticate with token from callback');
            }
        }).catch(error => {
            console.error('Character Distributor UI: Error processing callback token:', error);
            $('#auth_status').text('Authentication failed').removeClass('success').addClass('error');
            toastr.error('Error processing authentication token', 'Authentication Failed');
        });
    } catch (error) {
        console.error('Character Distributor UI: Error processing auth callback:', error);
        $('#auth_status').text('Authentication callback error').removeClass('success').addClass('error');
        toastr.error('Error processing authentication callback', 'Authentication Failed');
    }
}

// Check localStorage for auth token
async function checkLocalStorageForToken() {
    // Check if there's a token in localStorage
    const accessToken = localStorage.getItem('dropbox_auth_token');
    const tokenType = localStorage.getItem('dropbox_token_type');
    const expiresIn = localStorage.getItem('dropbox_expires_in');
    const timestamp = localStorage.getItem('dropbox_auth_timestamp');
    const refreshToken = localStorage.getItem('dropbox_refresh_token');
    
    console.log('Character Distributor UI: Checking localStorage for token...');
    console.log('Token exists:', !!accessToken);
    console.log('Timestamp exists:', !!timestamp);
    console.log('Token length:', accessToken?.length || 0);
    console.log('Refresh token exists:', !!refreshToken);
    
    // Initialize settings object if needed
    if (!extension_settings[MODULE_NAME]) {
        extension_settings[MODULE_NAME] = {};
    }
    
    // Make sure we have app keys configured before trying to use the token
    const appKey = $('#dropbox_app_key').val() || extension_settings[MODULE_NAME]?.dropboxAppKey;
    const appSecret = $('#dropbox_app_secret').val() || extension_settings[MODULE_NAME]?.dropboxAppSecret;
    
    if (!appKey || !appSecret) {
        console.warn('Character Distributor UI: App Key or Secret not configured. Cannot use saved token.');
        clearLocalStorageTokens();
        return;
    }
    
    // Make sure settings are saved with the current app key/secret
    extension_settings[MODULE_NAME].dropboxAppKey = appKey;
    extension_settings[MODULE_NAME].dropboxAppSecret = appSecret;
    saveSettingsDebounced();
    
    // If we have a token, try to use it
    if (accessToken) {
        console.log('Character Distributor UI: Found token in localStorage, attempting to use it');
        
        // Check token age if timestamp exists
        if (timestamp) {
            const tokenAge = Date.now() - parseInt(timestamp);
            const maxAge = 3600000; // 1 hour in milliseconds
            
            if (tokenAge > maxAge && !refreshToken) {
                console.warn(`Character Distributor UI: Token is old (${Math.floor(tokenAge / 60000)} minutes), skipping auto-login`);
                toastr.info('Found an old saved token but no refresh token. Please re-authenticate.', 'Authentication Needed');
                return;
            }
        }
        
        // Store in authData for use by sendTokenToServer
        authData = {
            accessToken: accessToken,
            refreshToken: refreshToken,
            expiresIn: parseInt(expiresIn || '14400'),
            tokenType: tokenType || 'bearer'
        };
        
        // Update UI
        $('#auth_status').text('Restoring saved authentication...');
        
        try {
            // Send token to server
            await sendTokenToServer();
            console.log('Character Distributor UI: Successfully restored authentication from localStorage');
            
            // Clear tokens from localStorage after successful restoration
            // This prevents auto-login if the server rejects the token next time
            clearLocalStorageTokens(); 
        } catch (error) {
            console.error('Character Distributor UI: Error sending saved token to server:', error);
            $('#auth_status').text('Failed to restore authentication').removeClass('success').addClass('error');
            toastr.error('Could not restore authentication from saved token', 'Authentication Failed');
            
            // Clear the invalid saved token
            clearLocalStorageTokens();
        }
    } else {
        console.log('Character Distributor UI: No saved token found in localStorage');
    }
}

// Clear localStorage tokens
function clearLocalStorageTokens() {
    try {
        console.log('Character Distributor UI: Clearing auth tokens from localStorage');
        
        // Get current values for logging
        const hadToken = !!localStorage.getItem('dropbox_auth_token');
        const hadRefreshToken = !!localStorage.getItem('dropbox_refresh_token');
        
        // Remove all token-related items
        localStorage.removeItem('dropbox_auth_token');
        localStorage.removeItem('dropbox_token_type');
        localStorage.removeItem('dropbox_expires_in');
        localStorage.removeItem('dropbox_auth_timestamp');
        localStorage.removeItem('dropbox_refresh_token');
        
        // Verify removal was successful
        const tokenRemoved = !localStorage.getItem('dropbox_auth_token');
        const refreshTokenRemoved = !localStorage.getItem('dropbox_refresh_token');
        
        if (!tokenRemoved || !refreshTokenRemoved) {
            console.error('Character Distributor UI: Failed to remove all tokens from localStorage');
            return false;
        }
        
        console.log('Character Distributor UI: Auth tokens cleared from localStorage');
        console.log('Character Distributor UI: Removed access token:', hadToken);
        console.log('Character Distributor UI: Removed refresh token:', hadRefreshToken);
        return true;
    } catch (error) {
        console.error('Character Distributor UI: Error clearing auth tokens from localStorage:', error);
        return false;
    }
}

// Store authentication token in localStorage for persistence
function storeAuthToken(accessToken, tokenType, expiresIn, refreshToken) {
    try {
        console.log('Character Distributor UI: Storing auth token in localStorage');
        
        // Validate parameters
        if (!accessToken) {
            console.error('Character Distributor UI: Cannot store null/empty token');
            return false;
        }
        
        if (typeof accessToken !== 'string') {
            console.error('Character Distributor UI: Token must be a string, got:', typeof accessToken);
            return false;
        }
        
        if (accessToken.length < 10) {
            console.warn('Character Distributor UI: Token is suspiciously short:', accessToken.length, 'chars');
        }
        
        // Store the token with clean values
        localStorage.setItem('dropbox_auth_token', accessToken);
        localStorage.setItem('dropbox_token_type', tokenType || 'bearer');
        localStorage.setItem('dropbox_expires_in', String(expiresIn || 14400));
        localStorage.setItem('dropbox_auth_timestamp', Date.now().toString());
        
        // Only store refresh token if it exists and is a string
        if (refreshToken && typeof refreshToken === 'string') {
            localStorage.setItem('dropbox_refresh_token', refreshToken);
            console.log('Character Distributor UI: Refresh token stored (length:', refreshToken.length, ')');
        } else if (refreshToken) {
            console.warn('Character Distributor UI: Invalid refresh token format, not storing');
        }
        
        // Verify storage was successful
        const storedToken = localStorage.getItem('dropbox_auth_token');
        if (storedToken !== accessToken) {
            console.error('Character Distributor UI: Token storage verification failed');
            return false;
        }
        
        console.log('Character Distributor UI: Auth token stored in localStorage successfully');
        console.log('Character Distributor UI: Token expiration set to:', new Date(Date.now() + (parseInt(expiresIn || '14400') * 1000)).toISOString());
        return true;
    } catch (error) {
        console.error('Character Distributor UI: Error storing auth token in localStorage:', error);
        return false;
    }
}
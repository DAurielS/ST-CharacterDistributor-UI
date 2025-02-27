/**
 * ST-CharacterDistributor-UI - UI Module
 * Contains functions for UI initialization, event handling, and UI updates
 */

// Import dependencies from other modules
import { loadSettings, saveSettings, sendSettingsToServer, testEchoEndpoint } from './settings.js';
import { 
    loadCharacterList, 
    refreshCharacterList,
    filterCharactersByTags,
    populateCharacterDropdown
} from './characters.js';
import { 
    checkServerStatus, 
    triggerSync, 
    startAutoSyncInterval,
    updateServerStatus,
    updateSyncStatus,
    generateShareLink,
    copyShareLink
} from './sync.js';
import {
    authenticateWithDropbox,
    logoutFromDropbox,
    submitManualToken,
    refreshAuthStatus,
    checkLocalStorageForToken,
    checkDiagnostics
} from './auth.js';

// Module constants
export const MODULE_ID = 'ST-CharacterDistributor-UI';
export const MODULE_NAME = 'ST-CharacterDistributor-UI';

/**
 * Initialize the UI
 */
function initializeUI() {
    console.log('Character Distributor UI: Initializing UI...');
    
    try {
        // Set up event listeners for existing UI elements
        setupEventListeners();
        
        // Load settings
        loadSettings();
        
        // Set up server status check interval
        setupStatusCheckInterval();
        
        // Load character list
        loadCharacterList().catch(error => {
            console.error('Character Distributor UI: Error loading character list:', error);
        });
        
        console.log('Character Distributor UI: UI initialized successfully');
    } catch (error) {
        console.error('Character Distributor UI: Error initializing UI:', error);
        toastr.error('Error initializing Character Distributor UI', 'Error');
    }
}

/**
 * Set up event listeners for UI elements
 */
function setupEventListeners() {
    console.log('Character Distributor UI: Setting up event listeners');
    
    // Settings form
    $('#save_settings').on('click', saveSettings);
    
    // Authentication buttons
    $('#dropbox_auth').on('click', authenticateWithDropbox);
    $('#dropbox_logout').on('click', logoutFromDropbox);
    $('#submit_manual_token').on('click', submitManualToken);
    $('#refresh_auth_status').on('click', refreshAuthStatus);
    $('#check_diagnostics').on('click', checkDiagnostics);
    
    // Sync button
    $('#force_sync').on('click', triggerSync);
    
    // Testing button
    $('#test_settings_api').on('click', testEchoEndpoint);
    
    // Character dropdown
    $('#share_character').on('change', function() {
        const hasSelection = $(this).val() !== null && $(this).val() !== '';
        $('#get_share_link').prop('disabled', !hasSelection);
    });
    
    // Share character
    $('#get_share_link').on('click', generateShareLink);
    $('#copy_link').on('click', copyShareLink);
    
    console.log('Character Distributor UI: Event listeners set up');
}

/**
 * Set up interval for checking server status
 */
function setupStatusCheckInterval() {
    console.log('Character Distributor UI: Setting up status check interval');
    
    // Check status immediately
    checkServerStatus().catch(error => {
        console.error('Character Distributor UI: Error checking server status:', error);
    });
    
    // Set up interval for checking status (every 60 seconds)
    setInterval(() => {
        checkServerStatus().catch(error => {
            console.error('Character Distributor UI: Error in status check interval:', error);
        });
    }, 60000);
    
    console.log('Character Distributor UI: Status check interval set up');
}

/**
 * Show manual token input form
 */
function showManualTokenInput() {
    $('#manual_token_section').show();
    $('#manual_access_token').focus();
}

/**
 * Hide manual token input form
 */
function hideManualTokenInput() {
    $('#manual_access_token').val('');
    $('#manual_token_section').hide();
}

// Export functions and constants
export {
    initializeUI,
    setupEventListeners,
    setupStatusCheckInterval,
    showManualTokenInput,
    hideManualTokenInput
}; 
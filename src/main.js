// Main application module for Character Distributor UI
// This will be imported by index.js which remains the entry point

import { loadSettings, saveSettings, testEchoEndpoint } from './utils/settings.js';
import { 
    checkServerStatus, 
    triggerSync, 
    generateShareLink,
    checkDiagnostics,
    calculateNextSyncTime 
} from './api/serverApi.js';
import { 
    refreshAuthStatus, 
    authenticateWithDropbox, 
    logoutFromDropbox, 
    sendTokenToServer,
    checkLocalStorageForToken,
    clearLocalStorageTokens
} from './auth/authApi.js';
import { 
    getCharacterTags, 
    characterHasExcludedTags, 
    filterCharactersByTags,
    loadCharacterList,
    refreshCharacterList 
} from './characters/characterUtils.js';

// Export all functions to be used in index.js
export {
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
    
    // Character utilities
    getCharacterTags,
    characterHasExcludedTags,
    filterCharactersByTags,
    loadCharacterList,
    refreshCharacterList
}; 
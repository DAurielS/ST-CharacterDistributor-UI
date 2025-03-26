// Server API module for Character Distributor UI
// Contains functions for interacting with the server plugin

import { getRequestHeaders } from "../../../../../script.js";
import { MODULE_NAME } from "../utils/settings.js";
import { extension_settings } from "../../../../extensions.js";

/**
 * Check if server plugin is running
 * @returns {Promise<Object>} Server status
 */
export async function checkServerStatus() {
    console.log('Character Distributor UI: Checking server status...');
    
    try {
        const response = await fetch('/api/plugins/character-distributor/status', {
            method: 'GET',
            headers: getRequestHeaders()
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const status = await response.json();

        return status;
    } catch (error) {
        console.error('Character Distributor UI: Error checking server status:', error);
        return { running: false, error: error.message };
    }
}

/**
 * Check plugin diagnostics
 * @returns {Promise<Object>} Diagnostic information
 */
export async function checkDiagnostics() {
    console.log('Character Distributor UI: Checking diagnostics...');
    $('#check_diagnostics').prop('disabled', true);
    
    try {
        const response = await fetch('/api/plugins/character-distributor/debug', {
            headers: getRequestHeaders()
        });
        
        if (response.ok) {
            const diagnosticInfo = await response.json();
            console.log('Character Distributor UI: Diagnostics', diagnosticInfo);
            
            // Format diagnostic info as a message
            let message = '<h4>Character Distributor Diagnostics</h4>';
            message += '<pre style="text-align: left; background-color: #1a1a1a; padding: 10px; max-height: 400px; overflow-y: auto;">';
            message += JSON.stringify(diagnosticInfo, null, 2);
            message += '</pre>';
            
            // Display in custom toastr
            toastr.info(message, 'Diagnostics', { 
                timeOut: 0,
                extendedTimeOut: 0,
                closeButton: true,
                tapToDismiss: false,
                escapeHtml: false
            });
            
            return diagnosticInfo;
        } else {
            console.error('Character Distributor UI: Failed to get diagnostics');
            toastr.error('Failed to get diagnostics information');
            return null;
        }
    } catch (error) {
        console.error('Character Distributor UI: Error checking diagnostics', error);
        toastr.error('Error checking diagnostics');
        return null;
    } finally {
        $('#check_diagnostics').prop('disabled', false);
    }
}

/**
 * Trigger synchronization with Dropbox
 * @param {string[]} characterFiles - List of character files to sync
 * @param {string[]} excludedCharacters - List of excluded character files
 * @param {string[]} excludeTags - List of tags to exclude
 * @returns {Promise<Object>} Sync result
 */
export async function triggerSync(characterFiles, excludedCharacters, excludeTags) {
    try {
        // Get proper request headers and add Content-Type
        const headers = getRequestHeaders();
        headers['Content-Type'] = 'application/json';
        
        // Send the list of allowed characters to the server
        const response = await fetch('/api/plugins/character-distributor/sync', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                allowedCharacterFiles: characterFiles, // Send list of files that are allowed
                excludeTags: excludeTags, // Also send excluded tags for secondary filtering
                excludedCharacters: excludedCharacters // Explicitly send the excluded character list
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Log the response for debugging
        console.log('Character Distributor UI: Sync response:', data);
        
        // Show a toast with more details if available
        if (data.success) {
            const details = [];
            if (data.count !== undefined) details.push(`Synced: ${data.count}`);
            if (data.added !== undefined) details.push(`Added: ${data.added}`);
            if (data.removed !== undefined) details.push(`Removed: ${data.removed}`);
            if (data.excluded !== undefined) details.push(`Excluded: ${data.excluded}`);
            
            toastr.success(details.join(' | '), 'Sync Complete');
        } else {
            toastr.error(data.error || 'Unknown error occurred', 'Sync Failed');
        }
        
        return {
            ...data,
            message: data.success ? 
                `Synced ${data.count} characters` + (data.removed ? `, removed ${data.removed}` : '') : 
                'Sync failed'
        };
    } catch (error) {
        console.error('Character Distributor UI: Error during sync', error);
        toastr.error('Error during sync operation. Check the console for details.');
        return { success: false, message: 'Sync failed. Check server logs.' };
    }
}

/**
 * Generate share link for a character
 * @param {string} characterId - Character ID to share
 * @returns {Promise<string|null>} Share link or null if failed
 */
export async function generateShareLink(characterId) {
    if (!characterId) {
        toastr.error('Please select a character');
        return null;
    }
    
    try {
        const response = await fetch(`/api/plugins/character-distributor/share/${characterId}`, {
            headers: getRequestHeaders()
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.shareLink) {
            toastr.success('Share link generated');
            return data.shareLink;
        } else {
            toastr.error('Failed to generate share link');
            return null;
        }
    } catch (error) {
        console.error('Character Distributor UI: Error generating share link', error);
        toastr.error('Error generating share link');
        return null;
    }
}

/**
 * Check if auto-sync should be triggered
 * @param {Object} status - Server status
 * @returns {Promise<boolean>} Whether auto-sync was triggered
 */
export async function checkAutoSync(status) {
    if (extension_settings[MODULE_NAME].autoSync && status.authenticated) {
        const lastSyncTime = status.lastSync ? new Date(status.lastSync) : null;
        const syncInterval = extension_settings[MODULE_NAME].syncInterval || 1800;
        const now = new Date();
        
        if (lastSyncTime) {
            const timeSinceSync = (now.getTime() - lastSyncTime.getTime()) / 1000;
            console.log('Character Distributor UI: Time since last sync:', Math.floor(timeSinceSync), 'seconds');
            console.log('Character Distributor UI: Sync interval:', syncInterval, 'seconds');
            
            if (timeSinceSync >= syncInterval) {
                console.log('Character Distributor UI: Auto-sync interval reached, triggering sync');
                return true;
            } else {
                console.log('Character Distributor UI: Not yet time for auto-sync. Next sync in:', 
                    Math.floor(syncInterval - timeSinceSync), 'seconds');
                return false;
            }
        } else if (status.authenticated) {
            // No last sync time found, trigger initial sync
            console.log('Character Distributor UI: No last sync time found, triggering initial sync');
            return true;
        }
    }
    
    return false;
}

/**
 * Calculate time until next sync
 * @param {string|null} lastSync - Last sync time ISO string
 * @returns {string} Formatted time until next sync
 */
export function calculateNextSyncTime(lastSync) {
    if (!lastSync) return 'calculating...';
    
    const now = new Date();
    const lastSyncTime = new Date(lastSync);
    const syncInterval = extension_settings[MODULE_NAME].syncInterval || 1800;
    const nextSyncTime = new Date(lastSyncTime.getTime() + (syncInterval * 1000));
    const timeUntilSync = nextSyncTime.getTime() - now.getTime();
    
    if (timeUntilSync <= 0) {
        return 'due now';
    }
    
    // Format the remaining time
    const minutes = Math.floor(timeUntilSync / 60000);
    const seconds = Math.floor((timeUntilSync % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
} 
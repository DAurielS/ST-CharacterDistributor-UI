# Character Distributor UI Extension for SillyTavern

A SillyTavern UI extension for sharing and discovering AI characters through Dropbox integration. This extension allows you to easily share your characters with friends or the community, and discover new characters from others.

## Features

- Dropbox integration for secure character sharing
- Automatic synchronization of characters
- Exclude private characters using tags
- Generate shareable links for individual characters
- User-friendly interface integrated into SillyTavern

## Installation

1. Navigate to the SillyTavern Extensions menu by clicking the puzzle piece icon in the top right corner.
2. Open the "Install Extension" tab.
3. In the "Install from URL" section, enter `https://github.com/DAurielS/ST-CharacterDistributor-UI`.
4. Click "Install" and wait for the extension to download and install.
5. After installation, you may need to restart SillyTavern.

## Configuration

After installing the extension, you'll need to:

1. Create a Dropbox API app:
   - Go to [Dropbox Developer Console](https://www.dropbox.com/developers/apps)
   - Click "Create app"
   - Choose "Scoped access" and "App Folder" access
   - Name your app (e.g., "ST Character Distributor")
   - Add `http://localhost:8000/scripts/extensions/third-party/ST-CharacterDistributor/dist/public/oauth_callback.html` as a redirect URI
   - Add `http://127.0.0.1:8000/scripts/extensions/third-party/ST-CharacterDistributor/dist/public/oauth_callback.html` as well for redundancy
   - Go to the Permissions menu within the app configuration page
   - Enable everything under "Files and folders"
   - Click "Submit"
   - Note your App Key and App Secret for later use

2. Configure the extension in SillyTavern:
   - Open the extension settings from the Extensions menu
   - Enter your Dropbox App Key and App Secret
   - Configure sync settings and tag exclusions
   - Click "Save Settings"
   - Authenticate with Dropbox by clicking the "Authenticate with Dropbox" button

## Usage

### Sharing Characters

1. Configure which characters to share by ensuring they don't have any excluded tags.
2. Click "Force Sync Now" to manually trigger synchronization, or enable automatic sync.
3. To share a specific character, select it from the dropdown in the "Share Characters" section.
4. Click "Generate Share Link" to create a link you can share with others.

### Discovering Characters

Character discovery features are accessible through the server plugin companion. Make sure you have both the UI extension and the server plugin installed for full functionality.

## Development

### Prerequisites

- Node.js 16.x or higher
- npm or yarn

### Setup

1. Clone the repository:
```
git clone https://github.com/DAurielS/ST-CharacterDistributor-UI.git
cd ST-CharacterDistributor-UI
```

2. Install dependencies:
```
npm install
```

3. Build the extension:
```
npm run build
```

The built extension will be available in the `dist` directory.

## Code Structure

- **index.js**: Main entry point required by SillyTavern's extension system
- **settings.html**: UI definition loaded automatically by SillyTavern
- **src/main.js**: Central module that imports and re-exports all functionality 
- **src/utils/settings.js**: Settings management utilities
- **src/api/serverApi.js**: Server communication functions
- **src/auth/authApi.js**: Authentication-related functions
- **src/characters/characterUtils.js**: Character management utilities

## Acknowledgements

- SillyTavern team for creating the platform
- Dropbox for providing the API
- All contributors and users of this extension

---

Created by MonGauss

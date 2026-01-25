# Installation Guide for SpyWeb Extension

## Prerequisites
- Google Chrome, Microsoft Edge, or any Chromium-based browser
- Developer mode enabled in the browser

## Installation Steps

### Step 1: Download the Extension
1. Clone or download this repository to your local machine
2. Extract the files if downloaded as a ZIP

### Step 2: Enable Developer Mode
1. Open your Chromium-based browser
2. Navigate to the extensions page:
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
   - Brave: `brave://extensions/`
3. Toggle "Developer mode" ON (usually in the top-right corner)

### Step 3: Load the Extension
1. Click "Load unpacked" button
2. Navigate to the SpyWeb directory (the folder containing `manifest.json`)
3. Select the folder and click "Select Folder" or "Open"
4. The SpyWeb extension should now appear in your extensions list

### Step 4: Pin the Extension (Optional but Recommended)
1. Click the puzzle piece icon in your browser toolbar
2. Find "SpyWeb" in the list
3. Click the pin icon to pin it to your toolbar for easy access

## Verification
- You should see the SpyWeb icon in your browser toolbar
- Click it to open the popup interface
- The extension is now ready to use!

## Troubleshooting

### Extension Not Loading
- Make sure you selected the correct folder (the one with `manifest.json`)
- Check that all files are present in the directory
- Try refreshing the extensions page and loading again

### Content Script Not Working
- Refresh the web page after installing the extension
- Check that the extension has permissions for the website
- Look at browser console for any error messages

### Permissions Issues
- The extension requires `storage`, `activeTab`, and `scripting` permissions
- These are declared in the manifest and should be granted automatically
- If prompted, click "Allow" to grant permissions

## Updating the Extension
1. Make changes to the extension files
2. Go to `chrome://extensions/` (or your browser's extension page)
3. Click the refresh icon on the SpyWeb extension card
4. The changes will take effect immediately

## Uninstallation
1. Go to `chrome://extensions/`
2. Find SpyWeb in the list
3. Click "Remove"
4. Confirm the removal

## Next Steps
After installation, check out the [Usage Guide](USAGE.md) to learn how to mask elements on web pages.

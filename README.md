# SpyWeb

SpyWeb is a web browser extension helping you mask off sensitive information on your screen.

## Features

- **Interactive Element Selection**: Click and select any element on a web page to mask
- **Flexible Masking Options**: Choose from multiple mask types:
  - Custom text overlay
  - Solid color overlay
  - Blur effect
  - Custom image overlay
- **Smart Input Handling**: For input fields, masks the appearance while preserving input functionality
- **Scope Control**: Apply masks to specific websites or globally across all sites
- **Element Management**: View and manage all masked elements from the options page
- **Import/Export**: Save and restore your masking configurations

## Installation

### Installing in Chrome/Edge

1. Download or clone this repository
2. Open Chrome/Edge and navigate to `chrome://extensions/` (or `edge://extensions/`)
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked"
5. Select the SpyWeb directory containing the `manifest.json` file
6. The extension is now installed and ready to use!

## Usage

### Masking Elements

1. Click the SpyWeb icon in your browser toolbar
2. Configure your mask appearance:
   - Choose mask type (text, color, blur, or image)
   - Set custom text or color if needed
3. Select mask scope (current website or all websites)
4. Click "Start Inspection"
5. Hover over elements on the page to highlight them
6. Click on any element to apply the mask
7. Click "Stop Inspection" when done

### Managing Masked Elements

1. Click "View Masked Elements" in the popup, or
2. Right-click the extension icon and select "Options"
3. View all masked elements organized by domain
4. Remove individual masks or clear all masks
5. Export/import your settings for backup or sharing

### Tips

- **Input Fields**: When you mask input fields (like password boxes), the mask only affects the visual appearance. You can still type normally.
- **Dynamic Content**: Masks are automatically reapplied when page content changes
- **Per-Site vs Global**: Use "Current Website Only" for site-specific sensitive data, or "All Websites" for elements that appear across multiple sites
- **Persistence**: Your masked elements are saved and will be automatically applied when you revisit the page

## Privacy

SpyWeb operates entirely locally in your browser. No data is sent to external servers. All configurations and masked elements are stored in your browser's local storage.

## Development

### File Structure

```
SpyWeb/
├── manifest.json        # Extension manifest
├── popup.html          # Popup UI
├── popup.css           # Popup styles
├── popup.js            # Popup logic
├── content.js          # Content script for page interaction
├── content.css         # Content script styles
├── background.js       # Background service worker
├── options.html        # Options page UI
├── options.css         # Options page styles
├── options.js          # Options page logic
└── icons/              # Extension icons
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```

### Key Components

- **Content Script** (`content.js`): Handles element selection, highlighting, and mask application
- **Popup** (`popup.js`): Provides the main user interface for configuring masks
- **Background Script** (`background.js`): Manages storage and cross-tab synchronization
- **Options Page** (`options.js`): Allows viewing and managing all masked elements

## License

MIT License - See LICENSE file for details

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

# SpyWeb Visual Walkthrough

This document provides a visual guide to using the SpyWeb browser extension.

## Demo Page

The extension includes a demo page (`demo.html`) with various types of sensitive information:

![Demo Page](https://github.com/user-attachments/assets/6dd3d24c-074d-40fd-a8f5-5b372f36047a)

The demo page includes:
- Personal information (names, emails, phone numbers, SSN)
- Login forms with filled credentials
- Financial information (bank accounts, credit cards)
- Transaction history
- API keys and authentication tokens

## Extension Popup Interface

When you click the SpyWeb icon, you'll see the popup interface with:

1. **Element Selection** - Start/stop inspection mode
2. **Mask Appearance** - Choose how masked elements should look:
   - Custom Text (default)
   - Solid Color
   - Blur Effect
   - Custom Image URL
3. **Mask Scope** - Apply to current site or all sites
4. **Management** - View and clear masked elements

## Key Features Demonstrated

### 1. Interactive Element Selection
- Hover highlighting shows which element will be masked
- Blue border appears around the target element
- Click to apply the mask instantly

### 2. Multiple Mask Types

**Text Mask**
- Default: "████████"
- Customizable to any text
- Good for placeholder text

**Color Mask**
- Solid color overlay
- Choose any color with color picker
- Complete coverage of content

**Blur Mask**
- Gaussian blur effect
- Maintains element shape
- Content becomes unreadable

**Image Mask**
- Use any image URL
- Good for branding or custom graphics
- Scaled to fit element

### 3. Input Field Handling
When masking input fields:
- Visual content is masked
- Input functionality preserved
- Cursor remains visible
- Perfect for screen sharing

### 4. Scope Control

**Current Website Only**
- Masks saved per domain
- Only applies to current site
- Best for site-specific data

**All Websites**
- Masks apply globally
- Useful for common elements
- Profile pictures, usernames, etc.

### 5. Management Interface

The Options page shows:
- All masked elements grouped by domain
- Element selectors (CSS)
- Mask type and settings
- Add date
- Special badges for input fields and global masks
- Remove buttons for each mask
- Export/Import functionality

## Common Workflows

### Masking Personal Information
1. Open demo page or any page with personal data
2. Click SpyWeb icon
3. Keep default text mask settings
4. Click "Start Inspection"
5. Click on email addresses, phone numbers, SSNs
6. Click "Stop Inspection"
7. Personal info is now masked!

### Screen Sharing Setup
1. Before joining meeting, open pages you'll share
2. Mask all sensitive elements
3. Choose "All Websites" for elements common across sites
4. Verify masks are working
5. Share screen confidently

### Creating Tutorial Videos
1. Open application/site for tutorial
2. Mask test user data, API keys, credentials
3. Use blur or color masks for less distraction
4. Record tutorial
5. Masks appear in recording

### Taking Documentation Screenshots
1. Navigate to page needing screenshots
2. Mask any sensitive/test data
3. Take screenshots
4. Professional-looking docs without data exposure

## Tips for Best Results

1. **Be Precise**: Click the exact element, not its container
2. **Test Inputs**: After masking input fields, verify typing still works
3. **Use Blur for Context**: Blur maintains shapes while hiding data
4. **Global for Common Elements**: Username/profile pics across sites
5. **Export for Backup**: Regularly export your mask configurations
6. **Dynamic Pages**: Masks auto-reapply when content changes

## Browser Compatibility

SpyWeb works on all Chromium-based browsers:
- ✅ Google Chrome
- ✅ Microsoft Edge
- ✅ Brave Browser
- ✅ Opera
- ✅ Vivaldi
- ✅ Other Chromium-based browsers

## Performance

- Lightweight CSS overlays
- Minimal performance impact
- Works on complex, dynamic pages
- Automatic reapplication on content changes
- No external requests or tracking

## Privacy & Security

- **100% Local**: All data stored in browser local storage
- **No Tracking**: No analytics or external connections
- **Open Source**: Code is transparent and auditable
- **Cosmetic Only**: Doesn't modify underlying page data
- **Export/Import**: Full control over your configurations

## Next Steps

1. Install the extension following the [Installation Guide](INSTALLATION.md)
2. Try the demo page to practice
3. Review the [Usage Guide](USAGE.md) for detailed instructions
4. Start masking sensitive data on real sites

## Need Help?

- Read the [README](README.md) for overview
- Check [Installation Guide](INSTALLATION.md) for setup help
- Review [Usage Guide](USAGE.md) for detailed features
- Open GitHub issue for bugs or feature requests

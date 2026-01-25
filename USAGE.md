# Usage Guide for SpyWeb Extension

## Overview
SpyWeb allows you to mask sensitive information on web pages by selecting elements and applying custom overlays. This guide will walk you through all features.

## Basic Usage

### 1. Starting Element Inspection

1. **Open the SpyWeb popup**
   - Click the SpyWeb icon in your browser toolbar

2. **Configure mask appearance** (optional)
   - Choose from 4 mask types:
     - **Custom Text**: Display custom text over the element (default: "████████")
     - **Solid Color**: Fill with a solid color (choose color with picker)
     - **Blur Effect**: Apply a blur filter to make content unreadable
     - **Custom Image URL**: Use an image from a URL as the mask

3. **Set mask scope**
   - **Current Website Only**: Mask only applies to the current domain
   - **All Websites**: Mask applies everywhere the element selector matches

4. **Start inspection**
   - Click the "Start Inspection" button
   - The page will enter inspection mode (cursor changes to crosshair)

### 2. Selecting Elements to Mask

1. **Hover over elements**
   - Move your mouse over different parts of the page
   - Elements will be highlighted with a blue border as you hover

2. **Click to mask**
   - Click on any highlighted element to apply the mask
   - You'll see a notification confirming the element was masked
   - The mask is applied immediately

3. **Continue masking**
   - Keep clicking on other elements you want to mask
   - Each element is saved independently

4. **Stop inspection**
   - Click "Stop Inspection" in the popup when done
   - Or click the SpyWeb icon again and click the button

### 3. Managing Masked Elements

#### View All Masks
1. Click "View Masked Elements" in the popup
2. Or right-click the extension icon and select "Options"
3. See all masked elements organized by website domain

#### Remove Individual Masks
1. Open the Options page
2. Find the element you want to unmask
3. Click the "Remove" button next to it

#### Clear All Masks for a Site
1. In the popup, click "Clear All Masks"
2. Confirms before clearing
3. Only clears masks for the current website

#### Clear All Masks Everywhere
1. Open the Options page
2. Click "Clear All Masks" at the top
3. Confirms before clearing
4. Removes all masks from all websites

## Advanced Features

### Input Field Masking
When you mask input fields (text boxes, password fields, etc.):
- The visual content is masked
- You can still type normally in the field
- The cursor remains visible
- Perfect for screen sharing or recording

Example:
```
Before: [john.doe@example.com]
After:  [████████████████████] (but you can still type!)
```

### Scope Control

**Current Website Only**
- Best for site-specific sensitive data
- Element selector includes domain check
- Won't apply to other sites

**All Websites**
- Best for common UI elements
- Applies wherever the element pattern matches
- Useful for masking profile pictures, usernames across sites

### Import/Export Settings

**Export**
1. Open Options page
2. Click "Export Settings"
3. Saves a JSON file with all your masks and settings
4. Use for backup or sharing with team members

**Import**
1. Open Options page
2. Click "Import Settings"
3. Select a previously exported JSON file
4. All masks and settings are restored

## Tips and Best Practices

### Selecting Elements Effectively
- **Be specific**: Click the exact element (e.g., the text div, not the container)
- **Test inputs**: For input fields, try typing after masking to ensure it works
- **Check persistence**: Reload the page to verify masks reapply correctly

### Choosing Mask Types
- **Text masks**: Best for replacing with placeholder text
- **Color masks**: Good for complete coverage
- **Blur masks**: Maintains rough shape while hiding content
- **Image masks**: Can add branding or custom graphics

### Performance
- Masks are lightweight CSS overlays
- Minimal performance impact even with many masks
- Works on dynamic content (masks reapply automatically)

### Privacy & Security
- All data stored locally in your browser
- No data sent to external servers
- Masks are cosmetic (underlying data unchanged)
- Use for screen sharing, screenshots, or presentations

## Common Use Cases

### 1. Screen Sharing in Meetings
Mask personal information before sharing your screen:
- Email addresses
- Phone numbers
- Account numbers
- Names and addresses

### 2. Creating Tutorials
Hide sensitive data in tutorial videos:
- API keys and tokens
- Database credentials
- User information
- Financial data

### 3. Taking Screenshots
Clean up screenshots for documentation:
- Personal data in forms
- Account information
- Test data that looks unprofessional

### 4. Privacy-Conscious Browsing
Mask elements you don't want visible:
- Personalized ads
- Recommended content
- User profiles
- Tracking widgets

## Troubleshooting

### Mask Not Appearing
- Refresh the page and check again
- Verify the element selector in Options
- Check if the element exists on the page

### Mask Appearing in Wrong Place
- Element may have moved dynamically
- Try removing and re-adding the mask
- Use more specific selectors if possible

### Input Field Not Working After Masking
- This shouldn't happen; masks on inputs preserve functionality
- Try removing and re-adding the mask
- Report as a bug if persists

### Dynamic Content Issues
- Masks automatically reapply when content changes
- If issues occur, try refreshing the page
- May need to re-select elements on single-page apps

## Keyboard Shortcuts
Currently, there are no keyboard shortcuts, but they may be added in future versions.

## Getting Help
- Check the [README](README.md) for general information
- Review the [Installation Guide](INSTALLATION.md) if the extension isn't working
- Open an issue on GitHub for bugs or feature requests

## Demo Page
A demo page (`demo.html`) is included with example elements to mask. Open it in your browser to practice using the extension before using it on real websites.

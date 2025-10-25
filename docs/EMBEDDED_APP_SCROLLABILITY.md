# Embedded App Scrollability Fixes for Commerce7

## Problem

Commerce7 uses an older version of `iframe-resizer` that doesn't properly handle dynamic content height changes in embedded apps. This causes several issues:

1. **Content gets cut off** - The iframe doesn't resize when content expands
2. **No scrolling** - Users can't scroll to see hidden content
3. **Nested scroll containers** - Elements with their own `overflow-y: auto` trap scrolling
4. **Poor UX** - Forms and multi-step wizards become unusable

### The Nested Scroll Container Problem

When a component has `maxHeight="300px"` with `overflow-y: auto`, it creates a scroll container within the iframe. The old iframe-resizer doesn't handle this well:
- User tries to scroll the page
- Instead, only the nested container scrolls
- Content below the nested container becomes unreachable
- The iframe never expands to show the full page

## Solution Overview

We've implemented a multi-layered approach to fix scrollability:

### 1. Load iframe-resizer Content Window Script (`app/root.tsx`)

**This is the most critical fix!** Commerce7's iframe-resizer requires BOTH scripts:
- **Parent script** (loaded by Commerce7): `iframeResizer.js`
- **Child script** (must be loaded by your app): `iframeResizer.contentWindow.js`

Without the child script, you'll see this warning:
```
IFrame has not responded within 5 seconds. Check iFrameResizer.contentWindow.js 
has been loaded in iFrame.
```

Added to the `<head>` of your app:
```tsx
<script 
  type="text/javascript" 
  src="https://cdnjs.cloudflare.com/ajax/libs/iframe-resizer/4.3.2/iframeResizer.contentWindow.min.js"
/>
```

**Why this matters:**
- Enables two-way communication between iframe and parent
- Provides `window.parentIFrame` API for programmatic control
- Automatically handles height updates on most DOM changes
- Enables scrolling coordination between iframe and parent

### 2. CSS Fixes (`app/app.css`)

Added global styles to ensure proper scrolling in embedded iframes:

```css
/* Force html/body to be scrollable */
html,
body {
  height: auto !important;
  min-height: 100vh;
  overflow-x: hidden;
  overflow-y: auto;
}

/* Fix Polaris Page component height issues */
.Polaris-Page {
  min-height: auto !important;
}

/* Wrapper class for embedded content */
.embedded-app-wrapper {
  width: 100%;
  min-height: 100vh;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
}
```

**Key points:**
- `height: auto !important` prevents fixed heights that block scrolling
- `overflow-y: auto` ensures vertical scrolling is always available
- `-webkit-overflow-scrolling: touch` enables smooth scrolling on iOS devices

### 2. Layout Wrapper (`app/routes/app.tsx`)

Applied the `embedded-app-wrapper` class to the main app layout and added padding:

```tsx
<div className="embedded-app-wrapper min-h-screen bg-gradient-to-br from-purple-50 to-violet-100">
  {/* header */}
  <div className="container mx-auto px-4 pb-8">
    <Outlet />
  </div>
</div>
```

**Benefits:**
- Ensures the entire app is scrollable
- Adds bottom padding so users can scroll past the last element
- Maintains visual styling while fixing functionality

### 3. Iframe Helper Utilities (`app/utils/iframe-helper.ts`)

Created utilities to work with iframe-resizer and provide fallbacks:

#### `setupAutoResize()`
- Checks if `window.parentIFrame` is available (from content window script)
- Sets up ResizeObserver to trigger updates on DOM changes
- Provides logging to confirm iframe-resizer is connected

#### `notifyParentOfHeightChange()`
Manually triggers iframe resize:
- **Preferred**: Uses `window.parentIFrame.size()` if available
- **Fallback**: Uses postMessage if script hasn't loaded yet
- Safe to call repeatedly after content changes

#### `scrollToTop()`
Scrolls to the top of the page:
- **Preferred**: Uses `window.parentIFrame.scrollTo(0, 0)` if available
- **Fallback**: Uses `window.scrollTo()` on the iframe content
- Useful after navigation or form submissions

#### `isEmbedded()`
Detects if the app is running in an iframe.

### 4. Removed Nested Scroll Containers (`app/components/ProductCollectionSelector.tsx`)

Removed problematic nested scrolling in the product/collection selector:

**Before (causes scroll trapping):**
```tsx
<Box maxHeight="300px" style={{ overflowY: "auto" }}>
  <BlockStack gap="200">
    {/* products or collections */}
  </BlockStack>
</Box>
```

**After (allows natural page scrolling):**
```tsx
<Box>
  <BlockStack gap="200">
    {/* products or collections */}
  </BlockStack>
</Box>
```

This allows the entire page to scroll naturally instead of creating isolated scroll areas.

### 5. Setup Page Integration (`app/routes/app.setup.tsx`)

Integrated iframe helpers into the multi-step setup wizard with aggressive height notifications:

```tsx
// On mount: setup auto-resize
useEffect(() => {
  setupAutoResize();
}, []);

// On step change: scroll to top and notify parent
useEffect(() => {
  scrollToTop();
  setTimeout(() => {
    notifyParentOfHeightChange();
  }, 100);
}, [currentStep]);

// When forms expand/collapse or tiers change
useEffect(() => {
  notifyParentOfHeightChange();
}, [tiers.length, tiers.map(t => t.showDiscountForm).join(',')]);

// Immediate notifications on user actions
const toggleDiscountForm = (id: string) => {
  setTiers(/* ... */);
  setTimeout(() => notifyParentOfHeightChange(), 150);
};

const addTier = () => {
  setTiers(/* ... */);
  setTimeout(() => notifyParentOfHeightChange(), 150);
};
```

**Added padding wrapper:**
```tsx
<div style={{ paddingBottom: '80px' }}>
  <Layout>
    {/* content */}
  </Layout>
</div>
```

This ensures users can scroll past the bottom navigation buttons.

## How It Works

### For Static Content
The CSS fixes alone handle most static content:
1. Browser allows vertical scrolling due to `overflow-y: auto`
2. Content naturally flows and expands
3. Users can scroll normally within the iframe

### For Dynamic Content
The iframe helpers actively communicate with the parent:
1. **ResizeObserver** detects DOM changes
2. **notifyParentOfHeightChange()** calculates new height
3. **postMessage** sends height update to parent frame
4. Parent iframe-resizer receives message and adjusts iframe height

### Multi-Step Wizards
The setup page automatically:
1. Scrolls to top on step change (better UX)
2. Notifies parent of new height (ensures full content visible)
3. Updates on form interactions (expanding discount forms, adding tiers)

## Applying to Other Pages

To apply these fixes to other pages in the app:

### 1. Import the utilities
```tsx
import { notifyParentOfHeightChange, setupAutoResize, scrollToTop } from '~/util/iframe-helper';
```

### 2. Setup on mount
```tsx
useEffect(() => {
  setupAutoResize();
}, []);
```

### 3. Notify on content changes
```tsx
// After loading data
useEffect(() => {
  if (dataLoaded) {
    notifyParentOfHeightChange();
  }
}, [dataLoaded]);

// After expanding sections
const handleToggle = () => {
  setExpanded(!expanded);
  setTimeout(() => notifyParentOfHeightChange(), 100);
};
```

### 4. Add bottom padding
```tsx
<div style={{ paddingBottom: '60px' }}>
  {/* Your content */}
</div>
```

## Testing

### Test in Commerce7 Embedded App
1. Navigate to your app in Commerce7 admin
2. Test these scenarios:
   - Scrolling through long forms
   - Multi-step wizards
   - Expanding/collapsing sections
   - Adding dynamic content (like tiers)
   - Mobile viewport sizes

### Test Outside Embedded Context
The utilities gracefully handle non-embedded contexts:
- `isEmbedded()` returns false
- postMessage calls are safely wrapped in try-catch
- App works normally in standalone browser

### Browser Developer Tools
Open browser console and check for:
- No postMessage errors
- Height calculations logging (if you add console.log)
- Smooth scrolling behavior

## Troubleshooting

### Getting "IFrame has not responded within 5 seconds" warning?

**This is the #1 issue!** It means the iframe-resizer content window script isn't loaded.

**Solution:**
1. Check that the script is in your `<head>`:
```tsx
<script 
  type="text/javascript" 
  src="https://cdnjs.cloudflare.com/ajax/libs/iframe-resizer/4.3.2/iframeResizer.contentWindow.min.js"
/>
```

2. Check browser console for:
   - "✅ iframe-resizer connected" (good!)
   - "⚠️ iframe-resizer not available yet" (script didn't load)

3. Verify the script loads by checking for `window.parentIFrame` in console:
```js
console.log(window.parentIFrame); // Should be an object, not undefined
```

4. If using Content Security Policy (CSP), ensure CDN is allowed:
```
script-src 'self' https://cdnjs.cloudflare.com;
```

### Content still cut off after expanding?
**Check for nested scroll containers:**
1. Use browser DevTools to inspect the expanded section
2. Look for elements with `overflow-y: auto` or `overflow: auto`
3. Check for `maxHeight` restrictions on Boxes/Divs
4. Remove nested scrolling - let the page scroll naturally

**Fix nested scroll containers:**
```tsx
// Bad - creates nested scroll
<Box maxHeight="300px" style={{ overflowY: "auto" }}>
  {content}
</Box>

// Good - allows page scroll
<Box>
  {content}
</Box>
```

### Can't scroll in expanded forms?
This is the nested scroll container issue. The fix:
1. Remove any `maxHeight` restrictions on expanding content
2. Remove `overflow-y: auto` from nested elements
3. Let the `.embedded-app-wrapper` handle all scrolling

### Content still cut off?
- Check if parent page has CSS preventing iframe resize
- Verify postMessage is not blocked by CORS
- Try increasing the periodic check interval in `setupAutoResize()`
- Add manual `notifyParentOfHeightChange()` calls after content changes

### Performance issues?
- Reduce frequency of periodic checks
- Use debouncing on rapid state changes
- Remove ResizeObserver if causing problems

### Scrolling not smooth?
- Check for conflicting CSS (overflow: hidden)
- Verify parent frame isn't preventing scroll
- Test `-webkit-overflow-scrolling: touch` on iOS

## Browser Compatibility

✅ **Supported:**
- Chrome/Edge 88+
- Firefox 87+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

⚠️ **Graceful degradation:**
- ResizeObserver not available → Falls back to periodic checks
- postMessage blocked → Normal scrolling still works
- iframe-resizer not present → CSS fixes maintain scrollability

## Future Improvements

If Commerce7 updates to a newer iframe-resizer:
- Remove periodic checks (rely on ResizeObserver only)
- Use native iframe-resizer events
- Simplify postMessage format

For now, this multi-layered approach ensures maximum compatibility with the old iframe-resizer version.


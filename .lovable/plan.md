# Contained Monetag Sidebar Layout

## What will change
- Keep the existing Monetag MultiTag script in the page head unchanged.
- Use a desktop flex row with the main tool at 75% and the ad sidebar at 25%.
- Keep the mobile layout stacked with the full-width ad sidebar after the main content.
- Style the sidebar with a 1px light border, 12px corners, 10px padding, a small gray label, and sticky desktop positioning.
- Add `id="monetag-ad-container"` and run zone `11875406` inside a sandboxed frame within that container, preventing it from covering or blocking the main tool.

## Technical details
- Preserve zone `285465` in the existing head script exactly as it is.
- Keep the ad frame constrained to the sidebar bounds and disable fullscreen capability.
- Verify desktop and mobile placement and confirm the app remains healthy.

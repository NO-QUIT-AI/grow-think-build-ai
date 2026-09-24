# Clean Monetag Ad Sidebar

## What will change
- Add a reusable `AdSidebar` component with a labelled 300×250 ad area.
- Show it as a separate sticky right column on desktop so it never covers the main tool.
- Move the same ad area below the main content at full width on mobile.
- Load only Monetag zone `11875406` in the sidebar using an in-page display/push placement.
- Remove the existing Monetag vignette and MultiTag scripts that can create disruptive overlays or popunders.
- Keep the existing Monetag verification meta tag unchanged.

## Technical details
- Update the authenticated home layout to use a responsive two-column wrapper at desktop widths.
- Keep the main tool’s current width and behavior intact inside its own column.
- Add cleanup and duplicate-load protection around the ad script.
- Verify the desktop/mobile placement and confirm the current build remains healthy.

# Launching the redesign on Wix

The site is one long, scroll-driven page. On Wix it runs as a **Custom Element**
(`<driver-bureau-site>`): a single JavaScript file that contains the page,
its styles, GSAP, three.js and Lenis. On the live site it takes over the full
screen and scrolls inside its own layer, so nothing in Wix's page layout
(section heights, transforms, overflow) can break the pinned animations.

Files you need are in `dist/`:

| File | Use |
| --- | --- |
| `dist/wix/driver-bureau-element.js` | The Custom Element (recommended route) |
| `dist/wix/velo-page-code.js` | Optional: lets the element render in Preview mode |
| `dist/driver-bureau-embed.html` | Fallback: single HTML file for an "Embed HTML" iframe |
| `dist/index.html` + `dist/assets/` | Standalone version for any static host |

## Requirements

Wix only shows custom elements on sites that have a **Premium plan, a connected
domain and no Wix ads**
([Wix Help Center](https://support.wix.com/en/article/wix-editor-adding-a-custom-element-to-your-site)).
driverib.com already uses its own domain, so this is probably already true.
Check the plan in your Wix dashboard before you start.

## Option A: Custom Element from a Velo file (recommended)

1. **Duplicate your site first** (Site Actions → Duplicate) or work on a new,
   hidden page, so the current site stays live while you test.
2. **Turn on coding.** In the Wix Editor, enable *Dev Mode* (Velo). In Wix
   Studio, open the *Code* panel.
3. **Add the file.** In the code sidebar under **Public**, create a folder named
   `custom-elements` and inside it a file named `driver-bureau-element.js`.
   Paste in the full contents of `dist/wix/driver-bureau-element.js` and save.
4. **Add the element to the page.** Add → Embed Code → **Custom Element**.
   Click *Choose Source*, select **Velo File**, pick
   `public/custom-elements/driver-bureau-element.js`, and set the **Tag Name**
   to exactly:

   ```
   driver-bureau-site
   ```

   The element's size in the editor does not matter. In the editor it shows a
   dashed placeholder box. On the published site it fills the screen.
5. **(Optional) Preview support.** Wix's Preview runs the page inside a frame,
   where the element stays a placeholder by default. To see the full
   experience in Preview, paste `dist/wix/velo-page-code.js` into the page's
   code panel and change `#customElement1` to your element's ID.
   Do **not** set `mode="live"` with the editor's *Set Attribute* button:
   that would also take over the editor canvas.
6. **Page settings.** Set the page's SEO title and description in Wix
   (Page Settings → SEO basics). Suggested:
   - Title: `Driver Bureau | Fleet safety through psychomotor training`
   - Description: `Driver Bureau profiles each driver's psychomotor ability and trains it with individualised EyeGym programmes, for a 28% to 55% improvement in harsh braking and acceleration.`
7. **Publish**, then test on a phone and a desktop (see checklist below).

To make it the home page, put the element on your Home page (you can delete
or hide the old sections behind it; the element covers them anyway).

### Link targets

All buttons point to your existing Wix pages (`/book-a-meeting`, `/resources`,
`/faqs`, `/about`, `/case-studies`, `/use-cases`) and the portal at
`admin.driverib.com/login`, so Wix Bookings and your resource downloads keep
working. To point a link somewhere else without rebuilding, use the element's
**Set Attribute** button in the editor:

| Attribute | Controls |
| --- | --- |
| `book-url` | Every "Book a meeting", "Request a demo", "Ask about pricing" link |
| `portal-url` | "Portal login" |
| `resources-url`, `faqs-url`, `about-url`, `case-studies-url`, `use-cases-url` | Links to those pages |
| `z-index` | Stacking order of the full-screen layer (default `9000`) |
| `mode` | `auto` (default), `live`, or `off` |

## Option B: Custom Element from a server URL

If you would rather not use Velo, host `driver-bureau-element.js` on any HTTPS
static host (Netlify, Vercel, GitHub Pages, S3…). Then in step 4 choose
**Server URL** and paste the full `https://…/driver-bureau-element.js` link.
The Wix Help Center notes the URL must be HTTPS or it won't show on the live
site.

## Option C: Embed HTML (fallback)

If custom elements are not available on your plan, add an **Embed HTML**
element, choose *Code*, and paste the contents of
`dist/driver-bureau-embed.html`. Stretch it to full width and full screen
height, and remove other content from the page. Links open in the main
window.

Trade-offs of this route: the page content lives inside an iframe, which is
weaker for SEO, and the Wix page itself doesn't scroll (only the frame does).
Use it only if Option A isn't possible. I haven't been able to confirm Wix's
current size limit for pasted embed code; if Wix rejects the paste, host the
file and use *Website address* mode instead.

## After publishing: checklist

- [ ] Hero loads, truck appears, scrolling moves the camera from road level to
      the drone shot and fades into the content.
- [ ] Every "Book a meeting" button opens your booking page.
- [ ] Cookie banner (if you use one) is still visible and clickable. The
      experience sits at `z-index: 9000`; if the banner is hidden, lower the
      `z-index` attribute or raise the banner's layer.
- [ ] Wix Chat or other floating widgets: same check as the cookie banner.
- [ ] Test on iPhone (Safari) and Android (Chrome), including landscape.
- [ ] Turn on "Reduce motion" in your OS settings and reload. You should get a
      still hero and simple page with no pinned scrolling.
- [ ] Google Analytics / Wix Analytics still record the page view.

## Updating content later

All copy is in `src/site.html`. Edit it, run `npm run build`, then paste the
new `dist/wix/driver-bureau-element.js` over the old file in Wix and publish.
Stats, product names and FAQ answers are plain HTML in that file.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Placeholder box on the live site | Site lacks Premium/connected domain, or the element is inside an iframe. Set `mode="live"` via Velo code. |
| Nothing shows at all | Tag name doesn't match `driver-bureau-site`, or the file wasn't saved in `public/custom-elements/`. |
| Static hero instead of the 3D scene | The device has WebGL turned off, or the visitor asked for reduced motion. This is intended. |
| Jerky animation on an old laptop | The scene lowers its resolution automatically after a couple of seconds. |

# Driver Bureau website redesign

A single long-scroll site for [Driver Bureau](https://www.driverib.com), built
to launch on Wix as a Custom Element.

The hero is a real-time 3D scene. A cab-over truck in Driver Bureau blue,
pulling a white box trailer in the brand livery, drives an N3-style dual
carriageway through the KZN midlands in late-afternoon light. As you scroll,
the camera orbits the truck, rises into a top-down drone shot and follows it
down the highway. A heads-up display first shows what telematics sees (a log
of harsh-braking events), then what Driver Bureau sees (the driver's
psychomotor profile, an area of concern and a training programme). The scene
then pulls away and fades into the content.

The rendering aims for a photographic look: physically based materials
(clearcoat paint, polished alloy rims, tyres with moulded tread, reflective
glass), a procedural sky with lit clouds that also provides image-based
lighting, cascaded sun shadows (crisp on the truck, long across the
landscape), sun-aware aerial haze, ambient occlusion, depth of field at road
level, bloom on the lamps, filmic tone mapping and a light lens treatment
(vignette, fringing, grain). Trees are branching acacias and eucalyptus with
leaf-card canopies that sway and glow when backlit; the verges have shell
grass and tussocks.

## Brand

Applied from the Driver Bureau brand guidelines:

- **Colours:** Driver Bureau blue `#24599A` and white. Deeper and lighter
  tones used for backgrounds and accents (navy `#0E243E`, ink `#0B1B2E`,
  mist `#EEF3F9`, sky `#8BB3E4`) are shades and tints of that blue.
- **Typography:** Montserrat, the brand typeface named in the guidelines
  (headings in Montserrat Bold, text in Regular and Medium).
- **Logo:** the official monogram, redrawn as a clean vector from the logo
  file (`src/js/brand.js`), used in the header, preloader (the four pieces
  assemble), footer, favicon and on the truck.
- **Tagline:** "Proactively reduce driver risk. Because peace of mind
  matters." Values: Scientifically proven, Result driven, Authentic, Trusted.

See [`docs/CONTENT.md`](docs/CONTENT.md) for what still needs confirming.

Everything is driven by GSAP: ScrollTrigger scrubs the 3D camera, truck and
HUD from one timeline. SplitText, ScrambleText and DrawSVG handle the type and
illustrations, and scroll-linked tweens recolour the page between sections.

## Page structure

1. **Hero:** pinned 3D drive with four story beats
2. **Our belief:** statement that lights up word by word, and the brand values
3. **The gap:** 90% figure plus stacking problem cards
4. **How it works:** Assess → Profile → Train → Measure, scrolling sideways, with a reaction-time mini test
5. **Products:** VPJ (South African mining and transport) and Evolve (international fleets, insurers and employers)
6. **Results:** key figures and a to-scale chart of harsh-braking improvement
7. **Case study:** challenge → solution → results, pinned
8. **Who it's for:** fleets, insurers, employers, mining (tabs)
9. **Resources**, **FAQ**, **Contact**, footer

All content comes from the current site; see [`docs/CONTENT.md`](docs/CONTENT.md)
for sources and the short list of things to verify before launch.

## Launching on Wix

Follow [`docs/WIX-LAUNCH.md`](docs/WIX-LAUNCH.md). In short: paste
`dist/wix/driver-bureau-element.js` into a Velo public file, add a Custom
Element with tag name `driver-bureau-site`, publish.

## Working on it

```bash
npm install
npm run build    # writes dist/
npm run serve    # http://localhost:5173
npm run dev      # rebuild on change (run serve in another terminal)
```

| Path | What it is |
| --- | --- |
| `src/site.html` | All page markup and copy |
| `src/styles/` | CSS (tokens and type in `base.css`) |
| `src/js/main.js` | Mounts everything; works on a normal page or inside Wix's shadow DOM overlay |
| `src/js/hero/` | three.js world: truck and livery, road, terrain, foliage, traffic, sky and haze, post-processing, and the scroll timeline (`hero.js`) |
| `src/js/brand.js` | The monogram as vector paths, and the brand blue |
| `src/js/sections/` | Section behaviours (reveals, horizontal steps, case study, tabs, FAQ, reaction test) |
| `src/js/ui/` | Preloader, header and mobile menu, section colours, road rail, cursor |
| `build.mjs` | Bundles with esbuild and writes every output format |

Outputs in `dist/`:

- `index.html` + `assets/`: standalone site
- `driver-bureau-embed.html`: single file for a Wix Embed HTML element
- `wix/driver-bureau-element.js`: Wix Custom Element
- `preview/driver-bureau.html`: fragment used for the shareable preview page

## Behaviour notes

- **Motion preferences:** with "reduce motion" on, the hero is a still frame,
  nothing is pinned and all content is shown statically.
- **No WebGL:** the hero falls back to a painted dusk gradient, and the story
  and content still work.
- **Performance:** textures are generated at runtime (no image downloads).
  The 3D scene renders only while the hero is on screen. Desktops get the
  full treatment (MSAA, ambient occlusion, depth of field, four shadow
  cascades); phones and small screens get a lighter tier. While the
  preloader is still up, the scene times a few frames and steps down until
  it runs smoothly (depth of field, then resolution, then ambient occlusion
  and the grass shells), so quality never changes on screen. A device that
  is far too slow even then (no graphics acceleration) shows a still frame
  of the truck instead of animating. The intro is set up behind the
  preloader, so the wipe opens straight onto the truck rolling in.
- **Accessibility:** real HTML text throughout, skip link, keyboard-operable
  tabs, accordion and menu, visible focus states, `aria-live` results on the
  reaction test.
- **Libraries:** GSAP 3.15 (GreenSock standard no-charge licence, which now
  covers all plugins), three.js r186 (MIT), postprocessing 6.39 (Zlib), N8AO
  2.0 (ISC), Lenis 1.3 (MIT). All are bundled, so there are no CDN
  dependencies at runtime. Font: Montserrat from Google Fonts (SIL Open Font
  Licence).
- **Size:** the bundled script is about 1.2 MB (about 420 KB gzipped), most
  of it three.js.

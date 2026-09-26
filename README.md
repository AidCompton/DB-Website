# Driver Bureau website redesign

A single long-scroll site for [Driver Bureau](https://www.driverib.com), built
to launch on Wix as a Custom Element.

The hero is a real-time 3D scene. A yellow cab-over truck with Driver Bureau
livery sits on an N3-style dual carriageway at golden hour. As you scroll,
the camera orbits the truck, rises into a top-down drone shot and follows it
down the highway. A heads-up display first shows what telematics sees (a log
of harsh-braking events), then what Driver Bureau sees (the driver's
psychomotor profile, an area of concern and an EyeGym programme). The scene
then pulls away and fades into the content.

Everything is driven by GSAP: ScrollTrigger scrubs the 3D camera, truck and
HUD from one timeline. SplitText, ScrambleText and DrawSVG handle the type and
illustrations, and scroll-linked tweens recolour the page between sections.

## Page structure

1. **Hero:** pinned 3D drive with four story beats
2. **Our belief:** statement that lights up word by word
3. **The gap:** 90% figure plus stacking problem cards
4. **How it works:** Assess → Profile → Train → Measure, scrolling sideways, with a reaction-time mini test
5. **Products:** Elevate AI, Elevate+, VPJ
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
| `src/js/hero/` | three.js world: road, terrain and farmland, truck, traffic, sky, and the scroll timeline (`hero.js`) |
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
  The 3D scene renders only while the hero is on screen and drops its
  resolution if frames run slow. Phones get a lighter quality tier.
- **Accessibility:** real HTML text throughout, skip link, keyboard-operable
  tabs, accordion and menu, visible focus states, `aria-live` results on the
  reaction test.
- **Libraries:** GSAP 3.15 (GreenSock standard no-charge licence, which now
  covers all plugins), three.js r186 (MIT), Lenis 1.3 (MIT). All are bundled,
  so there are no CDN dependencies at runtime. Fonts: Archivo and Martian
  Mono from Google Fonts.

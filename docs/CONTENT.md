# Content map and items to verify

The live site (www.driverib.com) couldn't be loaded directly from the build
environment, so the copy was assembled from search-engine snapshots of its
pages. Everything below should be checked against the live site before
launch. Items marked **VERIFY** are the ones I'm least sure about.

## Where each section's content comes from

| Section in the redesign | Source page(s) on driverib.com |
| --- | --- |
| Hero ("Fleet safety starts behind the wheel") | Home, About |
| Hero story beats (90% of accidents, telematics gap) | Home, About |
| Our belief | About ("proactive, personalised and measurable") |
| The gap (90% + three problems) | About, Case Studies (challenge) |
| How it works (Assess, Profile, Train, Measure) | Products, Home (EyeGym), Elevate AI service page |
| Products (Elevate AI, Elevate+, VPJ) | Products, Elevate AI service page, FAQs |
| Results | Case Studies, Home |
| Case study (mining operation) | Case Studies |
| Who it's for (fleets, insurers, employers, mining) | Use Cases |
| Resources (agreements, guides, API docs, policies) | Resources |
| FAQ | FAQs / Resources |
| Contact | Book a meeting |

## Figures used on the page

| Figure | Where used | Source |
| --- | --- | --- |
| Drivers cause 90% of accidents | Hero, The gap | About / Home |
| 28% to 55% improvement in harsh braking and acceleration, depending on training logged | Hero, Elevate+, Results chart | Home |
| 14% improvement from a single 40-minute session | Elevate AI, Results chart | Elevate AI service page |
| VPJ: 45-minute assessment plus ongoing EyeGym | VPJ, FAQ | FAQs |
| EyeGym: customised daily 10-minute exercises | How it works, HUD, FAQ | Home |
| Up to 55% reduction in high-risk driving incidents | Results, Case study | Case Studies |
| 28% improvement in risk awareness and decision-making | Results, Case study | Case Studies |
| Estimated 9.24% reduction in total crashes | Results, Case study | Case Studies |
| Estimated 3.7% improvement in loss ratio; bottom 30% of operators contribute 80% of claims | Results, Insurers tab | Case Studies / Use Cases |

## VERIFY before launch

1. **Phone number.** `+27 82 901 8498` came from the Book a meeting page as
   indexed by search. A business directory (ZoomInfo) lists `+27 76 811 6101`,
   which is not used. Confirm which number you want shown.
2. **"Driver Bureau guarantees a minimum ROI."** This appeared in a search
   snippet of the site. It is a strong claim; keep it only if it is still on
   your site and you stand behind it (Results intro in `src/site.html`).
3. **FAQ answers.** The six questions exist on your FAQ page, but the page
   text wasn't readable, so the answers were written from facts elsewhere on
   the site. In particular:
   - *Pay-As-You-Go vs Prepaid*: the answer only says both options exist and
     suggests booking a meeting. Replace with your real explanation.
   - *How do I set up my account*: the answer describes the consultation step
     only.
   - The FAQ about **API usage limits** is not reproduced. The section links
     to your full FAQ page instead.
4. **Logo.** The reticle mark and "DRIVER BUREAU" wordmark are placeholders.
   Send the official logo (SVG) and it can be swapped in the header,
   preloader, footer and the truck livery.
5. **Brand colours.** Asphalt `#0D0F12`, Concrete `#E3E2DC` and Road-line
   Yellow `#FFC21A` were chosen for the redesign, not taken from your
   current site. They live in `src/styles/base.css` and
   `src/js/ui/theme.js` if you want to change them.
6. **HUD readouts in the hero** (telematics log times, meter levels, "area of
   concern") are illustrative animation, not real data.
7. **Address.** A directory lists 141 Taunton Rd, Pietermaritzburg. It isn't
   shown on the page because I couldn't confirm it appears on your site.
8. **Client names.** Older pages under `/current-users/` (Sereth Logistics,
   Anderson Transport, Icon Earthworks) seem to belong to an earlier version
   of the site, so they aren't used. A "Trusted by" logo strip can be added
   if you'd like to show current clients.
9. **Truck.** South African traffic keeps left and cab-overs are
   right-hand drive; the scene follows both. The livery shows `driverib.com`.

## Pages that stay on Wix

The redesign links to these existing pages rather than replacing them:

- `/book-a-meeting` (Wix Bookings)
- `/resources` (agreements, guides, API docs, policies)
- `/faqs`, `/about`, `/case-studies`, `/use-cases`
- `https://admin.driverib.com/login` (Driver Bureau Portal)

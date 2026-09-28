# Content map and items to verify

The live site (www.driverib.com) couldn't be loaded directly from the build
environment, so the copy was assembled from search-engine snapshots of its
pages. Everything below should be checked against the live site before
launch. Items marked **VERIFY** are the ones I'm least sure about.

## Where each section's content comes from

| Section in the redesign | Source page(s) on driverib.com |
| --- | --- |
| Hero ("Proactively reduce driver risk. Because peace of mind matters.") | Brand strategy documents (tagline) |
| Hero story beat ("Fleet safety starts behind the wheel") | Home, About |
| Hero story beats (90% of accidents, telematics gap) | Home, About |
| Our belief | About ("proactive, personalised and measurable"); values from the brand strategy documents |
| The gap (90% + three problems) | About, Case Studies (challenge) |
| How it works (Assess, Profile, Train, Measure) | Products, Home; self-rating vs actual performance from the VPJ/Evolve course scripts; step wording supplied by the client (Sept 2026) |
| Products (VPJ, Evolve) | Client brief (Sept 2026): Elevate AI and Elevate+ are discontinued; VPJ is for South African mining and transport, Evolve for international use cases. Journey and positioning from Driver Bureau's own course scripts and VPJ marketing notes |
| Results | Case Studies, Home |
| Case study (mining operation) | Case Studies, reworded per the client: the mine engaged Driver Bureau for its operators (always plural), who went through VPJ |
| Who it's for (fleets, insurers, employers, mining) | Use Cases |
| Resources (agreements, guides, API docs, policies) | Resources |
| FAQ | FAQs / Resources |
| Contact | Book a meeting |

## Figures used on the page

| Figure | Where used | Source |
| --- | --- | --- |
| Drivers cause 90% of accidents | Hero, The gap | About / Home |
| 28% to 55% improvement in harsh braking and acceleration, depending on training logged | Hero, Results chart | Home |
| VPJ and Evolve: 45-minute assessment plus ongoing training | Product cards, FAQ | FAQs (VPJ); client (Evolve, Sept 2026) |
| Daily 10-minute training exercises | How it works, HUD, FAQ | Home |
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
4. **Logo.** The monogram is the official mark, redrawn as a vector from
   the logo file in the Driver Bureau CRM repository (`public/logo.png`) and
   checked against it. The full lockup files ("Group" PNGs in the Dropbox
   *New Logos* folder) couldn't be opened from the build environment, so the
   name beside the monogram is set in Montserrat Bold. If there is an
   official lockup or wordmark (ideally SVG), send it and it can replace
   that in the header, footer and on the trailer.
5. **Brand colours.** Driver Bureau blue `#24599A` and white come from the
   brand guidelines (the hex code appears in the guidelines PDF and matches
   the logo file). The brand strategy documents list the colours as
   *Green, Blue, White*, but no green hex code could be found in the
   guidelines' text, so green isn't used. Send the green's hex code if it
   should appear. Navy `#0E243E`, ink `#0B1B2E`, mist `#EEF3F9` and sky
   `#8BB3E4` are shades and tints of the brand blue chosen for this site;
   they live in `src/styles/base.css` and `src/js/ui/theme.js`.
   **Typography:** the guidelines name Montserrat (and Montserrat Bold). I
   couldn't read whether they set particular weights or sizes for headings
   and body text, so headings use Bold and text uses Regular/Medium.
6. **HUD readouts in the hero** (telematics log times, meter levels, "area of
   concern") are illustrative animation, not real data.
7. **Address.** A directory lists 141 Taunton Rd, Pietermaritzburg. It isn't
   shown on the page because I couldn't confirm it appears on your site.
8. **Client names.** Older pages under `/current-users/` (Sereth Logistics,
   Anderson Transport, Icon Earthworks) seem to belong to an earlier version
   of the site, so they aren't used. A "Trusted by" logo strip can be added
   if you'd like to show current clients.
9. **Truck.** South African traffic keeps left and cab-overs are
   right-hand drive; the scene follows both. The truck isn't modelled on a
   particular manufacturer and carries no manufacturer badges. The livery
   shows the monogram and name with "Because Peace of Mind Matters"
   underneath, and a blue rear block (sides and roof, lined up) with
   `driverib.com`. The front
   number plate (`ND 245-99`) is made up; change or remove it in
   `src/js/hero/livery.js` if you prefer.
10. **Tagline and values.** "Proactively reduce driver risk. Because peace of
   mind matters." and the values (Scientifically proven, Result driven,
   Authentic, Trusted) come from Driver Bureau's brand strategy documents.
   Check you're happy to publish them on the home page.
11. **VPJ and Evolve copy.** Evolve is described as the same journey as VPJ
   for international markets, based on the "Evolve now first world VPJ"
   course folder. Check in particular:
   - the **"Evolve Guide"**, which isn't listed: Resources shows the VPJ Guide
     plus a link to all guides;
   - the **14% single-session figure**, which was removed from the Products
     and Results sections because it was measured for Elevate AI. Restore it
     if it also holds for VPJ or Evolve.
12. **Case-study figures.** The results (up to 55%, 28%, 9.24%, 3.7%) come
   from the current driverib.com. Confirm they're backed by the case-study
   data and approved for publication before launch.
13. **No EyeGym.** At Driver Bureau's request (September 2026) the site
   doesn't name EyeGym anywhere, including the page description. Training is
   described generically ("training", "daily 10-minute exercises"). Keep it
   that way when editing copy.

## Pages that stay on Wix

The redesign links to these existing pages rather than replacing them:

- `/book-a-meeting` (Wix Bookings)
- `/resources` (agreements, guides, API docs, policies)
- `/faqs`, `/about`, `/case-studies`, `/use-cases`
- `https://admin.driverib.com/login` (Driver Bureau Portal)

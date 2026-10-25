# Devpost research for Pill (Cal Hacks 13.0), 2026-10-24
## DO THIS (in order)
1. Tagline ≤140 chars: what it does + for whom, honest verbs ("screens", "reads"); never "real/authentic/verified" (Peel's tagline says "check whether their medicine is real", which our rules ban).
2. Open the story with a 2–3 sentence elevator pitch before any heading (Duet does; Devpost: "Start with your pitch and a quick overview").
3. Write to the 5 Cal Hacks 13.0 criteria by name: Application, Intentionality, Functionality, Creativity, Technical Complexity.
4. "What it does" = numbered steps + the three verdicts, each with a one-line meaning (Peel's structure).
5. One plain physics paragraph (Beer–Lambert, water blank, in-line vs 90° sensor) with our measured numbers (0.29 vs 0.006 noise; red 0.035).
6. Challenges = 4–6 specific failures with cause → fix (riboflavin ≈328 at 444 nm; Uno R3 → UNO Q; Linux-side hang; 5.5 tool_choice 400; Gemini ~20/day; no CDP key). No generic "integration was hard".
7. Add a "What's real / not yet" block: TESTNET, real 402 + verify, paid 200 pending, Gemini limits. Peel's Devin PR had a "Not verified" section; judges read honesty as rigor.
8. Add "Sponsors, read here" with one short paragraph per entered track (Claude for Public Benefit, Coinbase x402, MLH Gemini, Figma Workflow, Best Hardware): Peel's pattern.
9. Credit Peel early with the house line ("method only, no code; every line of our code was written this weekend"): our three verdict phrases are identical to Peel's.
10. Voice: "we", one or two true fun moments (Duet's stuffed-bear line), end on learned + thanks. Logistics: station photo as 3:2 thumbnail, GitHub link, public YouTube (not "for kids"), submit before 09:00 PDT.

## Sources
### Cal Hacks 13.0 hackathon page: https://cal-hacks-13-0.devpost.com/ (verified-opened)
- "You must submit your hack by October 25th @ 9 AM PST with your teammates! This is a hard deadline."
- "Include an image of your project and GitHub repository for any code to be considered." / "three minutes to pitch and two minutes for judges to ask questions."
- Criteria: Application ("Strong submissions identify who they help, what problem they solve, and why people would actually use them."), Intentionality, Functionality ("include a clear, meaningful video demo on devpost for sponsors evaluating asynchronously"), Creativity ("Clearly show what makes your project stand out from similar work."), Technical Complexity.
- Relevant tracks: [Anthropic] Claude for Public Benefit; [Coinbase] Best Use of x402; [MLH] Best Use of Gemini API; [Figma] Best Figma Workflow Hack; Best Hardware Hack; Most Technically Complex; Best People-First Social Impact.

### Devpost help: Know Your Submission Steps: https://help.devpost.com/article/126-know-your-submission-steps (verified-opened)
- Thumbnail: "JPG, PNG or GIF format, 5 MB max file size. For best results, use a 3:2 ratio."
- Video: "must be hosted publicly on YouTube, or Vimeo to properly embed for the judges." Built-with: "Tag the sponsor's tool" (25 max). Step 6: "Double check your project using the View button."
- Tagline limit 140 chars: help.devpost.com/article/145 ("Submission tagline (140 characters)"): reported (search snippet only).

### Devpost blog, judging criteria: https://info.devpost.com/blog/understanding-hackathon-submission-and-judging-criteria (verified-opened)
- "If you can't explain how to use your project in a sentence or two, it might be too complicated."
- "Potential impact: Does your project solve a genuine problem? ... make sure to highlight this in your submission."

### Devpost blog, 6 demo-video tips: https://info.devpost.com/blog/6-tips-for-making-a-hackathon-demo-video (verified-opened)
- Demo video is "one of the first things that judges will look at"; "most are under three minutes long."
- "Start with your pitch and a quick overview of your project before diving in" / "Keep it short, interesting (no slide shows/decks)" / "mark your video as 'Not for Kids' on YouTube".

### Devpost blog, 5 judges: https://info.devpost.com/blog/hackathon-judging-tips (verified-opened)
- "sometimes you have a really nice video and a really lacking text description... it's important to have all of those things complementing one another." (Square)
- "Ambiguity is a red flag, and also projects that lack detail and code." / "Definitely err on more details" (Databricks)

### Peel, HackMIT 2026 Overall 1st + Elastic 1st: https://plume.hackmit.org/project/qxodw-wgjqk-lidau-dxrpe (verified-opened; on HackMIT's Plume, not Devpost)
- First 3 lines: title "Peel — The tiny lab technician"; tagline "A low-cost optical dissolution tester that plugs into any phone, paired with an AI evidence engine..."; Inspiration opens with a WHO-scale statistic.
- Structure/length: Inspiration ~180 words; What it does ~400 (3 numbered observations, verdict blockquotes); How we built it very long (Instrument / From Light to a Result / App / Evidence Engine); "SPONSOR-SPECIFIC NOTES: Sponsors, read here..." (one block per track); Individual Contributions; Challenges ~200; Accomplishments ~130; Learned ~180; What's next ~350.
- Voice: plain, declarative, every claim has a unit or measurement; no exclamation marks.
- Honesty quotes: "Unable to Verify: The reading can't be trusted because of a cloudy vial, a saturated sensor... Peel says so instead of guessing." / "Today Peel reads drugs that absorb visible light, with riboflavin as the calibrated reference."
- Challenges, model to copy: "Room light leaking into the case raised our dark reading from about 100 mV to 800 mV, the stirrer motor showed up in the sensor lines, and our violet LED ran dim at a 3.2 V forward voltage on a 3.3 V pin."
- Learned, model to copy: "analytical chemistry is mostly the discipline of distrusting your own instrument." / "the most important engineering is deciding what the system is allowed to say and enforcing it in code."
- Overlap with Pill: verdicts "Passed the Screen / Needs Lab Testing / Unable to Verify"; in-line + 90° sensors; water blank; absorbance curve; filtering "safe"/"genuine". Credit it (checklist 9).
- Context: https://www.mccormick.northwestern.edu/news/articles/2026/10/northwestern-engineering-student-wins-overall-track-first-place-at-hack-mit (verified-opened): "the members built the working prototype during the competition's 24-hour development period."

### Duet, Cal Hacks 11.0 1st Overall: https://devpost.com/software/duet-0tbkxe (verified-opened); win confirmed by https://stanforddaily.com/2024/11/20/stanford-students-win-cal-hacks (verified-opened)
- First 3 lines: title "Duet: Brainwaves -> Live Music"; tagline "Creativity is inherent, but expressing it is hard. Duet reads live brainwaves via EEG..."; pitch paragraph "Duet's music generation revolutionizes how we approach music therapy."
- Short sections; What it does = 2 lines: "1. Wear an EEG 2. Experience your brain waves as music!"
- Fun voice that won: "After trying it out on ourselves, the CalHacks stuffed bear, and the Ariana Grande cutout in the movie theater, we dove into coding." / "it turned out to be not too shabby!"
- Challenges are honest about doubt: "We originally thought it was impossible ... and even spent hours thinking about how to pivot."
- Winner's advice (Stanford Daily): "Make something that you think is really cool, because if you think it's really cool, it will show, and the judges will see it."

### PulseWalk, Cal Hacks 11.0 hardware (prize not confirmed): https://devpost.com/software/pulsewalk (verified-opened)
- First 3 lines: title; tagline "Our cutting-edge shoe enhances awareness for the visually impaired..."; Inspiration "came from my grandmother, who has struggled with poor vision for years."
- Good: a concrete personal origin; names what failed ("unfortunately we had trouble integrating Deepgram AI"). Bad: later says "successfully setting up Skylo services" after "trouble integrating Skylo", and "guarantees that visually impaired users can move confidently".

### merj, Cal Hacks 12.0 winner (prize unconfirmed): https://devpost.com/software/merj (verified-opened)
- First 3 lines: tagline "...One command. Zero headaches."; broken "## Inspiration ## What it does## Inspiration"; "Every developer knows that sinking feeling..."
- Weak Challenges list to avoid copying: "System design / Integration / LLM Formatting".
### Project No Cap, Cal Hacks 12.0 3rd Overall: https://devpost.com/software/project-no-cap (reported: HTTP 403; prize from search snippet). Tagline: "Bringing clarity to the chaos of misinformation through real-time AI verification."

## How winners write Challenges / Learned
- Peel: number + cause + fix in one sentence each; Learned = 3 transferable lessons, one per layer.
- Duet: one big challenge told as a story (thought impossible → new method). PulseWalk: names parts and errors (solder joints, Java version, modem with no reply).
- Weak (merj): category labels with no specifics.

## Patterns to AVOID
- Hype verbs: "revolutionizes" (Duet), "cutting-edge", "guarantees" (PulseWalk), "Zero headaches" (merj).
- Authenticity claims in the tagline (Peel's "real"); our banned words: safe/verified/authentic/genuine/certified/guaranteed/fake/counterfeit.
- Accomplishments that contradict Challenges (PulseWalk Skylo).
- Unsourced market stats (Duet's "projected growth rate of 15.59%"); use only our numbers files.
- Broken or duplicated markdown (merj headings; Peel repeats its Espressif/Arduino blocks): proofread with Devpost's View.
- A slide-deck video, or a generic AI-written script (Devpost blog).

(Research by a read-only scout at 20:4x; saved by the coordinator. Deadline on the Cal Hacks page: Oct 25, 9:00 AM PDT, hard.)

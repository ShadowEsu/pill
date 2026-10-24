# Recent Berkeley hackathon winners: Cal Hacks 12.0, UC Berkeley AI Hackathon 2026, Cal Hacks 11.0

_Compiled 2026-10-23 for the Cal Hacks 13.0 team._

## Sources and caveats
- Devpost winners filter (`/project-gallery?winners=true`) and `devpost.com/software/*` pages returned **HTTP 403** to my reader, so I could not open them directly.
- **Prize labels** come from HackStack, which copies Devpost's winner badges:
  - https://www.hack-stack.space/hackathons/cal-hacks-12-0?view=projects (638 of 699 projects indexed, partial)
  - https://www.hack-stack.space/hackathons/ai-hackathon-2026?view=projects (368 of 400)
  - https://www.hack-stack.space/hackathons/cal-hacks-11-0?view=projects (291 of 352)
- **One-line descriptions** come from Devpost galleries I could open: https://cal-hacks-12-0.devpost.com/project-gallery (pages 1–4), https://ai-hackathon-2026.devpost.com/project-gallery (pages 1–3), https://cal-hacks-11-0.devpost.com/project-gallery (pages 1–2).
- **Tech stack** comes from the project write-ups that HackStack mirrors. Where I only have the prize name, "(per prize)" means the sponsor tool is implied by a "Best Use of X" prize.
- **Input**: rows marked _(inf.)_ have the input type inferred from the tagline alone.
- Cal Hacks 12.0 prize catalogue: https://live.calhacks.io/prizes

---

## 1. Cal Hacks 12.0: Oct 24–26, 2025, Palace of Fine Arts, SF (699 Devpost submissions)
The organizers' own prizes were 1st, 2nd and 3rd Overall, Best Beginner, Most Creative, Best Hardware and Social Impact, plus "Best Use of Annapurna" (https://live.calhacks.io/prizes).
**There was no Cal Hacks "Most Technically Complex" prize at 12.0.** The closest prize, LiveKit's "Most Complex / Technically Challenging Use of LiveKit," had no winner in the mirror.

### 1a. Main Cal Hacks prizes
| Project | Prize(s) | What it does | Tech / sponsor tools | Input | URL |
|---|---|---|---|---|---|
| FaceTimeOS: AI Mac Agent | **1st Overall** | FaceTime your Mac; a computer-use agent hears your request and controls the Mac over screen share | Simular Agent S3, Fetch.ai, Fish Audio, Cluely-style hidden UI | Voice + screen | https://devpost.com/software/facetime-macos-ai-agent · write-up: https://blog.dylanlu.com/cal-hacks-12/ |
| Ted.AI | **2nd Overall**; LiveKit: Most Creative Project | Teddy bear that senses hugs, motion and heart rate, talks with children and guides breathing; dashboard for parents and clinicians | ESP32, HW-502 pulse sensor, capacitive touch, MPU6050 IMU, Whisper, RoBERTa emotion model, GPT via LangChain, MQTT, TFLite Micro, Flask, MongoDB, InfluxDB, React + D3 | **Sensors** + voice | https://devpost.com/software/ted-ai-x8537t |
| Project No Cap | **3rd Overall** | Live fact-checker: labels spoken or online statements TRUE / FALSE / OPINION; also runs AI-moderated debates | SwiftUI, Apple Speech, Claude, Janitor AI, Vapi, Creao | Voice + text | https://devpost.com/software/project-no-cap |
| Hardware Context Protocol (MCP for Hardware) | **Best Hardware Hack**; Crater: Play-Do Prize | SDK that lets an LLM discover and control hardware nodes; demoed as a voice-driven robot-arm chef | Python, FastAPI, LeRobot SO-ARM101, OpenCV AprilTags, Fetch.ai ASI:One, custom TCP pub/sub | Voice/text + camera | https://devpost.com/software/hardware-context-protocol |
| Bob | **Most Creative Hack** | AR glasses that see and hear what you're doing and coach physical tasks (circuits, car repair) | Snap Spectacles, Gemini Live, YOLOE, Slack SDK, Gmail | Camera + voice | https://devpost.com/software/bob-vj43mq |
| Expungo | **Greatest Social Impact**; Promise: Public Impact Prize | Upload a court record (RAP sheet); it checks expungement eligibility, fills the forms, and a voice agent walks you through it | Next.js, FastAPI, Gemini PDF parsing, LangChain + ChromaDB RAG, GPT-4, LiveKit voice agent | Document + voice | https://devpost.com/software/clearpathai |
| Physical Digital Darts (Wii Darts) | **Best Beginner Hack** | 3D-printed dart with an IMU; a real throwing motion lands on a digital dartboard | Arduino Nano, MPU6050, drift filter, Python simulator | **Sensor (IMU)** + button | https://devpost.com/software/digital-physical-darts-wii-darts |

### 1b. Sponsor prizes (every winner in the mirror)
| Project | Prize(s) | What it does | Tech / sponsor tools | Input | URL |
|---|---|---|---|---|---|
| Elda AI | Claude: Best Use of Claude | Eldercare companion that listens, monitors behavior, prevents medication mistakes and keeps caregivers updated | Claude, Letta, Chroma | Voice | https://devpost.com/software/elda-ai |
| Haven | Fetch AI: Best Use of Fetch AI; YC: Iconic YC Company 1st; LiveKit: Best Start-up Idea | Hospital command center: patient voice agent, agents watching vital signs, heart rate read from a camera, 3D floor map | LiveKit, OpenAI Realtime, Whisper, Fetch.ai, Claude tool-calling, OpenCV | Voice + camera | https://devpost.com/software/haven-536r1q |
| Orbit | Fetch AI: Best Use of Fetch AI | Listens to conversations and turns them into completed tasks | Fetch.ai (per prize) | Voice _(inf.)_ | https://devpost.com/software/orbit-n97hqz |
| EDFlow AI | Fetch AI: Best Deployment of Agentverse | Specialist agents (beds, labs, pharmacy) coordinate ER emergencies in under 30 s | Fetch.ai Agentverse | Data/text | https://devpost.com/software/edflowai |
| Agent Santa | Fetch AI: Best Use of ASI:One | Personality-based agents pick and pay for personalized gifts | Fetch.ai ASI:One | Text | https://devpost.com/software/agent-santa |
| InterViewAR | Fetch AI: Best Use of ASI:One | AR view that flags stress and burnout cues during interviews | Fetch.ai ASI:One, AR | Camera _(inf.)_ | https://devpost.com/software/interviewar |
| ADLOVIN | AppLovin: Ad Intelligence Challenge | Pulls visual, text and audio signals from ad images and videos | AppLovin challenge | Image/video | https://devpost.com/software/adlovin-media-intelligence |
| Duck Duck Goose | AppLovin: Query Planner Challenge | Fast query engine built on DuckDB | DuckDB | Data | https://devpost.com/software/duck-duck-goose-jelxr9 |
| Brydge | YC: Iconic YC Company 1st | Turns scattered engineering knowledge into automated workflows | — | Text | https://devpost.com/software/brydge |
| AI Docs | YC: Iconic YC Company 2nd | Google-Docs-style storage and editor with AI built in | — | Text | https://devpost.com/software/ai-docs |
| AgentOverflow | Elastic: Agent Builder (1st) | "Stack Overflow for LLMs": saves verified fixes and feeds them back to models through MCP | Elastic Agent Builder, Elasticsearch, MCP, Claude | Text | https://devpost.com/software/agentoverflow · https://www.elastic.co/search-labs/blog/agent-builder-projects-learnings-cal-hacks-12-0 |
| MarketMind | Elastic: Agent Builder (runner-up) | **Fintech**: six agents score live stock data (price, sentiment, volatility) and show it as visual "market energy" | Elastic Agent Builder, ES\|QL, Yahoo Finance, Next.js, Chart.js | Market data | https://devpost.com/software/marketmind-b6cy2q |
| Orion | Warp: Best Use of Warp; Vapi: Best Use of Vapi | **Wildfire** operations dashboard: live 3D map, wind-aware fire-spread prediction, voice-controlled dispatch, Telegram/SMS alerts | Next.js, Mapbox, Supabase Realtime, Open-Meteo, Fetch.ai uAgents, Vapi, Composio, Telegram | Voice + live data | https://devpost.com/software/orion-p5ayks |
| CareLink | Vapi: Best Use of Vapi | Coordinates hospital discharge with shelters and social workers | Vapi (per prize) | Voice | https://devpost.com/software/carelink-mf4qvr |
| Rep | Vapi: Best Use of Vapi | Practice sales calls against AI prospects with live coaching | Vapi | Voice | https://devpost.com/software/rep-ja9oqw |
| BallAR | Snap: Best Use of Spectacles | AR plus electro-stimulation to improve your beer pong | Snap Spectacles | Camera/AR | https://devpost.com/software/ballar |
| MemARy | Snap: Best Use of Spectacles | AR memory-aid glasses for Alzheimer's ("see, hear, remember") | Snap Spectacles | Camera + voice _(inf.)_ | https://devpost.com/software/memary |
| Wingman | Snap: Best Use of Spectacles; BitRobot: Best Robotics 3rd | Point and gesture through Spectacles to drive a robot that moves, grabs and captures 3D scenes | Snap Spectacles, robot | Gesture + camera | https://devpost.com/software/wingman-9xok8b |
| MIRAI | BitRobot: Best Robotics 1st | Natural motion and voice control of a humanoid robot | Unitree G1 (per repo name) | Camera + voice | https://devpost.com/software/boxing-robot |
| MARC | BitRobot: Best Robotics 2nd | Robot arm that draws from text prompts | LLM + linear-algebra arm control | Text | https://devpost.com/software/marc-marker-actuated-robotic-controller |
| Trialscope AI | Regeneron: **Grand Prize** | Reviews and rewrites clinical-trial protocol drafts into FDA-aligned documents | — | Documents | https://devpost.com/software/trialscope-ai |
| Harmoniq | Regeneron: Runner-Up; Rox: Best Use of Rox | Regulatory intelligence for clinical trials | Rox | Docs/text | https://devpost.com/software/harmoniq-06o1e9 |
| TrialFlow | Regeneron: Runner-Up | Smart clinical-trial coordinator | — | Text | https://devpost.com/software/trialflow |
| TrialGuideAI | Regeneron: Runner-Up | Turns trial protocols into patient-friendly summaries, infographics and videos | — | Documents | https://devpost.com/software/trialguideai |
| trialmatch.ai | Regeneron: Runner-Up | Agent that finds trial-eligible patients on its own | — | Data | https://devpost.com/software/trial-match-ai |
| Trialytics | Regeneron: Runner-Up | Automates protocol-compliant handling of trial data | — | Data | https://devpost.com/software/trialytics |
| Cura | Regeneron: Honorable Mention | AI symptom checker that connects patients to care | — | Text | https://devpost.com/software/cura-kthowx |
| MIFY | Regeneron: Honorable Mention | "Medical Insights For You" | — | Text | https://devpost.com/software/mify |
| MonitorMachine | Regeneron: Honorable Mention | Automates clinical-trial verification | — | Documents | https://devpost.com/software/monitormachine |
| GhostManager | Regeneron: Honorable Mention | Agentic AI for compliance | — | Text | https://devpost.com/software/ghostmanager |
| Synthetic Data Generation and Imputation | Regeneron: Honorable Mention | Generates virtual patients and fills missing data for trials | — | Data | https://devpost.com/software/synthetic-data-generation-and-imputation |
| Empirica | Regeneron: Honorable Mention | [one-liner not retrieved] | — | — | https://devpost.com/software/empirica |
| Human Capital | Sui: Best Use of Sui | Auction your time in 15-minute blocks on the blockchain | Sui | Text | https://devpost.com/software/human-capital |
| Movement | Sui: Best Use of Sui | **Fintech**: fee-free blockchain crowdfunding | Sui | Text | https://devpost.com/software/movement-f4nyob |
| Otter | Sui: Best Use of Sui | Decentralized messaging | Sui | Text | https://devpost.com/software/otter |
| Shard | Sui: Best Use of Sui | Earn side income by renting out an idle laptop | Sui | — | https://devpost.com/software/shard-2kvsch |
| SuiTix | Sui: Best Use of Sui | Fraud-proof ticket resale and loyalty program | Sui Kiosk | Text | https://devpost.com/software/suitix |
| CivitasX | Ripple: Best Use of XRP Ledger; Creao: Best MCP Integration | City-services AI agents whose actions are logged on the XRP Ledger | XRPL, MCP, Creao | Text | https://devpost.com/software/dhdhtfgh |
| LendX | Ripple: Best Use of XRP Ledger | **Fintech**: small-business lending tracked on-chain | XRPL | Text | https://devpost.com/software/lendx |
| XRPower | Ripple: Best Use of XRP Ledger | Prediction markets: stake XRP on outcomes | XRPL | Text | https://devpost.com/software/xrpower |
| Covenant | Ethereum Foundation: Honorable Mention | Stake money on your goals; miss them and it goes to a cause you dislike | Ethereum, AI | Text | https://devpost.com/software/covenant-onci9q |
| TraceFund | Ethereum Foundation: Honorable Mention | Transparent donation tracking | Ethereum | Text | https://devpost.com/software/trustfund-24cmnh |
| Kasha | Visa | **Fintech**: chatbot that tracks spending, splits charges and nudges friends who owe you | Visa (per prize) | Text | https://devpost.com/software/kasha |
| Cryptoagent – CFO | Postman | **Fintech**: crypto portfolio liquidation strategies | Gemini Exchange data, Fetch.ai | Data | https://devpost.com/software/cryptoagent-cfo |
| CryptoBot | Postman | "Robotic butler" with on-chain rights | — | — | https://devpost.com/software/cryptobot-ecytaj |
| Relay | Postman; [MLH] Best Use of Snowflake API | Turns vague product requirements into pull requests in about 30 s | Postman, Snowflake | Text | https://devpost.com/software/https-youtu-be-dqw4w9wgxcq |
| ChatRealm | Bright Data: Best Use of Bright Data | Context-aware AI chat rooms built on scraped LinkedIn data | Bright Data | Text | https://devpost.com/software/chatrealm |
| FairVal | Bright Data: Best Use of Bright Data | Watches prices after you buy and writes refund emails | Bright Data | Web data | https://devpost.com/software/reclaim-ai |
| Mantis | Reka: Best Use of Reka | Real-time shoplifting detection for stores | Reka vision | **Camera** | https://devpost.com/software/mantis-nie02d |
| PrivAds | Reka: Best Use of Reka | Privacy-first AI ad network | Reka | — | https://devpost.com/software/aura-e1marq |
| Argus | Conway: Most Data-Intensive; A37: Best Use of A37 | AI video surveillance with instant threat detection and search | Computer vision, streaming | **Camera** | https://devpost.com/software/argus-w6i0pv |
| InSight | Conway: Most Data-Intensive | Meta Ray-Bans record your interactions to build an AI clone of you | Meta Ray-Ban | Camera + audio | https://devpost.com/software/insight-vyfj5z |
| DIAL(\*) | Rox; Conversion; Crater: Play-Do | "How we booked an SF luxury hotel for $158" | Rox, Conversion | Voice _(inf.)_ | https://devpost.com/software/dial-4rqzc3 |
| Onboardly | Conversion: Best Use of Conversion | Automated onboarding and training with real-time coaching | Conversion | — | https://devpost.com/software/onboardly-3bp9gt |
| PitchLab | Rox: Best Use of Rox | Generates mock sales-pitch calls for practice | Rox | Voice | https://devpost.com/software/pitchlab-clxhuj |
| Curserve | Crater: Play-Do Prize | Server-side engine for agentic coding | — | Text | https://devpost.com/software/curserve |
| Iris | Crater: Play-Do Prize | "Changing lives, one blink at a time" | — | **Eye blink (camera)** _(inf.)_ | https://devpost.com/software/iris-ojrmnv |
| Poke SDR | Lava: Best Use of Lava Gateway | Sales assistant you text like a coworker; 6 MCP tools | Lava, MCP | Text | https://devpost.com/software/poke-sdr |
| Why waste time say lot word… | Lava: Best Use of Lava Gateway | Real-time conversation assistant with suggested replies and emotion analysis | Lava | Voice | https://devpost.com/software/why-waste-time-say-lot-word-when-few-word-do-trick |
| Githired | Composio: Best Use of Toolrouter | Judges developer skill from real GitHub activity | Composio | Data | https://devpost.com/software/githired |
| AdSensei | Creao: Best MCP Integration | Scores ads and suggests fixes | Creao, MCP | Image | https://devpost.com/software/adsensei-3vmh4n |
| AI-Powered Food Bank Management System | Creao: Best Designed Web App | Turns any phone into an intake scanner with live inventory | Creao | Camera (scan) | https://devpost.com/software/foodbank-automation |
| Tapped In | Creao: Best Real-World Productivity Tool | Real-time map of nearby community events | Creao | — | https://devpost.com/software/tapped-in |
| Sweet by Metabolic Company | Interaction Co.: Best MCP Automation | Diabetes-management assistant inside iMessage | Interaction (Poke), MCP | Text | https://devpost.com/software/sweet-by-metabolic-company-of-calhacks |
| RecallMe | Letta: Stateful AI Agent | Lecture chatbot that follows class live and remembers context across lectures | Letta | Voice/audio | https://devpost.com/software/temp-031caq |
| Clanker Town / darwin. / legendIDE / Mentora / PaperTrail | Letta: Honorable Mention | [one-liners not retrieved] | Letta | — | https://devpost.com/software/clanker-town · https://devpost.com/software/darwin-w6fez0 · https://devpost.com/software/legendide · https://devpost.com/software/planevent · https://devpost.com/software/papertrail-ydwm46 |
| Artki.tech | Chroma: Best AI App using Chroma | Learns your taste and renders 3D rooms from Amazon products | Chroma | Text/image | https://devpost.com/software/artki-tech |
| Fish Persuasion | fish.audio: Best Use of Fish Audio | Game: talk fish into leaving the pond | Fish Audio | Voice | https://devpost.com/software/fish-persuasion |
| Jade.AI | Groq: Best Use of Groq | "Cursor for data analysis" | Groq | Text | https://devpost.com/software/jadeai |
| CleanGetaway | JanitorAI: Functional, Novel & Fun | Multiplayer AI NPCs with shared memory | JanitorAI | Text | https://devpost.com/software/cleangetaway |
| Love Island: To Die For! | JanitorAI: Functional, Novel & Fun | Murder-mystery dating-show game | JanitorAI | Text | https://devpost.com/software/love-island-to-die-for |
| Jarvis | Most Wacky Hack (Wordware) | "Know everything" | Wordware | — | https://devpost.com/software/jarvis-0xt8ro |
| Salient Labs | Baseten: Best Use of Open Source Models | "Sharper where it matters" | Baseten | — | https://devpost.com/software/salient-9ohv4q |
| merj | CodeRabbit: Best Use of CodeRabbit | Merge-conflict copilot | CodeRabbit, Claude | Code | https://devpost.com/software/merj |
| PotBot | SnapDev | Turns one photo into civic action (e.g. pothole reports) | — | **Camera** | https://devpost.com/software/potbot |
| Calendera | [MLH] Best Use of AI (Reach Capital) | AI organizer for your messaging platforms | — | Text | https://devpost.com/software/clarity-joixz0 |
| I-IMO | [MLH] Best Use of DigitalOcean Gradient AI | In-person meeting-organizer agent | DigitalOcean Gradient | Voice | https://devpost.com/software/i-imo |
| Remixify | [MLH] Best Use of Gemini API | "Don't scroll Reels, scroll Remixify" | Gemini | Video | https://devpost.com/software/remixify |
| Roominate | [MLH] Best .Tech Domain | Breaks tasks into steps; rewards you with home décor | — | Text | https://devpost.com/software/roominate-vp1aqu |

**Probably winners, prize not captured [unverified]:**
- Guardian: AI-powered Scam and Fraud Prevention (blocks suspicious charges before they hit your account; voice alerts, merchant intelligence). It appears in Devpost's `?page=2&winners=true` search snippet with a "Winner" badge, but which prize it won is not visible. https://devpost.com/software/guardian-ai-powered-fraud-prevention-for-your-money
- These sit among the winners in Devpost's default (winners-first) gallery order but have no badge in the mirror: Agora https://devpost.com/software/agora-165spb · elle https://devpost.com/software/elle · MediSnap https://devpost.com/software/medsnap-2ysgxk · PeerFund https://devpost.com/software/r-fund · MedChain https://devpost.com/software/medchain-s7dz60 · Jarvis (voice operator) https://devpost.com/software/jarvis-an-agentic-voice-assistant-that-does-things-for-you · Research Compass https://devpost.com/software/research-compass · TrustBuddy https://devpost.com/software/trustbuddy · Sublytics https://devpost.com/software/sublytics-h3ks70

**Prizes listed on live.calhacks.io with no winner found:** Best Use of Annapurna; Data Visualization Agent; Best Use of Cofoundry; Ethereum main prize (only honorable mentions found); LiveKit Most Complex / Technically Challenging.

---

## 2. UC Berkeley AI Hackathon 2026: June 20–21, 2026, MLK Jr. Student Union (≈$96.7k in prizes, 1,097 participants, 400 projects)
Devpost: https://ai-hackathon-2026.devpost.com/ (winners announced in https://ai-hackathon-2026.devpost.com/updates/44683-and-the-winner-is).
The top prizes were four "Ddoski" Grand Prize tracks (Lab, World, Toolbox, Playground) plus a SkyDeck Grand Prize.

### 2a. Grand prizes, finalists and organizer awards
| Project | Prize(s) | What it does | Tech / sponsor tools | Input | URL |
|---|---|---|---|---|---|
| Theracat | **GRAND PRIZE – Lab Track; SkyDeck Grand Prize Winner; Finalist** | Wristband plus plush cat: spots rising anxiety from wrist motion and responds **before the panic peaks** with paced haptic breathing, a talking cat with moving ears, and routing to the 988 crisis line | ESP32, MPU6050 IMU over BLE, moving-average filter → FFT/statistical features → Random Forest, haptic motor, servo ears, Claude, ElevenLabs | **Sensor (IMU)** + voice | https://devpost.com/software/theracat |
| Lucid Voice | **GRAND PRIZE – World Track; Finalist** | For people who can't speak: a few taps become a full sentence in their own cloned voice; runs offline on the device | Kuzu knowledge graph, Gemma via MLX, XTTS voice cloning, Whisper, Redis, Deepgram, Sentry, Claude Code | Touch + voice | https://devpost.com/software/lucid-voice |
| IronBook | **GRAND PRIZE – Toolbox Track; Finalist** | Phone photos of a machine become a 3D model; a Claude agent flies the camera to answer factory-floor questions | COLMAP, msplat (3D Gaussian splatting), MLX, custom WebGL2 renderer, Claude, Deepgram, Sentry, Langfuse, MongoDB | Camera (photos) + voice | https://devpost.com/software/ironbook |
| Paper Cuts | **GRAND PRIZE – Playground Track; Finalist; Best UI/UX** | Draw on an iPad and the doodle becomes a working object in a live multiplayer fighting game | tldraw, FastAPI, CNN + VLM recognition, Redis vector search, SD/SDXL + InstructPix2Pix trained on AWS Trainium, Pika via fal.ai | Drawing + phones | https://devpost.com/software/paper-cuts |
| Inspector | Finalist; Hacker's Choice Award | Multi-agent computer-use QA testing | — | Screen | https://devpost.com/software/inspector-23ser6 |
| FirstResponder-Relay | Finalist | During wildfires, triages overflow 911 calls in 13+ languages, locates callers inside fire zones, translates both ways | FastAPI, Next.js (claimed; no write-up submitted) | Voice calls | https://devpost.com/software/firstresponder-relay |
| Percept | Finalist | Improves short videos using Meta TRIBE v2's predicted brain engagement as the score | Meta TRIBE v2, generative video | Video | https://devpost.com/software/cerebra-diqop9 |
| Sentinel | Finalist | AI security engineer: proves vulnerabilities with simulated attacks and ships fixes | — | Code | https://devpost.com/software/sentinel-poyh3v |
| SnapCycle | Finalist | "Recycle like a smart person" | — | Camera _(inf.)_ | https://devpost.com/software/rrr-s98zwc |
| StudForge | Finalist | Natural-language prompts → physics-checked, buildable swarm-robotics block worlds | — | Text | https://devpost.com/software/studforge |
| Workbench | **Most Technical Hack** | **Cancer**: upload a tumor's mutation profile, get a pathway graph and drug match; an ML fallback trained on DepMap lung-cancer data | Neo4j, KEGG, DepMap CRISPR + mutation data, multi-agent pipeline, server-sent events | CSV data + text | https://devpost.com/software/workbench-107jf2 |
| Fizz Buzz | Most Berkeley Hack | Roommate confrontation simulator | — | Voice/text _(inf.)_ | https://devpost.com/software/fizz-buzz |
| MarketVerse | Best Beginner Hack | AI agents play customers, competitors and investors to simulate 24 months of a startup | — | Text | https://devpost.com/software/marketverse-zgjmlv |
| ImmunoVerse | Best Solo Hack | Agents run patient-specific safety screens for gene therapies | — | Data | https://devpost.com/software/immunoverse-composable-in-silico-gene-therapy-screening |

### 2b. Sponsor prizes
| Project | Prize(s) | What it does | Tech / sponsor tools | Input | URL |
|---|---|---|---|---|---|
| Vanguard Telematics | Fetch AI: Best Use of Agentverse; **Best Use of QNX** | **Early warning** for fire trucks: live vehicle sensors and camera, 3D dashboard, agents detect crashes and write incident reports | Raspberry Pi 5 on QNX, Nucleo sensor board (accelerometer, vibration, temperature, pressure), proximity sensor, camera, Redis, Fetch.ai uAgents, per-sensor baseline + **multi-sensor z-score trigger** (alerts only when several sensors spike together), LLM write-up | **Sensors** + camera | https://devpost.com/software/vanguard-telematics |
| SafeTank | **Best Use of QNX** | **Predictive** chemical-tank safety: watches gas, temperature, humidity and vibration; alerts and maintenance forecasts on a dashboard | Raspberry Pi, MQ-2 gas sensor, temp/humidity sensor, vibration sensor, QNX RTOS, on-device prediction model | **Sensors** | https://devpost.com/software/safetank |
| MOGGIE | Best Use of QNX; Most Creative Use of Pika | Computer-vision arcade game for 1v1 battles based on viral trends, on a Raspberry Pi | QNX, Raspberry Pi, computer vision, Pika | **Camera** | https://devpost.com/software/moggie |
| baymax | Fetch AI: Best Use of Agentverse | Hospital agents use **weather, disease and inventory data** to move supplies between hospitals **before crises peak** | Fetch.ai, Claude | Data feeds | https://devpost.com/software/baymax-1wumi3 |
| LifeLink | Fetch AI: Best Use of Agentverse | Clinicians request blood in plain English; agents find units, allocate them, pay and prove delivery | Fetch.ai, ASI:One | Text | https://devpost.com/software/lifelink-soibwr |
| CareLoop | Fetch AI: Best Use of Agentverse | Voice-first healthcare concierge: triage, provider search, cost, booking | Fetch.ai | Voice | https://devpost.com/software/careloop-gsiy8w |
| Fetch Health | Fetch AI: Best Use of Agentverse | Assistant for organ transplants | Fetch.ai | Text | https://devpost.com/software/fetch-health |
| Constructa | Fetch AI: Agentverse; Best Use of Browserbase | Building-site evaluation, visualization and permit paperwork | Fetch.ai, Browserbase | Text/maps | https://devpost.com/software/constructa |
| AeroFreight AI | Fetch AI: Best Use of Agentverse | Plans international shipments by air or sea | Fetch.ai | Text | https://devpost.com/software/aerofreight-ai |
| AgriBroker | Fetch AI: Best Use of Agentverse | Agents negotiate and pay for farm produce | Fetch.ai | Text | https://devpost.com/software/agribroker |
| Quorum | Fetch AI: Best Use of Agentverse | Stops one agent's hallucination from spreading through a multi-agent system | Fetch.ai ASI:One | Text | https://devpost.com/software/quoram |
| AxisGen | Best Physical AI Hack (UFB) | One robot-task prompt → many simulation-ready variants for training data | — | Text | https://devpost.com/software/axisgen |
| Omniscient | Best Physical AI Hack (UFB) | Vision model watches a robot fleet, flags failures, operator teleoperates by hand tracking | VLM, hand tracking | **Camera** | https://devpost.com/software/ribbit-rtnfvg |
| Robo Jab | Best Physical AI Hack (UFB) | Phone video in, fighting humanoid out: markerless motion capture to a Unitree G1 | Unitree G1, simulation-trained balance | **Camera (video)** | https://devpost.com/software/robo-jab |
| SafeStreets | Best Use of Claude | Spots street hazards in imagery, backs them with city data, and drafts the fix, funding and official to contact | Claude | **Camera/imagery** | https://devpost.com/software/safestreets-h6yprx |
| Aside.ai | Best Use of Deepgram | Wearable that narrates your day out loud in any personality | Deepgram | Camera + voice | https://devpost.com/software/aside-ai |
| BrailleAI | Best Use of Orkes | Deafblind users type by touch to speak and feel replies as Braille, including the speaker's emotion | Orkes, refreshable Braille hardware | **Touch hardware** + voice | https://devpost.com/software/brailleai-a-two-way-voice-for-the-deafblind |
| Pulse AI | Best Use of Orkes; TokenRouter (PaleBlueDot AI) | Verified real people answer your medical questions; the agent waits for them instead of guessing | Orkes, TokenRouter | Text | https://devpost.com/software/pulse-ai-ub9lxt |
| 311.ai | TokenRouter (PaleBlueDot AI) | Voice-to-dispatch for city 311 non-emergency calls in under a minute | Multi-agent, ML priority scoring | Voice | https://devpost.com/software/311-ai |
| Retention | TokenRouter (PaleBlueDot AI) | Edits educational videos for retention using Meta's brain-simulation model | — | Video | https://devpost.com/software/retention |
| Accordion | Best Compression Model (The Token Company) | Context management to replace /compact | — | Text | https://devpost.com/software/accordion-jwarge |
| Re:Compress | Best Compression Model (The Token Company) | Query-aware compression distilled into a 1.5B model | — | Text | https://devpost.com/software/re-compress |
| AlphaResearch | Best Use of Cognition | Recursive sandboxed agents for autonomous research | Cognition/Devin | Text | https://devpost.com/software/alpharesearch-9fwk4m |
| BrowserDelta | Best Use of Cognition | Cuts browser-agent context by about 78% | Cognition | Screen | https://devpost.com/software/browserdelta |
| Refactorika | Best Use of Cognition | Agent harness for refactoring codebases | Cognition | Code | https://devpost.com/software/refactorika |
| Narcore | Best Use of Browserbase | Undercover agent that intercepts online drug ads | Browserbase | Web | https://devpost.com/software/narcore |
| Traide | Best Use of Browserbase | Text a photo; it lists, prices and negotiates your sale | Browserbase | Camera + text | https://devpost.com/software/traid-h6db5a |
| Captain Ddoski | Best Use of Terac | **Fintech**: trust scores and scam flags for AI finance agents' sources | API/MCP | Text | https://devpost.com/software/captain-ddoski |
| MatchVision | Best Use of Terac | Live sports for blind and low-vision fans | — | Video | https://devpost.com/software/match-vision |
| RESELLER. | Most Creative Use of Pika | End-to-end reselling agent | Pika | — | https://devpost.com/software/reseller-mkjlfg |
| Senya | Most Creative Use of Pika | Music you can feel, see and sign | Pika | Audio | https://devpost.com/software/senya |
| Canary | Best Use of Sentry API | Catches silent bugs, fixes them and writes regression tests | Sentry | Code | https://devpost.com/software/agi-14q6d3 |
| JUGAAD | Best Use of Arize | Insider tips on food, housing and financial aid for Berkeley students | Arize | Text | https://devpost.com/software/jugaad-dpmqi7 |
| Aegis | Best Use of ArmorIQ (Secure Agents) | Real-time 911 dispatch co-pilot: transcribes, translates and spins up agents in mass emergencies | ArmorIQ | Voice | https://devpost.com/software/aegis-jtde8o |
| Tendly | Best Use of Simular | One button lets elderly patients speak a need; Claude triages it into a live feed for caregivers | Simular, Claude | **Button** + voice | https://devpost.com/software/tendly-smolpq |
| Triage | Best Use of Band (agent-to-agent) | Reproduces bugs by actually using your app | Band | Screen | https://devpost.com/software/triage-y10mpq |
| Forge | Redis: Beyond Caching; Best Creativity and Originality; Best Technical Implementation | Safety-net clinics build verified operational tools from plain language | Redis | Text | https://devpost.com/software/forge-z8v4qm |

**[unverified]** Fireflai ("multi-agent AI tool for firefighters") sits among the winners on gallery page 1, but the mirror shows no badge for it. https://devpost.com/software/fireflai

### 2c. Hack for Social Impact 2026
Run by a separate nonprofit, not Cal Hacks. The SF 2026 event is **Oct 24–25, 2026** (the same weekend as Cal Hacks 13) at Wefunder HQ, so **no winners exist yet**.
- It has $1k bounties per problem statement (UNCCD land planning, prison-reentry mindfulness, justice-reform data, BRIDGEGOOD design training) and no grand prize.
- Source: https://www.hackforsocialimpact.com/events/sf-2026. Earlier recaps (SF 2024, SF 2025, Seattle 2026) are linked there; I did not open them.

---

## 3. Cal Hacks 11.0: Oct 2024 (352 Devpost projects), for comparison
| Project | Prize(s) | What it does | Tech / sponsor tools | Input | URL |
|---|---|---|---|---|---|
| Duet: Brainwaves → Live Music | **1st Overall** | Reads live EEG brainwaves and has an AI compose music that follows your emotions; aimed at children with developmental disabilities | Emotiv EEG + Cortex, SingleStore, Gemini as a live "composer", Sonic Pi, Next.js | **Sensor (EEG)** | https://devpost.com/software/duet-0tbkxe · https://stanforddaily.com/2024/11/20/stanford-students-win-cal-hacks |
| GhostWriter | **2nd Overall** | Listens to TA office hours and inserts useful points into the course notes line by line | Reflex, Deepgram live transcription, Gemini embeddings, ChromaDB, Groq Llama-3 | Voice | https://devpost.com/software/ghostwriter-491kuy |
| SnackSnap | **3rd Overall** | Photograph yourself recycling; Gemini checks it and you earn snacks for a digital pet | iOS, Gemini vision | **Camera** | https://devpost.com/software/snacksnap-lw4b9q |
| PulseWalk | **Best Hardware Hack** | Smart shoe for the visually impaired: IR distance sensors drive haptic servos and vibration; GPS navigation in a companion app | ESP32, IR sensors, 5 servos, vibration motors, 10 Ah battery, Google Maps API, Skylo Type1SC (attempted) | **Sensors** | https://devpost.com/software/pulsewalk |
| Resililink | **Hack for Impact**; Skylo 1st | **Disaster communications**: LoRa mesh with a satellite "super node"; messages arrive as SMS with delivery confirmation | ESP32 + LoRa, Skylo satellite, protobufs, MQTT, Azure, Twilio | Text over hardware | https://devpost.com/software/resilink |
| Canary | Skylo: Cellular → Satellite | **Early wildfire detection** sensor network relayed by satellite | Arduino 101 + Grove temperature sensor, ESP8266 WiFi, Monogoto satellite board, Google Cloud UDP server, Streamlit dashboard | **Sensors** | https://devpost.com/software/canary-lrg3ep |
| FRED | Skylo: Cellular → Satellite | Satellite emergency tool that sends GPS, images and voice to responders from remote areas | Skylo | GPS + camera + voice | https://devpost.com/software/fred-bpszwn |
| Autonomous AI Society | Fetch.ai: Agentic Track | Disaster-response agents analyze distress calls, dispatch drones and call rescuers | Fetch.ai | Voice/data | https://devpost.com/software/autonomous-ai-society |
| CLaiM | Hyperbolic: AI Inference Bounty | Auto-files home insurance claims after natural disasters | Hyperbolic | Camera/docs _(inf.)_ | https://devpost.com/software/autoclaim-q8who1 |
| TeachXR | Cal Hacks: Hackers' Choice; Vapi | AI study assistant in extended reality | Vapi, XR | Voice + XR | https://devpost.com/software/teachxr |
| Unreal EngJam | Cal Hacks: Most Entertaining; Warp: Best Dev Tool | A deliberately "cursed" programming language and game engine inside Figma | Figma, Warp | Design canvas | https://devpost.com/software/unreal-engjam |
| MafiAI | Cal Hacks: Hack on AI | Mafia party game played with LLMs | — | Text/voice | https://devpost.com/software/mafiai |
| CryptoWise | SingleStore: Best Real-Time App | **Fintech**: real-time crypto charts and automated trading | SingleStore | Market data | https://devpost.com/software/cryptowise-intelligent-trading-and-insights-platform |
| Guardian Angel | Google: Most Impactful App | "Always by your side" | Google | — | https://devpost.com/software/guardian-angel-op49t2 |

**[unverified]** Talk Tuah (AR glasses that coach you in social situations) and Healora (symptom tracking) sit among the winners in the CH11 gallery order, but the mirror shows no badge. https://devpost.com/software/talk-tuah · https://devpost.com/software/helora

---

## Patterns (10 lines)
1. **Input type:** 3 of the last 4 overall-prize "headliners" used physical sensors: Duet (EEG, CH11 1st), Ted.AI (ESP32 + pulse sensor + IMU, CH12 2nd) and Theracat (ESP32 + MPU6050, AI'26 SkyDeck grand prize). Voice is in almost every top winner.
2. **The winning loop is sense → classify → act.** Theracat steps in "before the panic peaks"; Vanguard alerts only when several sensors spike together against their own baseline; SafeTank forecasts failures. That is your "before it comes" pitch, already proven.
3. **Domain:** health, wellbeing and accessibility win the overall prizes most (Ted.AI, Theracat, Lucid Voice, Duet, PulseWalk, Expungo). Workbench, a cancer project, took "Most Technical" in 2026.
4. **Disaster and early-warning projects win, but mostly sponsor and impact prizes** (Resililink, Canary, FRED, Orion, Vanguard, SafeTank, baymax). FirstResponder-Relay reached finalist but did not take a grand prize.
5. **Fintech almost never wins overall.** It wins sponsor tracks: Sui, XRPL, Visa (Kasha), Elastic (MarketMind), Postman, Terac.
6. **Stacking sponsors pays off:** Haven won 3 prizes, DIAL 3, Vanguard 2 (Fetch + QNX), Resililink 2, Ted.AI 2, Hardware Context Protocol 2, Orion 2. Fetch.ai had winners at all three events (9 Agentverse winners in 2026).
7. **Hardware categories are thin:** each Cal Hacks had exactly one Best Hardware winner. Raspberry Pi + cheap sensors + QNX won the QNX prize twice in June 2026 (SafeTank, Vanguard).
8. **Demo style:** a live physical object you can hold plus a polished real-time dashboard. FaceTimeOS's winner says to assign one person to the UI and demo, and to hardcode a fallback path.
9. **AI agents are expected; the difference is a real-world body.** Wearables, Spectacles, robot arms and plush toys beat chat-only apps for the overall prizes.
10. **Suggested plan [INFERENCE]:** ESP32 + DHT11/thermistor/photoresistor/HC-SR04 → per-sensor baseline z-score anomaly score → Fetch agent + Claude voice alert + web/app dashboard. Pitch it as health or disaster early warning, aimed at Best Hardware + Social Impact + Fetch/Claude prizes. Check Cal Hacks 13.0's actual prize list first; I did not look it up.
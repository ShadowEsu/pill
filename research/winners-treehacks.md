# TreeHacks winners — 2026 & 2025 (research for Cal Hacks 13.0)

Sources: Devpost galleries `https://treehacks-2026.devpost.com/project-gallery?winners=true` and `https://treehacks-2025.devpost.com/project-gallery?winners=true`. Winners are listed first, followed by non-winners: 2026 had 65 winners out of 378 submissions, 2025 had 70 out of 257. Prize names come from each Devpost project page's "Submitted to → Winner" section unless marked otherwise. Also used: Stanford Daily 2026/2025 articles, the Runpod blog, the UNL and Arcadia news pieces, and team sites/repos.
Direct devpost.com requests returned 403. Project pages were read through the markdown.new / r.jina.ai proxies.
Flags: **HW** = hardware · **DIS** = disaster / early warning · **CLIM** = climate/sustainability/energy · **HLTH** = health · **FIN** = fintech/commerce.
"[not checked]" = winner per the gallery, exact prize not confirmed.

## TreeHacks 2026 (Feb 13–15, 2026): about 1,100 hackers, 378 teams, over $500k in prizes

### Top prizes (Grand Prize, Most X, Best Hardware/Beginner)
| Project | Prize(s) | What it does | Tech / sponsor tools | Input | Flags | URL |
|---|---|---|---|---|---|---|
| Shepherd | Grand Prize 1st ($12k) + OpenEvidence Healthcare Track Grand Prize + OpenEvidence Best Use of Clinical Info | Motorized smart cane that physically steers blind users around obstacles; GPS voice turn-by-turn | XIAO ESP32-S3 + DC motor + omniwheel, iPhone LiDAR/ARKit, BLE packets at 10 Hz, Vision framework, Vapi voice, OpenRouteService wheelchair routing, Google Geocoding | Sensor (LiDAR depth) + camera + GPS + voice | HW, HLTH | https://devpost.com/software/raising-cane |
| Robosurge | Grand Prize 2nd ($8k) | "Cursor for surgery": one remote surgeon commands 4 robot arms by natural language plus VR head tracking | Intel RealSense, ArUco, custom inverse kinematics, SAM + YOLOv11, ASUS Ascent GX10, GPT-5.2 + Gemini Robotics-ER, Meta Quest 3, Lean proofs, Nix | Camera (depth) + VR + voice/text | HW, HLTH | https://devpost.com/software/we-use-nix |
| ChromaChord | Grand Prize 3rd + Suno Best Musical Hack | Real-time chord suggestions from 24-D chroma vectors, plus track generation | Python, Suno, Perplexity, Vercel | Audio | — | https://devpost.com/software/chromachord |
| diffuji | Most Creative + Neo "Most Likely to Become a Product" | Diffusion-powered instant camera | Raspberry Pi, Python | Camera | HW | https://devpost.com/software/diffuji |
| Freak in the Sheets | Most Technically Complex + Human Capital Fellowship ($50k/person) | LLVM backend that compiles code to a spreadsheet | C/C++, LLVM, JS | Text (code) | — | https://devpost.com/software/freak-in-the-sheets-7jl542 |
| Mira | Most Impactful + OpenAI AI Track (1st per team repo github.com/nathanjzhao/treehacks2026) | Eldercare assistant on Ray-Ban Meta glasses: 3D scene reconstruction, finds lost objects, alerts caregivers | Gemini, GPT-5-mini, Grounded-SAM-2, YOLOv8, Perplexity Sonar, Supabase, Twilio, WebRTC, Google Cloud | Camera + voice | HLTH, HW (wearable) | https://devpost.com/software/mira-w65b0a |
| Sentinel | Best Hardware Hack | Full-stack AI for bare-metal embedded systems; shipped a bare-metal OS on a Raspberry Pi in 24 h | Claude Agent SDK / Claude Opus, RPi Zero W, arm-none-eabi-gcc, C, Next.js | Text → hardware | HW | https://devpost.com/software/sentinel-c8ki50 |
| HeartStart | Best Beginner Hack (Devpost); team site chilinghan.github.io says "Grand Prize" [conflict] | Wearable heart-rate monitor detects a flatline → Twilio call to EMS → robot drives to the patient and does CPR | Arduino + BLE heart-rate sensor, PySerial, Python dashboard, Twilio, ROS2 on Raspberry Pi, Arducam, OpenCV, AprilTag | Sensor (heart rate) + camera | HW, HLTH, DIS (early warning) | https://devpost.com/software/heartstart |

### Track prizes
| Project | Prize(s) | What it does | Tech / sponsor tools | Input | Flags | URL |
|---|---|---|---|---|---|---|
| ShadowGuard | OpenEvidence Healthcare Track Grand Prize (co-winner with Shepherd) | Network-layer AI firewall that redacts patient data before it leaves the hospital | mitmproxy, OpenAI, Vapi, D3, Node | Network traffic / text | HLTH | https://devpost.com/software/shadowguard-l6yv7p |
| VisionOS | OpenAI AI Track (place not shown) | Lets blind people code | Electron, LangGraph, Elasticsearch, Perplexity, Stagehand, Agentverse | Voice | HLTH (accessibility) | https://devpost.com/software/visionos-5euxo7 |
| ContainOS | OpenAI AI Track (place not shown) | Physics-grounded multi-agent copilot for wildfire containment | OpenAI/GPT-4o, Gemini, Leaflet maps, FastAPI, WebSockets | Map/geo data + text | DIS, CLIM | https://devpost.com/software/containos |
| Project Lend | Anthropic Human Flourishing | Autonomous AI + robotics food bank; moved 50+ lb of food to shelters during the event | Poke, Warp, Python/React | Text + robotics | (HW-ish) | https://devpost.com/software/project-lend |
| Tribune | Anthropic Human Flourishing | "GitHub for democracy": every policy change cited to a voice | Claude, OpenAI Realtime, Gemini, Elasticsearch, Mapbox, Twilio | Voice + text | — | https://devpost.com/software/tribune |
| Bloom | Anthropic Human Flourishing + Decagon Best Conversation Assistant | AI caretaker that keeps seniors independent and connected to family | OpenEvidence, React Native, MongoDB, Vercel AI Gateway, v0 | Voice | HLTH | https://devpost.com/software/bloom-dvjpea |
| Mirage | Modal Inference Track | Synthesizes 3D world-model training data for hard scenes (e.g. driving in hail) | Modal, Python | Generated 3D/video | — | https://devpost.com/software/synsplatt |
| ShotSpot | Modal Inference Track + Bright Data | Search inside videos to build training sets | Modal, Whisper, MongoDB, React | Video | — | https://devpost.com/software/shotspot-kfvp1n |
| jiggle wiggle | Modal Inference Track + Zoom x Render | AI movement/dance coach, "any move, any coach" | Modal, Zoom SDK, Render, Perplexity | Camera | HLTH (fitness) | https://devpost.com/software/jiggle-wiggle |
| GridVeda | Stanford Ecopreneurship – Best prototyping process | Predictive failure detection for 20 power transformers at the edge, with health scores and plain-language diagnostics | NVIDIA Jetson Nano, Nemotron, gpt-oss, Perplexity Sonar, three.js | Sensor telemetry | CLIM (grid), DIS (early warning), HW | https://devpost.com/software/gridveda |
| Morro | Stanford Ecopreneurship – Best broader context | "Geoengineering OS": predicts natural disasters and picks cloud-seeding interventions | NVIDIA Earth2Studio, GraphCast, Gemini, random forest, xarray/zarr, v0/Vercel, Warp | Weather data | DIS, CLIM | https://devpost.com/software/morro |
| ZoneZero | Stanford Ecopreneurship (per Stanford Daily) [unverified: not seen in the winners gallery] | — | — | — | CLIM? | https://stanforddaily.com/2026/02/15/12th-annual-treehacks/ |
| Mobius | YC "Iconic YC Company" + Modal Sandbox | Long-running autonomous agent that builds a company end to end | Modal sandboxes | Text | — | https://devpost.com/software/mobius-the-first-ai-agent-to-build-a-unicorn |
| TradeProof | YC "Iconic YC Company" | AI-native infrastructure for blue-collar trade work | — | Text | — | https://devpost.com/software/tradeproof |
| aesthetica | YC "Iconic YC Company" | Gesture on Meta glasses turns any outfit into products and a taste profile | Meta glasses | Camera + gesture | FIN (commerce) | https://devpost.com/software/aesthetica |
| HireUp | YC "Iconic YC Company" | Applicant matching with agents plus a TikTok-style recommender | — | Text | — | https://devpost.com/software/hireright |
| Zeta | YC "Iconic YC Company" | "Grammarly for math" | — | Text | — | https://devpost.com/software/zeta-jwq9te |
| evolve(browser) | YC "Iconic YC Company" | Self-modifying browser | — | Text | — | https://devpost.com/software/evolve-browser |
| Hellocare | Google Cloud AI Track | Schedules doctor visits and turns medical paperwork into clear next steps for older people | Firebase, Claude, OpenAI, Next.js | Text/docs | HLTH | https://devpost.com/software/hellocare |
| Bye! Buy! | Google Cloud AI Track + Browserbase Stagehand | Agents cross-list your items, negotiate, and guarantee instant payment | Stripe, Browserbase, OpenAI, SQLite | Text | FIN | https://devpost.com/software/bye-buy |
| TORQ | NVIDIA Edge AI Track | Retrofits any car into a self-driving vehicle with Jetson Thor | Jetson Thor, CUDA, Holoscan, MQTT, Swift | Camera/sensors | HW | https://devpost.com/software/torq |
| Sprout | NVIDIA Edge AI Track | Mini robot microfarm | Arduino, Jetson Nano, GPIO/I²C, Ollama/Qwen, CUDA | Sensors | HW, CLIM | https://devpost.com/software/greenguardian-microfarm |
| Detour | NVIDIA Edge AI Track | On-board AI agents that steer satellites away from orbital debris | NVIDIA edge | Telemetry | — | https://devpost.com/software/detour-64kpds |
| CalTrack | NVIDIA Edge AI Track | Predicts disaster impact and affected areas, coordinates faster emergency response | NVIDIA Earth2Studio, PyTorch, FastAPI, Docker | Camera feeds + weather data | DIS | https://devpost.com/software/caltrack-i0pq3n |
| Minerva | Zoom Education Track 1st + HeyGen Best Avatar API (UNL/Arcadia news; Devpost not read) | Live HeyGen avatar tutor inside Zoom that draws visualizations in real time | Zoom, HeyGen | Voice + video | — | https://devpost.com/software/minerva-3sj6z0 |
| Prereq | Zoom Education Track | Real-time knowledge graphs of a lecture | Zoom | Audio | — | https://devpost.com/software/prereq-sg1thw |
| TA-DA | Zoom Education Track | AI TA inside Zoom that detects confusion and generates concept cards | Zoom | Audio/video | — | https://devpost.com/software/ta-da-intelligent-teaching-assistant |

### Sponsor challenge prizes
| Project | Prize(s) | What it does | Tech | Input | Flags | URL |
|---|---|---|---|---|---|---|
| RepoRx | Runpod Best use of Flash, 1st (Runpod blog) | Finds FDA-approved drugs that could be repurposed for cancer, using GPU DiffDock docking | Runpod Serverless, DiffDock | Data | HLTH (cancer) | https://devpost.com/software/molecule-mcbob |
| NeuroBlocks | Runpod 2nd | Drag-and-drop neural-network builder | PyTorch on Runpod | GUI | — | https://devpost.com/software/neuroblocks-cz7n9k |
| HackOverflow | Runpod 3rd (tie) + Fetch.ai prize (Stanford Daily) | Stack Overflow for AI agents | Runpod Flash, Fetch.ai Agentverse | Text | — | https://devpost.com/software/hackoverflow-stack-overflow-for-ai-agents-at-hackathons |
| ADapt | Runpod 3rd (tie) | One video ad → localized variants for every market | Runpod | Video | — | https://devpost.com/software/adapt-ujvn5e |
| RescueRX | OpenEvidence Best Use of Clinical Information | Finds drugs shelved for business reasons and matches them to diseases | Knowledge graph, ML | Data | HLTH | https://devpost.com/software/rescuerx |
| Monolith | Modal Sandbox | Shared coding-agent context ("RLMs") | Modal | Text | — | https://devpost.com/software/monolith-z10684 |
| Longshot | Modal Sandbox | 100+ coding agents built Minecraft in one shot | Modal | Text | — | https://devpost.com/software/longshot |
| Sunday | Anthropic Best Use of Claude Agent SDK | Group-chat agent that plans dinners, orders groceries, books restaurants | Claude Agent SDK | Text | — | https://devpost.com/software/sunday-94odas |
| Keryx | Human Capital Fellowship | Drones map real buildings into world models that assistive agents can navigate | Drones, Apple Depth Pro, Qwen-VL, Modal, vLLM | Camera (drone) | HW, HLTH (accessibility) | https://devpost.com/software/keryx-k49dta |
| OnTab | Human Capital Fellowship | "Cursor Tab for everything" | — | Text | — | https://devpost.com/software/ontab |

### 2026 winners, prize [not checked]
| Project | What it does (tagline) | Input | Flags | URL |
|---|---|---|---|---|
| CareLink | Voice AI with RAG clinical reasoning that catches post-surgical complications and alerts providers before symptoms escalate | Voice | HLTH, DIS (early warning) | https://devpost.com/software/carelink-k1pzeh |
| 4sight | Biometric + visual monitoring that predicts when you're prone to bad decisions and triggers interventions | Sensor (biometric) + camera | HLTH, HW | https://devpost.com/software/4sight-neoslb |
| .dot | Agent-based in-home care for the elderly (charts, meds, emergency contacts) | Voice (speech-to-speech) | HLTH | https://devpost.com/software/dot-bringing-humanity-to-in-home-care |
| Mira Mira on Da Wall | AI smart mirror for what to wear and buy | Camera | HW, FIN (commerce) | https://devpost.com/software/mira-3xqlos |
| Voider | Voice-first shopping brain with cross-platform price comparison and agent-made payments | Voice | FIN | https://devpost.com/software/voider |
| kiru | Voice agent that calls companies and negotiates your bills down | Voice | FIN | https://devpost.com/software/kiru |
| AgentPlace | AI-native marketplace that haggles for you | Text | FIN | https://devpost.com/software/agentplace |
| Maestro | Turns an everyday object into infinite instruments | Camera/audio | (HW?) | https://devpost.com/software/maestro-n0uqyz |
| Gallop | Multi-agent cybersecurity control platform | Logs | — | https://devpost.com/software/gallop |
| Edamame | AI clones for organizational memory | Text | — | https://devpost.com/software/m-4f2iwy |
| aimogus | Can agents deceive/deduce in multi-agent systems? | Text | — | https://devpost.com/software/aimogus |
| Power Lever | Agentic inference optimization (saves water/compute) | — | CLIM-ish | https://devpost.com/software/power-lever |
| Concierge | Two Poke agents + Browserbase find and buy the perfect gift | Text | FIN | https://devpost.com/software/concierge-1tjlf5 |
| The Orchestration Company of Palo Alto | "OS of tomorrow, Claude Code of today" | Text | — | https://devpost.com/software/the-orchestration-company-of-palo-alto |
| HIVE | Swarm of parallel computer-use agents | Text | — | https://devpost.com/software/hive-swarm-intelligence |
| Snappier | Record a workflow once; AI automates it | Screen video | — | https://devpost.com/software/snappier |
| Arena | Agents compete to write your software | Text | — | https://devpost.com/software/arena-lz2m84 |
| NextOp | AI coach translating military careers to civilian résumés | Text | — | https://devpost.com/software/nextop |
| Tonguekeeper | Agents compile endangered-language atlases | Text | — | https://devpost.com/software/tonguekeeper |
| Synapse | Claim-level truth forensics (Perplexity Sonar + Claude + Semantic Scholar) | Text | — | https://devpost.com/software/a-p1lt2h |

## TreeHacks 2025 (Feb 14–16, 2025): about 1,000 hackers, over $200k in prizes
Tracks that year: Education, Healthcare, Sustainability, Edge AI, Web3, Autonomy. Grand Prize 1st was $11k; 2nd was $7.5k.
Prize names below are verified only where a source is given. The rest are [not checked], because Devpost project pages blocked direct reads and you asked me to stop before I could read them through the proxy. Modalities are guessed from the taglines.

| Project | Prize(s) | What it does | Input | Flags | URL |
|---|---|---|---|---|---|
| HawkWatch | **Grand Prize ($11k)** (Stanford Daily) | Turns any camera into a smart security system; a vision-language model flags crimes and life-threatening events | Camera | DIS (alerting) | https://devpost.com/software/hawkwatch |
| OmNom | **Most Creative** (Stanford Daily) | Autonomous robot that fetches late-night food across campus | Camera/sensors | HW | https://devpost.com/software/omnom-hg16v3 |
| BlinkAI | **Best Beginner** (Stanford Daily) | Blinked Morse code → text → AI prompts | Camera | HLTH (accessibility) | https://devpost.com/software/blinkai |
| Iris | **Edge AI Prize** (Devpost search snippet; which Edge AI prize is unclear) | Real-time vision for the blind | Camera | HLTH, HW | https://devpost.com/software/iris-vlnzp0 |
| HiveMind | **Education Grand Prize** (NIU news) | "Second brain" for smarter learning | Text | — | https://devpost.com/software/hivemind-18cula |
| Hearti | [not checked] | Congenital heart disease diagnosis/treatment planning with CV + VLMs | Medical images | HLTH | https://devpost.com/software/hearti |
| Edith | [not checked] | "Second pair of eyes" for accessibility | Camera | HLTH | https://devpost.com/software/edith-bvh014 |
| BrailleBot | [not checked] | Braille printer under $15 | Hardware | HW, HLTH | https://devpost.com/software/readable-ai-braille-printer |
| SurviveX | [not checked] | Hands-free on-device LLM survival assistant | Voice | DIS, HW (edge) | https://devpost.com/software/survivex |
| PUSHPA | [not checked] | Smart glasses steer drones for real-time wildfire mitigation (optical + UAV, edge compute) | Camera (drone/glasses) | DIS, CLIM, HW | https://devpost.com/software/pushpa-pyro-uav-system-for-high-risk-patrol-and-alerting |
| MediLedger | [not checked] | Privacy-preserving drug availability search (EigenDA, ZK) | Text | HLTH, FIN (web3) | https://devpost.com/software/mediledger |
| AgentZero | [not checked] | Verifiable autonomous AI trading agent | Market data | FIN | https://devpost.com/software/agentzero |
| ECGo | [not checked] | Wi-Fi mobile ECG with AI diagnosis and remote storage | Sensor (ECG) | HW, HLTH | https://devpost.com/software/ecgo |
| Therms | [not checked] | Thermoregulation wearable with AI insights | Sensor (temp) | HW, HLTH | https://devpost.com/software/therms-thermoregulation-wearables-with-ai-powered-insights |
| Project AVIA | [not checked] | Health data to improve fighter-pilot performance | Biometric sensors | HLTH | https://devpost.com/software/project-avia-autonomous-vigilance-insights-for-aviation |
| VisionGuard | [not checked] | In-car video → detects unsafe driver behavior | Camera | DIS (safety) | https://devpost.com/software/visionguard-smart-vision-for-smarter-driving |
| ERWIN | [not checked] | Carbon-removal assessment for enhanced rock weathering / carbon credits | Data | CLIM, FIN | https://devpost.com/software/erwin-enhanced-rock-weathering-impact-navigator |
| BAS Climate Action Matcher | [not checked] | Matches companies to climate actions | Text | CLIM | https://devpost.com/software/bas-climate-action-matcher |
| Lemon | [not checked] | Bargain-produce marketplace to cut food waste | Text | CLIM, FIN | https://devpost.com/software/lemon-7gn5hq |
| Ranger | [not checked] | Wearable AR that visualizes sound for deaf users | Audio (mic array) | HW, HLTH | https://devpost.com/software/ranger-6jkv5s |
| WiiWork | [not checked] | Agent-first website design | Text | — | https://devpost.com/software/wiiwork-8u1x62 |
| Portable Braille | [not checked] | Device for practicing Braille | Hardware | HW, HLTH | https://devpost.com/software/portable-braille-cdq8v5 |
| CyberDrive | [not checked] | Driving footage → insights | Video | — | https://devpost.com/software/cyberdrive |
| HorizonX | [not checked] | On-device VLM haptic guide for blind users + crowdsourced public-safety data | Camera | HW, HLTH | https://devpost.com/software/horizonx |
| WingNote | [not checked] | Smart hardware + AI documentation for nurses | Audio | HW, HLTH | https://devpost.com/software/wingnote |
| Lumora | [not checked] | Assistant marketplace; quizzes from Zoom class | Audio | — | https://devpost.com/software/lumora |
| Noteworthy | [not checked] | Lecture speech → live visualizations | Audio | — | https://devpost.com/software/noteworthy-visualize-capture-remember |
| FlowPilot | [not checked] | Zoom meetings → slides/Notion actions | Audio | — | https://devpost.com/software/flowpilot-zoom-agent-that-automates-your-workflows |
| ZoneOut | [not checked] | Real-time lecture Q&A buddy | Audio/video | — | https://devpost.com/software/zoneout-atz5pe |
| BEF | [not checked] | Team wearable data → arrhythmia detection, ECG reconstruction | Sensor (wearable) | HLTH, DIS | https://devpost.com/software/beef-xk5pif |
| WatchDog AI | [not checked] | Anti-rug-pull agent for memecoins | Chain data | FIN | https://devpost.com/software/watchdog-ai |
| Cipher Shield | [not checked] | Anti-discrimination via blockchain + homomorphic encryption | Text | FIN (web3) | https://devpost.com/software/cipher-shield |
| The Giving Tree | [not checked] | AI-agent crypto donation platform | Text | FIN | https://devpost.com/software/the-giving-tree-x0a5hk |
| Moods and Metrics | [not checked] | Mood analysis from audio/video/transcript | Camera + voice | HLTH | https://devpost.com/software/moodmap-ai |
| Vigilante | [not checked] | Misinformation flagging + global dashboard | Text | — | https://devpost.com/software/vigilante-xkf7s9 |
| Superclassroom | [not checked] | Adaptive content for students with disabilities | Text | — | https://devpost.com/software/superclassroom |
| Verify | [not checked] | Tweet-verification extension | Text | — | https://devpost.com/software/factchex |
| SynapseAI | [not checked] | Thoughts → visual expression | (EEG?) | HLTH | https://devpost.com/software/synapseai |
| Conductor AI | [not checked] | Cheaper/faster agent routing | Text | — | https://devpost.com/software/conductor-ai |
| CodeInsight | [not checked] | Understand codebases faster | Text | — | https://devpost.com/software/code-insight |
| Swarm AI | [not checked] | Parallel speech-to-speech QA testing | Voice | — | https://devpost.com/software/swarm-ai-s6lhd0 |
| PULSE.AI | [not checked] | Browser-context coding agent | Text | — | https://devpost.com/software/pulse-ai-0oafm5 |
| traider | [not checked] | Financial-literacy trading app | Text | FIN | https://devpost.com/software/traider |
| TheraMind | [not checked] | AI therapist's assistant | Voice/text | HLTH | https://devpost.com/software/theramind |
| Agent Ricky | [not checked] | Health/safety monitoring of first responders and military | Sensors | HLTH, DIS | https://devpost.com/software/jarvis-mhfy78 |
| Motherly.ai | [not checked] | "Your mom knows you better" | — | — | https://devpost.com/software/ai-mama |
| ProtestLink | [not checked] | Encrypted mesh protest coordination | Radio/mesh | DIS-ish | https://devpost.com/software/protestlink |
| CodeForge Pages | [not checked] | AI React landing pages | Text | — | https://devpost.com/software/codeforge-pages |
| theo | [not checked] | Cognition copilot from pen notes | Pen/handwriting | — | https://devpost.com/software/theo-k1enau |
| \<PriorityQueue\> | [not checked] | Democratizing electric-grid information | Data | CLIM | https://devpost.com/software/priorityqueue |
| CodeCrack | [not checked] | Voice mock coding interviews | Voice | — | https://devpost.com/software/codecrack |
| The Duck You Mean? | [not checked] | Explain-to-a-duck learning | Voice | — | https://devpost.com/software/the-duck-you-mean |
| EcoBite | [not checked] | Photo-based food-waste tracking | Camera | CLIM | https://devpost.com/software/ecobite-qcujae |
| Sprout (2025) | [not checked] | Imagination-driven learning | — | — | https://devpost.com/software/sprout-io |
| Caren AI | [not checked] | Caring companion | Voice | HLTH | https://devpost.com/software/caren-ai |
| Navi | [not checked] | Browser co-pilot | Voice | — | https://devpost.com/software/navi-7sp5mz |
| STIK GUI | [not checked] | AI tracking of spheroid tumor invasion | Microscopy images | HLTH (cancer) | https://devpost.com/software/tumor-invasion-kinetics-gui |
| Plot | [not checked] | Location insights for investment/building | Geo data | FIN | https://devpost.com/software/plot-3pi8c4 |
| The Anachronist | [not checked] | 3D time-travel history game | — | — | https://devpost.com/software/the-anachronist |
| Mirror | [not checked] | Auto-journal knowledge base | Screen | — | https://devpost.com/software/mirror-lmd54a |
| Sherlock | [not checked] | Investigation dot-connector | Text | — | https://devpost.com/software/sherlock-n4fikj |
| Fable | [not checked] | Brainwave-adaptive stories | EEG | HW | https://devpost.com/software/fable-br8e1d |
| TreeTrash | [not checked] | Intelligent trash monitoring | Camera/sensor | CLIM, HW | https://devpost.com/software/treetrash |
| Zue Research | [not checked] | Edge multimodal AI for neurodivergent learners | Multimodal | HLTH | https://devpost.com/software/zue-research |
| Lattice | [not checked] | Parallel agent research via spreadsheets | Text | — | https://devpost.com/software/lattice-data-at-your-fingertips |
| Spielberg AI | [not checked] | CUDA-accelerated NL video editing | Video | — | https://devpost.com/software/spielburg-ai |
| NeuroPilot | [not checked] | Control a computer with brainwaves | EEG | HW, HLTH | https://devpost.com/software/mindcontrolpc-control-computer-with-brainwaves |
| Miru | [not checked] | Indoor navigation for the visually impaired | Camera | HLTH | https://devpost.com/software/mapdash |
| CodeFusion | [not checked] | Talk + gesture coding | Voice + camera | — | https://devpost.com/software/codefusion-v9eq2x |
| Supernova | [not checked] | End-to-end AI-generated ads | Video | — | https://devpost.com/software/supernova-p1tum5 |

## Patterns (what top prizes share)
1. Physical hardware wins the overall prizes: 2026 Grand 1st (ESP32 cane) and 2nd (robot surgery), plus Most Creative (Pi camera), were all hardware. 2025 Most Creative was a delivery robot.
2. Input is almost always real-world sensing (LiDAR/depth, camera, heart-rate, audio). Text-only projects win sponsor/YC prizes, not the overall prizes.
3. Health and accessibility are the top domain: blind navigation (Shepherd, Iris, Miru, HorizonX, VisionOS), eldercare (Mira, Bloom, .dot), cardiac (HeartStart, ECGo).
4. Disaster/early warning shows up often: wildfire (ContainOS, PUSHPA), disaster forecasting (Morro, CalTrack), grid failure prediction (GridVeda). They win track and sustainability prizes, not the grand prize.
5. A recurring pipeline: sensor → threshold/model detects an event → automatic alert (Twilio call, caregiver dashboard). Examples: HeartStart, Mira, CareLink, GridVeda.
6. Winners stack prizes: Shepherd took 3 (Grand + Healthcare + OpenEvidence), and Mira, ChromaChord, diffuji, Bloom and Bye!Buy! took 2 each. Apply to all 10 allowed sponsor prizes.
7. Sponsor tools that showed up in winning projects: NVIDIA Earth2Studio/Jetson (climate/edge), Modal, OpenEvidence (health), Twilio (alerts), Perplexity Sonar, Claude Agent SDK.
8. Demo style is a live physical demo of a closed loop (the cane steers you, the robot drives up and does CPR), backed by a polished web dashboard and a short video.
9. Fintech never took a top prize. It only won agent/commerce sponsor prizes (Bye!Buy! via Stripe/Browserbase, Voider, kiru, AgentZero/WatchDog in the 2025 Web3 track).
10. For this team's kit, the closest match is ESP32/Pi sensors (DHT11, GPS, ultrasonic, photoresistor) → early-warning model → website + phone alert. Aim for 2–3 sponsor prizes (NVIDIA Earth2Studio for weather, Twilio for alerts, a health/climate track).
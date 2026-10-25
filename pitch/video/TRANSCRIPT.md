# Transcript: preston-pitch-raw.mp4 (179.4 s)

Machine transcript, not hand-checked. Source: Gemini `gemini-3.5-flash-lite` via the Files API (audio stream-copied with `ffmpeg -vn -c copy`), temperature 0, 2026-10-24 23:5x PDT. `gemini-2.5-flash` also answered (its JSON was malformed, raw reply kept in `edit/work/resp-gemini-2.5-flash.json`); the two agree to within ~0.5 s on every sentence. `gemini-3.1-flash-lite` answered with a different shape (also kept). Re-run: `bash pitch/video/edit/transcribe.sh`.

Where the two models disagree: 0:02 "What are the highest exports…" (3.5) vs "Pills, one of the highest exports…" (3.1); 1:48 "60 seconds" (3.5) vs "16 seconds" (2.5); 0:19 "aspirin A1" vs "aspirin 81" (the bottle is aspirin 81 mg). Edit uses none of the disputed words except "aspirin 81".

| Start | End | Text |
|---|---|---|
| 0:02.348 | 0:03.278 | Pills. |
| 0:03.278 | 0:07.728 | What are the highest exports and highest imports to all hospitals and medical centers around the world? |
| 0:08.308 | 0:09.918 | So why are we talking about pills? |
| 0:10.378 | 0:13.438 | So pills actually go through a very intense process with the FDA. |
| 0:13.918 | 0:18.528 | And they have to go through this process several times before being checked out for a normal pharmacy, |
| 0:18.528 | 0:19.468 | like Walgreens, |
| 0:19.788 | 0:23.018 | in which I got this from Walgreens and it's a aspir aspirin A1. |
| 0:24.168 | 0:27.768 | However, these numbers are actually bad, |
| 0:27.768 | 0:35.408 | because in the final process, some of them could be malfunctioned, as well as people could have bad intentions and put different drugs in here. |
| 0:36.198 | 0:43.718 | And these numbers are actually real, because 1.3 million people get injured from the right prescriptions, as well as 98,000 Americans. |
| 0:44.428 | 0:45.718 | So what we built, it's pill. |
| 0:46.368 | 0:49.038 | So pill is a hardware and software device |
| 0:49.268 | 0:51.528 | where let me go through the app first. |
| 0:52.568 | 0:55.708 | So, if we put check my medical. |
| 0:55.988 | 0:58.748 | So, first we have to put the prescription of the drug, |
| 0:59.038 | 1:00.678 | and then we use it, |
| 1:01.078 | 1:03.228 | as well as what it looks like in the pill. |
| 1:03.958 | 1:08.068 | And as we click this, it's going to tell us to get the water inside. |
| 1:08.478 | 1:17.388 | So, what we have in this beautifully 3D printed device is we're going to put some water in there, and there's going to be a marking just like so. |
| 1:20.158 | 1:23.518 | And as I click start, I'm going to push this medicine in. |
| 1:23.518 | 1:26.548 | So, first I'm going to pound it, pounding some in. |
| 1:28.988 | 1:30.018 | pounding it. |
| 1:31.768 | 1:32.418 | Okay. |
| 1:32.908 | 1:36.508 | And as that countdown is going, I'm going to put the medicine inside. |
| 1:37.338 | 1:41.278 | And I'm going to mix it with my hand, excuse the disturbance. |
| 1:42.588 | 1:43.348 | Perfect. |
| 1:44.258 | 1:47.458 | Righty, now that it's ready, we will go through the countdown. |
| 1:48.068 | 1:52.418 | This is going to take 60 seconds, and as I walk you through the process, this is going to keep going. |
| 1:52.418 | 1:57.488 | So, as you see in this hardware, we're going to use an Arduino Uno for the main head and CPU. |
| 1:57.868 | 2:04.388 | And what it does, it it uses red, blue, and white lights, as well as a photo resistor at the back. |
| 2:05.128 | 2:08.578 | So, since this is black and there are no lights inside, |
| 2:08.818 | 2:13.338 | we're going to use these three colors to find a good measurement from what you see here. |
| 2:14.078 | 2:16.898 | This measures the concentration of the vitamin. |
| 2:17.388 | 2:26.788 | And using the prescription and AI models, it can find the right concentration to the amount of cloudy things inside this um inside the stability. |
| 2:27.248 | 2:31.428 | And as we use the water and it does the 10-second countdown, |
| 2:31.698 | 2:36.818 | it goes through what is inside the water and sees it as a stable variable. |
| 2:37.348 | 2:43.278 | And using these lights, we can find the true concentration of what is in the prescription and what is in the clouds. |
| 2:44.118 | 2:47.388 | So as the timer runs out, I'm going to see and it's going to check. |
| 2:48.118 | 2:50.158 | And oh no, it's unable to verify. |
| 2:50.378 | 2:52.408 | Because guess what, I put morphine in here instead of aspirin. |
| 2:53.308 | 2:54.268 | So watch out. |
| 2:55.738 | 2:57.258 | Um, please swallow the right pills. |
| 2:57.728 | 2:58.338 | Thank you. |

Flag (StatsVerify, pitch/stats-verify.md): the 0:36–0:44 line ("1.3 million people get injured from the right prescriptions, as well as 98,000 Americans") does not match its sources; the edit cuts it.

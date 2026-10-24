#!/usr/bin/env python3
"""Discord <-> Cal Hacks helper bridge.

On start it makes sure a "PILL" category exists in the server with the team's channels, then listens in
every channel of that category. Each message is forwarded to the helper's herdr pane as a prompt, with the
channel name and id; attachments are saved under ~/calhacks-13/discord-inbox/. The helper replies with
tools/discord-bridge/say.sh <channel> "<text>", which posts through the bot's own identity.

Env (tools/discord-bridge/.env, git-ignored):
  DISCORD_BOT_TOKEN=...   bot token (Message Content Intent ON; invited with Manage Channels)
  DISCORD_CATEGORY=PILL   category name to create/use (default PILL)
  HERDR_TARGET=wZ:p1      helper pane
Run:  .venv/bin/python bridge.py            (listen)
      .venv/bin/python bridge.py --setup    (create channels, print ids, exit)
"""
import asyncio
import os
import re
import subprocess
import sys
import time
from pathlib import Path

import discord

ROOT = Path(__file__).resolve().parent
INBOX = Path.home() / "calhacks-13" / "discord-inbox"
LOG = ROOT / "bridge.log"

CHANNELS: list[tuple[str, str]] = [
    ("inquiries", "General questions and discussion: where to build, how, connectors. The helper answers here"),
    ("plan", "The master plan (PLAN.md), milestones, who does what, the clock to Sun 8:30 AM"),
    ("decisions", "One message per decision: what, why, who. The helper logs them"),
    ("ideas", "New ideas and what-ifs; the helper runs the debaters on request"),
    ("debate", "Results from the AI debaters and judge panels"),
    ("references", "Peel, past winners, papers, prize rules, every source we lean on"),
    ("documents", "Specs, PDFs, datasheets, drafts; drop files here"),
    ("hardware", "Wiring, sensors, calibration runs, photos of the box"),
    ("website", "Site and web app: pages, screens, design"),
    ("software", "Firmware, backend, agent, data"),
    ("errors", "Paste errors and logs here"),
    ("pitch", "Devpost text, slides, demo script, video"),
    ("status", "Short progress updates from the helper and team"),
    ("life-updates", "Where everyone is, food, sleep, schedule"),
]


def load_env() -> None:
    env_path = ROOT / ".env"
    if not env_path.exists():
        sys.exit(f"missing {env_path}; copy .env.example and fill it in")
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())


def log(msg: str) -> None:
    stamp = time.strftime("%Y-%m-%d %H:%M:%S")
    with LOG.open("a") as f:
        f.write(f"{stamp} {msg}\n")


def safe_name(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]", "_", name)[:80]


load_env()
TOKEN = os.environ["DISCORD_BOT_TOKEN"]
CATEGORY = os.environ.get("DISCORD_CATEGORY", "PILL")
TARGET = os.environ.get("HERDR_TARGET", "wZ:p1")
# DISCORD_ROUTES="inquiries=wZ:p3,ideas=wZ:p4" sends those channels to other panes; everything else goes to TARGET.
ROUTES: dict[str, str] = {}
for item in os.environ.get("DISCORD_ROUTES", "").split(","):
    if "=" in item:
        name, pane = item.split("=", 1)
        ROUTES[name.strip().lstrip("#")] = pane.strip()
SETUP_ONLY = "--setup" in sys.argv

intents = discord.Intents.default()
intents.message_content = True
intents.guilds = True
client = discord.Client(intents=intents)
watched: set[int] = set()


async def ensure_channels(guild: discord.Guild) -> discord.CategoryChannel:
    cat = discord.utils.get(guild.categories, name=CATEGORY)
    if cat is None:
        cat = await guild.create_category(CATEGORY)
        log(f"created category {CATEGORY} in {guild.name}")
    existing = {c.name: c for c in cat.text_channels}
    for name, topic in CHANNELS:
        if name in existing:
            continue
        await guild.create_text_channel(name, category=cat, topic=topic)
        log(f"created #{name}")
    return cat


@client.event
async def on_ready() -> None:
    if not client.guilds:
        print("bot is not in any server yet; invite it first", flush=True)
        await client.close()
        return
    for guild in client.guilds:
        cat = await ensure_channels(guild)
        for ch in cat.text_channels:
            watched.add(ch.id)
            print(f"{guild.name} #{ch.name} id={ch.id}", flush=True)
    log(f"ready as {client.user}; watching {len(watched)} channels -> herdr {TARGET}")
    if SETUP_ONLY:
        await client.close()
        return
    ask = next((c for g in client.guilds for c in g.text_channels if c.name == "inquiries" and c.id in watched), None)
    if ask:
        await ask.send("Pill is online. Ask anything here; drop files in #documents; the plan lives in #plan. I answer in the channel you write in.")


@client.event
async def on_message(message: discord.Message) -> None:
    if message.author.bot or message.channel.id not in watched:
        return
    text = message.content.strip()
    saved: list[str] = []
    if message.attachments:
        INBOX.mkdir(parents=True, exist_ok=True)
        for att in message.attachments:
            dest = INBOX / f"{int(time.time())}-{safe_name(att.filename)}"
            try:
                await att.save(dest)
                saved.append(str(dest))
            except Exception as exc:  # noqa: BLE001
                log(f"attachment save failed {att.filename}: {exc}")
    if not text and not saved:
        return
    author = message.author.display_name
    chan = message.channel.name
    parts = [f"DISCORD #{chan} (id {message.channel.id}) from {author}: {text or '(no text)'}"]
    if saved:
        parts.append("Attachments saved: " + ", ".join(saved))
    parts.append(f'Reply with: ~/calhacks-13/tools/discord-bridge/say.sh {chan} "<answer>" (short, plain English).')
    prompt = "\n".join(parts)
    try:
        await message.add_reaction("👀")
    except Exception:  # noqa: BLE001
        pass
    try:
        target = ROUTES.get(chan, TARGET)
        proc = await asyncio.create_subprocess_exec(
            "herdr", "agent", "prompt", target, prompt,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        )
        _, err = await proc.communicate()
        log(f"#{chan} from {author}: {text[:120]!r} attachments={len(saved)} rc={proc.returncode} {err.decode().strip()[:200]}")
        if proc.returncode != 0:
            await message.reply("Couldn't reach the helper right now; try again in a minute.", mention_author=False)
    except FileNotFoundError:
        log("herdr not found on PATH")
        await message.reply("Bridge misconfigured: herdr not found.", mention_author=False)


if __name__ == "__main__":
    client.run(TOKEN, log_handler=None)

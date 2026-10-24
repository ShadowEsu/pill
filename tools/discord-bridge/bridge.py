#!/usr/bin/env python3
"""Discord <-> Cal Hacks helper bridge.

Listens in one Discord channel. Every message there (from anyone Preston lets into the channel)
is forwarded to the helper's herdr pane as a prompt; attachments are saved under
~/calhacks-13/discord-inbox/ and their paths are included so the helper can read them.
The helper answers by running tools/discord-bridge/say.sh, which posts through a channel webhook.

Env (tools/discord-bridge/.env, git-ignored):
  DISCORD_BOT_TOKEN=...      bot token from the Discord Developer Portal (Message Content Intent ON)
  DISCORD_CHANNEL_ID=...     the one channel to listen in (right-click channel -> Copy Channel ID)
  HERDR_TARGET=wZ:p1         helper pane
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
CHANNEL_ID = int(os.environ["DISCORD_CHANNEL_ID"])
TARGET = os.environ.get("HERDR_TARGET", "wZ:p1")

intents = discord.Intents.default()
intents.message_content = True
client = discord.Client(intents=intents)


@client.event
async def on_ready() -> None:
    log(f"ready as {client.user} listening on channel {CHANNEL_ID} -> herdr {TARGET}")
    print(f"ready as {client.user}; channel {CHANNEL_ID}; target {TARGET}", flush=True)


@client.event
async def on_message(message: discord.Message) -> None:
    if message.author.bot or message.channel.id != CHANNEL_ID:
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
    parts = [f"DISCORD from {author} in #{message.channel.name}: {text}" if text else f"DISCORD from {author}: (no text)"]
    if saved:
        parts.append("Attachments saved: " + ", ".join(saved))
    parts.append("Reply with tools/discord-bridge/say.sh \"<answer>\" (plain English, short; split long answers).")
    prompt = "\n".join(parts)
    try:
        await message.add_reaction("👀")
    except Exception:  # noqa: BLE001
        pass
    try:
        proc = await asyncio.create_subprocess_exec(
            "herdr", "agent", "prompt", TARGET, prompt,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        )
        out, err = await proc.communicate()
        log(f"forwarded from {author}: {text[:120]!r} attachments={len(saved)} rc={proc.returncode} {err.decode().strip()[:200]}")
        if proc.returncode != 0:
            await message.reply("Couldn't reach the helper right now; try again in a minute.", mention_author=False)
    except FileNotFoundError:
        log("herdr not found on PATH")
        await message.reply("Bridge misconfigured: herdr not found.", mention_author=False)


if __name__ == "__main__":
    client.run(TOKEN, log_handler=None)

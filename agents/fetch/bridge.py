"""Fetch transport for the shared fictional Movin account."""

import asyncio
import json
import os
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


HELP = (
    "I'm Movin's sandbox housing checker. Describe the whole apartment rent, "
    "lease dates, roommates, commute, your fees, and minimum balance. It uses fictional banking data, "
    "not your personal account. You can also send a JSON object with housing details and safetyBufferCents. "
    "See agents/fetch/example-request.json for the request format."
)


def call_finance(payload: dict) -> dict:
    """Call only the locally configured backend; never accept a URL from chat."""
    token = os.environ.get("MOVIN_BRIDGE_TOKEN", "")
    if len(token) < 32:
        raise RuntimeError("Configure MOVIN_BRIDGE_TOKEN before starting the bridge.")
    port = int(os.environ.get("MOVIN_PORT", "3101"))
    request = Request(
        f"http://127.0.0.1:{port}/api/demo/affordability",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
        method="POST",
    )
    # A bounded timeout prevents a failed backend from holding a chat open forever.
    with urlopen(request, timeout=25) as response:
        return json.load(response)


def money(cents: int) -> str:
    """Format engine cents without recalculating any financial conclusions."""
    return f"${cents / 100:,.2f}"


def format_result(result: dict) -> str:
    """Report computed values and their caveats; do not invent an affordability score."""
    finance = result["affordability"]
    balances = finance["dailyBalances"]
    lowest = min(balances, key=lambda day: day["projectedBalanceCents"])
    below = next((day for day in balances if day["belowSafetyBuffer"]), None)
    lines = [
        f"Fictional sandbox account — snapshot {result['snapshotDate']}.",
        f"Housing per month (lease-start month): {money(finance['monthlyHousingCostCents'])}.",
        f"Upfront cash, including first rent: {money(finance['upfrontCashRequiredCents'])}.",
        f"Lowest projected balance: {money(lowest['projectedBalanceCents'])} on {lowest['date']}.",
        (f"First day below your safety buffer: {below['date']}." if below
         else "The forecast stays at or above your safety buffer."),
        f"Spending prediction used: {result['predictionMethod']}.",
    ]
    # Preserve limited-history and other warnings, including the seeded balance caveat.
    notes = finance["assumptions"] + finance["warnings"] + result.get("dataWarnings", [])
    lines.extend(f"• {note}" for note in dict.fromkeys(notes))
    return "\n".join(lines)


async def reply(text: str, fetch=call_finance) -> str:
    """Testable message boundary: malformed requests never invoke banking tools."""
    if len(text.encode()) > 16_384:
        return "Request too large. Send one apartment at a time."
    try:
        payload = json.loads(text)
    except ValueError:
        return HELP
    if not isinstance(payload, dict) or not isinstance(payload.get("housing"), dict):
        return HELP
    try:
        # urllib is blocking, so keep it off the agent's event loop.
        result = await asyncio.to_thread(fetch, payload)
        return format_result(result)
    except HTTPError as error:
        if error.code == 422:
            # The backend's validation messages are deliberately safe to show.
            try:
                detail = json.loads(error.read(16_384))
                return "Please fix the apartment details: " + detail.get("error", "Invalid input.")
            except (ValueError, TypeError):
                return "Please check the apartment details and try again."
        return "The finance service is unavailable or misconfigured. Please retry later."
    except (URLError, TimeoutError, OSError):
        return "I couldn't reach the finance service. Please retry shortly."
    except Exception:
        # Never disclose tokens, banking identifiers, or internal tracebacks in chat.
        return "I couldn't complete this check. Please check the local service configuration."


def create_agent():
    """Construct the ACP agent only on explicit startup, not on test imports."""
    from dotenv import load_dotenv
    from conversation import Conversation
    from uagents import Agent, Context, Protocol
    from uagents_core.contrib.protocols.chat import (
        ChatAcknowledgement, ChatMessage, TextContent, chat_protocol_spec,
    )

    load_dotenv(Path(__file__).resolve().parents[2] / ".env.local")
    seed = os.environ.get("MOVIN_AGENT_SEED", "")
    if len(seed) < 32 or len(os.environ.get("MOVIN_BRIDGE_TOKEN", "")) < 32:
        raise RuntimeError("Set private MOVIN_AGENT_SEED and MOVIN_BRIDGE_TOKEN (32+ characters each).")
    agent = Agent(name="Movin Housing Copilot", seed=seed, port=8001,
                  mailbox=True, publish_agent_details=True)
    protocol = Protocol(spec=chat_protocol_spec)
    conversation = Conversation()

    @protocol.on_message(ChatMessage)
    async def handle_message(ctx: Context, sender: str, message: ChatMessage):
        # ACP requires acknowledging receipt before processing the request.
        await ctx.send(sender, ChatAcknowledgement(acknowledged_msg_id=message.msg_id))
        text = "\n".join(part.text for part in message.content if isinstance(part, TextContent))
        # Sender and protocol session together separate users and conversations.
        response = await conversation.respond(f"{sender}:{ctx.session}", text, reply)
        await ctx.send(sender, ChatMessage(content=[TextContent(type="text", text=response)]))

    @protocol.on_message(ChatAcknowledgement)
    async def handle_ack(ctx: Context, sender: str, message: ChatAcknowledgement):
        # Acknowledgements need no reply; replying would create an endless loop.
        pass

    agent.include(protocol, publish_manifest=True)
    return agent


if __name__ == "__main__":
    # Running this contacts Fetch services and publishes the protocol manifest.
    create_agent().run()

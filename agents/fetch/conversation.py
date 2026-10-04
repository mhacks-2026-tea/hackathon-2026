"""ASI reads stated apartment inputs; the local engine computes financial results."""
import asyncio
import json
import math
import os
import time
import logging
import re
from collections import OrderedDict
from datetime import date
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

# Explicit zeros are required: an unknown expense is never assumed free.
FIELDS = {
    "campusId": "school name (for example University of Michigan, Wisconsin, Michigan State, Yale, or Howard)",
    "leaseStart": "lease start date including year",
    "leaseEnd": "lease end date including year (exclusive)",
    "monthlyApartmentRentDollars": "whole-apartment monthly rent in dollars",
    "bedrooms": "number of bedrooms",
    "roommates": "other roommates (zero if living alone)",
    "commute": "walk, bike, or bus",
    "monthlyParkingCents": "your monthly parking cost in dollars",
    "securityDepositCents": "your deposit in dollars",
    "applicationFeesCents": "your application fees in dollars",
    "movingCostsCents": "your moving costs in dollars",
    "safetyBufferCents": "minimum balance to keep in dollars",
    "eligibleForStudentBusFare": "whether you qualify for student bus fare",
}


def validate_patch(value):
    """Validate model output before it can reach banking tools."""
    if not isinstance(value, dict) or set(value) - set(FIELDS):
        raise ValueError("Unexpected fields")
    clean = {}
    for key, item in value.items():
        if item is None:
            continue
        if key == "campusId":
            if not isinstance(item, str) or not item or len(item) > 100:
                raise ValueError("Invalid school")
        elif key in ("leaseStart", "leaseEnd"):
            if not isinstance(item, str) or date.fromisoformat(item).isoformat() != item:
                raise ValueError("Invalid date")
        elif key == "commute":
            if item not in ("walk", "bike", "bus"):
                raise ValueError("Unsupported commute")
        elif key == "eligibleForStudentBusFare":
            if not isinstance(item, bool):
                raise ValueError("Invalid eligibility")
        else:
            if isinstance(item, bool) or not isinstance(item, (int, float)) or not math.isfinite(item) or item < 0:
                raise ValueError("Invalid amount")
            if key != "monthlyApartmentRentDollars":
                # JSON may encode exact cents as 5000.0; accept only whole values.
                if item > 2**53 - 1 or int(item) != item:
                    raise ValueError("Expected integer")
                item = int(item)
        clean[key] = item
    return clean


def _extract_once(text, known):
    """Send approved apartment inputs to ASI; never include banking data or other secrets."""
    key = os.environ.get("ASI1_API_KEY", "")
    if not key:
        raise RuntimeError("ASI1_API_KEY is missing")
    prompt = (
        "Extract only explicitly stated apartment facts. Return JSON using these keys: "
        + json.dumps(FIELDS) + ". Keys ending Cents are integer cents ($50=5000); rent is dollars. "
        "roommates excludes the student. Dates use YYYY-MM-DD and require a stated year. "
        "Map University of Michigan/UMich/michigan to umich, Wisconsin to wisconsin, "
        "Michigan State/MSU to michigan-state, Yale to yale, Howard to howard. "
        "Never invent dates, fees, zeros, income, eligibility, or balances. Omit unknown values. "
        "Include stated corrections. Off-topic messages return {}. No prose or financial advice."
    )
    body = {"model": "asi1", "max_tokens": 800, "messages": [
        {"role": "system", "content": prompt},
        {"role": "user", "content": json.dumps({"known": known, "message": text})},
    ]}
    request = Request("https://api.asi1.ai/v1/chat/completions", method="POST",
                      data=json.dumps(body).encode(), headers={
                          "Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    with urlopen(request, timeout=20) as response:
        content = json.load(response)["choices"][0]["message"]["content"].strip()
    # Accept a single outer JSON fence; arbitrary model prose remains invalid.
    if content.startswith("```") and content.endswith("```"):
        content = "\n".join(content.splitlines()[1:-1])
    return validate_patch(json.loads(content))


def extract_inputs(text, known):
    """Retry one temporary API or malformed-output failure; never retry invalid credentials."""
    for attempt in range(2):
        try:
            return _extract_once(text, known)
        except HTTPError as error:
            if attempt or error.code not in (408, 429, 500, 502, 503, 504):
                raise
        except (URLError, TimeoutError, ValueError, KeyError, TypeError, AttributeError):
            if attempt:
                raise
        # Bounded backoff gives a briefly busy service time to recover.
        time.sleep(0.5)


class Conversation:
    """Isolate chat state by sender and ACP session, with expiry and a memory limit."""
    def __init__(self, extract=extract_inputs):
        self.extract = extract
        self.sessions = OrderedDict()
        # New campus JSON profiles become available without changing the agent code.
        root = Path(__file__).resolve().parents[2] / "data" / "campuses"
        self.campuses = {path.stem for path in root.glob("*.json")}

    async def respond(self, session, text, execute):
        # ASI may retain the leading recipient mention; commands refer to the text after it.
        text = re.sub(r"^\s*@(?:agent1[a-z0-9]+|movin-housing)\s+", "", text, count=1).strip()
        now = time.monotonic()
        for key in list(self.sessions):
            if now - self.sessions[key]["updated"] > 600 and not self.sessions[key]["lock"].locked():
                del self.sessions[key]
        if session not in self.sessions:
            if len(self.sessions) >= 100:
                return "The demo is busy. Please retry shortly."
            self.sessions[session] = {"known": {}, "updated": now, "lock": asyncio.Lock()}
        state = self.sessions[session]
        async with state["lock"]:
            state["updated"] = time.monotonic()
            if text.strip().lower() in ("reset", "start over"):
                state["known"] = {}
                state.pop("last_payload", None)
                return "Started over. Which school and what apartment rent? This uses a fictional banking account."
            # Re-evaluate the saved scenario on explicit detail requests, without another LLM call.
            if text.strip().lower() in ("details", "assumptions", "show details", "show assumptions"):
                if "last_payload" not in state:
                    return "First evaluate an apartment, then ask for details."
                return await execute(state["last_payload"], details=True)
            if len(text.encode()) > 16384:
                return "Please send a shorter apartment description."
            # Structured input remains available when ASI is offline.
            try:
                structured = json.loads(text)
            except ValueError:
                structured = None
            if isinstance(structured, dict) and isinstance(structured.get("housing"), dict):
                state["last_payload"] = text
                return await execute(text)
            try:
                patch = await asyncio.to_thread(self.extract, text, dict(state["known"]))
                state["known"].update(validate_patch(patch))
            except Exception as error:
                # Log only type/status so diagnostics never expose input or credentials.
                logging.getLogger(__name__).warning("ASI extraction failed: %s status=%s", type(error).__name__, getattr(error, "code", "n/a"))
                if isinstance(error, HTTPError) and error.code in (401, 402, 403):
                    return "The ASI service needs an API-key or account-access check. Your earlier apartment details are saved."
                return "ASI is temporarily having trouble reading this. Your earlier details are saved—please resend this last message."
            known = state["known"]
            if known.get("campusId") == "michigan":
                known["campusId"] = "umich"
            if known.get("campusId") and known["campusId"] not in self.campuses:
                return "Cost data for that school is not connected to this agent yet. Available campus IDs: " + ", ".join(sorted(self.campuses)) + ". I won't substitute another school's costs."
            if known.get("commute") == "bus" and known.get("eligibleForStudentBusFare") is not True:
                return "Do you qualify for student bus fare? Otherwise this demo supports walking or biking."
            missing = [key for key in FIELDS if key not in known and key != "eligibleForStudentBusFare"]
            if missing:
                return "Using the fictional banking demo account. I still need: " + "; ".join(FIELDS[key] for key in missing[:4]) + "."
            # Fixed campus/name are disclosed demo metadata, not inferred financial facts.
            housing = {key: value for key, value in known.items() if key != "safetyBufferCents"}
            housing.update(name="Apartment from ASI conversation")
            state["last_payload"] = json.dumps({"housing": housing, "safetyBufferCents": known["safetyBufferCents"]})
            return await execute(state["last_payload"])

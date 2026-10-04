# Movin Fetch bridge — local integration checkpoint

This Python bridge receives Agent Chat Protocol messages and calls the existing
TypeScript finance service. Financial math and spending-model selection stay in
TypeScript. ASI extracts apartment details from natural-language messages, and
the bridge asks for missing fields before calling the engine. Structured JSON is
also supported as a fallback.
Registered agent: `@movin-housing`, address
`agent1qd2qgpnnvagkykwypsepkrjyap80aenxfp4gvylpl9kkunpt6cmqygegxxq`.
[Open in ASI:One](https://asi1.ai/ai/agent1qd2qgpnnvagkykwypsepkrjyap80aenxfp4gvylpl9kkunpt6cmqygegxxq).
The live ASI:One affordability workflow was verified October 4, 2026.
Hackathon submissions remain separate tasks.

## Local setup (Python 3.10+)

From the repository root:

```sh
python3 -m venv .venv-fetch
.venv-fetch/bin/pip install -r agents/fetch/requirements.txt
.venv-fetch/bin/python -m unittest discover -s agents/fetch -p 'test_*.py'
.venv-fetch/bin/python agents/fetch/check_asi.py
# After starting the local finance service, test the fictional four-turn workflow:
.venv-fetch/bin/python agents/fetch/check_multiturn.py
```

In ignored `.env.local`, set the existing Nessie settings, `FINANCE_HISTORY_START`,
`FINANCE_AS_OF_DATE=2026-10-03`, and two distinct random secrets of at least 32
characters: `MOVIN_BRIDGE_TOKEN` and `MOVIN_AGENT_SEED`. The token protects the
local finance endpoint. The seed controls the Fetch agent identity; keep it stable.
Generate each locally with `python3 -c 'import secrets; print(secrets.token_hex(32))'`.
Never share those values in chat or commit them. Add `ASI1_API_KEY` from
[ASI Developer](https://asi1.ai/developer) for natural-language extraction.
The live check sends only fictional apartment inputs and consumes an API request.

Terminal 1: `npm run serve:finance`

Terminal 2 (when ready to connect to Fetch):
`.venv-fetch/bin/python agents/fetch/bridge.py`

Starting the agent contacts Fetch and publishes the ACP manifest. Follow the
[official mailbox setup](https://innovationlab.fetch.ai/resources/docs/examples/chat-protocol/asi-compatible-uagents)
to connect your Agentverse account. Registration and ASI:One discovery must be
checked live; offline tests do not establish either.

Try: "For a fictional UMich demo, whole apartment rent is $1050, one bedroom, no roommates, walking.
Lease November 1, 2026 to December 1, 2026. My deposit is $1050,
application fee $50, moving $150, monthly parking $0, minimum balance $200."
You can provide these details over multiple messages, correct the rent, or send
`reset`. Conversations expire after ten minutes and are isolated by sender/session.
Replies show a short forecast summary. Send `details` to re-evaluate the last
scenario and display its complete assumptions and warnings without a model call.
Alternatively, send the contents of `example-request.json` as a chat message.
All example costs are fictional, zero costs are explicit assumptions, dates use
the fixed demo snapshot, and roommates means other occupants besides the student.
Rent is whole-apartment dollars; all fields ending in `Cents` are integer cents
representing the student's share. Existing sandbox bills remain included; an old
rent bill must be explicitly reviewed/excluded when modeling replacement housing.
The response preserves forecast assumptions and data-quality warnings.

## Next small steps

1. Merge the integration with the frontend and additional school data.
2. Complete Devpost and ASI submission-agent submissions and record the demo.

Natural-language messages and previously stated apartment inputs (including the
chosen safety buffer) are sent to `https://api.asi1.ai/v1/chat/completions`.
Banking transactions, account identifiers, and balances are not sent to ASI.
Use fictional demo data for the shared public agent. The agent asks for a school
and loads available `data/campuses/*.json` profiles. Currently this backend has
only UMich data; other schools are reported as unavailable rather than silently
using UMich estimates. ASI extracts inputs; deterministic templates report engine
results. Offline tests do not require a model key.
The TypeScript service still selects its spending forecast
using its existing evaluation, including the baseline fallback for short history.

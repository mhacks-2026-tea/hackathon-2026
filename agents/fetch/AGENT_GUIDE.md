# Movin Housing Copilot

![tag:innovationlab](https://img.shields.io/badge/innovationlab-3D8BD3)
![tag:hackathon](https://img.shields.io/badge/hackathon-5F43F1)

Movin helps college students test housing decisions using school-specific costs,
fictional Nessie banking data, and a spending forecast. The product supports a
school-based architecture; this live backend currently has a UMich cost profile.
Other schools require their campus data to be connected. Movin asks which school
you mean and never substitutes UMich costs for another school.

## What it does

1. Reads your apartment question with ASI and asks for missing details.
2. Loads the selected school's available cost data.
3. Fetches the shared fictional Nessie account and its scheduled obligations.
4. Selects a spending forecast, using ML only when historical evaluation supports it.
5. Calculates monthly housing costs, upfront cash, and daily projected balances.
6. Reports when the apartment would leave the demo account below your chosen buffer.

The complete workflow runs inside ASI:One using Agent Chat Protocol 0.3.0.
No custom frontend is required for this agent workflow.

## Try it

"For a fictional UMich demo: whole apartment rent is $1050, one bedroom, no
roommates, walking. Lease November 1, 2026 to December 1, 2026. My deposit is
$1050, application fees $50, moving costs $150, monthly parking $0, minimum
balance to keep $200. Can I afford it?"

You can provide details over multiple messages or correct the rent to compare
another apartment. Send `reset` to start over. Roommates means other occupants.
Rent is the whole-apartment amount; deposit and other fees are your own share.
Give explicit zero costs where applicable and include the year in dates.

## Demo limits

This uses a shared fictional bank account with a fixed October 3, 2026 snapshot,
not your personal bank account. Its $1800 balance is seeded. Three days of
transaction history are insufficient to evaluate the learned model, so the live
demo uses a baseline forecast. ML selection is tested separately with synthetic
history; simulation ranges are not calibrated probabilities.

School, apartment details, and your chosen buffer are sent to the ASI model to
interpret your request. Banking balances, transactions, and account IDs stay in
the local finance service. Do not enter private bank credentials or personal
banking data. Campus cost assumptions and data warnings accompany results.

## Links and running

- [Public source and project instructions](https://github.com/mhacks-2026-tea/hackathon-2026)
- [ASI:One agent](https://asi1.ai/ai/agent1qd2qgpnnvagkykwypsepkrjyap80aenxfp4gvylpl9kkunpt6cmqygegxxq)
- Agent handle: `@movin-housing`
- Agent address: `agent1qd2qgpnnvagkykwypsepkrjyap80aenxfp4gvylpl9kkunpt6cmqygegxxq`

Run the finance service and Python Fetch bridge as described in
`agents/fetch/README.md`. The local processes must remain online for replies.
The repository's finance-agent branch contains this integration until merged.

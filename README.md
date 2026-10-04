# UMich campus data

Offline campus data and cost helpers for `feature/campus-data`.
Requires Python 3.10+; no third-party packages.

Run this example from the repository root:

```python
from campus.loader import (
    estimate_true_monthly_cost,
    find_neighborhoods_in_budget,
)

cost = estimate_true_monthly_cost(
    "umich", rent=2600, roommates=1,
    commute="bus", month="january", bedrooms=2,
)
for name, value in cost["items"].items():
    print(f"{name}: {value['expected']:.2f}")
print("total:", cost["total"])
print("confidence:", cost["confidence"])

print(find_neighborhoods_in_budget(
    "umich", max_rent=2800, bedrooms=2, max_commute_min=20,
))
```

Output:

```text
rent: 1300.00
utilities: 182.50
internet: 32.50
renters_insurance: 10.00
groceries: 385.50
commute: 0.00
total: {'low': 1880.5, 'expected': 1910.5, 'high': 1940.5}
confidence: generic
[]
```

Costs are per person. Each total equals the sum of its corresponding
line items. Household costs split 50/50 for two occupants; insurance
is per person. Utilities exclude internet.

Fixed averages, midpoints, and utility modeling caps are user-approved
assumptions, not guaranteed prices. The result still carries
`data_status: placeholder`.

Commute times depend on traffic and location. The filter currently has
no matches; commute minutes and rent medians are not populated. Supplied
bedroom-specific ranges are stored in the CSV, but the rent helpers
still read median columns. Car ranges and typical move-in fees/deposit
also remain incomplete.

Sources and research dates are in `data/sources.md`. Links are optional;
recorded source names do not imply independent verification.

Run tests:

```bash
python -m unittest discover -s tests -v
```

Current result: 26 tests pass. Passing tests do not mean every PRD
requirement or data field is complete.

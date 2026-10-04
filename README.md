# UMich campus data

Offline campus data and cost helpers available on `main` and `feature/campus-data`.
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
    "umich", max_rent=1800, bedrooms=2,
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
[Neighborhood(...), ...]  # Burns Park, Oxbridge, Glazier Way / North Side
```

Costs are per person. Each total equals the sum of its corresponding
line items. Household costs split 50/50 for two occupants; insurance
is per person. Utilities exclude internet.

Fixed averages, midpoints, and utility modeling caps are user-approved
assumptions, not guaranteed prices. The result still carries
`data_status: placeholder`.

Rent helpers now use the supplied bedroom-specific ranges. Commute minutes,
car ranges, and listing-specific move-in charges remain unknown; the helpers
accept explicit inputs or report the missing information as described below.

Sources and research dates are in `data/sources.md`. Links are optional;
recorded source names do not imply independent verification.

Run tests:

```bash
python -m unittest discover -s tests -v
```

Current result: 35 tests pass. Passing tests do not mean every PRD
requirement or data field is complete.

## Movin integration and cost definitions

The Python helpers read local files in `data/`; they make no runtime network calls. `main` includes the campus code, data, source log, and campus tests.

| Cost | Input basis | Current calculation |
| --- | --- | --- |
| Rent | Whole apartment, supplied by student | Divide 50/50 for two occupants |
| Utilities | Apartment estimate by month and bedroom group; excludes internet | Divide 50/50 for two occupants |
| Internet | Household range 40–90; approved expected value 65 | Divide 50/50 for two occupants |
| Groceries | Approved fixed household budget 771 | 385.50 per person for two occupants |
| Renters insurance | Approved fixed assumption 10 per person | Not divided |
| Walk/bike | User-reported zero travel cost | Equipment/maintenance not separately established |
| Bus | Zero for eligible active U-M students with yellow MCard on TheRide fixed routes | Do not apply to ineligible riders |
| Car | Reported transportation average 345 | Helper lacks a complete car range; parking coverage is unconfirmed |
| Deposit/application fee | One-time costs | Actual amounts remain missing; legal caps are not typical costs |

Midpoints, fixed averages, and utility caps are approved modeling assumptions. The original `+` upper prices are not guaranteed limits. `confidence="generic"` describes a local estimate, not a verified listing quote; `data_status="placeholder"` means unresolved data remains. Books/supplies are for the supplied academic period, not a monthly line item.

### Range-aware rent helpers

The CSV contains bedroom-specific total rent ranges and estimated shared per-person ranges for five priced areas; four other areas retain empty ranges. Preserve all supplied endpoints, rounding, and open-ended `+` prices. Do not invent medians or divide an already per-person shared rent a second time.

`Neighborhood.rent_ranges` exposes the supplied endpoints using keys `1`, `2`, `3_plus`, and `shared_1`, `shared_2`, `shared_3_plus`. An open upper price is represented as `high=None` plus `high_lower_bound`; original CSV endpoints and rounding remain unchanged.

`get_rent_benchmark` now aggregates those ranges. It returns `median=None` when only ranges exist, and `high=None` if any upper bound is unknown/open. For example, one-bedroom whole-apartment benchmarks are low 825, median unknown, high 2550. These are supplied neighborhood ranges, not independently verified listings.

`find_neighborhoods_in_budget(..., max_commute_min=None, shared=False)` returns **potential** matches whose range starts within budget. It does not claim every listing is affordable. `shared=True` uses the supplied per-person range without dividing again. Unpriced neighborhoods are omitted, so an empty result only means no matches in the available data.

### Missing data: ask the student

Commute times depend on traffic and location. They are currently empty in the CSV. Movin should ask for the apartment location, campus destination, travel method, and expected commute time before claiming a match.

The move-in helper returns `total=None`, a `known_subtotal`, and `missing_fields` when deposit or application costs are unknown. Zero placeholders become `None`; explicitly supplied zero means no charge. For example:

```python
estimate_move_in_cost("umich", rent=1000)  # incomplete; asks for fees/deposit
estimate_move_in_cost("umich", rent=1000, security_deposit=500,
                      application_fee=0, extras=100)  # total 1600
```

Ask for actual listing charges; legal caps are not typical estimates. Caller overrides use the same payment basis as the input rent; the move-in helper does not split costs.

A commute limit with missing candidate times raises `ValueError` naming the neighborhoods. Supply `commute_minutes={"Oxbridge": 20}` with `commute_method="bus"`, or omit the commute limit to search rent only. Overrides must reflect the student's actual origin/destination and travel method.

For driving, supply an explicit monthly budget including parking via `estimate_commute_cost(..., monthly_cost=250)` or `estimate_true_monthly_cost(..., commute="car", commute_monthly_cost=250)`. The example amount is illustrative, not a campus benchmark. Without a supplied budget or complete stored range, the existing missing-data error remains.

Ask for apartment rent, bedroom count (`bedrooms=0` for studio), roommate count, month, and transport method. Only two-occupant 50/50 sharing is approved; other roommate arrangements need their own shares. Catch missing-data `ValueError` exceptions and surface the missing input in Movin instead of inserting a fabricated value.

No further research is required to begin integration: use the available monthly estimate, retain assumption labels, and ask for unresolved listing-specific details. Range-aware rent helpers and explicit missing-data returns are implemented on this branch.

### Verification limits

Run `python -m unittest discover -s tests -v` from the repository root. The 35 passing tests cover supplied data, sharing assumptions, itemized totals, range-based filtering, open bounds, explicit commute overrides, and incomplete move-in estimates. They do not establish real listing prices or fill missing research data.

# UMich campus estimates

Offline data and Python helpers for Movin. Requires Python 3.10+ and no third-party packages.

## Supported scope

- Five areas with supplied rent ranges: Kerrytown, Burns Park, Oxbridge, Glazier Way / North Side, and Downtown/Campus.
- Whole-apartment and shared per-person ranges for one, two, and three-plus bedrooms.
- Seasonal apartment utility estimates excluding internet, with studio using the one-bedroom utility group.
- Internet, renters insurance, and groceries under the recorded modeling assumptions.
- Walking/biking cost assumptions and bus fares for eligible U-M students.
- Populated campus identity and supplied academic dates.

Commute times and commute filtering have been removed. Areas without rent data and empty median columns are removed. Campus defaults for deposits, application fees, parking, driving costs, lease-start windows, county, and summer income gaps are removed. Generic rent averages with unspecified sharing basis and overlapping utility averages are also removed.

Listing-specific move-in costs belong in the finance engine using actual user inputs. Removing campus estimates does not mean those expenses are zero. Monthly totals below cover only the returned items; they are not a complete housing affordability forecast.

## Examples

```python
from campus.loader import (
    get_campus_profile, get_rent_benchmark,
    find_neighborhoods_in_budget, estimate_true_monthly_cost,
)

print(get_campus_profile("umich"))
print(get_rent_benchmark("umich", bedrooms=1))
# {'low': 825.0, 'high': 2550.0}

matches = find_neighborhoods_in_budget("umich", max_rent=1000, bedrooms=1)
print([row.neighborhood for row in matches])
# ['Oxbridge'] -- potential range overlap, not a confirmed listing

cost = estimate_true_monthly_cost(
    "umich", rent=2600, roommates=1,
    commute="bus", month="january", bedrooms=2,
)
print(cost["total"])
# {'low': 1880.5, 'expected': 1910.5, 'high': 1940.5}
```

## Contract and assumptions

`CampusProfile` contains `id`, `name`, `city`, `state`, `term_start_dates`, and `student_fare_notes`.

`Neighborhood` contains `neighborhood`, `notes`, `source`, and `rent_ranges`. Range keys are `1`, `2`, `3_plus`, `shared_1`, `shared_2`, and `shared_3_plus`. Each has `low`, `high`, and `high_lower_bound`. An explicitly open price such as `4500+` retains `high=None` and `high_lower_bound=4500`; no finite maximum is invented. This is a supplied open range, not an empty data placeholder.

`get_rent_benchmark` returns low/high across the available neighborhood ranges. It no longer returns a fabricated or empty median. An open upper range propagates as `high=None`.

`find_neighborhoods_in_budget` accepts campus ID, maximum rent, bedroom count, and optional `shared=True`. A match means the supplied range starts within budget; a particular available listing may cost more. Shared prices are already per person and are not divided again. No travel time claim is made. Studio rent ranges are not supplied, so the rent helpers require at least one bedroom.

`estimate_true_monthly_cost` takes whole-apartment rent. Its itemized output is per person. Equal sharing is approved only for two occupants; insurance is per person. Fixed groceries are a household modeling assumption. When integrating with transaction forecasts, avoid adding these groceries on top of predicted grocery spending.

`estimate_commute_cost` supports only walk, bike, and bus. Walking/biking zero costs represent the supplied direct-travel assumptions, not equipment or maintenance budgets. Free bus fares apply only to eligible active U-M students with yellow MCard on TheRide fixed routes. The caller must check that eligibility before selecting bus.

Costs are estimates, not guaranteed quotes. Utility modeling caps, fixed averages, and midpoint assumptions retain their labels. The existing generic confidence/placeholder status remains conservative; it is not independent verification of listing prices. Source notes and research dates are in `data/sources.md`.

## API changes from the earlier draft

- Removed `max_commute_min`, `commute_method`, and `commute_minutes` from neighborhood search.
- Removed `estimate_move_in_cost` and campus deposit/fee defaults.
- Removed car and supplied car-budget overrides from the campus helper.
- Removed empty legacy profile and neighborhood fields.
- Preserved existing supplied rent endpoints and supported cost assumptions.

Earlier requirements in `data/docs/PRD-campus-data.md` are background; this README describes the current reduced scope.

## Tests

```sh
python3 -m unittest discover -s tests -v
```

27 tests cover the current scope, supplied rent endpoints, cost sums, sharing rules, validation, and removal of unsupported features. Tests do not verify source prices against live listings.

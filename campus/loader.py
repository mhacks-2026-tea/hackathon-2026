"""Supported campus estimates only; listing-specific move-in costs live elsewhere."""
from dataclasses import dataclass, field
from typing import Optional
from pathlib import Path
import calendar
import csv
import json
import math

DATA_DIR = Path(__file__).resolve().parent.parent / 'data'


@dataclass(frozen=True)
class CampusProfile:
    id: str
    name: str
    city: str
    state: str
    term_start_dates: dict
    student_fare_notes: str


@dataclass(frozen=True)
class Neighborhood:
    neighborhood: str
    notes: str
    source: str
    rent_ranges: dict = field(default_factory=dict)


def get_campus_profile(campus_id: str) -> CampusProfile:
    """Expose populated identity and academic metadata without empty placeholders."""
    data = _load_cost_data(campus_id)
    for name in ('id', 'name', 'city', 'state', 'student_fare_notes'):
        if not isinstance(data.get(name), str) or not data[name].strip():
            raise ValueError(f'Missing or invalid {name}')
    if data['id'] != campus_id:
        raise ValueError('id must match requested campus')
    if not isinstance(data.get('term_start_dates'), dict):
        raise ValueError('Missing or invalid term_start_dates')
    return CampusProfile(**{key: data[key] for key in CampusProfile.__dataclass_fields__})


def _rent_endpoint(text: str, name: str) -> Optional[float]:
    """Parse an endpoint without interpreting an open bound as a maximum."""
    if not text:
        return None
    try:
        value = float(text.removesuffix('+'))
    except ValueError as exc:
        raise ValueError(f'{name}: invalid rent endpoint') from exc
    return _nonnegative_number(value, name)


def list_neighborhoods(campus_id: str) -> list[Neighborhood]:
    """Load the five populated areas; commute-time columns are not part of this API."""
    if not campus_id or Path(campus_id).name != campus_id or campus_id in {'.', '..'}:
        raise ValueError('Invalid campus ID')
    path = DATA_DIR / 'neighborhoods' / f'{campus_id}_neighborhoods.csv'
    with path.open(encoding='utf-8-sig', newline='') as stream:
        reader = csv.DictReader(stream)
        headers = reader.fieldnames or []
        for name in ('neighborhood', 'source', 'rent_1_bedroom_low', 'rent_1_bedroom_high'):
            if name not in headers:
                raise ValueError(f'Missing column {name}')
        if len(headers) != len(set(headers)):
            raise ValueError('Duplicate CSV columns')
        result = []
        for row in reader:
            if None in row:
                raise ValueError('CSV row has extra cells')
            name = (row.get('neighborhood') or '').strip()
            if not name:
                continue
            ranges = {}
            for group in ('1', '2', '3_plus'):
                for shared in (False, True):
                    prefix = f'shared_{group}_bedroom_per_person' if shared else f'rent_{group}_bedroom'
                    low_text = (row.get(prefix + '_low') or '').strip()
                    high_text = (row.get(prefix + '_high') or '').strip()
                    if not low_text and not high_text:
                        continue
                    low = _rent_endpoint(low_text, prefix + '_low')
                    high = _rent_endpoint(high_text, prefix + '_high')
                    if low is None or high is None or low_text.endswith('+') or low > high:
                        raise ValueError(f'{prefix}: require complete ordered endpoints')
                    ranges[('shared_' if shared else '') + group] = {
                        'low': low, 'high': None if high_text.endswith('+') else high,
                        'high_lower_bound': high if high_text.endswith('+') else None,
                    }
            if ranges:
                result.append(Neighborhood(name, row.get('notes') or '', row.get('source') or '', ranges))
        return result


def _range_key(bedrooms: int, shared: bool) -> str:
    """The source groups three or more bedrooms; it supplies no studio rent range."""
    if isinstance(bedrooms, bool) or not isinstance(bedrooms, int) or bedrooms < 1:
        raise ValueError('bedrooms must be a positive integer')
    if not isinstance(shared, bool):
        raise ValueError('shared must be a boolean')
    return ('shared_' if shared else '') + (str(bedrooms) if bedrooms <= 2 else '3_plus')


def get_rent_benchmark(campus_id: str, bedrooms: int, shared: bool = False) -> dict:
    """Summarize supplied ranges, without manufacturing a median or finite cap."""
    key = _range_key(bedrooms, shared)
    ranges = [row.rent_ranges[key] for row in list_neighborhoods(campus_id) if key in row.rent_ranges]
    if not ranges:
        raise ValueError('No supplied rent ranges for this bedroom group')
    highs = [value['high'] for value in ranges]
    return {'low': min(value['low'] for value in ranges),
            'high': max(highs) if all(value is not None for value in highs) else None}


def find_neighborhoods_in_budget(
    campus_id: str, max_rent: float, bedrooms: int, *, shared: bool = False,
) -> list[Neighborhood]:
    """Return potential rent matches, with no commute-time claim or filter.

    A range starting within budget does not guarantee a listing at that price.
    Shared endpoints already represent per-person prices and are not divided.
    """
    _nonnegative_number(max_rent, 'max_rent')
    key = _range_key(bedrooms, shared)
    return [row for row in list_neighborhoods(campus_id)
            if key in row.rent_ranges and row.rent_ranges[key]['low'] <= max_rent]


def _load_cost_data(campus_id: str) -> dict:
    """Read cost data without requiring unrelated calendar metadata."""
    if not campus_id or Path(campus_id).name != campus_id or campus_id in {'.', '..'}:
        raise ValueError(f'Invalid campus ID: {campus_id!r}')
    path = DATA_DIR / 'campuses' / f'{campus_id}.json'
    try:
        with path.open(encoding='utf-8') as stream:
            data = json.load(stream)
    except FileNotFoundError as exc:
        raise ValueError(f'Campus profile not found: {path}') from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f'{path}: invalid JSON: {exc.msg}') from exc
    if not isinstance(data, dict):
        raise ValueError(f'{path}: profile must be a JSON object')
    return data


def _nonnegative_number(value, field: str) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
        raise ValueError(f'{field} must be a finite nonnegative number')
    return value


def _cost_range(data, field: str) -> dict[str, float]:
    if not isinstance(data, dict):
        raise ValueError(f'Missing cost range {field!r}: provide low, expected, and high in the campus data file; a point or placeholder cannot supply a range')
    result = {}
    for key in ('low', 'expected', 'high'):
        if key not in data or data[key] is None:
            raise ValueError(f'Missing required field {field}.{key!s}')
        result[key] = _nonnegative_number(data[key], f'{field}.{key}')
    if not result['low'] <= result['expected'] <= result['high']:
        raise ValueError(f'{field}: require low <= expected <= high')
    return result


def estimate_utilities(
    campus_id: str, month: str, bedrooms: int, roommates: int
) -> dict[str, Optional[float]]:
    """Return monthly per-person utilities using the stored bedroom group.

    Apartment costs exclude internet. No roommates requires no sharing rule.
    With roommates, equal sharing must be explicitly selected in the data.
    A null high preserves an open-ended supplied upper price; expected uses
    the user's approved midpoint, already stored in the data file.
    """
    if not isinstance(month, str) or month.lower() not in [m.lower() for m in list(calendar.month_name)[1:]]:
        raise ValueError('month must be a full month name, such as january')
    if isinstance(bedrooms, bool) or not isinstance(bedrooms, int) or bedrooms < 0:
        raise ValueError('bedrooms must be a nonnegative integer; zero means studio')
    if isinstance(roommates, bool) or not isinstance(roommates, int) or roommates < 0:
        raise ValueError('roommates must be a nonnegative integer')
    data = _load_cost_data(campus_id)
    month = month.lower()
    ranges = data.get('utility_ranges_by_month')
    if not isinstance(ranges, dict) or not isinstance(ranges.get(month), dict):
        raise ValueError(f'Missing utility_ranges_by_month.{month}: provide household low/expected/high ranges by bedroom count')
    group = str(max(bedrooms, 1))
    if group not in ranges[month] and bedrooms > 2:
        group = '3_plus'
    field = f'utility_ranges_by_month.{month}.{group}'
    raw = ranges[month].get(group)
    if not isinstance(raw, dict):
        raise ValueError(f'Missing cost range {field!r}')
    for key in ('low', 'expected', 'high'):
        if key not in raw:
            raise ValueError(f'Missing required field {field}.{key}')
    if raw['high'] is None:
        lower = _nonnegative_number(raw.get('high_lower_bound'), f'{field}.high_lower_bound')
        low = _nonnegative_number(raw['low'], f'{field}.low')
        expected = _nonnegative_number(raw['expected'], f'{field}.expected')
        if not low <= expected <= lower:
            raise ValueError(f'{field}: require low <= expected <= high_lower_bound')
        household = {'low': low, 'expected': expected, 'high': None}
    else:
        household = _cost_range(raw, field)
    if roommates and data.get('utility_split') != 'equal':
        raise ValueError('Utility shares are user-defined: provide the agreed shares; an equal split cannot be assumed')
    sharing_occupants = data.get('utility_sharing_occupants')
    if roommates and sharing_occupants is not None and roommates + 1 != sharing_occupants:
        raise ValueError('Utility sharing is approved only for the configured number of occupants')
    divisor = roommates + 1
    return {key: None if value is None else value / divisor
            for key, value in household.items()}


def estimate_commute_cost(
    campus_id: str, method: str
) -> dict[str, float]:
    """Return the supplied monthly travel cost for walk, bike, or eligible bus riders.

    Required data: commute_cost_ranges[method] with low/expected/high.
    Bus cost applies only to eligible U-M yellow MCard users on fixed routes.
    """
    if not isinstance(method, str) or method.lower() not in ('walk', 'bike', 'bus'):
        raise ValueError('method must be walk, bike, or bus')
    method = method.lower()
    data = _load_cost_data(campus_id)
    ranges = data.get('commute_cost_ranges')
    if not isinstance(ranges, dict):
        raise ValueError(f'Missing commute_cost_ranges.{method}: provide monthly low/expected/high values; bus_pass and parking placeholders cannot establish commute ranges')
    return _cost_range(ranges.get(method), f'commute_cost_ranges.{method}')


# Combine recurring costs into per-person line items and matching total ranges.
# Move-in deposits and fees are separate one-time costs, not monthly expenses.
def estimate_true_monthly_cost(
    campus_id: str, rent: float, roommates: int = 0,
    commute: str = "bus", month: Optional[str] = None,
    *, bedrooms: Optional[int] = None
) -> dict:
    """Return items, total low/expected/high, and generic confidence.

    Rent is whole-apartment monthly rent supplied by the caller.
    Required data:
      bedrooms: per-apartment keyword input; zero means studio.
        Legacy monthly_cost_config.bedrooms is accepted if already present.
      monthly_cost_config.basis: rent/internet/renters_insurance/groceries
        each marked 'household' (equal split) or 'per_person'
      monthly_cost_ranges: internet/renters_insurance/groceries ranges
    Utilities and supported travel costs come from their existing helpers.
    Driving, parking, deposits, and application fees are outside this subtotal.
    month=None uses the current local calendar month.
    Missing ranges or sharing assumptions raise clear errors, not estimates.
    A listing rent alone does not justify 'specific' confidence for all costs.
    """
    from datetime import date

    rent = _nonnegative_number(rent, 'rent')
    if isinstance(roommates, bool) or not isinstance(roommates, int) or roommates < 0:
        raise ValueError('roommates must be a nonnegative integer')
    data = _load_cost_data(campus_id)
    config = data.get('monthly_cost_config')
    if not isinstance(config, dict):
        raise ValueError('Missing monthly_cost_config: provide bedrooms and cost basis/sharing rules in the campus data file')
    if bedrooms is None:
        bedrooms = config.get('bedrooms')
    if isinstance(bedrooms, bool) or not isinstance(bedrooms, int) or bedrooms < 0:
        raise ValueError('Missing or invalid bedrooms: supply the apartment bedroom count; zero means studio')
    sharing_occupants = config.get('sharing_occupants')
    if roommates and sharing_occupants is not None and roommates + 1 != sharing_occupants:
        raise ValueError('Sharing is approved only for the configured number of occupants')
    basis = config.get('basis')
    if not isinstance(basis, dict):
        raise ValueError('Missing monthly_cost_config.basis: provide household or per_person for each recurring cost')
    for name in ('rent', 'internet', 'renters_insurance', 'groceries'):
        if basis.get(name) not in ('household', 'per_person'):
            raise ValueError(f'Missing or invalid monthly_cost_config.basis.{name}: require household or per_person')
    if basis['rent'] != 'household':
        raise ValueError('monthly_cost_config.basis.rent must be household: the input rent is whole-apartment rent')
    ranges = data.get('monthly_cost_ranges')
    if not isinstance(ranges, dict):
        raise ValueError('Missing monthly_cost_ranges: provide low/expected/high for internet, renters_insurance, and groceries')
    status = data.get('data_status', 'placeholder')
    if status not in ('placeholder', 'verified'):
        raise ValueError("data_status must be 'placeholder' or 'verified'")
    if month is None:
        month = calendar.month_name[date.today().month].lower()
    occupants = roommates + 1
    items = {
        'rent': {key: rent / occupants for key in ('low', 'expected', 'high')},
        'utilities': estimate_utilities(campus_id, month, bedrooms, roommates),
    }
    for name in ('internet', 'renters_insurance', 'groceries'):
        cost = _cost_range(ranges.get(name), f'monthly_cost_ranges.{name}')
        divisor = occupants if basis[name] == 'household' else 1
        items[name] = {key: value / divisor for key, value in cost.items()}
    items['commute'] = estimate_commute_cost(campus_id, commute)
    if any(item.get('high') is None for item in items.values()):
        raise ValueError('Cannot produce a finite monthly high total: a component has an open-ended upper range')
    total = {
        key: sum(item[key] for item in items.values())
        for key in ('low', 'expected', 'high')
    }
    if not all(math.isfinite(value) for value in total.values()):
        raise ValueError('Monthly total exceeds the supported numeric range')
    return {
        'items': items, 'total': total, 'confidence': 'generic',
        'data_status': status,
        'assumptions': data.get('monthly_cost_assumptions', ''),
    }

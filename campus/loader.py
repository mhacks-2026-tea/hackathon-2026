"""Data shapes for campus profiles and neighborhood records."""
from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class CampusProfile:
    id: str
    name: str
    city: str
    county: str
    term_start_dates: dict[str, Optional[str]]
    typical_lease_start_window: dict[str, Optional[str]]
    summer_income_gap_months: float
    monthly_utilities_by_month: dict[str, float]
    internet: float
    renters_insurance: float
    groceries: float
    security_deposit_months: float
    application_fee: float
    parking: float
    bus_pass: float
    student_fare_notes: str


@dataclass(frozen=True)
class Neighborhood:
    neighborhood: str
    type: Optional[str]
    median_1_bedroom_rent: Optional[float]
    median_2_bedroom_rent: Optional[float]
    rent_per_bedroom_shared: Optional[float]
    walk_minutes: Optional[float]
    bike_minutes: Optional[float]
    bus_minutes: Optional[float]
    notes: Optional[str]
    source: Optional[str]


"""Offline loading and validation; blank CSV cells remain None."""
import calendar
import csv
import json
import math
from statistics import median
from dataclasses import fields
from pathlib import Path


DATA_DIR = Path(__file__).resolve().parent.parent / 'data'


def get_campus_profile(campus_id: str) -> CampusProfile:
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
    for field in fields(CampusProfile):
        if field.name not in data:
            raise ValueError(f'{path}: missing required field {field.name!r}')
    for name in ('id', 'name', 'city', 'county', 'student_fare_notes'):
        if not isinstance(data[name], str):
            raise ValueError(f'{path}: field {name!r} must be text')
    if data['id'] != campus_id:
        raise ValueError(f'{path}: field \'id\' must match {campus_id!r}')
    for name in ('term_start_dates', 'typical_lease_start_window'):
        if not isinstance(data[name], dict):
            raise ValueError(f'{path}: field {name!r} must be an object')
    for name in ('summer_income_gap_months', 'internet', 'renters_insurance',
                 'groceries', 'security_deposit_months', 'application_fee',
                 'parking', 'bus_pass'):
        value = data[name]
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
            raise ValueError(f'{path}: field {name!r} must be a finite nonnegative number')
    utilities = data['monthly_utilities_by_month']
    if not isinstance(utilities, dict):
        raise ValueError(f'{path}: field \'monthly_utilities_by_month\' must be an object')
    for month in list(calendar.month_name)[1:]:
        key = month.lower()
        field = f'monthly_utilities_by_month.{key}'
        if key not in utilities:
            raise ValueError(f'{path}: missing required field {field!r}')
        value = utilities[key]
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
            raise ValueError(f'{path}: field {field!r} must be a finite nonnegative number')
    return CampusProfile(**{field.name: data[field.name] for field in fields(CampusProfile)})


def list_neighborhoods(campus_id: str) -> list[Neighborhood]:
    if not campus_id or Path(campus_id).name != campus_id or campus_id in {'.', '..'}:
        raise ValueError(f'Invalid campus ID: {campus_id!r}')
    path = DATA_DIR / 'neighborhoods' / f'{campus_id}_neighborhoods.csv'
    try:
        stream = path.open(encoding='utf-8-sig', newline='')
    except FileNotFoundError as exc:
        raise ValueError(f'Neighborhood file not found: {path}') from exc
    with stream:
        reader = csv.DictReader(stream)
        required = [field.name for field in fields(Neighborhood)
                    if field.name not in {'type', 'notes'}]
        for name in required:
            if name not in (reader.fieldnames or []):
                raise ValueError(f'{path}: missing required column {name!r}')
        if len(reader.fieldnames) != len(set(reader.fieldnames)):
            raise ValueError(f'{path}: duplicate column names')
        result = []
        numeric = {'median_1_bedroom_rent', 'median_2_bedroom_rent',
                   'rent_per_bedroom_shared', 'walk_minutes', 'bike_minutes', 'bus_minutes'}
        for row in reader:
            if None in row:
                raise ValueError(f'{path}: row {reader.line_num} has extra cells')
            values = {}
            for field in fields(Neighborhood):
                name = field.name
                text = (row.get(name) or '').strip()
                value = text or None
                if text and name in numeric:
                    try:
                        value = float(text)
                    except ValueError as exc:
                        raise ValueError(f'{path}: row {reader.line_num}: field {name!r} must be numeric or blank') from exc
                    if not math.isfinite(value) or value < 0:
                        raise ValueError(f'{path}: row {reader.line_num}: field {name!r} must be finite and nonnegative')
                values[name] = value
            if values['neighborhood'] is None:
                continue
            result.append(Neighborhood(**values))
        return result


def get_rent_benchmark(
    campus_id: str, bedrooms: int, shared: bool = False
) -> dict[str, Optional[float]]:
    """Return min/median/max of available neighborhood rent medians.

    These describe the spread of neighborhood medians, not listing-level
    bounds or a HUD baseline. Missing and zero placeholder rents are excluded.
    Shared mode uses the recorded per-bedroom shared rent without deriving
    an unsupported estimate from whole-unit rent.
    """
    if isinstance(bedrooms, bool) or not isinstance(bedrooms, int) or bedrooms not in (1, 2):
        raise ValueError('bedrooms must be 1 or 2; no other bedroom rent columns are available')
    if not isinstance(shared, bool):
        raise ValueError('shared must be a boolean')
    column = 'rent_per_bedroom_shared' if shared else f'median_{bedrooms}_bedroom_rent'
    rents = [
        rent for neighborhood in list_neighborhoods(campus_id)
        if (rent := getattr(neighborhood, column)) is not None and rent > 0
    ]
    if not rents:
        return {'low': None, 'median': None, 'high': None}
    return {'low': min(rents), 'median': median(rents), 'high': max(rents)}


def find_neighborhoods_in_budget(
    campus_id: str, max_rent: float, bedrooms: int, max_commute_min: float
) -> list[Neighborhood]:
    """Find whole-unit rents within budget with at least one feasible commute.

    Commute means the shortest available walk, bike, or bus time.
    Missing or zero placeholder rents and missing commute times are skipped.
    Incomplete unrelated fields do not exclude an otherwise usable record.
    """
    if isinstance(bedrooms, bool) or not isinstance(bedrooms, int) or bedrooms not in (1, 2):
        raise ValueError('bedrooms must be 1 or 2; no other bedroom rent columns are available')
    for name, value in (('max_rent', max_rent), ('max_commute_min', max_commute_min)):
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
            raise ValueError(f'{name} must be a finite nonnegative number')
    column = f'median_{bedrooms}_bedroom_rent'
    matches = []
    for neighborhood in list_neighborhoods(campus_id):
        rent = getattr(neighborhood, column)
        if rent is None or rent <= 0 or rent > max_rent:
            continue
        times = [
            time for time in (
                neighborhood.walk_minutes, neighborhood.bike_minutes,
                neighborhood.bus_minutes
            ) if time is not None
        ]
        if times and min(times) <= max_commute_min:
            matches.append(neighborhood)
    return matches


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
) -> dict[str, float]:
    """Return per-person monthly utility ranges from explicit household ranges.

    Required data: utility_ranges_by_month[month][str(bedrooms)] containing
    low/expected/high, and utility_split='equal'. Roommates means other
    occupants, so an explicitly approved equal split uses roommates + 1.
    Internet is separate and is not silently included.
    """
    if not isinstance(month, str) or month.lower() not in [m.lower() for m in list(calendar.month_name)[1:]]:
        raise ValueError('month must be a full month name, such as january')
    if isinstance(bedrooms, bool) or not isinstance(bedrooms, int) or bedrooms <= 0:
        raise ValueError('bedrooms must be a positive integer')
    if isinstance(roommates, bool) or not isinstance(roommates, int) or roommates < 0:
        raise ValueError('roommates must be a nonnegative integer')
    data = _load_cost_data(campus_id)
    month = month.lower()
    ranges = data.get('utility_ranges_by_month')
    if not isinstance(ranges, dict) or not isinstance(ranges.get(month), dict):
        raise ValueError(f'Missing utility_ranges_by_month.{month}: provide household low/expected/high ranges by bedroom count; monthly_utilities_by_month contains only point placeholders')
    monthly = ranges[month]
    household = _cost_range(monthly.get(str(bedrooms)), f'utility_ranges_by_month.{month}.{bedrooms}')
    if data.get('utility_split') != 'equal':
        raise ValueError("Missing or unsupported utility_split: record 'equal' in the data file only after confirming equal sharing")
    return {key: value / (roommates + 1) for key, value in household.items()}


def estimate_move_in_cost(campus_id: str, rent: float, extras: float = 0) -> dict:
    """Return deposit, first month, application fee, extras, and their total.

    No range is inferred. Existing data placeholders are preserved in the
    arithmetic and explicitly labeled, so this is not a verified estimate.
    data_status may be set to 'verified' only after data research/source logging.
    """
    rent = _nonnegative_number(rent, 'rent')
    extras = _nonnegative_number(extras, 'extras')
    data = _load_cost_data(campus_id)
    for field in ('security_deposit_months', 'application_fee'):
        if field not in data:
            raise ValueError(f'Missing required field {field!r}')
        _nonnegative_number(data[field], field)
    status = data.get('data_status', 'placeholder')
    if status not in ('placeholder', 'verified'):
        raise ValueError("data_status must be 'placeholder' or 'verified'")
    items = {
        'security_deposit': rent * data['security_deposit_months'],
        'first_month_rent': rent,
        'application_fee': data['application_fee'],
        'extras': extras,
    }
    total = sum(items.values())
    if not math.isfinite(total):
        raise ValueError('Move-in total exceeds the supported numeric range')
    return {'items': items, 'total': total, 'data_status': status}


def estimate_commute_cost(campus_id: str, method: str) -> dict[str, float]:
    """Return an explicit monthly commute range for walk/bike/bus/car.

    Required data: commute_cost_ranges[method] with low/expected/high.
    No free walking/biking, student fares, or car operating costs are assumed.
    """
    if not isinstance(method, str) or method.lower() not in ('walk', 'bike', 'bus', 'car'):
        raise ValueError('method must be walk, bike, bus, or car')
    method = method.lower()
    data = _load_cost_data(campus_id)
    ranges = data.get('commute_cost_ranges')
    if not isinstance(ranges, dict):
        raise ValueError(f'Missing commute_cost_ranges.{method}: provide monthly low/expected/high values; bus_pass and parking placeholders cannot establish commute ranges')
    return _cost_range(ranges.get(method), f'commute_cost_ranges.{method}')

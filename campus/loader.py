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
        required = [field.name for field in fields(Neighborhood)]
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
            for name in required:
                if row[name] is None:
                    raise ValueError(f'{path}: row {reader.line_num}: missing cell {name!r}')
                text = row[name].strip()
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
                raise ValueError(f'{path}: row {reader.line_num}: field \'neighborhood\' must not be blank')
            result.append(Neighborhood(**values))
        return result

"""PRD checks. Synthetic fixtures test logic, never represent UMich prices.

Run from the repository root:
    python -m unittest discover -s tests -v

Data acceptance checks intentionally fail until the real files meet the PRD.
"""
import ast
import csv
import io
import json
import re
import unittest
from dataclasses import fields
from pathlib import Path
from unittest.mock import patch

from campus import loader


def synthetic_profile():
    """Arbitrary test inputs only; never copied to production data."""
    data = {
        'id': 'test', 'name': 'Test campus', 'city': 'Test city', 'county': '',
        'term_start_dates': {}, 'typical_lease_start_window': {},
        'student_fare_notes': '', 'summer_income_gap_months': 0,
        'monthly_utilities_by_month': {
            month.lower(): 0 for month in list(loader.calendar.month_name)[1:]
        },
        'internet': 0, 'renters_insurance': 0, 'groceries': 0,
        'security_deposit_months': 2, 'application_fee': 30,
        'parking': 0, 'bus_pass': 0, 'data_status': 'placeholder',
        'utility_split': 'equal',
        'utility_ranges_by_month': {
            'january': {'1': {'low': 60, 'expected': 90, 'high': 120}},
            'april': {'1': {'low': 30, 'expected': 45, 'high': 60}},
            'july': {'1': {'low': 50, 'expected': 75, 'high': 100}},
        },
        'monthly_cost_config': {
            'bedrooms': 1,
            'basis': {
                'rent': 'household', 'internet': 'household',
                'renters_insurance': 'per_person', 'groceries': 'per_person',
            },
        },
        'monthly_cost_ranges': {
            'internet': {'low': 10, 'expected': 20, 'high': 30},
            'renters_insurance': {'low': 5, 'expected': 10, 'high': 15},
            'groceries': {'low': 20, 'expected': 30, 'high': 40},
        },
        'commute_cost_ranges': {
            method: {'low': 10, 'expected': 20, 'high': 30}
            for method in ('walk', 'bike', 'bus', 'car')
        },
    }
    return data


class LogicTests(unittest.TestCase):
    def test_all_contract_functions_exist(self):
        for name in (
            'get_campus_profile', 'list_neighborhoods', 'get_rent_benchmark',
            'estimate_utilities', 'estimate_move_in_cost', 'estimate_commute_cost',
            'estimate_true_monthly_cost', 'find_neighborhoods_in_budget',
        ):
            self.assertTrue(callable(getattr(loader, name, None)), name)

    def test_each_missing_profile_field_is_named(self):
        for field in fields(loader.CampusProfile):
            data = synthetic_profile()
            del data[field.name]
            with self.subTest(field=field.name), patch.object(
                loader.Path, 'open', return_value=io.StringIO(json.dumps(data))
            ):
                with self.assertRaisesRegex(ValueError, re.escape(field.name)):
                    loader.get_campus_profile('test')

    def test_profile_shape_and_zero_placeholders(self):
        data = synthetic_profile()
        with patch.object(loader.Path, 'open', return_value=io.StringIO(json.dumps(data))):
            profile = loader.get_campus_profile('test')
        self.assertIsInstance(profile, loader.CampusProfile)
        self.assertEqual(profile.internet, 0)

    def test_missing_utility_month_is_named(self):
        data = synthetic_profile()
        del data['monthly_utilities_by_month']['january']
        with patch.object(loader.Path, 'open', return_value=io.StringIO(json.dumps(data))):
            with self.assertRaisesRegex(ValueError, 'monthly_utilities_by_month.january'):
                loader.get_campus_profile('test')

    def test_missing_csv_header_is_named(self):
        with patch.object(loader.Path, 'open', return_value=io.StringIO('neighborhood\nTest\n')):
            with self.assertRaisesRegex(ValueError, 'median_1_bedroom_rent'):
                loader.list_neighborhoods('test')

    def test_blank_and_short_rows_do_not_become_zero(self):
        text = (
            'neighborhood,median_1_bedroom_rent,median_2_bedroom_rent,'
            'rent_per_bedroom_shared,walk_minutes,bike_minutes,bus_minutes,source\n'
            'Empty,,,,,,,\n'
            'Short\n'
        )
        with patch.object(loader.Path, 'open', side_effect=lambda *a, **k: io.StringIO(text)):
            rows = loader.list_neighborhoods('test')
            self.assertEqual(len(rows), 2)
            self.assertIsNone(rows[0].median_1_bedroom_rent)
            self.assertIsNone(rows[1].bus_minutes)
            self.assertEqual(loader.find_neighborhoods_in_budget('test', 999, 1, 999), [])
            self.assertEqual(loader.get_rent_benchmark('test', 1),
                             {'low': None, 'median': None, 'high': None})

    def test_rent_and_budget_boundaries(self):
        text = (
            'neighborhood,median_1_bedroom_rent,median_2_bedroom_rent,'
            'rent_per_bedroom_shared,walk_minutes,bike_minutes,bus_minutes,source\n'
            'A,100,200,50,20,,,test\n'
            'B,300,400,150,,,10,test\n'
            'No commute,200,,100,,,,test\n'
            'Zero placeholder,0,,0,0,,,test\n'
        )
        with patch.object(loader.Path, 'open', side_effect=lambda *a, **k: io.StringIO(text)):
            self.assertEqual(loader.get_rent_benchmark('test', 1),
                             {'low': 100, 'median': 200, 'high': 300})
            self.assertEqual(loader.get_rent_benchmark('test', 2, shared=True),
                             {'low': 50, 'median': 100, 'high': 150})
            self.assertEqual(loader.get_rent_benchmark('test', 2),
                             {'low': 200, 'median': 300, 'high': 400})
            self.assertEqual(loader.find_neighborhoods_in_budget('test', 0, 1, 999), [])
            matches = loader.find_neighborhoods_in_budget('test', 100, 1, 20)
            self.assertEqual([row.neighborhood for row in matches], ['A'])
            self.assertEqual(len(loader.find_neighborhoods_in_budget('test', 999, 1, 999)), 2)

    def test_move_in_total_and_shape(self):
        with patch.object(loader, '_load_cost_data', return_value=synthetic_profile()):
            result = loader.estimate_move_in_cost('test', 100, extras=5)
        self.assertEqual(result['items'],
                         {'security_deposit': 200, 'first_month_rent': 100,
                          'application_fee': 30, 'extras': 5})
        self.assertEqual(result['total'], 335)
        self.assertEqual(result['total'], sum(result['items'].values()))
        self.assertEqual(result['data_status'], 'placeholder')

    def test_utilities_ranges_and_roommates(self):
        with patch.object(loader, '_load_cost_data', return_value=synthetic_profile()):
            self.assertEqual(loader.estimate_utilities('test', 'January', 1, 2),
                             {'low': 20, 'expected': 30, 'high': 40})

    def test_commute_methods(self):
        with patch.object(loader, '_load_cost_data', return_value=synthetic_profile()):
            for method in ('walk', 'bike', 'bus', 'car'):
                self.assertEqual(loader.estimate_commute_cost('test', method),
                                 {'low': 10, 'expected': 20, 'high': 30})

    def test_monthly_items_totals_and_helper_calls(self):
        with patch.object(loader, '_load_cost_data', return_value=synthetic_profile()), \
             patch.object(loader, 'estimate_utilities', wraps=loader.estimate_utilities) as utilities, \
             patch.object(loader, 'estimate_commute_cost', wraps=loader.estimate_commute_cost) as commute:
            result = loader.estimate_true_monthly_cost('test', 100, 1, 'bus', 'january')
            utilities.assert_called_once_with('test', 'january', 1, 1)
            commute.assert_called_once_with('test', 'bus')
        self.assertEqual(set(result['items']),
                         {'rent', 'utilities', 'internet', 'renters_insurance', 'groceries', 'commute'})
        self.assertEqual(result['total'], {'low': 120, 'expected': 165, 'high': 210})
        for key in ('low', 'expected', 'high'):
            self.assertEqual(result['total'][key],
                             sum(item[key] for item in result['items'].values()))
        self.assertEqual(result['confidence'], 'generic')
        self.assertEqual(result['data_status'], 'placeholder')

    def test_roommate_lowers_per_person_monthly_cost(self):
        with patch.object(loader, '_load_cost_data', return_value=synthetic_profile()):
            alone = loader.estimate_true_monthly_cost('test', 100, 0, month='january')
            shared = loader.estimate_true_monthly_cost('test', 100, 1, month='january')
        for key in ('low', 'expected', 'high'):
            self.assertLess(shared['total'][key], alone['total'][key])

    def test_missing_ranges_are_not_inferred(self):
        data = synthetic_profile()
        del data['monthly_cost_ranges']['internet']['low']
        with patch.object(loader, '_load_cost_data', return_value=data):
            with self.assertRaisesRegex(ValueError, 'monthly_cost_ranges.internet.low'):
                loader.estimate_true_monthly_cost('test', 100, month='january')
        data = synthetic_profile()
        del data['utility_ranges_by_month']
        with patch.object(loader, '_load_cost_data', return_value=data):
            with self.assertRaisesRegex(ValueError, 'utility_ranges_by_month'):
                loader.estimate_utilities('test', 'january', 1, 0)

    def test_invalid_inputs_and_ranges(self):
        with patch.object(loader, '_load_cost_data', return_value=synthetic_profile()):
            for rent in (-1, float('nan'), float('inf'), True):
                with self.subTest(rent=rent), self.assertRaises(ValueError):
                    loader.estimate_true_monthly_cost('test', rent, month='january')
            with self.assertRaises(ValueError):
                loader.estimate_true_monthly_cost('test', 100, -1, month='january')
            with self.assertRaises(ValueError):
                loader.estimate_commute_cost('test', 'plane')
            with self.assertRaises(ValueError):
                loader._cost_range({'low': 30, 'expected': 20, 'high': 10}, 'test')

    def test_no_hardcoded_cost_constants(self):
        tree = ast.parse(Path(loader.__file__).read_text())
        for node in ast.walk(tree):
            if isinstance(node, ast.Constant) and type(node.value) in (int, float):
                self.assertIn(node.value, (0, 1, 2),
                              'Unexpected numeric literal; costs must come from data')
        # Allowed literals above are validation, bedroom counts, or occupant arithmetic.


class DataAcceptanceTests(unittest.TestCase):
    """Keep these checks unchanged when placeholder data fails them."""

    def test_actual_profile_loads(self):
        profile = loader.get_campus_profile('umich')
        self.assertEqual(profile.id, 'umich')

    def test_actual_neighborhoods_preserve_empty_cells(self):
        rows = loader.list_neighborhoods('umich')
        self.assertEqual(len(rows), 6)
        for row in rows:
            self.assertIsNone(row.median_1_bedroom_rent)
            self.assertIsNone(row.bus_minutes)

    def test_actual_low_budget_returns_empty(self):
        self.assertEqual(loader.find_neighborhoods_in_budget('umich', 0, 1, 0), [])

    def test_actual_monthly_total_is_sum(self):
        result = loader.estimate_true_monthly_cost('umich', 100, month='january')
        for key in ('low', 'expected', 'high'):
            self.assertEqual(result['total'][key],
                             sum(item[key] for item in result['items'].values()))

    def test_actual_seasonality(self):
        winter = loader.estimate_utilities('umich', 'january', 1, 0)
        spring = loader.estimate_utilities('umich', 'april', 1, 0)
        summer = loader.estimate_utilities('umich', 'july', 1, 0)
        self.assertGreater(winter['expected'], spring['expected'])
        self.assertGreater(summer['expected'], spring['expected'])

    def test_actual_roommate_reduces_cost(self):
        alone = loader.estimate_true_monthly_cost('umich', 100, 0, month='january')
        shared = loader.estimate_true_monthly_cost('umich', 100, 1, month='january')
        self.assertLess(shared['total']['expected'], alone['total']['expected'])

    def test_source_log_covers_numeric_data(self):
        path = loader.DATA_DIR / 'sources.md'
        self.assertTrue(path.exists(), 'Missing data/sources.md; no numeric values have source entries')
        text = path.read_text()
        # Source entries must identify the field, value, source, URL, and retrieval date.
        rows = [line for line in text.splitlines()
                if 'http' in line and re.search(r'\d{4}-\d{2}-\d{2}', line)]
        data = json.loads((loader.DATA_DIR / 'campuses/umich.json').read_text())
        pending = [('umich', data)]
        while pending:
            key, value = pending.pop()
            if isinstance(value, dict):
                pending.extend((f'{key}.{child}', item) for child, item in value.items())
            elif isinstance(value, list):
                pending.extend((f'{key}.{index}', item) for index, item in enumerate(value))
            elif type(value) in (int, float):
                self.assertTrue(any(key in row and str(value) in row for row in rows),
                                f'Missing source entry for {key} = {value}')
        with (loader.DATA_DIR / 'neighborhoods/umich_neighborhoods.csv').open(newline='') as stream:
            for record in csv.DictReader(stream):
                for key, value in record.items():
                    if key in ('neighborhood', 'type', 'notes', 'source') or not value:
                        continue
                    float(value)
                    label = f"umich.{record['neighborhood']}.{key}"
                    self.assertTrue(any(label in row and value in row for row in rows),
                                    f'Missing source entry for {label}')


if __name__ == '__main__':
    unittest.main()

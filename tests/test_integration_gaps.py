"""Regression checks for range-aware search and explicit missing-data handling."""
import io
import unittest
from unittest.mock import patch
from campus import loader


class IntegrationGapTests(unittest.TestCase):
    def test_supplied_ranges_are_used_without_inventing_medians(self):
        self.assertEqual(loader.get_rent_benchmark('umich', 1),
                         {'low': 825, 'high': 2550})
        self.assertEqual(loader.get_rent_benchmark('umich', 2, shared=True),
                         {'low': 700, 'high': 1750})

    def test_open_bounds_and_supplied_rounding_are_preserved(self):
        rows = {row.neighborhood: row for row in loader.list_neighborhoods('umich')}
        self.assertEqual(rows['Kerrytown'].rent_ranges['shared_3_plus'],
                         {'low': 833, 'high': None, 'high_lower_bound': 1500})
        self.assertIsNone(loader.get_rent_benchmark('umich', 4)['high'])

    def test_rent_only_search_returns_candidates_without_commute_claim(self):
        matches = loader.find_neighborhoods_in_budget('umich', 1000, 1)
        self.assertEqual([row.neighborhood for row in matches], ['Oxbridge'])
        self.assertFalse(hasattr(matches[0], 'bus_minutes'))
        self.assertEqual(matches[0].rent_ranges['1']['high'], 1200)

    def test_shared_search_does_not_split_twice(self):
        self.assertEqual([row.neighborhood for row in
                          loader.find_neighborhoods_in_budget('umich', 700, 2, shared=True)], ['Oxbridge'])
        self.assertEqual(loader.find_neighborhoods_in_budget('umich', 699, 2, shared=True), [])





    def test_removed_features_are_not_exposed(self):
        self.assertFalse(hasattr(loader, 'estimate_move_in_cost'))
        with self.assertRaisesRegex(ValueError, 'walk, bike, or bus'):
            loader.estimate_commute_cost('umich', 'car')
        with self.assertRaises(TypeError):
            loader.find_neighborhoods_in_budget('umich', 1000, 1, max_commute_min=20)
        import json
        profile = json.loads((loader.DATA_DIR / 'campuses/umich.json').read_text())
        for key in ('county', 'typical_lease_start_window', 'security_deposit_months',
                    'application_fee', 'parking', 'car_transportation_average',
                    'monthly_utilities_by_month', 'summer_income_gap_months'):
            self.assertNotIn(key, profile)

    def test_invalid_csv_ranges_fail_clearly(self):
        header = ('neighborhood,median_1_bedroom_rent,median_2_bedroom_rent,'
                  'rent_per_bedroom_shared,walk_minutes,bike_minutes,bus_minutes,source,'
                  'rent_1_bedroom_low,rent_1_bedroom_high\n')
        for low, high in [('200', '100'), ('bad', '200'), ('-1', '200'), ('100+', '200')]:
            with self.subTest(low=low, high=high), patch.object(loader.Path, 'open',
                return_value=io.StringIO(header + f'Test,,,,,,,source,{low},{high}\n')):
                with self.assertRaises(ValueError):
                    loader.list_neighborhoods('test')


if __name__ == '__main__':
    unittest.main()

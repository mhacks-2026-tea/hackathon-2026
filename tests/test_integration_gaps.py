"""Regression checks for range-aware search and explicit missing-data handling."""
import io
import unittest
from unittest.mock import patch
from campus import loader


class IntegrationGapTests(unittest.TestCase):
    def test_supplied_ranges_are_used_without_inventing_medians(self):
        self.assertEqual(loader.get_rent_benchmark('umich', 1),
                         {'low': 825, 'median': None, 'high': 2550})
        self.assertEqual(loader.get_rent_benchmark('umich', 2, shared=True),
                         {'low': 700, 'median': None, 'high': 1750})

    def test_open_bounds_and_supplied_rounding_are_preserved(self):
        rows = {row.neighborhood: row for row in loader.list_neighborhoods('umich')}
        self.assertEqual(rows['Kerrytown'].rent_ranges['shared_3_plus'],
                         {'low': 833, 'high': None, 'high_lower_bound': 1500})
        self.assertIsNone(loader.get_rent_benchmark('umich', 4)['high'])

    def test_rent_only_search_returns_candidates_without_commute_claim(self):
        matches = loader.find_neighborhoods_in_budget('umich', 1000, 1)
        self.assertEqual([row.neighborhood for row in matches], ['Oxbridge'])
        self.assertIsNone(matches[0].bus_minutes)
        self.assertEqual(matches[0].rent_ranges['1']['high'], 1200)

    def test_shared_search_does_not_split_twice(self):
        self.assertEqual([row.neighborhood for row in
                          loader.find_neighborhoods_in_budget('umich', 700, 2, shared=True)], ['Oxbridge'])
        self.assertEqual(loader.find_neighborhoods_in_budget('umich', 699, 2, shared=True), [])

    def test_commute_requires_data_or_explicit_override(self):
        with self.assertRaisesRegex(ValueError, 'Missing commute minutes.*Oxbridge'):
            loader.find_neighborhoods_in_budget('umich', 1000, 1, 20)
        self.assertEqual(len(loader.find_neighborhoods_in_budget(
            'umich', 1000, 1, 20, commute_method='bus', commute_minutes={'Oxbridge': 20})), 1)
        self.assertEqual(loader.find_neighborhoods_in_budget(
            'umich', 1000, 1, 20, commute_minutes={'Oxbridge': 21}), [])

    def test_missing_move_in_costs_are_not_zero(self):
        result = loader.estimate_move_in_cost('umich', 1000)
        self.assertIsNone(result['total'])
        self.assertIsNone(result['items']['security_deposit'])
        self.assertEqual(result['known_subtotal'], 1000)
        self.assertEqual(set(result['missing_fields']), {'security_deposit', 'application_fee'})

    def test_actual_listing_overrides_allow_explicit_zero(self):
        result = loader.estimate_move_in_cost('umich', 1000, extras=100,
                                             security_deposit=500, application_fee=0)
        self.assertEqual(result['total'], 1600)
        self.assertEqual(result['missing_fields'], [])
        with self.assertRaises(ValueError):
            loader.estimate_move_in_cost('umich', 1000, security_deposit=-1)

    def test_car_budget_can_be_supplied_without_fabricated_range(self):
        with self.assertRaisesRegex(ValueError, 'commute_cost_ranges.car'):
            loader.estimate_commute_cost('umich', 'car')
        result = loader.estimate_true_monthly_cost('umich', 1000, bedrooms=1,
                                                  month='january', commute='car', commute_monthly_cost=250)
        self.assertEqual(result['items']['commute'], {'low': 250, 'expected': 250, 'high': 250})
        self.assertEqual(result['total']['expected'], sum(x['expected'] for x in result['items'].values()))

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

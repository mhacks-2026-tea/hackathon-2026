"""JSON stdin/stdout bridge for the TypeScript server. No network or credentials."""
import calendar
import json
import sys
from campus.loader import estimate_true_monthly_cost, get_campus_profile


def main():
    request = json.load(sys.stdin)
    if not isinstance(request, dict):
        raise ValueError('Campus input must be an object')
    campus_id = request['campusId']
    get_campus_profile(campus_id)
    months = {}
    for index in range(1, 13):
        months[f'{index:02d}'] = estimate_true_monthly_cost(
            campus_id, request['monthlyApartmentRentDollars'],
            roommates=request['roommates'], commute=request['commute'],
            month=calendar.month_name[index].lower(), bedrooms=request['bedrooms'],
        )
    json.dump({'months': months}, sys.stdout, allow_nan=False)


if __name__ == '__main__':
    try:
        main()
    except (ValueError, TypeError, KeyError, OSError) as error:
        print(f'Campus input/data error: {error}', file=sys.stderr)
        sys.exit(1)

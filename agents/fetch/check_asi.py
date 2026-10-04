"""One live ASI check with fictional inputs; does not register a Fetch agent."""
from pathlib import Path
from dotenv import load_dotenv
from conversation import extract_inputs

load_dotenv(Path(__file__).resolve().parents[2] / '.env.local')
try:
    values = extract_inputs('For a fictional UMich demo, whole apartment rent is $1050, one bedroom, '
                            'no roommates, walking. Lease November 1, 2026 to December 1, 2026. '
                            'My share of deposit is $1050, application fee $50, moving $150, '
                            'monthly parking $0, minimum balance $200.', {})
    expected = {'campusId': 'umich', 'monthlyApartmentRentDollars': 1050, 'bedrooms': 1, 'roommates': 0,
                'commute': 'walk', 'leaseStart': '2026-11-01', 'leaseEnd': '2026-12-01',
                'securityDepositCents': 105000, 'applicationFeesCents': 5000,
                'movingCostsCents': 15000, 'monthlyParkingCents': 0, 'safetyBufferCents': 20000}
    if any(values.get(key) != value for key, value in expected.items()):
        raise ValueError('Extraction did not match the fictional fixture')
    print('PASS live ASI extraction: dates, sharing, dollar/cents conversion, and explicit zero.')
except Exception as error:
    # Report error type/status without exposing credentials or HTTP response bodies.
    print(f'FAIL ASI check: {type(error).__name__}; status={getattr(error, "code", "n/a")}')
    raise SystemExit(1)

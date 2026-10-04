"""Offline tests for follow-up collection, isolation, and failed model responses."""
import json
import unittest
from unittest.mock import AsyncMock
from conversation import Conversation, validate_patch


class ConversationTests(unittest.IsolatedAsyncioTestCase):
    async def test_collects_then_executes_and_applies_correction(self):
        fixture = json.loads(__import__('pathlib').Path(__file__).with_name('example-request.json').read_text())
        full = {key: value for key, value in fixture['housing'].items() if key != 'name'}
        full['safetyBufferCents'] = fixture['safetyBufferCents']
        patches = iter([{'monthlyApartmentRentDollars': 1050}, full, {'monthlyApartmentRentDollars': 900}])
        chat = Conversation(lambda text, known: next(patches))
        execute = AsyncMock(return_value='result')
        first = await chat.respond('alice:1', 'Rent is $1050', execute)
        self.assertIn('lease start', first)
        execute.assert_not_awaited()
        self.assertEqual(await chat.respond('alice:1', 'Other details', execute), 'result')
        self.assertEqual(json.loads(execute.await_args.args[0])['housing']['monthlyApartmentRentDollars'], 1050)
        await chat.respond('alice:1', 'Actually $900', execute)
        self.assertEqual(json.loads(execute.await_args.args[0])['housing']['monthlyApartmentRentDollars'], 900)

    async def test_sessions_are_separate_and_resettable(self):
        chat = Conversation(lambda text, known: {'monthlyApartmentRentDollars': 1050} if text == 'rent' else {})
        execute = AsyncMock()
        await chat.respond('alice:1', 'rent', execute)
        await chat.respond('bob:1', 'hello', execute)
        self.assertEqual(chat.sessions['bob:1']['known'], {})
        await chat.respond('alice:1', 'reset', execute)
        self.assertEqual(chat.sessions['alice:1']['known'], {})
        execute.assert_not_awaited()

    async def test_invalid_model_output_never_executes(self):
        for patch in [{'accountId': 'override'}, {'safetyBufferCents': True}, {'movingCostsCents': -1}]:
            chat = Conversation(lambda text, known: patch)
            execute = AsyncMock()
            response = await chat.respond('alice:1', 'hello', execute)
            self.assertIn('retry', response)
            execute.assert_not_awaited()

    async def test_missing_campus_data_never_uses_umich_costs(self):
        chat = Conversation(lambda text, known: {'campusId': 'yale'})
        execute = AsyncMock()
        response = await chat.respond('alice:1', 'I go to Yale', execute)
        self.assertIn('not connected', response)
        execute.assert_not_awaited()

    def test_rejects_invalid_dates_and_amounts(self):
        for patch in [{'leaseStart': '2026-02-30'}, {'securityDepositCents': 1.5}, {'commute': 'car'}]:
            with self.assertRaises(ValueError):
                validate_patch(patch)


if __name__ == '__main__':
    unittest.main()

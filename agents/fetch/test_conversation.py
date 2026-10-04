"""Offline tests for follow-up collection, isolation, and failed model responses."""
import json
import unittest
from unittest.mock import AsyncMock, patch
from urllib.error import HTTPError
from conversation import Conversation, validate_patch, extract_inputs


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
            self.assertIn('resend', response)
            execute.assert_not_awaited()

    async def test_missing_campus_data_never_uses_umich_costs(self):
        chat = Conversation(lambda text, known: {'campusId': 'yale'})
        execute = AsyncMock()
        response = await chat.respond('alice:1', 'I go to Yale', execute)
        self.assertIn('not connected', response)
        execute.assert_not_awaited()

    async def test_details_reuses_saved_scenario_without_model(self):
        chat = Conversation(lambda text, known: self.fail('Details must bypass the model'))
        execute = AsyncMock(return_value='answer')
        await chat.respond('alice:1', '{"housing": {}}', execute)
        await chat.respond('alice:1', 'details', execute)
        self.assertEqual(execute.await_args.kwargs, {'details': True})
        await chat.respond('alice:1', 'reset', execute)
        execute.reset_mock()
        self.assertIn('First evaluate', await chat.respond('alice:1', 'details', execute))
        execute.assert_not_awaited()

    async def test_recipient_mentions_do_not_break_reset_or_details(self):
        chat = Conversation(lambda text, known: self.fail('Commands must bypass ASI'))
        execute = AsyncMock(return_value='expanded')
        await chat.respond('alice:1', '{"housing": {}}', execute)
        self.assertEqual(await chat.respond('alice:1', '@movin-housing details', execute), 'expanded')
        answer = await chat.respond('alice:1', '@agent1qd2qgpnnvagkykwypsepkrjyap80aenxfp4gvylpl9kkunpt6cmqygegxxq Reset', execute)
        self.assertIn('Started over', answer)
        self.assertNotIn('last_payload', chat.sessions['alice:1'])

    def test_rejects_invalid_dates_and_amounts(self):
        for patch in [{'leaseStart': '2026-02-30'}, {'securityDepositCents': 1.5}, {'commute': 'car'}]:
            with self.assertRaises(ValueError):
                validate_patch(patch)

    def test_whole_float_cents_are_normalized_without_accepting_fractions(self):
        self.assertEqual(validate_patch({'securityDepositCents': 5000.0}), {'securityDepositCents': 5000})
        with self.assertRaises(ValueError):
            validate_patch({'securityDepositCents': 5000.5})

    def test_retries_bad_model_output_once(self):
        with patch('conversation._extract_once', side_effect=[ValueError('bad JSON'), {'securityDepositCents': 105000}]) as call, patch('conversation.time.sleep'):
            self.assertEqual(extract_inputs('fictional deposit $1050', {}), {'securityDepositCents': 105000})
            self.assertEqual(call.call_count, 2)

    def test_invalid_credentials_are_not_retried(self):
        error = HTTPError('https://api.asi1.ai/v1/chat/completions', 401, 'Unauthorized', {}, None)
        with patch('conversation._extract_once', side_effect=error) as call:
            with self.assertRaises(HTTPError):
                extract_inputs('fictional deposit $1050', {})
            self.assertEqual(call.call_count, 1)


if __name__ == '__main__':
    unittest.main()

"""Offline tests: importing the bridge never registers or starts an agent."""

import unittest
from unittest.mock import AsyncMock, patch
from bridge import reply


class BridgeTests(unittest.IsolatedAsyncioTestCase):
    async def test_acp_acknowledges_then_replies_without_starting_agent(self):
        from bridge import create_agent
        from uagents_core.contrib.protocols.chat import ChatMessage, ChatAcknowledgement, TextContent
        # Use the real protocol models but mock the Agent to prevent registration.
        with patch.dict("os.environ", {"MOVIN_AGENT_SEED": "s" * 32, "MOVIN_BRIDGE_TOKEN": "t" * 32}), \
                patch("uagents.Agent") as agent_type, patch("dotenv.load_dotenv"), \
                patch("conversation.Conversation.respond", new=AsyncMock(return_value="Computed result")):
            create_agent()
            protocol = agent_type.return_value.include.call_args.args[0]
            handler = protocol._signed_message_handlers[ChatMessage.build_schema_digest(ChatMessage)]
            context = AsyncMock()
            message = ChatMessage(content=[TextContent(type="text", text="hello")])
            await handler(context, "test-sender", message)
            calls = context.send.await_args_list
            self.assertEqual(len(calls), 2)
            self.assertIsInstance(calls[0].args[1], ChatAcknowledgement)
            self.assertEqual(calls[0].args[1].acknowledged_msg_id, message.msg_id)
            self.assertEqual(calls[1].args[1].content[0].text, "Computed result")
            agent_type.return_value.run.assert_not_called()

    async def test_invalid_request_does_not_call_tools(self):
        def forbidden(payload):
            self.fail("Invalid input must not call finance tools")
        for text in ["hello", "[]", '{"housing": 1}', "x" * 16385]:
            self.assertIsInstance(await reply(text, forbidden), str)

    async def test_reports_engine_values_and_warnings(self):
        def finance(payload):
            return {
                "snapshotDate": "2026-10-03", "predictionMethod": "baseline",
                "dataWarnings": ["Balance is a seeded snapshot."],
                "affordability": {
                    "monthlyHousingCostCents": 123000, "upfrontCashRequiredCents": 248000,
                    "dailyBalances": [{"date": "2026-11-01", "projectedBalanceCents": -69800,
                                       "belowSafetyBuffer": True}],
                    "assumptions": ["Limited history."], "warnings": [],
                },
            }
        response = await reply('{"housing": {}}', finance)
        for expected in ["$1,230.00", "$2,480.00", "$-698.00", "baseline", "seeded", "Limited history"]:
            self.assertIn(expected, response)

    async def test_internal_error_is_private(self):
        def broken(payload):
            raise RuntimeError("SECRET_TOKEN")
        response = await reply('{"housing": {}}', broken)
        self.assertNotIn("SECRET_TOKEN", response)
        self.assertIn("couldn't complete", response)


if __name__ == "__main__":
    unittest.main()

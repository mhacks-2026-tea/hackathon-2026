"""Live fictional multi-turn demo check; uses ASI and the running local backend."""
import asyncio
from pathlib import Path
from dotenv import load_dotenv
from conversation import Conversation
from bridge import reply


async def main():
    load_dotenv(Path(__file__).resolve().parents[2] / '.env.local')
    chat = Conversation()
    messages = [
        'Hey, I am testing with a made-up UMich student. I found a one-bedroom for $1050 a month. Can I afford it?',
        'I would live alone and walk to campus. The lease is November 1, 2026 to December 1, 2026.',
        'The deposit is $1050, application fee is $50, and moving would cost about $150. No parking costs. I would like to keep at least $200 in my account.',
        'What if the whole apartment rent were $900 instead? Everything else stays the same.',
    ]
    for index, message in enumerate(messages):
        answer = await chat.respond('fictional-live-test', message, reply)
        if index < 2:
            assert 'I still need:' in answer, 'Expected a missing-details question'
        else:
            assert 'Lowest predicted balance:' in answer, 'Expected a finance result'
            assert ('$1,285.00' if index == 2 else '$1,135.00') in answer, 'Expected rent to change housing costs'
        print(f'PASS live demo turn {index + 1}')
    print('PASS full multi-turn ASI extraction, finance calls, and cheaper-rent comparison.')


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except Exception as error:
        # Never print request headers, bank data, or credentials in test failures.
        print(f'FAIL live conversation: {type(error).__name__}')
        raise SystemExit(1)

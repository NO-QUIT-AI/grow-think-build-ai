// @ts-nocheck -- Bun test runner; fetch is mocked per test.
import { afterEach, beforeEach, expect, mock, test } from 'bun:test';
import { stripReplyPrefix, PROVIDER_ORDER, routeChat, callOllama, callDeepSeek } from './router';

const saved = { OLLAMA_URL: process.env.OLLAMA_URL, DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY };
const realFetch = globalThis.fetch;

beforeEach(() => {
  delete process.env.OLLAMA_URL;
  delete process.env.DEEPSEEK_API_KEY;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

const messages = [{ role: 'user', content: 'Hello' }];

test('PROVIDER_ORDER is ollama then deepseek', () => {
  expect([...PROVIDER_ORDER]).toEqual(['ollama', 'deepseek']);
});

test('stripReplyPrefix removes only the leading prefix', () => {
  expect(stripReplyPrefix('NO QUIT AI: hello')).toBe('hello');
  expect(stripReplyPrefix('hello')).toBe('hello');
  expect(stripReplyPrefix('x NO QUIT AI: y')).toBe('x NO QUIT AI: y');
});

test('stripReplyPrefix trims nothing else', () => {
  expect(stripReplyPrefix('NO QUIT AI:  spaced  ')).toBe(' spaced  ');
});

test('callOllama falls back to data.response', async () => {
  globalThis.fetch = mock(async () => new Response(JSON.stringify({ response: '  hi ' }), { status: 200 }));
  expect(await callOllama({ messages })).toBe('hi');
});

test('callOllama returns null on network error', async () => {
  globalThis.fetch = mock(async () => { throw new Error('down'); });
  expect(await callOllama({ messages })).toBeNull();
});

test('callDeepSeek returns null without a key', async () => {
  const fake = mock(async () => new Response('{}', { status: 200 }));
  globalThis.fetch = fake;
  expect(await callDeepSeek({ messages })).toBeNull();
  expect(fake).not.toHaveBeenCalled();
});

test('callDeepSeek reads choices[0].message.content', async () => {
  process.env.DEEPSEEK_API_KEY = 'secret-key';
  globalThis.fetch = mock(async () => {
    return new Response(JSON.stringify({ choices: [{ message: { content: 'from deepseek' } }] }), { status: 200 });
  });
  expect(await callDeepSeek({ messages })).toBe('from deepseek');
});

test('routeChat prefers Ollama and strips prefix', async () => {
  globalThis.fetch = mock(async (url) => {
    if (String(url).includes('11434')) {
      return new Response(JSON.stringify({ message: { content: 'NO QUIT AI: local reply' } }), { status: 200 });
    }
    throw new Error('should not reach deepseek');
  });
  const result = await routeChat({ messages });
  expect(result).toEqual({ reply: 'local reply', provider: 'ollama' });
});

test('routeChat falls over to DeepSeek when Ollama is empty', async () => {
  process.env.DEEPSEEK_API_KEY = 'secret-key';
  globalThis.fetch = mock(async (url) => {
    if (String(url).includes('11434')) return new Response(JSON.stringify({ message: { content: '   ' } }), { status: 200 });
    return new Response(JSON.stringify({ choices: [{ message: { content: 'cloud reply' } }] }), { status: 200 });
  });
  expect(await routeChat({ messages })).toEqual({ reply: 'cloud reply', provider: 'deepseek' });
});

test('routeChat returns null only when both providers fail and never throws', async () => {
  globalThis.fetch = mock(async () => { throw new Error('boom'); });
  expect(await routeChat({ messages })).toBeNull();
});

test('routeChat does not leak api key in reply', async () => {
  process.env.DEEPSEEK_API_KEY = 'secret-key';
  globalThis.fetch = mock(async (url) => {
    if (String(url).includes('11434')) return new Response('nope', { status: 500 });
    return new Response(JSON.stringify({ choices: [{ message: { content: 'safe answer' } }] }), { status: 200 });
  });
  const result = await routeChat({ messages });
  expect(result?.reply).toBe('safe answer');
  expect(JSON.stringify(result)).not.toContain('secret-key');
});

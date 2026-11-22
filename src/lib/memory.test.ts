// @ts-nocheck -- Bun test runner.
import { expect, test } from "bun:test";
import {
  buildMemorySystemPrompt,
  createMemoryStore,
  defaultProfile,
  loadProfile,
  rememberFact,
  saveProfile,
} from "./ai/memory";

test("default profile has Abu Dhabi / UAE and ur+en languages", () => {
  const profile = defaultProfile();
  expect(profile.city).toBe("Abu Dhabi");
  expect(profile.country).toBe("United Arab Emirates");
  expect(profile.languages).toEqual(["ur", "en"]);
  expect(profile.name).toBeUndefined();
});

test("defaultProfile returns independent copies", () => {
  const a = defaultProfile();
  a.languages?.push("fr");
  const b = defaultProfile();
  expect(b.languages).toEqual(["ur", "en"]);
});

test("saveProfile then loadProfile round-trips through a store", async () => {
  const store = createMemoryStore();
  const saved = await saveProfile({ name: "Ali", work: "Engineer" }, store);
  expect(saved.updatedAt).toBeTruthy();
  const loaded = await loadProfile(store);
  expect(loaded.name).toBe("Ali");
  expect(loaded.work).toBe("Engineer");
  expect(loaded.city).toBe("Abu Dhabi");
});

test("loadProfile on an empty store returns defaults", async () => {
  const store = createMemoryStore();
  const loaded = await loadProfile(store);
  expect(loaded.city).toBe("Abu Dhabi");
  expect(loaded.languages).toEqual(["ur", "en"]);
});

test("rememberFact appends and updates notes with key:value, deduped", async () => {
  const store = createMemoryStore();
  await rememberFact("hobby", "football", store);
  await rememberFact("work", "Engineer", store);
  const updated = await rememberFact("hobby", "cricket", store);
  expect(updated.notes).toEqual(["work: Engineer", "hobby: cricket"]);
  const reloaded = await loadProfile(store);
  expect(reloaded.notes).toContain("hobby: cricket");
  expect(reloaded.notes).not.toContain("hobby: football");
});

test("rememberFact ignores blank key or value", async () => {
  const store = createMemoryStore();
  const result = await rememberFact("  ", "something", store);
  expect(result.notes ?? []).toEqual([]);
});

test("buildMemorySystemPrompt includes known facts and no re-ask rule", () => {
  const prompt = buildMemorySystemPrompt({
    name: "Sara",
    city: "Abu Dhabi",
    work: "Designer",
    preferences: ["short answers"],
  });
  expect(prompt).toContain("Sara");
  expect(prompt).toContain("Abu Dhabi");
  expect(prompt).toContain("Designer");
  expect(prompt).toContain("short answers");
  expect(prompt.toLowerCase()).toContain("never re-ask");
});

test("buildMemorySystemPrompt handles an empty profile", () => {
  const prompt = buildMemorySystemPrompt({});
  expect(prompt).toContain("KNOWN USER FACTS");
});

test("corrupt stored JSON falls back to defaults", async () => {
  const store = createMemoryStore();
  await store.set("nqai.personalProfile", "{not json");
  const loaded = await loadProfile(store);
  expect(loaded.city).toBe("Abu Dhabi");
});

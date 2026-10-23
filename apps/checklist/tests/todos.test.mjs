import test from "node:test";
import assert from "node:assert/strict";
import { dateFromKey, dateKey, readGuestTodos, sortTodos } from "../lib/todos.js";

const makeTask = (id, priority, completed = false) => ({ id, title: id, priority, completed, task_date: "2026-10-23", created_at: "2026-10-23T00:00:00.000Z" });

test("unfinished tasks come first, ordered by importance without changing the saved array", () => {
  const tasks = [makeTask("low", 3), makeTask("done-high", 1, true), makeTask("high", 1), makeTask("normal", 2)];
  const original = structuredClone(tasks);
  assert.deepEqual(sortTodos(tasks).map((task) => task.id), ["high", "normal", "low", "done-high"]);
  assert.deepEqual(tasks, original);
});

test("equally important tasks retain their creation order", () => {
  const first = { ...makeTask("first", 1), created_at: "2026-10-23T01:00:00.000Z" };
  const later = { ...makeTask("later", 1), created_at: "2026-10-23T02:00:00.000Z" };
  assert.deepEqual(sortTodos([later, first]).map((task) => task.id), ["first", "later"]);
});

test("saved tasks round trip and malformed records cannot break the list", () => {
  const valid = makeTask("saved", 2, true);
  const restored = readGuestTodos(JSON.stringify([null, {}, { ...valid, priority: 100 }, { ...valid, title: "" }, valid]));
  assert.deepEqual(restored, [valid]);
  assert.deepEqual(readGuestTodos(null), []);
  assert.throws(() => readGuestTodos("not json"));
  assert.throws(() => readGuestTodos('{}'));
});

test("local calendar dates retain the intended day across month boundaries", () => {
  const date = dateFromKey("2026-10-31");
  assert.equal(dateKey(date), "2026-10-31");
  date.setDate(date.getDate() + 1);
  assert.equal(dateKey(date), "2026-11-01");
});

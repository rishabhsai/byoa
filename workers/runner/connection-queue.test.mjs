import assert from "node:assert/strict";
import test from "node:test";
import { SingleConnectionQueue } from "./connection-queue.mjs";

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

async function turn() {
  await new Promise((resolve) => setImmediate(resolve));
}

test("waits for the current connection to finish before starting the next", async () => {
  const first = deferred();
  const second = deferred();
  const started = [];
  const queue = new SingleConnectionQueue((connection) => {
    started.push(connection.id);
    return connection.done;
  }, () => assert.fail("queue should not reject either connection"));

  assert.equal(queue.enqueue({ id: "first", done: first.promise }), "started");
  assert.equal(queue.enqueue({ id: "second", done: second.promise }), "queued");
  await turn();
  assert.deepEqual(started, ["first"]);

  first.resolve();
  await turn();
  assert.deepEqual(started, ["first", "second"]);
  second.resolve();
});

test("does not start a queued connection after it disconnects", async () => {
  const first = deferred();
  const started = [];
  const queue = new SingleConnectionQueue((connection) => {
    started.push(connection.id);
    return connection.done;
  }, () => assert.fail("queue should not reject either connection"));
  const waiting = { id: "waiting", done: Promise.resolve() };

  queue.enqueue({ id: "first", done: first.promise });
  queue.enqueue(waiting);
  assert.equal(queue.cancel(waiting), true);
  first.resolve();
  await turn();

  assert.deepEqual(started, ["first"]);
});

test("rejects a third connection instead of running app-servers concurrently", async () => {
  const first = deferred();
  const rejected = [];
  const queue = new SingleConnectionQueue((connection) => connection.done, (connection) => rejected.push(connection.id));

  queue.enqueue({ id: "first", done: first.promise });
  assert.equal(queue.enqueue({ id: "second", done: Promise.resolve() }), "queued");
  assert.equal(queue.enqueue({ id: "third", done: Promise.resolve() }), "rejected");
  assert.deepEqual(rejected, ["third"]);
  first.resolve();
});

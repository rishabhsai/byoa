import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { restoreCredentials, syncCredentials } from "./credential-store.mjs";

async function homes() {
  const root = await mkdtemp(join(tmpdir(), "byoa-credentials-"));
  return { root, local: join(root, "local"), persisted: join(root, "persisted") };
}

test("stores and restores only the credential file", async () => {
  const { root, local, persisted } = await homes();
  try {
    await restoreCredentials(local, persisted);
    await writeFile(join(local, "auth.json"), JSON.stringify({ tokens: { access_token: "test" } }));
    assert.equal(await syncCredentials(local, persisted), "stored");

    await rm(join(local, "auth.json"));
    assert.equal(await restoreCredentials(local, persisted), true);
    assert.deepEqual(JSON.parse(await readFile(join(local, "auth.json"), "utf8")), { tokens: { access_token: "test" } });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("removes the persisted credential when Codex logs out", async () => {
  const { root, local, persisted } = await homes();
  try {
    await restoreCredentials(local, persisted);
    await writeFile(join(local, "auth.json"), "{}");
    await syncCredentials(local, persisted);
    await rm(join(local, "auth.json"));
    assert.equal(await syncCredentials(local, persisted), "removed");
    assert.equal(await restoreCredentials(local, persisted), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects malformed persisted credentials", async () => {
  const { root, local, persisted } = await homes();
  try {
    await restoreCredentials(local, persisted);
    await writeFile(join(persisted, "auth.json"), "not json");
    await assert.rejects(restoreCredentials(local, persisted), SyntaxError);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

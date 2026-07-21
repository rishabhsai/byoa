import { watch } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const authFile = "auth.json";
const maxCredentialBytes = 1024 * 1024;

function missing(error) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function validateCredentialFile(data) {
  if (data.byteLength > maxCredentialBytes) throw new Error("persisted credential file is too large");
  const text = data.toString("utf8");
  const value = JSON.parse(text);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("persisted credential file is invalid");
  }
  return text;
}

export async function restoreCredentials(localHome, persistedHome) {
  await Promise.all([
    mkdir(localHome, { recursive: true }),
    mkdir(persistedHome, { recursive: true }),
  ]);

  const localPath = join(localHome, authFile);
  try {
    const data = await readFile(join(persistedHome, authFile));
    await writeFile(localPath, validateCredentialFile(data), { mode: 0o600 });
    return true;
  } catch (error) {
    if (!missing(error)) throw error;
    await rm(localPath, { force: true });
    return false;
  }
}

export async function syncCredentials(localHome, persistedHome) {
  await mkdir(persistedHome, { recursive: true });
  const persistedPath = join(persistedHome, authFile);
  try {
    const data = await readFile(join(localHome, authFile));
    await writeFile(persistedPath, validateCredentialFile(data), { mode: 0o600 });
    return "stored";
  } catch (error) {
    if (!missing(error)) throw error;
    await rm(persistedPath, { force: true });
    return "removed";
  }
}

export function watchCredentials(localHome, persistedHome, onError = () => {}) {
  let timer;
  let pending = Promise.resolve();

  const run = () => {
    pending = pending
      .then(() => syncCredentials(localHome, persistedHome))
      .catch((error) => onError(error));
    return pending;
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      void run();
    }, 150);
  };

  const watcher = watch(localHome, (_event, filename) => {
    if (filename && String(filename) === authFile) schedule();
  });
  watcher.on("error", onError);

  return {
    flush() {
      if (timer) clearTimeout(timer);
      timer = undefined;
      return run();
    },
    close() {
      if (timer) clearTimeout(timer);
      timer = undefined;
      watcher.close();
    },
  };
}

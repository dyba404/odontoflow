import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalStorageDriver } from "./storage";

test("LocalStorageDriver put/get/head/delete", async () => {
  const raiz = await mkdtemp(join(tmpdir(), "of-storage-"));
  const prev = process.env.ATTACHMENTS_DIR;
  process.env.ATTACHMENTS_DIR = raiz;

  try {
    const driver = new LocalStorageDriver();
    const key = join(raiz, "tenant-1", "foto.png");
    const data = new TextEncoder().encode("contenido-binario");

    assert.equal(driver.driver, "local");
    assert.equal(await driver.head(key), null);

    await driver.put(key, data, "image/png", data.length);
    const head = await driver.head(key);
    assert.ok(head);
    assert.equal(head.size, data.length);

    const leido = await driver.get(key);
    assert.equal(new TextDecoder().decode(leido), "contenido-binario");

    assert.equal(await driver.signGetUrl(key, 300), null);
    assert.equal(await driver.signPutUrl(key, "image/png", 300), null);

    await driver.delete(key);
    assert.equal(await driver.head(key), null);
  } finally {
    process.env.ATTACHMENTS_DIR = prev;
    await rm(raiz, { recursive: true, force: true });
  }
});

test("LocalStorageDriver rechaza escritura fuera de la raíz", async () => {
  const raiz = await mkdtemp(join(tmpdir(), "of-storage-"));
  const otro = await mkdtemp(join(tmpdir(), "of-fuera-"));
  const prev = process.env.ATTACHMENTS_DIR;
  process.env.ATTACHMENTS_DIR = raiz;

  try {
    const driver = new LocalStorageDriver();
    await assert.rejects(
      () => driver.put(join(otro, "fuga.png"), new TextEncoder().encode("x"), "image/png"),
      /ruta_invalida/,
    );
  } finally {
    process.env.ATTACHMENTS_DIR = prev;
    await rm(raiz, { recursive: true, force: true });
    await rm(otro, { recursive: true, force: true });
  }
});

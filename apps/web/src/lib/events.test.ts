import { test } from "node:test";
import assert from "node:assert/strict";
import { subscribe, publish } from "./events";

test("suscribe/unsuscribe no-transaccional", async () => {
  const recibidos: number[] = [];
  const unsub = subscribe<number>("evt.test", (n, ctx) => {
    recibidos.push(n);
    if (ctx.db) throw new Error("no debe haber ctx.db en no-transaccional");
  });

  await publish("evt.test", 42);
  assert.deepEqual(recibidos, [42]);

  unsub();
  await publish("evt.test", 99);
  assert.deepEqual(recibidos, [42]);
});

test("handler transaccional sin tx lanza error", async () => {
  subscribe("evt.tx", () => {}, { transactional: true });
  await assert.rejects(() => publish("evt.tx", {}), /requiere publish/i);
});

test("handler transaccional con tx se ejecuta", async () => {
  const fakeDb = {};
  let ctxDb: unknown = null;
  subscribe(
    "evt.tx2",
    (_p, ctx) => {
      ctxDb = ctx.db;
    },
    { transactional: true },
  );
  const count = await publish("evt.tx2", {}, { tx: fakeDb as never });
  assert.equal(count, 1);
  assert.equal(ctxDb, fakeDb);
});

test("handler transaccional falla y propaga", async () => {
  subscribe(
    "evt.tx3",
    () => {
      throw new Error("boom");
    },
    { transactional: true },
  );
  await assert.rejects(
    () => publish("evt.tx3", {}, { tx: {} as never }),
    /boom/,
  );
});

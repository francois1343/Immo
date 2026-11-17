/* Durable private store for estimate requests, on plain files.
   It needs nothing but a directory outside every served folder, so it runs the
   same on any Node host. The cockpit reads and updates the same layout:

     <dir>/demandes/<id>.json   {"schema":1,"version":1,"key":"<idempotency key>","record":{…}}
     <dir>/cles/<key>.json      {"id":"<id>"}   one file per idempotency key

   A request is created exactly once per key: the key file is created with an
   exclusive flag, which the operating system guarantees to succeed only once. */
import { mkdir, readFile, writeFile, rename, unlink } from "node:fs/promises";
import path from "node:path";

const SAFE = /^[0-9a-f-]{8,80}$/;

export function createFileStore(dir) {
  if (!dir || !path.isAbsolute(dir)) throw Error("An absolute storage directory is required.");
  const requests = path.join(dir, "demandes"),
    keys = path.join(dir, "cles");
  let ready;
  const prepare = () =>
    (ready ||= Promise.all([
      mkdir(requests, { recursive: true, mode: 0o700 }),
      mkdir(keys, { recursive: true, mode: 0o700 }),
    ]));
  const file = (id) => path.join(requests, id + ".json");
  async function write(target, value) {
    const tmp = target + "." + process.pid + "." + Date.now() + ".tmp";
    await writeFile(tmp, JSON.stringify(value), { mode: 0o600 });
    await rename(tmp, target); // a reader sees the old file or the new one, never half of it
  }
  async function read(id) {
    const d = JSON.parse(await readFile(file(id), "utf8"));
    if (d?.schema !== 1 || !Number.isInteger(d.version) || d.record?.id !== id) throw Error("Corrupt request file.");
    return d;
  }
  return {
    /* Returns {created, record}. The same key always yields the first stored record. */
    async put(key, record) {
      if (!SAFE.test(key) || !SAFE.test(record?.id || "")) throw Error("Invalid key or identifier.");
      await prepare();
      const keyFile = path.join(keys, key + ".json");
      try {
        await writeFile(keyFile, JSON.stringify({ id: record.id }), { flag: "wx", mode: 0o600 });
      } catch (e) {
        if (e.code !== "EEXIST") throw e;
        // Another submission holds this key. It may still be writing: wait for it rather than write a second request.
        let id = "";
        for (let attempt = 0; attempt < 20; attempt++) {
          try {
            id = JSON.parse(await readFile(keyFile, "utf8")).id;
            if (!SAFE.test(id || "")) throw Error("Corrupt key file.");
            return { created: false, record: (await read(id)).record };
          } catch (inner) {
            if (inner.code !== "ENOENT" && !(inner instanceof SyntaxError)) throw inner;
            await new Promise((r) => setTimeout(r, 25));
          }
        }
        if (!SAFE.test(id || "")) throw Error("Corrupt key file.");
        // The key was reserved long ago but the request never reached the disk: finish that first attempt.
        const recovered = { ...record, id };
        await write(file(id), { schema: 1, version: 1, key, record: recovered });
        return { created: true, record: recovered };
      }
      try {
        await write(file(record.id), { schema: 1, version: 1, key, record });
      } catch (e) {
        await unlink(keyFile).catch(() => {}); // nothing was stored: the visitor may try again
        throw e;
      }
      return { created: true, record };
    },
  };
}

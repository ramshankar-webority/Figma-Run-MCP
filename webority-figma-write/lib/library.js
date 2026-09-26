// Local JSON library for shaders and generative plugins: library/<kind>/<id>.json.

import fs from "node:fs";
import path from "node:path";

export const slugify = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

export class JsonLibrary {
  constructor(dir, label) {
    this.dir = dir;
    this.label = label;
  }

  file(id) {
    const safe = slugify(id);
    if (!safe) throw new Error(`Invalid ${this.label} id: '${id}'`);
    return path.join(this.dir, safe + ".json");
  }

  has(id) {
    return fs.existsSync(this.file(id));
  }

  get(id) {
    const f = this.file(id);
    if (!fs.existsSync(f)) return null;
    return JSON.parse(fs.readFileSync(f, "utf8"));
  }

  list() {
    if (!fs.existsSync(this.dir)) return [];
    return fs
      .readdirSync(this.dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        try {
          return JSON.parse(fs.readFileSync(path.join(this.dir, f), "utf8"));
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  save(record) {
    fs.mkdirSync(this.dir, { recursive: true });
    // Write then rename so a crash never leaves half a JSON file.
    const f = this.file(record.id);
    fs.writeFileSync(f + ".tmp", JSON.stringify(record, null, 2));
    fs.renameSync(f + ".tmp", f);
    return record;
  }
}

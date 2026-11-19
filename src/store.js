import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';

export function makeStore(dataDir) {
  mkdirSync(dataDir, { recursive: true });
  const path = (n) => join(dataDir, n + '.json');
  return {
    read(name, fallback) {
      return existsSync(path(name)) ? JSON.parse(readFileSync(path(name), 'utf8')) : fallback;
    },
    write(name, value) {
      const tmp = path(name) + '.tmp';
      writeFileSync(tmp, JSON.stringify(value, null, 2));
      renameSync(tmp, path(name));
    },
  };
}

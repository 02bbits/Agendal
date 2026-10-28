import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function loadSchema(name) {
  const filePath = path.resolve(__dirname, `../schemas/${name}`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function loadFixture(name) {
  const filePath = path.resolve(__dirname, `../fixtures/${name}`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

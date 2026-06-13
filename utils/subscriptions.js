import fs from 'fs';
import path from 'path';

const SUBS_FILE = path.join(process.cwd(), 'data', 'subscriptions.json');
const KNOWN_IPOS_FILE = path.join(process.cwd(), 'data', 'known-ipos.json');

function ensureDir() {
  const dir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function loadSubscriptions() {
  try {
    if (!fs.existsSync(SUBS_FILE)) return [];
    return JSON.parse(fs.readFileSync(SUBS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

export function saveSubscriptions(subs) {
  ensureDir();
  fs.writeFileSync(SUBS_FILE, JSON.stringify(subs, null, 2));
}

export function addSubscription(sub) {
  const subs = loadSubscriptions();
  const existing = subs.findIndex((s) => s.endpoint === sub.endpoint);
  if (existing >= 0) {
    subs[existing] = sub;
  } else {
    subs.push(sub);
  }
  saveSubscriptions(subs);
}

export function removeSubscription(endpoint) {
  const subs = loadSubscriptions().filter((s) => s.endpoint !== endpoint);
  saveSubscriptions(subs);
}

export function loadKnownIpoIds() {
  try {
    if (!fs.existsSync(KNOWN_IPOS_FILE)) return [];
    return JSON.parse(fs.readFileSync(KNOWN_IPOS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

export function saveKnownIpoIds(ids) {
  ensureDir();
  fs.writeFileSync(KNOWN_IPOS_FILE, JSON.stringify(ids, null, 2));
}

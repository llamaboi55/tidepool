// `npm run build` → dist/tidepool-chromium.zip and dist/tidepool-firefox.zip (+ unpacked folders).
// Zero dependencies, so it runs the same on Windows, macOS and Linux.
import { readFile, writeFile, mkdir, rm, readdir, cp } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const INCLUDE = ['manifest.json', 'LICENSE', 'src', 'icons'];

async function walk(path) {
  const out = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const full = join(path, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else if (!entry.name.startsWith('.') && !entry.name.endsWith('.svg') && entry.name !== 'icon-512.png') out.push(full);
  }
  return out;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Minimal ZIP (deflate) writer. files: [{ name, data: Buffer }] */
function zip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  const time = 0x6000; // fixed timestamp: reproducible builds
  const date = 0x5a21;
  for (const { name, data } of files) {
    const nameBuf = Buffer.from(name, 'utf8');
    const packed = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    locals.push(local, nameBuf, packed);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + packed.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuf, end]);
}

const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'));
const targets = {
  chromium: manifest,
  firefox: (() => {
    const m = structuredClone(manifest);
    m.permissions = m.permissions.filter((p) => p !== 'favicon');
    delete m.minimum_chrome_version;
    m.browser_specific_settings = { gecko: { id: 'tidepool@chipper-aos', strict_min_version: '115.0', data_collection_permissions: { required: ['none'] } } };
    return m;
  })(),
};

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const files = [];
for (const item of INCLUDE) {
  const full = join(root, item);
  const list = item.includes('.') || item === 'LICENSE' ? [full] : await walk(full);
  for (const f of list) if (!f.endsWith('manifest.json')) files.push(f);
}

for (const [target, m] of Object.entries(targets)) {
  const entries = [{ name: 'manifest.json', data: Buffer.from(JSON.stringify(m, null, 2)) }];
  for (const f of files) entries.push({ name: relative(root, f).split(sep).join('/'), data: await readFile(f) });
  const out = join(dist, `tidepool-${target}-${m.version}.zip`);
  await writeFile(out, zip(entries));
  // Unpacked copy for "Load unpacked" / "Load Temporary Add-on".
  const dir = join(dist, target);
  await mkdir(dir, { recursive: true });
  for (const item of INCLUDE.filter((i) => i !== 'manifest.json')) await cp(join(root, item), join(dir, item), { recursive: true });
  await writeFile(join(dir, 'manifest.json'), JSON.stringify(m, null, 2));
  console.log(`✓ ${relative(root, out)} (${entries.length} files)`);
}

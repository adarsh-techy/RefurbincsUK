// One-off: copy every file under backend/uploads/ into the storage bucket,
// keeping the same keys (client-logos/x.png, invoices/inv-….pdf, …).
// Safe to re-run — files already in the bucket with the same size are skipped.
//
//   STORAGE_BUCKET=… STORAGE_ACCESS_KEY_ID=… STORAGE_SECRET_ACCESS_KEY=… \
//   STORAGE_ENDPOINT=… STORAGE_REGION=auto node scripts/migrate-uploads-to-bucket.js [uploadsDir]
require('../src/config/env');
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const fileStorage = require('../src/services/file-storage');

const root = path.resolve(process.argv[2] || fileStorage.UPLOADS_ROOT);
const bucket = process.env.STORAGE_BUCKET;
if (!bucket) {
  console.error('STORAGE_BUCKET is not set.');
  process.exit(1);
}

const s3 = new S3Client({
  region: process.env.STORAGE_REGION || 'auto',
  endpoint: process.env.STORAGE_ENDPOINT || undefined,
  forcePathStyle: Boolean(process.env.STORAGE_ENDPOINT),
  credentials: process.env.STORAGE_ACCESS_KEY_ID
    ? { accessKeyId: process.env.STORAGE_ACCESS_KEY_ID, secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY || '' }
    : undefined,
});

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile() && !entry.name.startsWith('.')) yield full;
  }
}

async function sizeInBucket(key) {
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return head.ContentLength;
  } catch (err) {
    if (err?.$metadata?.httpStatusCode === 404 || err?.name === 'NotFound') return null;
    throw err;
  }
}

(async () => {
  if (!fs.existsSync(root)) {
    console.log(`Nothing to copy: ${root} does not exist.`);
    return;
  }
  let copied = 0;
  let skipped = 0;
  for (const full of walk(root)) {
    const key = path.relative(root, full).split(path.sep).join('/');
    const size = fs.statSync(full).size;
    if ((await sizeInBucket(key)) === size) {
      skipped += 1;
      continue;
    }
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: fs.readFileSync(full) }));
    copied += 1;
    console.log(`copied ${key}`);
  }
  console.log(`Done: ${copied} copied, ${skipped} already in the bucket.`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

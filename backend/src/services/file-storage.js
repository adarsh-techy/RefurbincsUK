const fs = require('fs');
const path = require('path');

// Where uploaded files live. Keys are paths relative to the uploads root,
// e.g. "invoices/inv-123-a.pdf" — the same shape as the /uploads/<key> URLs
// the apps already use, so nothing outside this file cares which backend
// holds the bytes.
//
//   Local disk (default): backend/uploads/<key>. On Render that disk is wiped
//   on every deploy unless a persistent disk is mounted at /app/uploads.
//   Bucket: set STORAGE_BUCKET (+ STORAGE_ACCESS_KEY_ID / STORAGE_SECRET_ACCESS_KEY,
//   STORAGE_REGION, and STORAGE_ENDPOINT for Cloudflare R2 / other
//   S3-compatible services) and every read/write goes to the bucket instead.
const UPLOADS_ROOT = path.join(__dirname, '..', '..', 'uploads');

// read lazily so it sees env loaded by dotenv in config/env.js
const bucket = () => process.env.STORAGE_BUCKET || '';
let s3 = null;
let s3sdk = null;

function bucketEnabled() {
  return Boolean(bucket());
}

function client() {
  if (!s3) {
    // Loaded only when a bucket is configured, so local dev never needs it
    s3sdk = require('@aws-sdk/client-s3');
    s3 = new s3sdk.S3Client({
      region: process.env.STORAGE_REGION || 'auto',
      endpoint: process.env.STORAGE_ENDPOINT || undefined,
      forcePathStyle: Boolean(process.env.STORAGE_ENDPOINT),
      credentials: process.env.STORAGE_ACCESS_KEY_ID
        ? {
            accessKeyId: process.env.STORAGE_ACCESS_KEY_ID,
            secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY || '',
          }
        : undefined,
    });
  }
  return s3;
}

// "invoices/x.pdf" only — no absolute paths, no "..", no empty segments
function cleanKey(key) {
  const normalised = path.posix.normalize(String(key || '').replace(/\\/g, '/')).replace(/^\/+/, '');
  if (!normalised || normalised === '.' || normalised.startsWith('..') || normalised.split('/').includes('..')) {
    throw Object.assign(new Error('Invalid file path'), { status: 400 });
  }
  return normalised;
}

const localPath = (key) => path.join(UPLOADS_ROOT, cleanKey(key));

const isMissing = (err) =>
  err?.name === 'NoSuchKey' || err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404 || err?.code === 'ENOENT';

async function save(key, buffer, contentType) {
  const k = cleanKey(key);
  if (bucketEnabled()) {
    await client().send(
      new s3sdk.PutObjectCommand({ Bucket: bucket(), Key: k, Body: buffer, ContentType: contentType || undefined })
    );
    return;
  }
  const full = localPath(k);
  await fs.promises.mkdir(path.dirname(full), { recursive: true });
  await fs.promises.writeFile(full, buffer);
}

// Best effort: a file that's already gone is not an error
async function remove(key) {
  if (!key) return;
  try {
    const k = cleanKey(key);
    if (bucketEnabled()) {
      await client().send(new s3sdk.DeleteObjectCommand({ Bucket: bucket(), Key: k }));
    } else {
      await fs.promises.unlink(localPath(k));
    }
  } catch (err) {
    if (!isMissing(err)) console.error('file-storage remove:', err.message);
  }
}

// { stream, length } or null when the file doesn't exist
async function open(key) {
  const k = cleanKey(key);
  if (bucketEnabled()) {
    try {
      const out = await client().send(new s3sdk.GetObjectCommand({ Bucket: bucket(), Key: k }));
      return { stream: out.Body, length: out.ContentLength };
    } catch (err) {
      if (isMissing(err)) return null;
      throw err;
    }
  }
  const full = localPath(k);
  try {
    const stat = await fs.promises.stat(full);
    if (!stat.isFile()) return null;
    return { stream: fs.createReadStream(full), length: stat.size };
  } catch (err) {
    if (isMissing(err)) return null;
    throw err;
  }
}

// Whole file as a Buffer (e-mail attachments), or null
async function read(key) {
  const file = await open(key);
  if (!file) return null;
  const chunks = [];
  for await (const chunk of file.stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

module.exports = { UPLOADS_ROOT, bucketEnabled, cleanKey, save, remove, open, read };

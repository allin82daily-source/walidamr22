// Simple Express server: upload files to S3, store metadata in MongoDB
// Run: npm install, set env from .env.example, then node server.js

require('dotenv').config();
const express = require('express');
const multer = require('multer');
const AWS = require('aws-sdk');
const mongoose = require('mongoose');

const {
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_REGION,
  S3_BUCKET,
  MONGO_URI,
  PORT = 4000
} = process.env;

if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !S3_BUCKET || !MONGO_URI) {
  console.error("Please set AWS credentials, S3_BUCKET and MONGO_URI in environment.");
  process.exit(1);
}

AWS.config.update({
  accessKeyId: AWS_ACCESS_KEY_ID,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
  region: AWS_REGION
});
const s3 = new AWS.S3();

mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
const fileSchema = new mongoose.Schema({
  code: { type: String, unique: true, index: true },
  name: String,
  type: String,
  s3Key: String,
  public: { type: Boolean, default: false },
  owner: String,
  createdAt: { type: Date, default: Date.now },
});
const File = mongoose.model('File', fileSchema);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB limit

const app = express();
app.use(express.json());

function generateCode(len = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

// POST /api/upload
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    const isPublic = req.body.public === 'true' || req.body.public === true;
    const file = req.file;
    const fname = file.originalname;
    // pick MIME type or fallback
    const ftype = file.mimetype || req.body.type || 'application/octet-stream';

    // generate unique code
    let code;
    do {
      code = generateCode(6);
    } while (await File.findOne({ code }));

    const s3Key = `files/${code}/${Date.now()}_${fname}`;

    // upload to s3
    await s3.putObject({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: file.buffer,
      ContentType: ftype,
      Metadata: {
        public: isPublic ? 'true' : 'false'
      }
    }).promise();

    // store metadata
    const doc = new File({
      code,
      name: fname,
      type: ftype,
      s3Key,
      public: !!isPublic,
      owner: null
    });
    await doc.save();

    res.json({ ok: true, code });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/file/:code -> metadata + presigned URL if public
app.get('/api/file/:code', async (req, res) => {
  const code = (req.params.code || '').toUpperCase();
  const doc = await File.findOne({ code });
  if (!doc) return res.status(404).json({ ok: false, error: 'Not found' });

  if (!doc.public) {
    // for simplicity this example returns 403. In production, check auth and ownership.
    return res.status(403).json({ ok: false, error: 'Private file' });
  }

  const url = s3.getSignedUrl('getObject', {
    Bucket: S3_BUCKET,
    Key: doc.s3Key,
    Expires: 60 // 1 minute
  });

  res.json({ ok: true, meta: { code: doc.code, name: doc.name, type: doc.type, public: doc.public }, url });
});

// GET /download/:code -> redirect to presigned
app.get('/download/:code', async (req, res) => {
  const code = (req.params.code || '').toUpperCase();
  const doc = await File.findOne({ code });
  if (!doc) return res.status(404).send('Not found');

  if (!doc.public) return res.status(403).send('Private file');

  const url = s3.getSignedUrl('getObject', {
    Bucket: S3_BUCKET,
    Key: doc.s3Key,
    Expires: 60
  });
  res.redirect(url);
});

// Additional endpoints: unshare, delete, list public (omitted for brevity)

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
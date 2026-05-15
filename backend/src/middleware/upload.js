const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const uploadDir = process.env.STORAGE_PATH || path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Magic-byte signatures for allowed image formats.
// Checking the actual file bytes prevents MIME-type spoofing where an attacker
// sets Content-Type: image/jpeg on a non-image payload.
const MAGIC_BYTES = [
  { bytes: [0xFF, 0xD8, 0xFF],             mime: 'image/jpeg' },
  { bytes: [0x89, 0x50, 0x4E, 0x47],       mime: 'image/png'  },
  { bytes: [0x52, 0x49, 0x46, 0x46],       mime: 'image/webp' }, // RIFF....WEBP
  { bytes: [0x00, 0x00, 0x00],             mime: 'image/heic' }, // simplified; extended below
];

function detectMimeFromBuffer(buf) {
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return 'image/png';
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return 'image/webp';
  // HEIC/HEIF: ftyp box at offset 4, brand starts at 8
  if (buf.length >= 12 && buf.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buf.toString('ascii', 8, 12);
    if (['heic', 'heix', 'mif1', 'msf1'].some(b => brand.startsWith(b))) return 'image/heic';
  }
  return null;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    // Use only the extension — never trust the original filename for the stored name.
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    // First-pass check against the declared MIME type.
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, WEBP, and HEIC images are accepted'));
    }
    cb(null, true);
  },
});

// Second-pass magic-byte validation called after the file is on disk.
// Returns null on success, or an error string if the file content doesn't
// match an allowed image format.
async function validateMagicBytes(filePath) {
  const fd = await fs.promises.open(filePath, 'r');
  const buf = Buffer.alloc(16);
  try {
    await fd.read(buf, 0, 16, 0);
  } finally {
    await fd.close();
  }
  const detected = detectMimeFromBuffer(buf);
  if (!detected) return 'File content is not a recognized image format';
  return null;
}

module.exports = { upload, validateMagicBytes };

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const MAX_SIZE_MB = parseFloat(process.env.MAX_UPLOAD_SIZE_MB || '5');

function makeUploader(subfolder) {
  const dest = path.join(__dirname, '..', '..', 'uploads', subfolder);
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, dest),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      cb(null, unique);
    },
  });

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

  return multer({
    storage,
    limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Only JPG, PNG, WEBP, or PDF files are allowed'));
      }
    },
  });
}

module.exports = {
  uploadProof: makeUploader('proofs'),
  uploadDepositScreenshot: makeUploader('deposits'),
  uploadAvatar: makeUploader('avatars'),
};

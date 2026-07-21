const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `logo_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

router.post('/logo', requireAuth, requireAdmin, upload.single('logo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const publicDomain = process.env.RAILWAY_PUBLIC_DOMAIN;
  const base = publicDomain ? `https://${publicDomain}` : `${req.protocol}://${req.get('host')}`;
  const url = `${base}/uploads/${req.file.filename}`;
  res.json({ url, filename: req.file.filename });
});

// Video uploads (help videos) — same pattern as /logo but a bigger size limit
// and its own subfolder, since video files are much larger than images.
const VIDEO_DIR = path.join(UPLOAD_DIR, 'videos');
if (!fs.existsSync(VIDEO_DIR)) fs.mkdirSync(VIDEO_DIR, { recursive: true });

const MAX_VIDEO_SIZE_MB = parseFloat(process.env.MAX_VIDEO_UPLOAD_SIZE_MB || '150');

const videoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, VIDEO_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `video_${Date.now()}${ext}`);
  },
});

const uploadVideo = multer({
  storage: videoStorage,
  limits: { fileSize: MAX_VIDEO_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.mp4', '.webm', '.mov', '.ogg', '.m4v'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only MP4, WEBM, MOV, OGG, or M4V video files are allowed'));
  },
});

router.post('/video', requireAuth, requireAdmin, uploadVideo.single('video'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const publicDomain = process.env.RAILWAY_PUBLIC_DOMAIN;
  const base = publicDomain ? `https://${publicDomain}` : `${req.protocol}://${req.get('host')}`;
  const url = `${base}/uploads/videos/${req.file.filename}`;
  res.json({ url, filename: req.file.filename });
});

module.exports = router;

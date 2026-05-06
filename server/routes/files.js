// ============================================================================
// OmniMind AI — File Upload Routes
// ============================================================================

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { apiError } from '../utils/helpers.js';
import { analyzeDocument, analyzeImage } from '../services/gemini.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.doc', '.txt', '.png', '.jpg', '.jpeg', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error(`Unsupported file type: ${ext}`));
  }
});

const router = Router();

router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return apiError(res, 400, 'No file uploaded');

  const { prompt = 'Summarize this document.' } = req.body;
  const ext = path.extname(req.file.originalname).toLowerCase();

  try {
    let result;
    if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) {
      const base64 = fs.readFileSync(req.file.path).toString('base64');
      const mimeType = `image/${ext.replace('.', '').replace('jpg', 'jpeg')}`;
      result = await analyzeImage(base64, mimeType, prompt);
    } else {
      // For text files and documents, read as text
      // PDF/DOCX parsing happens client-side; server receives extracted text
      const text = req.body.extractedText || fs.readFileSync(req.file.path, 'utf-8');
      result = await analyzeDocument(text, prompt);
    }

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({ success: true, analysis: result, filename: req.file.originalname });
  } catch (error) {
    if (req.file?.path) fs.unlinkSync(req.file.path);
    apiError(res, 500, error.message);
  }
});

export default router;

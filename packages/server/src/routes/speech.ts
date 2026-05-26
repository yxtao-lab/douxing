import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth.js';
import { transcribeSpeechBuffer } from '../services/speech.service.js';
import { fail, success } from '../utils/response.js';

const router = Router();

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('audio/') && file.mimetype !== 'application/octet-stream') {
      cb(new Error('仅支持音频文件'));
      return;
    }
    cb(null, true);
  },
});

router.post('/transcribe', authMiddleware, (req, res) => {
  audioUpload.single('audio')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      fail(res, err.code === 'LIMIT_FILE_SIZE' ? '音频文件过大' : '上传失败', 1, 400);
      return;
    }
    if (err) {
      fail(res, err instanceof Error ? err.message : '上传失败', 1, 400);
      return;
    }
    if (!req.file) {
      fail(res, '请上传音频文件', 1, 400);
      return;
    }

    try {
      const text = await transcribeSpeechBuffer(req.file.buffer, {
        mimeType: req.file.mimetype,
        originalName: req.file.originalname,
      });
      success(res, { text }, '识别成功');
    } catch (e) {
      const message = e instanceof Error ? e.message : '语音识别失败';
      console.error('[speech/transcribe]', message);
      fail(res, message, 1, 503);
    }
  });
});

export default router;

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const MAX_WIDTH = 1200;
const MAX_HEIGHT = 1200;
const JPEG_QUALITY = 80;
const WEBP_QUALITY = 80;
const PNG_COMPRESSION = 8;

const isImage = (mimetype) => /^image\//.test(mimetype || '');
const isProcessable = (mimetype) =>
  /^image\/(png|jpe?g|gif|webp|jfif|tiff)$/i.test(mimetype || '');

const processImage = async (filePath, mimetype) => {
  if (!isProcessable(mimetype)) return;

  try {
    const metadata = await sharp(filePath).metadata();
    const needsResize =
      metadata.width > MAX_WIDTH || metadata.height > MAX_HEIGHT;

    let pipeline = sharp(filePath);

    if (needsResize) {
      pipeline = pipeline.resize({
        width: MAX_WIDTH,
        height: MAX_HEIGHT,
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.png') {
      pipeline = pipeline.png({ compressionLevel: PNG_COMPRESSION, quality: 90 });
    } else if (ext === '.webp') {
      pipeline = pipeline.webp({ quality: WEBP_QUALITY });
    } else if (ext === '.gif') {
      // sharp does not re-encode GIF well; skip
      return;
    } else {
      // jpeg, jpg, jfif, tiff -> output as jpeg
      pipeline = pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true });
    }

    const tempPath = filePath + '.tmp';
    await pipeline.toFile(tempPath);

    // Replace original with processed file
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    console.error('Image processing failed for', filePath, err.message);
    // Clean up temp file if it exists
    const tempPath = filePath + '.tmp';
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
};

/**
 * Express middleware that processes uploaded images after multer writes them to disk.
 * Works with multer.any(), multer.array(), and multer.single().
 */
const optimizeUploadedImages = async (req, res, next) => {
  try {
    const files = req.files;
    if (!files || files.length === 0) return next();

    const imageFiles = Array.isArray(files)
      ? files.filter((f) => isImage(f.mimetype))
      : [];

    if (imageFiles.length === 0) return next();

    await Promise.all(
      imageFiles.map((file) => processImage(file.path, file.mimetype))
    );
  } catch (err) {
    console.error('optimizeUploadedImages error:', err.message);
  }
  next();
};

module.exports = { optimizeUploadedImages, processImage };

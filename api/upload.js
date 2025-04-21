const multer = require('multer');
const sharp = require('sharp');
const AdmZip = require('adm-zip');
const path = require('path');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) return reject(result);
      return resolve(result);
    });
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  await runMiddleware(req, res, upload.array('image'));  // must match your form field

  try {
    const zip = new AdmZip();

    for (const file of req.files) {
      const ext = path.extname(file.originalname).toLowerCase();
      let compressedBuffer;

      if (['.jpg', '.jpeg'].includes(ext)) {
        compressedBuffer = await sharp(file.buffer)
          .resize({ width: 1920, withoutEnlargement: true })  // resize large images
          .jpeg({ quality: 60, mozjpeg: true })
          .toBuffer();
      } else if (ext === '.png') {
        compressedBuffer = await sharp(file.buffer)
          .resize({ width: 1920, withoutEnlargement: true })
          .png({ compressionLevel: 9 })
          .toBuffer();
      } else if (ext === '.webp') {
        compressedBuffer = await sharp(file.buffer)
          .resize({ width: 1920, withoutEnlargement: true })
          .webp({ quality: 60 })
          .toBuffer();
      } else {
        compressedBuffer = file.buffer;  // skip compression for unsupported types
      }

      zip.addFile(file.originalname, compressedBuffer);
    }

    const zipBuffer = zip.toBuffer();

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="compressed_images.zip"');
    res.status(200).send(zipBuffer);

  } catch (err) {
    console.error(err);
    res.status(500).send('Compression failed.');
  }
};

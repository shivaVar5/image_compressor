const formidable = require('formidable');
const fs = require('fs');
const archiver = require('archiver');
const path = require('path');
const sharp = require('sharp');

export const config = {
  api: { bodyParser: false }
};

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const form = new formidable.IncomingForm({ multiples: true, uploadDir: '/tmp', keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Error parsing the files.');
    }

    const zipPath = `/tmp/compressed_${Date.now()}.zip`;
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="compressed_images.zip"');
      fs.createReadStream(zipPath).pipe(res).on('finish', () => {
        fs.unlinkSync(zipPath);
      });
    });

    archive.on('error', err => {
      console.error(err);
      res.status(500).send('Error creating ZIP.');
    });

    archive.pipe(output);

    const uploadedFiles = Array.isArray(files.image) ? files.image : [files.image];

    for (let file of uploadedFiles) {
      const originalName = path.basename(file.originalFilename || file.newFilename);
      const ext = path.extname(originalName).toLowerCase();

      // If it's an image, compress it using sharp
      if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
        const compressedPath = `/tmp/compressed_${Date.now()}_${originalName}`;

        try {
          await sharp(file.filepath)
            .resize({ width: 1920 })  // downscale large images
            .jpeg({ quality: 75 })    // adjust quality
            .toFile(compressedPath);

          archive.file(compressedPath, { name: originalName });

          // Clean up temp compressed image after archiving
          archive.on('end', () => {
            fs.unlinkSync(compressedPath);
          });

        } catch (err) {
          console.error(`Failed to compress ${originalName}:`, err);
          archive.file(file.filepath, { name: originalName });  // fallback: original
        }

      } else {
        // If not an image, add the original file
        archive.file(file.filepath, { name: originalName });
      }
    }

    await archive.finalize();
  });
}

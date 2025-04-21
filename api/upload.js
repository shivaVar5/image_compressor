const formidable = require('formidable');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const sharp = require('sharp');

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const form = new formidable.IncomingForm({ multiples: true, uploadDir: '/tmp', keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Form parse error:', err);
      return res.status(500).send('Error parsing the files.');
    }

    const uploadedFiles = Array.isArray(files.image) ? files.image : [files.image];

    if (!uploadedFiles.length) return res.status(400).send('No files uploaded.');

    const zipPath = `/tmp/compressed_${Date.now()}.zip`;
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="compressed_images.zip"');
      const readStream = fs.createReadStream(zipPath);
      readStream.pipe(res).on('close', () => fs.unlinkSync(zipPath));  // clean after download
    });

    archive.on('error', err => {
      console.error('Archiving error:', err);
      res.status(500).send('Error creating ZIP.');
    });

    archive.pipe(output);

    for (let file of uploadedFiles) {
      const originalName = path.basename(file.originalFilename || file.newFilename);
      const ext = path.extname(originalName).toLowerCase();

      try {
        if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
          const compressedPath = `/tmp/compressed_${Date.now()}_${originalName}`;

          await sharp(file.filepath)
            .resize({ width: 1920, withoutEnlargement: true })  // Only shrink large images
            .jpeg({ quality: 75 })
            .toFile(compressedPath);

          archive.file(compressedPath, { name: originalName });

          archive.on('end', () => fs.unlink(compressedPath, () => {}));
        } else {
          archive.file(file.filepath, { name: originalName });
        }
      } catch (error) {
        console.error(`Error compressing ${originalName}:`, error);
        archive.file(file.filepath, { name: originalName }); // fallback to original
      }
    }

    await archive.finalize();
  });
}

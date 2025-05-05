const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.static('public'));

app.post('/upload', upload.any(), async (req, res) => {
    const files = req.files;
    const outputFolder = `processed/${uuidv4()}`;
    const compressedFolder = `${outputFolder}/compressed`;
    const compressedZipPath = `${outputFolder}/compressed_images.zip`;

    fs.mkdirSync(compressedFolder, { recursive: true });

    try {
        for (const file of files) {
            const ext = path.extname(file.originalname).toLowerCase();
            const outputPath = path.join(compressedFolder, file.originalname);

            if (file.mimetype === 'application/zip' || ext === '.zip') {
                const zip = new AdmZip(file.path);
                const extractedPath = `${outputFolder}/extracted_${uuidv4()}`;
                fs.mkdirSync(extractedPath);
                zip.extractAllTo(extractedPath, true);

                const extractedFiles = fs.readdirSync(extractedPath);
                for (const img of extractedFiles) {
                    const imgPath = path.join(extractedPath, img);
                    const outputImgPath = path.join(compressedFolder, img);
                    const stat = fs.lstatSync(imgPath);
                    const imgExt = path.extname(img).toLowerCase();

                    if (!stat.isDirectory()) {
                        try {
                            if (['.jpg', '.jpeg'].includes(imgExt)) {
                                await sharp(imgPath)
                                    .jpeg({ quality: 50, mozjpeg: true })
                                    .toFile(outputImgPath);
                            } else if (imgExt === '.png') {
                                await sharp(imgPath)
                                    .png({ compressionLevel: 9, quality: 50 }) // ✅ PNG quality
                                    .toFile(outputImgPath);
                            } else if (imgExt === '.webp') {
                                await sharp(imgPath)
                                    .webp({ quality: 50 })
                                    .toFile(outputImgPath);
                            } else {
                                fs.copyFileSync(imgPath, outputImgPath);
                            }
                        } catch (imgErr) {
                            console.warn(`⚠️ Skipping image ${img} due to error:`, imgErr.message);
                        }
                    }
                }

                fs.rmSync(extractedPath, { recursive: true, force: true });

            } else {
                const stat = fs.lstatSync(file.path);

                if (!stat.isDirectory()) {
                    try {
                        if (['.jpg', '.jpeg'].includes(ext)) {
                            await sharp(file.path)
                                .jpeg({ quality: 50, mozjpeg: true })
                                .toFile(outputPath);
                        } else if (ext === '.png') {
                            await sharp(file.path)
                                .png({ compressionLevel: 9, quality: 50 }) // ✅ PNG quality
                                .toFile(outputPath);
                        } else if (ext === '.webp') {
                            await sharp(file.path)
                                .webp({ quality: 50 })
                                .toFile(outputPath);
                        } else {
                            fs.copyFileSync(file.path, outputPath);
                        }
                    } catch (imgErr) {
                        console.warn(`⚠️ Skipping file ${file.originalname} due to error:`, imgErr.message);
                    }
                }
            }

            // Clean up uploaded file
            try {
                await fs.promises.unlink(file.path);
            } catch (unlinkErr) {
                console.warn(`⚠️ Failed to delete temp file ${file.path}:`, unlinkErr.message);
            }
        }

        const compressedZip = new AdmZip();
        compressedZip.addLocalFolder(compressedFolder);
        compressedZip.writeZip(compressedZipPath);

        res.json({ downloadUrl: `/download/${path.basename(outputFolder)}` });

    } catch (err) {
        console.error('🔥 Compression failed:', err);
        res.status(500).json({ error: 'Compression failed', message: err.message });
    }
});

app.get('/download/:folderId', (req, res) => {
    const compressedZipPath = `processed/${req.params.folderId}/compressed_images.zip`;
    if (fs.existsSync(compressedZipPath)) {
        res.download(compressedZipPath);
    } else {
        res.status(404).send('File not found');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));


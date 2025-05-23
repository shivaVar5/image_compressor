// server.js
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
                        if (['.jpg', '.jpeg'].includes(imgExt)) {
                            await sharp(imgPath)
                                .resize({ width: 1920, withoutEnlargement: true })  // Optional Resize
                                .jpeg({ quality: 50, mozjpeg: true })
                                .withMetadata({ exif: false, icc: false })  // Strip Metadata
                                .toFile(outputImgPath);
                        } else if (imgExt === '.png') {
                            await sharp(imgPath)
                                .resize({ width: 1920, withoutEnlargement: true })  // Optional Resize
                                .png({ compressionLevel: 9, quality: 50 })
                                .withMetadata({ exif: false, icc: false })
                                .toFile(outputImgPath);
                        } else if (imgExt === '.webp') {
                            await sharp(imgPath)
                                .resize({ width: 1920, withoutEnlargement: true })
                                .webp({ quality: 50 })
                                .withMetadata({ exif: false, icc: false })
                                .toFile(outputImgPath);
                        } else {
                            fs.copyFileSync(imgPath, outputImgPath);
                        }
                    }
                }
                fs.rmSync(extractedPath, { recursive: true, force: true });
            } else {
                const stat = fs.lstatSync(file.path);
                if (!stat.isDirectory()) {
                    if (['.jpg', '.jpeg'].includes(ext)) {
                        await sharp(file.path)
                            .resize({ width: 1920, withoutEnlargement: true })
                            .jpeg({ quality: 50, mozjpeg: true })
                            .withMetadata({ exif: false, icc: false })
                            .toFile(outputPath);
                    } else if (ext === '.png') {
                        await sharp(file.path)
                            .resize({ width: 1920, withoutEnlargement: true })
                            .png({ compressionLevel: 9, quality: 50 })
                            .withMetadata({ exif: false, icc: false })
                            .toFile(outputPath);
                    } else if (ext === '.webp') {
                        await sharp(file.path)
                            .resize({ width: 1920, withoutEnlargement: true })
                            .webp({ quality: 50 })
                            .withMetadata({ exif: false, icc: false })
                            .toFile(outputPath);
                    } else {
                        fs.copyFileSync(file.path, outputPath);
                    }
                }
            }
            fs.unlinkSync(file.path);
        }

        const compressedZip = new AdmZip();
        compressedZip.addLocalFolder(compressedFolder);
        compressedZip.writeZip(compressedZipPath);

        res.json({ downloadUrl: `/download/${path.basename(outputFolder)}` });
    } catch (err) {
        console.error(err);
        res.status(500).send('Compression failed');
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

app.listen(3000, () => console.log('Server started at http://localhost:3000'));

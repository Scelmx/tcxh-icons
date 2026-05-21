const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { uploadsDir, getData, saveData } = require('../utils/storage');
const { buildIconFileRef, resolveUploadPath } = require('../utils/iconPath');
const { detectColorModeFromSvg } = require('../utils/svgProcess');

const router = express.Router();

// 先写入 uploads 根目录，POST 中再按 colorMode 移入子目录（避免 multipart 字段顺序问题）
const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => cb(null, /\.(svg|png|jpg|jpeg|webp|gif)$/i.test(file.originalname)),
});

router.get('/', (req, res) => {
  const data = getData();
  res.json({ icons: data.icons, total: data.icons.length });
});

router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请上传文件' });

  const { name, category = '其他' } = req.body;
  const ext = path.extname(req.file.filename).slice(1).toLowerCase();
  const srcPath = path.join(uploadsDir, req.file.filename);

  let colorMode = 'monochrome';
  if (ext === 'svg') {
    const svgContent = fs.readFileSync(srcPath, 'utf-8');
    colorMode = detectColorModeFromSvg(svgContent);
  }

  const destDir = path.join(uploadsDir, colorMode);
  fs.ensureDirSync(destDir);
  const destPath = path.join(destDir, req.file.filename);
  fs.moveSync(srcPath, destPath);
  const fileRef = buildIconFileRef(colorMode, req.file.filename);

  const data = getData();
  const icon = {
    id: uuidv4(),
    name: name || path.parse(req.file.originalname).name,
    ...fileRef,
    category,
    type: ext,
    createdAt: new Date().toISOString(),
  };

  data.icons.push(icon);
  if (!data.categories.includes(category)) data.categories.push(category);
  saveData(data);
  res.json({ icon });
});

router.delete('/:id', (req, res) => {
  const data = getData();
  const index = data.icons.findIndex((i) => i.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: '图标不存在' });

  const [icon] = data.icons.splice(index, 1);
  const filePath = resolveUploadPath(icon);
  if (fs.existsSync(filePath)) fs.removeSync(filePath);
  saveData(data);
  res.json({ success: true });
});

router.get('/categories', (req, res) => {
  res.json({ categories: getData().categories });
});

module.exports = router;

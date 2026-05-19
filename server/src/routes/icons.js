const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { uploadsDir, getData, saveData } = require('../utils/storage');

const router = express.Router();

// 文件上传配置
const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => cb(null, /\.(svg|png|jpg|jpeg|webp|gif)$/i.test(file.originalname))
});

// 获取图标列表
router.get('/', (req, res) => {
  const data = getData();
  res.json({ icons: data.icons, total: data.icons.length });
});

// 上传图标
router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请上传文件' });
  
  const { name, category = '其他' } = req.body;
  const data = getData();
  const icon = {
    id: uuidv4(),
    name: name || path.parse(req.file.originalname).name,
    filename: req.file.filename,
    category,
    type: path.extname(req.file.filename).slice(1).toLowerCase(),
    url: `/uploads/${req.file.filename}`,
    createdAt: new Date().toISOString()
  };
  
  data.icons.push(icon);
  if (!data.categories.includes(category)) data.categories.push(category);
  saveData(data);
  res.json({ icon });
});

// 删除图标
router.delete('/:id', (req, res) => {
  const data = getData();
  const index = data.icons.findIndex(i => i.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: '图标不存在' });
  
  const [icon] = data.icons.splice(index, 1);
  fs.removeSync(path.join(uploadsDir, icon.filename));
  saveData(data);
  res.json({ success: true });
});

// 获取分类
router.get('/categories', (req, res) => {
  res.json({ categories: getData().categories });
});

module.exports = router;

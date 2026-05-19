const path = require('path');
const fs = require('fs-extra');

// 目录配置
const uploadsDir = path.join(__dirname, '../../uploads');
const dataDir = path.join(__dirname, '../../data');
const outputDir = path.join(__dirname, '../../output');
const iconsFile = path.join(dataDir, 'icons.json');

// 确保目录存在
fs.ensureDirSync(uploadsDir);
fs.ensureDirSync(dataDir);
fs.ensureDirSync(outputDir);

// 初始化数据文件
if (!fs.existsSync(iconsFile)) {
  fs.writeJsonSync(iconsFile, { icons: [], categories: ['通用', '箭头', '编辑', '媒体', '文件', '其他'] });
}

// 读写数据
const getData = () => fs.readJsonSync(iconsFile);
const saveData = (data) => fs.writeJsonSync(iconsFile, data, { spaces: 2 });

module.exports = {
  uploadsDir,
  dataDir,
  outputDir,
  getData,
  saveData
};

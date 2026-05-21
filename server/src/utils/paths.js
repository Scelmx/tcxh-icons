const path = require('path');

const isPkg = typeof process.pkg !== 'undefined';

/**
 * 运行时数据根目录（uploads / data / output）
 * - pkg 可执行文件：与二进制同级的目录，或通过 TCXH_HOME 指定
 * - 开发模式：server/ 目录
 */
const getRuntimeRoot = () => {
  if (process.env.TCXH_HOME) {
    return path.resolve(process.env.TCXH_HOME);
  }
  if (isPkg) {
    return path.dirname(process.execPath);
  }
  return path.join(__dirname, '../..');
};

module.exports = { isPkg, getRuntimeRoot };

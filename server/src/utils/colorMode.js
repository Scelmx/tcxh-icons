const COLOR_MODES = ['monochrome', 'multicolor'];

const normalizeColorMode = (value, fallback = 'monochrome') => {
  const mode = String(value || fallback).toLowerCase();
  return COLOR_MODES.includes(mode) ? mode : fallback;
};

module.exports = { COLOR_MODES, normalizeColorMode };

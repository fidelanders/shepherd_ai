'use strict';

const fs = require('fs');

/**
 * Deletes a file, silently ignoring "not found" errors.
 * Other errors are logged but not thrown.
 */
function deleteFile(filePath) {
  if (!filePath) return;
  try {
    fs.unlinkSync(filePath);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn(`[cleanup] Could not delete "${filePath}": ${err.message}`);
    }
  }
}

/**
 * Deletes multiple files, collecting any errors.
 */
function deleteFiles(...paths) {
  for (const p of paths) deleteFile(p);
}

module.exports = { deleteFile, deleteFiles };

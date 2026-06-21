const { execSync } = require('child_process');
const path = require('path');

/**
 * Removes ALL code signatures from the macOS app bundle before packaging.
 * Squirrel.Mac recursively validates signatures — the Electron framework binaries
 * carry embedded signatures even when _CodeSignature folders are deleted.
 * codesign --deep --remove-signature strips both folder-based and embedded sigs.
 */
module.exports = async function (context) {
  if (context.electronPlatformName !== 'darwin') return;

  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);

  try {
    execSync(`codesign --deep --remove-signature "${appPath}"`, { stdio: 'pipe' });
    console.log(`afterPack: removed all signatures from ${appPath}`);
  } catch (e) {
    // Signature might not exist — that's fine
    console.log(`afterPack: no signatures to remove from ${appPath} (OK)`);
  }
};

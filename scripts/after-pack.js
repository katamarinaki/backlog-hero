const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Strips the ad-hoc code signature from the macOS app bundle before packaging.
 * Squirrel.Mac validates signatures on downloaded updates — without a real
 * Developer ID cert, this fails. Removing the signature lets Squirrel
 * skip validation entirely.
 */
module.exports = async function (context) {
  // Write proof file so CI logs confirm the hook ran
  const proofPath = path.join(context.outDir, '.afterpack-hook-ran');
  fs.writeFileSync(proofPath, new Date().toISOString());
  console.log('>>> afterPack hook STARTED');

  if (context.electronPlatformName !== 'darwin') {
    console.log('>>> afterPack: not macOS, skipping');
    return;
  }

  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);

  try {
    execSync(`codesign --remove-signature "${appPath}"`, { stdio: 'pipe' });
    console.log(`>>> afterPack: removed signature from ${appPath}`);
  } catch {
    console.log(`>>> afterPack: no signature to remove (OK)`);
  }
};

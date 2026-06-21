const fs = require('fs');
const path = require('path');

/**
 * Strips the ad-hoc code signature from the macOS app bundle before packaging.
 * Squirrel.Mac validates signatures on updates — without a real developer cert,
 * the ad-hoc signature produces bogus CodeResources that fail validation with:
 *   'code has no resources but signature indicates they must be present'
 *
 * Removing the signature lets Squirrel install the update without validation.
 * macOS creates a fresh ad-hoc signature when the app first launches.
 */
exports.default = async function (context) {
  if (context.electronPlatformName !== 'darwin') return;

  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  const sigDir = path.join(appPath, 'Contents', '_CodeSignature');

  if (fs.existsSync(sigDir)) {
    fs.rmSync(sigDir, { recursive: true, force: true });
    console.log(`Stripped _CodeSignature from ${appPath}`);
  }
};

const { execSync } = require('child_process');
const path = require('path');

/**
 * Ad-hoc code-signs the macOS app bundle.
 *
 * We do NOT have an Apple Developer certificate, so the app can't be properly
 * signed/notarized. However, an *ad-hoc* signature (`codesign --sign -`) is
 * still required:
 *
 *   - On Apple Silicon (arm64) the kernel refuses to execute any unsigned
 *     binary, so a fully unsigned build would be SIGKILLed on launch. Ad-hoc
 *     signing is the minimum needed for the app to start at all.
 *   - It must be the LAST thing we do to the bundle, after electron-builder has
 *     finished assembling it, so the signature covers the final contents.
 *
 * Auto-update does NOT rely on this signature: Squirrel.Mac can't validate an
 * ad-hoc signature across versions, so we bypass it entirely and install updates
 * ourselves (see src/main/updater.ts). This hook just keeps the app launchable.
 */
module.exports = async function (context) {
  if (context.electronPlatformName !== 'darwin') return;

  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);

  try {
    // --deep so nested helpers/frameworks are signed, --force to replace any
    // existing signature, --sign - for an ad-hoc (certificate-less) signature.
    execSync(`codesign --deep --force --sign - "${appPath}"`, { stdio: 'pipe' });
    console.log(`afterPack: ad-hoc signed ${appPath}`);
  } catch (e) {
    console.warn(`afterPack: ad-hoc signing failed for ${appPath}: ${e.message}`);
  }
};

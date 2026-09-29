// electron-builder afterPack hook.
//
// We have no Apple Developer ID cert locally, and electron-builder (v25) does
// NOT ad-hoc sign the macOS app on its own — it skips signing, which leaves the
// bundle carrying the stale Electron stub signature ("Identifier=Electron",
// no _CodeSignature). On Apple Silicon macOS then reports the app as "damaged
// and can't be opened" and Finder refuses to launch it.
//
// To guarantee a valid signature we ad-hoc sign the assembled .app here (runs
// after the bundle is fully built, before it gets zipped/dmg'd). The app is
// still "unidentified developer" (right-click → Open, or `xattr -dr
// com.apple.quarantine`), but it is no longer "damaged".
const { execFileSync } = require('child_process')
const path = require('path')

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return

  const appName = context.packager.appInfo.productFilename
  const appPath = path.join(context.appOutDir, `${appName}.app`)

  console.log(`  • afterPack: ad-hoc signing ${appPath}`)
  // --force replaces the stub signature; --deep signs nested helpers/frameworks;
  // `--sign -` is the ad-hoc identity.
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], {
    stdio: 'inherit'
  })
}

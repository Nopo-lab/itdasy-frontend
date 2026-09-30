'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const stalePermissionKeys = [
  'NSFaceIDUsageDescription',
  'NSUserTrackingUsageDescription',
];

const checks = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function check(name, ok, detail) {
  checks.push({ name, ok, detail });
}

const postClone = 'ci_scripts/ci_post_clone.sh';
check('Xcode Cloud post-clone script exists', exists(postClone), postClone);
if (exists(postClone)) {
  const body = read(postClone);
  check('Xcode Cloud runs Capacitor iOS sync', /npx cap sync ios/.test(body), postClone);
  check('Xcode Cloud installs CocoaPods', /pod install/.test(body), postClone);
  check('Xcode Cloud verifies release xcconfig', /Pods-App\.release\.xcconfig/.test(body), postClone);
}

check('iOS Privacy Manifest exists', exists('ios/App/App/PrivacyInfo.xcprivacy'), 'ios/App/App/PrivacyInfo.xcprivacy');
check('Podfile.lock is committed', exists('ios/App/Podfile.lock'), 'ios/App/Podfile.lock');

const projectFile = 'ios/App/App.xcodeproj/project.pbxproj';
check('Privacy Manifest is included in Xcode project', exists(projectFile) && /PrivacyInfo\.xcprivacy/.test(read(projectFile)), projectFile);

const localizedInfoPlists = [
  'ios/App/App/en.lproj/InfoPlist.strings',
  'ios/App/App/ko.lproj/InfoPlist.strings',
];

for (const relativePath of localizedInfoPlists) {
  const body = exists(relativePath) ? read(relativePath) : '';
  for (const key of stalePermissionKeys) {
    check(`${relativePath} does not declare ${key}`, !body.includes(key), relativePath);
  }
}

const appInfoPlist = 'ios/App/App/Info.plist';
const infoBody = exists(appInfoPlist) ? read(appInfoPlist) : '';
for (const key of stalePermissionKeys) {
  const declared = new RegExp(`<key>\\s*${key}\\s*</key>`).test(infoBody);
  check(`Info.plist does not declare ${key}`, !declared, appInfoPlist);
}

const failed = checks.filter((item) => !item.ok);
for (const item of checks) {
  console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.name} (${item.detail})`);
}

if (failed.length > 0) {
  process.exitCode = 1;
}

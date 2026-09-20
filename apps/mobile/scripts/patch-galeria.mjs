import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const packageDirectory = dirname(require.resolve('@nandorojo/galeria/package.json'));
const swiftFile = join(packageDirectory, 'ios', 'GaleriaView.swift');
const source = readFileSync(swiftFile, 'utf8');

const incompatibleImplementation = `    var reactSubviews: [UIView]? = nil
    if RCTIsNewArchEnabled() {
      reactSubviews = self.subviews
    } else {
      reactSubviews = self.reactSubviews()
    }

    guard let reactSubviews else { return nil }`;

const compatibleImplementation = `    #if RCT_NEW_ARCH_ENABLED
    let reactSubviews = self.subviews
    #else
    let reactSubviews = self.reactSubviews()
    #endif`;

if (source.includes(compatibleImplementation)) {
  console.log('Galeria iOS compatibility patch is already applied.');
} else if (source.includes(incompatibleImplementation)) {
  writeFileSync(swiftFile, source.replace(incompatibleImplementation, compatibleImplementation));
  console.log('Applied Galeria iOS compatibility patch for React Native 0.86.');
} else {
  throw new Error(
    `Unable to patch ${swiftFile}: the expected GaleriaView implementation was not found.`
  );
}

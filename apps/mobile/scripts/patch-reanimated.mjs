import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

// This patch rewrites Reanimated's Android Kotlin source, so it only ever matters for a native
// build (EAS / `expo run:android`). It runs from `postinstall` though, which means it also fires
// on installs that will never compile Android — a web-only Vercel deploy, CI type-check jobs — and
// there the Android sources may legitimately be absent (a restored/partial bun store, a pruned
// install). Those cases skip with a warning instead of failing the install. Pass `--strict` (as
// `eas-build-post-install` does) to make a missing target fatal, since a native build that silently
// ships unpatched Reanimated is the regression this patch exists to prevent.
const strict = process.argv.includes('--strict');

function skip(message) {
  if (strict) {
    throw new Error(message);
  }
  console.warn(`Skipping Reanimated Android SVG event patch: ${message}`);
  process.exit(0);
}

const require = createRequire(import.meta.url);

let packageDirectory;
try {
  packageDirectory = dirname(require.resolve('react-native-reanimated/package.json'));
} catch {
  skip('react-native-reanimated is not resolvable from this install.');
}

const sourceFile = join(
  packageDirectory,
  'android/src/main/java/com/swmansion/reanimated/NodesManager.kt'
);

if (!existsSync(sourceFile)) {
  skip(`${sourceFile} does not exist (no Android sources in this install).`);
}

const source = readFileSync(sourceFile, 'utf8');

const original = `            // Events can be dispatched from any thread so we have to make sure handleEvent is run from
            // the UI thread.`;

// SVG emits layout events while drawing. Reanimated 4.5.1 flushes pending
// transforms for every one, even when no worklet handles the event. The Android
// ANR trace shows this repeatedly applying UI props inside SvgView.onDraw.
// Skip only Reanimated's work for unhandled SVG layout events; React Native's
// event dispatcher still delivers the original event to JS listeners.
const patched = `            // Readspace: avoid flushing animations for unhandled SVG draw events.
            if (event.eventName == "topSvgLayout") {
                val eventName = mCustomEventNamesResolver.resolveCustomEventName(event.eventName) ?: return
                if (!mNativeProxy!!.isAnyHandlerWaitingForEvent(eventName, event.viewTag)) {
                    return
                }
            }
${original}`;

if (source.includes(patched)) {
  console.log('Reanimated Android SVG event patch is already applied.');
} else if (source.includes(original)) {
  writeFileSync(sourceFile, source.replace(original, patched));
  console.log('Applied Reanimated Android SVG event patch.');
} else {
  // The file is here but doesn't look like what we expect — that's a real upgrade break, not an
  // environment quirk, so it fails regardless of --strict.
  throw new Error(
    `Unable to patch ${sourceFile}: expected event dispatch implementation not found.`
  );
}

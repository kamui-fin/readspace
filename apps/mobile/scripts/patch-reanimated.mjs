import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const packageDirectory = dirname(require.resolve('react-native-reanimated/package.json'));
const sourceFile = join(
  packageDirectory,
  'android/src/main/java/com/swmansion/reanimated/NodesManager.kt'
);
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
  throw new Error(`Unable to patch ${sourceFile}: expected event dispatch implementation not found.`);
}

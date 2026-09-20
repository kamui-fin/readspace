# Native integration TODOs

Readspace currently uses Expo SDK 57. The packages below are installed and the
localization, background-task, and notifications config plugins are registered.
Feature integration remains TODO; installation does not enable these features.

| Integration | Setup | Remaining work |
| --- | --- | --- |
| `expo-localization` | Installed | TODO: use device locale and time zone for dates, digest preferences, and translation defaults; refresh locale-dependent state when appropriate. |
| `expo-background-task` | Installed; config plugin registered | TODO: implement bounded article prefetch and queued reading-state sync. Execution is controlled by the OS, not an exact schedule. |
| `expo-task-manager` | Installed | TODO: define background tasks at module scope in an early-loaded module, then register/unregister them according to account and sync preferences. |
| `expo-speech` | Installed | TODO: add article/digest read-aloud controls, voice/language selection, and stop playback on navigation or logout; verify device-specific behavior. |
| `expo-notifications` | Installed; config plugin registered | TODO: opt-in permissions, Android channels, push credentials/token registration, digest delivery, notification deep links, and logout cleanup. |
| `@expo/ui` | Installed; SDK 57 stable package | TODO: integrate a native SwiftUI surface with an Android fallback and verify it in an iOS development build. |
| `expo-widgets` | Installed; widget extension not configured | TODO: configure the widget extension, App Group, timeline data, and deep links for a digest or unread-count widget. |

## SwiftUI integration

SDK 57 supports Expo UI's stable package. It is autolinked and does not need an
additional app config plugin. Keep SwiftUI imports in `.ios.tsx` components and
provide a corresponding `.tsx` React Native fallback for Android. Wrap SwiftUI
views in `Host`; use SwiftUI stacks inside that boundary.

Example for a future iOS-only surface:

```tsx
import { Host, Text, VStack } from '@expo/ui/swift-ui';

export function NativeDigestPreview() {
  return (
    <Host matchContents>
      <VStack spacing={8}>
        <Text>Daily Digest</Text>
      </VStack>
    </Host>
  );
}
```

Use SDK 57 APIs when implementing these surfaces.
Liquid Glass features additionally require the corresponding Xcode/iOS versions.

## Upgrade requirements

- Expo SDK 57, React Native 0.86, React 19.2, and TypeScript 6.
- Bun 1.3.14 or newer is required; the project and EAS pin 1.4.2.
  The root `bunfig.toml` uses hoisted installs
  to keep React and Expo native modules deduplicated across the workspace.
- Node.js 22.13+ (24 LTS recommended); Xcode 26.4+ for iOS builds.
- Minimum iOS version is now 16.4.
- Regenerate ignored native projects for SDK 57 before rebuilding. Preserve any
  local native customizations first; `expo prebuild` now cleans by default.
- Expo Router owns its navigation APIs; import hooks/types through `expo-router`
  rather than `@react-navigation/*`.

## Build and release TODOs

- [x] Regenerate iOS and Android projects for SDK 57. Previous local projects
  were preserved under `.expo/native-sdk54-backup-*`.
- [ ] Rebuild development clients for iOS and Android to include the new native modules.
- [x] App version bumped to `1.1.0`; the `appVersion` runtime policy separates
  this native runtime from SDK 54 binaries.
- [ ] Verify permissions, task scheduling, notification delivery, and speech on physical devices.
- [ ] Validate the SwiftUI surface on iOS and its fallback on Android.
- [ ] Configure widget kinds and App Groups once the widget UI is implemented.
  Keep the config plugin deferred until then to avoid shipping an empty extension.

## Upgrade validation

- Expo dependency version check and all 21 Expo Doctor checks pass.
- Production JavaScript/Hermes bundle export succeeds for iOS and Android.
- Native prebuild succeeds for iOS and Android; native compilation and device
  testing remain pending.
- Web and shared-package TypeScript checks pass. Mobile still has four existing
  prop mismatches in `src/components/screens/article-reader/view.tsx` involving
  the action bar, reader dock, and article options sheet.

## References

- [Expo UI and SwiftUI](https://docs.expo.dev/guides/expo-ui-swift-ui/)
- [SDK 57 Expo UI](https://docs.expo.dev/versions/v57.0.0/sdk/ui/)
- [SDK 57 background tasks](https://docs.expo.dev/versions/v57.0.0/sdk/background-task/)
- [SDK 57 notifications](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/)
- [Expo SDK 55: widgets debut](https://expo.dev/sdk/55)
- [Widgets configuration](https://docs.expo.dev/versions/latest/sdk/widgets/)

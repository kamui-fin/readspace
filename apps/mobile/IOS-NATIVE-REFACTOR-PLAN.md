# iOS-Native Refactor Plan (Mobile)

**Goal:** move iOS surfaces to real SwiftUI (`@expo/ui/swift-ui`) where it makes sense and works properly, and move *every* sheet (iOS + Android) to `@lodev09/react-native-true-sheet`. **Android UI is unchanged** (our own `@components/ui/*`), except for sheets.

Rules of engagement live in `apps/mobile/CLAUDE.md`. This file is the work plan.

---

## Status board (update on every commit)

Legend: ✅ done · 🟡 code-done, **needs device test** · 🚧 in progress · ⬜ todo · ⏭️ deliberately kept

| # | Item | Status | Notes |
|---|---|---|---|
| 0 | Prereqs (True Sheet installed, `SUPPORTS_GLASS`, `NativeHost`) | ✅ | `@lib/constants/platform.ts`, `@components/ui/native-host` |
| 1 | Sheet wrappers (`BottomSheet`/`Modal`/`Input`) on True Sheet | 🟡 | gorhom removed |
| 2 | All sheet callers migrated | 🟡 | 29 files; see §2 device-test checklist |
| 3a | Back button (SwiftUI glass `Button`) | 🟡 | `@components/ui/back-button`; 5 call sites replaced |
| 3b | Toggle / Switch (SwiftUI `Toggle`) | 🟡 | `ui/switch/index.ios.tsx` |
| 3c | Spinner / ProgressView | ⏭️ | brand-coloured SVG spinner used on coloured buttons + toasts; native adds nothing |
| 3d | Label | ⬜ | lands with settings `Form` (§3.9) |
| 4 | Confirmation dialog + alerts | 🟡 | `useNativeConfirm` (`ui/confirm-dialog`); feed-switcher ×3 + profile replaced; `lib/review` mock alert kept |
| 5 | Menus (`Menu` for tap menus, ContextMenu spike) | ⬜ | |
| 6 | Settings `Form`/`Section`/`Picker`/`Stepper` | ⬜ | |
| 7 | Control group (article actions bar) | ⬜ | |
| 8 | Discover native header + search | ⬜ | approved |
| 9 | NativeTabs + feed switcher on long-press | ⬜ | approved; spike first |

**Device-test needed (nothing here has run on a simulator yet):** sheets (all), back button glass/bordered, Toggle, ConfirmationDialog anchoring inside a True Sheet.

---

## 0. Ground rules for every item

1. **Platform split pattern** (already proven by `reader-corner-menu.ios.tsx`): `foo/index.tsx` (Android/default, current implementation) + `foo/foo.ios.tsx` (SwiftUI) + `foo/foo.types.ts` (shared props contract). Callers never branch on `Platform`.
2. **One `Host` per surface, never per atom.** Every `Host` is a native view with its own layout pass. Use `Host matchContents` for a single control (menu, toggle, back button); use one `Host` around a whole `Form`/`List` for settings screens. Do **not** wrap each list row / divider in its own Host.
3. **`Host colorScheme` must follow the app (or the reader theme), not the system** (see reader-corner-menu comment: sepia/dark reader in light-mode phone).
4. **Custom RN content inside SwiftUI** goes through `RNHostView` (avatars, OPML status card, RevenueCat widgets).
5. **iOS 26 glass:** gate `buttonStyle('glass')` on `Platform.Version >= 26`, fall back to `bordered` (same constant as the reader menu; extract to `@lib/constants/platform.ts`).
6. **SF Symbols on iOS surfaces** replace Solar icons *inside SwiftUI trees only*. Solar stays everywhere else. (Approved, see §6.)
7. **"Makes sense" filter:** if the native version is worse (perf in lists, keyboard focus, custom brand visuals), keep the RN version and record why in the table below.

---

## 1. Prerequisites (do first, one PR)

- [ ] Commit/stash the large in-flight mobile working tree (article-outline, reader-settings, discover search sheets, etc. are all still gorhom). Migrating on top of uncommitted churn will conflict.
- [x] `bunx expo install @lodev09/react-native-true-sheet` (New Architecture; RN 0.86 OK). **Requires a new dev-client / EAS build**, since it is a native module.
- [ ] Confirm `@expo/ui` resolves to `57.0.19` for the mobile app (the bun store also contains stray `0.2.0-beta.9` / `canary` copies from transitive deps — check with `bun pm ls @expo/ui`; `Alert`, `ConfirmationDialog`, `ControlGroup`, `Toggle`, `ProgressView`, `Menu`, `TabView`, `Toolbar` only exist in 57.x).
- [~] (`SUPPORTS_GLASS` done in `@lib/constants/platform.ts`; `<NativeHost>` still TODO) Extract `SUPPORTS_GLASS` and a `<NativeHost>` helper (`Host` + theme-synced `colorScheme` + `matchContents` default) into `@components/ui/native-host`.
- [ ] Read the Expo UI SwiftUI docs for each component before using it (props drift between betas): https://docs.expo.dev/versions/latest/sdk/ui/swift-ui/

---

## 2. Bottom sheets → True Sheet (iOS + Android) — **highest value, do first**

### Scope (29 files import `@gorhom/bottom-sheet`)

| Group | Files |
|---|---|
| **Wrappers (migrate first, callers follow)** | `ui/bottom-sheet/index.tsx` (351 lines, footer-store hack), `ui/modal/index.tsx` (249), `ui/input/index.tsx` (`BottomSheetInput` uses `BottomSheetTextInput`), `hooks/useBottomSheetBackHandler.ts` (delete) |
| **Provider** | `app/_layout.tsx` (`BottomSheetModalProvider` → `TrueSheetProvider` if the lib requires one, else remove) |
| **Feature sheets** | `add-feed`, `article-options`, `article-outline`, `article-summary`, `codex-settings`, `create-folder`, `delete-account`, `feed-switcher/*`, `folder-picker`, `opml-import`, `reader-settings/*`, `rename-feed`, `rename-folder`, `self-hosted-settings`, `upgrade` (all `components/bottom-sheets/`) |
| **Inline / screen sheets** | `screens/codex/components/codex-writeups-sheet`, `screens/discover/ui/search-options.sheet`, `screens/discover/ui/language-picker.dropdown`, `screens/discover/routes/home`, `screens/article-reader/view.tsx`, `screens/auth/routes/login`, `auth/routes/new-account` (+`/email`), `app/(protected)/(tabs)/index.tsx`, `app/(protected)/settings/import-opml` |

### Approach
1. **Keep our public API stable** — rebuild `BottomSheet` and `Modal` on `TrueSheet` with the same props (`headerTitle`, `headerLeft/Right`, `footerActions`, `snapPoints` → `detents`, `ref.present()/dismiss()`) so the ~25 callers change by import + a few props, not rewrites. Add a `useSheetRef()` typing helper.
2. **Map gorhom → True Sheet:** `snapPoints` → `detents` (`'auto'`, fractions, `1`), `enableDynamicSizing` → `'auto'` detent, `BottomSheetScrollView` → `scrollable` + plain `ScrollView`, `footerComponent` → `footer` prop, `handleComponent` → native grabber, `backdrop` → native dimming (`dimmed`, `dimmedDetentIndex`).
3. **Delete obsolete machinery:** `FooterStore` + `useSyncExternalStore` + portal-context workaround (True Sheet's `footer` is a normal child), `useBottomSheetBackHandler` (True Sheet handles Android back natively — verify, then remove the CLAUDE.md legacy bullet), `BottomSheetModalProvider`.
4. **Inputs:** `BottomSheetInput` becomes the plain `Input` (True Sheet handles keyboard avoidance natively). Verify `autoFocus` on present for create-folder / rename / add-feed.
5. **Stacked sheets** (feed-switcher → create-folder, article-options → folder-picker): True Sheet supports presenting a sheet from a sheet; test each existing chain.
6. **Reader chrome sheets** (reader-settings, article-outline): keep the tap-to-toggle chrome behavior from [[feedback_reader_chrome_interaction]]; sheets must not steal reader gestures.
7. **iOS 26:** native sheets get Liquid Glass background automatically — remove our manual `backgroundColor`/blur on iOS, keep on Android.
8. Remove `@gorhom/bottom-sheet` + `@gorhom/portal` from `package.json` once `grep -r gorhom src` is empty.

### Verification
iOS sim + Android emulator: every sheet opens/dismisses, drag, detent changes, keyboard + input focus, Android back gesture closes only the sheet, sheet-over-sheet, reader theme (sepia/dark), rotation. Screenshots via expo-mcp / simulator.

**Risk:** medium (breadth, not depth). **Effort:** ~2–3 days.

---

## 3. iOS SwiftUI surfaces (per component)

Legend — **Do**: migrate; **Partial**: migrate only where noted; **Keep**: no migration (reason given).

### 3.1 Back buttons — **Do**
- **Today:** hand-rolled `Button variant="icon"` + `ArrowLeftIcon` in `navigation/header/ui/header-foreground.tsx` (×2), `article-actions.bar.tsx`, `discover/routes/similar-feeds`, `discover/routes/feed-articles`, `settings/import-opml` (`onBackPress`).
- **Plan:** `ui/back-button/` with `back-button.ios.tsx` = SwiftUI `Button(systemImage: 'chevron.left')` in `Host matchContents`, `labelStyle('iconOnly')`, `buttonStyle(glass|bordered)`, `buttonBorderShape('circle')` — same recipe as `reader-corner-menu.ios.tsx`. Android/default keeps current `ArrowLeftIcon` button. Replace all 6 call sites with `<BackButton onPress />`.
- **Alternative to evaluate:** where a screen already has a stack header, use the native header back button (`headerBackButtonDisplayMode: 'minimal'`) and delete the custom one. Only viable if the screen doesn't use our custom `Header`.
- **Risk:** low. Preserve the interactive swipe-back gesture (don't disable `gestureEnabled`).

### 3.2 Main bottom tab bar — **Partial / spike first**
- **Today:** custom JS tab bar (`navigation/bottom-tabs`, `animated-tab`, `expand-tab`) with a morph animation that expands into the **feed switcher**; `Tabs` from `expo-router` with `tabBar` override in `(tabs)/_layout.tsx`.
- **Native options:** Expo Router `NativeTabs` (real `UITabBarController`: iOS 26 Liquid Glass, minimize-on-scroll, `bottomAccessory`) or `@expo/ui` `TabView`. `NativeTabs` is the correct one for app-level tabs.
- **Blocker:** the expand/morph-into-feed-switcher interaction cannot exist in a native tab bar. Proposed replacement: long-press / re-press "Following" tab opens the **feed switcher True Sheet** (already a sheet after §2). Avatar tab icon (profile) needs an image icon — verify `NativeTabs` support.
- **Plan:** (a) 0.5-day spike on a branch with `NativeTabs` + SF Symbols (`doc.text`, `sparkles`, `safari`, `person.crop.circle`); (b) if the feed-switcher interaction is acceptable → `(tabs)/_layout.ios.tsx` with NativeTabs, Android keeps current `_layout.tsx`; (c) if not → **Keep** the custom bar. This is a product decision (§6 Q2).
- **Risk:** high (navigation shell, safe-area/inset changes for every tab screen). Do last.

### 3.3 Input bars — **Partial**
- **Today:** `ui/input` (RN `TextInput` wrapper), `discover/ui/search-bar.input.tsx`, sheet inputs (create-folder, rename-feed/folder, delete-account, add-feed, self-hosted-settings), reader/search bars.
- **Do:** Discover search → native `headerSearchBarOptions` (UISearchController) **only if** Discover adopts a native stack header; otherwise **Keep** the RN input (a SwiftUI `TextField` in a `Host` has weaker focus/keyboard/ref control and no `onSubmitEditing` parity).
- **Do:** text fields that live *inside* SwiftUI `Form`s (self-hosted URL/key in §3.9) use SwiftUI `TextField`/`SecureField` for free.
- **Keep:** inputs inside sheets (need reliable `autoFocus`, `ref.focus()`, `returnKeyType`); after §2 they are simple RN inputs anyway.

### 3.4 Dividers — **Partial (inside SwiftUI only)**
- **Do:** SwiftUI `Divider` inside `Form`/`List`/`Section` trees (comes free with `Section`; usually no explicit divider needed).
- **Keep:** `ui/divider` in article lists/cards/skeletons (8 files: `article-item.card`, `article-list-item`, `card`, `codex-view`, `at-a-glance-card`, skeletons, …). A Host per divider in a FlashList/Legend List row is a net performance loss for a 1px line.

### 3.5 Alerts — **Partial**
- **Fact:** `Alert.alert` on iOS is *already* a native `UIAlertController`. The 5 usages (`feed-switcher` ×3, `profile` ×1, `lib/review`) look native today.
- **Do:** Introduce `useNativeAlert()` / `<NativeAlert>` wrapper over `@expo/ui` `Alert` for **declarative** alerts tied to state (profile "Manage Subscription" web-purchase notice; review prompt), giving consistent role/destructive styling and removing the imperative `Alert.alert` call in components. `lib/review/index.ts` is non-UI code → **Keep** `Alert.alert` there.
- Android: unchanged (`Alert.alert` / existing custom).

### 3.6 Progress view — **Partial**
- **Do:** SwiftUI `ProgressView` (indeterminate spinner and linear `value`) for: `ui/spinner` on iOS (loading states in add-feed, upgrade, oauth redirects, follow button), and a linear/circular determinate variant for simple progress.
- **Keep:** `opml-status-card` gradient-tick bar (brand-specific visual; native ProgressView can't do ticks) — but swap its *spinner* only. `reading-progress.ring` is custom brand chrome → **Keep**; optional later experiment with SwiftUI `Gauge(.circularCapacity)`.
- **Note:** RN `ActivityIndicator` is already a native `UIActivityIndicatorView`; the win here is consistency with the rest of the SwiftUI trees, not new capability. Low priority.

### 3.7 Toggle — **Do**
- **Today:** `ui/switch` (custom Moti animation, ~85 lines); consumer: `codex-settings.bottom-sheet.tsx`, plus whatever the settings rework (§3.9) adds.
- **Plan:** `ui/switch/switch.ios.tsx` = SwiftUI `Toggle` (`Host matchContents`, `tint(brand green)`); Android keeps the custom Moti switch. Same `{checked, onChange}` contract. Inside a SwiftUI `Form` (§3.9) use `Toggle` directly, no wrapper.
- **Risk:** low.

### 3.8 Label — **Do (inside SwiftUI trees)**
- SwiftUI `Label(title, systemImage)` for every icon+text pair inside `Form`/`Menu`/`ContextMenu`/`ConfirmationDialog`. Not applicable to RN-rendered rows (article cards, chips) — **Keep** those.

### 3.9 Section (settings) — **Do, biggest UI win**
- **Today:** `profile/ui/settings-group.tsx` (title + rounded container) + custom `Button variant="button"` rows in `profile/index.tsx`; similar grouped layout in `codex-settings` and `self-hosted-settings` sheets.
- **Plan:** `profile/ui/settings-list.ios.tsx`: one `Host` → `Form` (`listStyle('insetGrouped')`) → `Section(header)` → `LabeledContent` / `Label` / `Toggle` / `Picker` / `Button` rows, with `RNHostView` for the OPML status card, avatar/account header, RevenueCat customer-center trigger. Android keeps `SettingsGroup`.
- Do `codex-settings` and `self-hosted-settings` sheet bodies the same way (SwiftUI `Form` inside the True Sheet, `scrollable`).
- `Picker` also replaces the reader-settings segmented rows (`segmented.row`, `navigation/segmented-control`) → `pickerStyle('segmented')`, and `navigation/stepper` → SwiftUI `Stepper` (font size). Verify against reader chrome behavior first.
- **Risk:** medium — dark mode/theme colors must map (SwiftUI `Form` background vs `COLORS.background`); test sepia/dark.

### 3.10 Context menu — **Partial**
- **Today:** `ui/context-menu` and `ui/dropdown-menu` wrap **zeego** (which is itself native `UIMenu`/`UIContextMenuInteraction`, so today's visuals are already native). Consumers: `feed-switcher` (`feed-list-item`, `folder-group`, index), `profile`, `article-actions.bar`, reader menus.
- **Do:** tap-triggered menus (dropdown) → SwiftUI `Menu` in `Host matchContents` (pattern already shipped in `reader-corner-menu.ios.tsx`): profile language/preference chips, article actions overflow, feed switcher header.
- **Spike then decide:** long-press row menus (`feed-list-item`, `folder-group`) → `@expo/ui` `ContextMenu` needs a Host **per row**. Measure with a 50-row feed switcher; if scroll/mount cost is visible → **Keep zeego** for row-level menus (no visual difference).
- Then remove `zeego`, `@react-native-menu/menu`, `react-native-ios-context-menu` only if nothing depends on them.

### 3.11 Control group — **Do (small, targeted)**
- SwiftUI `ControlGroup` for the grouped action clusters: `article-actions.bar` (save/share/AI/etc.) and reader toolbar clusters, wrapped in `GlassEffectContainer` on iOS 26 so buttons merge into one glass capsule. Android keeps current bar.
- **Risk:** low–medium (reader chrome tap-to-toggle animation ~140 ms must still drive show/hide from RN around the Host).

### 3.12 Confirmation dialog — **Do**
- SwiftUI `ConfirmationDialog` (action-sheet style with destructive/cancel roles) for: delete feed / delete folder / unfollow (`feed-switcher` ×3, currently `Alert.alert` with destructive buttons), delete-account confirm. Anchor to the triggering control so it presents as a popover on iPad.
- Wrapper: `useNativeConfirm({title, message, destructiveLabel})` returning `{confirm(): Promise<boolean>}` on both platforms (Android falls back to `Alert.alert`) so call sites stay platform-agnostic.

---

## 3.99 Progress log

- **PR 1 + 2 (sheets) code-complete, untested on device:** `BottomSheet` / `Modal` / `Input` rebuilt on True Sheet; all 29 gorhom importers migrated; `useBottomSheetBackHandler`, `BottomSheetModalProvider` and `@gorhom/bottom-sheet` removed; `tsc` clean. **Needs a dev-client rebuild + manual pass on iOS and Android** (see §2 Verification) before merge.

## 4. Order of work

| # | PR | Contains | Depends on |
|---|---|---|---|
| 0 | Prereqs | §1 | — |
| 1 | Sheet wrappers | `BottomSheet`, `Modal`, `Input`, provider, delete back-handler hook | 0 |
| 2 | Sheet callers | all 25 feature/inline sheets, split into ~3 PRs (settings-ish / reader / feed-switcher+discover) | 1 |
| 3 | Small native controls | Back button, Toggle, Progress/Spinner, Label | 0 (parallel to 1–2) |
| 4 | Dialogs | ConfirmationDialog + Alert wrapper, replace `Alert.alert` in feed-switcher/profile | 2 (feed-switcher must be True Sheet first) |
| 5 | Menus | `Menu` for tap menus; ContextMenu spike | 0 |
| 6 | Settings | `Form`/`Section`/`LabeledContent`/`Picker`/`Stepper` for profile + codex/self-hosted sheets | 2, 3 |
| 7 | Control group | article actions bar | 3 |
| 8 | Tab bar spike → decision | NativeTabs | 2 (feed switcher sheet) |

Every PR: `bun run check-types`, `bun run check` (Biome), iOS simulator screenshots (light/dark/sepia where relevant), Android emulator smoke test of anything touching sheets.

---

## 5. Explicit "Keep as-is" list (with reasons)

| Item | Reason |
|---|---|
| Article-list dividers, skeletons | Host-per-row perf cost, no benefit |
| OPML gradient-tick progress bar, reading-progress ring | Custom brand visuals ([[feedback_visual_restraint]]) |
| Text inputs inside sheets, Discover search input (unless native header) | Focus/keyboard/ref control |
| `lib/review` `Alert.alert` | Non-UI code path; already native |
| Row-level long-press menus (pending spike) | Host-per-row cost; zeego is already native UIMenu |
| All Android UI | Out of scope by design (only the sheet library changes) |

---

## 6. Decisions (resolved)

1. **Icons in SwiftUI trees:** SF Symbols are OK there; Solar stays elsewhere.
2. **Tab bar:** approved: adopt `NativeTabs` on iOS; long-press / re-press "Following" opens the feed switcher sheet (still gated on the §3.2 spike looking right).
3. **Discover:** approved: native stack header + `headerSearchBarOptions` (so the Discover search input moves from Partial to **Do**).
4. **Min iOS:** glass styles on iOS 26+, `bordered` fallback below.

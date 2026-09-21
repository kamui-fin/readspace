import { type MenuAction, MenuView } from '@expo/ui/community/menu';
import type { ReactNode } from 'react';
import type { ArticleOptionsMenuModel, ArticleViewMode } from '../article-actions.bar.types';
import { availableViewModes, OPEN_IN_BROWSER_LABEL, viewModeLabel } from './types';

export * from './types';

interface ArticleOptionsMenuProps {
  model: ArticleOptionsMenuModel;
  /** The overflow button the menu hangs off. */
  children: ReactNode;
}

/** `view:` namespaces the mode ids so they can't collide with a plain action id. */
const VIEW_ACTION_PREFIX = 'view:';

/**
 * The reader's overflow menu on Android (and any non-iOS default): a real anchored dropdown
 * rather than the bottom sheet this used to be.
 *
 * A sheet was the wrong shape for what it held. Two of its three "Viewing Mode" rows were a
 * choice between mutually exclusive states — the thing a menu expresses with a checkmark and a
 * sheet had to fake with a tinted icon — and the third, "Open in Browser", was a one-shot action
 * that cost a sheet presentation, a scroll container and a dismissal to reach.
 *
 * iOS does not use this: there the overflow button lives inside the navigation bar's SwiftUI
 * host, so its menu is built there with a real `Menu` + `Picker`. Both read from the same
 * `types.ts` so the rows stay identical.
 */
export function ArticleOptionsMenu({ model, children }: ArticleOptionsMenuProps) {
  const modes = availableViewModes(model);

  const actions: MenuAction[] = [
    ...(model.onOpenInBrowser
      ? [{ id: 'browser', title: OPEN_IN_BROWSER_LABEL, image: 'safari' as const }]
      : []),
    ...modes.map(
      (mode): MenuAction => ({
        id: `${VIEW_ACTION_PREFIX}${mode}`,
        title: viewModeLabel(mode, model),
        state: model.currentView === mode ? 'on' : 'off',
      })
    ),
  ];

  const onPressAction = ({ nativeEvent: { event } }: { nativeEvent: { event: string } }) => {
    if (event === 'browser') {
      model.onOpenInBrowser?.();
      return;
    }
    if (event.startsWith(VIEW_ACTION_PREFIX)) {
      model.onSelectView(event.slice(VIEW_ACTION_PREFIX.length) as ArticleViewMode);
    }
  };

  return (
    <MenuView actions={actions} onPressAction={onPressAction}>
      {children}
    </MenuView>
  );
}

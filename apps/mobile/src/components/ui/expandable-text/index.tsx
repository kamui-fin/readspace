import { Text } from '@components/ui/text';
import MaskedView from '@react-native-masked-view/masked-view';
import { useCallback, useId, useState } from 'react';
import { type NativeSyntheticEvent, Pressable, type TextLayoutEventData, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import type { ExpandableTextProps } from './types';

export type { ExpandableTextProps } from './types';

/** Opaque above this fraction of the collapsed block, dissolving to nothing at the bottom edge. */
const fadeStartOffset = (collapsedLines: number) => Math.max(0, 1 - 1 / collapsedLines);

/**
 * Long copy clamped to a few lines, the last of which dissolves into the page, with a `More`
 * toggle underneath — the treatment Music and the App Store use for a description.
 *
 * There is no native component for this: SwiftUI's `Text` truncates with an ellipsis and has no
 * built-in expander, and neither UIKit nor Compose ships one either. So the fade is drawn here,
 * with `MaskedView` over an SVG gradient. The mask fades *the glyphs themselves* to transparent
 * rather than laying a background-coloured scrim on top of them, which matters because both
 * callers sit on plain page backgrounds today but the digest cards may not tomorrow — a scrim
 * would have to be told the colour behind it and would smear over any image or tint.
 *
 * Overflow is measured from an invisible unclamped copy rather than inferred from the clamped
 * one: `onTextLayout` on a `numberOfLines` text reports the lines it *drew*, so a paragraph that
 * happens to be exactly `collapsedLines` long is indistinguishable from one that was cut, and
 * the toggle would appear on text with nothing left to show.
 */
export function ExpandableText({
  text,
  collapsedLines = 3,
  expandLabel = 'More',
  collapseLabel = 'Less',
  size,
  fontFamily = 'geist',
  className,
  style,
  actionClassName = 'text-primary-foreground',
  actionFontFamily = 'geist-medium',
}: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);
  const [lineCount, setLineCount] = useState(0);
  const [lineHeight, setLineHeight] = useState(0);

  // `useId` is the only collision-proof source for this: react-native-svg resolves `url(#id)`
  // against a shared registry, so two of these on one screen (the digest has several) would
  // otherwise share a gradient. The colons it produces are not valid in a fragment identifier.
  const gradientId = `expandable-fade-${useId().replace(/:/g, '')}`;

  const handleMeasure = useCallback((event: NativeSyntheticEvent<TextLayoutEventData>) => {
    const { lines } = event.nativeEvent;
    if (lines.length === 0) return;
    setLineCount(lines.length);
    setLineHeight(lines[0].height);
  }, []);

  const toggle = useCallback(() => setExpanded((previous) => !previous), []);

  if (!text?.trim()) return null;

  const measured = lineCount > 0;
  const overflows = measured && lineCount > collapsedLines;
  const faded = overflows && !expanded;

  const body = (
    <Text
      size={size}
      fontFamily={fontFamily}
      className={className}
      style={style}
      numberOfLines={expanded ? undefined : collapsedLines}>
      {text}
    </Text>
  );

  return (
    <View>
      {/* Measuring copy: absolutely positioned so it contributes no height, and unclamped so its
          line count is the article's, not the clamp's. */}
      <View
        pointerEvents="none"
        style={{ position: 'absolute', left: 0, right: 0, top: 0, opacity: 0 }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        <Text
          size={size}
          fontFamily={fontFamily}
          className={className}
          style={style}
          onTextLayout={handleMeasure}>
          {text}
        </Text>
      </View>

      {faded ? (
        // An explicit height: MaskedView takes its size from the mask on Android, and a
        // percentage-sized SVG inside an unsized parent collapses to nothing there.
        <MaskedView
          style={{ height: Math.ceil(lineHeight * collapsedLines) }}
          maskElement={
            <Svg width="100%" height="100%">
              <Defs>
                <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor="#ffffff" stopOpacity="1" />
                  <Stop
                    offset={String(fadeStartOffset(collapsedLines))}
                    stopColor="#ffffff"
                    stopOpacity="1"
                  />
                  <Stop offset="1" stopColor="#ffffff" stopOpacity="0" />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
            </Svg>
          }>
          {body}
        </MaskedView>
      ) : (
        body
      )}

      {overflows && (
        <Pressable
          onPress={toggle}
          accessibilityRole="button"
          hitSlop={8}
          className="self-start pt-1">
          <Text size={size} fontFamily={actionFontFamily} className={actionClassName} style={style}>
            {expanded ? collapseLabel : expandLabel}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

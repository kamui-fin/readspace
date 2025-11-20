import { useClampText } from '@hooks/useClampText';
import { ReactNode, useRef } from 'react';
import { Platform, Text } from 'react-native';

export type ClampTextProps = {
  text?: string | Iterable<ReactNode> | null;
  ellipsis?: string;
  expandButtonWidth?: number;
  foldText?: string | undefined;
  expandText?: string | undefined;
  maxLines?: number;
  className?: string;
};

export const ClampText = ({
  text = '',
  className,
  maxLines = 2,
  ellipsis = '...',
  expandButtonWidth = 10,
  foldText = 'less',
  expandText = 'more',
}: ClampTextProps) => {
  const textRef = useRef<Text>(null);

  const isPureText = typeof text === 'string';

  const { showMore, onShowLess, onShowMore, showLess, innerText, onTextLayout } = useClampText({
    element: textRef.current as any,
    rows: maxLines,
    text,
    expandButtonWidth,
    ellipsis,
    expandText,
    foldText,
  });

  if (!text || text === '') {
    return null;
  }

  return (
    <Text
      className={className}
      ref={textRef}
      onTextLayout={onTextLayout}
      style={
        Platform.OS === 'web'
          ? {
              // @ts-expect-error
              wordBreak: 'break-word',
            }
          : {}
      }>
      {innerText}
      {(showMore || showLess) && (isPureText || Platform.OS !== 'web') && (
        <Text
          onPress={showMore ? onShowMore : onShowLess}
          className="font-geist-bold text-sm text-black dark:text-white">
          {` ${showMore ? expandText : foldText}`}
        </Text>
      )}
    </Text>
  );
};

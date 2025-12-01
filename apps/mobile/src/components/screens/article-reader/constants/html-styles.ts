import { COLORS } from '@lib/constants/colors';
import Constants from 'expo-constants';
import { useMemo } from 'react';

export const useHtmlStyles = (
  textColor: string,
  greyColor: string,
  bgColor: string,
  lightGreyColor: string,
  midGreyColor: string,
  colors: typeof COLORS.light | typeof COLORS.dark
) => {
  const tagsStyles = useMemo(
    () => ({
      // Base body styles
      body: {
        fontFamily: 'EBGaramond_400Regular',
        fontSize: 18,
        lineHeight: 30,
        color: textColor,
      },
      // Paragraph styles
      p: {
        marginBottom: 20,
        fontFamily: 'EBGaramond_400Regular',
        fontSize: 18,
        lineHeight: 30,
        color: textColor,
      },
      // Heading hierarchy with proper spacing and typography
      h1: {
        fontFamily: 'EBGaramond_700Bold',
        fontSize: 32,
        lineHeight: 40,
        color: textColor,
        marginTop: 32,
        marginBottom: 16,
      },
      h2: {
        fontFamily: 'EBGaramond_700Bold',
        fontSize: 28,
        lineHeight: 36,
        color: textColor,
        marginTop: 28,
        marginBottom: 14,
      },
      h3: {
        fontFamily: 'EBGaramond_600SemiBold',
        fontSize: 24,
        lineHeight: 32,
        color: textColor,
        marginTop: 24,
        marginBottom: 12,
      },
      h4: {
        fontFamily: 'EBGaramond_600SemiBold',
        fontSize: 20,
        lineHeight: 28,
        color: textColor,
        marginTop: 20,
        marginBottom: 10,
      },
      h5: {
        fontFamily: 'EBGaramond_600SemiBold',
        fontSize: 18,
        lineHeight: 26,
        color: textColor,
        marginTop: 18,
        marginBottom: 8,
      },
      h6: {
        fontFamily: 'EBGaramond_600SemiBold',
        fontSize: 16,
        lineHeight: 24,
        color: textColor,
        marginTop: 16,
        marginBottom: 8,
      },
      // Inline text formatting
      strong: {
        fontFamily: 'EBGaramond_700Bold',
        color: textColor,
      },
      b: {
        fontFamily: 'EBGaramond_700Bold',
        color: textColor,
      },
      em: {
        fontFamily: 'EBGaramond_400Regular_Italic',
        fontStyle: 'italic' as const,
      },
      i: {
        fontFamily: 'EBGaramond_400Regular_Italic',
        fontStyle: 'italic' as const,
      },
      u: {
        textDecorationLine: 'underline' as const,
      },
      s: {
        textDecorationLine: 'line-through' as const,
        color: greyColor,
      },
      mark: {
        backgroundColor: colors.muted_green,
        color: textColor,
      },
      // Links with brand secondary color
      // Note: When links are inside <em> or <i> tags, react-native-render-html
      // will merge styles, so the italic font family from parent will be used
      a: {
        color: colors.secondary,
        textDecorationLine: 'underline' as const,
        fontFamily: 'EBGaramond_500Medium',
      },
      // Code elements with monospace font
      code: {
        fontFamily: 'GeistMono_400Regular',
        fontSize: 16,
        lineHeight: 24,
        backgroundColor: midGreyColor,
        color: colors.primary,
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 4,
      },
      // Pre-formatted code blocks
      pre: {
        fontFamily: 'GeistMono_400Regular',
        fontSize: 14,
        lineHeight: 22,
        backgroundColor: midGreyColor,
        color: textColor,
        padding: 16,
        borderRadius: 8,
        marginTop: 16,
        marginBottom: 20,
      },
      // Blockquotes with left border and muted styling
      blockquote: {
        fontFamily: 'EBGaramond_400Regular',
        fontSize: 18,
        lineHeight: 30,
        color: textColor,
        fontStyle: 'italic' as const,
        borderLeftWidth: 4,
        borderLeftColor: colors.secondary,
        backgroundColor: lightGreyColor,
        padding: 16,
        marginTop: 20,
        marginBottom: 20,
        marginLeft: 0,
        marginRight: 0,
      },
      // Horizontal rule
      hr: {
        backgroundColor: lightGreyColor,
        height: 1,
        marginTop: 24,
        marginBottom: 24,
        borderWidth: 0,
      },
      // Lists - unordered
      ul: {
        marginTop: 12,
        marginBottom: 20,
        paddingLeft: 24,
      },
      // Lists - ordered
      ol: {
        marginTop: 12,
        marginBottom: 20,
        paddingLeft: 24,
      },
      // List items with proper spacing
      li: {
        fontFamily: 'EBGaramond_400Regular',
        fontSize: 18,
        lineHeight: 30,
        color: textColor,
        marginBottom: 8,
        paddingLeft: 8,
      },
      // Tables
      table: {
        marginTop: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: lightGreyColor,
        borderRadius: 8,
      },
      thead: {
        backgroundColor: midGreyColor,
      },
      tbody: {
        backgroundColor: bgColor,
      },
      tr: {
        borderBottomWidth: 1,
        borderBottomColor: lightGreyColor,
      },
      th: {
        fontFamily: 'EBGaramond_600SemiBold',
        fontSize: 16,
        lineHeight: 24,
        color: textColor,
        padding: 12,
        textAlign: 'left' as const,
      },
      td: {
        fontFamily: 'EBGaramond_400Regular',
        fontSize: 16,
        lineHeight: 24,
        color: textColor,
        padding: 12,
      },
      // Figure and caption
      figure: {
        marginTop: 20,
        marginBottom: 20,
        marginLeft: 0,
        marginRight: 0,
      },
      figcaption: {
        fontFamily: 'EBGaramond_400Regular',
        fontSize: 14,
        lineHeight: 20,
        color: greyColor,
        textAlign: 'center' as const,
        marginTop: 8,
      },
      // Images
      img: {
        marginTop: 16,
        marginBottom: 16,
      },
      // Superscript and subscript
      sup: {
        fontSize: 14,
        lineHeight: 14,
      },
      sub: {
        fontSize: 14,
        lineHeight: 14,
      },
      // Small text
      small: {
        fontSize: 14,
        lineHeight: 22,
        color: greyColor,
      },
      // Abbreviation
      abbr: {
        textDecorationLine: 'underline' as const,
        textDecorationStyle: 'dotted' as const,
      },
      // Citation
      cite: {
        fontFamily: 'EBGaramond_500Medium',
        fontStyle: 'italic' as const,
        color: greyColor,
      },
      // Keyboard input
      kbd: {
        fontFamily: 'GeistMono_500Medium',
        fontSize: 14,
        backgroundColor: midGreyColor,
        color: textColor,
        paddingVertical: 2,
        paddingHorizontal: 6,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: colors.muted_green,
      },
      // Sample output
      samp: {
        fontFamily: 'GeistMono_400Regular',
        fontSize: 16,
        backgroundColor: midGreyColor,
        color: textColor,
      },
      // Variable
      var: {
        fontFamily: 'EBGaramond_400Regular',
        fontStyle: 'italic' as const,
        color: colors.primary,
      },
      // Definition
      dfn: {
        fontFamily: 'EBGaramond_600SemiBold',
      },
      // Time element
      time: {
        fontFamily: 'EBGaramond_400Regular',
        color: greyColor,
      },
    }),
    [textColor, greyColor, bgColor, lightGreyColor, midGreyColor, colors]
  );

  const systemFonts = useMemo(
    () => [
      'EBGaramond_400Regular',
      'EBGaramond_500Medium',
      'EBGaramond_600SemiBold',
      'EBGaramond_700Bold',
      'EBGaramond_400Regular_Italic',
      'EBGaramond_500Medium_Italic',
      'EBGaramond_600SemiBold_Italic',
      'EBGaramond_700Bold_Italic',
      'Geist_400Regular',
      'Geist_500Medium',
      'Geist_600SemiBold',
      'Geist_700Bold',
      'GeistMono_400Regular',
      'GeistMono_500Medium',
      'GeistMono_600SemiBold',
      'GeistMono_700Bold',
      'serif',
      ...Constants.systemFonts,
    ],
    []
  );

  const classesStyles = useMemo(
    () => ({
      'list-marker': {
        marginRight: 8,
        minWidth: 20,
      },
    }),
    []
  );

  const renderersProps = useMemo(
    () => ({
      ul: {
        markerTextStyle: {
          fontFamily: 'EBGaramond_400Regular',
          fontSize: 18,
          color: textColor,
        },
      },
      ol: {
        markerTextStyle: {
          fontFamily: 'EBGaramond_400Regular',
          fontSize: 18,
          color: textColor,
        },
      },
    }),
    [textColor]
  );

  return { tagsStyles, systemFonts, classesStyles, renderersProps };
};

import { Text } from '@components/ui/text';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { useIsDarkMode } from '@hooks/useIsDarkMode';
import { useOnFocus } from '@hooks/useOnFocus';
import { COLORS } from '@lib/constants/colors';
import clsx from 'clsx';
import { forwardRef, JSX, useMemo } from 'react';
import {
  Platform,
  Pressable,
  type PressableProps,
  TextInput as ReactNativeTextInput,
  type TextInputProps as RNTextInputProps,
  type StyleProp,
  type TextStyle,
  View,
} from 'react-native';

type InputProps = Omit<RNTextInputProps, 'style' | 'className'> & {
  leftElement?: JSX.Element;
  rightElement?: JSX.Element;
  isInvalid?: boolean;
  id?: string;
  disabled?: boolean;
  type?: RNTextInputProps['inputMode'];
  label?: string;
  errorText?: string;
  helperText?: string;
  inputStyle?: StyleProp<TextStyle>;
  autocomplete?: 'on' | 'off';
  borderRadius?: number;
  className?: string;
};

let idCounter = 0;
// Replace this with useId from React 18. Currently we're doing client side rendering, so probably this is safe!
export const useId = (id?: string) => {
  const newId = useMemo(() => {
    if (id) {
      return id;
    }
    idCounter++;
    return idCounter.toString();
  }, [id]);

  return newId;
};

// Internal Input component to avoid dry violations
const InputBase = forwardRef((props: InputProps & { TextInputComponent: any }, ref: any) => {
  const {
    leftElement,
    rightElement,
    placeholder,
    onChangeText,
    value,
    label,
    helperText,
    errorText,
    disabled,
    type,
    isInvalid,
    autoFocus,
    autocomplete,
    borderRadius = 9999,
    secureTextEntry,
    multiline,
    TextInputComponent,
    ...rest
  } = props;
  const { onFocus, onBlur } = useOnFocus();
  const isDark = useIsDarkMode();
  const inputId = useId(props.id);
  const helperTextId = useId();
  const errorTextId = useId();

  return (
    <View>
      {label ? (
        <>
          <Text
            nativeID={inputId}
            className={clsx('font-geist-medium text-sm text-gray-900 dark:text-white')}>
            {label}
          </Text>
          <View className="h-2" />
        </>
      ) : null}

      <View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            borderRadius: borderRadius,
            backgroundColor: isDark ? COLORS.dark.grey6 : COLORS.light.grey6,
            borderColor: isInvalid
              ? isDark
                ? COLORS.dark.destructive
                : COLORS.light.destructive
              : undefined,
            borderWidth: isInvalid ? 1 : undefined,
            opacity: disabled ? 0.75 : 1,
          },
        ]}>
        {leftElement}
        <TextInputComponent
          className={clsx('text-gray-900 dark:text-white', 'font-geist-medium', props.className)}
          style={[
            Platform.select({
              web: {
                outline: 'none',
              },
              default: undefined,
            }),
            {
              flex: 1,
              flexShrink: 1,
              color: isDark ? '#ffffff' : '#232222',
              paddingTop: Platform.select({
                ios: 16,
                default: 16,
              }),
              paddingBottom: Platform.select({
                ios: 16,
                default: 16,
              }),
              paddingLeft: leftElement ? 0 : 16,
              paddingRight: rightElement ? 0 : 16,
              fontFamily: props.className?.includes('font-geist-mono')
                ? 'GeistMono_500Medium'
                : 'Geist_500Medium',
            },
            props.inputStyle,
          ]}
          placeholderTextColor={isDark ? COLORS.dark.grey2 : COLORS.light.grey2}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          onFocus={(e: any) => {
            onFocus();
            if (rest.onFocus) {
              (rest.onFocus as any)(e);
            }
          }}
          onBlur={(e: any) => {
            onBlur();
            if (rest.onBlur) {
              (rest.onBlur as any)(e);
            }
          }}
          nativeID={inputId}
          selectionColor={isDark ? COLORS.dark.grey3 : COLORS.light.grey3}
          inputMode={type}
          editable={!disabled}
          autoFocus={autoFocus}
          aria-describedby={Platform.select({
            web: helperText ? helperTextId : undefined,
            default: undefined,
          })}
          aria-errormessage={Platform.select({
            web: errorText ? errorTextId : undefined,
            default: undefined,
          })}
          aria-invalid={Platform.select({
            web: isInvalid,
            default: undefined,
          })}
          ref={ref}
          autoComplete={autocomplete === 'off' ? 'off' : rest.autoComplete}
          secureTextEntry={secureTextEntry}
          multiline={multiline}
          {...rest}
        />
        {rightElement && (
          <View style={{ marginLeft: 'auto', paddingRight: 8 }}>{rightElement}</View>
        )}
      </View>
      {helperText ? (
        <Text
          nativeID={helperTextId}
          className={clsx('font-geist-medium text-sm text-gray-600 dark:text-gray-400')}
          style={{ marginTop: 4 }}>
          {helperText}
        </Text>
      ) : null}
      {errorText ? (
        <Text
          nativeID={errorTextId}
          className={clsx('font-geist-medium text-sm')}
          style={{
            marginTop: 4,
            color: isDark ? COLORS.dark.destructive : COLORS.light.destructive,
          }}>
          {errorText}
        </Text>
      ) : null}
    </View>
  );
});

export const Input = forwardRef((props: InputProps, ref: any) => {
  return <InputBase {...props} ref={ref} TextInputComponent={ReactNativeTextInput} />;
});

export const BottomSheetInput = forwardRef((props: InputProps, ref: any) => {
  return <InputBase {...props} ref={ref} TextInputComponent={BottomSheetTextInput} />;
});

Input.displayName = 'Input';
BottomSheetInput.displayName = 'BottomSheetInput';

// This component adds appropriate padding to match our design system and increase the pressable area
// Usage - with rightElement and leftElement
export const InputPressable = (props: PressableProps) => {
  return <Pressable style={{ padding: 8 }} {...props} />;
};

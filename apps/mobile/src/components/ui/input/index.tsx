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
  Text,
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

// biome-ignore lint/suspicious/noExplicitAny: forwardRef typing
export const Input = forwardRef((props: InputProps, ref: any) => {
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
            className={clsx('text-sm font-bold text-gray-900 dark:text-white')}>
            {label}
          </Text>
          <View className="h-2" />
        </>
      ) : null}

      <View
        className={clsx('transition-all duration-300')}
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
        <ReactNativeTextInput
          className={clsx('text-gray-900 dark:text-white')}
          style={[
            // @ts-expect-error remove focus outline on web as we'll control the focus styling
            Platform.select({
              web: {
                outline: 'none',
              },
              default: undefined,
            }),
            {
              flexGrow: 1,
              paddingTop: Platform.select({
                ios: 16,
                default: 12,
              }),
              paddingBottom: Platform.select({
                ios: 16,
                default: 12,
              }),
              paddingLeft: leftElement ? 0 : 16,
              paddingRight: rightElement ? 0 : 16,
              fontWeight: '500',
            },
            props.inputStyle,
          ]}
          placeholderTextColor={isDark ? COLORS.dark.grey2 : COLORS.light.grey2}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          // @ts-expect-error
          readOnly={disabled}
          onFocus={onFocus}
          onBlur={onBlur}
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
        {rightElement && <View style={{ marginLeft: 'auto' }}>{rightElement}</View>}
      </View>
      {helperText ? (
        <Text
          nativeID={helperTextId}
          className={clsx('text-sm text-gray-600 dark:text-gray-400')}
          style={{ marginTop: 4, fontWeight: '600' }}>
          {helperText}
        </Text>
      ) : null}
      {errorText ? (
        <Text
          nativeID={errorTextId}
          className={clsx('text-sm')}
          style={{
            marginTop: 4,
            fontWeight: '600',
            color: isDark ? COLORS.dark.destructive : COLORS.light.destructive,
          }}>
          {errorText}
        </Text>
      ) : null}
    </View>
  );
});

Input.displayName = 'Input';

// This component adds appropriate padding to match our design system and increase the pressable area
// Usage - with rightElement and leftElement
export const InputPressable = (props: PressableProps) => {
  return <Pressable style={{ padding: 8 }} {...props} />;
};

import { forwardRef } from 'react';
import { StyleSheet, type TextInputProps } from 'react-native';
import { OtpInput, type OtpInputRef } from 'react-native-otp-entry';

const COLORS = {
    primary: '#386641',
    midGrey: '#F3F3F3',
    grey: '#90988B',
    red: '#EA4335',
    black: '#232222',
};

export interface OTPInputProps extends Omit<TextInputProps, 'value' | 'onChangeText'> {
    numberOfDigits?: number;
    value?: string;
    onTextChange?: (text: string) => void;
    onFilled?: (text: string) => void;
    error?: boolean;
}

export const OTPInput = forwardRef<OtpInputRef, OTPInputProps>(
    (
        {
            numberOfDigits = 6,
            value = '',
            onTextChange,
            onFilled,
            error = false,
            autoFocus = true,
            ...props
        },
        ref
    ) => {
        return (
            <OtpInput
                ref={ref}
                numberOfDigits={numberOfDigits}
                onTextChange={onTextChange}
                onFilled={onFilled}
                autoFocus={autoFocus}
                type="numeric"
                focusColor={error ? COLORS.red : COLORS.primary}
                textInputProps={{
                    autoComplete: 'one-time-code',
                    textContentType: 'oneTimeCode',
                    ...props,
                }}
                focusStickBlinkingDuration={500}
                theme={{
                    containerStyle: styles.container,
                    pinCodeContainerStyle: {
                        ...styles.pinCodeContainer,
                        ...(error && styles.pinCodeContainerError),
                    },
                    focusedPinCodeContainerStyle: {
                        ...styles.focusedPinCodeContainer,
                        ...(error && styles.focusedPinCodeContainerError),
                    },
                    pinCodeTextStyle: styles.pinCodeText,
                    filledPinCodeContainerStyle: styles.filledPinCodeContainer,
                }}
            />
        );
    }
);

OTPInput.displayName = 'OTPInput';

const styles = StyleSheet.create({
    container: {
        width: '100%',
        gap: 0,
    },
    pinCodeContainer: {
        height: 54,
        width: 54,
        borderRadius: 12,
        backgroundColor: COLORS.midGrey,
        borderWidth: 0,
    },
    pinCodeContainerError: {
        borderWidth: 2,
        borderColor: COLORS.red,
    },
    focusedPinCodeContainer: {
        borderWidth: 2,
        borderColor: COLORS.primary,
    },
    focusedPinCodeContainerError: {
        borderColor: COLORS.red,
    },
    pinCodeText: {
        fontFamily: 'GeistMono_400Regular',
        fontSize: 24,
        color: COLORS.black,
    },
    filledPinCodeContainer: {
        backgroundColor: COLORS.midGrey,
    },
});

import { Button } from '@/components/ui/Button';
import {
    BottomSheetBackdrop,
    BottomSheetModal,
    BottomSheetTextInput,
    BottomSheetView,
} from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { toast } from 'sonner-native';
import { z } from 'zod';
import { validateSupabaseConnection } from '@/lib/supabase/client';

const selfHostSchema = z.object({
    apiUrl: z.string().url('Invalid API URL'),
    supabaseUrl: z.string().url('Invalid Supabase URL'),
    supabaseAnonKey: z.string().min(1, 'Supabase Anonymous Key is required'),
});

export interface SelfHostSettingsProps {
    onSave?: (data: { apiUrl: string; supabaseUrl: string; supabaseAnonKey: string }) => void;
    initialData?: {
        apiUrl?: string;
        supabaseUrl?: string;
        supabaseAnonKey?: string;
    };
}

export const SelfHostSettings = forwardRef<BottomSheetModal, SelfHostSettingsProps>(
    ({ onSave, initialData }, ref) => {
        const [apiUrl, setApiUrl] = useState(initialData?.apiUrl || '');
        const [supabaseUrl, setSupabaseUrl] = useState(initialData?.supabaseUrl || '');
        const [supabaseAnonKey, setSupabaseAnonKey] = useState(initialData?.supabaseAnonKey || '');
        const [errors, setErrors] = useState<Record<string, string>>({});
        const [isValidating, setIsValidating] = useState(false);

        const snapPoints = useMemo(() => ['90%'], []);

        // Validate form
        const isValid = useMemo(() => {
            try {
                selfHostSchema.parse({
                    apiUrl,
                    supabaseUrl,
                    supabaseAnonKey,
                });
                return true;
            } catch {
                return false;
            }
        }, [apiUrl, supabaseUrl, supabaseAnonKey]);

        const handleSave = useCallback(async () => {
            setIsValidating(true);
            setErrors({});

            try {
                // Validate form schema first
                const data = selfHostSchema.parse({
                    apiUrl,
                    supabaseUrl,
                    supabaseAnonKey,
                });

                // Test API endpoint
                toast.loading('Validating API endpoint...', { id: 'validation' });
                try {
                    const apiResponse = await fetch(data.apiUrl + '/health', {
                        method: 'GET',
                        headers: { 'Content-Type': 'application/json' },
                    });

                    if (!apiResponse.ok) {
                        throw new Error(
                            `API endpoint returned ${apiResponse.status}: ${apiResponse.statusText}`
                        );
                    }
                } catch (error) {
                    toast.dismiss('validation');
                    const errorMsg =
                        error instanceof Error ? error.message : 'Failed to connect to API';
                    setErrors((prev) => ({ ...prev, apiUrl: errorMsg }));
                    setIsValidating(false);
                    return;
                }

                // Test Supabase connection
                toast.loading('Validating Supabase connection...', { id: 'validation' });
                const supabaseValidation = await validateSupabaseConnection(
                    data.supabaseUrl,
                    data.supabaseAnonKey
                );

                if (!supabaseValidation.valid) {
                    toast.dismiss('validation');
                    setErrors((prev) => ({
                        ...prev,
                        supabaseUrl: supabaseValidation.error || 'Connection failed',
                    }));
                    setIsValidating(false);
                    return;
                }

                // All validations passed
                toast.success('Configuration validated successfully', { id: 'validation' });
                onSave?.(data);

                if (ref && typeof ref !== 'function' && ref.current) {
                    ref.current.dismiss();
                }
            } catch (error) {
                toast.dismiss('validation');
                if (error instanceof z.ZodError) {
                    const newErrors: Record<string, string> = {};
                    error.issues.forEach((err: z.ZodIssue) => {
                        if (err.path[0]) {
                            newErrors[err.path[0] as string] = err.message;
                        }
                    });
                    setErrors(newErrors);
                }
            } finally {
                setIsValidating(false);
            }
        }, [apiUrl, supabaseUrl, supabaseAnonKey, onSave, ref]);

        const renderBackdrop = useCallback(
            (props: any) => (
                <BottomSheetBackdrop
                    {...props}
                    appearsOnIndex={0}
                    disappearsOnIndex={-1}
                    opacity={0.5}
                />
            ),
            []
        );

        // Clear errors when values change
        useEffect(() => {
            if (errors.apiUrl && apiUrl) setErrors((prev) => ({ ...prev, apiUrl: '' }));
        }, [apiUrl, errors.apiUrl]);

        useEffect(() => {
            if (errors.supabaseUrl && supabaseUrl)
                setErrors((prev) => ({ ...prev, supabaseUrl: '' }));
        }, [supabaseUrl, errors.supabaseUrl]);

        useEffect(() => {
            if (errors.supabaseAnonKey && supabaseAnonKey)
                setErrors((prev) => ({ ...prev, supabaseAnonKey: '' }));
        }, [supabaseAnonKey, errors.supabaseAnonKey]);

        return (
            <BottomSheetModal
                ref={ref}
                snapPoints={snapPoints}
                enablePanDownToClose
                stackBehavior="push"
                keyboardBehavior="extend"
                keyboardBlurBehavior="restore"
                android_keyboardInputMode="adjustResize"
                backdropComponent={renderBackdrop}
                backgroundStyle={{ backgroundColor: '#FFFFFF' }}
                handleIndicatorStyle={{ backgroundColor: '#D1DBCD' }}>
                <BottomSheetView className="flex-1 px-6 py-4">
                    <Text className="mb-2 font-geist-bold text-2xl tracking-heading text-black">
                        Self-hosted connection
                    </Text>
                    <Text className="mb-6 font-geist text-base text-grey">
                        Connect to your own Readspace instance
                    </Text>

                    <View style={{ gap: 16 }}>
                        <View>
                            <Text className="mb-2 font-geist-medium text-sm text-black">
                                API Url
                            </Text>
                            <BottomSheetTextInput
                                value={apiUrl}
                                onChangeText={setApiUrl}
                                placeholder="http://localhost:18008"
                                placeholderTextColor="#90988B"
                                keyboardType="url"
                                autoCapitalize="none"
                                autoComplete="off"
                                autoCorrect={false}
                                style={{
                                    borderRadius: 16,
                                    backgroundColor: '#F3F3F3',
                                    paddingHorizontal: 20,
                                    paddingVertical: 16,
                                    fontSize: 16,
                                    fontFamily: 'GeistMono_400Regular',
                                    color: '#232222',
                                    borderWidth: errors.apiUrl ? 2 : 0,
                                    borderColor: errors.apiUrl ? '#EA4335' : 'transparent',
                                }}
                            />
                            {errors.apiUrl && (
                                <Text className="mt-1 font-geist text-xs text-red">
                                    {errors.apiUrl}
                                </Text>
                            )}
                        </View>

                        <View>
                            <Text className="mb-2 font-geist-medium text-sm text-black">
                                Supabase Url
                            </Text>
                            <BottomSheetTextInput
                                value={supabaseUrl}
                                onChangeText={setSupabaseUrl}
                                placeholder="http://localhost:18000"
                                placeholderTextColor="#90988B"
                                keyboardType="url"
                                autoCapitalize="none"
                                autoComplete="off"
                                autoCorrect={false}
                                style={{
                                    borderRadius: 16,
                                    backgroundColor: '#F3F3F3',
                                    paddingHorizontal: 20,
                                    paddingVertical: 16,
                                    fontSize: 16,
                                    fontFamily: 'GeistMono_400Regular',
                                    color: '#232222',
                                    borderWidth: errors.supabaseUrl ? 2 : 0,
                                    borderColor: errors.supabaseUrl ? '#EA4335' : 'transparent',
                                }}
                            />
                            {errors.supabaseUrl && (
                                <Text className="mt-1 font-geist text-xs text-red">
                                    {errors.supabaseUrl}
                                </Text>
                            )}
                        </View>

                        <View>
                            <Text className="mb-2 font-geist-medium text-sm text-black">
                                Supabase Anonymous Key
                            </Text>
                            <BottomSheetTextInput
                                value={supabaseAnonKey}
                                onChangeText={setSupabaseAnonKey}
                                placeholder="Your anonymous key"
                                placeholderTextColor="#90988B"
                                autoCapitalize="none"
                                autoComplete="off"
                                autoCorrect={false}
                                style={{
                                    borderRadius: 16,
                                    backgroundColor: '#F3F3F3',
                                    paddingHorizontal: 20,
                                    paddingVertical: 16,
                                    fontSize: 16,
                                    fontFamily: 'GeistMono_400Regular',
                                    color: '#232222',
                                    borderWidth: errors.supabaseAnonKey ? 2 : 0,
                                    borderColor: errors.supabaseAnonKey ? '#EA4335' : 'transparent',
                                }}
                            />
                            {errors.supabaseAnonKey && (
                                <Text className="mt-1 font-geist text-xs text-red">
                                    {errors.supabaseAnonKey}
                                </Text>
                            )}
                        </View>
                    </View>

                    <View className="flex-1" />

                    <Button
                        variant="primary"
                        size="lg"
                        fullWidth
                        onPress={handleSave}
                        disabled={!isValid || isValidating}
                        className="mt-6">
                        {isValidating ? (
                            <View className="flex-row items-center gap-2">
                                <ActivityIndicator size="small" color="#FFFFFF" />
                                <Text className="font-geist-semibold text-base text-white">
                                    Validating...
                                </Text>
                            </View>
                        ) : (
                            'Save'
                        )}
                    </Button>
                </BottomSheetView>
            </BottomSheetModal>
        );
    }
);

SelfHostSettings.displayName = 'SelfHostSettings';

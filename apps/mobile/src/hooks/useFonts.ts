import { EBGaramond_400Regular } from '@expo-google-fonts/eb-garamond/400Regular';
import { EBGaramond_400Regular_Italic } from '@expo-google-fonts/eb-garamond/400Regular_Italic';
import { EBGaramond_500Medium } from '@expo-google-fonts/eb-garamond/500Medium';
import { EBGaramond_500Medium_Italic } from '@expo-google-fonts/eb-garamond/500Medium_Italic';
import { EBGaramond_600SemiBold } from '@expo-google-fonts/eb-garamond/600SemiBold';
import { EBGaramond_600SemiBold_Italic } from '@expo-google-fonts/eb-garamond/600SemiBold_Italic';
import { EBGaramond_700Bold } from '@expo-google-fonts/eb-garamond/700Bold';
import { EBGaramond_700Bold_Italic } from '@expo-google-fonts/eb-garamond/700Bold_Italic';
import { Figtree_500Medium } from '@expo-google-fonts/figtree';
import {
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
} from '@expo-google-fonts/geist';
import {
    GeistMono_400Regular,
    GeistMono_500Medium,
    GeistMono_600SemiBold,
    GeistMono_700Bold,
} from '@expo-google-fonts/geist-mono';
import { useFonts as useExpoFonts } from 'expo-font';

export const useFonts = () => {
    const [loaded, error] = useExpoFonts({
        Geist_400Regular,
        Geist_500Medium,
        Geist_600SemiBold,
        Geist_700Bold,
        GeistMono_400Regular,
        GeistMono_500Medium,
        GeistMono_600SemiBold,
        GeistMono_700Bold,
        Figtree_500Medium,
        EBGaramond_400Regular,
        EBGaramond_500Medium,
        EBGaramond_600SemiBold,
        EBGaramond_700Bold,
        EBGaramond_400Regular_Italic,
        EBGaramond_500Medium_Italic,
        EBGaramond_600SemiBold_Italic,
        EBGaramond_700Bold_Italic,
    });
    console.log('Loaded fonts:', loaded, 'Error:', error);

    return { loaded, error };
};

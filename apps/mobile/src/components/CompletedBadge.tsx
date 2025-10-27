import { View } from 'react-native';
import Svg, {
    Defs,
    FeBlend,
    FeColorMatrix,
    FeComposite,
    FeFlood,
    FeGaussianBlur,
    FeOffset,
    Filter,
    G,
    Path,
} from 'react-native-svg';

export function CompletedBadge() {
    return (
        <View className="h-8 w-8">
            <Svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <Defs>
                    <Filter
                        id="filter0_d_290_178"
                        x="0"
                        y="0"
                        width="31.0652"
                        height="32"
                        filterUnits="userSpaceOnUse">
                        <FeFlood floodOpacity="0" result="BackgroundImageFix" />
                        <FeColorMatrix
                            in="SourceAlpha"
                            type="matrix"
                            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                            result="hardAlpha"
                        />
                        <FeOffset dy="4" />
                        <FeGaussianBlur stdDeviation="2" />
                        <FeComposite in2="hardAlpha" operator="out" />
                        <FeColorMatrix
                            type="matrix"
                            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"
                        />
                        <FeBlend
                            mode="normal"
                            in2="BackgroundImageFix"
                            result="effect1_dropShadow_290_178"
                        />
                        <FeBlend
                            mode="normal"
                            in="SourceGraphic"
                            in2="effect1_dropShadow_290_178"
                            result="shape"
                        />
                    </Filter>
                </Defs>
                <G filter="url(#filter0_d_290_178)">
                    <Path
                        d="M14.0896 0.471C14.9486 -0.157 16.1156 -0.157 16.9756 0.471C19.0346 1.977 18.5916 1.833 21.1416 1.825C22.2066 1.822 23.1506 2.508 23.4756 3.521C24.2556 5.948 23.9826 5.573 26.0506 7.065C26.9136 7.688 27.2746 8.798 26.9426 9.81C26.1486 12.227 26.1446 11.763 26.9426 14.19C27.2756 15.201 26.9146 16.312 26.0506 16.935C23.9826 18.426 24.2566 18.051 23.4756 20.479C23.1506 21.493 22.2056 22.179 21.1416 22.175C18.5906 22.167 19.0336 22.023 16.9756 23.529C16.1166 24.157 14.9496 24.157 14.0896 23.529C12.0306 22.024 12.4736 22.166 9.92363 22.175C8.85863 22.178 7.91463 21.492 7.58963 20.479C6.80963 18.049 7.07863 18.424 5.01463 16.935C4.15163 16.312 3.79063 15.202 4.12263 14.19C4.91763 11.773 4.92063 12.237 4.12263 9.81C3.78963 8.797 4.15063 7.687 5.01363 7.064C7.07563 5.575 6.80863 5.953 7.58863 3.52C7.91363 2.506 8.85863 1.82 9.92263 1.824C12.4676 1.832 12.0186 1.985 14.0896 0.471Z"
                        fill="#386641"
                    />
                </G>
                <Path
                    d="M11.5327 12.5705L14.5327 15.999L19.5327 7.99902"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </Svg>
        </View>
    );
}

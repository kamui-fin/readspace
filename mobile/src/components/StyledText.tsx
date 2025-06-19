import { Text, TextProps } from "./Themed";
import { TYPOGRAPHY } from "@lib/constants";

export function MonoText(props: TextProps) {
	return (
		<Text
			{...props}
			style={[props.style, { fontFamily: TYPOGRAPHY.FONTS.regular }]}
		/>
	);
}

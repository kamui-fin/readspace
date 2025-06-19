import { View } from "@showtime-xyz/universal.view";
import { Stepper } from "@components/navigation/Stepper";
import UsernameScreen from "@app/(auth)/signup/username";
import EmailScreen from "@app/(auth)/signup/email";
import PasswordScreen from "@app/(auth)/signup/password";
import NotificationsScreen from "@app/(auth)/signup/notifications";

export default function SignupScreen() {
	const pages = [
		<EmailScreen key={0} />,
		<UsernameScreen key={1} />,
		<PasswordScreen key={2} />,
		<NotificationsScreen key={3} />,
	];

	return (
		<View style={{ flex: 1 }}>
			<Stepper pages={pages} />
		</View>
	);
}

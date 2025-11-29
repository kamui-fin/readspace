import { BottomSheet } from "@components/ui/bottom-sheet";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { toast } from "@components/ui/toast";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { BUTTON_BORDER_RADIUS } from "@lib/constants/app";
import { useCreateFolder } from "@readspace/shared";
import {
	forwardRef,
	useCallback,
	useImperativeHandle,
	useRef,
	useState,
} from "react";
import { Alert, Platform, Text, View } from "react-native";

export interface CreateFolderModalRef {
	present: () => void;
	dismiss: () => void;
}

export interface CreateFolderModalProps {
	onSuccess?: () => void;
}

export const CreateFolderModal = forwardRef<
	CreateFolderModalRef,
	CreateFolderModalProps
>(({ onSuccess }, ref) => {
	const bottomSheetRef = useRef<BottomSheetModal>(null);
	const createFolder = useCreateFolder();
	const [folderName, setFolderName] = useState("");

	const handleCreateFolder = useCallback(
		(name?: string) => {
			if (name?.trim()) {
				createFolder.mutate(
					{ name: name.trim() },
					{
						onSuccess: () => {
							toast.success("Folder created successfully");
							onSuccess?.();
						},
						onError: () => {
							toast.error("Failed to create folder");
						},
					},
				);
			}
		},
		[createFolder, onSuccess],
	);

	const handleConfirm = useCallback(() => {
		handleCreateFolder(folderName);
		bottomSheetRef.current?.dismiss();
		setFolderName("");
	}, [folderName, handleCreateFolder]);

	useImperativeHandle(ref, () => ({
		present: () => {
			if (Platform.OS === "ios") {
				// Use native iOS Alert.prompt
				Alert.prompt(
					"Create Folder",
					"Enter a name for your new folder",
					[
						{
							text: "Cancel",
							style: "cancel",
						},
						{
							text: "Create",
							onPress: handleCreateFolder,
						},
					],
					"plain-text",
					"",
					"default",
				);
			} else {
				// Use bottom sheet on Android
				setFolderName("");
				bottomSheetRef.current?.present();
			}
		},
		dismiss: () => {
			if (Platform.OS === "android") {
				bottomSheetRef.current?.dismiss();
			}
		},
	}));

	// Only render bottom sheet on Android
	if (Platform.OS === "android") {
		return (
			<BottomSheet
				ref={bottomSheetRef}
				headerTitle="Create Folder"
				headerTitleAlign="left"
				enablePanDownToClose={true}
				snapPoints={["50%"]}
				bottomInset={0}
				containerClassName="rounded-3xl overflow-hidden"
				headerClassName="px-4"
			>
				<View>
					<Text className="mb-4 font-geist text-base text-grey dark:text-grey-dark">
						Enter a name for your new folder
					</Text>
					<Input
						value={folderName}
						onChangeText={setFolderName}
						placeholder="Folder name"
						autoFocus
						autoCapitalize="words"
						returnKeyType="done"
						onSubmitEditing={handleConfirm}
						borderRadius={12}
					/>
					<View className="mt-6">
						<Button
							variant="primary"
							size="large"
							fullWidth
							onPress={handleConfirm}
							disabled={!folderName.trim()}
							style={{ borderRadius: BUTTON_BORDER_RADIUS }}
						>
							Confirm
						</Button>
					</View>
				</View>
			</BottomSheet>
		);
	}

	// iOS uses native Alert, so return null
	return null;
});

CreateFolderModal.displayName = "CreateFolderModal";

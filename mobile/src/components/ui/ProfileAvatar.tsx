import { useState, useEffect } from "react";
import { Avatar } from "@showtime-xyz/universal.avatar";
import { Skeleton } from "@showtime-xyz/universal.skeleton";
import { Image } from "expo-image";

type Props = {
	url?: string;
	size: number;
};

export default function ProfileAvatar({ url, size }: Props) {
	const [isLoading, setIsLoading] = useState(true);
	const [hasError, setHasError] = useState(false);

	useEffect(() => {
		let isMounted = true;
		if (!url) {
			setHasError(true);
			setIsLoading(false);
			return;
		}

		setHasError(false);
		setIsLoading(true);

		Image.prefetch(url)
			.then(() => {
				if (isMounted) {
					setIsLoading(false);
				}
			})
			.catch(() => {
				if (isMounted) {
					setHasError(true);
					setIsLoading(false);
				}
			});

		return () => {
			isMounted = false;
		};
	}, [url]);

	if (isLoading || hasError) {
		return <Skeleton width={size} height={size} radius="round" />;
	}

	// This is a type guard to ensure url is a string.
	if (!url) {
		return <Skeleton width={size} height={size} radius="round" />;
	}

	return <Avatar alt="Avatar" url={url} size={size} />;
}

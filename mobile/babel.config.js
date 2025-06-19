export default function (api) {
	api.cache(true);
	return {
		presets: [
			["babel-preset-expo", { jsxImportSource: "nativewind" }],
			"nativewind/babel",
		],
		plugins: [
			[
				"module-resolver",
				{
					root: ["./src"],
					extensions: [".js", ".jsx", ".ts", ".tsx"],
					alias: {
						"^@showtime-xyz/universal.alert$":
							"./node_modules/@showtime-xyz/universal.alert",
						"^@showtime-xyz/universal.button$":
							"./node_modules/@showtime-xyz/universal.button",
						"^@showtime-xyz/universal.tab-view$":
							"./node_modules/@showtime-xyz/universal.tab-view",
						"^@showtime-xyz/universal.hooks$":
							"./node_modules/@showtime-xyz/universal.hooks",
						"^@showtime-xyz/universal.safe-area$":
							"./node_modules/@showtime-xyz/universal.safe-area",
						"^@showtime-xyz/universal.tailwind$":
							"./node_modules/@showtime-xyz/universal.tailwind",
						"^@showtime-xyz/universal.view$":
							"./node_modules/@showtime-xyz/universal.view",
						"^@showtime-xyz/universal.text-input$":
							"./node_modules/@showtime-xyz/universal.text-input",
						"^@showtime-xyz/universal.image$":
							"./node_modules/@showtime-xyz/universal.image",
						"^@showtime-xyz/universal.avatar$":
							"./node_modules/@showtime-xyz/universal.avatar",
						"^@showtime-xyz/universal.input$":
							"./node_modules/@showtime-xyz/universal.input",
						"^@showtime-xyz/universal.skeleton$":
							"./node_modules/@showtime-xyz/universal.skeleton",
						"^@showtime-xyz/universal.snackbar$":
							"./node_modules/@showtime-xyz/universal.snackbar",
					},
				},
			],
		],
	};
}

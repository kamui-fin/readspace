"use client";

import Image from "next/image";
import Link from "next/link";
import toast from "react-hot-toast";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useFormik } from "formik";
import { z } from "zod";
import { toFormikValidationSchema } from "zod-formik-adapter";

const SignupSchema = z.object({
	name: z
		.string()
		.min(2, "Name is required and must be at least 2 characters."),
	email: z.string().email("Invalid email address."),
});

// Helper to generate combined error message
function getCombinedErrorMessage(touched: any, errors: any) {
	const fields: string[] = [];
	if (touched.name && errors.name) fields.push("Name");
	if (touched.email && errors.email) fields.push("Email");
	if (fields.length === 1) return `${fields[0]} is required`;
	if (fields.length === 2) return `${fields.join(" and ")} are required`;
	return null;
}

export default function Signup() {
	const nameId = useId();
	const emailId = useId();

	const formik = useFormik({
		initialValues: { name: "", email: "" },
		validationSchema: toFormikValidationSchema(SignupSchema),
		onSubmit: (values) => {
			// handle submit with resend
			toast.success("Thanks for signing up!");
			alert(JSON.stringify(values, null, 2));
		},
	});

	return (
		<div className="min-h-screen flex flex-col dark-black:bg">
			<div className="flex items-center justify-between w-full px-6 pt-6">
				<Link href="/">
					<Image
						src="/wordmark.svg"
						alt="Readspace Logo"
						width={178}
						height={63}
					/>
				</Link>
			</div>
			<div className="flex flex-1 items-center justify-center">
				<form
					className="flex flex-col gap-4 w-full max-w-md bg-transparent p-8 rounded-lg"
					onSubmit={formik.handleSubmit}
				>
					<div className="flex flex-col items-center mb-2">
						<h1 className="text-2xl font-semibold">join the waitlist</h1>
					</div>
					<div className="group relative">
						<label
							htmlFor={nameId}
							className="origin-start text-muted-foreground/70 group-focus-within:text-foreground has-[+input:not(:placeholder-shown)]:text-foreground absolute top-1/2 block -translate-y-1/2 cursor-text px-1 text-sm transition-all group-focus-within:pointer-events-none group-focus-within:top-0 group-focus-within:cursor-default group-focus-within:text-xs group-focus-within:font-medium has-[+input:not(:placeholder-shown)]:pointer-events-none has-[+input:not(:placeholder-shown)]:top-0 has-[+input:not(:placeholder-shown)]:cursor-default has-[+input:not(:placeholder-shown)]:text-xs has-[+input:not(:placeholder-shown)]:font-medium"
						>
							<span className="bg-background inline-flex px-2">Name</span>
						</label>
						<Input
							id={nameId}
							name="name"
							type="text"
							placeholder=" "
							className="dark:bg-zinc-900 placeholder:text-zinc-400"
							value={formik.values.name}
							onChange={formik.handleChange}
							onBlur={formik.handleBlur}
						/>
					</div>
					<div className="group relative">
						<label
							htmlFor={emailId}
							className="origin-start text-muted-foreground/70 group-focus-within:text-foreground has-[+input:not(:placeholder-shown)]:text-foreground absolute top-1/2 block -translate-y-1/2 cursor-text px-1 text-sm transition-all group-focus-within:pointer-events-none group-focus-within:top-0 group-focus-within:cursor-default group-focus-within:text-xs group-focus-within:font-medium has-[+input:not(:placeholder-shown)]:pointer-events-none has-[+input:not(:placeholder-shown)]:top-0 has-[+input:not(:placeholder-shown)]:cursor-default has-[+input:not(:placeholder-shown)]:text-xs has-[+input:not(:placeholder-shown)]:font-medium"
						>
							<span className="bg-background inline-flex px-2">Email</span>
						</label>
						<Input
							id={emailId}
							name="email"
							type="email"
							placeholder=" "
							className="dark:bg-zinc-900 placeholder:text-zinc-400 pr-10"
							value={formik.values.email}
							onChange={formik.handleChange}
							onBlur={formik.handleBlur}
						/>
					</div>
					<div className="flex items-center justify-between min-h-[2.5rem] mt-1 w-full">
						<div className="flex-1">
							{(() => {
								const msg = getCombinedErrorMessage(
									formik.touched,
									formik.errors,
								);
								return msg ? (
									<span className="text-sm text-red-500">{msg}</span>
								) : null;
							})()}
						</div>
						<Button
							type="submit"
							data-formik="submit"
							className="px-6 py-2 rounded-md font-semibold bg-zinc-800 text-white hover:bg-zinc-700 dark:bg-zinc-200 dark:text-black dark:hover:bg-zinc-100 ml-4"
						>
							Sign up
						</Button>
					</div>
				</form>
			</div>
		</div>
	);
}

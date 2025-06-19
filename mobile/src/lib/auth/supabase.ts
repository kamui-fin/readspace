import { supabase } from "@lib/supabase/client";

export async function signInWithEmail(email: string, password: string) {
	const { data, error } = await supabase.auth.signInWithPassword({
		email,
		password,
	});

	if (error) throw error;
	return data;
}

export async function signUpWithEmail(
	email: string,
	password: string,
	username: string,
) {
	const { data, error } = await supabase.auth.signUp({
		email,
		password,
		options: {
			data: {
				username,
			},
		},
	});

	if (error) throw error;
	return data;
}

export async function signOut() {
	const { error } = await supabase.auth.signOut();
	if (error) throw error;
}

export async function getSession() {
	const {
		data: { session },
		error,
	} = await supabase.auth.getSession();
	if (error) throw error;
	return session;
}

export async function getUser() {
	const {
		data: { user },
		error,
	} = await supabase.auth.getUser();
	if (error) throw error;
	return user;
}

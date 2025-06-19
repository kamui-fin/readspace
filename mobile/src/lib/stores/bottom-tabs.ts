import { createSelectors } from "@lib/utils/create-selectors";
import { create } from "zustand";

interface State {
	isBottomTabsHidden: boolean;
}

interface Actions {
	setIsBottomTabsHidden: (isBottomTabsHidden: boolean) => void;
}

export const initialState: State = {
	isBottomTabsHidden: false,
};

const bottomTabsStore = create<State & Actions>()((set) => ({
	...initialState,
	setIsBottomTabsHidden: (isBottomTabsHidden) => {
		set((state) => ({
			...state,
			isBottomTabsHidden,
		}));
	},
}));

export const useBottomTabsStore = createSelectors(bottomTabsStore);

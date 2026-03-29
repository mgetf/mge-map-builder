import { Electroview } from "electrobun/view";
import type { AppRPC } from "../../shared/rpc.js";
import { addProgress, finishBuild } from "$lib/stores/build.svelte.js";

const rpc = Electroview.defineRPC<AppRPC>({
	handlers: {
		requests: {},
		messages: {
			buildProgress: (progress) => addProgress(progress),
			buildComplete: (result) => finishBuild(result),
		},
	},
});

export const electroview = new Electroview({ rpc });

export const api = electroview.rpc.request;

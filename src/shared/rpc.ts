import type { RPCSchema } from "electrobun/bun";
import type { ArenaPackage, BuildConfig, BuildResult, CompileProgress } from "./types.js";

export type AppRPC = {
	bun: RPCSchema<{
		requests: {
			detectTF2: { params: {}; response: string | null };
			setTF2Path: { params: { path: string }; response: boolean };
			getArenas: { params: {}; response: ArenaPackage[] };
			selectFolder: { params: {}; response: string | null };
			build: { params: BuildConfig; response: BuildResult };
			cancelBuild: { params: {}; response: void };
			copyToTF2: {
				params: { bspPath: string; cfgPath: string };
				response: boolean;
			};
			openFolder: { params: { path: string }; response: void };
		};
		messages: {
			buildProgress: CompileProgress;
			buildComplete: BuildResult;
		};
	}>;
	webview: RPCSchema<{
		requests: {};
		messages: {};
	}>;
};

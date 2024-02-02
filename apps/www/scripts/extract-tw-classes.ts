import { readFileSync } from "fs";
import type { PluginCreator } from "postcss";
import type { Config } from "tailwindcss";
import postcss from "postcss";
import postcssImport from "postcss-import";
import postcssJs from "postcss-js";
import tw from "tailwindcss";
import config from "../tailwind.config";

// tailwind needs to fix their exports :]
const tailwindcss = tw as unknown as PluginCreator<string | Config | { config: string | Config }>;

/**
 *
 * @param content The string content of the Svelte file
 * @param cssEntryPath The path to the CSS file with tailwind imports
 * @returns
 */
export async function extractTailwindClasses(content: string, cssEntryPath = "./simple.pcss") {
	const css = readFileSync(cssEntryPath, "utf8");

	const twConfig = {
		...config,
		content: [{ raw: content }],
		plugins: [],
	} satisfies Config;

	const result = await postcss([postcssImport(), tailwindcss(twConfig)]).process(css, {
		from: cssEntryPath,
	});

	const cssInJs = postcssJs.objectify(result.root);
	console.log(cssInJs);

	const classNames = new Set<string>();

	function stripKey(key: string) {
		const strippedKey = key.slice(1).replaceAll("\\", "");
		const sections = strippedKey.split(":");
		if (sections.length === 3) {
			return sections[0] + ":" + sections[1];
		} else {
			return strippedKey;
		}
	}

	for (const key in cssInJs) {
		if (key.startsWith(".")) {
			classNames.add(stripKey(key));
		}
		if (key.startsWith("@")) {
			for (const subKey in cssInJs[key]) {
				if (subKey.startsWith(".")) {
					classNames.add(stripKey(subKey));
				}
			}
		}
	}

	return classNames;
}

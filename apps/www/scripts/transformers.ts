import { vitePreprocess } from "@sveltejs/kit/vite";
import { parse, preprocess } from "svelte/compiler";
import ts from "typescript";
import prettier from "prettier";
import type { Attribute, TemplateNode } from "svelte/types/compiler/interfaces";
import { walk } from "zimmerframe";
import { extractTailwindClasses } from "./extract-tw-classes";
import MagicString from "magic-string";

export type TransformOpts = {
	filename: string;
	content: string;
	// baseColor?: z.infer<typeof registryBaseColorSchema>; - will use later
};

const sharedPrettierConfig = {
	useTabs: true,
	tabWidth: 4,
	singleQuote: false,
	trailingComma: "es5" as const,
	printWidth: 100,
	endOfLine: "lf" as const,
	bracketSameLine: false,
};

const registrySveltePrettierConfig = {
	...sharedPrettierConfig,
	pluginSearchDirs: ["./node_modules/prettier-plugin-svelte"],
	parser: "svelte",
	svelteStrictMode: false,
	plugins: ["prettier-plugin-svelte"],
};

const registryJSPrettierConfig = {
	...sharedPrettierConfig,
	parser: "babel",
};

export async function transformContent(content: string, filename: string) {
	// The rest is for transforming typescript to javascript
	if (filename.endsWith(".svelte")) {
		return prettier.format(
			await transformSvelteTStoJS(content, filename),
			registrySveltePrettierConfig
		);
	} else {
		return prettier.format(transformTStoJS(content, filename), registryJSPrettierConfig);
	}
}

async function transformSvelteTStoJS(content: string, filename: string) {
	try {
		const { code } = await preprocess(content, [vitePreprocess()]);
		let s = code.replaceAll(/<script lang=['"]ts['"]>/g, "<script>");
		s = s.replaceAll(/void 0/g, "undefined");
		return s;
	} catch (e) {
		throw new Error(`Error preprocessing Svelte file: ${filename} \n ${e}`);
	}
}

const compilerOptions: ts.CompilerOptions = {
	target: ts.ScriptTarget.ESNext,
	module: ts.ModuleKind.ESNext,
	isolatedModules: true,
	preserveValueImports: true,
	lib: ["esnext", "DOM", "DOM.Iterable"],
	moduleResolution: ts.ModuleResolutionKind.Bundler,
	esModuleInterop: true,
	ignoreDeprecations: "5.0",
};

function transformTStoJS(content: string, filename: string) {
	const { outputText, diagnostics } = ts.transpileModule(content, {
		compilerOptions,
		reportDiagnostics: true,
	});

	// Check for compilation errors
	if (diagnostics && diagnostics.length > 0) {
		// Throw the errors so the user can see them/create an issue about them.
		throw new Error(
			`Error compiling TypeScript to JavaScript for file: ${filename} \n ${diagnostics}`
		);
	} else {
		return outputText;
	}
}

export const PREFIX = "TW-PREFIX-";

const codeStr = `<script lang="ts">
import { Dialog as DialogPrimitive } from "bits-ui";
import * as Dialog from ".";
import { cn, flyAndScale } from "$lib/utils";
import { X } from "lucide-svelte";
import { Form as FormPrimitive } from 'formsnap'

type $$Props = DialogPrimitive.ContentProps;

let className: $$Props["class"] = undefined;
export let transition: $$Props["transition"] = flyAndScale;
export let transitionConfig: $$Props["transitionConfig"] = {
	duration: 200,
};

const isOpen = false

export { className as class };
const condA = false
const condB = true
const condC = true
</script>

<Dialog.Portal>
<Dialog.Overlay />
<DialogPrimitive.Content
	{transition}
	{transitionConfig}
	class={cn(
		"fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg sm:rounded-lg md:w-full",
		isOpen ? "sm:gap-6" : "sm:gap-4",
		condA ? "cn-condA" : condB ? "cnCondB" : condC ? "cnCondC" : "cnCondAlt",
		className
	)}
	{...$$restProps}
>
	<slot />
	<DialogPrimitive.Close
		class="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
	>
		<X class={"h-4 w-4"} />
		<span class={true ? "sr-only" : "sr-a"}>Close</span>
	</DialogPrimitive.Close>
</DialogPrimitive.Content>
</Dialog.Portal>`;

async function addTailwindPrefixTemplate(content: string) {
	const { code } = await preprocess(content, [vitePreprocess()]);
	const twClasses = await extractTailwindClasses(code);

	const ms = new MagicString(code);

	const { html } = parse(code);
	const state = {
		insideClass: false,
	};

	walk(html as TemplateNode, state, {
		Attribute(node, { state, next }) {
			if (!state.insideClass) {
				const currNode = node as Attribute;
				if (currNode.name === "class") {
					if (typeof currNode.value === "string") {
						ms.update(currNode.start, currNode.end, applyTailwindPrefix(currNode.value, twClasses));
					}

					return next({ insideClass: true });
				}
			}
		},
		Literal(node, { state }) {
			if (state.insideClass) {
				if ("value" in node && typeof node.value === "string") {
					ms.update(node.start, node.end, `"${applyTailwindPrefix(node.value, twClasses)}"`);
					return {
						...node,
						value: applyTailwindPrefix(node.value, twClasses),
					};
				}
			}
		},
		Text(node, { state }) {
			if (state.insideClass) {
				if (typeof node.data === "string") {
					ms.update(node.start, node.end, applyTailwindPrefix(node.data, twClasses));
					return {
						...node,
						data: applyTailwindPrefix(node.data, twClasses),
					};
				}
			}
		},
	});

	console.log(ms.toString());
}

await addTailwindPrefixTemplate(codeStr);

function applyTailwindPrefix(input: string, twClasses: Set<string>) {
	const classNames = input.split(" ");
	const newClassNames: string[] = [];
	for (const className of classNames) {
		if (!twClasses.has(className) && !isPartialClassnameMatch(className, twClasses)) {
			newClassNames.push(className);
			continue;
		}
		const [variant, value, modifier] = splitClassName(className);
		if (variant) {
			modifier
				? newClassNames.push(`${variant}:${PREFIX}${value}/${modifier}`)
				: newClassNames.push(`${variant}:${PREFIX}${value}`);
		} else {
			modifier
				? newClassNames.push(`${PREFIX}${value}/${modifier}`)
				: newClassNames.push(`${PREFIX}${value}`);
		}
	}
	return newClassNames.join(" ");
}

function isPartialClassnameMatch(className: string, twClasses: Set<string>) {
	for (const twClass of twClasses) {
		if (twClass.startsWith(className) && twClass.endsWith("]")) {
			return true;
		}
	}
	return false;
}

function splitClassName(className: string): (string | null)[] {
	if (!className.includes("/") && !className.includes(":")) {
		return [null, className, null];
	}

	const parts: (string | null)[] = [];
	// First we split to find the alpha.
	const [rest, alpha] = className.split("/");

	// Check if rest has a colon.
	if (!rest.includes(":")) {
		return [null, rest, alpha];
	}

	// Next we split the rest by the colon.
	const split = rest.split(":");

	// We take the last item from the split as the name.
	const name = split.pop();

	// We glue back the rest of the split.
	const variant = split.join(":");

	// Finally we push the variant, name and alpha.
	parts.push(variant ?? null, name ?? null, alpha ?? null);

	return parts;
}

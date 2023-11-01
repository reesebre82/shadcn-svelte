<script lang="ts">
	import * as HoverCard from "@/registry/new-york/ui/hover-card";
	import * as Command from "@/registry/new-york/ui/command";
	import * as Popover from "@/registry/new-york/ui/popover";
	import { Label } from "@/registry/new-york/ui/label";
	import { Button } from "@/registry/new-york/ui/button";
	import type { ModelType, Model } from "../(data)/models";
	import { CaretSort } from "radix-icons-svelte";
	import { tick } from "svelte";
	export let types: ModelType[];
	export let models: Model[];

	let selectedModel = models[0];
	let peekedModel = models[0];
	let open = false;

	function handlePeek(model: Model) {
		if (peekedModel.id === model.id) return;
		peekedModel = model;
	}

	function closeAndRefocusTrigger(id: string) {
		open = false;

		tick().then(() => document.getElementById(id)?.focus());
	}

	function observerAction(node: HTMLElement, params: { model: Model }) {
		const callback = (mutations: MutationRecord[]) => {
			for (const mutation of mutations) {
				if (mutation.type === "attributes") {
					if (mutation.attributeName === "aria-selected") {
						handlePeek(params.model);
					}
				}
			}
		};

		const observer = new MutationObserver(callback);

		observer.observe(node);

		return {
			destroy() {
				observer.disconnect();
			}
		};
	}
</script>

<div class="grid gap-2">
	<HoverCard.Root openDelay={200} positioning={{ placement: "left-start" }}>
		<HoverCard.Trigger asChild let:builder>
			<div use:builder.action {...builder}>
				<Label for="model">Model</Label>
			</div>
		</HoverCard.Trigger>
		<HoverCard.Content class="w-[260px] text-sm">
			The model which will generate the completion. Some models are
			suitable for natural language tasks, others specialize in code.
			Learn more.
		</HoverCard.Content>
	</HoverCard.Root>
	<Popover.Root bind:open positioning={{ placement: "bottom-end" }} let:ids>
		<Popover.Trigger asChild let:builder>
			<Button
				variant="outline"
				role="combobox"
				aria-expanded={open}
				aria-label="Select a model"
				class="w-full justify-between"
				builders={[builder]}
			>
				{selectedModel ? selectedModel.name : "Select a model..."}
				<CaretSort class="ml-2 h-4 w-4 shrink-0 opacity-50" />
			</Button>
		</Popover.Trigger>
		<Popover.Content class="w-[250px] p-0">
			<HoverCard.Root
				positioning={{
					placement: "left"
				}}
				closeOnOutsideClick={false}
				{open}
			>
				<HoverCard.Trigger asChild>
					<HoverCard.Content class="min-h-[280px]">
						<div class="grid gap-2">
							<h4 class="font-medium leading-none">
								{peekedModel.name}
							</h4>
							<div class="text-sm text-muted-foreground">
								{peekedModel.description}
							</div>
							{#if peekedModel.strengths}
								<div class="mt-4 grid gap-2">
									<h5
										class="text-sm font-medium leading-none"
									>
										Strengths
									</h5>
									<ul class="text-sm text-muted-foreground">
										{peekedModel.strengths}
									</ul>
								</div>
							{/if}
						</div>
					</HoverCard.Content>
					<Command.Root>
						<Command.List
							class="h-[var(--cmdk-list-height)] max-h-[400px]"
						>
							<Command.Input placeholder="Search models..." />
							<Command.Empty>No models found.</Command.Empty>
							{#each types as type}
								<Command.Group heading={type}>
									{#each models.filter((model) => model.type === type) as model}
										<Command.Item
											asChild
											onSelect={() => {
												selectedModel = model;
												closeAndRefocusTrigger(
													ids.trigger
												);
											}}
											value={model.name}
											class="text-sm"
											let:attrs
											let:action
										>
											<div
												{...attrs}
												use:action
												use:observerAction={{ model }}
											>
												{model.name}
											</div>
										</Command.Item>
									{/each}
								</Command.Group>
							{/each}
						</Command.List>
					</Command.Root>
				</HoverCard.Trigger>
			</HoverCard.Root>
		</Popover.Content>
	</Popover.Root>
</div>

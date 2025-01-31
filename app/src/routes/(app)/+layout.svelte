<script lang="ts">
    import { page } from "$app/stores";
    import "../../app.css";
    import { goto } from "$app/navigation";
    import DarkModeToggle from "$lib/components/DarkModeToggle.svelte";
    import Uploader from "$lib/components/Uploader.svelte";
    import { user } from "$lib/stores/user";
    import { Film, Menu } from "lucide-svelte";

    const { data, children } = $props();
    user.set(data.authenticatedUser);

    async function handleLogout() {
        try {
            // const response = await fetch(
            //     `${PUBLIC_ALCOVES_API_URL}/api/auth/logout`,
            //     {
            //         method: "POST",
            //         headers: {
            //             "Content-Type": "application/json",
            //         },
            //         credentials: "include",
            //     },
            // );

            // if (!response.ok) {
            //     throw new Error("Network response was not ok");
            // }

            goto("/login");
        } catch (error) {
            console.error("Login Error:", error);
        }
    }
</script>

<div class="flex h-screen bg-base-100 text-base-content overflow-hidden">
    <div class="drawer lg:drawer-open">
        <input id="default-drawer" type="checkbox" class="drawer-toggle" />
        <div class="drawer-content flex flex-col h-screen overflow-hidden">
            <div class="navbar flex-none border-b border-base-300">
                <div class="flex-1">
                    <label
                        for="default-drawer"
                        class="btn btn-ghost drawer-button lg:hidden"
                    >
                        <Menu />
                    </label>
                </div>
                <div class="flex gap-2">
                    <Uploader />
                    <DarkModeToggle />
                    <div class="dropdown dropdown-end">
                        <div
                            tabindex="0"
                            role="button"
                            class="btn btn-ghost btn-circle avatar placeholder"
                        >
                            <div
                                class="bg-neutral text-neutral-content w-10 rounded-full"
                            >
                                <span class="text-xl"
                                    >{$user?.email[0].toUpperCase()}</span
                                >
                            </div>
                        </div>
                        <ul
                            class="menu menu-sm dropdown-content bg-base-200 rounded-box z-[1] mt-3 w-52 p-2 shadow"
                        >
                            <li class="gap-2">
                                <button
                                    type="button"
                                    class="btn btn-sm"
                                    onclick={handleLogout}
                                >
                                    Logout
                                </button>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            <main class="flex-1 p-6 overflow-y-auto">
                {@render children()}
            </main>
        </div>

        <div class="drawer-side z-20">
            <label
                for="default-drawer"
                aria-label="close sidebar"
                class="drawer-overlay"
            ></label>
            <div
                class="flex flex-col justify-start items-start min-h-full bg-base-100 text-base-content w-80"
            >
                <div
                    class="flex justify-start items-center h-[65px] p-2 w-full"
                >
                    <div class="">
                        <label
                            for="default-drawer"
                            class="btn btn-ghost drawer-button lg:hidden"
                        >
                            <Menu />
                        </label>
                    </div>

                    <a href="/" class="hover:text-primary text-lg font-semibold"
                        >Alcoves</a
                    >
                </div>
                <div
                    class="h-[calc(100vh-65px)] w-full border-r border-base-300"
                >
                    <ul class="menu p-4 w-full">
                        <li>
                            <a
                                href="/"
                                class:active={$page.url.pathname == "/"}
                            >
                                <Film class="w-5 h-5" />My Library</a
                            >
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    </div>
</div>

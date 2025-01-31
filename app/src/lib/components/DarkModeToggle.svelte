<script lang="ts">
  import { onMount } from "svelte";
  import { Sun, Moon } from "lucide-svelte";

  const themes = ["dark", "light"];
  let currentTheme: string;

  onMount(() => {
    currentTheme = localStorage.getItem("theme") || "dark"; // Default theme as set by tailwind.config.ts
    applyTheme(currentTheme);
  });

  function applyTheme(theme: string) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
    currentTheme = theme;
  }

  function toggleTheme() {
    const newTheme = currentTheme === "light" ? "dark" : "light";
    applyTheme(newTheme);
  }
</script>

<label class="swap swap-rotate">
  <!-- this hidden checkbox controls the state -->
  <input
    type="checkbox"
    class="theme-controller"
    on:change={toggleTheme}
    checked={currentTheme === "light"}
  />

  <!-- Sun icon for light mode -->
  <div class="swap-off flex items-center justify-center">
    <Sun size={24} class="text-primary" />
  </div>

  <!-- Moon icon for dark mode -->
  <div class="swap-on flex items-center justify-center">
    <Moon size={24} class="text-primary" />
  </div>
</label>

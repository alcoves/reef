<script>
import "../../app.css";
let { children } = $props();
</script>

<div class="flex flex-col items-center justify-center h-screen w-screen">
  <main>
    {@render children()}
  </main>
</div>

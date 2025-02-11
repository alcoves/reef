<script lang="ts">
import { page } from "$app/state";
import Assets from "$lib/components/Assets.svelte";
</script>

<Assets initialAssets={page.data.assets} />

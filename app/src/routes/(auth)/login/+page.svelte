<script lang="ts">
import type { PageProps } from "./$types";

const cardTitle = "Let's get logged in";
const cardAction = "Log In";
const alternateButtonText = "Or create an account";
const alternateButtonLink = "/signup";

let { form }: PageProps = $props();
</script>

<div class="card bg-neutral text-neutral-content w-96">
  <div class="card-body items-center text-center">
    <h2 class="card-title">{cardTitle}</h2>
    <form method="POST">
      <div class="mt-2 card-actions justify-center">
        <input
          class="input w-full"
          required
          name="email"
          type="email"
          placeholder="Email"
        />
        <input
          class="input w-full"
          required
          name="password"
          type="password"
          placeholder="Password"
        />
        {#if form?.error}
          <div class="text-red-500">{form?.error}</div>{/if}
        <button class="btn w-full btn-primary mt-4" type="submit">
          {cardAction}
        </button>
        <a class="mt-2" href={alternateButtonLink}>{alternateButtonText}</a>
      </div>
    </form>
  </div>
</div>

import { defineConfig } from 'vite';

// './' keeps asset URLs relative so the build works from the /northstar-travel/
// GitHub Pages subpath; a root-absolute base would break it.
export default defineConfig({
  base: './',
});

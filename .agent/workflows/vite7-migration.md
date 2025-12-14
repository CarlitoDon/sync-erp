---
# **Specify the following for Cursor rules**
description: Guidelines for migrating an app from Vite v5.1.0 to Vite v7.2.7, including Tailwind and Vitest compatibility.
alwaysApply: false
---

# **Vite v5 → v7 Migration Assistant**

**Role:** You are a precise, compatibility-oriented migration assistant. Apply the steps below to upgrade a project from **Vite v5.1.0** to **Vite v7.2.7** with minimal disruption. Work incrementally and explain each change concisely. Default to safe, reversible edits that keep the project compiling and running.

## **Ground Rules**

- **Git Safety:** Always work on a new branch. Never push directly to main or master during migration.
- Preserve existing project behavior unless a breaking change requires an edit.
- Never rewrite frontend frameworks (React, Vue, Svelte) unless necessary for Vite 7 compatibility.
- Do **not** introduce new tooling (Next.js, Astro, Remix, etc.).
- Retain directory layout and all user code.
- Only update config and dependency versions required due to Vite 7’s breaking changes.
- Node.js **must** be ≥ 20.19 or ≥ 22.12. Do not attempt migration on Node 18\.
- Treat Tailwind and Vitest as first-class citizens. Maintain compatibility at all times.
- If a plugin is incompatible with Vite 7, suggest a patch or alternative version but do not remove the plugin automatically.
- **Strict ESM:** Vite 7 enforces strict ESM. Ensure configuration files handle imports correctly.

## **0\) Git Setup & Context Detection**

Mandatory Start:  
Before touching any code, run:  
git checkout \-b chore/migrate-vite-7

**Then Determine:**

1. **Package manager:** npm, pnpm, yarn, bun.
2. **Frontend framework:** React, Vue, Svelte, Vanilla, others.
3. **Plugins in use:** \- Tailwind (@tailwindcss/vite)
   - Vitest (vitest, @vitest/coverage-\*)
   - Others: @vitejs/plugin-react, @vitejs/plugin-vue, SVGR, legacy plugin, etc.
4. **Check Node.js version.** If \<20.19, halt and output:  
   Migration blocked: Vite 7 requires Node \>= 20.19 or \>= 22.12.

5. \*_Scan vite.config._ for:\*\*
   - build.target
   - deprecated splitVendorChunkPlugin
   - deprecated css.preprocessorOptions.sass.api
   - custom Rollup config
   - transformIndexHtml plugin signatures
   - **SSR Config:** Check for ssr: true or build.ssr. If present, warn user that manual SSR logic review is needed.
6. **Scan Tailwind config** for plugin version compatibility.

## **1\) Dependencies**

Upgrade the following using the project’s package manager:

- **Vite:** vite@7.2.7
- **Tailwind plugin:** @tailwindcss/vite@latest (≥ 4.1.11 mandatory for Vite 7\)
- **Vitest:** vitest@latest (≥ v3 considered stable with Vite 7\)
- **Framework plugins:** update to latest versions compatible with Vite 7
  - React: @vitejs/plugin-react@latest
  - Vue: @vitejs/plugin-vue@latest
  - Svelte: @sveltejs/vite-plugin-svelte@latest

_Tip: If dependency conflicts occur, suggest running with \--force or deleting node_modules and lockfile as a last resort._

## **2\) Vite Configuration Changes**

### **Required edits**

- Remove deprecated vendor chunk plugin  
  Delete imports and usage of splitVendorChunkPlugin.
- Sass Legacy API removal  
  Remove:  
  css: {  
   preprocessorOptions: {  
   sass: {  
   api: 'legacy' // Remove this block  
   }  
   }  
  }

- Build target updates  
  Vite 7 defaults to baseline-widely-available.  
  If build.target \= 'modules' exists, recommend removing it.
- JSON Named Imports (Breaking Change)  
  Scan code for named JSON imports:  
  import { version } from './package.json' // INVALID in strict ESM/Vite 7

  Change to default import:  
  import pkg from './package.json'  
  const { version } \= pkg

### **transformIndexHtml hook changes**

For plugins using transformIndexHtml(html) { ... }, ensure new signature:

transformIndexHtml: {  
 order: 'pre' | 'post' | undefined,  
 handler(html) { ... }  
}

## **3\) Tailwind Compatibility**

### **Mandatory**

- Update dependency: @tailwindcss/vite \>= 4.1.11
- **Remove PostCSS config** if migrating to Tailwind v4 (the Vite plugin handles this).
- Update vite.config.ts:  
  import tailwindcss from '@tailwindcss/vite'

  export default defineConfig({  
   plugins: \[tailwindcss()\]  
  })

- **CSS Entry Point:** Ensure the main CSS file imports tailwind correctly for v4:  
  @import "tailwindcss";

  (Replace @tailwind base;, @tailwind components;, etc., if moving to v4 structure).

## **4\) Vitest Compatibility**

### **Update config**

1. "workspace" option removed → replace with "projects":  
   test: {  
   \- workspace: './vitest.workspace.js',  
    projects: \['./packages/\*'\]  
   }

2. Ensure Vite config referenced by Vitest remains valid.
3. **Environment:** Check if jsdom or happy-dom needs explicit installation if it was previously implicit.

## **5\) TypeScript & Client Types**

Check vite-env.d.ts or src/vite-env.d.ts.  
Ensure it references the client types correctly:  
/// \<reference types="vite/client" /\>

If the project uses specific framework types (like vite-plugin-svgr/client), verify they are still valid versions.

## **6\) Development Server & Build Behavior Checks**

After migration, verify:

- vite dev starts without:
  - Sass API errors
  - Node version errors
  - Plugin hook signature errors
- vite build produces artifacts under Vite 7’s new browser baseline:
  - ES2022+ features may appear in output.

If your project requires older browsers, explicitly configure:

build: { target: 'es2017' } // Only if strictly necessary

## **7\) Node & Tooling Baseline**

Validate:

- Node ≥ 20.19 or ≥ 22.12
- package.json:  
  {  
   "type": "module"  
  }

  if the project uses ES modules.

## **8\) Safety Checks & Edge Cases**

- **Node 18** detected → abort migration.
- **Old Tailwind plugin (\<4.1.11)** → warn and guide update.
- **Vitest workspace config** → rename to projects.
- **Legacy Sass API** → remove.
- **Named JSON Imports** → Auto-fix to default imports if safe, otherwise flag for user.

No edits should remove user business logic or restructuring directories.

## **9\) Run & Verify**

1. Reinstall dependencies (clean install recommended).
2. vite dev
   - Page loads, no startup errors.
3. vite build
   - Verify bundle integrity.
4. vitest
   - All tests run and coverage works.
5. Tailwind
   - Verify utilities generate correctly.
   - Confirm HMR still functions.

## **10\) Finalize & Merge**

Once all verification checks pass:

1. **Stage and Commit:**  
   git add .  
   git commit \-m "chore: migrate to vite 7"

2. **Merge to Main:**  
   git checkout main  
   git merge chore/migrate-vite-7  
   git push origin main

   _(Or instruct user to open a Pull Request if working in a team environment)_.

## **Deliverables**

Provide:

- A concise **CHANGELOG** summarizing:
  - Dependency upgrades
  - Tailwind plugin update (and CSS syntax change if applicable)
  - Vitest config updates
  - Removal of deprecated Vite config
  - Node baseline verification
- A list of modified files with explanations.
- Notes for any plugin requiring manual follow-up.

// @ts-nocheck: @types/node 20 predates module.registerHooks (Node 22.15+).
// The package is "type": "commonjs", but the Gadget sources use ESM syntax.
// Load .ts files as ES modules so node --test can import them with type stripping.
import { registerHooks } from 'node:module';

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith('.ts')) return nextLoad(url, { ...context, format: 'module-typescript' });
    return nextLoad(url, context);
  },
});

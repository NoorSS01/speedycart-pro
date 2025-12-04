# Hostinger Deployment Guide (for coding agents)

This project uses **React + Vite** and is deployed to a normal Hostinger web hosting plan using **Advanced Git**. Hostinger does **not** run `npm run build` for us – we commit the built `dist/` folder and let Apache serve it.

The instructions below are written for future coding agents so this setup can be reused on other similar projects.

---

## 1. Repo layout & Vite config

- Vite config:
  - `build.outDir = "dist"`
  - `base = "/dist/"` (because the SPA is served from `/dist` under the document root)
- The **`dist/` folder is committed to Git** (not ignored in `.gitignore`).
- There is a **root `.htaccess`** that rewrites all requests to `/dist/index.html` so React Router works on refresh and deep links.

Minimal `.htaccess` pattern used:

```apacheconf
RewriteEngine On

# Serve the built React app from /dist
RewriteCond %{REQUEST_URI} !^/dist/
RewriteRule ^$ /dist/index.html [L]

# For client-side routes, send everything to the SPA entry
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^ /dist/index.html [L]
```

> When adapting to another project, keep the same idea: commit the built folder and make `.htaccess` route everything to its `index.html`.

---

## 2. Build & commit flow (local)

For any new deployment:

1. Run `npm run build` locally.
2. Ensure `dist/` contains `index.html`, `assets/*`, and (optionally) its own `.htaccess` or static files.
3. Commit **both**:
   - The app source changes
   - The updated `dist/` output and `.htaccess`.
4. Push to the main branch connected to Hostinger Advanced Git.

This makes the repository itself a ready-to-serve static site.

---

## 3. Hostinger Advanced Git setup

In hPanel:

1. Go to **Advanced → Git** and connect the GitHub repo.
2. Set **Install Path** to the domain's web root, e.g.:
   - `/public_html` for the main domain.
3. Do **not** configure any build command – Advanced Git will just `git pull` the repo into that directory.
4. After pushing to `main`, click **Deploy** in Advanced Git.
5. The result in File Manager under `public_html` should include:
   - `.htaccess`
   - `dist/` (with `index.html` and assets)

At that point `https://your-domain.com` should load the Vite app from `/dist`.

---

## 4. Generic checklist for similar projects

When setting up another React/Vite SPA on Hostinger via Git only:

1. **Vite config**
   - Decide where the app will live relative to the document root.
   - Set `base` to that path and `build.outDir` accordingly.
2. **Build artifacts committed**
   - Remove `dist` from `.gitignore`.
   - Commit `dist/` after running `npm run build`.
3. **Routing**
   - Add a root `.htaccess` that rewrites all non-file/dir requests to the SPA `index.html`.
4. **Hostinger**
   - Advanced → Git → Install Path points to the domain's `public_html`.
   - No server-side build; deployments are just `git pull`.
5. **Verification**
   - After deploy, check File Manager for `.htaccess` and `dist/` in `public_html`.
   - Visit the domain and test both `/` and a nested route (e.g. `/shop`).

This pattern avoids blank pages caused by Hostinger serving the raw source instead of the built app.


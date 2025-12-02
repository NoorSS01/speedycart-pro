# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/016e7b5f-81e0-48be-8fae-0d9acbed6010

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/016e7b5f-81e0-48be-8fae-0d9acbed6010) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/016e7b5f-81e0-48be-8fae-0d9acbed6010) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## Supabase database setup (one file)

- Open `supabase/schema.sql` in this repo.
- Copy **all** the SQL in that file.
- In your Supabase project, go to **SQL editor** → **New query**.
- Paste the SQL and click **Run**.

This creates all required tables, enums, policies and triggers for the app.

## Hostinger Advanced Git Deployment

This project is configured for Hostinger Advanced Git deployment:

1. **Build Configuration**: 
   - Build output directory: `dist/`
   - Base path: `/` (configured in `vite.config.ts`)
   - The `.htaccess` file in `public/` is automatically copied to `dist/` during build for SPA routing

2. **Setup in Hostinger**:
   - Connect your GitHub repository in Hostinger's Advanced Git options
   - Set build command: `npm run build`
   - Set publish directory: `dist`
   - The `.htaccess` file ensures all routes are properly handled for React Router

3. **Important Notes**:
   - The project uses Vite + React with `BrowserRouter`, so all non-file routes must rewrite to `index.html`
   - The `.htaccess` file in `public/` handles this automatically
   - After pushing to your main branch, Hostinger will automatically build and deploy

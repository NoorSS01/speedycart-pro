# Hostinger Advanced Git Deployment Guide

## Setup Instructions

1. **In Hostinger Control Panel:**
   - Go to **Advanced** → **Git**
   - Connect your GitHub repository
   - Set **Build Command**: `npm run build`
   - Set **Publish Directory**: `dist`
   - Set **Node Version**: `20` (or latest LTS)

2. **Environment Variables:**
   Make sure to add these in Hostinger's environment variables section:
   - `VITE_SUPABASE_URL` - Your Supabase project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` - Your Supabase anon/public key

3. **After Configuration:**
   - Push to your `main` branch
   - Hostinger will automatically build and deploy
   - The `.htaccess` file will be included in the build for proper SPA routing

## Troubleshooting

If you see a blank page:

1. **Check Build Output**: Verify that Hostinger is building successfully
2. **Check Publish Directory**: Ensure it's set to `dist` (not `public_html`)
3. **Check Environment Variables**: Make sure Supabase credentials are set
4. **Check .htaccess**: The file should be automatically included in the `dist` folder
5. **Check Browser Console**: Look for any JavaScript errors

## Notes

- The build outputs to `dist/` directory (standard Vite output)
- The `.htaccess` file in `public/` is automatically copied to `dist/` during build
- All routes will be handled by React Router thanks to the `.htaccess` configuration


# SpeedyCart Pro - Enterprise E-Commerce Platform

A production-ready, feature-rich e-commerce application built with modern web technologies. Designed for performance, scalability, and an exceptional user experience.

![Project Status](https://img.shields.io/badge/status-production--ready-green)
![Tests](https://img.shields.io/badge/tests-passing-brightgreen)
![Coverage](https://img.shields.io/badge/coverage-high-blue)

## 🚀 Key Features

*   **PWA Ready**: Installable on mobile devices with rich offline capabilities.
*   **Performance First**: Optimized for Core Web Vitals with code-splitting, lazy loading, and asset optimization.
*   **Enterprise Administration**: Comprehensive dashboard for managing products, orders, delivery partners, and seasonal themes.
*   **Water Refill System**: Dedicated workflow for 20L water bottle deposits and refills.
*   **Delivery Management**: Dedicated portal for delivery partners with order assignment and routing.
*   **Theme System**: Dynamic seasonal themes (Diwali, Christmas, Ramazan) configurable via admin panel.

## 🛠 Tech Stack

*   **Frontend**: React (Vite), TypeScript
*   **UI Framework**: Shadcn UI, Tailwind CSS
*   **State Management**: React Query, Context API
*   **Backend / Database**: Supabase (PostgreSQL, Auth, Edge Functions)
*   **Testing**: Vitest (Unit), Playwright (E2E)
*   **Tooling**: ESLint, PostCSS

## 🏁 Getting Started

### Prerequisites

*   Node.js (v18+)
*   npm (v9+)
*   Supabase Project

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/your-org/speedycart-pro.git
    cd speedycart-pro
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Environment Setup**
    Create a `.env` file in the root directory:
    ```env
    VITE_SUPABASE_URL=your_supabase_url
    VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
    
    # Optional - Observability
    VITE_SENTRY_DSN=your_sentry_dsn
    VITE_LOGTAIL_TOKEN=your_logtail_token
    ```

4.  **Database Setup**
    Run the SQL scripts located in `supabase/` in your Supabase SQL Editor in the following order:
    1. `schema.sql` (Core schema)
    2. `water_deposits.sql` (Water features)
    3. `push_notifications.sql` (Notification system)

### Local Development

Start the development server:
```bash
npm run dev
```

## 🧪 Testing

We maintain high code quality standards through rigorous testing.

### Unit & Integration Tests (Vitest)
Runs tests for components, hooks, and utilities.
```bash
npm run test
```

### End-to-End Tests (Playwright)
Tests critical user flows like checkout and authentication.
*Requires local dev server running on port 5173.*
```bash
npm run e2e
```

## 📦 Deployment

### Hostinger (Advanced Git)
The project is configured for Hostinger's Advanced Git deployment.
*   **Build Command**: `npm run build`
*   **Publish Directory**: `dist`
*   **Routing**: `.htaccess` is automatically handled for client-side routing.

## 🔒 Security

*   Row Level Security (RLS) enabled on all database tables.
*   Protected Routes for Admin and Delivery interfaces.
*   Secure HTTP-only cookie handling for sessions.

---
© 2026 SpeedyCart Pro. All rights reserved.

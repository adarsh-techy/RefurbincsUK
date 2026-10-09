/**
 * Demo Login Credentials
 * Dedicated configuration file for quick-fill credentials on the Login page.
 *
 * Only enabled in local dev, or when a build explicitly opts in with
 * VITE_ENABLE_DEMO_LOGIN=true. Otherwise both exports are null and the
 * bundler drops the credentials entirely, so a production build doesn't
 * ship working logins (including super admin) to anyone who opens the site.
 */
export const DEMO_LOGIN_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_LOGIN === 'true';

// The repo is public, so no password lives in source: set VITE_DEMO_PASSWORD
// in your local (git-ignored) .env to make the quick-fill buttons log in.
const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD || '';

export const DEMO_CREDENTIALS = !DEMO_LOGIN_ENABLED ? null : {
  superAdmin: {
    id: 'superAdmin',
    label: 'Super Admin',
    icon: '👑',
    email: import.meta.env.VITE_DEMO_SUPERADMIN_EMAIL || 'superadmin@gmail.com',
    password: DEMO_PASSWORD,
    tone: 'indigo',
  },
  client: {
    id: 'client',
    label: 'HumanForest',
    icon: '⚡',
    email: import.meta.env.VITE_DEMO_CLIENT_EMAIL || 'humanforest@gmail.com',
    password: DEMO_PASSWORD,
    tone: 'emerald',
  },
  recycle: {
    id: 'recycle',
    label: 'Recycle Client',
    icon: '♻️',
    email: import.meta.env.VITE_DEMO_RECYCLE_EMAIL || 'recycle@gmail.com',
    password: DEMO_PASSWORD,
    tone: 'teal',
  },
};

export const MOBILE_DEMO_CREDENTIALS = !DEMO_LOGIN_ENABLED ? null : {
  akhil: {
    id: 'akhil',
    label: 'Akhil Tech',
    icon: '🔧',
    role: 'Technician',
    email: 'akhil@gmail.com',
    password: DEMO_PASSWORD,
    tone: 'violet',
  },
  akshay: {
    id: 'akshay',
    label: 'Akshay Sup',
    icon: '⚡',
    role: 'Supervisor',
    email: 'akshay@gmail.com',
    password: DEMO_PASSWORD,
    tone: 'blue',
  },
};

export default DEMO_CREDENTIALS;

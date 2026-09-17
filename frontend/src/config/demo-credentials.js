/**
 * Demo Login Credentials
 * Dedicated configuration file for quick-fill credentials on the Login page.
 * Can be overridden via environment variables if provided.
 */
export const DEMO_CREDENTIALS = {
  superAdmin: {
    id: 'superAdmin',
    label: 'Super Admin',
    icon: '👑',
    email: import.meta.env.VITE_DEMO_SUPERADMIN_EMAIL || 'superadmin@gmail.com',
    password: import.meta.env.VITE_DEMO_SUPERADMIN_PASSWORD || '12345678',
    tone: 'neutral',
  },
  client: {
    id: 'client',
    label: 'HumanForest',
    icon: '⚡',
    email: import.meta.env.VITE_DEMO_CLIENT_EMAIL || 'humanforest@gmail.com',
    password: import.meta.env.VITE_DEMO_CLIENT_PASSWORD || '12345678',
    tone: 'emerald',
  },
  recycle: {
    id: 'recycle',
    label: 'Recycle Client',
    icon: '♻️',
    email: import.meta.env.VITE_DEMO_RECYCLE_EMAIL || 'recycle@gmail.com',
    password: import.meta.env.VITE_DEMO_RECYCLE_PASSWORD || '12345678',
    tone: 'teal',
  },
};

export default DEMO_CREDENTIALS;

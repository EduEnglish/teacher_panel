export default [
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
    },
    rules: {
      // Disable strict rules for now - can be configured later
      'no-unused-vars': 'warn',
      'no-console': 'off', // Allow console.log in Cloud Functions
    },
  },
];


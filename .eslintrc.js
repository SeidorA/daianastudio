module.exports = {
    extends: [
        'eslint:recommended',
        'plugin:markdown/recommended',
        'plugin:react/recommended',
        'plugin:react/jsx-runtime',
        'plugin:react-hooks/recommended',
        'plugin:jsx-a11y/recommended',
        'plugin:prettier/recommended'
    ],
    settings: {
        react: {
            version: 'detect'
        }
    },
    parser: '@typescript-eslint/parser',
    ignorePatterns: ['**/node_modules', '**/dist', '**/build', '**/coverage', '**/package-lock.json'],
    plugins: ['unused-imports'],
    overrides: [
        {
            files: ['**/*.test.{js,jsx,ts,tsx}', '**/*.spec.{js,jsx,ts,tsx}'],
            rules: {
                'no-restricted-properties': [
                    'error',
                    { object: 'describe', property: 'only', message: 'Focused tests must not be committed.' },
                    { object: 'it', property: 'only', message: 'Focused tests must not be committed.' },
                    { object: 'test', property: 'only', message: 'Focused tests must not be committed.' }
                ]
            }
        }
    ],
    rules: {
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        'no-unused-vars': 'off',
        'unused-imports/no-unused-imports': 'warn',
        'unused-imports/no-unused-vars': ['warn', { vars: 'all', varsIgnorePattern: '^_', args: 'after-used', argsIgnorePattern: '^_' }],
        'no-undef': 'off',
        'no-console': [process.env.CI ? 'error' : 'warn', { allow: ['warn', 'error', 'info'] }],
        'prettier/prettier': 'error',
        'no-control-regex': 0 // Used to match control regex's in user input
    }
}

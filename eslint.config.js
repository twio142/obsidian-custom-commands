import antfu from '@antfu/eslint-config';

export default antfu({
  ignores: [
    '**/*.js',
    '**/*.html',
    '**/*.md',
    '**/*.yaml',
  ],
}, {
  rules: {
    'style/semi': ['error', 'always'],
    'style/brace-style': ['error', '1tbs'],
    'no-console': 'off',
    'unicorn/prefer-node-protocol': 'off',
    'node/prefer-global/process': 'off',
  },
});

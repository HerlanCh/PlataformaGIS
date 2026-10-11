export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Los mensajes se escriben en español; no se impone el uso de minúsculas de la convención inglesa.
    'subject-case': [0],
  },
};

// Generador de módulos: `pnpm gen:module <nombre>`.
const PLANTILLAS = 'tools/plop/templates/module';
const CARPETAS_VACIAS = ['domain', 'application', 'adapters', 'migrations'];

export default function (plop) {
  plop.setGenerator('module', {
    description: 'Crea un módulo hexagonal en packages/modules/<nombre>',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'Nombre del módulo (kebab-case, por ejemplo open-data):',
        validate: (valor) =>
          /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(valor) || 'Usa minúsculas, números y guiones',
      },
    ],
    actions: [
      {
        type: 'addMany',
        destination: 'packages/modules/{{name}}',
        base: PLANTILLAS,
        templateFiles: `${PLANTILLAS}/**/*.hbs`,
      },
      ...CARPETAS_VACIAS.map((carpeta) => ({
        type: 'add',
        path: `packages/modules/{{name}}/${carpeta}/.gitkeep`,
        template: '',
      })),
    ],
  });
}

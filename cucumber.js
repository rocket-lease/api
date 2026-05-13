module.exports = {
  default: {
    requireModule: [
        'ts-node/register',
        'tsconfig-paths/register'
    ],
    require: [
      'test/cucumber/step_definitions/**/*.ts',
      'test/cucumber/support/**/*.ts'
    ],
    paths: ['test/cucumber/features/**/*.feature'],
    publishQuiet: true,
    backtrace: true,
    format: ['summary']
  }
}

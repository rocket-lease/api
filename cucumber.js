module.exports = {
  default: {
    import: [
      'test/cucumber/step_definitions/**/*.ts',
      'test/cucumber/support/**/*.ts'
    ],
    paths: ['test/cucumber/features/**/*.feature'],
    publishQuiet: true,
    backtrace: true,
    format: ['summary', 'json:reports/cucumber-report.json', 'html:reports/cucumber-report.html']
  }
}

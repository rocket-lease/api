// Webpack config for `nest build --webpack`. Bundles api source AND
// the linked @rocket-lease/contracts source into a single dist/main.js,
// so the production image needs no runtime resolution of the link.
// See infra/docs/adr/0007-contracts-as-source.md.

const path = require('node:path');
const nodeExternals = require('webpack-node-externals');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

module.exports = function (options) {
  return {
    ...options,
    externals: [
      nodeExternals({
        // Bundle @rocket-lease/contracts INTO the output instead of leaving
        // it as a runtime require — contracts is not published, only linked.
        allowlist: [/^@rocket-lease\/contracts/],
      }),
    ],
    resolve: {
      ...options.resolve,
      plugins: [
        ...(options.resolve?.plugins ?? []),
        new TsconfigPathsPlugin({
          configFile: path.resolve(__dirname, 'tsconfig.build.json'),
        }),
      ],
    },
  };
};

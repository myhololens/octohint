// @ts-check
const path = require('path')
const CleanWebpackPlugin = require('clean-webpack-plugin')
const StringReplacePlugin = require('string-replace-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')

/** @type {import('webpack').Configuration} */
const config = {
  mode: 'development',
  watch: true,
  entry: {
    background: './src/chrome/background',
    'content-script': './src/chrome/content-script',
    options: './src/chrome/options',
  },
  output: {
    path: path.resolve('chrome/dist'),
    filename: '[name].js',
    publicPath: '/dist/',
  },
  // Enable sourcemaps for debugging webpack's output.
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'awesome-typescript-loader',
          options: { configFileName: './src/chrome/tsconfig.json' },
        },
        exclude: /node_modules/,
      },
      {
        // This is an ugly hack to prevent require error
        test: /node_modules\/vscode.*\.js$/,
        use: StringReplacePlugin.replace({
          replacements: [
            {
              pattern: /factory\(require, exports\)/g,
              replacement: function(match, p1, offset, string) {
                return 'factory(null, exports)'
              },
            },
            {
              pattern: /function \(require, exports\)/,
              replacement: function(match, p1, offset, string) {
                return 'function (UnUsedVar, exports)'
              },
            },
          ],
        }),
      },
      {
        enforce: 'pre',
        test: /\.js$/,
        use: 'source-map-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
  },

  // https://github.com/postcss/postcss-js/issues/10#issuecomment-179782081
  node: { fs: 'empty' },
  plugins: [
    new CleanWebpackPlugin('chrome/dist'),
    new StringReplacePlugin(),
    new HtmlWebpackPlugin({
      title: 'Options',
      filename: 'options.html',
      chunks: ['options'],
    }),
  ],
}

module.exports = config

import * as webpack from 'webpack'
import * as path from 'path'
import * as CleanWebpackPlugin from 'clean-webpack-plugin'
import * as StringReplacePlugin from 'string-replace-webpack-plugin'
import * as HtmlWebpackPlugin from 'html-webpack-plugin'
// TODO: Live reload

import { Plugin, RuleSetUse } from 'webpack'

declare class StringReplacePlugin extends Plugin {
  static replace(options: StringReplacePlugin.Options, nextLoaders?: string): RuleSetUse
  static replace(prevLoaders: string, options: StringReplacePlugin.Options, nextLoaders?: string): RuleSetUse
}

declare namespace StringReplacePlugin {
  interface Options {
    replacements: ReplacementItem[]
  }

  interface ReplacementItem {
    pattern: RegExp
    replacement: (substring: string, ...args: any[]) => string
  }
}

const config: webpack.Configuration = {
  mode: 'development',
  watch: true,
  entry: {
    'ts-lib': './src/ts-lib',
    background: './src/chrome/background',
    'content-script': './src/chrome/content-script',
    options: './src/chrome/options',
  },
  output: {
    path: path.resolve('chrome/dist'),
    filename: '[name].js',
  },
  // Enable sourcemaps for debugging webpack's output.
  devtool: 'source-map',
  module: {
    rules: [
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
        test: /\.tsx?$/,
        use: 'awesome-typescript-loader',
        exclude: /node_modules/,
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
    alias: {
      path: 'path-browserify',
    },
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

const safariConfig: webpack.Configuration = {
  ...config,
  entry: {
    'ts-lib': './src/ts-lib',
    background: './src/safari/background',
    'content-script': './src/safari/content-script',
  },
  output: {
    ...config.output,
    path: path.resolve('octohint.safariextension/dist'),
  },
  plugins: [new CleanWebpackPlugin('octohint.safariextension/dist'), new StringReplacePlugin()],
}

// multiple outputs
// https://github.com/webpack/webpack/blob/master/examples/multi-compiler/webpack.config.js
export default [config, safariConfig]

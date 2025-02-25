const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');
const webpack = require('webpack');

module.exports = {
    entry: path.join(__dirname, 'src/index.js'),
    output: {
        path: path.join(__dirname, 'dist/'),
        filename: 'index.js',
        libraryTarget: 'window',
        library: 'STCharacterDistributor' // Export as a window variable
    },
    mode: 'production',
    target: 'web', // Target web browsers
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        cacheDirectory: true,
                        presets: ['@babel/preset-env']
                    }
                }
            }
        ]
    },
    optimization: {
        minimize: true,
        minimizer: [new TerserPlugin({
            extractComments: false,
        })]
    },
    // Define SillyTavern globals as externals
    externals: {
        // These will be available at runtime from the window object
        'window': 'window',
        'jQuery': 'jQuery',
        '$': '$'
    },
    resolve: {
        fallback: {
            "buffer": false,
            "crypto": false,
            "stream": false,
            "util": false,
            "process": false
        }
    },
    plugins: [
        // Define SillyTavern globals
        new webpack.DefinePlugin({
            'global': {}
        })
    ]
};
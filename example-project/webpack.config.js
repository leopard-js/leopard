const path = require('path')

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js'
  },
  module: {
    rules: [
      {
        test: /\.(png|jpg|gif|svg)$/i,
        loader: 'url-loader'
      }
    ]
  },
  devServer: {
    publicPath: '/dist/'
  }
}
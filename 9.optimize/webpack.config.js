const path = require("path");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const PurgecssPlugin = require("purgecss-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const OptimizeCSSAssetsPlugin = require("optimize-css-assets-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const UploadPlugin = require("./plugins/UploadPlugin");
const {BundleAnalyzerPlugin} = require("webpack-bundle-analyzer")
const glob = require("glob");
const PATHS = {
    src: path.join(__dirname, "src"),
};
module.exports = {
  mode: "development",
  devtool: false,
  context: process.cwd(),
  //entry:'./src/index.js',
  /*   
  entry: {
    page1: "./src/page1.js",
    page2: "./src/page2.js",
    page3: "./src/page3.js",
  }, */
  entry: {
    main: "./src/index.js",
    vender: ["lodash"],
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].[chunkhash].js",
    chunkFilename: "[name].[chunkhash].chunk.js",
    //publicPath: "http://img.zhufengpeixun.cn/", // 产出的文件的访问的域名。比如我将产出的文件上传到七牛云CDN服务器了，那么我可以在这里加上这个域名，用以访问七牛云上的静态文件。这里也可以设置成自己服务器的域名。
  },
  optimization: {
    minimize: true,
    minimizer: [
      //压缩JS
      /* new TerserPlugin({
        sourceMap: false,
        extractComments: false,
      }),
      //压缩CSS
      new OptimizeCSSAssetsPlugin({}), */
    ],
    //自动分割第三方模块和公共模块
    /*  splitChunks: {
      chunks: "all", //默认作用于异步chunk，值为all（全部），all和initial的效果差不多/initial（同步），既分割同步的代码块，也分割import()形式的代码块/async（异步），只分割import()形式的模块
      minSize: 0, //默认值是30kb，代码块的最小尺寸，意思是只要大于30kb就分割出去（多大才分割出去）
      minChunks: 1, //被多少模块共享才会分割出去，在分割之前模块的被引用次数。
      maxAsyncRequests: 2, //最大异步请求数，限制异步模块内部的并行最大请求数的，说白了你可以理解为是每个import()它里面的最大并行请求数量
      maxInitialRequests: 3, //最大同步请求数，限制入口的拆分数量
      name: true, //打包后的名称，默认是chunk的名字通过分隔符（默认是～）分隔开，如vendor~
      automaticNameDelimiter: "~", //默认webpack将会使用入口名和代码块的名称生成命名,比如 'vendors~main.js'
      cacheGroups: {// 缓存组
        //设置缓存组用来抽取满足不同规则的chunk,下面以生成common为例
        vendors: {
          chunks: "all",
          test: /node_modules/, // 条件，意思是如果你的模块是在node_modules里的，会被放到venders里面去
          priority: -10, ///优先级，一个chunk很可能满足多个缓存组，会被抽取到优先级高的缓存组中,为了能够让自定义缓存组有更高的优先级(默认0),默认缓存组的priority属性为负值.
        },
        commons: {
          chunks: "all",
          minSize: 0, //最小提取字节数
          minChunks: 2, //最少被几个chunk引用
          priority: -20,// 如果一个模块既满足commons缓存组的条件，又满足venders缓存组的条件，则根据优先级-10 > -20的原则，模块会被分割到venders里
        },
      },
    }, */
    //为了长期缓存保持运行时代码块是单独的文件
    /*  runtimeChunk: {
      name: (entrypoint) => `runtime-${entrypoint.name}`,
    }, */
  },
  module: {
    rules: [
      {
        test: /\.js/,
        include: path.resolve(__dirname, "src"),
        use: [
          {
            loader: "babel-loader",
            options: {
              presets: [
                ["@babel/preset-env", { modules: false }],
                "@babel/preset-react",
              ],
            },
          },
        ],
      },
      {
        test: /\.css$/,
        include: path.resolve(__dirname, "src"),
        exclude: /node_modules/,
        use: [
          {
            loader: MiniCssExtractPlugin.loader,
          },
          "css-loader",
        ],
      },
      {
        test: /\.(png|svg|jpg|gif|jpeg|ico)$/,
        use: [
          "file-loader",
          {
            loader: "image-webpack-loader",
            options: {
              mozjpeg: {
                progressive: true,
                quality: 65,
              },
              optipng: {
                enabled: false,
              },
              pngquant: {
                quality: "65-90",
                speed: 4,
              },
              gifsicle: {
                interlaced: false,
              },
              webp: {
                quality: 75,
              },
            },
          },
        ],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      inject: true,
      template: "./src/index.html"
     // filename:'[name].[hash].html' // 一版html不会设置缓存
    }),
    new MiniCssExtractPlugin({
      filename: "[name].[contenthash].css",
    }),
    new PurgecssPlugin({
      paths: glob.sync(`${PATHS.src}/**/*`, { nodir: true }),
    }),
    //new UploadPlugin({}),
    new BundleAnalyzerPlugin({
      analyzerMode: "disabled", // 不启动展示打包报告的http服务器
      generateStatsFile: true, // 是否生成stats.json文件
    }),
    //new BundleAnalyzerPlugin(), // 使用默认配置
    //默认配置的具体配置项
    /*     
    new BundleAnalyzerPlugin({
      analyzerMode: 'server',
      analyzerHost: '127.0.0.1',
      analyzerPort: '8888',
      reportFilename: 'report.html',
      defaultSizes: 'parsed',
      openAnalyzer: true,
      generateStatsFile: false,
      statsFilename: 'stats.json',
      statsOptions: null,
      excludeAssets: null,
      logLevel: info
    }) */
  ],
  devServer: {},
};

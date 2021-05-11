module.exports = function (grunt) {
  //1.加载 babel任务
  grunt.loadNpmTasks("grunt-babel");
  //初始化配置文件
  grunt.initConfig({
    babel: {
      options: {
        sourceMap: true,
        presets: ["@babel/preset-env"], // 把es6编译成es5
      },
      dist: {
        files: {
          "dist/app.js": "src/app.js",
        },
      },
    },
  });
  //default指的是入口任务
  grunt.registerTask("default", ["babel"]);
};

const fs = require("fs");//读文件
const path = require("path");//处理路径的
const types = require("babel-types");//处理类型
const parser = require("@babel/parser");//把源代码转成抽象语法树
const traverse = require("@babel/traverse").default;//遍历语法树
const generate = require("@babel/generator").default;//把语树生成源代码
const baseDir = toUnix(process.cwd());//根目录 /
const {SyncHook} = require('tapable');

class Compiler {
  constructor(options) {
    this.options = options;
    this.hooks = {
      run: new SyncHook(),
      done: new SyncHook()
    };
  }
  run() {
    let modules = [];
    let chunks = [];
    let assets = {};
    let files = [];
    this.hooks.run.call(); 
    //5. 根据配置中的`entry`找出入口文件
    let entry = toUnix(path.join(this.options.context, this.options.entry));
    //从入口文件出发,调用所有配置的`Loader`对模块进行编译
    let entryModule = buildModule(entry);
    modules.push(entryModule);
    //7. 再找出该模块依赖的模块，再递归本步骤直到所有入口依赖的文件都经过了本步骤的处理
    entryModule.dependencies.forEach(dependency=>{
      let dependencyModule= buildModule(dependency);
      modules.push(dependencyModule);
    });
    //8.根据入口和模块之间的依赖关系，组装成一个个包含多个模块的 Chunk
    let chunk = { name: "main", entryModule,modules};
    chunks.push(chunk);
    //9. 再把每个Chunk转换成一个单独的文件加入到输出列表
    chunks.forEach(chunk => {
      assets[chunk.name+'.js']=getSource(chunk);
    });
    //10.在确定好输出内容后，根据配置确定输出的路径和文件名，把文件内容写入到文件系统
    files = Object.keys(assets);
    for(let file in assets){
      fs.writeFileSync(`./dist/${file}`, assets[file]);
    }
    this.hooks.done.call();
  }
}
//1. 初始化参数：从配置文件和Shell语句中读取与合并参数，得出最终的参数对象 --entry
let options = require('./webpack.config');
let shellOptions = process.argv.slice(2).reduce((config,item)=>{
  let [key,value] = item.split('=');
  config[key.slice(2)]=value;
  return config;
},{});
Object.assign(options,shellOptions);

//2.用上一步得到的参数初始化Compiler对象
let compiler = new Compiler(options);

//3.加载所有配置的插件
if (options.plugins && Array.isArray(options.plugins)) {
  for (const plugin of options.plugins) {
   plugin.apply(compiler);
  }
}
//4.执行对象的run方法开始执行编译
compiler.run();

function babelLoader(source) {
  return source;
}

function buildModule(modulePath){
  const originSource = fs.readFileSync(modulePath, "utf-8");//读取文件内容
  const scriptSource  = babelLoader(originSource);
  const ast = parser.parse(scriptSource, {
    sourceType: "module",//源代码转成抽象语法树
  });
  const moduleId = "./" + path.posix.relative(baseDir, modulePath);// ./src/index.js
  const module = { id: moduleId, dependencies:[] };//模块对象
  traverse(ast, {
    CallExpression({ node }) {
      if (node.callee.name === 'require') {
        node.callee.name = "__webpack_require__";
        let moduleName = node.arguments[0].value;
        const dirname = path.posix.dirname(modulePath);
        const dependencyPath = path.posix.join(dirname, moduleName);
        const dependencyModuleId = "./" + path.posix.relative(baseDir, dependencyPath);
        node.arguments = [types.stringLiteral(dependencyModuleId)];
        module.dependencies.push(dependencyPath);
      }
    }
  });
  let { code } = generate(ast);
  module._source = code;
  return module;
}

function getSource(chunk){
 return `
          (function (modules) {
              function __webpack_require__(moduleId) {
                  var module = {
                      i: moduleId,
                      exports: {}
                  };
                  modules[moduleId].call(
                      module.exports,
                      module,
                      module.exports,
                      __webpack_require__
                  );
                  return module.exports;
              }
          
              return __webpack_require__("${chunk.entryModule.id}");
          })(
              {
                ${chunk.modules
                  .map(
                    (module) =>
                      `"${module.id}": function (module, exports,__webpack_require__) {${module._source}}`
                  )
                  .join(",")}
              }
          );
        `;
}
function toUnix(url){
  return url.replace(/\\/g,path.posix.sep);
}
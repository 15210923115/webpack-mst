var fs = require("fs");
var path = require("path");
var readFile = fs.readFile.bind(fs);

var PATH_QUERY_FRAGMENT_REGEXP = /^([^?#]*)(\?[^#]*)?(#.*)?$/;

/**
 * @param {string} str 包含查询字符串和片断的路径
 * @returns {{ path: string, query: string, fragment: string }} 解析结果
 */
function parsePathQueryFragment(str) {
	var match = PATH_QUERY_FRAGMENT_REGEXP.exec(str);
	return {
		path: match[1],
		query: match[2] || "",
		fragment: match[3] || ""
	};
}

function createLoaderObject(loader) {
	var obj = {
		path: null,//原始路径
		query: null,//查询参数
		fragment: null,//片段
		normal: null,//正常的loader
		pitch: null,//pitch的loader
		raw: null,//是否需要原生Buffer
		data: null,//当前数据
		pitchExecuted: false,//pitch已经执行过
		normalExecuted: false//正常已经执行过
	};
	Object.defineProperty(obj, "request", {
		get: function () {
			return obj.path + obj.query;
		},
		set: function (value) {
			var splittedRequest = parsePathQueryFragment(value);
			obj.path = splittedRequest.path;
			obj.query = splittedRequest.query;
			obj.fragment = splittedRequest.fragment;
		}
	});
	obj.request = loader;//这里会走上面的set
	return obj;
}

function runSyncOrAsync(fn, context, args, callback) {
	var isSync = true;
	var isDone = false;
	context.async = function async() {
		if (isDone) {
			throw new Error("async(): The callback was already called.");
		}
		isSync = false;
		return innerCallback;
	};
	var innerCallback = context.callback = function () {
		if (isDone) {
			throw new Error("callback(): The callback was already called.");
		}
		isDone = true;
		isSync = false;
		callback.apply(null, arguments);
	};
	var result = fn.apply(context, args);
	if (isSync) {
		isDone = true;
		return callback(null, result);
	}
}

function convertArgs(args, raw) {
	if (!raw && Buffer.isBuffer(args[0]))
		args[0] = args[0].toString("utf-8");
	else if (raw && typeof args[0] === "string")
		args[0] = Buffer.from(args[0], "utf-8");
}

function iteratePitchingLoaders(options, loaderContext, callback) {
	//最后一个loader就结束了,开始读取模块内容
	if (loaderContext.loaderIndex >= loaderContext.loaders.length)
		return processResource(options, loaderContext, callback);
	//当前的loader对象
	var currentLoaderObject = loaderContext.loaders[loaderContext.loaderIndex];

	// 如果执行过了pitch则可以继续执行下一个pitch
	if (currentLoaderObject.pitchExecuted) {
		loaderContext.loaderIndex++;
		return iteratePitchingLoaders(options, loaderContext, callback);
	}

	//加载loader这个模块
	loadLoader(currentLoaderObject);
	var pitchFn = currentLoaderObject.pitch;
	currentLoaderObject.pitchExecuted = true;
	if (!pitchFn) return iteratePitchingLoaders(options, loaderContext, callback);
	runSyncOrAsync(
		pitchFn,
		loaderContext, [loaderContext.remainingRequest, loaderContext.previousRequest, currentLoaderObject.data = {}],
		function (err,args) {
			//为了支持同步和异步,可以基于参数的值决定是否继续pitching流程,只要有一个参数不为undefined就可以
			//如果有参数
			if (args) {
				loaderContext.loaderIndex--;//索引减1,开始回退了
				iterateNormalLoaders(options, loaderContext, args, callback);
			} else {
				iteratePitchingLoaders(options, loaderContext, callback);
			}
		}
	);
}
function loadLoader(loader) {
	var module = require(loader.path);
	loader.normal = module;
	loader.pitch = module.pitch;
	loader.raw = module.raw;
};
function processResource(options, loaderContext, callback) {
	loaderContext.loaderIndex = loaderContext.loaders.length - 1;
	var resourcePath = loaderContext.resourcePath;
	if (resourcePath) {
		options.readResource(resourcePath, function (err, buffer) {
			if (err) return callback(err);
			options.resourceBuffer = buffer;
			iterateNormalLoaders(options, loaderContext, [buffer], callback);
		});
	} else {
		iterateNormalLoaders(options, loaderContext, [null], callback);
	}
}

function iterateNormalLoaders(options, loaderContext, args, callback) {
	if (loaderContext.loaderIndex < 0)
		return callback(null, args);

	var currentLoaderObject = loaderContext.loaders[loaderContext.loaderIndex];
	if (currentLoaderObject.normalExecuted) {
		loaderContext.loaderIndex--;
		return iterateNormalLoaders(options, loaderContext, args, callback);
	}

	var fn = currentLoaderObject.normal;
	currentLoaderObject.normalExecuted = true;
	if (!fn) {
		return iterateNormalLoaders(options, loaderContext, args, callback);
	}

	convertArgs(args, currentLoaderObject.raw);

	runSyncOrAsync(fn, loaderContext, args, function (err) {
		if (err) return callback(err);
		var args = Array.prototype.slice.call(arguments, 1);
		iterateNormalLoaders(options, loaderContext, args, callback);
	});
}

exports.runLoaders = function runLoaders(options, callback) {
	var resource = options.resource || "";//读取的资源
	var loaders = options.loaders || [];//配置的loader
	var loaderContext = options.context || {};//上下文路径
	var readResource = options.readResource || readFile;//读取文件的模块

	var splittedResource = resource && parsePathQueryFragment(resource);//分割资源路径
	var resourcePath = splittedResource ? splittedResource.path : undefined;//绝对路径
	var resourceQuery = splittedResource ? splittedResource.query : undefined;//查询参数
	var resourceFragment = splittedResource ? splittedResource.fragment : undefined;//片断
	var contextDirectory = resourcePath ? path.dirname(resourcePath) : null;//资源所在的目录
	//准备loader对象
	loaders = loaders.map(createLoaderObject);

	loaderContext.context = contextDirectory;//此模块所在的目录
	loaderContext.loaderIndex = 0;//当前loader的索引
	loaderContext.loaders = loaders;//loader数组
	loaderContext.resourcePath = resourcePath;//资源绝对路径
	loaderContext.resourceQuery = resourceQuery;//查询字符串
	loaderContext.resourceFragment = resourceFragment;//片断
	loaderContext.async = null;//是否异步
	loaderContext.callback = null;//调下一个loader
	Object.defineProperty(loaderContext, "resource", {
		enumerable: true,
		get: function () {
			return loaderContext.resourcePath + loaderContext.resourceQuery + loaderContext.resourceFragment;
		}
	});
	Object.defineProperty(loaderContext, "request", {
		enumerable: true,
		get: function () {
			return loaderContext.loaders.map(function (o) {
				return o.request;
			}).concat(loaderContext.resource || "").join("!");
		}
	});
	Object.defineProperty(loaderContext, "remainingRequest", {
		enumerable: true,
		get: function () {
			if (loaderContext.loaderIndex >= loaderContext.loaders.length - 1 && !loaderContext.resource)
				return "";
			return loaderContext.loaders.slice(loaderContext.loaderIndex + 1).map(function (o) {
				return o.request;
			}).concat(loaderContext.resource || "").join("!");
		}
	});
	Object.defineProperty(loaderContext, "currentRequest", {
		enumerable: true,
		get: function () {
			return loaderContext.loaders.slice(loaderContext.loaderIndex).map(function (o) {
				return o.request;
			}).concat(loaderContext.resource || "").join("!");
		}
	});
	Object.defineProperty(loaderContext, "previousRequest", {
		enumerable: true,
		get: function () {
			return loaderContext.loaders.slice(0, loaderContext.loaderIndex).map(function (o) {
				return o.request;
			}).join("!");
		}
	});
	Object.defineProperty(loaderContext, "query", {
		enumerable: true,
		get: function () {
			var entry = loaderContext.loaders[loaderContext.loaderIndex];
			return entry.options && typeof entry.options === "object" ? entry.options : entry.query;
		}
	});
	Object.defineProperty(loaderContext, "data", {
		enumerable: true,
		get: function () {
			return loaderContext.loaders[loaderContext.loaderIndex].data;
		}
	});

	var processOptions = {
		resourceBuffer: null,
		readResource: readResource
	};
	iteratePitchingLoaders(processOptions, loaderContext, function (err, result) {
		if (err) { return callback(err, {}); }
		callback(null, {
			result: result,
			resourceBuffer: processOptions.resourceBuffer
		});
	});
};

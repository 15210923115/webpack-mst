module.exports = function loadLoader(loader, callback) {
	var module = require(loader.path);
	loader.normal = module;
	loader.pitch = module.pitch;
	loader.raw = module.raw;
	callback();
};

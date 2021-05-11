function loader(source) {
  let callback = this.async();
  return callback(null,source+'//async2');
}

module.exports = loader;
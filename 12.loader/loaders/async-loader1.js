function loader(source) {
  debugger
  let callback = this.async();
  return callback(null,source+'//async1');
}
/* 
loader.pitch = function(){
  return 'let async1-pitch;';
} */
module.exports = loader;
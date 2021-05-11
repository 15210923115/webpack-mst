let {SyncHook,HookMap} = require('tapable');
const keyedHook = new HookMap(key => new SyncHook(["name"]))
keyedHook.tap('key',"Plugin1", (name) => {console.log(1,name); });
keyedHook.for("key").tap("Plugin2", (name) => {console.log(2,name); });
const hook = keyedHook.get("key");
hook.call("zhufeng");
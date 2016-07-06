# proxy-all

Proxies all http/https requests when NODE_PROXY env is set

## Install

```
npm install --save proxy-all
```

## Use

### require the module
```js
require('proxy-all');
// ... more code ...
```

### run your code with NODE_PROXY set

```
NODE_PROXY=http://localhost:8080/ node index.js
```
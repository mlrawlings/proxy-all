
/**
 * Module dependencies.
 */

var net = require('net');
var tls = require('tls');
var url = require('url');
var extend = require('extend');
var Agent = require('agent-base');
var inherits = require('util').inherits;
var debug = require('debug')('http-proxy-agent');

/**
 * Module exports.
 */

module.exports = ProxyAgent;

/**
 * The `ProxyAgent` implements an HTTP Agent subclass that connects to the
 * specified "HTTP proxy server" in order to proxy HTTP requests.
 *
 * @api public
 */

function ProxyAgent(options) {
    if (!(this instanceof ProxyAgent)) return new ProxyAgent(options);
    if ('string' == typeof options) options = url.parse(options);
    if (!options) throw new Error('an HTTP(S) proxy server `host` and `port` must be specified!');
    debug('creating new ProxyAgent instance: %o', options);
    Agent.call(this, connect);

    var proxy = extend({}, options);

    // if `true`, then connect to the proxy server over TLS. defaults to `false`.
    this.secureProxy = proxy.protocol ? /^https:?$/i.test(proxy.protocol) : false;

    // prefer `hostname` over `host`, and set the `port` if needed
    proxy.host = proxy.hostname || proxy.host;
    proxy.port = +proxy.port || (this.secureProxy ? 443 : 80);

    if (proxy.host && proxy.path) {
        // if both a `host` and `path` are specified then it's most likely the
        // result of a `url.parse()` call... we need to remove the `path` portion so
        // that `net.connect()` doesn't attempt to open that as a unix socket file.
        delete proxy.path;
        delete proxy.pathname;
    }

    this.proxy = proxy;
}
inherits(ProxyAgent, Agent);

ProxyAgent.prototype.getSocket = function getSocket() {
    if (this.secureProxy) {
        return tls.connect(this.proxy);
    } else {
        return net.connect(this.proxy);
    }
}

/**
 * Called when the node-core HTTP client library is creating a new HTTP request.
 *
 * @api public
 */
function connect(req, options, fn) {
     // change the `http.ClientRequest` instance's "path" field
     // to the absolute path of the URL that will be requested
     // by the proxy
     req.path = getAbsoluteUrl(req.path, options);

     // at this point, the http ClientRequest's internal `_header` field might have
     // already been set. If this is the case then we'll need to re-generate the
     // string since we just changed the `req.path`
     if(req._header) {
         regenerateHeader(req);
     }

     // it is also possible that the _header has already been queued to be
     // written to the socket, if so, we need to patch the output buffer
     if(req.output && req.output.length > 0) {
         patchOutputBuffer(req);
     }

     fn(null, this.getSocket());
}

function getAbsoluteUrl(path, options) {
    var parsed = url.parse(path);
    if (null == parsed.protocol) parsed.protocol = options.protocol || 'http:';
    if (null == parsed.hostname) parsed.hostname = options.hostname || options.host;
    if (null == parsed.port) parsed.port = options.port;
    if (isDefaultPort(parsed)) delete parsed.port;
    return url.format(parsed);
}

function isDefaultPort(url) {
    return (url.protocol == 'http:' && url.port == 80) ||
           (url.protocol == 'https:' && url.port == 443);
}

function regenerateHeader(req) {
    debug('regenerating stored HTTP header string for request');
    req._header = null;
    req._implicitHeader();
}

function patchOutputBuffer(req) {
    debug('patching connection write() output buffer with updated header');
    var firstChunk = req.output[0];
    var endOfHeaders = firstChunk.indexOf('\r\n\r\n') + 4;
    var bodyStart = firstChunk.substring(endOfHeaders);
    req.output[0] = req._header + bodyStart;
    debug('output buffer: %o', req.output);
}
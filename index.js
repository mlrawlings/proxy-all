var http = require('http')
var https = require('https')
var colors = require('colors')
var _requestHttp = http.request
var _requestHttps = https.request
var url = require('url')
var debug = process.env.NODE_DEBUG && /proxy-all/.test(process.env.NODE_DEBUG)
var proxy = process.env.NODE_PROXY
var ProxyAgent = require('./agent')

if(proxy) {
    http.request = function(options, callback) {
        options = typeof options === 'string'
            ? url.parse(options)
            : Object.assign({}, options)

        if(debug) {
            var protoColor = options.protocol == 'https:' ? 'yellow' : 'gray'
            var protoLog = colors[protoColor].bold((options.protocol||'')+'//')
            var hostLog = colors.bold(options.host||'')
            var pathLog = options.path
            var urlLog = protoLog + hostLog + pathLog
        }

        options.agent = new ProxyAgent(proxy)

        var callback2 = !debug ? callback : function(response) {
            var isError = parseInt(response.statusCode) >= 400
            var statusColor = isError ? 'red' : 'green'
            var statusLog = colors[statusColor].bold(response.statusCode)
            var body = ''

            if(isError) response.on('data', function(chunk) {
                body += chunk
            })

            response.on('end', function() {
                console.log(statusLog, urlLog, body)
            })

            callback && callback.apply(this, arguments)
        }

        var request = _requestHttp.call(http, options, callback2)

        if(debug) request.on('error', function(err) {
            console.log(colors.red.bold('[REQUEST ERROR]'), urlLog, err)
        })

        return request
    }

    https.request = function(options, callback) {
        options = typeof options === 'string'
            ? url.parse(options)
            : Object.assign({}, options)

        options.protocol = 'https:'

        return _requestHttps.call(https, options, callback)
    }
}
'use strict';

const Hapi = require('@hapi/hapi');
const swStats = require('../../lib');    // require('swagger-stats');
const Inert = require('@hapi/inert');

const swaggerSpec = require('./petstore.json');

let server = null;

function waitfor(t, v) {
    return new Promise(function(resolve) {
        setTimeout(resolve.bind(null, v), t)
    });
}

const init = async () => {

    server = Hapi.server({
        port: 3040,
        host: 'localhost'
    });

    server.route({
        method: 'GET',
        path: '/',
        handler: (request, h) => {
            return 'Hello World!';
        }
    });

    await server.register(Inert);

    await server.register({
        plugin: swStats.getHapiPlugin,
        options: {
            name: 'swagger-stats-hapitest',
            version: '0.95.7',
            hostname: "hostname",
            ip: "127.0.0.1",
            swaggerSpec:swaggerSpec
        }
    });

    await server.ext('onRequest', async function (request, h) {
        // respond to any petstore api
        if(request.raw.req.url.startsWith('/v2')) {
            return await mockApiImplementation(request,h);
        }else{
            return h.continue;
        }
    });

    await server.start();
    console.log('Server running on %s', server.info.uri);
};

process.on('unhandledRejection', (err) => {

    console.log(err);
    process.exit(1);
});

function stopApp() {
    console.log('stopping hapi server')
    server.stop({ timeout: 1000 }).then(function (err) {
        console.log('hapi server stopped');
        process.exit(0);
    })
}

// Mock implementation of any API request
// Supports the following parameters in x-sws-res header:
// x-sws-res={ code:<response code>,
//             message:<message to provide in response>,
//             delay:<delay to respond>,
//             payloadsize:<size of payload JSON to generate>
//           }
async function mockApiImplementation(request,h){

    let code = 500;
    let message = "MOCK API RESPONSE";
    let delay = 0;
    let payloadsize = 0;


    // get header
    let hdrSwsRes = request.headers['x-sws-res'];

    if(typeof hdrSwsRes !== 'undefined'){
        var swsRes = JSON.parse(hdrSwsRes);
        if( 'code' in swsRes ) code = parseInt(swsRes.code);
        if( 'message' in swsRes ) message = swsRes.message;
        if( 'delay' in swsRes ) delay = swsRes.delay;
        if( 'payloadsize' in swsRes ) payloadsize = swsRes.payloadsize;
    }

    if( delay > 0 ){
        await waitfor(delay);
    }

    return mockApiSendResponse(request,h,code,message,payloadsize);
}

function mockApiSendResponse(request,h,code,message,payloadsize){
    if(payloadsize<=0){
        return h.response(message)
            .code(code)
            .header('Content-Type', 'text/plain')
            .takeover();
    }else{
        // generate dummy payload of approximate size
        var dummyPayload = [];
        var adjSize = payloadsize-4;
        if(adjSize<=0) adjSize = 1;
        var str = '';
        for(var i=0;i<adjSize;i++) str += 'a';
        dummyPayload.push(str);
        return h.response(dummyPayload)
            .code(code)
            .takeover();
    }
}


init();
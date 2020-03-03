#!/usr/bin/env node
const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const allowedFiles = [
    "/index.html",
    "/index-server.html",
    "/js/client.js",
    "/js/server.js",
];

function isFileAllowed(file) {
    for (let i = 0; i < allowedFiles.length; i++) {
        if (allowedFiles[i] === file) {
            return true;
        }
    }
    return false;
}

http.createServer(function (req, res) {
    if (!isFileAllowed(req.url)) {
        res.writeHead(404);
        res.end();
        return;
    }
    const content = fs.readFileSync('.' + req.url);
    res.writeHead(200, {'Content-Type': req.url.endsWith("html") ? 'text/html' : "application/json"});
    res.end(content);
}).listen(8000);

const wss = new WebSocket.Server({
    port: 8080,
    perMessageDeflate: {
        zlibDeflateOptions: {
            // See zlib defaults.
            chunkSize: 1024,
            memLevel: 7,
            level: 3
        },
        zlibInflateOptions: {
            chunkSize: 10 * 1024
        },
        // Other options settable:
        clientNoContextTakeover: true, // Defaults to negotiated value.
        serverNoContextTakeover: true, // Defaults to negotiated value.
        serverMaxWindowBits: 10, // Defaults to negotiated value.
        // Below options specified as default values.
        concurrencyLimit: 10, // Limits zlib concurrency for perf.
        threshold: 1024 // Size (in bytes) below which messages
        // should not be compressed.
    }
});

clients = {};
let clientIdGen = 1;
wss.on('connection', function connection(ws) {
    const clientId = clientIdGen++;
    clients[clientId] = ws;
    console.log("Client %s connected", clientId);
    ws.on('close',  e => {
        console.log("Connection to client %s closed", clientId);
        delete clients[clientId];
    });
    ws.on('message', function incoming(message) {
        console.log('received (%s): %s', clientId, message);
        let msg;
        try {
            msg = JSON.parse(message);
        } catch (e) {
            console.log("Parse error (%s): %s", clientId, e);
            return;
        }
        const fwd = {
            from: clientId,
            payload: msg.payload
        };
        if (msg.to === "all") {
            for (const rcid in clients) {
                if (clients.hasOwnProperty(rcid) && clientId.toString() !== rcid) {
                    console.log("Relaying to %s", rcid);
                    clients[rcid].send(JSON.stringify(fwd));
                }
            }
        } else {
            console.log("Relaying to %s", msg.to);
            clients[msg.to].send(JSON.stringify(fwd));
        }
    });
});

console.log("Listening...");
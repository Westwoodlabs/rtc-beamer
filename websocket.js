#!/usr/bin/env node
const WebSocket = require('ws');
const https = require('https');
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

const server = https.createServer({
        cert: fs.readFileSync('./cert.pem'),
        key: fs.readFileSync('./key.pem')
    },
    function (req, res) {
    if (!isFileAllowed(req.url)) {
        res.writeHead(404);
        res.end();
        return;
    }
    const content = fs.readFileSync('.' + req.url);
    res.writeHead(200, {'Content-Type': req.url.endsWith("html") ? 'text/html' : "text/javascript"});
    res.end(content);
}).listen(8443);

const wss = new WebSocket.Server({server});

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
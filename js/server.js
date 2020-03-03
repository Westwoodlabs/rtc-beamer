const video = document.getElementById("video");

let rtc;
let ws;
let currentPartner = null;

async function main() {
    ws = new WebSocket("ws://" + window.location.host);

    ws.onopen = _ => {
        console.log("WS connected");
    };

    ws.onerror = e => {
        console.log("WS connect failed: %s", e);
    };

    async function onOffer(msg) {
        currentPartner = msg.from;
        video.srcObject = new MediaStream();
        createRtc();
        const offer = msg.payload.offer;
        await rtc.setRemoteDescription(offer);
        const answer = await rtc.createAnswer();
        await rtc.setLocalDescription(answer);
        const res = JSON.stringify({
            to: msg.from,
            payload: {
                type: "answer",
                answer: answer
            }
        });
        console.log("Sending RTC response: %s", res);
        ws.send(res);
    }

    async function onIceCandidate(msg) {
        const candidate = msg.payload.ice_candidate;
        console.log("Got ICE candidate: %s", JSON.stringify(candidate));
        await rtc.addIceCandidate(candidate);
    }

    async function onDiscoverServer(msg) {
        ws.send(JSON.stringify({
            to: msg.from,
            payload: {
                type: "advertise_server"
            }
        }));
    }

    ws.onmessage = async message => {
        console.log("WS message: %s", message.data);
        const msg = JSON.parse(message.data);
        switch (msg.payload.type) {
            case "offer":
                await onOffer(msg);
                break;
            case "ice_candidate":
                await onIceCandidate(msg);
                break;
            case "discover_server":
                await onDiscoverServer(msg);
                break;
        }
    };

    function createRtc() {
        rtc = new RTCPeerConnection();
        rtc.onicecandidate = e => {
            console.log("ICE candidate: %s", JSON.stringify(e.candidate));
            if (currentPartner === null) {
                console.log("No current partner...");
                return;
            }
            if (e.candidate === null || e.candidate.candidate === "") {
                return;
            }
            ws.send(JSON.stringify({
                to: currentPartner,
                payload: {
                    type: "ice_candidate",
                    ice_candidate: e.candidate
                }
            }));
        };

        rtc.onicegatheringstatechange = async _ => {
            console.log("ICE gathering " + rtc.iceGatheringState);
        };

        rtc.oniceconnectionstatechange = e => {
            console.log("ICE state is now: %s", rtc.iceConnectionState);
            switch (rtc.iceConnectionState) {
                case "closed":
                case "disconnected":
                case "failed":
                    video.srcObject = new MediaStream();
                    rtc.close();
            }
        };

        rtc.ontrack = e => {
            console.log("Got track %s with %s streams", e.track, e.streams.length);
            video.srcObject.addTrack(e.track);
            video.play();
        };
    }
}


main();
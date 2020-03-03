const rtc = new RTCPeerConnection(null);
let ws;
let currentPartner = null;

async function main() {
    ws = new WebSocket("ws://127.0.0.1:8080");

    ws.onopen = _ => {
        console.log("WS connected");
        ws.send(JSON.stringify({
            to: "all",
            payload : {
                type: "discover_server"
            }
        }));
    };

    ws.onerror = e => {
        console.log("WS connect failed: %s", e);
    };

    async function onSdpAnswer(msg) {
        const answer = msg.payload.answer;
        await rtc.setRemoteDescription(answer);
    }

    async function onRemoteIceCandidate(msg) {
        const candidate = msg.payload.ice_candidate;
        console.log("Got ICE candidate: %s", JSON.stringify(candidate));
        await rtc.addIceCandidate(new RTCIceCandidate(candidate));
    }

    rtc.onnegotiationneeded = async _ => {
        console.log("#createOffer");
        let offer = await rtc.createOffer();
        console.log("#setLocalDescription");
        await rtc.setLocalDescription(offer);
        ws.send(JSON.stringify({
            to: currentPartner,
            payload: {type: "offer", offer: rtc.localDescription}
        }));
    };

    async function onAdvertiseServer(msg) {
        if (currentPartner === null) {
            currentPartner = msg.from;
            console.log("Chosen partner %s", currentPartner);
            await addLocalMedia();
        }
    }
    async function addLocalMedia() {
        console.log("#getDisplayMedia");
        const v_stream = await navigator.mediaDevices.getDisplayMedia({video: true});
        console.log("#getUserMedia");
        const a_stream = await navigator.mediaDevices.getUserMedia({audio: true});

        console.log("#getTracks");
        v_stream.getVideoTracks().forEach(track => {
            console.log("Adding track %s", track.id);
            rtc.addTrack(track);
        });
        a_stream.getAudioTracks().forEach(track => {
            console.log("Adding track %s", track.id);
            rtc.addTrack(track);
        });

        // document.getElementById("video").srcObject = v_stream
    }

    ws.onmessage = async message => {
        console.log("WS message: %s", message.data);
        const msg = JSON.parse(message.data);
        switch (msg.payload.type) {
            case "answer":
                await onSdpAnswer(msg);
                break;
            case "ice_candidate":
                await onRemoteIceCandidate(msg);
                break;
            case "advertise_server":
                await onAdvertiseServer(msg);
                break;
        }
    };

    rtc.onicecandidate = e => {
        console.log("ICE candidate: %s", JSON.stringify(e.candidate));
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
    };
}


// ============================================
// EL JASUS — VOICE CHAT (WebRTC)
// Peer-to-peer audio via Firebase signaling
// ============================================

class VoiceChat {
    constructor(db, roomCode, currentUid, currentUsername) {
        this.db       = db;
        this.roomCode = roomCode;
        this.uid      = currentUid;
        this.username = currentUsername;

        this.peers       = {};   // uid → RTCPeerConnection
        this.localStream = null;
        this.muted       = false;
        this.active      = false;
        this.speaking    = {};   // uid → bool

        this.config = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };

        this.buildUI();
        this.listenSignals();
    }

    // ── JOIN VOICE ────────────────────────────
    async join() {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl:  true
                },
                video: false
            });
            this.active = true;
            this.updateUI();
            this.setupVoiceDetection();

            // Announce presence to signal room
            this.signal('joined', { username: this.username });

            if (window.SND) SND.play('join');
            if (window.showToast) showToast('🎙️ انضممت للدردشة الصوتية');
        } catch (err) {
            console.error('Voice chat error:', err);
            if (err.name === 'NotAllowedError') {
                alert('يجب السماح بالوصول للميكروفون لاستخدام الدردشة الصوتية');
            } else {
                alert('خطأ في الدردشة الصوتية: ' + err.message);
            }
        }
    }

    // ── LEAVE VOICE ───────────────────────────
    leave() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(t => t.stop());
            this.localStream = null;
        }

        Object.values(this.peers).forEach(pc => pc.close());
        this.peers = {};
        this.active = false;
        this.updateUI();

        this.signal('left', {});
        if (window.showToast) showToast('🎙️ غادرت الدردشة الصوتية');
    }

    // ── MUTE / UNMUTE ─────────────────────────
    toggleMute() {
        if (!this.localStream) return;
        this.muted = !this.muted;
        this.localStream.getAudioTracks().forEach(t => (t.enabled = !this.muted));
        this.updateUI();
        if (window.SND) SND.play('click');
    }

    // ── SIGNALING VIA FIREBASE ─────────────────
    signal(type, data) {
        const { push, ref } = window._firebaseFns;
        push(ref(this.db, `rooms/${this.roomCode}/voiceSignals`), {
            from:      this.uid,
            fromName:  this.username,
            type,
            data,
            timestamp: Date.now()
        });
    }

    listenSignals() {
        const { ref, onChildAdded } = window._firebaseFns;
        const sigRef = ref(this.db, `rooms/${this.roomCode}/voiceSignals`);

        onChildAdded(sigRef, snap => {
            const msg = snap.val();
            if (!msg || msg.from === this.uid) return;
            if (msg.timestamp < Date.now() - 30000) return; // ignore old signals

            this.handleSignal(msg);
        });
    }

    async handleSignal(msg) {
        switch (msg.type) {
            case 'joined':
                if (this.active) {
                    // Create peer connection and offer
                    await this.createPeer(msg.from, true);
                }
                this.addVoiceUser(msg.from, msg.fromName);
                break;

            case 'offer':
                await this.handleOffer(msg.from, msg.fromName, msg.data);
                break;

            case 'answer':
                if (this.peers[msg.from]) {
                    await this.peers[msg.from].setRemoteDescription(
                        new RTCSessionDescription(msg.data)
                    );
                }
                break;

            case 'ice':
                if (this.peers[msg.from]) {
                    try {
                        await this.peers[msg.from].addIceCandidate(
                            new RTCIceCandidate(msg.data)
                        );
                    } catch(e) {}
                }
                break;

            case 'left':
                this.removePeer(msg.from);
                this.removeVoiceUser(msg.from);
                break;

            case 'speaking':
                this.setSpeaking(msg.from, msg.data.speaking);
                break;
        }
    }

    // ── PEER CONNECTION ───────────────────────
    async createPeer(remoteUid, initiator) {
        if (this.peers[remoteUid]) {
            this.peers[remoteUid].close();
        }

        const pc = new RTCPeerConnection(this.config);
        this.peers[remoteUid] = pc;

        // Add local tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(t => pc.addTrack(t, this.localStream));
        }

        // Handle remote audio
        pc.ontrack = (e) => {
            const audio = document.createElement('audio');
            audio.autoplay = true;
            audio.srcObject = e.streams[0];
            audio.id = `audio-${remoteUid}`;
            document.getElementById('voice-audio-container')?.appendChild(audio);
        };

        // ICE candidates
        pc.onicecandidate = (e) => {
            if (e.candidate) {
                this.signal('ice', e.candidate.toJSON());
            }
        };

        // Connection state
        pc.onconnectionstatechange = () => {
            const state = pc.connectionState;
            this.updatePeerStatus(remoteUid, state);
        };

        // Create offer if initiator
        if (initiator) {
            const offer = await pc.createOffer({ offerToReceiveAudio: true });
            await pc.setLocalDescription(offer);
            this.signal('offer', pc.localDescription.toJSON());
        }

        return pc;
    }

    async handleOffer(fromUid, fromName, offerData) {
        const pc = await this.createPeer(fromUid, false);
        await pc.setRemoteDescription(new RTCSessionDescription(offerData));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.signal('answer', pc.localDescription.toJSON());
        this.addVoiceUser(fromUid, fromName);
    }

    removePeer(uid) {
        if (this.peers[uid]) {
            this.peers[uid].close();
            delete this.peers[uid];
        }
        const audio = document.getElementById(`audio-${uid}`);
        if (audio) audio.remove();
    }

    // ── VOICE ACTIVITY DETECTION ──────────────
    setupVoiceDetection() {
        if (!this.localStream || !window.AudioContext) return;

        const audioCtx  = new AudioContext();
        const source    = audioCtx.createMediaStreamSource(this.localStream);
        const analyser  = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const data = new Uint8Array(analyser.frequencyBinCount);
        let lastState = false;

        const check = () => {
            if (!this.active) return;
            analyser.getByteFrequencyData(data);
            const avg = data.reduce((a, b) => a + b, 0) / data.length;
            const speaking = avg > 20;

            if (speaking !== lastState) {
                lastState = speaking;
                this.setSpeaking(this.uid, speaking);
                this.signal('speaking', { speaking });

                // Visual feedback on own avatar
                const myAvatar = document.getElementById(`voice-user-${this.uid}`);
                if (myAvatar) {
                    myAvatar.style.borderColor = speaking ? '#00ff00' : 'rgba(0,242,255,.3)';
                    myAvatar.style.boxShadow   = speaking ? '0 0 15px #00ff00' : 'none';
                }
            }
            requestAnimationFrame(check);
        };
        check();
    }

    setSpeaking(uid, speaking) {
        this.speaking[uid] = speaking;
        const el = document.getElementById(`voice-user-${uid}`);
        if (el) {
            el.style.borderColor = speaking ? '#00ff00' : 'rgba(0,242,255,.3)';
            el.style.boxShadow   = speaking ? '0 0 15px rgba(0,255,0,.6)' : 'none';
        }
    }

    updatePeerStatus(uid, state) {
        const dot = document.getElementById(`peer-dot-${uid}`);
        if (!dot) return;
        const colors = { connected:'#00ff00', connecting:'#ffd700', failed:'#ff4444', disconnected:'#666' };
        dot.style.background = colors[state] || '#666';
    }

    // ── VOICE USERS UI ────────────────────────
    addVoiceUser(uid, name) {
        const container = document.getElementById('voice-users');
        if (!container || document.getElementById(`voice-user-${uid}`)) return;

        const el = document.createElement('div');
        el.id = `voice-user-${uid}`;
        el.style.cssText = `
            display:flex;flex-direction:column;align-items:center;gap:4px;
            padding:8px;border-radius:12px;border:2px solid rgba(0,242,255,.3);
            background:rgba(0,242,255,.05);transition:all .3s;min-width:60px;`;
        el.innerHTML = `
            <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#00f2ff,#7c30ff);
                display:flex;align-items:center;justify-content:center;font-size:16px;position:relative;">
                <i class="fas fa-user" style="color:white;font-size:14px;"></i>
                <div id="peer-dot-${uid}" style="position:absolute;bottom:0;right:0;width:10px;height:10px;
                    border-radius:50%;background:#ffd700;border:2px solid #0a0e1a;"></div>
            </div>
            <span style="font-size:9px;color:#ccc;font-weight:700;max-width:56px;overflow:hidden;
                text-overflow:ellipsis;white-space:nowrap;">${name}</span>`;
        container.appendChild(el);
    }

    removeVoiceUser(uid) {
        document.getElementById(`voice-user-${uid}`)?.remove();
    }

    // ── UI PANEL ──────────────────────────────
    buildUI() {
        if (document.getElementById('voice-panel')) return;

        document.body.insertAdjacentHTML('beforeend', `
        <div id="voice-audio-container" style="display:none;"></div>

        <div id="voice-panel" style="
            position:fixed;bottom:80px;right:20px;z-index:8500;
            background:linear-gradient(135deg,rgba(10,14,26,.97),rgba(20,25,45,.97));
            border:2px solid rgba(0,242,255,.3);border-radius:20px;padding:16px;
            backdrop-filter:blur(20px);min-width:220px;display:none;
            box-shadow:0 8px 32px rgba(0,0,0,.5);font-family:'Cairo',sans-serif;">

            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
                <h4 style="color:#00f2ff;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:2px;margin:0;">
                    🎙️ الدردشة الصوتية
                </h4>
                <button onclick="document.getElementById('voice-panel').style.display='none'"
                    style="background:none;border:none;color:#666;cursor:pointer;font-size:16px;">✕</button>
            </div>

            <div id="voice-users" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;min-height:50px;
                align-items:center;justify-content:center;">
                <p style="color:#555;font-size:11px;text-align:center;width:100%;">لا أحد في الدردشة الصوتية</p>
            </div>

            <div style="display:flex;gap:8px;">
                <button id="vc-join-btn" onclick="window.VC?.join()" style="
                    flex:1;padding:10px;border-radius:12px;font-weight:900;font-size:12px;
                    background:linear-gradient(135deg,#00f2ff,#7c30ff);border:none;color:white;cursor:pointer;">
                    انضم
                </button>
                <button id="vc-mute-btn" onclick="window.VC?.toggleMute()" style="
                    width:42px;height:42px;border-radius:12px;border:2px solid rgba(0,242,255,.3);
                    background:rgba(0,242,255,.1);color:#00f2ff;cursor:pointer;font-size:16px;display:flex;
                    align-items:center;justify-content:center;">
                    <i class="fas fa-microphone"></i>
                </button>
                <button id="vc-leave-btn" onclick="window.VC?.leave()" style="
                    width:42px;height:42px;border-radius:12px;border:2px solid rgba(239,68,68,.3);
                    background:rgba(239,68,68,.1);color:#ef4444;cursor:pointer;font-size:16px;display:flex;
                    align-items:center;justify-content:center;">
                    <i class="fas fa-phone-slash"></i>
                </button>
            </div>
        </div>

        <button id="voice-fab" onclick="document.getElementById('voice-panel').style.display=
            document.getElementById('voice-panel').style.display==='block'?'none':'block'" style="
            position:fixed;bottom:80px;right:20px;z-index:8501;
            width:46px;height:46px;border-radius:50%;
            background:linear-gradient(135deg,rgba(0,242,255,.15),rgba(124,48,255,.15));
            border:2px solid rgba(0,242,255,.4);cursor:pointer;
            display:flex;align-items:center;justify-content:center;
            backdrop-filter:blur(12px);color:#00f2ff;font-size:18px;transition:all .3s;"
            title="الدردشة الصوتية">
            <i class="fas fa-microphone"></i>
        </button>`);
    }

    updateUI() {
        const joinBtn  = document.getElementById('vc-join-btn');
        const muteBtn  = document.getElementById('vc-mute-btn');
        const leavBtn  = document.getElementById('vc-leave-btn');
        const fab      = document.getElementById('voice-fab');

        if (!joinBtn) return;

        if (this.active) {
            joinBtn.style.display  = 'none';
            muteBtn.style.display  = 'flex';
            leavBtn.style.display  = 'flex';
            fab.style.borderColor  = '#00ff00';
            fab.style.boxShadow    = '0 0 15px rgba(0,255,0,.4)';
            muteBtn.innerHTML      = this.muted
                ? '<i class="fas fa-microphone-slash" style="color:#ef4444;"></i>'
                : '<i class="fas fa-microphone" style="color:#00f2ff;"></i>';
            // Add self to user list
            this.addVoiceUser(this.uid, this.username);
        } else {
            joinBtn.style.display  = 'block';
            muteBtn.style.display  = 'none';
            leavBtn.style.display  = 'none';
            fab.style.borderColor  = 'rgba(0,242,255,.4)';
            fab.style.boxShadow    = 'none';
            this.removeVoiceUser(this.uid);
        }
    }
}

// ── EXPORT ────────────────────────────────
window.VoiceChat = VoiceChat;

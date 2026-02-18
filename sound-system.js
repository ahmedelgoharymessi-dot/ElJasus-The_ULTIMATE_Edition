// ============================================
// EL JASUS - SOUND SYSTEM v2
// Music | Sound Effects | Voice Announcements
// ============================================

class SoundSystem {
    constructor() {
        this.ctx = null;
        this.musicGain = null;
        this.sfxGain   = null;
        this.musicNodes = [];
        this.musicLoopTimer = null;
        this.settings = {
            masterVol: 0.7, musicVol: 0.4, sfxVol: 0.8, voiceVol: 1.0,
            musicOn: true, sfxOn: true, voiceOn: true
        };
        this.loadSettings();
        this.buildUI();
    }

    start() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.musicGain = this.ctx.createGain();
        this.sfxGain   = this.ctx.createGain();
        this.musicGain.connect(this.ctx.destination);
        this.sfxGain.connect(this.ctx.destination);
        this.setMusicVol(this.settings.musicVol);
        this.setSfxVol(this.settings.sfxVol);
        if (this.settings.musicOn) this.startMusic();
    }

    // ── GENERATIVE BACKGROUND MUSIC (Exciting Calm Ambient) ───────────
    startMusic() {
        if (!this.ctx) return;
        this.stopMusic();
        this.settings.musicOn = true;
        
        // Multi-layered ambient soundscape
        this.playDrone();
        this.playPad();
        this.playSubBass();
        
        // Enhanced arpeggio with more melodic progression
        const notes = [
            220, 277, 330, 440,  // A3, C#4, E4, A4 (ascending)
            392, 330, 277, 220,  // G4, E4, C#4, A3 (descending)
            196, 247, 294, 330,  // G3, B3, D4, E4 (variation)
            277, 220, 196, 165   // C#4, A3, G3, E3 (resolution)
        ];
        
        let step = 0;
        const tick = () => {
            if (!this.settings.musicOn || !this.ctx) return;
            this.playArpNote(notes[step % notes.length]);
            step++;
            // Add shimmer every 4 notes
            if (step % 4 === 0) this.playShimmer();
            this.musicLoopTimer = setTimeout(tick, 450); // Slightly slower for calm feel
        };
        tick();
        
        // Start atmospheric layer after 3 seconds
        setTimeout(() => {
            if (this.settings.musicOn) this.playAtmosphere();
        }, 3000);
    }

    playDrone() {
        if (!this.ctx) return;
        // Deep bass drone with subtle vibrato
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        const lfo = this.ctx.createOscillator(); // Vibrato
        const lfoGain = this.ctx.createGain();
        
        osc1.type = 'sine'; osc1.frequency.value = 55;  // A1
        osc2.type = 'sine'; osc2.frequency.value = 82.5; // E2
        lfo.type = 'sine'; lfo.frequency.value = 0.3;
        lfoGain.gain.value = 1;
        
        filter.type = 'lowpass'; filter.frequency.value = 800;
        gain.gain.value = 0.1;
        
        lfo.connect(lfoGain);
        lfoGain.connect(osc1.frequency);
        
        osc1.connect(filter); osc2.connect(filter);
        filter.connect(gain); gain.connect(this.musicGain);
        
        osc1.start(); osc2.start(); lfo.start();
        this.musicNodes.push(osc1, osc2, lfo);
    }

    playPad() {
        if (!this.ctx) return;
        // Warm mid-range pad
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const panner = this.ctx.createStereoPanner();
        
        osc1.type = 'triangle'; osc1.frequency.value = 110; // A2
        osc2.type = 'triangle'; osc2.frequency.value = 165; // E3
        panner.pan.value = 0.3;
        gain.gain.value = 0.06;
        
        osc1.connect(gain); osc2.connect(gain);
        gain.connect(panner); panner.connect(this.musicGain);
        
        osc1.start(); osc2.start();
        this.musicNodes.push(osc1, osc2);
    }

    playSubBass() {
        if (!this.ctx) return;
        // Very low sub-bass for depth
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine'; osc.frequency.value = 27.5; // A0
        gain.gain.value = 0.08;
        osc.connect(gain); gain.connect(this.musicGain);
        osc.start();
        this.musicNodes.push(osc);
    }

    playAtmosphere() {
        if (!this.ctx || !this.settings.musicOn) return;
        // High atmospheric layer that fades in and out
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        const panner = this.ctx.createStereoPanner();
        
        osc.type = 'sine';
        osc.frequency.value = 440 + Math.random() * 220; // A4-C5 range
        filter.type = 'bandpass';
        filter.frequency.value = 800;
        filter.Q.value = 5;
        panner.pan.value = (Math.random() * 2 - 1) * 0.7; // Random stereo position
        
        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.02, this.ctx.currentTime + 4);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 12);
        
        osc.connect(filter); filter.connect(gain);
        gain.connect(panner); panner.connect(this.musicGain);
        
        osc.start(); osc.stop(this.ctx.currentTime + 12);
        
        // Schedule next atmospheric layer
        setTimeout(() => this.playAtmosphere(), 8000 + Math.random() * 6000);
    }

    playShimmer() {
        if (!this.ctx || !this.settings.musicOn) return;
        // Sparkle/shimmer high tones
        const freq = 880 * (1 + Math.random() * 2); // High harmonics
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        
        osc.type = 'sine'; osc.frequency.value = freq;
        filter.type = 'bandpass'; filter.frequency.value = freq; filter.Q.value = 15;
        
        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.015, this.ctx.currentTime + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 2);
        
        osc.connect(filter); filter.connect(gain); gain.connect(this.musicGain);
        osc.start(); osc.stop(this.ctx.currentTime + 2);
    }

    playArpNote(freq) {
        if (!this.ctx) return;
        const osc  = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        
        osc.type = 'triangle'; osc.frequency.value = freq;
        filter.type = 'lowpass'; filter.frequency.value = 2000; filter.Q.value = 1;
        
        // Smooth ADSR envelope
        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.04, this.ctx.currentTime + 0.05); // Attack
        gain.gain.linearRampToValueAtTime(0.03, this.ctx.currentTime + 0.15); // Decay
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.6); // Release
        
        osc.connect(filter); filter.connect(gain); gain.connect(this.musicGain);
        osc.start(); osc.stop(this.ctx.currentTime + 0.6);
    }

    stopMusic() {
        clearTimeout(this.musicLoopTimer);
        this.musicNodes.forEach(n => { try { n.stop(); } catch(e){} });
        this.musicNodes = [];
    }

    // ── SOUND EFFECTS ─────────────────────────
    sfx = {
        click:       { freqs:[800,600],          type:'sine',     dur:0.12 },
        hover:       { freqs:[900],              type:'sine',     dur:0.06 },
        join:        { freqs:[500,700,900],       type:'triangle', dur:0.5  },
        leave:       { freqs:[700,500,300],       type:'triangle', dur:0.4  },
        message:     { freqs:[1000],             type:'sine',     dur:0.1  },
        vote:        { freqs:[600,800],          type:'square',   dur:0.25 },
        voteEnd:     { freqs:[400,600,800,1000], type:'sine',     dur:0.8  },
        revealSpy:   { freqs:[200,150,100],      type:'sawtooth', dur:1.0  },
        revealGood:  { freqs:[500,700,1000],     type:'sine',     dur:0.8  },
        spyWin:      { freqs:[300,250,200],      type:'triangle', dur:1.2  },
        innocentWin: { freqs:[600,800,1000,1200],type:'sine',     dur:1.5  },
        achievement: { freqs:[700,900,1100,1400],type:'sine',     dur:1.2  },
        rankUp:      { freqs:[400,500,600,800,1000],type:'sine',  dur:1.5  },
        timerTick:   { freqs:[800],              type:'square',   dur:0.05 },
        timerWarn:   { freqs:[400],              type:'square',   dur:0.15 },
        coins:       { freqs:[1200,1400,1600],   type:'sine',     dur:0.5  },
        shop:        { freqs:[900,1100],         type:'sine',     dur:0.3  },
        error:       { freqs:[300,250],          type:'sawtooth', dur:0.3  },
        emoji:       { freqs:[1100],             type:'sine',     dur:0.08 },
        reaction:    { freqs:[900,1100],         type:'sine',     dur:0.2  }
    };

    play(name) {
        if (!this.settings.sfxOn || !this.ctx) return;
        const s = this.sfx[name]; if (!s) return;
        s.freqs.forEach((f, i) => {
            setTimeout(() => {
                const osc  = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = s.type; osc.frequency.value = f;
                const vol = this.settings.sfxVol * this.settings.masterVol * 0.4;
                gain.gain.setValueAtTime(vol, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + s.dur);
                osc.connect(gain); gain.connect(this.sfxGain);
                osc.start(); osc.stop(this.ctx.currentTime + s.dur);
            }, i * 110);
        });
    }

    // ── VOICE ANNOUNCEMENTS ───────────────────
    speak(text) {
        if (!this.settings.voiceOn || !window.speechSynthesis) return;
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang   = 'ar-SA';
        u.volume = this.settings.voiceVol * this.settings.masterVol;
        u.rate   = 0.95;
        u.pitch  = 1.1;
        speechSynthesis.speak(u);
    }

    announce = {
        gameStart:     () => { this.play('join');        this.speak('بدأت اللعبة');              },
        spyReveal:     () => { this.play('revealSpy');   this.speak('أنت الجاسوس');             },
        innocentReveal:() => { this.play('revealGood');  this.speak('أنت بريء');                },
        voting:        () => { this.play('vote');        this.speak('حان وقت التصويت');         },
        votingEnd:     () => { this.play('voteEnd');     this.speak('انتهى التصويت');           },
        spyWins:       () => { this.play('spyWin');      this.speak('الجاسوس انتصر');          },
        innocentsWin:  () => { this.play('innocentWin'); this.speak('الأبرياء انتصروا');       },
        achievement:   (n) => { this.play('achievement');this.speak('إنجاز جديد: ' + n);      },
        rankUp:        (r) => { this.play('rankUp');     this.speak('ترقية! أصبحت ' + r);     },
        playerJoin:    (n) => { this.play('join');       this.speak(n + ' انضم للعبة');        },
        playerLeave:   (n) => { this.play('leave');      this.speak(n + ' غادر اللعبة');      },
        timerWarning:  () => { this.play('timerWarn');   this.speak('عشر ثوان');               },
        coinsEarned:   (n) => { this.play('coins');      this.speak('ربحت ' + n + ' عملة');  },
        shopPurchase:  () => { this.play('shop');        this.speak('تم الشراء');              }
    };

    // ── VOLUME ────────────────────────────────
    setMasterVol(v) { this.settings.masterVol = v; this.setMusicVol(this.settings.musicVol); this.setSfxVol(this.settings.sfxVol); }
    setMusicVol(v)  { this.settings.musicVol = v; if (this.musicGain) this.musicGain.gain.value = v * this.settings.masterVol * 0.5; }
    setSfxVol(v)    { this.settings.sfxVol = v; }

    // ── PERSISTENCE ───────────────────────────
    loadSettings() {
        try { Object.assign(this.settings, JSON.parse(localStorage.getItem('eljasus_sound') || '{}')); } catch(e){}
    }
    saveSettings() { localStorage.setItem('eljasus_sound', JSON.stringify(this.settings)); }

    // ── FLOATING UI ───────────────────────────
    buildUI() {
        if (document.getElementById('snd-btn')) return;
        const div = document.createElement('div');
        div.innerHTML = `
<style>
#snd-btn{position:fixed;bottom:20px;left:20px;z-index:9990;width:46px;height:46px;border-radius:50%;
  background:linear-gradient(135deg,rgba(0,242,255,.15),rgba(124,48,255,.15));
  border:2px solid rgba(0,242,255,.4);cursor:pointer;display:flex;align-items:center;justify-content:center;
  backdrop-filter:blur(12px);transition:all .3s;font-size:18px;color:#00f2ff;}
#snd-btn:hover{transform:scale(1.12);box-shadow:0 0 20px rgba(0,242,255,.5);}
#snd-panel{position:fixed;bottom:76px;left:20px;z-index:9989;width:260px;
  background:linear-gradient(135deg,rgba(8,12,24,.97),rgba(20,25,45,.97));
  border:2px solid rgba(0,242,255,.3);border-radius:20px;padding:18px;
  backdrop-filter:blur(20px);box-shadow:0 8px 32px rgba(0,0,0,.6);display:none;
  font-family:'Cairo',sans-serif;color:#fff;}
#snd-panel h4{color:#00f2ff;font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:2px;margin:0 0 14px;}
.sr{margin-bottom:10px;}
.sr label{display:flex;justify-content:space-between;font-size:11px;color:#aaa;font-weight:700;margin-bottom:4px;}
.sr label span{color:#00f2ff;}
.ss{width:100%;-webkit-appearance:none;height:4px;border-radius:2px;background:rgba(0,242,255,.2);outline:none;cursor:pointer;}
.ss::-webkit-slider-thumb{-webkit-appearance:none;width:13px;height:13px;border-radius:50%;background:linear-gradient(135deg,#00f2ff,#7c30ff);cursor:pointer;box-shadow:0 0 6px rgba(0,242,255,.6);}
hr.sd{border:none;border-top:1px solid rgba(255,255,255,.07);margin:12px 0;}
.strow{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;}
.strow span{font-size:11px;color:#bbb;}
.sw{position:relative;width:36px;height:18px;flex-shrink:0;}
.sw input{opacity:0;width:0;height:0;}
.st{position:absolute;inset:0;border-radius:18px;background:rgba(255,255,255,.15);cursor:pointer;transition:.3s;}
.st::before{content:'';position:absolute;width:12px;height:12px;border-radius:50%;background:#fff;top:3px;left:3px;transition:.3s;}
.sw input:checked+.st{background:linear-gradient(90deg,#00f2ff,#7c30ff);}
.sw input:checked+.st::before{transform:translateX(18px);}
</style>
<button id="snd-btn" title="إعدادات الصوت"><i class="fas fa-volume-up"></i></button>
<div id="snd-panel">
  <h4>🎵 إعدادات الصوت</h4>
  <div class="sr"><label>الصوت العام <span id="sv-m">70%</span></label><input class="ss" id="sl-m" type="range" min="0" max="100" value="70"></div>
  <div class="sr"><label>الموسيقى <span id="sv-mu">40%</span></label><input class="ss" id="sl-mu" type="range" min="0" max="100" value="40"></div>
  <div class="sr"><label>المؤثرات <span id="sv-s">80%</span></label><input class="ss" id="sl-s" type="range" min="0" max="100" value="80"></div>
  <div class="sr"><label>الأصوات الإعلانية <span id="sv-v">100%</span></label><input class="ss" id="sl-v" type="range" min="0" max="100" value="100"></div>
  <hr class="sd">
  <div class="strow"><span>🎵 موسيقى الخلفية</span><label class="sw"><input type="checkbox" id="tog-mu" checked><span class="st"></span></label></div>
  <div class="strow"><span>🔊 المؤثرات</span><label class="sw"><input type="checkbox" id="tog-s" checked><span class="st"></span></label></div>
  <div class="strow"><span>🗣️ الإعلانات الصوتية</span><label class="sw"><input type="checkbox" id="tog-v" checked><span class="st"></span></label></div>
</div>`;
        document.body.appendChild(div);

        const btn   = document.getElementById('snd-btn');
        const panel = document.getElementById('snd-panel');

        btn.addEventListener('click', () => {
            this.start();
            panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
            this.play('click');
        });

        const sliders = {
            'sl-m':  (v) => { this.setMasterVol(v); document.getElementById('sv-m').textContent  = Math.round(v*100)+'%'; },
            'sl-mu': (v) => { this.setMusicVol(v);  document.getElementById('sv-mu').textContent = Math.round(v*100)+'%'; },
            'sl-s':  (v) => { this.setSfxVol(v);    document.getElementById('sv-s').textContent  = Math.round(v*100)+'%'; },
            'sl-v':  (v) => { this.settings.voiceVol = v; document.getElementById('sv-v').textContent = Math.round(v*100)+'%'; }
        };
        Object.keys(sliders).forEach(id => {
            document.getElementById(id).addEventListener('input', e => { sliders[id](e.target.value/100); this.saveSettings(); });
        });

        document.getElementById('tog-mu').addEventListener('change', e => {
            this.settings.musicOn = e.target.checked;
            this.start();
            e.target.checked ? this.startMusic() : this.stopMusic();
            this.saveSettings();
        });
        document.getElementById('tog-s').addEventListener('change', e => { this.settings.sfxOn   = e.target.checked; this.saveSettings(); });
        document.getElementById('tog-v').addEventListener('change', e => { this.settings.voiceOn = e.target.checked; this.saveSettings(); });

        document.addEventListener('click', () => this.start(), { once: true });
    }
}

window.SND = new SoundSystem();
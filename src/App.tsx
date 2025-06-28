import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import './App.css';

function App() {
  const [selectedInstrument, setSelectedInstrument] = useState('synth');
  const [volume, setVolume] = useState(0.5);
  const [tone, setTone] = useState(0.5);
  const [effects, setEffects] = useState(0.5);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingMode, setRecordingMode] = useState<'instrument' | 'voice'>('instrument');
  const [recordings, setRecordings] = useState<Array<{ url: string; isLooping: boolean }>>([]);

  // Initialize instruments
  const synth = new Tone.PolySynth(Tone.Synth).toDestination();
  const strings = new Tone.Sampler({
    urls: {
      "C4": "https://tonejs.github.io/audio/salamander/C4.mp3",
      "G4": "https://tonejs.github.io/audio/salamander/G4.mp3",
    },
    release: 1
  }).toDestination();
  const organ = new Tone.FMSynth({
    harmonicity: 2,
    modulationIndex: 3,
    oscillator: { type: "sine" },
    envelope: {
      attack: 0.01,
      decay: 0.2,
      sustain: 0.8,
      release: 0.1
    }
  }).toDestination();

  // Initialize drum kit
  const drumKit = {
    kick: new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 5,
      oscillator: { type: "sine" },
      envelope: {
        attack: 0.001,
        decay: 0.2,
        sustain: 0,
      }
    }).toDestination(),
    snare: new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: {
        attack: 0.001,
        decay: 0.2,
        sustain: 0
      }
    }).toDestination(),
    hihat: new Tone.MetalSynth({
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5,
      envelope: {
        attack: 0.001,
        decay: 0.1,
        release: 0.01
      }
    }).toDestination(),
    clap: new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: {
        attack: 0.001,
        decay: 0.2,
        sustain: 0
      }
    }).toDestination()
  };

  // Effects chain
  const filter = new Tone.Filter(1000, "lowpass").toDestination();
  const reverb = new Tone.Reverb(2).toDestination();
  const recorder = useRef(new Tone.Recorder());

  useEffect(() => {
    // Connect instruments to effects and recorder
    const instruments = [synth, strings, organ];
    instruments.forEach(inst => {
      inst.disconnect();
      inst.connect(filter);
      inst.connect(reverb);
      inst.connect(recorder.current);
    });

    // Connect drum kit to effects
    Object.values(drumKit).forEach(drum => {
      drum.disconnect();
      drum.connect(filter);
      drum.connect(reverb);
      drum.connect(recorder.current);
    });

    // Update parameters based on controls
    const vol = Tone.gainToDb(volume);
    [...instruments, ...Object.values(drumKit)].forEach(inst => {
      inst.volume.value = vol;
    });
    
    filter.frequency.value = tone * 10000 + 100;
    reverb.wet.value = effects;
  }, [volume, tone, effects]);

  const playNote = async (note: string) => {
    if (!isPlaying) {
      await Tone.start();
      setIsPlaying(true);
    }

    if (selectedInstrument === 'drums') {
      switch (note) {
        case 'C4':
          drumKit.kick.triggerAttackRelease('C1', '8n');
          break;
        case 'D4':
          drumKit.snare.triggerAttackRelease('8n', '+0.0');
          break;
        case 'E4':
          drumKit.hihat.triggerAttackRelease('32n', '+0.0');
          break;
        case 'F4':
          drumKit.clap.triggerAttackRelease('8n', '+0.0');
          break;
        case 'G4':
          drumKit.kick.triggerAttackRelease('C2', '8n');
          break;
        case 'A4':
          drumKit.snare.triggerAttackRelease('8n', '+0.0', 0.8);
          break;
        case 'B4':
          drumKit.hihat.triggerAttackRelease('16n', '+0.0', 0.5);
          break;
        case 'C5':
          drumKit.clap.triggerAttackRelease('8n', '+0.0', 0.6);
          break;
      }
    } else {
      const currentInstrument = {
        'synth': synth,
        'strings': strings,
        'organ': organ
      }[selectedInstrument];

      if (currentInstrument) {
        currentInstrument.triggerAttackRelease(note, "8n");
      }
    }
  };

  const startRecording = async () => {
    if (recordingMode === 'instrument') {
      await Tone.start();
      recorder.current.start();
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        const audioChunks: BlobPart[] = [];

        mediaRecorder.ondataavailable = (event) => {
          audioChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
          const url = URL.createObjectURL(audioBlob);
          setRecordings(prev => [...prev, { url, isLooping: false }]);
        };

        mediaRecorder.start();
        (window as any).mediaRecorder = mediaRecorder;
      } catch (error) {
        console.error('Error accessing microphone:', error);
        return;
      }
    }
    setIsRecording(true);
  };

  const stopRecording = async () => {
    if (recordingMode === 'instrument') {
      const recording = await recorder.current.stop();
      const url = URL.createObjectURL(recording);
      setRecordings(prev => [...prev, { url, isLooping: false }]);
    } else {
      const mediaRecorder = (window as any).mediaRecorder;
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
    }
    setIsRecording(false);
  };

  const toggleLoop = (index: number) => {
    setRecordings(prev => prev.map((rec, i) => {
      if (i === index) {
        return { ...rec, isLooping: !rec.isLooping };
      }
      return rec;
    }));
  };

  const deleteRecording = (index: number) => {
    setRecordings(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="te-container">
      <div className="te-controls">
        <div className="te-instruments">
          <button 
            className={selectedInstrument === 'synth' ? 'active' : ''} 
            onClick={() => setSelectedInstrument('synth')}
          >
            Synth
          </button>
          <button 
            className={selectedInstrument === 'strings' ? 'active' : ''} 
            onClick={() => setSelectedInstrument('strings')}
          >
            Strings
          </button>
          <button 
            className={selectedInstrument === 'organ' ? 'active' : ''} 
            onClick={() => setSelectedInstrument('organ')}
          >
            Organ
          </button>
          <button 
            className={selectedInstrument === 'drums' ? 'active' : ''} 
            onClick={() => setSelectedInstrument('drums')}
          >
            Drums
          </button>
        </div>

        <div className="te-record">
          <div className="te-record-mode">
            <button 
              className={recordingMode === 'instrument' ? 'active' : ''} 
              onClick={() => setRecordingMode('instrument')}
            >
              Record Instrument
            </button>
            <button 
              className={recordingMode === 'voice' ? 'active' : ''} 
              onClick={() => setRecordingMode('voice')}
            >
              Record Voice
            </button>
          </div>
          <button 
            className={isRecording ? 'active' : ''} 
            onClick={isRecording ? stopRecording : startRecording}
          >
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </button>
        </div>

        {recordings.length > 0 && (
          <div className="te-recordings">
            <h3>Recordings</h3>
            {recordings.map((recording, index) => (
              <div key={index} className="te-recording">
                <audio 
                  src={recording.url} 
                  controls 
                  loop={recording.isLooping}
                  className="te-audio-player"
                />
                <div className="te-recording-controls">
                  <button 
                    className={recording.isLooping ? 'active' : ''} 
                    onClick={() => toggleLoop(index)}
                  >
                    {recording.isLooping ? 'Stop Loop' : 'Loop'}
                  </button>
                  <button 
                    className="delete" 
                    onClick={() => deleteRecording(index)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="te-knobs">
          <div className="te-knob">
            <label>Volume</label>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01" 
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
            />
          </div>
          <div className="te-knob">
            <label>Tone</label>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01" 
              value={tone}
              onChange={(e) => setTone(parseFloat(e.target.value))}
            />
          </div>
          <div className="te-knob">
            <label>Effects</label>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01" 
              value={effects}
              onChange={(e) => setEffects(parseFloat(e.target.value))}
            />
          </div>
        </div>
      </div>
      <div className="te-keyboard">
        {selectedInstrument === 'drums' ? (
          <>
            {['Kick', 'Snare', 'HiHat', 'Clap', 'Kick 2', 'Snare 2', 'HiHat 2', 'Clap 2'].map((drum, index) => (
              <button 
                key={drum} 
                onClick={() => playNote(['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'][index])}
              >
                {drum}
              </button>
            ))}
          </>
        ) : (
          <>
            {['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'].map((note) => (
              <button key={note} onClick={() => playNote(note)}>
                {note}
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

export default App;

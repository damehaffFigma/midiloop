import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { WebMidi, Input } from 'webmidi';
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
  
  // MIDI state
  const [midiEnabled, setMidiEnabled] = useState(false);
  const [midiInputs, setMidiInputs] = useState<Input[]>([]);
  const [selectedInput, setSelectedInput] = useState<string>('');
  const [midiStatus, setMidiStatus] = useState<string>('Initializing MIDI...');

  // Initialize instruments
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: {
      type: "triangle"
    },
    envelope: {
      attack: 0.005,
      decay: 0.1,
      sustain: 0.3,
      release: 1
    }
  }).toDestination();

  // Enhanced strings with more samples
  const strings = new Tone.Sampler({
    urls: {
      "A0": "https://tonejs.github.io/audio/salamander/A0.mp3",
      "C1": "https://tonejs.github.io/audio/salamander/C1.mp3",
      "D#1": "https://tonejs.github.io/audio/salamander/Ds1.mp3",
      "F#1": "https://tonejs.github.io/audio/salamander/Fs1.mp3",
      "A1": "https://tonejs.github.io/audio/salamander/A1.mp3",
      "C2": "https://tonejs.github.io/audio/salamander/C2.mp3",
      "D#2": "https://tonejs.github.io/audio/salamander/Ds2.mp3",
      "F#2": "https://tonejs.github.io/audio/salamander/Fs2.mp3",
      "A2": "https://tonejs.github.io/audio/salamander/A2.mp3",
      "C3": "https://tonejs.github.io/audio/salamander/C3.mp3",
      "D#3": "https://tonejs.github.io/audio/salamander/Ds3.mp3",
      "F#3": "https://tonejs.github.io/audio/salamander/Fs3.mp3",
      "A3": "https://tonejs.github.io/audio/salamander/A3.mp3",
      "C4": "https://tonejs.github.io/audio/salamander/C4.mp3",
      "D#4": "https://tonejs.github.io/audio/salamander/Ds4.mp3",
      "F#4": "https://tonejs.github.io/audio/salamander/Fs4.mp3",
      "A4": "https://tonejs.github.io/audio/salamander/A4.mp3",
      "C5": "https://tonejs.github.io/audio/salamander/C5.mp3",
      "D#5": "https://tonejs.github.io/audio/salamander/Ds5.mp3",
      "F#5": "https://tonejs.github.io/audio/salamander/Fs5.mp3",
      "A5": "https://tonejs.github.io/audio/salamander/A5.mp3",
      "C6": "https://tonejs.github.io/audio/salamander/C6.mp3",
      "D#6": "https://tonejs.github.io/audio/salamander/Ds6.mp3",
      "F#6": "https://tonejs.github.io/audio/salamander/Fs6.mp3"
    },
    release: 1,
    attack: 0.1,
    volume: -8
  }).toDestination();

  // Enhanced organ sound
  const organ = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 2,
    modulationIndex: 1.5,
    oscillator: {
      type: "sine"
    },
    envelope: {
      attack: 0.01,
      decay: 0.2,
      sustain: 0.8,
      release: 0.1
    },
    modulation: {
      type: "square"
    },
    modulationEnvelope: {
      attack: 0.5,
      decay: 0,
      sustain: 1,
      release: 0.5
    }
  }).toDestination();

  // Initialize drum kit with better sounds
  const drumKit = {
    kick: new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 5,
      oscillator: { type: "sine" },
      envelope: {
        attack: 0.001,
        decay: 0.4,
        sustain: 0.01,
        release: 1.4
      }
    }).toDestination(),
    snare: new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: {
        attack: 0.001,
        decay: 0.2,
        sustain: 0,
        release: 0.2
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
        decay: 0.3,
        sustain: 0,
        release: 0.1
      }
    }).toDestination()
  };

  // Effects chain
  const filter = new Tone.Filter(1000, "lowpass").toDestination();
  const reverb = new Tone.Reverb(2).toDestination();
  const recorder = useRef(new Tone.Recorder());

  // Initialize WebMidi
  useEffect(() => {
    const initWebMidi = async () => {
      try {
        // Enable WebMidi
        await WebMidi.enable({ sysex: true });
        setMidiEnabled(true);
        setMidiStatus('MIDI enabled');
        
        // Update inputs list
        setMidiInputs(WebMidi.inputs);
        
        if (WebMidi.inputs.length < 1) {
          setMidiStatus('No MIDI devices detected.');
        } else {
          setMidiStatus(`Available MIDI devices: ${WebMidi.inputs.map(device => device.name).join(', ')}`);
          console.log('Available MIDI inputs:', WebMidi.inputs);
        }

        // Add connection listeners
        WebMidi.addListener("connected", e => {
          console.log("MIDI Device connected:", e);
          setMidiInputs(WebMidi.inputs);
          setMidiStatus(`MIDI device connected: ${e.port.name}`);
        });

        WebMidi.addListener("disconnected", e => {
          console.log("MIDI Device disconnected:", e);
          setMidiInputs(WebMidi.inputs);
          setMidiStatus(`MIDI device disconnected: ${e.port.name}`);
        });

      } catch (err) {
        console.error('WebMidi could not be enabled:', err);
        setMidiStatus(`MIDI Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    };

    initWebMidi();

    return () => {
      // Cleanup
      WebMidi.removeListener("connected");
      WebMidi.removeListener("disconnected");
      if (midiEnabled) {
        WebMidi.disable();
      }
    };
  }, []);

  // Handle MIDI input selection and note events
  useEffect(() => {
    if (!selectedInput || !midiEnabled) return;

    try {
      // Get the selected input device
      const input = WebMidi.getInputById(selectedInput);
      if (!input) {
        setMidiStatus('Selected MIDI device not found');
        return;
      }

      // Remove existing listeners from all inputs
      WebMidi.inputs.forEach(input => {
        input.removeListener();
      });

      // Add listeners to the selected input
      input.addListener("noteon", e => {
        console.log(`Note played: ${e.note.name}${e.note.octave}`);
        playNote(`${e.note.name}${e.note.octave}`);
      });

      input.addListener("noteoff", e => {
        // Optional: Handle note off events if needed
        console.log(`Note released: ${e.note.name}${e.note.octave}`);
      });

      setMidiStatus(`Connected to: ${input.name}`);

      return () => {
        // Cleanup listeners when input changes or component unmounts
        input.removeListener();
      };
    } catch (err) {
      console.error('Error setting up MIDI input:', err);
      setMidiStatus(`Error setting up MIDI input: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [selectedInput, midiEnabled]);

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
      // Map MIDI notes to drum sounds
      const drumMapping: { [key: string]: keyof typeof drumKit } = {
        'C2': 'kick',
        'D2': 'snare',
        'E2': 'hihat',
        'F2': 'clap',
        'G2': 'kick',  // Alternative kick
        'A2': 'snare', // Alternative snare
        'B2': 'hihat', // Alternative hihat
        'C3': 'clap'   // Alternative clap
      };

      const drumType = drumMapping[note];
      if (drumType) {
        drumKit[drumType].triggerAttackRelease('8n', Tone.now());
      }
    } else {
      const currentInstrument = {
        'synth': synth,
        'strings': strings,
        'organ': organ
      }[selectedInstrument];

      if (currentInstrument) {
        if (currentInstrument === strings) {
          currentInstrument.triggerAttackRelease(note, "2n");
        } else if (currentInstrument === organ) {
          currentInstrument.triggerAttackRelease(note, "4n");
        } else {
          currentInstrument.triggerAttackRelease(note, "8n");
        }
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
    <div className="app">
      {/* MIDI Status Display */}
      <div className="midi-status" style={{
        padding: '10px',
        margin: '10px',
        backgroundColor: midiEnabled ? '#e6ffe6' : '#ffe6e6',
        borderRadius: '5px',
        border: '1px solid ' + (midiEnabled ? '#99cc99' : '#cc9999'),
        fontFamily: 'monospace'
      }}>
        <div style={{ marginBottom: '8px' }}>{midiStatus}</div>
        {midiEnabled && midiInputs.length > 0 && (
          <select 
            value={selectedInput}
            onChange={(e) => setSelectedInput(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '4px',
              border: '1px solid #ccc'
            }}
          >
            <option value="">Select MIDI Input</option>
            {midiInputs.map(input => (
              <option key={input.id} value={input.id}>
                {input.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Instrument Selection */}
      <div className="controls">
        <div className="instrument-select">
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

        {/* Volume, Tone, and Effects controls */}
        <div className="knobs">
          <div className="knob">
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
          <div className="knob">
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
          <div className="knob">
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

        {/* Recording controls */}
        <div className="recording-controls">
          <select
            value={recordingMode}
            onChange={(e) => setRecordingMode(e.target.value as 'instrument' | 'voice')}
          >
            <option value="instrument">Record Instrument</option>
            <option value="voice">Record Voice</option>
          </select>
          <button onClick={isRecording ? stopRecording : startRecording}>
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </button>
        </div>
      </div>

      {/* Recordings */}
      <div className="recordings">
        {recordings.map((recording, index) => (
          <div key={index} className="recording">
            <audio src={recording.url} controls loop={recording.isLooping} />
            <button onClick={() => toggleLoop(index)}>
              {recording.isLooping ? 'Stop Loop' : 'Loop'}
            </button>
            <button onClick={() => deleteRecording(index)}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;

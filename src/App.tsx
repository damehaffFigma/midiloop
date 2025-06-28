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

  // Initialize instruments with distinct sounds
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: {
      type: "fatsawtooth",
      count: 3,
      spread: 40
    },
    envelope: {
      attack: 0.01,
      decay: 0.1,
      sustain: 0.3,
      release: 0.4
    }
  }).toDestination();

  // Strings using orchestral string samples
  const strings = new Tone.Sampler({
    urls: {
      "A3": "https://tonejs.github.io/audio/violin/A3.mp3",
      "A4": "https://tonejs.github.io/audio/violin/A4.mp3",
      "A5": "https://tonejs.github.io/audio/violin/A5.mp3",
      "A6": "https://tonejs.github.io/audio/violin/A6.mp3",
      "C4": "https://tonejs.github.io/audio/violin/C4.mp3",
      "C5": "https://tonejs.github.io/audio/violin/C5.mp3",
      "C6": "https://tonejs.github.io/audio/violin/C6.mp3",
      "E4": "https://tonejs.github.io/audio/violin/E4.mp3",
      "E5": "https://tonejs.github.io/audio/violin/E5.mp3",
      "E6": "https://tonejs.github.io/audio/violin/E6.mp3",
    },
    release: 1,
    attack: 0.2,
    volume: -8,
    onload: () => {
      console.log("String samples loaded");
    }
  }).chain(
    new Tone.Vibrato(5, 0.1),
    new Tone.Reverb({ decay: 5, wet: 0.6 }),
    Tone.Destination
  );

  // Church organ with multiple ranks
  const organ = new Tone.Sampler({
    urls: {
      "C2": "https://tonejs.github.io/audio/organ/C2.mp3",
      "C3": "https://tonejs.github.io/audio/organ/C3.mp3",
      "C4": "https://tonejs.github.io/audio/organ/C4.mp3",
      "C5": "https://tonejs.github.io/audio/organ/C5.mp3",
      "C6": "https://tonejs.github.io/audio/organ/C6.mp3",
    },
    release: 0.2,
    attack: 0.05,
    volume: -12,
    onload: () => {
      console.log("Organ samples loaded");
    }
  }).chain(
    new Tone.Chorus(4, 2.5, 0.5),
    new Tone.Reverb({ decay: 3, wet: 0.3 }),
    Tone.Destination
  );

  // TR-808 style drum kit
  const drumKit = {
    kick: new Tone.Player({
      url: "https://tonejs.github.io/audio/drum-samples/808/kick.mp3",
      volume: -2
    }).toDestination(),
    snare: new Tone.Player({
      url: "https://tonejs.github.io/audio/drum-samples/808/snare.mp3",
      volume: -4
    }).toDestination(),
    hihat: new Tone.Player({
      url: "https://tonejs.github.io/audio/drum-samples/808/hihat.mp3",
      volume: -8
    }).toDestination(),
    clap: new Tone.Player({
      url: "https://tonejs.github.io/audio/drum-samples/808/clap.mp3",
      volume: -6
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
        'G2': 'kick',
        'A2': 'snare',
        'B2': 'hihat',
        'C3': 'clap'
      };

      const drumType = drumMapping[note];
      if (drumType && drumKit[drumType].loaded) {
        drumKit[drumType].start();
      }
    } else {
      const currentInstrument = {
        'synth': synth,
        'strings': strings,
        'organ': organ
      }[selectedInstrument];

      if (currentInstrument) {
        switch (selectedInstrument) {
          case 'strings':
            currentInstrument.triggerAttackRelease(note, "2n", undefined, 0.7);
            break;
          case 'organ':
            currentInstrument.triggerAttackRelease(note, "4n", undefined, 0.9);
            break;
          default:
            currentInstrument.triggerAttackRelease(note, "8n", undefined, 0.8);
            break;
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

  // Haptic feedback function
  const triggerHapticFeedback = () => {
    if (navigator.vibrate) {
      navigator.vibrate(50); // 50ms vibration
    }
  };

  // Handle instrument selection with haptic feedback
  const handleInstrumentChange = (instrument: string) => {
    setSelectedInstrument(instrument);
    triggerHapticFeedback();
    
    // Visual feedback animation
    const button = document.querySelector(`button[data-instrument="${instrument}"]`);
    if (button) {
      button.classList.add('instrument-change-flash');
      setTimeout(() => button.classList.remove('instrument-change-flash'), 200);
    }
  };

  return (
    <div className="te-container">
      <div className="te-controls">
        <div className="te-instruments">
          <button 
            data-instrument="synth"
            className={selectedInstrument === 'synth' ? 'active' : ''} 
            onClick={() => handleInstrumentChange('synth')}
          >
            Synth
          </button>
          <button 
            data-instrument="strings"
            className={selectedInstrument === 'strings' ? 'active' : ''} 
            onClick={() => handleInstrumentChange('strings')}
          >
            Strings
          </button>
          <button 
            data-instrument="organ"
            className={selectedInstrument === 'organ' ? 'active' : ''} 
            onClick={() => handleInstrumentChange('organ')}
          >
            Organ
          </button>
          <button 
            data-instrument="drums"
            className={selectedInstrument === 'drums' ? 'active' : ''} 
            onClick={() => handleInstrumentChange('drums')}
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

      {/* Add MIDI status and device selector at the top */}
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
    </div>
  );
}

export default App;

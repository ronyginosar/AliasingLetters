let backgroundcolor = 220;
let canvas;

// ===== audio plumbing =====
// let srcMode = "off";   // "off" | "mic" | "file"
let mic, fft, amp, audiofile;
// future: put this in a soundController
var audio;
let micEnabled = false;
// end section

let PRMODE = false; // for debug
let INTERNALAUDIOMODE = false; // for debug
// future make mic and internal mutex
let DEBUG = false; // for debug

let btnMic, btnExport, btnInternalAudio;

// TIME SCALES FOR PARAM CHANGES
let FIVE_SECONDS = 60*5;
let TEN_SECONDS = 60*10;
let TWO_MINUTES = 60*2*60; // 2 minutes


// Transition controller
let TRANSITION = {
  startAtSec: 180,   // <-- when to begin (use your TIME globals)
  durationSec: 8,    // <-- speed of change (shorter = faster)
  t: 0               // 0..1 mix, computed each frame
};

// helper for easing (optional)
function smoothstep01(x){ x = constrain(x,0,1); return x*x*(3-2*x); }





function preload(){
    audiofile = loadSound('/assets/lines_simulation.mp4');
    img = loadImage('assets/T-S_K5_73_R_manual_2.png'); // for zigzag shape
}


function setup() {
  if (PRMODE) {
    pixelDensity(10);
  }

  canvas = createCanvas(windowWidth, windowHeight-40); // 40 for buttons
  reset();
    
  // ui
  btnMic = createButton("Mic ON/OFF");
  btnExport = createButton("Export");
  btnInternalAudio = createButton("Internal Audio");

  btnExport.mousePressed(() => {saveCanvas('aliasing.png');});

  // toggle inputs
  btnMic.mousePressed(toggleMic);
  btnInternalAudio.mousePressed(toggleInternalAudio);

  audio = new p5.AudioIn(); // init as mic, later we can switch to audiofile
  fft = new p5.FFT();
  amp = new p5.Amplitude();


  // test
  
  
  // OPTION A: from an image you've already loaded as `img`
  // TODO QUICK FIX - this stops image bug- > why??
  let zz = createZigzagShape({
    mode: 'image',
    image: img,
    numSegments: 60,
    baseHeight: 120,
    audioFactor: 0.15,  // subtle audio modulation
    audioAmp: 40,
    strokeWeight: 1,
    opacity: 220
  });

  wl = createImageWaveLines({
    image: img,             // your p5.Image
    targetWidth: windowWidth,
    rows: 20,
    res: 900,
    baseHeight: 30,
    audioFactor: 1,      // subtle
    audioAmp: 350,
    ema: 0.08,
    strokeWeight: 3,
    strokeColor: color(0),  // black lines
    opacity: 255,
    sampleSkip: 1,
    debug: false
  });



  // OPTION B: from text
  // zz = createZigzagShape({
  //   mode: 'text',
  //   text: 'GERBILS',
  //   font: myLoadedFont,   // optional
  //   textSize: 160,
  //   numSegments: 60,
  //   baseHeight: 110,
  //   audioFactor: 0.18,
  //   audioAmp: 35,
  //   strokeWeight: 1,
  //   opacity: 220
  // });
}

function draw() {

  frameRate(10);

  // future: return to this
  // if (soundController) {
  //   soundController.update(); 
  //   soundController.drawVisualizer(soundVisualizerCanvas); // draw new visual
  //   image(soundVisualizerCanvas, 0, 0); // draw ON TOP of main canvas
  // }

  if ((micEnabled || INTERNALAUDIOMODE) && !PRMODE) {

    // use your own TIME; here I derive from millis for clarity
const elapsedSec = millis()/1000;

// compute mix 0..1
if (elapsedSec >= TRANSITION.startAtSec) {
  const u = (elapsedSec - TRANSITION.startAtSec) / TRANSITION.durationSec;
  TRANSITION.t = smoothstep01(u);   // ease-in/out; use u for linear
} else {
  TRANSITION.t = 0;
}


    // AMPLITUDE
    // p5.Amplitude object keeps track of the volume of a sound, and we can get this number, that ranges between 0 and 1, using the getLevel() function
    // var audio.getLevel();
    // console.log("Mic level: " + ampLevel.toPrecision(2));
    // console.log("AMP : " + amp.getLevel()); // same as direct mic

    // we "init" twice this ampLevel, it seems they are different objects and need to run one over the other
    // if (INTERNALAUDIOMODE) {
      // var ampLevel = amp.getLevel(); // get the level of the audio file
    // } else {
      // var ampLevel = audio.getLevel(); // get the level of the mic input
    // }


    //FFT (Fast Fourier Transform) is an analysis algorithm that isolates individual audio frequencies within a waveform. The p5.FFT object can return two types of data in arrays via two different functions: waveform() and analyze()
    // waveform(): Returns an array of amplitude values (between -1.0 and 1.0) along the time domain (a sample of time)
    // analyze(): Returns an array of amplitude values (between 0 and 255) across the frequency spectrum.
    var waveform = fft.waveform(); 
    // console.log("Waveform: " + waveform);
    // console.log("Waveform: " + waveform.length);
    // var spectrum = fft.analyze();
    fft.analyze();


    if (DEBUG) {
    // let bass = fft.getEnergy(20, 250);       // low
    // let mids = fft.getEnergy(250, 2000);     // voice
    // let highs = fft.getEnergy(2000, 10000);  // sibilance / noise
    // console.log(`Bass: ${bass}  Mids: ${mids}  Highs: ${highs}`);
    // let energy = fft.getEnergy(peakDetect.f1, peakDetect.f2);
    // console.log('Current FFT energy:', energy);
    }

    // TODO draw sketch
    reset(); // clean canvas

  

  // visual
  let transparency = 180;

  const mix = TRANSITION.t;                 // 0..1
const alphaOld = (1 - mix) * transparency;

  let strokeWeight_ = 5;
  strokeWeight(strokeWeight_);
  let colors = ["red", "green", "blue"];

  // CMYK as RGBA you provided
// const colors = [
//   // cyan    = rgba(0, 252, 251, 255)
//   () => color(0, 252, 251, 255),
//   // magenta = rgba(253, 0, 251, 255)
//   () => color(253, 0, 251, 255),
//   // yellow  = rgba(253, 253, 0, 255)
//   () => color(253, 253, 0, 255),
//   // key     = rgba(0, 0, 0, 255)
//   () => color(0, 0, 0, 255)
// ];

  let color_line_spacing = strokeWeight_;
  // let horizontal_spacing = 3;
  let zigzag_spacing = 8; // y+= 2 to 8 works good
  // let transparency = 180; // 0-255
  transparency = alphaOld; // 0-255
  // let BLACK = backgroundcolor;
  let BLACK = 20;
  let zigzag_bleed = 0;
  let xAmp = 150;     // amplitude of zigzag
  let smoothN = 10; // higher = smoother, slower
  let avg = 0;

  let y_start = height/3;
  let y_end = 2*height/3;


  



// // TEMP

  // straight colored lines
    strokeWeight(strokeWeight_);
    for (let i = y_start; i < y_end; i+=color_line_spacing) {
      // cycle through colors
        let c = colors[(i / color_line_spacing) % colors.length]; // RGB 
        // let c = colors[(i / horizontal_spacing) % colors.length](); // CMYK
        stroke(c);
        line(0, i, width, i);
    }
 // note we cant use the same loop due to the internal draw loop that draws over the "next" line


//  // audio-driven zigzag lines
//   strokeWeight(strokeWeight_/2);
//   stroke(BLACK, transparency); // semi-transparent black
//   noFill();
//   for (let y = y_start-zigzag_bleed; y < y_end+zigzag_bleed; y += zigzag_spacing) {
//     beginShape();
//     for (let i = 0; i < waveform.length; i += strokeWeight_) { 

//       // avg worked nicer than smoothing
//       for (let k = 0; k < smoothN; k++) {
//         if (i + k < waveform.length) avg += waveform[i + k];
//       }
//       avg /= smoothN;
  
//       let yOffset = avg * xAmp;
//       let x = map(i, 0, waveform.length, 0, width);

//       vertex(x, y + yOffset);
//     }
//     endShape();
//   }

//   // END TEMP

// when you want to start drawing the zigzag shape (TIME gate handled by you):
  // if (TIME > someThreshold) {
  // image(img, 0, 0);
    stroke(BLACK); // semi-transparent black
    strokeWeight(1);
  // console.log(zz);
  //   const dt = deltaTime / 1000;
  //   const wf = fft.waveform();    // you already compute this
  //   zz.update(dt, wf);

  //   // center-ish placement, scaled 2x (tweak to taste)
  //   const sx = 2.0;
  //   const dx = width/2 - (zz.width() * sx)/2;
  //   const dy = height/2 - (zz.height() * sx)/2 - 100;
  //   // zz.draw_(dx, dy, sx);

  //   zz.draw_(20, 20, 1);

  const dt = deltaTime / 1000;
  const wf = fft.waveform();     // you already compute this
  wl.update(dt, wf);

  // draw it at top-left of the scaled image; it already matches window width
  // wl.draw(0, (height - wl.height())/2); // vertical centering example
  wl.draw(0, (height - wl.height())/2); // vertical centering example

  // }

}

}

function doubleClicked() {
  if (PRMODE) {
    canvas.background(backgroundcolor);
    // TODO draw PR
    noLoop();
  }
  else {
    console.log("Double clicked, not in PRMODE");
  }
}

function reset() {
  canvas.background(backgroundcolor);
}

function toggleMic() {
  console.log("Toggling mic");
    // toggle mic on/off 
    if (micEnabled) {
        console.log("Mic OFF");
        audio.stop();
        fft.setInput();  // reset to default, can't reset amp  
    }
    else {
      console.log("Mic ON");
      audio.start(() => {
        fft.setInput(audio);
        amp.setInput(audio);
      });

    }
      micEnabled = !micEnabled;
}

function toggleInternalAudio() {
  // TODO FIX THE AMP UPON SWITCH after INTERNAL
  console.log("Toggling internal audio mode");
  try { getAudioContext().resume(); } catch(e) {}
    if (!INTERNALAUDIOMODE) {
      if (micEnabled) { audio.stop(); micEnabled = false; } // <-- simple mutex
        if (!audiofile) { console.warn("No audiofile loaded"); return; }
        audiofile.play();
        fft.setInput(audiofile); //  set the input source for the FFT object to the mic
        amp.setInput(audiofile);
    } else {
      audiofile.pause(); // to continue from where we left off 
      // future make this a toggle between pause and audiofile.stop();
      fft.setInput();   // reset to default, can't reset amp 
    }
  INTERNALAUDIOMODE = !INTERNALAUDIOMODE;
}




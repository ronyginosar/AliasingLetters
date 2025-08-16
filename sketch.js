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


let phase = 0;     // shifting angle for animation
let phaseSpeed = 0.05; // how fast the wave moves


function preload(){
  // TODO
    // audiofile = loadSound('/assets/Alto_score_simulation-for-rony_5th-movement.wav');
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
}

function draw() {

  // future: return to this
  // if (soundController) {
  //   soundController.update(); 
  //   soundController.drawVisualizer(soundVisualizerCanvas); // draw new visual
  //   image(soundVisualizerCanvas, 0, 0); // draw ON TOP of main canvas
  // }

  if ((micEnabled || INTERNALAUDIOMODE) && !PRMODE) {

    // AMPLITUDE
    // p5.Amplitude object keeps track of the volume of a sound, and we can get this number, that ranges between 0 and 1, using the getLevel() function
    // var audio.getLevel();
    // console.log("Mic level: " + ampLevel.toPrecision(2));
    // console.log("AMP : " + amp.getLevel()); // same as direct mic

    // we "init" twice this ampLevel, it seems they are different objects and need to run one over the other
    // if (INTERNALAUDIOMODE) {
      var ampLevel = amp.getLevel(); // get the level of the audio file
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



    
  }

  // test
  stroke("black");
  strokeWeight(1);
  let colors = ["red", "green", "blue"]; // or try CMYK!
    let spacing = 1;



    for (let i = 0; i < height/2; i+=spacing) {
        // line(i, 0, i, height);
            let c = colors[(i / spacing) % colors.length]; // cycle through colors
        stroke(c);
        line(0, i, width, i);
        // // maybe zigzag is sound wave?
        // var waveform = fft.waveform();
        // for (var i = 0; i < waveform.length; i++) {
        //     var x = map(i, 0, waveform.length, 0, width);
        //     var y = map(waveform[i], -1, 1, height, 0);
            // ellipse(x, y, 5, 5);
            // ellipse(i, i, 5, 5);
        // }

        // if (i % 5 == 0) { // space out zigz
        // // zigzag brut force
        // let yAmp = 9;
        // let  y = -yAmp;
        // noFill();
        // stroke("black");
        // push();
        //   // translate(0, frameRate());
        //   // TODO move zigzag
        //   beginShape();
        //   for (let j = 0; j < 100; j++) {
        //     vertex(j*10, y+i);
        //     if(y == -yAmp) {
        //       y = yAmp;
        //     } else {
        //       y = -yAmp;
        //     }
        //   }
        //   endShape();
        // pop();
        // }


    }

    // for (let i = 0; i < height/2; i+=5) { // space out zigz
    //     // zigzag brut force
    //     let yAmp = 9;
    //     let  y = -yAmp;
    //     noFill();
    //     stroke("black");
    //     // push();
    //       // translate(0, frameRate());
    //       // TODO move zigzag
    //       beginShape();
    //       for (let j = 0; j < 100; j++) {
    //         vertex(j*10, y+i);
    //         if(y == -yAmp) {
    //           y = yAmp;
    //         } else {
    //           y = -yAmp;
    //         }
    //       }
    //       endShape();
    //     // pop();
    //   }


let xAmp = 10;     // amplitude of zigzag
  let xFreq = 0.05;  // frequency of zigzag
  // y+= 2 to 8 works good
  for (let y = 0; y < height/2; y += 8) {
    stroke(0, 180); // semi-transparent black
    beginShape();
    noFill();
    for (let x = 0; x < width; x += 5) {
      let yOffset = sin(x * xFreq ) * xAmp;
      vertex(x, y + yOffset);
    }
    endShape();
  }

  // update phase each frame
  // phase += phaseSpeed;

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




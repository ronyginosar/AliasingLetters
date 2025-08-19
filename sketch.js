let backgroundcolor = 220;
let canvas;

// ===== audio plumbing =====
// let srcMode = "off";   // "off" | "mic" | "file"
let mic, fft, amp, audiofile;
// future: put this in a soundController
var audio;
let micEnabled = false;
let INTERNALAUDIOMODE = false; // for debug
// future make mic and internal mutex
let btnMic, btnExport, btnInternalAudio;

let DEBUG = false; // for debug
let PRMODE = false; // for debug

// TIME SCALES FOR PARAM CHANGES
let FIVE_SECONDS = 60 * 5;
let TEN_SECONDS = 60 * 10;
let TWO_MINUTES = 60 * 2 * 60; // 2 minutes

let USE_IMAGE_SHAPING = true; // flip true/false whenever you want
// ===== IMAGE SHAPING STATE =====
let shapeImg; // p5.Image (grayscale or any)
let shapeProfile = null; // 2D Float32Array [rows][samples]
let shapeRows, shapeSamples;
// tuneables
let imgContrast = 1.0; // optional contrast on brightness (see Q2)
let imgGamma = 1.0; // optional gamma on brightness (see Q2)
let imgAmp = 10; // how much the image bends the lines (px)
// imgAmp → how many pixels the image can bend a line up/down. Bigger imgAmp = taller hills/valleys.
let imgPolarity = +1; // +1: white rises, -1: black rises

// ===== line params =====
let transparency = 180;
let strokeWeight_ = 5;
let color_line_spacing = strokeWeight_;
let zigzag_spacing = 8; // y+= 2 to 8 works good
let BLACK = 20; // backgroundcolor?
let zigzag_bleed = 0;
let xAmp = 150; // amplitude of zigzag
let smoothN = 10; // higher = smoother, slower
let avg = 0;
let y_start;
let y_end;
let colors = ["red", "green", "blue"];
// or CMYK as RGBA
// const colors = [
//   () => color(0, 252, 251, 255),  // C
//   () => color(253, 0, 251, 255),  // M
//   () => color(253, 253, 0, 255),  // Y
//   () => color(0, 0, 0, 255)       // K
// ];

function preload() {
  audiofile = loadSound("/assets/lines_simulation.mp4");
  shapeImg = loadImage("assets/T-S_K5_73_R_manual.png"); // for zigzag shape
}

function setup() {
  if (PRMODE) {
    pixelDensity(10);
  }

  canvas = createCanvas(windowWidth, windowHeight - 40); // 40 for buttons
  reset();

  y_start = height / 3;
  y_end = (2 * height) / 3;
  console.log("SETUP; y_start: " + y_start + ", y_end: " + y_end);

  shapeImg.filter(BLUR, 4); // future: more filters?

  buildShapeProfile({
    yStart: y_start,
    yEnd: y_end,
    zigzagSpacing: zigzag_spacing,
    sampleStepPx: strokeWeight_,
    shapeYOffsetPx: 40, // move image lower inside the band
    fitMode: "fitWidth", // or "cover"/"stretch"
  });
  // note: (If change spacing/window size later, call buildShapeProfile(...) again.)

  // ui
  btnMic = createButton("Mic ON/OFF");
  btnExport = createButton("Export");
  btnInternalAudio = createButton("Internal Audio");

  btnExport.mousePressed(() => {
    saveCanvas("aliasing.png");
  });

  // toggle inputs
  btnMic.mousePressed(toggleMic);
  btnInternalAudio.mousePressed(toggleInternalAudio);

  audio = new p5.AudioIn(); // init as mic, later we can switch to audiofile
  fft = new p5.FFT();
  amp = new p5.Amplitude();
}

function draw() {
  frameRate(10);

  if ((micEnabled || INTERNALAUDIOMODE) && !PRMODE) {
    var waveform = fft.waveform();
    fft.analyze();

    if (DEBUG) {
      // let bass = fft.getEnergy(20, 250);       // low
      // let mids = fft.getEnergy(250, 2000);     // voice
      // let highs = fft.getEnergy(2000, 10000);  // sibilance / noise
      // console.log(`Bass: ${bass}  Mids: ${mids}  Highs: ${highs}`);
      // let energy = fft.getEnergy(peakDetect.f1, peakDetect.f2);
      // console.log('Current FFT energy:', energy);
    }

    reset(); // clean canvas

    // straight colored lines as base
    strokeWeight(strokeWeight_);
    for (let i = y_start; i < y_end; i += color_line_spacing) {
      // cycle through colors
      let c = colors[int(i / color_line_spacing) % colors.length]; // RGB
      // let c = colors[(i / horizontal_spacing) % colors.length](); // CMYK
      stroke(c);
      line(0, i, width, i);
    }
    // note we cant use the same loop due to the internal draw loop that draws over the "next" line

    // audio-driven zigzag lines
    strokeWeight(strokeWeight_ / 2);
    stroke(BLACK, transparency); // semi-transparent black
    noFill();

    const sampleStepPx = strokeWeight_; // same as your i-step
    const rowsCount = Math.floor((y_end - y_start) / zigzag_spacing);

    for (let r = 0; r < rowsCount; r++) {
      const y = y_start - zigzag_bleed + r * zigzag_spacing;
      beginShape();

      for (let i = 0; i < waveform.length; i += strokeWeight_) {
        // --- audio smoothing (reset avg per i) ---
        let avg = 0;
        for (let k = 0; k < smoothN; k++) {
          if (i + k < waveform.length) avg += waveform[i + k];
        }
        avg /= smoothN;

        const x = map(i, 0, waveform.length - 1, 0, width);

        // --- audio contribution (same as before) ---
        let yOffset = avg * xAmp;

        // --- optional image shaping (toggle) ---
        if (USE_IMAGE_SHAPING && shapeProfile) {
          // future: transition
          // yOffset += (shapeProfile ? imgNorm * imgAmp * mix : 0); // mix in [0..1], mix over time

          const r = Math.floor((y - y_start + zigzag_bleed) / zigzag_spacing);
          const s = Math.min(Math.floor(x / sampleStepPx), shapeSamples - 1);
          const imgNorm = shapeProfile[r]?.[s] ?? 0; // [-1..1]
          yOffset += imgNorm * imgAmp; // apply image bend
        }

        vertex(x, y + yOffset);
      }

      endShape();
    }
  }
}

// ################## helpers ##################

function buildShapeProfile({
  yStart,
  yEnd,
  zigzagSpacing,
  sampleStepPx = 5,
  // NEW:
  shapeYOffsetPx = 0, // shift the image *down* inside the band
  fitMode = "fitWidth", // "fitWidth" | "cover" | "stretch"
}) {
  if (!shapeImg) return;

  // 1) make a safe working copy; always match canvas width
  let src = shapeImg.get();
  const bandH = max(1, Math.floor(yEnd - yStart));

  if (fitMode === "stretch") {
    // stretch to band exactly (both W & H)
    src.resize(width, bandH);
  } else {
    // fit by width; keep aspect
    src.resize(width, 0);
    if (fitMode === "cover" && src.height < bandH) {
      // upscale until we fully cover band height
      src.resize(0, bandH);
    }
  }
  src.loadPixels();

  // 2) compute the usable vertical window inside the band
  //    we will only sample from a window <= bandH, starting at shapeYOffsetPx
  const usableH = min(src.height, bandH);
  const y0 = constrain(Math.floor(shapeYOffsetPx), 0, bandH - usableH); // anchor inside band

  // 3) allocate profile grid
  shapeRows = Math.floor(bandH / zigzagSpacing);
  shapeSamples = Math.floor(width / sampleStepPx) + 1;
  shapeProfile = Array.from(
    { length: shapeRows },
    () => new Float32Array(shapeSamples)
  );

  // 4) fill brightness profile, aligned to yStart and clipped to band
  for (let r = 0; r < shapeRows; r++) {
    const bandRowY = r * zigzagSpacing; // 0..bandH
    // map this band-row to image-row within [y0, y0+usableH)
    const imgY = Math.floor(map(bandRowY, 0, bandH - 1, y0, y0 + usableH - 1));
    const iy = constrain(imgY, 0, src.height - 1);

    for (let s = 0; s < shapeSamples; s++) {
      const ix = constrain(s * sampleStepPx, 0, src.width - 1);
      const c = src.get(ix, iy); // [r,g,b,a]
      let bright = (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255.0; // 0..1

      // optional contrast/gamma shaping:
      bright = pow(bright, imgGamma); // gamma
      let centered = (bright - 0.5) * 2.0; // -> [-1..1]
      centered *= imgContrast; // amplify/attenuate
      centered = constrain(centered, -1, 1);

      shapeProfile[r][s] = imgPolarity * centered; // store normalized [-1..1]
    }
  }
}

// ################## boilerplate helpers ##################

function doubleClicked() {
  if (PRMODE) {
    canvas.background(backgroundcolor);
    // TODO draw PR
    noLoop();
  } else {
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
    fft.setInput(); // reset to default, can't reset amp
  } else {
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
  try {
    getAudioContext().resume();
  } catch (e) {}
  if (!INTERNALAUDIOMODE) {
    if (micEnabled) {
      audio.stop();
      micEnabled = false;
    } // <-- simple mutex
    if (!audiofile) {
      console.warn("No audiofile loaded");
      return;
    }
    audiofile.play();
    fft.setInput(audiofile); //  set the input source for the FFT object to the mic
    amp.setInput(audiofile);
  } else {
    audiofile.pause(); // to continue from where we left off
    // future make this a toggle between pause and audiofile.stop();
    fft.setInput(); // reset to default, can't reset amp
  }
  INTERNALAUDIOMODE = !INTERNALAUDIOMODE;
}

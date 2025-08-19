let backgroundcolor = 0;
let canvas;

// ===== audio plumbing =====
// let srcMode = "off";   // "off" | "mic" | "file"
let mic, fft, amp, audiofile;
// future: put this in a soundController
var audio;
let micEnabled = false;
let INTERNALAUDIOMODE = false; // for debug
// future make mic and internal mutex
let btnMic, btnExport, btnInternalAudio
let btnImageMode, btnTerrainMode;

let DEBUG = false; // for debug
let PRMODE = false; // for debug

// TIME SCALES FOR PARAM CHANGES
let FIVE_SECONDS = 60 * 5;
let TEN_SECONDS = 60 * 10;
let TWO_MINUTES = 60 * 2 * 60; // 2 minutes

let USE_IMAGE_SHAPING = false; // flip true/false whenever you want
// ===== IMAGE SHAPING STATE =====
let shapeImg; // p5.Image (grayscale or any)
let shapeProfile = null; // 2D Float32Array [rows][samples]
let shapeRows, shapeSamples;
// tuneables
// MAIN SHAPER: imgAmp → how many pixels the image can bend a line up/down. Bigger imgAmp = taller hills/valleys.
let imgAmp = 10; // how much the image bends the lines (px)
// Secondary shapers
// imgContrast → multiplies the normalized brightness (bright−0.5)*2.
// 1.0 emphasizes extremes (blacks/whites), <1.0 softens.
// imgGamma → applies gamma to brightness before centering.
// 1.0 downplays bright areas; <1.0 boosts them (nonlinear).
// imgPolarity (+1 / −1) → flips which (white vs. black) “rises”.
let imgPolarity = -1; // +1: white rises, -1: black rises
let imgContrast = 1.0; // optional contrast on brightness 
let imgGamma = 1.0; // optional gamma on brightness 

let TERRAIN_MODE = false; // toggle terrain mode
let WAVE_MODE = true;


// ===== line params =====
let transparency = 180;
let strokeWeight_ = 5;
let color_line_spacing = strokeWeight_;
let zigzag_spacing = 8; // y+= 2 to 8 works good
let BLACK = 0; // backgroundcolor?
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


// ---- MODE TOGGLE ----
/*
  0 = your current audio zigzags
  1 = "terrain plane" made from the TOP zigzag line
  2 = colored "line planes" (side view)
  3 = vector-field ribbons
*/
let MODE = 0;  // change live, or time-gate later



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
  btnWaveMode = createButton("Disable Wave Mode");
  btnImageMode = createButton("Use Image Shaping");
  btnTerrainMode = createButton("Use Terrain Mode");

  btnWaveMode.mousePressed(() => {
    WAVE_MODE = !WAVE_MODE;
    btnWaveMode.html(WAVE_MODE ? "Disable Wave Mode" : "Use Wave Mode");
  });

  btnTerrainMode.mousePressed(() => {
    TERRAIN_MODE = !TERRAIN_MODE;
    btnTerrainMode.html(TERRAIN_MODE ? "Disable Terrain Mode" : "Use Terrain Mode");
  });

  btnExport.mousePressed(() => {
    saveCanvas("aliasing.png");
  });

  btnImageMode.mousePressed(() => {
    USE_IMAGE_SHAPING = !USE_IMAGE_SHAPING;
    btnImageMode.html(USE_IMAGE_SHAPING ? "Disable Image Shaping" : "Use Image Shaping");
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

    // MODE 0

    if (WAVE_MODE) {
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

        // --- image shaping (toggle button) ---
        if (USE_IMAGE_SHAPING && shapeProfile) {
          // HIGH PRIORITY: transition
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

    // MODE 1
    if (TERRAIN_MODE){
      const bands = audioBands(fft);
      drawTerrainFromTopLine(waveform, bands, y_start);
    }

  }
}

// ################## helpers ##################

// ---- Terrain state (WEBGL buffer so main stays 2D) ----
let g3d;         // p5.Graphics(WEBGL)
let tp = { scale: 24, w: 900, h: 650, cols: 0, rows: 0, zbuf: [], zoff: 0 };

function initTerrain() {
  // y_start = 0; // reset y_start for terrain
  // y_end = height; // reset y_end for terrain
  frameRate(1);

  g3d = createGraphics(tp.w, tp.h, WEBGL);
  // FADE / NO FADE >> dunes or not
    const gl = g3d._renderer.GL;
    gl.disable(gl.DEPTH_TEST);     // draw in order, no depth test


  tp.cols = Math.floor(tp.w / tp.scale);
  tp.rows = Math.floor(tp.h / tp.scale);
  tp.zbuf = Array.from({length: tp.cols}, () => new Float32Array(tp.rows));

}

function drawTerrainFromTopLine(waveform, bands) {
    tp.w = width*6;                // *__ makes it diagonal from right // HIGH PRIORITY make scale to change 1-10
    // tp.h = height;               // full window height  (or use y_end - y_start for a band)

  if (!g3d) initTerrain();
  const wf = resampleWave(waveform, tp.cols);               // profile across X

  // drive params by audio
  const heightAmp   = lerp(60, 180, bands.bass);            // z range
  const flightSpeed = lerp(0.02, 0.14, bands.mids);
  const chop        = lerp(0.02, 0.10, bands.highs);        // ripples

  tp.zoff -= flightSpeed;

  // write newest column at "front" (row 0), push old back
  for (let x = 0; x < tp.cols; x++) {
    for (let y = tp.rows - 1; y > 0; y--) tp.zbuf[x][y] = tp.zbuf[x][y-1];
    const zz = wf[x] * heightAmp + (noise(x*0.08, tp.zoff)*2-1) * heightAmp * chop;
    tp.zbuf[x][0] = zz;
  }

  // ----- render buffer -----
  g3d.push();
  g3d.background(0,0);       // transparent
  g3d.stroke(0);
  g3d.noFill();
  g3d.rotateX(PI/3);
  g3d.translate(-tp.w, -tp.h/2, 0);

  for (let y = 0; y < tp.rows-1; y++) {
    g3d.beginShape(TRIANGLE_STRIP);
    // note can toggle TRIANGLES with translate on -tp.w/2 and tp.w = width
    for (let x = 0; x < tp.cols; x++) {
      g3d.vertex(x*tp.scale, y*tp.scale,     tp.zbuf[x][y]);
      g3d.vertex(x*tp.scale, (y+1)*tp.scale, tp.zbuf[x][y+1]);
    }
    g3d.endShape();
  }
  g3d.pop();



  // blend onto main canvas where your band begins
  // image(g3d, 0, y_start - tp.h*0.4); // tweak Y mount point
  image(g3d, 0, 0); // tweak Y mount point
}

// // ---- terrain state (same as before) ----
// let g3d;
// let tp = {
//   scale: 14, w: 900, h: 700, cols: 0, rows: 0,
//   zbuf: [], zoff: 0,
//   // camera/pose
//   pitch: 3.1416/3,
//   fov:   3.1416/3,
//   camZ:  900,
//   camY:  260,
//   horizonFactor: 0.66 // 0.60–0.70; aligns the far edge with y_start
// };

// function initTerrain() {
//   g3d = createGraphics(tp.w, tp.h, WEBGL);
//   tp.cols = floor(tp.w / tp.scale);
//   tp.rows = floor(tp.h / tp.scale);
//   tp.zbuf = Array.from({length: tp.cols}, () => new Float32Array(tp.rows));
// }

// function drawTerrainFromTopLine(waveform, bands, yStart) {
//   if (!g3d) initTerrain();

//   // --- build 1D profile from waveform ---
//   const wf = resampleWave(waveform, tp.cols);

//   // audio mapping
//   const heightAmp   = lerp(60, 180, bands.bass);
//   const flightSpeed = lerp(0.02, 0.14, bands.mids);
//   const chop        = lerp(0.00, 0.06,  bands.highs);

//   tp.zoff -= flightSpeed;

//   // push newest profile forward
//   for (let x = 0; x < tp.cols; x++) {
//     for (let y = tp.rows - 1; y > 0; y--) tp.zbuf[x][y] = tp.zbuf[x][y-1];
//     const noiseChop = (noise(x*0.08, tp.zoff)*2 - 1) * heightAmp * chop;
//     tp.zbuf[x][0] = wf[x] * heightAmp + noiseChop;
//   }

//   // --- render into WEBGL buffer with perspective ---
//   g3d.push();
//   g3d.clear();
//   g3d.resetMatrix();

//   // camera + projection
//   g3d.perspective(tp.fov, tp.w/tp.h, 10, 5000);
//   // camera(eyeX, eyeY, eyeZ, centerX, centerY, centerZ, upX, upY, upZ)
//   g3d.camera(0, tp.camY, tp.camZ,  0, 0, 0,  0, 1, 0);

//   g3d.stroke(0, 240);
//   g3d.strokeWeight(1.5);
//   g3d.noFill();

//   // pose the ground: rotate, then drop it so the far edge is near the top
//   g3d.rotateX(tp.pitch);
//   g3d.translate(-tp.w/2, -tp.h*0.5, 0); // center X, lift plane up a bit

//   for (let y = 0; y < tp.rows - 1; y++) {
//     g3d.beginShape(TRIANGLE_STRIP);
//     for (let x = 0; x < tp.cols; x++) {
//       g3d.vertex(x*tp.scale,     y*tp.scale,     tp.zbuf[x][y]);
//       g3d.vertex(x*tp.scale, (y+1)*tp.scale,     tp.zbuf[x][y+1]);
//     }
//     g3d.endShape();
//   }
//   g3d.pop();

//   // --- place the buffer so the “horizon” sits on y_start ---
//   // const placeY = yStart - tp.h * tp.horizonFactor;
//   const placeY = yStart - tp.h * tp.horizonFactor  + 200;
//   image(g3d, 0, placeY);
// }


// call these each frame after fft.waveform() / fft.analyze()
function audioBands(fft) {
  return {
    bass:   fft.getEnergy(20, 200)   / 255,   // 0..1
    mids:   fft.getEnergy(200, 2000) / 255,
    highs:  fft.getEnergy(2000, 8000)/ 255
  };
}

// resample waveform to N points (averaging) – stable & fast
function resampleWave(wf, N) {
  const out = new Float32Array(N);
  if (!wf || wf.length === 0) return out;
  const step = wf.length / N;
  for (let k = 0; k < N; k++) {
    const s = Math.floor(k * step), e = Math.max(s + 1, Math.floor((k + 1) * step));
    let sum = 0; for (let i = s; i < e; i++) sum += wf[i];
    out[k] = sum / (e - s);
  }
  return out;
}


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

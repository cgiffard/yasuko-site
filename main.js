window.addEventListener("load", setup);
window.addEventListener("resize", resize);
window.addEventListener("scroll", scroll);

const MAX_DEVICE_PIXEL_RATIO = 1;
const ROTATIONS_PER_SECOND = 0.025;
const ZOOM_IN_THRESHOLD = 1;
const BASE_BOX_DIAMETER = 1000;
const BASE_BOX_SCALE = 0.7; // 70% of the average dimensions of viewport width and height

/* Cache values which are expensive to look-up */
let w_width  = window.innerWidth;
let w_height = window.innerHeight;
let w_scroll = document.documentElement.scrollTop || document.body.scrollTop;
let w_scroll_perc = 1;

/* State tracking */
let setupDone = false;

function scroll() {
  w_scroll = document.documentElement.scrollTop || document.body.scrollTop;
  w_scroll_perc = Math.max(0, Math.min(1, 1 - ((w_scroll - w_height) / w_height)));
  
  if (w_scroll_perc === 1) {
    document.body.classList.remove("scrolled");
  } else {
    document.body.classList.add("scrolled");
  }
  
  wobblyLineShader.uniforms.colourOpacity.value = w_scroll_perc;
}

const scene       = new THREE.Scene();
const renderer    = new THREE.WebGLRenderer({
  alpha: true,
  antialias: true
});

scene.fog = new THREE.Fog( 0xE1F0F5, 0, w_height );

let camera = setupCamera();

const lights = [];
let sprites;
let box;

const wobblyLineShader = new THREE.ShaderPass({
  uniforms: {
    tDiffuse:          { value: null },
    lineColor:         { value: new THREE.Color(0xffffff) },
    backgroundColor:   { value: new THREE.Color(0xffffff) },
    foregroundColor:   { value: new THREE.Color(0xffffff) },
    contrastThreshold: { value: 0.05 },
    sampleDistance:    { value: 1 },
    viewWidth:         { value: w_width },
    viewHeight:        { value: w_height },
    time:              { value: 0.1 },
    renderOpacity:     { value: 1.0 },
    colourOpacity:     { value: 1.0 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1);
    }
  `,
  fragmentShader: `
    #extension GL_EXT_frag_depth : enable
    
    #define M_PI 3.1415926535897932384626433832795

    varying vec2 vUv;
    
    uniform sampler2D tDiffuse;
    uniform vec3 lineColor;
    uniform float contrastThreshold;
    uniform float sampleDistance;

    uniform float viewWidth;
    uniform float viewHeight;
    uniform float time;
    
    // This covers the initial fade-in and fade out when the page is scrolled
    uniform float renderOpacity;
    uniform float colourOpacity;
    
    float luminosity(vec3 pixelRGB) {
      vec3 luminosityBias = vec3(0.2125, 0.7154, 0.0721);
      return dot(pixelRGB, luminosityBias);
    }

    // Return amount to boost luminosity
    vec3 boostLuminosity(vec3 pixelRGB) {
      float inputLum = luminosity(pixelRGB);
      float luminosityBoostFactor =
        clamp((log(inputLum) / 2.0) * -1.0, 0.0, 1.0);
      
      float bias = 1.0 + luminosityBoostFactor;

      return pixelRGB * bias;
    }

    void main() {
      float pixelWidth = 1.0 / viewWidth;
      float pixelHeight = 1.0 / viewHeight;
      
      float timeSecs = time / 1000.0;
      float wrappedTime = mod(timeSecs, M_PI * 2.0);

      vec2 coords = vUv + (sin(vUv * 50.0) * 0.001) + (sin(wrappedTime) * 0.001);
      vec2 coords2 =
        vUv + (sin(vUv * 100.0) * 0.001) + (sin(vUv * 10.0) * 0.005)
        + (cos(wrappedTime) * 0.001);

      float xmdist = (sampleDistance * pixelWidth) * -1.0;
      float xpdist = (sampleDistance * pixelWidth);
      float ymdist = (sampleDistance * pixelHeight) * -1.0;
      float ypdist = (sampleDistance * pixelHeight);
      
      vec2 diagonal1 = clamp(coords2 + vec2(     0, ymdist), 0.0, 1.0);
      vec2 diagonal2 = clamp(coords2 + vec2(xpdist, 0     ), 0.0, 1.0);
      vec2 diagonal3 = clamp(coords2 + vec2(     0, ypdist), 0.0, 1.0);
      vec2 diagonal4 = clamp(coords2 + vec2(xmdist, 0     ), 0.0, 1.0);

      float diagSample1 = luminosity(texture2D(tDiffuse, diagonal1).rgb);
      float diagSample2 = luminosity(texture2D(tDiffuse, diagonal2).rgb);
      float diagSample3 = luminosity(texture2D(tDiffuse, diagonal3).rgb);
      float diagSample4 = luminosity(texture2D(tDiffuse, diagonal4).rgb);
      float pixelLuminosity = luminosity(texture2D(tDiffuse, coords).rgb);

      float maxDiag =
        max(diagSample1, max(diagSample2, max(diagSample3, diagSample4)));

      float minDiag =
        min(diagSample1, min(diagSample2, min(diagSample3, diagSample4)));

      float contrast = (maxDiag - minDiag) / 1.0;

      vec4 previousPassColor = texture2D(tDiffuse, coords);
      vec4 resultPixelColor = previousPassColor;

      float inLine = step(contrastThreshold, contrast);
      vec4 lineColour = vec4(lineColor.rgb, renderOpacity);
      vec4 nonLineColour = vec4(
        boostLuminosity(resultPixelColor.rgb),
        resultPixelColor.w * max(colourOpacity, 0.01) * renderOpacity
      );
      
      gl_FragColor = mix(nonLineColour, lineColour, inLine);
    }
  `,
});

wobblyLineShader.renderToScreen = true;

const composer = new THREE.EffectComposer(renderer);
composer.addPass(new THREE.RenderPass(scene, camera));
composer.addPass(wobblyLineShader);

var boxMaterial =
    new THREE.MeshPhongMaterial({
      color: 0xFF00FF
    });
    
const textureLoader = new THREE.TextureLoader();
const loadStart = Date.now();
let loadedAllImages = false;
let textureLoadCount = 0;

// Ensure our timings all start from when we're actually ready to go.
let loadingLagTime = 0;

const countTexture = function() {
  textureLoadCount ++;
  if (textureLoadCount >= 8) {
    loadedAllImages = true;
    loadingLagTime = Date.now() - loadStart;
    document.body.classList.add("textures-loaded");
    animate();
  }
};

var sandMaterialTexture = textureLoader.load("images/sand-texture.jpg", countTexture);
sandMaterialTexture.wrapS = THREE.RepeatWrapping;
sandMaterialTexture.wrapT = THREE.RepeatWrapping;

var sandMaterial =
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      opacity: 1,
      transparent: false,
      bumpScale: 1,
      bumpMap: sandMaterialTexture,
      roughnessMap: sandMaterialTexture,
      roughness: 7
    });

const buttonTextures = [];
const buttonMaterials = [];

["a", "b", "c", "d", "e", "f", "g"].forEach((id) => {
  let buttonTexture = textureLoader.load(`images/sprites/${id}.gif`, countTexture);
  let buttonMaterial = new THREE.SpriteMaterial( { map: buttonTexture, color: 0xffffff, fog: true } );
  buttonTexture.transparent = true;
  buttonTextures.push(buttonTexture);
  buttonMaterials.push(buttonMaterial);
});

function rad(input) {
  return input * Math.PI/180;
}

function setupCamera() {
  let intCamera = new THREE.OrthographicCamera(
    w_width / - 2,   // left
    w_width / 2,     // right
    w_height / 2,    // top
    w_height / - 2,  // bottom
    -2000,           // near
    2000             // far
  );

  return intCamera;
}

function setCameraView(time = 0) {
  const rotationSpeedMs = (1/ROTATIONS_PER_SECOND) * 1000;
  const progressThroughRotation = (time % rotationSpeedMs) / rotationSpeedMs;
  const rotationInRadians = progressThroughRotation * Math.PI * 2;
  const baseVerticalRotation = 45;
  const verticalRotation = baseVerticalRotation + ((1 - w_scroll_perc) * 30);

  camera.rotation.set(0,0,0,0)

  camera.rotateOnWorldAxis(new THREE.Vector3(1, 0, 0), rad(verticalRotation));
  camera.up = new THREE.Vector3(0, 0, 1);

  // Ensure the box is always positioned properly with reasonable spacing from the top of the screen.
  // Not too close to the top on widescreen displays, not too far from the top on vertical displays.
  camera.position.z = Math.min(Math.abs(Math.min(0, (w_height * 0.8) - getTargetDiameter())), w_height / 2)

  camera.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1).normalize(), rotationInRadians);

  setCameraZoom();
}

function setCameraZoom() {
  const zoom = 1 + ((1 - w_scroll_perc) * ZOOM_IN_THRESHOLD);

  camera.left   = (w_width  / - 2) / zoom;
  camera.right  = (w_width  /   2) / zoom;
  camera.top    = (w_height /   2) / zoom;
  camera.bottom = (w_height / - 2) / zoom;
  camera.updateProjectionMatrix();
}

function setup() {
  document.body.classList.add("loaded");
  renderer.setSize(w_width, w_height);
  composer.setSize(w_width, w_height);
  composer.setPixelRatio(Math.min(Math.max(window.devicePixelRatio, 2), MAX_DEVICE_PIXEL_RATIO));
  renderer.setPixelRatio(Math.min(Math.max(window.devicePixelRatio, 2), MAX_DEVICE_PIXEL_RATIO));
  document.body.querySelector("header").appendChild(renderer.domElement);

  buildScene();
  
  // Browsers seem to optimise out the initial state required to get the fade-in to work using
  // a CSS transition, so the style is appended after a delay. This is of course not required
  // with an animation, but then an animation fights with state applied via scrolling.
  setTimeout(() => document.body.classList.add("setup-done"), 500);
  setupDone = true;
}

function resize() {
  // Update cached values
  w_width  = window.innerWidth;
  w_height = window.innerHeight;
  
  if (setupDone) {
    setCameraZoom();
    scaleObject(sprites);
    scaleObject(box);
  }

  composer.setSize(w_width, w_height);
  renderer.setSize(w_width, w_height);
  
  render();
}

function animate(time = 0) {
  requestAnimationFrame(animate);
  
  /* No animation until we're done loading */
  if (!loadedAllImages || !setupDone) {
    return;
  }
  
  /* If we're good to go subtract loading lag */
  let normalisedTime = time - loadingLagTime;
  wobblyLineShader.uniforms.time.value = normalisedTime;
  
  /* Colour change */
  animateBG(normalisedTime);

  setCameraView(time);

  sprites.rotateOnAxis(new THREE.Vector3(0, 0, 1), rad(0.5))

  render();
}

function render() {
  /* Render both scenes */
  composer.render(0);
}

function buildScene() {
  box = constructBox();
  sprites = constructSprites();
  lights.push(...constructLights());

  scaleObject(sprites);
  scaleObject(box);

  scene.add(box, ...lights, sprites);
}

function scaleObject(object) {
  const boxTargetDiameter = getTargetDiameter();
  const percOfUnscaledDiameter = boxTargetDiameter / BASE_BOX_DIAMETER;
  
  object.scale.set(percOfUnscaledDiameter, percOfUnscaledDiameter, percOfUnscaledDiameter);
}

function getTargetDiameter() {
  const maxDimension = Math.max(w_width, w_height);
  const minDimension = Math.min(w_width, w_height);
  return ((maxDimension + minDimension) / 2) * BASE_BOX_SCALE;
}

function constructLights() {
  var light = new THREE.PointLight( 0xffffff, 1, w_width * 100 );
  light.position.set( w_width * 1.5,
                      w_width * 1.5,
                      w_height * 3 );

  var light2 = new THREE.PointLight( 0xff9999, 1, w_width * 100 );
  light2.position.set(
    w_width * -2,
    w_width * -2,
    w_height * 3 );

  return [
    light,
    light2
  ];
}

function constructBox() {
  const boxDiameter = 1000;
  const boxRadius = boxDiameter / 2;
  const boxHeight = boxDiameter / 2;
  const boxThickness = boxDiameter / 50;
  const boxInsideDiameter = boxDiameter - (boxThickness * 2);
  const perturbDistance = boxHeight / 10;
  const sandVerticesCount = boxInsideDiameter / 10 | 0;

  var baseGeom = new THREE.BoxGeometry(boxDiameter, boxDiameter, 1);
  var sideGeom = new THREE.BoxGeometry(
    boxThickness,
    boxDiameter,
    boxHeight
  );
  var perpendicularSideGeom = new THREE.BoxGeometry(
    boxDiameter,
    boxThickness,
    boxHeight
  );

  var base = new THREE.Mesh(baseGeom, boxMaterial);
  base.position.z = (boxHeight/2) * -1;

  var leftSide = new THREE.Mesh(sideGeom, boxMaterial);
  leftSide.position.x = (boxRadius + boxThickness / 2) * -1;

  var rightSide = new THREE.Mesh(sideGeom, boxMaterial);
  rightSide.position.x = boxRadius + boxThickness / 2;

  var topSide = new THREE.Mesh(perpendicularSideGeom, boxMaterial);
  topSide.position.y = (boxRadius - boxThickness / 2) * -1;

  var bottomSide = new THREE.Mesh(perpendicularSideGeom, boxMaterial);
  bottomSide.position.y = boxRadius - boxThickness / 2;

  var sandGeometry =
      new THREE.PlaneBufferGeometry(
        boxDiameter,
        boxInsideDiameter,
        sandVerticesCount,
        sandVerticesCount);

  var vertices = sandGeometry.attributes.position.array;
  for ( var i = 0, j = 0, l = vertices.length; j < l; i ++, j += 3 ) {
    let x = i / sandVerticesCount | 0;
    let y = i % (sandVerticesCount + 1);

    let perturbation =
        perturbDistance * ((Math.sin(x / 10) + Math.sin(y / 10)) / 2);

    vertices[ j + 2 ] = vertices[ j + 2 ] + perturbation | 0;
  }

  var sand = new THREE.Mesh(sandGeometry, sandMaterial);
  sand.position.z = perturbDistance;

  var box = new THREE.Group()
  box.add(
    base,
    leftSide,
    rightSide,
    topSide,
    bottomSide,
    sand
  );

  return box;
}

function constructSprites() {
  const distributionBound = BASE_BOX_DIAMETER * 0.3;
  const { length } = buttonMaterials;
  const spriteList = buttonMaterials.map((material, index) => {
    let count = (((index + 1) / length) * 6) - 3;

    var sprite = new THREE.Sprite( material );
    sprite.position.set(
      Math.sin(count) * distributionBound,
      Math.cos(count) * distributionBound,
      150
    );
    sprite.scale.set( BASE_BOX_DIAMETER / 4, BASE_BOX_DIAMETER / 4, 1.0 );
    
    return sprite;
  });

  const sprites = new THREE.Group();
  sprites.add(...spriteList);

  return sprites;
}









const COLOUR_CYCLE_TIME = 15e3;
const COLOUR_COMBINATIONS = [
  ["#FF00FF", "#E1F0F5", "#AA00CC", 270],
  ["#E1F0F5", "#F8F7D9", "#43C7DB", 360],
  ["#e7f5e0", "#f8d8d8", "#C3B2E7", 90],
  ["#F8F7D9", "#e7f5e0", "#60DDC5", 180]
];

const PROCESSED_COLOUR_COMBINATIONS =
      COLOUR_COMBINATIONS.map((colourList) => colourList.map(hex2rgb));

let nav = document.querySelector("nav");

function interpolate(v1, v2, perc) {
  return v1 + ((v2 - v1) * perc);
}

function interpolate3(v1, v2, perc) {
  return [
    interpolate(v1[0], v2[0], perc) | 0,
    interpolate(v1[1], v2[1], perc) | 0,
    interpolate(v1[2], v2[2], perc) | 0
  ];
}

function hex2rgb(hex) {
  if (typeof hex !== "string") return hex;
  const int = parseInt(hex.replace(/^#/,""), 16);
  return [
    int >> 16 & 255,
    int >> 8  & 255,
    int       & 255
  ];
};

let lastTime = 0;

function animateBG(time = 0) {
  // Don't change colours if we've only been on the page for 5 seconds or less
  if (time < 5000) {
    time = 1;
  } else {
    // Subtract our lag time (five seconds after page load)
    time -= 5000;
  }
  
  if (!setupDone) {
    return;
  }
  
  const COLOUR_LIST = PROCESSED_COLOUR_COMBINATIONS;

  const currentTime = time % COLOUR_CYCLE_TIME;
  const combinationTime = COLOUR_CYCLE_TIME / COLOUR_LIST.length;
  const interpolationPerc = (currentTime % combinationTime) / combinationTime;
  const currentCombinationIndex =
        ((currentTime / COLOUR_CYCLE_TIME) * COLOUR_LIST.length) | 0;
  const nextCombinationIndex =
        (currentCombinationIndex + 1) % COLOUR_LIST.length;

  const [currentBackground, currentForeground, currentKeyColour, currentHue] =
        COLOUR_LIST[currentCombinationIndex];
  const [nextBackground, nextForeground, nextKeyColour, nextHue] =
        COLOUR_LIST[nextCombinationIndex];

  const newForeground =
        interpolate3(currentForeground, nextForeground, interpolationPerc);
  
  const newBackground =
        interpolate3(currentBackground, nextBackground, interpolationPerc);

  const newKeyColour =
        interpolate3(currentKeyColour, nextKeyColour, interpolationPerc);
        
  const newHue =
        interpolate(currentHue, nextHue, interpolationPerc);

  const newForegroundRGB =
        `rgb(${newForeground[0]}, ${newForeground[1]}, ${newForeground[2]})`;
  
  const newBackgroundRGB =
        `rgb(${newBackground[0]}, ${newBackground[1]}, ${newBackground[2]})`;
  
  const newKeyColourRGB =
        `rgb(${newKeyColour[0]}, ${newKeyColour[1]}, ${newKeyColour[2]})`;
        
  const newHueDeg = `${newHue}deg`
  
  boxMaterial.color.setRGB(...newKeyColour.map((i) => i / 255));
  lights[0].color.setRGB(...newBackground.map((i) => i / 255))
  lights[1].color.setRGB(...newForeground.map((i) => i / 255))
  scene.fog.color.setRGB(...newForeground.map((i) => i / 255));
  
  // The lines should be white in the main view and change to the key colour when the
  // user scrolls down and the other colours disappear. 
  const newLineColour = 
        interpolate3(newKeyColour, [255, 255, 255], w_scroll_perc);
        
  wobblyLineShader.uniforms.lineColor.value.setRGB(...newLineColour.map((i) => i / 255));
  wobblyLineShader.uniforms.backgroundColor.value.setRGB(...newBackground.map((i) => i / 255));
  wobblyLineShader.uniforms.foregroundColor.value.setRGB(...newForeground.map((i) => i / 255));
  
  // Don't want this to execute too frequently.
  if ((time / 100 | 0) <= lastTime) {
    return;
  }

  lastTime = time / 100 | 0;

  // Finally, do the expensive DOM stuff at once.
  // TODO: tune the CSS & composite computation here (filter is expensive!)
  document.body.style.setProperty("--foreground-color", newForegroundRGB);
  document.body.style.setProperty("--background-color", newBackgroundRGB);
  document.body.style.setProperty("--key-color", newKeyColourRGB);
  document.body.style.setProperty("--hue-rotate", newHueDeg)
}
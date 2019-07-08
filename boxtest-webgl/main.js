window.addEventListener("load", setup);
window.addEventListener("resize", resize);

const scene       = new THREE.Scene();
const renderer    = new THREE.WebGLRenderer({
	alpha: true,
  antialias: true
});

let canvasOpacity = 0;
let distributionBound = window.innerWidth * 0.3;

scene.fog = new THREE.Fog( 0xE1F0F5, 0, window.innerHeight );

let   camera   = setupCamera();

const objects  = [];
const lights   = [];
const sprites  = [];

const wobblyLineShader = {
	uniforms: {
		tDiffuse:          { value: null },
    lineColor:         { value: new THREE.Color(0xffffff) },
    contrastThreshold: { value: 0.05 },
    sampleDistance:    { value: 1 },
    viewWidth:         { value: window.innerWidth },
    viewHeight:        { value: window.innerHeight },
    time:              { value: 0.1 }
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

    varying vec2 vUv;
    
    uniform sampler2D tDiffuse;
    uniform vec3 lineColor;
    uniform float contrastThreshold;
    uniform float sampleDistance;

    uniform float viewWidth;
    uniform float viewHeight;
    uniform float time;
    
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

      vec2 coords = sin(vUv) + (sin(vUv * 50.0) * 0.001);
      vec2 coords2 =
        sin(vUv) + (sin(vUv * 100.0) * 0.001) + (sin(vUv * 10.0) * 0.005);

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

      if (contrast >= contrastThreshold) {
        resultPixelColor = vec4(lineColor.rgb, 1.0);
      } else {
        resultPixelColor = vec4(
          boostLuminosity(resultPixelColor.rgb),
          resultPixelColor.w
        );
      }
      
      gl_FragColor = resultPixelColor;
		}
	`,
};

const wobblyLinePass = new THREE.ShaderPass(wobblyLineShader);
wobblyLinePass.renderToScreen = true;

const composer = new THREE.EffectComposer(renderer);
composer.addPass(new THREE.RenderPass(scene, camera));
composer.addPass(wobblyLinePass);

var boxMaterial =
	  new THREE.MeshPhongMaterial({
		  color: 0xFF00FF
	  });

var backgroundMaterial =
	  new THREE.MeshPhongMaterial({
		  color: 0xE1F0F5,
		  opacity: 0.5,
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
		  bumpScale: 3,
		  bumpMap: sandMaterialTexture,
		  roughnessMap: sandMaterialTexture,
		  roughness: 2
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
		window.innerWidth / - 2,   // left
		window.innerWidth / 2,     // right
		window.innerHeight / 2,    // top
    window.innerHeight / - 2,  // bottom
    -2000,                     // near
    2000                       // far
  );

	intCamera.rotateOnWorldAxis(new THREE.Vector3(1, 0, 0), rad(60));
	intCamera.up = new THREE.Vector3(0, 0, 1);

	intCamera.position.z = window.innerHeight / 4;

	return intCamera;
}

function setup() {
	renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  composer.setPixelRatio(Math.max(window.devicePixelRatio, 2));
  renderer.setPixelRatio(Math.max(window.devicePixelRatio, 2));
	document.body.querySelector("header").appendChild(renderer.domElement);

	buildScene();
}

function resize() {
  camera.left   = window.innerWidth  / - 2;
  camera.right  = window.innerWidth  /   2;
  camera.top    = window.innerHeight /   2;
  camera.bottom = window.innerHeight / - 2;
  camera.updateProjectionMatrix();

  composer.setSize(window.innerWidth, window.innerHeight);
  renderer.setSize(window.innerWidth, window.innerHeight);
  
  render();
}

// Thanks, https://math.stackexchange.com/questions/121720/ease-in-out-function
function quadraticEase(time, maxTime) {
  const easingSharpness = 4;
  const progress = time / maxTime;
  
  if (time >= maxTime) {
    return 1;
  }
  
  return Math.pow(progress, easingSharpness) / (
    Math.pow(progress, easingSharpness) +
      Math.pow(1 - progress, easingSharpness)
    );
}

function animate(time = 0) {
  requestAnimationFrame(animate);
	
	/* No animation until we're done loading */
	if (!loadedAllImages) {
  	return;
  }
	
	/* If we're good to go subtract loading lag */
  let normalisedTime = time - loadingLagTime;
  wobblyLineShader.uniforms.time.value = normalisedTime;
	
	/* Colour change */
	animateBG(normalisedTime);
	
	/* Bail out if we know the box isn't visible */
	if (document.body.scrollTop > window.innerHeight * 1.5) {
  	return;
	}

	camera.rotateOnWorldAxis(new THREE.Vector3(0, 0.4, 1).normalize(), rad(0.2));

	const amount = Math.sin(normalisedTime/10e3 % 10)

	lights.forEach((light, index) => {
		light.color.setRGB(Math.abs(amount), Math.abs(amount), Math.abs(amount))
	});

	const { length } = sprites;

  sprites.forEach((sprite, index) => {
		let count = (((index + 1) / length) * 6) - 3;
		let timeRadius = (normalisedTime / 2000) + count;

    sprite.position.set(
      Math.sin(timeRadius) * distributionBound,
      Math.cos(timeRadius) * distributionBound,
      window.innerHeight / 4
    );
	});

	/* Fade in */
	if (canvasOpacity < 1) {
    canvasOpacity = quadraticEase(normalisedTime, 10000);
		renderer.domElement.style.opacity = canvasOpacity;
	}

  render();
}

function render() {
  /* Render both scenes */
  composer.render(0);
}

function buildScene() {
  distributionBound = window.innerWidth * 0.3;
	objects.push(...constructBox());
	lights.push(...constructLights());
	sprites.push(...constructSprites());
	scene.add(...objects, ...lights, ...sprites);
}

function constructLights() {
	var light = new THREE.PointLight( 0xffffff, 1, window.innerWidth * 100 );
	light.position.set( window.innerWidth * 1.5,
					            window.innerWidth * 1.5,
	                    window.innerHeight * 3 );

	var light2 = new THREE.PointLight( 0xff9999, 1, window.innerWidth * 100 );
	light2.position.set(
    window.innerWidth * -2,
    window.innerWidth * -2,
    window.innerHeight * 3 );

	return [
		light,
		light2
	];
}

function constructBox() {
	const boxDiameter = window.innerWidth;
	const boxRadius = boxDiameter / 2;
	const boxHeight = window.innerHeight / 2;
	const boxThickness = window.innerWidth / 50;
	const boxInsideDiameter = boxDiameter - (boxThickness * 2);
	const perturbDistance = boxHeight / 10;
	const sandVerticesCount = boxInsideDiameter / 10 | 0;

	var baseGeom = new THREE.BoxGeometry(boxDiameter, boxDiameter, 1);
	var sideGeom = new THREE.BoxGeometry(
    window.innerWidth / 50,
    window.innerWidth,
    window.innerHeight / 2
  );
	var perpendicularSideGeom = new THREE.BoxGeometry(
    window.innerWidth,
    window.innerWidth / 50,
    window.innerHeight / 2
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

	return [
		base,
		leftSide,
		rightSide,
		topSide,
		bottomSide,
		sand
	];
}

function constructSprites() {
	const distributionBound = window.innerWidth * 0.3;
	const { length } = buttonMaterials;
	return buttonMaterials.map((material, index) => {
		let count = (((index + 1) / length) * 6) - 3;

		var sprite = new THREE.Sprite( material );
		sprite.position.set(
      Math.sin(count) * distributionBound,
      Math.cos(count) * distributionBound,
      150
    );
		sprite.scale.set( window.innerWidth / 5, window.innerWidth / 5, 1.0 );
		
		return sprite;
	});
}









const COLOUR_CYCLE_TIME = 15e3;
const COLOUR_COMBINATIONS = [
  ["#FF00FF", "#E1F0F5", "#FF00FF"],
  ["#E1F0F5", "#F8F7D9", "#43C7DB"],
  ["#e7f5e0", "#f8d8d8", "#C3B2E7"],
  ["#F8F7D9", "#e7f5e0", "#60DDC5"]
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
    time = 0;
  }
  
  // Subtract our lag time (five seconds after page load)
  time -= 5000;
  
  // Don't want this to execute too frequently.
  if ((time / 100 | 0) <= lastTime) {
	  return;
  }

  lastTime = time / 100 | 0;
	
  const COLOUR_LIST = PROCESSED_COLOUR_COMBINATIONS;

  const currentTime = time % COLOUR_CYCLE_TIME;
  const combinationTime = COLOUR_CYCLE_TIME / COLOUR_LIST.length;
  const interpolationPerc = (currentTime % combinationTime) / combinationTime;
  const currentCombinationIndex =
        ((currentTime / COLOUR_CYCLE_TIME) * COLOUR_LIST.length) | 0;
  const nextCombinationIndex =
        (currentCombinationIndex + 1) % COLOUR_LIST.length;

  const [currentBackground, currentForeground, currentKeyColour] =
        COLOUR_LIST[currentCombinationIndex];
  const [nextBackground, nextForeground, nextKeyColour] =
        COLOUR_LIST[nextCombinationIndex];

  const newForeground =
        interpolate3(currentForeground, nextForeground, interpolationPerc);
  
  const newBackground =
        interpolate3(currentBackground, nextBackground, interpolationPerc);

  const newKeyColour =
        interpolate3(currentKeyColour, nextKeyColour, interpolationPerc);

  const newForegroundRGB =
        `rgb(${newForeground[0]}, ${newForeground[1]}, ${newForeground[2]})`;
  
  const newBackgroundRGB =
        `rgb(${newBackground[0]}, ${newBackground[1]}, ${newBackground[2]})`;
  
  const newKeyColourRGB =
        `rgb(${newKeyColour[0]}, ${newKeyColour[1]}, ${newKeyColour[2]})`;
  
  boxMaterial.color.setRGB(...newKeyColour.map((i) => i / 255));
  lights[0].color.setRGB(...newBackground.map((i) => i / 255))
  lights[1].color.setRGB(...newForeground.map((i) => i / 255))
  scene.fog.color.setRGB(...newForeground.map((i) => i / 255));
  wobblyLineShader.uniforms.lineColor.value.setRGB(...newKeyColour.map((i) => i / 255));

  // Finally, do the expensive DOM stuff at once.
  document.body.style.setProperty("--foreground-color", newForegroundRGB);
  document.body.style.setProperty("--background-color", newBackgroundRGB);
  document.body.style.setProperty("--key-color", newKeyColourRGB);
}


// Handle scrolling
window.addEventListener("scroll", function() {
  if (window.innerWidth < 700) { return; }

  if ((document.body.scrollTop || window.scrollY) > (window.innerHeight * 0.9)) {
    document.body.classList.add("nav-fixed");
  } else {
    document.body.classList.remove("nav-fixed");
  }
});

window.addEventListener("load", function() {
  document.body.classList.add("loaded");
});
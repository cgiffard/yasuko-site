
window.addEventListener("load", setup);
window.addEventListener("resize", resize);

const scene       = new THREE.Scene();
const spriteScene = new THREE.Scene();
const renderer    = new THREE.WebGLRenderer({
						alpha: true,
						antialias: true });

let canvasOpacity = 0;

scene.fog = new THREE.Fog( 0x000000, 0, window.innerHeight );
spriteScene.fog = new THREE.Fog( 0x000000, 0, window.innerHeight * 0.8 );

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
						
let   camera   = setupCamera();

const objects  = [];
const lights   = [];
const sprites  = [];

var boxMaterial =
	new THREE.MeshPhongMaterial({
		color: 0xFF00FF
	});

var backgroundMaterial =
	new THREE.MeshPhongMaterial({
		color: 0xE1F0F5,
		opacity: 0.5,
	  });
	  
var sandMaterialTexture = new THREE.TextureLoader().load("sand-texture.jpg");
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
	let buttonTexture = new THREE.TextureLoader().load(`sprites/${id}.gif`);
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
		window.innerWidth / - 2,
		window.innerWidth / 2,
		window.innerHeight / 2,
		window.innerHeight / - 2, -2000, 2000);
	
	intCamera.rotateOnWorldAxis(new THREE.Vector3(1, 0, 0), rad(60));
	intCamera.up = new THREE.Vector3(0, 0, 1);
	
	intCamera.position.z = window.innerHeight / 4;
	
	return intCamera;
}

function setup() {
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.setPixelRatio( window.devicePixelRatio );
	document.body.querySelector("header").appendChild(renderer.domElement);
	
	buildScene();
	animate();
}

function resize() {
	camera = setupCamera();
	renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate(time = 0) {
	requestAnimationFrame(animate);
	
	camera.rotateOnWorldAxis(new THREE.Vector3(0, 0.4, 1).normalize(), rad(0.2));
	
	const amount = Math.sin(time/10e3 % 10)
	
	lights.forEach((light, index) => {
		light.color.setRGB(Math.abs(amount), Math.abs(amount), Math.abs(amount))
	});
	
	const distributionBound = window.innerWidth * 0.3;
	const { length } = sprites;
	sprites.forEach((sprite, index) => {
		let count = (((index + 1) / length) * 6) - 3;
		let timeRadius = ((time / 2000) % 40) + count
		sprite.position.set(Math.sin(timeRadius) * distributionBound, Math.cos(timeRadius) * distributionBound, 150);
	});
	
	/* Fade in */
	if (canvasOpacity < 1) {
		canvasOpacity = (time / 15000);
	}
	
	renderer.domElement.style.opacity = canvasOpacity;
	
	/* Colour change */
	animateBG(time);
	
	/* Render both scenes */
	renderer.autoClear = true;
	renderer.render( scene, camera );
	renderer.autoClear = false;
	renderer.render( spriteScene, camera );
}

function buildScene() {
	objects.push(...constructBox());
	lights.push(...constructLights());
	sprites.push(...constructSprites());
	scene.add(...objects, ...lights);
	spriteScene.add(...sprites);
}

function constructLights() {
	var light = new THREE.PointLight( 0xffffff, 1, window.innerWidth * 100 );
	light.position.set( window.innerWidth * 1.5,
					   window.innerWidth * 1.5,
	                    window.innerHeight * 3 );

	var light2 = new THREE.PointLight( 0xff9999, 1, window.innerWidth * 100 );
	light2.position.set( window.innerWidth * -2, window.innerWidth * -2, window.innerHeight * 3 );
	
	return [
		light,
		light2
	]
}

function constructBox() {
	var boxDiameter = window.innerWidth;
	var boxRadius = boxDiameter / 2;
	var boxHeight = window.innerHeight / 2;
	var boxThickness = window.innerWidth / 50;
	var boxInsideDiameter = boxDiameter - (boxThickness * 2);
	const perturbDistance = boxHeight / 10;
	const sandVerticesCount = boxInsideDiameter / 10 | 0;
	
	var baseGeom = new THREE.BoxGeometry(boxDiameter, boxDiameter, 1);
	var sideGeom = new THREE.BoxGeometry( window.innerWidth / 50, window.innerWidth, window.innerHeight / 2 );
	var perpendicularSideGeom = new THREE.BoxGeometry( window.innerWidth, window.innerWidth / 50, window.innerHeight / 2 );

	var base = new THREE.Mesh(baseGeom, boxMaterial);
	base.position.z = (boxHeight/2) * -1;
	
	var leftSide = new THREE.Mesh(sideGeom, boxMaterial);
	leftSide.position.x = (boxRadius + boxThickness / 2) * -1
	
	var rightSide = new THREE.Mesh(sideGeom, boxMaterial);
	rightSide.position.x = boxRadius + boxThickness / 2
	
	var topSide = new THREE.Mesh(perpendicularSideGeom, boxMaterial);
	topSide.position.y = (boxRadius - boxThickness / 2) * -1
	
	var bottomSide = new THREE.Mesh(perpendicularSideGeom, boxMaterial);
	bottomSide.position.y = boxRadius - boxThickness / 2

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
		
		let perturbation = perturbDistance * ((Math.sin(x / 10) + Math.sin(y / 10)) / 2)
		vertices[ j + 2 ] = vertices[ j + 2 ] + perturbation | 0;
	}
	
	var sand = new THREE.Mesh(sandGeometry, sandMaterial);
	sand.position.z = perturbDistance * 2 + 1;
	
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
		sprite.position.set(Math.sin(count) * distributionBound, Math.cos(count) * distributionBound, 150);
		sprite.scale.set( window.innerWidth / 5, window.innerWidth / 5, 1.0 );
		
		return sprite;
	});
}









const COLOUR_CYCLE_TIME = 10e3;
const COLOUR_COMBINATIONS = [
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

function animateBG(time = 0) {
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

  document.body.style.backgroundImage =
    `linear-gradient(${newForegroundRGB}, ${newBackgroundRGB})`;
  document.body.style.backgroundColor = newBackgroundRGB;
  
  nav.style.backgroundColor = newKeyColourRGB;
  
  boxMaterial.color.setRGB(...newKeyColour.map((i) => i / 255))
  lights[0].color.setRGB(...newBackground.map((i) => i / 255))
  lights[1].color.setRGB(...newForeground.map((i) => i / 255))
  scene.fog.color.setRGB(...newForeground.map((i) => i / 255))
  spriteScene.fog.color.setRGB(...newForeground.map((i) => i / 255))
}

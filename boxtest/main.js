const COLOUR_CYCLE_TIME = 10e3;
const COLOUR_COMBINATIONS = [
  ["#E1F0F5", "#F8F7D9", "#43C7DB"],
  ["#e7f5e0", "#f8d8d8", "#C3B2E7"],
  ["#F8F7D9", "#e7f5e0", "#60DDC5"]
];

const PROCESSED_COLOUR_COMBINATIONS =
      COLOUR_COMBINATIONS.map((colourList) => colourList.map(hex2rgb));
/*

let rims;
let textSlices;
*/

function load() {
/*
  rims = [].slice.call(document.querySelectorAll("rim"));
  textSlices = [].slice.call(document.querySelectorAll("h1"));
*/
  animate();
}

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

function animate(time = 0) {
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
/*
  rims[0].style.backgroundColor = newKeyColourRGB;
  rims[1].style.backgroundColor = newKeyColourRGB;
  rims[2].style.backgroundColor = newKeyColourRGB;
  rims[3].style.backgroundColor = newKeyColourRGB;
  textSlices.map((slice) => slice.style.color = newKeyColourRGB);
*/

  requestAnimationFrame(animate);
}

window.addEventListener("load", load);

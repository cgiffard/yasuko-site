window.addEventListener("load", animate);

function animate(time = 0) {
    requestAnimationFrame(animate);

    /* Colour change */
    animateBG(time);
}

const COLOUR_CYCLE_TIME = 15e3;
const COLOUR_COMBINATIONS = [
    ["#FF00FF", "#E1F0F5", "#AA00CC", 270],
    ["#E1F0F5", "#F8F7D9", "#43C7DB", 360],
    ["#e7f5e0", "#f8d8d8", "#C3B2E7", 90],
    ["#F8F7D9", "#e7f5e0", "#60DDC5", 180],
];

const PROCESSED_COLOUR_COMBINATIONS = COLOUR_COMBINATIONS.map((colourList) =>
    colourList.map(hex2rgb)
);

let nav = document.querySelector("nav");

function interpolate(v1, v2, perc) {
    return v1 + (v2 - v1) * perc;
}

function interpolate3(v1, v2, perc) {
    return [
        interpolate(v1[0], v2[0], perc) | 0,
        interpolate(v1[1], v2[1], perc) | 0,
        interpolate(v1[2], v2[2], perc) | 0,
    ];
}

function hex2rgb(hex) {
    if (typeof hex !== "string") return hex;
    const int = parseInt(hex.replace(/^#/, ""), 16);
    return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}

let lastTime = 0;

function animateBG(time = 0) {
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

    const newForeground = interpolate3(
        currentForeground,
        nextForeground,
        interpolationPerc
    );

    const newBackground = interpolate3(
        currentBackground,
        nextBackground,
        interpolationPerc
    );

    const newKeyColour = interpolate3(
        currentKeyColour,
        nextKeyColour,
        interpolationPerc
    );

    const newHue = interpolate(currentHue, nextHue, interpolationPerc);

    const newForegroundRGB = `rgb(${newForeground[0]}, ${newForeground[1]}, ${newForeground[2]})`;

    const newBackgroundRGB = `rgb(${newBackground[0]}, ${newBackground[1]}, ${newBackground[2]})`;

    const newKeyColourRGB = `rgb(${newKeyColour[0]}, ${newKeyColour[1]}, ${newKeyColour[2]})`;

    const newHueDeg = `${newHue}deg`;

    // Don't want this to execute too frequently.
    if (((time / 100) | 0) <= lastTime) {
        return;
    }

    lastTime = (time / 100) | 0;

    // Finally, do the expensive DOM stuff at once.
    // TODO: tune the CSS & composite computation here (filter is expensive!)
    document.body.style.setProperty("--foreground-color", newForegroundRGB);
    document.body.style.setProperty("--background-color", newBackgroundRGB);
    document.body.style.setProperty("--key-color", newKeyColourRGB);
    document.body.style.setProperty("--hue-rotate", newHueDeg);
}

import {
    FaceLandmarker,
    FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/+esm";


// ===============================
// ELEMENTS
// ===============================

const startScreen = document.getElementById("startScreen");
const gameScreen = document.getElementById("gameScreen");
const resultScreen = document.getElementById("resultScreen");

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const againBtn = document.getElementById("againBtn");

const video = document.getElementById("video");

const statusText = document.getElementById("status");
const cameraStatus = document.getElementById("cameraStatus");

const countdownText = document.getElementById("countdown");
const timerText = document.getElementById("timer");

const person1Status = document.getElementById("person1");
const person2Status = document.getElementById("person2");


// ===============================
// VARIABLES
// ===============================

let faceLandmarker;
let cameraStream;

let detecting = false;
let gameRunning = false;
let countdownStarted = false;
let startTime = 0;
let timerInterval = null;

let lastVideoTime = -1;

let attempts =
    Number(localStorage.getItem("attempts")) || 0;

let bestTime =
    Number(localStorage.getItem("bestTime")) || 0;


// ===============================
// MEDIAPIPE SETUP
// ===============================

async function setupFaceLandmarker() {

    statusText.textContent =
        "🤖 Loading face detection...";

    const vision =
        await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm"
        );

    faceLandmarker =
        await FaceLandmarker.createFromOptions(
            vision,
            {
                baseOptions: {
                    modelAssetPath:
                        "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
                },

                runningMode: "VIDEO",

                numFaces: 2,

                minFaceDetectionConfidence: 0.5,

                minFacePresenceConfidence: 0.5,

                minTrackingConfidence: 0.5
            }
        );

    statusText.textContent =
        "🤖 Face detection ready!";
}


// ===============================
// START CAMERA
// ===============================

async function startCamera() {

    try {

        cameraStream =
            await navigator.mediaDevices.getUserMedia({
                video: {
                    width: 1280,
                    height: 720
                },
                audio: false
            });

        video.srcObject = cameraStream;

        await video.play();

        cameraStatus.textContent =
            "📷 Camera connected";

        detecting = true;

        detectFaces();

    } catch (error) {

        console.error(error);

        cameraStatus.textContent =
            "❌ Camera permission denied";

        statusText.textContent =
            "Please allow camera access.";

    }
}


// ===============================
// START GAME
// ===============================

startBtn.addEventListener("click", async () => {

    startScreen.classList.add("hidden");

    gameScreen.classList.remove("hidden");

    await setupFaceLandmarker();

    await startCamera();

   

});



function detectFaces() {

    if (!detecting) return;

    if (
        video.readyState >= 2 &&
        video.currentTime !== lastVideoTime
    ) {

        lastVideoTime = video.currentTime;

        const results =
            faceLandmarker.detectForVideo(
                video,
                performance.now()
            );

        processFaces(results);
    }

    requestAnimationFrame(detectFaces);
}


// ===============================
// PROCESS FACES
// ===============================

function processFaces(results) {

    const faces =
        results.faceLandmarks || [];

    if (faces.length === 0) {

        person1Status.textContent =
            "Person 1: ❌ No face";

        person2Status.textContent =
            "Person 2: ❌ No face";

        if (gameRunning) {

            statusText.textContent =
                "❌ Face disappeared!";

            stopGame();

        }

        return;
    }


    if (faces.length === 1) {

        person1Status.textContent =
            "Person 1: 👀 Detected";

        person2Status.textContent =
            "Person 2: ❌ Missing";

        if (gameRunning) {

            statusText.textContent =
                "❌ Need two people!";

            stopGame();

        }

        return;
    }


    // Two faces found

    let faceA = faces[0];
    let faceB = faces[1];


    // Sort people from left to right

    const centerA =
        getFaceCenter(faceA);

    const centerB =
        getFaceCenter(faceB);


    let leftFace;
    let rightFace;


    if (centerA.x < centerB.x) {

        leftFace = faceA;
        rightFace = faceB;

    } else {

        leftFace = faceB;
        rightFace = faceA;
    }


    const leftLooking =
        isLookingRight(leftFace);

    const rightLooking =
        isLookingLeft(rightFace);


    const leftBlinking =
        isBlinking(leftFace);

    const rightBlinking =
        isBlinking(rightFace);


    // Display status

    person1Status.textContent =
        leftLooking
            ? "Person 1: 👀 Looking"
            : "Person 1: 👁️ Looking away";

    person2Status.textContent =
        rightLooking
            ? "Person 2: 👀 Looking"
            : "Person 2: 👁️ Looking away";


    // If game hasn't started yet

   if (!gameRunning && !countdownStarted) {

    if (leftLooking && rightLooking) {

        statusText.textContent =
            "👀 Both ready! Starting...";

        countdownStarted = true;

        startCountdown();

    } else {

        statusText.textContent =
            "👀 Make both people look toward each other.";

    }

    return;
}


    // ===========================
    // GAME IS RUNNING
    // ===========================

    if (leftLooking && rightLooking) {

        if (leftBlinking || rightBlinking) {

            statusText.textContent =
                "😉 Blink detected — allowed!";

        } else {

            statusText.textContent =
                "🔥 PERFECT EYE CONTACT!";
        }

    } else {

        statusText.textContent =
            "💀 SOMEONE LOOKED AWAY!";

        stopGame();
    }
}


// ===============================
// FACE CENTER
// ===============================

function getFaceCenter(face) {

    let totalX = 0;
    let totalY = 0;

    for (const point of face) {

        totalX += point.x;
        totalY += point.y;

    }

    return {

        x: totalX / face.length,

        y: totalY / face.length
    };
}


// ===============================
// EYE GAZE
// ===============================

function eyePosition(face, leftCorner, rightCorner, irisIndex) {

    const left =
        face[leftCorner];

    const right =
        face[rightCorner];

    const iris =
        face[irisIndex];


    const eyeWidth =
        Math.abs(right.x - left.x);


    if (eyeWidth === 0) return 0.5;


    return (
        (iris.x - left.x) /
        eyeWidth
    );
}


// ===============================
// LEFT PERSON LOOKING RIGHT
// ===============================

function isLookingRight(face) {

    const eye1 =
        eyePosition(face, 33, 133, 468);

    const eye2 =
        eyePosition(face, 362, 263, 473);


    const average =
        (eye1 + eye2) / 2;


    return average > 0.55;
}


// ===============================
// RIGHT PERSON LOOKING LEFT
// ===============================

function isLookingLeft(face) {

    const eye1 =
        eyePosition(face, 33, 133, 468);

    const eye2 =
        eyePosition(face, 362, 263, 473);


    const average =
        (eye1 + eye2) / 2;


    return average < 0.45;
}


// ===============================
// BLINK DETECTION
// ===============================

function eyeAspectRatio(face, top, bottom, left, right) {

    const vertical =
        Math.abs(
            face[top].y -
            face[bottom].y
        );

    const horizontal =
        Math.abs(
            face[left].x -
            face[right].x
        );

    if (horizontal === 0) return 1;

    return vertical / horizontal;
}


function isBlinking(face) {

    const leftEye =
        eyeAspectRatio(
            face,
            159,
            145,
            33,
            133
        );

    const rightEye =
        eyeAspectRatio(
            face,
            386,
            374,
            362,
            263
        );


    const average =
        (leftEye + rightEye) / 2;


    return average < 0.18;
}


// ===============================
// COUNTDOWN
// ===============================

function startCountdown() {

    let count = 3;

    countdownText.textContent =
        count;


    const interval =
        setInterval(() => {

            count--;

            if (count > 0) {

                countdownText.textContent =
                    count;

            } else {

                clearInterval(interval);

                countdownText.textContent =
                    "👀 GO!";

                startTimer();

            }

        }, 1000);
}


// ===============================
// START TIMER
// ===============================

function startTimer() {

    gameRunning = true;

    startTime = performance.now();


    timerInterval =
        setInterval(() => {

            const elapsed =
                (performance.now() - startTime) /
                1000;

            timerText.textContent =
                elapsed.toFixed(2);

        }, 10);
}


// ===============================
// STOP GAME
// ===============================

function stopGame() {

    if (!gameRunning) return;


    gameRunning = false;

    clearInterval(timerInterval);


    const finalTime =
        (performance.now() - startTime) /
        1000;


    attempts++;


    if (finalTime > bestTime) {

        bestTime = finalTime;

    }


    localStorage.setItem(
        "attempts",
        attempts
    );

    localStorage.setItem(
        "bestTime",
        bestTime
    );


    showResult(finalTime);
}


// ===============================
// SHOW RESULT
// ===============================

function showResult(time) {

    gameScreen.classList.add("hidden");

    resultScreen.classList.remove("hidden");


    document.getElementById(
        "finalTime"
    ).textContent =
        time.toFixed(2) +
        " seconds";


    document.getElementById(
        "bestTime"
    ).textContent =
        bestTime.toFixed(2) +
        "s";


    document.getElementById(
        "attempts"
    ).textContent =
        attempts;


    const awkwardness =
        Math.min(
            Math.round(time * 3.33),
            100
        );


    document.getElementById(
        "awkwardness"
    ).textContent =
        awkwardness +
        "%";


    let rank;
    let message;


    if (time < 2) {

        rank =
            "🐔 Professional Chicken";

        message =
            "You looked away before the awkwardness even started.";

    }

    else if (time < 5) {

        rank =
            "😳 Awkward Beginner";

        message =
            "That got awkward FAST.";

    }

    else if (time < 10) {

        rank =
            "👀 Suspicious Stare";

        message =
            "Why are you still staring?";

    }

    else if (time < 20) {

        rank =
            "🗿 Human Statue";

        message =
            "Blinking is apparently optional.";

    }

    else if (time < 30) {

        rank =
            "🔥 Uncomfortably Powerful";

        message =
            "This friendship may never recover.";

    }

    else {

        rank =
            "👁️ No Social Fear";

        message =
            "Please stop staring at each other.";

    }


    document.getElementById(
        "rank"
    ).textContent =
        rank;


    document.getElementById(
        "funnyMessage"
    ).textContent =
        message;
}


// ===============================
// MANUAL STOP
// ===============================

stopBtn.addEventListener(
    "click",
    stopGame
);


// ===============================
// TRY AGAIN
// ===============================

againBtn.addEventListener(
    "click",
    () => {

        resultScreen.classList.add("hidden");

        startScreen.classList.remove("hidden");

        timerText.textContent = "0.00";

        countdownText.textContent = "";

        statusText.textContent =
            "👥 Put TWO people in front of the camera.";

        gameRunning = false;

        countdownStarted = false;

    }
);
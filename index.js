(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.jiboProgrammingChallenge = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/// <reference path="../typings/index.d.ts" />
/// <reference path="./tone.ts" />
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class AudioPlayer {
    constructor() {
        this.ctx = new AudioContext();
        this.notes = [];
        this.node = this.ctx.createScriptProcessor(1024, 0, 1); // mono, no buffer
        this.node.connect(this.ctx.destination);
        this.node.onaudioprocess = this.callback.bind(this);
    }
    callback(e) {
        let outputData = e.outputBuffer.getChannelData(0);
        for (let sample = 0; sample < e.outputBuffer.length; sample++) {
            outputData[sample] = 0;
            for (let i = 0; i < this.notes.length; i++) {
                if (this.notes[i] && this.notes[i].isPlaying) {
                    outputData[sample] += this.notes[i].generate();
                }
            }
        }
        for (let i = 0; i < this.notes.length; i++) {
            if (!(this.notes[i].isPlaying)) {
                this.notes.splice(i, 1);
                i--;
            }
        }
    }
}
exports.AudioPlayer = AudioPlayer;

},{}],2:[function(require,module,exports){
/// <reference path="../typings/index.d.ts" />
/// <reference path="./tone.ts" />
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tone_1 = require("./tone");
const C4 = 256; // dem numerologists be crazy, but I'm using A 432 anyway
var Direction;
(function (Direction) {
    Direction[Direction["Up"] = 0] = "Up";
    Direction[Direction["Down"] = 1] = "Down";
    Direction[Direction["Left"] = 2] = "Left";
    Direction[Direction["Right"] = 3] = "Right";
})(Direction || (Direction = {}));
const directions = [Direction.Up, Direction.Down, Direction.Left, Direction.Right];
class Board {
    constructor(size, stage) {
        this.size = size;
        this.stage = stage;
        this.arrows = [];
        this.exitSquares = [];
        this.events = [];
        this.currentEvent = [];
        this.presolved = false;
        this.framesBetweenEvents = 7;
        if (this.size > 20) {
            this.framesBetweenEvents = 2; // speed it way up for big boards
        }
        this.currentRestFrame = 0;
        this.drawingLongestPath = 0;
        this.TL = { x: 50, y: 100 };
        this.w = 600;
        this.h = 600;
        this.cellWidth = this.w / (size + 2);
        this.cellHeight = this.h / (size + 2);
        this.drawingExitSquares = [];
        this.drawingBacktraceSquares = [];
        this.lineSprites = [];
        this.cellSprites = [];
        this.arrowSprites = [];
        this.longestPathText = null;
        for (let i = 0; i < size * size; i++) {
            this.arrows[i] = directions[Math.floor(Math.random() * 4)]; // generate board
            this.exitSquares[i] = false; // initialize exitSquares
            this.drawingExitSquares[i] = false;
            this.drawingBacktraceSquares[i] = false;
            this.cellSprites[i] = null;
            this.arrowSprites[i] = null;
        }
    }
    row(square) {
        return Math.floor(square / this.size);
    }
    col(square) {
        return square % this.size;
    }
    square(row, col) {
        return this.size * row + col;
    }
    up(square) {
        if (this.row(square) === 0) {
            return null;
        }
        else {
            return square - this.size;
        }
    }
    down(square) {
        if (this.row(square) === this.size - 1) {
            return null;
        }
        else {
            return square + this.size;
        }
    }
    left(square) {
        if (this.col(square) === 0) {
            return null;
        }
        else {
            return square - 1;
        }
    }
    right(square) {
        if (this.col(square) === this.size - 1) {
            return null;
        }
        else {
            return square + 1;
        }
    }
    next(square) {
        switch (this.arrows[square]) {
            case Direction.Up:
                return this.up(square);
            case Direction.Down:
                return this.down(square);
            case Direction.Left:
                return this.left(square);
            case Direction.Right:
                return this.right(square);
            default:
                return null; // should never happen
        }
    }
    nextCheckerSquareRC(squareRC) {
        if (squareRC.row < 0 || squareRC.row >= this.size
            || squareRC.col < 0 || squareRC.col >= this.size) {
            return null; // there are no arrows off-board
        }
        let square = this.square(squareRC.row, squareRC.col);
        // we can't just use the "next" method because we may need
        // to move the checker off the board
        switch (this.arrows[square]) {
            case Direction.Up:
                return { row: squareRC.row - 1, col: squareRC.col };
            case Direction.Down:
                return { row: squareRC.row + 1, col: squareRC.col };
            case Direction.Left:
                return { row: squareRC.row, col: squareRC.col - 1 };
            case Direction.Right:
                return { row: squareRC.row, col: squareRC.col + 1 };
            default:
                return null; // should never happen
        }
    }
    record(event) {
        this.currentEvent.push(event);
    }
    nextEvent() {
        this.events.push(this.currentEvent);
        this.currentEvent = [];
    }
    // In a time-efficient algorithm, the presolving step marks the squares that
    // lead to an exit.  However, we're going for a space-efficient algorith
    // instead.  So, while we *are* marking the squares that lead to an exit
    // (O(n^2) space), we're only using that information for the purposes of the
    // visualization.  What presolving does instead is as follows:
    //
    // It starts around the board, looking for squares with arrows pointing out.
    // When it finds them, it checks their immediate neighbors for squares that
    // lead to that square in order to backtrace the path, and it backtraces the
    // path recursively to find all squares leading to the exit.  Meanwhile, it
    // counts these exit-leading squares and keeps track of path length, for a
    // total storage that grows as O(1).
    //
    // When the checker is eventually placed on the board, we know that if it has
    // not exited by the time it has taken as many steps as the longest leading
    // path, or if it has taken more paths than there are non-exit-leading
    // squares on the board, it will never reach an exit.
    //
    // Instead of waiting for animation frames, the presolving algorithm records
    // animatable actions, which are played back later by the renderer at human
    // speeds.  Doing this directly would be a nightmare, especially for the
    // recursive bit.
    presolve() {
        let self = this;
        if (this.presolved) {
            return;
        }
        let longestPath = 0;
        let exits = 0; // count of exit squares
        // we can't just count the true values in exitSquares because that would
        // violate our O(1) storage requirement
        // returns path length
        function backtracePath(square) {
            let pathLengths = [0, 0, 0, 0];
            let neighbors = [self.up(square), self.down(square), self.left(square), self.right(square)];
            for (let i = 0; i < neighbors.length; i++) {
                if (neighbors[i] !== null && self.next(neighbors[i]) === square) {
                    exits++;
                    self.exitSquares[neighbors[i]] = true;
                    self.record({
                        event: "addExitSquare",
                        square: neighbors[i]
                    });
                    self.record({
                        event: "addBacktraceSquare",
                        square: square
                    });
                    self.nextEvent();
                    pathLengths[i] = backtracePath(neighbors[i]);
                    self.record({
                        event: "removeBacktraceSquare",
                        square: square
                    });
                    self.nextEvent();
                }
            }
            return 1 + Math.max(...pathLengths);
        }
        // We're going to do all four sides at once.
        // This will take O(n) checks instead of O(n^2), so even though it's
        // a bit messier to code, it's a potentially very large improvement
        // in cases we'll likely never actually hit.  But it's the principle
        // of the thing.  If we wanted to just check the entire grid for exit
        // points, we'd just check if this.next is null for each square.
        for (let i = 0; i < this.size - 1; i++) {
            let targetSquares = [
                this.square(0, i),
                this.square(i, this.size - 1),
                this.square(this.size - 1, this.size - 1 - i),
                this.square(this.size - 1 - i, 0) // along left
            ];
            for (let j = 0; j < 4; j++) {
                if (this.next(targetSquares[j]) === null) {
                    exits++;
                    this.exitSquares[targetSquares[j]] = true;
                    this.record({
                        event: "addExitSquare",
                        square: targetSquares[j]
                    });
                    this.record({
                        event: "addBacktraceSquare",
                        square: targetSquares[j]
                    });
                    this.nextEvent();
                    let pathLength = backtracePath(targetSquares[j]);
                    this.record({
                        event: "removeBacktraceSquare",
                        square: targetSquares[j]
                    });
                    if (pathLength > longestPath) {
                        longestPath = pathLength;
                        this.record({
                            event: "updateLongestPath",
                            value: longestPath
                        });
                    }
                    this.nextEvent();
                }
            }
        }
        this.longestExitPathLength = longestPath;
        this.presolved = true;
    }
    processRenderEvent(event) {
        switch (event.event) {
            case "updateLongestPath":
                this.drawingLongestPath = event.value;
                this.createStatsText();
                break;
            case "addExitSquare":
                this.drawingExitSquares[event.square] = true;
                this.createCellSprite(event.square);
                break;
            case "addBacktraceSquare":
                this.drawingBacktraceSquares[event.square] = true;
                this.createCellSprite(event.square);
                break;
            case "removeBacktraceSquare":
                this.drawingBacktraceSquares[event.square] = false;
                this.createCellSprite(event.square);
                break;
        }
    }
    playSound() {
        // ranndom beeps, because why not
        let frequency = 2 * (2 / (Math.random() + 1)) * C4; // random note between C5 and C6
        // Actually not quite a random note -- we're choosing the note in a weird
        // way.  Think of a string that makes a C4 sound.  Now, find the midpoint.
        // We're picking random spots on the string on one side of the midpoint
        // and plucking on the other side.  It's still random, just... weird.
        let duration = (this.framesBetweenEvents / 60) * 500; // assuming 60 fps
        let tone = new tone_1.Tone(frequency, duration, 0.1);
        tone.play();
    }
    stepPresolutionAnimation() {
        if (this.events.length > 0 && this.currentRestFrame <= 0) {
            let renderEvents = this.events.shift();
            for (let i = 0; i < renderEvents.length; i++) {
                this.processRenderEvent(renderEvents[i]);
            }
            this.currentRestFrame += this.framesBetweenEvents;
            this.playSound();
        }
        else if (this.currentRestFrame > 0) {
            this.currentRestFrame--;
        }
    }
    destroy() {
        this.clearBoardSprites();
        this.clearStatsText();
    }
    initBoardRender() {
        this.clearBoardSprites();
        this.createBoardSprites();
        this.createStatsText();
    }
    clearStatsText() {
        this.clearLongestPathText();
    }
    clearLongestPathText() {
        if (this.longestPathText !== null) {
            this.stage.removeChild(this.longestPathText);
            this.longestPathText = null;
        }
    }
    createStatsText() {
        this.clearStatsText();
        let style = new PIXI.TextStyle({
            fontSize: 30,
            fill: 0xD0D0D0
        });
        this.longestPathText = new PIXI.Text('Longest Path Length: ' + this.drawingLongestPath, style);
        this.longestPathText.x = 50;
        this.longestPathText.y = 45;
        this.stage.addChild(this.longestPathText);
    }
    clearBoardSprites() {
        for (let i = 0; i < this.lineSprites.length; i++) {
            this.stage.removeChild(this.lineSprites[i]);
        }
        this.lineSprites = [];
        for (let i = 0; i < this.size * this.size; i++) {
            this.removeCellSprite(i); // also clears arrow sprite
        }
    }
    removeCellSprite(square) {
        if (this.cellSprites[square] !== null) {
            this.stage.removeChild(this.cellSprites[square]);
        }
        this.cellSprites[square] = null;
        this.removeArrowSprite(square);
    }
    removeArrowSprite(square) {
        if (this.arrowSprites[square] !== null) {
            this.stage.removeChild(this.arrowSprites[square]);
        }
        this.arrowSprites[square] = null;
    }
    createBoardSprites() {
        this.clearBoardSprites();
        this.createLineSprites();
        for (let i = 0; i < this.size * this.size; i++) {
            this.createCellSprite(i);
        }
    }
    createLineSprites() {
        for (let i = 1; i <= this.size + 1; i++) {
            let hLine = new PIXI.Graphics();
            hLine.lineStyle(3, 0x8080FF, 1);
            hLine.moveTo(this.TL.x + this.cellWidth - 1.5, this.TL.y + i * this.cellHeight);
            hLine.lineTo(this.TL.x + (this.size + 1) * this.cellWidth + 1.5, this.TL.y + i * this.cellHeight);
            this.stage.addChild(hLine);
            this.lineSprites.push(hLine);
            let vLine = new PIXI.Graphics();
            vLine.lineStyle(3, 0x8080FF, 1);
            vLine.moveTo(this.TL.x + this.cellWidth * i, this.TL.y + this.cellHeight - 1.5);
            vLine.lineTo(this.TL.x + this.cellWidth * i, this.TL.y + (this.size + 1) * this.cellHeight + 1.5);
            this.stage.addChild(vLine);
            this.lineSprites.push(vLine);
        }
    }
    createCellSprite(square) {
        this.removeCellSprite(square); // also removes arrow sprite
        let cell = new PIXI.Graphics();
        if (this.drawingBacktraceSquares[square]) {
            cell.lineStyle(1, 0xFF4040, 1); // border around backtrace squares
        }
        else {
            cell.lineStyle(0, 0x000000, 0);
        }
        if (this.drawingExitSquares[square]) {
            cell.beginFill(0x202020);
        }
        else {
            cell.beginFill(0xE0E0E0);
        }
        let r = this.row(square);
        let c = this.col(square);
        cell.drawRect(this.TL.x + this.cellWidth * (c + 1) + 1, this.TL.y + this.cellHeight * (r + 1) + 1, this.cellWidth - 2, this.cellHeight - 2);
        cell.endFill();
        this.stage.addChild(cell);
        this.cellSprites[square] = cell;
        this.createArrowSprite(square);
    }
    createArrowSprite(square) {
        let center = this.centerOfSquare({
            row: this.row(square),
            col: this.col(square)
        });
        const k = Math.sqrt(3) / 8; // useful geometric constant
        let arrow = new PIXI.Graphics();
        arrow.beginFill(0x808080);
        switch (this.arrows[square]) {
            case Direction.Up:
                arrow.drawPolygon([
                    center.x, center.y - this.cellHeight * 0.375,
                    center.x + k * this.cellWidth, center.y,
                    center.x - k * this.cellWidth, center.y
                ]);
                break;
            case Direction.Down:
                arrow.drawPolygon([
                    center.x, center.y + this.cellHeight * 0.375,
                    center.x - k * this.cellWidth, center.y,
                    center.x + k * this.cellWidth, center.y
                ]);
                break;
            case Direction.Left:
                arrow.drawPolygon([
                    center.x - this.cellHeight * 0.375, center.y,
                    center.x, center.y - k * this.cellHeight,
                    center.x, center.y + k * this.cellHeight
                ]);
                break;
            case Direction.Right:
                arrow.drawPolygon([
                    center.x + this.cellHeight * 0.375, center.y,
                    center.x, center.y + k * this.cellHeight,
                    center.x, center.y - k * this.cellHeight
                ]);
                break;
        }
        arrow.endFill();
        this.stage.addChild(arrow);
        this.arrowSprites[square] = arrow;
    }
    centerOfSquare(squareRC) {
        return {
            x: this.TL.x + this.cellWidth * (squareRC.col + 1.5),
            y: this.TL.y + this.cellHeight * (squareRC.row + 1.5)
        };
    }
}
exports.Board = Board;

},{"./tone":5}],3:[function(require,module,exports){
/// <reference path="../typings/index.d.ts" />
/// <reference path="./board.ts" />
/// <reference path="./tone.ts" />
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tone_1 = require("./tone");
const C4 = 256; // dem numerologists be crazy, but I'm using A 432 anyway
class Checker {
    constructor(board, row, col, stage) {
        this.board = board;
        this.stage = stage;
        this.squareRC = { row: row, col: col };
        this.calculateOnBoard();
        this.position = this.board.centerOfSquare(this.squareRC);
        this.stepsTaken = 0;
        this.started = false;
        this.done = false;
        this.calculateRadius();
        this.checkerSprite = null;
        this.stepsText = null;
        this.doneText = null;
        this.movementFrames = 30;
        if (this.board.size > 20) {
            this.movementFrames = 10; // speed it way up for big boards
        }
    }
    initCheckerRender() {
        this.createSprites();
    }
    calculateOnBoard() {
        if (this.squareRC.row >= 0 && this.squareRC.row < this.board.size
            && this.squareRC.col >= 0 && this.squareRC.col < this.board.size) {
            this.onBoard = true;
        }
        else {
            this.onBoard = false;
        }
    }
    calculateRadius() {
        let cellSize = Math.min(this.board.cellWidth, this.board.cellHeight);
        this.radius = cellSize / 4;
    }
    destroy() {
        this.clearSprites();
    }
    clearSprites() {
        this.clearCheckerSprite();
        this.clearStepsText();
        this.clearDoneText();
    }
    createSprites() {
        this.createCheckerSprite();
        this.createStepsText();
    }
    clearCheckerSprite() {
        if (this.checkerSprite !== null) {
            this.stage.removeChild(this.checkerSprite);
        }
        this.checkerSprite = null;
    }
    clearStepsText() {
        if (this.stepsText !== null) {
            this.stage.removeChild(this.stepsText);
        }
        this.stepsText = null;
    }
    clearDoneText() {
        if (this.doneText !== null) {
            this.stage.removeChild(this.doneText);
        }
        this.doneText = null;
    }
    createCheckerSprite() {
        this.clearCheckerSprite();
        this.checkerSprite = new PIXI.Graphics();
        this.checkerSprite.lineStyle(2, 0x0000FF, 1);
        this.checkerSprite.beginFill(0x4040FF);
        this.checkerSprite.drawCircle(0, 0, this.radius);
        this.checkerSprite.x = this.position.x;
        this.checkerSprite.y = this.position.y;
        this.stage.addChild(this.checkerSprite);
    }
    createStepsText() {
        this.clearStepsText();
        let style;
        if (!this.onBoard) {
            style = new PIXI.TextStyle({
                fontSize: 30,
                fill: 0x40FF40
            });
        }
        else if (this.tooManySteps()) {
            style = new PIXI.TextStyle({
                fontSize: 30,
                fill: 0xFF4040
            });
        }
        else {
            style = new PIXI.TextStyle({
                fontSize: 30,
                fill: 0xD0D0D0
            });
        }
        this.stepsText = new PIXI.Text('Steps Taken: ' + this.stepsTaken, style);
        this.stepsText.x = 700;
        this.stepsText.y = 300;
        this.stage.addChild(this.stepsText);
    }
    createDoneText(msg) {
        this.clearDoneText();
        let style = new PIXI.TextStyle({
            fontSize: 30,
            fill: 0xD0D0D0
        });
        this.doneText = new PIXI.Text(msg, style);
        this.doneText.x = 700;
        this.doneText.y = 350;
        this.stage.addChild(this.doneText);
    }
    tooManySteps() {
        return (this.stepsTaken >= this.board.longestExitPathLength);
    }
    // update and animate
    update() {
        if (this.done) {
            return;
        }
        else if (!this.started) {
            // set direction
            this.nextSquareRC = this.board.nextCheckerSquareRC(this.squareRC);
            this.nextPosition = this.board.centerOfSquare(this.nextSquareRC);
            this.currentFrame++;
            this.started = true;
            this.createStepsText();
            this.currentFrame = 1;
        }
        else if (this.currentFrame === 0) {
            // arrive at square
            this.checkerSprite.x = this.nextPosition.x;
            this.checkerSprite.y = this.nextPosition.y;
            this.position = this.nextPosition;
            this.squareRC = this.nextSquareRC;
            this.stepsTaken++;
            this.calculateOnBoard();
            this.createStepsText();
            this.playSound();
            if (!this.onBoard) {
                this.done = true; // exit condition
                this.createDoneText('Exited');
            }
            else if (this.tooManySteps()) {
                this.done = true; // loop condition
                this.createDoneText('Will loop');
            }
            else {
                // set next direction
                this.nextSquareRC = this.board.nextCheckerSquareRC(this.squareRC);
                this.nextPosition = this.board.centerOfSquare(this.nextSquareRC);
                this.currentFrame++;
            }
        }
        else {
            // move to next square
            let f = (this.movementFrames - this.currentFrame) / this.movementFrames;
            f = f * f; // nicer animation
            this.checkerSprite.x = f * this.position.x + (1 - f) * this.nextPosition.x;
            this.checkerSprite.y = f * this.position.y + (1 - f) * this.nextPosition.y;
            this.currentFrame++;
            if (this.currentFrame === this.movementFrames) {
                this.currentFrame = 0;
            }
        }
    }
    playSound() {
        let duration = (this.movementFrames / 60) * 300; // assuming 60 fps
        let frequency = C4 * ((2 * this.board.longestExitPathLength - 2) /
            (this.board.longestExitPathLength + this.stepsTaken - 2));
        let tone1 = new tone_1.Tone(frequency, duration, 0.09);
        tone1.play();
        let tone2 = new tone_1.Tone(frequency / 2, duration, 0.03);
        tone2.play();
    }
}
exports.Checker = Checker;

},{"./tone":5}],4:[function(require,module,exports){
/// <reference path="../typings/index.d.ts" />
/// <reference path="./board.ts" />
/// <reference path="./checker.ts" />
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const PIXI = require("pixi.js");
const board_1 = require("./board");
const checker_1 = require("./checker");
const renderer = new PIXI.WebGLRenderer(1380, 800);
document.body.appendChild(renderer.view);
// You need to create a root container that will hold the scene you want to draw.
const stage = new PIXI.Container();
let presolveButton = null;
let presolveButtonText = null;
let regenerateButton = null;
let regenerateButtonText = null;
let boardSize = 11;
let sizeLabel = null;
let sizeText = null;
let smallerButton = null;
let largerButton = null;
let createCheckerButton = null;
let createCheckerButtonText = null;
let solveButton = null;
let solveButtonText = null;
let checker = null;
let board = null;
generateBoard();
function generateBoard() {
    destroyChecker();
    if (board !== null) {
        board.destroy();
    }
    board = new board_1.Board(boardSize, stage);
    board.initBoardRender();
    createUI();
    renderer.render(stage);
}
function incrementSize() {
    boardSize++;
    createSizeUI();
    renderer.render(stage);
}
function decrementSize() {
    boardSize--;
    createSizeUI();
    renderer.render(stage);
}
let presolveAnimation = null; // to stop animation of presolving
function presolve() {
    board.presolve();
    createPresolveButton(); // create the disabled button
    function animatePresolution() {
        if (presolveAnimation !== null && board.events.length === 0) {
            cancelAnimationFrame(presolveAnimation);
            presolveAnimation = null;
            createCreateCheckerButton();
        }
        else {
            presolveAnimation = requestAnimationFrame(animatePresolution);
        }
        board.stepPresolutionAnimation();
        renderer.render(stage);
    }
    animatePresolution();
}
function destroyChecker() {
    if (checker !== null) {
        if (solveAnimation !== null) {
            cancelAnimationFrame(solveAnimation);
            solveAnimation = null;
        }
        checker.destroy();
        checker = null;
    }
}
function createChecker() {
    destroyChecker();
    let row = Math.floor(Math.random() * boardSize);
    let col = Math.floor(Math.random() * boardSize);
    checker = new checker_1.Checker(board, row, col, stage);
    checker.initCheckerRender();
    createUI();
    renderer.render(stage);
}
let solveAnimation = null;
function solve() {
    createSolveButton();
    function animateSolution() {
        if (checker.done) {
            cancelAnimationFrame(solveAnimation);
            solveAnimation = null;
        }
        else {
            solveAnimation = requestAnimationFrame(animateSolution);
        }
        checker.update();
        renderer.render(stage);
    }
    animateSolution();
}
function createUI() {
    createRegenerateButton();
    createPresolveButton();
    createSizeUI();
    createCreateCheckerButton();
    createSolveButton();
}
function createSizeUI() {
    if (sizeLabel !== null) {
        stage.removeChild(sizeLabel);
        sizeLabel = null;
    }
    if (sizeText !== null) {
        stage.removeChild(sizeText);
        sizeText = null;
    }
    if (smallerButton !== null) {
        stage.removeChild(smallerButton);
        smallerButton = null;
    }
    if (largerButton !== null) {
        stage.removeChild(largerButton);
        largerButton = null;
    }
    let style = new PIXI.TextStyle({
        fontSize: 24,
        fill: 0xD0D0D0
    });
    let label = new PIXI.Text('Size: ', style);
    label.x = 700;
    label.y = 50;
    stage.addChild(label);
    sizeLabel = label;
    let centerX = 772; // for up/down buttons
    let upButton = new PIXI.Graphics();
    upButton.beginFill(0xD0D0D0);
    upButton.drawPolygon([
        centerX, 53,
        centerX + 10, 63,
        centerX - 10, 63
    ]);
    upButton.endFill();
    upButton.interactive = true;
    upButton.on('mouseup', incrementSize);
    stage.addChild(upButton);
    largerButton = upButton;
    let downButton = new PIXI.Graphics();
    if (boardSize > 2) {
        downButton.beginFill(0xD0D0D0);
    }
    else {
        downButton.beginFill(0x808080);
    }
    downButton.drawPolygon([
        centerX, 77,
        centerX - 10, 67,
        centerX + 10, 67
    ]);
    downButton.endFill();
    if (boardSize > 2) {
        downButton.interactive = true;
        downButton.on('mouseup', decrementSize);
    }
    stage.addChild(downButton);
    smallerButton = downButton;
    let text = new PIXI.Text('' + boardSize, style);
    text.x = centerX + 14;
    text.y = 50;
    stage.addChild(text);
    sizeText = text;
}
function createRegenerateButton() {
    if (regenerateButton !== null) {
        stage.removeChild(regenerateButton);
        regenerateButton = null;
    }
    if (regenerateButtonText !== null) {
        stage.removeChild(regenerateButtonText);
        regenerateButtonText = null;
    }
    let button = new PIXI.Graphics();
    button.lineStyle(2, 0x8080FF, 1);
    button.beginFill(0xD0D0D0);
    button.drawRoundedRect(700, 90, 155, 30, 7);
    button.endFill();
    button.interactive = true;
    button.on('mouseup', generateBoard);
    stage.addChild(button);
    regenerateButton = button;
    let style = new PIXI.TextStyle({
        fontSize: 20,
        fill: 0x202020
    });
    let text = new PIXI.Text('Regenerate', style);
    text.x = 726;
    text.y = 93;
    stage.addChild(text);
    regenerateButtonText = text;
}
function createPresolveButton() {
    if (presolveButton !== null) {
        stage.removeChild(presolveButton);
        presolveButton = null;
    }
    if (presolveButtonText !== null) {
        stage.removeChild(presolveButtonText);
        presolveButtonText = null;
    }
    let button = new PIXI.Graphics();
    button.lineStyle(2, 0x8080FF, 1);
    if (board.presolved) {
        button.beginFill(0x808080);
    }
    else {
        button.beginFill(0xD0D0D0);
    }
    button.drawRoundedRect(700, 130, 155, 30, 7);
    button.endFill();
    if (!board.presolved) {
        button.interactive = true;
        button.on('mouseup', presolve);
    }
    stage.addChild(button);
    presolveButton = button;
    let style = new PIXI.TextStyle({
        fontSize: 20,
        fill: 0x202020
    });
    let text = new PIXI.Text('Presolve', style);
    text.x = 739;
    text.y = 133;
    stage.addChild(text);
    presolveButtonText = text;
}
function createCreateCheckerButton() {
    if (createCheckerButton !== null) {
        stage.removeChild(createCheckerButton);
        createCheckerButton = null;
    }
    if (createCheckerButtonText !== null) {
        stage.removeChild(createCheckerButtonText);
        createCheckerButtonText = null;
    }
    let button = new PIXI.Graphics();
    button.lineStyle(2, 0x8080FF, 1);
    if (board.presolved) {
        button.beginFill(0xD0D0D0);
    }
    else {
        button.beginFill(0x808080);
    }
    button.drawRoundedRect(700, 210, 155, 30, 7);
    button.endFill();
    if (board.presolved) {
        button.interactive = true;
        button.on('mouseup', createChecker);
    }
    stage.addChild(button);
    createCheckerButton = button;
    let style = new PIXI.TextStyle({
        fontSize: 20,
        fill: 0x202020
    });
    let text = new PIXI.Text('Create Checker', style);
    text.x = 707;
    text.y = 213;
    stage.addChild(text);
    createCheckerButtonText = text;
}
function createSolveButton() {
    if (solveButton !== null) {
        stage.removeChild(solveButton);
        solveButton = null;
    }
    if (solveButtonText !== null) {
        stage.removeChild(solveButtonText);
        solveButtonText = null;
    }
    let enabled = checker !== null && !checker.started;
    let button = new PIXI.Graphics();
    button.lineStyle(2, 0x8080FF, 1);
    if (enabled) {
        button.beginFill(0xD0D0D0);
    }
    else {
        button.beginFill(0x808080);
    }
    button.drawRoundedRect(700, 250, 155, 30, 7);
    button.endFill();
    if (enabled) {
        button.interactive = true;
        button.on('mouseup', solve);
    }
    stage.addChild(button);
    solveButton = button;
    let style = new PIXI.TextStyle({
        fontSize: 20,
        fill: 0x202020
    });
    let text = new PIXI.Text('Solve', style);
    text.x = 752;
    text.y = 253;
    stage.addChild(text);
    solveButtonText = text;
}
/*// Declare a global variable for our sprite so that the animate function can access it.
let bunny:PIXI.Sprite = null;

// load the texture we need
PIXI.loader.add('bunny', 'images/bunny.jpeg').load(function (loader:PIXI.loaders.Loader, resources:any) {
    // This creates a texture from a 'bunny.png' image.
    bunny = new PIXI.Sprite(resources.bunny.texture);

    // Setup the position and scale of the bunny
    bunny.position.x = 400;
    bunny.position.y = 300;

    bunny.scale.x = 2;
    bunny.scale.y = 2;

    // Add the bunny to the scene we are building.
    stage.addChild(bunny);

    // kick off the animation loop (defined below)
    animate();
});

function animate() {
    // start the timer for the next animation loop
    requestAnimationFrame(animate);

    // each frame we spin the bunny around a bit
    bunny.rotation += 0.01;

    // this is the main render call that makes pixi draw your container and its children.
    renderer.render(stage);
}*/

},{"./board":2,"./checker":3,"pixi.js":undefined}],5:[function(require,module,exports){
/// <reference path="../typings/index.d.ts" />
/// <reference path="./audio.ts" />
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const audio_1 = require("./audio");
const sampleRate = 44100;
const mspa = 1000 / sampleRate; // ms per audio frame
class Tone {
    constructor(frequency, duration, gain) {
        // there could be a lot more features, but we don't need them here
        this.frequency = frequency;
        this.duration = duration; // ms
        this.gain = gain;
        this.isPlaying = false;
        this.frame = 0;
        this.phase = Math.random() * 2.0 * Math.PI;
        this.envelope = {
            attack: 10,
            decay: 10,
            release: 20,
            attackGain: 2
        };
    }
    calculateFrames() {
        this.attackUntilFrame = this.envelope.attack / mspa;
        this.decayUntilFrame = this.attackUntilFrame + this.envelope.decay / mspa;
        this.sustainUntilFrame = this.duration / mspa;
        this.releaseUntilFrame = this.sustainUntilFrame + this.envelope.release / mspa;
    }
    play() {
        this.calculateFrames();
        this.isPlaying = true;
        Tone.player.notes.push(this);
    }
    generateEnvelope() {
        if (this.frame < this.attackUntilFrame) {
            return (this.frame / this.attackUntilFrame) * this.envelope.attackGain;
        }
        else if (this.frame < this.decayUntilFrame) {
            return ((this.frame - this.attackUntilFrame) /
                (this.decayUntilFrame - this.attackUntilFrame)) * (1 - this.envelope.attackGain) +
                this.envelope.attackGain;
        }
        else if (this.frame < this.sustainUntilFrame) {
            return 1.0;
        }
        else if (this.frame < this.releaseUntilFrame) {
            return 1.0 - (this.frame - this.sustainUntilFrame) /
                (this.releaseUntilFrame - this.sustainUntilFrame);
        }
        else {
            this.isPlaying = false;
            return 0;
        }
    }
    generate() {
        // triangle wave -- we could use a variety but we won't
        let sample = 2.0 * Math.abs((this.phase / Math.PI) - 1.0) - 1.0;
        sample *= this.gain * this.generateEnvelope();
        // update
        this.phase += Math.PI * this.frequency * mspa / 500;
        while (this.phase > 2 * Math.PI) {
            this.phase -= 2 * Math.PI;
        }
        this.frame++;
        return sample;
    }
}
Tone.player = new audio_1.AudioPlayer();
exports.Tone = Tone;

},{"./audio":1}]},{},[4])(4)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvYXVkaW8udHMiLCJzcmMvYm9hcmQudHMiLCJzcmMvY2hlY2tlci50cyIsInNyYy9pbmRleC50cyIsInNyYy90b25lLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUEsOENBQThDO0FBQzlDLGtDQUFrQzs7O0FBSWxDO0lBS0U7UUFDRSxJQUFJLENBQUMsR0FBRyxHQUFHLElBQUksWUFBWSxFQUFFLENBQUM7UUFDOUIsSUFBSSxDQUFDLEtBQUssR0FBRyxFQUFFLENBQUM7UUFDaEIsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLHFCQUFxQixDQUFDLElBQUksRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxrQkFBa0I7UUFDMUUsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUN4QyxJQUFJLENBQUMsSUFBSSxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN0RCxDQUFDO0lBRUQsUUFBUSxDQUFDLENBQUM7UUFDUixJQUFJLFVBQVUsR0FBRyxDQUFDLENBQUMsWUFBWSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNsRCxHQUFHLENBQUMsQ0FBQyxJQUFJLE1BQU0sR0FBRyxDQUFDLEVBQUUsTUFBTSxHQUFHLENBQUMsQ0FBQyxZQUFZLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxFQUFFLENBQUM7WUFDOUQsVUFBVSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUN2QixHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7Z0JBQzNDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO29CQUM3QyxVQUFVLENBQUMsTUFBTSxDQUFDLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQztnQkFDakQsQ0FBQztZQUNILENBQUM7UUFDSCxDQUFDO1FBQ0QsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1lBQzNDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDL0IsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUN4QixDQUFDLEVBQUUsQ0FBQztZQUNOLENBQUM7UUFDSCxDQUFDO0lBQ0gsQ0FBQztDQUNGO0FBOUJELGtDQThCQzs7O0FDbkNELDhDQUE4QztBQUM5QyxrQ0FBa0M7OztBQUVsQyxpQ0FBNEI7QUFDNUIsTUFBTSxFQUFFLEdBQUcsR0FBRyxDQUFDLENBQUMseURBQXlEO0FBRXpFLElBQUssU0FLSjtBQUxELFdBQUssU0FBUztJQUNaLHFDQUFNLENBQUE7SUFDTix5Q0FBSSxDQUFBO0lBQ0oseUNBQUksQ0FBQTtJQUNKLDJDQUFLLENBQUE7QUFDUCxDQUFDLEVBTEksU0FBUyxLQUFULFNBQVMsUUFLYjtBQUVELE1BQU0sVUFBVSxHQUFHLENBQUMsU0FBUyxDQUFDLEVBQUUsRUFBRSxTQUFTLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxJQUFJLEVBQUUsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBRW5GO0lBeUJFLFlBQVksSUFBWSxFQUFFLEtBQXFCO1FBQzdDLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO1FBQ2pCLElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO1FBQ25CLElBQUksQ0FBQyxNQUFNLEdBQUcsRUFBRSxDQUFDO1FBQ2pCLElBQUksQ0FBQyxXQUFXLEdBQUcsRUFBRSxDQUFDO1FBQ3RCLElBQUksQ0FBQyxNQUFNLEdBQUcsRUFBRSxDQUFDO1FBQ2pCLElBQUksQ0FBQyxZQUFZLEdBQUcsRUFBRSxDQUFDO1FBQ3ZCLElBQUksQ0FBQyxTQUFTLEdBQUcsS0FBSyxDQUFDO1FBQ3ZCLElBQUksQ0FBQyxtQkFBbUIsR0FBRyxDQUFDLENBQUM7UUFDN0IsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQ25CLElBQUksQ0FBQyxtQkFBbUIsR0FBRyxDQUFDLENBQUMsQ0FBQyxpQ0FBaUM7UUFDakUsQ0FBQztRQUNELElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxDQUFDLENBQUM7UUFDMUIsSUFBSSxDQUFDLGtCQUFrQixHQUFHLENBQUMsQ0FBQztRQUM1QixJQUFJLENBQUMsRUFBRSxHQUFHLEVBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFDLENBQUM7UUFDMUIsSUFBSSxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUM7UUFDYixJQUFJLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQztRQUNiLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLENBQUMsR0FBQyxDQUFDLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQztRQUNuQyxJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxDQUFDLEdBQUMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDcEMsSUFBSSxDQUFDLGtCQUFrQixHQUFHLEVBQUUsQ0FBQztRQUM3QixJQUFJLENBQUMsdUJBQXVCLEdBQUcsRUFBRSxDQUFDO1FBQ2xDLElBQUksQ0FBQyxXQUFXLEdBQUcsRUFBRSxDQUFDO1FBQ3RCLElBQUksQ0FBQyxXQUFXLEdBQUcsRUFBRSxDQUFDO1FBQ3RCLElBQUksQ0FBQyxZQUFZLEdBQUcsRUFBRSxDQUFDO1FBQ3ZCLElBQUksQ0FBQyxlQUFlLEdBQUcsSUFBSSxDQUFDO1FBQzVCLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxHQUFHLElBQUksRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1lBQ3JDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsVUFBVSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxHQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxpQkFBaUI7WUFDM0UsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUMsQ0FBQyx5QkFBeUI7WUFDdEQsSUFBSSxDQUFDLGtCQUFrQixDQUFDLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQztZQUNuQyxJQUFJLENBQUMsdUJBQXVCLENBQUMsQ0FBQyxDQUFDLEdBQUcsS0FBSyxDQUFDO1lBQ3hDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDO1lBQzNCLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDO1FBQzlCLENBQUM7SUFDSCxDQUFDO0lBRUQsR0FBRyxDQUFDLE1BQWM7UUFDaEIsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN0QyxDQUFDO0lBRUQsR0FBRyxDQUFDLE1BQWM7UUFDaEIsTUFBTSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO0lBQzVCLENBQUM7SUFFRCxNQUFNLENBQUMsR0FBVyxFQUFFLEdBQVc7UUFDN0IsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLEdBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQztJQUM3QixDQUFDO0lBRUQsRUFBRSxDQUFDLE1BQWM7UUFDZixFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDM0IsTUFBTSxDQUFDLElBQUksQ0FBQztRQUNkLENBQUM7UUFBQyxJQUFJLENBQUMsQ0FBQztZQUNOLE1BQU0sQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQztRQUM1QixDQUFDO0lBQ0gsQ0FBQztJQUVELElBQUksQ0FBQyxNQUFjO1FBQ2pCLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEtBQUssSUFBSSxDQUFDLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3ZDLE1BQU0sQ0FBQyxJQUFJLENBQUM7UUFDZCxDQUFDO1FBQUMsSUFBSSxDQUFDLENBQUM7WUFDTixNQUFNLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUM7UUFDNUIsQ0FBQztJQUNILENBQUM7SUFFRCxJQUFJLENBQUMsTUFBYztRQUNqQixFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDM0IsTUFBTSxDQUFDLElBQUksQ0FBQztRQUNkLENBQUM7UUFBQyxJQUFJLENBQUMsQ0FBQztZQUNOLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO1FBQ3BCLENBQUM7SUFDSCxDQUFDO0lBRUQsS0FBSyxDQUFDLE1BQWM7UUFDbEIsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsS0FBSyxJQUFJLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDdkMsTUFBTSxDQUFDLElBQUksQ0FBQztRQUNkLENBQUM7UUFBQyxJQUFJLENBQUMsQ0FBQztZQUNOLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO1FBQ3BCLENBQUM7SUFDSCxDQUFDO0lBRUQsSUFBSSxDQUFDLE1BQWM7UUFDakIsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDNUIsS0FBSyxTQUFTLENBQUMsRUFBRTtnQkFDZixNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUN6QixLQUFLLFNBQVMsQ0FBQyxJQUFJO2dCQUNqQixNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUMzQixLQUFLLFNBQVMsQ0FBQyxJQUFJO2dCQUNqQixNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUMzQixLQUFLLFNBQVMsQ0FBQyxLQUFLO2dCQUNsQixNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUM1QjtnQkFDRSxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsc0JBQXNCO1FBQ3ZDLENBQUM7SUFDSCxDQUFDO0lBRUQsbUJBQW1CLENBQUMsUUFBb0M7UUFDdEQsRUFBRSxDQUFDLENBQUMsUUFBUSxDQUFDLEdBQUcsR0FBRyxDQUFDLElBQUksUUFBUSxDQUFDLEdBQUcsSUFBSSxJQUFJLENBQUMsSUFBSTtlQUMxQyxRQUFRLENBQUMsR0FBRyxHQUFHLENBQUMsSUFBSSxRQUFRLENBQUMsR0FBRyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1lBQ3JELE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxnQ0FBZ0M7UUFDL0MsQ0FBQztRQUNELElBQUksTUFBTSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLEdBQUcsRUFBRSxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDckQsMERBQTBEO1FBQzFELG9DQUFvQztRQUNwQyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUM1QixLQUFLLFNBQVMsQ0FBQyxFQUFFO2dCQUNmLE1BQU0sQ0FBQyxFQUFDLEdBQUcsRUFBRSxRQUFRLENBQUMsR0FBRyxHQUFHLENBQUMsRUFBRSxHQUFHLEVBQUUsUUFBUSxDQUFDLEdBQUcsRUFBQyxDQUFDO1lBQ3BELEtBQUssU0FBUyxDQUFDLElBQUk7Z0JBQ2pCLE1BQU0sQ0FBQyxFQUFDLEdBQUcsRUFBRSxRQUFRLENBQUMsR0FBRyxHQUFHLENBQUMsRUFBRSxHQUFHLEVBQUUsUUFBUSxDQUFDLEdBQUcsRUFBQyxDQUFDO1lBQ3BELEtBQUssU0FBUyxDQUFDLElBQUk7Z0JBQ2pCLE1BQU0sQ0FBQyxFQUFDLEdBQUcsRUFBRSxRQUFRLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxRQUFRLENBQUMsR0FBRyxHQUFHLENBQUMsRUFBQyxDQUFDO1lBQ3BELEtBQUssU0FBUyxDQUFDLEtBQUs7Z0JBQ2xCLE1BQU0sQ0FBQyxFQUFDLEdBQUcsRUFBRSxRQUFRLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxRQUFRLENBQUMsR0FBRyxHQUFHLENBQUMsRUFBQyxDQUFDO1lBQ3BEO2dCQUNFLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxzQkFBc0I7UUFDdkMsQ0FBQztJQUNILENBQUM7SUFFRCxNQUFNLENBQUMsS0FBYTtRQUNsQixJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNoQyxDQUFDO0lBRUQsU0FBUztRQUNQLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUNwQyxJQUFJLENBQUMsWUFBWSxHQUFHLEVBQUUsQ0FBQztJQUN6QixDQUFDO0lBRUQsNEVBQTRFO0lBQzVFLHdFQUF3RTtJQUN4RSx3RUFBd0U7SUFDeEUsNEVBQTRFO0lBQzVFLDhEQUE4RDtJQUM5RCxFQUFFO0lBQ0YsNEVBQTRFO0lBQzVFLDJFQUEyRTtJQUMzRSw0RUFBNEU7SUFDNUUsMkVBQTJFO0lBQzNFLDBFQUEwRTtJQUMxRSxvQ0FBb0M7SUFDcEMsRUFBRTtJQUNGLDZFQUE2RTtJQUM3RSwyRUFBMkU7SUFDM0Usc0VBQXNFO0lBQ3RFLHFEQUFxRDtJQUNyRCxFQUFFO0lBQ0YsNEVBQTRFO0lBQzVFLDJFQUEyRTtJQUMzRSx3RUFBd0U7SUFDeEUsaUJBQWlCO0lBQ2pCLFFBQVE7UUFDTixJQUFJLElBQUksR0FBRyxJQUFJLENBQUM7UUFDaEIsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7WUFDbkIsTUFBTSxDQUFDO1FBQ1QsQ0FBQztRQUNELElBQUksV0FBVyxHQUFHLENBQUMsQ0FBQztRQUNwQixJQUFJLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyx3QkFBd0I7UUFDdkMsd0VBQXdFO1FBQ3hFLHVDQUF1QztRQUV2QyxzQkFBc0I7UUFDdEIsdUJBQXVCLE1BQWM7WUFDbkMsSUFBSSxXQUFXLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQTtZQUM5QixJQUFJLFNBQVMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztZQUM1RixHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztnQkFDMUMsRUFBRSxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxLQUFLLElBQUksSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLE1BQU0sQ0FBQyxDQUFDLENBQUM7b0JBQ2hFLEtBQUssRUFBRSxDQUFDO29CQUNSLElBQUksQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDO29CQUN0QyxJQUFJLENBQUMsTUFBTSxDQUFDO3dCQUNWLEtBQUssRUFBRSxlQUFlO3dCQUN0QixNQUFNLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQztxQkFDckIsQ0FBQyxDQUFDO29CQUNILElBQUksQ0FBQyxNQUFNLENBQUM7d0JBQ1YsS0FBSyxFQUFFLG9CQUFvQjt3QkFDM0IsTUFBTSxFQUFFLE1BQU07cUJBQ2YsQ0FBQyxDQUFDO29CQUNILElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztvQkFDakIsV0FBVyxDQUFDLENBQUMsQ0FBQyxHQUFHLGFBQWEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDN0MsSUFBSSxDQUFDLE1BQU0sQ0FBQzt3QkFDVixLQUFLLEVBQUUsdUJBQXVCO3dCQUM5QixNQUFNLEVBQUUsTUFBTTtxQkFDZixDQUFDLENBQUM7b0JBQ0gsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO2dCQUNuQixDQUFDO1lBQ0gsQ0FBQztZQUNELE1BQU0sQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLFdBQVcsQ0FBQyxDQUFDO1FBQ3RDLENBQUM7UUFFRCw0Q0FBNEM7UUFDNUMsb0VBQW9FO1FBQ3BFLG1FQUFtRTtRQUNuRSxvRUFBb0U7UUFDcEUscUVBQXFFO1FBQ3JFLGdFQUFnRTtRQUNoRSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxJQUFJLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7WUFDdkMsSUFBSSxhQUFhLEdBQUc7Z0JBQ2xCLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQztnQkFDakIsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLElBQUksR0FBRyxDQUFDLENBQUM7Z0JBQzdCLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksR0FBRyxDQUFDLEVBQUUsSUFBSSxDQUFDLElBQUksR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUM3QyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxhQUFhO2FBQ2hELENBQUM7WUFDRixHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO2dCQUMzQixFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUM7b0JBQ3pDLEtBQUssRUFBRSxDQUFDO29CQUNSLElBQUksQ0FBQyxXQUFXLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDO29CQUMxQyxJQUFJLENBQUMsTUFBTSxDQUFDO3dCQUNWLEtBQUssRUFBRSxlQUFlO3dCQUN0QixNQUFNLEVBQUUsYUFBYSxDQUFDLENBQUMsQ0FBQztxQkFDekIsQ0FBQyxDQUFDO29CQUNILElBQUksQ0FBQyxNQUFNLENBQUM7d0JBQ1YsS0FBSyxFQUFFLG9CQUFvQjt3QkFDM0IsTUFBTSxFQUFFLGFBQWEsQ0FBQyxDQUFDLENBQUM7cUJBQ3pCLENBQUMsQ0FBQztvQkFDSCxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7b0JBQ2pCLElBQUksVUFBVSxHQUFHLGFBQWEsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDakQsSUFBSSxDQUFDLE1BQU0sQ0FBQzt3QkFDVixLQUFLLEVBQUUsdUJBQXVCO3dCQUM5QixNQUFNLEVBQUUsYUFBYSxDQUFDLENBQUMsQ0FBQztxQkFDekIsQ0FBQyxDQUFDO29CQUNILEVBQUUsQ0FBQyxDQUFDLFVBQVUsR0FBRyxXQUFXLENBQUMsQ0FBQyxDQUFDO3dCQUM3QixXQUFXLEdBQUcsVUFBVSxDQUFDO3dCQUN6QixJQUFJLENBQUMsTUFBTSxDQUFDOzRCQUNWLEtBQUssRUFBRSxtQkFBbUI7NEJBQzFCLEtBQUssRUFBRSxXQUFXO3lCQUNuQixDQUFDLENBQUM7b0JBQ0wsQ0FBQztvQkFDRCxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7Z0JBQ25CLENBQUM7WUFDSCxDQUFDO1FBQ0gsQ0FBQztRQUVELElBQUksQ0FBQyxxQkFBcUIsR0FBRyxXQUFXLENBQUM7UUFDekMsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUM7SUFDeEIsQ0FBQztJQUVELGtCQUFrQixDQUFDLEtBQVU7UUFDM0IsTUFBTSxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7WUFDcEIsS0FBSyxtQkFBbUI7Z0JBQ3RCLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDO2dCQUN0QyxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7Z0JBQ3ZCLEtBQUssQ0FBQztZQUNSLEtBQUssZUFBZTtnQkFDbEIsSUFBSSxDQUFDLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsR0FBRyxJQUFJLENBQUM7Z0JBQzdDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBQ3BDLEtBQUssQ0FBQztZQUNSLEtBQUssb0JBQW9CO2dCQUN2QixJQUFJLENBQUMsdUJBQXVCLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxHQUFHLElBQUksQ0FBQztnQkFDbEQsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztnQkFDcEMsS0FBSyxDQUFDO1lBQ1IsS0FBSyx1QkFBdUI7Z0JBQzFCLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLEdBQUcsS0FBSyxDQUFDO2dCQUNuRCxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUNwQyxLQUFLLENBQUM7UUFDVixDQUFDO0lBQ0gsQ0FBQztJQUVELFNBQVM7UUFDUCxpQ0FBaUM7UUFDakMsSUFBSSxTQUFTLEdBQUcsQ0FBQyxHQUFDLENBQUMsQ0FBQyxHQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUMsRUFBRSxDQUFDLENBQUMsZ0NBQWdDO1FBQzlFLHlFQUF5RTtRQUN6RSwwRUFBMEU7UUFDMUUsdUVBQXVFO1FBQ3ZFLHFFQUFxRTtRQUNyRSxJQUFJLFFBQVEsR0FBRyxDQUFDLElBQUksQ0FBQyxtQkFBbUIsR0FBQyxFQUFFLENBQUMsR0FBQyxHQUFHLENBQUMsQ0FBQyxrQkFBa0I7UUFDcEUsSUFBSSxJQUFJLEdBQUcsSUFBSSxXQUFJLENBQUMsU0FBUyxFQUFFLFFBQVEsRUFBRSxHQUFHLENBQUMsQ0FBQztRQUM5QyxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7SUFDZCxDQUFDO0lBRUQsd0JBQXdCO1FBQ3RCLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN6RCxJQUFJLFlBQVksR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ3ZDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsWUFBWSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO2dCQUM3QyxJQUFJLENBQUMsa0JBQWtCLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDM0MsQ0FBQztZQUNELElBQUksQ0FBQyxnQkFBZ0IsSUFBSSxJQUFJLENBQUMsbUJBQW1CLENBQUM7WUFDbEQsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1FBQ25CLENBQUM7UUFBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLGdCQUFnQixHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDckMsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7UUFDMUIsQ0FBQztJQUNILENBQUM7SUFFRCxPQUFPO1FBQ0wsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7UUFDekIsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO0lBQ3hCLENBQUM7SUFFRCxlQUFlO1FBQ2IsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7UUFDekIsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7UUFDMUIsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO0lBQ3pCLENBQUM7SUFFRCxjQUFjO1FBQ1osSUFBSSxDQUFDLG9CQUFvQixFQUFFLENBQUM7SUFDOUIsQ0FBQztJQUVELG9CQUFvQjtRQUNsQixFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsZUFBZSxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUM7WUFDbEMsSUFBSSxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDO1lBQzdDLElBQUksQ0FBQyxlQUFlLEdBQUcsSUFBSSxDQUFDO1FBQzlCLENBQUM7SUFDSCxDQUFDO0lBRUQsZUFBZTtRQUNiLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztRQUN0QixJQUFJLEtBQUssR0FBRyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUM7WUFDN0IsUUFBUSxFQUFFLEVBQUU7WUFDWixJQUFJLEVBQUUsUUFBUTtTQUNmLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxlQUFlLEdBQUcsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLHVCQUF1QixHQUFHLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUMvRixJQUFJLENBQUMsZUFBZSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUM7UUFDNUIsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDO1FBQzVCLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQztJQUM1QyxDQUFDO0lBRUQsaUJBQWlCO1FBQ2YsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1lBQ2pELElBQUksQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUM5QyxDQUFDO1FBQ0QsSUFBSSxDQUFDLFdBQVcsR0FBRyxFQUFFLENBQUM7UUFDdEIsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsSUFBSSxHQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztZQUM3QyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQywyQkFBMkI7UUFDdkQsQ0FBQztJQUNILENBQUM7SUFFRCxnQkFBZ0IsQ0FBQyxNQUFjO1FBQzdCLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQztZQUN0QyxJQUFJLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7UUFDbkQsQ0FBQztRQUNELElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDO1FBQ2hDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNqQyxDQUFDO0lBRUQsaUJBQWlCLENBQUMsTUFBYztRQUM5QixFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUM7WUFDdkMsSUFBSSxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO1FBQ3BELENBQUM7UUFDRCxJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxHQUFHLElBQUksQ0FBQztJQUNuQyxDQUFDO0lBRUQsa0JBQWtCO1FBQ2hCLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1FBQ3pCLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1FBQ3pCLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLElBQUksR0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7WUFDN0MsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzNCLENBQUM7SUFDSCxDQUFDO0lBRUQsaUJBQWlCO1FBQ2YsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxJQUFJLENBQUMsSUFBSSxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDO1lBQ3hDLElBQUksS0FBSyxHQUFHLElBQUksSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ2hDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLFFBQVEsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUNoQyxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUcsR0FBRyxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDOUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDLEdBQUMsSUFBSSxDQUFDLFNBQVMsR0FBRyxHQUFHLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUM5RixJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUMzQixJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUU3QixJQUFJLEtBQUssR0FBRyxJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUNoQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDaEMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsU0FBUyxHQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsVUFBVSxHQUFHLEdBQUcsQ0FBQyxDQUFDO1lBQzlFLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLFNBQVMsR0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQyxHQUFDLElBQUksQ0FBQyxVQUFVLEdBQUcsR0FBRyxDQUFDLENBQUM7WUFDOUYsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDM0IsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDL0IsQ0FBQztJQUNILENBQUM7SUFFRCxnQkFBZ0IsQ0FBQyxNQUFjO1FBQzdCLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLDRCQUE0QjtRQUMzRCxJQUFJLElBQUksR0FBRyxJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUMvQixFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsdUJBQXVCLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3pDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLFFBQVEsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLGtDQUFrQztRQUNwRSxDQUFDO1FBQUMsSUFBSSxDQUFDLENBQUM7WUFDTixJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDakMsQ0FBQztRQUNELEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDcEMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUMzQixDQUFDO1FBQUMsSUFBSSxDQUFDLENBQUM7WUFDTixJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzNCLENBQUM7UUFDRCxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3pCLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDekIsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsU0FBUyxHQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsRUFDdEMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLFVBQVUsR0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQ3ZDLElBQUksQ0FBQyxTQUFTLEdBQUcsQ0FBQyxFQUNsQixJQUFJLENBQUMsVUFBVSxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ25DLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUNmLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzFCLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDO1FBQ2hDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNqQyxDQUFDO0lBRUQsaUJBQWlCLENBQUMsTUFBYztRQUM5QixJQUFJLE1BQU0sR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDO1lBQy9CLEdBQUcsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQztZQUNyQixHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUM7U0FDdEIsQ0FBQyxDQUFDO1FBQ0gsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBQyxDQUFDLENBQUMsQ0FBQyw0QkFBNEI7UUFDdEQsSUFBSSxLQUFLLEdBQUcsSUFBSSxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDaEMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUMxQixNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUMxQixLQUFLLFNBQVMsQ0FBQyxFQUFFO2dCQUNmLEtBQUssQ0FBQyxXQUFXLENBQUM7b0JBQ2hCLE1BQU0sQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsVUFBVSxHQUFDLEtBQUs7b0JBQzFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsTUFBTSxDQUFDLENBQUM7b0JBQ3JDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsTUFBTSxDQUFDLENBQUM7aUJBQ3RDLENBQUMsQ0FBQztnQkFDSCxLQUFLLENBQUM7WUFDUixLQUFLLFNBQVMsQ0FBQyxJQUFJO2dCQUNqQixLQUFLLENBQUMsV0FBVyxDQUFDO29CQUNoQixNQUFNLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLFVBQVUsR0FBQyxLQUFLO29CQUMxQyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLE1BQU0sQ0FBQyxDQUFDO29CQUNyQyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLE1BQU0sQ0FBQyxDQUFDO2lCQUN0QyxDQUFDLENBQUM7Z0JBQ0gsS0FBSyxDQUFDO1lBQ1IsS0FBSyxTQUFTLENBQUMsSUFBSTtnQkFDakIsS0FBSyxDQUFDLFdBQVcsQ0FBQztvQkFDaEIsTUFBTSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsVUFBVSxHQUFDLEtBQUssRUFBRSxNQUFNLENBQUMsQ0FBQztvQkFDMUMsTUFBTSxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBQyxJQUFJLENBQUMsVUFBVTtvQkFDdEMsTUFBTSxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBQyxJQUFJLENBQUMsVUFBVTtpQkFDdkMsQ0FBQyxDQUFDO2dCQUNILEtBQUssQ0FBQztZQUNSLEtBQUssU0FBUyxDQUFDLEtBQUs7Z0JBQ2xCLEtBQUssQ0FBQyxXQUFXLENBQUM7b0JBQ2hCLE1BQU0sQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLFVBQVUsR0FBQyxLQUFLLEVBQUUsTUFBTSxDQUFDLENBQUM7b0JBQzFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUMsSUFBSSxDQUFDLFVBQVU7b0JBQ3RDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUMsSUFBSSxDQUFDLFVBQVU7aUJBQ3ZDLENBQUMsQ0FBQztnQkFDSCxLQUFLLENBQUM7UUFDWixDQUFDO1FBQ0QsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ2hCLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQzNCLElBQUksQ0FBQyxZQUFZLENBQUMsTUFBTSxDQUFDLEdBQUcsS0FBSyxDQUFDO0lBQ3BDLENBQUM7SUFFRCxjQUFjLENBQUMsUUFBb0M7UUFDakQsTUFBTSxDQUFDO1lBQ0wsQ0FBQyxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxTQUFTLEdBQUMsQ0FBQyxRQUFRLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQztZQUNsRCxDQUFDLEVBQUUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLFVBQVUsR0FBQyxDQUFDLFFBQVEsQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDO1NBQ3BELENBQUE7SUFDSCxDQUFDO0NBQ0Y7QUEvY0Qsc0JBK2NDOzs7QUM5ZEQsOENBQThDO0FBQzlDLG1DQUFtQztBQUNuQyxrQ0FBa0M7OztBQUdsQyxpQ0FBNEI7QUFDNUIsTUFBTSxFQUFFLEdBQUcsR0FBRyxDQUFDLENBQUMseURBQXlEO0FBRXpFO0lBbUJFLFlBQVksS0FBWSxFQUFFLEdBQVcsRUFBRSxHQUFXLEVBQUUsS0FBcUI7UUFDdkUsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7UUFDbkIsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7UUFDbkIsSUFBSSxDQUFDLFFBQVEsR0FBRyxFQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBQyxDQUFDO1FBQ3JDLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1FBQ3hCLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ3pELElBQUksQ0FBQyxVQUFVLEdBQUcsQ0FBQyxDQUFDO1FBQ3BCLElBQUksQ0FBQyxPQUFPLEdBQUcsS0FBSyxDQUFDO1FBQ3JCLElBQUksQ0FBQyxJQUFJLEdBQUcsS0FBSyxDQUFDO1FBQ2xCLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztRQUN2QixJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQztRQUMxQixJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQztRQUN0QixJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQztRQUNyQixJQUFJLENBQUMsY0FBYyxHQUFHLEVBQUUsQ0FBQztRQUN6QixFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQ3pCLElBQUksQ0FBQyxjQUFjLEdBQUcsRUFBRSxDQUFDLENBQUMsaUNBQWlDO1FBQzdELENBQUM7SUFDSCxDQUFDO0lBRUQsaUJBQWlCO1FBQ2YsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO0lBQ3ZCLENBQUM7SUFFRCxnQkFBZ0I7UUFDZCxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJO2VBQzFELElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxJQUFJLENBQUMsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7WUFDckUsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUM7UUFDdEIsQ0FBQztRQUFDLElBQUksQ0FBQyxDQUFDO1lBQ04sSUFBSSxDQUFDLE9BQU8sR0FBRyxLQUFLLENBQUM7UUFDdkIsQ0FBQztJQUNILENBQUM7SUFFRCxlQUFlO1FBQ2IsSUFBSSxRQUFRLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ3JFLElBQUksQ0FBQyxNQUFNLEdBQUcsUUFBUSxHQUFDLENBQUMsQ0FBQztJQUMzQixDQUFDO0lBRUQsT0FBTztRQUNMLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztJQUN0QixDQUFDO0lBRUQsWUFBWTtRQUNWLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO1FBQzFCLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztRQUN0QixJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7SUFDdkIsQ0FBQztJQUVELGFBQWE7UUFDWCxJQUFJLENBQUMsbUJBQW1CLEVBQUUsQ0FBQztRQUMzQixJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7SUFDekIsQ0FBQztJQUVELGtCQUFrQjtRQUNoQixFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYSxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUM7WUFDaEMsSUFBSSxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDO1FBQzdDLENBQUM7UUFDRCxJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQztJQUM1QixDQUFDO0lBRUQsY0FBYztRQUNaLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQztZQUM1QixJQUFJLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDekMsQ0FBQztRQUNELElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDO0lBQ3hCLENBQUM7SUFFRCxhQUFhO1FBQ1gsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDO1lBQzNCLElBQUksQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUN4QyxDQUFDO1FBQ0QsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUM7SUFDdkIsQ0FBQztJQUVELG1CQUFtQjtRQUNqQixJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztRQUMxQixJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQ3pDLElBQUksQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDN0MsSUFBSSxDQUFDLGFBQWEsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDdkMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxVQUFVLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDakQsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7UUFDdkMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7UUFDdkMsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBQzFDLENBQUM7SUFFRCxlQUFlO1FBQ2IsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO1FBRXRCLElBQUksS0FBSyxDQUFDO1FBQ1YsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztZQUNsQixLQUFLLEdBQUcsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDO2dCQUN6QixRQUFRLEVBQUUsRUFBRTtnQkFDWixJQUFJLEVBQUUsUUFBUTthQUNmLENBQUMsQ0FBQztRQUNMLENBQUM7UUFBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUMsQ0FBQztZQUMvQixLQUFLLEdBQUcsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDO2dCQUN6QixRQUFRLEVBQUUsRUFBRTtnQkFDWixJQUFJLEVBQUUsUUFBUTthQUNmLENBQUMsQ0FBQztRQUNMLENBQUM7UUFBQyxJQUFJLENBQUMsQ0FBQztZQUNOLEtBQUssR0FBRyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUM7Z0JBQ3pCLFFBQVEsRUFBRSxFQUFFO2dCQUNaLElBQUksRUFBRSxRQUFRO2FBQ2YsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUVELElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLGVBQWUsR0FBRyxJQUFJLENBQUMsVUFBVSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ3pFLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQztRQUN2QixJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUM7UUFDdkIsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQ3RDLENBQUM7SUFFRCxjQUFjLENBQUMsR0FBVztRQUN4QixJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7UUFFckIsSUFBSSxLQUFLLEdBQUcsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDO1lBQzdCLFFBQVEsRUFBRSxFQUFFO1lBQ1osSUFBSSxFQUFFLFFBQVE7U0FDZixDQUFDLENBQUM7UUFFSCxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFDMUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDO1FBQ3RCLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQztRQUN0QixJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDckMsQ0FBQztJQUVELFlBQVk7UUFDVixNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMscUJBQXFCLENBQUMsQ0FBQztJQUMvRCxDQUFDO0lBRUQscUJBQXFCO0lBQ3JCLE1BQU07UUFDSixFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztZQUNkLE1BQU0sQ0FBQztRQUNULENBQUM7UUFBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztZQUN6QixnQkFBZ0I7WUFDaEIsSUFBSSxDQUFDLFlBQVksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUNsRSxJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUNqRSxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDcEIsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUM7WUFDcEIsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO1lBQ3ZCLElBQUksQ0FBQyxZQUFZLEdBQUcsQ0FBQyxDQUFDO1FBQ3hCLENBQUM7UUFBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFlBQVksS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ25DLG1CQUFtQjtZQUNuQixJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQztZQUMzQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQztZQUMzQyxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUM7WUFDbEMsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDO1lBQ2xDLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztZQUNsQixJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQztZQUN4QixJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7WUFDdkIsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ2pCLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7Z0JBQ2xCLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLENBQUMsaUJBQWlCO2dCQUNuQyxJQUFJLENBQUMsY0FBYyxDQUFDLFFBQVEsQ0FBQyxDQUFBO1lBQy9CLENBQUM7WUFBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUMsQ0FBQztnQkFDL0IsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsQ0FBQyxpQkFBaUI7Z0JBQ25DLElBQUksQ0FBQyxjQUFjLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDbkMsQ0FBQztZQUFDLElBQUksQ0FBQyxDQUFDO2dCQUNOLHFCQUFxQjtnQkFDckIsSUFBSSxDQUFDLFlBQVksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztnQkFDbEUsSUFBSSxDQUFDLFlBQVksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7Z0JBQ2pFLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUN0QixDQUFDO1FBQ0gsQ0FBQztRQUFDLElBQUksQ0FBQyxDQUFDO1lBQ04sc0JBQXNCO1lBQ3RCLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLEdBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQztZQUN0RSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLGtCQUFrQjtZQUM3QixJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7WUFDdkUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO1lBQ3ZFLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUNwQixFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsWUFBWSxLQUFLLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDO2dCQUM5QyxJQUFJLENBQUMsWUFBWSxHQUFHLENBQUMsQ0FBQztZQUN4QixDQUFDO1FBQ0gsQ0FBQztJQUNILENBQUM7SUFFRCxTQUFTO1FBQ1AsSUFBSSxRQUFRLEdBQUcsQ0FBQyxJQUFJLENBQUMsY0FBYyxHQUFDLEVBQUUsQ0FBQyxHQUFDLEdBQUcsQ0FBQyxDQUFDLGtCQUFrQjtRQUMvRCxJQUFJLFNBQVMsR0FBRyxFQUFFLEdBQUMsQ0FBQyxDQUFDLENBQUMsR0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLHFCQUFxQixHQUFHLENBQUMsQ0FBQztZQUMxRCxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMscUJBQXFCLEdBQUcsSUFBSSxDQUFDLFVBQVUsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzVELElBQUksS0FBSyxHQUFHLElBQUksV0FBSSxDQUFDLFNBQVMsRUFBRSxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDaEQsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ2IsSUFBSSxLQUFLLEdBQUcsSUFBSSxXQUFJLENBQUMsU0FBUyxHQUFDLENBQUMsRUFBRSxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDbEQsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDO0lBQ2YsQ0FBQztDQUNGO0FBNU1ELDBCQTRNQzs7O0FDcE5ELDhDQUE4QztBQUM5QyxtQ0FBbUM7QUFDbkMscUNBQXFDOzs7QUFFckMsZ0NBQWlDO0FBQ2pDLG1DQUE4QjtBQUM5Qix1Q0FBa0M7QUFDbEMsTUFBTSxRQUFRLEdBQXNCLElBQUksSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFDdEUsUUFBUSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBRXpDLGlGQUFpRjtBQUNqRixNQUFNLEtBQUssR0FBa0IsSUFBSSxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7QUFFbEQsSUFBSSxjQUFjLEdBQUcsSUFBSSxDQUFDO0FBQzFCLElBQUksa0JBQWtCLEdBQUcsSUFBSSxDQUFDO0FBQzlCLElBQUksZ0JBQWdCLEdBQUcsSUFBSSxDQUFDO0FBQzVCLElBQUksb0JBQW9CLEdBQUcsSUFBSSxDQUFDO0FBQ2hDLElBQUksU0FBUyxHQUFHLEVBQUUsQ0FBQztBQUNuQixJQUFJLFNBQVMsR0FBRyxJQUFJLENBQUM7QUFDckIsSUFBSSxRQUFRLEdBQUcsSUFBSSxDQUFDO0FBQ3BCLElBQUksYUFBYSxHQUFHLElBQUksQ0FBQztBQUN6QixJQUFJLFlBQVksR0FBRyxJQUFJLENBQUM7QUFDeEIsSUFBSSxtQkFBbUIsR0FBRyxJQUFJLENBQUM7QUFDL0IsSUFBSSx1QkFBdUIsR0FBRyxJQUFJLENBQUM7QUFDbkMsSUFBSSxXQUFXLEdBQUcsSUFBSSxDQUFDO0FBQ3ZCLElBQUksZUFBZSxHQUFHLElBQUksQ0FBQztBQUczQixJQUFJLE9BQU8sR0FBRyxJQUFJLENBQUM7QUFFbkIsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDO0FBQ2pCLGFBQWEsRUFBRSxDQUFDO0FBRWhCO0lBQ0UsY0FBYyxFQUFFLENBQUM7SUFDakIsRUFBRSxDQUFDLENBQUMsS0FBSyxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDbkIsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBQ2xCLENBQUM7SUFDRCxLQUFLLEdBQUcsSUFBSSxhQUFLLENBQUMsU0FBUyxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ3BDLEtBQUssQ0FBQyxlQUFlLEVBQUUsQ0FBQztJQUN4QixRQUFRLEVBQUUsQ0FBQztJQUNYLFFBQVEsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDekIsQ0FBQztBQUVEO0lBQ0UsU0FBUyxFQUFFLENBQUM7SUFDWixZQUFZLEVBQUUsQ0FBQztJQUNmLFFBQVEsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDekIsQ0FBQztBQUVEO0lBQ0UsU0FBUyxFQUFFLENBQUM7SUFDWixZQUFZLEVBQUUsQ0FBQztJQUNmLFFBQVEsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDekIsQ0FBQztBQUVELElBQUksaUJBQWlCLEdBQUcsSUFBSSxDQUFDLENBQUMsa0NBQWtDO0FBQ2hFO0lBQ0UsS0FBSyxDQUFDLFFBQVEsRUFBRSxDQUFDO0lBQ2pCLG9CQUFvQixFQUFFLENBQUMsQ0FBQyw2QkFBNkI7SUFDckQ7UUFDRSxFQUFFLENBQUMsQ0FBQyxpQkFBaUIsS0FBSyxJQUFJLElBQUksS0FBSyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUM1RCxvQkFBb0IsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1lBQ3hDLGlCQUFpQixHQUFHLElBQUksQ0FBQztZQUN6Qix5QkFBeUIsRUFBRSxDQUFDO1FBQzlCLENBQUM7UUFBQyxJQUFJLENBQUMsQ0FBQztZQUNOLGlCQUFpQixHQUFHLHFCQUFxQixDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFDaEUsQ0FBQztRQUNELEtBQUssQ0FBQyx3QkFBd0IsRUFBRSxDQUFDO1FBQ2pDLFFBQVEsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDekIsQ0FBQztJQUNELGtCQUFrQixFQUFFLENBQUM7QUFDdkIsQ0FBQztBQUVEO0lBQ0UsRUFBRSxDQUFDLENBQUMsT0FBTyxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDckIsRUFBRSxDQUFDLENBQUMsY0FBYyxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUM7WUFDNUIsb0JBQW9CLENBQUMsY0FBYyxDQUFDLENBQUM7WUFDckMsY0FBYyxHQUFHLElBQUksQ0FBQztRQUN4QixDQUFDO1FBQ0QsT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO1FBQ2xCLE9BQU8sR0FBRyxJQUFJLENBQUM7SUFDakIsQ0FBQztBQUNILENBQUM7QUFFRDtJQUNFLGNBQWMsRUFBRSxDQUFDO0lBQ2pCLElBQUksR0FBRyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxHQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQzlDLElBQUksR0FBRyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxHQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQzlDLE9BQU8sR0FBRyxJQUFJLGlCQUFPLENBQUMsS0FBSyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDOUMsT0FBTyxDQUFDLGlCQUFpQixFQUFFLENBQUM7SUFDNUIsUUFBUSxFQUFFLENBQUM7SUFDWCxRQUFRLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ3pCLENBQUM7QUFFRCxJQUFJLGNBQWMsR0FBRyxJQUFJLENBQUM7QUFDMUI7SUFDRSxpQkFBaUIsRUFBRSxDQUFDO0lBQ3BCO1FBQ0UsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7WUFDakIsb0JBQW9CLENBQUMsY0FBYyxDQUFDLENBQUM7WUFDckMsY0FBYyxHQUFHLElBQUksQ0FBQztRQUN4QixDQUFDO1FBQUMsSUFBSSxDQUFDLENBQUM7WUFDTixjQUFjLEdBQUcscUJBQXFCLENBQUMsZUFBZSxDQUFDLENBQUM7UUFDMUQsQ0FBQztRQUNELE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQztRQUNqQixRQUFRLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ3pCLENBQUM7SUFDRCxlQUFlLEVBQUUsQ0FBQztBQUNwQixDQUFDO0FBRUQ7SUFDRSxzQkFBc0IsRUFBRSxDQUFDO0lBQ3pCLG9CQUFvQixFQUFFLENBQUM7SUFDdkIsWUFBWSxFQUFFLENBQUM7SUFDZix5QkFBeUIsRUFBRSxDQUFDO0lBQzVCLGlCQUFpQixFQUFFLENBQUM7QUFDdEIsQ0FBQztBQUVEO0lBQ0UsRUFBRSxDQUFDLENBQUMsU0FBUyxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDdkIsS0FBSyxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUM3QixTQUFTLEdBQUcsSUFBSSxDQUFDO0lBQ25CLENBQUM7SUFDRCxFQUFFLENBQUMsQ0FBQyxRQUFRLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQztRQUN0QixLQUFLLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQzVCLFFBQVEsR0FBRyxJQUFJLENBQUM7SUFDbEIsQ0FBQztJQUNELEVBQUUsQ0FBQyxDQUFDLGFBQWEsS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQzNCLEtBQUssQ0FBQyxXQUFXLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDakMsYUFBYSxHQUFHLElBQUksQ0FBQztJQUN2QixDQUFDO0lBQ0QsRUFBRSxDQUFDLENBQUMsWUFBWSxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDMUIsS0FBSyxDQUFDLFdBQVcsQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUNoQyxZQUFZLEdBQUcsSUFBSSxDQUFDO0lBQ3RCLENBQUM7SUFFRCxJQUFJLEtBQUssR0FBRyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUM7UUFDN0IsUUFBUSxFQUFFLEVBQUU7UUFDWixJQUFJLEVBQUUsUUFBUTtLQUNmLENBQUMsQ0FBQztJQUVILElBQUksS0FBSyxHQUFHLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDM0MsS0FBSyxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUM7SUFDZCxLQUFLLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQztJQUViLEtBQUssQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDdEIsU0FBUyxHQUFHLEtBQUssQ0FBQztJQUVsQixJQUFJLE9BQU8sR0FBRyxHQUFHLENBQUMsQ0FBQyxzQkFBc0I7SUFFekMsSUFBSSxRQUFRLEdBQUcsSUFBSSxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7SUFDbkMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUM3QixRQUFRLENBQUMsV0FBVyxDQUFDO1FBQ25CLE9BQU8sRUFBRSxFQUFFO1FBQ1gsT0FBTyxHQUFHLEVBQUUsRUFBRSxFQUFFO1FBQ2hCLE9BQU8sR0FBRyxFQUFFLEVBQUUsRUFBRTtLQUNqQixDQUFDLENBQUM7SUFDSCxRQUFRLENBQUMsT0FBTyxFQUFFLENBQUM7SUFFbkIsUUFBUSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUM7SUFDNUIsUUFBUSxDQUFDLEVBQUUsQ0FBQyxTQUFTLEVBQUUsYUFBYSxDQUFDLENBQUM7SUFFdEMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUN6QixZQUFZLEdBQUcsUUFBUSxDQUFDO0lBRXhCLElBQUksVUFBVSxHQUFHLElBQUksSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO0lBQ3JDLEVBQUUsQ0FBQyxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2xCLFVBQVUsQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDakMsQ0FBQztJQUFDLElBQUksQ0FBQyxDQUFDO1FBQ04sVUFBVSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUNqQyxDQUFDO0lBQ0QsVUFBVSxDQUFDLFdBQVcsQ0FBQztRQUNyQixPQUFPLEVBQUUsRUFBRTtRQUNYLE9BQU8sR0FBRyxFQUFFLEVBQUUsRUFBRTtRQUNoQixPQUFPLEdBQUcsRUFBRSxFQUFFLEVBQUU7S0FDakIsQ0FBQyxDQUFDO0lBQ0gsVUFBVSxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBRXJCLEVBQUUsQ0FBQyxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2xCLFVBQVUsQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDO1FBQzlCLFVBQVUsQ0FBQyxFQUFFLENBQUMsU0FBUyxFQUFFLGFBQWEsQ0FBQyxDQUFDO0lBQzFDLENBQUM7SUFFRCxLQUFLLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQzNCLGFBQWEsR0FBRyxVQUFVLENBQUM7SUFFM0IsSUFBSSxJQUFJLEdBQUcsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsR0FBRyxTQUFTLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDaEQsSUFBSSxDQUFDLENBQUMsR0FBRyxPQUFPLEdBQUcsRUFBRSxDQUFDO0lBQ3RCLElBQUksQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDO0lBRVosS0FBSyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNyQixRQUFRLEdBQUcsSUFBSSxDQUFDO0FBQ2xCLENBQUM7QUFFRDtJQUNFLEVBQUUsQ0FBQyxDQUFDLGdCQUFnQixLQUFLLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDOUIsS0FBSyxDQUFDLFdBQVcsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1FBQ3BDLGdCQUFnQixHQUFHLElBQUksQ0FBQztJQUMxQixDQUFDO0lBQ0QsRUFBRSxDQUFDLENBQUMsb0JBQW9CLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQztRQUNsQyxLQUFLLENBQUMsV0FBVyxDQUFDLG9CQUFvQixDQUFDLENBQUM7UUFDeEMsb0JBQW9CLEdBQUcsSUFBSSxDQUFDO0lBQzlCLENBQUM7SUFFRCxJQUFJLE1BQU0sR0FBRyxJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztJQUNqQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDakMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUMzQixNQUFNLENBQUMsZUFBZSxDQUFDLEdBQUcsRUFBRSxFQUFFLEVBQUUsR0FBRyxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUM1QyxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUM7SUFFakIsTUFBTSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUM7SUFDMUIsTUFBTSxDQUFDLEVBQUUsQ0FBQyxTQUFTLEVBQUUsYUFBYSxDQUFDLENBQUM7SUFFcEMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUN2QixnQkFBZ0IsR0FBRyxNQUFNLENBQUM7SUFFMUIsSUFBSSxLQUFLLEdBQUcsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDO1FBQzdCLFFBQVEsRUFBRSxFQUFFO1FBQ1osSUFBSSxFQUFFLFFBQVE7S0FDZixDQUFDLENBQUM7SUFFSCxJQUFJLElBQUksR0FBRyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQzlDLElBQUksQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDO0lBQ2IsSUFBSSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUM7SUFFWixLQUFLLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3JCLG9CQUFvQixHQUFHLElBQUksQ0FBQztBQUM5QixDQUFDO0FBRUQ7SUFDRSxFQUFFLENBQUMsQ0FBQyxjQUFjLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQztRQUM1QixLQUFLLENBQUMsV0FBVyxDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQ2xDLGNBQWMsR0FBRyxJQUFJLENBQUM7SUFDeEIsQ0FBQztJQUNELEVBQUUsQ0FBQyxDQUFDLGtCQUFrQixLQUFLLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDaEMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1FBQ3RDLGtCQUFrQixHQUFHLElBQUksQ0FBQztJQUM1QixDQUFDO0lBRUQsSUFBSSxNQUFNLEdBQUcsSUFBSSxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7SUFDakMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsUUFBUSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ2pDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO1FBQ3BCLE1BQU0sQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDN0IsQ0FBQztJQUFDLElBQUksQ0FBQyxDQUFDO1FBQ04sTUFBTSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUM3QixDQUFDO0lBQ0QsTUFBTSxDQUFDLGVBQWUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDN0MsTUFBTSxDQUFDLE9BQU8sRUFBRSxDQUFDO0lBRWpCLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7UUFDckIsTUFBTSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUM7UUFDMUIsTUFBTSxDQUFDLEVBQUUsQ0FBQyxTQUFTLEVBQUUsUUFBUSxDQUFDLENBQUM7SUFDakMsQ0FBQztJQUVELEtBQUssQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDdkIsY0FBYyxHQUFHLE1BQU0sQ0FBQztJQUV4QixJQUFJLEtBQUssR0FBRyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUM7UUFDN0IsUUFBUSxFQUFFLEVBQUU7UUFDWixJQUFJLEVBQUUsUUFBUTtLQUNmLENBQUMsQ0FBQztJQUVILElBQUksSUFBSSxHQUFHLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDNUMsSUFBSSxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUM7SUFDYixJQUFJLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQztJQUViLEtBQUssQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDckIsa0JBQWtCLEdBQUcsSUFBSSxDQUFDO0FBQzVCLENBQUM7QUFFRDtJQUNFLEVBQUUsQ0FBQyxDQUFDLG1CQUFtQixLQUFLLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDakMsS0FBSyxDQUFDLFdBQVcsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1FBQ3ZDLG1CQUFtQixHQUFHLElBQUksQ0FBQztJQUM3QixDQUFDO0lBQ0QsRUFBRSxDQUFDLENBQUMsdUJBQXVCLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQztRQUNyQyxLQUFLLENBQUMsV0FBVyxDQUFDLHVCQUF1QixDQUFDLENBQUM7UUFDM0MsdUJBQXVCLEdBQUcsSUFBSSxDQUFDO0lBQ2pDLENBQUM7SUFFRCxJQUFJLE1BQU0sR0FBRyxJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztJQUNqQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDakMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7UUFDcEIsTUFBTSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUM3QixDQUFDO0lBQUMsSUFBSSxDQUFDLENBQUM7UUFDTixNQUFNLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQzdCLENBQUM7SUFDRCxNQUFNLENBQUMsZUFBZSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUM3QyxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUM7SUFFakIsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7UUFDcEIsTUFBTSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUM7UUFDMUIsTUFBTSxDQUFDLEVBQUUsQ0FBQyxTQUFTLEVBQUUsYUFBYSxDQUFDLENBQUM7SUFDdEMsQ0FBQztJQUVELEtBQUssQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDdkIsbUJBQW1CLEdBQUcsTUFBTSxDQUFDO0lBRTdCLElBQUksS0FBSyxHQUFHLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQztRQUM3QixRQUFRLEVBQUUsRUFBRTtRQUNaLElBQUksRUFBRSxRQUFRO0tBQ2YsQ0FBQyxDQUFDO0lBRUgsSUFBSSxJQUFJLEdBQUcsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLGdCQUFnQixFQUFFLEtBQUssQ0FBQyxDQUFDO0lBQ2xELElBQUksQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDO0lBQ2IsSUFBSSxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUM7SUFFYixLQUFLLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3JCLHVCQUF1QixHQUFHLElBQUksQ0FBQztBQUNqQyxDQUFDO0FBRUQ7SUFDRSxFQUFFLENBQUMsQ0FBQyxXQUFXLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQztRQUN6QixLQUFLLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQy9CLFdBQVcsR0FBRyxJQUFJLENBQUM7SUFDckIsQ0FBQztJQUNELEVBQUUsQ0FBQyxDQUFDLGVBQWUsS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQzdCLEtBQUssQ0FBQyxXQUFXLENBQUMsZUFBZSxDQUFDLENBQUM7UUFDbkMsZUFBZSxHQUFHLElBQUksQ0FBQztJQUN6QixDQUFDO0lBRUQsSUFBSSxPQUFPLEdBQUcsT0FBTyxLQUFLLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUM7SUFFbkQsSUFBSSxNQUFNLEdBQUcsSUFBSSxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7SUFDakMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsUUFBUSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ2pDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7UUFDWixNQUFNLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQzdCLENBQUM7SUFBQyxJQUFJLENBQUMsQ0FBQztRQUNOLE1BQU0sQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDN0IsQ0FBQztJQUNELE1BQU0sQ0FBQyxlQUFlLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQzdDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsQ0FBQztJQUVqQixFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1FBQ1osTUFBTSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUM7UUFDMUIsTUFBTSxDQUFDLEVBQUUsQ0FBQyxTQUFTLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDOUIsQ0FBQztJQUVELEtBQUssQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDdkIsV0FBVyxHQUFHLE1BQU0sQ0FBQztJQUVyQixJQUFJLEtBQUssR0FBRyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUM7UUFDN0IsUUFBUSxFQUFFLEVBQUU7UUFDWixJQUFJLEVBQUUsUUFBUTtLQUNmLENBQUMsQ0FBQztJQUVILElBQUksSUFBSSxHQUFHLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDekMsSUFBSSxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUM7SUFDYixJQUFJLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQztJQUViLEtBQUssQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDckIsZUFBZSxHQUFHLElBQUksQ0FBQztBQUN6QixDQUFDO0FBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0ErQkc7OztBQ2xZSCw4Q0FBOEM7QUFDOUMsbUNBQW1DOzs7QUFFbkMsbUNBQW9DO0FBRXBDLE1BQU0sVUFBVSxHQUFHLEtBQUssQ0FBQztBQUN6QixNQUFNLElBQUksR0FBRyxJQUFJLEdBQUMsVUFBVSxDQUFDLENBQUMscUJBQXFCO0FBRW5EO0lBb0JFLFlBQVksU0FBaUIsRUFBRSxRQUFnQixFQUFFLElBQVk7UUFDM0Qsa0VBQWtFO1FBQ2xFLElBQUksQ0FBQyxTQUFTLEdBQUcsU0FBUyxDQUFDO1FBQzNCLElBQUksQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDLENBQUMsS0FBSztRQUMvQixJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztRQUNqQixJQUFJLENBQUMsU0FBUyxHQUFHLEtBQUssQ0FBQztRQUN2QixJQUFJLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQztRQUNmLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxHQUFDLEdBQUcsR0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO1FBQ3ZDLElBQUksQ0FBQyxRQUFRLEdBQUc7WUFDZCxNQUFNLEVBQUUsRUFBRTtZQUNWLEtBQUssRUFBRSxFQUFFO1lBQ1QsT0FBTyxFQUFFLEVBQUU7WUFDWCxVQUFVLEVBQUUsQ0FBQztTQUNkLENBQUM7SUFDSixDQUFDO0lBRUQsZUFBZTtRQUNiLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sR0FBQyxJQUFJLENBQUM7UUFDbEQsSUFBSSxDQUFDLGVBQWUsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLEdBQUMsSUFBSSxDQUFDO1FBQ3hFLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxJQUFJLENBQUMsUUFBUSxHQUFDLElBQUksQ0FBQztRQUM1QyxJQUFJLENBQUMsaUJBQWlCLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxHQUFDLElBQUksQ0FBQztJQUMvRSxDQUFDO0lBRUQsSUFBSTtRQUNGLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztRQUN2QixJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQztRQUN0QixJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDL0IsQ0FBQztJQUVELGdCQUFnQjtRQUNkLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUMsQ0FBQztZQUN2QyxNQUFNLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxHQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDO1FBQ3JFLENBQUM7UUFBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQztZQUM3QyxNQUFNLENBQUMsQ0FDSCxDQUFDLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDO2dCQUNwQyxDQUFDLElBQUksQ0FBQyxlQUFlLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQy9DLEdBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUM7Z0JBQ2hDLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDO1FBQzdCLENBQUM7UUFBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxDQUFDO1lBQy9DLE1BQU0sQ0FBQyxHQUFHLENBQUM7UUFDYixDQUFDO1FBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLENBQUMsQ0FBQztZQUMvQyxNQUFNLENBQUMsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUM7Z0JBQ2hELENBQUMsSUFBSSxDQUFDLGlCQUFpQixHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBQ3RELENBQUM7UUFBQyxJQUFJLENBQUMsQ0FBQztZQUNOLElBQUksQ0FBQyxTQUFTLEdBQUcsS0FBSyxDQUFDO1lBQ3ZCLE1BQU0sQ0FBQyxDQUFDLENBQUM7UUFDWCxDQUFDO0lBQ0gsQ0FBQztJQUVELFFBQVE7UUFDTix1REFBdUQ7UUFDdkQsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxHQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsR0FBRyxHQUFHLENBQUMsR0FBRyxHQUFHLENBQUM7UUFDNUQsTUFBTSxJQUFJLElBQUksQ0FBQyxJQUFJLEdBQUMsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7UUFDNUMsU0FBUztRQUNULElBQUksQ0FBQyxLQUFLLElBQUksSUFBSSxDQUFDLEVBQUUsR0FBQyxJQUFJLENBQUMsU0FBUyxHQUFDLElBQUksR0FBQyxHQUFHLENBQUM7UUFDOUMsT0FBTyxJQUFJLENBQUMsS0FBSyxHQUFHLENBQUMsR0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLENBQUM7WUFDOUIsSUFBSSxDQUFDLEtBQUssSUFBSSxDQUFDLEdBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztRQUMxQixDQUFDO1FBQ0QsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1FBRWIsTUFBTSxDQUFDLE1BQU0sQ0FBQztJQUNoQixDQUFDOztBQWhGTSxXQUFNLEdBQUcsSUFBSSxtQkFBVyxFQUFFLENBQUM7QUFEcEMsb0JBa0ZDIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuLi90eXBpbmdzL2luZGV4LmQudHNcIiAvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vdG9uZS50c1wiIC8+XG5cbmltcG9ydCB7VG9uZX0gZnJvbSAnLi90b25lJztcblxuZXhwb3J0IGNsYXNzIEF1ZGlvUGxheWVyIHtcbiAgY3R4OiBBdWRpb0NvbnRleHQ7XG4gIG5vdGVzOiBUb25lW107XG4gIG5vZGU6IFNjcmlwdFByb2Nlc3Nvck5vZGU7XG5cbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5jdHggPSBuZXcgQXVkaW9Db250ZXh0KCk7XG4gICAgdGhpcy5ub3RlcyA9IFtdO1xuICAgIHRoaXMubm9kZSA9IHRoaXMuY3R4LmNyZWF0ZVNjcmlwdFByb2Nlc3NvcigxMDI0LCAwLCAxKTsgLy8gbW9ubywgbm8gYnVmZmVyXG4gICAgdGhpcy5ub2RlLmNvbm5lY3QodGhpcy5jdHguZGVzdGluYXRpb24pO1xuICAgIHRoaXMubm9kZS5vbmF1ZGlvcHJvY2VzcyA9IHRoaXMuY2FsbGJhY2suYmluZCh0aGlzKTtcbiAgfVxuXG4gIGNhbGxiYWNrKGUpIHtcbiAgICBsZXQgb3V0cHV0RGF0YSA9IGUub3V0cHV0QnVmZmVyLmdldENoYW5uZWxEYXRhKDApO1xuICAgIGZvciAobGV0IHNhbXBsZSA9IDA7IHNhbXBsZSA8IGUub3V0cHV0QnVmZmVyLmxlbmd0aDsgc2FtcGxlKyspIHtcbiAgICAgIG91dHB1dERhdGFbc2FtcGxlXSA9IDA7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMubm90ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKHRoaXMubm90ZXNbaV0gJiYgdGhpcy5ub3Rlc1tpXS5pc1BsYXlpbmcpIHtcbiAgICAgICAgICBvdXRwdXREYXRhW3NhbXBsZV0gKz0gdGhpcy5ub3Rlc1tpXS5nZW5lcmF0ZSgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5ub3Rlcy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKCEodGhpcy5ub3Rlc1tpXS5pc1BsYXlpbmcpKSB7XG4gICAgICAgIHRoaXMubm90ZXMuc3BsaWNlKGksIDEpO1xuICAgICAgICBpLS07XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iLCIvLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi4vdHlwaW5ncy9pbmRleC5kLnRzXCIgLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL3RvbmUudHNcIiAvPlxuXG5pbXBvcnQge1RvbmV9IGZyb20gJy4vdG9uZSc7XG5jb25zdCBDNCA9IDI1NjsgLy8gZGVtIG51bWVyb2xvZ2lzdHMgYmUgY3JhenksIGJ1dCBJJ20gdXNpbmcgQSA0MzIgYW55d2F5XG5cbmVudW0gRGlyZWN0aW9uIHtcbiAgVXAgPSAwLFxuICBEb3duLFxuICBMZWZ0LFxuICBSaWdodFxufVxuXG5jb25zdCBkaXJlY3Rpb25zID0gW0RpcmVjdGlvbi5VcCwgRGlyZWN0aW9uLkRvd24sIERpcmVjdGlvbi5MZWZ0LCBEaXJlY3Rpb24uUmlnaHRdO1xuXG5leHBvcnQgY2xhc3MgQm9hcmQge1xuICBzaXplOiBudW1iZXI7XG4gIGFycm93czogRGlyZWN0aW9uW107XG4gIGV4aXRTcXVhcmVzOiBib29sZWFuW107XG4gIHByZXNvbHZlZDogYm9vbGVhbjtcbiAgbG9uZ2VzdEV4aXRQYXRoTGVuZ3RoOiBudW1iZXI7XG4gIC8vIGRyYXdpbmdcbiAgc3RhZ2U6IFBJWEkuQ29udGFpbmVyO1xuICBldmVudHM6IGFueVtdW107IC8vIHJlY29yZCBzdGVwcyB0byByZW5kZXIgbGF0ZXJcbiAgY3VycmVudEV2ZW50OiBhbnlbXTtcbiAgZnJhbWVzQmV0d2VlbkV2ZW50czogbnVtYmVyO1xuICBjdXJyZW50UmVzdEZyYW1lOiBudW1iZXI7XG4gIGRyYXdpbmdFeGl0U3F1YXJlczogYm9vbGVhbltdO1xuICBkcmF3aW5nQmFja3RyYWNlU3F1YXJlczogYm9vbGVhbltdO1xuICBkcmF3aW5nTG9uZ2VzdFBhdGg6IG51bWJlcjtcbiAgbG9uZ2VzdFBhdGhUZXh0OiBQSVhJLlRleHQ7XG4gIFRMOiB7eDogbnVtYmVyLCB5OiBudW1iZXJ9OyAvLyB0b3AgbGVmdCBjb3JuZXIgKHRoZXJlIHdpbGwgYmUgYSAxLXNxdWFyZSBidWZmZXIgYXJvdW5kIHRoZSB3aG9sZSB0aGluZylcbiAgY2VsbFdpZHRoOiBudW1iZXI7IC8vIHNpbmNlIHRoZSBncmlkIGlzIHNxdWFyZSwgdGhpcyBwcm9iYWJseSBzaG91bGQgYmUganVzdCBvbmUgcHJvcGVydHlcbiAgY2VsbEhlaWdodDogbnVtYmVyO1xuICB3OiBudW1iZXI7IC8vIHdpZHRoXG4gIGg6IG51bWJlcjsgLy8gaGVpZ2h0XG4gIGxpbmVTcHJpdGVzOiBQSVhJLkdyYXBoaWNzW107IC8vIHNvIHdlIGNhbiByZW1vdmUgdGhlbSBsYXRlclxuICBjZWxsU3ByaXRlczogUElYSS5HcmFwaGljc1tdOyAvLyBhcnJheSBieSBzcXVhcmUgaW5kZXg7IHRoaW5ncyBpbiBpdCBhcmUgbnVsbCB1bnRpbCBwb3B1bGF0ZWRcbiAgYXJyb3dTcHJpdGVzOiBQSVhJLkdyYXBoaWNzW107IC8vIGFsc28gYnkgc3F1YXJlIGluZGV4O1xuXG4gIGNvbnN0cnVjdG9yKHNpemU6IG51bWJlciwgc3RhZ2U6IFBJWEkuQ29udGFpbmVyKSB7XG4gICAgdGhpcy5zaXplID0gc2l6ZTtcbiAgICB0aGlzLnN0YWdlID0gc3RhZ2U7XG4gICAgdGhpcy5hcnJvd3MgPSBbXTtcbiAgICB0aGlzLmV4aXRTcXVhcmVzID0gW107XG4gICAgdGhpcy5ldmVudHMgPSBbXTtcbiAgICB0aGlzLmN1cnJlbnRFdmVudCA9IFtdO1xuICAgIHRoaXMucHJlc29sdmVkID0gZmFsc2U7XG4gICAgdGhpcy5mcmFtZXNCZXR3ZWVuRXZlbnRzID0gNztcbiAgICBpZiAodGhpcy5zaXplID4gMjApIHtcbiAgICAgIHRoaXMuZnJhbWVzQmV0d2VlbkV2ZW50cyA9IDI7IC8vIHNwZWVkIGl0IHdheSB1cCBmb3IgYmlnIGJvYXJkc1xuICAgIH1cbiAgICB0aGlzLmN1cnJlbnRSZXN0RnJhbWUgPSAwO1xuICAgIHRoaXMuZHJhd2luZ0xvbmdlc3RQYXRoID0gMDtcbiAgICB0aGlzLlRMID0ge3g6IDUwLCB5OiAxMDB9O1xuICAgIHRoaXMudyA9IDYwMDtcbiAgICB0aGlzLmggPSA2MDA7XG4gICAgdGhpcy5jZWxsV2lkdGggPSB0aGlzLncvKHNpemUgKyAyKTtcbiAgICB0aGlzLmNlbGxIZWlnaHQgPSB0aGlzLmgvKHNpemUgKyAyKTtcbiAgICB0aGlzLmRyYXdpbmdFeGl0U3F1YXJlcyA9IFtdO1xuICAgIHRoaXMuZHJhd2luZ0JhY2t0cmFjZVNxdWFyZXMgPSBbXTtcbiAgICB0aGlzLmxpbmVTcHJpdGVzID0gW107XG4gICAgdGhpcy5jZWxsU3ByaXRlcyA9IFtdO1xuICAgIHRoaXMuYXJyb3dTcHJpdGVzID0gW107XG4gICAgdGhpcy5sb25nZXN0UGF0aFRleHQgPSBudWxsO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2l6ZSAqIHNpemU7IGkrKykge1xuICAgICAgdGhpcy5hcnJvd3NbaV0gPSBkaXJlY3Rpb25zW01hdGguZmxvb3IoTWF0aC5yYW5kb20oKSo0KV07IC8vIGdlbmVyYXRlIGJvYXJkXG4gICAgICB0aGlzLmV4aXRTcXVhcmVzW2ldID0gZmFsc2U7IC8vIGluaXRpYWxpemUgZXhpdFNxdWFyZXNcbiAgICAgIHRoaXMuZHJhd2luZ0V4aXRTcXVhcmVzW2ldID0gZmFsc2U7XG4gICAgICB0aGlzLmRyYXdpbmdCYWNrdHJhY2VTcXVhcmVzW2ldID0gZmFsc2U7XG4gICAgICB0aGlzLmNlbGxTcHJpdGVzW2ldID0gbnVsbDtcbiAgICAgIHRoaXMuYXJyb3dTcHJpdGVzW2ldID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICByb3coc3F1YXJlOiBudW1iZXIpIHsgLy8gYmFzaWMgb3BlcmF0aW9uIHRvIGdldCByb3cgZnJvbSBzcXVhcmUgbnVtYmVyXG4gICAgcmV0dXJuIE1hdGguZmxvb3Ioc3F1YXJlL3RoaXMuc2l6ZSk7XG4gIH1cblxuICBjb2woc3F1YXJlOiBudW1iZXIpIHsgLy8gZ2V0IGNvbHVtblxuICAgIHJldHVybiBzcXVhcmUgJSB0aGlzLnNpemU7XG4gIH1cblxuICBzcXVhcmUocm93OiBudW1iZXIsIGNvbDogbnVtYmVyKSB7IC8vIGdldCBzcXVhcmUgZnJvbSByb3cgYW5kIGNvbHVtblxuICAgIHJldHVybiB0aGlzLnNpemUqcm93ICsgY29sO1xuICB9XG5cbiAgdXAoc3F1YXJlOiBudW1iZXIpIHsgLy8gZ28gdXAgYSBzcXVhcmUgKDAgaXMgdXBwZXIgbGVmdCwgZ29pbmcgYWNyb3NzIHRoZW4gZG93bilcbiAgICBpZiAodGhpcy5yb3coc3F1YXJlKSA9PT0gMCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBzcXVhcmUgLSB0aGlzLnNpemU7XG4gICAgfVxuICB9XG5cbiAgZG93bihzcXVhcmU6IG51bWJlcikgeyAvLyBkb3duIGEgc3F1YXJlXG4gICAgaWYgKHRoaXMucm93KHNxdWFyZSkgPT09IHRoaXMuc2l6ZSAtIDEpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gc3F1YXJlICsgdGhpcy5zaXplO1xuICAgIH1cbiAgfVxuXG4gIGxlZnQoc3F1YXJlOiBudW1iZXIpIHsgLy8gbGVmdCBhIHNxdWFyZVxuICAgIGlmICh0aGlzLmNvbChzcXVhcmUpID09PSAwKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHNxdWFyZSAtIDE7XG4gICAgfVxuICB9XG5cbiAgcmlnaHQoc3F1YXJlOiBudW1iZXIpIHsgLy8gcmlnaHQgYSBzcXVhcmVcbiAgICBpZiAodGhpcy5jb2woc3F1YXJlKSA9PT0gdGhpcy5zaXplIC0gMSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBzcXVhcmUgKyAxO1xuICAgIH1cbiAgfVxuXG4gIG5leHQoc3F1YXJlOiBudW1iZXIpIHsgLy8gZm9sbG93IHRoZSBhcnJvd1xuICAgIHN3aXRjaCAodGhpcy5hcnJvd3Nbc3F1YXJlXSkge1xuICAgICAgY2FzZSBEaXJlY3Rpb24uVXA6XG4gICAgICAgIHJldHVybiB0aGlzLnVwKHNxdWFyZSk7XG4gICAgICBjYXNlIERpcmVjdGlvbi5Eb3duOlxuICAgICAgICByZXR1cm4gdGhpcy5kb3duKHNxdWFyZSk7XG4gICAgICBjYXNlIERpcmVjdGlvbi5MZWZ0OlxuICAgICAgICByZXR1cm4gdGhpcy5sZWZ0KHNxdWFyZSk7XG4gICAgICBjYXNlIERpcmVjdGlvbi5SaWdodDpcbiAgICAgICAgcmV0dXJuIHRoaXMucmlnaHQoc3F1YXJlKTtcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiBudWxsOyAvLyBzaG91bGQgbmV2ZXIgaGFwcGVuXG4gICAgfVxuICB9XG5cbiAgbmV4dENoZWNrZXJTcXVhcmVSQyhzcXVhcmVSQzoge3JvdzogbnVtYmVyLCBjb2w6IG51bWJlcn0pIHtcbiAgICBpZiAoc3F1YXJlUkMucm93IDwgMCB8fCBzcXVhcmVSQy5yb3cgPj0gdGhpcy5zaXplXG4gICAgICAgIHx8IHNxdWFyZVJDLmNvbCA8IDAgfHwgc3F1YXJlUkMuY29sID49IHRoaXMuc2l6ZSkge1xuICAgICAgcmV0dXJuIG51bGw7IC8vIHRoZXJlIGFyZSBubyBhcnJvd3Mgb2ZmLWJvYXJkXG4gICAgfVxuICAgIGxldCBzcXVhcmUgPSB0aGlzLnNxdWFyZShzcXVhcmVSQy5yb3csIHNxdWFyZVJDLmNvbCk7XG4gICAgLy8gd2UgY2FuJ3QganVzdCB1c2UgdGhlIFwibmV4dFwiIG1ldGhvZCBiZWNhdXNlIHdlIG1heSBuZWVkXG4gICAgLy8gdG8gbW92ZSB0aGUgY2hlY2tlciBvZmYgdGhlIGJvYXJkXG4gICAgc3dpdGNoICh0aGlzLmFycm93c1tzcXVhcmVdKSB7XG4gICAgICBjYXNlIERpcmVjdGlvbi5VcDpcbiAgICAgICAgcmV0dXJuIHtyb3c6IHNxdWFyZVJDLnJvdyAtIDEsIGNvbDogc3F1YXJlUkMuY29sfTtcbiAgICAgIGNhc2UgRGlyZWN0aW9uLkRvd246XG4gICAgICAgIHJldHVybiB7cm93OiBzcXVhcmVSQy5yb3cgKyAxLCBjb2w6IHNxdWFyZVJDLmNvbH07XG4gICAgICBjYXNlIERpcmVjdGlvbi5MZWZ0OlxuICAgICAgICByZXR1cm4ge3Jvdzogc3F1YXJlUkMucm93LCBjb2w6IHNxdWFyZVJDLmNvbCAtIDF9O1xuICAgICAgY2FzZSBEaXJlY3Rpb24uUmlnaHQ6XG4gICAgICAgIHJldHVybiB7cm93OiBzcXVhcmVSQy5yb3csIGNvbDogc3F1YXJlUkMuY29sICsgMX07XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gbnVsbDsgLy8gc2hvdWxkIG5ldmVyIGhhcHBlblxuICAgIH1cbiAgfVxuXG4gIHJlY29yZChldmVudDogT2JqZWN0KSB7IC8vIHJlY29yZCBhbiBldmVudCBpbiB0aGlzIHJlbmRlciBzdGVwXG4gICAgdGhpcy5jdXJyZW50RXZlbnQucHVzaChldmVudCk7XG4gIH1cblxuICBuZXh0RXZlbnQoKSB7IC8vIG1ha2UgdGhlIG5leHQgcmVuZGVyIHN0ZXBcbiAgICB0aGlzLmV2ZW50cy5wdXNoKHRoaXMuY3VycmVudEV2ZW50KTtcbiAgICB0aGlzLmN1cnJlbnRFdmVudCA9IFtdO1xuICB9XG5cbiAgLy8gSW4gYSB0aW1lLWVmZmljaWVudCBhbGdvcml0aG0sIHRoZSBwcmVzb2x2aW5nIHN0ZXAgbWFya3MgdGhlIHNxdWFyZXMgdGhhdFxuICAvLyBsZWFkIHRvIGFuIGV4aXQuICBIb3dldmVyLCB3ZSdyZSBnb2luZyBmb3IgYSBzcGFjZS1lZmZpY2llbnQgYWxnb3JpdGhcbiAgLy8gaW5zdGVhZC4gIFNvLCB3aGlsZSB3ZSAqYXJlKiBtYXJraW5nIHRoZSBzcXVhcmVzIHRoYXQgbGVhZCB0byBhbiBleGl0XG4gIC8vIChPKG5eMikgc3BhY2UpLCB3ZSdyZSBvbmx5IHVzaW5nIHRoYXQgaW5mb3JtYXRpb24gZm9yIHRoZSBwdXJwb3NlcyBvZiB0aGVcbiAgLy8gdmlzdWFsaXphdGlvbi4gIFdoYXQgcHJlc29sdmluZyBkb2VzIGluc3RlYWQgaXMgYXMgZm9sbG93czpcbiAgLy9cbiAgLy8gSXQgc3RhcnRzIGFyb3VuZCB0aGUgYm9hcmQsIGxvb2tpbmcgZm9yIHNxdWFyZXMgd2l0aCBhcnJvd3MgcG9pbnRpbmcgb3V0LlxuICAvLyBXaGVuIGl0IGZpbmRzIHRoZW0sIGl0IGNoZWNrcyB0aGVpciBpbW1lZGlhdGUgbmVpZ2hib3JzIGZvciBzcXVhcmVzIHRoYXRcbiAgLy8gbGVhZCB0byB0aGF0IHNxdWFyZSBpbiBvcmRlciB0byBiYWNrdHJhY2UgdGhlIHBhdGgsIGFuZCBpdCBiYWNrdHJhY2VzIHRoZVxuICAvLyBwYXRoIHJlY3Vyc2l2ZWx5IHRvIGZpbmQgYWxsIHNxdWFyZXMgbGVhZGluZyB0byB0aGUgZXhpdC4gIE1lYW53aGlsZSwgaXRcbiAgLy8gY291bnRzIHRoZXNlIGV4aXQtbGVhZGluZyBzcXVhcmVzIGFuZCBrZWVwcyB0cmFjayBvZiBwYXRoIGxlbmd0aCwgZm9yIGFcbiAgLy8gdG90YWwgc3RvcmFnZSB0aGF0IGdyb3dzIGFzIE8oMSkuXG4gIC8vXG4gIC8vIFdoZW4gdGhlIGNoZWNrZXIgaXMgZXZlbnR1YWxseSBwbGFjZWQgb24gdGhlIGJvYXJkLCB3ZSBrbm93IHRoYXQgaWYgaXQgaGFzXG4gIC8vIG5vdCBleGl0ZWQgYnkgdGhlIHRpbWUgaXQgaGFzIHRha2VuIGFzIG1hbnkgc3RlcHMgYXMgdGhlIGxvbmdlc3QgbGVhZGluZ1xuICAvLyBwYXRoLCBvciBpZiBpdCBoYXMgdGFrZW4gbW9yZSBwYXRocyB0aGFuIHRoZXJlIGFyZSBub24tZXhpdC1sZWFkaW5nXG4gIC8vIHNxdWFyZXMgb24gdGhlIGJvYXJkLCBpdCB3aWxsIG5ldmVyIHJlYWNoIGFuIGV4aXQuXG4gIC8vXG4gIC8vIEluc3RlYWQgb2Ygd2FpdGluZyBmb3IgYW5pbWF0aW9uIGZyYW1lcywgdGhlIHByZXNvbHZpbmcgYWxnb3JpdGhtIHJlY29yZHNcbiAgLy8gYW5pbWF0YWJsZSBhY3Rpb25zLCB3aGljaCBhcmUgcGxheWVkIGJhY2sgbGF0ZXIgYnkgdGhlIHJlbmRlcmVyIGF0IGh1bWFuXG4gIC8vIHNwZWVkcy4gIERvaW5nIHRoaXMgZGlyZWN0bHkgd291bGQgYmUgYSBuaWdodG1hcmUsIGVzcGVjaWFsbHkgZm9yIHRoZVxuICAvLyByZWN1cnNpdmUgYml0LlxuICBwcmVzb2x2ZSgpIHtcbiAgICBsZXQgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHRoaXMucHJlc29sdmVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGxldCBsb25nZXN0UGF0aCA9IDA7XG4gICAgbGV0IGV4aXRzID0gMDsgLy8gY291bnQgb2YgZXhpdCBzcXVhcmVzXG4gICAgLy8gd2UgY2FuJ3QganVzdCBjb3VudCB0aGUgdHJ1ZSB2YWx1ZXMgaW4gZXhpdFNxdWFyZXMgYmVjYXVzZSB0aGF0IHdvdWxkXG4gICAgLy8gdmlvbGF0ZSBvdXIgTygxKSBzdG9yYWdlIHJlcXVpcmVtZW50XG5cbiAgICAvLyByZXR1cm5zIHBhdGggbGVuZ3RoXG4gICAgZnVuY3Rpb24gYmFja3RyYWNlUGF0aChzcXVhcmU6IG51bWJlcikge1xuICAgICAgbGV0IHBhdGhMZW5ndGhzID0gWzAsIDAsIDAsIDBdXG4gICAgICBsZXQgbmVpZ2hib3JzID0gW3NlbGYudXAoc3F1YXJlKSwgc2VsZi5kb3duKHNxdWFyZSksIHNlbGYubGVmdChzcXVhcmUpLCBzZWxmLnJpZ2h0KHNxdWFyZSldO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBuZWlnaGJvcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKG5laWdoYm9yc1tpXSAhPT0gbnVsbCAmJiBzZWxmLm5leHQobmVpZ2hib3JzW2ldKSA9PT0gc3F1YXJlKSB7XG4gICAgICAgICAgZXhpdHMrKztcbiAgICAgICAgICBzZWxmLmV4aXRTcXVhcmVzW25laWdoYm9yc1tpXV0gPSB0cnVlO1xuICAgICAgICAgIHNlbGYucmVjb3JkKHtcbiAgICAgICAgICAgIGV2ZW50OiBcImFkZEV4aXRTcXVhcmVcIixcbiAgICAgICAgICAgIHNxdWFyZTogbmVpZ2hib3JzW2ldXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgc2VsZi5yZWNvcmQoe1xuICAgICAgICAgICAgZXZlbnQ6IFwiYWRkQmFja3RyYWNlU3F1YXJlXCIsXG4gICAgICAgICAgICBzcXVhcmU6IHNxdWFyZVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIHNlbGYubmV4dEV2ZW50KCk7XG4gICAgICAgICAgcGF0aExlbmd0aHNbaV0gPSBiYWNrdHJhY2VQYXRoKG5laWdoYm9yc1tpXSk7XG4gICAgICAgICAgc2VsZi5yZWNvcmQoe1xuICAgICAgICAgICAgZXZlbnQ6IFwicmVtb3ZlQmFja3RyYWNlU3F1YXJlXCIsXG4gICAgICAgICAgICBzcXVhcmU6IHNxdWFyZVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIHNlbGYubmV4dEV2ZW50KCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiAxICsgTWF0aC5tYXgoLi4ucGF0aExlbmd0aHMpO1xuICAgIH1cblxuICAgIC8vIFdlJ3JlIGdvaW5nIHRvIGRvIGFsbCBmb3VyIHNpZGVzIGF0IG9uY2UuXG4gICAgLy8gVGhpcyB3aWxsIHRha2UgTyhuKSBjaGVja3MgaW5zdGVhZCBvZiBPKG5eMiksIHNvIGV2ZW4gdGhvdWdoIGl0J3NcbiAgICAvLyBhIGJpdCBtZXNzaWVyIHRvIGNvZGUsIGl0J3MgYSBwb3RlbnRpYWxseSB2ZXJ5IGxhcmdlIGltcHJvdmVtZW50XG4gICAgLy8gaW4gY2FzZXMgd2UnbGwgbGlrZWx5IG5ldmVyIGFjdHVhbGx5IGhpdC4gIEJ1dCBpdCdzIHRoZSBwcmluY2lwbGVcbiAgICAvLyBvZiB0aGUgdGhpbmcuICBJZiB3ZSB3YW50ZWQgdG8ganVzdCBjaGVjayB0aGUgZW50aXJlIGdyaWQgZm9yIGV4aXRcbiAgICAvLyBwb2ludHMsIHdlJ2QganVzdCBjaGVjayBpZiB0aGlzLm5leHQgaXMgbnVsbCBmb3IgZWFjaCBzcXVhcmUuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnNpemUgLSAxOyBpKyspIHtcbiAgICAgIGxldCB0YXJnZXRTcXVhcmVzID0gW1xuICAgICAgICB0aGlzLnNxdWFyZSgwLCBpKSwgLy8gYWxvbmcgdG9wXG4gICAgICAgIHRoaXMuc3F1YXJlKGksIHRoaXMuc2l6ZSAtIDEpLCAvLyBhbG9uZyByaWdodFxuICAgICAgICB0aGlzLnNxdWFyZSh0aGlzLnNpemUgLSAxLCB0aGlzLnNpemUgLSAxIC0gaSksIC8vIGFsb25nIGJvdHRvbVxuICAgICAgICB0aGlzLnNxdWFyZSh0aGlzLnNpemUgLSAxIC0gaSwgMCkgLy8gYWxvbmcgbGVmdFxuICAgICAgXTtcbiAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgNDsgaisrKSB7XG4gICAgICAgIGlmICh0aGlzLm5leHQodGFyZ2V0U3F1YXJlc1tqXSkgPT09IG51bGwpIHtcbiAgICAgICAgICBleGl0cysrO1xuICAgICAgICAgIHRoaXMuZXhpdFNxdWFyZXNbdGFyZ2V0U3F1YXJlc1tqXV0gPSB0cnVlO1xuICAgICAgICAgIHRoaXMucmVjb3JkKHtcbiAgICAgICAgICAgIGV2ZW50OiBcImFkZEV4aXRTcXVhcmVcIixcbiAgICAgICAgICAgIHNxdWFyZTogdGFyZ2V0U3F1YXJlc1tqXVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIHRoaXMucmVjb3JkKHtcbiAgICAgICAgICAgIGV2ZW50OiBcImFkZEJhY2t0cmFjZVNxdWFyZVwiLFxuICAgICAgICAgICAgc3F1YXJlOiB0YXJnZXRTcXVhcmVzW2pdXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgdGhpcy5uZXh0RXZlbnQoKTtcbiAgICAgICAgICBsZXQgcGF0aExlbmd0aCA9IGJhY2t0cmFjZVBhdGgodGFyZ2V0U3F1YXJlc1tqXSk7XG4gICAgICAgICAgdGhpcy5yZWNvcmQoe1xuICAgICAgICAgICAgZXZlbnQ6IFwicmVtb3ZlQmFja3RyYWNlU3F1YXJlXCIsXG4gICAgICAgICAgICBzcXVhcmU6IHRhcmdldFNxdWFyZXNbal1cbiAgICAgICAgICB9KTtcbiAgICAgICAgICBpZiAocGF0aExlbmd0aCA+IGxvbmdlc3RQYXRoKSB7XG4gICAgICAgICAgICBsb25nZXN0UGF0aCA9IHBhdGhMZW5ndGg7XG4gICAgICAgICAgICB0aGlzLnJlY29yZCh7XG4gICAgICAgICAgICAgIGV2ZW50OiBcInVwZGF0ZUxvbmdlc3RQYXRoXCIsXG4gICAgICAgICAgICAgIHZhbHVlOiBsb25nZXN0UGF0aFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMubmV4dEV2ZW50KCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLmxvbmdlc3RFeGl0UGF0aExlbmd0aCA9IGxvbmdlc3RQYXRoO1xuICAgIHRoaXMucHJlc29sdmVkID0gdHJ1ZTtcbiAgfVxuXG4gIHByb2Nlc3NSZW5kZXJFdmVudChldmVudDogYW55KSB7XG4gICAgc3dpdGNoIChldmVudC5ldmVudCkge1xuICAgICAgY2FzZSBcInVwZGF0ZUxvbmdlc3RQYXRoXCI6XG4gICAgICAgIHRoaXMuZHJhd2luZ0xvbmdlc3RQYXRoID0gZXZlbnQudmFsdWU7XG4gICAgICAgIHRoaXMuY3JlYXRlU3RhdHNUZXh0KCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBcImFkZEV4aXRTcXVhcmVcIjpcbiAgICAgICAgdGhpcy5kcmF3aW5nRXhpdFNxdWFyZXNbZXZlbnQuc3F1YXJlXSA9IHRydWU7XG4gICAgICAgIHRoaXMuY3JlYXRlQ2VsbFNwcml0ZShldmVudC5zcXVhcmUpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgXCJhZGRCYWNrdHJhY2VTcXVhcmVcIjpcbiAgICAgICAgdGhpcy5kcmF3aW5nQmFja3RyYWNlU3F1YXJlc1tldmVudC5zcXVhcmVdID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5jcmVhdGVDZWxsU3ByaXRlKGV2ZW50LnNxdWFyZSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBcInJlbW92ZUJhY2t0cmFjZVNxdWFyZVwiOlxuICAgICAgICB0aGlzLmRyYXdpbmdCYWNrdHJhY2VTcXVhcmVzW2V2ZW50LnNxdWFyZV0gPSBmYWxzZTtcbiAgICAgICAgdGhpcy5jcmVhdGVDZWxsU3ByaXRlKGV2ZW50LnNxdWFyZSk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIHBsYXlTb3VuZCgpIHtcbiAgICAvLyByYW5uZG9tIGJlZXBzLCBiZWNhdXNlIHdoeSBub3RcbiAgICBsZXQgZnJlcXVlbmN5ID0gMiooMi8oTWF0aC5yYW5kb20oKSArIDEpKSpDNDsgLy8gcmFuZG9tIG5vdGUgYmV0d2VlbiBDNSBhbmQgQzZcbiAgICAvLyBBY3R1YWxseSBub3QgcXVpdGUgYSByYW5kb20gbm90ZSAtLSB3ZSdyZSBjaG9vc2luZyB0aGUgbm90ZSBpbiBhIHdlaXJkXG4gICAgLy8gd2F5LiAgVGhpbmsgb2YgYSBzdHJpbmcgdGhhdCBtYWtlcyBhIEM0IHNvdW5kLiAgTm93LCBmaW5kIHRoZSBtaWRwb2ludC5cbiAgICAvLyBXZSdyZSBwaWNraW5nIHJhbmRvbSBzcG90cyBvbiB0aGUgc3RyaW5nIG9uIG9uZSBzaWRlIG9mIHRoZSBtaWRwb2ludFxuICAgIC8vIGFuZCBwbHVja2luZyBvbiB0aGUgb3RoZXIgc2lkZS4gIEl0J3Mgc3RpbGwgcmFuZG9tLCBqdXN0Li4uIHdlaXJkLlxuICAgIGxldCBkdXJhdGlvbiA9ICh0aGlzLmZyYW1lc0JldHdlZW5FdmVudHMvNjApKjUwMDsgLy8gYXNzdW1pbmcgNjAgZnBzXG4gICAgbGV0IHRvbmUgPSBuZXcgVG9uZShmcmVxdWVuY3ksIGR1cmF0aW9uLCAwLjEpO1xuICAgIHRvbmUucGxheSgpO1xuICB9XG5cbiAgc3RlcFByZXNvbHV0aW9uQW5pbWF0aW9uKCkge1xuICAgIGlmICh0aGlzLmV2ZW50cy5sZW5ndGggPiAwICYmIHRoaXMuY3VycmVudFJlc3RGcmFtZSA8PSAwKSB7XG4gICAgICBsZXQgcmVuZGVyRXZlbnRzID0gdGhpcy5ldmVudHMuc2hpZnQoKTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmVuZGVyRXZlbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHRoaXMucHJvY2Vzc1JlbmRlckV2ZW50KHJlbmRlckV2ZW50c1tpXSk7XG4gICAgICB9XG4gICAgICB0aGlzLmN1cnJlbnRSZXN0RnJhbWUgKz0gdGhpcy5mcmFtZXNCZXR3ZWVuRXZlbnRzO1xuICAgICAgdGhpcy5wbGF5U291bmQoKTtcbiAgICB9IGVsc2UgaWYgKHRoaXMuY3VycmVudFJlc3RGcmFtZSA+IDApIHtcbiAgICAgIHRoaXMuY3VycmVudFJlc3RGcmFtZS0tO1xuICAgIH1cbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5jbGVhckJvYXJkU3ByaXRlcygpO1xuICAgIHRoaXMuY2xlYXJTdGF0c1RleHQoKTtcbiAgfVxuXG4gIGluaXRCb2FyZFJlbmRlcigpIHtcbiAgICB0aGlzLmNsZWFyQm9hcmRTcHJpdGVzKCk7XG4gICAgdGhpcy5jcmVhdGVCb2FyZFNwcml0ZXMoKTtcbiAgICB0aGlzLmNyZWF0ZVN0YXRzVGV4dCgpO1xuICB9XG5cbiAgY2xlYXJTdGF0c1RleHQoKSB7XG4gICAgdGhpcy5jbGVhckxvbmdlc3RQYXRoVGV4dCgpO1xuICB9XG5cbiAgY2xlYXJMb25nZXN0UGF0aFRleHQoKSB7XG4gICAgaWYgKHRoaXMubG9uZ2VzdFBhdGhUZXh0ICE9PSBudWxsKSB7XG4gICAgICB0aGlzLnN0YWdlLnJlbW92ZUNoaWxkKHRoaXMubG9uZ2VzdFBhdGhUZXh0KTtcbiAgICAgIHRoaXMubG9uZ2VzdFBhdGhUZXh0ID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICBjcmVhdGVTdGF0c1RleHQoKSB7XG4gICAgdGhpcy5jbGVhclN0YXRzVGV4dCgpO1xuICAgIGxldCBzdHlsZSA9IG5ldyBQSVhJLlRleHRTdHlsZSh7XG4gICAgICBmb250U2l6ZTogMzAsXG4gICAgICBmaWxsOiAweEQwRDBEMFxuICAgIH0pO1xuXG4gICAgdGhpcy5sb25nZXN0UGF0aFRleHQgPSBuZXcgUElYSS5UZXh0KCdMb25nZXN0IFBhdGggTGVuZ3RoOiAnICsgdGhpcy5kcmF3aW5nTG9uZ2VzdFBhdGgsIHN0eWxlKTtcbiAgICB0aGlzLmxvbmdlc3RQYXRoVGV4dC54ID0gNTA7XG4gICAgdGhpcy5sb25nZXN0UGF0aFRleHQueSA9IDQ1O1xuICAgIHRoaXMuc3RhZ2UuYWRkQ2hpbGQodGhpcy5sb25nZXN0UGF0aFRleHQpO1xuICB9XG5cbiAgY2xlYXJCb2FyZFNwcml0ZXMoKSB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmxpbmVTcHJpdGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB0aGlzLnN0YWdlLnJlbW92ZUNoaWxkKHRoaXMubGluZVNwcml0ZXNbaV0pO1xuICAgIH1cbiAgICB0aGlzLmxpbmVTcHJpdGVzID0gW107XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnNpemUqdGhpcy5zaXplOyBpKyspIHtcbiAgICAgIHRoaXMucmVtb3ZlQ2VsbFNwcml0ZShpKTsgLy8gYWxzbyBjbGVhcnMgYXJyb3cgc3ByaXRlXG4gICAgfVxuICB9XG5cbiAgcmVtb3ZlQ2VsbFNwcml0ZShzcXVhcmU6IG51bWJlcikge1xuICAgIGlmICh0aGlzLmNlbGxTcHJpdGVzW3NxdWFyZV0gIT09IG51bGwpIHtcbiAgICAgIHRoaXMuc3RhZ2UucmVtb3ZlQ2hpbGQodGhpcy5jZWxsU3ByaXRlc1tzcXVhcmVdKTtcbiAgICB9XG4gICAgdGhpcy5jZWxsU3ByaXRlc1tzcXVhcmVdID0gbnVsbDtcbiAgICB0aGlzLnJlbW92ZUFycm93U3ByaXRlKHNxdWFyZSk7XG4gIH1cblxuICByZW1vdmVBcnJvd1Nwcml0ZShzcXVhcmU6IG51bWJlcikge1xuICAgIGlmICh0aGlzLmFycm93U3ByaXRlc1tzcXVhcmVdICE9PSBudWxsKSB7XG4gICAgICB0aGlzLnN0YWdlLnJlbW92ZUNoaWxkKHRoaXMuYXJyb3dTcHJpdGVzW3NxdWFyZV0pO1xuICAgIH1cbiAgICB0aGlzLmFycm93U3ByaXRlc1tzcXVhcmVdID0gbnVsbDtcbiAgfVxuXG4gIGNyZWF0ZUJvYXJkU3ByaXRlcygpIHtcbiAgICB0aGlzLmNsZWFyQm9hcmRTcHJpdGVzKCk7XG4gICAgdGhpcy5jcmVhdGVMaW5lU3ByaXRlcygpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5zaXplKnRoaXMuc2l6ZTsgaSsrKSB7XG4gICAgICB0aGlzLmNyZWF0ZUNlbGxTcHJpdGUoaSk7XG4gICAgfVxuICB9XG5cbiAgY3JlYXRlTGluZVNwcml0ZXMoKSB7XG4gICAgZm9yIChsZXQgaSA9IDE7IGkgPD0gdGhpcy5zaXplICsgMTsgaSsrKSB7XG4gICAgICBsZXQgaExpbmUgPSBuZXcgUElYSS5HcmFwaGljcygpO1xuICAgICAgaExpbmUubGluZVN0eWxlKDMsIDB4ODA4MEZGLCAxKTtcbiAgICAgIGhMaW5lLm1vdmVUbyh0aGlzLlRMLnggKyB0aGlzLmNlbGxXaWR0aCAtIDEuNSwgdGhpcy5UTC55ICsgaSp0aGlzLmNlbGxIZWlnaHQpO1xuICAgICAgaExpbmUubGluZVRvKHRoaXMuVEwueCArICh0aGlzLnNpemUgKyAxKSp0aGlzLmNlbGxXaWR0aCArIDEuNSwgdGhpcy5UTC55ICsgaSp0aGlzLmNlbGxIZWlnaHQpO1xuICAgICAgdGhpcy5zdGFnZS5hZGRDaGlsZChoTGluZSk7XG4gICAgICB0aGlzLmxpbmVTcHJpdGVzLnB1c2goaExpbmUpO1xuXG4gICAgICBsZXQgdkxpbmUgPSBuZXcgUElYSS5HcmFwaGljcygpO1xuICAgICAgdkxpbmUubGluZVN0eWxlKDMsIDB4ODA4MEZGLCAxKTtcbiAgICAgIHZMaW5lLm1vdmVUbyh0aGlzLlRMLnggKyB0aGlzLmNlbGxXaWR0aCppLCB0aGlzLlRMLnkgKyB0aGlzLmNlbGxIZWlnaHQgLSAxLjUpO1xuICAgICAgdkxpbmUubGluZVRvKHRoaXMuVEwueCArIHRoaXMuY2VsbFdpZHRoKmksIHRoaXMuVEwueSArICh0aGlzLnNpemUgKyAxKSp0aGlzLmNlbGxIZWlnaHQgKyAxLjUpO1xuICAgICAgdGhpcy5zdGFnZS5hZGRDaGlsZCh2TGluZSk7XG4gICAgICB0aGlzLmxpbmVTcHJpdGVzLnB1c2godkxpbmUpO1xuICAgIH1cbiAgfVxuXG4gIGNyZWF0ZUNlbGxTcHJpdGUoc3F1YXJlOiBudW1iZXIpIHtcbiAgICB0aGlzLnJlbW92ZUNlbGxTcHJpdGUoc3F1YXJlKTsgLy8gYWxzbyByZW1vdmVzIGFycm93IHNwcml0ZVxuICAgIGxldCBjZWxsID0gbmV3IFBJWEkuR3JhcGhpY3MoKTtcbiAgICBpZiAodGhpcy5kcmF3aW5nQmFja3RyYWNlU3F1YXJlc1tzcXVhcmVdKSB7XG4gICAgICBjZWxsLmxpbmVTdHlsZSgxLCAweEZGNDA0MCwgMSk7IC8vIGJvcmRlciBhcm91bmQgYmFja3RyYWNlIHNxdWFyZXNcbiAgICB9IGVsc2Uge1xuICAgICAgY2VsbC5saW5lU3R5bGUoMCwgMHgwMDAwMDAsIDApO1xuICAgIH1cbiAgICBpZiAodGhpcy5kcmF3aW5nRXhpdFNxdWFyZXNbc3F1YXJlXSkge1xuICAgICAgY2VsbC5iZWdpbkZpbGwoMHgyMDIwMjApO1xuICAgIH0gZWxzZSB7XG4gICAgICBjZWxsLmJlZ2luRmlsbCgweEUwRTBFMCk7XG4gICAgfVxuICAgIGxldCByID0gdGhpcy5yb3coc3F1YXJlKTtcbiAgICBsZXQgYyA9IHRoaXMuY29sKHNxdWFyZSk7XG4gICAgY2VsbC5kcmF3UmVjdCh0aGlzLlRMLnggKyB0aGlzLmNlbGxXaWR0aCooYyArIDEpICsgMSxcbiAgICAgICAgICAgICAgICAgIHRoaXMuVEwueSArIHRoaXMuY2VsbEhlaWdodCoociArIDEpICsgMSxcbiAgICAgICAgICAgICAgICAgIHRoaXMuY2VsbFdpZHRoIC0gMixcbiAgICAgICAgICAgICAgICAgIHRoaXMuY2VsbEhlaWdodCAtIDIpO1xuICAgIGNlbGwuZW5kRmlsbCgpO1xuICAgIHRoaXMuc3RhZ2UuYWRkQ2hpbGQoY2VsbCk7XG4gICAgdGhpcy5jZWxsU3ByaXRlc1tzcXVhcmVdID0gY2VsbDtcbiAgICB0aGlzLmNyZWF0ZUFycm93U3ByaXRlKHNxdWFyZSk7XG4gIH1cblxuICBjcmVhdGVBcnJvd1Nwcml0ZShzcXVhcmU6IG51bWJlcikge1xuICAgIGxldCBjZW50ZXIgPSB0aGlzLmNlbnRlck9mU3F1YXJlKHtcbiAgICAgIHJvdzogdGhpcy5yb3coc3F1YXJlKSxcbiAgICAgIGNvbDogdGhpcy5jb2woc3F1YXJlKVxuICAgIH0pO1xuICAgIGNvbnN0IGsgPSBNYXRoLnNxcnQoMykvODsgLy8gdXNlZnVsIGdlb21ldHJpYyBjb25zdGFudFxuICAgIGxldCBhcnJvdyA9IG5ldyBQSVhJLkdyYXBoaWNzKCk7XG4gICAgYXJyb3cuYmVnaW5GaWxsKDB4ODA4MDgwKTtcbiAgICBzd2l0Y2ggKHRoaXMuYXJyb3dzW3NxdWFyZV0pIHtcbiAgICAgICAgY2FzZSBEaXJlY3Rpb24uVXA6XG4gICAgICAgICAgYXJyb3cuZHJhd1BvbHlnb24oW1xuICAgICAgICAgICAgY2VudGVyLngsIGNlbnRlci55IC0gdGhpcy5jZWxsSGVpZ2h0KjAuMzc1LFxuICAgICAgICAgICAgY2VudGVyLnggKyBrKnRoaXMuY2VsbFdpZHRoLCBjZW50ZXIueSxcbiAgICAgICAgICAgIGNlbnRlci54IC0gayp0aGlzLmNlbGxXaWR0aCwgY2VudGVyLnlcbiAgICAgICAgICBdKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBEaXJlY3Rpb24uRG93bjpcbiAgICAgICAgICBhcnJvdy5kcmF3UG9seWdvbihbXG4gICAgICAgICAgICBjZW50ZXIueCwgY2VudGVyLnkgKyB0aGlzLmNlbGxIZWlnaHQqMC4zNzUsXG4gICAgICAgICAgICBjZW50ZXIueCAtIGsqdGhpcy5jZWxsV2lkdGgsIGNlbnRlci55LFxuICAgICAgICAgICAgY2VudGVyLnggKyBrKnRoaXMuY2VsbFdpZHRoLCBjZW50ZXIueVxuICAgICAgICAgIF0pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIERpcmVjdGlvbi5MZWZ0OlxuICAgICAgICAgIGFycm93LmRyYXdQb2x5Z29uKFtcbiAgICAgICAgICAgIGNlbnRlci54IC0gdGhpcy5jZWxsSGVpZ2h0KjAuMzc1LCBjZW50ZXIueSxcbiAgICAgICAgICAgIGNlbnRlci54LCBjZW50ZXIueSAtIGsqdGhpcy5jZWxsSGVpZ2h0LFxuICAgICAgICAgICAgY2VudGVyLngsIGNlbnRlci55ICsgayp0aGlzLmNlbGxIZWlnaHRcbiAgICAgICAgICBdKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBEaXJlY3Rpb24uUmlnaHQ6XG4gICAgICAgICAgYXJyb3cuZHJhd1BvbHlnb24oW1xuICAgICAgICAgICAgY2VudGVyLnggKyB0aGlzLmNlbGxIZWlnaHQqMC4zNzUsIGNlbnRlci55LFxuICAgICAgICAgICAgY2VudGVyLngsIGNlbnRlci55ICsgayp0aGlzLmNlbGxIZWlnaHQsXG4gICAgICAgICAgICBjZW50ZXIueCwgY2VudGVyLnkgLSBrKnRoaXMuY2VsbEhlaWdodFxuICAgICAgICAgIF0pO1xuICAgICAgICAgIGJyZWFrO1xuICAgIH1cbiAgICBhcnJvdy5lbmRGaWxsKCk7XG4gICAgdGhpcy5zdGFnZS5hZGRDaGlsZChhcnJvdyk7XG4gICAgdGhpcy5hcnJvd1Nwcml0ZXNbc3F1YXJlXSA9IGFycm93O1xuICB9XG5cbiAgY2VudGVyT2ZTcXVhcmUoc3F1YXJlUkM6IHtyb3c6IG51bWJlciwgY29sOiBudW1iZXJ9KSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHg6IHRoaXMuVEwueCArIHRoaXMuY2VsbFdpZHRoKihzcXVhcmVSQy5jb2wgKyAxLjUpLFxuICAgICAgeTogdGhpcy5UTC55ICsgdGhpcy5jZWxsSGVpZ2h0KihzcXVhcmVSQy5yb3cgKyAxLjUpXG4gICAgfVxuICB9XG59XG4iLCIvLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi4vdHlwaW5ncy9pbmRleC5kLnRzXCIgLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2JvYXJkLnRzXCIgLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL3RvbmUudHNcIiAvPlxuXG5pbXBvcnQge0JvYXJkfSBmcm9tICcuL2JvYXJkJztcbmltcG9ydCB7VG9uZX0gZnJvbSAnLi90b25lJztcbmNvbnN0IEM0ID0gMjU2OyAvLyBkZW0gbnVtZXJvbG9naXN0cyBiZSBjcmF6eSwgYnV0IEknbSB1c2luZyBBIDQzMiBhbnl3YXlcblxuZXhwb3J0IGNsYXNzIENoZWNrZXIge1xuICBib2FyZDogQm9hcmQ7XG4gIG9uQm9hcmQ6IGJvb2xlYW47XG4gIHNxdWFyZVJDOiB7cm93OiBudW1iZXIsIGNvbDogbnVtYmVyfTsgLy8gY2hlY2tlciBjYW4gYmUgb2ZmIGJvYXJkLCBzbyAtMSDiiaQgcm93LCBjb2wg4omkIHNpemVcbiAgbmV4dFNxdWFyZVJDOiB7cm93OiBudW1iZXIsIGNvbDogbnVtYmVyfTtcbiAgc3RhcnRlZDogYm9vbGVhbjtcbiAgZG9uZTogYm9vbGVhbjtcbiAgLy8gZHJhd2luZ1xuICBzdGFnZTogUElYSS5Db250YWluZXI7XG4gIHBvc2l0aW9uOiB7eDogbnVtYmVyLCB5OiBudW1iZXJ9OyAvLyBhY3R1YWwgcG9zaXRpb24gZm9yIHJlbmRlcmluZ1xuICBuZXh0UG9zaXRpb246IHt4OiBudW1iZXIsIHk6IG51bWJlcn07XG4gIG1vdmVtZW50RnJhbWVzOiBudW1iZXI7IC8vIGZyYW1lcyBpdCB0YWtlcyB0byBtb3ZlIGZyb20gb25lIHNxdWFyZSB0byB0aGUgbmV4dFxuICBjdXJyZW50RnJhbWU6IG51bWJlcjtcbiAgc3RlcHNUYWtlbjogbnVtYmVyO1xuICByYWRpdXM6IG51bWJlcjtcbiAgY2hlY2tlclNwcml0ZTogUElYSS5HcmFwaGljcztcbiAgc3RlcHNUZXh0OiBQSVhJLlRleHQ7XG4gIGRvbmVUZXh0OiBQSVhJLlRleHQ7XG5cbiAgY29uc3RydWN0b3IoYm9hcmQ6IEJvYXJkLCByb3c6IG51bWJlciwgY29sOiBudW1iZXIsIHN0YWdlOiBQSVhJLkNvbnRhaW5lcikge1xuICAgIHRoaXMuYm9hcmQgPSBib2FyZDtcbiAgICB0aGlzLnN0YWdlID0gc3RhZ2U7XG4gICAgdGhpcy5zcXVhcmVSQyA9IHtyb3c6IHJvdywgY29sOiBjb2x9O1xuICAgIHRoaXMuY2FsY3VsYXRlT25Cb2FyZCgpO1xuICAgIHRoaXMucG9zaXRpb24gPSB0aGlzLmJvYXJkLmNlbnRlck9mU3F1YXJlKHRoaXMuc3F1YXJlUkMpO1xuICAgIHRoaXMuc3RlcHNUYWtlbiA9IDA7XG4gICAgdGhpcy5zdGFydGVkID0gZmFsc2U7XG4gICAgdGhpcy5kb25lID0gZmFsc2U7XG4gICAgdGhpcy5jYWxjdWxhdGVSYWRpdXMoKTtcbiAgICB0aGlzLmNoZWNrZXJTcHJpdGUgPSBudWxsO1xuICAgIHRoaXMuc3RlcHNUZXh0ID0gbnVsbDtcbiAgICB0aGlzLmRvbmVUZXh0ID0gbnVsbDtcbiAgICB0aGlzLm1vdmVtZW50RnJhbWVzID0gMzA7XG4gICAgaWYgKHRoaXMuYm9hcmQuc2l6ZSA+IDIwKSB7XG4gICAgICB0aGlzLm1vdmVtZW50RnJhbWVzID0gMTA7IC8vIHNwZWVkIGl0IHdheSB1cCBmb3IgYmlnIGJvYXJkc1xuICAgIH1cbiAgfVxuXG4gIGluaXRDaGVja2VyUmVuZGVyKCkge1xuICAgIHRoaXMuY3JlYXRlU3ByaXRlcygpO1xuICB9XG5cbiAgY2FsY3VsYXRlT25Cb2FyZCgpIHtcbiAgICBpZiAodGhpcy5zcXVhcmVSQy5yb3cgPj0gMCAmJiB0aGlzLnNxdWFyZVJDLnJvdyA8IHRoaXMuYm9hcmQuc2l6ZVxuICAgICAgICAmJiB0aGlzLnNxdWFyZVJDLmNvbCA+PSAwICYmIHRoaXMuc3F1YXJlUkMuY29sIDwgdGhpcy5ib2FyZC5zaXplKSB7XG4gICAgICB0aGlzLm9uQm9hcmQgPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLm9uQm9hcmQgPSBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBjYWxjdWxhdGVSYWRpdXMoKSB7XG4gICAgbGV0IGNlbGxTaXplID0gTWF0aC5taW4odGhpcy5ib2FyZC5jZWxsV2lkdGgsIHRoaXMuYm9hcmQuY2VsbEhlaWdodCk7XG4gICAgdGhpcy5yYWRpdXMgPSBjZWxsU2l6ZS80O1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLmNsZWFyU3ByaXRlcygpO1xuICB9XG5cbiAgY2xlYXJTcHJpdGVzKCkge1xuICAgIHRoaXMuY2xlYXJDaGVja2VyU3ByaXRlKCk7XG4gICAgdGhpcy5jbGVhclN0ZXBzVGV4dCgpO1xuICAgIHRoaXMuY2xlYXJEb25lVGV4dCgpO1xuICB9XG5cbiAgY3JlYXRlU3ByaXRlcygpIHtcbiAgICB0aGlzLmNyZWF0ZUNoZWNrZXJTcHJpdGUoKTtcbiAgICB0aGlzLmNyZWF0ZVN0ZXBzVGV4dCgpO1xuICB9XG5cbiAgY2xlYXJDaGVja2VyU3ByaXRlKCkge1xuICAgIGlmICh0aGlzLmNoZWNrZXJTcHJpdGUgIT09IG51bGwpIHtcbiAgICAgIHRoaXMuc3RhZ2UucmVtb3ZlQ2hpbGQodGhpcy5jaGVja2VyU3ByaXRlKTtcbiAgICB9XG4gICAgdGhpcy5jaGVja2VyU3ByaXRlID0gbnVsbDtcbiAgfVxuXG4gIGNsZWFyU3RlcHNUZXh0KCkge1xuICAgIGlmICh0aGlzLnN0ZXBzVGV4dCAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5zdGFnZS5yZW1vdmVDaGlsZCh0aGlzLnN0ZXBzVGV4dCk7XG4gICAgfVxuICAgIHRoaXMuc3RlcHNUZXh0ID0gbnVsbDtcbiAgfVxuXG4gIGNsZWFyRG9uZVRleHQoKSB7XG4gICAgaWYgKHRoaXMuZG9uZVRleHQgIT09IG51bGwpIHtcbiAgICAgIHRoaXMuc3RhZ2UucmVtb3ZlQ2hpbGQodGhpcy5kb25lVGV4dCk7XG4gICAgfVxuICAgIHRoaXMuZG9uZVRleHQgPSBudWxsO1xuICB9XG5cbiAgY3JlYXRlQ2hlY2tlclNwcml0ZSgpIHtcbiAgICB0aGlzLmNsZWFyQ2hlY2tlclNwcml0ZSgpO1xuICAgIHRoaXMuY2hlY2tlclNwcml0ZSA9IG5ldyBQSVhJLkdyYXBoaWNzKCk7XG4gICAgdGhpcy5jaGVja2VyU3ByaXRlLmxpbmVTdHlsZSgyLCAweDAwMDBGRiwgMSk7XG4gICAgdGhpcy5jaGVja2VyU3ByaXRlLmJlZ2luRmlsbCgweDQwNDBGRik7XG4gICAgdGhpcy5jaGVja2VyU3ByaXRlLmRyYXdDaXJjbGUoMCwgMCwgdGhpcy5yYWRpdXMpO1xuICAgIHRoaXMuY2hlY2tlclNwcml0ZS54ID0gdGhpcy5wb3NpdGlvbi54O1xuICAgIHRoaXMuY2hlY2tlclNwcml0ZS55ID0gdGhpcy5wb3NpdGlvbi55O1xuICAgIHRoaXMuc3RhZ2UuYWRkQ2hpbGQodGhpcy5jaGVja2VyU3ByaXRlKTtcbiAgfVxuXG4gIGNyZWF0ZVN0ZXBzVGV4dCgpIHtcbiAgICB0aGlzLmNsZWFyU3RlcHNUZXh0KCk7XG5cbiAgICBsZXQgc3R5bGU7XG4gICAgaWYgKCF0aGlzLm9uQm9hcmQpIHtcbiAgICAgIHN0eWxlID0gbmV3IFBJWEkuVGV4dFN0eWxlKHtcbiAgICAgICAgZm9udFNpemU6IDMwLFxuICAgICAgICBmaWxsOiAweDQwRkY0MFxuICAgICAgfSk7XG4gICAgfSBlbHNlIGlmICh0aGlzLnRvb01hbnlTdGVwcygpKSB7XG4gICAgICBzdHlsZSA9IG5ldyBQSVhJLlRleHRTdHlsZSh7XG4gICAgICAgIGZvbnRTaXplOiAzMCxcbiAgICAgICAgZmlsbDogMHhGRjQwNDBcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBzdHlsZSA9IG5ldyBQSVhJLlRleHRTdHlsZSh7XG4gICAgICAgIGZvbnRTaXplOiAzMCxcbiAgICAgICAgZmlsbDogMHhEMEQwRDBcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHRoaXMuc3RlcHNUZXh0ID0gbmV3IFBJWEkuVGV4dCgnU3RlcHMgVGFrZW46ICcgKyB0aGlzLnN0ZXBzVGFrZW4sIHN0eWxlKTtcbiAgICB0aGlzLnN0ZXBzVGV4dC54ID0gNzAwO1xuICAgIHRoaXMuc3RlcHNUZXh0LnkgPSAzMDA7XG4gICAgdGhpcy5zdGFnZS5hZGRDaGlsZCh0aGlzLnN0ZXBzVGV4dCk7XG4gIH1cblxuICBjcmVhdGVEb25lVGV4dChtc2c6IHN0cmluZykge1xuICAgIHRoaXMuY2xlYXJEb25lVGV4dCgpO1xuXG4gICAgbGV0IHN0eWxlID0gbmV3IFBJWEkuVGV4dFN0eWxlKHtcbiAgICAgIGZvbnRTaXplOiAzMCxcbiAgICAgIGZpbGw6IDB4RDBEMEQwXG4gICAgfSk7XG5cbiAgICB0aGlzLmRvbmVUZXh0ID0gbmV3IFBJWEkuVGV4dChtc2csIHN0eWxlKTtcbiAgICB0aGlzLmRvbmVUZXh0LnggPSA3MDA7XG4gICAgdGhpcy5kb25lVGV4dC55ID0gMzUwO1xuICAgIHRoaXMuc3RhZ2UuYWRkQ2hpbGQodGhpcy5kb25lVGV4dCk7XG4gIH1cblxuICB0b29NYW55U3RlcHMoKSB7XG4gICAgcmV0dXJuICh0aGlzLnN0ZXBzVGFrZW4gPj0gdGhpcy5ib2FyZC5sb25nZXN0RXhpdFBhdGhMZW5ndGgpO1xuICB9XG5cbiAgLy8gdXBkYXRlIGFuZCBhbmltYXRlXG4gIHVwZGF0ZSgpIHtcbiAgICBpZiAodGhpcy5kb25lKSB7XG4gICAgICByZXR1cm47XG4gICAgfSBlbHNlIGlmICghdGhpcy5zdGFydGVkKSB7XG4gICAgICAvLyBzZXQgZGlyZWN0aW9uXG4gICAgICB0aGlzLm5leHRTcXVhcmVSQyA9IHRoaXMuYm9hcmQubmV4dENoZWNrZXJTcXVhcmVSQyh0aGlzLnNxdWFyZVJDKTtcbiAgICAgIHRoaXMubmV4dFBvc2l0aW9uID0gdGhpcy5ib2FyZC5jZW50ZXJPZlNxdWFyZSh0aGlzLm5leHRTcXVhcmVSQyk7XG4gICAgICB0aGlzLmN1cnJlbnRGcmFtZSsrO1xuICAgICAgdGhpcy5zdGFydGVkID0gdHJ1ZTtcbiAgICAgIHRoaXMuY3JlYXRlU3RlcHNUZXh0KCk7XG4gICAgICB0aGlzLmN1cnJlbnRGcmFtZSA9IDE7XG4gICAgfSBlbHNlIGlmICh0aGlzLmN1cnJlbnRGcmFtZSA9PT0gMCkge1xuICAgICAgLy8gYXJyaXZlIGF0IHNxdWFyZVxuICAgICAgdGhpcy5jaGVja2VyU3ByaXRlLnggPSB0aGlzLm5leHRQb3NpdGlvbi54O1xuICAgICAgdGhpcy5jaGVja2VyU3ByaXRlLnkgPSB0aGlzLm5leHRQb3NpdGlvbi55O1xuICAgICAgdGhpcy5wb3NpdGlvbiA9IHRoaXMubmV4dFBvc2l0aW9uO1xuICAgICAgdGhpcy5zcXVhcmVSQyA9IHRoaXMubmV4dFNxdWFyZVJDO1xuICAgICAgdGhpcy5zdGVwc1Rha2VuKys7XG4gICAgICB0aGlzLmNhbGN1bGF0ZU9uQm9hcmQoKTtcbiAgICAgIHRoaXMuY3JlYXRlU3RlcHNUZXh0KCk7XG4gICAgICB0aGlzLnBsYXlTb3VuZCgpO1xuICAgICAgaWYgKCF0aGlzLm9uQm9hcmQpIHtcbiAgICAgICAgdGhpcy5kb25lID0gdHJ1ZTsgLy8gZXhpdCBjb25kaXRpb25cbiAgICAgICAgdGhpcy5jcmVhdGVEb25lVGV4dCgnRXhpdGVkJylcbiAgICAgIH0gZWxzZSBpZiAodGhpcy50b29NYW55U3RlcHMoKSkge1xuICAgICAgICB0aGlzLmRvbmUgPSB0cnVlOyAvLyBsb29wIGNvbmRpdGlvblxuICAgICAgICB0aGlzLmNyZWF0ZURvbmVUZXh0KCdXaWxsIGxvb3AnKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIHNldCBuZXh0IGRpcmVjdGlvblxuICAgICAgICB0aGlzLm5leHRTcXVhcmVSQyA9IHRoaXMuYm9hcmQubmV4dENoZWNrZXJTcXVhcmVSQyh0aGlzLnNxdWFyZVJDKTtcbiAgICAgICAgdGhpcy5uZXh0UG9zaXRpb24gPSB0aGlzLmJvYXJkLmNlbnRlck9mU3F1YXJlKHRoaXMubmV4dFNxdWFyZVJDKTtcbiAgICAgICAgdGhpcy5jdXJyZW50RnJhbWUrKztcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gbW92ZSB0byBuZXh0IHNxdWFyZVxuICAgICAgbGV0IGYgPSAodGhpcy5tb3ZlbWVudEZyYW1lcyAtIHRoaXMuY3VycmVudEZyYW1lKS90aGlzLm1vdmVtZW50RnJhbWVzO1xuICAgICAgZiA9IGYgKiBmOyAvLyBuaWNlciBhbmltYXRpb25cbiAgICAgIHRoaXMuY2hlY2tlclNwcml0ZS54ID0gZip0aGlzLnBvc2l0aW9uLnggKyAoMSAtIGYpKnRoaXMubmV4dFBvc2l0aW9uLng7XG4gICAgICB0aGlzLmNoZWNrZXJTcHJpdGUueSA9IGYqdGhpcy5wb3NpdGlvbi55ICsgKDEgLSBmKSp0aGlzLm5leHRQb3NpdGlvbi55O1xuICAgICAgdGhpcy5jdXJyZW50RnJhbWUrKztcbiAgICAgIGlmICh0aGlzLmN1cnJlbnRGcmFtZSA9PT0gdGhpcy5tb3ZlbWVudEZyYW1lcykge1xuICAgICAgICB0aGlzLmN1cnJlbnRGcmFtZSA9IDA7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcGxheVNvdW5kKCkge1xuICAgIGxldCBkdXJhdGlvbiA9ICh0aGlzLm1vdmVtZW50RnJhbWVzLzYwKSozMDA7IC8vIGFzc3VtaW5nIDYwIGZwc1xuICAgIGxldCBmcmVxdWVuY3kgPSBDNCooKDIqdGhpcy5ib2FyZC5sb25nZXN0RXhpdFBhdGhMZW5ndGggLSAyKS9cbiAgICAgICh0aGlzLmJvYXJkLmxvbmdlc3RFeGl0UGF0aExlbmd0aCArIHRoaXMuc3RlcHNUYWtlbiAtIDIpKTtcbiAgICBsZXQgdG9uZTEgPSBuZXcgVG9uZShmcmVxdWVuY3ksIGR1cmF0aW9uLCAwLjA5KTtcbiAgICB0b25lMS5wbGF5KCk7XG4gICAgbGV0IHRvbmUyID0gbmV3IFRvbmUoZnJlcXVlbmN5LzIsIGR1cmF0aW9uLCAwLjAzKTtcbiAgICB0b25lMi5wbGF5KCk7XG4gIH1cbn1cbiIsIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuLi90eXBpbmdzL2luZGV4LmQudHNcIiAvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vYm9hcmQudHNcIiAvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vY2hlY2tlci50c1wiIC8+XG5cbmltcG9ydCBQSVhJID0gcmVxdWlyZSgncGl4aS5qcycpO1xuaW1wb3J0IHtCb2FyZH0gZnJvbSAnLi9ib2FyZCc7XG5pbXBvcnQge0NoZWNrZXJ9IGZyb20gJy4vY2hlY2tlcic7XG5jb25zdCByZW5kZXJlcjpQSVhJLldlYkdMUmVuZGVyZXIgPSBuZXcgUElYSS5XZWJHTFJlbmRlcmVyKDEzODAsIDgwMCk7XG5kb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHJlbmRlcmVyLnZpZXcpO1xuXG4vLyBZb3UgbmVlZCB0byBjcmVhdGUgYSByb290IGNvbnRhaW5lciB0aGF0IHdpbGwgaG9sZCB0aGUgc2NlbmUgeW91IHdhbnQgdG8gZHJhdy5cbmNvbnN0IHN0YWdlOlBJWEkuQ29udGFpbmVyID0gbmV3IFBJWEkuQ29udGFpbmVyKCk7XG5cbmxldCBwcmVzb2x2ZUJ1dHRvbiA9IG51bGw7XG5sZXQgcHJlc29sdmVCdXR0b25UZXh0ID0gbnVsbDtcbmxldCByZWdlbmVyYXRlQnV0dG9uID0gbnVsbDtcbmxldCByZWdlbmVyYXRlQnV0dG9uVGV4dCA9IG51bGw7XG5sZXQgYm9hcmRTaXplID0gMTE7XG5sZXQgc2l6ZUxhYmVsID0gbnVsbDtcbmxldCBzaXplVGV4dCA9IG51bGw7XG5sZXQgc21hbGxlckJ1dHRvbiA9IG51bGw7XG5sZXQgbGFyZ2VyQnV0dG9uID0gbnVsbDtcbmxldCBjcmVhdGVDaGVja2VyQnV0dG9uID0gbnVsbDtcbmxldCBjcmVhdGVDaGVja2VyQnV0dG9uVGV4dCA9IG51bGw7XG5sZXQgc29sdmVCdXR0b24gPSBudWxsO1xubGV0IHNvbHZlQnV0dG9uVGV4dCA9IG51bGw7XG5cblxubGV0IGNoZWNrZXIgPSBudWxsO1xuXG5sZXQgYm9hcmQgPSBudWxsO1xuZ2VuZXJhdGVCb2FyZCgpO1xuXG5mdW5jdGlvbiBnZW5lcmF0ZUJvYXJkKCkge1xuICBkZXN0cm95Q2hlY2tlcigpO1xuICBpZiAoYm9hcmQgIT09IG51bGwpIHtcbiAgICBib2FyZC5kZXN0cm95KCk7XG4gIH1cbiAgYm9hcmQgPSBuZXcgQm9hcmQoYm9hcmRTaXplLCBzdGFnZSk7XG4gIGJvYXJkLmluaXRCb2FyZFJlbmRlcigpO1xuICBjcmVhdGVVSSgpO1xuICByZW5kZXJlci5yZW5kZXIoc3RhZ2UpO1xufVxuXG5mdW5jdGlvbiBpbmNyZW1lbnRTaXplKCkge1xuICBib2FyZFNpemUrKztcbiAgY3JlYXRlU2l6ZVVJKCk7XG4gIHJlbmRlcmVyLnJlbmRlcihzdGFnZSk7XG59XG5cbmZ1bmN0aW9uIGRlY3JlbWVudFNpemUoKSB7XG4gIGJvYXJkU2l6ZS0tO1xuICBjcmVhdGVTaXplVUkoKTtcbiAgcmVuZGVyZXIucmVuZGVyKHN0YWdlKTtcbn1cblxubGV0IHByZXNvbHZlQW5pbWF0aW9uID0gbnVsbDsgLy8gdG8gc3RvcCBhbmltYXRpb24gb2YgcHJlc29sdmluZ1xuZnVuY3Rpb24gcHJlc29sdmUoKSB7XG4gIGJvYXJkLnByZXNvbHZlKCk7XG4gIGNyZWF0ZVByZXNvbHZlQnV0dG9uKCk7IC8vIGNyZWF0ZSB0aGUgZGlzYWJsZWQgYnV0dG9uXG4gIGZ1bmN0aW9uIGFuaW1hdGVQcmVzb2x1dGlvbigpIHtcbiAgICBpZiAocHJlc29sdmVBbmltYXRpb24gIT09IG51bGwgJiYgYm9hcmQuZXZlbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgY2FuY2VsQW5pbWF0aW9uRnJhbWUocHJlc29sdmVBbmltYXRpb24pO1xuICAgICAgcHJlc29sdmVBbmltYXRpb24gPSBudWxsO1xuICAgICAgY3JlYXRlQ3JlYXRlQ2hlY2tlckJ1dHRvbigpO1xuICAgIH0gZWxzZSB7XG4gICAgICBwcmVzb2x2ZUFuaW1hdGlvbiA9IHJlcXVlc3RBbmltYXRpb25GcmFtZShhbmltYXRlUHJlc29sdXRpb24pO1xuICAgIH1cbiAgICBib2FyZC5zdGVwUHJlc29sdXRpb25BbmltYXRpb24oKTtcbiAgICByZW5kZXJlci5yZW5kZXIoc3RhZ2UpO1xuICB9XG4gIGFuaW1hdGVQcmVzb2x1dGlvbigpO1xufVxuXG5mdW5jdGlvbiBkZXN0cm95Q2hlY2tlcigpIHtcbiAgaWYgKGNoZWNrZXIgIT09IG51bGwpIHtcbiAgICBpZiAoc29sdmVBbmltYXRpb24gIT09IG51bGwpIHtcbiAgICAgIGNhbmNlbEFuaW1hdGlvbkZyYW1lKHNvbHZlQW5pbWF0aW9uKTtcbiAgICAgIHNvbHZlQW5pbWF0aW9uID0gbnVsbDtcbiAgICB9XG4gICAgY2hlY2tlci5kZXN0cm95KCk7XG4gICAgY2hlY2tlciA9IG51bGw7XG4gIH1cbn1cblxuZnVuY3Rpb24gY3JlYXRlQ2hlY2tlcigpIHtcbiAgZGVzdHJveUNoZWNrZXIoKTtcbiAgbGV0IHJvdyA9IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSpib2FyZFNpemUpO1xuICBsZXQgY29sID0gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpKmJvYXJkU2l6ZSk7XG4gIGNoZWNrZXIgPSBuZXcgQ2hlY2tlcihib2FyZCwgcm93LCBjb2wsIHN0YWdlKTtcbiAgY2hlY2tlci5pbml0Q2hlY2tlclJlbmRlcigpO1xuICBjcmVhdGVVSSgpO1xuICByZW5kZXJlci5yZW5kZXIoc3RhZ2UpO1xufVxuXG5sZXQgc29sdmVBbmltYXRpb24gPSBudWxsO1xuZnVuY3Rpb24gc29sdmUoKSB7XG4gIGNyZWF0ZVNvbHZlQnV0dG9uKCk7XG4gIGZ1bmN0aW9uIGFuaW1hdGVTb2x1dGlvbigpIHtcbiAgICBpZiAoY2hlY2tlci5kb25lKSB7XG4gICAgICBjYW5jZWxBbmltYXRpb25GcmFtZShzb2x2ZUFuaW1hdGlvbik7XG4gICAgICBzb2x2ZUFuaW1hdGlvbiA9IG51bGw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHNvbHZlQW5pbWF0aW9uID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKGFuaW1hdGVTb2x1dGlvbik7XG4gICAgfVxuICAgIGNoZWNrZXIudXBkYXRlKCk7XG4gICAgcmVuZGVyZXIucmVuZGVyKHN0YWdlKTtcbiAgfVxuICBhbmltYXRlU29sdXRpb24oKTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlVUkoKSB7XG4gIGNyZWF0ZVJlZ2VuZXJhdGVCdXR0b24oKTtcbiAgY3JlYXRlUHJlc29sdmVCdXR0b24oKTtcbiAgY3JlYXRlU2l6ZVVJKCk7XG4gIGNyZWF0ZUNyZWF0ZUNoZWNrZXJCdXR0b24oKTtcbiAgY3JlYXRlU29sdmVCdXR0b24oKTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlU2l6ZVVJKCkge1xuICBpZiAoc2l6ZUxhYmVsICE9PSBudWxsKSB7XG4gICAgc3RhZ2UucmVtb3ZlQ2hpbGQoc2l6ZUxhYmVsKTtcbiAgICBzaXplTGFiZWwgPSBudWxsO1xuICB9XG4gIGlmIChzaXplVGV4dCAhPT0gbnVsbCkge1xuICAgIHN0YWdlLnJlbW92ZUNoaWxkKHNpemVUZXh0KTtcbiAgICBzaXplVGV4dCA9IG51bGw7XG4gIH1cbiAgaWYgKHNtYWxsZXJCdXR0b24gIT09IG51bGwpIHtcbiAgICBzdGFnZS5yZW1vdmVDaGlsZChzbWFsbGVyQnV0dG9uKTtcbiAgICBzbWFsbGVyQnV0dG9uID0gbnVsbDtcbiAgfVxuICBpZiAobGFyZ2VyQnV0dG9uICE9PSBudWxsKSB7XG4gICAgc3RhZ2UucmVtb3ZlQ2hpbGQobGFyZ2VyQnV0dG9uKTtcbiAgICBsYXJnZXJCdXR0b24gPSBudWxsO1xuICB9XG5cbiAgbGV0IHN0eWxlID0gbmV3IFBJWEkuVGV4dFN0eWxlKHtcbiAgICBmb250U2l6ZTogMjQsXG4gICAgZmlsbDogMHhEMEQwRDBcbiAgfSk7XG5cbiAgbGV0IGxhYmVsID0gbmV3IFBJWEkuVGV4dCgnU2l6ZTogJywgc3R5bGUpO1xuICBsYWJlbC54ID0gNzAwO1xuICBsYWJlbC55ID0gNTA7XG5cbiAgc3RhZ2UuYWRkQ2hpbGQobGFiZWwpO1xuICBzaXplTGFiZWwgPSBsYWJlbDtcblxuICBsZXQgY2VudGVyWCA9IDc3MjsgLy8gZm9yIHVwL2Rvd24gYnV0dG9uc1xuXG4gIGxldCB1cEJ1dHRvbiA9IG5ldyBQSVhJLkdyYXBoaWNzKCk7XG4gIHVwQnV0dG9uLmJlZ2luRmlsbCgweEQwRDBEMCk7XG4gIHVwQnV0dG9uLmRyYXdQb2x5Z29uKFtcbiAgICBjZW50ZXJYLCA1MyxcbiAgICBjZW50ZXJYICsgMTAsIDYzLFxuICAgIGNlbnRlclggLSAxMCwgNjNcbiAgXSk7XG4gIHVwQnV0dG9uLmVuZEZpbGwoKTtcblxuICB1cEJ1dHRvbi5pbnRlcmFjdGl2ZSA9IHRydWU7XG4gIHVwQnV0dG9uLm9uKCdtb3VzZXVwJywgaW5jcmVtZW50U2l6ZSk7XG5cbiAgc3RhZ2UuYWRkQ2hpbGQodXBCdXR0b24pO1xuICBsYXJnZXJCdXR0b24gPSB1cEJ1dHRvbjtcblxuICBsZXQgZG93bkJ1dHRvbiA9IG5ldyBQSVhJLkdyYXBoaWNzKCk7XG4gIGlmIChib2FyZFNpemUgPiAyKSB7XG4gICAgZG93bkJ1dHRvbi5iZWdpbkZpbGwoMHhEMEQwRDApO1xuICB9IGVsc2Uge1xuICAgIGRvd25CdXR0b24uYmVnaW5GaWxsKDB4ODA4MDgwKTtcbiAgfVxuICBkb3duQnV0dG9uLmRyYXdQb2x5Z29uKFtcbiAgICBjZW50ZXJYLCA3NyxcbiAgICBjZW50ZXJYIC0gMTAsIDY3LFxuICAgIGNlbnRlclggKyAxMCwgNjdcbiAgXSk7XG4gIGRvd25CdXR0b24uZW5kRmlsbCgpO1xuXG4gIGlmIChib2FyZFNpemUgPiAyKSB7XG4gICAgZG93bkJ1dHRvbi5pbnRlcmFjdGl2ZSA9IHRydWU7XG4gICAgZG93bkJ1dHRvbi5vbignbW91c2V1cCcsIGRlY3JlbWVudFNpemUpO1xuICB9XG5cbiAgc3RhZ2UuYWRkQ2hpbGQoZG93bkJ1dHRvbik7XG4gIHNtYWxsZXJCdXR0b24gPSBkb3duQnV0dG9uO1xuXG4gIGxldCB0ZXh0ID0gbmV3IFBJWEkuVGV4dCgnJyArIGJvYXJkU2l6ZSwgc3R5bGUpO1xuICB0ZXh0LnggPSBjZW50ZXJYICsgMTQ7XG4gIHRleHQueSA9IDUwO1xuXG4gIHN0YWdlLmFkZENoaWxkKHRleHQpO1xuICBzaXplVGV4dCA9IHRleHQ7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVJlZ2VuZXJhdGVCdXR0b24oKSB7XG4gIGlmIChyZWdlbmVyYXRlQnV0dG9uICE9PSBudWxsKSB7XG4gICAgc3RhZ2UucmVtb3ZlQ2hpbGQocmVnZW5lcmF0ZUJ1dHRvbik7XG4gICAgcmVnZW5lcmF0ZUJ1dHRvbiA9IG51bGw7XG4gIH1cbiAgaWYgKHJlZ2VuZXJhdGVCdXR0b25UZXh0ICE9PSBudWxsKSB7XG4gICAgc3RhZ2UucmVtb3ZlQ2hpbGQocmVnZW5lcmF0ZUJ1dHRvblRleHQpO1xuICAgIHJlZ2VuZXJhdGVCdXR0b25UZXh0ID0gbnVsbDtcbiAgfVxuXG4gIGxldCBidXR0b24gPSBuZXcgUElYSS5HcmFwaGljcygpO1xuICBidXR0b24ubGluZVN0eWxlKDIsIDB4ODA4MEZGLCAxKTtcbiAgYnV0dG9uLmJlZ2luRmlsbCgweEQwRDBEMCk7XG4gIGJ1dHRvbi5kcmF3Um91bmRlZFJlY3QoNzAwLCA5MCwgMTU1LCAzMCwgNyk7XG4gIGJ1dHRvbi5lbmRGaWxsKCk7XG5cbiAgYnV0dG9uLmludGVyYWN0aXZlID0gdHJ1ZTtcbiAgYnV0dG9uLm9uKCdtb3VzZXVwJywgZ2VuZXJhdGVCb2FyZCk7XG5cbiAgc3RhZ2UuYWRkQ2hpbGQoYnV0dG9uKTtcbiAgcmVnZW5lcmF0ZUJ1dHRvbiA9IGJ1dHRvbjtcblxuICBsZXQgc3R5bGUgPSBuZXcgUElYSS5UZXh0U3R5bGUoe1xuICAgIGZvbnRTaXplOiAyMCxcbiAgICBmaWxsOiAweDIwMjAyMFxuICB9KTtcblxuICBsZXQgdGV4dCA9IG5ldyBQSVhJLlRleHQoJ1JlZ2VuZXJhdGUnLCBzdHlsZSk7XG4gIHRleHQueCA9IDcyNjtcbiAgdGV4dC55ID0gOTM7XG5cbiAgc3RhZ2UuYWRkQ2hpbGQodGV4dCk7XG4gIHJlZ2VuZXJhdGVCdXR0b25UZXh0ID0gdGV4dDtcbn1cblxuZnVuY3Rpb24gY3JlYXRlUHJlc29sdmVCdXR0b24oKSB7XG4gIGlmIChwcmVzb2x2ZUJ1dHRvbiAhPT0gbnVsbCkge1xuICAgIHN0YWdlLnJlbW92ZUNoaWxkKHByZXNvbHZlQnV0dG9uKTtcbiAgICBwcmVzb2x2ZUJ1dHRvbiA9IG51bGw7XG4gIH1cbiAgaWYgKHByZXNvbHZlQnV0dG9uVGV4dCAhPT0gbnVsbCkge1xuICAgIHN0YWdlLnJlbW92ZUNoaWxkKHByZXNvbHZlQnV0dG9uVGV4dCk7XG4gICAgcHJlc29sdmVCdXR0b25UZXh0ID0gbnVsbDtcbiAgfVxuXG4gIGxldCBidXR0b24gPSBuZXcgUElYSS5HcmFwaGljcygpO1xuICBidXR0b24ubGluZVN0eWxlKDIsIDB4ODA4MEZGLCAxKTtcbiAgaWYgKGJvYXJkLnByZXNvbHZlZCkge1xuICAgIGJ1dHRvbi5iZWdpbkZpbGwoMHg4MDgwODApO1xuICB9IGVsc2Uge1xuICAgIGJ1dHRvbi5iZWdpbkZpbGwoMHhEMEQwRDApO1xuICB9XG4gIGJ1dHRvbi5kcmF3Um91bmRlZFJlY3QoNzAwLCAxMzAsIDE1NSwgMzAsIDcpO1xuICBidXR0b24uZW5kRmlsbCgpO1xuXG4gIGlmICghYm9hcmQucHJlc29sdmVkKSB7XG4gICAgYnV0dG9uLmludGVyYWN0aXZlID0gdHJ1ZTtcbiAgICBidXR0b24ub24oJ21vdXNldXAnLCBwcmVzb2x2ZSk7XG4gIH1cblxuICBzdGFnZS5hZGRDaGlsZChidXR0b24pO1xuICBwcmVzb2x2ZUJ1dHRvbiA9IGJ1dHRvbjtcblxuICBsZXQgc3R5bGUgPSBuZXcgUElYSS5UZXh0U3R5bGUoe1xuICAgIGZvbnRTaXplOiAyMCxcbiAgICBmaWxsOiAweDIwMjAyMFxuICB9KTtcblxuICBsZXQgdGV4dCA9IG5ldyBQSVhJLlRleHQoJ1ByZXNvbHZlJywgc3R5bGUpO1xuICB0ZXh0LnggPSA3Mzk7XG4gIHRleHQueSA9IDEzMztcblxuICBzdGFnZS5hZGRDaGlsZCh0ZXh0KTtcbiAgcHJlc29sdmVCdXR0b25UZXh0ID0gdGV4dDtcbn1cblxuZnVuY3Rpb24gY3JlYXRlQ3JlYXRlQ2hlY2tlckJ1dHRvbigpIHtcbiAgaWYgKGNyZWF0ZUNoZWNrZXJCdXR0b24gIT09IG51bGwpIHtcbiAgICBzdGFnZS5yZW1vdmVDaGlsZChjcmVhdGVDaGVja2VyQnV0dG9uKTtcbiAgICBjcmVhdGVDaGVja2VyQnV0dG9uID0gbnVsbDtcbiAgfVxuICBpZiAoY3JlYXRlQ2hlY2tlckJ1dHRvblRleHQgIT09IG51bGwpIHtcbiAgICBzdGFnZS5yZW1vdmVDaGlsZChjcmVhdGVDaGVja2VyQnV0dG9uVGV4dCk7XG4gICAgY3JlYXRlQ2hlY2tlckJ1dHRvblRleHQgPSBudWxsO1xuICB9XG5cbiAgbGV0IGJ1dHRvbiA9IG5ldyBQSVhJLkdyYXBoaWNzKCk7XG4gIGJ1dHRvbi5saW5lU3R5bGUoMiwgMHg4MDgwRkYsIDEpO1xuICBpZiAoYm9hcmQucHJlc29sdmVkKSB7XG4gICAgYnV0dG9uLmJlZ2luRmlsbCgweEQwRDBEMCk7XG4gIH0gZWxzZSB7XG4gICAgYnV0dG9uLmJlZ2luRmlsbCgweDgwODA4MCk7XG4gIH1cbiAgYnV0dG9uLmRyYXdSb3VuZGVkUmVjdCg3MDAsIDIxMCwgMTU1LCAzMCwgNyk7XG4gIGJ1dHRvbi5lbmRGaWxsKCk7XG5cbiAgaWYgKGJvYXJkLnByZXNvbHZlZCkge1xuICAgIGJ1dHRvbi5pbnRlcmFjdGl2ZSA9IHRydWU7XG4gICAgYnV0dG9uLm9uKCdtb3VzZXVwJywgY3JlYXRlQ2hlY2tlcik7XG4gIH1cblxuICBzdGFnZS5hZGRDaGlsZChidXR0b24pO1xuICBjcmVhdGVDaGVja2VyQnV0dG9uID0gYnV0dG9uO1xuXG4gIGxldCBzdHlsZSA9IG5ldyBQSVhJLlRleHRTdHlsZSh7XG4gICAgZm9udFNpemU6IDIwLFxuICAgIGZpbGw6IDB4MjAyMDIwXG4gIH0pO1xuXG4gIGxldCB0ZXh0ID0gbmV3IFBJWEkuVGV4dCgnQ3JlYXRlIENoZWNrZXInLCBzdHlsZSk7XG4gIHRleHQueCA9IDcwNztcbiAgdGV4dC55ID0gMjEzO1xuXG4gIHN0YWdlLmFkZENoaWxkKHRleHQpO1xuICBjcmVhdGVDaGVja2VyQnV0dG9uVGV4dCA9IHRleHQ7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVNvbHZlQnV0dG9uKCkge1xuICBpZiAoc29sdmVCdXR0b24gIT09IG51bGwpIHtcbiAgICBzdGFnZS5yZW1vdmVDaGlsZChzb2x2ZUJ1dHRvbik7XG4gICAgc29sdmVCdXR0b24gPSBudWxsO1xuICB9XG4gIGlmIChzb2x2ZUJ1dHRvblRleHQgIT09IG51bGwpIHtcbiAgICBzdGFnZS5yZW1vdmVDaGlsZChzb2x2ZUJ1dHRvblRleHQpO1xuICAgIHNvbHZlQnV0dG9uVGV4dCA9IG51bGw7XG4gIH1cblxuICBsZXQgZW5hYmxlZCA9IGNoZWNrZXIgIT09IG51bGwgJiYgIWNoZWNrZXIuc3RhcnRlZDtcblxuICBsZXQgYnV0dG9uID0gbmV3IFBJWEkuR3JhcGhpY3MoKTtcbiAgYnV0dG9uLmxpbmVTdHlsZSgyLCAweDgwODBGRiwgMSk7XG4gIGlmIChlbmFibGVkKSB7XG4gICAgYnV0dG9uLmJlZ2luRmlsbCgweEQwRDBEMCk7XG4gIH0gZWxzZSB7XG4gICAgYnV0dG9uLmJlZ2luRmlsbCgweDgwODA4MCk7XG4gIH1cbiAgYnV0dG9uLmRyYXdSb3VuZGVkUmVjdCg3MDAsIDI1MCwgMTU1LCAzMCwgNyk7XG4gIGJ1dHRvbi5lbmRGaWxsKCk7XG5cbiAgaWYgKGVuYWJsZWQpIHtcbiAgICBidXR0b24uaW50ZXJhY3RpdmUgPSB0cnVlO1xuICAgIGJ1dHRvbi5vbignbW91c2V1cCcsIHNvbHZlKTtcbiAgfVxuXG4gIHN0YWdlLmFkZENoaWxkKGJ1dHRvbik7XG4gIHNvbHZlQnV0dG9uID0gYnV0dG9uO1xuXG4gIGxldCBzdHlsZSA9IG5ldyBQSVhJLlRleHRTdHlsZSh7XG4gICAgZm9udFNpemU6IDIwLFxuICAgIGZpbGw6IDB4MjAyMDIwXG4gIH0pO1xuXG4gIGxldCB0ZXh0ID0gbmV3IFBJWEkuVGV4dCgnU29sdmUnLCBzdHlsZSk7XG4gIHRleHQueCA9IDc1MjtcbiAgdGV4dC55ID0gMjUzO1xuXG4gIHN0YWdlLmFkZENoaWxkKHRleHQpO1xuICBzb2x2ZUJ1dHRvblRleHQgPSB0ZXh0O1xufVxuXG4vKi8vIERlY2xhcmUgYSBnbG9iYWwgdmFyaWFibGUgZm9yIG91ciBzcHJpdGUgc28gdGhhdCB0aGUgYW5pbWF0ZSBmdW5jdGlvbiBjYW4gYWNjZXNzIGl0LlxubGV0IGJ1bm55OlBJWEkuU3ByaXRlID0gbnVsbDtcblxuLy8gbG9hZCB0aGUgdGV4dHVyZSB3ZSBuZWVkXG5QSVhJLmxvYWRlci5hZGQoJ2J1bm55JywgJ2ltYWdlcy9idW5ueS5qcGVnJykubG9hZChmdW5jdGlvbiAobG9hZGVyOlBJWEkubG9hZGVycy5Mb2FkZXIsIHJlc291cmNlczphbnkpIHtcbiAgICAvLyBUaGlzIGNyZWF0ZXMgYSB0ZXh0dXJlIGZyb20gYSAnYnVubnkucG5nJyBpbWFnZS5cbiAgICBidW5ueSA9IG5ldyBQSVhJLlNwcml0ZShyZXNvdXJjZXMuYnVubnkudGV4dHVyZSk7XG5cbiAgICAvLyBTZXR1cCB0aGUgcG9zaXRpb24gYW5kIHNjYWxlIG9mIHRoZSBidW5ueVxuICAgIGJ1bm55LnBvc2l0aW9uLnggPSA0MDA7XG4gICAgYnVubnkucG9zaXRpb24ueSA9IDMwMDtcblxuICAgIGJ1bm55LnNjYWxlLnggPSAyO1xuICAgIGJ1bm55LnNjYWxlLnkgPSAyO1xuXG4gICAgLy8gQWRkIHRoZSBidW5ueSB0byB0aGUgc2NlbmUgd2UgYXJlIGJ1aWxkaW5nLlxuICAgIHN0YWdlLmFkZENoaWxkKGJ1bm55KTtcblxuICAgIC8vIGtpY2sgb2ZmIHRoZSBhbmltYXRpb24gbG9vcCAoZGVmaW5lZCBiZWxvdylcbiAgICBhbmltYXRlKCk7XG59KTtcblxuZnVuY3Rpb24gYW5pbWF0ZSgpIHtcbiAgICAvLyBzdGFydCB0aGUgdGltZXIgZm9yIHRoZSBuZXh0IGFuaW1hdGlvbiBsb29wXG4gICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKGFuaW1hdGUpO1xuXG4gICAgLy8gZWFjaCBmcmFtZSB3ZSBzcGluIHRoZSBidW5ueSBhcm91bmQgYSBiaXRcbiAgICBidW5ueS5yb3RhdGlvbiArPSAwLjAxO1xuXG4gICAgLy8gdGhpcyBpcyB0aGUgbWFpbiByZW5kZXIgY2FsbCB0aGF0IG1ha2VzIHBpeGkgZHJhdyB5b3VyIGNvbnRhaW5lciBhbmQgaXRzIGNoaWxkcmVuLlxuICAgIHJlbmRlcmVyLnJlbmRlcihzdGFnZSk7XG59Ki9cbiIsIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuLi90eXBpbmdzL2luZGV4LmQudHNcIiAvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vYXVkaW8udHNcIiAvPlxuXG5pbXBvcnQge0F1ZGlvUGxheWVyfSBmcm9tICcuL2F1ZGlvJztcblxuY29uc3Qgc2FtcGxlUmF0ZSA9IDQ0MTAwO1xuY29uc3QgbXNwYSA9IDEwMDAvc2FtcGxlUmF0ZTsgLy8gbXMgcGVyIGF1ZGlvIGZyYW1lXG5cbmV4cG9ydCBjbGFzcyBUb25lIHtcbiAgc3RhdGljIHBsYXllciA9IG5ldyBBdWRpb1BsYXllcigpO1xuXG4gIGlzUGxheWluZzogYm9vbGVhbjtcbiAgZnJlcXVlbmN5OiBudW1iZXI7IC8vIHNeLTFcbiAgZHVyYXRpb246IG51bWJlcjsgLy8gbXNcbiAgZ2FpbjogbnVtYmVyO1xuICBmcmFtZTogbnVtYmVyO1xuICBwaGFzZTogbnVtYmVyO1xuICBlbnZlbG9wZToge1xuICAgIGF0dGFjazogbnVtYmVyLCAvLyBtc1xuICAgIGRlY2F5OiBudW1iZXIsXG4gICAgcmVsZWFzZTogbnVtYmVyLCAvLyBhZnRlciBkdXJhdGlvblxuICAgIGF0dGFja0dhaW46IG51bWJlciwgLy8gcGVhayBzaXplIGZvciBhdHRhY2tcbiAgfVxuICBhdHRhY2tVbnRpbEZyYW1lOiBudW1iZXI7XG4gIGRlY2F5VW50aWxGcmFtZTogbnVtYmVyO1xuICBzdXN0YWluVW50aWxGcmFtZTogbnVtYmVyO1xuICByZWxlYXNlVW50aWxGcmFtZTogbnVtYmVyO1xuXG4gIGNvbnN0cnVjdG9yKGZyZXF1ZW5jeTogbnVtYmVyLCBkdXJhdGlvbjogbnVtYmVyLCBnYWluOiBudW1iZXIpIHtcbiAgICAvLyB0aGVyZSBjb3VsZCBiZSBhIGxvdCBtb3JlIGZlYXR1cmVzLCBidXQgd2UgZG9uJ3QgbmVlZCB0aGVtIGhlcmVcbiAgICB0aGlzLmZyZXF1ZW5jeSA9IGZyZXF1ZW5jeTtcbiAgICB0aGlzLmR1cmF0aW9uID0gZHVyYXRpb247IC8vIG1zXG4gICAgdGhpcy5nYWluID0gZ2FpbjtcbiAgICB0aGlzLmlzUGxheWluZyA9IGZhbHNlO1xuICAgIHRoaXMuZnJhbWUgPSAwO1xuICAgIHRoaXMucGhhc2UgPSBNYXRoLnJhbmRvbSgpKjIuMCpNYXRoLlBJO1xuICAgIHRoaXMuZW52ZWxvcGUgPSB7XG4gICAgICBhdHRhY2s6IDEwLFxuICAgICAgZGVjYXk6IDEwLFxuICAgICAgcmVsZWFzZTogMjAsXG4gICAgICBhdHRhY2tHYWluOiAyXG4gICAgfTtcbiAgfVxuXG4gIGNhbGN1bGF0ZUZyYW1lcygpIHtcbiAgICB0aGlzLmF0dGFja1VudGlsRnJhbWUgPSB0aGlzLmVudmVsb3BlLmF0dGFjay9tc3BhO1xuICAgIHRoaXMuZGVjYXlVbnRpbEZyYW1lID0gdGhpcy5hdHRhY2tVbnRpbEZyYW1lICsgdGhpcy5lbnZlbG9wZS5kZWNheS9tc3BhO1xuICAgIHRoaXMuc3VzdGFpblVudGlsRnJhbWUgPSB0aGlzLmR1cmF0aW9uL21zcGE7XG4gICAgdGhpcy5yZWxlYXNlVW50aWxGcmFtZSA9IHRoaXMuc3VzdGFpblVudGlsRnJhbWUgKyB0aGlzLmVudmVsb3BlLnJlbGVhc2UvbXNwYTtcbiAgfVxuXG4gIHBsYXkoKSB7XG4gICAgdGhpcy5jYWxjdWxhdGVGcmFtZXMoKTtcbiAgICB0aGlzLmlzUGxheWluZyA9IHRydWU7XG4gICAgVG9uZS5wbGF5ZXIubm90ZXMucHVzaCh0aGlzKTtcbiAgfVxuXG4gIGdlbmVyYXRlRW52ZWxvcGUoKSB7XG4gICAgaWYgKHRoaXMuZnJhbWUgPCB0aGlzLmF0dGFja1VudGlsRnJhbWUpIHtcbiAgICAgIHJldHVybiAodGhpcy5mcmFtZS90aGlzLmF0dGFja1VudGlsRnJhbWUpKnRoaXMuZW52ZWxvcGUuYXR0YWNrR2FpbjtcbiAgICB9IGVsc2UgaWYgKHRoaXMuZnJhbWUgPCB0aGlzLmRlY2F5VW50aWxGcmFtZSkge1xuICAgICAgcmV0dXJuIChcbiAgICAgICAgICAodGhpcy5mcmFtZSAtIHRoaXMuYXR0YWNrVW50aWxGcmFtZSkvXG4gICAgICAgICAgKHRoaXMuZGVjYXlVbnRpbEZyYW1lIC0gdGhpcy5hdHRhY2tVbnRpbEZyYW1lKVxuICAgICAgICApKigxIC0gdGhpcy5lbnZlbG9wZS5hdHRhY2tHYWluKSArXG4gICAgICAgIHRoaXMuZW52ZWxvcGUuYXR0YWNrR2FpbjtcbiAgICB9IGVsc2UgaWYgKHRoaXMuZnJhbWUgPCB0aGlzLnN1c3RhaW5VbnRpbEZyYW1lKSB7XG4gICAgICByZXR1cm4gMS4wO1xuICAgIH0gZWxzZSBpZiAodGhpcy5mcmFtZSA8IHRoaXMucmVsZWFzZVVudGlsRnJhbWUpIHtcbiAgICAgIHJldHVybiAxLjAgLSAodGhpcy5mcmFtZSAtIHRoaXMuc3VzdGFpblVudGlsRnJhbWUpL1xuICAgICAgICAodGhpcy5yZWxlYXNlVW50aWxGcmFtZSAtIHRoaXMuc3VzdGFpblVudGlsRnJhbWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmlzUGxheWluZyA9IGZhbHNlO1xuICAgICAgcmV0dXJuIDA7XG4gICAgfVxuICB9XG5cbiAgZ2VuZXJhdGUoKSB7XG4gICAgLy8gdHJpYW5nbGUgd2F2ZSAtLSB3ZSBjb3VsZCB1c2UgYSB2YXJpZXR5IGJ1dCB3ZSB3b24ndFxuICAgIGxldCBzYW1wbGUgPSAyLjAqTWF0aC5hYnMoKHRoaXMucGhhc2UvTWF0aC5QSSkgLSAxLjApIC0gMS4wO1xuICAgIHNhbXBsZSAqPSB0aGlzLmdhaW4qdGhpcy5nZW5lcmF0ZUVudmVsb3BlKCk7XG4gICAgLy8gdXBkYXRlXG4gICAgdGhpcy5waGFzZSArPSBNYXRoLlBJKnRoaXMuZnJlcXVlbmN5Km1zcGEvNTAwO1xuICAgIHdoaWxlICh0aGlzLnBoYXNlID4gMipNYXRoLlBJKSB7XG4gICAgICB0aGlzLnBoYXNlIC09IDIqTWF0aC5QSTtcbiAgICB9XG4gICAgdGhpcy5mcmFtZSsrO1xuXG4gICAgcmV0dXJuIHNhbXBsZTtcbiAgfVxufVxuIl19

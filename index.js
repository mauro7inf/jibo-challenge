(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.jiboProgrammingChallenge = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/// <reference path="../typings/index.d.ts" />
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
    stepPresolutionAnimation() {
        if (this.events.length > 0 && this.currentRestFrame <= 0) {
            let renderEvents = this.events.shift();
            for (let i = 0; i < renderEvents.length; i++) {
                this.processRenderEvent(renderEvents[i]);
            }
            this.currentRestFrame += this.framesBetweenEvents;
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

},{}],2:[function(require,module,exports){
/// <reference path="../typings/index.d.ts" />
/// <reference path="./board.ts" />
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
}
exports.Checker = Checker;

},{}],3:[function(require,module,exports){
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

},{"./board":1,"./checker":2,"pixi.js":undefined}]},{},[3])(3)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvYm9hcmQudHMiLCJzcmMvY2hlY2tlci50cyIsInNyYy9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBLDhDQUE4Qzs7O0FBRTlDLElBQUssU0FLSjtBQUxELFdBQUssU0FBUztJQUNaLHFDQUFNLENBQUE7SUFDTix5Q0FBSSxDQUFBO0lBQ0oseUNBQUksQ0FBQTtJQUNKLDJDQUFLLENBQUE7QUFDUCxDQUFDLEVBTEksU0FBUyxLQUFULFNBQVMsUUFLYjtBQUVELE1BQU0sVUFBVSxHQUFHLENBQUMsU0FBUyxDQUFDLEVBQUUsRUFBRSxTQUFTLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxJQUFJLEVBQUUsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBRW5GO0lBeUJFLFlBQVksSUFBWSxFQUFFLEtBQXFCO1FBQzdDLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO1FBQ2pCLElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO1FBQ25CLElBQUksQ0FBQyxNQUFNLEdBQUcsRUFBRSxDQUFDO1FBQ2pCLElBQUksQ0FBQyxXQUFXLEdBQUcsRUFBRSxDQUFDO1FBQ3RCLElBQUksQ0FBQyxNQUFNLEdBQUcsRUFBRSxDQUFDO1FBQ2pCLElBQUksQ0FBQyxZQUFZLEdBQUcsRUFBRSxDQUFDO1FBQ3ZCLElBQUksQ0FBQyxTQUFTLEdBQUcsS0FBSyxDQUFDO1FBQ3ZCLElBQUksQ0FBQyxtQkFBbUIsR0FBRyxDQUFDLENBQUM7UUFDN0IsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQ25CLElBQUksQ0FBQyxtQkFBbUIsR0FBRyxDQUFDLENBQUMsQ0FBQyxpQ0FBaUM7UUFDakUsQ0FBQztRQUNELElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxDQUFDLENBQUM7UUFDMUIsSUFBSSxDQUFDLGtCQUFrQixH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LENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQzdDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsQ0FBQztJQUVqQixFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1FBQ1osTUFBTSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUM7UUFDMUIsTUFBTSxDQUFDLEVBQUUsQ0FBQyxTQUFTLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDOUIsQ0FBQztJQUVELEtBQUssQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDdkIsV0FBVyxHQUFHLE1BQU0sQ0FBQztJQUVyQixJQUFJLEtBQUssR0FBRyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUM7UUFDN0IsUUFBUSxFQUFFLEVBQUU7UUFDWixJQUFJLEVBQUUsUUFBUTtLQUNmLENBQUMsQ0FBQztJQUVILElBQUksSUFBSSxHQUFHLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDekMsSUFBSSxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUM7SUFDYixJQUFJLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQztJQUViLEtBQUssQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDckIsZUFBZSxHQUFHLElBQUksQ0FBQztBQUN6QixDQUFDO0FBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0ErQkciLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4uL3R5cGluZ3MvaW5kZXguZC50c1wiIC8+XG5cbmVudW0gRGlyZWN0aW9uIHtcbiAgVXAgPSAwLFxuICBEb3duLFxuICBMZWZ0LFxuICBSaWdodFxufVxuXG5jb25zdCBkaXJlY3Rpb25zID0gW0RpcmVjdGlvbi5VcCwgRGlyZWN0aW9uLkRvd24sIERpcmVjdGlvbi5MZWZ0LCBEaXJlY3Rpb24uUmlnaHRdO1xuXG5leHBvcnQgY2xhc3MgQm9hcmQge1xuICBzaXplOiBudW1iZXI7XG4gIGFycm93czogRGlyZWN0aW9uW107XG4gIGV4aXRTcXVhcmVzOiBib29sZWFuW107XG4gIHByZXNvbHZlZDogYm9vbGVhbjtcbiAgbG9uZ2VzdEV4aXRQYXRoTGVuZ3RoOiBudW1iZXI7XG4gIC8vIGRyYXdpbmdcbiAgc3RhZ2U6IFBJWEkuQ29udGFpbmVyO1xuICBldmVudHM6IGFueVtdW107IC8vIHJlY29yZCBzdGVwcyB0byByZW5kZXIgbGF0ZXJcbiAgY3VycmVudEV2ZW50OiBhbnlbXTtcbiAgZnJhbWVzQmV0d2VlbkV2ZW50czogbnVtYmVyO1xuICBjdXJyZW50UmVzdEZyYW1lOiBudW1iZXI7XG4gIGRyYXdpbmdFeGl0U3F1YXJlczogYm9vbGVhbltdO1xuICBkcmF3aW5nQmFja3RyYWNlU3F1YXJlczogYm9vbGVhbltdO1xuICBkcmF3aW5nTG9uZ2VzdFBhdGg6IG51bWJlcjtcbiAgbG9uZ2VzdFBhdGhUZXh0OiBQSVhJLlRleHQ7XG4gIFRMOiB7eDogbnVtYmVyLCB5OiBudW1iZXJ9OyAvLyB0b3AgbGVmdCBjb3JuZXIgKHRoZXJlIHdpbGwgYmUgYSAxLXNxdWFyZSBidWZmZXIgYXJvdW5kIHRoZSB3aG9sZSB0aGluZylcbiAgY2VsbFdpZHRoOiBudW1iZXI7IC8vIHNpbmNlIHRoZSBncmlkIGlzIHNxdWFyZSwgdGhpcyBwcm9iYWJseSBzaG91bGQgYmUganVzdCBvbmUgcHJvcGVydHlcbiAgY2VsbEhlaWdodDogbnVtYmVyO1xuICB3OiBudW1iZXI7IC8vIHdpZHRoXG4gIGg6IG51bWJlcjsgLy8gaGVpZ2h0XG4gIGxpbmVTcHJpdGVzOiBQSVhJLkdyYXBoaWNzW107IC8vIHNvIHdlIGNhbiByZW1vdmUgdGhlbSBsYXRlclxuICBjZWxsU3ByaXRlczogUElYSS5HcmFwaGljc1tdOyAvLyBhcnJheSBieSBzcXVhcmUgaW5kZXg7IHRoaW5ncyBpbiBpdCBhcmUgbnVsbCB1bnRpbCBwb3B1bGF0ZWRcbiAgYXJyb3dTcHJpdGVzOiBQSVhJLkdyYXBoaWNzW107IC8vIGFsc28gYnkgc3F1YXJlIGluZGV4O1xuXG4gIGNvbnN0cnVjdG9yKHNpemU6IG51bWJlciwgc3RhZ2U6IFBJWEkuQ29udGFpbmVyKSB7XG4gICAgdGhpcy5zaXplID0gc2l6ZTtcbiAgICB0aGlzLnN0YWdlID0gc3RhZ2U7XG4gICAgdGhpcy5hcnJvd3MgPSBbXTtcbiAgICB0aGlzLmV4aXRTcXVhcmVzID0gW107XG4gICAgdGhpcy5ldmVudHMgPSBbXTtcbiAgICB0aGlzLmN1cnJlbnRFdmVudCA9IFtdO1xuICAgIHRoaXMucHJlc29sdmVkID0gZmFsc2U7XG4gICAgdGhpcy5mcmFtZXNCZXR3ZWVuRXZlbnRzID0gNztcbiAgICBpZiAodGhpcy5zaXplID4gMjApIHtcbiAgICAgIHRoaXMuZnJhbWVzQmV0d2VlbkV2ZW50cyA9IDI7IC8vIHNwZWVkIGl0IHdheSB1cCBmb3IgYmlnIGJvYXJkc1xuICAgIH1cbiAgICB0aGlzLmN1cnJlbnRSZXN0RnJhbWUgPSAwO1xuICAgIHRoaXMuZHJhd2luZ0xvbmdlc3RQYXRoID0gMDtcbiAgICB0aGlzLlRMID0ge3g6IDUwLCB5OiAxMDB9O1xuICAgIHRoaXMudyA9IDYwMDtcbiAgICB0aGlzLmggPSA2MDA7XG4gICAgdGhpcy5jZWxsV2lkdGggPSB0aGlzLncvKHNpemUgKyAyKTtcbiAgICB0aGlzLmNlbGxIZWlnaHQgPSB0aGlzLmgvKHNpemUgKyAyKTtcbiAgICB0aGlzLmRyYXdpbmdFeGl0U3F1YXJlcyA9IFtdO1xuICAgIHRoaXMuZHJhd2luZ0JhY2t0cmFjZVNxdWFyZXMgPSBbXTtcbiAgICB0aGlzLmxpbmVTcHJpdGVzID0gW107XG4gICAgdGhpcy5jZWxsU3ByaXRlcyA9IFtdO1xuICAgIHRoaXMuYXJyb3dTcHJpdGVzID0gW107XG4gICAgdGhpcy5sb25nZXN0UGF0aFRleHQgPSBudWxsO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2l6ZSAqIHNpemU7IGkrKykge1xuICAgICAgdGhpcy5hcnJvd3NbaV0gPSBkaXJlY3Rpb25zW01hdGguZmxvb3IoTWF0aC5yYW5kb20oKSo0KV07IC8vIGdlbmVyYXRlIGJvYXJkXG4gICAgICB0aGlzLmV4aXRTcXVhcmVzW2ldID0gZmFsc2U7IC8vIGluaXRpYWxpemUgZXhpdFNxdWFyZXNcbiAgICAgIHRoaXMuZHJhd2luZ0V4aXRTcXVhcmVzW2ldID0gZmFsc2U7XG4gICAgICB0aGlzLmRyYXdpbmdCYWNrdHJhY2VTcXVhcmVzW2ldID0gZmFsc2U7XG4gICAgICB0aGlzLmNlbGxTcHJpdGVzW2ldID0gbnVsbDtcbiAgICAgIHRoaXMuYXJyb3dTcHJpdGVzW2ldID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICByb3coc3F1YXJlOiBudW1iZXIpIHsgLy8gYmFzaWMgb3BlcmF0aW9uIHRvIGdldCByb3cgZnJvbSBzcXVhcmUgbnVtYmVyXG4gICAgcmV0dXJuIE1hdGguZmxvb3Ioc3F1YXJlL3RoaXMuc2l6ZSk7XG4gIH1cblxuICBjb2woc3F1YXJlOiBudW1iZXIpIHsgLy8gZ2V0IGNvbHVtblxuICAgIHJldHVybiBzcXVhcmUgJSB0aGlzLnNpemU7XG4gIH1cblxuICBzcXVhcmUocm93OiBudW1iZXIsIGNvbDogbnVtYmVyKSB7IC8vIGdldCBzcXVhcmUgZnJvbSByb3cgYW5kIGNvbHVtblxuICAgIHJldHVybiB0aGlzLnNpemUqcm93ICsgY29sO1xuICB9XG5cbiAgdXAoc3F1YXJlOiBudW1iZXIpIHsgLy8gZ28gdXAgYSBzcXVhcmUgKDAgaXMgdXBwZXIgbGVmdCwgZ29pbmcgYWNyb3NzIHRoZW4gZG93bilcbiAgICBpZiAodGhpcy5yb3coc3F1YXJlKSA9PT0gMCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBzcXVhcmUgLSB0aGlzLnNpemU7XG4gICAgfVxuICB9XG5cbiAgZG93bihzcXVhcmU6IG51bWJlcikgeyAvLyBkb3duIGEgc3F1YXJlXG4gICAgaWYgKHRoaXMucm93KHNxdWFyZSkgPT09IHRoaXMuc2l6ZSAtIDEpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gc3F1YXJlICsgdGhpcy5zaXplO1xuICAgIH1cbiAgfVxuXG4gIGxlZnQoc3F1YXJlOiBudW1iZXIpIHsgLy8gbGVmdCBhIHNxdWFyZVxuICAgIGlmICh0aGlzLmNvbChzcXVhcmUpID09PSAwKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHNxdWFyZSAtIDE7XG4gICAgfVxuICB9XG5cbiAgcmlnaHQoc3F1YXJlOiBudW1iZXIpIHsgLy8gcmlnaHQgYSBzcXVhcmVcbiAgICBpZiAodGhpcy5jb2woc3F1YXJlKSA9PT0gdGhpcy5zaXplIC0gMSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBzcXVhcmUgKyAxO1xuICAgIH1cbiAgfVxuXG4gIG5leHQoc3F1YXJlOiBudW1iZXIpIHsgLy8gZm9sbG93IHRoZSBhcnJvd1xuICAgIHN3aXRjaCAodGhpcy5hcnJvd3Nbc3F1YXJlXSkge1xuICAgICAgY2FzZSBEaXJlY3Rpb24uVXA6XG4gICAgICAgIHJldHVybiB0aGlzLnVwKHNxdWFyZSk7XG4gICAgICBjYXNlIERpcmVjdGlvbi5Eb3duOlxuICAgICAgICByZXR1cm4gdGhpcy5kb3duKHNxdWFyZSk7XG4gICAgICBjYXNlIERpcmVjdGlvbi5MZWZ0OlxuICAgICAgICByZXR1cm4gdGhpcy5sZWZ0KHNxdWFyZSk7XG4gICAgICBjYXNlIERpcmVjdGlvbi5SaWdodDpcbiAgICAgICAgcmV0dXJuIHRoaXMucmlnaHQoc3F1YXJlKTtcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiBudWxsOyAvLyBzaG91bGQgbmV2ZXIgaGFwcGVuXG4gICAgfVxuICB9XG5cbiAgbmV4dENoZWNrZXJTcXVhcmVSQyhzcXVhcmVSQzoge3JvdzogbnVtYmVyLCBjb2w6IG51bWJlcn0pIHtcbiAgICBpZiAoc3F1YXJlUkMucm93IDwgMCB8fCBzcXVhcmVSQy5yb3cgPj0gdGhpcy5zaXplXG4gICAgICAgIHx8IHNxdWFyZVJDLmNvbCA8IDAgfHwgc3F1YXJlUkMuY29sID49IHRoaXMuc2l6ZSkge1xuICAgICAgcmV0dXJuIG51bGw7IC8vIHRoZXJlIGFyZSBubyBhcnJvd3Mgb2ZmLWJvYXJkXG4gICAgfVxuICAgIGxldCBzcXVhcmUgPSB0aGlzLnNxdWFyZShzcXVhcmVSQy5yb3csIHNxdWFyZVJDLmNvbCk7XG4gICAgLy8gd2UgY2FuJ3QganVzdCB1c2UgdGhlIFwibmV4dFwiIG1ldGhvZCBiZWNhdXNlIHdlIG1heSBuZWVkXG4gICAgLy8gdG8gbW92ZSB0aGUgY2hlY2tlciBvZmYgdGhlIGJvYXJkXG4gICAgc3dpdGNoICh0aGlzLmFycm93c1tzcXVhcmVdKSB7XG4gICAgICBjYXNlIERpcmVjdGlvbi5VcDpcbiAgICAgICAgcmV0dXJuIHtyb3c6IHNxdWFyZVJDLnJvdyAtIDEsIGNvbDogc3F1YXJlUkMuY29sfTtcbiAgICAgIGNhc2UgRGlyZWN0aW9uLkRvd246XG4gICAgICAgIHJldHVybiB7cm93OiBzcXVhcmVSQy5yb3cgKyAxLCBjb2w6IHNxdWFyZVJDLmNvbH07XG4gICAgICBjYXNlIERpcmVjdGlvbi5MZWZ0OlxuICAgICAgICByZXR1cm4ge3Jvdzogc3F1YXJlUkMucm93LCBjb2w6IHNxdWFyZVJDLmNvbCAtIDF9O1xuICAgICAgY2FzZSBEaXJlY3Rpb24uUmlnaHQ6XG4gICAgICAgIHJldHVybiB7cm93OiBzcXVhcmVSQy5yb3csIGNvbDogc3F1YXJlUkMuY29sICsgMX07XG4gICAgICBkZWZhdWx0OlxuICAgICAgICByZXR1cm4gbnVsbDsgLy8gc2hvdWxkIG5ldmVyIGhhcHBlblxuICAgIH1cbiAgfVxuXG4gIHJlY29yZChldmVudDogT2JqZWN0KSB7IC8vIHJlY29yZCBhbiBldmVudCBpbiB0aGlzIHJlbmRlciBzdGVwXG4gICAgdGhpcy5jdXJyZW50RXZlbnQucHVzaChldmVudCk7XG4gIH1cblxuICBuZXh0RXZlbnQoKSB7IC8vIG1ha2UgdGhlIG5leHQgcmVuZGVyIHN0ZXBcbiAgICB0aGlzLmV2ZW50cy5wdXNoKHRoaXMuY3VycmVudEV2ZW50KTtcbiAgICB0aGlzLmN1cnJlbnRFdmVudCA9IFtdO1xuICB9XG5cbiAgLy8gSW4gYSB0aW1lLWVmZmljaWVudCBhbGdvcml0aG0sIHRoZSBwcmVzb2x2aW5nIHN0ZXAgbWFya3MgdGhlIHNxdWFyZXMgdGhhdFxuICAvLyBsZWFkIHRvIGFuIGV4aXQuICBIb3dldmVyLCB3ZSdyZSBnb2luZyBmb3IgYSBzcGFjZS1lZmZpY2llbnQgYWxnb3JpdGhcbiAgLy8gaW5zdGVhZC4gIFNvLCB3aGlsZSB3ZSAqYXJlKiBtYXJraW5nIHRoZSBzcXVhcmVzIHRoYXQgbGVhZCB0byBhbiBleGl0XG4gIC8vIChPKG5eMikgc3BhY2UpLCB3ZSdyZSBvbmx5IHVzaW5nIHRoYXQgaW5mb3JtYXRpb24gZm9yIHRoZSBwdXJwb3NlcyBvZiB0aGVcbiAgLy8gdmlzdWFsaXphdGlvbi4gIFdoYXQgcHJlc29sdmluZyBkb2VzIGluc3RlYWQgaXMgYXMgZm9sbG93czpcbiAgLy9cbiAgLy8gSXQgc3RhcnRzIGFyb3VuZCB0aGUgYm9hcmQsIGxvb2tpbmcgZm9yIHNxdWFyZXMgd2l0aCBhcnJvd3MgcG9pbnRpbmcgb3V0LlxuICAvLyBXaGVuIGl0IGZpbmRzIHRoZW0sIGl0IGNoZWNrcyB0aGVpciBpbW1lZGlhdGUgbmVpZ2hib3JzIGZvciBzcXVhcmVzIHRoYXRcbiAgLy8gbGVhZCB0byB0aGF0IHNxdWFyZSBpbiBvcmRlciB0byBiYWNrdHJhY2UgdGhlIHBhdGgsIGFuZCBpdCBiYWNrdHJhY2VzIHRoZVxuICAvLyBwYXRoIHJlY3Vyc2l2ZWx5IHRvIGZpbmQgYWxsIHNxdWFyZXMgbGVhZGluZyB0byB0aGUgZXhpdC4gIE1lYW53aGlsZSwgaXRcbiAgLy8gY291bnRzIHRoZXNlIGV4aXQtbGVhZGluZyBzcXVhcmVzIGFuZCBrZWVwcyB0cmFjayBvZiBwYXRoIGxlbmd0aCwgZm9yIGFcbiAgLy8gdG90YWwgc3RvcmFnZSB0aGF0IGdyb3dzIGFzIE8oMSkuXG4gIC8vXG4gIC8vIFdoZW4gdGhlIGNoZWNrZXIgaXMgZXZlbnR1YWxseSBwbGFjZWQgb24gdGhlIGJvYXJkLCB3ZSBrbm93IHRoYXQgaWYgaXQgaGFzXG4gIC8vIG5vdCBleGl0ZWQgYnkgdGhlIHRpbWUgaXQgaGFzIHRha2VuIGFzIG1hbnkgc3RlcHMgYXMgdGhlIGxvbmdlc3QgbGVhZGluZ1xuICAvLyBwYXRoLCBvciBpZiBpdCBoYXMgdGFrZW4gbW9yZSBwYXRocyB0aGFuIHRoZXJlIGFyZSBub24tZXhpdC1sZWFkaW5nXG4gIC8vIHNxdWFyZXMgb24gdGhlIGJvYXJkLCBpdCB3aWxsIG5ldmVyIHJlYWNoIGFuIGV4aXQuXG4gIC8vXG4gIC8vIEluc3RlYWQgb2Ygd2FpdGluZyBmb3IgYW5pbWF0aW9uIGZyYW1lcywgdGhlIHByZXNvbHZpbmcgYWxnb3JpdGhtIHJlY29yZHNcbiAgLy8gYW5pbWF0YWJsZSBhY3Rpb25zLCB3aGljaCBhcmUgcGxheWVkIGJhY2sgbGF0ZXIgYnkgdGhlIHJlbmRlcmVyIGF0IGh1bWFuXG4gIC8vIHNwZWVkcy4gIERvaW5nIHRoaXMgZGlyZWN0bHkgd291bGQgYmUgYSBuaWdodG1hcmUsIGVzcGVjaWFsbHkgZm9yIHRoZVxuICAvLyByZWN1cnNpdmUgYml0LlxuICBwcmVzb2x2ZSgpIHtcbiAgICBsZXQgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHRoaXMucHJlc29sdmVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGxldCBsb25nZXN0UGF0aCA9IDA7XG4gICAgbGV0IGV4aXRzID0gMDsgLy8gY291bnQgb2YgZXhpdCBzcXVhcmVzXG4gICAgLy8gd2UgY2FuJ3QganVzdCBjb3VudCB0aGUgdHJ1ZSB2YWx1ZXMgaW4gZXhpdFNxdWFyZXMgYmVjYXVzZSB0aGF0IHdvdWxkXG4gICAgLy8gdmlvbGF0ZSBvdXIgTygxKSBzdG9yYWdlIHJlcXVpcmVtZW50XG5cbiAgICAvLyByZXR1cm5zIHBhdGggbGVuZ3RoXG4gICAgZnVuY3Rpb24gYmFja3RyYWNlUGF0aChzcXVhcmU6IG51bWJlcikge1xuICAgICAgbGV0IHBhdGhMZW5ndGhzID0gWzAsIDAsIDAsIDBdXG4gICAgICBsZXQgbmVpZ2hib3JzID0gW3NlbGYudXAoc3F1YXJlKSwgc2VsZi5kb3duKHNxdWFyZSksIHNlbGYubGVmdChzcXVhcmUpLCBzZWxmLnJpZ2h0KHNxdWFyZSldO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBuZWlnaGJvcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKG5laWdoYm9yc1tpXSAhPT0gbnVsbCAmJiBzZWxmLm5leHQobmVpZ2hib3JzW2ldKSA9PT0gc3F1YXJlKSB7XG4gICAgICAgICAgZXhpdHMrKztcbiAgICAgICAgICBzZWxmLmV4aXRTcXVhcmVzW25laWdoYm9yc1tpXV0gPSB0cnVlO1xuICAgICAgICAgIHNlbGYucmVjb3JkKHtcbiAgICAgICAgICAgIGV2ZW50OiBcImFkZEV4aXRTcXVhcmVcIixcbiAgICAgICAgICAgIHNxdWFyZTogbmVpZ2hib3JzW2ldXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgc2VsZi5yZWNvcmQoe1xuICAgICAgICAgICAgZXZlbnQ6IFwiYWRkQmFja3RyYWNlU3F1YXJlXCIsXG4gICAgICAgICAgICBzcXVhcmU6IHNxdWFyZVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIHNlbGYubmV4dEV2ZW50KCk7XG4gICAgICAgICAgcGF0aExlbmd0aHNbaV0gPSBiYWNrdHJhY2VQYXRoKG5laWdoYm9yc1tpXSk7XG4gICAgICAgICAgc2VsZi5yZWNvcmQoe1xuICAgICAgICAgICAgZXZlbnQ6IFwicmVtb3ZlQmFja3RyYWNlU3F1YXJlXCIsXG4gICAgICAgICAgICBzcXVhcmU6IHNxdWFyZVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIHNlbGYubmV4dEV2ZW50KCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiAxICsgTWF0aC5tYXgoLi4ucGF0aExlbmd0aHMpO1xuICAgIH1cblxuICAgIC8vIFdlJ3JlIGdvaW5nIHRvIGRvIGFsbCBmb3VyIHNpZGVzIGF0IG9uY2UuXG4gICAgLy8gVGhpcyB3aWxsIHRha2UgTyhuKSBjaGVja3MgaW5zdGVhZCBvZiBPKG5eMiksIHNvIGV2ZW4gdGhvdWdoIGl0J3NcbiAgICAvLyBhIGJpdCBtZXNzaWVyIHRvIGNvZGUsIGl0J3MgYSBwb3RlbnRpYWxseSB2ZXJ5IGxhcmdlIGltcHJvdmVtZW50XG4gICAgLy8gaW4gY2FzZXMgd2UnbGwgbGlrZWx5IG5ldmVyIGFjdHVhbGx5IGhpdC4gIEJ1dCBpdCdzIHRoZSBwcmluY2lwbGVcbiAgICAvLyBvZiB0aGUgdGhpbmcuICBJZiB3ZSB3YW50ZWQgdG8ganVzdCBjaGVjayB0aGUgZW50aXJlIGdyaWQgZm9yIGV4aXRcbiAgICAvLyBwb2ludHMsIHdlJ2QganVzdCBjaGVjayBpZiB0aGlzLm5leHQgaXMgbnVsbCBmb3IgZWFjaCBzcXVhcmUuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnNpemUgLSAxOyBpKyspIHtcbiAgICAgIGxldCB0YXJnZXRTcXVhcmVzID0gW1xuICAgICAgICB0aGlzLnNxdWFyZSgwLCBpKSwgLy8gYWxvbmcgdG9wXG4gICAgICAgIHRoaXMuc3F1YXJlKGksIHRoaXMuc2l6ZSAtIDEpLCAvLyBhbG9uZyByaWdodFxuICAgICAgICB0aGlzLnNxdWFyZSh0aGlzLnNpemUgLSAxLCB0aGlzLnNpemUgLSAxIC0gaSksIC8vIGFsb25nIGJvdHRvbVxuICAgICAgICB0aGlzLnNxdWFyZSh0aGlzLnNpemUgLSAxIC0gaSwgMCkgLy8gYWxvbmcgbGVmdFxuICAgICAgXTtcbiAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgNDsgaisrKSB7XG4gICAgICAgIGlmICh0aGlzLm5leHQodGFyZ2V0U3F1YXJlc1tqXSkgPT09IG51bGwpIHtcbiAgICAgICAgICBleGl0cysrO1xuICAgICAgICAgIHRoaXMuZXhpdFNxdWFyZXNbdGFyZ2V0U3F1YXJlc1tqXV0gPSB0cnVlO1xuICAgICAgICAgIHRoaXMucmVjb3JkKHtcbiAgICAgICAgICAgIGV2ZW50OiBcImFkZEV4aXRTcXVhcmVcIixcbiAgICAgICAgICAgIHNxdWFyZTogdGFyZ2V0U3F1YXJlc1tqXVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIHRoaXMucmVjb3JkKHtcbiAgICAgICAgICAgIGV2ZW50OiBcImFkZEJhY2t0cmFjZVNxdWFyZVwiLFxuICAgICAgICAgICAgc3F1YXJlOiB0YXJnZXRTcXVhcmVzW2pdXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgdGhpcy5uZXh0RXZlbnQoKTtcbiAgICAgICAgICBsZXQgcGF0aExlbmd0aCA9IGJhY2t0cmFjZVBhdGgodGFyZ2V0U3F1YXJlc1tqXSk7XG4gICAgICAgICAgdGhpcy5yZWNvcmQoe1xuICAgICAgICAgICAgZXZlbnQ6IFwicmVtb3ZlQmFja3RyYWNlU3F1YXJlXCIsXG4gICAgICAgICAgICBzcXVhcmU6IHRhcmdldFNxdWFyZXNbal1cbiAgICAgICAgICB9KTtcbiAgICAgICAgICBpZiAocGF0aExlbmd0aCA+IGxvbmdlc3RQYXRoKSB7XG4gICAgICAgICAgICBsb25nZXN0UGF0aCA9IHBhdGhMZW5ndGg7XG4gICAgICAgICAgICB0aGlzLnJlY29yZCh7XG4gICAgICAgICAgICAgIGV2ZW50OiBcInVwZGF0ZUxvbmdlc3RQYXRoXCIsXG4gICAgICAgICAgICAgIHZhbHVlOiBsb25nZXN0UGF0aFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMubmV4dEV2ZW50KCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLmxvbmdlc3RFeGl0UGF0aExlbmd0aCA9IGxvbmdlc3RQYXRoO1xuICAgIHRoaXMucHJlc29sdmVkID0gdHJ1ZTtcbiAgfVxuXG4gIHByb2Nlc3NSZW5kZXJFdmVudChldmVudDogYW55KSB7XG4gICAgc3dpdGNoIChldmVudC5ldmVudCkge1xuICAgICAgY2FzZSBcInVwZGF0ZUxvbmdlc3RQYXRoXCI6XG4gICAgICAgIHRoaXMuZHJhd2luZ0xvbmdlc3RQYXRoID0gZXZlbnQudmFsdWU7XG4gICAgICAgIHRoaXMuY3JlYXRlU3RhdHNUZXh0KCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBcImFkZEV4aXRTcXVhcmVcIjpcbiAgICAgICAgdGhpcy5kcmF3aW5nRXhpdFNxdWFyZXNbZXZlbnQuc3F1YXJlXSA9IHRydWU7XG4gICAgICAgIHRoaXMuY3JlYXRlQ2VsbFNwcml0ZShldmVudC5zcXVhcmUpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgXCJhZGRCYWNrdHJhY2VTcXVhcmVcIjpcbiAgICAgICAgdGhpcy5kcmF3aW5nQmFja3RyYWNlU3F1YXJlc1tldmVudC5zcXVhcmVdID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5jcmVhdGVDZWxsU3ByaXRlKGV2ZW50LnNxdWFyZSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBcInJlbW92ZUJhY2t0cmFjZVNxdWFyZVwiOlxuICAgICAgICB0aGlzLmRyYXdpbmdCYWNrdHJhY2VTcXVhcmVzW2V2ZW50LnNxdWFyZV0gPSBmYWxzZTtcbiAgICAgICAgdGhpcy5jcmVhdGVDZWxsU3ByaXRlKGV2ZW50LnNxdWFyZSk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIHN0ZXBQcmVzb2x1dGlvbkFuaW1hdGlvbigpIHtcbiAgICBpZiAodGhpcy5ldmVudHMubGVuZ3RoID4gMCAmJiB0aGlzLmN1cnJlbnRSZXN0RnJhbWUgPD0gMCkge1xuICAgICAgbGV0IHJlbmRlckV2ZW50cyA9IHRoaXMuZXZlbnRzLnNoaWZ0KCk7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHJlbmRlckV2ZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICB0aGlzLnByb2Nlc3NSZW5kZXJFdmVudChyZW5kZXJFdmVudHNbaV0pO1xuICAgICAgfVxuICAgICAgdGhpcy5jdXJyZW50UmVzdEZyYW1lICs9IHRoaXMuZnJhbWVzQmV0d2VlbkV2ZW50cztcbiAgICB9IGVsc2UgaWYgKHRoaXMuY3VycmVudFJlc3RGcmFtZSA+IDApIHtcbiAgICAgIHRoaXMuY3VycmVudFJlc3RGcmFtZS0tO1xuICAgIH1cbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5jbGVhckJvYXJkU3ByaXRlcygpO1xuICAgIHRoaXMuY2xlYXJTdGF0c1RleHQoKTtcbiAgfVxuXG4gIGluaXRCb2FyZFJlbmRlcigpIHtcbiAgICB0aGlzLmNsZWFyQm9hcmRTcHJpdGVzKCk7XG4gICAgdGhpcy5jcmVhdGVCb2FyZFNwcml0ZXMoKTtcbiAgICB0aGlzLmNyZWF0ZVN0YXRzVGV4dCgpO1xuICB9XG5cbiAgY2xlYXJTdGF0c1RleHQoKSB7XG4gICAgdGhpcy5jbGVhckxvbmdlc3RQYXRoVGV4dCgpO1xuICB9XG5cbiAgY2xlYXJMb25nZXN0UGF0aFRleHQoKSB7XG4gICAgaWYgKHRoaXMubG9uZ2VzdFBhdGhUZXh0ICE9PSBudWxsKSB7XG4gICAgICB0aGlzLnN0YWdlLnJlbW92ZUNoaWxkKHRoaXMubG9uZ2VzdFBhdGhUZXh0KTtcbiAgICAgIHRoaXMubG9uZ2VzdFBhdGhUZXh0ID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICBjcmVhdGVTdGF0c1RleHQoKSB7XG4gICAgdGhpcy5jbGVhclN0YXRzVGV4dCgpO1xuICAgIGxldCBzdHlsZSA9IG5ldyBQSVhJLlRleHRTdHlsZSh7XG4gICAgICBmb250U2l6ZTogMzAsXG4gICAgICBmaWxsOiAweEQwRDBEMFxuICAgIH0pO1xuXG4gICAgdGhpcy5sb25nZXN0UGF0aFRleHQgPSBuZXcgUElYSS5UZXh0KCdMb25nZXN0IFBhdGggTGVuZ3RoOiAnICsgdGhpcy5kcmF3aW5nTG9uZ2VzdFBhdGgsIHN0eWxlKTtcbiAgICB0aGlzLmxvbmdlc3RQYXRoVGV4dC54ID0gNTA7XG4gICAgdGhpcy5sb25nZXN0UGF0aFRleHQueSA9IDQ1O1xuICAgIHRoaXMuc3RhZ2UuYWRkQ2hpbGQodGhpcy5sb25nZXN0UGF0aFRleHQpO1xuICB9XG5cbiAgY2xlYXJCb2FyZFNwcml0ZXMoKSB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmxpbmVTcHJpdGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB0aGlzLnN0YWdlLnJlbW92ZUNoaWxkKHRoaXMubGluZVNwcml0ZXNbaV0pO1xuICAgIH1cbiAgICB0aGlzLmxpbmVTcHJpdGVzID0gW107XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnNpemUqdGhpcy5zaXplOyBpKyspIHtcbiAgICAgIHRoaXMucmVtb3ZlQ2VsbFNwcml0ZShpKTsgLy8gYWxzbyBjbGVhcnMgYXJyb3cgc3ByaXRlXG4gICAgfVxuICB9XG5cbiAgcmVtb3ZlQ2VsbFNwcml0ZShzcXVhcmU6IG51bWJlcikge1xuICAgIGlmICh0aGlzLmNlbGxTcHJpdGVzW3NxdWFyZV0gIT09IG51bGwpIHtcbiAgICAgIHRoaXMuc3RhZ2UucmVtb3ZlQ2hpbGQodGhpcy5jZWxsU3ByaXRlc1tzcXVhcmVdKTtcbiAgICB9XG4gICAgdGhpcy5jZWxsU3ByaXRlc1tzcXVhcmVdID0gbnVsbDtcbiAgICB0aGlzLnJlbW92ZUFycm93U3ByaXRlKHNxdWFyZSk7XG4gIH1cblxuICByZW1vdmVBcnJvd1Nwcml0ZShzcXVhcmU6IG51bWJlcikge1xuICAgIGlmICh0aGlzLmFycm93U3ByaXRlc1tzcXVhcmVdICE9PSBudWxsKSB7XG4gICAgICB0aGlzLnN0YWdlLnJlbW92ZUNoaWxkKHRoaXMuYXJyb3dTcHJpdGVzW3NxdWFyZV0pO1xuICAgIH1cbiAgICB0aGlzLmFycm93U3ByaXRlc1tzcXVhcmVdID0gbnVsbDtcbiAgfVxuXG4gIGNyZWF0ZUJvYXJkU3ByaXRlcygpIHtcbiAgICB0aGlzLmNsZWFyQm9hcmRTcHJpdGVzKCk7XG4gICAgdGhpcy5jcmVhdGVMaW5lU3ByaXRlcygpO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5zaXplKnRoaXMuc2l6ZTsgaSsrKSB7XG4gICAgICB0aGlzLmNyZWF0ZUNlbGxTcHJpdGUoaSk7XG4gICAgfVxuICB9XG5cbiAgY3JlYXRlTGluZVNwcml0ZXMoKSB7XG4gICAgZm9yIChsZXQgaSA9IDE7IGkgPD0gdGhpcy5zaXplICsgMTsgaSsrKSB7XG4gICAgICBsZXQgaExpbmUgPSBuZXcgUElYSS5HcmFwaGljcygpO1xuICAgICAgaExpbmUubGluZVN0eWxlKDMsIDB4ODA4MEZGLCAxKTtcbiAgICAgIGhMaW5lLm1vdmVUbyh0aGlzLlRMLnggKyB0aGlzLmNlbGxXaWR0aCAtIDEuNSwgdGhpcy5UTC55ICsgaSp0aGlzLmNlbGxIZWlnaHQpO1xuICAgICAgaExpbmUubGluZVRvKHRoaXMuVEwueCArICh0aGlzLnNpemUgKyAxKSp0aGlzLmNlbGxXaWR0aCArIDEuNSwgdGhpcy5UTC55ICsgaSp0aGlzLmNlbGxIZWlnaHQpO1xuICAgICAgdGhpcy5zdGFnZS5hZGRDaGlsZChoTGluZSk7XG4gICAgICB0aGlzLmxpbmVTcHJpdGVzLnB1c2goaExpbmUpO1xuXG4gICAgICBsZXQgdkxpbmUgPSBuZXcgUElYSS5HcmFwaGljcygpO1xuICAgICAgdkxpbmUubGluZVN0eWxlKDMsIDB4ODA4MEZGLCAxKTtcbiAgICAgIHZMaW5lLm1vdmVUbyh0aGlzLlRMLnggKyB0aGlzLmNlbGxXaWR0aCppLCB0aGlzLlRMLnkgKyB0aGlzLmNlbGxIZWlnaHQgLSAxLjUpO1xuICAgICAgdkxpbmUubGluZVRvKHRoaXMuVEwueCArIHRoaXMuY2VsbFdpZHRoKmksIHRoaXMuVEwueSArICh0aGlzLnNpemUgKyAxKSp0aGlzLmNlbGxIZWlnaHQgKyAxLjUpO1xuICAgICAgdGhpcy5zdGFnZS5hZGRDaGlsZCh2TGluZSk7XG4gICAgICB0aGlzLmxpbmVTcHJpdGVzLnB1c2godkxpbmUpO1xuICAgIH1cbiAgfVxuXG4gIGNyZWF0ZUNlbGxTcHJpdGUoc3F1YXJlOiBudW1iZXIpIHtcbiAgICB0aGlzLnJlbW92ZUNlbGxTcHJpdGUoc3F1YXJlKTsgLy8gYWxzbyByZW1vdmVzIGFycm93IHNwcml0ZVxuICAgIGxldCBjZWxsID0gbmV3IFBJWEkuR3JhcGhpY3MoKTtcbiAgICBpZiAodGhpcy5kcmF3aW5nQmFja3RyYWNlU3F1YXJlc1tzcXVhcmVdKSB7XG4gICAgICBjZWxsLmxpbmVTdHlsZSgxLCAweEZGNDA0MCwgMSk7IC8vIGJvcmRlciBhcm91bmQgYmFja3RyYWNlIHNxdWFyZXNcbiAgICB9IGVsc2Uge1xuICAgICAgY2VsbC5saW5lU3R5bGUoMCwgMHgwMDAwMDAsIDApO1xuICAgIH1cbiAgICBpZiAodGhpcy5kcmF3aW5nRXhpdFNxdWFyZXNbc3F1YXJlXSkge1xuICAgICAgY2VsbC5iZWdpbkZpbGwoMHgyMDIwMjApO1xuICAgIH0gZWxzZSB7XG4gICAgICBjZWxsLmJlZ2luRmlsbCgweEUwRTBFMCk7XG4gICAgfVxuICAgIGxldCByID0gdGhpcy5yb3coc3F1YXJlKTtcbiAgICBsZXQgYyA9IHRoaXMuY29sKHNxdWFyZSk7XG4gICAgY2VsbC5kcmF3UmVjdCh0aGlzLlRMLnggKyB0aGlzLmNlbGxXaWR0aCooYyArIDEpICsgMSxcbiAgICAgICAgICAgICAgICAgIHRoaXMuVEwueSArIHRoaXMuY2VsbEhlaWdodCoociArIDEpICsgMSxcbiAgICAgICAgICAgICAgICAgIHRoaXMuY2VsbFdpZHRoIC0gMixcbiAgICAgICAgICAgICAgICAgIHRoaXMuY2VsbEhlaWdodCAtIDIpO1xuICAgIGNlbGwuZW5kRmlsbCgpO1xuICAgIHRoaXMuc3RhZ2UuYWRkQ2hpbGQoY2VsbCk7XG4gICAgdGhpcy5jZWxsU3ByaXRlc1tzcXVhcmVdID0gY2VsbDtcbiAgICB0aGlzLmNyZWF0ZUFycm93U3ByaXRlKHNxdWFyZSk7XG4gIH1cblxuICBjcmVhdGVBcnJvd1Nwcml0ZShzcXVhcmU6IG51bWJlcikge1xuICAgIGxldCBjZW50ZXIgPSB0aGlzLmNlbnRlck9mU3F1YXJlKHtcbiAgICAgIHJvdzogdGhpcy5yb3coc3F1YXJlKSxcbiAgICAgIGNvbDogdGhpcy5jb2woc3F1YXJlKVxuICAgIH0pO1xuICAgIGNvbnN0IGsgPSBNYXRoLnNxcnQoMykvODsgLy8gdXNlZnVsIGdlb21ldHJpYyBjb25zdGFudFxuICAgIGxldCBhcnJvdyA9IG5ldyBQSVhJLkdyYXBoaWNzKCk7XG4gICAgYXJyb3cuYmVnaW5GaWxsKDB4ODA4MDgwKTtcbiAgICBzd2l0Y2ggKHRoaXMuYXJyb3dzW3NxdWFyZV0pIHtcbiAgICAgICAgY2FzZSBEaXJlY3Rpb24uVXA6XG4gICAgICAgICAgYXJyb3cuZHJhd1BvbHlnb24oW1xuICAgICAgICAgICAgY2VudGVyLngsIGNlbnRlci55IC0gdGhpcy5jZWxsSGVpZ2h0KjAuMzc1LFxuICAgICAgICAgICAgY2VudGVyLnggKyBrKnRoaXMuY2VsbFdpZHRoLCBjZW50ZXIueSxcbiAgICAgICAgICAgIGNlbnRlci54IC0gayp0aGlzLmNlbGxXaWR0aCwgY2VudGVyLnlcbiAgICAgICAgICBdKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBEaXJlY3Rpb24uRG93bjpcbiAgICAgICAgICBhcnJvdy5kcmF3UG9seWdvbihbXG4gICAgICAgICAgICBjZW50ZXIueCwgY2VudGVyLnkgKyB0aGlzLmNlbGxIZWlnaHQqMC4zNzUsXG4gICAgICAgICAgICBjZW50ZXIueCAtIGsqdGhpcy5jZWxsV2lkdGgsIGNlbnRlci55LFxuICAgICAgICAgICAgY2VudGVyLnggKyBrKnRoaXMuY2VsbFdpZHRoLCBjZW50ZXIueVxuICAgICAgICAgIF0pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIERpcmVjdGlvbi5MZWZ0OlxuICAgICAgICAgIGFycm93LmRyYXdQb2x5Z29uKFtcbiAgICAgICAgICAgIGNlbnRlci54IC0gdGhpcy5jZWxsSGVpZ2h0KjAuMzc1LCBjZW50ZXIueSxcbiAgICAgICAgICAgIGNlbnRlci54LCBjZW50ZXIueSAtIGsqdGhpcy5jZWxsSGVpZ2h0LFxuICAgICAgICAgICAgY2VudGVyLngsIGNlbnRlci55ICsgayp0aGlzLmNlbGxIZWlnaHRcbiAgICAgICAgICBdKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBEaXJlY3Rpb24uUmlnaHQ6XG4gICAgICAgICAgYXJyb3cuZHJhd1BvbHlnb24oW1xuICAgICAgICAgICAgY2VudGVyLnggKyB0aGlzLmNlbGxIZWlnaHQqMC4zNzUsIGNlbnRlci55LFxuICAgICAgICAgICAgY2VudGVyLngsIGNlbnRlci55ICsgayp0aGlzLmNlbGxIZWlnaHQsXG4gICAgICAgICAgICBjZW50ZXIueCwgY2VudGVyLnkgLSBrKnRoaXMuY2VsbEhlaWdodFxuICAgICAgICAgIF0pO1xuICAgICAgICAgIGJyZWFrO1xuICAgIH1cbiAgICBhcnJvdy5lbmRGaWxsKCk7XG4gICAgdGhpcy5zdGFnZS5hZGRDaGlsZChhcnJvdyk7XG4gICAgdGhpcy5hcnJvd1Nwcml0ZXNbc3F1YXJlXSA9IGFycm93O1xuICB9XG5cbiAgY2VudGVyT2ZTcXVhcmUoc3F1YXJlUkM6IHtyb3c6IG51bWJlciwgY29sOiBudW1iZXJ9KSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHg6IHRoaXMuVEwueCArIHRoaXMuY2VsbFdpZHRoKihzcXVhcmVSQy5jb2wgKyAxLjUpLFxuICAgICAgeTogdGhpcy5UTC55ICsgdGhpcy5jZWxsSGVpZ2h0KihzcXVhcmVSQy5yb3cgKyAxLjUpXG4gICAgfVxuICB9XG59XG4iLCIvLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi4vdHlwaW5ncy9pbmRleC5kLnRzXCIgLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2JvYXJkLnRzXCIgLz5cblxuaW1wb3J0IHtCb2FyZH0gZnJvbSAnLi9ib2FyZCc7XG5cbmV4cG9ydCBjbGFzcyBDaGVja2VyIHtcbiAgYm9hcmQ6IEJvYXJkO1xuICBvbkJvYXJkOiBib29sZWFuO1xuICBzcXVhcmVSQzoge3JvdzogbnVtYmVyLCBjb2w6IG51bWJlcn07IC8vIGNoZWNrZXIgY2FuIGJlIG9mZiBib2FyZCwgc28gLTEg4omkIHJvdywgY29sIOKJpCBzaXplXG4gIG5leHRTcXVhcmVSQzoge3JvdzogbnVtYmVyLCBjb2w6IG51bWJlcn07XG4gIHN0YXJ0ZWQ6IGJvb2xlYW47XG4gIGRvbmU6IGJvb2xlYW47XG4gIC8vIGRyYXdpbmdcbiAgc3RhZ2U6IFBJWEkuQ29udGFpbmVyO1xuICBwb3NpdGlvbjoge3g6IG51bWJlciwgeTogbnVtYmVyfTsgLy8gYWN0dWFsIHBvc2l0aW9uIGZvciByZW5kZXJpbmdcbiAgbmV4dFBvc2l0aW9uOiB7eDogbnVtYmVyLCB5OiBudW1iZXJ9O1xuICBtb3ZlbWVudEZyYW1lczogbnVtYmVyOyAvLyBmcmFtZXMgaXQgdGFrZXMgdG8gbW92ZSBmcm9tIG9uZSBzcXVhcmUgdG8gdGhlIG5leHRcbiAgY3VycmVudEZyYW1lOiBudW1iZXI7XG4gIHN0ZXBzVGFrZW46IG51bWJlcjtcbiAgcmFkaXVzOiBudW1iZXI7XG4gIGNoZWNrZXJTcHJpdGU6IFBJWEkuR3JhcGhpY3M7XG4gIHN0ZXBzVGV4dDogUElYSS5UZXh0O1xuICBkb25lVGV4dDogUElYSS5UZXh0O1xuXG4gIGNvbnN0cnVjdG9yKGJvYXJkOiBCb2FyZCwgcm93OiBudW1iZXIsIGNvbDogbnVtYmVyLCBzdGFnZTogUElYSS5Db250YWluZXIpIHtcbiAgICB0aGlzLmJvYXJkID0gYm9hcmQ7XG4gICAgdGhpcy5zdGFnZSA9IHN0YWdlO1xuICAgIHRoaXMuc3F1YXJlUkMgPSB7cm93OiByb3csIGNvbDogY29sfTtcbiAgICB0aGlzLmNhbGN1bGF0ZU9uQm9hcmQoKTtcbiAgICB0aGlzLnBvc2l0aW9uID0gdGhpcy5ib2FyZC5jZW50ZXJPZlNxdWFyZSh0aGlzLnNxdWFyZVJDKTtcbiAgICB0aGlzLnN0ZXBzVGFrZW4gPSAwO1xuICAgIHRoaXMuc3RhcnRlZCA9IGZhbHNlO1xuICAgIHRoaXMuZG9uZSA9IGZhbHNlO1xuICAgIHRoaXMuY2FsY3VsYXRlUmFkaXVzKCk7XG4gICAgdGhpcy5jaGVja2VyU3ByaXRlID0gbnVsbDtcbiAgICB0aGlzLnN0ZXBzVGV4dCA9IG51bGw7XG4gICAgdGhpcy5kb25lVGV4dCA9IG51bGw7XG4gICAgdGhpcy5tb3ZlbWVudEZyYW1lcyA9IDMwO1xuICAgIGlmICh0aGlzLmJvYXJkLnNpemUgPiAyMCkge1xuICAgICAgdGhpcy5tb3ZlbWVudEZyYW1lcyA9IDEwOyAvLyBzcGVlZCBpdCB3YXkgdXAgZm9yIGJpZyBib2FyZHNcbiAgICB9XG4gIH1cblxuICBpbml0Q2hlY2tlclJlbmRlcigpIHtcbiAgICB0aGlzLmNyZWF0ZVNwcml0ZXMoKTtcbiAgfVxuXG4gIGNhbGN1bGF0ZU9uQm9hcmQoKSB7XG4gICAgaWYgKHRoaXMuc3F1YXJlUkMucm93ID49IDAgJiYgdGhpcy5zcXVhcmVSQy5yb3cgPCB0aGlzLmJvYXJkLnNpemVcbiAgICAgICAgJiYgdGhpcy5zcXVhcmVSQy5jb2wgPj0gMCAmJiB0aGlzLnNxdWFyZVJDLmNvbCA8IHRoaXMuYm9hcmQuc2l6ZSkge1xuICAgICAgdGhpcy5vbkJvYXJkID0gdHJ1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5vbkJvYXJkID0gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgY2FsY3VsYXRlUmFkaXVzKCkge1xuICAgIGxldCBjZWxsU2l6ZSA9IE1hdGgubWluKHRoaXMuYm9hcmQuY2VsbFdpZHRoLCB0aGlzLmJvYXJkLmNlbGxIZWlnaHQpO1xuICAgIHRoaXMucmFkaXVzID0gY2VsbFNpemUvNDtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5jbGVhclNwcml0ZXMoKTtcbiAgfVxuXG4gIGNsZWFyU3ByaXRlcygpIHtcbiAgICB0aGlzLmNsZWFyQ2hlY2tlclNwcml0ZSgpO1xuICAgIHRoaXMuY2xlYXJTdGVwc1RleHQoKTtcbiAgICB0aGlzLmNsZWFyRG9uZVRleHQoKTtcbiAgfVxuXG4gIGNyZWF0ZVNwcml0ZXMoKSB7XG4gICAgdGhpcy5jcmVhdGVDaGVja2VyU3ByaXRlKCk7XG4gICAgdGhpcy5jcmVhdGVTdGVwc1RleHQoKTtcbiAgfVxuXG4gIGNsZWFyQ2hlY2tlclNwcml0ZSgpIHtcbiAgICBpZiAodGhpcy5jaGVja2VyU3ByaXRlICE9PSBudWxsKSB7XG4gICAgICB0aGlzLnN0YWdlLnJlbW92ZUNoaWxkKHRoaXMuY2hlY2tlclNwcml0ZSk7XG4gICAgfVxuICAgIHRoaXMuY2hlY2tlclNwcml0ZSA9IG51bGw7XG4gIH1cblxuICBjbGVhclN0ZXBzVGV4dCgpIHtcbiAgICBpZiAodGhpcy5zdGVwc1RleHQgIT09IG51bGwpIHtcbiAgICAgIHRoaXMuc3RhZ2UucmVtb3ZlQ2hpbGQodGhpcy5zdGVwc1RleHQpO1xuICAgIH1cbiAgICB0aGlzLnN0ZXBzVGV4dCA9IG51bGw7XG4gIH1cblxuICBjbGVhckRvbmVUZXh0KCkge1xuICAgIGlmICh0aGlzLmRvbmVUZXh0ICE9PSBudWxsKSB7XG4gICAgICB0aGlzLnN0YWdlLnJlbW92ZUNoaWxkKHRoaXMuZG9uZVRleHQpO1xuICAgIH1cbiAgICB0aGlzLmRvbmVUZXh0ID0gbnVsbDtcbiAgfVxuXG4gIGNyZWF0ZUNoZWNrZXJTcHJpdGUoKSB7XG4gICAgdGhpcy5jbGVhckNoZWNrZXJTcHJpdGUoKTtcbiAgICB0aGlzLmNoZWNrZXJTcHJpdGUgPSBuZXcgUElYSS5HcmFwaGljcygpO1xuICAgIHRoaXMuY2hlY2tlclNwcml0ZS5saW5lU3R5bGUoMiwgMHgwMDAwRkYsIDEpO1xuICAgIHRoaXMuY2hlY2tlclNwcml0ZS5iZWdpbkZpbGwoMHg0MDQwRkYpO1xuICAgIHRoaXMuY2hlY2tlclNwcml0ZS5kcmF3Q2lyY2xlKDAsIDAsIHRoaXMucmFkaXVzKTtcbiAgICB0aGlzLmNoZWNrZXJTcHJpdGUueCA9IHRoaXMucG9zaXRpb24ueDtcbiAgICB0aGlzLmNoZWNrZXJTcHJpdGUueSA9IHRoaXMucG9zaXRpb24ueTtcbiAgICB0aGlzLnN0YWdlLmFkZENoaWxkKHRoaXMuY2hlY2tlclNwcml0ZSk7XG4gIH1cblxuICBjcmVhdGVTdGVwc1RleHQoKSB7XG4gICAgdGhpcy5jbGVhclN0ZXBzVGV4dCgpO1xuXG4gICAgbGV0IHN0eWxlO1xuICAgIGlmICghdGhpcy5vbkJvYXJkKSB7XG4gICAgICBzdHlsZSA9IG5ldyBQSVhJLlRleHRTdHlsZSh7XG4gICAgICAgIGZvbnRTaXplOiAzMCxcbiAgICAgICAgZmlsbDogMHg0MEZGNDBcbiAgICAgIH0pO1xuICAgIH0gZWxzZSBpZiAodGhpcy50b29NYW55U3RlcHMoKSkge1xuICAgICAgc3R5bGUgPSBuZXcgUElYSS5UZXh0U3R5bGUoe1xuICAgICAgICBmb250U2l6ZTogMzAsXG4gICAgICAgIGZpbGw6IDB4RkY0MDQwXG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3R5bGUgPSBuZXcgUElYSS5UZXh0U3R5bGUoe1xuICAgICAgICBmb250U2l6ZTogMzAsXG4gICAgICAgIGZpbGw6IDB4RDBEMEQwXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICB0aGlzLnN0ZXBzVGV4dCA9IG5ldyBQSVhJLlRleHQoJ1N0ZXBzIFRha2VuOiAnICsgdGhpcy5zdGVwc1Rha2VuLCBzdHlsZSk7XG4gICAgdGhpcy5zdGVwc1RleHQueCA9IDcwMDtcbiAgICB0aGlzLnN0ZXBzVGV4dC55ID0gMzAwO1xuICAgIHRoaXMuc3RhZ2UuYWRkQ2hpbGQodGhpcy5zdGVwc1RleHQpO1xuICB9XG5cbiAgY3JlYXRlRG9uZVRleHQobXNnOiBzdHJpbmcpIHtcbiAgICB0aGlzLmNsZWFyRG9uZVRleHQoKTtcblxuICAgIGxldCBzdHlsZSA9IG5ldyBQSVhJLlRleHRTdHlsZSh7XG4gICAgICBmb250U2l6ZTogMzAsXG4gICAgICBmaWxsOiAweEQwRDBEMFxuICAgIH0pO1xuXG4gICAgdGhpcy5kb25lVGV4dCA9IG5ldyBQSVhJLlRleHQobXNnLCBzdHlsZSk7XG4gICAgdGhpcy5kb25lVGV4dC54ID0gNzAwO1xuICAgIHRoaXMuZG9uZVRleHQueSA9IDM1MDtcbiAgICB0aGlzLnN0YWdlLmFkZENoaWxkKHRoaXMuZG9uZVRleHQpO1xuICB9XG5cbiAgdG9vTWFueVN0ZXBzKCkge1xuICAgIHJldHVybiAodGhpcy5zdGVwc1Rha2VuID49IHRoaXMuYm9hcmQubG9uZ2VzdEV4aXRQYXRoTGVuZ3RoKTtcbiAgfVxuXG4gIC8vIHVwZGF0ZSBhbmQgYW5pbWF0ZVxuICB1cGRhdGUoKSB7XG4gICAgaWYgKHRoaXMuZG9uZSkge1xuICAgICAgcmV0dXJuO1xuICAgIH0gZWxzZSBpZiAoIXRoaXMuc3RhcnRlZCkge1xuICAgICAgLy8gc2V0IGRpcmVjdGlvblxuICAgICAgdGhpcy5uZXh0U3F1YXJlUkMgPSB0aGlzLmJvYXJkLm5leHRDaGVja2VyU3F1YXJlUkModGhpcy5zcXVhcmVSQyk7XG4gICAgICB0aGlzLm5leHRQb3NpdGlvbiA9IHRoaXMuYm9hcmQuY2VudGVyT2ZTcXVhcmUodGhpcy5uZXh0U3F1YXJlUkMpO1xuICAgICAgdGhpcy5jdXJyZW50RnJhbWUrKztcbiAgICAgIHRoaXMuc3RhcnRlZCA9IHRydWU7XG4gICAgICB0aGlzLmNyZWF0ZVN0ZXBzVGV4dCgpO1xuICAgICAgdGhpcy5jdXJyZW50RnJhbWUgPSAxO1xuICAgIH0gZWxzZSBpZiAodGhpcy5jdXJyZW50RnJhbWUgPT09IDApIHtcbiAgICAgIC8vIGFycml2ZSBhdCBzcXVhcmVcbiAgICAgIHRoaXMuY2hlY2tlclNwcml0ZS54ID0gdGhpcy5uZXh0UG9zaXRpb24ueDtcbiAgICAgIHRoaXMuY2hlY2tlclNwcml0ZS55ID0gdGhpcy5uZXh0UG9zaXRpb24ueTtcbiAgICAgIHRoaXMucG9zaXRpb24gPSB0aGlzLm5leHRQb3NpdGlvbjtcbiAgICAgIHRoaXMuc3F1YXJlUkMgPSB0aGlzLm5leHRTcXVhcmVSQztcbiAgICAgIHRoaXMuc3RlcHNUYWtlbisrO1xuICAgICAgdGhpcy5jYWxjdWxhdGVPbkJvYXJkKCk7XG4gICAgICB0aGlzLmNyZWF0ZVN0ZXBzVGV4dCgpO1xuICAgICAgaWYgKCF0aGlzLm9uQm9hcmQpIHtcbiAgICAgICAgdGhpcy5kb25lID0gdHJ1ZTsgLy8gZXhpdCBjb25kaXRpb25cbiAgICAgICAgdGhpcy5jcmVhdGVEb25lVGV4dCgnRXhpdGVkJylcbiAgICAgIH0gZWxzZSBpZiAodGhpcy50b29NYW55U3RlcHMoKSkge1xuICAgICAgICB0aGlzLmRvbmUgPSB0cnVlOyAvLyBsb29wIGNvbmRpdGlvblxuICAgICAgICB0aGlzLmNyZWF0ZURvbmVUZXh0KCdXaWxsIGxvb3AnKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIHNldCBuZXh0IGRpcmVjdGlvblxuICAgICAgICB0aGlzLm5leHRTcXVhcmVSQyA9IHRoaXMuYm9hcmQubmV4dENoZWNrZXJTcXVhcmVSQyh0aGlzLnNxdWFyZVJDKTtcbiAgICAgICAgdGhpcy5uZXh0UG9zaXRpb24gPSB0aGlzLmJvYXJkLmNlbnRlck9mU3F1YXJlKHRoaXMubmV4dFNxdWFyZVJDKTtcbiAgICAgICAgdGhpcy5jdXJyZW50RnJhbWUrKztcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gbW92ZSB0byBuZXh0IHNxdWFyZVxuICAgICAgbGV0IGYgPSAodGhpcy5tb3ZlbWVudEZyYW1lcyAtIHRoaXMuY3VycmVudEZyYW1lKS90aGlzLm1vdmVtZW50RnJhbWVzO1xuICAgICAgZiA9IGYgKiBmOyAvLyBuaWNlciBhbmltYXRpb25cbiAgICAgIHRoaXMuY2hlY2tlclNwcml0ZS54ID0gZip0aGlzLnBvc2l0aW9uLnggKyAoMSAtIGYpKnRoaXMubmV4dFBvc2l0aW9uLng7XG4gICAgICB0aGlzLmNoZWNrZXJTcHJpdGUueSA9IGYqdGhpcy5wb3NpdGlvbi55ICsgKDEgLSBmKSp0aGlzLm5leHRQb3NpdGlvbi55O1xuICAgICAgdGhpcy5jdXJyZW50RnJhbWUrKztcbiAgICAgIGlmICh0aGlzLmN1cnJlbnRGcmFtZSA9PT0gdGhpcy5tb3ZlbWVudEZyYW1lcykge1xuICAgICAgICB0aGlzLmN1cnJlbnRGcmFtZSA9IDA7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iLCIvLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi4vdHlwaW5ncy9pbmRleC5kLnRzXCIgLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2JvYXJkLnRzXCIgLz5cbi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuL2NoZWNrZXIudHNcIiAvPlxuXG5pbXBvcnQgUElYSSA9IHJlcXVpcmUoJ3BpeGkuanMnKTtcbmltcG9ydCB7Qm9hcmR9IGZyb20gJy4vYm9hcmQnO1xuaW1wb3J0IHtDaGVja2VyfSBmcm9tICcuL2NoZWNrZXInO1xuY29uc3QgcmVuZGVyZXI6UElYSS5XZWJHTFJlbmRlcmVyID0gbmV3IFBJWEkuV2ViR0xSZW5kZXJlcigxMzgwLCA4MDApO1xuZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChyZW5kZXJlci52aWV3KTtcblxuLy8gWW91IG5lZWQgdG8gY3JlYXRlIGEgcm9vdCBjb250YWluZXIgdGhhdCB3aWxsIGhvbGQgdGhlIHNjZW5lIHlvdSB3YW50IHRvIGRyYXcuXG5jb25zdCBzdGFnZTpQSVhJLkNvbnRhaW5lciA9IG5ldyBQSVhJLkNvbnRhaW5lcigpO1xuXG5sZXQgcHJlc29sdmVCdXR0b24gPSBudWxsO1xubGV0IHByZXNvbHZlQnV0dG9uVGV4dCA9IG51bGw7XG5sZXQgcmVnZW5lcmF0ZUJ1dHRvbiA9IG51bGw7XG5sZXQgcmVnZW5lcmF0ZUJ1dHRvblRleHQgPSBudWxsO1xubGV0IGJvYXJkU2l6ZSA9IDExO1xubGV0IHNpemVMYWJlbCA9IG51bGw7XG5sZXQgc2l6ZVRleHQgPSBudWxsO1xubGV0IHNtYWxsZXJCdXR0b24gPSBudWxsO1xubGV0IGxhcmdlckJ1dHRvbiA9IG51bGw7XG5sZXQgY3JlYXRlQ2hlY2tlckJ1dHRvbiA9IG51bGw7XG5sZXQgY3JlYXRlQ2hlY2tlckJ1dHRvblRleHQgPSBudWxsO1xubGV0IHNvbHZlQnV0dG9uID0gbnVsbDtcbmxldCBzb2x2ZUJ1dHRvblRleHQgPSBudWxsO1xuXG5cbmxldCBjaGVja2VyID0gbnVsbDtcblxubGV0IGJvYXJkID0gbnVsbDtcbmdlbmVyYXRlQm9hcmQoKTtcblxuZnVuY3Rpb24gZ2VuZXJhdGVCb2FyZCgpIHtcbiAgZGVzdHJveUNoZWNrZXIoKTtcbiAgaWYgKGJvYXJkICE9PSBudWxsKSB7XG4gICAgYm9hcmQuZGVzdHJveSgpO1xuICB9XG4gIGJvYXJkID0gbmV3IEJvYXJkKGJvYXJkU2l6ZSwgc3RhZ2UpO1xuICBib2FyZC5pbml0Qm9hcmRSZW5kZXIoKTtcbiAgY3JlYXRlVUkoKTtcbiAgcmVuZGVyZXIucmVuZGVyKHN0YWdlKTtcbn1cblxuZnVuY3Rpb24gaW5jcmVtZW50U2l6ZSgpIHtcbiAgYm9hcmRTaXplKys7XG4gIGNyZWF0ZVNpemVVSSgpO1xuICByZW5kZXJlci5yZW5kZXIoc3RhZ2UpO1xufVxuXG5mdW5jdGlvbiBkZWNyZW1lbnRTaXplKCkge1xuICBib2FyZFNpemUtLTtcbiAgY3JlYXRlU2l6ZVVJKCk7XG4gIHJlbmRlcmVyLnJlbmRlcihzdGFnZSk7XG59XG5cbmxldCBwcmVzb2x2ZUFuaW1hdGlvbiA9IG51bGw7IC8vIHRvIHN0b3AgYW5pbWF0aW9uIG9mIHByZXNvbHZpbmdcbmZ1bmN0aW9uIHByZXNvbHZlKCkge1xuICBib2FyZC5wcmVzb2x2ZSgpO1xuICBjcmVhdGVQcmVzb2x2ZUJ1dHRvbigpOyAvLyBjcmVhdGUgdGhlIGRpc2FibGVkIGJ1dHRvblxuICBmdW5jdGlvbiBhbmltYXRlUHJlc29sdXRpb24oKSB7XG4gICAgaWYgKHByZXNvbHZlQW5pbWF0aW9uICE9PSBudWxsICYmIGJvYXJkLmV2ZW50cy5sZW5ndGggPT09IDApIHtcbiAgICAgIGNhbmNlbEFuaW1hdGlvbkZyYW1lKHByZXNvbHZlQW5pbWF0aW9uKTtcbiAgICAgIHByZXNvbHZlQW5pbWF0aW9uID0gbnVsbDtcbiAgICAgIGNyZWF0ZUNyZWF0ZUNoZWNrZXJCdXR0b24oKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcHJlc29sdmVBbmltYXRpb24gPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoYW5pbWF0ZVByZXNvbHV0aW9uKTtcbiAgICB9XG4gICAgYm9hcmQuc3RlcFByZXNvbHV0aW9uQW5pbWF0aW9uKCk7XG4gICAgcmVuZGVyZXIucmVuZGVyKHN0YWdlKTtcbiAgfVxuICBhbmltYXRlUHJlc29sdXRpb24oKTtcbn1cblxuZnVuY3Rpb24gZGVzdHJveUNoZWNrZXIoKSB7XG4gIGlmIChjaGVja2VyICE9PSBudWxsKSB7XG4gICAgaWYgKHNvbHZlQW5pbWF0aW9uICE9PSBudWxsKSB7XG4gICAgICBjYW5jZWxBbmltYXRpb25GcmFtZShzb2x2ZUFuaW1hdGlvbik7XG4gICAgICBzb2x2ZUFuaW1hdGlvbiA9IG51bGw7XG4gICAgfVxuICAgIGNoZWNrZXIuZGVzdHJveSgpO1xuICAgIGNoZWNrZXIgPSBudWxsO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUNoZWNrZXIoKSB7XG4gIGRlc3Ryb3lDaGVja2VyKCk7XG4gIGxldCByb3cgPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkqYm9hcmRTaXplKTtcbiAgbGV0IGNvbCA9IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSpib2FyZFNpemUpO1xuICBjaGVja2VyID0gbmV3IENoZWNrZXIoYm9hcmQsIHJvdywgY29sLCBzdGFnZSk7XG4gIGNoZWNrZXIuaW5pdENoZWNrZXJSZW5kZXIoKTtcbiAgY3JlYXRlVUkoKTtcbiAgcmVuZGVyZXIucmVuZGVyKHN0YWdlKTtcbn1cblxubGV0IHNvbHZlQW5pbWF0aW9uID0gbnVsbDtcbmZ1bmN0aW9uIHNvbHZlKCkge1xuICBjcmVhdGVTb2x2ZUJ1dHRvbigpO1xuICBmdW5jdGlvbiBhbmltYXRlU29sdXRpb24oKSB7XG4gICAgaWYgKGNoZWNrZXIuZG9uZSkge1xuICAgICAgY2FuY2VsQW5pbWF0aW9uRnJhbWUoc29sdmVBbmltYXRpb24pO1xuICAgICAgc29sdmVBbmltYXRpb24gPSBudWxsO1xuICAgIH0gZWxzZSB7XG4gICAgICBzb2x2ZUFuaW1hdGlvbiA9IHJlcXVlc3RBbmltYXRpb25GcmFtZShhbmltYXRlU29sdXRpb24pO1xuICAgIH1cbiAgICBjaGVja2VyLnVwZGF0ZSgpO1xuICAgIHJlbmRlcmVyLnJlbmRlcihzdGFnZSk7XG4gIH1cbiAgYW5pbWF0ZVNvbHV0aW9uKCk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVVJKCkge1xuICBjcmVhdGVSZWdlbmVyYXRlQnV0dG9uKCk7XG4gIGNyZWF0ZVByZXNvbHZlQnV0dG9uKCk7XG4gIGNyZWF0ZVNpemVVSSgpO1xuICBjcmVhdGVDcmVhdGVDaGVja2VyQnV0dG9uKCk7XG4gIGNyZWF0ZVNvbHZlQnV0dG9uKCk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVNpemVVSSgpIHtcbiAgaWYgKHNpemVMYWJlbCAhPT0gbnVsbCkge1xuICAgIHN0YWdlLnJlbW92ZUNoaWxkKHNpemVMYWJlbCk7XG4gICAgc2l6ZUxhYmVsID0gbnVsbDtcbiAgfVxuICBpZiAoc2l6ZVRleHQgIT09IG51bGwpIHtcbiAgICBzdGFnZS5yZW1vdmVDaGlsZChzaXplVGV4dCk7XG4gICAgc2l6ZVRleHQgPSBudWxsO1xuICB9XG4gIGlmIChzbWFsbGVyQnV0dG9uICE9PSBudWxsKSB7XG4gICAgc3RhZ2UucmVtb3ZlQ2hpbGQoc21hbGxlckJ1dHRvbik7XG4gICAgc21hbGxlckJ1dHRvbiA9IG51bGw7XG4gIH1cbiAgaWYgKGxhcmdlckJ1dHRvbiAhPT0gbnVsbCkge1xuICAgIHN0YWdlLnJlbW92ZUNoaWxkKGxhcmdlckJ1dHRvbik7XG4gICAgbGFyZ2VyQnV0dG9uID0gbnVsbDtcbiAgfVxuXG4gIGxldCBzdHlsZSA9IG5ldyBQSVhJLlRleHRTdHlsZSh7XG4gICAgZm9udFNpemU6IDI0LFxuICAgIGZpbGw6IDB4RDBEMEQwXG4gIH0pO1xuXG4gIGxldCBsYWJlbCA9IG5ldyBQSVhJLlRleHQoJ1NpemU6ICcsIHN0eWxlKTtcbiAgbGFiZWwueCA9IDcwMDtcbiAgbGFiZWwueSA9IDUwO1xuXG4gIHN0YWdlLmFkZENoaWxkKGxhYmVsKTtcbiAgc2l6ZUxhYmVsID0gbGFiZWw7XG5cbiAgbGV0IGNlbnRlclggPSA3NzI7IC8vIGZvciB1cC9kb3duIGJ1dHRvbnNcblxuICBsZXQgdXBCdXR0b24gPSBuZXcgUElYSS5HcmFwaGljcygpO1xuICB1cEJ1dHRvbi5iZWdpbkZpbGwoMHhEMEQwRDApO1xuICB1cEJ1dHRvbi5kcmF3UG9seWdvbihbXG4gICAgY2VudGVyWCwgNTMsXG4gICAgY2VudGVyWCArIDEwLCA2MyxcbiAgICBjZW50ZXJYIC0gMTAsIDYzXG4gIF0pO1xuICB1cEJ1dHRvbi5lbmRGaWxsKCk7XG5cbiAgdXBCdXR0b24uaW50ZXJhY3RpdmUgPSB0cnVlO1xuICB1cEJ1dHRvbi5vbignbW91c2V1cCcsIGluY3JlbWVudFNpemUpO1xuXG4gIHN0YWdlLmFkZENoaWxkKHVwQnV0dG9uKTtcbiAgbGFyZ2VyQnV0dG9uID0gdXBCdXR0b247XG5cbiAgbGV0IGRvd25CdXR0b24gPSBuZXcgUElYSS5HcmFwaGljcygpO1xuICBpZiAoYm9hcmRTaXplID4gMikge1xuICAgIGRvd25CdXR0b24uYmVnaW5GaWxsKDB4RDBEMEQwKTtcbiAgfSBlbHNlIHtcbiAgICBkb3duQnV0dG9uLmJlZ2luRmlsbCgweDgwODA4MCk7XG4gIH1cbiAgZG93bkJ1dHRvbi5kcmF3UG9seWdvbihbXG4gICAgY2VudGVyWCwgNzcsXG4gICAgY2VudGVyWCAtIDEwLCA2NyxcbiAgICBjZW50ZXJYICsgMTAsIDY3XG4gIF0pO1xuICBkb3duQnV0dG9uLmVuZEZpbGwoKTtcblxuICBpZiAoYm9hcmRTaXplID4gMikge1xuICAgIGRvd25CdXR0b24uaW50ZXJhY3RpdmUgPSB0cnVlO1xuICAgIGRvd25CdXR0b24ub24oJ21vdXNldXAnLCBkZWNyZW1lbnRTaXplKTtcbiAgfVxuXG4gIHN0YWdlLmFkZENoaWxkKGRvd25CdXR0b24pO1xuICBzbWFsbGVyQnV0dG9uID0gZG93bkJ1dHRvbjtcblxuICBsZXQgdGV4dCA9IG5ldyBQSVhJLlRleHQoJycgKyBib2FyZFNpemUsIHN0eWxlKTtcbiAgdGV4dC54ID0gY2VudGVyWCArIDE0O1xuICB0ZXh0LnkgPSA1MDtcblxuICBzdGFnZS5hZGRDaGlsZCh0ZXh0KTtcbiAgc2l6ZVRleHQgPSB0ZXh0O1xufVxuXG5mdW5jdGlvbiBjcmVhdGVSZWdlbmVyYXRlQnV0dG9uKCkge1xuICBpZiAocmVnZW5lcmF0ZUJ1dHRvbiAhPT0gbnVsbCkge1xuICAgIHN0YWdlLnJlbW92ZUNoaWxkKHJlZ2VuZXJhdGVCdXR0b24pO1xuICAgIHJlZ2VuZXJhdGVCdXR0b24gPSBudWxsO1xuICB9XG4gIGlmIChyZWdlbmVyYXRlQnV0dG9uVGV4dCAhPT0gbnVsbCkge1xuICAgIHN0YWdlLnJlbW92ZUNoaWxkKHJlZ2VuZXJhdGVCdXR0b25UZXh0KTtcbiAgICByZWdlbmVyYXRlQnV0dG9uVGV4dCA9IG51bGw7XG4gIH1cblxuICBsZXQgYnV0dG9uID0gbmV3IFBJWEkuR3JhcGhpY3MoKTtcbiAgYnV0dG9uLmxpbmVTdHlsZSgyLCAweDgwODBGRiwgMSk7XG4gIGJ1dHRvbi5iZWdpbkZpbGwoMHhEMEQwRDApO1xuICBidXR0b24uZHJhd1JvdW5kZWRSZWN0KDcwMCwgOTAsIDE1NSwgMzAsIDcpO1xuICBidXR0b24uZW5kRmlsbCgpO1xuXG4gIGJ1dHRvbi5pbnRlcmFjdGl2ZSA9IHRydWU7XG4gIGJ1dHRvbi5vbignbW91c2V1cCcsIGdlbmVyYXRlQm9hcmQpO1xuXG4gIHN0YWdlLmFkZENoaWxkKGJ1dHRvbik7XG4gIHJlZ2VuZXJhdGVCdXR0b24gPSBidXR0b247XG5cbiAgbGV0IHN0eWxlID0gbmV3IFBJWEkuVGV4dFN0eWxlKHtcbiAgICBmb250U2l6ZTogMjAsXG4gICAgZmlsbDogMHgyMDIwMjBcbiAgfSk7XG5cbiAgbGV0IHRleHQgPSBuZXcgUElYSS5UZXh0KCdSZWdlbmVyYXRlJywgc3R5bGUpO1xuICB0ZXh0LnggPSA3MjY7XG4gIHRleHQueSA9IDkzO1xuXG4gIHN0YWdlLmFkZENoaWxkKHRleHQpO1xuICByZWdlbmVyYXRlQnV0dG9uVGV4dCA9IHRleHQ7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVByZXNvbHZlQnV0dG9uKCkge1xuICBpZiAocHJlc29sdmVCdXR0b24gIT09IG51bGwpIHtcbiAgICBzdGFnZS5yZW1vdmVDaGlsZChwcmVzb2x2ZUJ1dHRvbik7XG4gICAgcHJlc29sdmVCdXR0b24gPSBudWxsO1xuICB9XG4gIGlmIChwcmVzb2x2ZUJ1dHRvblRleHQgIT09IG51bGwpIHtcbiAgICBzdGFnZS5yZW1vdmVDaGlsZChwcmVzb2x2ZUJ1dHRvblRleHQpO1xuICAgIHByZXNvbHZlQnV0dG9uVGV4dCA9IG51bGw7XG4gIH1cblxuICBsZXQgYnV0dG9uID0gbmV3IFBJWEkuR3JhcGhpY3MoKTtcbiAgYnV0dG9uLmxpbmVTdHlsZSgyLCAweDgwODBGRiwgMSk7XG4gIGlmIChib2FyZC5wcmVzb2x2ZWQpIHtcbiAgICBidXR0b24uYmVnaW5GaWxsKDB4ODA4MDgwKTtcbiAgfSBlbHNlIHtcbiAgICBidXR0b24uYmVnaW5GaWxsKDB4RDBEMEQwKTtcbiAgfVxuICBidXR0b24uZHJhd1JvdW5kZWRSZWN0KDcwMCwgMTMwLCAxNTUsIDMwLCA3KTtcbiAgYnV0dG9uLmVuZEZpbGwoKTtcblxuICBpZiAoIWJvYXJkLnByZXNvbHZlZCkge1xuICAgIGJ1dHRvbi5pbnRlcmFjdGl2ZSA9IHRydWU7XG4gICAgYnV0dG9uLm9uKCdtb3VzZXVwJywgcHJlc29sdmUpO1xuICB9XG5cbiAgc3RhZ2UuYWRkQ2hpbGQoYnV0dG9uKTtcbiAgcHJlc29sdmVCdXR0b24gPSBidXR0b247XG5cbiAgbGV0IHN0eWxlID0gbmV3IFBJWEkuVGV4dFN0eWxlKHtcbiAgICBmb250U2l6ZTogMjAsXG4gICAgZmlsbDogMHgyMDIwMjBcbiAgfSk7XG5cbiAgbGV0IHRleHQgPSBuZXcgUElYSS5UZXh0KCdQcmVzb2x2ZScsIHN0eWxlKTtcbiAgdGV4dC54ID0gNzM5O1xuICB0ZXh0LnkgPSAxMzM7XG5cbiAgc3RhZ2UuYWRkQ2hpbGQodGV4dCk7XG4gIHByZXNvbHZlQnV0dG9uVGV4dCA9IHRleHQ7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUNyZWF0ZUNoZWNrZXJCdXR0b24oKSB7XG4gIGlmIChjcmVhdGVDaGVja2VyQnV0dG9uICE9PSBudWxsKSB7XG4gICAgc3RhZ2UucmVtb3ZlQ2hpbGQoY3JlYXRlQ2hlY2tlckJ1dHRvbik7XG4gICAgY3JlYXRlQ2hlY2tlckJ1dHRvbiA9IG51bGw7XG4gIH1cbiAgaWYgKGNyZWF0ZUNoZWNrZXJCdXR0b25UZXh0ICE9PSBudWxsKSB7XG4gICAgc3RhZ2UucmVtb3ZlQ2hpbGQoY3JlYXRlQ2hlY2tlckJ1dHRvblRleHQpO1xuICAgIGNyZWF0ZUNoZWNrZXJCdXR0b25UZXh0ID0gbnVsbDtcbiAgfVxuXG4gIGxldCBidXR0b24gPSBuZXcgUElYSS5HcmFwaGljcygpO1xuICBidXR0b24ubGluZVN0eWxlKDIsIDB4ODA4MEZGLCAxKTtcbiAgaWYgKGJvYXJkLnByZXNvbHZlZCkge1xuICAgIGJ1dHRvbi5iZWdpbkZpbGwoMHhEMEQwRDApO1xuICB9IGVsc2Uge1xuICAgIGJ1dHRvbi5iZWdpbkZpbGwoMHg4MDgwODApO1xuICB9XG4gIGJ1dHRvbi5kcmF3Um91bmRlZFJlY3QoNzAwLCAyMTAsIDE1NSwgMzAsIDcpO1xuICBidXR0b24uZW5kRmlsbCgpO1xuXG4gIGlmIChib2FyZC5wcmVzb2x2ZWQpIHtcbiAgICBidXR0b24uaW50ZXJhY3RpdmUgPSB0cnVlO1xuICAgIGJ1dHRvbi5vbignbW91c2V1cCcsIGNyZWF0ZUNoZWNrZXIpO1xuICB9XG5cbiAgc3RhZ2UuYWRkQ2hpbGQoYnV0dG9uKTtcbiAgY3JlYXRlQ2hlY2tlckJ1dHRvbiA9IGJ1dHRvbjtcblxuICBsZXQgc3R5bGUgPSBuZXcgUElYSS5UZXh0U3R5bGUoe1xuICAgIGZvbnRTaXplOiAyMCxcbiAgICBmaWxsOiAweDIwMjAyMFxuICB9KTtcblxuICBsZXQgdGV4dCA9IG5ldyBQSVhJLlRleHQoJ0NyZWF0ZSBDaGVja2VyJywgc3R5bGUpO1xuICB0ZXh0LnggPSA3MDc7XG4gIHRleHQueSA9IDIxMztcblxuICBzdGFnZS5hZGRDaGlsZCh0ZXh0KTtcbiAgY3JlYXRlQ2hlY2tlckJ1dHRvblRleHQgPSB0ZXh0O1xufVxuXG5mdW5jdGlvbiBjcmVhdGVTb2x2ZUJ1dHRvbigpIHtcbiAgaWYgKHNvbHZlQnV0dG9uICE9PSBudWxsKSB7XG4gICAgc3RhZ2UucmVtb3ZlQ2hpbGQoc29sdmVCdXR0b24pO1xuICAgIHNvbHZlQnV0dG9uID0gbnVsbDtcbiAgfVxuICBpZiAoc29sdmVCdXR0b25UZXh0ICE9PSBudWxsKSB7XG4gICAgc3RhZ2UucmVtb3ZlQ2hpbGQoc29sdmVCdXR0b25UZXh0KTtcbiAgICBzb2x2ZUJ1dHRvblRleHQgPSBudWxsO1xuICB9XG5cbiAgbGV0IGVuYWJsZWQgPSBjaGVja2VyICE9PSBudWxsICYmICFjaGVja2VyLnN0YXJ0ZWQ7XG5cbiAgbGV0IGJ1dHRvbiA9IG5ldyBQSVhJLkdyYXBoaWNzKCk7XG4gIGJ1dHRvbi5saW5lU3R5bGUoMiwgMHg4MDgwRkYsIDEpO1xuICBpZiAoZW5hYmxlZCkge1xuICAgIGJ1dHRvbi5iZWdpbkZpbGwoMHhEMEQwRDApO1xuICB9IGVsc2Uge1xuICAgIGJ1dHRvbi5iZWdpbkZpbGwoMHg4MDgwODApO1xuICB9XG4gIGJ1dHRvbi5kcmF3Um91bmRlZFJlY3QoNzAwLCAyNTAsIDE1NSwgMzAsIDcpO1xuICBidXR0b24uZW5kRmlsbCgpO1xuXG4gIGlmIChlbmFibGVkKSB7XG4gICAgYnV0dG9uLmludGVyYWN0aXZlID0gdHJ1ZTtcbiAgICBidXR0b24ub24oJ21vdXNldXAnLCBzb2x2ZSk7XG4gIH1cblxuICBzdGFnZS5hZGRDaGlsZChidXR0b24pO1xuICBzb2x2ZUJ1dHRvbiA9IGJ1dHRvbjtcblxuICBsZXQgc3R5bGUgPSBuZXcgUElYSS5UZXh0U3R5bGUoe1xuICAgIGZvbnRTaXplOiAyMCxcbiAgICBmaWxsOiAweDIwMjAyMFxuICB9KTtcblxuICBsZXQgdGV4dCA9IG5ldyBQSVhJLlRleHQoJ1NvbHZlJywgc3R5bGUpO1xuICB0ZXh0LnggPSA3NTI7XG4gIHRleHQueSA9IDI1MztcblxuICBzdGFnZS5hZGRDaGlsZCh0ZXh0KTtcbiAgc29sdmVCdXR0b25UZXh0ID0gdGV4dDtcbn1cblxuLyovLyBEZWNsYXJlIGEgZ2xvYmFsIHZhcmlhYmxlIGZvciBvdXIgc3ByaXRlIHNvIHRoYXQgdGhlIGFuaW1hdGUgZnVuY3Rpb24gY2FuIGFjY2VzcyBpdC5cbmxldCBidW5ueTpQSVhJLlNwcml0ZSA9IG51bGw7XG5cbi8vIGxvYWQgdGhlIHRleHR1cmUgd2UgbmVlZFxuUElYSS5sb2FkZXIuYWRkKCdidW5ueScsICdpbWFnZXMvYnVubnkuanBlZycpLmxvYWQoZnVuY3Rpb24gKGxvYWRlcjpQSVhJLmxvYWRlcnMuTG9hZGVyLCByZXNvdXJjZXM6YW55KSB7XG4gICAgLy8gVGhpcyBjcmVhdGVzIGEgdGV4dHVyZSBmcm9tIGEgJ2J1bm55LnBuZycgaW1hZ2UuXG4gICAgYnVubnkgPSBuZXcgUElYSS5TcHJpdGUocmVzb3VyY2VzLmJ1bm55LnRleHR1cmUpO1xuXG4gICAgLy8gU2V0dXAgdGhlIHBvc2l0aW9uIGFuZCBzY2FsZSBvZiB0aGUgYnVubnlcbiAgICBidW5ueS5wb3NpdGlvbi54ID0gNDAwO1xuICAgIGJ1bm55LnBvc2l0aW9uLnkgPSAzMDA7XG5cbiAgICBidW5ueS5zY2FsZS54ID0gMjtcbiAgICBidW5ueS5zY2FsZS55ID0gMjtcblxuICAgIC8vIEFkZCB0aGUgYnVubnkgdG8gdGhlIHNjZW5lIHdlIGFyZSBidWlsZGluZy5cbiAgICBzdGFnZS5hZGRDaGlsZChidW5ueSk7XG5cbiAgICAvLyBraWNrIG9mZiB0aGUgYW5pbWF0aW9uIGxvb3AgKGRlZmluZWQgYmVsb3cpXG4gICAgYW5pbWF0ZSgpO1xufSk7XG5cbmZ1bmN0aW9uIGFuaW1hdGUoKSB7XG4gICAgLy8gc3RhcnQgdGhlIHRpbWVyIGZvciB0aGUgbmV4dCBhbmltYXRpb24gbG9vcFxuICAgIHJlcXVlc3RBbmltYXRpb25GcmFtZShhbmltYXRlKTtcblxuICAgIC8vIGVhY2ggZnJhbWUgd2Ugc3BpbiB0aGUgYnVubnkgYXJvdW5kIGEgYml0XG4gICAgYnVubnkucm90YXRpb24gKz0gMC4wMTtcblxuICAgIC8vIHRoaXMgaXMgdGhlIG1haW4gcmVuZGVyIGNhbGwgdGhhdCBtYWtlcyBwaXhpIGRyYXcgeW91ciBjb250YWluZXIgYW5kIGl0cyBjaGlsZHJlbi5cbiAgICByZW5kZXJlci5yZW5kZXIoc3RhZ2UpO1xufSovXG4iXX0=

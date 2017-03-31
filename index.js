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
        this.currentRestFrame = 0;
        this.drawingNonExits = size * size;
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
        this.nonExitsText = null;
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
    record(event) {
        this.currentEvent.push(event);
    }
    nextEvent() {
        this.events.push(this.currentEvent);
        this.currentEvent = [];
    }
    // Here we're going to compute which squares lead out.
    // We're only going to presolve one way, but we'll keep
    // track of it in different ways.  There are two algorithms
    // that we'll use at the same time, and the visualization
    // will choose just one to actually display.
    //
    // Here's how this will work.  For the first algorithm, we're going to
    // presolve the board entirely, which will take O(n^2) in the worst case
    // and O(n) in the best, with a storage cost of O(n^2).  However, this
    // cost is entirely up front, so when we put a checker on a random square,
    // we will know whether it will exit in O(1).
    // For the second algorithm, we're going to keep track of the longest
    // path leading out, as well as the number of squares leading out in
    // general.  This will take O(n^2) but will have O(1) storage.  When we put
    // a checker on a random square, we'll therefore have an upper limit on
    // the number of steps it can take before looping, so we can just keep
    // stepping it and counting until either the checker exits or we know
    // we've gone long enough to be in a loop.  This will take O(n^2) steps in
    // the worst case.
    //
    // The actual presolving algorithm is as follows: we go around the edge of
    // the board, looking for arrows pointing out.  When we find one, we simply
    // follow the path backwards, either marking squares or counting them (well,
    // actually, we'll do both, but we'll only visualize one at a time).
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
                        event: "updateNonExits",
                        value: self.size * self.size - exits
                    });
                    self.record({
                        event: "addExitSquare",
                        square: square
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
                        event: "updateNonExits",
                        value: this.size * this.size - exits
                    });
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
        this.nonExitSquareCount = this.size * this.size - exits;
        this.presolved = true;
    }
    processRenderEvent(event) {
        switch (event.event) {
            case "updateNonExits":
                this.drawingNonExits = event.value;
                this.createStatsText();
                break;
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
        this.clearNonExitsText();
        this.clearLongestPathText();
    }
    clearNonExitsText() {
        if (this.nonExitsText !== null) {
            this.stage.removeChild(this.nonExitsText);
            this.nonExitsText = null;
        }
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
        this.nonExitsText = new PIXI.Text('Non-Exit Squares: ' + this.drawingNonExits, style);
        this.nonExitsText.x = 50;
        this.nonExitsText.y = 5;
        this.stage.addChild(this.nonExitsText);
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
        let r = this.row(square);
        let c = this.col(square);
        let xCenter = this.TL.x + this.cellWidth * (c + 1.5);
        let yCenter = this.TL.y + this.cellHeight * (r + 1.5);
        const k = Math.sqrt(3) / 8; // useful geometric constant
        let arrow = new PIXI.Graphics();
        arrow.beginFill(0x808080);
        switch (this.arrows[square]) {
            case Direction.Up:
                arrow.drawPolygon([
                    xCenter, yCenter - this.cellHeight * 0.375,
                    xCenter + k * this.cellWidth, yCenter,
                    xCenter - k * this.cellWidth, yCenter
                ]);
                break;
            case Direction.Down:
                arrow.drawPolygon([
                    xCenter, yCenter + this.cellHeight * 0.375,
                    xCenter - k * this.cellWidth, yCenter,
                    xCenter + k * this.cellWidth, yCenter
                ]);
                break;
            case Direction.Left:
                arrow.drawPolygon([
                    xCenter - this.cellHeight * 0.375, yCenter,
                    xCenter, yCenter - k * this.cellHeight,
                    xCenter, yCenter + k * this.cellHeight
                ]);
                break;
            case Direction.Right:
                arrow.drawPolygon([
                    xCenter + this.cellHeight * 0.375, yCenter,
                    xCenter, yCenter + k * this.cellHeight,
                    xCenter, yCenter - k * this.cellHeight
                ]);
                break;
        }
        arrow.endFill();
        this.stage.addChild(arrow);
        this.arrowSprites[square] = arrow;
    }
}
exports.Board = Board;

},{}],2:[function(require,module,exports){
/// <reference path="../typings/index.d.ts" />
/// <reference path="./board.ts" />
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const PIXI = require("pixi.js");
const board_1 = require("./board");
const renderer = new PIXI.WebGLRenderer(1280, 720);
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
let board = null;
generateBoard();
function generateBoard() {
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
        }
        else {
            presolveAnimation = requestAnimationFrame(animatePresolution);
        }
        board.stepPresolutionAnimation();
        renderer.render(stage);
    }
    animatePresolution();
}
function createUI() {
    createRegenerateButton();
    createPresolveButton();
    createSizeUI();
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
    if (boardSize > 1) {
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
    if (boardSize > 1) {
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
    button.drawRoundedRect(700, 90, 115, 30, 7);
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
    text.x = 706;
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
    button.drawRoundedRect(700, 130, 115, 30, 7);
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
    text.x = 719;
    text.y = 133;
    stage.addChild(text);
    presolveButtonText = text;
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

},{"./board":1,"pixi.js":undefined}]},{},[2])(2)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvYm9hcmQudHMiLCJzcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQSw4Q0FBOEM7OztBQUU5QyxJQUFLLFNBS0o7QUFMRCxXQUFLLFNBQVM7SUFDWixxQ0FBTSxDQUFBO0lBQ04seUNBQUksQ0FBQTtJQUNKLHlDQUFJLENBQUE7SUFDSiwyQ0FBSyxDQUFBO0FBQ1AsQ0FBQyxFQUxJLFNBQVMsS0FBVCxTQUFTLFFBS2I7QUFFRCxNQUFNLFVBQVUsR0FBRyxDQUFDLFNBQVMsQ0FBQyxFQUFFLEVBQUUsU0FBUyxDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUVuRjtJQTRCRSxZQUFZLElBQVksRUFBRSxLQUFxQjtRQUM3QyxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztRQUNqQixJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztRQUNuQixJQUFJLENBQUMsTUFBTSxHQUFHLEVBQUUsQ0FBQztRQUNqQixJQUFJLENBQUMsV0FBVyxHQUFHLEVBQUUsQ0FBQztRQUN0QixJQUFJLENBQUMsTUFBTSxHQUFHLEVBQUUsQ0FBQztRQUNqQixJQUFJLENBQUMsWUFBWSxHQUFHLEVBQUUsQ0FBQztRQUN2QixJQUFJLENBQUMsU0FBUyxHQUFHLEtBQUssQ0FBQztRQUN2QixJQUFJLENBQUMsbUJBQW1CLEdBQUcsQ0FBQyxDQUFDO1FBQzdCLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxDQUFDLENBQUM7UUFDMUIsSUFBSSxDQUFDLGVBQWUsR0FBRyxJQUFJLEdBQUcsSUFBSSxDQUFDO1FBQ25DLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxDQUFDLENBQUM7UUFDNUIsSUFBSSxDQUFDLEVBQUUsR0FBRyxFQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBQyxDQUFDO1FB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LElBQUksS0FBSyxHQUFHLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQztRQUM3QixRQUFRLEVBQUUsRUFBRTtRQUNaLElBQUksRUFBRSxRQUFRO0tBQ2YsQ0FBQyxDQUFDO0lBRUgsSUFBSSxJQUFJLEdBQUcsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxLQUFLLENBQUMsQ0FBQztJQUM1QyxJQUFJLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQztJQUNiLElBQUksQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDO0lBRWIsS0FBSyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNyQixrQkFBa0IsR0FBRyxJQUFJLENBQUM7QUFDNUIsQ0FBQztBQUVEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0dBK0JHIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuLi90eXBpbmdzL2luZGV4LmQudHNcIiAvPlxuXG5lbnVtIERpcmVjdGlvbiB7XG4gIFVwID0gMCxcbiAgRG93bixcbiAgTGVmdCxcbiAgUmlnaHRcbn1cblxuY29uc3QgZGlyZWN0aW9ucyA9IFtEaXJlY3Rpb24uVXAsIERpcmVjdGlvbi5Eb3duLCBEaXJlY3Rpb24uTGVmdCwgRGlyZWN0aW9uLlJpZ2h0XTtcblxuZXhwb3J0IGNsYXNzIEJvYXJkIHtcbiAgc2l6ZTogbnVtYmVyO1xuICBhcnJvd3M6IERpcmVjdGlvbltdO1xuICBleGl0U3F1YXJlczogYm9vbGVhbltdO1xuICBwcmVzb2x2ZWQ6IGJvb2xlYW47XG4gIG5vbkV4aXRTcXVhcmVDb3VudDogbnVtYmVyO1xuICBsb25nZXN0RXhpdFBhdGhMZW5ndGg6IG51bWJlcjtcbiAgLy8gZHJhd2luZ1xuICBzdGFnZTogUElYSS5Db250YWluZXI7XG4gIGV2ZW50czogYW55W11bXTsgLy8gcmVjb3JkIHN0ZXBzIHRvIHJlbmRlciBsYXRlclxuICBjdXJyZW50RXZlbnQ6IGFueVtdO1xuICBmcmFtZXNCZXR3ZWVuRXZlbnRzOiBudW1iZXI7XG4gIGN1cnJlbnRSZXN0RnJhbWU6IG51bWJlcjtcbiAgZHJhd2luZ0V4aXRTcXVhcmVzOiBib29sZWFuW107XG4gIGRyYXdpbmdOb25FeGl0czogbnVtYmVyO1xuICBub25FeGl0c1RleHQ6IFBJWEkuVGV4dDtcbiAgZHJhd2luZ0JhY2t0cmFjZVNxdWFyZXM6IGJvb2xlYW5bXTtcbiAgZHJhd2luZ0xvbmdlc3RQYXRoOiBudW1iZXI7XG4gIGxvbmdlc3RQYXRoVGV4dDogUElYSS5UZXh0O1xuICBUTDoge3g6IG51bWJlciwgeTogbnVtYmVyfTsgLy8gdG9wIGxlZnQgY29ybmVyICh0aGVyZSB3aWxsIGJlIGEgMS1zcXVhcmUgYnVmZmVyIGFyb3VuZCB0aGUgd2hvbGUgdGhpbmcpXG4gIGNlbGxXaWR0aDogbnVtYmVyO1xuICBjZWxsSGVpZ2h0OiBudW1iZXI7XG4gIHc6IG51bWJlcjsgLy8gd2lkdGhcbiAgaDogbnVtYmVyOyAvLyBoZWlnaHRcbiAgbGluZVNwcml0ZXM6IFBJWEkuR3JhcGhpY3NbXTsgLy8gc28gd2UgY2FuIHJlbW92ZSB0aGVtIGxhdGVyXG4gIGNlbGxTcHJpdGVzOiBQSVhJLkdyYXBoaWNzW107IC8vIGFycmF5IGJ5IHNxdWFyZSBpbmRleDsgdGhpbmdzIGluIGl0IGFyZSBudWxsIHVudGlsIHBvcHVsYXRlZFxuICBhcnJvd1Nwcml0ZXM6IFBJWEkuR3JhcGhpY3NbXTsgLy8gYWxzbyBieSBzcXVhcmUgaW5kZXg7XG5cbiAgY29uc3RydWN0b3Ioc2l6ZTogbnVtYmVyLCBzdGFnZTogUElYSS5Db250YWluZXIpIHtcbiAgICB0aGlzLnNpemUgPSBzaXplO1xuICAgIHRoaXMuc3RhZ2UgPSBzdGFnZTtcbiAgICB0aGlzLmFycm93cyA9IFtdO1xuICAgIHRoaXMuZXhpdFNxdWFyZXMgPSBbXTtcbiAgICB0aGlzLmV2ZW50cyA9IFtdO1xuICAgIHRoaXMuY3VycmVudEV2ZW50ID0gW107XG4gICAgdGhpcy5wcmVzb2x2ZWQgPSBmYWxzZTtcbiAgICB0aGlzLmZyYW1lc0JldHdlZW5FdmVudHMgPSA3O1xuICAgIHRoaXMuY3VycmVudFJlc3RGcmFtZSA9IDA7XG4gICAgdGhpcy5kcmF3aW5nTm9uRXhpdHMgPSBzaXplICogc2l6ZTtcbiAgICB0aGlzLmRyYXdpbmdMb25nZXN0UGF0aCA9IDA7XG4gICAgdGhpcy5UTCA9IHt4OiA1MCwgeTogMTAwfTtcbiAgICB0aGlzLncgPSA2MDA7XG4gICAgdGhpcy5oID0gNjAwO1xuICAgIHRoaXMuY2VsbFdpZHRoID0gdGhpcy53LyhzaXplICsgMik7XG4gICAgdGhpcy5jZWxsSGVpZ2h0ID0gdGhpcy5oLyhzaXplICsgMik7XG4gICAgdGhpcy5kcmF3aW5nRXhpdFNxdWFyZXMgPSBbXTtcbiAgICB0aGlzLmRyYXdpbmdCYWNrdHJhY2VTcXVhcmVzID0gW107XG4gICAgdGhpcy5saW5lU3ByaXRlcyA9IFtdO1xuICAgIHRoaXMuY2VsbFNwcml0ZXMgPSBbXTtcbiAgICB0aGlzLmFycm93U3ByaXRlcyA9IFtdO1xuICAgIHRoaXMubm9uRXhpdHNUZXh0ID0gbnVsbDtcbiAgICB0aGlzLmxvbmdlc3RQYXRoVGV4dCA9IG51bGw7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzaXplICogc2l6ZTsgaSsrKSB7XG4gICAgICB0aGlzLmFycm93c1tpXSA9IGRpcmVjdGlvbnNbTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpKjQpXTsgLy8gZ2VuZXJhdGUgYm9hcmRcbiAgICAgIHRoaXMuZXhpdFNxdWFyZXNbaV0gPSBmYWxzZTsgLy8gaW5pdGlhbGl6ZSBleGl0U3F1YXJlc1xuICAgICAgdGhpcy5kcmF3aW5nRXhpdFNxdWFyZXNbaV0gPSBmYWxzZTtcbiAgICAgIHRoaXMuZHJhd2luZ0JhY2t0cmFjZVNxdWFyZXNbaV0gPSBmYWxzZTtcbiAgICAgIHRoaXMuY2VsbFNwcml0ZXNbaV0gPSBudWxsO1xuICAgICAgdGhpcy5hcnJvd1Nwcml0ZXNbaV0gPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIHJvdyhzcXVhcmU6IG51bWJlcikgeyAvLyBiYXNpYyBvcGVyYXRpb24gdG8gZ2V0IHJvdyBmcm9tIHNxdWFyZSBudW1iZXJcbiAgICByZXR1cm4gTWF0aC5mbG9vcihzcXVhcmUvdGhpcy5zaXplKTtcbiAgfVxuXG4gIGNvbChzcXVhcmU6IG51bWJlcikgeyAvLyBnZXQgY29sdW1uXG4gICAgcmV0dXJuIHNxdWFyZSAlIHRoaXMuc2l6ZTtcbiAgfVxuXG4gIHNxdWFyZShyb3c6IG51bWJlciwgY29sOiBudW1iZXIpIHsgLy8gZ2V0IHNxdWFyZSBmcm9tIHJvdyBhbmQgY29sdW1uXG4gICAgcmV0dXJuIHRoaXMuc2l6ZSpyb3cgKyBjb2w7XG4gIH1cblxuICB1cChzcXVhcmU6IG51bWJlcikgeyAvLyBnbyB1cCBhIHNxdWFyZSAoMCBpcyB1cHBlciBsZWZ0LCBnb2luZyBhY3Jvc3MgdGhlbiBkb3duKVxuICAgIGlmICh0aGlzLnJvdyhzcXVhcmUpID09PSAwKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHNxdWFyZSAtIHRoaXMuc2l6ZTtcbiAgICB9XG4gIH1cblxuICBkb3duKHNxdWFyZTogbnVtYmVyKSB7IC8vIGRvd24gYSBzcXVhcmVcbiAgICBpZiAodGhpcy5yb3coc3F1YXJlKSA9PT0gdGhpcy5zaXplIC0gMSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBzcXVhcmUgKyB0aGlzLnNpemU7XG4gICAgfVxuICB9XG5cbiAgbGVmdChzcXVhcmU6IG51bWJlcikgeyAvLyBsZWZ0IGEgc3F1YXJlXG4gICAgaWYgKHRoaXMuY29sKHNxdWFyZSkgPT09IDApIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gc3F1YXJlIC0gMTtcbiAgICB9XG4gIH1cblxuICByaWdodChzcXVhcmU6IG51bWJlcikgeyAvLyByaWdodCBhIHNxdWFyZVxuICAgIGlmICh0aGlzLmNvbChzcXVhcmUpID09PSB0aGlzLnNpemUgLSAxKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHNxdWFyZSArIDE7XG4gICAgfVxuICB9XG5cbiAgbmV4dChzcXVhcmU6IG51bWJlcikgeyAvLyBmb2xsb3cgdGhlIGFycm93XG4gICAgc3dpdGNoICh0aGlzLmFycm93c1tzcXVhcmVdKSB7XG4gICAgICBjYXNlIERpcmVjdGlvbi5VcDpcbiAgICAgICAgcmV0dXJuIHRoaXMudXAoc3F1YXJlKTtcbiAgICAgIGNhc2UgRGlyZWN0aW9uLkRvd246XG4gICAgICAgIHJldHVybiB0aGlzLmRvd24oc3F1YXJlKTtcbiAgICAgIGNhc2UgRGlyZWN0aW9uLkxlZnQ6XG4gICAgICAgIHJldHVybiB0aGlzLmxlZnQoc3F1YXJlKTtcbiAgICAgIGNhc2UgRGlyZWN0aW9uLlJpZ2h0OlxuICAgICAgICByZXR1cm4gdGhpcy5yaWdodChzcXVhcmUpO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIG51bGw7IC8vIHNob3VsZCBuZXZlciBoYXBwZW5cbiAgICB9XG4gIH1cblxuICByZWNvcmQoZXZlbnQ6IE9iamVjdCkgeyAvLyByZWNvcmQgYW4gZXZlbnQgaW4gdGhpcyByZW5kZXIgc3RlcFxuICAgIHRoaXMuY3VycmVudEV2ZW50LnB1c2goZXZlbnQpO1xuICB9XG5cbiAgbmV4dEV2ZW50KCkgeyAvLyBtYWtlIHRoZSBuZXh0IHJlbmRlciBzdGVwXG4gICAgdGhpcy5ldmVudHMucHVzaCh0aGlzLmN1cnJlbnRFdmVudCk7XG4gICAgdGhpcy5jdXJyZW50RXZlbnQgPSBbXTtcbiAgfVxuXG4gIC8vIEhlcmUgd2UncmUgZ29pbmcgdG8gY29tcHV0ZSB3aGljaCBzcXVhcmVzIGxlYWQgb3V0LlxuICAvLyBXZSdyZSBvbmx5IGdvaW5nIHRvIHByZXNvbHZlIG9uZSB3YXksIGJ1dCB3ZSdsbCBrZWVwXG4gIC8vIHRyYWNrIG9mIGl0IGluIGRpZmZlcmVudCB3YXlzLiAgVGhlcmUgYXJlIHR3byBhbGdvcml0aG1zXG4gIC8vIHRoYXQgd2UnbGwgdXNlIGF0IHRoZSBzYW1lIHRpbWUsIGFuZCB0aGUgdmlzdWFsaXphdGlvblxuICAvLyB3aWxsIGNob29zZSBqdXN0IG9uZSB0byBhY3R1YWxseSBkaXNwbGF5LlxuICAvL1xuICAvLyBIZXJlJ3MgaG93IHRoaXMgd2lsbCB3b3JrLiAgRm9yIHRoZSBmaXJzdCBhbGdvcml0aG0sIHdlJ3JlIGdvaW5nIHRvXG4gIC8vIHByZXNvbHZlIHRoZSBib2FyZCBlbnRpcmVseSwgd2hpY2ggd2lsbCB0YWtlIE8obl4yKSBpbiB0aGUgd29yc3QgY2FzZVxuICAvLyBhbmQgTyhuKSBpbiB0aGUgYmVzdCwgd2l0aCBhIHN0b3JhZ2UgY29zdCBvZiBPKG5eMikuICBIb3dldmVyLCB0aGlzXG4gIC8vIGNvc3QgaXMgZW50aXJlbHkgdXAgZnJvbnQsIHNvIHdoZW4gd2UgcHV0IGEgY2hlY2tlciBvbiBhIHJhbmRvbSBzcXVhcmUsXG4gIC8vIHdlIHdpbGwga25vdyB3aGV0aGVyIGl0IHdpbGwgZXhpdCBpbiBPKDEpLlxuICAvLyBGb3IgdGhlIHNlY29uZCBhbGdvcml0aG0sIHdlJ3JlIGdvaW5nIHRvIGtlZXAgdHJhY2sgb2YgdGhlIGxvbmdlc3RcbiAgLy8gcGF0aCBsZWFkaW5nIG91dCwgYXMgd2VsbCBhcyB0aGUgbnVtYmVyIG9mIHNxdWFyZXMgbGVhZGluZyBvdXQgaW5cbiAgLy8gZ2VuZXJhbC4gIFRoaXMgd2lsbCB0YWtlIE8obl4yKSBidXQgd2lsbCBoYXZlIE8oMSkgc3RvcmFnZS4gIFdoZW4gd2UgcHV0XG4gIC8vIGEgY2hlY2tlciBvbiBhIHJhbmRvbSBzcXVhcmUsIHdlJ2xsIHRoZXJlZm9yZSBoYXZlIGFuIHVwcGVyIGxpbWl0IG9uXG4gIC8vIHRoZSBudW1iZXIgb2Ygc3RlcHMgaXQgY2FuIHRha2UgYmVmb3JlIGxvb3BpbmcsIHNvIHdlIGNhbiBqdXN0IGtlZXBcbiAgLy8gc3RlcHBpbmcgaXQgYW5kIGNvdW50aW5nIHVudGlsIGVpdGhlciB0aGUgY2hlY2tlciBleGl0cyBvciB3ZSBrbm93XG4gIC8vIHdlJ3ZlIGdvbmUgbG9uZyBlbm91Z2ggdG8gYmUgaW4gYSBsb29wLiAgVGhpcyB3aWxsIHRha2UgTyhuXjIpIHN0ZXBzIGluXG4gIC8vIHRoZSB3b3JzdCBjYXNlLlxuICAvL1xuICAvLyBUaGUgYWN0dWFsIHByZXNvbHZpbmcgYWxnb3JpdGhtIGlzIGFzIGZvbGxvd3M6IHdlIGdvIGFyb3VuZCB0aGUgZWRnZSBvZlxuICAvLyB0aGUgYm9hcmQsIGxvb2tpbmcgZm9yIGFycm93cyBwb2ludGluZyBvdXQuICBXaGVuIHdlIGZpbmQgb25lLCB3ZSBzaW1wbHlcbiAgLy8gZm9sbG93IHRoZSBwYXRoIGJhY2t3YXJkcywgZWl0aGVyIG1hcmtpbmcgc3F1YXJlcyBvciBjb3VudGluZyB0aGVtICh3ZWxsLFxuICAvLyBhY3R1YWxseSwgd2UnbGwgZG8gYm90aCwgYnV0IHdlJ2xsIG9ubHkgdmlzdWFsaXplIG9uZSBhdCBhIHRpbWUpLlxuICBwcmVzb2x2ZSgpIHtcbiAgICBsZXQgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHRoaXMucHJlc29sdmVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGxldCBsb25nZXN0UGF0aCA9IDA7XG4gICAgbGV0IGV4aXRzID0gMDsgLy8gY291bnQgb2YgZXhpdCBzcXVhcmVzXG4gICAgLy8gd2UgY2FuJ3QganVzdCBjb3VudCB0aGUgdHJ1ZSB2YWx1ZXMgaW4gZXhpdFNxdWFyZXMgYmVjYXVzZSB0aGF0IHdvdWxkXG4gICAgLy8gdmlvbGF0ZSBvdXIgTygxKSBzdG9yYWdlIHJlcXVpcmVtZW50XG5cbiAgICAvLyByZXR1cm5zIHBhdGggbGVuZ3RoXG4gICAgZnVuY3Rpb24gYmFja3RyYWNlUGF0aChzcXVhcmU6IG51bWJlcikge1xuICAgICAgbGV0IHBhdGhMZW5ndGhzID0gWzAsIDAsIDAsIDBdXG4gICAgICBsZXQgbmVpZ2hib3JzID0gW3NlbGYudXAoc3F1YXJlKSwgc2VsZi5kb3duKHNxdWFyZSksIHNlbGYubGVmdChzcXVhcmUpLCBzZWxmLnJpZ2h0KHNxdWFyZSldO1xuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBuZWlnaGJvcnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKG5laWdoYm9yc1tpXSAhPT0gbnVsbCAmJiBzZWxmLm5leHQobmVpZ2hib3JzW2ldKSA9PT0gc3F1YXJlKSB7XG4gICAgICAgICAgZXhpdHMrKztcbiAgICAgICAgICBzZWxmLmV4aXRTcXVhcmVzW25laWdoYm9yc1tpXV0gPSB0cnVlO1xuICAgICAgICAgIHNlbGYucmVjb3JkKHtcbiAgICAgICAgICAgIGV2ZW50OiBcInVwZGF0ZU5vbkV4aXRzXCIsXG4gICAgICAgICAgICB2YWx1ZTogc2VsZi5zaXplICogc2VsZi5zaXplIC0gZXhpdHNcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBzZWxmLnJlY29yZCh7XG4gICAgICAgICAgICBldmVudDogXCJhZGRFeGl0U3F1YXJlXCIsXG4gICAgICAgICAgICBzcXVhcmU6IHNxdWFyZVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIHNlbGYucmVjb3JkKHtcbiAgICAgICAgICAgIGV2ZW50OiBcImFkZEJhY2t0cmFjZVNxdWFyZVwiLFxuICAgICAgICAgICAgc3F1YXJlOiBzcXVhcmVcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBzZWxmLm5leHRFdmVudCgpO1xuICAgICAgICAgIHBhdGhMZW5ndGhzW2ldID0gYmFja3RyYWNlUGF0aChuZWlnaGJvcnNbaV0pO1xuICAgICAgICAgIHNlbGYucmVjb3JkKHtcbiAgICAgICAgICAgIGV2ZW50OiBcInJlbW92ZUJhY2t0cmFjZVNxdWFyZVwiLFxuICAgICAgICAgICAgc3F1YXJlOiBzcXVhcmVcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBzZWxmLm5leHRFdmVudCgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gMSArIE1hdGgubWF4KC4uLnBhdGhMZW5ndGhzKTtcbiAgICB9XG5cbiAgICAvLyBXZSdyZSBnb2luZyB0byBkbyBhbGwgZm91ciBzaWRlcyBhdCBvbmNlLlxuICAgIC8vIFRoaXMgd2lsbCB0YWtlIE8obikgY2hlY2tzIGluc3RlYWQgb2YgTyhuXjIpLCBzbyBldmVuIHRob3VnaCBpdCdzXG4gICAgLy8gYSBiaXQgbWVzc2llciB0byBjb2RlLCBpdCdzIGEgcG90ZW50aWFsbHkgdmVyeSBsYXJnZSBpbXByb3ZlbWVudFxuICAgIC8vIGluIGNhc2VzIHdlJ2xsIGxpa2VseSBuZXZlciBhY3R1YWxseSBoaXQuICBCdXQgaXQncyB0aGUgcHJpbmNpcGxlXG4gICAgLy8gb2YgdGhlIHRoaW5nLiAgSWYgd2Ugd2FudGVkIHRvIGp1c3QgY2hlY2sgdGhlIGVudGlyZSBncmlkIGZvciBleGl0XG4gICAgLy8gcG9pbnRzLCB3ZSdkIGp1c3QgY2hlY2sgaWYgdGhpcy5uZXh0IGlzIG51bGwgZm9yIGVhY2ggc3F1YXJlLlxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5zaXplIC0gMTsgaSsrKSB7XG4gICAgICBsZXQgdGFyZ2V0U3F1YXJlcyA9IFtcbiAgICAgICAgdGhpcy5zcXVhcmUoMCwgaSksIC8vIGFsb25nIHRvcFxuICAgICAgICB0aGlzLnNxdWFyZShpLCB0aGlzLnNpemUgLSAxKSwgLy8gYWxvbmcgcmlnaHRcbiAgICAgICAgdGhpcy5zcXVhcmUodGhpcy5zaXplIC0gMSwgdGhpcy5zaXplIC0gMSAtIGkpLCAvLyBhbG9uZyBib3R0b21cbiAgICAgICAgdGhpcy5zcXVhcmUodGhpcy5zaXplIC0gMSAtIGksIDApIC8vIGFsb25nIGxlZnRcbiAgICAgIF07XG4gICAgICBmb3IgKGxldCBqID0gMDsgaiA8IDQ7IGorKykge1xuICAgICAgICBpZiAodGhpcy5uZXh0KHRhcmdldFNxdWFyZXNbal0pID09PSBudWxsKSB7XG4gICAgICAgICAgZXhpdHMrKztcbiAgICAgICAgICB0aGlzLmV4aXRTcXVhcmVzW3RhcmdldFNxdWFyZXNbal1dID0gdHJ1ZTtcbiAgICAgICAgICB0aGlzLnJlY29yZCh7XG4gICAgICAgICAgICBldmVudDogXCJ1cGRhdGVOb25FeGl0c1wiLFxuICAgICAgICAgICAgdmFsdWU6IHRoaXMuc2l6ZSAqIHRoaXMuc2l6ZSAtIGV4aXRzXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgdGhpcy5yZWNvcmQoe1xuICAgICAgICAgICAgZXZlbnQ6IFwiYWRkRXhpdFNxdWFyZVwiLFxuICAgICAgICAgICAgc3F1YXJlOiB0YXJnZXRTcXVhcmVzW2pdXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgdGhpcy5yZWNvcmQoe1xuICAgICAgICAgICAgZXZlbnQ6IFwiYWRkQmFja3RyYWNlU3F1YXJlXCIsXG4gICAgICAgICAgICBzcXVhcmU6IHRhcmdldFNxdWFyZXNbal1cbiAgICAgICAgICB9KTtcbiAgICAgICAgICB0aGlzLm5leHRFdmVudCgpO1xuICAgICAgICAgIGxldCBwYXRoTGVuZ3RoID0gYmFja3RyYWNlUGF0aCh0YXJnZXRTcXVhcmVzW2pdKTtcbiAgICAgICAgICB0aGlzLnJlY29yZCh7XG4gICAgICAgICAgICBldmVudDogXCJyZW1vdmVCYWNrdHJhY2VTcXVhcmVcIixcbiAgICAgICAgICAgIHNxdWFyZTogdGFyZ2V0U3F1YXJlc1tqXVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIGlmIChwYXRoTGVuZ3RoID4gbG9uZ2VzdFBhdGgpIHtcbiAgICAgICAgICAgIGxvbmdlc3RQYXRoID0gcGF0aExlbmd0aDtcbiAgICAgICAgICAgIHRoaXMucmVjb3JkKHtcbiAgICAgICAgICAgICAgZXZlbnQ6IFwidXBkYXRlTG9uZ2VzdFBhdGhcIixcbiAgICAgICAgICAgICAgdmFsdWU6IGxvbmdlc3RQYXRoXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy5uZXh0RXZlbnQoKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMubG9uZ2VzdEV4aXRQYXRoTGVuZ3RoID0gbG9uZ2VzdFBhdGg7XG4gICAgdGhpcy5ub25FeGl0U3F1YXJlQ291bnQgPSB0aGlzLnNpemUqdGhpcy5zaXplIC0gZXhpdHM7XG4gICAgdGhpcy5wcmVzb2x2ZWQgPSB0cnVlO1xuICB9XG5cbiAgcHJvY2Vzc1JlbmRlckV2ZW50KGV2ZW50OiBhbnkpIHtcbiAgICBzd2l0Y2ggKGV2ZW50LmV2ZW50KSB7XG4gICAgICBjYXNlIFwidXBkYXRlTm9uRXhpdHNcIjpcbiAgICAgICAgdGhpcy5kcmF3aW5nTm9uRXhpdHMgPSBldmVudC52YWx1ZTtcbiAgICAgICAgdGhpcy5jcmVhdGVTdGF0c1RleHQoKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFwidXBkYXRlTG9uZ2VzdFBhdGhcIjpcbiAgICAgICAgdGhpcy5kcmF3aW5nTG9uZ2VzdFBhdGggPSBldmVudC52YWx1ZTtcbiAgICAgICAgdGhpcy5jcmVhdGVTdGF0c1RleHQoKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFwiYWRkRXhpdFNxdWFyZVwiOlxuICAgICAgICB0aGlzLmRyYXdpbmdFeGl0U3F1YXJlc1tldmVudC5zcXVhcmVdID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5jcmVhdGVDZWxsU3ByaXRlKGV2ZW50LnNxdWFyZSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBcImFkZEJhY2t0cmFjZVNxdWFyZVwiOlxuICAgICAgICB0aGlzLmRyYXdpbmdCYWNrdHJhY2VTcXVhcmVzW2V2ZW50LnNxdWFyZV0gPSB0cnVlO1xuICAgICAgICB0aGlzLmNyZWF0ZUNlbGxTcHJpdGUoZXZlbnQuc3F1YXJlKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFwicmVtb3ZlQmFja3RyYWNlU3F1YXJlXCI6XG4gICAgICAgIHRoaXMuZHJhd2luZ0JhY2t0cmFjZVNxdWFyZXNbZXZlbnQuc3F1YXJlXSA9IGZhbHNlO1xuICAgICAgICB0aGlzLmNyZWF0ZUNlbGxTcHJpdGUoZXZlbnQuc3F1YXJlKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgc3RlcFByZXNvbHV0aW9uQW5pbWF0aW9uKCkge1xuICAgIGlmICh0aGlzLmV2ZW50cy5sZW5ndGggPiAwICYmIHRoaXMuY3VycmVudFJlc3RGcmFtZSA8PSAwKSB7XG4gICAgICBsZXQgcmVuZGVyRXZlbnRzID0gdGhpcy5ldmVudHMuc2hpZnQoKTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgcmVuZGVyRXZlbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHRoaXMucHJvY2Vzc1JlbmRlckV2ZW50KHJlbmRlckV2ZW50c1tpXSk7XG4gICAgICB9XG4gICAgICB0aGlzLmN1cnJlbnRSZXN0RnJhbWUgKz0gdGhpcy5mcmFtZXNCZXR3ZWVuRXZlbnRzO1xuICAgIH0gZWxzZSBpZiAodGhpcy5jdXJyZW50UmVzdEZyYW1lID4gMCkge1xuICAgICAgdGhpcy5jdXJyZW50UmVzdEZyYW1lLS07XG4gICAgfVxuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLmNsZWFyQm9hcmRTcHJpdGVzKCk7XG4gICAgdGhpcy5jbGVhclN0YXRzVGV4dCgpO1xuICB9XG5cbiAgaW5pdEJvYXJkUmVuZGVyKCkge1xuICAgIHRoaXMuY2xlYXJCb2FyZFNwcml0ZXMoKTtcbiAgICB0aGlzLmNyZWF0ZUJvYXJkU3ByaXRlcygpO1xuICAgIHRoaXMuY3JlYXRlU3RhdHNUZXh0KCk7XG4gIH1cblxuICBjbGVhclN0YXRzVGV4dCgpIHtcbiAgICB0aGlzLmNsZWFyTm9uRXhpdHNUZXh0KCk7XG4gICAgdGhpcy5jbGVhckxvbmdlc3RQYXRoVGV4dCgpO1xuICB9XG5cbiAgY2xlYXJOb25FeGl0c1RleHQoKSB7XG4gICAgaWYgKHRoaXMubm9uRXhpdHNUZXh0ICE9PSBudWxsKSB7XG4gICAgICB0aGlzLnN0YWdlLnJlbW92ZUNoaWxkKHRoaXMubm9uRXhpdHNUZXh0KTtcbiAgICAgIHRoaXMubm9uRXhpdHNUZXh0ID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICBjbGVhckxvbmdlc3RQYXRoVGV4dCgpIHtcbiAgICBpZiAodGhpcy5sb25nZXN0UGF0aFRleHQgIT09IG51bGwpIHtcbiAgICAgIHRoaXMuc3RhZ2UucmVtb3ZlQ2hpbGQodGhpcy5sb25nZXN0UGF0aFRleHQpO1xuICAgICAgdGhpcy5sb25nZXN0UGF0aFRleHQgPSBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGNyZWF0ZVN0YXRzVGV4dCgpIHtcbiAgICB0aGlzLmNsZWFyU3RhdHNUZXh0KCk7XG4gICAgbGV0IHN0eWxlID0gbmV3IFBJWEkuVGV4dFN0eWxlKHtcbiAgICAgIGZvbnRTaXplOiAzMCxcbiAgICAgIGZpbGw6IDB4RDBEMEQwXG4gICAgfSk7XG5cbiAgICB0aGlzLm5vbkV4aXRzVGV4dCA9IG5ldyBQSVhJLlRleHQoJ05vbi1FeGl0IFNxdWFyZXM6ICcgKyB0aGlzLmRyYXdpbmdOb25FeGl0cywgc3R5bGUpO1xuICAgIHRoaXMubm9uRXhpdHNUZXh0LnggPSA1MDtcbiAgICB0aGlzLm5vbkV4aXRzVGV4dC55ID0gNTtcbiAgICB0aGlzLnN0YWdlLmFkZENoaWxkKHRoaXMubm9uRXhpdHNUZXh0KTtcblxuICAgIHRoaXMubG9uZ2VzdFBhdGhUZXh0ID0gbmV3IFBJWEkuVGV4dCgnTG9uZ2VzdCBQYXRoIExlbmd0aDogJyArIHRoaXMuZHJhd2luZ0xvbmdlc3RQYXRoLCBzdHlsZSk7XG4gICAgdGhpcy5sb25nZXN0UGF0aFRleHQueCA9IDUwO1xuICAgIHRoaXMubG9uZ2VzdFBhdGhUZXh0LnkgPSA0NTtcbiAgICB0aGlzLnN0YWdlLmFkZENoaWxkKHRoaXMubG9uZ2VzdFBhdGhUZXh0KTtcbiAgfVxuXG4gIGNsZWFyQm9hcmRTcHJpdGVzKCkge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5saW5lU3ByaXRlcy5sZW5ndGg7IGkrKykge1xuICAgICAgdGhpcy5zdGFnZS5yZW1vdmVDaGlsZCh0aGlzLmxpbmVTcHJpdGVzW2ldKTtcbiAgICB9XG4gICAgdGhpcy5saW5lU3ByaXRlcyA9IFtdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5zaXplKnRoaXMuc2l6ZTsgaSsrKSB7XG4gICAgICB0aGlzLnJlbW92ZUNlbGxTcHJpdGUoaSk7IC8vIGFsc28gY2xlYXJzIGFycm93IHNwcml0ZVxuICAgIH1cbiAgfVxuXG4gIHJlbW92ZUNlbGxTcHJpdGUoc3F1YXJlOiBudW1iZXIpIHtcbiAgICBpZiAodGhpcy5jZWxsU3ByaXRlc1tzcXVhcmVdICE9PSBudWxsKSB7XG4gICAgICB0aGlzLnN0YWdlLnJlbW92ZUNoaWxkKHRoaXMuY2VsbFNwcml0ZXNbc3F1YXJlXSk7XG4gICAgfVxuICAgIHRoaXMuY2VsbFNwcml0ZXNbc3F1YXJlXSA9IG51bGw7XG4gICAgdGhpcy5yZW1vdmVBcnJvd1Nwcml0ZShzcXVhcmUpO1xuICB9XG5cbiAgcmVtb3ZlQXJyb3dTcHJpdGUoc3F1YXJlOiBudW1iZXIpIHtcbiAgICBpZiAodGhpcy5hcnJvd1Nwcml0ZXNbc3F1YXJlXSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5zdGFnZS5yZW1vdmVDaGlsZCh0aGlzLmFycm93U3ByaXRlc1tzcXVhcmVdKTtcbiAgICB9XG4gICAgdGhpcy5hcnJvd1Nwcml0ZXNbc3F1YXJlXSA9IG51bGw7XG4gIH1cblxuICBjcmVhdGVCb2FyZFNwcml0ZXMoKSB7XG4gICAgdGhpcy5jbGVhckJvYXJkU3ByaXRlcygpO1xuICAgIHRoaXMuY3JlYXRlTGluZVNwcml0ZXMoKTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuc2l6ZSp0aGlzLnNpemU7IGkrKykge1xuICAgICAgdGhpcy5jcmVhdGVDZWxsU3ByaXRlKGkpO1xuICAgIH1cbiAgfVxuXG4gIGNyZWF0ZUxpbmVTcHJpdGVzKCkge1xuICAgIGZvciAobGV0IGkgPSAxOyBpIDw9IHRoaXMuc2l6ZSArIDE7IGkrKykge1xuICAgICAgbGV0IGhMaW5lID0gbmV3IFBJWEkuR3JhcGhpY3MoKTtcbiAgICAgIGhMaW5lLmxpbmVTdHlsZSgzLCAweDgwODBGRiwgMSk7XG4gICAgICBoTGluZS5tb3ZlVG8odGhpcy5UTC54ICsgdGhpcy5jZWxsV2lkdGggLSAxLjUsIHRoaXMuVEwueSArIGkqdGhpcy5jZWxsSGVpZ2h0KTtcbiAgICAgIGhMaW5lLmxpbmVUbyh0aGlzLlRMLnggKyAodGhpcy5zaXplICsgMSkqdGhpcy5jZWxsV2lkdGggKyAxLjUsIHRoaXMuVEwueSArIGkqdGhpcy5jZWxsSGVpZ2h0KTtcbiAgICAgIHRoaXMuc3RhZ2UuYWRkQ2hpbGQoaExpbmUpO1xuICAgICAgdGhpcy5saW5lU3ByaXRlcy5wdXNoKGhMaW5lKTtcblxuICAgICAgbGV0IHZMaW5lID0gbmV3IFBJWEkuR3JhcGhpY3MoKTtcbiAgICAgIHZMaW5lLmxpbmVTdHlsZSgzLCAweDgwODBGRiwgMSk7XG4gICAgICB2TGluZS5tb3ZlVG8odGhpcy5UTC54ICsgdGhpcy5jZWxsV2lkdGgqaSwgdGhpcy5UTC55ICsgdGhpcy5jZWxsSGVpZ2h0IC0gMS41KTtcbiAgICAgIHZMaW5lLmxpbmVUbyh0aGlzLlRMLnggKyB0aGlzLmNlbGxXaWR0aCppLCB0aGlzLlRMLnkgKyAodGhpcy5zaXplICsgMSkqdGhpcy5jZWxsSGVpZ2h0ICsgMS41KTtcbiAgICAgIHRoaXMuc3RhZ2UuYWRkQ2hpbGQodkxpbmUpO1xuICAgICAgdGhpcy5saW5lU3ByaXRlcy5wdXNoKHZMaW5lKTtcbiAgICB9XG4gIH1cblxuICBjcmVhdGVDZWxsU3ByaXRlKHNxdWFyZTogbnVtYmVyKSB7XG4gICAgdGhpcy5yZW1vdmVDZWxsU3ByaXRlKHNxdWFyZSk7IC8vIGFsc28gcmVtb3ZlcyBhcnJvdyBzcHJpdGVcbiAgICBsZXQgY2VsbCA9IG5ldyBQSVhJLkdyYXBoaWNzKCk7XG4gICAgaWYgKHRoaXMuZHJhd2luZ0JhY2t0cmFjZVNxdWFyZXNbc3F1YXJlXSkge1xuICAgICAgY2VsbC5saW5lU3R5bGUoMSwgMHhGRjQwNDAsIDEpOyAvLyBib3JkZXIgYXJvdW5kIGJhY2t0cmFjZSBzcXVhcmVzXG4gICAgfSBlbHNlIHtcbiAgICAgIGNlbGwubGluZVN0eWxlKDAsIDB4MDAwMDAwLCAwKTtcbiAgICB9XG4gICAgaWYgKHRoaXMuZHJhd2luZ0V4aXRTcXVhcmVzW3NxdWFyZV0pIHtcbiAgICAgIGNlbGwuYmVnaW5GaWxsKDB4MjAyMDIwKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY2VsbC5iZWdpbkZpbGwoMHhFMEUwRTApO1xuICAgIH1cbiAgICBsZXQgciA9IHRoaXMucm93KHNxdWFyZSk7XG4gICAgbGV0IGMgPSB0aGlzLmNvbChzcXVhcmUpO1xuICAgIGNlbGwuZHJhd1JlY3QodGhpcy5UTC54ICsgdGhpcy5jZWxsV2lkdGgqKGMgKyAxKSArIDEsXG4gICAgICAgICAgICAgICAgICB0aGlzLlRMLnkgKyB0aGlzLmNlbGxIZWlnaHQqKHIgKyAxKSArIDEsXG4gICAgICAgICAgICAgICAgICB0aGlzLmNlbGxXaWR0aCAtIDIsXG4gICAgICAgICAgICAgICAgICB0aGlzLmNlbGxIZWlnaHQgLSAyKTtcbiAgICBjZWxsLmVuZEZpbGwoKTtcbiAgICB0aGlzLnN0YWdlLmFkZENoaWxkKGNlbGwpO1xuICAgIHRoaXMuY2VsbFNwcml0ZXNbc3F1YXJlXSA9IGNlbGw7XG4gICAgdGhpcy5jcmVhdGVBcnJvd1Nwcml0ZShzcXVhcmUpO1xuICB9XG5cbiAgY3JlYXRlQXJyb3dTcHJpdGUoc3F1YXJlOiBudW1iZXIpIHtcbiAgICBsZXQgciA9IHRoaXMucm93KHNxdWFyZSk7XG4gICAgbGV0IGMgPSB0aGlzLmNvbChzcXVhcmUpO1xuICAgIGxldCB4Q2VudGVyID0gdGhpcy5UTC54ICsgdGhpcy5jZWxsV2lkdGgqKGMgKyAxLjUpO1xuICAgIGxldCB5Q2VudGVyID0gdGhpcy5UTC55ICsgdGhpcy5jZWxsSGVpZ2h0KihyICsgMS41KTtcbiAgICBjb25zdCBrID0gTWF0aC5zcXJ0KDMpLzg7IC8vIHVzZWZ1bCBnZW9tZXRyaWMgY29uc3RhbnRcbiAgICBsZXQgYXJyb3cgPSBuZXcgUElYSS5HcmFwaGljcygpO1xuICAgIGFycm93LmJlZ2luRmlsbCgweDgwODA4MCk7XG4gICAgc3dpdGNoICh0aGlzLmFycm93c1tzcXVhcmVdKSB7XG4gICAgICAgIGNhc2UgRGlyZWN0aW9uLlVwOlxuICAgICAgICAgIGFycm93LmRyYXdQb2x5Z29uKFtcbiAgICAgICAgICAgIHhDZW50ZXIsIHlDZW50ZXIgLSB0aGlzLmNlbGxIZWlnaHQqMC4zNzUsXG4gICAgICAgICAgICB4Q2VudGVyICsgayp0aGlzLmNlbGxXaWR0aCwgeUNlbnRlcixcbiAgICAgICAgICAgIHhDZW50ZXIgLSBrKnRoaXMuY2VsbFdpZHRoLCB5Q2VudGVyXG4gICAgICAgICAgXSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgRGlyZWN0aW9uLkRvd246XG4gICAgICAgICAgYXJyb3cuZHJhd1BvbHlnb24oW1xuICAgICAgICAgICAgeENlbnRlciwgeUNlbnRlciArIHRoaXMuY2VsbEhlaWdodCowLjM3NSxcbiAgICAgICAgICAgIHhDZW50ZXIgLSBrKnRoaXMuY2VsbFdpZHRoLCB5Q2VudGVyLFxuICAgICAgICAgICAgeENlbnRlciArIGsqdGhpcy5jZWxsV2lkdGgsIHlDZW50ZXJcbiAgICAgICAgICBdKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBEaXJlY3Rpb24uTGVmdDpcbiAgICAgICAgICBhcnJvdy5kcmF3UG9seWdvbihbXG4gICAgICAgICAgICB4Q2VudGVyIC0gdGhpcy5jZWxsSGVpZ2h0KjAuMzc1LCB5Q2VudGVyLFxuICAgICAgICAgICAgeENlbnRlciwgeUNlbnRlciAtIGsqdGhpcy5jZWxsSGVpZ2h0LFxuICAgICAgICAgICAgeENlbnRlciwgeUNlbnRlciArIGsqdGhpcy5jZWxsSGVpZ2h0XG4gICAgICAgICAgXSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgRGlyZWN0aW9uLlJpZ2h0OlxuICAgICAgICAgIGFycm93LmRyYXdQb2x5Z29uKFtcbiAgICAgICAgICAgIHhDZW50ZXIgKyB0aGlzLmNlbGxIZWlnaHQqMC4zNzUsIHlDZW50ZXIsXG4gICAgICAgICAgICB4Q2VudGVyLCB5Q2VudGVyICsgayp0aGlzLmNlbGxIZWlnaHQsXG4gICAgICAgICAgICB4Q2VudGVyLCB5Q2VudGVyIC0gayp0aGlzLmNlbGxIZWlnaHRcbiAgICAgICAgICBdKTtcbiAgICAgICAgICBicmVhaztcbiAgICB9XG4gICAgYXJyb3cuZW5kRmlsbCgpO1xuICAgIHRoaXMuc3RhZ2UuYWRkQ2hpbGQoYXJyb3cpO1xuICAgIHRoaXMuYXJyb3dTcHJpdGVzW3NxdWFyZV0gPSBhcnJvdztcbiAgfVxufVxuIiwiLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4uL3R5cGluZ3MvaW5kZXguZC50c1wiIC8+XG4vLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi9ib2FyZC50c1wiIC8+XG5cbmltcG9ydCBQSVhJID0gcmVxdWlyZSgncGl4aS5qcycpO1xuaW1wb3J0IHtCb2FyZH0gZnJvbSAnLi9ib2FyZCc7XG5jb25zdCByZW5kZXJlcjpQSVhJLldlYkdMUmVuZGVyZXIgPSBuZXcgUElYSS5XZWJHTFJlbmRlcmVyKDEyODAsIDcyMCk7XG5kb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHJlbmRlcmVyLnZpZXcpO1xuXG4vLyBZb3UgbmVlZCB0byBjcmVhdGUgYSByb290IGNvbnRhaW5lciB0aGF0IHdpbGwgaG9sZCB0aGUgc2NlbmUgeW91IHdhbnQgdG8gZHJhdy5cbmNvbnN0IHN0YWdlOlBJWEkuQ29udGFpbmVyID0gbmV3IFBJWEkuQ29udGFpbmVyKCk7XG5cbmxldCBwcmVzb2x2ZUJ1dHRvbiA9IG51bGw7XG5sZXQgcHJlc29sdmVCdXR0b25UZXh0ID0gbnVsbDtcbmxldCByZWdlbmVyYXRlQnV0dG9uID0gbnVsbDtcbmxldCByZWdlbmVyYXRlQnV0dG9uVGV4dCA9IG51bGw7XG5sZXQgYm9hcmRTaXplID0gMTE7XG5sZXQgc2l6ZUxhYmVsID0gbnVsbDtcbmxldCBzaXplVGV4dCA9IG51bGw7XG5sZXQgc21hbGxlckJ1dHRvbiA9IG51bGw7XG5sZXQgbGFyZ2VyQnV0dG9uID0gbnVsbDtcblxubGV0IGJvYXJkID0gbnVsbDtcbmdlbmVyYXRlQm9hcmQoKTtcblxuZnVuY3Rpb24gZ2VuZXJhdGVCb2FyZCgpIHtcbiAgaWYgKGJvYXJkICE9PSBudWxsKSB7XG4gICAgYm9hcmQuZGVzdHJveSgpO1xuICB9XG4gIGJvYXJkID0gbmV3IEJvYXJkKGJvYXJkU2l6ZSwgc3RhZ2UpO1xuICBib2FyZC5pbml0Qm9hcmRSZW5kZXIoKTtcbiAgY3JlYXRlVUkoKTtcbiAgcmVuZGVyZXIucmVuZGVyKHN0YWdlKTtcbn1cblxuZnVuY3Rpb24gaW5jcmVtZW50U2l6ZSgpIHtcbiAgYm9hcmRTaXplKys7XG4gIGNyZWF0ZVNpemVVSSgpO1xuICByZW5kZXJlci5yZW5kZXIoc3RhZ2UpO1xufVxuXG5mdW5jdGlvbiBkZWNyZW1lbnRTaXplKCkge1xuICBib2FyZFNpemUtLTtcbiAgY3JlYXRlU2l6ZVVJKCk7XG4gIHJlbmRlcmVyLnJlbmRlcihzdGFnZSk7XG59XG5cbmxldCBwcmVzb2x2ZUFuaW1hdGlvbiA9IG51bGw7IC8vIHRvIHN0b3AgYW5pbWF0aW9uIG9mIHByZXNvbHZpbmdcbmZ1bmN0aW9uIHByZXNvbHZlKCkge1xuICBib2FyZC5wcmVzb2x2ZSgpO1xuICBjcmVhdGVQcmVzb2x2ZUJ1dHRvbigpOyAvLyBjcmVhdGUgdGhlIGRpc2FibGVkIGJ1dHRvblxuICBmdW5jdGlvbiBhbmltYXRlUHJlc29sdXRpb24oKSB7XG4gICAgaWYgKHByZXNvbHZlQW5pbWF0aW9uICE9PSBudWxsICYmIGJvYXJkLmV2ZW50cy5sZW5ndGggPT09IDApIHtcbiAgICAgIGNhbmNlbEFuaW1hdGlvbkZyYW1lKHByZXNvbHZlQW5pbWF0aW9uKTtcbiAgICAgIHByZXNvbHZlQW5pbWF0aW9uID0gbnVsbDtcbiAgICB9IGVsc2Uge1xuICAgICAgcHJlc29sdmVBbmltYXRpb24gPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoYW5pbWF0ZVByZXNvbHV0aW9uKTtcbiAgICB9XG4gICAgYm9hcmQuc3RlcFByZXNvbHV0aW9uQW5pbWF0aW9uKCk7XG4gICAgcmVuZGVyZXIucmVuZGVyKHN0YWdlKTtcbiAgfVxuICBhbmltYXRlUHJlc29sdXRpb24oKTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlVUkoKSB7XG4gIGNyZWF0ZVJlZ2VuZXJhdGVCdXR0b24oKTtcbiAgY3JlYXRlUHJlc29sdmVCdXR0b24oKTtcbiAgY3JlYXRlU2l6ZVVJKCk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVNpemVVSSgpIHtcbiAgaWYgKHNpemVMYWJlbCAhPT0gbnVsbCkge1xuICAgIHN0YWdlLnJlbW92ZUNoaWxkKHNpemVMYWJlbCk7XG4gICAgc2l6ZUxhYmVsID0gbnVsbDtcbiAgfVxuICBpZiAoc2l6ZVRleHQgIT09IG51bGwpIHtcbiAgICBzdGFnZS5yZW1vdmVDaGlsZChzaXplVGV4dCk7XG4gICAgc2l6ZVRleHQgPSBudWxsO1xuICB9XG4gIGlmIChzbWFsbGVyQnV0dG9uICE9PSBudWxsKSB7XG4gICAgc3RhZ2UucmVtb3ZlQ2hpbGQoc21hbGxlckJ1dHRvbik7XG4gICAgc21hbGxlckJ1dHRvbiA9IG51bGw7XG4gIH1cbiAgaWYgKGxhcmdlckJ1dHRvbiAhPT0gbnVsbCkge1xuICAgIHN0YWdlLnJlbW92ZUNoaWxkKGxhcmdlckJ1dHRvbik7XG4gICAgbGFyZ2VyQnV0dG9uID0gbnVsbDtcbiAgfVxuXG4gIGxldCBzdHlsZSA9IG5ldyBQSVhJLlRleHRTdHlsZSh7XG4gICAgZm9udFNpemU6IDI0LFxuICAgIGZpbGw6IDB4RDBEMEQwXG4gIH0pO1xuXG4gIGxldCBsYWJlbCA9IG5ldyBQSVhJLlRleHQoJ1NpemU6ICcsIHN0eWxlKTtcbiAgbGFiZWwueCA9IDcwMDtcbiAgbGFiZWwueSA9IDUwO1xuXG4gIHN0YWdlLmFkZENoaWxkKGxhYmVsKTtcbiAgc2l6ZUxhYmVsID0gbGFiZWw7XG5cbiAgbGV0IGNlbnRlclggPSA3NzI7IC8vIGZvciB1cC9kb3duIGJ1dHRvbnNcblxuICBsZXQgdXBCdXR0b24gPSBuZXcgUElYSS5HcmFwaGljcygpO1xuICB1cEJ1dHRvbi5iZWdpbkZpbGwoMHhEMEQwRDApO1xuICB1cEJ1dHRvbi5kcmF3UG9seWdvbihbXG4gICAgY2VudGVyWCwgNTMsXG4gICAgY2VudGVyWCArIDEwLCA2MyxcbiAgICBjZW50ZXJYIC0gMTAsIDYzXG4gIF0pO1xuICB1cEJ1dHRvbi5lbmRGaWxsKCk7XG5cbiAgdXBCdXR0b24uaW50ZXJhY3RpdmUgPSB0cnVlO1xuICB1cEJ1dHRvbi5vbignbW91c2V1cCcsIGluY3JlbWVudFNpemUpO1xuXG4gIHN0YWdlLmFkZENoaWxkKHVwQnV0dG9uKTtcbiAgbGFyZ2VyQnV0dG9uID0gdXBCdXR0b247XG5cbiAgbGV0IGRvd25CdXR0b24gPSBuZXcgUElYSS5HcmFwaGljcygpO1xuICBpZiAoYm9hcmRTaXplID4gMSkge1xuICAgIGRvd25CdXR0b24uYmVnaW5GaWxsKDB4RDBEMEQwKTtcbiAgfSBlbHNlIHtcbiAgICBkb3duQnV0dG9uLmJlZ2luRmlsbCgweDgwODA4MCk7XG4gIH1cbiAgZG93bkJ1dHRvbi5kcmF3UG9seWdvbihbXG4gICAgY2VudGVyWCwgNzcsXG4gICAgY2VudGVyWCAtIDEwLCA2NyxcbiAgICBjZW50ZXJYICsgMTAsIDY3XG4gIF0pO1xuICBkb3duQnV0dG9uLmVuZEZpbGwoKTtcblxuICBpZiAoYm9hcmRTaXplID4gMSkge1xuICAgIGRvd25CdXR0b24uaW50ZXJhY3RpdmUgPSB0cnVlO1xuICAgIGRvd25CdXR0b24ub24oJ21vdXNldXAnLCBkZWNyZW1lbnRTaXplKTtcbiAgfVxuXG4gIHN0YWdlLmFkZENoaWxkKGRvd25CdXR0b24pO1xuICBzbWFsbGVyQnV0dG9uID0gZG93bkJ1dHRvbjtcblxuICBsZXQgdGV4dCA9IG5ldyBQSVhJLlRleHQoJycgKyBib2FyZFNpemUsIHN0eWxlKTtcbiAgdGV4dC54ID0gY2VudGVyWCArIDE0O1xuICB0ZXh0LnkgPSA1MDtcblxuICBzdGFnZS5hZGRDaGlsZCh0ZXh0KTtcbiAgc2l6ZVRleHQgPSB0ZXh0O1xufVxuXG5mdW5jdGlvbiBjcmVhdGVSZWdlbmVyYXRlQnV0dG9uKCkge1xuICBpZiAocmVnZW5lcmF0ZUJ1dHRvbiAhPT0gbnVsbCkge1xuICAgIHN0YWdlLnJlbW92ZUNoaWxkKHJlZ2VuZXJhdGVCdXR0b24pO1xuICAgIHJlZ2VuZXJhdGVCdXR0b24gPSBudWxsO1xuICB9XG4gIGlmIChyZWdlbmVyYXRlQnV0dG9uVGV4dCAhPT0gbnVsbCkge1xuICAgIHN0YWdlLnJlbW92ZUNoaWxkKHJlZ2VuZXJhdGVCdXR0b25UZXh0KTtcbiAgICByZWdlbmVyYXRlQnV0dG9uVGV4dCA9IG51bGw7XG4gIH1cblxuICBsZXQgYnV0dG9uID0gbmV3IFBJWEkuR3JhcGhpY3MoKTtcbiAgYnV0dG9uLmxpbmVTdHlsZSgyLCAweDgwODBGRiwgMSk7XG4gIGJ1dHRvbi5iZWdpbkZpbGwoMHhEMEQwRDApO1xuICBidXR0b24uZHJhd1JvdW5kZWRSZWN0KDcwMCwgOTAsIDExNSwgMzAsIDcpO1xuICBidXR0b24uZW5kRmlsbCgpO1xuXG4gIGJ1dHRvbi5pbnRlcmFjdGl2ZSA9IHRydWU7XG4gIGJ1dHRvbi5vbignbW91c2V1cCcsIGdlbmVyYXRlQm9hcmQpO1xuXG4gIHN0YWdlLmFkZENoaWxkKGJ1dHRvbik7XG4gIHJlZ2VuZXJhdGVCdXR0b24gPSBidXR0b247XG5cbiAgbGV0IHN0eWxlID0gbmV3IFBJWEkuVGV4dFN0eWxlKHtcbiAgICBmb250U2l6ZTogMjAsXG4gICAgZmlsbDogMHgyMDIwMjBcbiAgfSk7XG5cbiAgbGV0IHRleHQgPSBuZXcgUElYSS5UZXh0KCdSZWdlbmVyYXRlJywgc3R5bGUpO1xuICB0ZXh0LnggPSA3MDY7XG4gIHRleHQueSA9IDkzO1xuXG4gIHN0YWdlLmFkZENoaWxkKHRleHQpO1xuICByZWdlbmVyYXRlQnV0dG9uVGV4dCA9IHRleHQ7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVByZXNvbHZlQnV0dG9uKCkge1xuICBpZiAocHJlc29sdmVCdXR0b24gIT09IG51bGwpIHtcbiAgICBzdGFnZS5yZW1vdmVDaGlsZChwcmVzb2x2ZUJ1dHRvbik7XG4gICAgcHJlc29sdmVCdXR0b24gPSBudWxsO1xuICB9XG4gIGlmIChwcmVzb2x2ZUJ1dHRvblRleHQgIT09IG51bGwpIHtcbiAgICBzdGFnZS5yZW1vdmVDaGlsZChwcmVzb2x2ZUJ1dHRvblRleHQpO1xuICAgIHByZXNvbHZlQnV0dG9uVGV4dCA9IG51bGw7XG4gIH1cblxuICBsZXQgYnV0dG9uID0gbmV3IFBJWEkuR3JhcGhpY3MoKTtcbiAgYnV0dG9uLmxpbmVTdHlsZSgyLCAweDgwODBGRiwgMSk7XG4gIGlmIChib2FyZC5wcmVzb2x2ZWQpIHtcbiAgICBidXR0b24uYmVnaW5GaWxsKDB4ODA4MDgwKTtcbiAgfSBlbHNlIHtcbiAgICBidXR0b24uYmVnaW5GaWxsKDB4RDBEMEQwKTtcbiAgfVxuICBidXR0b24uZHJhd1JvdW5kZWRSZWN0KDcwMCwgMTMwLCAxMTUsIDMwLCA3KTtcbiAgYnV0dG9uLmVuZEZpbGwoKTtcblxuICBpZiAoIWJvYXJkLnByZXNvbHZlZCkge1xuICAgIGJ1dHRvbi5pbnRlcmFjdGl2ZSA9IHRydWU7XG4gICAgYnV0dG9uLm9uKCdtb3VzZXVwJywgcHJlc29sdmUpO1xuICB9XG5cbiAgc3RhZ2UuYWRkQ2hpbGQoYnV0dG9uKTtcbiAgcHJlc29sdmVCdXR0b24gPSBidXR0b247XG5cbiAgbGV0IHN0eWxlID0gbmV3IFBJWEkuVGV4dFN0eWxlKHtcbiAgICBmb250U2l6ZTogMjAsXG4gICAgZmlsbDogMHgyMDIwMjBcbiAgfSk7XG5cbiAgbGV0IHRleHQgPSBuZXcgUElYSS5UZXh0KCdQcmVzb2x2ZScsIHN0eWxlKTtcbiAgdGV4dC54ID0gNzE5O1xuICB0ZXh0LnkgPSAxMzM7XG5cbiAgc3RhZ2UuYWRkQ2hpbGQodGV4dCk7XG4gIHByZXNvbHZlQnV0dG9uVGV4dCA9IHRleHQ7XG59XG5cbi8qLy8gRGVjbGFyZSBhIGdsb2JhbCB2YXJpYWJsZSBmb3Igb3VyIHNwcml0ZSBzbyB0aGF0IHRoZSBhbmltYXRlIGZ1bmN0aW9uIGNhbiBhY2Nlc3MgaXQuXG5sZXQgYnVubnk6UElYSS5TcHJpdGUgPSBudWxsO1xuXG4vLyBsb2FkIHRoZSB0ZXh0dXJlIHdlIG5lZWRcblBJWEkubG9hZGVyLmFkZCgnYnVubnknLCAnaW1hZ2VzL2J1bm55LmpwZWcnKS5sb2FkKGZ1bmN0aW9uIChsb2FkZXI6UElYSS5sb2FkZXJzLkxvYWRlciwgcmVzb3VyY2VzOmFueSkge1xuICAgIC8vIFRoaXMgY3JlYXRlcyBhIHRleHR1cmUgZnJvbSBhICdidW5ueS5wbmcnIGltYWdlLlxuICAgIGJ1bm55ID0gbmV3IFBJWEkuU3ByaXRlKHJlc291cmNlcy5idW5ueS50ZXh0dXJlKTtcblxuICAgIC8vIFNldHVwIHRoZSBwb3NpdGlvbiBhbmQgc2NhbGUgb2YgdGhlIGJ1bm55XG4gICAgYnVubnkucG9zaXRpb24ueCA9IDQwMDtcbiAgICBidW5ueS5wb3NpdGlvbi55ID0gMzAwO1xuXG4gICAgYnVubnkuc2NhbGUueCA9IDI7XG4gICAgYnVubnkuc2NhbGUueSA9IDI7XG5cbiAgICAvLyBBZGQgdGhlIGJ1bm55IHRvIHRoZSBzY2VuZSB3ZSBhcmUgYnVpbGRpbmcuXG4gICAgc3RhZ2UuYWRkQ2hpbGQoYnVubnkpO1xuXG4gICAgLy8ga2ljayBvZmYgdGhlIGFuaW1hdGlvbiBsb29wIChkZWZpbmVkIGJlbG93KVxuICAgIGFuaW1hdGUoKTtcbn0pO1xuXG5mdW5jdGlvbiBhbmltYXRlKCkge1xuICAgIC8vIHN0YXJ0IHRoZSB0aW1lciBmb3IgdGhlIG5leHQgYW5pbWF0aW9uIGxvb3BcbiAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoYW5pbWF0ZSk7XG5cbiAgICAvLyBlYWNoIGZyYW1lIHdlIHNwaW4gdGhlIGJ1bm55IGFyb3VuZCBhIGJpdFxuICAgIGJ1bm55LnJvdGF0aW9uICs9IDAuMDE7XG5cbiAgICAvLyB0aGlzIGlzIHRoZSBtYWluIHJlbmRlciBjYWxsIHRoYXQgbWFrZXMgcGl4aSBkcmF3IHlvdXIgY29udGFpbmVyIGFuZCBpdHMgY2hpbGRyZW4uXG4gICAgcmVuZGVyZXIucmVuZGVyKHN0YWdlKTtcbn0qL1xuIl19

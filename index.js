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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvYm9hcmQudHMiLCJzcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQSw4Q0FBOEM7OztBQUU5QyxJQUFLLFNBS0o7QUFMRCxXQUFLLFNBQVM7SUFDWixxQ0FBTSxDQUFBO0lBQ04seUNBQUksQ0FBQTtJQUNKLHlDQUFJLENBQUE7SUFDSiwyQ0FBSyxDQUFBO0FBQ1AsQ0FBQyxFQUxJLFNBQVMsS0FBVCxTQUFTLFFBS2I7QUFFRCxNQUFNLFVBQVUsR0FBRyxDQUFDLFNBQVMsQ0FBQyxFQUFFLEVBQUUsU0FBUyxDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsSUFBSSxFQUFFLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUVuRjtJQTRCRSxZQUFZLElBQVksRUFBRSxLQUFxQjtRQUM3QyxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztRQUNqQixJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztRQUNuQixJQUFJLENBQUMsTUFBTSxHQUFHLEVBQUUsQ0FBQztRQUNqQixJQUFJLENBQUMsV0FBVyxHQUFHLEVBQUUsQ0FBQztRQUN0QixJQUFJLENBQUMsTUFBTSxHQUFHLEVBQUUsQ0FBQztRQUNqQixJQUFJLENBQUMsWUFBWSxHQUFHLEVBQUUsQ0FBQztRQUN2QixJQUFJLENBQUMsU0FBUyxHQUFHLEtBQUssQ0FBQztRQUN2QixJQUFJLENBQUMsbUJBQW1CLEdBQUcsQ0FBQyxDQUFDO1FBQzdCLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxDQUFDLENBQUM7UUFDMUIsSUFBSSxDQUFDLGVBQWUsR0FBRyxJQUFJLEdBQUcsSUFBSSxDQUFDO1FBQ25DLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxDQUFDLENBQUM7UUFDNUIsSUFBSSxDQUFDLEVBQUUsR0FBRyxFQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBQyxDQUFDO1FB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LE1BQU0sQ0FBQztJQUV4QixJQUFJLEtBQUssR0FBRyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUM7UUFDN0IsUUFBUSxFQUFFLEVBQUU7UUFDWixJQUFJLEVBQUUsUUFBUTtLQUNmLENBQUMsQ0FBQztJQUVILElBQUksSUFBSSxHQUFHLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDNUMsSUFBSSxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUM7SUFDYixJQUFJLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQztJQUViLEtBQUssQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDckIsa0JBQWtCLEdBQUcsSUFBSSxDQUFDO0FBQzVCLENBQUM7QUFFRDs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQStCRyIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvLy8gPHJlZmVyZW5jZSBwYXRoPVwiLi4vdHlwaW5ncy9pbmRleC5kLnRzXCIgLz5cblxuZW51bSBEaXJlY3Rpb24ge1xuICBVcCA9IDAsXG4gIERvd24sXG4gIExlZnQsXG4gIFJpZ2h0XG59XG5cbmNvbnN0IGRpcmVjdGlvbnMgPSBbRGlyZWN0aW9uLlVwLCBEaXJlY3Rpb24uRG93biwgRGlyZWN0aW9uLkxlZnQsIERpcmVjdGlvbi5SaWdodF07XG5cbmV4cG9ydCBjbGFzcyBCb2FyZCB7XG4gIHNpemU6IG51bWJlcjtcbiAgYXJyb3dzOiBEaXJlY3Rpb25bXTtcbiAgZXhpdFNxdWFyZXM6IGJvb2xlYW5bXTtcbiAgcHJlc29sdmVkOiBib29sZWFuO1xuICBub25FeGl0U3F1YXJlQ291bnQ6IG51bWJlcjtcbiAgbG9uZ2VzdEV4aXRQYXRoTGVuZ3RoOiBudW1iZXI7XG4gIC8vIGRyYXdpbmdcbiAgc3RhZ2U6IFBJWEkuQ29udGFpbmVyO1xuICBldmVudHM6IGFueVtdW107IC8vIHJlY29yZCBzdGVwcyB0byByZW5kZXIgbGF0ZXJcbiAgY3VycmVudEV2ZW50OiBhbnlbXTtcbiAgZnJhbWVzQmV0d2VlbkV2ZW50czogbnVtYmVyO1xuICBjdXJyZW50UmVzdEZyYW1lOiBudW1iZXI7XG4gIGRyYXdpbmdFeGl0U3F1YXJlczogYm9vbGVhbltdO1xuICBkcmF3aW5nTm9uRXhpdHM6IG51bWJlcjtcbiAgbm9uRXhpdHNUZXh0OiBQSVhJLlRleHQ7XG4gIGRyYXdpbmdCYWNrdHJhY2VTcXVhcmVzOiBib29sZWFuW107XG4gIGRyYXdpbmdMb25nZXN0UGF0aDogbnVtYmVyO1xuICBsb25nZXN0UGF0aFRleHQ6IFBJWEkuVGV4dDtcbiAgVEw6IHt4OiBudW1iZXIsIHk6IG51bWJlcn07IC8vIHRvcCBsZWZ0IGNvcm5lciAodGhlcmUgd2lsbCBiZSBhIDEtc3F1YXJlIGJ1ZmZlciBhcm91bmQgdGhlIHdob2xlIHRoaW5nKVxuICBjZWxsV2lkdGg6IG51bWJlcjtcbiAgY2VsbEhlaWdodDogbnVtYmVyO1xuICB3OiBudW1iZXI7IC8vIHdpZHRoXG4gIGg6IG51bWJlcjsgLy8gaGVpZ2h0XG4gIGxpbmVTcHJpdGVzOiBQSVhJLkdyYXBoaWNzW107IC8vIHNvIHdlIGNhbiByZW1vdmUgdGhlbSBsYXRlclxuICBjZWxsU3ByaXRlczogUElYSS5HcmFwaGljc1tdOyAvLyBhcnJheSBieSBzcXVhcmUgaW5kZXg7IHRoaW5ncyBpbiBpdCBhcmUgbnVsbCB1bnRpbCBwb3B1bGF0ZWRcbiAgYXJyb3dTcHJpdGVzOiBQSVhJLkdyYXBoaWNzW107IC8vIGFsc28gYnkgc3F1YXJlIGluZGV4O1xuXG4gIGNvbnN0cnVjdG9yKHNpemU6IG51bWJlciwgc3RhZ2U6IFBJWEkuQ29udGFpbmVyKSB7XG4gICAgdGhpcy5zaXplID0gc2l6ZTtcbiAgICB0aGlzLnN0YWdlID0gc3RhZ2U7XG4gICAgdGhpcy5hcnJvd3MgPSBbXTtcbiAgICB0aGlzLmV4aXRTcXVhcmVzID0gW107XG4gICAgdGhpcy5ldmVudHMgPSBbXTtcbiAgICB0aGlzLmN1cnJlbnRFdmVudCA9IFtdO1xuICAgIHRoaXMucHJlc29sdmVkID0gZmFsc2U7XG4gICAgdGhpcy5mcmFtZXNCZXR3ZWVuRXZlbnRzID0gNztcbiAgICB0aGlzLmN1cnJlbnRSZXN0RnJhbWUgPSAwO1xuICAgIHRoaXMuZHJhd2luZ05vbkV4aXRzID0gc2l6ZSAqIHNpemU7XG4gICAgdGhpcy5kcmF3aW5nTG9uZ2VzdFBhdGggPSAwO1xuICAgIHRoaXMuVEwgPSB7eDogNTAsIHk6IDEwMH07XG4gICAgdGhpcy53ID0gNjAwO1xuICAgIHRoaXMuaCA9IDYwMDtcbiAgICB0aGlzLmNlbGxXaWR0aCA9IHRoaXMudy8oc2l6ZSArIDIpO1xuICAgIHRoaXMuY2VsbEhlaWdodCA9IHRoaXMuaC8oc2l6ZSArIDIpO1xuICAgIHRoaXMuZHJhd2luZ0V4aXRTcXVhcmVzID0gW107XG4gICAgdGhpcy5kcmF3aW5nQmFja3RyYWNlU3F1YXJlcyA9IFtdO1xuICAgIHRoaXMubGluZVNwcml0ZXMgPSBbXTtcbiAgICB0aGlzLmNlbGxTcHJpdGVzID0gW107XG4gICAgdGhpcy5hcnJvd1Nwcml0ZXMgPSBbXTtcbiAgICB0aGlzLm5vbkV4aXRzVGV4dCA9IG51bGw7XG4gICAgdGhpcy5sb25nZXN0UGF0aFRleHQgPSBudWxsO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc2l6ZSAqIHNpemU7IGkrKykge1xuICAgICAgdGhpcy5hcnJvd3NbaV0gPSBkaXJlY3Rpb25zW01hdGguZmxvb3IoTWF0aC5yYW5kb20oKSo0KV07IC8vIGdlbmVyYXRlIGJvYXJkXG4gICAgICB0aGlzLmV4aXRTcXVhcmVzW2ldID0gZmFsc2U7IC8vIGluaXRpYWxpemUgZXhpdFNxdWFyZXNcbiAgICAgIHRoaXMuZHJhd2luZ0V4aXRTcXVhcmVzW2ldID0gZmFsc2U7XG4gICAgICB0aGlzLmRyYXdpbmdCYWNrdHJhY2VTcXVhcmVzW2ldID0gZmFsc2U7XG4gICAgICB0aGlzLmNlbGxTcHJpdGVzW2ldID0gbnVsbDtcbiAgICAgIHRoaXMuYXJyb3dTcHJpdGVzW2ldID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICByb3coc3F1YXJlOiBudW1iZXIpIHsgLy8gYmFzaWMgb3BlcmF0aW9uIHRvIGdldCByb3cgZnJvbSBzcXVhcmUgbnVtYmVyXG4gICAgcmV0dXJuIE1hdGguZmxvb3Ioc3F1YXJlL3RoaXMuc2l6ZSk7XG4gIH1cblxuICBjb2woc3F1YXJlOiBudW1iZXIpIHsgLy8gZ2V0IGNvbHVtblxuICAgIHJldHVybiBzcXVhcmUgJSB0aGlzLnNpemU7XG4gIH1cblxuICBzcXVhcmUocm93OiBudW1iZXIsIGNvbDogbnVtYmVyKSB7IC8vIGdldCBzcXVhcmUgZnJvbSByb3cgYW5kIGNvbHVtblxuICAgIHJldHVybiB0aGlzLnNpemUqcm93ICsgY29sO1xuICB9XG5cbiAgdXAoc3F1YXJlOiBudW1iZXIpIHsgLy8gZ28gdXAgYSBzcXVhcmUgKDAgaXMgdXBwZXIgbGVmdCwgZ29pbmcgYWNyb3NzIHRoZW4gZG93bilcbiAgICBpZiAodGhpcy5yb3coc3F1YXJlKSA9PT0gMCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBzcXVhcmUgLSB0aGlzLnNpemU7XG4gICAgfVxuICB9XG5cbiAgZG93bihzcXVhcmU6IG51bWJlcikgeyAvLyBkb3duIGEgc3F1YXJlXG4gICAgaWYgKHRoaXMucm93KHNxdWFyZSkgPT09IHRoaXMuc2l6ZSAtIDEpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gc3F1YXJlICsgdGhpcy5zaXplO1xuICAgIH1cbiAgfVxuXG4gIGxlZnQoc3F1YXJlOiBudW1iZXIpIHsgLy8gbGVmdCBhIHNxdWFyZVxuICAgIGlmICh0aGlzLmNvbChzcXVhcmUpID09PSAwKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHNxdWFyZSAtIDE7XG4gICAgfVxuICB9XG5cbiAgcmlnaHQoc3F1YXJlOiBudW1iZXIpIHsgLy8gcmlnaHQgYSBzcXVhcmVcbiAgICBpZiAodGhpcy5jb2woc3F1YXJlKSA9PT0gdGhpcy5zaXplIC0gMSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBzcXVhcmUgKyAxO1xuICAgIH1cbiAgfVxuXG4gIG5leHQoc3F1YXJlOiBudW1iZXIpIHsgLy8gZm9sbG93IHRoZSBhcnJvd1xuICAgIHN3aXRjaCAodGhpcy5hcnJvd3Nbc3F1YXJlXSkge1xuICAgICAgY2FzZSBEaXJlY3Rpb24uVXA6XG4gICAgICAgIHJldHVybiB0aGlzLnVwKHNxdWFyZSk7XG4gICAgICBjYXNlIERpcmVjdGlvbi5Eb3duOlxuICAgICAgICByZXR1cm4gdGhpcy5kb3duKHNxdWFyZSk7XG4gICAgICBjYXNlIERpcmVjdGlvbi5MZWZ0OlxuICAgICAgICByZXR1cm4gdGhpcy5sZWZ0KHNxdWFyZSk7XG4gICAgICBjYXNlIERpcmVjdGlvbi5SaWdodDpcbiAgICAgICAgcmV0dXJuIHRoaXMucmlnaHQoc3F1YXJlKTtcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiBudWxsOyAvLyBzaG91bGQgbmV2ZXIgaGFwcGVuXG4gICAgfVxuICB9XG5cbiAgcmVjb3JkKGV2ZW50OiBPYmplY3QpIHsgLy8gcmVjb3JkIGFuIGV2ZW50IGluIHRoaXMgcmVuZGVyIHN0ZXBcbiAgICB0aGlzLmN1cnJlbnRFdmVudC5wdXNoKGV2ZW50KTtcbiAgfVxuXG4gIG5leHRFdmVudCgpIHsgLy8gbWFrZSB0aGUgbmV4dCByZW5kZXIgc3RlcFxuICAgIHRoaXMuZXZlbnRzLnB1c2godGhpcy5jdXJyZW50RXZlbnQpO1xuICAgIHRoaXMuY3VycmVudEV2ZW50ID0gW107XG4gIH1cblxuICAvLyBIZXJlIHdlJ3JlIGdvaW5nIHRvIGNvbXB1dGUgd2hpY2ggc3F1YXJlcyBsZWFkIG91dC5cbiAgLy8gV2UncmUgb25seSBnb2luZyB0byBwcmVzb2x2ZSBvbmUgd2F5LCBidXQgd2UnbGwga2VlcFxuICAvLyB0cmFjayBvZiBpdCBpbiBkaWZmZXJlbnQgd2F5cy4gIFRoZXJlIGFyZSB0d28gYWxnb3JpdGhtc1xuICAvLyB0aGF0IHdlJ2xsIHVzZSBhdCB0aGUgc2FtZSB0aW1lLCBhbmQgdGhlIHZpc3VhbGl6YXRpb25cbiAgLy8gd2lsbCBjaG9vc2UganVzdCBvbmUgdG8gYWN0dWFsbHkgZGlzcGxheS5cbiAgLy9cbiAgLy8gSGVyZSdzIGhvdyB0aGlzIHdpbGwgd29yay4gIEZvciB0aGUgZmlyc3QgYWxnb3JpdGhtLCB3ZSdyZSBnb2luZyB0b1xuICAvLyBwcmVzb2x2ZSB0aGUgYm9hcmQgZW50aXJlbHksIHdoaWNoIHdpbGwgdGFrZSBPKG5eMikgaW4gdGhlIHdvcnN0IGNhc2VcbiAgLy8gYW5kIE8obikgaW4gdGhlIGJlc3QsIHdpdGggYSBzdG9yYWdlIGNvc3Qgb2YgTyhuXjIpLiAgSG93ZXZlciwgdGhpc1xuICAvLyBjb3N0IGlzIGVudGlyZWx5IHVwIGZyb250LCBzbyB3aGVuIHdlIHB1dCBhIGNoZWNrZXIgb24gYSByYW5kb20gc3F1YXJlLFxuICAvLyB3ZSB3aWxsIGtub3cgd2hldGhlciBpdCB3aWxsIGV4aXQgaW4gTygxKS5cbiAgLy8gRm9yIHRoZSBzZWNvbmQgYWxnb3JpdGhtLCB3ZSdyZSBnb2luZyB0byBrZWVwIHRyYWNrIG9mIHRoZSBsb25nZXN0XG4gIC8vIHBhdGggbGVhZGluZyBvdXQsIGFzIHdlbGwgYXMgdGhlIG51bWJlciBvZiBzcXVhcmVzIGxlYWRpbmcgb3V0IGluXG4gIC8vIGdlbmVyYWwuICBUaGlzIHdpbGwgdGFrZSBPKG5eMikgYnV0IHdpbGwgaGF2ZSBPKDEpIHN0b3JhZ2UuICBXaGVuIHdlIHB1dFxuICAvLyBhIGNoZWNrZXIgb24gYSByYW5kb20gc3F1YXJlLCB3ZSdsbCB0aGVyZWZvcmUgaGF2ZSBhbiB1cHBlciBsaW1pdCBvblxuICAvLyB0aGUgbnVtYmVyIG9mIHN0ZXBzIGl0IGNhbiB0YWtlIGJlZm9yZSBsb29waW5nLCBzbyB3ZSBjYW4ganVzdCBrZWVwXG4gIC8vIHN0ZXBwaW5nIGl0IGFuZCBjb3VudGluZyB1bnRpbCBlaXRoZXIgdGhlIGNoZWNrZXIgZXhpdHMgb3Igd2Uga25vd1xuICAvLyB3ZSd2ZSBnb25lIGxvbmcgZW5vdWdoIHRvIGJlIGluIGEgbG9vcC4gIFRoaXMgd2lsbCB0YWtlIE8obl4yKSBzdGVwcyBpblxuICAvLyB0aGUgd29yc3QgY2FzZS5cbiAgLy9cbiAgLy8gVGhlIGFjdHVhbCBwcmVzb2x2aW5nIGFsZ29yaXRobSBpcyBhcyBmb2xsb3dzOiB3ZSBnbyBhcm91bmQgdGhlIGVkZ2Ugb2ZcbiAgLy8gdGhlIGJvYXJkLCBsb29raW5nIGZvciBhcnJvd3MgcG9pbnRpbmcgb3V0LiAgV2hlbiB3ZSBmaW5kIG9uZSwgd2Ugc2ltcGx5XG4gIC8vIGZvbGxvdyB0aGUgcGF0aCBiYWNrd2FyZHMsIGVpdGhlciBtYXJraW5nIHNxdWFyZXMgb3IgY291bnRpbmcgdGhlbSAod2VsbCxcbiAgLy8gYWN0dWFsbHksIHdlJ2xsIGRvIGJvdGgsIGJ1dCB3ZSdsbCBvbmx5IHZpc3VhbGl6ZSBvbmUgYXQgYSB0aW1lKS5cbiAgcHJlc29sdmUoKSB7XG4gICAgbGV0IHNlbGYgPSB0aGlzO1xuICAgIGlmICh0aGlzLnByZXNvbHZlZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBsZXQgbG9uZ2VzdFBhdGggPSAwO1xuICAgIGxldCBleGl0cyA9IDA7IC8vIGNvdW50IG9mIGV4aXQgc3F1YXJlc1xuICAgIC8vIHdlIGNhbid0IGp1c3QgY291bnQgdGhlIHRydWUgdmFsdWVzIGluIGV4aXRTcXVhcmVzIGJlY2F1c2UgdGhhdCB3b3VsZFxuICAgIC8vIHZpb2xhdGUgb3VyIE8oMSkgc3RvcmFnZSByZXF1aXJlbWVudFxuXG4gICAgLy8gcmV0dXJucyBwYXRoIGxlbmd0aFxuICAgIGZ1bmN0aW9uIGJhY2t0cmFjZVBhdGgoc3F1YXJlOiBudW1iZXIpIHtcbiAgICAgIGxldCBwYXRoTGVuZ3RocyA9IFswLCAwLCAwLCAwXVxuICAgICAgbGV0IG5laWdoYm9ycyA9IFtzZWxmLnVwKHNxdWFyZSksIHNlbGYuZG93bihzcXVhcmUpLCBzZWxmLmxlZnQoc3F1YXJlKSwgc2VsZi5yaWdodChzcXVhcmUpXTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbmVpZ2hib3JzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChuZWlnaGJvcnNbaV0gIT09IG51bGwgJiYgc2VsZi5uZXh0KG5laWdoYm9yc1tpXSkgPT09IHNxdWFyZSkge1xuICAgICAgICAgIGV4aXRzKys7XG4gICAgICAgICAgc2VsZi5leGl0U3F1YXJlc1tuZWlnaGJvcnNbaV1dID0gdHJ1ZTtcbiAgICAgICAgICBzZWxmLnJlY29yZCh7XG4gICAgICAgICAgICBldmVudDogXCJ1cGRhdGVOb25FeGl0c1wiLFxuICAgICAgICAgICAgdmFsdWU6IHNlbGYuc2l6ZSAqIHNlbGYuc2l6ZSAtIGV4aXRzXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgc2VsZi5yZWNvcmQoe1xuICAgICAgICAgICAgZXZlbnQ6IFwiYWRkRXhpdFNxdWFyZVwiLFxuICAgICAgICAgICAgc3F1YXJlOiBuZWlnaGJvcnNbaV1cbiAgICAgICAgICB9KTtcbiAgICAgICAgICBzZWxmLnJlY29yZCh7XG4gICAgICAgICAgICBldmVudDogXCJhZGRCYWNrdHJhY2VTcXVhcmVcIixcbiAgICAgICAgICAgIHNxdWFyZTogc3F1YXJlXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgc2VsZi5uZXh0RXZlbnQoKTtcbiAgICAgICAgICBwYXRoTGVuZ3Roc1tpXSA9IGJhY2t0cmFjZVBhdGgobmVpZ2hib3JzW2ldKTtcbiAgICAgICAgICBzZWxmLnJlY29yZCh7XG4gICAgICAgICAgICBldmVudDogXCJyZW1vdmVCYWNrdHJhY2VTcXVhcmVcIixcbiAgICAgICAgICAgIHNxdWFyZTogc3F1YXJlXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgc2VsZi5uZXh0RXZlbnQoKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIDEgKyBNYXRoLm1heCguLi5wYXRoTGVuZ3Rocyk7XG4gICAgfVxuXG4gICAgLy8gV2UncmUgZ29pbmcgdG8gZG8gYWxsIGZvdXIgc2lkZXMgYXQgb25jZS5cbiAgICAvLyBUaGlzIHdpbGwgdGFrZSBPKG4pIGNoZWNrcyBpbnN0ZWFkIG9mIE8obl4yKSwgc28gZXZlbiB0aG91Z2ggaXQnc1xuICAgIC8vIGEgYml0IG1lc3NpZXIgdG8gY29kZSwgaXQncyBhIHBvdGVudGlhbGx5IHZlcnkgbGFyZ2UgaW1wcm92ZW1lbnRcbiAgICAvLyBpbiBjYXNlcyB3ZSdsbCBsaWtlbHkgbmV2ZXIgYWN0dWFsbHkgaGl0LiAgQnV0IGl0J3MgdGhlIHByaW5jaXBsZVxuICAgIC8vIG9mIHRoZSB0aGluZy4gIElmIHdlIHdhbnRlZCB0byBqdXN0IGNoZWNrIHRoZSBlbnRpcmUgZ3JpZCBmb3IgZXhpdFxuICAgIC8vIHBvaW50cywgd2UnZCBqdXN0IGNoZWNrIGlmIHRoaXMubmV4dCBpcyBudWxsIGZvciBlYWNoIHNxdWFyZS5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuc2l6ZSAtIDE7IGkrKykge1xuICAgICAgbGV0IHRhcmdldFNxdWFyZXMgPSBbXG4gICAgICAgIHRoaXMuc3F1YXJlKDAsIGkpLCAvLyBhbG9uZyB0b3BcbiAgICAgICAgdGhpcy5zcXVhcmUoaSwgdGhpcy5zaXplIC0gMSksIC8vIGFsb25nIHJpZ2h0XG4gICAgICAgIHRoaXMuc3F1YXJlKHRoaXMuc2l6ZSAtIDEsIHRoaXMuc2l6ZSAtIDEgLSBpKSwgLy8gYWxvbmcgYm90dG9tXG4gICAgICAgIHRoaXMuc3F1YXJlKHRoaXMuc2l6ZSAtIDEgLSBpLCAwKSAvLyBhbG9uZyBsZWZ0XG4gICAgICBdO1xuICAgICAgZm9yIChsZXQgaiA9IDA7IGogPCA0OyBqKyspIHtcbiAgICAgICAgaWYgKHRoaXMubmV4dCh0YXJnZXRTcXVhcmVzW2pdKSA9PT0gbnVsbCkge1xuICAgICAgICAgIGV4aXRzKys7XG4gICAgICAgICAgdGhpcy5leGl0U3F1YXJlc1t0YXJnZXRTcXVhcmVzW2pdXSA9IHRydWU7XG4gICAgICAgICAgdGhpcy5yZWNvcmQoe1xuICAgICAgICAgICAgZXZlbnQ6IFwidXBkYXRlTm9uRXhpdHNcIixcbiAgICAgICAgICAgIHZhbHVlOiB0aGlzLnNpemUgKiB0aGlzLnNpemUgLSBleGl0c1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIHRoaXMucmVjb3JkKHtcbiAgICAgICAgICAgIGV2ZW50OiBcImFkZEV4aXRTcXVhcmVcIixcbiAgICAgICAgICAgIHNxdWFyZTogdGFyZ2V0U3F1YXJlc1tqXVxuICAgICAgICAgIH0pO1xuICAgICAgICAgIHRoaXMucmVjb3JkKHtcbiAgICAgICAgICAgIGV2ZW50OiBcImFkZEJhY2t0cmFjZVNxdWFyZVwiLFxuICAgICAgICAgICAgc3F1YXJlOiB0YXJnZXRTcXVhcmVzW2pdXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgdGhpcy5uZXh0RXZlbnQoKTtcbiAgICAgICAgICBsZXQgcGF0aExlbmd0aCA9IGJhY2t0cmFjZVBhdGgodGFyZ2V0U3F1YXJlc1tqXSk7XG4gICAgICAgICAgdGhpcy5yZWNvcmQoe1xuICAgICAgICAgICAgZXZlbnQ6IFwicmVtb3ZlQmFja3RyYWNlU3F1YXJlXCIsXG4gICAgICAgICAgICBzcXVhcmU6IHRhcmdldFNxdWFyZXNbal1cbiAgICAgICAgICB9KTtcbiAgICAgICAgICBpZiAocGF0aExlbmd0aCA+IGxvbmdlc3RQYXRoKSB7XG4gICAgICAgICAgICBsb25nZXN0UGF0aCA9IHBhdGhMZW5ndGg7XG4gICAgICAgICAgICB0aGlzLnJlY29yZCh7XG4gICAgICAgICAgICAgIGV2ZW50OiBcInVwZGF0ZUxvbmdlc3RQYXRoXCIsXG4gICAgICAgICAgICAgIHZhbHVlOiBsb25nZXN0UGF0aFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMubmV4dEV2ZW50KCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLmxvbmdlc3RFeGl0UGF0aExlbmd0aCA9IGxvbmdlc3RQYXRoO1xuICAgIHRoaXMubm9uRXhpdFNxdWFyZUNvdW50ID0gdGhpcy5zaXplKnRoaXMuc2l6ZSAtIGV4aXRzO1xuICAgIHRoaXMucHJlc29sdmVkID0gdHJ1ZTtcbiAgfVxuXG4gIHByb2Nlc3NSZW5kZXJFdmVudChldmVudDogYW55KSB7XG4gICAgc3dpdGNoIChldmVudC5ldmVudCkge1xuICAgICAgY2FzZSBcInVwZGF0ZU5vbkV4aXRzXCI6XG4gICAgICAgIHRoaXMuZHJhd2luZ05vbkV4aXRzID0gZXZlbnQudmFsdWU7XG4gICAgICAgIHRoaXMuY3JlYXRlU3RhdHNUZXh0KCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBcInVwZGF0ZUxvbmdlc3RQYXRoXCI6XG4gICAgICAgIHRoaXMuZHJhd2luZ0xvbmdlc3RQYXRoID0gZXZlbnQudmFsdWU7XG4gICAgICAgIHRoaXMuY3JlYXRlU3RhdHNUZXh0KCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBcImFkZEV4aXRTcXVhcmVcIjpcbiAgICAgICAgdGhpcy5kcmF3aW5nRXhpdFNxdWFyZXNbZXZlbnQuc3F1YXJlXSA9IHRydWU7XG4gICAgICAgIHRoaXMuY3JlYXRlQ2VsbFNwcml0ZShldmVudC5zcXVhcmUpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgXCJhZGRCYWNrdHJhY2VTcXVhcmVcIjpcbiAgICAgICAgdGhpcy5kcmF3aW5nQmFja3RyYWNlU3F1YXJlc1tldmVudC5zcXVhcmVdID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5jcmVhdGVDZWxsU3ByaXRlKGV2ZW50LnNxdWFyZSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBcInJlbW92ZUJhY2t0cmFjZVNxdWFyZVwiOlxuICAgICAgICB0aGlzLmRyYXdpbmdCYWNrdHJhY2VTcXVhcmVzW2V2ZW50LnNxdWFyZV0gPSBmYWxzZTtcbiAgICAgICAgdGhpcy5jcmVhdGVDZWxsU3ByaXRlKGV2ZW50LnNxdWFyZSk7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIHN0ZXBQcmVzb2x1dGlvbkFuaW1hdGlvbigpIHtcbiAgICBpZiAodGhpcy5ldmVudHMubGVuZ3RoID4gMCAmJiB0aGlzLmN1cnJlbnRSZXN0RnJhbWUgPD0gMCkge1xuICAgICAgbGV0IHJlbmRlckV2ZW50cyA9IHRoaXMuZXZlbnRzLnNoaWZ0KCk7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHJlbmRlckV2ZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICB0aGlzLnByb2Nlc3NSZW5kZXJFdmVudChyZW5kZXJFdmVudHNbaV0pO1xuICAgICAgfVxuICAgICAgdGhpcy5jdXJyZW50UmVzdEZyYW1lICs9IHRoaXMuZnJhbWVzQmV0d2VlbkV2ZW50cztcbiAgICB9IGVsc2UgaWYgKHRoaXMuY3VycmVudFJlc3RGcmFtZSA+IDApIHtcbiAgICAgIHRoaXMuY3VycmVudFJlc3RGcmFtZS0tO1xuICAgIH1cbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5jbGVhckJvYXJkU3ByaXRlcygpO1xuICAgIHRoaXMuY2xlYXJTdGF0c1RleHQoKTtcbiAgfVxuXG4gIGluaXRCb2FyZFJlbmRlcigpIHtcbiAgICB0aGlzLmNsZWFyQm9hcmRTcHJpdGVzKCk7XG4gICAgdGhpcy5jcmVhdGVCb2FyZFNwcml0ZXMoKTtcbiAgICB0aGlzLmNyZWF0ZVN0YXRzVGV4dCgpO1xuICB9XG5cbiAgY2xlYXJTdGF0c1RleHQoKSB7XG4gICAgdGhpcy5jbGVhck5vbkV4aXRzVGV4dCgpO1xuICAgIHRoaXMuY2xlYXJMb25nZXN0UGF0aFRleHQoKTtcbiAgfVxuXG4gIGNsZWFyTm9uRXhpdHNUZXh0KCkge1xuICAgIGlmICh0aGlzLm5vbkV4aXRzVGV4dCAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5zdGFnZS5yZW1vdmVDaGlsZCh0aGlzLm5vbkV4aXRzVGV4dCk7XG4gICAgICB0aGlzLm5vbkV4aXRzVGV4dCA9IG51bGw7XG4gICAgfVxuICB9XG5cbiAgY2xlYXJMb25nZXN0UGF0aFRleHQoKSB7XG4gICAgaWYgKHRoaXMubG9uZ2VzdFBhdGhUZXh0ICE9PSBudWxsKSB7XG4gICAgICB0aGlzLnN0YWdlLnJlbW92ZUNoaWxkKHRoaXMubG9uZ2VzdFBhdGhUZXh0KTtcbiAgICAgIHRoaXMubG9uZ2VzdFBhdGhUZXh0ID0gbnVsbDtcbiAgICB9XG4gIH1cblxuICBjcmVhdGVTdGF0c1RleHQoKSB7XG4gICAgdGhpcy5jbGVhclN0YXRzVGV4dCgpO1xuICAgIGxldCBzdHlsZSA9IG5ldyBQSVhJLlRleHRTdHlsZSh7XG4gICAgICBmb250U2l6ZTogMzAsXG4gICAgICBmaWxsOiAweEQwRDBEMFxuICAgIH0pO1xuXG4gICAgdGhpcy5ub25FeGl0c1RleHQgPSBuZXcgUElYSS5UZXh0KCdOb24tRXhpdCBTcXVhcmVzOiAnICsgdGhpcy5kcmF3aW5nTm9uRXhpdHMsIHN0eWxlKTtcbiAgICB0aGlzLm5vbkV4aXRzVGV4dC54ID0gNTA7XG4gICAgdGhpcy5ub25FeGl0c1RleHQueSA9IDU7XG4gICAgdGhpcy5zdGFnZS5hZGRDaGlsZCh0aGlzLm5vbkV4aXRzVGV4dCk7XG5cbiAgICB0aGlzLmxvbmdlc3RQYXRoVGV4dCA9IG5ldyBQSVhJLlRleHQoJ0xvbmdlc3QgUGF0aCBMZW5ndGg6ICcgKyB0aGlzLmRyYXdpbmdMb25nZXN0UGF0aCwgc3R5bGUpO1xuICAgIHRoaXMubG9uZ2VzdFBhdGhUZXh0LnggPSA1MDtcbiAgICB0aGlzLmxvbmdlc3RQYXRoVGV4dC55ID0gNDU7XG4gICAgdGhpcy5zdGFnZS5hZGRDaGlsZCh0aGlzLmxvbmdlc3RQYXRoVGV4dCk7XG4gIH1cblxuICBjbGVhckJvYXJkU3ByaXRlcygpIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMubGluZVNwcml0ZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHRoaXMuc3RhZ2UucmVtb3ZlQ2hpbGQodGhpcy5saW5lU3ByaXRlc1tpXSk7XG4gICAgfVxuICAgIHRoaXMubGluZVNwcml0ZXMgPSBbXTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuc2l6ZSp0aGlzLnNpemU7IGkrKykge1xuICAgICAgdGhpcy5yZW1vdmVDZWxsU3ByaXRlKGkpOyAvLyBhbHNvIGNsZWFycyBhcnJvdyBzcHJpdGVcbiAgICB9XG4gIH1cblxuICByZW1vdmVDZWxsU3ByaXRlKHNxdWFyZTogbnVtYmVyKSB7XG4gICAgaWYgKHRoaXMuY2VsbFNwcml0ZXNbc3F1YXJlXSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5zdGFnZS5yZW1vdmVDaGlsZCh0aGlzLmNlbGxTcHJpdGVzW3NxdWFyZV0pO1xuICAgIH1cbiAgICB0aGlzLmNlbGxTcHJpdGVzW3NxdWFyZV0gPSBudWxsO1xuICAgIHRoaXMucmVtb3ZlQXJyb3dTcHJpdGUoc3F1YXJlKTtcbiAgfVxuXG4gIHJlbW92ZUFycm93U3ByaXRlKHNxdWFyZTogbnVtYmVyKSB7XG4gICAgaWYgKHRoaXMuYXJyb3dTcHJpdGVzW3NxdWFyZV0gIT09IG51bGwpIHtcbiAgICAgIHRoaXMuc3RhZ2UucmVtb3ZlQ2hpbGQodGhpcy5hcnJvd1Nwcml0ZXNbc3F1YXJlXSk7XG4gICAgfVxuICAgIHRoaXMuYXJyb3dTcHJpdGVzW3NxdWFyZV0gPSBudWxsO1xuICB9XG5cbiAgY3JlYXRlQm9hcmRTcHJpdGVzKCkge1xuICAgIHRoaXMuY2xlYXJCb2FyZFNwcml0ZXMoKTtcbiAgICB0aGlzLmNyZWF0ZUxpbmVTcHJpdGVzKCk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnNpemUqdGhpcy5zaXplOyBpKyspIHtcbiAgICAgIHRoaXMuY3JlYXRlQ2VsbFNwcml0ZShpKTtcbiAgICB9XG4gIH1cblxuICBjcmVhdGVMaW5lU3ByaXRlcygpIHtcbiAgICBmb3IgKGxldCBpID0gMTsgaSA8PSB0aGlzLnNpemUgKyAxOyBpKyspIHtcbiAgICAgIGxldCBoTGluZSA9IG5ldyBQSVhJLkdyYXBoaWNzKCk7XG4gICAgICBoTGluZS5saW5lU3R5bGUoMywgMHg4MDgwRkYsIDEpO1xuICAgICAgaExpbmUubW92ZVRvKHRoaXMuVEwueCArIHRoaXMuY2VsbFdpZHRoIC0gMS41LCB0aGlzLlRMLnkgKyBpKnRoaXMuY2VsbEhlaWdodCk7XG4gICAgICBoTGluZS5saW5lVG8odGhpcy5UTC54ICsgKHRoaXMuc2l6ZSArIDEpKnRoaXMuY2VsbFdpZHRoICsgMS41LCB0aGlzLlRMLnkgKyBpKnRoaXMuY2VsbEhlaWdodCk7XG4gICAgICB0aGlzLnN0YWdlLmFkZENoaWxkKGhMaW5lKTtcbiAgICAgIHRoaXMubGluZVNwcml0ZXMucHVzaChoTGluZSk7XG5cbiAgICAgIGxldCB2TGluZSA9IG5ldyBQSVhJLkdyYXBoaWNzKCk7XG4gICAgICB2TGluZS5saW5lU3R5bGUoMywgMHg4MDgwRkYsIDEpO1xuICAgICAgdkxpbmUubW92ZVRvKHRoaXMuVEwueCArIHRoaXMuY2VsbFdpZHRoKmksIHRoaXMuVEwueSArIHRoaXMuY2VsbEhlaWdodCAtIDEuNSk7XG4gICAgICB2TGluZS5saW5lVG8odGhpcy5UTC54ICsgdGhpcy5jZWxsV2lkdGgqaSwgdGhpcy5UTC55ICsgKHRoaXMuc2l6ZSArIDEpKnRoaXMuY2VsbEhlaWdodCArIDEuNSk7XG4gICAgICB0aGlzLnN0YWdlLmFkZENoaWxkKHZMaW5lKTtcbiAgICAgIHRoaXMubGluZVNwcml0ZXMucHVzaCh2TGluZSk7XG4gICAgfVxuICB9XG5cbiAgY3JlYXRlQ2VsbFNwcml0ZShzcXVhcmU6IG51bWJlcikge1xuICAgIHRoaXMucmVtb3ZlQ2VsbFNwcml0ZShzcXVhcmUpOyAvLyBhbHNvIHJlbW92ZXMgYXJyb3cgc3ByaXRlXG4gICAgbGV0IGNlbGwgPSBuZXcgUElYSS5HcmFwaGljcygpO1xuICAgIGlmICh0aGlzLmRyYXdpbmdCYWNrdHJhY2VTcXVhcmVzW3NxdWFyZV0pIHtcbiAgICAgIGNlbGwubGluZVN0eWxlKDEsIDB4RkY0MDQwLCAxKTsgLy8gYm9yZGVyIGFyb3VuZCBiYWNrdHJhY2Ugc3F1YXJlc1xuICAgIH0gZWxzZSB7XG4gICAgICBjZWxsLmxpbmVTdHlsZSgwLCAweDAwMDAwMCwgMCk7XG4gICAgfVxuICAgIGlmICh0aGlzLmRyYXdpbmdFeGl0U3F1YXJlc1tzcXVhcmVdKSB7XG4gICAgICBjZWxsLmJlZ2luRmlsbCgweDIwMjAyMCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNlbGwuYmVnaW5GaWxsKDB4RTBFMEUwKTtcbiAgICB9XG4gICAgbGV0IHIgPSB0aGlzLnJvdyhzcXVhcmUpO1xuICAgIGxldCBjID0gdGhpcy5jb2woc3F1YXJlKTtcbiAgICBjZWxsLmRyYXdSZWN0KHRoaXMuVEwueCArIHRoaXMuY2VsbFdpZHRoKihjICsgMSkgKyAxLFxuICAgICAgICAgICAgICAgICAgdGhpcy5UTC55ICsgdGhpcy5jZWxsSGVpZ2h0KihyICsgMSkgKyAxLFxuICAgICAgICAgICAgICAgICAgdGhpcy5jZWxsV2lkdGggLSAyLFxuICAgICAgICAgICAgICAgICAgdGhpcy5jZWxsSGVpZ2h0IC0gMik7XG4gICAgY2VsbC5lbmRGaWxsKCk7XG4gICAgdGhpcy5zdGFnZS5hZGRDaGlsZChjZWxsKTtcbiAgICB0aGlzLmNlbGxTcHJpdGVzW3NxdWFyZV0gPSBjZWxsO1xuICAgIHRoaXMuY3JlYXRlQXJyb3dTcHJpdGUoc3F1YXJlKTtcbiAgfVxuXG4gIGNyZWF0ZUFycm93U3ByaXRlKHNxdWFyZTogbnVtYmVyKSB7XG4gICAgbGV0IHIgPSB0aGlzLnJvdyhzcXVhcmUpO1xuICAgIGxldCBjID0gdGhpcy5jb2woc3F1YXJlKTtcbiAgICBsZXQgeENlbnRlciA9IHRoaXMuVEwueCArIHRoaXMuY2VsbFdpZHRoKihjICsgMS41KTtcbiAgICBsZXQgeUNlbnRlciA9IHRoaXMuVEwueSArIHRoaXMuY2VsbEhlaWdodCoociArIDEuNSk7XG4gICAgY29uc3QgayA9IE1hdGguc3FydCgzKS84OyAvLyB1c2VmdWwgZ2VvbWV0cmljIGNvbnN0YW50XG4gICAgbGV0IGFycm93ID0gbmV3IFBJWEkuR3JhcGhpY3MoKTtcbiAgICBhcnJvdy5iZWdpbkZpbGwoMHg4MDgwODApO1xuICAgIHN3aXRjaCAodGhpcy5hcnJvd3Nbc3F1YXJlXSkge1xuICAgICAgICBjYXNlIERpcmVjdGlvbi5VcDpcbiAgICAgICAgICBhcnJvdy5kcmF3UG9seWdvbihbXG4gICAgICAgICAgICB4Q2VudGVyLCB5Q2VudGVyIC0gdGhpcy5jZWxsSGVpZ2h0KjAuMzc1LFxuICAgICAgICAgICAgeENlbnRlciArIGsqdGhpcy5jZWxsV2lkdGgsIHlDZW50ZXIsXG4gICAgICAgICAgICB4Q2VudGVyIC0gayp0aGlzLmNlbGxXaWR0aCwgeUNlbnRlclxuICAgICAgICAgIF0pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIERpcmVjdGlvbi5Eb3duOlxuICAgICAgICAgIGFycm93LmRyYXdQb2x5Z29uKFtcbiAgICAgICAgICAgIHhDZW50ZXIsIHlDZW50ZXIgKyB0aGlzLmNlbGxIZWlnaHQqMC4zNzUsXG4gICAgICAgICAgICB4Q2VudGVyIC0gayp0aGlzLmNlbGxXaWR0aCwgeUNlbnRlcixcbiAgICAgICAgICAgIHhDZW50ZXIgKyBrKnRoaXMuY2VsbFdpZHRoLCB5Q2VudGVyXG4gICAgICAgICAgXSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgRGlyZWN0aW9uLkxlZnQ6XG4gICAgICAgICAgYXJyb3cuZHJhd1BvbHlnb24oW1xuICAgICAgICAgICAgeENlbnRlciAtIHRoaXMuY2VsbEhlaWdodCowLjM3NSwgeUNlbnRlcixcbiAgICAgICAgICAgIHhDZW50ZXIsIHlDZW50ZXIgLSBrKnRoaXMuY2VsbEhlaWdodCxcbiAgICAgICAgICAgIHhDZW50ZXIsIHlDZW50ZXIgKyBrKnRoaXMuY2VsbEhlaWdodFxuICAgICAgICAgIF0pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIERpcmVjdGlvbi5SaWdodDpcbiAgICAgICAgICBhcnJvdy5kcmF3UG9seWdvbihbXG4gICAgICAgICAgICB4Q2VudGVyICsgdGhpcy5jZWxsSGVpZ2h0KjAuMzc1LCB5Q2VudGVyLFxuICAgICAgICAgICAgeENlbnRlciwgeUNlbnRlciArIGsqdGhpcy5jZWxsSGVpZ2h0LFxuICAgICAgICAgICAgeENlbnRlciwgeUNlbnRlciAtIGsqdGhpcy5jZWxsSGVpZ2h0XG4gICAgICAgICAgXSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGFycm93LmVuZEZpbGwoKTtcbiAgICB0aGlzLnN0YWdlLmFkZENoaWxkKGFycm93KTtcbiAgICB0aGlzLmFycm93U3ByaXRlc1tzcXVhcmVdID0gYXJyb3c7XG4gIH1cbn1cbiIsIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuLi90eXBpbmdzL2luZGV4LmQudHNcIiAvPlxuLy8vIDxyZWZlcmVuY2UgcGF0aD1cIi4vYm9hcmQudHNcIiAvPlxuXG5pbXBvcnQgUElYSSA9IHJlcXVpcmUoJ3BpeGkuanMnKTtcbmltcG9ydCB7Qm9hcmR9IGZyb20gJy4vYm9hcmQnO1xuY29uc3QgcmVuZGVyZXI6UElYSS5XZWJHTFJlbmRlcmVyID0gbmV3IFBJWEkuV2ViR0xSZW5kZXJlcigxMjgwLCA3MjApO1xuZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChyZW5kZXJlci52aWV3KTtcblxuLy8gWW91IG5lZWQgdG8gY3JlYXRlIGEgcm9vdCBjb250YWluZXIgdGhhdCB3aWxsIGhvbGQgdGhlIHNjZW5lIHlvdSB3YW50IHRvIGRyYXcuXG5jb25zdCBzdGFnZTpQSVhJLkNvbnRhaW5lciA9IG5ldyBQSVhJLkNvbnRhaW5lcigpO1xuXG5sZXQgcHJlc29sdmVCdXR0b24gPSBudWxsO1xubGV0IHByZXNvbHZlQnV0dG9uVGV4dCA9IG51bGw7XG5sZXQgcmVnZW5lcmF0ZUJ1dHRvbiA9IG51bGw7XG5sZXQgcmVnZW5lcmF0ZUJ1dHRvblRleHQgPSBudWxsO1xubGV0IGJvYXJkU2l6ZSA9IDExO1xubGV0IHNpemVMYWJlbCA9IG51bGw7XG5sZXQgc2l6ZVRleHQgPSBudWxsO1xubGV0IHNtYWxsZXJCdXR0b24gPSBudWxsO1xubGV0IGxhcmdlckJ1dHRvbiA9IG51bGw7XG5cbmxldCBib2FyZCA9IG51bGw7XG5nZW5lcmF0ZUJvYXJkKCk7XG5cbmZ1bmN0aW9uIGdlbmVyYXRlQm9hcmQoKSB7XG4gIGlmIChib2FyZCAhPT0gbnVsbCkge1xuICAgIGJvYXJkLmRlc3Ryb3koKTtcbiAgfVxuICBib2FyZCA9IG5ldyBCb2FyZChib2FyZFNpemUsIHN0YWdlKTtcbiAgYm9hcmQuaW5pdEJvYXJkUmVuZGVyKCk7XG4gIGNyZWF0ZVVJKCk7XG4gIHJlbmRlcmVyLnJlbmRlcihzdGFnZSk7XG59XG5cbmZ1bmN0aW9uIGluY3JlbWVudFNpemUoKSB7XG4gIGJvYXJkU2l6ZSsrO1xuICBjcmVhdGVTaXplVUkoKTtcbiAgcmVuZGVyZXIucmVuZGVyKHN0YWdlKTtcbn1cblxuZnVuY3Rpb24gZGVjcmVtZW50U2l6ZSgpIHtcbiAgYm9hcmRTaXplLS07XG4gIGNyZWF0ZVNpemVVSSgpO1xuICByZW5kZXJlci5yZW5kZXIoc3RhZ2UpO1xufVxuXG5sZXQgcHJlc29sdmVBbmltYXRpb24gPSBudWxsOyAvLyB0byBzdG9wIGFuaW1hdGlvbiBvZiBwcmVzb2x2aW5nXG5mdW5jdGlvbiBwcmVzb2x2ZSgpIHtcbiAgYm9hcmQucHJlc29sdmUoKTtcbiAgY3JlYXRlUHJlc29sdmVCdXR0b24oKTsgLy8gY3JlYXRlIHRoZSBkaXNhYmxlZCBidXR0b25cbiAgZnVuY3Rpb24gYW5pbWF0ZVByZXNvbHV0aW9uKCkge1xuICAgIGlmIChwcmVzb2x2ZUFuaW1hdGlvbiAhPT0gbnVsbCAmJiBib2FyZC5ldmVudHMubGVuZ3RoID09PSAwKSB7XG4gICAgICBjYW5jZWxBbmltYXRpb25GcmFtZShwcmVzb2x2ZUFuaW1hdGlvbik7XG4gICAgICBwcmVzb2x2ZUFuaW1hdGlvbiA9IG51bGw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHByZXNvbHZlQW5pbWF0aW9uID0gcmVxdWVzdEFuaW1hdGlvbkZyYW1lKGFuaW1hdGVQcmVzb2x1dGlvbik7XG4gICAgfVxuICAgIGJvYXJkLnN0ZXBQcmVzb2x1dGlvbkFuaW1hdGlvbigpO1xuICAgIHJlbmRlcmVyLnJlbmRlcihzdGFnZSk7XG4gIH1cbiAgYW5pbWF0ZVByZXNvbHV0aW9uKCk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVVJKCkge1xuICBjcmVhdGVSZWdlbmVyYXRlQnV0dG9uKCk7XG4gIGNyZWF0ZVByZXNvbHZlQnV0dG9uKCk7XG4gIGNyZWF0ZVNpemVVSSgpO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVTaXplVUkoKSB7XG4gIGlmIChzaXplTGFiZWwgIT09IG51bGwpIHtcbiAgICBzdGFnZS5yZW1vdmVDaGlsZChzaXplTGFiZWwpO1xuICAgIHNpemVMYWJlbCA9IG51bGw7XG4gIH1cbiAgaWYgKHNpemVUZXh0ICE9PSBudWxsKSB7XG4gICAgc3RhZ2UucmVtb3ZlQ2hpbGQoc2l6ZVRleHQpO1xuICAgIHNpemVUZXh0ID0gbnVsbDtcbiAgfVxuICBpZiAoc21hbGxlckJ1dHRvbiAhPT0gbnVsbCkge1xuICAgIHN0YWdlLnJlbW92ZUNoaWxkKHNtYWxsZXJCdXR0b24pO1xuICAgIHNtYWxsZXJCdXR0b24gPSBudWxsO1xuICB9XG4gIGlmIChsYXJnZXJCdXR0b24gIT09IG51bGwpIHtcbiAgICBzdGFnZS5yZW1vdmVDaGlsZChsYXJnZXJCdXR0b24pO1xuICAgIGxhcmdlckJ1dHRvbiA9IG51bGw7XG4gIH1cblxuICBsZXQgc3R5bGUgPSBuZXcgUElYSS5UZXh0U3R5bGUoe1xuICAgIGZvbnRTaXplOiAyNCxcbiAgICBmaWxsOiAweEQwRDBEMFxuICB9KTtcblxuICBsZXQgbGFiZWwgPSBuZXcgUElYSS5UZXh0KCdTaXplOiAnLCBzdHlsZSk7XG4gIGxhYmVsLnggPSA3MDA7XG4gIGxhYmVsLnkgPSA1MDtcblxuICBzdGFnZS5hZGRDaGlsZChsYWJlbCk7XG4gIHNpemVMYWJlbCA9IGxhYmVsO1xuXG4gIGxldCBjZW50ZXJYID0gNzcyOyAvLyBmb3IgdXAvZG93biBidXR0b25zXG5cbiAgbGV0IHVwQnV0dG9uID0gbmV3IFBJWEkuR3JhcGhpY3MoKTtcbiAgdXBCdXR0b24uYmVnaW5GaWxsKDB4RDBEMEQwKTtcbiAgdXBCdXR0b24uZHJhd1BvbHlnb24oW1xuICAgIGNlbnRlclgsIDUzLFxuICAgIGNlbnRlclggKyAxMCwgNjMsXG4gICAgY2VudGVyWCAtIDEwLCA2M1xuICBdKTtcbiAgdXBCdXR0b24uZW5kRmlsbCgpO1xuXG4gIHVwQnV0dG9uLmludGVyYWN0aXZlID0gdHJ1ZTtcbiAgdXBCdXR0b24ub24oJ21vdXNldXAnLCBpbmNyZW1lbnRTaXplKTtcblxuICBzdGFnZS5hZGRDaGlsZCh1cEJ1dHRvbik7XG4gIGxhcmdlckJ1dHRvbiA9IHVwQnV0dG9uO1xuXG4gIGxldCBkb3duQnV0dG9uID0gbmV3IFBJWEkuR3JhcGhpY3MoKTtcbiAgaWYgKGJvYXJkU2l6ZSA+IDIpIHtcbiAgICBkb3duQnV0dG9uLmJlZ2luRmlsbCgweEQwRDBEMCk7XG4gIH0gZWxzZSB7XG4gICAgZG93bkJ1dHRvbi5iZWdpbkZpbGwoMHg4MDgwODApO1xuICB9XG4gIGRvd25CdXR0b24uZHJhd1BvbHlnb24oW1xuICAgIGNlbnRlclgsIDc3LFxuICAgIGNlbnRlclggLSAxMCwgNjcsXG4gICAgY2VudGVyWCArIDEwLCA2N1xuICBdKTtcbiAgZG93bkJ1dHRvbi5lbmRGaWxsKCk7XG5cbiAgaWYgKGJvYXJkU2l6ZSA+IDIpIHtcbiAgICBkb3duQnV0dG9uLmludGVyYWN0aXZlID0gdHJ1ZTtcbiAgICBkb3duQnV0dG9uLm9uKCdtb3VzZXVwJywgZGVjcmVtZW50U2l6ZSk7XG4gIH1cblxuICBzdGFnZS5hZGRDaGlsZChkb3duQnV0dG9uKTtcbiAgc21hbGxlckJ1dHRvbiA9IGRvd25CdXR0b247XG5cbiAgbGV0IHRleHQgPSBuZXcgUElYSS5UZXh0KCcnICsgYm9hcmRTaXplLCBzdHlsZSk7XG4gIHRleHQueCA9IGNlbnRlclggKyAxNDtcbiAgdGV4dC55ID0gNTA7XG5cbiAgc3RhZ2UuYWRkQ2hpbGQodGV4dCk7XG4gIHNpemVUZXh0ID0gdGV4dDtcbn1cblxuZnVuY3Rpb24gY3JlYXRlUmVnZW5lcmF0ZUJ1dHRvbigpIHtcbiAgaWYgKHJlZ2VuZXJhdGVCdXR0b24gIT09IG51bGwpIHtcbiAgICBzdGFnZS5yZW1vdmVDaGlsZChyZWdlbmVyYXRlQnV0dG9uKTtcbiAgICByZWdlbmVyYXRlQnV0dG9uID0gbnVsbDtcbiAgfVxuICBpZiAocmVnZW5lcmF0ZUJ1dHRvblRleHQgIT09IG51bGwpIHtcbiAgICBzdGFnZS5yZW1vdmVDaGlsZChyZWdlbmVyYXRlQnV0dG9uVGV4dCk7XG4gICAgcmVnZW5lcmF0ZUJ1dHRvblRleHQgPSBudWxsO1xuICB9XG5cbiAgbGV0IGJ1dHRvbiA9IG5ldyBQSVhJLkdyYXBoaWNzKCk7XG4gIGJ1dHRvbi5saW5lU3R5bGUoMiwgMHg4MDgwRkYsIDEpO1xuICBidXR0b24uYmVnaW5GaWxsKDB4RDBEMEQwKTtcbiAgYnV0dG9uLmRyYXdSb3VuZGVkUmVjdCg3MDAsIDkwLCAxMTUsIDMwLCA3KTtcbiAgYnV0dG9uLmVuZEZpbGwoKTtcblxuICBidXR0b24uaW50ZXJhY3RpdmUgPSB0cnVlO1xuICBidXR0b24ub24oJ21vdXNldXAnLCBnZW5lcmF0ZUJvYXJkKTtcblxuICBzdGFnZS5hZGRDaGlsZChidXR0b24pO1xuICByZWdlbmVyYXRlQnV0dG9uID0gYnV0dG9uO1xuXG4gIGxldCBzdHlsZSA9IG5ldyBQSVhJLlRleHRTdHlsZSh7XG4gICAgZm9udFNpemU6IDIwLFxuICAgIGZpbGw6IDB4MjAyMDIwXG4gIH0pO1xuXG4gIGxldCB0ZXh0ID0gbmV3IFBJWEkuVGV4dCgnUmVnZW5lcmF0ZScsIHN0eWxlKTtcbiAgdGV4dC54ID0gNzA2O1xuICB0ZXh0LnkgPSA5MztcblxuICBzdGFnZS5hZGRDaGlsZCh0ZXh0KTtcbiAgcmVnZW5lcmF0ZUJ1dHRvblRleHQgPSB0ZXh0O1xufVxuXG5mdW5jdGlvbiBjcmVhdGVQcmVzb2x2ZUJ1dHRvbigpIHtcbiAgaWYgKHByZXNvbHZlQnV0dG9uICE9PSBudWxsKSB7XG4gICAgc3RhZ2UucmVtb3ZlQ2hpbGQocHJlc29sdmVCdXR0b24pO1xuICAgIHByZXNvbHZlQnV0dG9uID0gbnVsbDtcbiAgfVxuICBpZiAocHJlc29sdmVCdXR0b25UZXh0ICE9PSBudWxsKSB7XG4gICAgc3RhZ2UucmVtb3ZlQ2hpbGQocHJlc29sdmVCdXR0b25UZXh0KTtcbiAgICBwcmVzb2x2ZUJ1dHRvblRleHQgPSBudWxsO1xuICB9XG5cbiAgbGV0IGJ1dHRvbiA9IG5ldyBQSVhJLkdyYXBoaWNzKCk7XG4gIGJ1dHRvbi5saW5lU3R5bGUoMiwgMHg4MDgwRkYsIDEpO1xuICBpZiAoYm9hcmQucHJlc29sdmVkKSB7XG4gICAgYnV0dG9uLmJlZ2luRmlsbCgweDgwODA4MCk7XG4gIH0gZWxzZSB7XG4gICAgYnV0dG9uLmJlZ2luRmlsbCgweEQwRDBEMCk7XG4gIH1cbiAgYnV0dG9uLmRyYXdSb3VuZGVkUmVjdCg3MDAsIDEzMCwgMTE1LCAzMCwgNyk7XG4gIGJ1dHRvbi5lbmRGaWxsKCk7XG5cbiAgaWYgKCFib2FyZC5wcmVzb2x2ZWQpIHtcbiAgICBidXR0b24uaW50ZXJhY3RpdmUgPSB0cnVlO1xuICAgIGJ1dHRvbi5vbignbW91c2V1cCcsIHByZXNvbHZlKTtcbiAgfVxuXG4gIHN0YWdlLmFkZENoaWxkKGJ1dHRvbik7XG4gIHByZXNvbHZlQnV0dG9uID0gYnV0dG9uO1xuXG4gIGxldCBzdHlsZSA9IG5ldyBQSVhJLlRleHRTdHlsZSh7XG4gICAgZm9udFNpemU6IDIwLFxuICAgIGZpbGw6IDB4MjAyMDIwXG4gIH0pO1xuXG4gIGxldCB0ZXh0ID0gbmV3IFBJWEkuVGV4dCgnUHJlc29sdmUnLCBzdHlsZSk7XG4gIHRleHQueCA9IDcxOTtcbiAgdGV4dC55ID0gMTMzO1xuXG4gIHN0YWdlLmFkZENoaWxkKHRleHQpO1xuICBwcmVzb2x2ZUJ1dHRvblRleHQgPSB0ZXh0O1xufVxuXG4vKi8vIERlY2xhcmUgYSBnbG9iYWwgdmFyaWFibGUgZm9yIG91ciBzcHJpdGUgc28gdGhhdCB0aGUgYW5pbWF0ZSBmdW5jdGlvbiBjYW4gYWNjZXNzIGl0LlxubGV0IGJ1bm55OlBJWEkuU3ByaXRlID0gbnVsbDtcblxuLy8gbG9hZCB0aGUgdGV4dHVyZSB3ZSBuZWVkXG5QSVhJLmxvYWRlci5hZGQoJ2J1bm55JywgJ2ltYWdlcy9idW5ueS5qcGVnJykubG9hZChmdW5jdGlvbiAobG9hZGVyOlBJWEkubG9hZGVycy5Mb2FkZXIsIHJlc291cmNlczphbnkpIHtcbiAgICAvLyBUaGlzIGNyZWF0ZXMgYSB0ZXh0dXJlIGZyb20gYSAnYnVubnkucG5nJyBpbWFnZS5cbiAgICBidW5ueSA9IG5ldyBQSVhJLlNwcml0ZShyZXNvdXJjZXMuYnVubnkudGV4dHVyZSk7XG5cbiAgICAvLyBTZXR1cCB0aGUgcG9zaXRpb24gYW5kIHNjYWxlIG9mIHRoZSBidW5ueVxuICAgIGJ1bm55LnBvc2l0aW9uLnggPSA0MDA7XG4gICAgYnVubnkucG9zaXRpb24ueSA9IDMwMDtcblxuICAgIGJ1bm55LnNjYWxlLnggPSAyO1xuICAgIGJ1bm55LnNjYWxlLnkgPSAyO1xuXG4gICAgLy8gQWRkIHRoZSBidW5ueSB0byB0aGUgc2NlbmUgd2UgYXJlIGJ1aWxkaW5nLlxuICAgIHN0YWdlLmFkZENoaWxkKGJ1bm55KTtcblxuICAgIC8vIGtpY2sgb2ZmIHRoZSBhbmltYXRpb24gbG9vcCAoZGVmaW5lZCBiZWxvdylcbiAgICBhbmltYXRlKCk7XG59KTtcblxuZnVuY3Rpb24gYW5pbWF0ZSgpIHtcbiAgICAvLyBzdGFydCB0aGUgdGltZXIgZm9yIHRoZSBuZXh0IGFuaW1hdGlvbiBsb29wXG4gICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKGFuaW1hdGUpO1xuXG4gICAgLy8gZWFjaCBmcmFtZSB3ZSBzcGluIHRoZSBidW5ueSBhcm91bmQgYSBiaXRcbiAgICBidW5ueS5yb3RhdGlvbiArPSAwLjAxO1xuXG4gICAgLy8gdGhpcyBpcyB0aGUgbWFpbiByZW5kZXIgY2FsbCB0aGF0IG1ha2VzIHBpeGkgZHJhdyB5b3VyIGNvbnRhaW5lciBhbmQgaXRzIGNoaWxkcmVuLlxuICAgIHJlbmRlcmVyLnJlbmRlcihzdGFnZSk7XG59Ki9cbiJdfQ==

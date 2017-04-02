/// <reference path="../typings/index.d.ts" />
/// <reference path="./tone.ts" />

import {Tone} from './tone';
const C4 = 256; // dem numerologists be crazy, but I'm using A 432 anyway

enum Direction {
  Up = 0,
  Down,
  Left,
  Right
}

const directions = [Direction.Up, Direction.Down, Direction.Left, Direction.Right];

export class Board {
  size: number;
  arrows: Direction[];
  exitSquares: boolean[];
  presolved: boolean;
  longestExitPathLength: number;
  // drawing
  stage: PIXI.Container;
  events: any[][]; // record steps to render later
  currentEvent: any[];
  framesBetweenEvents: number;
  currentRestFrame: number;
  drawingExitSquares: boolean[];
  drawingBacktraceSquares: boolean[];
  drawingLongestPath: number;
  longestPathText: PIXI.Text;
  TL: {x: number, y: number}; // top left corner (there will be a 1-square buffer around the whole thing)
  cellWidth: number; // since the grid is square, this probably should be just one property
  cellHeight: number;
  w: number; // width
  h: number; // height
  lineSprites: PIXI.Graphics[]; // so we can remove them later
  cellSprites: PIXI.Graphics[]; // array by square index; things in it are null until populated
  arrowSprites: PIXI.Graphics[]; // also by square index;

  constructor(size: number, stage: PIXI.Container) {
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
    this.TL = {x: 50, y: 100};
    this.w = 600;
    this.h = 600;
    this.cellWidth = this.w/(size + 2);
    this.cellHeight = this.h/(size + 2);
    this.drawingExitSquares = [];
    this.drawingBacktraceSquares = [];
    this.lineSprites = [];
    this.cellSprites = [];
    this.arrowSprites = [];
    this.longestPathText = null;
    for (let i = 0; i < size * size; i++) {
      this.arrows[i] = directions[Math.floor(Math.random()*4)]; // generate board
      this.exitSquares[i] = false; // initialize exitSquares
      this.drawingExitSquares[i] = false;
      this.drawingBacktraceSquares[i] = false;
      this.cellSprites[i] = null;
      this.arrowSprites[i] = null;
    }
  }

  row(square: number) { // basic operation to get row from square number
    return Math.floor(square/this.size);
  }

  col(square: number) { // get column
    return square % this.size;
  }

  square(row: number, col: number) { // get square from row and column
    return this.size*row + col;
  }

  up(square: number) { // go up a square (0 is upper left, going across then down)
    if (this.row(square) === 0) {
      return null;
    } else {
      return square - this.size;
    }
  }

  down(square: number) { // down a square
    if (this.row(square) === this.size - 1) {
      return null;
    } else {
      return square + this.size;
    }
  }

  left(square: number) { // left a square
    if (this.col(square) === 0) {
      return null;
    } else {
      return square - 1;
    }
  }

  right(square: number) { // right a square
    if (this.col(square) === this.size - 1) {
      return null;
    } else {
      return square + 1;
    }
  }

  next(square: number) { // follow the arrow
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

  nextCheckerSquareRC(squareRC: {row: number, col: number}) {
    if (squareRC.row < 0 || squareRC.row >= this.size
        || squareRC.col < 0 || squareRC.col >= this.size) {
      return null; // there are no arrows off-board
    }
    let square = this.square(squareRC.row, squareRC.col);
    // we can't just use the "next" method because we may need
    // to move the checker off the board
    switch (this.arrows[square]) {
      case Direction.Up:
        return {row: squareRC.row - 1, col: squareRC.col};
      case Direction.Down:
        return {row: squareRC.row + 1, col: squareRC.col};
      case Direction.Left:
        return {row: squareRC.row, col: squareRC.col - 1};
      case Direction.Right:
        return {row: squareRC.row, col: squareRC.col + 1};
      default:
        return null; // should never happen
    }
  }

  record(event: Object) { // record an event in this render step
    this.currentEvent.push(event);
  }

  nextEvent() { // make the next render step
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
    function backtracePath(square: number) {
      let pathLengths = [0, 0, 0, 0]
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
        this.square(0, i), // along top
        this.square(i, this.size - 1), // along right
        this.square(this.size - 1, this.size - 1 - i), // along bottom
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

  processRenderEvent(event: any) {
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
    let frequency = 2*(2/(Math.random() + 1))*C4; // random note between C5 and C6
    // Actually not quite a random note -- we're choosing the note in a weird
    // way.  Think of a string that makes a C4 sound.  Now, find the midpoint.
    // We're picking random spots on the string on one side of the midpoint
    // and plucking on the other side.  It's still random, just... weird.
    let duration = (this.framesBetweenEvents/60)*500; // assuming 60 fps
    let tone = new Tone(frequency, duration, 0.1);
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
    } else if (this.currentRestFrame > 0) {
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
    for (let i = 0; i < this.size*this.size; i++) {
      this.removeCellSprite(i); // also clears arrow sprite
    }
  }

  removeCellSprite(square: number) {
    if (this.cellSprites[square] !== null) {
      this.stage.removeChild(this.cellSprites[square]);
    }
    this.cellSprites[square] = null;
    this.removeArrowSprite(square);
  }

  removeArrowSprite(square: number) {
    if (this.arrowSprites[square] !== null) {
      this.stage.removeChild(this.arrowSprites[square]);
    }
    this.arrowSprites[square] = null;
  }

  createBoardSprites() {
    this.clearBoardSprites();
    this.createLineSprites();
    for (let i = 0; i < this.size*this.size; i++) {
      this.createCellSprite(i);
    }
  }

  createLineSprites() {
    for (let i = 1; i <= this.size + 1; i++) {
      let hLine = new PIXI.Graphics();
      hLine.lineStyle(3, 0x8080FF, 1);
      hLine.moveTo(this.TL.x + this.cellWidth - 1.5, this.TL.y + i*this.cellHeight);
      hLine.lineTo(this.TL.x + (this.size + 1)*this.cellWidth + 1.5, this.TL.y + i*this.cellHeight);
      this.stage.addChild(hLine);
      this.lineSprites.push(hLine);

      let vLine = new PIXI.Graphics();
      vLine.lineStyle(3, 0x8080FF, 1);
      vLine.moveTo(this.TL.x + this.cellWidth*i, this.TL.y + this.cellHeight - 1.5);
      vLine.lineTo(this.TL.x + this.cellWidth*i, this.TL.y + (this.size + 1)*this.cellHeight + 1.5);
      this.stage.addChild(vLine);
      this.lineSprites.push(vLine);
    }
  }

  createCellSprite(square: number) {
    this.removeCellSprite(square); // also removes arrow sprite
    let cell = new PIXI.Graphics();
    if (this.drawingBacktraceSquares[square]) {
      cell.lineStyle(1, 0xFF4040, 1); // border around backtrace squares
    } else {
      cell.lineStyle(0, 0x000000, 0);
    }
    if (this.drawingExitSquares[square]) {
      cell.beginFill(0x202020);
    } else {
      cell.beginFill(0xE0E0E0);
    }
    let r = this.row(square);
    let c = this.col(square);
    cell.drawRect(this.TL.x + this.cellWidth*(c + 1) + 1,
                  this.TL.y + this.cellHeight*(r + 1) + 1,
                  this.cellWidth - 2,
                  this.cellHeight - 2);
    cell.endFill();
    this.stage.addChild(cell);
    this.cellSprites[square] = cell;
    this.createArrowSprite(square);
  }

  createArrowSprite(square: number) {
    let center = this.centerOfSquare({
      row: this.row(square),
      col: this.col(square)
    });
    const k = Math.sqrt(3)/8; // useful geometric constant
    let arrow = new PIXI.Graphics();
    arrow.beginFill(0x808080);
    switch (this.arrows[square]) {
        case Direction.Up:
          arrow.drawPolygon([
            center.x, center.y - this.cellHeight*0.375,
            center.x + k*this.cellWidth, center.y,
            center.x - k*this.cellWidth, center.y
          ]);
          break;
        case Direction.Down:
          arrow.drawPolygon([
            center.x, center.y + this.cellHeight*0.375,
            center.x - k*this.cellWidth, center.y,
            center.x + k*this.cellWidth, center.y
          ]);
          break;
        case Direction.Left:
          arrow.drawPolygon([
            center.x - this.cellHeight*0.375, center.y,
            center.x, center.y - k*this.cellHeight,
            center.x, center.y + k*this.cellHeight
          ]);
          break;
        case Direction.Right:
          arrow.drawPolygon([
            center.x + this.cellHeight*0.375, center.y,
            center.x, center.y + k*this.cellHeight,
            center.x, center.y - k*this.cellHeight
          ]);
          break;
    }
    arrow.endFill();
    this.stage.addChild(arrow);
    this.arrowSprites[square] = arrow;
  }

  centerOfSquare(squareRC: {row: number, col: number}) {
    return {
      x: this.TL.x + this.cellWidth*(squareRC.col + 1.5),
      y: this.TL.y + this.cellHeight*(squareRC.row + 1.5)
    }
  }
}

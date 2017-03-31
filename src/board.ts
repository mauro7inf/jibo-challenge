/// <reference path="../typings/index.d.ts" />

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
  nonExitSquareCount: number;
  longestExitPathLength: number;
  // drawing
  stage: PIXI.Container;
  events: any[][]; // record steps to render later
  currentEvent: any[];
  framesBetweenEvents: number;
  currentRestFrame: number;
  drawingExitSquares: boolean[];
  drawingNonExits: number;
  nonExitsText: PIXI.Text;
  drawingBacktraceSquares: boolean[];
  drawingLongestPath: number;
  longestPathText: PIXI.Text;
  TL: {x: number, y: number}; // top left corner (there will be a 1-square buffer around the whole thing)
  cellWidth: number;
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
    this.currentRestFrame = 0;
    this.drawingNonExits = size * size;
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
    this.nonExitsText = null;
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

  record(event: Object) { // record an event in this render step
    this.currentEvent.push(event);
  }

  nextEvent() { // make the next render step
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
    function backtracePath(square: number) {
      let pathLengths = [0, 0, 0, 0]
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
    this.nonExitSquareCount = this.size*this.size - exits;
    this.presolved = true;
  }

  processRenderEvent(event: any) {
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
    let r = this.row(square);
    let c = this.col(square);
    let xCenter = this.TL.x + this.cellWidth*(c + 1.5);
    let yCenter = this.TL.y + this.cellHeight*(r + 1.5);
    const k = Math.sqrt(3)/8; // useful geometric constant
    let arrow = new PIXI.Graphics();
    arrow.beginFill(0x808080);
    switch (this.arrows[square]) {
        case Direction.Up:
          arrow.drawPolygon([
            xCenter, yCenter - this.cellHeight*0.375,
            xCenter + k*this.cellWidth, yCenter,
            xCenter - k*this.cellWidth, yCenter
          ]);
          break;
        case Direction.Down:
          arrow.drawPolygon([
            xCenter, yCenter + this.cellHeight*0.375,
            xCenter - k*this.cellWidth, yCenter,
            xCenter + k*this.cellWidth, yCenter
          ]);
          break;
        case Direction.Left:
          arrow.drawPolygon([
            xCenter - this.cellHeight*0.375, yCenter,
            xCenter, yCenter - k*this.cellHeight,
            xCenter, yCenter + k*this.cellHeight
          ]);
          break;
        case Direction.Right:
          arrow.drawPolygon([
            xCenter + this.cellHeight*0.375, yCenter,
            xCenter, yCenter + k*this.cellHeight,
            xCenter, yCenter - k*this.cellHeight
          ]);
          break;
    }
    arrow.endFill();
    this.stage.addChild(arrow);
    this.arrowSprites[square] = arrow;
  }
}

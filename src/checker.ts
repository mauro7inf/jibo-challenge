/// <reference path="../typings/index.d.ts" />
/// <reference path="./board.ts" />
/// <reference path="./tone.ts" />

import {Board} from './board';
import {Tone} from './tone';
const C4 = 256; // dem numerologists be crazy, but I'm using A 432 anyway

export class Checker {
  board: Board;
  onBoard: boolean;
  squareRC: {row: number, col: number}; // checker can be off board, so -1 ≤ row, col ≤ size
  nextSquareRC: {row: number, col: number};
  started: boolean;
  done: boolean;
  // drawing
  stage: PIXI.Container;
  position: {x: number, y: number}; // actual position for rendering
  nextPosition: {x: number, y: number};
  movementFrames: number; // frames it takes to move from one square to the next
  currentFrame: number;
  stepsTaken: number;
  radius: number;
  checkerSprite: PIXI.Graphics;
  stepsText: PIXI.Text;
  doneText: PIXI.Text;

  constructor(board: Board, row: number, col: number, stage: PIXI.Container) {
    this.board = board;
    this.stage = stage;
    this.squareRC = {row: row, col: col};
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
    } else {
      this.onBoard = false;
    }
  }

  calculateRadius() {
    let cellSize = Math.min(this.board.cellWidth, this.board.cellHeight);
    this.radius = cellSize/4;
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
    } else if (this.tooManySteps()) {
      style = new PIXI.TextStyle({
        fontSize: 30,
        fill: 0xFF4040
      });
    } else {
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

  createDoneText(msg: string) {
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
    } else if (!this.started) {
      // set direction
      this.nextSquareRC = this.board.nextCheckerSquareRC(this.squareRC);
      this.nextPosition = this.board.centerOfSquare(this.nextSquareRC);
      this.currentFrame++;
      this.started = true;
      this.createStepsText();
      this.currentFrame = 1;
    } else if (this.currentFrame === 0) {
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
        this.createDoneText('Exited')
      } else if (this.tooManySteps()) {
        this.done = true; // loop condition
        this.createDoneText('Will loop');
      } else {
        // set next direction
        this.nextSquareRC = this.board.nextCheckerSquareRC(this.squareRC);
        this.nextPosition = this.board.centerOfSquare(this.nextSquareRC);
        this.currentFrame++;
      }
    } else {
      // move to next square
      let f = (this.movementFrames - this.currentFrame)/this.movementFrames;
      f = f * f; // nicer animation
      this.checkerSprite.x = f*this.position.x + (1 - f)*this.nextPosition.x;
      this.checkerSprite.y = f*this.position.y + (1 - f)*this.nextPosition.y;
      this.currentFrame++;
      if (this.currentFrame === this.movementFrames) {
        this.currentFrame = 0;
      }
    }
  }

  playSound() {
    let duration = (this.movementFrames/60)*300; // assuming 60 fps
    let frequency = C4*((2*this.board.longestExitPathLength - 2)/
      (this.board.longestExitPathLength + this.stepsTaken - 2));
    let tone1 = new Tone(frequency, duration, 0.09);
    tone1.play();
    let tone2 = new Tone(frequency/2, duration, 0.03);
    tone2.play();
  }
}

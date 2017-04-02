/// <reference path="../typings/index.d.ts" />
/// <reference path="./board.ts" />
/// <reference path="./checker.ts" />

import PIXI = require('pixi.js');
import {Board} from './board';
import {Checker} from './checker';
const renderer:PIXI.WebGLRenderer = new PIXI.WebGLRenderer(1380, 800);
document.body.appendChild(renderer.view);

// You need to create a root container that will hold the scene you want to draw.
const stage:PIXI.Container = new PIXI.Container();

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
  board = new Board(boardSize, stage);
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
    } else {
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
  let row = Math.floor(Math.random()*boardSize);
  let col = Math.floor(Math.random()*boardSize);
  checker = new Checker(board, row, col, stage);
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
    } else {
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
  } else {
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
  } else {
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
  } else {
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
  } else {
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

(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.jiboProgrammingChallenge = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/// <reference path="../typings/index.d.ts" />
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const PIXI = require("pixi.js");
const renderer = new PIXI.WebGLRenderer(1280, 720);
document.body.appendChild(renderer.view);
// You need to create a root container that will hold the scene you want to draw.
const stage = new PIXI.Container();
// Declare a global variable for our sprite so that the animate function can access it.
let bunny = null;
// load the texture we need
PIXI.loader.add('bunny', 'images/bunny.jpeg').load(function (loader, resources) {
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
}

},{"pixi.js":undefined}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQSw4Q0FBOEM7OztBQUU5QyxnQ0FBaUM7QUFDakMsTUFBTSxRQUFRLEdBQXNCLElBQUksSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFDdEUsUUFBUSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBRXpDLGlGQUFpRjtBQUNqRixNQUFNLEtBQUssR0FBa0IsSUFBSSxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7QUFFbEQsdUZBQXVGO0FBQ3ZGLElBQUksS0FBSyxHQUFlLElBQUksQ0FBQztBQUU3QiwyQkFBMkI7QUFDM0IsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsT0FBTyxFQUFFLG1CQUFtQixDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsTUFBMEIsRUFBRSxTQUFhO0lBQ2xHLG1EQUFtRDtJQUNuRCxLQUFLLEdBQUcsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7SUFFakQsNENBQTRDO0lBQzVDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQztJQUN2QixLQUFLLENBQUMsUUFBUSxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUM7SUFFdkIsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ2xCLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUVsQiw4Q0FBOEM7SUFDOUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUV0Qiw4Q0FBOEM7SUFDOUMsT0FBTyxFQUFFLENBQUM7QUFDZCxDQUFDLENBQUMsQ0FBQztBQUVIO0lBQ0ksOENBQThDO0lBQzlDLHFCQUFxQixDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBRS9CLDRDQUE0QztJQUM1QyxLQUFLLENBQUMsUUFBUSxJQUFJLElBQUksQ0FBQztJQUV2QixxRkFBcUY7SUFDckYsUUFBUSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUMzQixDQUFDIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8vLyA8cmVmZXJlbmNlIHBhdGg9XCIuLi90eXBpbmdzL2luZGV4LmQudHNcIiAvPlxuXG5pbXBvcnQgUElYSSA9IHJlcXVpcmUoJ3BpeGkuanMnKTtcbmNvbnN0IHJlbmRlcmVyOlBJWEkuV2ViR0xSZW5kZXJlciA9IG5ldyBQSVhJLldlYkdMUmVuZGVyZXIoMTI4MCwgNzIwKTtcbmRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQocmVuZGVyZXIudmlldyk7XG5cbi8vIFlvdSBuZWVkIHRvIGNyZWF0ZSBhIHJvb3QgY29udGFpbmVyIHRoYXQgd2lsbCBob2xkIHRoZSBzY2VuZSB5b3Ugd2FudCB0byBkcmF3LlxuY29uc3Qgc3RhZ2U6UElYSS5Db250YWluZXIgPSBuZXcgUElYSS5Db250YWluZXIoKTtcblxuLy8gRGVjbGFyZSBhIGdsb2JhbCB2YXJpYWJsZSBmb3Igb3VyIHNwcml0ZSBzbyB0aGF0IHRoZSBhbmltYXRlIGZ1bmN0aW9uIGNhbiBhY2Nlc3MgaXQuXG5sZXQgYnVubnk6UElYSS5TcHJpdGUgPSBudWxsO1xuXG4vLyBsb2FkIHRoZSB0ZXh0dXJlIHdlIG5lZWRcblBJWEkubG9hZGVyLmFkZCgnYnVubnknLCAnaW1hZ2VzL2J1bm55LmpwZWcnKS5sb2FkKGZ1bmN0aW9uIChsb2FkZXI6UElYSS5sb2FkZXJzLkxvYWRlciwgcmVzb3VyY2VzOmFueSkge1xuICAgIC8vIFRoaXMgY3JlYXRlcyBhIHRleHR1cmUgZnJvbSBhICdidW5ueS5wbmcnIGltYWdlLlxuICAgIGJ1bm55ID0gbmV3IFBJWEkuU3ByaXRlKHJlc291cmNlcy5idW5ueS50ZXh0dXJlKTtcblxuICAgIC8vIFNldHVwIHRoZSBwb3NpdGlvbiBhbmQgc2NhbGUgb2YgdGhlIGJ1bm55XG4gICAgYnVubnkucG9zaXRpb24ueCA9IDQwMDtcbiAgICBidW5ueS5wb3NpdGlvbi55ID0gMzAwO1xuXG4gICAgYnVubnkuc2NhbGUueCA9IDI7XG4gICAgYnVubnkuc2NhbGUueSA9IDI7XG5cbiAgICAvLyBBZGQgdGhlIGJ1bm55IHRvIHRoZSBzY2VuZSB3ZSBhcmUgYnVpbGRpbmcuXG4gICAgc3RhZ2UuYWRkQ2hpbGQoYnVubnkpO1xuXG4gICAgLy8ga2ljayBvZmYgdGhlIGFuaW1hdGlvbiBsb29wIChkZWZpbmVkIGJlbG93KVxuICAgIGFuaW1hdGUoKTtcbn0pO1xuXG5mdW5jdGlvbiBhbmltYXRlKCkge1xuICAgIC8vIHN0YXJ0IHRoZSB0aW1lciBmb3IgdGhlIG5leHQgYW5pbWF0aW9uIGxvb3BcbiAgICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoYW5pbWF0ZSk7XG5cbiAgICAvLyBlYWNoIGZyYW1lIHdlIHNwaW4gdGhlIGJ1bm55IGFyb3VuZCBhIGJpdFxuICAgIGJ1bm55LnJvdGF0aW9uICs9IDAuMDE7XG5cbiAgICAvLyB0aGlzIGlzIHRoZSBtYWluIHJlbmRlciBjYWxsIHRoYXQgbWFrZXMgcGl4aSBkcmF3IHlvdXIgY29udGFpbmVyIGFuZCBpdHMgY2hpbGRyZW4uXG4gICAgcmVuZGVyZXIucmVuZGVyKHN0YWdlKTtcbn1cbiJdfQ==

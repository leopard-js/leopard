# scratch-js
Library for direct translation from Scratch to Javascript. Automatic translator coming soon.

## Usage
```
git clone https://github.com/PullJosh/scratch-js.git
cd example-project
npm install
npm run watch
```
Open http://localhost:8080/ to see development build (automatically reloads after changes).

* For production build, use `npm run build` in place of `npm run watch`.
* To launch dev server on a different port, use `npm run watch -- --port [your_port_number]`

## What is this? (In more words.)
There are two main components to `scratch-js`. Right now, only one of them exists.

### Thing 1: A Javascript Library For Creating Games
First and foremost, `scratch-js` is a library which makes it easy to create games in Javascript. You can think of it as a [PixiJS](http://www.pixijs.com/) equivalent. The library ~~handles~~ will eventually handle the rendering of sprites, collision detection, audio, and more. It is designed to be easy-to-use for real human beings. If you're a person, you can make games with `scratch-js`.

But `scratch-js` also has a second trick up its sleeve...

### Thing 2 (coming soon): A Compiler to Turn Scratch Projects into JS
The design of the `scratch-js` library closely mimics that of the [Scratch](https://scratch.mit.edu/) programming language. This is no accident; it allows for *direct, easy translation from Scratch to JS*. There are a lot of reasons why this is difficult without the library (mostly the way that Scratch handles asynchronous code), but with `scratch-js` alongside, the translation is stupid simple.

All of this means that (in the future) a compiler can exist which translates Scratch projects directly into usable Javascript. This isn't ugly compilation that leaves little room for human input. The final code is clear and concise, exactly the same as the Scratch project from which it is created.
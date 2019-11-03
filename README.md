# scratch-js
Library for making Scratch-like projects with Javascript. Automatic translator coming soon.

## Usage
### Step 1: Get the code
```
> git clone https://github.com/PullJosh/scratch-js.git
> cd scratch-js
```
(Note that the `cd` command takes us into the repo directory, **NOT** the `scratch-js` folder within it!)

### Step 2: Serve the files
Everything in this repo can be opened in a browser directly. Unfortunately for us, javascript modules must come from a server like `localhost` rather than straight from the file system, so **we need to serve the repo's files on localhost.**

There are plenty of different ways to do this. If you have `node` installed, you can use [`http-server`](https://www.npmjs.com/package/http-server):
```
> npm i -g http-server
> http-server -p 3000
```

Once you start the server, open http://localhost:3000/example-project/index.html to see the example project in action!

## What is this? (In more words.)
There are two main components to `scratch-js`. Right now, only one of them exists.

### Thing 1: A Javascript Library For Creating Games
First and foremost, `scratch-js` is a library which makes it easy to create games in Javascript. You can think of it as a [PixiJS](http://www.pixijs.com/) equivalent. The library ~~handles~~ will eventually handle the rendering of sprites, collision detection, audio, and more. It is designed to be easy-to-use for real human beings. If you're a person, you can make games with `scratch-js`.

But `scratch-js` also has a second trick up its sleeve...

### Thing 2 (coming soon): A Compiler to Turn Scratch Projects into JS
The design of the `scratch-js` library closely mimics that of the [Scratch](https://scratch.mit.edu/) programming language. This is no accident; it allows for *direct, easy translation from Scratch to JS*. There are a lot of reasons why this is difficult without the library (mostly the way that Scratch handles asynchronous code), but with `scratch-js` alongside, the translation is stupid simple.

All of this means that (in the future) a compiler can exist which translates Scratch projects directly into usable Javascript. This isn't ugly compilation that leaves little room for human input. The final code is clear and concise, exactly the same as the Scratch project from which it is created.

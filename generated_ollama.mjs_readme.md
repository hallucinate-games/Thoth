# Ollama.js: A JavaScript Client for LLaMA Models

Ollama.js is a lightweight JavaScript client library that allows you to interact with LLaMA models hosted on a server. With Ollama.js, you can easily generate text, chat with the model, and perform other tasks using the LLaMA API.

## High-Level Overview

Ollama.js provides an intuitive interface for interacting with LLaMA models. You can create an instance of the `Ollama` class by passing in the URL of your LLaMA server and optionally specifying a model name. The library supports both synchronous and streaming responses, allowing you to choose the best approach for your use case.

The `Ollama` instance provides several methods for interacting with the LLaMA model:

* `generate`: Generates text based on a prompt
* `chat`: Engages in a conversation with the model
* `ps`: Retrieves information about the LLaMA server's processes
* `create`: Creates a new model (not tested)
* `tags`: Retrieves a list of available models
* `copy`: Copies an existing model (not tested)
* `embeddings`: Retrieves embeddings for a given input
* `pull`: Pulls a model from the server
* `push`: Pushes a model to the server
* `delete`: Deletes a model from the server

## Quickstart Guide

1. Install Ollama.js using npm or yarn:
```
npm install ollama.js
```
2. Import the library in your JavaScript file:
```javascript
import Ollama from 'ollama.js';
```
3. Create an instance of the `Ollama` class, specifying the URL of your LLaMA server and optionally a model name:
```javascript
const ollama = new Ollama('http://localhost:11434', 'my_model');
```
4. Use one of the methods to interact with the LLaMA model. For example, to generate text based on a prompt:
```javascript
ollama.generate({prompt: 'Hello, world!'}).then(response => {
console.log(response);
});
```
5. To use streaming responses, pass an object with `stream: true` as the payload. For example:
```javascript
const req = ollama.chat({
messages: [
{role: "system", content: "You are an impish silly assistant."},
{role:"user",content: "Who are you?"}
],
stream: true
});
req.onchunk = console.log;
```
This will log each response chunk to the console as it is received from the server.

That's it! With Ollama.js, you can easily integrate LLaMA models into your JavaScript applications.

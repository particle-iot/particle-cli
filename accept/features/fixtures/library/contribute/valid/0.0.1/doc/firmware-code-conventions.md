### Firmware Code Conventions

In general or where unspecified, use node.js + [npm](https://www.npmjs.org/doc/misc/npm-coding-style.html) for inspiration while respecting the pragmatic realities of embedded programming.  Specifically:

- Use `all-lower-hyphen-css-case` for multiword filenames.
- Use `UpperCamelCase` for class names (things that you'd pass to "new") and namespaces
- Use `lowerCamelCase` for multiword identifiers when they refer to objects, functions, methods, members, or anything not specified in this section.
- Use `CAPS_SNAKE_CASE` for constants, things that should never change and are rarely used.

When using an acronym like `LED` or `JSON` in a class name, file name, or other context above, don't necessarily use all caps.  Instead, let the convention drive the spelling. For example, a class that blinks LEDs would be called `LedBlinker`, and live in a file called `led-blinker.cpp`

- Use two spaces for indentation.
- Prefix variables or functions with an underscore (`_`) when indended for very narrow, restricted, local usage.
- Functions or methods that begin with the name `begin`, are meant to be called in the `setup()` function.
- Curly Brackets should go on the next line after a class or function.

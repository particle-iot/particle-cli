# CLI Refactor


Goals:

- reusable application logic in other node apps (e.g. Particle Dev)

- support machine parseable output and pretty printed output

- automation/scripting support - response files

- TDD/unit tests for components

- integration tests (combining CLI components for end-to-end tests, while mocking external actors)

- acceptance tests

- increased developer documentation, including jsdoc


Strategy:

- Incremental - CLI will remain functional throughout the entire process

- New command implementation that abstracts the command input and command output, as well as
 command invocation. Each command is implemented one at a time until ready.

- use of dependency injection to avoid reliance on global dependencies. This also includes key
 implementation facades, such as Particle-api.js, fs, etc.. so these can be easily mocked/stubbed for
  integration and unit testing.



Outcomes:

- remove reliance on global `settings` and the `global` object - this is injected into each command - increases testability
internationalization?

- remove implementation artefacts from cloud API (e.g. parsing body.error/body.transferRequestId) when claiming a device.

- use yargs parsing, but make a separate part of the command processor
will attempt to parse the commands before command invocation
command parser is passed to the command context so additional parsing can be done as needed
prompts and responses abstracted via command UI instance. Interaction should be as coarsely grained as possible, as dictated by the information flow. (E.g. avoid multiple prompts for successive informations if they are independent. Chatty comms between Command and UI only required if the later UI varies based on earlier actions.)
UI output for plain/color - can we detect a tty vs pipe? yes isatty() and command line flag
events command is looking for "mine" and changing the event name. This should be done in the args parsing code.
Incremental approach:
leave existing commands intact
help command: combines old help and new command help in one output
new commands loaded from a new directory
new commands registered in a new directory as part of the App. The registration describes the command prefix, the type of command parser to use, input/output requirements, reliance on other services (e.g. profile, wifi scanning, serial.)
new commands invoked using new command context providing all the invocation details for the command.
command exit code properly honoured for success/nonsuccess. Commands can further specify the exit code, and the system will not set it according to success/error.

## New Command Structure

- Command comprises core command logic (the command) and a CommandSite object.

- Command:
 - an ES6 object in src/lib/<commandname>.js
 - provides the core application logic, which may exist there, or may delegate to external
   node modules (e.g. cli-library-manager)
 - constructor takes command parameters object, command site object
 - stateless/externally immutable - all state stored in a state object

- CommandSite:
 - encapsulates any interaction required by the command, including additional input not
 - interface is typically command-specific - the interface is an ES6 class declared in the command js file

- CLI implementation of CommandSite:
 - the CLI implementation binds the site interface with the invocation arguments, standard input and
  standard output.
 - For convenience, the CLICommandSite has a method to instantiate the corresponding command. Saving the
    caller from having to instantiate two objects.

- GUI implementation of CommandSite:
 - this exists outside the CLI project, such as

- the base Command/CommandSite in `src/cmd` may be later moved to a separate node package so that the CLI
 contains only the CLICommandSite implementations for each command.



## Migrating from Old to New Command structure

- There is a new command invoker and an old command invoker. They both are implemented as
 methods that take the command line arguments passed to the program.
- The new command invoker is run first, and the response indicates if the command was recognized or not.
- If the command is not recognized, the old command runner is executed.
- The old command runner is based on the present Interpreter class.
- The new command runner is a new class that loads commands from the src/cli directory,
binds the CLI command site and parses arguments.


## Implementation Guidelines for new commands

- all mutable conversation state is stored in the CommandSite instance. static data
may be stored in the command object.

- the command implementation and command site interfaces are quite closely bound
 - the dynamics of the command regarding information needed after the initial invocation,
 and information presented to the user during the command are reflected in the
 interface of the command site.

- global settings and the global object are passed to the site object and relevant
settings fetched via the site object.

- references to globals/environment should be avoided and instead injected via the comamnd site. Examples are
    `process.argv`, `process.stdin`, `process.stdout`. The command execution can set a result on the site. The
    site handles that result in an invocation specific way (e.g. setting a non-zero return code for the CLI.)

- leverage TDD principles to help drive implementation of the command into decoupled, separately testable pieces,
 especially in areas where functions grow to more than a handful of lines of code

- leverage acceptance testing and document driven testing to describe the
 externally visible interface before writing code (command arguments, expected output, both
 machine readable lines/json and pretty printed.)

- the CLICommandSite instance provides convenience methods for test/json/template output, and
for CLI input.

- The existing Category/Command classes can be renamed CLICommandCategory and CLICommand to
show their intent as CLI-focused commands (in contrast to UI-neutral commands.)

- CLICommand may have a register() function that registers the command execution, documentation.
Presently this is done in the run() method which seems to tightly couple registration with execution.

## Extensions for flexibility/enabling testing

Generally, all hard-coded external dependencies should be overridable. Some examples:

- allow the profile directory and current profile to be specified on the command line. The settings are transient and
    affect only the current execution.
- allow the location of settings.js and the settings override file to be specified on the command line





## Dependencies

The project has a number of dependencies. To get a better
idea what these do, run

```
npm install -g package-describe
package-describe
```

## Suggestions for Cleanup

- separate command from input/output
- commands can return promises, and the invoker manages catching exceptions, and progress updates for long running commands.
- move input/output from BaseCommand to collaborator classes, allowing input/output to be more easily mocked
- avoid direct wrotes to console.log() - output handled by an outputter strategy instance
- use nopts to centralize command parsing - command parameters are provided as a map to each command
- commands API is a node API rather than a command-line (args/input/output/error streams)
  so they can be more easily reused in other projects
- with input/output managed as a strategy, pretty printing/coloring or raw command output will simple to implement
- avoid hard-coded strings for UX, so i18n becomes possible
- add eslint rules to help enforce best practices writing interface-independent commands
- end to end tests for all commands
- ES6/7
- add version check for node early on startup to validate version requirements?
